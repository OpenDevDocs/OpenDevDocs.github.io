---
title: Inserting Documents
slug: inserting-documents
metadescription: Learn to add data to MongoDB with insertOne and insertMany, read the results, handle duplicate key errors, and use ordered and unordered inserts.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'crud', 'insert', 'basics']
course: mongodb
---
## What you will learn

By the end of this lesson you will be able to:

- Add one document with `insertOne()`
- Add many documents at once with `insertMany()`
- Read the result MongoDB sends back
- Insert documents with arrays, embedded documents, dates and references
- Understand what happens when an insert fails, and how **ordered** and **unordered** inserts differ
- Insert documents from a Node.js app

## The C in CRUD

Almost everything an app does with a database fits into four actions, called **CRUD**:

| Letter | Action | MongoDB methods |
| --- | --- | --- |
| **C** | Create | `insertOne`, `insertMany` |
| **R** | Read | `find`, `findOne` |
| **U** | Update | `updateOne`, `updateMany`, `replaceOne` |
| **D** | Delete | `deleteOne`, `deleteMany` |

This lesson is all about **C**: putting new documents into a collection.

> **Think of it like this:** A collection is a photo album. Inserting is sliding a new photo into an empty pocket. Updating is changing a photo that's already there. Deleting is taking one out.

## insertOne: add a single document

Let's add a new product. Start in the `shop` database:

```javascript
use shop

db.products.insertOne({
  name: "Water Bottle",
  category: "kitchen",
  price: 399,
  stock: 80,
  tags: ["steel", "gift"]
})
```

MongoDB answers with a small **result document**:

```javascript
{
  acknowledged: true,
  insertedId: ObjectId("6718e1a2b3c4d5e6f7a8b9c1")
}
```

| Field | Meaning |
| --- | --- |
| `acknowledged: true` | The server received the write and confirmed it. |
| `insertedId` | The `_id` of the new document. We didn't give one, so MongoDB made an ObjectId. |

Remember from the last lessons:

- If the `products` collection didn't exist, it's created now.
- If the `shop` database didn't exist, it's created now too.

### Keeping the result

Because mongosh is JavaScript, you can save the result in a variable and use the new ID straight away:

```javascript
const result = db.products.insertOne({ name: "Desk Organiser", category: "stationery", price: 349, stock: 25, tags: ["office"] })

result.insertedId
// → ObjectId("6718e1b7b3c4d5e6f7a8b9c2")

db.products.findOne({ _id: result.insertedId })
// → { _id: ObjectId("6718e1b7..."), name: "Desk Organiser", ... }
```

### Choosing your own _id

You can provide the `_id` yourself, as you saw in [ObjectId and the _id Field](/courses/mongodb/objectid-and-id-field):

```javascript
db.coupons.insertOne({ _id: "DIWALI25", percentOff: 25, active: true })
// → { acknowledged: true, insertedId: "DIWALI25" }
```

## insertMany: add several documents at once

`insertMany()` takes an **array** of documents. Let's add customers for our shop:

```javascript
db.customers.insertMany([
  { name: "Asha Roy", email: "asha@example.com", city: "Kolkata", joinedAt: new Date("2026-01-15"), isMember: true },
  { name: "Rahul Sharma", email: "rahul@example.com", city: "Delhi", joinedAt: new Date("2026-03-02"), isMember: false },
  { name: "Priya Nair", email: "priya@example.com", city: "Kochi", joinedAt: new Date("2026-04-05"), isMember: true },
  { name: "Ken Tanaka", email: "ken@example.com", city: "Tokyo", joinedAt: new Date("2026-06-20"), isMember: false },
  { name: "Maria Garcia", email: "maria@example.com", city: "Madrid", joinedAt: new Date("2026-08-11"), isMember: true }
])
```

The result lists every new `_id`, keyed by its position in the array (starting at 0):

```javascript
{
  acknowledged: true,
  insertedIds: {
    "0": ObjectId("6718e2c0b3c4d5e6f7a8b9c3"),
    "1": ObjectId("6718e2c0b3c4d5e6f7a8b9c4"),
    "2": ObjectId("6718e2c0b3c4d5e6f7a8b9c5"),
    "3": ObjectId("6718e2c0b3c4d5e6f7a8b9c6"),
    "4": ObjectId("6718e2c0b3c4d5e6f7a8b9c7")
  }
}
```

Notice the plural: `insertedIds` for `insertMany`, `insertedId` for `insertOne`.

> **Tip:** `insertMany()` is much faster than calling `insertOne()` in a loop, because it sends many documents to the server in one trip instead of one trip per document.

### Remember the brackets

`insertMany` needs an **array**, wrapped in `[ ]`. `insertOne` takes a **single document**, wrapped in `{ }`.

```javascript
db.customers.insertMany({ name: "Asha" })     // ✗ error: not an array
db.customers.insertMany([{ name: "Asha" }])   // ✓ an array with one document
```

## Inserting richer documents

Real documents usually contain arrays, embedded documents and links to other documents. Let's create an **order** that does all three.

