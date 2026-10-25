---
title: "SQL vs NoSQL: When to Use MongoDB"
slug: sql-vs-nosql
metadescription: Compare SQL and NoSQL databases in plain words. See the same data stored both ways and learn when MongoDB is a good fit and when SQL is better.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'nosql', 'sql', 'basics']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What "SQL" and "NoSQL" actually mean
- How the same data looks in a SQL table and in a MongoDB document
- The main differences: schema, relationships, scaling and transactions
- When MongoDB is a great choice, and when a SQL database may suit you better

You still don't need to install anything. This lesson is about understanding the *why* before we start typing commands.

## Two families of databases

Almost every database you will meet belongs to one of two big families.

**SQL databases** (also called *relational databases*) store data in **tables** with fixed columns. You talk to them using **SQL** (Structured Query Language). Popular examples are MySQL, PostgreSQL, SQL Server, Oracle and SQLite.

**NoSQL databases** are everything that does *not* use the classic table-and-SQL model. "NoSQL" is best read as **"Not only SQL"**. It is a big umbrella with several kinds of databases under it.

> **Think of it like this:** A SQL database is like a set of spreadsheets that are carefully linked together. A NoSQL document database like MongoDB is like a set of folders, where each folder holds complete files about one thing each.

### The four main kinds of NoSQL database

| Kind | How it stores data | Example |
| --- | --- | --- |
| **Document** | JSON-like documents grouped in collections | MongoDB |
| **Key-value** | A simple lookup: one key, one value | Redis |
| **Wide-column** | Rows with flexible, very wide sets of columns | Apache Cassandra |
| **Graph** | Nodes and the connections between them | Neo4j |

MongoDB is a **document database**. That is the only kind we will focus on in this course.

## The same data, stored two ways

Let's store one customer and their two orders. Seeing both versions side by side is the fastest way to feel the difference.

### The SQL way: split into tables

In a relational database you usually split data into several tables and link them with IDs.

```sql
-- Table 1: customers
CREATE TABLE customers (
  id    INT PRIMARY KEY,
  name  VARCHAR(100),
  email VARCHAR(100),
  city  VARCHAR(50)
);

-- Table 2: orders (each order points to a customer)
CREATE TABLE orders (
  id          INT PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  total       INT,
  status      VARCHAR(20)
);

-- Table 3: order_items (each item points to an order)
CREATE TABLE order_items (
  order_id INT REFERENCES orders(id),
  product  VARCHAR(100),
  qty      INT,
  price    INT
);
```

To show "Asha's orders with their items", SQL joins the three tables back together:

```sql
SELECT c.name, o.id, o.status, i.product, i.qty
FROM customers c
JOIN orders o      ON o.customer_id = c.id
JOIN order_items i ON i.order_id = o.id
WHERE c.email = 'asha@example.com';
```

This design is called **normalisation**: every fact is stored once, in exactly one place.

### The MongoDB way: keep related data together

In MongoDB you can store an order as one document, with its items inside it:

```javascript
// One document in the "orders" collection
{
  _id: ObjectId("6718b1c2d3e4f5a6b7c8d9e0"),
  customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0"),
  items: [
    { name: "Notebook", qty: 2, price: 49 },
    { name: "Gel Pen", qty: 5, price: 15 }
  ],
  total: 173,
  status: "shipped",
  createdAt: ISODate("2026-10-20T10:30:00Z")
}
```

The items live *inside* the order, as an array. When your app shows this order, it reads **one document** and gets everything it needs. No joins required.

Fetching it is short and readable:

```javascript
db.orders.find({ customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") })
```

> **Note:** MongoDB *can* link documents across collections too (here, `customerId` points to a customer). It also has a `$lookup` stage that works like a join. You'll learn it later in [Joining Collections with lookup](/courses/mongodb/lookup-and-joins).

## Key difference 1: the schema

A **schema** is the shape of your data: which fields exist and what type each one is.

