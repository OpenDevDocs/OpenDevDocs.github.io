---
title: Migrations and Schema Evolution
slug: migrations-and-schema-evolution
metadescription: Learn how to change the shape of MongoDB documents safely using the schema versioning pattern, backfills with updateMany and bulkWrite, and migrate-mongo.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 4
tags: ['mongodb', 'migrations', 'schema-design', 'nodejs']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- Why documents change shape over time, and why that is normal in MongoDB
- The **schema versioning pattern** and how app code can read old and new documents
- How to **backfill** old documents with `updateMany` and with batched `bulkWrite`
- How to run repeatable, tracked migrations with **migrate-mongo**
- The safe **expand and contract** order for deploying a change with zero downtime

> **Before you start:** this lesson assumes you've read [Mongoose ODM: Schemas, Models and Middleware](/courses/mongodb/mongoose-odm), [Bulk Writes and the Bulk API](/courses/mongodb/bulk-writes) and [Schema Validation with JSON Schema](/courses/mongodb/schema-validation). You can try everything on a local MongoDB.

## Why schemas evolve

No app keeps the same data shape forever. Your shop starts with a simple `city` field on customers. A year later you ship to other countries, and you need `address.city` and `address.country`.

In a SQL database you would run `ALTER TABLE`, and the whole table changes in one go. MongoDB has a **flexible schema**, so old and new shapes can live side by side in the same collection. That is a superpower and a responsibility: your app must cope with both until the old shape is gone.

A **migration** is a planned, repeatable change to your data (or indexes, or validation rules) that moves it from one shape to the next.

> **Think of it like this:** Changing a schema is like renovating a shop while it stays open. You can't close for a week and rebuild everything. You put up a new shelf, move products over a few at a time, and only remove the old shelf once it is empty.

## Our example change

Today, customer documents look like this (version 1):

```javascript
use shop

db.customers.insertMany([
  { name: "Asha Roy", email: "asha@example.com", city: "Kolkata", isMember: true, joinedAt: ISODate("2025-03-10") },
  { name: "Rahul Sen", email: "rahul@example.com", city: "Pune", isMember: false, joinedAt: ISODate("2025-07-21") },
  { name: "Maria Lopez", email: "maria@example.com", city: "Madrid", isMember: true, joinedAt: ISODate("2026-01-05") }
])
```

We want version 2:

```javascript
{
  name: "Asha Roy",
  email: "asha@example.com",
  address: { city: "Kolkata", country: "IN" },
  isMember: true,
  joinedAt: ISODate("2025-03-10"),
  schemaVersion: 2
}
```

## The schema versioning pattern

The **schema versioning pattern** is simple: every document carries a field that says which shape it has.

```javascript
{ ..., schemaVersion: 2 }
```

Documents with no `schemaVersion` are treated as version 1. Now your code can check the version and handle each shape correctly.

Here is a small Node.js helper that always returns the **new** shape, whatever is stored:

```javascript
// customers.js
export function normaliseCustomer(doc) {
  if ((doc.schemaVersion ?? 1) === 1) {
    return {
      ...doc,
      address: { city: doc.city, country: null }, // country unknown for old docs
      schemaVersion: 2
    };
  }
  return doc; // already version 2
}
```

Every read goes through this helper, so the rest of the app only ever sees version 2.

### Three ways to move old documents

| Strategy | How it works | Good for |
| --- | --- | --- |
| **Lazy (on write)** | When the app saves a v1 document, it writes it back as v2. | Huge collections, no rush to finish |
| **Backfill (batch)** | A script updates all v1 documents in the background. | Most changes; you want it finished |
| **Big bang** | Stop the app, update everything, start the new app. | Tiny datasets, or when downtime is allowed |

Most teams combine the first two. The app handles both shapes, and a background script converts everything so the old code path can be deleted later.

## Backfilling with updateMany

For small and medium collections, one `updateMany` with an **aggregation pipeline update** does the job. The square brackets `[ ... ]` mean the update is a pipeline, so it can read other fields of the same document using `$fieldName`.

```javascript
db.customers.updateMany(
  { schemaVersion: { $exists: false } },        // only v1 documents
  [
    {
      $set: {
        address: { city: "$city", country: null },
        schemaVersion: 2
      }
    },
    { $unset: "city" }
  ]
)
// → { acknowledged: true, matchedCount: 3, modifiedCount: 3, ... }
```

Check the result:

