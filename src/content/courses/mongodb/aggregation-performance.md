---
title: Aggregation Performance with merge and out
slug: aggregation-performance
metadescription: Make aggregation pipelines fast. Learn stage ordering, index use, memory limits and allowDiskUse, and how to build materialised views with $merge and $out.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 4
tags: ['mongodb', 'aggregation', 'performance', 'indexes']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- Why the **order of stages** decides how fast a pipeline is
- Which stages can use an **index**, and how to check with `explain`
- How the **100 MB memory limit** works and what `allowDiskUse` does
- What the built-in **pipeline optimiser** already does for you
- How to build **materialised views** with `$out` and `$merge`, and when to pick each

> **Before you start:** this lesson assumes you've read [Core Stages: match, project, group and sort](/courses/mongodb/core-aggregation-stages), [Joining Collections with lookup](/courses/mongodb/lookup-and-joins) and [explain and Query Plans](/courses/mongodb/explain-and-query-plans). Everything here runs on a local MongoDB.

## How a pipeline really runs

An aggregation pipeline is a conveyor belt. Documents enter at the first stage, get changed, and move to the next stage. Every stage only sees what the previous stage passed on.

That means two simple facts decide speed:

1. **How many documents enter the belt** at the start.
2. **How much work** each stage does on each document.

> **Think of it like this:** Imagine sorting a sack of mail. If you first throw away everything that isn't addressed to your street, you only sort a handful of letters. If you sort the whole sack first and filter later, you've done hours of useless work.

Let's set up some orders to experiment with:

```javascript
use shop

// Make 50,000 fake orders
const statuses = ["pending", "shipped", "delivered"];
const docs = [];
for (let i = 0; i < 50000; i++) {
  docs.push({
    customerId: ObjectId(),
    items: [{ name: "Notebook", qty: 1 + (i % 4), price: 49 }],
    total: 49 * (1 + (i % 4)),
    status: statuses[i % 3],
    createdAt: new Date(Date.UTC(2026, 0, 1) + (i % 298) * 86400000)
  });
}
db.orders.insertMany(docs)
// → { acknowledged: true, insertedIds: { ... } }
```

## Rule 1: filter first with $match

Put `$match` as close to the **start** as possible. A `$match` at the very beginning can use an index, just like `find()`.

Here is a slow version. It calculates a field for **every** order and only then filters:

```javascript
// Slow: work on 50,000 docs, then throw most away
db.orders.aggregate([
  { $addFields: { year: { $year: "$createdAt" } } },
  { $group: { _id: "$status", revenue: { $sum: "$total" } } },
  { $match: { _id: "delivered" } }
])
```

And here is the fast version. It filters first, then groups only what is left:

```javascript
// Fast: filter first, then group
db.orders.aggregate([
  { $match: { status: "delivered" } },
  { $group: { _id: "$status", revenue: { $sum: "$total" } } }
])
// → [ { _id: 'delivered', revenue: 2041585 } ]
```

Now add an index so the `$match` doesn't scan the whole collection:

```javascript
db.orders.createIndex({ status: 1, createdAt: 1 })
```

### Check it with explain

You can call `explain` on a pipeline just like on `find`:

```javascript
db.orders.explain("executionStats").aggregate([
  { $match: { status: "delivered", createdAt: { $gte: ISODate("2026-06-01") } } },
  { $group: { _id: null, revenue: { $sum: "$total" } } }
])
```

The output is long. Look for the plan stage and the counts (simplified here):

```javascript
// winningPlan: { stage: 'IXSCAN', indexName: 'status_1_createdAt_1', ... }
// executionStats: { nReturned: 8210, totalKeysExamined: 8210, totalDocsExamined: 8210, ... }
```

`IXSCAN` means the index was used. If you see `COLLSCAN` instead, MongoDB read every document. That is your cue to add or fix an index, or move `$match` earlier.

### Which stages can use an index?

Only stages at the **start** of the pipeline (before any stage that reshapes documents) can use an index:

| Stage | Can use an index? |
| --- | --- |
| `$match` at the start | Yes |
| `$sort` at the start (or right after the first `$match`) | Yes |
| `$geoNear` | Yes (must be the first stage) |
| `$lookup` | Yes, for the **foreign** collection's `foreignField` |
| `$group`, `$project`, `$unwind`, `$addFields` | No, they work on documents in memory |
| `$match` after `$group` | No, the documents no longer come from the collection |

## Rule 2: sort and limit together

`$sort` on a big set is expensive. If you only need the top few results, put `$limit` **right after** `$sort`. MongoDB then keeps only the top N in memory instead of sorting everything.

```javascript
// The 5 biggest delivered orders
db.orders.aggregate([
  { $match: { status: "delivered" } },
  { $sort: { total: -1 } },
  { $limit: 5 },
  { $project: { _id: 0, total: 1, createdAt: 1 } }
])
```

