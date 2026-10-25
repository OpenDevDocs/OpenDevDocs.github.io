---
title: "Expression Operators: hash, createObjectId and EJSON"
slug: expression-operators
metadescription: Learn the MongoDB 8.3 expression operators $hash, $hexHash, $createObjectId, $serializeEJSON and $deserializeEJSON, and how to do the same on older versions.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'aggregation', 'ejson', 'mongodb-8']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Conversion Operators: convert, toObject and toArray](/courses/mongodb/conversion-operators) and [ObjectId and the _id Field](/courses/mongodb/objectid-and-id-field). It uses the `shop` data from [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals).

> **Version check:** every operator in this lesson was **added in MongoDB 8.3**, so you need 8.3 or later. Run `db.version()` to check. Each section ends with a way to do the same job on older versions.

## What you will learn

By the end of this lesson you will know:

- What a **hash** is, and how to make one with **`$hash`** and **`$hexHash`**
- How to create brand-new ObjectIds inside a pipeline or update with **`$createObjectId`**
- What **Extended JSON (EJSON)** is and why plain JSON loses information
- How to turn documents into EJSON with **`$serializeEJSON`**, and back with **`$deserializeEJSON`**
- What to use instead on MongoDB 8.0 and earlier

## Part 1: hashing with $hash and $hexHash

### What is a hash?

A **hash** is a short "fingerprint" made from some data. The same input always gives the same fingerprint, but you can't easily turn the fingerprint back into the input.

> **Think of it like this:** A hash is like a fingerprint of a person. Two fingerprints match only if they came from the same finger, so you can check "is this the same person?" without knowing their name. And you can't rebuild the whole person from the fingerprint.

People use hashes to:

- **Hide** values while still being able to compare them (for example, an email in an analytics export)
- **Detect changes**: if the fingerprint changed, the data changed
- **Check files and messages** for corruption

### The two operators

Both take the same two fields:

```javascript
{ $hexHash: { input: <string or binData>, algorithm: "md5" | "sha256" | "xxh64" } }
{ $hash:    { input: <string or binData>, algorithm: "md5" | "sha256" | "xxh64" } }
```

| Operator | Returns | Looks like |
| --- | --- | --- |
| `$hexHash` | An **uppercase hexadecimal string** | `"EA4E36A8...AB68"` |
| `$hash` | **Binary data** (`BinData`) | `Binary.createFromBase64("6k42...", 0)` |

Use `$hexHash` when people or other systems will read the value. Use `$hash` when you want to store it compactly as binary.

### Example: an anonymised export

The marketing team wants to see which customers ordered, but shouldn't see email addresses. Replace each email with its SHA-256 fingerprint:

```javascript
db.customers.aggregate([
  { $match: { city: { $in: ["Kolkata", "Mumbai"] } } },
  { $project: {
      _id: 0,
      city: 1,
      emailHash: { $hexHash: { input: "$email", algorithm: "sha256" } }
  } }
])
// → [
//   { city: "Kolkata", emailHash: "EA4E36A829983D27E865B649CD10FCB61F2F1BCD857B47AB709E7ADBE941AB68" },  // Asha
//   { city: "Mumbai",  emailHash: "4806156A20C29B26BE555E0BC9ED4536699760CCA00F961182648F30B1A90815" },  // Rahul
//   { city: "Kolkata", emailHash: "..." }                                                                  // Priya
// ]
```

The same email always gives the same hash, so the team can still count *unique* customers and join reports together, without seeing the real addresses.

The same value with `$hash` comes back as binary:

```javascript
db.customers.aggregate([
  { $match: { name: "Asha Roy" } },
  { $project: { _id: 0, emailHash: { $hash: { input: "$email", algorithm: "sha256" } } } }
])
// → [ { emailHash: Binary.createFromBase64("6k42qCmYPSfoZbZJzRD8th8vG82Fe0ercJ562+lBq2g=", 0) } ]
```

### Choosing an algorithm

| Algorithm | Output (hex characters) | Use it for |
| --- | --- | --- |
| `"sha256"` | 64 | Anything sensitive. The safe default. |
| `"xxh64"` | 16 | Very fast fingerprints for change detection. **Not** for security. |
| `"md5"` | 32 | Matching old systems that already use MD5. **Not secure**, and disabled on servers running in FIPS mode. |

> **Warning:** A plain hash of an email is not real anonymity. Someone with a list of emails can hash them all and compare. For stronger protection, add a secret value (a *salt*) before hashing, for example `{ $concat: ["$email", "my-secret-salt"] }`, and keep the salt out of the export.

### Example: detecting changes