```javascript
db.customers.findOne({ name: "Asha Roy" })
// → { _id: ObjectId("..."), name: "Asha Roy", email: "asha@example.com",
//     isMember: true, joinedAt: ISODate("2025-03-10T00:00:00.000Z"),
//     address: { city: "Kolkata", country: null }, schemaVersion: 2 }
```

Notice the filter `{ schemaVersion: { $exists: false } }`. It makes the update **idempotent**: running it twice does nothing the second time, because no v1 documents are left. Always design migrations so they are safe to run again.

## Backfilling big collections in batches

One giant `updateMany` over millions of documents can run for a long time, fill the oplog, add replication lag and slow down live traffic. For big collections, work in **small batches** and pause between them.

Here is a Node.js script that converts 1,000 customers at a time using `bulkWrite`:

```javascript
// scripts/backfill-address.js
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017");
const customers = client.db("shop").collection("customers");

const BATCH_SIZE = 1000;
const countryByCity = { Kolkata: "IN", Pune: "IN", Madrid: "ES" };

let total = 0;

while (true) {
  // 1. Fetch a batch of v1 documents (only the fields we need)
  const batch = await customers
    .find({ schemaVersion: { $exists: false } }, { projection: { city: 1 } })
    .limit(BATCH_SIZE)
    .toArray();

  if (batch.length === 0) break;

  // 2. Build one update per document
  const ops = batch.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id, schemaVersion: { $exists: false } },
      update: {
        $set: {
          address: { city: doc.city, country: countryByCity[doc.city] ?? null },
          schemaVersion: 2
        },
        $unset: { city: "" }
      }
    }
  }));

  // 3. Send them in one round trip
  const result = await customers.bulkWrite(ops, { ordered: false });
  total += result.modifiedCount;
  console.log(`migrated ${total} customers so far`);

  // 4. Be gentle with the server
  await new Promise((r) => setTimeout(r, 200));
}

console.log("Backfill complete");
await client.close();
```

Sample output:

```text
migrated 1000 customers so far
migrated 2000 customers so far
migrated 2417 customers so far
Backfill complete
```

Why is this safe?

- **Small batches** keep each write short, so live requests are not blocked.
- **The pause** lets secondaries catch up, so replication lag stays low.
- **The filter repeats `schemaVersion: { $exists: false }`**, so if the app already upgraded a document lazily, we don't overwrite it.
- **It can restart.** If the script crashes, just run it again. It picks up the documents that are still v1.

> **Tip:** Watch replication lag while a backfill runs, with `rs.printSecondaryReplicationInfo()` in mongosh. If secondaries fall behind, make the batches smaller or the pause longer.

## Tracked migrations with migrate-mongo

Scripts in a `scripts/` folder work, but in a team you quickly ask: "Has this migration already run on staging? On production?" A **migration tool** answers that by recording each finished migration in a special collection.

**migrate-mongo** is a popular, small tool for this. Install it as a dev dependency:

```bash
npm install --save-dev migrate-mongo
npx migrate-mongo init
```

This creates a `migrations/` folder and a `migrate-mongo-config.js` file. Edit the config so it points at your database:

```javascript
// migrate-mongo-config.js
const config = {
  mongodb: {
    url: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017",
    databaseName: "shop",
    options: {}
  },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",  // where finished migrations are recorded
  lockCollectionName: "changelog_lock",  // stops two people migrating at once
  lockTtl: 0,
  migrationFileExtension: ".js",
  useFileHash: false,
  moduleSystem: "commonjs"
};

module.exports = config;
```

> **Note:** If your `package.json` has `"type": "module"`, run `npx migrate-mongo init -m esm` instead. The generated files then use `export` instead of `module.exports`.

### Create a migration

```bash
npx migrate-mongo create customer-address
# → Created: migrations/20261025080000-customer-address.js
```

Fill in the `up` (apply) and `down` (undo) functions:

```javascript
// migrations/20261025080000-customer-address.js
module.exports = {
  async up(db) {
    await db.collection("customers").updateMany(
      { schemaVersion: { $exists: false } },
      [
        { $set: { address: { city: "$city", country: null }, schemaVersion: 2 } },
        { $unset: "city" }
      ]
    );
    await db.collection("customers").createIndex({ "address.country": 1 });
  },

  async down(db) {
    await db.collection("customers").dropIndex({ "address.country": 1 });
    await db.collection("customers").updateMany(
      { schemaVersion: 2 },
      [
        { $set: { city: "$address.city" } },
        { $unset: ["address", "schemaVersion"] }
      ]
    );
  }
};
```

### Run it and check the status

```bash
npx migrate-mongo status
```

