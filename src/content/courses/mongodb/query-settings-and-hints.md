---
title: Query Settings and Index Hints
slug: query-settings-and-hints
metadescription: Learn how to steer MongoDB's query planner with hint(), why index filters are deprecated, and how MongoDB 8.0 query settings fix or block a query shape cluster-wide.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'query-settings', 'indexes', 'performance']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [explain and Query Plans](/courses/mongodb/explain-and-query-plans) and [The Cost-Based Ranker](/courses/mongodb/cost-based-ranker).

## What you will learn

By the end of this lesson you will know:

- Why the query planner sometimes picks the "wrong" index
- How to force an index for one query with `.hint()`
- What **index filters** were, and why MongoDB 8.0 deprecated them
- What a **query shape** is
- How to use **query settings** (`setQuerySettings`, `$querySettings`, `removeQuerySettings`) to pin an index or block a bad query everywhere, without changing app code

You can try everything here locally. Query settings are available in MongoDB Community, Enterprise and Atlas (but not on Atlas M0 free or Flex clusters). Because they are stored cluster-wide, run them on a replica set (a single-node replica set is fine) or through `mongos` on a sharded cluster.

## Why would the planner choose badly?

When a query could use several indexes, MongoDB's **query planner** picks one. It usually picks well. Sometimes it doesn't, for example:

- The data changed a lot since the plan was cached.
- Two indexes look equally good on a small sample but behave very differently on the full data.
- A query is rare and unusual, and the planner's estimate is off.

> **Think of it like this:** A GPS app chooses your route. Most days it's right. But you know the "fast" road is closed for repairs this month. You want a way to say "take the other road", either for one trip (`hint`) or for everyone in the city until the repairs finish (query settings).

## Our example data

We'll use the `shop.orders` collection with two indexes:

```javascript
use shop
db.orders.createIndex({ status: 1 })                    // status_1
db.orders.createIndex({ customerId: 1, createdAt: -1 }) // customerId_1_createdAt_-1
```

And this common query:

```javascript
db.orders.find({ status: "pending", customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") })
  .sort({ createdAt: -1 })
```

Imagine the planner picks `status_1`, but 90% of orders are pending, so it reads far too many documents. The `customerId_1_createdAt_-1` index would be much better.

## Option 1: hint() for one query

`.hint()` tells MongoDB which index to use for **this one query**. You can pass the index key pattern:

```javascript
db.orders.find({ status: "pending", customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") })
  .sort({ createdAt: -1 })
  .hint({ customerId: 1, createdAt: -1 })
```

Or the index name:

```javascript
db.orders.find({ status: "pending", customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") })
  .sort({ createdAt: -1 })
  .hint("customerId_1_createdAt_-1")
```

Check with `explain()` that it worked:

```javascript
db.orders.find({ status: "pending", customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") })
  .sort({ createdAt: -1 })
  .hint("customerId_1_createdAt_-1")
  .explain().queryPlanner.winningPlan
// → { stage: 'FETCH', inputStage: { stage: 'IXSCAN', indexName: 'customerId_1_createdAt_-1', ... } }
```

`hint` works on aggregations too:

```javascript
db.orders.aggregate(
  [ { $match: { status: "pending" } }, { $group: { _id: "$customerId", n: { $sum: 1 } } } ],
  { hint: "status_1" }
)
```

And `{ $natural: 1 }` forces a **collection scan**, which is occasionally useful for testing:

```javascript
db.orders.find({ status: "pending" }).hint({ $natural: 1 })
```

### The problem with hint()

`hint` lives in your **application code**. To change it you edit code, test and deploy. If the slow query comes from a library, a reporting tool, or another team's service, you may not be able to change it at all.

> **Warning:** If you hint an index that doesn't exist (for example, someone dropped it), the query **fails** with an error. Hints in code can break when indexes change.

## Option 2 (old): index filters

Before MongoDB 8.0 you could set an **index filter** on the server with `planCacheSetFilter`. It said "for queries of this shape, only consider these indexes":

```javascript
// Old approach, deprecated in MongoDB 8.0
db.runCommand({
  planCacheSetFilter: "orders",
  query: { status: "pending", customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") },
  sort: { createdAt: -1 },
  indexes: [ { customerId: 1, createdAt: -1 } ]
})
```

Index filters had big weaknesses:

- They were **not persistent**. A server restart wiped them.
- They applied to **one `mongod` only**. On a replica set or sharded cluster, you had to set them on every member yourself.

MongoDB 8.0 **deprecated index filters** (`planCacheSetFilter`, `planCacheListFilters`, `planCacheClearFilters`). Use query settings instead.

## What is a query shape?

Query settings attach to a **query shape**, so let's understand that first.

A query shape is the "outline" of a query: which fields it filters on, which operators it uses, how it sorts and projects. The actual **values** don't matter.

These two queries have the **same shape**:

```javascript
db.orders.find({ status: "pending", customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") }).sort({ createdAt: -1 })
db.orders.find({ status: "shipped", customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c1") }).sort({ createdAt: -1 })
```