Hash only accepts strings or binary data. To fingerprint several fields, turn them into one string first. In 8.3, `$toString` can turn a document into JSON text:

```javascript
db.products.aggregate([
  { $project: {
      name: 1,
      fingerprint: {
        $hexHash: {
          input: { $toString: { name: "$name", price: "$price", stock: "$stock" } },
          algorithm: "xxh64"
        }
      }
  } }
])
// → each product gets a 16-character hex fingerprint, e.g. { _id: ..., name: "Notebook", fingerprint: "..." }
```

Store the fingerprint. Next time, compute it again: if it's different, the name, price or stock changed. This is handy when syncing data to another system.

> **Note:** Field **order** matters. `{ name, price }` and `{ price, name }` produce different strings, so different hashes. Always build the input in the same order.

If `input` is `null` or missing, both operators return `null`. If it's another type (like a number), you get an error, so wrap numbers in `$toString` first.

### Before MongoDB 8.3

- **Hash in your app.** In Node.js, the built-in `crypto` module does it:

  ```javascript
  import { createHash } from "node:crypto";

  const emailHash = createHash("sha256").update("asha@example.com").digest("hex").toUpperCase();
  // → "EA4E36A829983D27E865B649CD10FCB61F2F1BCD857B47AB709E7ADBE941AB68"
  ```

