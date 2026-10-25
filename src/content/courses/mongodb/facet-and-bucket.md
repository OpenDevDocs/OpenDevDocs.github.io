---
title: facet, bucket and Multi-Result Pipelines
slug: facet-and-bucket
metadescription: Learn to build search filters, price ranges and paginated results in one query with $facet, $bucket and $bucketAuto, and combine collections with $unionWith.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'aggregation', 'facet', 'bucket']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Core Stages: match, project, group and sort](/courses/mongodb/core-aggregation-stages) and [unwind and Array Aggregation](/courses/mongodb/unwind-and-array-aggregation). It uses the `shop` data from [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals).

## What you will learn

By the end of this lesson you will know:

- How **`$bucket`** sorts documents into ranges you choose, like price bands
- How **`$bucketAuto`** picks the ranges for you
- How **`$facet`** runs several pipelines on the same documents and returns all the answers at once
- How to build **pagination with a total count** in one query
- How **`$unionWith`** stacks documents from two collections into one result

## The shopping page problem

Open any shopping site and search for something. Next to the results you see a sidebar like this:

```text
Category                 Price
  stationery (2)           Under 100 (2)
  electronics (2)          100 – 499 (2)
  kitchen (1)              500 and up (1)

5 products found          Top rated: Coffee Mug (4.8)
```

That one page needs **four** different answers: counts by category, counts by price range, a total, and a top item. You could send four queries. In this lesson you'll learn to get them all in **one**.

First, though, we need a way to count by *range*.

## $bucket: sorting into ranges you choose

`$group` puts documents with the **same value** together. But prices are rarely the same. We want *ranges*: 0 to 99, 100 to 499, and so on. That's `$bucket`.

> **Think of it like this:** At the end of the conveyor belt stands a row of labelled bins: "0+", "100+", "500+". A worker looks at each product's price and drops it into the right bin. Each bin then gets a sticker with a count.

```javascript
db.products.aggregate([
  { $bucket: {
      groupBy: "$price",                     // the value to look at
      boundaries: [0, 100, 500, 5000],       // where each bin starts and ends
      output: {
        count: { $sum: 1 },
        products: { $push: "$name" }
      }
  } }
])
// → [
//   { _id: 0,   count: 2, products: ["Notebook", "Gel Pen"] },
//   { _id: 100, count: 2, products: ["USB Cable", "Coffee Mug"] },
//   { _id: 500, count: 1, products: ["Headphones"] }
// ]
```

How to read `boundaries: [0, 100, 500, 5000]`:

| Bucket `_id` | Includes prices | Products |
| --- | --- | --- |
| `0` | 0 up to (but not including) 100 | Notebook 49, Gel Pen 15 |
| `100` | 100 up to (but not including) 500 | USB Cable 299, Coffee Mug 249 |
| `500` | 500 up to (but not including) 5000 | Headphones 1999 |

Each bucket's `_id` is its **lower boundary**. The lower edge is included and the upper edge is not, so a price of exactly 100 goes into the `100` bucket.

> **Note:** If you leave out `output`, each bucket just gets a `count`. If you *do* write `output`, add `count: { $sum: 1 }` yourself, as we did, or it won't be there.

### The default bucket

What if a product costs 9,999, beyond the last boundary? Without a safety net, MongoDB returns an **error**. Add a `default` bucket to catch everything that doesn't fit (including documents where the field is missing):

```javascript
db.products.aggregate([
  { $bucket: {
      groupBy: "$price",
      boundaries: [0, 100, 500],
      default: "500 and up"
  } }
])
// → [
//   { _id: 0,            count: 2 },
//   { _id: 100,          count: 2 },
//   { _id: "500 and up", count: 1 }
// ]
```

Rules to remember:

- `boundaries` must be in **ascending order** and all the same type (all numbers, or all dates...).
- You need at least **two** boundaries (one bucket).
- The `default` value must sit outside the boundaries, for example a text label like ours.

## $bucketAuto: let MongoDB choose the ranges

Sometimes you don't know good boundaries in advance. `$bucketAuto` takes a number of buckets and tries to spread the documents **evenly** across them.

Split our 6 orders by total into 3 buckets:

```javascript
db.orders.aggregate([
  { $bucketAuto: { groupBy: "$total", buckets: 3 } }
])
// → [
//   { _id: { min: 158,  max: 329 },  count: 2 },
//   { _id: { min: 329,  max: 1999 }, count: 2 },
//   { _id: { min: 1999, max: 2248 }, count: 2 }
// ]
```

Each bucket's `_id` is now a `{ min, max }` pair. Our sorted totals are 158, 245, 329, 498, 1999 and 2248, so each bucket got two orders. As with `$bucket`, `max` is *not* included in that bucket, except in the last bucket, where `max` is the largest value.

