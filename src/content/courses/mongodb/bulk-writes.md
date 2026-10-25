---
title: Bulk Writes and the Bulk API
slug: bulk-writes
metadescription: Learn how to send many inserts, updates and deletes in one request with bulkWrite(), including MongoDB 8's cross-collection client bulk write.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'bulk-write', 'crud', 'performance']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What a **bulk write** is and why it is faster than many single writes
- How to use `db.collection.bulkWrite()` to mix inserts, updates and deletes
- The difference between **ordered** and **unordered** bulk writes
- How MongoDB 8 lets you write to **many collections in one request** with `db.getMongo().bulkWrite()` and the `bulkWrite` command
- How to do the same from a Node.js app with `collection.bulkWrite()` and `client.bulkWrite()`

> **Note:** Everything in this lesson works on a plain local MongoDB server. The cross-collection version needs MongoDB 8.0 or later.

## Why bulk writes?

Every time your app sends a command to MongoDB, the message has to travel over the network and come back. That trip is called a **round trip**.

If you need to change 1,000 documents and you send 1,000 separate `updateOne()` calls, you pay for 1,000 round trips. Most of the time is spent waiting on the network, not doing actual work.

A **bulk write** packs many write operations into one request. MongoDB receives the whole list, runs it, and sends back one combined result.

> **Think of it like this:** Posting 50 letters one at a time means 50 trips to the post office. Putting all 50 in one big envelope means one trip. A bulk write is the big envelope.

Bulk writes are perfect for:

- Importing data from a file or another system
- Nightly jobs, like updating prices or marking old orders as archived
- Syncing a batch of changes that came from a queue or an API

## Your first bulkWrite()

Let's use the `shop` database from earlier lessons. Make sure the `products` collection has the sample data:

```javascript
use shop

db.products.insertMany([
  { name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"] },
  { name: "Gel Pen", category: "stationery", price: 15, stock: 500, tags: ["pen", "school"] },
  { name: "Headphones", category: "electronics", price: 1999, stock: 35, tags: ["audio", "wireless"], rating: 4.5 },
  { name: "USB Cable", category: "electronics", price: 299, stock: 0, tags: ["cable"] },
  { name: "Coffee Mug", category: "kitchen", price: 249, stock: 60, tags: ["ceramic", "gift"], rating: 4.8 }
])
```

`bulkWrite()` takes an **array of operations**. Each operation is an object whose key is the operation name. Here we add a product, raise a price, restock items, and remove a product, all in one call:

```javascript
db.products.bulkWrite([
  { insertOne: { document: { name: "Sticky Notes", category: "stationery", price: 35, stock: 200, tags: ["paper"] } } },
  { updateOne: { filter: { name: "Headphones" }, update: { $set: { price: 1899 } } } },
  { updateMany: { filter: { stock: 0 }, update: { $set: { stock: 50 } } } },
  { deleteOne: { filter: { name: "Gel Pen" } } }
])
```

MongoDB answers with one summary for the whole batch:

```javascript
// → {
//     acknowledged: true,
//     insertedCount: 1,
//     insertedIds: { '0': ObjectId('6718b0c1a2b3c4d5e6f7a8b9') },
//     matchedCount: 2,
//     modifiedCount: 2,
//     deletedCount: 1,
//     upsertedCount: 0,
//     upsertedIds: {}
//   }
```

Notice that `insertedIds` uses the **position** of the operation in your array (`'0'` is the first operation). This helps you match results back to your input.

### All six operation types

| Operation | What it does | Required fields |
| --- | --- | --- |
| `insertOne` | Adds one document | `document` |
| `updateOne` | Updates the first match | `filter`, `update` |
| `updateMany` | Updates every match | `filter`, `update` |
| `replaceOne` | Swaps the whole document for a new one | `filter`, `replacement` |
| `deleteOne` | Deletes the first match | `filter` |
| `deleteMany` | Deletes every match | `filter` |

The update and replace operations also accept `upsert: true`, just like the normal methods you learned in *Update Operators and Upserts*:

```javascript
db.products.bulkWrite([
  {
    updateOne: {
      filter: { name: "Desk Lamp" },
      update: { $set: { category: "electronics", price: 799, stock: 15 } },
      upsert: true // create it if it doesn't exist
    }
  },
  {
    replaceOne: {
      filter: { name: "Coffee Mug" },
      replacement: { name: "Coffee Mug", category: "kitchen", price: 229, stock: 80, tags: ["ceramic"] }
    }
  }
])
// → { ..., matchedCount: 1, modifiedCount: 1, upsertedCount: 1, upsertedIds: { '0': ObjectId('...') } }
```

> **Note:** `insertOne` inside `bulkWrite()` is the only way to insert in a bulk write. There is no `insertMany` operation in the list. To insert many documents, just add many `insertOne` items, or use plain `insertMany()`.

## Ordered vs unordered

What happens if one operation in the middle fails, for example because of a duplicate `_id`? That depends on the `ordered` option.

### Ordered (the default)

With `ordered: true`, MongoDB runs the operations **one by one, in your order**. If one fails, it **stops**. Operations before the error are kept. Operations after the error never run.

```javascript
db.products.bulkWrite([
  { insertOne: { document: { _id: 1, name: "Eraser", price: 10 } } },
  { insertOne: { document: { _id: 1, name: "Ruler", price: 20 } } },  // duplicate _id, fails
  { insertOne: { document: { _id: 2, name: "Stapler", price: 120 } } } // never runs
])
// → MongoBulkWriteError: E11000 duplicate key error collection: shop.products index: _id_ dup key: { _id: 1 }
//   Result: insertedCount: 1
```

Only the Eraser was saved.

### Unordered

With `ordered: false`, MongoDB may run the operations in any order (and in parallel on sharded clusters). If one fails, it **keeps going** and reports all the errors at the end.

```javascript
db.products.bulkWrite(
  [
    { insertOne: { document: { _id: 10, name: "Eraser", price: 10 } } },
    { insertOne: { document: { _id: 10, name: "Ruler", price: 20 } } },  // fails
    { insertOne: { document: { _id: 11, name: "Stapler", price: 120 } } } // still runs
  ],
  { ordered: false }
)
// → MongoBulkWriteError: E11000 duplicate key error ...
//   writeErrors: [ { index: 1, code: 11000, ... } ]
//   Result: insertedCount: 2
```

The Eraser and the Stapler were saved. The error tells you **which index** failed (`index: 1`), so you can fix or retry that one.

> **Tip:** Use **unordered** when operations don't depend on each other (like an import). It is usually faster. Use **ordered** when a later step depends on an earlier one, like "insert a product, then update it".

