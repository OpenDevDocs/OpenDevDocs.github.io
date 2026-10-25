---
title: Transactions and ACID Guarantees
slug: transactions
metadescription: Learn what ACID means, when you need multi-document transactions in MongoDB, and how to run them safely in mongosh and Node.js with withTransaction.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'transactions', 'acid', 'sessions']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Change Streams](/courses/mongodb/change-streams) (it shows how to start a local single-node replica set) and [Bulk Writes and the Bulk API](/courses/mongodb/bulk-writes).

## What you will learn

By the end of this lesson you will know:

- What **ACID** means, in plain words
- Why a single-document write in MongoDB is already safe, and when you need more
- How to run a **multi-document transaction** in mongosh with a **session**
- How to use `withTransaction()` in Node.js, which retries for you
- The limits and costs of transactions, so you use them wisely

## The problem transactions solve

Rahul buys the last pair of Headphones. Your app must do two things:

1. Lower the Headphones `stock` by 1 in `products`
2. Insert a new order in `orders`

What if the server crashes, or the network drops, **between** step 1 and step 2? The stock went down, but no order exists. A pair of headphones has vanished from your shop.

A **transaction** groups several operations so they succeed **together** or fail **together**. Either both steps happen, or neither does.

> **Think of it like this:** Sending money to a friend has two steps: take it out of your account, put it into theirs. The bank would never let the first step happen without the second. A transaction is that "both or nothing" promise.

## ACID in plain words

Databases describe this promise with four letters, **ACID**:

| Letter | Name | Plain meaning |
| --- | --- | --- |
| A | **Atomicity** | All the steps happen, or none of them do. No half-finished work. |
| C | **Consistency** | The data moves from one valid state to another (rules like unique indexes and validation still hold). |
| I | **Isolation** | Other users don't see your half-finished work. They see the "before" or the "after", never the middle. |
| D | **Durability** | Once committed, the change survives a crash. |

## One document is already atomic

Here's good news: in MongoDB, **every write to a single document is atomic**, even if it changes many fields or array items at once. No transaction needed.

```javascript
// This is all-or-nothing, without a transaction:
db.orders.updateOne(
  { _id: 5001 },
  {
    $set: { status: "shipped", shippedAt: new Date() },
    $push: { history: { status: "shipped", at: new Date() } }
  }
)
```

This is one reason good schema design matters (see *Embedding vs Referencing*). If data that changes together lives in **one document**, you often don't need a transaction at all.

> **Tip:** Before reaching for a transaction, ask: "Could I store this in one document instead?" If yes, you get atomicity for free and better speed.

You need a **multi-document transaction** when one action must change **several documents**, often in different collections. Our stock-and-order example is exactly that.

## What you need

- A **replica set** or **sharded cluster**. Transactions don't run on a standalone server. Use Atlas (any tier) or a local single-node replica set as shown in *Change Streams*.
- A **session**. A session is like a conversation with the server: it ties a group of operations together so the server knows they belong to the same transaction.

Check you're on a replica set:

```javascript
db.hello().setName
// → 'rs0'   (a standalone server returns undefined)
```

## Your first transaction in mongosh

Make sure the sample products exist (Headphones has `stock: 35`). To make the example easy to follow, set the stock to 1:

```javascript
use shop
db.products.updateOne({ name: "Headphones" }, { $set: { stock: 1 } })
```

Now run the transaction. Read the comments line by line:

```javascript
// 1. Start a session
const session = db.getMongo().startSession()

// 2. Get collections THROUGH the session
const products = session.getDatabase("shop").products
const orders = session.getDatabase("shop").orders

// 3. Start the transaction
session.startTransaction({
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
})

try {
  // 4. Take one from stock, only if there is stock left
  const result = products.updateOne(
    { name: "Headphones", stock: { $gte: 1 } },
    { $inc: { stock: -1 } }
  )
  if (result.modifiedCount === 0) {
    throw new Error("Out of stock")
  }

  // 5. Create the order
  orders.insertOne({
    customerName: "Rahul",
    items: [{ name: "Headphones", qty: 1, price: 1999 }],
    total: 1999,
    status: "pending",
    createdAt: new Date()
  })

  // 6. Save both changes together
  session.commitTransaction()
  print("Order placed")
} catch (err) {
  // Undo everything done in this transaction
  session.abortTransaction()
  print("Cancelled: " + err.message)
} finally {
  session.endSession()
}
// → Order placed
```

