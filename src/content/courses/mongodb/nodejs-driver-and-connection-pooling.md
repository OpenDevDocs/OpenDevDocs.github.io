---
title: Node.js Driver and Connection Pooling
slug: nodejs-driver-and-connection-pooling
metadescription: Learn how the MongoDB Node.js driver manages a connection pool, how to tune maxPoolSize and friends, and how to reuse one client and shut down cleanly.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 4
tags: ['mongodb', 'nodejs', 'driver', 'connection-pool']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What a **connection pool** is and why the driver keeps one for you
- Why your app should create **one `MongoClient`** and reuse it everywhere
- How to tune `maxPoolSize`, `minPoolSize`, `maxIdleTimeMS` and `waitQueueTimeoutMS`
- How to watch the pool with **pool events**
- How to **shut down gracefully** so no request is cut off halfway

> **Before you start:** this lesson assumes you've read [Connecting MongoDB to Your First App](/courses/mongodb/connecting-from-an-app) and [Queryable Encryption](/courses/mongodb/queryable-encryption). You only need Node.js and a local MongoDB (or a free Atlas cluster) to follow along.

## Which driver version?

The official package on npm is called `mongodb`. At the time of writing, the latest major version is **7.x** (7.7 is current). Version 6.x is still maintained, and everything in this lesson works the same on 6.x and 7.x.

> **Note:** Driver 7 needs **Node.js 20.19 or newer**. It dropped Node 16 and 18. If you are stuck on an older Node, stay on driver 6.x for now.

Create a small project and install the driver:

```bash
mkdir shop-api && cd shop-api
npm init -y
npm pkg set type=module
npm install mongodb
```

The line `npm pkg set type=module` tells Node to treat `.js` files as **ES modules**, so we can use `import` instead of `require`.

## What is a connection pool?

Opening a connection to MongoDB is slow. The driver has to open a network socket, do a TLS handshake, log in, and ask the server what it can do. That can take tens of milliseconds. Your query itself might only take one millisecond.

So the driver does something clever. It opens connections once, keeps them open, and lends them out to your code again and again. This set of ready-to-use connections is called a **connection pool**.

> **Think of it like this:** A connection pool is like the trolleys at a supermarket. Shoppers don't build a new trolley each time they arrive. They take one from the line, use it, and put it back for the next person. If all trolleys are in use, the next shopper waits a moment.

Here is what happens when you run a query:

1. Your code calls `products.find(...)`.
2. The driver **checks out** a free connection from the pool (or opens a new one if the pool is below its limit).
3. The query runs on that connection.
4. The driver **checks the connection back in** so another request can use it.

You never touch connections yourself. You just call methods on the client.

### One pool per server

There is one detail that surprises people. The driver keeps **a separate pool for every server** it talks to. In a three-member replica set, the client has three pools.

On top of that, each client opens up to **two monitoring connections per server** to keep an eye on its health. So with the default settings and reads going only to the primary, you can see up to 100 pooled connections plus 6 monitoring connections.

## The golden rule: one client per app

The most important lesson about pooling is simple:

> **Create one `MongoClient` when your app starts, and reuse it for every request.**

Each `new MongoClient()` creates its **own** pools. If you create a client inside a request handler, every request builds and destroys a whole pool. Your app gets slow, and the server gets flooded with connections.

Here is the **wrong** way:

```javascript
// BAD: a brand new client (and pool) for every request
app.get("/products", async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI);
  const products = await client.db("shop").collection("products").find().toArray();
  await client.close();
  res.json(products);
});
```

And here is the **right** way. Put the client in its own module, so every other file imports the same object:

```javascript
// db.js
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";

export const client = new MongoClient(uri, {
  appName: "shop-api",
  maxPoolSize: 50
});

export const db = client.db("shop");
```

Node.js caches modules. No matter how many files `import { db } from "./db.js"`, they all get the **same** client and the same pool.

Now use it in a route:

```javascript
// routes/products.js
import { db } from "../db.js";

export async function listProducts(req, res) {
  const products = await db
    .collection("products")
    .find({ stock: { $gt: 0 } }, { projection: { name: 1, price: 1 } })
    .toArray();
  res.json(products);
}
// → [{ _id: ObjectId("..."), name: "Notebook", price: 49 }, ...]
```

> **Tip:** You do not have to call `client.connect()` before running a query. The driver connects automatically on the first operation. Calling `await client.connect()` at startup is still a good idea, because it fails fast if the URI or password is wrong.

