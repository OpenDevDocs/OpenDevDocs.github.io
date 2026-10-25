---
title: Projections and Field Selection
slug: projections
metadescription: Learn how to return only the fields you need from MongoDB queries using projections, including _id, nested fields, $slice and $elemMatch.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'queries', 'projection', 'crud']
course: mongodb
---
## What you will learn

By the end of this lesson you will know how to:

- Return only some fields from a query (an **inclusion** projection)
- Hide fields you don't want (an **exclusion** projection)
- Control the `_id` field
- Pick fields inside embedded documents
- Return part of an array with `$slice` and `$elemMatch`

So far, every `find()` you ran returned **whole** documents. That's fine for five products. But a real product document might have 40 fields, and your page may only need the name and the price. Sending everything wastes time and network.

## Get the sample data ready

We'll keep using the `shop` database. Run this in mongosh to make sure you have the same data:

```javascript
use shop

db.products.deleteMany({})
db.products.insertMany([
  { name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"] },
  { name: "Gel Pen", category: "stationery", price: 15, stock: 500, tags: ["pen", "school"] },
  { name: "Headphones", category: "electronics", price: 1999, stock: 35, tags: ["audio", "wireless"], rating: 4.5 },
  { name: "USB Cable", category: "electronics", price: 299, stock: 0, tags: ["cable"] },
  { name: "Coffee Mug", category: "kitchen", price: 249, stock: 60, tags: ["ceramic", "gift"], rating: 4.8 }
])
```

## What is a projection?

A **projection** is the list of fields you want back from a query. You pass it as the **second** argument to `find()` or `findOne()`:

```javascript
db.products.find(filter, projection)
```

The first argument decides **which documents** come back. The second decides **which fields** of those documents come back.

> **Think of it like this:** The filter is choosing which students to call into the room. The projection is choosing which page of their file you want to read. You still get the same students, just less paper.

## Including fields

To show a field, give it the value `1` (or `true`). Let's show only the name and price of every product:

```javascript
db.products.find({}, { name: 1, price: 1 })
```

The result:

```javascript
[
  { _id: ObjectId("..."), name: "Notebook", price: 49 },
  { _id: ObjectId("..."), name: "Gel Pen", price: 15 },
  { _id: ObjectId("..."), name: "Headphones", price: 1999 },
  { _id: ObjectId("..."), name: "USB Cable", price: 299 },
  { _id: ObjectId("..."), name: "Coffee Mug", price: 249 }
]
```

The empty filter `{}` means "all documents". Every other field (category, stock, tags, rating) is gone.

But wait, `_id` came back even though we didn't ask for it. That is on purpose.

## The special `_id` rule

MongoDB **always** includes `_id` unless you turn it off. To hide it, set it to `0`:

```javascript
db.products.find({}, { name: 1, price: 1, _id: 0 })
// → [
//     { name: "Notebook", price: 49 },
//     { name: "Gel Pen", price: 15 },
//     ...
//   ]
```

This is the cleanest way to get a simple list for display.

## Excluding fields

Sometimes it's easier to say what you **don't** want. Give those fields the value `0`, and everything else comes back:

```javascript
// Everything except tags and stock
db.products.find({ category: "kitchen" }, { tags: 0, stock: 0 })
// → [
//     { _id: ObjectId("..."), name: "Coffee Mug", category: "kitchen", price: 249, rating: 4.8 }
//   ]
```

Exclusion is handy when a document has one big field (like a long description or an image list) that you want to skip.

## You can't mix 1 and 0 (except `_id`)

A projection must be **either** an inclusion list **or** an exclusion list. This will fail:

```javascript
db.products.find({}, { name: 1, stock: 0 })
// → MongoServerError: Cannot do exclusion on field stock in inclusion projection
```

Why? If you say "include name", MongoDB already hides everything else. Saying "and also hide stock" makes no sense.

The **only** exception is `_id`. You can always turn `_id` off in an inclusion projection, like `{ name: 1, _id: 0 }`.

