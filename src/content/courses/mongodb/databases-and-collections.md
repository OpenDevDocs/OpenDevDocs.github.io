---
title: Databases, Collections and Namespaces
slug: databases-and-collections
metadescription: Learn how MongoDB organises data into databases and collections, how to create, list, rename and drop them, the naming rules, and what a namespace is.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'databases', 'collections', 'basics']
course: mongodb
---
## What you will learn

By the end of this lesson you will be able to:

- Explain how a MongoDB server is organised: server → databases → collections → documents
- Create databases and collections, both automatically and on purpose
- List, rename and delete (drop) them safely
- Follow the naming rules for databases and collections
- Understand what a **namespace** like `shop.products` means

## The big picture

You've met these words already. Now let's put them in order:

```text
MongoDB server (mongod)
├── shop                 ← database
│   ├── products         ← collection
│   │   ├── { name: "Notebook", ... }     ← document
│   │   └── { name: "Gel Pen", ... }      ← document
│   ├── customers        ← collection
│   └── orders           ← collection
├── blog                 ← another database
│   └── posts
├── admin                ← system database
├── config               ← system database
└── local                ← system database
```

- A **server** can hold many **databases**.
- A **database** holds many **collections**.
- A **collection** holds many **documents**.

> **Think of it like this:** The server is a library building. Each database is one room (Science, History, Fiction). Each collection is a bookshelf in that room. Each document is one book on the shelf.

### How do I decide what goes where?

A simple guideline for beginners:

- **One database per application.** Your online shop gets `shop`. Your blog gets `blog`.
- **One collection per kind of thing.** Products go in `products`, customers in `customers`, orders in `orders`.

Keep documents in one collection *similar*. Putting products and customers in the same collection would work technically, but it would make every query and index confusing.

## Databases

### See which database you're in

```javascript
db
// → test
```

### List databases

```javascript
show dbs
```

```text
admin   40.00 KiB
config  72.00 KiB
local   72.00 KiB
shop    96.00 KiB
```

The sizes show how much disk space each database uses.

### Create a database

There is no "create database" command. You simply **switch to it** and **store something**:

```javascript
use blog
// → switched to db blog

show dbs
// → blog is NOT listed yet
```

`blog` doesn't appear yet, because it's empty. MongoDB creates databases *lazily*: only when the first data arrives.

```javascript
db.posts.insertOne({ title: "Hello MongoDB", author: "Ken" })

show dbs
// → now blog appears in the list
```

> **Think of it like this:** `use blog` is like *deciding* to open a new room in the library. The room is only built when you bring in the first book.

### Work with another database without switching

```javascript
use shop
db.getSiblingDB("blog").posts.find()
// → [ { _id: ObjectId("..."), title: "Hello MongoDB", author: "Ken" } ]
```

You stay in `shop`, but read from `blog`.

### Delete a database

`db.dropDatabase()` deletes the **current** database and everything inside it.

```javascript
use blog
db.dropDatabase()
// → { ok: 1, dropped: "blog" }
```

> **Warning:** There is no undo and no "Are you sure?" question. Always run `db` first to check which database you're in before dropping anything.

### The system databases

Three databases belong to MongoDB itself:

| Database | What it's for |
| --- | --- |
| `admin` | Users, roles and server-wide admin commands |
| `local` | Data that belongs to this one server only, such as the replication log |
| `config` | Internal settings, used heavily in sharded clusters |

Don't store your own data in them, and don't delete them. (Older tutorials also mention a `test` database. That's just mongosh's default starting point, and it only exists once you put data in it.)

## Collections

### Create a collection automatically

Just like databases, collections are created **the first time you insert** into them:

```javascript
use shop
db.reviews.insertOne({ product: "Coffee Mug", stars: 5, by: "Priya" })

show collections
// → customers
//   products
//   reviews
```

(You'll see whichever collections you've created so far.)

### Create a collection on purpose

Sometimes you want to create a collection **with special options** before inserting anything. Use `db.createCollection()`:

```javascript
db.createCollection("suppliers")
// → { ok: 1 }
```

Without options, this is the same as the automatic way. The real power is in the options, for example:

```javascript
// A collection that only accepts documents with a "name" string
db.createCollection("suppliers2", {
  validator: {
    $jsonSchema: {
      required: ["name"],
      properties: { name: { bsonType: "string" } }
    }
  }
})
```

Other options create special kinds of collections, which you'll meet later:

| Option | Creates... | Lesson |
| --- | --- | --- |
| `validator` | A collection with rules about document shape | [Schema Validation with JSON Schema](/courses/mongodb/schema-validation) |
| `timeseries` | A collection optimised for measurements over time | [Time Series and Capped Collections](/courses/mongodb/time-series-collections) |
| `capped` + `size` | A fixed-size collection that overwrites its oldest documents | [Time Series and Capped Collections](/courses/mongodb/time-series-collections) |

### List collections

```javascript
show collections
```

Or get them as a JavaScript array, handy inside scripts:

```javascript
db.getCollectionNames()
// → [ "customers", "products", "reviews", "suppliers", "suppliers2" ]
```

### Rename a collection

```javascript
db.reviews.renameCollection("productReviews")
// → { ok: 1 }
```