| | SQL | MongoDB |
| --- | --- | --- |
| Where is the schema defined? | In the database, before you insert anything (`CREATE TABLE`) | Mostly in your app; optional rules in the database |
| Adding a new field | Run `ALTER TABLE` to add a column | Just start saving documents with the new field |
| Can rows/documents differ? | No, every row has the same columns | Yes, documents in a collection can have different fields |

Here are two products in the same MongoDB collection with different fields. This is perfectly fine:

```javascript
{ name: "Notebook", price: 49, tags: ["paper", "school"] }
{ name: "Headphones", price: 1999, tags: ["audio", "wireless"], rating: 4.5 }
```

Only the headphones have a `rating`. In SQL, the notebook row would need a `rating` column too, probably set to `NULL`.

> **Tip:** Flexible is not the same as "no rules". When you want the database to enforce a shape, MongoDB offers [Schema Validation with JSON Schema](/courses/mongodb/schema-validation).

## Key difference 2: relationships

SQL databases are built around relationships between tables. Joins are their superpower.

MongoDB gives you two choices:

1. **Embed** related data inside one document (like the order items above).
2. **Reference** another document by its `_id` (like `customerId`) and look it up when needed.

A simple rule of thumb that works for most beginners:

> **Think of it like this:** If two pieces of data are usually read *together*, keep them *together* in one document. If something is shared by many documents or grows without limit, store it separately and reference it.

You'll go deeper in [Embedding vs Referencing](/courses/mongodb/schema-design-embedding-vs-referencing).

## Key difference 3: scaling

**Scaling** means handling more data and more users.

- **Vertical scaling (scale up):** buy a bigger server with more CPU, RAM and disk. Both SQL and MongoDB can do this.
- **Horizontal scaling (scale out):** spread data across *many* servers. MongoDB has this built in, through **sharding**. Many SQL databases need extra tools or careful manual setup to do the same.

> **Think of it like this:** Vertical scaling is buying a bigger truck. Horizontal scaling is adding more trucks to your fleet.

As a beginner you won't need sharding for a long time. It's just good to know MongoDB was designed to grow this way.

## Key difference 4: transactions

A **transaction** is a group of changes that either *all* succeed or *all* fail. Think of moving money: you must take it from one account *and* add it to the other, never just one half.

- SQL databases have always been strong at transactions.
- MongoDB guarantees that a write to **a single document** is always all-or-nothing. Because related data often lives in one document, many apps rarely need more.
- When you do need to change several documents together, MongoDB supports **multi-document ACID transactions** too. They need a *replica set* (a group of copied servers). MongoDB Atlas clusters are replica sets by default.

You'll learn the details in [Transactions and ACID Guarantees](/courses/mongodb/transactions).

## Same question, two languages

Here are a few everyday questions written in both SQL and MongoDB's query language. Don't memorise these. Just notice how similar the ideas are.

**Find stationery under 50:**

```sql
SELECT name, price FROM products
WHERE category = 'stationery' AND price < 50;
```

```javascript
db.products.find(
  { category: "stationery", price: { $lt: 50 } },
  { name: 1, price: 1, _id: 0 }
)
// → [ { name: "Notebook", price: 49 }, { name: "Gel Pen", price: 15 } ]
```

**Add a new product:**

```sql
INSERT INTO products (name, category, price, stock)
VALUES ('Coffee Mug', 'kitchen', 249, 60);
```

```javascript
db.products.insertOne({ name: "Coffee Mug", category: "kitchen", price: 249, stock: 60 })
```

**Change the price of one product:**

```sql
UPDATE products SET price = 279 WHERE name = 'USB Cable';
```

```javascript
db.products.updateOne({ name: "USB Cable" }, { $set: { price: 279 } })
```

**Count products per category:**

```sql
SELECT category, COUNT(*) FROM products GROUP BY category;
```

```javascript
db.products.aggregate([
  { $group: { _id: "$category", count: { $sum: 1 } } }
])
```

### A quick translation table

| SQL term | MongoDB term |
| --- | --- |
| Database | Database |
| Table | Collection |
| Row | Document |
| Column | Field |
| Primary key | `_id` field |
| `JOIN` | Embedding, or the `$lookup` stage |
| `GROUP BY` | `$group` stage in an aggregation pipeline |
| Index | Index (same idea!) |

