---
title: Querying with find and Filters
slug: querying-with-find
metadescription: Learn to read data in MongoDB with find and findOne. Write filters for exact matches, several conditions, arrays and nested fields, and work with cursors.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'crud', 'queries', 'find']
course: mongodb
---
## What you will learn

By the end of this lesson you will be able to:

- Read documents with `find()` and `findOne()`
- Write **filters** that match exact values
- Combine several conditions in one filter
- Match values inside **arrays** and **embedded documents**
- Understand **cursors**, and get results as an array
- Avoid the classic mistakes: wrong types, wrong case and `null`

## Reading is the most common job

Most apps read data far more often than they write it. Every time you open a product page, search a shop or scroll a feed, a database is answering a **query**: a question about the data.

In MongoDB, the main tool for asking questions is `find()`.

> **Think of it like this:** A collection is a big box of index cards. `find()` is you flipping through the box. The **filter** is your instruction: "only pull out cards where the category says *stationery*".

## Get the same data as this lesson

So that your results match the examples, reset the `products` collection to the five course products:

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

> **Warning:** `deleteMany({})` removes every product, including any you added yourself. That's fine for practice data.

## find(): get every document

With no filter, `find()` returns everything in the collection:

```javascript
db.products.find()
```

```javascript
[
  { _id: ObjectId("..."), name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"] },
  { _id: ObjectId("..."), name: "Gel Pen", category: "stationery", price: 15, stock: 500, tags: ["pen", "school"] },
  { _id: ObjectId("..."), name: "Headphones", category: "electronics", price: 1999, stock: 35, tags: ["audio", "wireless"], rating: 4.5 },
  { _id: ObjectId("..."), name: "USB Cable", category: "electronics", price: 299, stock: 0, tags: ["cable"] },
  { _id: ObjectId("..."), name: "Coffee Mug", category: "kitchen", price: 249, stock: 60, tags: ["ceramic", "gift"], rating: 4.8 }
]
```

`find()` and `find({})` mean exactly the same: an **empty filter** matches every document.

## Filters: match exact values

A **filter** is a document that describes what you're looking for. The simplest filter is `{ field: value }`, which means "where *field* equals *value*".

All stationery:

```javascript
db.products.find({ category: "stationery" })
// → Notebook, Gel Pen
```

The product called "USB Cable":

```javascript
db.products.find({ name: "USB Cable" })
// → [ { _id: ObjectId("..."), name: "USB Cable", category: "electronics", price: 299, stock: 0, tags: ["cable"] } ]
```

Products with exactly 0 in stock:

```javascript
db.products.find({ stock: 0 })
// → USB Cable
```

If nothing matches, you get an empty result, not an error:

```javascript
db.products.find({ category: "toys" })
// → (nothing is printed)
```

### In SQL terms

If you know SQL, a filter is the `WHERE` part:

```sql
SELECT * FROM products WHERE category = 'stationery';
```

```javascript
db.products.find({ category: "stationery" })
```

## findOne(): get just one document

`findOne()` returns the **first** matching document, as a plain document (not a list). If nothing matches, it returns `null`.

```javascript
db.products.findOne({ category: "electronics" })
// → { _id: ObjectId("..."), name: "Headphones", category: "electronics", price: 1999, ... }

db.products.findOne({ category: "toys" })
// → null
```

Use `findOne()` when you expect one result, like looking up a customer by email or a product by `_id`:

```javascript
db.customers.findOne({ email: "asha@example.com" })
```

> **Note:** "First" here means the first one MongoDB happens to find, usually in insertion order. If you need a specific one (like the cheapest), you'll add sorting in [Sorting, Limiting and Skipping](/courses/mongodb/sort-limit-skip).

## Several conditions at once (AND)

Put more than one field in the filter, and a document must match **all** of them:

```javascript
db.products.find({ category: "electronics", stock: 0 })
// → USB Cable    (electronics AND out of stock)
```

```javascript
db.products.find({ category: "stationery", price: 15 })
// → Gel Pen
```

Separating fields with commas means **AND**. In SQL this would be `WHERE category = 'electronics' AND stock = 0`.

> **Think of it like this:** Each extra field is one more box the document has to tick on a checklist. Only documents that tick *every* box come back.

What about **OR** ("electronics *or* kitchen")? That needs a query operator such as `$or` or `$in`, which you'll learn in the very next lesson, [Comparison and Logical Query Operators](/courses/mongodb/query-operators). Here's a sneak peek:

```javascript
db.products.find({ category: { $in: ["electronics", "kitchen"] } })
// → Headphones, USB Cable, Coffee Mug
```

