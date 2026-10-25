---
title: explain and Query Plans
slug: explain-and-query-plans
metadescription: Learn how to use explain() in MongoDB to see query plans, read COLLSCAN, IXSCAN and FETCH stages, and check whether your indexes really work.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'explain', 'indexes', 'performance']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What a **query plan** is and who chooses it
- How to run `explain()` and its three **verbosity modes**
- How to read the most important parts of the output: stages, `nReturned`, `totalKeysExamined` and `totalDocsExamined`
- How to spot a slow query and fix it with an index
- What winning plans, rejected plans and the plan cache are

> **Before you start:** this lesson assumes you've read [Single Field and Compound Indexes](/courses/mongodb/indexes-single-and-compound).

## What is a query plan?

When you send a query, MongoDB doesn't just start reading. First, a part of the server called the **query planner** decides *how* to run it:

- Should it read every document (a collection scan)?
- Should it use an index? Which one, if there are several?
- Does it need to sort the results in memory, or does an index already give them in order?

The chosen recipe is called the **query plan**. `explain()` lets you see that plan, and how well it performed.

> **Think of it like this:** You ask a delivery app to get you from home to the station. The app (the planner) looks at a few routes, picks one (the plan), and `explain()` is like tapping "show route details": which roads, how many turns, how long it took.

## Running explain()

Add `.explain()` to the end of a `find`:

```javascript
use shop
db.products.find({ category: "electronics" }).explain()
```

Or put `explain()` before the operation. This form also works for `aggregate`:

```javascript
db.products.explain().find({ category: "electronics" })

db.products.explain().aggregate([
  { $match: { category: "electronics" } },
  { $group: { _id: null, avgPrice: { $avg: "$price" } } }
])
```

> **Note:** `explain()` with the default mode does **not** run your query. It only shows the plan. That makes it safe to try on big collections.

## The three verbosity modes

You choose how much detail you want by passing a mode:

| Mode | Runs the query? | What you get |
| --- | --- | --- |
| `"queryPlanner"` (default) | No | The winning plan and rejected plans |
| `"executionStats"` | Yes | The plan **plus** real numbers: documents returned, keys and documents examined, time taken |
| `"allPlansExecution"` | Yes | Everything above, plus partial stats for the rejected plans gathered while choosing |

Most of the time you want `"executionStats"`:

```javascript
db.products.find({ category: "electronics" }).explain("executionStats")
```

> **Warning:** `"executionStats"` really runs the query. For a heavy query on a production server, that means real load. Try it on a copy or during quiet hours.

## A slow query, step by step

Let's look at a query with **no** helpful index yet. First, make sure only the `_id` index exists on `products`:

```javascript
db.products.dropIndexes()   // drops all indexes except _id
```

Now explain a query:

```javascript
db.products.find({ category: "electronics", price: { $lt: 1000 } }).explain("executionStats")
```

Here is the trimmed output, showing the parts that matter:

```javascript
{
  explainVersion: '1',
  queryPlanner: {
    namespace: 'shop.products',
    parsedQuery: { '$and': [ { category: { '$eq': 'electronics' } }, { price: { '$lt': 1000 } } ] },
    winningPlan: {
      stage: 'COLLSCAN',
      filter: { '$and': [ { category: { '$eq': 'electronics' } }, { price: { '$lt': 1000 } } ] },
      direction: 'forward'
    },
    rejectedPlans: []
  },
  executionStats: {
    executionSuccess: true,
    nReturned: 1,
    executionTimeMillis: 0,
    totalKeysExamined: 0,
    totalDocsExamined: 5
  }
}
```

Let's read it:

- `stage: 'COLLSCAN'`: MongoDB read the **whole collection**.
- `totalDocsExamined: 5`: it looked at all 5 products.
- `nReturned: 1`: only 1 matched (the USB Cable).

Looking at 5 documents to return 1 is fine now, but with 5 million products it would be a disaster.

## Fixing it with an index

Let's add an index that follows the ESR rule (equality on `category`, range on `price`):

```javascript
db.products.createIndex({ category: 1, price: 1 })
```

Run the same explain again:

```javascript
db.products.find({ category: "electronics", price: { $lt: 1000 } }).explain("executionStats")
```

Trimmed output:

```javascript
{
  queryPlanner: {
    winningPlan: {
      stage: 'FETCH',
      inputStage: {
        stage: 'IXSCAN',
        keyPattern: { category: 1, price: 1 },
        indexName: 'category_1_price_1',
        isMultiKey: false,
        direction: 'forward',
        indexBounds: {
          category: [ '["electronics", "electronics"]' ],
          price: [ '[-inf.0, 1000)' ]
        }
      }
    },
    rejectedPlans: []
  },
  executionStats: {
    nReturned: 1,
    executionTimeMillis: 0,
    totalKeysExamined: 1,
    totalDocsExamined: 1
  }
}
```

Now:

- `IXSCAN` used `category_1_price_1`.
- `indexBounds` shows MongoDB only scanned the "electronics, price below 1000" slice of the index.
- `totalKeysExamined: 1`, `totalDocsExamined: 1`, `nReturned: 1`. Perfect.

> **Tip:** Read the plan **from the inside out**. The innermost `inputStage` runs first and passes its results up to its parent. Here: `IXSCAN` finds index entries, then `FETCH` loads the matching documents.

## The three numbers to watch

| Field | Meaning |
| --- | --- |
| `nReturned` | How many documents the query returned. |
| `totalKeysExamined` | How many index entries were scanned. |
| `totalDocsExamined` | How many documents were loaded and checked. |

For a great query, all three are close to each other: **1 : 1 : 1** is the ideal. Warning signs:

- `totalDocsExamined` is much larger than `nReturned`: MongoDB is reading lots of documents and throwing them away. You probably need a better index.
- `totalKeysExamined` is much larger than `nReturned`: the index is being used, but poorly. Check the field order (ESR).
- `totalKeysExamined: 0` with a big `totalDocsExamined`: a collection scan.

`executionTimeMillis` is useful too, but on tiny test data it's always 0. Trust the ratios more than the time.

## Common stages you will see

| Stage | Meaning | Good or bad? |
| --- | --- | --- |
| `COLLSCAN` | Read every document | Bad on big collections |
| `IXSCAN` | Scan part of an index | Good |
| `FETCH` | Load full documents for index entries | Normal |
| `SORT` | Sort results in memory | Fine for small results; consider an index for big ones |
| `LIMIT` / `SKIP` | Apply `.limit()` / `.skip()` | Normal |
| `PROJECTION_SIMPLE` / `PROJECTION_DEFAULT` | Apply your projection | Normal |
| `PROJECTION_COVERED` | Projection answered from the index alone | Excellent (covered query) |
| `EXPRESS_IXSCAN` | A fast path for very simple lookups, such as an exact `_id` match | Excellent (MongoDB 8.0+) |

### Spotting an in-memory sort

Let's sort by `rating`, which isn't in our index:

```javascript
db.products.find({ category: "electronics" }).sort({ rating: -1 }).explain().queryPlanner.winningPlan
// → {
//     stage: 'SORT',
//     sortPattern: { rating: -1 },
//     inputStage: { stage: 'FETCH', inputStage: { stage: 'IXSCAN', indexName: 'category_1_price_1', ... } }
//   }
```

The `SORT` stage means MongoDB collected the results and sorted them in memory. On large results that is slow, and big sorts may need to spill to disk. An index like `{ category: 1, rating: -1 }` would give the results already in order, and the `SORT` stage would disappear.

### Spotting a covered query

```javascript
db.products.find({ category: "kitchen" }, { _id: 0, category: 1, price: 1 }).explain("executionStats")
// winningPlan → { stage: 'PROJECTION_COVERED', inputStage: { stage: 'IXSCAN', ... } }
// executionStats → { nReturned: 1, totalKeysExamined: 1, totalDocsExamined: 0 }
```

`totalDocsExamined: 0` and no `FETCH` stage: MongoDB answered entirely from the index.

## Winning plans and rejected plans

When several indexes could work, the planner tries the candidates and picks one. Let's create a second index:

```javascript
db.products.createIndex({ price: 1 })

db.products.find({ category: "electronics", price: { $lt: 1000 } }).explain()
```

Now `rejectedPlans` is no longer empty:

```javascript
{
  queryPlanner: {
    winningPlan:   { stage: 'FETCH', inputStage: { stage: 'IXSCAN', indexName: 'category_1_price_1', ... } },
    rejectedPlans: [
      { stage: 'FETCH', filter: { category: { '$eq': 'electronics' } },
        inputStage: { stage: 'IXSCAN', indexName: 'price_1', ... } }
    ]
  }
}
```

The planner considered using `price_1` (and then filtering by category) but chose the compound index because it did less work.

> **Note:** How exactly the planner picks the winner is the topic of the next lesson, [The Cost-Based Ranker](/courses/mongodb/cost-based-ranker).