## When is MongoDB a great fit?

MongoDB shines when:

- **Your data is naturally "object shaped".** User profiles, product catalogues, blog posts, orders with items. Things you'd describe as a JavaScript object.
- **Your data changes shape often.** New features mean new fields, and you don't want a migration for every small change.
- **Different records need different fields.** A catalogue where a book has `pages` and a phone has `batteryLife`.
- **You need to grow big.** Lots of data, lots of users, many servers.
- **You want one place for many features.** MongoDB (especially on Atlas) adds full-text search, vector search for AI apps, time series data and change streams on top of normal queries.
- **You're building with JavaScript.** Documents look just like JS objects, so there is little converting back and forth.

## When might SQL be a better fit?

SQL is often the simpler choice when:

- **Your data is very tabular and stable.** For example, accounting ledgers with fixed columns that rarely change.
- **You need lots of complex joins** across many tables, and most questions cut across the whole dataset in different ways.
- **Your team or tools are already SQL-based.** Reporting tools, existing skills and existing systems matter.
- **You rely on heavy reporting** written in SQL by analysts.

> **Note:** This is not a war. Many real companies use both: MongoDB for the app's main data and a SQL database or data warehouse for reporting. Pick the tool that fits the job.

## A simple decision checklist

Ask yourself these questions about your project:

1. Does each "thing" in my app look like an object with nested details? → leans **MongoDB**
2. Will the shape of my data change as the app grows? → leans **MongoDB**
3. Do I mostly read one thing at a time (one user, one order, one post)? → leans **MongoDB**
4. Is my data a fixed grid that is mainly analysed with joins and reports? → leans **SQL**
5. Is my team already expert in SQL with tools built around it? → leans **SQL**

If most answers lean one way, you have your answer. If it's a mix, either can work, and good design matters more than the choice.

## Common mistakes

- **Copying SQL tables directly into MongoDB.** Creating a separate collection for every SQL table, then joining them all the time, throws away MongoDB's biggest advantage. Design around how your app *reads* data.
- **Thinking "flexible schema" means "no planning".** Documents in a collection should still be similar. Decide on field names and types early, and add validation when the app matures.
- **Believing MongoDB can't do transactions.** It can. Single-document writes are always atomic, and multi-document transactions are available on replica sets.
- **Embedding everything forever.** An array that grows without limit (like every page view a user ever made) will eventually make documents too big. Some data belongs in its own collection.
- **Choosing a database because it's trendy.** Choose based on your data and your team, not on hype.

## Practice

1. Write a single MongoDB document for a blog post that has a title, an author name, a list of tags and two comments (each comment has a name and a text).
2. In a SQL design, how many tables would you probably use for the same data? Name them.
3. A school wants to store exam marks: every student has exactly the same 5 subjects, and the data is mostly used for printed reports with averages. Which database family leans as the better fit, and why?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. One blog post document with embedded comments
{
  title: "My First Week with MongoDB",
  author: "Priya",
  tags: ["mongodb", "beginners"],
  comments: [
    { name: "Rahul", text: "Great post!" },
    { name: "Maria", text: "Very helpful, thanks." }
  ]
}

// 2. Probably three or four tables:
//    posts, comments, tags and a post_tags linking table

// 3. SQL leans as the better fit: the data is a fixed grid
//    (same 5 subjects for everyone) and it is mainly used for reports.
//    MongoDB would also work, but it has no special advantage here.
```

</details>

## Key takeaways

- **SQL databases** store data in linked tables with a fixed schema. **NoSQL** means "not only SQL" and includes document, key-value, wide-column and graph databases.
- MongoDB is a **document database**: related data can live together in one document, so many reads need no joins.
- MongoDB has a **flexible schema**, built-in **horizontal scaling** (sharding) and supports **transactions** when you need them.
- MongoDB fits object-shaped, evolving data. SQL fits stable, tabular data with heavy joins and reports.
- Many teams use both. Design for how your app reads and writes data.

**Next lesson:** [Installing MongoDB Community 8](/courses/mongodb/installing-mongodb)
