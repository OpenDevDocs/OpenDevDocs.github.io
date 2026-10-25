---
title: Aggregation Pipeline Fundamentals
slug: aggregation-pipeline-fundamentals
metadescription: Learn how MongoDB's aggregation pipeline works like a factory conveyor belt, with stages that filter, reshape and summarise your documents step by step.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'aggregation', 'pipeline', 'analytics']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Querying with find and Filters](/courses/mongodb/querying-with-find) and [Projections and Field Selection](/courses/mongodb/projections).

## What you will learn

By the end of this lesson you will know:

- What the **aggregation pipeline** is and when you need it instead of `find()`
- How documents travel through **stages**, one after another
- The difference between a stage, an operator, a field path (`"$total"`) and a variable (`"$$ROOT"`)
- Why the **order of stages** matters
- How to build and debug a pipeline one stage at a time

## Why find() is not always enough

`find()` is great at one job: *giving you back documents that match a filter*. But many real questions are not "give me the documents". They are "tell me something **about** the documents":

- How much money did we make from delivered orders?
- How many orders does each customer have?
- Which product category sells best each month?

`find()` cannot add numbers together, group documents, or join collections. For that, MongoDB has the **aggregation pipeline**.

> **Think of it like this:** Picture a factory with a conveyor belt. Raw documents are placed on the belt at one end. Along the belt stand workers, and each worker does exactly one job: one throws away items that don't belong, one repaints items, one packs similar items into boxes, one sorts the boxes. What comes out at the far end is the finished product. In MongoDB, each worker is called a **stage**, and the whole belt is the **pipeline**.

## Set up the practice data

We will use the `shop` database in all the aggregation lessons. Copy this into mongosh. It **resets** the three collections, so your results will match the lesson exactly.

```javascript
use shop

// Start fresh so your results match the lesson
db.products.drop()
db.customers.drop()
db.orders.drop()

db.products.insertMany([
  { _id: ObjectId("66b000000000000000000001"), name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"] },
  { _id: ObjectId("66b000000000000000000002"), name: "Gel Pen", category: "stationery", price: 15, stock: 500, tags: ["pen", "school"] },
  { _id: ObjectId("66b000000000000000000003"), name: "Headphones", category: "electronics", price: 1999, stock: 35, tags: ["audio", "wireless"], rating: 4.5 },
  { _id: ObjectId("66b000000000000000000004"), name: "USB Cable", category: "electronics", price: 299, stock: 0, tags: ["cable"] },
  { _id: ObjectId("66b000000000000000000005"), name: "Coffee Mug", category: "kitchen", price: 249, stock: 60, tags: ["ceramic", "gift"], rating: 4.8 }
])

db.customers.insertMany([
  { _id: ObjectId("66a000000000000000000001"), name: "Asha Roy", email: "asha@example.com", city: "Kolkata", joinedAt: ISODate("2025-01-15"), isMember: true },
  { _id: ObjectId("66a000000000000000000002"), name: "Rahul Mehta", email: "rahul@example.com", city: "Mumbai", joinedAt: ISODate("2025-03-02"), isMember: false },
  { _id: ObjectId("66a000000000000000000003"), name: "Priya Nair", email: "priya@example.com", city: "Kolkata", joinedAt: ISODate("2025-06-20"), isMember: true },
  { _id: ObjectId("66a000000000000000000004"), name: "Ken Sato", email: "ken@example.com", city: "Tokyo", joinedAt: ISODate("2026-02-11"), isMember: false },
  { _id: ObjectId("66a000000000000000000005"), name: "Maria Garcia", email: "maria@example.com", city: "Madrid", joinedAt: ISODate("2026-05-08"), isMember: true }
])

db.orders.insertMany([
  { _id: 1, customerId: ObjectId("66a000000000000000000001"), status: "delivered", createdAt: ISODate("2026-01-10"), total: 158,
    items: [ { productId: ObjectId("66b000000000000000000001"), name: "Notebook", qty: 2, price: 49 },
             { productId: ObjectId("66b000000000000000000002"), name: "Gel Pen", qty: 4, price: 15 } ] },
  { _id: 2, customerId: ObjectId("66a000000000000000000001"), status: "shipped", createdAt: ISODate("2026-03-05"), total: 1999,
    items: [ { productId: ObjectId("66b000000000000000000003"), name: "Headphones", qty: 1, price: 1999 } ] },
  { _id: 3, customerId: ObjectId("66a000000000000000000002"), status: "delivered", createdAt: ISODate("2026-01-22"), total: 498,
    items: [ { productId: ObjectId("66b000000000000000000005"), name: "Coffee Mug", qty: 2, price: 249 } ] },
  { _id: 4, customerId: ObjectId("66a000000000000000000003"), status: "pending", createdAt: ISODate("2026-03-18"), total: 329,
    items: [ { productId: ObjectId("66b000000000000000000004"), name: "USB Cable", qty: 1, price: 299 },
             { productId: ObjectId("66b000000000000000000002"), name: "Gel Pen", qty: 2, price: 15 } ] },
  { _id: 5, customerId: ObjectId("66a000000000000000000004"), status: "delivered", createdAt: ISODate("2026-02-14"), total: 2248,
    items: [ { productId: ObjectId("66b000000000000000000003"), name: "Headphones", qty: 1, price: 1999 },
             { productId: ObjectId("66b000000000000000000005"), name: "Coffee Mug", qty: 1, price: 249 } ] },
  { _id: 6, customerId: ObjectId("66a000000000000000000003"), status: "shipped", createdAt: ISODate("2026-02-28"), total: 245,
    items: [ { productId: ObjectId("66b000000000000000000001"), name: "Notebook", qty: 5, price: 49 } ] }
])
```