## Pool options you can tune

You set pool options either in the options object or in the connection string. These two are the same:

```javascript
new MongoClient(uri, { maxPoolSize: 50, minPoolSize: 5 });

new MongoClient("mongodb://127.0.0.1:27017/?maxPoolSize=50&minPoolSize=5");
```

Here are the options you will touch most often:

| Option | What it does | Default |
| --- | --- | --- |
| `maxPoolSize` | Most connections the pool keeps **per server**. Extra requests wait. | `100` |
| `minPoolSize` | Connections the pool keeps open even when idle. | `0` |
| `maxIdleTimeMS` | How long a connection can sit unused before it is closed. | `0` (no limit) |
| `waitQueueTimeoutMS` | How long a request may wait for a free connection. | `0` (no limit) |
| `maxConnecting` | How many new connections a pool may open at the same moment. | `2` |
| `serverSelectionTimeoutMS` | How long to look for a suitable server before giving up. | `30000` |

Let's look at each one in plain words.

### maxPoolSize: how many trolleys?

`maxPoolSize` is the ceiling. If 100 requests are already using connections, request number 101 waits in a queue until one comes back.

Bigger is not always better. Every connection uses memory on the MongoDB server (roughly 1 MB each). If you run 20 copies of your app, each with `maxPoolSize: 100`, the server could face 2,000 connections.

> **Tip:** A useful starting point is: `maxPoolSize` × number of app instances should stay comfortably below the server's connection limit. For a small Atlas tier, keep `maxPoolSize` modest, like 10–50.

### minPoolSize: keep a few warm

If your app gets sudden bursts of traffic, the first requests may wait while new connections open. `minPoolSize` keeps some connections ready at all times:

```javascript
const client = new MongoClient(uri, { minPoolSize: 5 });
```

The cost is that those connections stay open on the server even at 3 a.m. when nobody is shopping.

### maxIdleTimeMS: tidy up unused connections

Firewalls and load balancers often silently drop connections that have been idle for a long time. When the driver later tries to use one, the request fails.

`maxIdleTimeMS` closes idle connections before that happens:

```javascript
const client = new MongoClient(uri, {
  maxIdleTimeMS: 60_000 // close connections idle for more than 60 seconds
});
```

> **Tip:** The docs suggest setting `maxIdleTimeMS` **higher** than your normal quiet periods but **lower** than your firewall or proxy idle timeout.

### waitQueueTimeoutMS: don't wait forever

By default a request waits as long as it takes for a free connection. During a traffic spike, requests can pile up and your users see a frozen page. Set a limit so the request fails quickly instead:

```javascript
const client = new MongoClient(uri, {
  maxPoolSize: 20,
  waitQueueTimeoutMS: 5_000
});
```

If no connection frees up within 5 seconds, the operation throws an error, and your app can return a friendly "please try again" message.

### A sensible starting config

Putting it together:

```javascript
// db.js
import { MongoClient } from "mongodb";

export const client = new MongoClient(process.env.MONGODB_URI, {
  appName: "shop-api",       // shows up in server logs, very handy
  maxPoolSize: 30,
  minPoolSize: 2,
  maxIdleTimeMS: 60_000,
  waitQueueTimeoutMS: 5_000,
  serverSelectionTimeoutMS: 10_000
});

export const db = client.db("shop");
```

Treat these numbers as a starting point. Measure, then adjust.

## Watching the pool with events

The `MongoClient` is an event emitter. It tells you every time a connection is created, checked out, checked in or closed. This is great for debugging "too many connections" problems.

```javascript
import { client } from "./db.js";

let inUse = 0;

client.on("connectionCreated", (e) => {
  console.log("new connection", e.connectionId, "to", e.address);
});

client.on("connectionCheckedOut", () => {
  inUse++;
});

client.on("connectionCheckedIn", () => {
  inUse--;
});

client.on("connectionCheckOutFailed", (e) => {
  console.warn("could not get a connection:", e.reason);
});

setInterval(() => console.log("connections in use:", inUse), 5_000);
```

Sample output while a load test runs:

```text
new connection 1 to 127.0.0.1:27017
new connection 2 to 127.0.0.1:27017
connections in use: 2
connections in use: 17
connections in use: 30
could not get a connection: timeout
```

The last line tells you the pool hit `maxPoolSize` and a request waited longer than `waitQueueTimeoutMS`. Time to look for slow queries or raise the pool size.

On the server side, you can count connections from mongosh:

```javascript
db.serverStatus().connections
// → { current: 38, available: 838822, totalCreated: 112, active: 6, ... }
```

## Graceful shutdown

When you deploy a new version, your process receives a **SIGTERM** signal. If you exit immediately, requests that are halfway through a write are cut off.

A **graceful shutdown** means:

1. Stop accepting new HTTP requests.
2. Let in-flight requests finish.
3. Close the MongoDB client.
4. Exit.

Here is a complete small server using Node's built-in `http` module:

```javascript
// server.js
import http from "node:http";
import { client, db } from "./db.js";

await client.connect(); // fail fast if MongoDB is unreachable
console.log("Connected to MongoDB");

const server = http.createServer(async (req, res) => {
  if (req.url === "/products") {
    const items = await db.collection("products").find().limit(20).toArray();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(items));
    return;
  }
  res.writeHead(404).end();
});

server.listen(3000, () => console.log("Listening on :3000"));

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {     // 1 + 2: stop new requests, wait for open ones
    await client.close();        // 3: close all pooled connections
    console.log("MongoDB client closed");
    process.exit(0);             // 4: exit
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);  // Ctrl+C in your terminal
```

Run it and press Ctrl+C:

```text
Connected to MongoDB
Listening on :3000
SIGINT received, shutting down...
MongoDB client closed
```

> **Note:** `client.close()` closes idle connections right away. Connections that are in use are closed when their operation finishes and they are returned to the pool. It does **not** kill a running query, but it does end open sessions and transactions.

## Serverless functions

On platforms like AWS Lambda or Vercel functions, your code may run in a fresh container or a reused one. The same rule applies: create the client **outside** the handler so warm invocations reuse it.

```javascript
// api/products.js
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });

export default async function handler(req, res) {
  const items = await client.db("shop").collection("products").find().limit(10).toArray();
  res.status(200).json(items);
}
```

Keep `maxPoolSize` small here. Hundreds of function instances, each with a big pool, can quickly use up your cluster's connection limit. Do not call `client.close()` at the end of each invocation, or you lose the reuse.

## Common mistakes

- **Creating a client per request.** This is the number one cause of "too many connections" errors. Create one client at startup and import it everywhere.
- **Setting `maxPoolSize` very high "just in case".** It multiplies across every app instance. Size it from real traffic, and watch `connections.current` on the server.
- **Leaving `waitQueueTimeoutMS` unset in busy apps.** Requests can hang during spikes. A timeout turns a frozen page into a clear, retryable error.
- **Exiting without `client.close()`.** In-flight writes may be cut off and the server keeps dead sockets for a while. Hook `SIGTERM` and `SIGINT`.
- **Using `useNewUrlParser` or `useUnifiedTopology`.** These old options do nothing in modern drivers and were removed in driver 7. Delete them from old code.

## Practice

1. Write a `db.js` module that exports a single client with a pool of at most 15 connections, keeps 2 warm, and fails a request that waits more than 3 seconds for a connection.
2. Add a listener that logs a warning whenever checking out a connection fails.
3. Your company runs 12 copies of an API, each with `maxPoolSize: 100`, against a 3-member replica set and reads only from the primary. Roughly how many application connections could the primary receive at peak?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1 + 2. db.js
import { MongoClient } from "mongodb";

export const client = new MongoClient(process.env.MONGODB_URI, {
  appName: "practice-app",
  maxPoolSize: 15,
  minPoolSize: 2,
  waitQueueTimeoutMS: 3_000
});

client.on("connectionCheckOutFailed", (e) => {
  console.warn("Pool checkout failed:", e.reason);
});

export const db = client.db("shop");

// 3. 12 instances × 100 connections = up to 1,200 pooled connections
//    on the primary, plus monitoring connections (2 per instance per server).
//    That is a lot! Lowering maxPoolSize to 20–30 is usually wiser.
```

</details>

## Key takeaways

- The driver keeps a **connection pool per server** and lends connections to your queries automatically.
- Create **one `MongoClient` per process** and import it everywhere. Never create one per request.
- `maxPoolSize` (default 100) caps connections, `minPoolSize` keeps some warm, `maxIdleTimeMS` tidies idle ones, and `waitQueueTimeoutMS` stops endless waiting.
- Pool **events** like `connectionCheckOutFailed` help you find pool problems fast.
- Shut down gracefully: stop the HTTP server, wait for requests, then `await client.close()`.

**Next lesson:** [Mongoose ODM: Schemas, Models and Middleware](/courses/mongodb/mongoose-odm)
