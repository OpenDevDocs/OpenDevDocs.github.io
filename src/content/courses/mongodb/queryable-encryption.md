---
title: Queryable Encryption
slug: queryable-encryption
metadescription: Learn how MongoDB Queryable Encryption keeps fields encrypted on the server while still allowing equality and range queries, with Node.js examples.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'security', 'encryption', 'queryable-encryption']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Client-Side Field Level Encryption](/courses/mongodb/client-side-field-level-encryption).

## What you will learn

By the end of this lesson you will know:

- What problem **Queryable Encryption (QE)** solves that CSFLE can't
- How QE stays secure while still letting the server find matching documents
- How to define **encrypted fields** with **equality** and **range** query types
- How to create an encrypted collection, insert data and query it from Node.js
- What runs where (Community vs Enterprise vs Atlas), and the main limitations

> **Note:** Queryable Encryption needs a **replica set** or sharded cluster (a single-node replica set is fine for learning). **Automatic** QE, which this lesson uses, needs **MongoDB Enterprise or Atlas** (a dedicated cluster or a local Enterprise server). MongoDB Community supports **explicit** QE, where you call the encryption functions yourself.

## The problem with CSFLE queries

In the last lesson you learned two CSFLE choices:

- **Deterministic** encryption: you can search by exact value, but the same value always gives the same ciphertext. Someone watching the stored data can spot duplicates and patterns.
- **Random** encryption: very secure, but you can't search at all.

What if you want **both**: strong, randomized encryption **and** the ability to search, even with ranges like "born between 1990 and 2000"? That's what **Queryable Encryption** is for.

> **Think of it like this:** CSFLE deterministic is like writing names in a secret code where "Asha" is always "Xkqz". You can find "Xkqz" in a list, but anyone can see it appears five times. Queryable Encryption is like a clever sealed-envelope system where every envelope looks different, yet a sorting machine can still tell you which envelopes match your request, without opening any of them.

## How it works (the short version)

With QE:

1. Your app's driver encrypts the field with **randomized** encryption, so equal values look different on disk.
2. The driver also creates special **encrypted tokens** that the server stores in hidden metadata.
3. When you query, the driver turns your search value into an encrypted **query token**.
4. The server uses the tokens to find matches **without ever decrypting** the data.
5. The matching documents come back still encrypted, and the driver decrypts them in your app.

The server never sees the plain value, not in the data, not in the query, and not in memory.

## Query types

When you set up an encrypted field, you choose what kind of queries it supports:

| `queryType` | Lets you use | Field types | Status |
| --- | --- | --- | --- |
| *(none)* | No queries, just encrypted storage | Any | GA |
| `equality` | `$eq`, `$ne`, `$in`, `$nin` and friends | Most types, such as string, int, date, objectId (not double, decimal, object or array) | GA since 7.0 |
| `range` | Equality plus `$gt`, `$gte`, `$lt`, `$lte` | int, long, double, decimal, date | **GA since 8.0** |
| `prefix`, `suffix`, `substring` | "starts with", "ends with", "contains" on strings | string | Public preview in 8.2; GA in 9.0 |

This lesson focuses on **equality** and **range**, which are generally available across 8.x.

> **Note:** Range queries were a preview (`rangePreview`) in 7.x. If you see old examples using `rangePreview`, they won't work on 8.0+. Use `range`.

## Our example

The shop wants to store customers' **tax ID** and **birth year** encrypted:

- Support staff look up a customer by exact **tax ID** (equality).
- Marketing needs "customers born between 1990 and 1999" (range).
- Private **notes** are encrypted and never queried.

## Step 1: describe the encrypted fields

In QE, the list of encrypted fields lives on the **collection itself**, as `encryptedFields`. It's set when you create the collection:

```javascript
const encryptedFields = {
  fields: [
    {
      path: "taxId",
      bsonType: "string",
      keyId: null,                     // null: create a new data key automatically
      queries: { queryType: "equality" }
    },
    {
      path: "birthYear",
      bsonType: "int",
      keyId: null,
      queries: { queryType: "range", min: 1900, max: 2100 }
    },
    {
      path: "notes",
      bsonType: "string",
      keyId: null                      // encrypted, not queryable
    }
  ]
};
```

For `range` fields, `min` and `max` set the allowed values. They're optional for whole-number types but strongly recommended: a smaller range means smaller, faster encrypted indexes. Values outside the range are rejected.

> **Tip:** Each field can be **either** equality **or** range, not both. A range field already supports equality matches, so pick `range` if you need both.

