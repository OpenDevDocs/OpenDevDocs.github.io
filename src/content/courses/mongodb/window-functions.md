---
title: Window Functions with setWindowFields
slug: window-functions
metadescription: Learn MongoDB window functions with $setWindowFields to build running totals, rankings, moving averages and previous-value comparisons.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'aggregation', 'window-functions', 'analytics']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Core Stages: match, project, group and sort](/courses/mongodb/core-aggregation-stages). It uses the `shop` data from [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals). `$setWindowFields` needs **MongoDB 5.0 or newer**, so any 8.x server is fine.

## What you will learn

By the end of this lesson you will know:

- What a **window function** is and how it differs from `$group`
- How to write a **`$setWindowFields`** stage with `partitionBy`, `sortBy` and `output`
- How to build **running totals**, **rankings** and **moving averages**
- How to compare each document with the **previous** one using `$shift`
- The difference between **`documents`** and **`range`** windows

## $group squashes, windows keep

With `$group`, many documents go in and **one summary** comes out. That's great for "total revenue per customer". But what if you want to see **every order** *and*, next to it, the customer's total so far?

| Order | Customer | Total | Running total for this customer |
| --- | --- | --- | --- |
| 1 | Asha | 158 | 158 |
| 2 | Asha | 1999 | 2157 |
| 6 | Priya | 245 | 245 |
| 4 | Priya | 329 | 574 |

`$group` can't do this, because it throws away the individual orders. A **window function** can. It calculates a value from a *group of neighbouring documents* and writes it onto **each** document, without removing any.

> **Think of it like this:** Picture our conveyor belt again. A worker stands at the belt holding a small frame (a *window*). For every document that passes, the worker looks through the frame at the documents nearby, for example "this one and the two before it", and writes a note on the current document: "the average of what I can see is 968". Then the frame slides along to the next document. Nothing is removed from the belt; each document just gets a new note.

## The shape of $setWindowFields

```javascript
{ $setWindowFields: {
    partitionBy: <expression>,        // optional: separate groups (like $group's _id)
    sortBy: { <field>: 1 or -1 },     // the order inside each group
    output: {
      <newField>: {
        <window operator>: <argument>,
        window: { documents: [<lower>, <upper>] }   // optional: which neighbours to look at
      }
    }
} }
```

Three ideas to understand:

| Part | Plain meaning |
| --- | --- |
| `partitionBy` | Split the belt into separate lanes, for example one lane per customer. Windows never look across lanes. Leave it out to have one lane for everything. |
| `sortBy` | The order of documents inside each lane. "Before" and "after" depend on it. |
| `window` | Which documents the frame covers, relative to the current one. Leave it out to cover the **whole lane**. |

## A running total

Let's add a running total of revenue across all orders, in date order:

```javascript
db.orders.aggregate([
  { $setWindowFields: {
      sortBy: { createdAt: 1 },
      output: {
        runningTotal: {
          $sum: "$total",
          window: { documents: ["unbounded", "current"] }
        }
      }
  } },
  { $project: { _id: 1, createdAt: 1, total: 1, runningTotal: 1 } }
])
// → [
//   { _id: 1, createdAt: ISODate("2026-01-10T00:00:00.000Z"), total: 158,  runningTotal: 158 },
//   { _id: 3, createdAt: ISODate("2026-01-22T00:00:00.000Z"), total: 498,  runningTotal: 656 },
//   { _id: 5, createdAt: ISODate("2026-02-14T00:00:00.000Z"), total: 2248, runningTotal: 2904 },
//   { _id: 6, createdAt: ISODate("2026-02-28T00:00:00.000Z"), total: 245,  runningTotal: 3149 },
//   { _id: 2, createdAt: ISODate("2026-03-05T00:00:00.000Z"), total: 1999, runningTotal: 5148 },
//   { _id: 4, createdAt: ISODate("2026-03-18T00:00:00.000Z"), total: 329,  runningTotal: 5477 }
// ]
```

`documents: ["unbounded", "current"]` means "from the very first document up to and including this one". All 6 orders are still there, and each has a new `runningTotal`. The last one equals the grand total, 5477.

### Window boundaries

The two values in `documents: [lower, upper]` can be:

| Boundary | Meaning |
| --- | --- |
| `"unbounded"` | The first (lower) or last (upper) document in the lane |
| `"current"` | The current document |
| `-2`, `-1` | 2 or 1 documents **before** the current one |
| `0` | The current document (same as `"current"`) |
| `1`, `2` | 1 or 2 documents **after** the current one |

Both boundaries are **included**.

## Separate lanes with partitionBy

Now the per-customer running total from the table at the top. Add `partitionBy`:

```javascript
db.orders.aggregate([
  { $setWindowFields: {
      partitionBy: "$customerId",
      sortBy: { createdAt: 1 },
      output: {
        customerRunningTotal: { $sum: "$total", window: { documents: ["unbounded", "current"] } },
        orderNumber: { $documentNumber: {} }       // 1st, 2nd, 3rd... order of this customer
      }
  } },
  { $project: { customerId: 1, total: 1, customerRunningTotal: 1, orderNumber: 1 } },
  { $sort: { customerId: 1, orderNumber: 1 } }
])
// → [
//   { _id: 1, customerId: ObjectId("66a000000000000000000001"), total: 158,  customerRunningTotal: 158,  orderNumber: 1 },  // Asha
//   { _id: 2, customerId: ObjectId("66a000000000000000000001"), total: 1999, customerRunningTotal: 2157, orderNumber: 2 },
//   { _id: 3, customerId: ObjectId("66a000000000000000000002"), total: 498,  customerRunningTotal: 498,  orderNumber: 1 },  // Rahul
//   { _id: 6, customerId: ObjectId("66a000000000000000000003"), total: 245,  customerRunningTotal: 245,  orderNumber: 1 },  // Priya
//   { _id: 4, customerId: ObjectId("66a000000000000000000003"), total: 329,  customerRunningTotal: 574,  orderNumber: 2 },
//   { _id: 5, customerId: ObjectId("66a000000000000000000004"), total: 2248, customerRunningTotal: 2248, orderNumber: 1 }   // Ken
// ]
```

Each customer's total starts again from zero, because each customer has their own lane.

> **Note:** `$setWindowFields` doesn't promise any output order. That's why we added a `$sort` at the end. Add one whenever the order of the result matters.

### The whole lane: share of total

If you leave `window` out, the frame covers the **whole lane**. That's handy for "what percentage of the customer's spending was this order?":

```javascript
db.orders.aggregate([
  { $setWindowFields: {
      partitionBy: "$customerId",
      output: { customerTotal: { $sum: "$total" } }       // no window = whole partition
  } },
  { $set: {
      percentOfCustomer: { $round: [ { $multiply: [ { $divide: ["$total", "$customerTotal"] }, 100 ] }, 1 ] }
  } },
  { $project: { total: 1, customerTotal: 1, percentOfCustomer: 1 } }
])
// Order 1 → total 158, customerTotal 2157, percentOfCustomer 7.3
// Order 2 → total 1999, customerTotal 2157, percentOfCustomer 92.7
// Order 6 → 42.7, order 4 → 57.3, orders 3 and 5 → 100
```

Notice the pattern: the window operator goes in `$setWindowFields`, and any extra maths (`$divide`, `$round`) goes in a normal `$set` after it.

## Ranking

Rank products by price within each category:

```javascript
db.products.aggregate([
  { $setWindowFields: {
      partitionBy: "$category",
      sortBy: { price: -1 },
      output: { priceRank: { $rank: {} } }
  } },
  { $project: { _id: 0, category: 1, name: 1, price: 1, priceRank: 1 } },
  { $sort: { category: 1, priceRank: 1 } }
])
// → [
//   { name: "Headphones", category: "electronics", price: 1999, priceRank: 1 },
//   { name: "USB Cable",  category: "electronics", price: 299,  priceRank: 2 },
//   { name: "Coffee Mug", category: "kitchen",     price: 249,  priceRank: 1 },
//   { name: "Notebook",   category: "stationery",  price: 49,   priceRank: 1 },
//   { name: "Gel Pen",    category: "stationery",  price: 15,   priceRank: 2 }
// ]
```

Want only the most expensive product per category? Add `{ $match: { priceRank: 1 } }`.

There are three ranking operators. They differ only when there are **ties**. Imagine four exam scores:

| Score | `$rank` | `$denseRank` | `$documentNumber` |
| --- | --- | --- | --- |
| 100 | 1 | 1 | 1 |
| 90 | 2 | 2 | 2 |
| 90 | 2 | 2 | 3 |
| 80 | **4** | **3** | 4 |

- `$rank` gives ties the same rank, then **skips** (like sports: two silver medals, no bronze).
- `$denseRank` gives ties the same rank and **doesn't skip**.
- `$documentNumber` just counts 1, 2, 3, 4, ignoring ties.

All three need `sortBy` and take an empty object: `{ $rank: {} }`. They don't accept a `window`.

## Moving averages

A **moving average** smooths out bumpy numbers. "The average of this order and the two before it" is a 3-order moving average:

```javascript
db.orders.aggregate([
  { $setWindowFields: {
      sortBy: { createdAt: 1 },
      output: {
        movingAvg: { $avg: "$total", window: { documents: [-2, 0] } }
      }
  } },
  { $set: { movingAvg: { $round: ["$movingAvg", 2] } } },
  { $project: { total: 1, movingAvg: 1 } }
])
// → [
//   { _id: 1, total: 158,  movingAvg: 158 },       // only 1 order so far
//   { _id: 3, total: 498,  movingAvg: 328 },       // (158 + 498) / 2
//   { _id: 5, total: 2248, movingAvg: 968 },       // (158 + 498 + 2248) / 3
//   { _id: 6, total: 245,  movingAvg: 997 },       // (498 + 2248 + 245) / 3
//   { _id: 2, total: 1999, movingAvg: 1497.33 },
//   { _id: 4, total: 329,  movingAvg: 857.67 }
// ]
```

At the start there aren't two earlier orders yet, so the frame just covers what exists.

## Comparing with the previous document: $shift

`$shift` copies a value from a document a few positions away. `by: -1` means "the previous one". Here's how much each customer's order changed compared with their previous order:

```javascript
db.orders.aggregate([
  { $setWindowFields: {
      partitionBy: "$customerId",
      sortBy: { createdAt: 1 },
      output: {
        previousTotal: { $shift: { output: "$total", by: -1, default: null } }
      }
  } },
  { $set: { change: { $subtract: ["$total", "$previousTotal"] } } },
  { $project: { customerId: 1, total: 1, previousTotal: 1, change: 1 } }
])
// Asha:  order 1 → previousTotal null, change null
//        order 2 → previousTotal 158,  change 1841
// Priya: order 6 → previousTotal null, change null
//        order 4 → previousTotal 245,  change 84
```

The first order of each customer has nothing before it, so it gets the `default` value (`null`). Like the ranking operators, `$shift` uses its own position and doesn't take a `window`.

## Range windows: "the last 30 days"

So far our windows counted **documents** ("2 before me"). A **range** window uses **values** of the `sortBy` field instead ("everything within 30 days before me"). With dates, add a `unit`:

```javascript
db.orders.aggregate([
  { $setWindowFields: {
      sortBy: { createdAt: 1 },
      output: {
        last30Days: { $sum: "$total", window: { range: [-30, 0], unit: "day" } }
      }
  } },
  { $project: { createdAt: 1, total: 1, last30Days: 1 } }
])
// → [
//   { _id: 1, createdAt: ISODate("2026-01-10T00:00:00.000Z"), total: 158,  last30Days: 158 },
//   { _id: 3, createdAt: ISODate("2026-01-22T00:00:00.000Z"), total: 498,  last30Days: 656 },
//   { _id: 5, createdAt: ISODate("2026-02-14T00:00:00.000Z"), total: 2248, last30Days: 2746 },
//   { _id: 6, createdAt: ISODate("2026-02-28T00:00:00.000Z"), total: 245,  last30Days: 2493 },
//   { _id: 2, createdAt: ISODate("2026-03-05T00:00:00.000Z"), total: 1999, last30Days: 4492 },
//   { _id: 4, createdAt: ISODate("2026-03-18T00:00:00.000Z"), total: 329,  last30Days: 2573 }
// ]
```

On 14 February, the 30-day frame reaches back to 15 January. Order 1 (10 January) is outside it, so `last30Days` is 498 + 2248 = 2746.