First, look up a customer's `_id` and two products we want to order:

```javascript
const asha = db.customers.findOne({ name: "Asha Roy" })
const notebook = db.products.findOne({ name: "Notebook" })
const pen = db.products.findOne({ name: "Gel Pen" })
```

Now insert the order:

```javascript
db.orders.insertOne({
  customerId: asha._id,                       // a reference to the customer
  items: [                                    // an array of embedded documents
    { productId: notebook._id, name: "Notebook", qty: 2, price: 49 },
    { productId: pen._id, name: "Gel Pen", qty: 5, price: 15 }
  ],
  total: 2 * 49 + 5 * 15,                     // JavaScript does the maths: 173
  status: "pending",
  createdAt: new Date()                       // the current date and time
})
// → { acknowledged: true, insertedId: ObjectId("...") }
```

Let's look at what's stored:

```javascript
db.orders.findOne()
```

```javascript
{
  _id: ObjectId("6718e3d4b3c4d5e6f7a8b9c8"),
  customerId: ObjectId("6718e2c0b3c4d5e6f7a8b9c3"),
  items: [
    { productId: ObjectId("..."), name: "Notebook", qty: 2, price: 49 },
    { productId: ObjectId("..."), name: "Gel Pen", qty: 5, price: 15 }
  ],
  total: 173,
  status: "pending",
  createdAt: ISODate("2026-10-25T08:45:00.000Z")
}
```

A few things worth noticing:

- `total` was calculated **before** sending, so the stored value is just `173`.
- `new Date()` became a real Date, shown as `ISODate(...)`.
- The items store a copy of the `name` and `price` at the time of ordering. That's deliberate: if the Notebook's price changes next month, old orders still show what the customer actually paid.

> **Think of it like this:** An order is like a printed receipt. It records what you bought and the price *on that day*, even if the shop changes its prices later.

## When an insert fails

Inserts can fail. The most common reason for beginners is a **duplicate `_id`**.

### insertOne with a duplicate

```javascript
db.coupons.insertOne({ _id: "DIWALI25", percentOff: 30 })
```

```text
MongoServerError: E11000 duplicate key error collection: shop.coupons index: _id_ dup key: { _id: "DIWALI25" }
```

Nothing was inserted, and the original coupon is unchanged.

### insertMany: ordered (the default)

By default `insertMany` is **ordered**: it inserts documents **one after another, in order**, and **stops at the first error**.

```javascript
db.coupons.insertMany([
  { _id: "NEWYEAR10", percentOff: 10 },   // 1. inserted
  { _id: "DIWALI25", percentOff: 25 },    // 2. duplicate, error, STOP
  { _id: "HOLI15", percentOff: 15 }       // 3. never tried
])
```

```text
MongoBulkWriteError: E11000 duplicate key error collection: shop.coupons index: _id_ dup key: { _id: "DIWALI25" }
Result: BulkWriteResult {
  insertedCount: 1,
  ...
}
```

`NEWYEAR10` **was** inserted (it came before the error), `DIWALI25` failed, and `HOLI15` was **skipped**.

> **Warning:** A failed `insertMany` does **not** undo the documents that were already inserted. MongoDB inserts each document separately. If you need "all or nothing", you need a transaction, covered in [Transactions and ACID Guarantees](/courses/mongodb/transactions).

### insertMany: unordered

Pass `{ ordered: false }` to tell MongoDB: "try **every** document, and report all the problems at the end."

```javascript
db.coupons.insertMany(
  [
    { _id: "DIWALI25", percentOff: 25 },   // duplicate, error
    { _id: "HOLI15", percentOff: 15 },     // inserted
    { _id: "EID20", percentOff: 20 }       // inserted
  ],
  { ordered: false }
)
```

This still reports an error for `DIWALI25`, but `HOLI15` and `EID20` are both inserted.

