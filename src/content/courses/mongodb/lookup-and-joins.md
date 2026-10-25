---
title: Joining Collections with lookup
slug: lookup-and-joins
metadescription: Learn how $lookup joins documents from two MongoDB collections, how to flatten the results, filter joined data with a sub-pipeline and keep joins fast.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'aggregation', 'lookup', 'joins']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Core Stages: match, project, group and sort](/courses/mongodb/core-aggregation-stages). It uses the `shop` data from [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals), so run that setup script first if you haven't.

## What you will learn

By the end of this lesson you will know:

- Why you sometimes need to **join** collections in MongoDB
- How the basic **`$lookup`** stage works, and why it always returns an **array**
- How to turn that array into a single embedded document
- How to filter and trim joined documents with a **sub-pipeline**
- How to keep joins fast with the right index

## Why join at all?

In [Embedding vs Referencing](/courses/mongodb/schema-design-embedding-vs-referencing) you learned that some data is better kept in its own collection and *referenced*. Our orders do exactly that: each order stores a `customerId`, not the whole customer.

```javascript
// An order only knows the customer's _id
{ _id: 1, customerId: ObjectId("66a000000000000000000001"), total: 158, status: "delivered", ... }

// The customer lives in another collection
{ _id: ObjectId("66a000000000000000000001"), name: "Asha Roy", city: "Kolkata", ... }
```

That's great for storage, but an invoice page needs **both**. You could run two queries from your app. Or you can ask the pipeline to do the matching for you with `$lookup`.

> **Think of it like this:** Our conveyor belt carries orders. At one station, a worker reads the customer number on each order, walks to the customer filing cabinet, photocopies every matching card, and staples the copies to the order. The order now travels on with its customer attached.

## Your first $lookup

The basic form takes four fields:

| Field | Meaning |
| --- | --- |
| `from` | The *other* collection to search (same database) |
| `localField` | The field in the documents on the belt |
| `foreignField` | The field in the `from` collection to compare with |
| `as` | The name of the new array field to put the matches in |

Attach the customer to order 1:

```javascript
db.orders.aggregate([
  { $match: { _id: 1 } },
  { $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
  } }
])
```

Result:

```javascript
[
  {
    _id: 1,
    customerId: ObjectId("66a000000000000000000001"),
    status: "delivered",
    createdAt: ISODate("2026-01-10T00:00:00.000Z"),
    total: 158,
    items: [ ... ],
    customer: [
      {
        _id: ObjectId("66a000000000000000000001"),
        name: "Asha Roy",
        email: "asha@example.com",
        city: "Kolkata",
        joinedAt: ISODate("2025-01-15T00:00:00.000Z"),
        isMember: true
      }
    ]
  }
]
```

Look closely: `customer` is an **array**, even though there is only one match. `$lookup` *always* produces an array, because in general there could be zero, one or many matches. The worker staples *all* the photocopies, even if there's only one.

## Turning the array into one document

For "one order has one customer", an array of one is awkward. There are two common fixes.

**Option 1: `$first`** (array operator, MongoDB 4.4+) replaces the array with its first element:

```javascript
db.orders.aggregate([
  { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } },
  { $set: { customer: { $first: "$customer" } } },
  { $project: { _id: 1, total: 1, customerName: "$customer.name", city: "$customer.city" } }
])
// → [
//   { _id: 1, total: 158,  customerName: "Asha Roy",    city: "Kolkata" },
//   { _id: 2, total: 1999, customerName: "Asha Roy",    city: "Kolkata" },
//   { _id: 3, total: 498,  customerName: "Rahul Mehta", city: "Mumbai" },
//   { _id: 4, total: 329,  customerName: "Priya Nair",  city: "Kolkata" },
//   { _id: 5, total: 2248, customerName: "Ken Sato",    city: "Tokyo" },
//   { _id: 6, total: 245,  customerName: "Priya Nair",  city: "Kolkata" }
// ]
```

