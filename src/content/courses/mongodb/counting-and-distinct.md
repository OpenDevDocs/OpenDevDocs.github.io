---
title: Counting Documents and Distinct Values
slug: counting-and-distinct
metadescription: Learn how to count MongoDB documents with countDocuments and estimatedDocumentCount, and list unique values in a field with distinct().
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'queries', 'counting', 'distinct']
course: mongodb
---
## What you will learn

By the end of this lesson you will know how to:

- Count documents that match a filter with `countDocuments()`
- Get a quick total for a whole collection with `estimatedDocumentCount()`
- List the unique values of a field with `distinct()`
- Know which old counting methods to avoid
- Take a first peek at counting per group

Counting is one of the most common questions an app asks. "How many orders are pending?" "How many products are out of stock?" "Which cities do our customers live in?" MongoDB has small, dedicated methods for exactly these questions.

## Get the sample data ready

We'll use the `shop` products and add a few customers. Run this in mongosh:

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

db.customers.deleteMany({})
db.customers.insertMany([
  { name: "Asha", email: "asha@example.com", city: "Kolkata", joinedAt: ISODate("2025-03-10"), isMember: true },
  { name: "Rahul", email: "rahul@example.com", city: "Mumbai", joinedAt: ISODate("2026-01-15"), isMember: false },
  { name: "Priya", email: "priya@example.com", city: "Kolkata", joinedAt: ISODate("2026-06-02"), isMember: true },
  { name: "Ken", email: "ken@example.com", city: "Tokyo", joinedAt: ISODate("2024-11-20"), isMember: false },
  { name: "Maria", email: "maria@example.com", city: "Madrid", joinedAt: ISODate("2026-02-14"), isMember: true }
])
```

## Counting with `countDocuments()`

`countDocuments()` takes the **same filter** you would give to `find()`, but instead of returning the documents, it returns a number.

Let's count every product:

```javascript
db.products.countDocuments({})
// → 5
```

The empty filter `{}` means "all documents". Now let's ask more useful questions:

```javascript
// How many stationery products?
db.products.countDocuments({ category: "stationery" })
// → 2

// How many are out of stock?
db.products.countDocuments({ stock: 0 })
// → 1

// How many cost 200 or more?
db.products.countDocuments({ price: { $gte: 200 } })
// → 3

// How many are tagged "school"?
db.products.countDocuments({ tags: "school" })
// → 2
```

Every query operator you learned works here, including `$in`, `$or` and dates:

```javascript
// Customers who are members
db.customers.countDocuments({ isMember: true })
// → 3

// Customers who joined in 2026
db.customers.countDocuments({
  joinedAt: { $gte: ISODate("2026-01-01"), $lt: ISODate("2027-01-01") }
})
// → 3
```

> **Think of it like this:** `find()` is asking the librarian to bring you every book about cooking. `countDocuments()` is asking "how many cooking books do you have?" You get a number, not a heavy pile.

### Why not `find().length`?

You may be tempted to fetch everything and count it in your code. Don't. If a collection has a million matching documents, you would pull a million documents over the network just to read one number. `countDocuments()` does the counting on the server and sends back only the result.

### Counting with a cap

`countDocuments()` accepts an options object as its second argument. The `limit` option stops counting once it reaches that number. This is useful when you only need to know "is there **at least one**?" or "are there more than 100?":

```javascript
// Is there at least one out-of-stock product?
db.products.countDocuments({ stock: 0 }, { limit: 1 })
// → 1   (stops as soon as it finds one)
```

There is also a `skip` option, but you'll rarely need it.

## A fast total: `estimatedDocumentCount()`

When you want the total number of documents in a whole collection and don't need a filter, use `estimatedDocumentCount()`:

```javascript
db.products.estimatedDocumentCount()
// → 5
```

Instead of looking at the documents, it reads the collection's **metadata** (information MongoDB keeps about the collection). That makes it very fast, even on huge collections.

The catch is in the name: it's an **estimate**. In rare cases, such as right after a server crash or in a sharded cluster, it can be slightly off. It also **cannot take a filter**.

| Method | Takes a filter? | Speed | Exact? |
| --- | --- | --- | --- |
| `countDocuments(filter)` | Yes | Depends on the filter and indexes | Yes |
| `estimatedDocumentCount()` | No | Very fast | Almost always, but not guaranteed |

> **Tip:** Use `estimatedDocumentCount()` for things like "about 12,400 products" on an admin dashboard. Use `countDocuments()` when the number must be exact or needs a filter.

## Old methods to avoid: `count()`

You'll find older tutorials using `count()`:

```javascript
// Old style, don't use these
db.products.count({ category: "stationery" })
db.products.find({ category: "stationery" }).count()
```

Both are **deprecated**. In mongosh they still run but print a deprecation warning, and they can give wrong numbers in some situations (for example, in sharded clusters). Use `countDocuments()` or `estimatedDocumentCount()` instead.

## Listing unique values with `distinct()`

`distinct()` answers a different question: "What are the **different** values in this field?" It returns an array with each value listed once.

Let's see which categories we sell:

```javascript
db.products.distinct("category")
// → [ "electronics", "kitchen", "stationery" ]
```

Five products, but only three unique categories. And which cities our customers come from:

```javascript
db.customers.distinct("city")
// → [ "Kolkata", "Madrid", "Mumbai", "Tokyo" ]
```

Kolkata appears twice in the data but only once in the answer.

> **Note:** The field name is a **string** in quotes: `distinct("city")`, not `distinct(city)` or `distinct({ city: 1 })`. Don't rely on the order of the returned values. If you need them sorted, sort the array in your code.

### `distinct()` with a filter

The second argument is a normal filter. Only matching documents are looked at:

```javascript
// Categories that have at least one product over 200
db.products.distinct("category", { price: { $gt: 200 } })
// → [ "electronics", "kitchen" ]