- **`$toHashedIndexKey`** has been around for longer (it's documented back to 7.0). It returns a `Long` number using the same hash function as hashed indexes. It's fine for spreading or bucketing data, but it is **not** a cryptographic hash like SHA-256.

  ```javascript
  db.customers.aggregate([ { $project: { key: { $toHashedIndexKey: "$email" } } } ])
  // → each customer gets a Long value, e.g. key: Long("...")
  ```

## Part 2: new ObjectIds with $createObjectId

### Why you need it

Sometimes you need **new unique ids** in the middle of an update or pipeline: a tracking number for each shipped order, or an `_id` for documents in a view that doesn't have one.

`$createObjectId` takes an **empty object** and returns a fresh `ObjectId`:

```javascript
{ $createObjectId: {} }
```

Anything other than `{}` as the argument is an error.

### Example: a tracking id for each shipped order

```javascript
db.orders.updateMany(
  { status: "shipped", trackingId: { $exists: false } },
  [ { $set: { trackingId: { $createObjectId: {} } } } ]      // note the [ ]: an update pipeline
)
// → { acknowledged: true, matchedCount: 2, modifiedCount: 2, ... }

db.orders.find({ status: "shipped" }, { trackingId: 1 })
// → [
//   { _id: 2, trackingId: ObjectId("...") },
//   { _id: 6, trackingId: ObjectId("...") }   // a different value from order 2
// ]
```

Each document gets its own new id.

### The trap it avoids

You might think this does the same thing:

```javascript
// Looks similar, but is NOT the same!
db.orders.updateMany({ status: "shipped" }, { $set: { trackingId: ObjectId() } })
```

Here `ObjectId()` runs **once, in mongosh**, before the command is sent. The server receives one fixed value and writes that **same** id into every matching order. `$createObjectId` runs **on the server, for each document**, so each one gets a fresh id.

> **Think of it like this:** `ObjectId()` in the shell is printing one ticket and photocopying it for everyone. `$createObjectId` is a ticket machine on the conveyor belt that prints a new ticket for each document.

### Example: ids for a view

Views built with `$unwind` or `$project` sometimes have repeated or missing `_id` values. Some stages, like `$graphLookup`, rely on `_id` to tell documents apart. `$createObjectId` can give each one a unique id:

```javascript
db.createView("orderLines", "orders", [
  { $unwind: "$items" },
  { $project: { _id: { $createObjectId: {} }, orderId: "$_id", name: "$items.name", qty: "$items.qty" } }
])

db.orderLines.find().limit(2)
// → [
//   { _id: ObjectId("..."), orderId: 1, name: "Notebook", qty: 2 },
//   { _id: ObjectId("..."), orderId: 1, name: "Gel Pen",  qty: 4 }
// ]
```

> **Note:** A view runs its pipeline every time you read it, so these `_id` values are generated fresh on each read. Don't save them and expect to find the same ids later.

Don't confuse it with `$toObjectId`, which **converts** an existing 24-character hex string into an ObjectId. `$createObjectId` **makes a new one**.

### Before MongoDB 8.3

Create the ids in your app (or in mongosh) and write them one document at a time:

```javascript
// mongosh: a new ObjectId per document
db.orders.find({ status: "shipped", trackingId: { $exists: false } }).forEach(order => {
  db.orders.updateOne({ _id: order._id }, { $set: { trackingId: new ObjectId() } })
})
```

For many documents, send these updates together with a bulk write (see [Bulk Writes and the Bulk API](/courses/mongodb/bulk-writes)).

## Part 3: Extended JSON with $serializeEJSON and $deserializeEJSON

### The problem with plain JSON

JSON only knows strings, numbers, booleans, `null`, objects and arrays. BSON knows much more: dates, ObjectIds, 32-bit vs 64-bit integers, decimals, binary data. If you turn a document into plain JSON, that type information is **lost**: a date becomes just a string, and nobody can tell it was a date.

**Extended JSON** (EJSON) fixes this with special **wrapper** objects that start with `$`:

```javascript
{ "$oid": "66a000000000000000000001" }               // an ObjectId
{ "$date": "2025-01-15T00:00:00.000Z" }              // a date
{ "$numberInt": "42" }                               // a 32-bit integer
```

There are two styles:

| BSON type | **Canonical** EJSON (keeps every type) | **Relaxed** EJSON (easier to read) |
| --- | --- | --- |
| Int32 | `{ "$numberInt": "42" }` | `42` |
| Int64 | `{ "$numberLong": "42" }` | `42` |
| Double | `{ "$numberDouble": "42.5" }` | `42.5` |
| ObjectId | `{ "$oid": "..." }` | same |
| Date | `{ "$date": { "$numberLong": "1736899200000" } }` | `{ "$date": "2025-01-15T00:00:00.000Z" }` |

Tools like `mongoexport` and `mongoimport` already use EJSON. Since 8.3, you can produce and read it inside a pipeline too.

### $serializeEJSON: document → EJSON

```javascript
{ $serializeEJSON: { input: <expression>, relaxed: <boolean>, onError: <expression> } }
```

`relaxed` defaults to `false` (canonical). Let's serialise Asha's customer document in relaxed form:

```javascript
db.customers.aggregate([
  { $match: { name: "Asha Roy" } },
  { $project: { _id: 0, ejson: { $serializeEJSON: { input: "$$ROOT", relaxed: true } } } }
])
// → [
//   {
//     ejson: {
//       _id: { $oid: "66a000000000000000000001" },
//       name: "Asha Roy",
//       email: "asha@example.com",
//       city: "Kolkata",
//       joinedAt: { $date: "2025-01-15T00:00:00.000Z" },
//       isMember: true
//     }
//   }
// ]
```

Before: `joinedAt: ISODate("2025-01-15T00:00:00.000Z")` (a real date).
After: `joinedAt: { $date: "2025-01-15T00:00:00.000Z" }` (a plain document that *describes* a date).

Leave out `relaxed: true` and you get the canonical form, for example `joinedAt: { $date: { $numberLong: "1736899200000" } }`.

The result is still a **document**, not text. To get a JSON **string** (for example, to send to another service), wrap it in `$toString`:

```javascript
db.customers.aggregate([
  { $match: { name: "Asha Roy" } },
  { $project: {
      _id: 0,
      json: { $toString: { $serializeEJSON: { input: { name: "$name", joinedAt: "$joinedAt" }, relaxed: true } } }
  } }
])
// → [ { json: '{"name":"Asha Roy","joinedAt":{"$date":"2025-01-15T00:00:00.000Z"}}' } ]
```

### $deserializeEJSON: EJSON → real BSON types

```javascript
{ $deserializeEJSON: { input: <expression>, onError: <expression> } }
```

Imagine a supplier sends restock events as JSON text, using EJSON wrappers for the types:

```javascript
db.aggregate([
  { $documents: [
      { raw: '{"sku": "MUG-03", "qty": {"$numberInt": "40"}, "restockedAt": {"$date": "2026-10-01T00:00:00.000Z"}}' }
  ] },
  { $project: {
      _id: 0,
      step1: { $toObject: "$raw" },                                          // text → document
      step2: { $deserializeEJSON: { input: { $toObject: "$raw" } } }         // wrappers → real types
  } }
])
// → [
//   {
//     step1: { sku: "MUG-03", qty: { "$numberInt": "40" }, restockedAt: { "$date": "2026-10-01T00:00:00.000Z" } },
//     step2: { sku: "MUG-03", qty: 40, restockedAt: ISODate("2026-10-01T00:00:00.000Z") }
//   }
// ]
```

Watch the conveyor belt:

1. **`$toObject`** parses the text into a document, but the wrappers are still plain sub-documents (`step1`).
2. **`$deserializeEJSON`** turns the wrappers into a real integer and a real date (`step2`). Now you can sort by `restockedAt` or do maths with `qty`.

If the input might be broken, add `onError`, for example `onError: null`, so one bad event doesn't stop the whole pipeline. A `null` or missing input simply returns `null`.

### Before MongoDB 8.3

Use the `EJSON` helper that comes with mongosh and the Node.js driver:

```javascript
// mongosh: document → EJSON text, and back
EJSON.stringify(db.customers.findOne({ name: "Asha Roy" }), { relaxed: false })
EJSON.parse('{"restockedAt": {"$date": "2026-10-01T00:00:00.000Z"}}')
// → { restockedAt: ISODate("2026-10-01T00:00:00.000Z") }
```

```javascript
// Node.js (driver 7.x; also works on 6.x)
import { EJSON } from "mongodb";

const text = EJSON.stringify(customer, { relaxed: true });
const doc = EJSON.parse(text);   // dates and ObjectIds come back as real types
```

For whole collections, `mongoexport` and `mongoimport` read and write EJSON for you (see [Import, Export and Data Migration Tools](/courses/mongodb/import-export-and-tools)).

## Cheat sheet

| Operator | What it does | Added in | Before 8.3 |
| --- | --- | --- | --- |
| `$hexHash` | Hash a string/binary into an uppercase hex string | 8.3 | Hash in app code (`crypto`) |
| `$hash` | Hash a string/binary into `BinData` | 8.3 | Hash in app code |
| `$createObjectId` | A new `ObjectId` for each evaluation | 8.3 | `new ObjectId()` per document in app code |
| `$serializeEJSON` | BSON → EJSON document (canonical or relaxed) | 8.3 | `EJSON.stringify` in mongosh/driver |
| `$deserializeEJSON` | EJSON document → real BSON types | 8.3 | `EJSON.parse` in mongosh/driver |

> **Note:** MongoDB 8.3 also added a `$subtype` expression that reads the subtype of a binary value. You'll rarely need it as a beginner.

## Common mistakes

- **Hashing a number directly.** `$hexHash` only accepts strings or binary data. Use `{ $toString: "$price" }` first.
- **Using MD5 for anything sensitive.** It's broken for security. Use `"sha256"`.
- **Thinking a hash is encryption.** You can't "decrypt" a hash. If you need the original value back, you need encryption instead (see [Client-Side Field Level Encryption](/courses/mongodb/client-side-field-level-encryption)).
- **Using `ObjectId()` in `updateMany` to make unique ids.** The shell creates one value and every document gets it. Use `$createObjectId: {}` in an update pipeline.
- **Expecting `$serializeEJSON` to return text.** It returns a document. Wrap it in `$toString` for a JSON string.

## Practice

1. Return each product's `name` with an `md5` hex hash of the name. How long is each hash?
2. Give every order a new `receiptId` with `$createObjectId` in an update pipeline. How many documents were modified?
3. Serialise each order's `createdAt` and `total` as **canonical** EJSON. What does `total` look like?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. MD5 of each product name → 32 hex characters each
db.products.aggregate([
  { $project: { _id: 0, name: 1, nameHash: { $hexHash: { input: "$name", algorithm: "md5" } } } }
])

// 2. A receipt id for every order
db.orders.updateMany({}, [ { $set: { receiptId: { $createObjectId: {} } } } ])
// → modifiedCount: 6

// 3. Canonical EJSON
db.orders.aggregate([
  { $project: { ejson: { $serializeEJSON: { input: { createdAt: "$createdAt", total: "$total" } } } } }
])
// Order 1 → ejson: { createdAt: { $date: { $numberLong: "1768003200000" } }, total: { $numberInt: "158" } }
```

</details>

## Key takeaways

- **`$hexHash`** and **`$hash`** (8.3+) create fingerprints with `"sha256"`, `"xxh64"` or `"md5"`; `$hexHash` returns text, `$hash` returns binary.
- A hash can't be reversed, and plain hashes of guessable values like emails need a secret salt for real privacy.
- **`$createObjectId: {}`** (8.3+) makes a fresh ObjectId on the server for each document, unlike `ObjectId()` in the shell.
- **EJSON** keeps BSON types in JSON with wrappers like `$oid` and `$date`; **`$serializeEJSON`** and **`$deserializeEJSON`** (8.3+) convert inside pipelines.
- On older versions, do the same work in your app: `crypto` for hashes, `new ObjectId()` for ids, and `EJSON.stringify`/`EJSON.parse` for Extended JSON.

**Next lesson:** [Bulk Writes and the Bulk API](/courses/mongodb/bulk-writes)