**Option 2: `$unwind`** splits the array into separate documents (you'll study it in the next lesson). With one match, you get one document with `customer` as a plain object:

```javascript
{ $unwind: "$customer" }
```

> **Warning:** By default `$unwind` **drops** documents whose array is empty. If an order pointed to a deleted customer, it would quietly disappear from your report. `$first` keeps the order and just leaves `customer` missing.

## Joining, then grouping

Once the customer is attached, you can group by any of its fields. Revenue per city:

```javascript
db.orders.aggregate([
  { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } },
  { $set: { customer: { $first: "$customer" } } },
  { $group: { _id: "$customer.city", revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
  { $sort: { revenue: -1 } }
])
// → [
//   { _id: "Kolkata", revenue: 2731, orders: 4 },
//   { _id: "Tokyo",   revenue: 2248, orders: 1 },
//   { _id: "Mumbai",  revenue: 498,  orders: 1 }
// ]
```

The city only exists in `customers`, and the totals only exist in `orders`. The join lets one pipeline use both.

## Joining the other way: one-to-many

Now start from **customers** and pull in their orders. This time many matches are normal:

```javascript
db.customers.aggregate([
  { $lookup: { from: "orders", localField: "_id", foreignField: "customerId", as: "orders" } },
  { $project: { _id: 0, name: 1, orderCount: { $size: "$orders" } } }
])
// → [
//   { name: "Asha Roy",     orderCount: 2 },
//   { name: "Rahul Mehta",  orderCount: 1 },
//   { name: "Priya Nair",   orderCount: 2 },
//   { name: "Ken Sato",     orderCount: 1 },
//   { name: "Maria Garcia", orderCount: 0 }
// ]
```

Maria has no orders, so her `orders` array is **empty**, but she is still in the result. This is what SQL calls a **left outer join**: every document on the belt stays, matched or not.

```sql
-- The SQL idea, for comparison
SELECT c.name, COUNT(o.id)
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.name;
```

Want only customers who have **never** ordered? Match on the empty array:

```javascript
db.customers.aggregate([
  { $lookup: { from: "orders", localField: "_id", foreignField: "customerId", as: "orders" } },
  { $match: { orders: { $size: 0 } } },
  { $project: { _id: 0, name: 1, email: 1 } }
])
// → [ { name: "Maria Garcia", email: "maria@example.com" } ]
```

That's a perfect list for a "Your first order is 10% off!" email.

## Filtering joined documents with a sub-pipeline

The basic `$lookup` copies **every** matching document, with **every** field. Sometimes you only want some of them. For that, `$lookup` accepts a `pipeline`: a little conveyor belt that runs inside the other collection.

Since MongoDB 5.0 you can combine `localField`/`foreignField` with a `pipeline`. Here each customer gets only their **delivered** orders, with only the `total`:

```javascript
db.customers.aggregate([
  { $lookup: {
      from: "orders",
      localField: "_id",
      foreignField: "customerId",
      pipeline: [
        { $match: { status: "delivered" } },
        { $project: { _id: 1, total: 1 } }
      ],
      as: "deliveredOrders"
  } },
  { $project: { _id: 0, name: 1, deliveredOrders: 1 } }
])
// → [
//   { name: "Asha Roy",     deliveredOrders: [ { _id: 1, total: 158 } ] },
//   { name: "Rahul Mehta",  deliveredOrders: [ { _id: 3, total: 498 } ] },
//   { name: "Priya Nair",   deliveredOrders: [] },
//   { name: "Ken Sato",     deliveredOrders: [ { _id: 5, total: 2248 } ] },
//   { name: "Maria Garcia", deliveredOrders: [] }
// ]
```

### The let + $expr form

For more complex conditions, or on servers older than 5.0, use `let` to pass values from the current document into the sub-pipeline. Inside, you refer to them with `$$` and compare with `$expr`:

```javascript
db.customers.aggregate([
  { $lookup: {
      from: "orders",
      let: { custId: "$_id" },                       // a variable from the customer
      pipeline: [
        { $match: {
            $expr: { $eq: ["$customerId", "$$custId"] },   // join condition
            status: "delivered"                             // extra filter
        } },
        { $project: { _id: 1, total: 1 } }
      ],
      as: "deliveredOrders"
  } }
])
// Same result as above
```

Remember the `$` rule from the fundamentals lesson: inside the sub-pipeline, `"$customerId"` is a field of the **order**, and `"$$custId"` is the variable we passed in from the **customer**.

## Joining on an array field

`localField` can also be an **array**. Each order has `items.productId`, which is a list of product ids. `$lookup` matches *any* of them:

```javascript
db.orders.aggregate([
  { $lookup: {
      from: "products",
      localField: "items.productId",
      foreignField: "_id",
      pipeline: [ { $project: { _id: 0, name: 1, stock: 1 } } ],
      as: "products"
  } },
  { $match: { "products.stock": 0 } },               // orders containing an out-of-stock product
  { $project: { _id: 1, status: 1, products: 1 } }
])
// → [
//   { _id: 4, status: "pending",
//     products: [ { name: "USB Cable", stock: 0 }, { name: "Gel Pen", stock: 500 } ] }
// ]
```

Order 4 is pending and contains the USB Cable, which has no stock. Time to call the supplier!

> **Note:** The matched documents may not come back in the same order as the ids in your array. If order matters, sort them yourself or match them up with the item list afterwards.

## Keeping joins fast

For every document on the belt, `$lookup` searches the `from` collection. Without an index on `foreignField`, that's a full collection scan *for every document*. With 10,000 customers, that's 10,000 scans.

- Joining on `_id`? It's always indexed, so you're fine.
- Joining customers to orders on `customerId`? Create an index:

```javascript
db.orders.createIndex({ customerId: 1 })
```

More tips:

- **`$match` before `$lookup`.** Join only the documents you need, not the whole collection.
- **Trim the joined documents** with a sub-pipeline `$project`. Every copied field costs memory and network.
- **Mind the 16 MB limit.** If a customer could have 100,000 orders, the `orders` array could grow past the document size limit. Count or summarise inside the sub-pipeline instead of copying everything.
- **Same database only.** `from` must be a collection in the same database. Since MongoDB 5.1, the `from` collection can be sharded.

> **Tip:** If you find yourself running the same `$lookup` on every single request, it may be a sign the data should be **embedded** instead. Revisit [Embedding vs Referencing](/courses/mongodb/schema-design-embedding-vs-referencing).

> **Note:** `$unionWith` (MongoDB 4.4+) is sometimes confused with `$lookup`. It doesn't *attach* documents; it *stacks* the documents of another collection onto the belt, like SQL's `UNION ALL`.

## Common mistakes

- **Mismatched types.** If `customerId` is stored as the string `"66a0..."` but `_id` is an `ObjectId`, nothing matches and every array is empty. Store references with the same type (or convert with `$toObjectId`, covered in [Conversion Operators](/courses/mongodb/conversion-operators)).
- **Forgetting the result is an array.** `"$customer.name"` on an array gives you an array of names. Use `$first` or `$unwind` first.
- **`$unwind` hiding unmatched documents.** Use `preserveNullAndEmptyArrays: true`, or use `$first` instead.
- **No index on `foreignField`.** Joins that are fast on 6 orders become painfully slow on 6 million.
- **Mixing up `$` and `$$` in sub-pipelines.** `$field` is the joined collection's field; `$$var` is a variable from `let`.

## Practice

1. For every order, show its `_id`, `total` and the customer's `email`.
2. For every customer, show their `name` and total amount spent (`0` for Maria).
3. Show each order with a list of the **categories** of the products it contains.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Order + customer email
db.orders.aggregate([
  { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } },
  { $project: { total: 1, email: { $first: "$customer.email" } } }
])