Run the whole block again. This time the stock is 0, so `modifiedCount` is 0, we throw, and the transaction is aborted:

```javascript
// → Cancelled: Out of stock
```

No order was created the second time. That's atomicity.

### The four session commands

| Command | What it does |
| --- | --- |
| `startTransaction()` | Begins the "both or nothing" group. |
| `commitTransaction()` | Saves all changes at once. |
| `abortTransaction()` | Throws away every change made since the start. |
| `endSession()` | Closes the session. An open transaction is aborted. |

> **Warning:** Operations only belong to the transaction if they go **through the session**. In mongosh that means using `session.getDatabase(...)`. If you accidentally use plain `db.products`, that write happens immediately, outside the transaction, and won't be undone.

## Seeing isolation in action

Open a second mongosh window to watch. In window A, start a transaction and make a change, but **don't commit yet**:

```javascript
// Window A
const s = db.getMongo().startSession()
const p = s.getDatabase("shop").products
s.startTransaction()
p.updateOne({ name: "Notebook" }, { $set: { price: 59 } })
```

In window B, look at the Notebook:

```javascript
// Window B
db.products.findOne({ name: "Notebook" }, { price: 1 })
// → { _id: ObjectId('...'), price: 49 }    still the old price!
```

Back in window A, commit:

```javascript
// Window A
s.commitTransaction()
s.endSession()
```

Now window B sees the change:

```javascript
// Window B
db.products.findOne({ name: "Notebook" }, { price: 1 })
// → { _id: ObjectId('...'), price: 59 }
```

Others never saw a half-finished state. That's isolation.

## Transactions in Node.js with withTransaction()

Real apps hit temporary problems: a brief network glitch, or a **primary** server being replaced during an election. The driver marks these errors with labels:

- **`TransientTransactionError`**: something temporary went wrong. It's safe to run the **whole transaction** again.
- **`UnknownTransactionCommitResult`**: the commit was sent, but the reply got lost. It's safe to retry the **commit**.

Handling these by hand is tricky. The driver's `withTransaction()` helper does it for you: it starts the transaction, runs your function, commits, and **retries automatically** on those errors.

```javascript
import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017/?replicaSet=rs0");
const db = client.db("shop");
const products = db.collection("products");
const orders = db.collection("orders");

async function placeOrder(customerName, productName, qty) {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const product = await products.findOneAndUpdate(
        { name: productName, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { session, returnDocument: "after" } // pass the session to EVERY operation
      );

      if (!product) {
        throw new Error(`${productName} is out of stock`); // aborts, no retry
      }

      await orders.insertOne(
        {
          customerName,
          items: [{ productId: product._id, name: product.name, qty, price: product.price }],
          total: product.price * qty,
          status: "pending",
          createdAt: new Date()
        },
        { session }
      );
    });

    console.log("Order placed for", customerName);
  } finally {
    await session.endSession();
  }
}

await placeOrder("Priya", "Coffee Mug", 2);
// → Order placed for Priya
```

Key points:

- Pass **`{ session }`** to every operation inside the transaction. Forgetting it is the most common bug.
- If your function **throws**, the transaction is aborted and the error is passed on to you.
- Your function **may run more than once** (because of retries), so don't do things inside it that can't be repeated, like sending an email. Send the email **after** `withTransaction()` finishes.

> **Tip:** The callback should only contain database work. Keep slow things (HTTP calls, file uploads) out of it.

## Bulk writes inside a transaction

You can combine this with the previous lesson. In mongosh (MongoDB 8.0+), a session has its own `bulkWrite()` that takes the same arguments as `db.getMongo().bulkWrite()`:

```javascript
const session = db.getMongo().startSession()
session.startTransaction()
session.bulkWrite([
  { namespace: "shop.products", name: "updateOne", filter: { name: "Gel Pen" }, update: { $inc: { stock: -10 } } },
  { namespace: "shop.orders", name: "insertOne", document: { customerName: "Ken", total: 150, status: "pending", createdAt: new Date() } }
])
session.commitTransaction()
session.endSession()
```

In Node.js, pass `{ session }` as an option to `collection.bulkWrite()` or `client.bulkWrite()`.

## Read and write concern in transactions

You saw `readConcern` and `writeConcern` in `startTransaction()`. The next lesson explains them in depth. For now:

- Set them on the **transaction**, never on individual operations inside it (that causes an error).
- `writeConcern: { w: "majority" }` (the default) means the commit is safely copied to most servers before it counts.
- `readConcern: { level: "snapshot" }` means all reads in the transaction see one consistent moment in time.
- Transactions that read data must use read preference **`primary`**.

## Limits and costs

Transactions are powerful, but they are **not free**. Keep these in mind:

- **Time limit.** By default a transaction must finish in under **60 seconds** (the `transactionLifetimeLimitSeconds` setting). Longer ones are aborted automatically.
- **Lock waits.** A transaction waits only about 5 milliseconds for a lock it needs. If it can't get it, it aborts (with `TransientTransactionError`, so `withTransaction()` retries).
- **Write conflicts.** If someone else changes a document your transaction is also changing, one side gets a write conflict and has to retry.
- **Not everything is allowed.** You can't write to capped collections, time series collections, `system.*` collections, or the `admin`, `config` and `local` databases. `explain` is not supported inside a transaction.
- **Speed.** Transactions hold resources until they finish. Many big, slow transactions will slow the whole database.

> **Think of it like this:** A transaction is like reserving a meeting room. Book it for exactly as long as you need and give it back quickly. If everyone books rooms for the whole day, nobody else can meet.

**Good habits:**

- Keep transactions **short** and touch **as few documents as possible**.
- Put everything you need to read **before** the transaction when you can.
- Use indexes so the queries inside the transaction are fast.
- Prefer a better schema (one document) over a transaction when it's natural.

## Common mistakes

- **Forgetting `{ session }` on an operation.** That write runs outside the transaction and is not rolled back. Pass it to every call.
- **Running on a standalone server.** You get "Transaction numbers are only allowed on a replica set member or mongos". Start a single-node replica set.
- **Side effects inside `withTransaction()`.** The callback can run several times. Send emails or call payment APIs after the transaction commits.
- **Long transactions.** Doing a big import inside one transaction hits the 60-second limit. Split the work into smaller pieces, or use plain bulk writes if all-or-nothing isn't required.
- **Using transactions for everything.** Single-document updates are already atomic. Wrapping them in a transaction only adds cost.

## Practice

1. In mongosh, write a transaction that moves 5 units of "Gel Pen" stock into a new `warehouseB` collection document `{ name: "Gel Pen", stock: 5 }`, lowering `products` by 5. Abort if the products stock is less than 5.
2. In Node.js, write a `cancelOrder(orderId)` function that, in one transaction, sets the order's `status` to `"cancelled"` and puts each item's `qty` back into product stock.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. mongosh
const session = db.getMongo().startSession()
const shopDb = session.getDatabase("shop")
session.startTransaction({ writeConcern: { w: "majority" } })
try {
  const r = shopDb.products.updateOne(
    { name: "Gel Pen", stock: { $gte: 5 } },
    { $inc: { stock: -5 } }
  )
  if (r.modifiedCount === 0) throw new Error("Not enough Gel Pens")
  shopDb.warehouseB.updateOne(
    { name: "Gel Pen" },
    { $inc: { stock: 5 } },
    { upsert: true }
  )
  session.commitTransaction()
} catch (e) {
  session.abortTransaction()
  print(e.message)
} finally {
  session.endSession()
}

// 2. Node.js
async function cancelOrder(orderId) {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await orders.findOneAndUpdate(
        { _id: orderId, status: "pending" },
        { $set: { status: "cancelled" } },
        { session }
      );
      if (!order) throw new Error("Order not found or not pending");

      for (const item of order.items) {
        await products.updateOne(
          { _id: item.productId },
          { $inc: { stock: item.qty } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
}
```

</details>

## Key takeaways

- **ACID** means all-or-nothing (Atomicity), valid data (Consistency), no half-finished views (Isolation) and survives crashes (Durability).
- Writes to **one document** are always atomic; design your schema so most actions touch one document.
- **Multi-document transactions** need a replica set or sharded cluster and a **session**.
- In mongosh use `startTransaction()`, `commitTransaction()` and `abortTransaction()`; in apps prefer `withTransaction()`, which retries on temporary errors.
- Keep transactions short (under 60 seconds by default), pass the session to every operation, and keep side effects outside.

**Next lesson:** [Read and Write Concerns](/courses/mongodb/read-and-write-concerns)