```text
┌──────────────────────────────────────┬────────────┐
│ Filename                             │ Applied At │
├──────────────────────────────────────┼────────────┤
│ 20261025080000-customer-address.js   │ PENDING    │
└──────────────────────────────────────┴────────────┘
```

```bash
npx migrate-mongo up
# → MIGRATED UP: 20261025080000-customer-address.js
```

Running `status` again now shows a timestamp instead of `PENDING`. Behind the scenes, migrate-mongo added a document to the `changelog` collection:

```javascript
db.changelog.find()
// → { _id: ObjectId("..."), fileName: "20261025080000-customer-address.js",
//     appliedAt: ISODate("2026-10-25T08:05:12.000Z"), ... }
```

Made a mistake? `npx migrate-mongo down` undoes the **last** applied migration.

> **Warning:** A `down` function can't bring back data you deleted. In our example `down` rebuilds `city` from `address.city`, so nothing is lost. If an `up` truly throws data away, take a backup first (see [Backups, Snapshots and Point-in-Time Restore](/courses/mongodb/backups-and-restore)).

## Migrating validation rules and indexes

Migrations are not only about documents. Indexes and validation rules change too, and they belong in migrations so every environment matches.

To update a collection's JSON Schema validator, use `collMod`:

```javascript
db.runCommand({
  collMod: "customers",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email"],
      properties: {
        address: {
          bsonType: "object",
          properties: { city: { bsonType: "string" }, country: { bsonType: ["string", "null"] } }
        }
      }
    }
  },
  validationLevel: "moderate" // don't block updates to old documents that don't match yet
})
// → { ok: 1 }
```

`validationLevel: "moderate"` is handy during a migration. New documents and documents that already pass the rules are checked, while old documents that don't match yet can still be updated. Switch back to `"strict"` once the backfill is done.

## Expand and contract: the safe order

Changing code and data at the same time is where things break. The **expand and contract** pattern spreads the change over several small, safe deploys:

1. **Expand.** Deploy code that **reads both** shapes and **writes the new** shape. Old and new documents now coexist safely.
2. **Migrate.** Run the backfill until no old documents remain.
3. **Verify.** `db.customers.countDocuments({ schemaVersion: { $exists: false } })` returns `0`.
4. **Contract.** Deploy code that drops support for the old shape. Remove old indexes and tighten validation.

```javascript
db.customers.countDocuments({ schemaVersion: { $exists: false } })
// → 0   (safe to contract)
```

At every step, the running app understands every document in the database. That is what makes zero-downtime migrations possible.

## Common mistakes

- **Changing code and data in one deploy.** For a few minutes, the new code meets old documents and crashes. Use expand and contract.
- **Migrations that aren't idempotent.** A script that crashes halfway must be safe to run again. Always filter on the old shape (for example `schemaVersion: { $exists: false }`).
- **One giant `updateMany` on a huge collection.** It can cause replication lag and slow queries. Use batches with a pause.
- **Forgetting indexes and validators.** Put `createIndex`, `dropIndex` and `collMod` changes into migrations too, so dev, staging and production stay in sync.
- **No backup before a destructive change.** If a migration deletes or overwrites fields, back up first.

## Practice

1. Products are getting a new `price` shape: `{ amount: 49, currency: "INR" }` instead of a plain number. Write an `updateMany` that converts every product where `price` is still a number, and sets `schemaVersion: 2`.
2. Write the `down` function for that migration.
3. Write a query that counts how many products still use the old shape.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. up
db.products.updateMany(
  { price: { $type: "number" } },
  [
    { $set: { price: { amount: "$price", currency: "INR" }, schemaVersion: 2 } }
  ]
)

// 2. down
db.products.updateMany(
  { schemaVersion: 2 },
  [
    { $set: { price: "$price.amount" } },
    { $unset: "schemaVersion" }
  ]
)

// 3. how many are still old?
db.products.countDocuments({ price: { $type: "number" } })
// → 0 after the migration
```

</details>

## Key takeaways

- In MongoDB, old and new document shapes can live together, so your app must handle both during a change.
- The **schema versioning pattern** adds a `schemaVersion` field so code knows which shape it is reading.
- Backfill with `updateMany` (pipeline updates) for small data, and batched `bulkWrite` with pauses for big data. Make every migration **idempotent**.
- Tools like **migrate-mongo** record applied migrations in a `changelog` collection and give you `up`, `down` and `status`.
- Deploy with **expand and contract**: read both, migrate, verify, then remove the old path.

**Next lesson:** [Aggregation Performance with merge and out](/courses/mongodb/aggregation-performance)
