---
title: "mongosh: The MongoDB Shell"
slug: mongosh-basics
metadescription: Learn to use mongosh, the MongoDB Shell. Connect to a server, switch databases, run commands, use JavaScript, read results and get help.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'mongosh', 'shell', 'basics']
course: mongodb
---
## What you will learn

By the end of this lesson you will be able to:

- Connect **mongosh** to a local server or to Atlas
- Move around with `show dbs`, `use` and `show collections`
- Run your first insert and find commands
- Use JavaScript inside the shell (variables, loops, functions)
- Get help, see more results, run script files and exit

> **Before you start:** you need MongoDB running locally ([Installing MongoDB Community 8](/courses/mongodb/installing-mongodb)) or an Atlas cluster ([MongoDB Atlas: Free Cluster Setup](/courses/mongodb/mongodb-atlas-setup)), plus mongosh installed.

## What is mongosh?

**mongosh** (the MongoDB Shell) is a command-line program for talking to MongoDB. You type a command, press Enter, and the shell shows the result.

It is also a full **JavaScript** environment (built on Node.js). That means anything you can write in basic JavaScript, you can type into mongosh.

> **Think of it like this:** mongosh is a phone line straight to your database. You speak (type commands), the database replies (shows results). No app, no buttons, just a direct conversation.

Why learn the shell when there are graphical tools?

- It's the **fastest** way to try a query.
- Every MongoDB tutorial and doc page shows shell commands.
- Commands you test here translate almost word for word into app code.

## Connecting

### To MongoDB on your own computer

Open a terminal and type:

```bash
mongosh
```

With no options, mongosh connects to `mongodb://127.0.0.1:27017`, the default local address. You can also write it out in full, including a database to start in:

```bash
mongosh "mongodb://localhost:27017/shop"
```

### To MongoDB Atlas

Use the address from your cluster's **Connect** button and let mongosh ask for the password:

```bash
mongosh "mongodb+srv://cluster0.abcd123.mongodb.net/shop" --username asha
```

### The prompt

Once connected, you'll see a prompt that shows the **current database**:

```text
test>
```

`test` is the database mongosh starts in by default. When you see `shop>` instead, you are in the `shop` database.

## Finding your way around

These four commands are your map and compass.

**Which database am I in?**

```javascript
db
// → test
```

`db` is a special variable that always points to the current database.

**Which databases exist?**

```javascript
show dbs
```

```text
admin   40.00 KiB
config  60.00 KiB
local   40.00 KiB
```

`admin`, `config` and `local` are MongoDB's own system databases. Leave them alone.

**Switch to (or start using) a database:**

```javascript
use shop
// → switched to db shop
```

> **Note:** `use shop` works even if `shop` doesn't exist yet. MongoDB creates the database for real only when you first store data in it. That's why `shop` won't appear in `show dbs` until you insert something.

**Which collections are in this database?**

```javascript
show collections
```

Right now this prints nothing, because `shop` is still empty. Let's fix that.

## Your first commands

Insert one product into a `products` collection:

```javascript
db.products.insertOne({ name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"] })
```

```javascript
{
  acknowledged: true,
  insertedId: ObjectId("6718c3a1f2b4e5d6a7b8c9d0")
}
```

Notice the pattern: **`db.<collection>.<method>(...)`**. Here the collection is `products` and the method is `insertOne`. If the collection doesn't exist, MongoDB creates it.

Now read it back:

```javascript
db.products.find()
```

```javascript
[
  {
    _id: ObjectId("6718c3a1f2b4e5d6a7b8c9d0"),
    name: "Notebook",
    category: "stationery",
    price: 49,
    stock: 120,
    tags: ["paper", "school"]
  }
]
```

MongoDB added an `_id` for us. You'll learn all about it in [ObjectId and the _id Field](/courses/mongodb/objectid-and-id-field).

> **Note:** mongosh usually prints text values with single quotes, like `name: 'Notebook'`. Single or double quotes mean the same thing. This course writes them with double quotes.

Now `show dbs` lists `shop`, and `show collections` lists `products`.

### Adding the course data

Let's load the five products that the rest of the course uses. Paste this whole block into mongosh. The shell understands multi-line input: it waits until all brackets are closed before running.

```javascript
db.products.deleteMany({})   // start fresh: removes every product

db.products.insertMany([
  { name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"] },
  { name: "Gel Pen", category: "stationery", price: 15, stock: 500, tags: ["pen", "school"] },
  { name: "Headphones", category: "electronics", price: 1999, stock: 35, tags: ["audio", "wireless"], rating: 4.5 },
  { name: "USB Cable", category: "electronics", price: 299, stock: 0, tags: ["cable"] },
  { name: "Coffee Mug", category: "kitchen", price: 249, stock: 60, tags: ["ceramic", "gift"], rating: 4.8 }
])
// → { acknowledged: true, insertedIds: { '0': ObjectId("..."), '1': ObjectId("..."), ... } }
```

> **Warning:** `deleteMany({})` with an empty filter deletes **every** document in the collection. It's fine here because we are resetting practice data, but be careful with it in real projects.

Try a filter: only electronics.

```javascript
db.products.find({ category: "electronics" })
// → the Headphones and USB Cable documents
```

And find a single document with `findOne`:

```javascript
db.products.findOne({ name: "Coffee Mug" })
// → { _id: ObjectId("..."), name: "Coffee Mug", category: "kitchen", price: 249, ... }
```

## mongosh speaks JavaScript

Because mongosh is JavaScript, you can use variables, maths, loops and functions.

**Variables:**