## A first look at comparisons

Exact matches only get you so far. "Price less than 100" needs a **comparison operator**. Operators start with a `$` and go inside an inner document:

```javascript
db.products.find({ price: { $lt: 100 } })   // $lt = "less than"
// → Notebook (49), Gel Pen (15)

db.products.find({ stock: { $gt: 100 } })   // $gt = "greater than"
// → Notebook (120), Gel Pen (500)
```

You'll learn all of them (`$gt`, `$gte`, `$lt`, `$lte`, `$ne`, `$in` and more) in the next lesson. For now, just recognise the shape: `{ field: { $operator: value } }`.

## Matching values inside arrays

Arrays get special treatment. If a field holds an array, a simple filter matches when the array **contains** that value:

```javascript
db.products.find({ tags: "school" })
// → Notebook (tags: ["paper", "school"]), Gel Pen (tags: ["pen", "school"])
```

You didn't have to say "somewhere in the array". MongoDB checks every element for you.

```javascript
db.products.find({ tags: "gift" })
// → Coffee Mug
```

If you give a whole array, MongoDB looks for that **exact array**, same values in the same order:

```javascript
db.products.find({ tags: ["paper", "school"] })   // → Notebook
db.products.find({ tags: ["school", "paper"] })   // → nothing (order differs)
```

> **Tip:** To find documents whose array contains *several* values in any order, use `$all`, for example `{ tags: { $all: ["school", "paper"] } }`. Arrays get a full lesson in [Working with Arrays](/courses/mongodb/working-with-arrays).

## Matching fields inside embedded documents

Let's add a customer with an embedded `address` document:

```javascript
db.customers.insertOne({
  name: "Ken Tanaka",
  email: "ken.t@example.com",
  address: { city: "Tokyo", country: "Japan" },
  isMember: false,
  joinedAt: new Date("2026-06-20")
})
```

To filter on a field *inside* `address`, use **dot notation** and **put the path in quotes**:

```javascript
db.customers.find({ "address.city": "Tokyo" })
// → Ken Tanaka
```

> **Warning:** The quotes are required. `{ address.city: "Tokyo" }` without quotes is a JavaScript syntax error.

There's much more to embedded documents in [Embedded Documents and Dot Notation](/courses/mongodb/embedded-documents).

## Choosing which fields come back (a preview)

`find()` takes an optional **second argument**, called a **projection**, which picks the fields to return. `1` means "include".

```javascript
db.products.find({ category: "stationery" }, { name: 1, price: 1 })
// → [ { _id: ObjectId("..."), name: "Notebook", price: 49 },
//     { _id: ObjectId("..."), name: "Gel Pen", price: 15 } ]
```

The `_id` comes back unless you switch it off with `_id: 0`:

```javascript
db.products.find({ category: "stationery" }, { name: 1, price: 1, _id: 0 })
// → [ { name: "Notebook", price: 49 }, { name: "Gel Pen", price: 15 } ]
```

Projections get their own lesson: [Projections and Field Selection](/courses/mongodb/projections).

## Cursors: how results come back

`find()` doesn't hand you all the documents at once. It returns a **cursor**, an object that fetches results from the server in **batches** as you need them.

> **Think of it like this:** A cursor is a bookmark in a long list. You read a page, and when you're ready, it fetches the next page. Nobody has to carry the whole book at once.

In mongosh this is mostly invisible:

- mongosh prints the first **20** documents.
- If there are more, it says `Type "it" for more`. Type `it` to get the next batch.

### Useful cursor methods

Turn the results into a normal JavaScript array:

```javascript
const stationery = db.products.find({ category: "stationery" }).toArray()
stationery.length
// → 2
stationery[0].name
// → Notebook
```

Run some code for each document:

```javascript
db.products.find({ rating: 4.5 }).forEach(p => print(p.name + " is rated " + p.rating))
// → Headphones is rated 4.5
```

Limit the number of results:

```javascript
db.products.find().limit(2)
// → only the first 2 products
```

Count matching documents. Use the collection method `countDocuments()` with the same filter:

```javascript
db.products.countDocuments({ category: "electronics" })
// → 2
```

> **Note:** You'll see old tutorials use `.count()`. It's deprecated. Use `countDocuments()`, covered in [Counting Documents and Distinct Values](/courses/mongodb/counting-and-distinct).

## Type and case matter

MongoDB compares values **exactly**. Two common surprises:

### Case-sensitive text

```javascript
db.products.find({ category: "Stationery" })
// → nothing (the stored value is "stationery", lowercase)
```

