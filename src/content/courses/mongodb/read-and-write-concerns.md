---
title: Read and Write Concerns
slug: read-and-write-concerns
metadescription: Understand MongoDB write concern (w, j, wtimeout) and read concern levels like local and majority, so you can choose between speed and safety with confidence.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'write-concern', 'read-concern', 'replica-set']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Transactions and ACID Guarantees](/courses/mongodb/transactions). You can try every command on a local single-node replica set or on Atlas.

## What you will learn

By the end of this lesson you will know:

- Why "the write succeeded" can mean different things on a replica set
- How **write concern** (`w`, `j`, `wtimeout`) controls when MongoDB says "done"
- How **read concern** (`local`, `majority`, `snapshot` and others) controls which data you can see
- How to set both per operation, per connection and for the whole cluster
- How sessions give you **read-your-own-writes** behaviour

## A quick picture of a replica set

In production, MongoDB usually runs as a **replica set**: a group of servers that hold copies of the same data. (You'll study it closely in *Replica Sets and Elections*.)

- One server is the **primary**. All writes go to it.
- The others are **secondaries**. They copy the primary's writes a moment later.

```text
            write
   app ───────────────▶ PRIMARY
                          │  copies writes
                ┌─────────┴─────────┐
                ▼                   ▼
           SECONDARY           SECONDARY
```

Here's the catch. Say a write reaches the primary, and the primary crashes **before** any secondary copied it. A secondary becomes the new primary, without that write. When the old primary comes back, it has to throw the write away. This is called a **rollback**.

So "did my write succeed?" really means "how many servers have it?" And "what does this read show?" means "how sure is this data?" **Write concern** and **read concern** let you choose.

> **Think of it like this:** You hand an important letter to a receptionist. Write concern is how much proof you want before walking away: no proof at all (`w: 0`), the receptionist saying "got it" (`w: 1`), or a signed receipt from most of the managers (`w: "majority"`).

## Write concern

**Write concern** tells MongoDB how many servers must confirm a write before it replies "success" to your app.

### The w option

| Value | MongoDB replies when... | Speed | Safety |
| --- | --- | --- | --- |
| `w: 0` | Immediately. It doesn't even wait for the primary. | Fastest | You don't know if it worked |
| `w: 1` | The primary has applied the write. | Fast | Can be rolled back if the primary dies |
| `w: "majority"` | Most voting members have the write. | Slower | Will **not** be rolled back |
| `w: 3` (a number) | That many members have the write. | Depends | Depends |

Since MongoDB 5.0, the default is **`w: "majority"`** for most setups. That's the safe choice, and you usually don't need to change it.

### Setting it on one operation

Every write method accepts a `writeConcern` option:

```javascript
use shop

db.orders.insertOne(
  { customerName: "Maria", total: 498, status: "pending", createdAt: new Date() },
  { writeConcern: { w: "majority" } }
)
// → { acknowledged: true, insertedId: ObjectId('...') }
```

With `w: 0`, the reply is instant but tells you nothing:

```javascript
db.pageViews.insertOne(
  { page: "/products/notebook", at: new Date() },
  { writeConcern: { w: 0 } }
)
// → { acknowledged: false, insertedId: ObjectId('...') }
```

`acknowledged: false` means "I sent it, but nobody confirmed". Even a duplicate key error would go unnoticed.

> **Tip:** `w: 0` only makes sense for data you don't mind losing, like rough page-view counters. Never use it for orders, payments or user accounts.

### The j option (journal)

The **journal** is a file on disk where MongoDB records writes before applying them, so it can recover after a crash.

`j: true` means "only reply after the write is in the journal on disk". With `w: "majority"`, MongoDB already waits for the journal on the majority by default, so you rarely need to set `j` yourself.

```javascript
db.orders.updateOne(
  { customerName: "Maria", status: "pending" },
  { $set: { status: "shipped" } },
  { writeConcern: { w: 1, j: true } }
)
```

### The wtimeout option

On a replica set, if some secondaries are down, a `w: "majority"` write could wait a long time. `wtimeout` sets a limit in milliseconds:

```javascript
db.orders.insertOne(
  { customerName: "Ken", total: 1999, status: "pending", createdAt: new Date() },
  { writeConcern: { w: "majority", wtimeout: 5000 } }
)
```

If the majority doesn't confirm within 5 seconds, you get a **write concern error**.

> **Warning:** A `wtimeout` error does **not** undo the write. The write may still be on the primary and may still reach the majority later. Your app should treat it as "unknown", not as "failed".

## Read concern

**Read concern** tells MongoDB how "sure" the data must be before you're allowed to see it.

| Level | You see... | Notes |
| --- | --- | --- |
| `"local"` | The newest data on the server you're reading from. | The default. Might later be rolled back. |
| `"available"` | Same as local on a replica set. | On sharded clusters it's even faster but can return stray duplicate documents. Rarely used. |
| `"majority"` | Only data that most members have. | Will never be rolled back. May be slightly older. |
| `"linearizable"` | The latest majority data, after confirming with the other members. | Primary only, single-document reads. Slow. |
| `"snapshot"` | One consistent moment in time across the whole query. | Used in transactions and some reads. |

> **Think of it like this:** `"local"` is reading a draft that was just typed. `"majority"` is reading the version that was approved and filed. The draft is newer, but the filed version won't suddenly disappear.

### Setting it in mongosh

Add `.readConcern()` to a cursor:

```javascript
db.orders.find({ status: "pending" }).readConcern("majority")
```

Or use it in `aggregate()`:

```javascript
db.orders.aggregate(
  [{ $group: { _id: "$status", count: { $sum: 1 } } }],
  { readConcern: { level: "majority" } }
)
// → { _id: 'pending', count: 3 }
//   { _id: 'shipped', count: 5 }
```

### Why does "majority" matter?

Imagine a payment page reads an order with `"local"` and shows "Payment received". Then the primary crashes and that write is rolled back. The customer saw something that, as far as the database is concerned, never happened.

With `"majority"`, the page only shows data that is guaranteed to stay. For anything a human relies on (balances, order status, stock), `"majority"` is the safer read.

## Setting concerns for a whole app

You don't want to add options to every single call. Set them once instead.

### In the connection string

```text
mongodb://localhost:27017/shop?replicaSet=rs0&w=majority&wtimeoutMS=5000&readConcernLevel=majority
```

| Parameter | Meaning |
| --- | --- |
| `w=majority` | Default write concern |
| `journal=true` | Same as `j: true` |
| `wtimeoutMS=5000` | Default write timeout |
| `readConcernLevel=majority` | Default read concern |

### In Node.js

You can set them on the client, a database or a collection. The closest setting wins:

```javascript
import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017/?replicaSet=rs0", {
  writeConcern: { w: "majority", wtimeoutMS: 5000 },
  readConcern: { level: "majority" }
});

const shop = client.db("shop");

// A collection for low-value logs with a faster write concern
const pageViews = shop.collection("pageViews", { writeConcern: { w: 1 } });

// One operation can still override
await shop.collection("orders").insertOne(
  { customerName: "Asha", total: 49, status: "pending", createdAt: new Date() },
  { writeConcern: { w: "majority" } }
);
```

> **Note:** In the Node.js driver the timeout option is spelled `wtimeoutMS`, while inside mongosh's `writeConcern` document it is `wtimeout`. Both mean milliseconds.

### For the whole cluster

An administrator can change the **cluster-wide defaults** that apply when an app doesn't say anything:

```javascript
db.adminCommand({
  setDefaultRWConcern: 1,
  defaultWriteConcern: { w: "majority" },
  defaultReadConcern: { level: "majority" }
})

db.adminCommand({ getDefaultRWConcern: 1 })
// → { defaultReadConcern: { level: 'majority' }, defaultWriteConcern: { w: 'majority', wtimeout: 0 }, ... }
```

> **Note:** On Atlas, some of these admin commands are managed for you. Atlas already uses safe defaults.

## Reading your own writes

Here's a classic surprise. Asha updates her profile, the page reloads, and the old name shows. Why? The write went to the primary, but the read went to a **secondary** that hadn't copied it yet.

A **causally consistent session** fixes this. Inside such a session, MongoDB guarantees that each read sees the effects of your earlier writes, even if the read goes to a secondary. Use `"majority"` for both the write and the read concern:

```javascript
const session = client.startSession({ causalConsistency: true });
try {
  const customers = client.db("shop").collection("customers");

  await customers.updateOne(
    { email: "asha@example.com" },
    { $set: { city: "Bengaluru" } },
    { session, writeConcern: { w: "majority" } }
  );

  const asha = await customers.findOne(
    { email: "asha@example.com" },
    { session, readConcern: { level: "majority" }, readPreference: "secondaryPreferred" }
  );

  console.log(asha.city);
  // → Bengaluru   (guaranteed, even when read from a secondary)
} finally {
  await session.endSession();
}
```

> **Tip:** If you always read from the primary (the default), you already see your own writes. Causal consistency matters when you send reads to secondaries, which is the topic of the next lesson.

## Recipes: which settings should I pick?

| Data | Write concern | Read concern |
| --- | --- | --- |
| Orders, payments, accounts | `w: "majority"` (default) | `"majority"` |
| Product catalogue pages | `w: "majority"` | `"local"` (default) is fine |
| Click or page-view counters | `w: 1` | `"local"` |
| Throwaway debug logs | `w: 0` is acceptable | `"local"` |
| Reports that must be consistent | `w: "majority"` | `"snapshot"` or a transaction |

> **Note:** On a **single-node** replica set, "majority" means "this one server", so you won't feel any speed difference while practising. The difference shows up on real 3-node replica sets.

## Common mistakes

- **Using `w: 0` or `w: 1` to "go faster" for important data.** You trade safety for a few milliseconds. Keep `"majority"` for anything that matters.
- **Treating a `wtimeout` error as a failed write.** The write might still succeed. Design the operation so retrying it is safe (for example, use an upsert with a unique key).
- **Thinking read concern `"majority"` means "the newest data".** It means "data that won't be rolled back", which can be a little behind `"local"`.
- **Setting write concern on operations inside a transaction.** Set it on `startTransaction()` or `withTransaction()` instead; per-operation settings cause an error.
- **Expecting read-your-own-writes from secondaries without a session.** Use a causally consistent session with majority read and write concern.

## Practice

1. Insert a document into `shop.auditLog` with write concern majority and a 3-second timeout.
2. Count the orders per `status` using read concern `"majority"`.
3. Write a Node.js connection string that sets `w=majority`, a 2-second write timeout and `readConcernLevel=majority` for replica set `rs0`.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1
db.auditLog.insertOne(
  { action: "price-change", product: "Notebook", by: "Priya", at: new Date() },
  { writeConcern: { w: "majority", wtimeout: 3000 } }
)

// 2
db.orders.aggregate(
  [{ $group: { _id: "$status", count: { $sum: 1 } } }],
  { readConcern: { level: "majority" } }
)

// 3
const uri = "mongodb://localhost:27017/shop?replicaSet=rs0&w=majority&wtimeoutMS=2000&readConcernLevel=majority";
```

</details>

## Key takeaways

- On a replica set, a write can be **rolled back** if it never reached a majority of members.
- **Write concern** (`w`, `j`, `wtimeout`) decides how many members must confirm a write; `w: "majority"` is the default and the safe choice.
- **Read concern** decides how sure data must be: `"local"` (default, newest), `"majority"` (won't roll back), `"snapshot"` (one moment in time), `"linearizable"` (strongest, slowest).
- Set concerns per operation, per collection or client, in the connection string, or cluster-wide with `setDefaultRWConcern`.
- A **causally consistent session** gives you read-your-own-writes, even when reading from secondaries.

**Next lesson:** [Read Preferences and Replica Set Reads](/courses/mongodb/read-preferences)