| | Ordered (default) | Unordered (`ordered: false`) |
| --- | --- | --- |
| On error | Stops at the first error | Keeps going, reports all errors at the end |
| Documents after a failure | Not inserted | Inserted (if they're valid) |
| Speed | Good | Often faster, because MongoDB can process the batch more freely |
| Use when | Order matters (later documents depend on earlier ones) | Loading lots of independent data, where a few bad rows shouldn't stop everything |

### Other reasons an insert can fail

- The document is bigger than **16 MB**.
- The collection has **validation rules** and the document breaks them.
- A **unique index** on another field (like `email`) already has that value. You'll learn about unique indexes in [Single Field and Compound Indexes](/courses/mongodb/indexes-single-and-compound).

## How sure is "saved"? A peek at write concern

`acknowledged: true` means the server confirmed the write. You can ask for a stronger promise with a **write concern**, for example "confirm only after most servers in the replica set have it":

```javascript
db.products.insertOne(
  { name: "Pencil Box", category: "stationery", price: 199, stock: 50, tags: ["school"] },
  { writeConcern: { w: "majority" } }
)
```

On a single local server this makes no visible difference. On Atlas (which has 3 copies of your data), `"majority"` is already the usual default. You'll learn the details in [Read and Write Concerns](/courses/mongodb/read-and-write-concerns).

## Old methods to avoid

Older tutorials use `db.collection.insert()`. It is **deprecated**, which means it's outdated and may be removed. Its results are also less clear.

```javascript
db.products.insert({ name: "Old Way" })        // ✗ deprecated, don't use
db.products.insertOne({ name: "New Way" })     // ✓ use this
```

Always use `insertOne()` or `insertMany()`.

## Inserting from a Node.js app

In a real app you insert data using a **driver**, the MongoDB library for your programming language. The methods have the same names as in mongosh. Here's the official Node.js driver:

```javascript
import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017");

async function main() {
  await client.connect();
  const products = client.db("shop").collection("products");

  // Insert one
  const one = await products.insertOne({
    name: "Bookmark Set",
    category: "stationery",
    price: 59,
    stock: 150,
    tags: ["paper", "gift"]
  });
  console.log("Inserted one:", one.insertedId);

  // Insert many
  const many = await products.insertMany([
    { name: "Highlighter", category: "stationery", price: 25, stock: 300, tags: ["pen"] },
    { name: "Tea Cup", category: "kitchen", price: 179, stock: 45, tags: ["ceramic"] }
  ]);
  console.log("Inserted", many.insertedCount, "documents");

  await client.close();
}

main();
```

```text
Inserted one: new ObjectId("6718e5f6b3c4d5e6f7a8b9d0")
Inserted 2 documents
```

Two differences from mongosh: you must `await` each call, and the result of `insertMany` includes a handy `insertedCount`.

> **Tip:** In Node.js, numbers like `59` are JavaScript numbers. The driver sends whole numbers that fit in 32 bits as Int32, and other numbers as Double, so you get the same types as in mongosh.

## Common mistakes

- **Passing a single document to `insertMany`.** It needs an array: `insertMany([ {...} ])`.
- **Using the deprecated `insert()`.** Use `insertOne()` or `insertMany()`.
- **Assuming a failed `insertMany` inserted nothing.** With the default ordered mode, documents *before* the error are saved. Check the result, or use a transaction if you need all-or-nothing.
- **Saving dates as strings.** Write `new Date("2026-10-25")`, not `"2026-10-25"`, so you can sort and filter by date.
- **Inserting in a loop with `insertOne()`** when you have hundreds of documents. Collect them in an array and call `insertMany()` once.

## Practice

1. Insert one new product: a "Lunch Box" in the `kitchen` category, price 449, stock 30, tags `"steel"` and `"school"`. Save the result in a variable and print its `insertedId`.
2. Insert two orders for Rahul in one command: one for 1 Coffee Mug (status `"shipped"`) and one for 1 Headphones (status `"delivered"`). Include `customerId`, `items`, `total`, `status` and `createdAt`.
3. Insert three coupons where the middle one has a duplicate `_id`, using `ordered: false`. Which ones end up in the collection?

<details>
<summary>Show a possible answer</summary>

```javascript
use shop

// 1.
const r = db.products.insertOne({ name: "Lunch Box", category: "kitchen", price: 449, stock: 30, tags: ["steel", "school"] })
r.insertedId
// → ObjectId("...")

// 2.
const rahul = db.customers.findOne({ name: "Rahul Sharma" })
const mug = db.products.findOne({ name: "Coffee Mug" })
const phones = db.products.findOne({ name: "Headphones" })

db.orders.insertMany([
  {
    customerId: rahul._id,
    items: [{ productId: mug._id, name: "Coffee Mug", qty: 1, price: 249 }],
    total: 249,
    status: "shipped",
    createdAt: new Date()
  },
  {
    customerId: rahul._id,
    items: [{ productId: phones._id, name: "Headphones", qty: 1, price: 1999 }],
    total: 1999,
    status: "delivered",
    createdAt: new Date()
  }
])
// → { acknowledged: true, insertedIds: { "0": ObjectId("..."), "1": ObjectId("...") } }

// 3.
db.coupons.insertMany(
  [
    { _id: "SUMMER5", percentOff: 5 },
    { _id: "DIWALI25", percentOff: 25 },   // already exists
    { _id: "WINTER12", percentOff: 12 }
  ],
  { ordered: false }
)
// → an E11000 error is reported for DIWALI25,
//   but SUMMER5 and WINTER12 are both inserted.
```

</details>

## Key takeaways

- Use **`insertOne(doc)`** for one document and **`insertMany([docs])`** for several. The collection and database are created if needed.
- The result tells you the new IDs: `insertedId` (one) or `insertedIds` (many).
- Documents can hold arrays, embedded documents, dates and references to other documents' `_id`.
- `insertMany` is **ordered** by default: it stops at the first error but keeps the documents already inserted. Use `{ ordered: false }` to try every document.
- Never use the deprecated `insert()`. Drivers like Node.js use the same `insertOne`/`insertMany` methods.

**Next lesson:** [Querying with find and Filters](/courses/mongodb/querying-with-find)
