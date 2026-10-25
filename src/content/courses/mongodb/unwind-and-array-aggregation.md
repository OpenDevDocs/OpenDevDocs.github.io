---
title: unwind and Array Aggregation
slug: unwind-and-array-aggregation
metadescription: Learn how $unwind splits arrays into separate documents for grouping, and how array operators like $size, $filter, $map and $sortArray work without unwinding.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'aggregation', 'unwind', 'arrays']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Core Stages: match, project, group and sort](/courses/mongodb/core-aggregation-stages) and [Joining Collections with lookup](/courses/mongodb/lookup-and-joins). It uses the `shop` data from [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals).

## What you will learn

By the end of this lesson you will know:

- What **`$unwind`** does and why you need it to group array elements
- How to find best-selling products from order line items
- The `$unwind` options **`includeArrayIndex`** and **`preserveNullAndEmptyArrays`**
- How to work on arrays **without** unwinding, using `$size`, `$filter`, `$map`, `$sortArray` and friends
- When to unwind and when not to

## The problem: answers hidden inside arrays

Each order has an `items` array. Order 1 looks like this:

```javascript
{
  _id: 1,
  total: 158,
  items: [
    { productId: ObjectId("66b000000000000000000001"), name: "Notebook", qty: 2, price: 49 },
    { productId: ObjectId("66b000000000000000000002"), name: "Gel Pen",  qty: 4, price: 15 }
  ],
  ...
}
```

Now the manager asks: **"How many Notebooks have we sold in total?"**

`$group` can't help directly, because a group key like `"$items.name"` would be the *whole list* `["Notebook", "Gel Pen"]`, not one product. We need each item on its own.

> **Think of it like this:** Imagine a box of 2 items riding on the conveyor belt. A worker opens the box and puts each item on the belt separately, with a copy of the box's label (order number, date, customer) stuck on each one. That worker is `$unwind`.

## $unwind: one document per array element

```javascript
db.orders.aggregate([
  { $match: { _id: 1 } },
  { $unwind: "$items" },
  { $project: { _id: 1, status: 1, items: 1 } }
])
```

**Before** `$unwind`: 1 document with an array of 2 items.
**After** `$unwind`: 2 documents, each with **one** item. `items` is now an object, not an array:

```javascript
[
  { _id: 1, status: "delivered",
    items: { productId: ObjectId("66b000000000000000000001"), name: "Notebook", qty: 2, price: 49 } },
  { _id: 1, status: "delivered",
    items: { productId: ObjectId("66b000000000000000000002"), name: "Gel Pen", qty: 4, price: 15 } }
]
```

Notice both documents have `_id: 1`. That's fine. They're temporary documents on the belt, not saved anywhere.

Across all 6 orders, `$unwind: "$items"` produces **9** documents, one per line item.

## Best sellers: unwind, then group

Now each item is its own document, so we can group by product name:

```javascript
db.orders.aggregate([
  { $unwind: "$items" },
  { $group: {
      _id: "$items.name",
      unitsSold: { $sum: "$items.qty" },
      revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } }
  } },
  { $sort: { revenue: -1 } }
])
// → [
//   { _id: "Headphones", unitsSold: 2, revenue: 3998 },
//   { _id: "Coffee Mug", unitsSold: 3, revenue: 747 },
//   { _id: "Notebook",   unitsSold: 7, revenue: 343 },
//   { _id: "USB Cable",  unitsSold: 1, revenue: 299 },
//   { _id: "Gel Pen",    unitsSold: 6, revenue: 90 }
// ]
```

So we sold 7 Notebooks. Notebooks win on units, but Headphones win on money.

This "unwind, then group" pattern is one of the most common in MongoDB. You'll write it again and again.

### Unwind + lookup: revenue per category

Order items don't store a category, but products do. Unwind the items, then join each one to its product:

```javascript
db.orders.aggregate([
  { $unwind: "$items" },
  { $lookup: { from: "products", localField: "items.productId", foreignField: "_id", as: "product" } },
  { $set: { product: { $first: "$product" } } },
  { $group: {
      _id: "$product.category",
      revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } }
  } },
  { $sort: { revenue: -1 } }
])
// → [
//   { _id: "electronics", revenue: 4297 },
//   { _id: "kitchen",     revenue: 747 },
//   { _id: "stationery",  revenue: 433 }
// ]
```

### A shortcut: $sortByCount

"Unwind, group, count, sort by count" is so common that it has its own stage. Which product tags are most popular?

```javascript
db.products.aggregate([
  { $unwind: "$tags" },
  { $sortByCount: "$tags" }
])
// → [ { _id: "school", count: 2 }, { _id: "paper", count: 1 }, { _id: "pen", count: 1 }, ... ]
```