This one has a **different shape**, because it adds a range on `total`:

```javascript
db.orders.find({ status: "pending", total: { $gt: 500 } }).sort({ createdAt: -1 })
```

> **Think of it like this:** A query shape is a form with blanks. "Find orders where status is ____ and customer is ____, newest first." Everyone fills in different values, but it's the same form.

Each shape gets a long ID called the **query shape hash**.

## Option 3 (new): query settings

**Query settings** (MongoDB 8.0+) let you attach instructions to a query shape on the **server**. They are:

- **Persistent:** they survive restarts.
- **Cluster-wide:** set once, used by every member of the replica set or sharded cluster.
- **Code-free:** the app keeps sending the same query and doesn't need to change.

### Setting an index hint

You run `setQuerySettings` on the admin database. You give it an example of the query (as a command document, plus `$db`), and the settings you want:

```javascript
db.adminCommand({
  setQuerySettings: {
    find: "orders",
    filter: { status: "pending", customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") },
    sort: { createdAt: -1 },
    $db: "shop"
  },
  settings: {
    indexHints: {
      ns: { db: "shop", coll: "orders" },
      allowedIndexes: [ "customerId_1_createdAt_-1" ]
    },
    comment: "status_1 reads too many docs; use customer index (ticket OPS-42)"
  }
})
```

```javascript
// → { queryShapeHash: 'AB8ECADEE8F0EB0F447A30744EB4813AE7E0BFEF523B0870CA10FCBC87F5D8F1',
//     settings: { indexHints: [ ... ], comment: '...' },
//     representativeQuery: { find: 'orders', filter: { ... }, sort: { createdAt: -1 }, '$db': 'shop' },
//     ok: 1 }
```

From now on, **every** query with this shape (any status, any customer) may only use the indexes in `allowedIndexes`.

The settings you can use are:

| Setting | What it does |
| --- | --- |
| `indexHints` | Limits the planner to the listed indexes (names, key patterns, or `{ $natural: 1 }`) for a namespace |
| `queryFramework` | Chooses the execution engine: `"classic"` or `"sbe"` (advanced, rarely needed) |
| `reject` | If `true`, new queries of this shape are refused with an error |
| `comment` | A note for humans that shows up in `$querySettings`, `explain()` and slow query logs (8.0.4+ and 8.1+) |

> **Tip:** Always add a `comment` explaining **why** the setting exists. Six months later, someone will be glad you did.

> **Note:** MongoDB 9.0 adds more settings here, such as a per-shape `maxTimeMS` and `queryKnobs`, and lets you pass `querySettings` directly on a single `find`, `distinct` or `aggregate`. This lesson sticks to what works in 8.x.

### Confirming it with explain

```javascript
db.orders.find({ status: "shipped", customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c1") })
  .sort({ createdAt: -1 })
  .explain().queryPlanner
// → { ..., querySettings: { indexHints: { ns: {...}, allowedIndexes: [ 'customerId_1_createdAt_-1' ] },
//          comment: 'status_1 reads too many docs; ...' },
//     winningPlan: { ... indexName: 'customerId_1_createdAt_-1' ... } }
```

Notice we used different values, and the setting still applied. That's the power of shapes.

### It works for aggregate and distinct too

```javascript
db.adminCommand({
  setQuerySettings: {
    aggregate: "orders",
    pipeline: [
      { $match: { status: "pending" } },
      { $group: { _id: "$customerId", n: { $sum: 1 } } }
    ],
    $db: "shop"
  },
  settings: {
    indexHints: { ns: { db: "shop", coll: "orders" }, allowedIndexes: [ "status_1" ] }
  }
})
```

### Blocking a dangerous query

Sometimes a bad query, maybe from a buggy release, is hammering the database. Query settings can act as an **emergency brake**:

```javascript
db.adminCommand({
  setQuerySettings: {
    find: "orders",
    filter: { "items.name": "Notebook" },
    $db: "shop"
  },
  settings: {
    reject: true,
    comment: "Unindexed scan from release 4.2.0, blocked until hotfix"
  }
})
```

Now that shape fails immediately instead of scanning millions of documents. Queries already running are not affected; use `db.killOp()` for those.

> **Warning:** `reject: true` breaks whatever feature sends that query. Use it only to protect the whole database, and tell the app team straight away.

## Listing query settings

The `$querySettings` aggregation stage shows every query setting in the cluster. Run it on the `admin` database:

```javascript
db.getSiblingDB("admin").aggregate([
  { $querySettings: { showDebugQueryShape: true } }
])
```