`"Stationery"` and `"stationery"` are different strings. Store values in a consistent case (lowercase is common for categories and tags).

### Different types never match

```javascript
db.products.find({ price: "49" })
// → nothing (the price is stored as the number 49, not the text "49")

db.products.find({ price: 49 })
// → Notebook
```

The same rule explains the `_id` trap from [ObjectId and the _id Field](/courses/mongodb/objectid-and-id-field):

```javascript
db.products.find({ _id: "6718e1a2b3c4d5e6f7a8b9c1" })           // → nothing (string)
db.products.find({ _id: ObjectId("6718e1a2b3c4d5e6f7a8b9c1") })  // → the product (ObjectId)
```

> **Note:** All *number* types match each other by value, so `{ price: 49 }` finds the Notebook whether 49 is stored as an Int32, a Long or a Double.

## Matching null and missing fields

Only the Headphones and the Coffee Mug have a `rating`. What does a search for `null` return?

```javascript
db.products.find({ rating: null }, { name: 1, _id: 0 })
// → [ { name: "Notebook" }, { name: "Gel Pen" }, { name: "USB Cable" } ]
```

`{ field: null }` matches documents where the field is `null` **or where it doesn't exist at all**. Here, none of the three have a `rating` field.

To ask "does this field exist?", use `$exists`:

```javascript
db.products.find({ rating: { $exists: true } }, { name: 1, _id: 0 })
// → [ { name: "Headphones" }, { name: "Coffee Mug" } ]
```

## find() in a Node.js app

In the Node.js driver, `find()` also returns a cursor. Call `.toArray()` (with `await`) to get the documents:

```javascript
import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017");

async function main() {
  const products = client.db("shop").collection("products");

  // Many documents
  const school = await products.find({ tags: "school" }).toArray();
  console.log(school.map(p => p.name));
  // → [ 'Notebook', 'Gel Pen' ]

  // One document
  const mug = await products.findOne({ name: "Coffee Mug" });
  console.log(mug.price);
  // → 249

  await client.close();
}

main();
```

The filters are exactly the same as in mongosh. That's the nice part: what you test in the shell, you paste into your app.

## Common mistakes

- **Forgetting quotes around dot notation.** Write `{ "address.city": "Tokyo" }`, not `{ address.city: "Tokyo" }`.
- **Searching with the wrong type.** `"49"` won't match `49`, and a string won't match an ObjectId. Check how the value is stored.
- **Getting the case wrong.** `"Stationery"` won't match `"stationery"`. Keep stored values in a consistent case.
- **Expecting `findOne()` to return a list.** It returns one document or `null`. Use `find()` for many.
- **Thinking `{ rating: null }` only finds `null` values.** It also matches documents that have no `rating` field. Use `$exists` to tell them apart.

## Practice

1. Find all products in the `kitchen` category.
2. Using only exact matches, find the electronics product that has exactly `35` in stock.
3. Find all products tagged `"wireless"`, showing only their `name` and `price` (no `_id`).
4. Find the customer whose email is `"asha@example.com"` using `findOne()`. What does `findOne()` return for an email that doesn't exist?
5. Count how many products have **no** `rating` field.

<details>
<summary>Show a possible answer</summary>

```javascript
use shop

// 1.
db.products.find({ category: "kitchen" })
// → Coffee Mug

// 2.
db.products.find({ category: "electronics", stock: 35 })
// → Headphones

// 3.
db.products.find({ tags: "wireless" }, { name: 1, price: 1, _id: 0 })
// → [ { name: "Headphones", price: 1999 } ]

// 4.
db.customers.findOne({ email: "asha@example.com" })
// → { _id: ObjectId("..."), name: "Asha Roy", email: "asha@example.com", ... }
db.customers.findOne({ email: "nobody@example.com" })
// → null

// 5.
db.products.countDocuments({ rating: { $exists: false } })
// → 3
```

</details>

## Key takeaways

- `find(filter)` returns **all** matching documents (as a cursor). `findOne(filter)` returns the **first** match or `null`.
- A filter like `{ field: value }` matches exact values. Several fields in one filter mean **AND**.
- A simple filter on an array field matches if the array **contains** the value. Use quoted **dot notation** for nested fields.
- Matching is exact: **type** and **case** both matter. `{ field: null }` also matches missing fields.
- Use `.toArray()`, `.forEach()`, `.limit()` and `countDocuments()` to work with results. Operators like `$lt` and `$in` come next.

**Next lesson:** [Comparison and Logical Query Operators](/courses/mongodb/query-operators)
