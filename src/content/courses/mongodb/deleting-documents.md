---
title: Deleting Documents
slug: deleting-documents
metadescription: Learn how to safely remove MongoDB documents with deleteOne, deleteMany and findOneAndDelete, when to drop a collection, and how soft deletes work.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'crud', 'delete']
course: mongodb
---
## What you will learn

By the end of this lesson you will know how to:

- Remove one document with `deleteOne()`
- Remove many documents with `deleteMany()`
- Remove a document and get it back with `findOneAndDelete()`
- Tell the difference between emptying a collection and dropping it
- Use a "soft delete" so mistakes can be undone

Deleting is the last of the four basic operations, often called **CRUD**: **C**reate, **R**ead, **U**pdate, **D**elete. It's also the most dangerous one, because MongoDB has no "undo" button. This lesson shows you how to delete *and* how to delete carefully.

## Get the sample data ready

You're going to delete things, so start from a fresh copy. Run this block again whenever you want your data back:

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

Notice that this setup block already uses `deleteMany({})` to clear the collection. You'll understand exactly what it does by the end of the lesson.

## The golden rule: find first, delete second

Delete methods take the **same filter** as `find()`. That gives you a simple safety habit:

1. Run your filter with `find()` (or `countDocuments()`).
2. Look at what comes back. Is it really what you want to remove?
3. Only then swap `find` for `deleteOne` or `deleteMany`.

```javascript
// Step 1: preview
db.products.find({ stock: 0 })
// → [ { name: "USB Cable", ... } ]   Yes, that's the one.

// Step 2: delete with the exact same filter
db.products.deleteOne({ stock: 0 })
```

> **Think of it like this:** Before you throw papers in the shredder, you look at them one more time. `find()` is that last look. It costs nothing and can save your day.

## Deleting one document with `deleteOne()`

`deleteOne()` removes the **first** document that matches the filter. Let's reset the data, then delete the USB Cable:

```javascript
db.products.deleteOne({ name: "USB Cable" })
```

mongosh replies:

```javascript
{ acknowledged: true, deletedCount: 1 }
```

`deletedCount` tells you how many documents were removed. Let's confirm it's gone:

```javascript
db.products.findOne({ name: "USB Cable" })
// → null
```

If nothing matches, nothing is deleted and there's no error:

```javascript
db.products.deleteOne({ name: "Stapler" })
// → { acknowledged: true, deletedCount: 0 }
```

### Delete by `_id` when you mean "this exact one"

Because `deleteOne()` removes the *first* match, a loose filter like `{ category: "stationery" }` could remove the Notebook or the Gel Pen. You can't be sure which.

When you mean one specific document, use its `_id`, which is always unique:

```javascript
const pen = db.products.findOne({ name: "Gel Pen" })

db.products.deleteOne({ _id: pen._id })
// → { acknowledged: true, deletedCount: 1 }
```

In apps, this is the normal way to delete: a "Delete" button next to a product sends that product's `_id` to the server.

## Deleting many documents with `deleteMany()`

`deleteMany()` removes **every** document that matches. Reset the data first, then let's remove all stationery:

```javascript
db.products.countDocuments({ category: "stationery" })   // preview: how many?
// → 2

db.products.deleteMany({ category: "stationery" })
// → { acknowledged: true, deletedCount: 2 }
```

Any filter works, including operators:

```javascript
// Remove everything priced under 300
db.products.deleteMany({ price: { $lt: 300 } })

// Remove products that have no rating
db.products.deleteMany({ rating: { $exists: false } })
```

### Deleting everything in a collection

An empty filter `{}` matches **all** documents, so this removes every product:

```javascript
db.products.deleteMany({})
// → { acknowledged: true, deletedCount: 5 }
```

The collection still exists, it's just empty. Any indexes you created on it are kept too. That's why our setup block uses it to start fresh.

> **Warning:** `deleteMany({})` deletes every document instantly. There is no "Are you sure?" prompt and no recycle bin. Double-check which database you're in (type `db` in mongosh) before running it.

## Delete and return with `findOneAndDelete()`

Sometimes you want to remove a document **and** see what you removed, for example to show "Deleted Headphones" in your app, or to move it into an archive.

`findOneAndDelete()` deletes one document and returns it:

```javascript
db.products.findOneAndDelete({ name: "Headphones" })
// → { _id: ObjectId("..."), name: "Headphones", category: "electronics", price: 1999, stock: 35, tags: [ "audio", "wireless" ], rating: 4.5 }
```

It also accepts a `sort` option, so you can choose *which* match gets deleted. Let's reset the data and remove the cheapest electronics product:

```javascript
db.products.findOneAndDelete(
  { category: "electronics" },
  { sort: { price: 1 } }
)
// → { _id: ObjectId("..."), name: "USB Cable", ..., price: 299, ... }
```

If nothing matches, it returns `null`.

This is handy for simple job queues: "take the oldest waiting job and remove it from the queue", all in one safe step.

## Emptying vs dropping a collection

There are two ways to get rid of all products. They look similar but are different.