All documents and indexes move to the new name.

### Delete a collection

`drop()` removes the collection, all its documents and all its indexes:

```javascript
db.suppliers2.drop()
// → true
```

`drop()` returns `true` if the collection existed and was removed.

> **Note:** "Delete all documents" and "drop the collection" are different. `db.products.deleteMany({})` empties the collection but keeps it (and its indexes and validation rules). `db.products.drop()` removes the collection completely. You'll learn more in [Deleting Documents](/courses/mongodb/deleting-documents).

## Namespaces

A **namespace** is the full name of a collection: the database name, a dot, and the collection name.

```text
shop.products
└┬─┘ └──┬───┘
 db  collection
```

So `shop.products` and `blog.products` are two completely separate collections, even though both are called `products`. They live in different databases.

> **Think of it like this:** A namespace is like a full postal address. "12 Park Street" alone could be in many cities. "Kolkata, 12 Park Street" points to exactly one place.

You'll see namespaces in error messages, logs and tools. Remember the duplicate key error from the last lesson?

```text
E11000 duplicate key error collection: shop.inventory index: _id_ ...
```

`shop.inventory` is the namespace: the `inventory` collection in the `shop` database.

A namespace can be at most **255 bytes** long (235 bytes for sharded collections). With normal names you'll never get close.

## Naming rules

### Database names

- **Not empty**, and **shorter than 64 bytes**.
- Can't contain these characters: `/ \ . " $` and spaces. On Windows, also `* < > : | ?`.
- **Don't rely on upper/lower case to tell databases apart.** You can't have both `salesData` and `SalesData`. After you create a database, always spell it with the same capitalisation.

### Collection names

- Should **start with a letter or an underscore**.
- Can't contain `$`, can't be empty, and can't start with `system.` (reserved for MongoDB).
- **Case-sensitive:** `products` and `Products` are two different collections.

### A naming style that keeps life easy

| Do | Example |
| --- | --- |
| Use lowercase or camelCase | `products`, `orderItems` |
| Use plural nouns for collections | `customers`, not `customer` |
| Keep names short and clear | `reviews`, not `all_the_reviews_from_customers` |
| Avoid spaces, dashes and dots | `orderItems`, not `order-items` |

If you inherit a collection with an awkward name (with a dash or starting with a number), the dot syntax won't work. Use `getCollection()` instead:

```javascript
db["order-items"].find()               // works
db.getCollection("order-items").find() // also works, and is clearer
// db.order-items.find()               // breaks: JavaScript reads "-" as minus
```

## Quick look at sizes and stats

Want to know how big a database is and how many collections it has?

```javascript
db.stats()
```

```javascript
{
  db: "shop",
  collections: 4,
  views: 0,
  objects: 14,
  dataSize: 1820,
  storageSize: 61440,
  indexes: 4,
  ...
  ok: 1
}
```

`objects` is the number of documents, and sizes are in bytes. Your numbers will be different. You don't need to understand every field yet.

## Setting up the course collections

Let's make sure your `shop` database has the three collections the course uses. If you've been following along, `products` already has data. Create the other two now:

```javascript
use shop
db.createCollection("customers")
db.createCollection("orders")

show collections
// → customers
//   orders
//   products
//   ... plus any extra practice collections you created
```

We'll fill `customers` and `orders` with documents in the next lesson.

## Common mistakes

- **Expecting `use mydb` to show up in `show dbs` immediately.** It appears only after you insert data.
- **Typos create new collections silently.** `db.prodcts.insertOne(...)` happily creates a new `prodcts` collection. Check with `show collections`.
- **Dropping the wrong database.** Always type `db` first to confirm where you are, especially when connected to Atlas.
- **Mixing up case.** `Products` and `products` are different collections. Pick one style (lowercase or camelCase) and stick to it.
- **Confusing `deleteMany({})` and `drop()`.** The first empties a collection but keeps its settings. The second removes the collection entirely.

## Practice

1. Create a database called `school` with a collection `students`, by inserting one student named Rahul.
2. List all collections in `school`, then rename `students` to `pupils`.
3. Without leaving `school`, count the documents in `shop.products`.
4. Finally, drop the `school` database.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1.
use school
db.students.insertOne({ name: "Rahul", grade: 7 })

// 2.
show collections
// → students
db.students.renameCollection("pupils")
// → { ok: 1 }

// 3.
db.getSiblingDB("shop").products.countDocuments()
// → the number of products you have, for example 7

// 4.
db
// → school   (always check first!)
db.dropDatabase()
// → { ok: 1, dropped: "school" }
```

</details>

## Key takeaways

- MongoDB is organised as **server → databases → collections → documents**.
- Databases and collections are created **automatically** on the first insert. Use `db.createCollection()` when you need options like validation or time series.
- Use `show dbs`, `show collections`, `renameCollection()`, `drop()` and `dropDatabase()` to manage them, and always check `db` before dropping.
- A **namespace** is `database.collection`, like `shop.products`.
- Follow the naming rules, and prefer short, lowercase or camelCase, plural names.

**Next lesson:** [Inserting Documents](/courses/mongodb/inserting-documents)