// 2. Total spent per customer
db.customers.aggregate([
  { $lookup: { from: "orders", localField: "_id", foreignField: "customerId", as: "orders" } },
  { $project: { _id: 0, name: 1, spent: { $sum: "$orders.total" } } }
])
// → Asha 2157, Rahul 498, Priya 574, Ken 2248, Maria 0

// 3. Categories in each order
db.orders.aggregate([
  { $lookup: {
      from: "products",
      localField: "items.productId",
      foreignField: "_id",
      pipeline: [ { $project: { _id: 0, category: 1 } } ],
      as: "products"
  } },
  { $project: { categories: { $setUnion: ["$products.category"] } } }
])
// e.g. order 5 → categories: ["electronics", "kitchen"]
```

</details>

## Key takeaways

- **`$lookup`** joins documents from another collection in the same database. Matching documents are stapled on as an **array**.
- It behaves like a **left outer join**: documents with no match stay, with an empty array.
- Use **`$first`** or **`$unwind`** to turn a one-element array into a single document.
- A **sub-pipeline** (with `localField`/`foreignField` since 5.0, or `let` + `$expr`) filters and trims joined documents.
- Index the **`foreignField`**, `$match` before you join, and keep joined arrays small.

**Next lesson:** [unwind and Array Aggregation](/courses/mongodb/unwind-and-array-aggregation)
