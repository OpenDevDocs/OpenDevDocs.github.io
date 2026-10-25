---
title: "Core Stages: match, project, group and sort"
slug: core-aggregation-stages
metadescription: Master the four aggregation stages you will use every day, $match, $project, $group and $sort, plus $addFields, $limit and $count, with step-by-step examples.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'aggregation', 'group', 'pipeline']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals). It uses the same `shop` data, so run the setup script from that lesson first if you haven't.

## What you will learn

By the end of this lesson you will know:

- How to filter documents with **`$match`**
- How to keep, hide and compute fields with **`$project`**, **`$addFields`** and **`$unset`**
- How to summarise documents with **`$group`** and its accumulators (`$sum`, `$avg`, `$push`...)
- How to order and trim results with **`$sort`**, **`$limit`**, **`$skip`** and **`$count`**
- How to combine them into a small report, step by step

## The four workers you will use most

Most real pipelines are built from just four stages. Think of them as the four most common jobs on our factory conveyor belt:

| Stage | Worker's job |
| --- | --- |
| `$match` | The **gatekeeper**: lets only matching documents through |
| `$project` | The **painter**: decides which fields each document carries, and can paint new ones |
| `$group` | The **packer**: puts similar documents into boxes and writes a summary on each box |
| `$sort` | The **organiser**: lines the documents up in order |

Let's meet them one by one.

## $match: the gatekeeper

`$match` takes the **same filter you already use with `find()`**. Every query operator you learned (`$gt`, `$in`, `$ne`, `$or`...) works here.

Find orders worth 300 or more that are not pending:

```javascript
db.orders.aggregate([
  { $match: { total: { $gte: 300 }, status: { $ne: "pending" } } }
])
// → orders 2 (1999, shipped), 3 (498, delivered) and 5 (2248, delivered)
```

Order 4 (329) is big enough, but it is pending, so the gatekeeper turns it away.

> **Tip:** Put `$match` as the **first stage** whenever you can. It shrinks the number of documents every later stage has to handle, and at the start of a pipeline it can use an index, just like `find()`.

To compare two fields of the *same* document, wrap an aggregation expression in `$expr`:

```javascript
// Products whose stock is lower than their price (a silly rule, but shows $expr)
db.products.aggregate([
  { $match: { $expr: { $lt: ["$stock", "$price"] } } }
])
// → Headphones (35 vs 1999), USB Cable (0 vs 299), Coffee Mug (60 vs 249)
```

## $project: the painter

`$project` reshapes each document. You can:

- **include** fields with `1`
- **exclude** fields with `0`
- **compute** new fields with an expression

```javascript
db.products.aggregate([
  { $project: {
      _id: 0,
      name: 1,
      price: 1,
      stockValue: { $multiply: ["$price", "$stock"] }   // price × stock
  } }
])
// → [
//   { name: "Notebook",   price: 49,   stockValue: 5880 },
//   { name: "Gel Pen",    price: 15,   stockValue: 7500 },
//   { name: "Headphones", price: 1999, stockValue: 69965 },
//   { name: "USB Cable",  price: 299,  stockValue: 0 },
//   { name: "Coffee Mug", price: 249,  stockValue: 14940 }
// ]
```

Here is one document **before** and **after** the painter:

```javascript
// Before
{ _id: ObjectId("66b000000000000000000001"), name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"] }

// After
{ name: "Notebook", price: 49, stockValue: 5880 }
```

Fields you don't mention are **dropped** in an inclusion projection. `_id` is the one exception: it stays unless you say `_id: 0`.

> **Warning:** You can't mix `1` and `0` in the same `$project` (except for `_id`). `{ name: 1, tags: 0 }` returns an error. Pick one style: list what you want to keep, *or* list what you want to remove.

### $addFields (or $set) and $unset

Often you want to **add** a field and keep everything else. Listing every field in `$project` would be tiring. Use `$addFields` instead. `$set` is just another name for the same stage.

```javascript
db.products.aggregate([
  { $set: {
      inStock: { $gt: ["$stock", 0] },
      priceBand: { $cond: { if: { $gte: ["$price", 500] }, then: "premium", else: "budget" } }
  } },
  { $unset: ["tags", "stock"] }        // remove fields you don't need
])
// → [
//   { _id: ..., name: "Notebook", category: "stationery", price: 49, inStock: true, priceBand: "budget" },
//   ...
//   { _id: ..., name: "USB Cable", category: "electronics", price: 299, inStock: false, priceBand: "budget" },
//   ...
// ]
```

### Handy expressions

You can use these inside `$project`, `$set`, `$group` and more:

| Kind | Operators | Example |
| --- | --- | --- |
| Maths | `$add`, `$subtract`, `$multiply`, `$divide`, `$round` | `{ $multiply: ["$price", 0.9] }` |
| Text | `$concat`, `$toUpper`, `$toLower`, `$substrCP` | `{ $concat: ["$name", " (", "$category", ")"] }` |
| Dates | `$year`, `$month`, `$dayOfMonth`, `$dateToString` | `{ $dateToString: { format: "%Y-%m", date: "$createdAt" } }` |
| Choices | `$cond`, `$ifNull`, `$switch` | `{ $ifNull: ["$rating", "no rating"] }` |
| Compare | `$eq`, `$gt`, `$lt`, `$in` | `{ $gt: ["$stock", 0] }` |