### The plan cache

Choosing a plan takes a little time, so MongoDB remembers the winner in the **plan cache**. Next time a query with the same *shape* arrives (same fields and operators, different values), it reuses the cached plan.

In explain output you'll see identifiers like `planCacheShapeHash` (MongoDB 8.0+; older versions call it `queryHash`) and `planCacheKey`, which identify that shape.

> **Note:** `explain()` itself ignores the plan cache and always plans the query fresh, so it shows you what the planner would choose right now.

### Forcing an index with hint()

To compare plans yourself, force a specific index with `hint()`:

```javascript
db.products.find({ category: "electronics", price: { $lt: 1000 } })
  .hint({ price: 1 })
  .explain("executionStats")
// → IXSCAN on price_1, then FETCH with a category filter.
//   Compare totalKeysExamined and totalDocsExamined with the default plan.
```

Use `hint()` for testing. In app code, a hint stops MongoDB from adapting when your data changes.

## Explaining aggregations

Aggregation explain output is organised by **stages** of your pipeline. When the first `$match` can use an index, you'll see it inside a `$cursor` stage (or directly in `queryPlanner`):

```javascript
db.orders.explain("executionStats").aggregate([
  { $match: { status: "pending" } },
  { $group: { _id: "$customerId", total: { $sum: "$total" } } }
])
```

Look for `IXSCAN` versus `COLLSCAN` in the part that handles `$match`, just like with `find`.

> **Note:** Some queries run on MongoDB's newer **slot-based execution engine**. Their output has `explainVersion: '2'`, and the plan appears under `winningPlan.queryPlan`. Read it the same way: look for `COLLSCAN`, `IXSCAN`, `FETCH` and `SORT`.

## Explain in Compass

If you prefer pictures, **MongoDB Compass** has an **Explain Plan** button on the Documents and Aggregations tabs. It draws the same stages as boxes and highlights collection scans and in-memory sorts. See [Compass and the VS Code Extension](/courses/mongodb/compass-and-vscode-extension).

## Common mistakes

- **Using the default mode and looking for numbers.** `explain()` without a mode shows only the plan. Use `"executionStats"` to see `totalDocsExamined`.
- **Judging by time on tiny data.** With 5 documents everything takes 0 ms. Look at keys and documents examined instead.
- **Ignoring the SORT stage.** An in-memory sort on a big result can be your slowest step. Add the sort field to the index (ESR).
- **Reading the plan top-down.** The innermost `inputStage` runs first. Start there.
- **Leaving `hint()` in production code.** It's a testing tool; the best index can change as data grows.

## Practice

1. Run `db.orders.find({ status: "shipped" }).explain("executionStats")`. Is it a `COLLSCAN` or an `IXSCAN`?
2. Create an index that turns it into an `IXSCAN`, and check that `totalDocsExamined` now equals `nReturned`.
3. Make `db.products.find({ category: "stationery" }, { _id: 0, category: 1, price: 1 })` a covered query and prove it with explain.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Without an index on status, you'll see stage: 'COLLSCAN'
db.orders.find({ status: "shipped" }).explain("executionStats")

// 2.
db.orders.createIndex({ status: 1 })
db.orders.find({ status: "shipped" }).explain("executionStats").executionStats
// → { nReturned: N, totalKeysExamined: N, totalDocsExamined: N, ... }

// 3. The { category: 1, price: 1 } index covers it
db.products.createIndex({ category: 1, price: 1 })
const plan = db.products.find({ category: "stationery" }, { _id: 0, category: 1, price: 1 })
  .explain("executionStats")
plan.queryPlanner.winningPlan.stage          // → 'PROJECTION_COVERED'
plan.executionStats.totalDocsExamined        // → 0
```

</details>

## Key takeaways

- The **query planner** picks a **query plan**; `explain()` shows it.
- Modes: `"queryPlanner"` (plan only), `"executionStats"` (runs it, shows numbers), `"allPlansExecution"` (also rejected-plan stats).
- `COLLSCAN` reads everything; `IXSCAN` uses an index; `FETCH` loads documents; `SORT` sorts in memory.
- Compare `nReturned`, `totalKeysExamined` and `totalDocsExamined`; close to 1:1:1 is ideal.
- Rejected plans show the alternatives; the winner is stored in the **plan cache** for queries of the same shape.
- Use `hint()` to compare plans while testing, not in production code.

**Next lesson:** [The Cost-Based Ranker](/courses/mongodb/cost-based-ranker)