| Projection | What you get |
| --- | --- |
| `{ name: 1 }` | `_id` and `name` |
| `{ name: 1, _id: 0 }` | only `name` |
| `{ tags: 0 }` | every field except `tags` |
| `{ tags: 0, _id: 0 }` | every field except `tags` and `_id` |
| `{ name: 1, tags: 0 }` | an error |

> **Tip:** A field you ask for that doesn't exist is simply left out. `{ name: 1, rating: 1 }` returns `rating` only for products that have one. No error, no `null`.

## Projections with filters, `findOne` and sorting

Projections combine with everything you have learned so far. Here we find cheap stationery and show just the name:

```javascript
db.products.find(
  { category: "stationery", price: { $lt: 50 } },
  { name: 1, _id: 0 }
)
// → [ { name: "Notebook" }, { name: "Gel Pen" } ]
```

`findOne()` takes a projection in the same place:

```javascript
db.products.findOne({ name: "Headphones" }, { price: 1, stock: 1, _id: 0 })
// → { price: 1999, stock: 35 }
```

You can also chain methods like `sort()` after a projected `find()`. You'll learn about sorting in the next lesson.

## Selecting fields inside embedded documents

Documents can contain other documents. Let's add one product with a nested `supplier` field so we can try it:

```javascript
db.products.insertOne({
  name: "Desk Lamp",
  category: "electronics",
  price: 899,
  stock: 20,
  tags: ["light", "desk"],
  supplier: { name: "BrightCo", city: "Pune", phone: "020-555-0101" }
})
```

To pick a field **inside** `supplier`, use **dot notation**: the parent name, a dot, then the child name. The whole thing must be in quotes:

```javascript
db.products.find(
  { name: "Desk Lamp" },
  { name: 1, "supplier.city": 1, _id: 0 }
)
// → [ { name: "Desk Lamp", supplier: { city: "Pune" } } ]
```

Notice that the result keeps the shape. You get a `supplier` object containing only `city`.

You can exclude nested fields the same way:

```javascript
db.products.find({ name: "Desk Lamp" }, { "supplier.phone": 0, _id: 0 })
// → [ { name: "Desk Lamp", ..., supplier: { name: "BrightCo", city: "Pune" } } ]
```

You will learn much more about this in the *Embedded Documents and Dot Notation* lesson.

## Returning part of an array

Arrays can grow long. A blog post might have hundreds of comments. Projections give you two tools to return only some elements.

### `$slice`: the first or last few items

`$slice` with a positive number returns that many items from the **start** of the array:

```javascript
db.products.find({}, { name: 1, tags: { $slice: 1 }, _id: 0 })
// → [
//     { name: "Notebook", tags: ["paper"] },
//     { name: "Gel Pen", tags: ["pen"] },
//     { name: "Headphones", tags: ["audio"] },
//     ...
//   ]
```

A negative number counts from the **end**:

```javascript
db.products.find({ name: "Notebook" }, { name: 1, tags: { $slice: -1 }, _id: 0 })
// → [ { name: "Notebook", tags: ["school"] } ]
```

And `[skip, count]` lets you jump ahead, like pages:

```javascript
// Skip 1 tag, then return 1 tag
db.products.find({ name: "Headphones" }, { tags: { $slice: [1, 1] }, _id: 0 })
// → [ { tags: ["wireless"] } ]
```

> **Note:** `$slice` is a little different from other projections. On its own, like `{ tags: { $slice: 1 } }`, it returns **all** the other fields too. Add field names with `1` (as above) if you want only a few.

### `$elemMatch`: the first item that matches

For arrays of objects, `$elemMatch` returns the **first** element that matches a condition. Let's add an order with several items:

```javascript
db.orders.insertOne({
  status: "pending",
  items: [
    { name: "Notebook", qty: 3, price: 49 },
    { name: "Headphones", qty: 1, price: 1999 },
    { name: "Gel Pen", qty: 10, price: 15 }
  ],
  total: 2296
})
```