// Cities of our members only
db.customers.distinct("city", { isMember: true })
// → [ "Kolkata", "Madrid" ]
```

### `distinct()` on an array field

When the field is an array, `distinct()` looks **inside** the arrays and treats each element as its own value:

```javascript
db.products.distinct("tags")
// → [ "audio", "cable", "ceramic", "gift", "paper", "pen", "school", "wireless" ]
```

"school" appears in two products but only once here. This makes `distinct()` perfect for building a "filter by tag" menu.

### Counting the unique values

`distinct()` returns a plain array, so you can use `.length` to count the unique values:

```javascript
db.products.distinct("tags").length
// → 8
```

### Missing fields are skipped

Documents that don't have the field are simply ignored:

```javascript
db.products.distinct("rating")
// → [ 4.5, 4.8 ]
```

Only two products have a rating, so only two values come back.

> **Warning:** `distinct()` returns all the unique values in **one** response, which has a 16 MB size limit. For a field with millions of unique values (like email addresses), use the aggregation pipeline instead. For categories, cities, tags and statuses, `distinct()` is perfect.

## A first peek: counting per group

What if you want the count **for each** category at once, like "electronics: 2, kitchen: 1, stationery: 2"? You could run `countDocuments()` three times, but there is a better tool: the **aggregation pipeline**. Here is a sneak preview:

```javascript
db.products.aggregate([
  { $group: { _id: "$category", count: { $sum: 1 } } }
])
// → [
//     { _id: "electronics", count: 2 },
//     { _id: "kitchen", count: 1 },
//     { _id: "stationery", count: 2 }
//   ]
```

Read it as: "group products by their category, and add 1 for each product in the group". Don't worry about the details. You'll learn this properly in the Intermediate section, starting with [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals).

## In application code

The Node.js driver uses the same method names. You'll set this up in the *Connecting MongoDB to Your First App* lesson:

```javascript
// Node.js driver
const products = db.collection("products");

const outOfStock = await products.countDocuments({ stock: 0 });
const total = await products.estimatedDocumentCount();
const categories = await products.distinct("category");

console.log(outOfStock, total, categories);
// → 1 5 [ 'electronics', 'kitchen', 'stationery' ]
```

## Common mistakes

- **Using `count()`.** It's deprecated. Use `countDocuments()` (with a filter) or `estimatedDocumentCount()` (whole collection).
- **Passing a filter to `estimatedDocumentCount()`.** It doesn't accept one. Use `countDocuments(filter)`.
- **Fetching everything to count it.** `find().toArray().length` in an app moves every document over the network. Let the server count.
- **Forgetting the quotes in `distinct()`.** The first argument is the field name as a string: `distinct("category")`.
- **Expecting `distinct()` to return whole documents.** It returns only the values. Use `find()` with a filter when you need the documents.

## Practice

1. Count the products that cost less than 100.
2. Count customers who live in Kolkata **and** are members.
3. List the unique tags of stationery products only.
4. How many different cities do our customers live in?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. countDocuments with a comparison operator
db.products.countDocuments({ price: { $lt: 100 } })
// → 2

// 2. Two conditions joined by an implicit AND
db.customers.countDocuments({ city: "Kolkata", isMember: true })
// → 2

// 3. distinct with a filter on an array field
db.products.distinct("tags", { category: "stationery" })
// → [ "paper", "pen", "school" ]

// 4. distinct returns an array, so use .length
db.customers.distinct("city").length
// → 4
```

</details>

## Key takeaways

- `countDocuments(filter)` returns an exact count of matching documents.
- `estimatedDocumentCount()` gives a very fast total for the whole collection, but takes no filter.
- `count()` is deprecated; don't use it in new code.
- `distinct("field", filter)` returns each unique value once, and looks inside arrays.
- To count per group, use the aggregation pipeline's `$group` stage, which you'll learn later.

**Next lesson:** [Updating Documents](/courses/mongodb/updating-documents)