> **Tip:** Ranges like "158 to 329" look odd in a shop sidebar. `$bucketAuto` has a `granularity` option (for example `"1-2-5"` or `"POWERSOF2"`) that rounds boundaries to "nice" numbers. It only works when every `groupBy` value is a number.

## $facet: many pipelines, one trip

Now for the main trick. `$facet` takes the documents on the belt and sends a **copy** of them down several **sub-pipelines** at the same time. Each sub-pipeline has a name. The result is a **single document** with one array per name.

> **Think of it like this:** The conveyor belt splits into four smaller belts. Every product goes down all four. One belt counts by category, one sorts into price bins, one finds the top rated item, and one just counts. At the end, the four results are packed together into one parcel.

Here's the whole shopping sidebar in one query:

```javascript
db.products.aggregate([
  { $facet: {
      byCategory: [
        { $sortByCount: "$category" }
      ],
      byPrice: [
        { $bucket: { groupBy: "$price", boundaries: [0, 100, 500], default: "500 and up" } }
      ],
      topRated: [
        { $match: { rating: { $exists: true } } },
        { $sort: { rating: -1 } },
        { $limit: 1 },
        { $project: { _id: 0, name: 1, rating: 1 } }
      ],
      total: [
        { $count: "products" }
      ]
  } }
])
```

**Before** `$facet`: 5 product documents on the belt.
**After** `$facet`: exactly **one** document:

```javascript
[
  {
    byCategory: [
      { _id: "stationery",  count: 2 },
      { _id: "electronics", count: 2 },
      { _id: "kitchen",     count: 1 }
    ],
    byPrice: [
      { _id: 0,            count: 2 },
      { _id: 100,          count: 2 },
      { _id: "500 and up", count: 1 }
    ],
    topRated: [ { name: "Coffee Mug", rating: 4.8 } ],
    total: [ { products: 5 } ]
  }
]
```

Every sidebar number from the beginning of the lesson, in one round trip. (`stationery` and `electronics` both have 2, so they may swap places.)

### Filter first, then facet

A real search page shows facets for the *search results*, not for the whole shop. Put a `$match` **before** `$facet`:

```javascript
db.products.aggregate([
  { $match: { stock: { $gt: 0 } } },          // only products in stock
  { $facet: {
      byCategory: [ { $sortByCount: "$category" } ],
      total: [ { $count: "products" } ]
  } }
])
// → [ { byCategory: [ { _id: "stationery", count: 2 }, { _id: "electronics", count: 1 }, { _id: "kitchen", count: 1 } ],
//       total: [ { products: 4 } ] } ]
```

The USB Cable (stock 0) is gone from every facet at once.

> **Warning:** Sub-pipelines inside `$facet` **can't use indexes**. They work on the documents handed to them. So always do your filtering with a `$match` *before* the `$facet`, where an index can help.

## Pagination with a total count

Lists in apps usually show "Page 1 of 3" and need two things: **one page of results** and **the total number**. `$facet` gives you both.

Show orders newest first, 2 per page, page 1:

```javascript
db.orders.aggregate([
  { $sort: { createdAt: -1, _id: 1 } },
  { $facet: {
      metadata: [ { $count: "totalOrders" } ],
      data: [
        { $skip: 0 },          // (page - 1) * pageSize
        { $limit: 2 },         // pageSize
        { $project: { status: 1, total: 1, createdAt: 1 } }
      ]
  } },
  { $project: {
      totalOrders: { $first: "$metadata.totalOrders" },
      data: 1
  } }
])
// → [
//   {
//     data: [
//       { _id: 4, status: "pending", createdAt: ISODate("2026-03-18T00:00:00.000Z"), total: 329 },
//       { _id: 2, status: "shipped", createdAt: ISODate("2026-03-05T00:00:00.000Z"), total: 1999 }
//     ],
//     totalOrders: 6
//   }
// ]
```

The last `$project` tidies the result so your app reads `totalOrders` as a plain number. For page 2, change `$skip` to `2`.

Here's the same thing from a Node.js app:

```javascript
const page = 2;
const pageSize = 2;

const [result] = await db.collection("orders").aggregate([
  { $sort: { createdAt: -1, _id: 1 } },
  { $facet: {
      metadata: [{ $count: "totalOrders" }],
      data: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }]
  } }
]).toArray();

const totalOrders = result.metadata[0]?.totalOrders ?? 0;
console.log(`Page ${page} of ${Math.ceil(totalOrders / pageSize)}`);   // Page 2 of 3
```