> **Note:** We gave the documents fixed `_id` values (like `ObjectId("66a000000000000000000001")`) only so the examples are easy to follow. In a real app you would let MongoDB create them.

Here is the data in short form, so you can keep it in your head:

| Order | Customer | Status | Date | Total |
| --- | --- | --- | --- | --- |
| 1 | Asha | delivered | 2026-01-10 | 158 |
| 2 | Asha | shipped | 2026-03-05 | 1999 |
| 3 | Rahul | delivered | 2026-01-22 | 498 |
| 4 | Priya | pending | 2026-03-18 | 329 |
| 5 | Ken | delivered | 2026-02-14 | 2248 |
| 6 | Priya | shipped | 2026-02-28 | 245 |

Maria has no orders yet. That will be useful later.

## Your first pipeline

Question: **How much money did we make from delivered orders, and how many were there?**

We call `aggregate()` on the collection and give it an **array of stages**:

```javascript
db.orders.aggregate([
  { $match: { status: "delivered" } },                       // stage 1
  { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }  // stage 2
])
// → [ { _id: null, revenue: 2904, orders: 3 } ]
```

Let's walk along the conveyor belt and look at the documents after each stage.

**At the start**, all 6 orders are on the belt.

**After stage 1 (`$match`)**, only delivered orders are left. The worker threw the other three off the belt:

```javascript
{ _id: 1, status: "delivered", total: 158,  ... }
{ _id: 3, status: "delivered", total: 498,  ... }
{ _id: 5, status: "delivered", total: 2248, ... }
```

**After stage 2 (`$group`)**, the three documents were packed into one box. `_id: null` means "put everything in the same group". `$sum: "$total"` adds up the totals, and `$sum: 1` adds 1 for every document, which counts them:

```javascript
{ _id: null, revenue: 2904, orders: 3 }
```

That's the whole idea. Every stage receives documents, does one job, and passes its result to the next stage.

## The parts of a pipeline

The dollar sign `$` shows up a lot in pipelines, and it means different things in different places. This table is worth bookmarking:

| What you see | Name | Meaning |
| --- | --- | --- |
| `{ $match: ... }` | **Stage** | A worker on the belt. Always the *key* of an object in the pipeline array. |
| `{ $sum: ... }` | **Operator** | A tool the worker uses (add, multiply, compare...). |
| `"$total"` | **Field path** | A *string* that starts with one `$`: "the value of the `total` field of the current document". |
| `"$items.qty"` | **Field path** (nested) | Dot notation works too. |
| `"$$ROOT"` | **Variable** | Starts with `$$`. A built-in or named variable. `$$ROOT` is the whole current document. |
| `"$$NOW"` | **Variable** | The current date and time. |

The most common beginner bug is mixing these up:

```javascript
{ $sum: "total" }    // Wrong: the literal text "total" is not a number, so you get 0
{ $sum: "$total" }   // Right: adds the value of each document's total field
```

> **Tip:** Read `"$total"` out loud as "the total of this document". If you are referring to a field's value, you need the `$`.

## Common stages at a glance