`$sortByCount: "$tags"` is the same as `$group` by tag with `count: { $sum: 1 }`, followed by `$sort: { count: -1 }`. Tags with the same count can appear in any order.

## $unwind options

The short form `{ $unwind: "$items" }` is enough most of the time. The long form gives you two extra switches:

```javascript
{ $unwind: {
    path: "$items",
    includeArrayIndex: "line",            // optional: store the element's position
    preserveNullAndEmptyArrays: true      // optional: keep documents with no elements
} }
```

### includeArrayIndex: remember the position

```javascript
db.orders.aggregate([
  { $match: { _id: 4 } },
  { $unwind: { path: "$items", includeArrayIndex: "line" } },
  { $project: { _id: 1, line: 1, item: "$items.name" } }
])
// → [
//   { _id: 4, line: Long("0"), item: "USB Cable" },
//   { _id: 4, line: Long("1"), item: "Gel Pen" }
// ]
```

Positions start at **0**. The value is stored as a long integer, which mongosh shows as `Long("0")`. (Need the position *without* unwinding? See [Array Index Access with IDX and arrayIndexAs](/courses/mongodb/array-index-access).)

### preserveNullAndEmptyArrays: don't lose anyone

By default, `$unwind` **drops** a document if the array is **missing, `null` or empty**. There's nothing to put on the belt, so the document simply vanishes. Watch Maria, who has no orders:

```javascript
db.customers.aggregate([
  { $lookup: { from: "orders", localField: "_id", foreignField: "customerId", as: "orders" } },
  { $unwind: "$orders" },
  { $group: { _id: "$name", spent: { $sum: "$orders.total" } } }
])
// → Asha 2157, Ken 2248, Priya 574, Rahul 498   (no Maria!)
```

Add `preserveNullAndEmptyArrays: true` and she stays, with no `orders` field:

```javascript
db.customers.aggregate([
  { $lookup: { from: "orders", localField: "_id", foreignField: "customerId", as: "orders" } },
  { $unwind: { path: "$orders", preserveNullAndEmptyArrays: true } },
  { $group: { _id: "$name", spent: { $sum: "$orders.total" } } }
])
// → Asha 2157, Ken 2248, Maria 0, Priya 574, Rahul 498
```

> **Warning:** Silently dropped documents are one of the sneakiest bugs in reports. Whenever you `$unwind`, ask yourself: "Can this array be empty? Do I still want those documents?"

> **Note:** If the field is not an array but a single value (for example `tags: "gift"`), `$unwind` treats it like an array of one element.

## Putting arrays back together

After unwinding, you can rebuild arrays with `$group` and `$push`. Here we keep only order lines with a quantity of 2 or more, then pack them back per order:

```javascript
db.orders.aggregate([
  { $unwind: "$items" },
  { $match: { "items.qty": { $gte: 2 } } },
  { $group: { _id: "$_id", bigItems: { $push: "$items.name" } } },
  { $sort: { _id: 1 } }
])
// → [
//   { _id: 1, bigItems: ["Notebook", "Gel Pen"] },
//   { _id: 3, bigItems: ["Coffee Mug"] },
//   { _id: 4, bigItems: ["Gel Pen"] },
//   { _id: 6, bigItems: ["Notebook"] }
// ]
```

It works, but notice two things. Orders 2 and 5 **disappeared** (they had no big items). And we lost every other field of the order. There's a better way for jobs like this.

## Array operators: work inside the box

Many array questions are about **one document at a time**: "how many items in this order?", "which items in this order are big?". For these, you don't need to unwind. Array **expression operators** work on the array right where it is, inside `$project` or `$set`.

> **Think of it like this:** Instead of tipping the box out onto the belt, the worker reaches into the box, does the job, and closes it again. The box stays one box.

The same "big items" question, without unwinding:

```javascript
db.orders.aggregate([
  { $project: {
      bigItems: {
        $filter: { input: "$items", as: "item", cond: { $gte: ["$$item.qty", 2] } }
      }
  } }
])
// → order 1: [Notebook, Gel Pen lines], order 2: [], order 3: [Coffee Mug line], ...
```

Every order is still there (order 2 just gets an empty list), and you could keep any other fields too. `$$item` is the variable name we chose with `as`, pointing at the current element.

### More useful array operators

Here's a pipeline that shows several at once:

```javascript
db.orders.aggregate([
  { $match: { _id: 1 } },
  { $project: {
      itemCount:  { $size: "$items" },                          // how many lines
      units:      { $sum: "$items.qty" },                       // total quantity
      firstItem:  { $first: "$items.name" },                    // first line's name
      hasGelPen:  { $in: ["Gel Pen", "$items.name"] },          // is it in the list?
      checkTotal: { $sum: { $map: {                             // recompute the total
                      input: "$items", as: "i",
                      in: { $multiply: ["$$i.qty", "$$i.price"] } } } },
      priciest:   { $first: { $sortArray: { input: "$items", sortBy: { price: -1 } } } }
  } }
])
// → [
//   { _id: 1, itemCount: 2, units: 6, firstItem: "Notebook", hasGelPen: true, checkTotal: 158,
//     priciest: { productId: ObjectId("66b000000000000000000001"), name: "Notebook", qty: 2, price: 49 } }
// ]
```

`checkTotal` matches the stored `total` of 158, so the order is correct. Handy for data checks!

> **Note:** `"$items.qty"` on an array of documents gives you an array of the values: `[2, 4]`. That's why `$sum: "$items.qty"` works.

A quick reference:

| Operator | What it does | Since |
| --- | --- | --- |
| `$size` | Number of elements | |
| `$arrayElemAt` | Element at a position: `{ $arrayElemAt: ["$items", 0] }` | |
| `$first` / `$last` | First / last element | 4.4 |
| `$slice` | A part of the array: `{ $slice: ["$items", 2] }` | |
| `$in` | Is a value in the array? | |
| `$filter` | Keep elements that pass a test | |
| `$map` | Transform every element | |
| `$reduce` | Combine all elements into one value | |
| `$concatArrays` | Join arrays end to end | |
| `$setUnion` | Merge arrays, removing duplicates | |
| `$sortArray` | Sort the elements | 5.2 |
| `$firstN` / `$lastN` / `$maxN` / `$minN` | First, last, biggest or smallest N elements | 5.2 |

## Unwind or array operator?

| Your question is about... | Use |
| --- | --- |
| Elements **across many documents** ("total Notebooks sold") | `$unwind` + `$group` |
| Elements **within one document** ("items in this order") | Array operators in `$project`/`$set` |
| Joining each element to another collection | `$unwind` + `$lookup` (or `$lookup` on the array field) |

> **Tip:** `$unwind` multiplies documents. 1 million orders with 10 items each become 10 million documents on the belt. Always `$match` **before** `$unwind`, and prefer array operators when you don't really need to group across documents.

## Common mistakes

- **Losing documents with empty arrays.** `$unwind` drops them by default. Use `preserveNullAndEmptyArrays: true` when they matter.
- **Forgetting that `items` is an object after unwinding.** Write `"$items.qty"` (works on both), but don't expect `$size: "$items"` to work after `$unwind`. It's no longer an array.
- **Unwinding to answer a per-document question.** Use `$filter`, `$map`, `$size` instead. It's simpler and faster.
- **Unwinding before filtering.** Put `$match` first so fewer documents get multiplied.
- **Using `$` instead of `$$` for the element variable.** Inside `$filter`/`$map`, the current element is `"$$item"` (two dollar signs), not `"$item"`.

## Practice

1. Find the total **quantity** of each product sold, but only from **delivered** orders.
2. For each order, add a field `lineCount` (number of items) and `names` (array of item names), without `$unwind`.
3. Which customers have bought a `"Gel Pen"`? Show their `customerId` only once each.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Units sold from delivered orders
db.orders.aggregate([
  { $match: { status: "delivered" } },            // filter BEFORE unwinding
  { $unwind: "$items" },
  { $group: { _id: "$items.name", units: { $sum: "$items.qty" } } },
  { $sort: { units: -1 } }
])
// → Gel Pen 4, Coffee Mug 3, Notebook 2, Headphones 1

// 2. Without unwinding
db.orders.aggregate([
  { $set: { lineCount: { $size: "$items" }, names: "$items.name" } }
])

// 3. Gel Pen buyers
db.orders.aggregate([
  { $match: { "items.name": "Gel Pen" } },
  { $group: { _id: "$customerId" } }
])
// → Asha (66a...0001) and Priya (66a...0003)
```

</details>

## Key takeaways

- **`$unwind`** turns one document with an array of N elements into N documents, each with one element.
- **Unwind, then group** answers questions across many documents, like best sellers.
- `includeArrayIndex` keeps the position; `preserveNullAndEmptyArrays: true` keeps documents with empty or missing arrays.
- **Array operators** (`$size`, `$filter`, `$map`, `$sortArray`, `$in`...) work inside one document without unwinding.
- `$match` before `$unwind`, because unwinding multiplies the number of documents.

**Next lesson:** [facet, bucket and Multi-Result Pipelines](/courses/mongodb/facet-and-bucket)
