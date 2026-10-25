---
title: Updating Documents
slug: updating-documents
metadescription: Learn how to change existing MongoDB documents with updateOne, updateMany, replaceOne and findOneAndUpdate, and how to read the update result.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'crud', 'update', 'set']
course: mongodb
---
## What you will learn

By the end of this lesson you will know how to:

- Change one document with `updateOne()` and the `$set` operator
- Change many documents at once with `updateMany()`
- Read the result: `matchedCount` and `modifiedCount`
- Swap a whole document with `replaceOne()`
- Update a document and get it back in one step with `findOneAndUpdate()`

Data rarely stays the same. Prices go up, stock goes down, a customer changes their email. **Updating** is how you change documents that are already saved.

## Get the sample data ready

This lesson changes data, so start from a clean copy. Run this in mongosh (you can run it again any time to reset):

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

## The shape of an update

Every update needs two things:

1. A **filter**: which document(s) to change. This is the same kind of filter you use with `find()`.
2. An **update**: what to change. This uses **update operators**, which start with `$`.

```javascript
db.collection.updateOne(filter, update)
```

> **Think of it like this:** An update is like a note to an office assistant: "Find the file for Notebook (the filter) and change the price to 59 (the update)." You don't rewrite the whole file. You just correct one line.

## Your first update with `$set`

`$set` is the most common update operator. It sets a field to a new value.

Let's raise the price of the Notebook from 49 to 59:

```javascript
db.products.updateOne(
  { name: "Notebook" },          // filter: which document
  { $set: { price: 59 } }        // update: what to change
)
```

mongosh replies with a result:

```javascript
{
  acknowledged: true,
  insertedId: null,
  matchedCount: 1,
  modifiedCount: 1,
  upsertedCount: 0
}
```

Let's check:

```javascript
db.products.findOne({ name: "Notebook" })
// → { _id: ObjectId("..."), name: "Notebook", category: "stationery", price: 59, stock: 120, tags: [ "paper", "school" ] }
```

Only `price` changed. Every other field is exactly as it was.

## Reading the result

The result tells you what happened. The two numbers that matter most are:

| Field | Meaning |
| --- | --- |
| `matchedCount` | How many documents matched your filter |
| `modifiedCount` | How many documents were actually changed |
| `acknowledged` | `true` means the server received and confirmed the write |
| `upsertedCount`, `insertedId` | Used by *upserts*, covered in the next lesson |

Why would `matchedCount` and `modifiedCount` be different? Run the same update again:

```javascript
db.products.updateOne({ name: "Notebook" }, { $set: { price: 59 } })
// → { acknowledged: true, insertedId: null, matchedCount: 1, modifiedCount: 0, upsertedCount: 0 }
```

The Notebook matched, but its price was **already** 59, so nothing needed to change. MongoDB is smart enough to skip it.

And if nothing matches the filter at all:

```javascript
db.products.updateOne({ name: "Stapler" }, { $set: { price: 99 } })
// → { acknowledged: true, insertedId: null, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 }
```

No error, just zero. This is a quiet failure, so in apps you should check `matchedCount` when you expect a match.

> **Tip:** `matchedCount: 0` usually means a typo in the filter: a wrong name, wrong capital letter, or a number stored as text.

## Changing several fields at once

Put more fields inside `$set`. They all change together:

```javascript
db.products.updateOne(
  { name: "USB Cable" },
  { $set: { stock: 80, price: 279 } }
)
// → matchedCount: 1, modifiedCount: 1
```

### `$set` can also add new fields

If the field doesn't exist yet, `$set` creates it. The Gel Pen has no `rating`, so let's give it one:

```javascript
db.products.updateOne({ name: "Gel Pen" }, { $set: { rating: 4.1 } })

db.products.findOne({ name: "Gel Pen" }, { name: 1, rating: 1, _id: 0 })
// → { name: "Gel Pen", rating: 4.1 }
```

This is the flexible schema at work. No table change is needed.

## Updating by `_id`

`updateOne()` changes **only the first** document that matches. If several products had the name "Notebook", you can't be sure which one gets updated.

The safest way to target exactly one document is by its `_id`, which is always unique:

```javascript
const mug = db.products.findOne({ name: "Coffee Mug" })

db.products.updateOne({ _id: mug._id }, { $set: { stock: 55 } })
// → matchedCount: 1, modifiedCount: 1
```

In real apps you usually have the `_id` already, for example from a URL like `/products/6718a2f1...`.

> **Note:** From MongoDB 8.0, `updateOne()` also accepts a `sort` option, so you can choose *which* match gets updated, for example `{ sort: { price: 1 } }` to update the cheapest match.

## Updating many documents with `updateMany()`

`updateMany()` has the same shape, but changes **every** document that matches.

Let's put all stationery on sale:

```javascript
db.products.updateMany(
  { category: "stationery" },
  { $set: { onSale: true } }
)
// → { acknowledged: true, insertedId: null, matchedCount: 2, modifiedCount: 2, upsertedCount: 0 }
```

Both the Notebook and the Gel Pen now have `onSale: true`.

An empty filter `{}` matches every document in the collection:

```javascript
// Add a "lastChecked" date to every product
db.products.updateMany({}, { $set: { lastChecked: new Date() } })
// → matchedCount: 5, modifiedCount: 5
```

> **Warning:** Before running `updateMany()`, run the same filter with `find()` or `countDocuments()` first. It's a cheap way to make sure you're about to change the documents you think you are.

```javascript
db.products.countDocuments({ category: "stationery" })   // check first
// → 2
```

## Replacing a whole document with `replaceOne()`

Sometimes you want to throw away the old content and put in something new. `replaceOne()` does that. The second argument is a **plain document**, with no `$` operators:

```javascript
db.products.replaceOne(
  { name: "USB Cable" },
  { name: "USB-C Cable", category: "electronics", price: 349, stock: 40 }
)
// → matchedCount: 1, modifiedCount: 1
```

Now look at it:

```javascript
db.products.findOne({ name: "USB-C Cable" })
// → { _id: ObjectId("..."), name: "USB-C Cable", category: "electronics", price: 349, stock: 40 }
```

Notice two things:

- The `_id` stayed the same. MongoDB keeps it when replacing.
- The `tags` field is **gone**. Anything you don't include in the replacement is removed.

| | `updateOne()` with `$set` | `replaceOne()` |
| --- | --- | --- |
| Second argument | Update operators like `{ $set: {...} }` | A plain document |
| Fields you don't mention | Kept as they were | Removed |
| `_id` | Kept | Kept |
| Typical use | Change a few fields | Save a full edited form |

> **Tip:** If you're unsure, use `updateOne()` with `$set`. It's much harder to lose data by accident.

## Update and read in one step: `findOneAndUpdate()`

Sometimes you want to change a document **and** see it straight away. `findOneAndUpdate()` does both in one atomic step, which means no other write can sneak in between the change and the read.

By default it returns the document **before** the change:

```javascript
db.products.findOneAndUpdate(
  { name: "Headphones" },
  { $set: { stock: 30 } }
)
// → { _id: ObjectId("..."), name: "Headphones", ..., stock: 35, ... }   (old value)
```

Add `returnDocument: "after"` to get the **updated** version instead:

```javascript
db.products.findOneAndUpdate(
  { name: "Headphones" },
  { $set: { stock: 25 } },
  { returnDocument: "after", projection: { name: 1, stock: 1, _id: 0 } }
)
// → { name: "Headphones", stock: 25 }
```

You can also pass `projection` (as above) and `sort` in the same options object. If nothing matches, it returns `null`.

## You can't change `_id`

The `_id` field is permanent. Trying to change it gives an error:

```javascript
db.products.updateOne({ name: "Gel Pen" }, { $set: { _id: 123 } })
// → MongoServerError: Performing an update on the path '_id' would modify the immutable field '_id'
```

If you truly need a different `_id`, insert a new document and delete the old one.

## Updates are safe for a single document

When an update changes several fields in one document, MongoDB applies them **all together or not at all**. Another user will never see a half-updated product with the new price but the old stock. This is called being **atomic** at the document level. Updates that span many documents need *transactions*, which you'll meet in the Advanced section.

## SQL comparison

```sql
UPDATE products SET price = 59 WHERE name = 'Notebook';
UPDATE products SET on_sale = TRUE WHERE category = 'stationery';
```

```javascript
db.products.updateOne({ name: "Notebook" }, { $set: { price: 59 } })
db.products.updateMany({ category: "stationery" }, { $set: { onSale: true } })
```

## In application code

The Node.js driver uses the same method names and returns the same result fields. You'll set it up in the *Connecting MongoDB to Your First App* lesson:

```javascript
// Node.js driver
const result = await db.collection("products").updateOne(
  { name: "Notebook" },
  { $set: { price: 59 } }
);

if (result.matchedCount === 0) {
  console.log("No product called Notebook!");
}
```

## Common mistakes

- **Forgetting `$set`.** `updateOne({ name: "Notebook" }, { price: 59 })` fails with `MongoInvalidArgumentError: Update document requires atomic operators`. Wrap the change: `{ $set: { price: 59 } }`.
- **Using `$set` with `replaceOne()`.** The replacement must be a plain document. Operators there cause a "must not contain atomic operators" error.
- **Expecting `updateOne()` to change all matches.** It changes only the first. Use `updateMany()` for all of them.
- **Not checking `matchedCount`.** A typo in the filter updates nothing and raises no error.
- **Using the old `update()` method.** It's deprecated. Use `updateOne()`, `updateMany()` or `replaceOne()`.

## Practice

Reset the data first using the setup block at the top.

1. Set the price of the Gel Pen to 20.
2. Mark every electronics product with `featured: true`.
3. Replace the Coffee Mug with `{ name: "Coffee Mug", category: "kitchen", price: 299, stock: 50 }`. Which fields disappeared?
4. Set the stock of the Notebook to 100 and get the **updated** document back.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. One document, one field
db.products.updateOne({ name: "Gel Pen" }, { $set: { price: 20 } })
// → matchedCount: 1, modifiedCount: 1

// 2. Many documents
db.products.updateMany({ category: "electronics" }, { $set: { featured: true } })
// → matchedCount: 2, modifiedCount: 2

// 3. Replace: tags and rating are removed, _id is kept
db.products.replaceOne(
  { name: "Coffee Mug" },
  { name: "Coffee Mug", category: "kitchen", price: 299, stock: 50 }
)

// 4. Update and return the new version
db.products.findOneAndUpdate(
  { name: "Notebook" },
  { $set: { stock: 100 } },
  { returnDocument: "after" }
)
// → { _id: ObjectId("..."), name: "Notebook", ..., stock: 100, ... }
```

</details>

## Key takeaways

- `updateOne(filter, update)` changes the first match; `updateMany()` changes every match.
- Updates use operators. `$set` changes a field's value, or adds the field if it's missing.
- `matchedCount` tells you how many documents matched; `modifiedCount` tells you how many really changed.
- `replaceOne()` swaps the whole document (except `_id`). Fields you leave out are deleted.
- `findOneAndUpdate()` changes one document and returns it. Use `returnDocument: "after"` to see the new version.

**Next lesson:** [Update Operators and Upserts](/courses/mongodb/update-operators-and-upserts)
