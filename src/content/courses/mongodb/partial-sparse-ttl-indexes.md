---
title: Partial, Sparse and TTL Indexes
slug: partial-sparse-ttl-indexes
metadescription: Learn how partial and sparse indexes keep indexes small, and how TTL indexes make MongoDB delete old documents automatically.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'indexes', 'ttl', 'performance']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- How a **partial index** indexes only the documents you care about
- The rule that decides whether a query can use a partial index
- What a **sparse index** is and why partial indexes usually replace it
- How a **TTL index** deletes old documents automatically
- How to combine these options, for example a unique index that ignores missing values

> **Before you start:** this lesson assumes you've read [Single Field and Compound Indexes](/courses/mongodb/indexes-single-and-compound).

## Why index only some documents?

A normal index has an entry for **every** document in the collection. Often that's wasteful.

Think about our `orders` collection. After a year, it might have 2 million orders, but only a few hundred are `"pending"`. The warehouse dashboard only ever asks for pending orders. Indexing all 2 million to find a few hundred means a big index that eats RAM and slows every write.

> **Think of it like this:** A school keeps a "students who still owe fees" list on the noticeboard. It doesn't list every student who has ever attended. A short, focused list is quicker to read and easier to keep up to date. Partial and sparse indexes are those short lists.

## Partial indexes

A **partial index** only includes documents that match a filter, called the `partialFilterExpression`.

Let's index `createdAt`, but only for pending orders:

```javascript
use shop

db.orders.createIndex(
  { createdAt: 1 },
  { partialFilterExpression: { status: "pending" } }
)
// → createdAt_1
```

Now this query can use the small index:

```javascript
db.orders.find({ status: "pending", createdAt: { $lt: ISODate("2026-10-20") } })
  .sort({ createdAt: 1 })
```

When an order's status changes from `"pending"` to `"shipped"`, MongoDB removes it from the index automatically. The index stays tiny.

### The golden rule for partial indexes

MongoDB will only use a partial index if your query's filter **guarantees** that every matching document is in the index. In practice, your query must include the same condition (or a stricter one).

```javascript
// Uses the partial index: the query asks for status "pending"
db.orders.find({ status: "pending", createdAt: { $gte: ISODate("2026-10-01") } })

// Does NOT use it: shipped orders aren't in the index
db.orders.find({ status: "shipped", createdAt: { $gte: ISODate("2026-10-01") } })

// Does NOT use it: no status in the filter, so results could include non-pending orders
db.orders.find({ createdAt: { $gte: ISODate("2026-10-01") } })
```

Here is another example with a range. We index the price of in-stock products only:

```javascript
db.products.createIndex(
  { price: 1 },
  { partialFilterExpression: { stock: { $gt: 0 } } }
)

db.products.find({ price: { $lt: 500 }, stock: { $gt: 10 } })  // can use it (stock > 10 implies stock > 0)
db.products.find({ price: { $lt: 500 }, stock: { $gt: 0 } })   // can use it
db.products.find({ price: { $lt: 500 } })                      // can't, might need out-of-stock items
```

> **Tip:** Check with `explain()` whether your query really used the partial index. Look for `IXSCAN` with the right `indexName`. You'll learn this in [explain and Query Plans](/courses/mongodb/explain-and-query-plans).

### What can go in the filter?

The `partialFilterExpression` supports a limited set of operators:

| Allowed | Example |
| --- | --- |
| Equality | `{ status: "pending" }` or `{ status: { $eq: "pending" } }` |
| `$exists: true` | `{ email: { $exists: true } }` |
| Comparisons | `$gt`, `$gte`, `$lt`, `$lte` |
| `$type` | `{ rating: { $type: "number" } }` |
| `$and`, `$or`, `$in` | `{ status: { $in: ["pending", "shipped"] } }` |

Operators like `$ne`, `$nin` and `$exists: false` are **not** allowed.

## Unique, but only when the field is present

Here's a really useful trick. Suppose customers may have an optional `phone` field, and when it exists it must be unique.

A plain unique index fails, because every customer without a phone counts as having a missing (null) value, and two of those are "duplicates".

A **partial unique index** solves it:

```javascript
db.customers.createIndex(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $exists: true } } }
)

db.customers.insertOne({ name: "Ken",   email: "ken@example.com" })                          // OK, no phone
db.customers.insertOne({ name: "Maria", email: "maria@example.com" })                        // OK, no phone
db.customers.insertOne({ name: "Asha",  email: "asha2@example.com",  phone: "98300 11111" })  // OK
db.customers.insertOne({ name: "Rahul", email: "rahul2@example.com", phone: "98300 11111" })
// → MongoServerError: E11000 duplicate key error ... index: phone_1
```

> **Note:** The uniqueness rule only applies to documents inside the partial index. Documents outside the filter can share any value.

## Sparse indexes

A **sparse index** is an older, simpler idea: it only includes documents that **have** the indexed field (even if its value is `null`). Documents without the field are skipped.

```javascript
// Only products that have a rating are indexed
db.products.createIndex({ rating: 1 }, { sparse: true })
```

In our `shop` data, only Headphones and Coffee Mug have a `rating`, so the index has just two entries.

### A sparse index can be skipped by the planner

Because some documents are missing from a sparse index, MongoDB won't use it when that would give wrong results. For example, sorting **all** products by rating:

```javascript
db.products.find().sort({ rating: -1 })
// MongoDB does NOT use the sparse index here,
// because products without a rating would be missing from the results
```

If you force it with `hint()`, you'll get only the products that have a rating, which may surprise you.

### Partial or sparse?

A partial index with `$exists: true` does the same job as a sparse index, and partial indexes can do much more.

