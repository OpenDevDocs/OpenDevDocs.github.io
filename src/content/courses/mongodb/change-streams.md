---
title: Change Streams
slug: change-streams
metadescription: Learn how MongoDB change streams let your app react to inserts, updates and deletes in real time, and how to set up a local replica set to try them.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'change-streams', 'real-time', 'replica-set']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What a **change stream** is and when it is useful
- How to start a **single-node replica set** on your own machine (change streams need one)
- How to watch a collection in mongosh and read **change events**
- How to filter events and get the full updated document
- How to **resume** a stream after your app restarts, using Node.js

> **Before you start:** this lesson assumes you've read [Bulk Writes and the Bulk API](/courses/mongodb/bulk-writes) and know basic inserts and updates.

## Why change streams?

Imagine your shop app needs to send an email every time an order is shipped. How does the email service find out?

One option is to ask the database every few seconds: "Any new shipped orders? How about now? Now?" This is called **polling**. It is wasteful and always a little late.

A **change stream** flips this around. Your app opens a stream once, and MongoDB **pushes** a message to it every time something changes. No polling, no missed changes.

> **Think of it like this:** Polling is refreshing a tracking page over and over. A change stream is signing up for delivery notifications: your phone buzzes the moment the parcel moves.

Common uses:

- Sending notifications (order shipped, new message)
- Keeping a search index or cache in sync with the database
- Live dashboards that update without refreshing
- Copying changes to another system, like an analytics database

## Change streams need a replica set

Change streams are built on the **oplog** (operations log). The oplog is a special collection where a **replica set** records every write so other servers can copy it. A plain standalone server has no oplog, so it can't run change streams.

You'll learn replica sets properly in *Replica Sets and Elections*. For now, you only need a **single-node replica set**: one server that *thinks* it is part of a replica set. That is enough to unlock change streams and transactions on your laptop.

Pick **one** of the three options below.

### Option 1: MongoDB Atlas (easiest)

Every Atlas cluster, including the free tier, is already a replica set. If you followed *MongoDB Atlas: Free Cluster Setup*, change streams just work. Skip to the next section.

### Option 2: Docker

Start a MongoDB 8 container with a replica set name:

```bash
docker run -d --name mongo-rs -p 27017:27017 mongo:8 --replSet rs0
```

Then tell it to start the replica set. We set the host to `localhost:27017` so your computer can reach it:

```bash
docker exec -it mongo-rs mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })'
```

On Windows PowerShell the same two commands look like this:

```powershell
docker run -d --name mongo-rs -p 27017:27017 mongo:8 --replSet rs0
docker exec -it mongo-rs mongosh --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] })"
```

### Option 3: Your local mongod

Stop any MongoDB server that is already running, then start `mongod` with a replica set name and an empty data folder:

```bash
mkdir -p ~/mongo-rs0
mongod --replSet rs0 --dbpath ~/mongo-rs0 --port 27017
```

```powershell
New-Item -ItemType Directory -Force C:\mongo-rs0
mongod --replSet rs0 --dbpath C:\mongo-rs0 --port 27017
```

Leave that window open. In a second terminal, open mongosh and initiate the set:

```javascript
rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })
// → { ok: 1 }
```

If you run MongoDB as a service (for example on Windows), you can add the replica set name to its config file instead, then restart the service and run `rs.initiate()` once:

```yaml
# mongod.conf (mongod.cfg on Windows)
replication:
  replSetName: rs0
```

### Check that it worked

After a few seconds your mongosh prompt changes to show the set name and role:

```javascript
rs.status().members[0].stateStr
// → 'PRIMARY'
```

The prompt now looks like `rs0 [direct: primary] test>`. You're ready.

## Watching a collection in mongosh

You'll need **two mongosh windows** side by side. Window A watches. Window B makes changes.

In **window A**, open a change stream on `orders` and print every event:

```javascript
use shop

const stream = db.orders.watch()

while (stream.hasNext()) {
  printjson(stream.next())
}
```

`hasNext()` waits until something happens, so window A will look "stuck". That's correct: it is listening.

In **window B**, insert an order:

```javascript
use shop

db.orders.insertOne({
  customerId: ObjectId(),
  items: [{ name: "Coffee Mug", qty: 1, price: 249 }],
  total: 249,
  status: "pending",
  createdAt: new Date()
})
```

Window A immediately prints a **change event**:

```javascript
{
  _id: { _data: '826718C2F1000000012B0429296E1404' },
  operationType: 'insert',
  clusterTime: Timestamp({ t: 1729843953, i: 1 }),
  wallTime: ISODate('2026-10-25T08:12:33.120Z'),
  fullDocument: {
    _id: ObjectId('6718c2f1a9b8c7d6e5f4a3b2'),
    customerId: ObjectId('6718c2f1a9b8c7d6e5f4a3b1'),
    items: [ { name: 'Coffee Mug', qty: 1, price: 249 } ],
    total: 249,
    status: 'pending',
    createdAt: ISODate('2026-10-25T08:12:33.110Z')
  },
  ns: { db: 'shop', coll: 'orders' },
  documentKey: { _id: ObjectId('6718c2f1a9b8c7d6e5f4a3b2') }
}
```

Press `Ctrl + C` in window A to stop watching.

### Reading a change event

| Field | Meaning |
| --- | --- |
| `_id` | The **resume token**. A bookmark for this exact event. |
| `operationType` | What happened: `insert`, `update`, `replace`, `delete`, `drop`, `rename`, `invalidate`, and more. |
| `clusterTime` / `wallTime` | When it happened. |
| `ns` | Which database and collection. |
| `documentKey` | The `_id` of the changed document. |
| `fullDocument` | The whole document (always present for `insert` and `replace`). |
| `updateDescription` | For `update` events: which fields changed. |

Now, in window B, ship the order:

```javascript
db.orders.updateOne({ total: 249, status: "pending" }, { $set: { status: "shipped" } })
```

The update event only describes the **difference**, not the whole document:

```javascript
{
  _id: { _data: '...' },
  operationType: 'update',
  ns: { db: 'shop', coll: 'orders' },
  documentKey: { _id: ObjectId('6718c2f1a9b8c7d6e5f4a3b2') },
  updateDescription: {
    updatedFields: { status: 'shipped' },
    removedFields: [],
    truncatedArrays: []
  },
  ...
}
```

## Watching at three levels

You can open a stream on a single collection, a whole database, or the whole deployment:

```javascript
db.orders.watch()      // one collection
db.watch()             // every collection in the current database
db.getMongo().watch()  // every database (except admin, local and config)
```

> **Tip:** Watch the smallest thing you need. Watching everything means your app receives (and ignores) lots of events it doesn't care about.

## Filtering events with a pipeline

Usually you only care about some changes. `watch()` accepts an **aggregation pipeline** as its first argument, using stages like `$match` and `$project` from the aggregation lessons.

Only listen for orders that become `"shipped"`:

```javascript
const stream = db.orders.watch([
  {
    $match: {
      operationType: "update",
      "updateDescription.updatedFields.status": "shipped"
    }
  }
])
```

Only listen for big new orders:

```javascript
const stream = db.orders.watch([
  { $match: { operationType: "insert", "fullDocument.total": { $gte: 1000 } } }
])
```

The filtering happens on the server, so your app doesn't even receive the events you don't want.

## Getting the full document on updates

An update event only says *what changed*. If your email service needs the customer's id and the order total, ask for the full document with the `fullDocument` option:

```javascript
const stream = db.orders.watch([], { fullDocument: "updateLookup" })
```

Now each update event includes a `fullDocument` field with the **current** version of the document.

> **Note:** `"updateLookup"` fetches the document *when the event is read*, not when the change happened. If the order changed again in between, you get the newer version. If it was deleted, `fullDocument` is `null`.

### Before and after images (MongoDB 6.0+)

Sometimes you need to know what the document looked like **before** the change, for example to show "status changed from pending to shipped". Turn on **pre- and post-images** for the collection:

```javascript
db.runCommand({
  collMod: "orders",
  changeStreamPreAndPostImages: { enabled: true }
})
```

Then ask for them when you watch:

```javascript
const stream = db.orders.watch([], {
  fullDocument: "whenAvailable",
  fullDocumentBeforeChange: "whenAvailable"
})
```

Each update event now carries both `fullDocumentBeforeChange` (the old version) and `fullDocument` (the new version). Use `"required"` instead of `"whenAvailable"` if you want an error when an image is missing.

> **Warning:** Pre- and post-images are stored on the server, so they take extra disk space. Only enable them on collections that really need them.

## Change streams in a Node.js app

In a real app, a small background worker opens the stream and reacts to each event. The Node.js driver lets you loop over a stream with `for await`:

```javascript
import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017/?replicaSet=rs0");
await client.connect();
const orders = client.db("shop").collection("orders");

const pipeline = [{ $match: { "updateDescription.updatedFields.status": "shipped" } }];
const stream = orders.watch(pipeline, { fullDocument: "updateLookup" });

for await (const change of stream) {
  const order = change.fullDocument;
  console.log(`Send "your order shipped" email for order ${order._id}, total ${order.total}`);
}
```

## Resuming after a restart

What if your worker crashes or restarts for a deploy? Any changes that happened while it was down would be missed, unless you **resume**.

Every event's `_id` is a **resume token**. Save the latest one somewhere safe (a small collection works well). When your worker starts again, pass it as `resumeAfter`, and MongoDB replays everything that happened since.

```javascript
const state = client.db("shop").collection("streamState");

// 1. Load the last saved token (if any)
const saved = await state.findOne({ _id: "order-emails" });

const stream = orders.watch(pipeline, {
  fullDocument: "updateLookup",
  ...(saved ? { resumeAfter: saved.token } : {})
});

for await (const change of stream) {
  await sendShippedEmail(change.fullDocument);

  // 2. Save the token AFTER the work is done
  await state.updateOne(
    { _id: "order-emails" },
    { $set: { token: change._id } },
    { upsert: true }
  );
}
```

There are three ways to choose a starting point:

| Option | Starts |
| --- | --- |
| `resumeAfter: token` | Right after the event with that token. |
| `startAfter: token` | Same, but also works after an `invalidate` event (like a dropped collection). |
| `startAtOperationTime: timestamp` | At a point in time. |

> **Warning:** You can only resume as far back as the **oplog** still remembers. The oplog has a fixed size and old entries fall off. If your worker is down for too long, resuming fails and you need to do a full re-sync.

> **Tip:** The driver already retries automatically after short network blips. Saving the resume token is for longer stops, like a crash or redeploy.

## Things change streams cannot do

- They don't work on a **standalone** server. You need a replica set or sharded cluster (or Atlas).
- They don't work on **time series collections**.
- They report only changes that are **majority-committed** (safely copied to most servers), so an event can arrive a fraction of a second after the write.
- Each open stream holds a connection from the driver's pool. Hundreds of open streams in one app need a bigger `maxPoolSize`.

## Common mistakes

- **Running on a standalone server.** You get an error like "The $changeStream stage is only supported on replica sets". Start a single-node replica set as shown above.
- **Expecting `fullDocument` on updates by default.** Without `fullDocument: "updateLookup"` (or pre/post images), update events only have `updateDescription`.
- **Filtering on `fullDocument` for updates without asking for it.** A `$match` on `fullDocument.total` won't match update events unless `fullDocument` is requested.
- **Not saving the resume token.** If you restart without it, you only see changes from that moment on and silently miss the rest.
- **Saving the token before doing the work.** If the app crashes in between, that event is skipped forever. Save it after.

## Practice

1. Open a change stream on `shop.products` that only shows events where `stock` was updated.
2. Open a change stream on the whole `shop` database that only shows `delete` events.
3. Test both by updating a product's stock and deleting an order in a second window.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Only stock updates
use shop
const stockStream = db.products.watch([
  { $match: { operationType: "update", "updateDescription.updatedFields.stock": { $exists: true } } }
])
while (stockStream.hasNext()) { printjson(stockStream.next()) }

// 2. Only deletes, anywhere in the shop database
const deleteStream = db.watch([{ $match: { operationType: "delete" } }])
while (deleteStream.hasNext()) { printjson(deleteStream.next()) }

// 3. In another window
db.products.updateOne({ name: "Notebook" }, { $inc: { stock: -1 } })
db.orders.deleteOne({ status: "pending" })
```

</details>

## Key takeaways

- A **change stream** pushes a message to your app every time data changes, so you don't need to poll.
- Change streams need a **replica set**. Locally, a single-node replica set (`--replSet rs0` plus `rs.initiate()`) is enough; Atlas clusters already are one.
- Use `watch()` on a collection, a database, or the whole deployment, and filter with a `$match` pipeline.
- Use `fullDocument: "updateLookup"` or pre/post images when you need the whole document on updates.
- Save each event's **resume token** and pass it to `resumeAfter` so a restarted app continues where it left off.

**Next lesson:** [Time Series and Capped Collections](/courses/mongodb/time-series-collections)