Now show only the first item that costs more than 1000:

```javascript
db.orders.find(
  { status: "pending" },
  { items: { $elemMatch: { price: { $gt: 1000 } } }, _id: 0 }
)
// → [ { items: [ { name: "Headphones", qty: 1, price: 1999 } ] } ]
```

If no element matches, the `items` field is left out of that document. You'll see more array tricks in the *Working with Arrays* lesson.

## Bonus: computed fields

In MongoDB 4.4 and later (including the MongoDB 8.x this course uses), a projection can also **create** a field from an expression. For example, to show a price that includes 18% tax:

```javascript
db.products.find(
  { category: "kitchen" },
  { name: 1, priceWithTax: { $multiply: ["$price", 1.18] }, _id: 0 }
)
// → [ { name: "Coffee Mug", priceWithTax: 293.82 } ]
```

The `"$price"` (with a dollar sign inside quotes) means "the value of the price field". This is the same expression language used by the **aggregation pipeline**, which you'll meet in the Intermediate section. For now, it's enough to know it exists.

## Projections in application code

In mongosh, the projection is the second argument. In the Node.js driver it goes inside an options object under the key `projection`. You'll write code like this in the *Connecting MongoDB to Your First App* lesson:

```javascript
// Node.js driver
const cheap = await db.collection("products")
  .find({ price: { $lt: 300 } }, { projection: { name: 1, price: 1, _id: 0 } })
  .toArray();
```

> **Warning:** In Node.js, the second argument of `find()` is an *options* object, not a projection. If you pass `{ name: 1 }` there without the `projection` key, the driver does not treat it as a projection, and you get whole documents back.

## Common mistakes

- **Mixing 1 and 0.** `{ name: 1, stock: 0 }` throws an error. Pick inclusion or exclusion. Only `_id: 0` may be mixed in.
- **Forgetting that `_id` comes back.** Add `_id: 0` when you want a clean list.
- **Not quoting dot notation.** `{ supplier.city: 1 }` is a JavaScript syntax error. Write `{ "supplier.city": 1 }`.
- **Putting the projection in the filter.** `find({ name: 1 })` searches for documents where `name` equals `1`. The projection is the **second** argument: `find({}, { name: 1 })`.
- **Thinking projection saves server work on its own.** It mostly saves network and memory in your app. To make the query itself faster, you'll use indexes (covered in the Indexing section).

## Practice

1. Show the `name` and `stock` of every electronics product, without `_id`.
2. Show every field of the Gel Pen except `tags` and `_id`.
3. Show each product's name and only its **last** tag.
4. From the Desk Lamp, show only the supplier's name.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Inclusion projection with _id turned off
db.products.find({ category: "electronics" }, { name: 1, stock: 1, _id: 0 })
// → Headphones, USB Cable, Desk Lamp with their stock

// 2. Exclusion projection
db.products.find({ name: "Gel Pen" }, { tags: 0, _id: 0 })
// → { name: "Gel Pen", category: "stationery", price: 15, stock: 500 }

// 3. $slice with a negative number
db.products.find({}, { name: 1, tags: { $slice: -1 }, _id: 0 })

// 4. Dot notation in quotes
db.products.find({ name: "Desk Lamp" }, { "supplier.name": 1, _id: 0 })
// → { supplier: { name: "BrightCo" } }
```

</details>

## Key takeaways

- A projection is the second argument to `find()` and `findOne()`. It decides which **fields** come back.
- Use `1` to include fields or `0` to exclude them, but don't mix the two (except `_id`).
- `_id` is included by default. Use `_id: 0` to hide it.
- Use quoted dot notation like `"supplier.city"` for nested fields.
- `$slice` and `$elemMatch` return only part of an array.

**Next lesson:** [Sorting, Limiting and Skipping](/courses/mongodb/sort-limit-skip)
