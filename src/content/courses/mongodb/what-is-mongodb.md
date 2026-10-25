---
title: What is MongoDB 8? Documents and Collections
slug: what-is-mongodb
metadescription: A beginner-friendly introduction to MongoDB 8. Learn what a document database is, how documents and collections work, and why developers choose MongoDB.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'nosql', 'basics', 'documents']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What MongoDB is and what problem it solves
- What a **document** and a **collection** are
- How MongoDB stores data compared to a spreadsheet
- Where MongoDB is used in real projects

You do not need to install anything yet. Just read along and look at the examples.

## MongoDB in one sentence

**MongoDB is a database that stores your data as documents that look like JSON.**

A *database* is a place where an application keeps its data so it is still there tomorrow: user accounts, blog posts, orders, chat messages, and so on.

Most older databases (like MySQL or PostgreSQL) store data in **tables** made of rows and columns, a bit like an Excel sheet. MongoDB takes a different approach. It stores each record as a **document**, which is a set of `key: value` pairs, just like a JavaScript object.

> **Think of it like this:** A table-based database is like a filing cabinet where every form must have exactly the same boxes. MongoDB is like a folder of index cards. Each card describes one thing, and cards can have slightly different details written on them.

## What is a document?

A **document** is a single record. Here is a document that describes one user:

```javascript
{
  _id: ObjectId("6718a2f1c3b4e5d6f7a8b9c0"),
  name: "Asha Roy",
  email: "asha@example.com",
  age: 24,
  isMember: true,
  hobbies: ["painting", "cycling"],
  address: {
    city: "Kolkata",
    country: "India"
  }
}
```

Let's break it down:

| Part | Meaning |
| --- | --- |
| `_id` | A unique ID. MongoDB adds one automatically if you don't. |
| `name`, `email` | Text values (called *strings*). |
| `age` | A number. |
| `isMember` | A true/false value (a *boolean*). |
| `hobbies` | A list of values (an *array*). |
| `address` | A document inside a document (an *embedded document*). |

Notice how natural this is. If you have written JavaScript before, this looks exactly like an object. There is no need to split the address into a separate table or the hobbies into another table. Everything about Asha lives together in one place.

> **Note:** On disk MongoDB stores documents in a format called **BSON** (Binary JSON). BSON is faster to read and supports extra types like dates and `ObjectId`. You will learn about it in the *BSON Types and Document Structure* lesson. For now, just think "JSON".

## What is a collection?

A **collection** is a group of documents. If a document is one index card, a collection is the box that holds all the cards of the same kind.

For example, an online shop might have these collections:

- `users` – one document per customer
- `products` – one document per item for sale
- `orders` – one document per order

And a **database** is simply a group of collections. So the structure looks like this:

```text
MongoDB server
└── shop            (database)
    ├── users       (collection)
    │   ├── { name: "Asha", ... }      (document)
    │   └── { name: "Rahul", ... }     (document)
    ├── products    (collection)
    └── orders      (collection)
```

If you know SQL, here is a quick translation:

| SQL world | MongoDB world |
| --- | --- |
| Database | Database |
| Table | Collection |
| Row | Document |
| Column | Field |

## Documents in a collection can differ

In a SQL table, every row must have the same columns. In MongoDB, two documents in the same collection can have different fields. This is called a **flexible schema**.

```javascript
// Both documents can live in the same "products" collection
{ name: "Notebook", price: 49, pages: 200 }
{ name: "Headphones", price: 1999, color: "black", wireless: true }
```

A notebook has `pages`, headphones have `color` and `wireless`. MongoDB is happy to store both side by side.

> **Tip:** Flexible does not mean messy. In real apps you still keep documents in a collection *similar* to each other. Later in the course you'll learn **schema validation**, which lets you add rules when you want them.

## A first taste of MongoDB code

You talk to MongoDB using commands. The most common tool is **mongosh**, the MongoDB Shell. Here is what saving and reading a document looks like:

```javascript
// Save a new user into the "users" collection
db.users.insertOne({ name: "Asha Roy", age: 24 })

// Find every user who is 18 or older
db.users.find({ age: { $gte: 18 } })
```

Don't worry about the details yet. Just notice that the commands look like JavaScript and the data looks like JavaScript objects. That is a big reason MongoDB feels friendly to web developers.

## Why do developers like MongoDB?

1. **It matches how you code.** Your app already works with objects. MongoDB stores objects, so there is less converting back and forth.
2. **It is flexible.** You can add a new field to new documents without changing a table structure first.
3. **It scales.** MongoDB can spread data across many servers (called *sharding*) when your app grows.
4. **It has powerful queries.** You can filter, sort, group, join, and even run full-text and AI vector search.
5. **It runs anywhere.** On your laptop, on your own server, or in the cloud with **MongoDB Atlas**.

## What's new in MongoDB 8?

This course uses **MongoDB 8** (the 8.x line, up to **8.3**), which is what you get today when you install MongoDB Community on your own computer. MongoDB **9.0** was released in late 2026 and is rolling out on Atlas first, so you may see it mentioned. As a beginner you do not need to memorise new features, but it is good to know that version 8 brought:

- **Big speed improvements** for everyday reads and writes
- **Query settings**, a way to tell the database how to run a specific query
- A more powerful **bulkWrite** command that can write to many collections at once
- Better **Queryable Encryption**, so sensitive data can stay encrypted while you search it
- Newer releases also added hybrid search tools like `$rankFusion` and `$scoreFusion`

Everything you learn in the beginner lessons works the same way in older versions too.

## Where is MongoDB used?

- **Web and mobile apps** – user profiles, posts, comments, shopping carts
- **Content management** – blogs and news sites where each article has different fields
- **Real-time analytics** – counting clicks, views and events
- **IoT** – storing readings from sensors using *time series collections*
- **AI apps** – storing text and its vector embeddings for semantic search

## Common beginner mix-ups

- **"MongoDB has no structure."** It does: databases → collections → documents → fields. It just doesn't *force* every document to look identical.
- **"MongoDB stores JSON text."** It stores BSON, a binary version of JSON with extra types.
- **"NoSQL means no queries."** MongoDB has a very rich query language. "NoSQL" only means it does not use SQL tables.

## Practice

Try writing these on paper or in a text editor. There is no wrong place to practise.

1. Write a document for a book with a title, an author, a year, and a list of genres.
2. Which would you call the collection that holds all book documents?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. One book document
{
  title: "The Alchemist",
  author: "Paulo Coelho",
  year: 1988,
  genres: ["fiction", "adventure"]
}

// 2. A good collection name is plural and lowercase: "books"
```

</details>

## Key takeaways

- MongoDB is a **document database**. It stores records as JSON-like documents.
- A **document** is one record, made of fields (`key: value` pairs).
- A **collection** groups similar documents. A **database** groups collections.
- Documents can contain arrays and other documents, so related data stays together.
- This course uses MongoDB 8, but the basics are the same across versions (including the newer 9.0).

**Next lesson:** [SQL vs NoSQL: When to Use MongoDB](/courses/mongodb/sql-vs-nosql)
