---
title: Connecting MongoDB to Your First App
slug: connecting-from-an-app
metadescription: Build your first Node.js app for MongoDB. Install the official driver, keep the connection string in .env, insert and find documents, and close cleanly.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'nodejs', 'driver', 'connection-string']
course: mongodb
---
## What you will learn

By the end of this lesson you will know how to:

- Set up a small Node.js project and install the official `mongodb` driver
- Keep your **connection string** safe in a `.env` file
- Connect with `MongoClient`, then insert and find documents from code
- Close the connection properly when your script is done
- Read the most common connection errors and fix them

Until now you've typed every command into mongosh. That's perfect for learning, but real users never open mongosh. They use *your app*, and your app talks to MongoDB for them. In this lesson you'll write that app, in about 30 lines of JavaScript.

## What is a driver?

A **driver** is a library that lets your programming language talk to MongoDB. MongoDB has official drivers for Node.js, Python, Java, C#, Go, PHP, Rust and more. We'll use the **Node.js driver**, which is published on npm simply as `mongodb`.

The good news: the driver's methods have the same names you've been using. `insertOne`, `find`, `updateOne`, `deleteMany`, `countDocuments`... they all work almost exactly like in mongosh.

> **Think of it like this:** MongoDB speaks its own language over the network. The driver is a translator that sits inside your app. You say `insertOne(...)` in JavaScript, and the driver turns it into a message the database understands, then brings the answer back.

## What you need

- **Node.js 20.19 or newer.** Any current Long Term Support release (such as 22 or 24) is a good choice. Check with `node --version`.
- **A running MongoDB.** Either the local server from [Installing MongoDB Community 8](/courses/mongodb/installing-mongodb), or a free Atlas cluster from [MongoDB Atlas: Free Cluster Setup](/courses/mongodb/mongodb-atlas-setup).
- A terminal and a code editor (VS Code is great).

```bash
node --version
# → v22.x.x (anything 20.19 or above is fine)
```

## Step 1: Create the project

Make a new folder, move into it, and create a `package.json` file with `npm init`:

```bash
mkdir shop-app
cd shop-app
npm init -y
```

`npm init -y` creates a `package.json` with default values. This file describes your project and its dependencies.

Next, tell Node.js we'll use modern `import` syntax (called **ES modules**):

```bash
npm pkg set type=module
```

This adds `"type": "module"` to `package.json`. It also lets us use `await` at the top level of our file, which keeps the code short.

## Step 2: Install the driver

```bash
npm install mongodb
```

npm downloads the driver into a `node_modules` folder and records it in `package.json`:

```json
{
  "name": "shop-app",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "mongodb": "^7.7.0"
  }
}
```

Your version number may be a little different. That's fine. This course uses version 7 of the Node.js driver (7.7 at the time of writing), which needs Node.js 20.19 or newer. Everything in this lesson also works with the older version 6.

## Step 3: Store the connection string in `.env`

A **connection string** is the address of your database, written as a URL. It tells the driver where MongoDB is and, for Atlas, how to log in.

For a local server it looks like this:

```text
mongodb://127.0.0.1:27017
```

For Atlas, you copy it from the **Connect** button in the Atlas UI. It looks something like this:

```text
mongodb+srv://asha:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

An Atlas connection string contains your **password**. You must never paste it straight into your code, because code gets shared, pushed to GitHub, and copied around. Instead, put it in a separate file called `.env` (short for "environment").

Create a file named `.env` in the `shop-app` folder:

```text
MONGODB_URI=mongodb://127.0.0.1:27017
```

If you use Atlas, put your Atlas string there instead, with your real database password in place of `<db_password>`.

Now create a `.gitignore` file so Git never uploads your secrets or the huge `node_modules` folder:

```text
.env
node_modules
```

> **Warning:** If a password ever ends up on GitHub, change it immediately in Atlas (**Database Access**). Bots scan public repositories for leaked connection strings within minutes.

> **Tip:** Why `127.0.0.1` and not `localhost`? On some computers, Node.js turns `localhost` into the IPv6 address `::1`, but a default local MongoDB only listens on `127.0.0.1`. Using `127.0.0.1` avoids a confusing "connection refused" error.

## Step 4: Write the app

Create a file called `index.js`:

```javascript
// index.js
import { MongoClient } from "mongodb";

// 1. Read the connection string from the environment
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is missing. Did you create the .env file?");
}

// 2. Create a client (this doesn't connect yet)
const client = new MongoClient(uri);