## Step 2: set up the client

The setup is like CSFLE: a key vault, a KMS provider, and the **Automatic Encryption Shared Library** (`crypt_shared`), downloaded from MongoDB.

```bash
npm install mongodb mongodb-client-encryption
```

```javascript
const { MongoClient, ClientEncryption } = require("mongodb");
const fs = require("fs");

const uri = "mongodb://localhost:27017/?replicaSet=rs0";
const keyVaultNamespace = "encryption.__keyVault";
const kmsProviders = { local: { key: fs.readFileSync("master-key.txt") } }; // dev only

const encryptedClient = new MongoClient(uri, {
  autoEncryption: {
    keyVaultNamespace,
    kmsProviders,
    extraOptions: { cryptSharedLibPath: "/opt/mongodb/lib/mongo_crypt_v1.so" }
  }
});
await encryptedClient.connect();
```

(Run these snippets inside an `async` function. Create `master-key.txt` as in the previous lesson.)

## Step 3: create the encrypted collection

`createEncryptedCollection` creates any missing data keys and the collection in one step:

```javascript
const encryption = new ClientEncryption(encryptedClient, { keyVaultNamespace, kmsProviders });

await encryption.createEncryptedCollection(
  encryptedClient.db("shop"),
  "secureCustomers",
  {
    provider: "local",
    createCollectionOptions: { encryptedFields }
  }
);
```

Behind the scenes, MongoDB also creates two hidden metadata collections:

```text
shop
├── secureCustomers                    (your data)
├── enxcol_.secureCustomers.esc        (encrypted state metadata)
└── enxcol_.secureCustomers.ecoc       (compaction metadata)
```

Don't edit or drop these. They hold the encrypted tokens that make searching possible.

## Step 4: insert data like normal

With automatic encryption, your code uses **plain values**. The driver encrypts the listed fields for you:

```javascript
const customers = encryptedClient.db("shop").collection("secureCustomers");

await customers.insertMany([
  { name: "Asha Roy",    city: "Kolkata", taxId: "ABCPR1234K", birthYear: 1996, notes: "Prefers email" },
  { name: "Rahul Sen",   city: "Pune",    taxId: "BXQPS5678L", birthYear: 1988, notes: "VIP since 2020" },
  { name: "Priya Nair",  city: "Kochi",   taxId: "CMNPN9012M", birthYear: 1993, notes: "" }
]);
```

Now look at the same collection with a **normal** mongosh connection (no keys):

```javascript
db.getSiblingDB("shop").secureCustomers.findOne({ name: "Asha Roy" })
// → {
//     _id: ObjectId('...'),
//     name: 'Asha Roy',
//     city: 'Kolkata',
//     taxId: Binary.createFromBase64('DkIy3w...', 6),
//     birthYear: Binary.createFromBase64('DkKp9a...', 6),
//     notes: Binary.createFromBase64('EJ7Qm1...', 6),
//     __safeContent__: [ Binary.createFromBase64('...', 0), ... ]
//   }
```

The encrypted fields are unreadable. The extra `__safeContent__` array holds tags used for searching. Leave it alone.

## Step 5: query encrypted fields

### Equality

```javascript
const asha = await customers.findOne({ taxId: "ABCPR1234K" });
console.log(asha);
// → { name: 'Asha Roy', city: 'Kolkata', taxId: 'ABCPR1234K', birthYear: 1996, notes: 'Prefers email', ... }
```

You wrote a plain query. The driver turned `"ABCPR1234K"` into an encrypted token, the server found the match, and the driver decrypted the result.

### Range

```javascript
const nineties = await customers
  .find({ birthYear: { $gte: 1990, $lte: 1999 } })
  .project({ _id: 0, name: 1, birthYear: 1 })
  .toArray();

console.log(nineties);
// → [ { name: 'Asha Roy', birthYear: 1996 }, { name: 'Priya Nair', birthYear: 1993 } ]
```

Range works in aggregations too, inside `$match`:

```javascript
await customers.aggregate([
  { $match: { birthYear: { $lt: 1990 } } },
  { $project: { _id: 0, name: 1 } }
]).toArray();
// → [ { name: 'Rahul Sen' } ]
```

### What doesn't work

```javascript
// notes has no queryType, so it can't be queried
await customers.findOne({ notes: "Prefers email" });
// → error (the field was encrypted without a query type)

// Sorting by an encrypted field isn't supported
await customers.find().sort({ birthYear: 1 }).toArray();
// → error
```