```javascript
[
  {
    queryShapeHash: 'AB8ECADEE8F0EB0F447A30744EB4813AE7E0BFEF523B0870CA10FCBC87F5D8F1',
    settings: {
      indexHints: [ { ns: { db: 'shop', coll: 'orders' }, allowedIndexes: [ 'customerId_1_createdAt_-1' ] } ],
      comment: 'status_1 reads too many docs; use customer index (ticket OPS-42)'
    },
    representativeQuery: { find: 'orders', filter: { ... }, sort: { createdAt: -1 }, '$db': 'shop' },
    debugQueryShape: {
      cmdNs: { db: 'shop', coll: 'orders' },
      command: 'find',
      filter: { status: { '$eq': '?string' }, customerId: { '$eq': '?objectId' } },
      sort: { createdAt: -1 }
    }
  }
]
```

`debugQueryShape` shows the shape with placeholders like `?string` where values would go. It's a nice way to see what "same shape" really means.

You can also set query settings by **hash** instead of by example query. You find a hash in `$querySettings`, the slow query log or the profiler:

```javascript
db.adminCommand({
  setQuerySettings: "AB8ECADEE8F0EB0F447A30744EB4813AE7E0BFEF523B0870CA10FCBC87F5D8F1",
  settings: { indexHints: { ns: { db: "shop", coll: "orders" }, allowedIndexes: [ "status_1" ] } }
})
```

## Removing query settings

When the problem is fixed (for example, you added a better index), remove the setting. You can use the hash:

```javascript
db.adminCommand({
  removeQuerySettings: "AB8ECADEE8F0EB0F447A30744EB4813AE7E0BFEF523B0870CA10FCBC87F5D8F1"
})
```

Or an example query with the same shape (the values don't have to match):

```javascript
db.adminCommand({
  removeQuerySettings: {
    find: "orders",
    filter: { status: "any", customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") },
    sort: { createdAt: -1 },
    $db: "shop"
  }
})
```

> **Note:** To un-block a rejected shape, either run `setQuerySettings` again with `reject: false` **plus** at least one other setting, or simply remove the settings with `removeQuerySettings`.

## Which one should I use?

| | `.hint()` | Index filters | Query settings |
| --- | --- | --- | --- |
| Where it lives | App code | One server's memory | Cluster metadata |
| Survives restart | Yes (it's in code) | No | Yes |
| Applies to all members | Yes | No, set on each | Yes |
| Needs code change | Yes | No | No |
| Can block a query | No | No | Yes (`reject`) |
| Status | Supported | **Deprecated in 8.0** | Recommended (8.0+) |

**Rule of thumb:** first try to fix the root cause (a better index, or let the cost-based ranker do its job). Use `.hint()` when you own the code and want a permanent, visible choice. Use query settings when you need a quick, server-side fix, or need to block a harmful query.

If a query setting with `indexHints` matches, it **wins** over a `.hint()` in the query.

## Common mistakes

- **Hinting an index that later gets dropped.** A `.hint()` to a missing index makes the query fail. Search your code before dropping an index.
- **Expecting query settings to match "similar" queries.** They match an exact **shape**. Adding a field to the filter or changing the sort makes a new shape.
- **Forgetting `$db` and `ns`.** `setQuerySettings` needs `$db` in the query part and `ns: { db, coll }` inside `indexHints`.
- **Leaving old settings forever.** A setting that helped last year may hurt after the data changes. Review `$querySettings` regularly and use `comment` to explain each one.
- **Still using `planCacheSetFilter`.** It is deprecated and lost on restart. Move to query settings.

## Practice

1. Write a `find` on `shop.products` filtering by `category` and sorting by `price`, forcing the index `category_1_price_1` with `.hint()`.
2. Use `setQuerySettings` so that every query of the shape `find products where category = ? sort by price` may only use `category_1_price_1`. Add a comment.
3. List all query settings, then remove the one you just created.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. One-off hint
db.products.createIndex({ category: 1, price: 1 })
db.products.find({ category: "electronics" }).sort({ price: 1 }).hint("category_1_price_1")

// 2. Cluster-wide query setting
db.adminCommand({
  setQuerySettings: {
    find: "products",
    filter: { category: "electronics" },
    sort: { price: 1 },
    $db: "shop"
  },
  settings: {
    indexHints: { ns: { db: "shop", coll: "products" }, allowedIndexes: [ "category_1_price_1" ] },
    comment: "Pin category/price index for catalogue page"
  }
})

// 3. List and remove (any category value gives the same shape)
db.getSiblingDB("admin").aggregate([ { $querySettings: {} } ])
db.adminCommand({
  removeQuerySettings: {
    find: "products",
    filter: { category: "kitchen" },
    sort: { price: 1 },
    $db: "shop"
  }
})
```

</details>

## Key takeaways

- `.hint()` forces an index for **one query**, but it lives in app code and fails if the index disappears.
- **Index filters** were per-server and lost on restart. They are **deprecated in MongoDB 8.0**.
- A **query shape** is a query with its values blanked out. Query settings attach to shapes.
- `setQuerySettings` (8.0+) can pin indexes, choose the engine, add a comment, or **reject** a shape, cluster-wide and persistently.
- List settings with the `$querySettings` stage and delete them with `removeQuerySettings`. Prefer fixing the root cause first.

**Next lesson:** [Atlas Search and the search Stage](/courses/mongodb/atlas-search)