You will meet these properly in the next lesson. For now, here is the cast of workers:

| Stage | Job on the conveyor belt | SQL cousin |
| --- | --- | --- |
| `$match` | Throw away documents that don't match a filter | `WHERE` |
| `$project` | Keep, remove or compute fields | `SELECT` columns |
| `$addFields` / `$set` | Add new fields, keep the rest | computed columns |
| `$group` | Pack documents into groups and summarise them | `GROUP BY` |
| `$sort` | Put documents in order | `ORDER BY` |
| `$limit` / `$skip` | Keep only some documents | `LIMIT` / `OFFSET` |
| `$lookup` | Bring in matching documents from another collection | `LEFT JOIN` |
| `$unwind` | Split one document with an array into many documents | (no direct match) |
| `$count` | Replace everything with a single count | `COUNT(*)` |

## Order matters

Workers on a belt can only work with what reaches them. Swapping two stages can change the answer, or make the pipeline slower.

Here we group first and filter second. We want customers who spent more than 1000 in total:

```javascript
db.orders.aggregate([
  { $group: { _id: "$customerId", spent: { $sum: "$total" } } },
  { $match: { spent: { $gt: 1000 } } }
])
// → [
//   { _id: ObjectId("66a000000000000000000001"), spent: 2157 },   // Asha
//   { _id: ObjectId("66a000000000000000000004"), spent: 2248 }    // Ken
// ]
```

