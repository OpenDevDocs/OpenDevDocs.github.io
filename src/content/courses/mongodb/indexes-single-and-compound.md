---
title: Single Field and Compound Indexes
slug: indexes-single-and-compound
metadescription: Learn what MongoDB indexes are, how to create single field and compound indexes, the ESR rule, unique indexes and covered queries, in plain language.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'indexes', 'performance', 'queries']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What an **index** is and why it makes queries fast
- How to create, list and drop **single field** indexes
- How **compound** indexes work, and why field order matters
- The **ESR rule** for choosing field order
- What **unique** indexes and **covered queries** are

> **Before you start:** this lesson assumes you're comfortable with [Querying with find and Filters](/courses/mongodb/querying-with-find) and [Sorting, Limiting and Skipping](/courses/mongodb/sort-limit-skip).

## Why do we need indexes?

Imagine our `products` collection grows from 5 products to 5 million. You run:

```javascript
db.products.find({ name: "Coffee Mug" })
```

Without help, MongoDB has to look at **every single document** to check its `name`. This is called a **collection scan** (`COLLSCAN` in MongoDB's output). It works, but it gets slower and slower as the collection grows.

An **index** is a small, sorted list of one or more fields, where each entry points to the matching document. MongoDB can jump straight to the right entry instead of reading everything.

> **Think of it like this:** An index is exactly like the index at the back of a book. To find "photosynthesis" you don't read all 600 pages. You flip to the index, find the word in alphabetical order, and it says "page 214". A MongoDB index is a sorted list of values with "page numbers" pointing to documents.

Under the hood MongoDB stores indexes in a structure called a **B-tree**, which keeps values sorted so lookups, ranges and sorts are quick.

## The index you already have

Every collection gets an index on `_id` automatically. That's why finding a document by `_id` is always fast.

```javascript
use shop
db.products.getIndexes()
// → [ { v: 2, key: { _id: 1 }, name: '_id_' } ]
```

You can't drop the `_id` index.

## Single field indexes

A **single field index** sorts documents by one field. Let's index `price`:

```javascript
db.products.createIndex({ price: 1 })
// → price_1
```

The `1` means ascending order (smallest first). `-1` means descending. MongoDB returns the index's **name**, which is built from the field and direction: `price_1`.

Now this query can use the index:

```javascript
db.products.find({ price: { $lt: 300 } })
```

Let's check, using `explain` (you'll learn it fully in [explain and Query Plans](/courses/mongodb/explain-and-query-plans)):

```javascript
db.products.find({ price: { $lt: 300 } }).explain().queryPlanner.winningPlan
// → { stage: 'FETCH', inputStage: { stage: 'IXSCAN', keyPattern: { price: 1 }, indexName: 'price_1', ... } }
```

`IXSCAN` means "index scan". MongoDB used the index to find matching entries, then `FETCH` loaded the actual documents.

> **Tip:** For a single field index, the direction (`1` or `-1`) doesn't matter much. MongoDB can walk the index forwards or backwards, so `{ price: 1 }` supports both `sort({ price: 1 })` and `sort({ price: -1 })`.

### Indexing nested fields

You can index a field inside an embedded document with dot notation:

```javascript
db.customers.createIndex({ "address.city": 1 })
```

### Listing and dropping indexes

```javascript
// See all indexes
db.products.getIndexes()

// Drop by name
db.products.dropIndex("price_1")
// → { nIndexesWas: 2, ok: 1 }

// Or drop by key pattern
db.products.dropIndex({ price: 1 })
```

You can give an index your own name when creating it:

```javascript
db.products.createIndex({ price: 1 }, { name: "by_price" })
```

## Compound indexes

A **compound index** includes more than one field. It is sorted by the first field, then, inside each group, by the second field, and so on.

```javascript
db.products.createIndex({ category: 1, price: 1 })
// → category_1_price_1
```

Picture the index like this:

```text
category       price  → document
electronics    299    → USB Cable
electronics    1999   → Headphones
kitchen        249    → Coffee Mug
stationery     15     → Gel Pen
stationery     49     → Notebook
```

> **Think of it like this:** A compound index is like a phone book sorted by **surname**, then by **first name**. Finding "all the Sens" is easy. Finding "Rahul Sen" is easy. But finding "everyone named Rahul" (first name only) means reading the whole book, because first names are only sorted *inside* each surname.

This index helps all of these:

```javascript
db.products.find({ category: "stationery" })
db.products.find({ category: "stationery", price: { $lt: 30 } })
db.products.find({ category: "kitchen" }).sort({ price: 1 })
```

### Prefixes

The fields at the start of a compound index are its **prefixes**. For `{ category: 1, price: 1, stock: 1 }` the prefixes are:

- `{ category: 1 }`
- `{ category: 1, price: 1 }`

A query can use the index if it filters on a prefix. A query on **only** `price` cannot use this index efficiently, because `price` is not the first field.

```javascript
db.products.find({ price: 49 })   // can't use { category, price, stock } well
```

> **Tip:** Because of prefixes, if you have `{ category: 1, price: 1 }` you usually don't need a separate `{ category: 1 }` index. It would be redundant.

### Sort direction matters in compound indexes

With several fields, the *combination* of directions matters. An index `{ category: 1, price: -1 }` supports:

- `sort({ category: 1, price: -1 })` (same directions)
- `sort({ category: -1, price: 1 })` (exactly reversed)

But not `sort({ category: 1, price: 1 })`. For that, MongoDB has to sort in memory.

## The ESR rule: choosing field order

When a query has equality filters, a sort, and range filters, put the index fields in this order:

1. **E**quality: fields matched with an exact value (`category: "electronics"`)
2. **S**ort: fields in `.sort()`
3. **R**ange: fields with `$gt`, `$lt`, `$gte`, `$lte`, `$ne`, and similar

Take this query: "electronics under 2000, best rated first".

```javascript
db.products.find({
  category: "electronics",        // Equality
  price: { $lt: 2000 }            // Range
}).sort({ rating: -1 })           // Sort
```

Following ESR, the best index is:

```javascript
db.products.createIndex({ category: 1, rating: -1, price: 1 })
```

Why this order? Equality first jumps straight to the electronics section. Inside it, entries are already sorted by rating, so no in-memory sort is needed. The price range then filters entries as MongoDB walks the index.

If you put `price` before `rating`, the matching entries come out sorted by price, and MongoDB has to sort them by rating in memory, which is slower and uses RAM.

## Unique indexes

A **unique index** stops two documents from having the same value. It is perfect for emails and usernames:

```javascript
db.customers.createIndex({ email: 1 }, { unique: true })

db.customers.insertOne({ name: "Asha Roy",  email: "asha@example.com" })
db.customers.insertOne({ name: "Asha Copy", email: "asha@example.com" })
// → MongoServerError: E11000 duplicate key error collection: shop.customers
//   index: email_1 dup key: { email: "asha@example.com" }
```

A compound index can also be unique, meaning the *combination* must be unique:

```javascript
// One review per customer per product
db.reviews.createIndex({ productId: 1, customerId: 1 }, { unique: true })
```

> **Warning:** Creating a unique index fails if duplicates already exist. Find and fix them first.

## Covered queries

If every field in the filter **and** every field you return is inside the index, MongoDB can answer from the index alone, without loading documents. This is a **covered query**, the fastest kind.

```javascript
db.products.createIndex({ category: 1, price: 1 })

db.products.find(
  { category: "stationery" },
  { _id: 0, category: 1, price: 1 }   // only indexed fields, and _id excluded
)
```

The `explain` output shows `IXSCAN` with a `PROJECTION_COVERED` stage and no `FETCH`, and `totalDocsExamined: 0`.

> **Note:** You must exclude `_id` (`_id: 0`) unless it is part of the index, because `_id` is returned by default.

## Indexes are not free

Each index makes reads faster but has costs:

- **Slower writes.** Every insert, update or delete must also update each index.
- **Memory and disk.** Indexes work best when they fit in RAM.
- **Limit.** A collection can have at most 64 indexes, and a compound index at most 32 fields.

A good habit: create indexes for your **real, frequent** queries, and remove the ones nobody uses. The `$indexStats` aggregation stage shows how often each index is used:

```javascript
db.products.aggregate([ { $indexStats: {} } ])
// → [ { name: 'category_1_price_1', accesses: { ops: 1520, since: ISODate("...") }, ... }, ... ]
```

> **Tip:** Before dropping an index on a busy app, you can **hide** it with `db.products.hideIndex("price_1")`. The planner stops using it, but it is still maintained. If things get slow, `unhideIndex` brings it back instantly, with no rebuild.

## Common mistakes

- **Indexing every field "just in case".** Each index slows writes. Index for the queries you actually run.
- **Wrong field order in compound indexes.** Remember ESR: Equality, Sort, Range.
- **Filtering on a field that isn't a prefix.** An index on `{ category: 1, price: 1 }` does not help a query on `price` alone.
- **Expecting a covered query while returning `_id`.** Add `_id: 0` to the projection.
- **Forgetting to index reference fields.** If you look up orders by `customerId`, create `{ customerId: 1 }`.

## Practice

1. Create an index that makes `db.orders.find({ customerId: someId })` fast.
2. The app's busiest query is: orders with `status: "pending"` created after a date, newest first. Write the best index using ESR.
3. Make sure no two customers can share an email. What happens if you try to insert a duplicate?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1.
db.orders.createIndex({ customerId: 1 })

// 2. Query:
db.orders.find({ status: "pending", createdAt: { $gte: ISODate("2026-10-01") } })
         .sort({ createdAt: -1 })
// Equality: status. Sort and range are on the same field (createdAt), so it goes next.
db.orders.createIndex({ status: 1, createdAt: -1 })

// 3.
db.customers.createIndex({ email: 1 }, { unique: true })
// A duplicate insert fails with: E11000 duplicate key error ... index: email_1
```

</details>

## Key takeaways

- An index is a sorted list of field values pointing to documents, like a book's index.
- Without an index MongoDB does a `COLLSCAN`; with one it does an `IXSCAN`.
- Single field indexes: `createIndex({ field: 1 })`. Direction rarely matters for one field.
- Compound indexes are sorted by the first field, then the next; queries must use a **prefix**.
- Order compound fields by the **ESR rule**: Equality, Sort, Range.
- Unique indexes prevent duplicates; covered queries are answered from the index alone.

**Next lesson:** [Multikey, Text and Wildcard Indexes](/courses/mongodb/multikey-text-wildcard-indexes)