Even better, if an index covers both the filter and the sort (for example `{ status: 1, total: -1 }`), the sort comes straight from the index and no in-memory sort is needed at all.

## Rule 3: let $project shape the output, not "speed things up"

A common tip online is "add `$project` early to drop fields". In modern MongoDB this is usually **not needed**. The optimiser looks at which fields the pipeline actually uses and only carries those.

Adding `$project` too early can even hurt, because it can stop the optimiser from moving other stages around.

> **Tip:** Use `$project` (or `$unset`) mainly to **shape the final result** you send to your app. Keep the output small, especially before `$lookup`, `$out` and `$merge`, and before sending data over the network.

## Rule 4: make $lookup cheap

`$lookup` runs a query on the other collection **for each document** that reaches it. Two rules keep it fast:

1. **Index the `foreignField`.** Otherwise each lookup scans the whole foreign collection.
2. **Reduce documents before `$lookup`.** Filter, sort and limit first, then join.

```javascript
// customers._id is always indexed, so this join is cheap
db.orders.aggregate([
  { $match: { status: "pending" } },
  { $sort: { createdAt: -1 } },
  { $limit: 20 },                         // join only 20 orders, not 16,667
  {
    $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
    }
  },
  { $unwind: "$customer" },
  { $project: { total: 1, createdAt: 1, "customer.name": 1, "customer.email": 1 } }
])
```

## Rule 5: know the memory limit

Stages like `$group`, `$sort` and `$bucket` collect documents in memory. Each such stage can use up to **100 MB** of RAM. What happens above that depends on `allowDiskUse`:

- Since MongoDB 6.0, the server setting `allowDiskUseByDefault` is **true**, so big stages **spill to temporary files on disk** automatically.
- You can still pass the option per pipeline:

```javascript
// Force the pipeline to fail instead of using disk
db.orders.aggregate(
  [
    { $group: { _id: "$customerId", spent: { $sum: "$total" } } },
    { $sort: { spent: -1 } }
  ],
  { allowDiskUse: false }
)
// → MongoServerError: ... Exceeded memory limit ... (only if over 100 MB)
```

Spilling to disk works, but it is much slower than memory. Treat it as a safety net, not a plan. If `explain("executionStats")` shows `usedDisk: true`, try to filter more, group on fewer documents, or pre-compute results (see materialised views below).

> **Note:** Some shared Atlas tiers have extra aggregation limits. Check the limits page for your tier before relying on disk spilling there.

## What the optimiser already does

MongoDB rewrites your pipeline before running it. A few things it does automatically:

- **Moves `$match` earlier** when it only uses fields that existed before an `$addFields` or `$project`.
- **Merges `$sort` + `$limit`** into a single "top N" step.
- **Merges `$lookup` + `$unwind`** on the same field, so it never builds a huge array first.
- **Combines** neighbouring `$match` stages or neighbouring `$limit` stages.

You can see the rewritten pipeline in the `explain` output. It is a good way to learn: write a pipeline, explain it, and compare.

> **Tip:** The optimiser is smart, but it can't read your mind. If your filter depends on a computed field, compute and filter as early as possible yourself, or store that value in the document so `$match` can use an index.

## Materialised views: pre-computing results

Some pipelines are expensive no matter how well you tune them. "Revenue per day for the whole year" might scan millions of orders. If your dashboard runs it on every page load, the database suffers.

The fix is to run the pipeline **once**, save the result in a collection, and let the dashboard read that small collection. This saved result is called a **materialised view**.

> **Think of it like this:** Instead of counting every coin in the shop's till each time someone asks "how much did we make today?", the cashier writes the total in a notebook every evening. Anyone can read the notebook instantly.

MongoDB gives you two stages to write pipeline results into a collection: `$out` and `$merge`. Both must be the **last** stage.

### $out: replace the whole collection

`$out` writes the results into a collection and **replaces** whatever was there before:

```javascript
db.orders.aggregate([
  { $match: { status: "delivered" } },
  {
    $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
      revenue: { $sum: "$total" },
      orders: { $sum: 1 }
    }
  },
  { $out: "daily_revenue" }
])

db.daily_revenue.find().sort({ _id: 1 }).limit(2)
// → [ { _id: '2026-01-01', revenue: 5488, orders: 56 },
//     { _id: '2026-01-02', revenue: 8232, orders: 56 } ]
```

Good to know about `$out`:

- It builds the new data in a temporary collection and swaps it in at the end, so readers never see a half-written collection.
- It always recomputes **everything**, which is fine for small results but wasteful for big ones.
- It can write to another database: `{ $out: { db: "reports", coll: "daily_revenue" } }`.
- It **cannot** write to a sharded collection.