> **Note:** Expressions use the **array style** `{ $gt: ["$stock", 0] }`, while `$match` filters use the **query style** `{ stock: { $gt: 0 } }`. They look similar but are different languages. Inside `$match`, use query style (or `$expr` for the array style).

## $group: the packer

`$group` is the heart of aggregation. It needs two things:

1. **`_id`** – the group key. Documents with the same key go into the same box.
2. **Accumulators** – what to write on each box (a sum, an average, a list...).

Summarise products by category:

```javascript
db.products.aggregate([
  { $group: {
      _id: "$category",
      count: { $sum: 1 },
      avgPrice: { $avg: "$price" },
      totalStock: { $sum: "$stock" },
      names: { $push: "$name" }
  } }
])
// → [
//   { _id: "stationery",  count: 2, avgPrice: 32,   totalStock: 620, names: ["Notebook", "Gel Pen"] },
//   { _id: "electronics", count: 2, avgPrice: 1149, totalStock: 35,  names: ["Headphones", "USB Cable"] },
//   { _id: "kitchen",     count: 1, avgPrice: 249,  totalStock: 60,  names: ["Coffee Mug"] }
// ]
```

Five documents went in; three boxes came out. Notice that the output has **only** `_id` and the accumulator fields. Fields like `price` and `tags` are gone, because a box doesn't have *one* price. It has many.

### The accumulator toolbox

| Accumulator | Writes on the box | Since |
| --- | --- | --- |
| `$sum` | Total of a field (`$sum: 1` counts documents) | |
| `$avg` | Average | |
| `$min` / `$max` | Smallest / largest value | |
| `$push` | A list of every value (duplicates kept) | |
| `$addToSet` | A list of unique values | |
| `$first` / `$last` | The value from the first / last document in the box | |
| `$count` | Number of documents: `{ $count: {} }` | 5.0 |
| `$top` / `$bottom` | The value from the top / bottom document by a sort order you give | 5.2 |
| `$median` / `$percentile` | Middle value / percentiles | 7.0 |

### Grouping by more than one field

The group key can be a **document**. This groups orders by year *and* month:

```javascript
db.orders.aggregate([
  { $group: {
      _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
      revenue: { $sum: "$total" },
      orders: { $sum: 1 }
  } },
  { $sort: { "_id.year": 1, "_id.month": 1 } }
])
// → [
//   { _id: { year: 2026, month: 1 }, revenue: 656,  orders: 2 },
//   { _id: { year: 2026, month: 2 }, revenue: 2493, orders: 2 },
//   { _id: { year: 2026, month: 3 }, revenue: 2328, orders: 2 }
// ]
```

### One box for everything

Use `_id: null` when you want a single summary of the whole collection:

```javascript
db.orders.aggregate([
  { $group: { _id: null, revenue: { $sum: "$total" }, biggest: { $max: "$total" }, average: { $avg: "$total" } } }
])
// → [ { _id: null, revenue: 5477, biggest: 2248, average: 912.8333333333334 } ]
```

### $first needs a sorted belt

`$first` takes the value from whichever document reached the box first. That's only meaningful if you **sort before grouping**. Here is each customer's latest order:

```javascript
db.orders.aggregate([
  { $sort: { createdAt: -1 } },                       // newest first
  { $group: {
      _id: "$customerId",
      lastOrderId: { $first: "$_id" },
      lastOrderDate: { $first: "$createdAt" }
  } }
])
// Asha → order 2 (2026-03-05), Rahul → order 3, Priya → order 4 (2026-03-18), Ken → order 5
```

## $sort: the organiser

`$sort` takes fields with `1` (ascending, A to Z, small to big) or `-1` (descending).

```javascript
db.products.aggregate([
  { $sort: { category: 1, price: -1 } }    // by category, then most expensive first
])
// → electronics: Headphones, USB Cable; kitchen: Coffee Mug; stationery: Notebook, Gel Pen
```

> **Tip:** If two documents have the same sort value, their order is not guaranteed and can change between runs. Add a unique field as a tie-breaker, for example `{ total: -1, _id: 1 }`. This matters a lot for pagination.

### $limit, $skip and $count

These three are simple but useful:

```javascript
// Top 2 most expensive products
db.products.aggregate([ { $sort: { price: -1 } }, { $limit: 2 } ])
// → Headphones (1999), USB Cable (299)

// "Page 2" of products, 2 per page
db.products.aggregate([ { $sort: { price: -1, _id: 1 } }, { $skip: 2 }, { $limit: 2 } ])
// → Coffee Mug (249), Notebook (49)

// How many delivered orders?
db.orders.aggregate([ { $match: { status: "delivered" } }, { $count: "deliveredOrders" } ])
// → [ { deliveredOrders: 3 } ]
```