This works because `spent` only exists *after* `$group`. If you put the `$match` first, there would be no `spent` field yet, and nothing would match. (A `$match` after a `$group` is like SQL's `HAVING`.)

Now the opposite case. If you want to filter on a field that already exists, such as `status`, put `$match` **as early as possible**:

```javascript
// Good: fewer documents reach $group, and $match can use an index
db.orders.aggregate([
  { $match: { status: "delivered" } },
  { $group: { _id: "$customerId", spent: { $sum: "$total" } } }
])
```

> **Think of it like this:** Throw the rotten apples out at the start of the line, not after you've washed, polished and boxed them.

> **Note:** MongoDB's optimiser can move some stages around for you (for example, a `$match` that follows a `$sort`). Still, write pipelines in a sensible order. It makes them easier to read, and you don't have to guess what the optimiser will do.

## Group keys: what goes in _id

In `$group`, the `_id` is the **group key**: documents with the same key go into the same box.

```javascript
// One box per status
db.orders.aggregate([
  { $group: { _id: "$status", orders: { $sum: 1 }, revenue: { $sum: "$total" } } }
])
// → [
//   { _id: "delivered", orders: 3, revenue: 2904 },
//   { _id: "shipped",   orders: 2, revenue: 2244 },
//   { _id: "pending",   orders: 1, revenue: 329 }
// ]
```

The groups can come out in any order. Add a `$sort` stage if order matters to you:

```javascript
db.orders.aggregate([
  { $group: { _id: "$status", revenue: { $sum: "$total" } } },
  { $sort: { revenue: -1 } }       // biggest first
])
```

## Build pipelines one stage at a time

Long pipelines can look scary. The secret is that nobody writes them in one go. Professionals add **one stage, run it, look at the output, then add the next**.

A handy way to do this in mongosh is to keep the stages in a variable:

```javascript
let pipeline = [
  { $match: { status: { $in: ["shipped", "delivered"] } } }
]
db.orders.aggregate(pipeline)        // look at the result

pipeline.push({ $group: { _id: "$customerId", spent: { $sum: "$total" } } })
db.orders.aggregate(pipeline)        // look again

pipeline.push({ $sort: { spent: -1 } }, { $limit: 2 })
db.orders.aggregate(pipeline)
// → [
//   { _id: ObjectId("66a000000000000000000004"), spent: 2248 },   // Ken
//   { _id: ObjectId("66a000000000000000000001"), spent: 2157 }    // Asha
// ]
```

> **Tip:** While building, add a temporary `{ $limit: 3 }` at the end so you only see a few documents. Remove it when you're done.

**MongoDB Compass** also has an *Aggregations* tab where you add stages as cards and see a preview of the documents after each one. It is the conveyor belt made visible, and it's a great way to learn.

## Pipelines don't change your data

Running `aggregate()` only **reads**. Your `orders` collection is exactly the same afterwards. The results come back to you as a *cursor*, just like `find()`.

The only exceptions are two special final stages, `$out` and `$merge`, which save the results into a collection. You'll learn them in the Expert lesson [Aggregation Performance with merge and out](/courses/mongodb/aggregation-performance).

## Where else you can use pipelines

The same stage syntax appears in several places, so learning it pays off many times:

- **`db.collection.aggregate([...])`** – what we used above.
- **`db.aggregate([...])`** with a `$documents` stage (MongoDB 5.1+) – run a pipeline on documents you type in, without any collection. Perfect for experiments:

  ```javascript
  db.aggregate([
    { $documents: [ { a: 2, b: 3 }, { a: 10, b: 1 } ] },
    { $project: { sum: { $add: ["$a", "$b"] } } }
  ])
  // → [ { sum: 5 }, { sum: 11 } ]
  ```

- **Updates with a pipeline** (MongoDB 4.2+) – `updateMany({}, [ { $set: ... } ])` lets an update use aggregation expressions.
- **Views** – `db.createView()` saves a pipeline as a read-only virtual collection.
- **Your app** – drivers send the same array.

Here is the "top customers" pipeline from Node.js (driver 7.x; the same code works on 6.x):

```javascript
const pipeline = [
  { $match: { status: { $in: ["shipped", "delivered"] } } },
  { $group: { _id: "$customerId", spent: { $sum: "$total" } } },
  { $sort: { spent: -1 } },
  { $limit: 2 }
];

const topCustomers = await db.collection("orders").aggregate(pipeline).toArray();
console.log(topCustomers);
```

## Limits worth knowing

You won't hit these in practice data, but it's good to know they exist:

- **Memory per stage:** stages like `$group` and `$sort` can use about 100 MB of memory. Since MongoDB 6.0, when a stage needs more, it writes temporary files to disk automatically (this is the `allowDiskUse` behaviour, now on by default).
- **Document size:** every document coming out of a stage must still fit the 16 MB BSON limit. This matters when you collect big arrays with `$push`.
- **Performance:** only the stages at the start of the pipeline (like an early `$match` or `$sort`) can use indexes. Use `explain()` to check, as you learned in [explain and Query Plans](/courses/mongodb/explain-and-query-plans):

  ```javascript
  db.orders.explain("executionStats").aggregate([ { $match: { status: "delivered" } } ])
  ```

## Common mistakes

- **Forgetting the `$` in a field path.** `{ $sum: "total" }` silently gives `0`. Write `"$total"`.
- **Forgetting the square brackets.** A pipeline is an array: `aggregate([ {...}, {...} ])`. Always wrap your stages in `[ ]`.
- **Filtering on a field before it exists.** A field you create in `$group` or `$project` can only be used in *later* stages.
- **Expecting groups in a fixed order.** `$group` output order is not guaranteed. Add `$sort`.
- **Putting `$match` late "because it works".** It works, but it's slower. Filter early whenever the field already exists.

## Practice

Use the `shop` data from the setup above.

1. Count how many orders are `"shipped"`, using `$match` and `$group`.
2. Find the total revenue of **all** orders in one document.
3. For each customer, find their number of orders. Show the customer with the most orders first.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Shipped orders
db.orders.aggregate([
  { $match: { status: "shipped" } },
  { $group: { _id: null, count: { $sum: 1 } } }
])
// → [ { _id: null, count: 2 } ]

// 2. Total revenue
db.orders.aggregate([
  { $group: { _id: null, revenue: { $sum: "$total" } } }
])
// → [ { _id: null, revenue: 5477 } ]

// 3. Orders per customer, most first
db.orders.aggregate([
  { $group: { _id: "$customerId", orders: { $sum: 1 } } },
  { $sort: { orders: -1 } }
])
// Asha and Priya have 2 orders each; Rahul and Ken have 1
```

</details>

## Key takeaways

- The **aggregation pipeline** is a conveyor belt: documents flow through **stages**, and each stage does one job.
- A pipeline is an **array** passed to `aggregate()`. The output of one stage is the input of the next.
- `"$field"` means "this document's value"; `"$$NAME"` is a variable; `$stage` and `$operator` are keys.
- **Order matters.** Filter early with `$match`; use fields only after the stage that creates them.
- Build pipelines **one stage at a time** and look at the documents after each step.
- `aggregate()` only reads data, unless you end with `$out` or `$merge`.

**Next lesson:** [Core Stages: match, project, group and sort](/courses/mongodb/core-aggregation-stages)