```javascript
// 1. Empty it: removes documents, keeps the collection and its indexes
db.products.deleteMany({})

// 2. Drop it: removes the collection itself, with all documents and indexes
db.products.drop()
// → true
```

| | `deleteMany({})` | `drop()` |
| --- | --- | --- |
| Removes documents | Yes | Yes |
| Keeps the collection | Yes | No |
| Keeps indexes and validation rules | Yes | No |
| Speed on a huge collection | Slower (deletes one by one) | Very fast |

Use `drop()` when you're done with a collection for good, or when you want to rebuild it from scratch. Use `deleteMany({})` when you want an empty collection that's ready to use.

There's an even bigger hammer. This deletes the **whole current database**, all collections included:

```javascript
db.dropDatabase()
// → { ok: 1, dropped: "shop" }
```

You will rarely need it outside of practice. Use it with great care.

## Soft deletes: deleting without losing data

Many real apps never truly delete important records like orders or users. Instead they mark them as deleted. This is called a **soft delete**.

```javascript
// "Delete" the Coffee Mug by marking it
db.products.updateOne(
  { name: "Coffee Mug" },
  { $set: { deletedAt: new Date() } }
)
```

Then your normal queries skip marked documents:

```javascript
// Only show products that are not deleted
db.products.find({ deletedAt: { $exists: false } })
```

And if someone deleted it by mistake, you can bring it back:

```javascript
db.products.updateOne({ name: "Coffee Mug" }, { $unset: { deletedAt: "" } })
```

| | Hard delete (`deleteOne`) | Soft delete (`$set: { deletedAt }`) |
| --- | --- | --- |
| Can be undone | No (only from a backup) | Yes |
| Data stays in the database | No | Yes |
| Queries need an extra filter | No | Yes |
| Good for | Temporary data, carts, logs | Orders, users, anything important |

> **Tip:** Want old data to disappear automatically, like login sessions after 24 hours? MongoDB can do that with a **TTL index**, covered in [Partial, Sparse and TTL Indexes](/courses/mongodb/partial-sparse-ttl-indexes). And for real protection against mistakes, see [Backups, Snapshots and Point-in-Time Restore](/courses/mongodb/backups-and-restore).

## SQL comparison

```sql
DELETE FROM products WHERE name = 'USB Cable';
DELETE FROM products WHERE category = 'stationery';
DELETE FROM products;          -- empty the table
DROP TABLE products;           -- remove the table
```

```javascript
db.products.deleteOne({ name: "USB Cable" })
db.products.deleteMany({ category: "stationery" })
db.products.deleteMany({})
db.products.drop()
```

## In application code

In the Node.js driver the methods and result look the same. You'll set it up in the *Connecting MongoDB to Your First App* lesson:

```javascript
// Node.js driver
import { ObjectId } from "mongodb";

const result = await db.collection("products").deleteOne({
  _id: new ObjectId(productIdFromUrl)
});

if (result.deletedCount === 0) {
  console.log("Nothing to delete. Wrong id?");
}
```

## Common mistakes

- **Deleting without previewing.** Run the filter with `find()` or `countDocuments()` first, every time.
- **Using a loose filter with `deleteOne()`.** It removes the first match, which might not be the one you meant. Use `_id`.
- **Running `deleteMany({})` in the wrong database.** Type `db` in mongosh to check where you are.
- **Matching `_id` as a string.** `{ _id: "6718a2f1..." }` won't match an ObjectId. Use `ObjectId("6718a2f1...")` in mongosh or `new ObjectId(id)` in Node.js.
- **Using the old `remove()` method.** It's deprecated. Use `deleteOne()` or `deleteMany()`.

## Practice

Reset the data before each exercise using the setup block at the top.

1. Delete the product that has no stock. Preview it first.
2. Delete every product in the electronics category. How many were deleted?
3. Delete the **most expensive** product and print what was removed.
4. Soft delete the Notebook, then write a query that lists only products that aren't deleted.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Preview, then delete
db.products.find({ stock: 0 })
db.products.deleteOne({ stock: 0 })
// → { acknowledged: true, deletedCount: 1 }

// 2. deleteMany with a filter
db.products.deleteMany({ category: "electronics" })
// → { acknowledged: true, deletedCount: 2 }

// 3. findOneAndDelete with a sort, most expensive first
db.products.findOneAndDelete({}, { sort: { price: -1 } })
// → { ..., name: "Headphones", price: 1999, ... }

// 4. Soft delete, then filter it out
db.products.updateOne({ name: "Notebook" }, { $set: { deletedAt: new Date() } })
db.products.find({ deletedAt: { $exists: false } })
// → Gel Pen, Headphones, USB Cable, Coffee Mug
```

</details>

## Key takeaways

- `deleteOne(filter)` removes the first match; `deleteMany(filter)` removes all matches. Both report `deletedCount`.
- Always preview with `find()` first. There is no undo.
- Delete by `_id` when you mean one exact document.
- `findOneAndDelete()` removes a document and returns it, and can use `sort`.
- `deleteMany({})` empties a collection; `drop()` removes it completely. Soft deletes keep data recoverable.

**Next lesson:** [Working with Arrays](/courses/mongodb/working-with-arrays)