> **Note:** `$skip` gets slower as page numbers grow, because MongoDB still walks past every skipped document. For very deep pages, "load more after the last `_id` I saw" (a range query) is faster.

## $facet limits

`$facet` is powerful, but keep these in mind:

- **One output document.** All facets together must fit in the **16 MB** document limit. Don't put a sub-pipeline that returns thousands of full documents inside a facet.
- **No indexes inside.** As above, filter before the facet.
- **Some stages aren't allowed** inside a facet, including `$facet` itself, `$out`, `$merge`, `$geoNear`, `$collStats` and `$indexStats`.

## $unionWith: stacking two collections

`$facet` splits one stream into many. `$unionWith` (MongoDB 4.4+) does the opposite: it **adds** documents from another collection onto the belt, like SQL's `UNION ALL`.

Let's build a simple activity feed with new customers *and* new orders, newest first:

```javascript
db.customers.aggregate([
  { $project: { _id: 0, date: "$joinedAt", event: { $concat: ["New customer: ", "$name"] } } },
  { $unionWith: {
      coll: "orders",
      pipeline: [
        { $project: { _id: 0, date: "$createdAt", event: { $concat: ["Order #", { $toString: "$_id" }] } } }
      ]
  } },
  { $sort: { date: -1 } },
  { $limit: 4 }
])
// → [
//   { date: ISODate("2026-05-08T00:00:00.000Z"), event: "New customer: Maria Garcia" },
//   { date: ISODate("2026-03-18T00:00:00.000Z"), event: "Order #4" },
//   { date: ISODate("2026-03-05T00:00:00.000Z"), event: "Order #2" },
//   { date: ISODate("2026-02-28T00:00:00.000Z"), event: "Order #6" }
// ]
```

The `pipeline` inside `$unionWith` reshapes the orders so they look like the customer events. After that, they're all just documents on the same belt, and `$sort` treats them equally.

| Stage | Shape | Use it for |
| --- | --- | --- |
| `$facet` | One input → many named results in one document | Sidebars, dashboards, pagination |
| `$unionWith` | Two collections → one combined stream | Feeds, combining archived and live data |
| `$lookup` | Attach matching documents to each document | Joins (previous lessons) |

## Common mistakes

- **Unsorted or mixed-type `boundaries`.** `[100, 0, 500]` or `[0, "100"]` causes an error. Keep them ascending and one type.
- **No `default` bucket.** One value outside your boundaries and the whole query fails. Add a `default` unless you're sure.
- **Forgetting `count` when you add `output`.** `$bucket` only adds `count` automatically when `output` is left out.
- **Filtering inside `$facet` instead of before it.** It works, but can't use an index. Move shared filters before the facet.
- **Treating `$facet` output like many documents.** It's always **one** document. In your app, read `result[0].byCategory`, not `result.byCategory`.

## Practice

1. Put customers into buckets by the **year** they joined (2025 and 2026). Hint: group by `{ $year: "$joinedAt" }`.
2. Write one `$facet` query on orders that returns: the count per `status`, and the single biggest order.
3. Split products into 2 automatic buckets by `stock`.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Customers by join year
db.customers.aggregate([
  { $bucket: {
      groupBy: { $year: "$joinedAt" },
      boundaries: [2025, 2026, 2027],
      output: { count: { $sum: 1 }, names: { $push: "$name" } }
  } }
])
// → [ { _id: 2025, count: 3, names: ["Asha Roy", "Rahul Mehta", "Priya Nair"] },
//     { _id: 2026, count: 2, names: ["Ken Sato", "Maria Garcia"] } ]

// 2. Status counts + biggest order
db.orders.aggregate([
  { $facet: {
      byStatus: [ { $sortByCount: "$status" } ],
      biggest: [ { $sort: { total: -1 } }, { $limit: 1 }, { $project: { total: 1 } } ]
  } }
])
// → byStatus: delivered 3, shipped 2, pending 1; biggest: [ { _id: 5, total: 2248 } ]

// 3. Two automatic buckets by stock
db.products.aggregate([
  { $bucketAuto: { groupBy: "$stock", buckets: 2 } }
])
```

</details>

## Key takeaways

- **`$bucket`** groups documents into **ranges** you choose with `boundaries`; add a `default` bucket for values that don't fit.
- **`$bucketAuto`** picks the ranges for you, aiming for evenly sized buckets.
- **`$facet`** runs several sub-pipelines on the same input and returns **one document** with all the results.
- Use `$facet` for search sidebars, dashboards and **pagination with a total count**.
- Filter with `$match` **before** `$facet`, and keep the combined output under 16 MB.
- **`$unionWith`** stacks documents from another collection onto the belt.

**Next lesson:** [Window Functions with setWindowFields](/courses/mongodb/window-functions)