> **Note:** When `$sort` is followed by `$limit`, MongoDB is smart: it only keeps the top few documents in memory while sorting, instead of sorting everything.

## Putting it all together: a monthly report

Goal: **For every month, show revenue, number of orders and average order value, ignoring pending orders. Oldest month first.**

```javascript
db.orders.aggregate([
  { $match: { status: { $ne: "pending" } } },                                    // 1
  { $group: {                                                                    // 2
      _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
      revenue: { $sum: "$total" },
      orders: { $sum: 1 },
      avgOrder: { $avg: "$total" }
  } },
  { $project: { _id: 0, month: "$_id", revenue: 1, orders: 1, avgOrder: 1 } },   // 3
  { $sort: { month: 1 } }                                                        // 4
])
```

Now let's watch the conveyor belt.

**After stage 1 (`$match`)** – 5 orders remain (order 4 is pending and was removed):

```javascript
{ _id: 1, createdAt: ISODate("2026-01-10"), total: 158,  ... }
{ _id: 2, createdAt: ISODate("2026-03-05"), total: 1999, ... }
{ _id: 3, createdAt: ISODate("2026-01-22"), total: 498,  ... }
{ _id: 5, createdAt: ISODate("2026-02-14"), total: 2248, ... }
{ _id: 6, createdAt: ISODate("2026-02-28"), total: 245,  ... }
```

**After stage 2 (`$group`)** – packed into one box per month (in any order):

```javascript
{ _id: "2026-03", revenue: 1999, orders: 1, avgOrder: 1999 }
{ _id: "2026-01", revenue: 656,  orders: 2, avgOrder: 328 }
{ _id: "2026-02", revenue: 2493, orders: 2, avgOrder: 1246.5 }
```

**After stage 3 (`$project`)** – `_id` renamed to a friendlier `month`:

```javascript
{ revenue: 1999, orders: 1, avgOrder: 1999, month: "2026-03" }
{ revenue: 656,  orders: 2, avgOrder: 328,  month: "2026-01" }
{ revenue: 2493, orders: 2, avgOrder: 1246.5, month: "2026-02" }
```

**After stage 4 (`$sort`)** – the final result:

```javascript
[
  { revenue: 656,  orders: 2, avgOrder: 328,    month: "2026-01" },
  { revenue: 2493, orders: 2, avgOrder: 1246.5, month: "2026-02" },
  { revenue: 1999, orders: 1, avgOrder: 1999,   month: "2026-03" }
]
```

Four small, readable steps. That's the whole trick to aggregation.

## Common mistakes

- **Mixing query style and expression style.** `{ $match: { $gt: ["$total", 300] } }` is wrong. Use `{ $match: { total: { $gt: 300 } } }`, or wrap the array style in `$expr`.
- **Forgetting `_id` in `$group`.** Every `$group` needs an `_id`. Use `null` for "everything in one group".
- **Using a field that `$group` removed.** After `$group`, only `_id` and your accumulators exist. Carry anything else you need with `$first`, `$push` or another accumulator.
- **Using `$first` without sorting.** Without a `$sort` before it, "first" means "whichever happened to arrive first".
- **Mixing include and exclude in `$project`.** Choose one style (except for `_id`).

## Practice

1. Show every product's `name` and a `salePrice` that is 90% of its price. Hide `_id`.
2. Count products per category. Show the biggest category first; break ties alphabetically.
3. Find the **name** of the most expensive product in each category.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Sale prices
db.products.aggregate([
  { $project: { _id: 0, name: 1, salePrice: { $multiply: ["$price", 0.9] } } }
])
// → Notebook 44.1, Gel Pen 13.5, Headphones 1799.1, USB Cable 269.1, Coffee Mug 224.1

// 2. Products per category
db.products.aggregate([
  { $group: { _id: "$category", count: { $sum: 1 } } },
  { $sort: { count: -1, _id: 1 } }
])
// → electronics 2, stationery 2, kitchen 1

// 3. Most expensive product per category
db.products.aggregate([
  { $sort: { price: -1 } },
  { $group: { _id: "$category", mostExpensive: { $first: "$name" } } }
])
// → electronics: Headphones, kitchen: Coffee Mug, stationery: Notebook
```

</details>

## Key takeaways

- **`$match`** filters with normal query syntax. Put it first to save work and use indexes.
- **`$project`** keeps, hides or computes fields; **`$addFields`/`$set`** add fields and keep the rest; **`$unset`** removes fields.
- **`$group`** needs an `_id` (the group key) and accumulators such as `$sum`, `$avg`, `$push` and `$first`.
- After `$group`, only `_id` and the accumulator fields remain.
- **`$sort`** orders documents; add a tie-breaker like `_id` for stable results. `$limit`, `$skip` and `$count` trim and count.
- Big reports are just small stages chained together.

**Next lesson:** [Joining Collections with lookup](/courses/mongodb/lookup-and-joins)