### $merge: update only what changed

`$merge` is more flexible. It **merges** each result document into the target collection, matching on a field (by default `_id`):

```javascript
db.orders.aggregate([
  { $match: { status: "delivered", createdAt: { $gte: ISODate("2026-10-24") } } },  // only recent days
  {
    $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
      revenue: { $sum: "$total" },
      orders: { $sum: 1 }
    }
  },
  {
    $merge: {
      into: "daily_revenue",
      on: "_id",
      whenMatched: "replace",     // day already exists → overwrite it
      whenNotMatched: "insert"    // new day → add it
    }
  }
])
```

This is an **incremental refresh**. Each night you only recompute the last day or two, and older days stay as they are. On a big collection that is hundreds of times less work than a full `$out`.

Your options for each case:

| Option | Choices |
| --- | --- |
| `whenMatched` | `"replace"`, `"merge"` (combine fields), `"keepExisting"`, `"fail"`, or an update pipeline |
| `whenNotMatched` | `"insert"`, `"discard"`, `"fail"` |

> **Warning:** If `on` is a field other than `_id`, the target collection must have a **unique index** on that field (or fields), or `$merge` throws an error.

### $out vs $merge at a glance

| | `$out` | `$merge` |
| --- | --- | --- |
| What happens to old data | Whole collection replaced | Matching docs updated, others kept |
| Incremental refresh | No | Yes |
| Write to a sharded collection | No | Yes |
| Write to another database | Yes | Yes |
| Best for | Small, full rebuilds | Growing summaries, incremental updates |

### Keeping the view fresh

A materialised view is only as fresh as its last refresh. Run the `$merge` pipeline on a schedule, for example from a nightly cron job in your app, or a scheduled trigger if you use Atlas. Then make sure readers know how fresh the data is, for instance by storing an `updatedAt` field:

```javascript
{ $set: { updatedAt: "$$NOW" } }   // add this stage just before $merge
```

> **Note:** A normal **view** (made with `db.createView`) is different. It saves only the pipeline and runs it again on every read. It is always fresh but never faster than running the pipeline yourself. A materialised view trades a little freshness for a lot of speed.

## Common mistakes

- **Filtering late.** A `$match` after `$group` or `$unwind` can't use indexes and runs on far more documents. Move it to the top whenever possible.
- **Sorting without a limit or an index.** Large in-memory sorts hit the 100 MB limit and spill to disk. Add `$limit` right after `$sort`, or an index that matches the sort.
- **No index on the `$lookup` foreign field.** Every joined document triggers a full scan of the other collection.
- **Using `$out` for a huge summary that changes a little each day.** Use `$merge` with a date filter for incremental refreshes.
- **Relying on disk spilling.** `usedDisk: true` in explain means the pipeline is doing too much work. Reduce data earlier or pre-compute.

## Practice

1. Rewrite this pipeline so it is efficient: `[{ $unwind: "$items" }, { $match: { status: "shipped" } }, { $group: { _id: "$items.name", qty: { $sum: "$items.qty" } } }]`.
2. Build a materialised view `category_stock` with one document per product category and the total stock, using `$merge`.
3. Which index would help a pipeline that starts with `{ $match: { status: "pending" } }, { $sort: { createdAt: -1 } }`?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Filter before unwinding
db.orders.aggregate([
  { $match: { status: "shipped" } },
  { $unwind: "$items" },
  { $group: { _id: "$items.name", qty: { $sum: "$items.qty" } } }
])

// 2. Materialised view of stock per category
db.products.aggregate([
  { $group: { _id: "$category", totalStock: { $sum: "$stock" }, products: { $sum: 1 } } },
  { $set: { updatedAt: "$$NOW" } },
  { $merge: { into: "category_stock", on: "_id", whenMatched: "replace", whenNotMatched: "insert" } }
])
db.category_stock.find()
// → [ { _id: 'stationery', totalStock: 620, products: 2, updatedAt: ... }, ... ]

// 3. An index on the equality field first, then the sort field
db.orders.createIndex({ status: 1, createdAt: -1 })
```

</details>

## Key takeaways

- Pipelines are conveyor belts: **fewer documents early** means less work everywhere.
- Only stages at the **start** (`$match`, `$sort`, `$geoNear`) can use indexes. Check with `explain("executionStats")`.
- Put `$limit` right after `$sort`, and index the `foreignField` of every `$lookup`.
- Blocking stages have a **100 MB** memory limit; since 6.0 they spill to disk by default, which is slow. Treat `usedDisk: true` as a warning.
- Use **`$out`** to rebuild a whole result collection and **`$merge`** for incremental, upsert-style materialised views.

**Next lesson:** [Multi-Region and Global Clusters](/courses/mongodb/multi-region-clusters)