> **Warning:** A bulk write is **not a transaction**. If operation 3 fails, operations 1 and 2 are not undone. If you need all-or-nothing, wrap the work in a transaction (you'll learn this in *Transactions and ACID Guarantees*).

## The older Bulk API

Before `bulkWrite()` existed, MongoDB shells used a builder style called the **Bulk API**. You will still see it in older tutorials, and mongosh still supports it:

```javascript
const bulk = db.products.initializeUnorderedBulkOp()

bulk.insert({ name: "Marker", category: "stationery", price: 40, stock: 90 })
bulk.find({ category: "kitchen" }).update({ $inc: { stock: 10 } })
bulk.find({ name: "Eraser" }).deleteOne()

bulk.execute()
// → { acknowledged: true, insertedCount: 1, matchedCount: 1, modifiedCount: 1, deletedCount: 1, ... }
```

There is also `initializeOrderedBulkOp()` for the ordered version. Both do the same job as `bulkWrite()`. For new code, prefer `bulkWrite()`: it is the same in mongosh and in every driver.

## MongoDB 8: one bulk write, many collections

`db.collection.bulkWrite()` has one limit: every operation goes to **the same collection**.

MongoDB 8.0 added a new server command, also called **`bulkWrite`**, that can write to **many collections, even in different databases, in one request**. In mongosh you use it through `db.getMongo().bulkWrite()`.

> **Think of it like this:** The old bulk write is a big envelope for one address. The new one is a courier bag with envelopes for several addresses inside, delivered in one trip.

### db.getMongo().bulkWrite() in mongosh

Each operation now says **where** it goes with a `namespace` field (`"database.collection"`) and **what** it is with a `name` field.

Here a new customer places their first order. We insert the customer, insert the order, and lower the stock, across three collections:

```javascript
db.getMongo().bulkWrite([
  {
    namespace: "shop.customers",
    name: "insertOne",
    document: { _id: 101, name: "Priya Nair", email: "priya@example.com", city: "Pune", isMember: false }
  },
  {
    namespace: "shop.orders",
    name: "insertOne",
    document: {
      customerId: 101,
      items: [{ name: "Notebook", qty: 2, price: 49 }],
      total: 98,
      status: "pending",
      createdAt: new Date()
    }
  },
  {
    namespace: "shop.products",
    name: "updateOne",
    filter: { name: "Notebook" },
    update: { $inc: { stock: -2 } }
  }
])
```

The result adds up the counts across all collections:

```javascript
// → {
//     acknowledged: true,
//     insertedCount: 2,
//     matchedCount: 1,
//     modifiedCount: 1,
//     deletedCount: 0,
//     upsertedCount: 0,
//     ...
//   }
```

The operation names are the same six you already know (`insertOne`, `updateOne`, `updateMany`, `replaceOne`, `deleteOne`, `deleteMany`). The options include `ordered` (default `true`) and `verboseResults` (default `false`). Set `verboseResults: true` to get a result for every single operation in `insertResults`, `updateResults` and `deleteResults`.

> **Note:** In a real app, use a real `ObjectId` for `customerId`. We used a plain number here to keep the example short.

### The raw bulkWrite command

Under the hood, mongosh sends the `bulkWrite` command to the `admin` database. You rarely need it directly, but it helps to recognise it. Instead of a namespace string on every operation, it lists the namespaces once in `nsInfo` and each operation points to one by its **index**:

```javascript
db.adminCommand({
  bulkWrite: 1,
  ops: [
    { insert: 0, document: { name: "Sticky Tape", category: "stationery", price: 25, stock: 300 } },
    { update: 0, filter: { name: "Notebook" }, updateMods: { $set: { price: 45 } } },
    { delete: 1, filter: { status: "cancelled" }, multi: true }
  ],
  nsInfo: [
    { ns: "shop.products" }, // index 0
    { ns: "shop.orders" }    // index 1
  ]
})
// → {
//     cursor: { firstBatch: [ { ok: 1, idx: 0, n: 1 }, { ok: 1, idx: 1, n: 1, nModified: 1 }, { ok: 1, idx: 2, n: 0 } ], ... },
//     nErrors: 0, nInserted: 1, nMatched: 1, nModified: 1, nUpserted: 0, nDeleted: 0, ok: 1
//   }
```

Notice the different field names: `updateMods` instead of `update`, and `multi: true` instead of a separate `updateMany` or `deleteMany`. The friendly `db.getMongo().bulkWrite()` hides all of this for you.

## Bulk writes from Node.js

Apps usually send bulk writes from code. The Node.js driver offers both styles.

### collection.bulkWrite()

This works with any MongoDB version and looks just like mongosh:

```javascript
import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017");
const products = client.db("shop").collection("products");

const result = await products.bulkWrite(
  [
    { insertOne: { document: { name: "Pencil Box", category: "stationery", price: 99, stock: 40 } } },
    { updateMany: { filter: { category: "stationery" }, update: { $inc: { stock: 10 } } } },
    { deleteMany: { filter: { stock: 0 } } }
  ],
  { ordered: false }
);

console.log(result.insertedCount, result.modifiedCount, result.deletedCount);
// → 1 4 0  (your numbers depend on what is in your collection)
```

### client.bulkWrite() (MongoDB 8.0+)

For writes across collections, call `bulkWrite()` on the **client** itself. It needs MongoDB Server 8.0 or later and Node.js driver 6.10 or later. The model shape is the same as in mongosh: `namespace` plus `name`.

```javascript
const result = await client.bulkWrite([
  {
    namespace: "shop.orders",
    name: "updateOne",
    filter: { status: "pending" },
    update: { $set: { status: "shipped" } }
  },
  {
    namespace: "shop.customers",
    name: "updateMany",
    filter: { city: "Pune" },
    update: { $set: { isMember: true } }
  }
]);

console.log(result.matchedCount, result.modifiedCount);
```

If something fails, the driver throws an error you can inspect:

```javascript
import { MongoClientBulkWriteError } from "mongodb";

try {
  await client.bulkWrite(models, { ordered: false });
} catch (err) {
  if (err instanceof MongoClientBulkWriteError) {
    console.log("Failed operations:", err.writeErrors);     // a Map: index → error
    console.log("What did work:", err.partialResult);
  } else {
    throw err;
  }
}
```

For `collection.bulkWrite()` the error class is `MongoBulkWriteError` instead.

## How big can a bulk write be?

You can pass a very large array. The driver and mongosh automatically split it into smaller **batches** behind the scenes (the server accepts up to 100,000 operations per batch, and each batch must fit in the message size limit). You get one combined result either way.

> **Tip:** For huge imports, build your array in chunks of a few thousand operations and call `bulkWrite()` once per chunk. That keeps your app's memory use low and lets you log progress.

## Common mistakes

- **Expecting a rollback.** A failed bulk write keeps every operation that already succeeded. Use a transaction if you need all-or-nothing.
- **Forgetting the wrapper key.** In `collection.bulkWrite()`, each item must look like `{ updateOne: { filter, update } }`, not `{ filter, update }`. Missing the wrapper gives an "invalid operation" error.
- **Mixing up the two shapes.** `db.products.bulkWrite()` uses `{ insertOne: { document } }`, while `db.getMongo().bulkWrite()` and `client.bulkWrite()` use `{ namespace, name: "insertOne", document }`.
- **Using ordered mode for imports.** One bad row stops the whole import. Use `{ ordered: false }` and read `writeErrors` instead.
- **Calling client-level bulk write on an older server.** `db.getMongo().bulkWrite()` and `client.bulkWrite()` need MongoDB 8.0+. On older servers, call `collection.bulkWrite()` once per collection.

## Practice

1. Write one `db.products.bulkWrite()` call that adds a "Water Bottle" (kitchen, price 349, stock 25), gives every kitchen product a `featured: true` field, and deletes all products with `stock: 0`.
2. Make it unordered.
3. Write a `db.getMongo().bulkWrite()` call that marks the order with `_id: 5001` as `"delivered"` and adds 10 to the stock of "USB Cable".

<details>
<summary>Show a possible answer</summary>

```javascript
// 1 and 2
db.products.bulkWrite(
  [
    { insertOne: { document: { name: "Water Bottle", category: "kitchen", price: 349, stock: 25 } } },
    { updateMany: { filter: { category: "kitchen" }, update: { $set: { featured: true } } } },
    { deleteMany: { filter: { stock: 0 } } }
  ],
  { ordered: false }
)

// 3 (MongoDB 8.0+)
db.getMongo().bulkWrite([
  { namespace: "shop.orders", name: "updateOne", filter: { _id: 5001 }, update: { $set: { status: "delivered" } } },
  { namespace: "shop.products", name: "updateOne", filter: { name: "USB Cable" }, update: { $inc: { stock: 10 } } }
])
```

</details>

## Key takeaways

- A **bulk write** sends many write operations in one request, saving network round trips.
- `db.collection.bulkWrite()` mixes `insertOne`, `updateOne`, `updateMany`, `replaceOne`, `deleteOne` and `deleteMany` on one collection.
- **Ordered** (default) stops at the first error; **unordered** keeps going and reports every error.
- A bulk write is **not** a transaction: successful operations are not undone when another fails.
- MongoDB 8.0 adds cross-collection bulk writes: `db.getMongo().bulkWrite()` in mongosh, `client.bulkWrite()` in Node.js, and the `bulkWrite` admin command underneath.

**Next lesson:** [Change Streams](/courses/mongodb/change-streams)