try {
  // 3. Connect to the server
  await client.connect();
  console.log("Connected to MongoDB!");

  // 4. Pick a database and a collection
  const db = client.db("shop");
  const products = db.collection("products");

  // 5. Insert one document
  const result = await products.insertOne({
    name: "Sticky Notes",
    category: "stationery",
    price: 35,
    stock: 200,
    tags: ["paper", "office"]
  });
  console.log("Inserted with _id:", result.insertedId);

  // 6. Find documents and turn the results into an array
  const stationery = await products
    .find({ category: "stationery" }, { projection: { name: 1, price: 1, _id: 0 } })
    .sort({ price: 1 })
    .toArray();
  console.log("Stationery:", stationery);
} finally {
  // 7. Always close the client, even if something above failed
  await client.close();
  console.log("Connection closed.");
}
```

## Step 5: Run it

Node.js can read a `.env` file for you with the `--env-file` flag:

```bash
node --env-file=.env index.js
```

You should see something like this:

```text
Connected to MongoDB!
Inserted with _id: new ObjectId('6718b9e2a1c3f4d5e6f7a8b9')
Stationery: [
  { name: 'Gel Pen', price: 15 },
  { name: 'Sticky Notes', price: 35 },
  { name: 'Notebook', price: 49 }
]
Connection closed.
```

(If your `shop` database is empty, you'll only see Sticky Notes. That's fine too.)

Open mongosh and check. The document your app inserted is really there:

```javascript
use shop
db.products.findOne({ name: "Sticky Notes" })
// → { _id: ObjectId("6718b9e2a1c3f4d5e6f7a8b9"), name: "Sticky Notes", category: "stationery", price: 35, stock: 200, tags: [ "paper", "office" ] }
```

To save typing, add a script to `package.json`:

```json
{
  "scripts": {
    "start": "node --env-file=.env index.js"
  }
}
```

Now `npm start` runs your app.

> **Note:** The `--env-file` flag is built into Node.js 20.6 and later. In older tutorials you'll often see the `dotenv` package doing the same job with `import "dotenv/config"`. Both work.

## Understanding the code

Let's walk through the important pieces.

### `MongoClient`

`new MongoClient(uri)` creates a **client**: the object that manages the connection to your database. Creating it doesn't contact the server yet. `await client.connect()` does that.

> **Tip:** Modern drivers also connect automatically the first time you run a command, so `client.connect()` is optional. Calling it explicitly makes errors appear early and clearly, which is nice while learning.

### `client.db()` and `db.collection()`

These just pick names, exactly like `use shop` and `db.products` in mongosh. They don't talk to the server, and, as you learned in [Databases, Collections and Namespaces](/courses/mongodb/databases-and-collections), the database and collection are created automatically on the first insert.

### `await`

Talking to a database takes time: the request travels over the network and comes back. So every driver method that talks to the server returns a **Promise**, and you put `await` in front of it to wait for the answer.

```javascript
const count = await products.countDocuments({ stock: 0 });   // right: a number
const oops = products.countDocuments({ stock: 0 });          // wrong: a Promise, not a number
```

### `find()` returns a cursor

In mongosh, `find()` prints results right away. In the driver, `find()` returns a **cursor**: a pointer to the results that fetches them in batches as you need them. To get the results, either turn the cursor into an array:

```javascript
const all = await products.find({}).toArray();
```

or loop over it one document at a time, which uses less memory for big results:

```javascript
for await (const product of products.find({ stock: { $gt: 0 } })) {
  console.log(product.name);
}
```

`findOne()` is simpler. It returns a single document (or `null`) directly:

```javascript
const mug = await products.findOne({ name: "Coffee Mug" });
```

### Projection lives inside options

In mongosh, the projection is the second argument. In the driver, the second argument of `find()` is an **options** object, and the projection goes under `projection`, as you saw in Step 4.

### `client.close()`

`close()` shuts down the connection. If you forget it, a small script like ours may keep running and never return to the prompt. We put it in a `finally` block, which always runs, even if an error happened above.

## mongosh vs the Node.js driver

| Task | mongosh | Node.js driver |
| --- | --- | --- |
| Pick a database | `use shop` | `const db = client.db("shop")` |
| Pick a collection | `db.products` | `db.collection("products")` |
| Insert | `db.products.insertOne({...})` | `await products.insertOne({...})` |
| Find many | `db.products.find({...})` | `await products.find({...}).toArray()` |
| Projection | `find(filter, { name: 1 })` | `find(filter, { projection: { name: 1 } })` |
| Find by id | `{ _id: ObjectId("...") }` | `{ _id: new ObjectId("...") }` (import `ObjectId` from `"mongodb"`) |
| Update / delete | `updateOne`, `deleteMany`... | same names, with `await` |

## One client for the whole app

In this script we create one client, use it, and close it. In a real web server (for example with Express), you create **one** client when the server starts and reuse it for every request. You do **not** create a new client per request.

Why? Each client keeps a small set of open connections, called a **connection pool**, ready to use. Opening connections is slow; reusing them is fast. Creating a new client for each request throws that benefit away and can overwhelm the database with connections.

You'll learn how pools work and how to tune them in the Expert lesson [Node.js Driver and Connection Pooling](/courses/mongodb/nodejs-driver-and-connection-pooling). For now, just remember: one client, created once, shared everywhere.

## When things go wrong

Connection problems are the most common beginner headache. Here are the usual messages and what they mean:

| Error message contains | What it usually means | Fix |
| --- | --- | --- |
| `MONGODB_URI is missing` (our own check) | The `.env` file wasn't loaded | Run with `--env-file=.env`, and check the file name and location |
| `ECONNREFUSED 127.0.0.1:27017` | Nothing is listening there | Start your local MongoDB server |
| `MongoServerSelectionError` / `Server selection timed out` | The driver couldn't reach any server in time (30 seconds by default) | Check the address; for Atlas, add your IP under **Network Access** |
| `bad auth : authentication failed` | Wrong username or password | Check the database user in Atlas **Database Access** |
| `querySrv ENOTFOUND` | The `mongodb+srv://` host name is wrong, or DNS is blocked | Re-copy the string from Atlas; try another network |