| Window type | Counts by | Example | Needs |
| --- | --- | --- | --- |
| `documents` | Position | "this order and the 2 before it" | `sortBy` |
| `range` | Value of the sort field | "orders within 30 days before this one" | exactly **one** ascending `sortBy` field of numbers or dates |

`unit` can be `"year"`, `"quarter"`, `"month"`, `"week"`, `"day"`, `"hour"`, `"minute"`, `"second"` or `"millisecond"`.

## Which operators work in a window?

| Kind | Operators |
| --- | --- |
| Accumulators | `$sum`, `$avg`, `$min`, `$max`, `$count`, `$push`, `$addToSet`, `$first`, `$last`, `$stdDevPop`, `$median` (7.0+), `$topN`/`$bottomN` (5.2+) |
| Rank and order | `$rank`, `$denseRank`, `$documentNumber`, `$shift` |
| Time series maths | `$derivative`, `$integral`, `$expMovingAvg` |
| Filling gaps | `$locf` (5.2+, carry the last value forward), `$linearFill` (5.3+) |
| Objects | `$mergeObjects` (8.3+) |

> **Tip:** Filling missing values in time series data (sensor readings, daily prices) is a classic job for windows. You'll see more of it in [Time Series and Capped Collections](/courses/mongodb/time-series-collections).

## Common mistakes

- **Doing maths inside `output`.** `output` only accepts window operators. Put `$round`, `$divide` and friends in a `$set` stage after `$setWindowFields`.
- **Forgetting `sortBy`.** Running totals, moving averages, ranks and `$shift` all depend on order. Without `sortBy`, "previous" has no meaning (and most of these return an error).
- **Expecting sorted output.** `$setWindowFields` doesn't guarantee order. Add a `$sort` at the end.
- **Adding a `window` to `$rank` or `$shift`.** They use their own position and return an error if you give them a window.
- **Using a range window with the wrong sort field.** Range windows need exactly one ascending sort field, made of numbers (or dates when you use `unit`).

## Practice

1. Number every order in date order across the whole shop (1, 2, 3...).
2. For each product category, add the category's **average price** to every product, then show how far each product is above or below it.
3. For each customer, show each order with the customer's **previous order date**.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Number all orders by date
db.orders.aggregate([
  { $setWindowFields: { sortBy: { createdAt: 1 }, output: { seq: { $documentNumber: {} } } } },
  { $project: { createdAt: 1, seq: 1 } }
])
// → order 1 seq 1, order 3 seq 2, order 5 seq 3, order 6 seq 4, order 2 seq 5, order 4 seq 6

// 2. Compare with the category average
db.products.aggregate([
  { $setWindowFields: {
      partitionBy: "$category",
      output: { categoryAvg: { $avg: "$price" } }
  } },
  { $set: { diff: { $subtract: ["$price", "$categoryAvg"] } } },
  { $project: { _id: 0, name: 1, price: 1, categoryAvg: 1, diff: 1 } }
])
// → Notebook diff 17, Gel Pen -17, Headphones 850, USB Cable -850, Coffee Mug 0

// 3. Previous order date per customer
db.orders.aggregate([
  { $setWindowFields: {
      partitionBy: "$customerId",
      sortBy: { createdAt: 1 },
      output: { previousOrderDate: { $shift: { output: "$createdAt", by: -1 } } }
  } },
  { $project: { customerId: 1, createdAt: 1, previousOrderDate: 1 } }
])
```

</details>

## Key takeaways

- A **window function** calculates a value from nearby documents and adds it to **each** document; nothing is removed, unlike `$group`.
- `$setWindowFields` has `partitionBy` (separate lanes), `sortBy` (order) and `output` (the new fields).
- `documents: ["unbounded", "current"]` gives running totals; `documents: [-2, 0]` gives a 3-document moving window; no `window` means the whole lane.
- `$rank`, `$denseRank`, `$documentNumber` and `$shift` need `sortBy` and never take a `window`.
- **Range** windows use values (like "30 days") instead of positions.
- Add a `$sort` after `$setWindowFields` when the output order matters.

**Next lesson:** [Array Index Access with IDX and arrayIndexAs](/courses/mongodb/array-index-access)