Unencrypted fields like `name` and `city` work exactly as normal, with normal indexes.

## Explicit QE on Community

On MongoDB Community you can't use automatic encryption, but you can call the encryption yourself. For an equality field, you encrypt values with the `"Indexed"` algorithm:

```javascript
const encryptedTaxId = await encryption.encrypt("ABCPR1234K", {
  keyId: taxIdKeyId,             // the data key used for this field
  algorithm: "Indexed",
  contentionFactor: 8,
  queryType: "equality"
});
```

You use the same kind of call to build query values. It's more code, so most teams use automatic QE on Enterprise or Atlas, and explicit QE only when they're on Community.

## CSFLE or Queryable Encryption?

| | CSFLE | Queryable Encryption |
| --- | --- | --- |
| Encryption on disk | Deterministic or random | Always randomized |
| Equality queries | Only on deterministic fields | Yes |
| Range queries | No | Yes (GA in 8.0) |
| Leaks duplicate values? | Deterministic does | No |
| Where field rules live | Client schema map (and optional server validator) | `encryptedFields` on the collection |
| Needs replica set | No | Yes |
| Storage overhead | Low | Higher (metadata collections and tokens) |

**Rule of thumb:** for new projects that need to **search** sensitive fields, prefer Queryable Encryption. Use CSFLE when you only need to read encrypted fields back, or on setups QE doesn't support.

## Limitations to know

- **You can't change `encryptedFields` later** by simply editing them. Plan the fields and query types up front, or migrate to a new collection.
- **Extra storage and slower writes.** Queryable fields, especially range fields, write extra metadata. Keep the `min`/`max` range tight.
- **Some operations aren't supported** on QE collections, including `moveCollection`, `reshardCollection` and `unshardCollection`.
- **Housekeeping:** the metadata collections grow over time. The `compactStructuredEncryptionData` command compacts them (Atlas and drivers can help schedule this).
- **No sorting or computing** on encrypted values on the server (`$sort`, `$sum` and so on).
- Lose the master key, and the data is gone, just as with CSFLE.

## Common mistakes

- **Running on a standalone server.** QE requires a replica set or sharded cluster. Start a single-node replica set for local testing.
- **Using old `rangePreview` examples.** On 8.0+, use `queryType: "range"`.
- **Forgetting `min` and `max` on range fields.** Huge ranges make bigger metadata and slower writes. Set realistic bounds.
- **Querying a field with no `queryType`.** It's encrypted but not searchable. Add a query type when you create the collection.
- **Writing with a client that has no encryption settings.** Plain values sent to an encrypted field are rejected, which protects you, but it's confusing. Always use the encrypted client for that collection.

## Practice

1. Write an `encryptedFields` definition for a `payments` collection: `cardLast4` (string, equality), `amount` (int, range from 0 to 1000000) and `billingAddress` (string, not queryable).
2. Write a query on that collection for payments with `amount` between 500 and 5000.
3. Which would you choose, CSFLE or QE, for a `bloodGroup` field that doctors filter by? Why?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Encrypted fields
const encryptedFields = {
  fields: [
    { path: "cardLast4", bsonType: "string", keyId: null, queries: { queryType: "equality" } },
    { path: "amount", bsonType: "int", keyId: null, queries: { queryType: "range", min: 0, max: 1000000 } },
    { path: "billingAddress", bsonType: "string", keyId: null }
  ]
};

// 2. Range query (with an auto-encryption client)
await payments.find({ amount: { $gte: 500, $lte: 5000 } }).toArray();

// 3. Queryable Encryption. bloodGroup has only a few values, so CSFLE
//    deterministic encryption would reveal patterns, and random CSFLE
//    can't be queried. QE gives randomized storage AND equality queries.
```

</details>

## Key takeaways

- **Queryable Encryption** stores fields with randomized encryption yet still lets the server find matches, without decrypting anything.
- Choose a `queryType` per field: `equality`, `range` (GA in 8.0), or none. Prefix, suffix and substring arrived as a preview in 8.2.
- Encrypted fields are defined in the collection's `encryptedFields`, created with `createEncryptedCollection`.
- With automatic QE (Enterprise or Atlas), you write plain queries and the driver handles encryption and decryption.
- QE needs a replica set, uses more storage, and has limits: plan fields up front, no sorting on encrypted fields, and protect the master key.

**Next lesson:** [Node.js Driver and Connection Pooling](/courses/mongodb/nodejs-driver-and-connection-pooling)