> **Note:** If your password contains special characters like `@`, `:` or `/`, they must be **URL-encoded** in the connection string (for example `@` becomes `%40`). Otherwise the driver misreads where the password ends. The simplest fix is to choose a password with only letters and numbers.

## Common mistakes

- **Hard-coding the connection string.** Keep it in `.env` and add `.env` to `.gitignore`.
- **Forgetting `await`.** You get a Promise instead of data, and things happen in the wrong order.
- **Forgetting `.toArray()`.** `find()` returns a cursor, not an array. Use `.toArray()` or `for await`.
- **Passing the projection as the second argument.** In the driver, use `{ projection: { ... } }`.
- **Creating a new `MongoClient` for every request.** Create one at startup and reuse it.

## Practice

Use your `shop-app` project. Change `index.js` (or create new files) to do each task.

1. Print how many products are out of stock.
2. Print the names of all products that cost more than 200, most expensive first.
3. Increase the stock of "Sticky Notes" by 50 and print `modifiedCount`.
4. Delete the "Sticky Notes" document and print `deletedCount`.

<details>
<summary>Show a possible answer</summary>

```javascript
// practice.js  (run with: node --env-file=.env practice.js)
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

try {
  const products = client.db("shop").collection("products");

  // 1. Count with a filter
  const outOfStock = await products.countDocuments({ stock: 0 });
  console.log("Out of stock:", outOfStock);

  // 2. Filter, sort, project, then toArray
  const pricey = await products
    .find({ price: { $gt: 200 } }, { projection: { name: 1, _id: 0 } })
    .sort({ price: -1 })
    .toArray();
  console.log("Pricey:", pricey.map((p) => p.name));

  // 3. Update with $inc
  const updated = await products.updateOne({ name: "Sticky Notes" }, { $inc: { stock: 50 } });
  console.log("Modified:", updated.modifiedCount);

  // 4. Delete one
  const deleted = await products.deleteOne({ name: "Sticky Notes" });
  console.log("Deleted:", deleted.deletedCount);
} finally {
  await client.close();
}
```

</details>

## Key takeaways

- The official Node.js driver is the `mongodb` npm package. Its methods match what you learned in mongosh.
- Keep the connection string in a `.env` file, load it with `node --env-file=.env`, and never commit it.
- `new MongoClient(uri)` creates the client; `client.db()` and `db.collection()` pick where to work.
- Driver calls return Promises, so use `await`. `find()` returns a cursor; use `.toArray()` or `for await`.
- Close the client when a script ends, and in servers create one client at startup and reuse it.

**Next lesson:** [Beginner Project: A Library Database](/courses/mongodb/beginner-project-library-database)