```javascript
// These two behave almost the same
db.products.createIndex({ rating: 1 }, { sparse: true })
db.products.createIndex({ rating: 1 }, { partialFilterExpression: { rating: { $exists: true } } })
```

> **Tip:** MongoDB's documentation recommends partial indexes over sparse indexes for new work. Learn sparse so you recognise it in older projects.

## TTL indexes: automatic clean-up

Many apps store data that should only live for a while:

- Login sessions that expire after 2 hours
- One-time verification codes valid for 10 minutes
- Shopping carts abandoned for 30 days
- Debug logs older than a week

You could write a script that deletes old documents every night. Or you can let MongoDB do it with a **TTL index**. TTL stands for **Time To Live**.

> **Think of it like this:** A TTL index is like the "best before" date on milk. You stamp a date on each carton, and a shop assistant walks the shelves regularly and throws out anything past its date.

### Creating a TTL index

A TTL index is a single field index on a **date** field, with the `expireAfterSeconds` option:

```javascript
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7200 })  // 2 hours
// → createdAt_1

db.sessions.insertOne({ userName: "Asha", createdAt: new Date() })
```

About two hours after its `createdAt` time, the session document is deleted automatically.

### How the clean-up actually runs

- MongoDB has a background task (the **TTL monitor**) that wakes up **every 60 seconds** and deletes expired documents.
- So a document is removed **some time after** it expires, not at the exact second. On a busy server it can take longer.
- On a replica set, the deletes happen on the primary and are copied to the secondaries like any other delete.

> **Warning:** Never rely on TTL for exact timing. If your code must not use an expired session, also check the time in your query, e.g. `{ createdAt: { $gt: twoHoursAgo } }`.

### TTL rules

- The indexed field must hold a **date** (or an array of dates; the earliest one is used).
- Documents where the field is missing or isn't a date **never expire**.
- TTL works only on **single field** indexes. A compound index ignores `expireAfterSeconds`.
- You can't create a TTL index on `_id`.

### Expire at a specific time

Sometimes each document has its own expiry time. Store the exact moment in a field and set `expireAfterSeconds: 0`:

```javascript
db.otpCodes.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })

db.otpCodes.insertOne({
  userName: "Rahul",
  code: "482913",
  expireAt: new Date(Date.now() + 10 * 60 * 1000)   // 10 minutes from now
})
```

Each document is deleted soon after its own `expireAt` time.

### Changing the expiry time

To change `expireAfterSeconds` on an existing TTL index, use `collMod`. No need to drop and rebuild:

```javascript
db.runCommand({
  collMod: "sessions",
  index: { keyPattern: { createdAt: 1 }, expireAfterSeconds: 86400 }  // now 24 hours
})
```

### TTL plus partial

You can combine both: only delete *some* documents after a while. Here, only guest carts expire, not carts saved by members:

```javascript
db.carts.createIndex(
  { updatedAt: 1 },
  { expireAfterSeconds: 2592000, partialFilterExpression: { isGuest: true } }  // 30 days
)
```

> **Note:** Time series collections (see [Time Series and Capped Collections](/courses/mongodb/time-series-collections)) have their own `expireAfterSeconds` collection option for removing old data.

## Cheat sheet

| Option | What it does | Typical use |
| --- | --- | --- |
| `partialFilterExpression` | Index only documents matching a filter | Hot subsets: pending orders, active users |
| `sparse: true` | Index only documents that have the field | Older code; prefer partial |
| `unique` + `partialFilterExpression` | Unique only among matching documents | Optional but unique fields (phone, username) |
| `expireAfterSeconds` | Delete documents after a time | Sessions, codes, logs, carts |

## Common mistakes

- **Query doesn't match the partial filter.** If the index filter is `status: "pending"`, your query must also ask for `status: "pending"`, or the index is ignored.
- **Storing dates as strings.** `createdAt: "2026-10-25"` is text, not a date, so TTL never deletes it. Use `new Date()` or `ISODate(...)`.
- **Expecting instant deletion.** TTL runs about once a minute and can lag. Also filter by time in queries that care.
- **Adding `expireAfterSeconds` to a compound index.** It's ignored. TTL needs a single field index.
- **Using sparse and forgetting it skips documents.** Sorting or counting with a hinted sparse index can return fewer documents than you expect.

## Practice

1. Create an index that speeds up "delivered orders, newest first" but only contains delivered orders.
2. Make `username` unique for customers who have one, while allowing many customers without a username.
3. Store password-reset requests that disappear 15 minutes after creation. Write the index and one insert.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1.
db.orders.createIndex(
  { createdAt: -1 },
  { partialFilterExpression: { status: "delivered" } }
)
db.orders.find({ status: "delivered" }).sort({ createdAt: -1 })

// 2.
db.customers.createIndex(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $exists: true } } }
)

// 3.
db.passwordResets.createIndex({ createdAt: 1 }, { expireAfterSeconds: 900 })
db.passwordResets.insertOne({ email: "priya@example.com", createdAt: new Date() })
```

</details>

## Key takeaways

- A **partial index** includes only documents that match `partialFilterExpression`, so it's smaller and cheaper.
- A query can use a partial index only when its filter guarantees the results are all in the index.
- A **sparse index** skips documents missing the field; partial indexes are the modern, more flexible choice.
- **Unique + partial** gives you "unique when present" for optional fields.
- A **TTL index** (`expireAfterSeconds`) deletes documents automatically, roughly once a minute, based on a date field.
- Use `expireAfterSeconds: 0` with an `expireAt` field for per-document expiry times.

**Next lesson:** [Geospatial Indexes and Queries](/courses/mongodb/geospatial-indexes)