```javascript
const cheap = db.products.find({ price: { $lt: 100 } }).toArray()
cheap.length
// → 2
```

`.toArray()` turns the results into a normal JavaScript array.

**Maths and strings:**

```javascript
49 * 3
// → 147

"Hello, " + "Asha"
// → Hello, Asha
```

**Loops:**

```javascript
db.products.find().forEach(p => {
  print(p.name + " costs " + p.price)
})
```

```text
Notebook costs 49
Gel Pen costs 15
Headphones costs 1999
USB Cable costs 299
Coffee Mug costs 249
```

`print()` writes plain text. There's also `printjson()` for printing objects neatly.

**Functions:**

```javascript
function inStock() {
  return db.products.find({ stock: { $gt: 0 } }).toArray().map(p => p.name)
}

inStock()
// → [ "Notebook", "Gel Pen", "Headphones", "Coffee Mug" ]
```

## Reading results: cursors and "it"

`find()` doesn't return all documents at once. It returns a **cursor**, which is a pointer that fetches results in batches.

> **Think of it like this:** A cursor is like a waiter bringing food from a buffet one plate at a time, instead of carrying the whole buffet to your table at once.

When there are many results, mongosh shows the first **20** and then says:

```text
Type "it" for more
```

Type `it` and press Enter to see the next batch.

## Getting help

mongosh has built-in help at every level:

```javascript
help                  // general shell help
db.help()             // methods you can call on a database
db.products.help()    // methods you can call on a collection
```

Two more tricks that save lots of typing:

- **Tab completion:** type `db.products.ins` and press **Tab**. mongosh completes it to `insertOne` or shows the options. It also completes collection names.
- **History:** press the **Up arrow** to bring back earlier commands. Edit them and press Enter to run again.

## Handy everyday commands

| Command | What it does |
| --- | --- |
| `db` | Show the current database |
| `show dbs` | List databases |
| `use shop` | Switch to the `shop` database |
| `show collections` | List collections in the current database |
| `db.version()` | Show the server's MongoDB version |
| `db.runCommand({ ping: 1 })` | Check the server answers (`{ ok: 1 }`) |
| `db.getSiblingDB("blog")` | Get another database without switching |
| `cls` | Clear the screen |
| `help` | Show help |
| `exit` or `quit` | Leave mongosh |

For example, `getSiblingDB` lets you peek into another database while staying in `shop`:

```javascript
db.getSiblingDB("admin").runCommand({ ping: 1 })
// → { ok: 1 }
```

## Running scripts

Typing everything by hand gets tiring. You can save commands in a `.js` file and run it.

Create a file called `seed.js`:

```javascript
// seed.js
db = db.getSiblingDB("shop")

db.customers.insertMany([
  { name: "Asha Roy", email: "asha@example.com", city: "Kolkata", joinedAt: new Date("2026-01-15"), isMember: true },
  { name: "Rahul Sharma", email: "rahul@example.com", city: "Delhi", joinedAt: new Date("2026-03-02"), isMember: false }
])

print("Customers now: " + db.customers.countDocuments())
```

Run it from your terminal:

```bash
mongosh "mongodb://localhost:27017" seed.js
```

Or load it from inside an open mongosh session:

```javascript
load("seed.js")
```

You can also run one quick command without opening the shell, using `--eval`:

```bash
mongosh --quiet --eval "db.version()"
```

`--quiet` hides the welcome messages, so only the answer is printed.

> **Tip:** Scripts can't use the `use shop` shortcut. Use `db = db.getSiblingDB("shop")` instead, as in the example above.

## Common mistakes

- **Typing `mongo` instead of `mongosh`.** The old `mongo` shell is gone. Use `mongosh`.
- **Typing shell commands into your normal terminal.** `show dbs` and `db.products.find()` only work *inside* mongosh, after the prompt like `test>`. Commands such as `mongosh --eval` go in the normal terminal.
- **Forgetting which database you're in.** If `find()` returns nothing, type `db` to check. You may still be in `test`.
- **Misspelling a collection name.** `db.prodcuts.find()` doesn't give an error. It just returns nothing, because the misspelled collection is empty. Run `show collections` to check names.
- **Using old commands** like `db.products.insert()` or `count()` from outdated tutorials. Use `insertOne`, `insertMany` and `countDocuments`.

## Practice

1. Connect with mongosh, switch to `shop`, and list its collections.
2. Insert a new product: `{ name: "Desk Lamp", category: "electronics", price: 899, stock: 15, tags: ["light"] }`.
3. Use a loop to print only the names of products in the `stationery` category.
4. Find out which MongoDB server version you're connected to.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1.
use shop
show collections

// 2.
db.products.insertOne({ name: "Desk Lamp", category: "electronics", price: 899, stock: 15, tags: ["light"] })
// → { acknowledged: true, insertedId: ObjectId("...") }

// 3.
db.products.find({ category: "stationery" }).forEach(p => print(p.name))
// → Notebook
//   Gel Pen

// 4.
db.version()
// → 8.0.x
```

</details>

## Key takeaways

- **mongosh** is MongoDB's command-line shell and a full JavaScript environment.
- `show dbs`, `use`, `show collections` and `db` help you find your way around.
- Commands follow the pattern `db.collection.method(...)`, for example `db.products.find()`.
- `find()` returns a **cursor**. Type `it` to see more results, or use `.toArray()` and `.forEach()`.
- Use `help`, **Tab** and the **Up arrow** to work faster, and run `.js` files for repeatable scripts.

**Next lesson:** [Compass and the VS Code Extension](/courses/mongodb/compass-and-vscode-extension)
