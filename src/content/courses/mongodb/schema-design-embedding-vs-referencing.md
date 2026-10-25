---
title: Embedding vs Referencing
slug: schema-design-embedding-vs-referencing
metadescription: Learn when to embed related data inside one MongoDB document and when to store it in a separate collection and link it with a reference.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'schema-design', 'data-modelling', 'relationships']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What **embedding** and **referencing** mean in MongoDB
- The golden rule of MongoDB schema design: *data that is used together is stored together*
- How to model one-to-one, one-to-many and many-to-many relationships
- The warning signs that tell you to switch from embedding to referencing
- How to read referenced data back with a second query or `$lookup`

> **Before you start:** this lesson assumes you've read [Embedded Documents and Dot Notation](/courses/mongodb/embedded-documents) and finished the [Beginner Project: A Library Database](/courses/mongodb/beginner-project-library-database).

## Why schema design still matters

MongoDB has a *flexible schema*. You can put almost any shape of document into a collection. That freedom is great, but it also means **you** decide how related pieces of data are stored.

In a SQL database the answer is almost always the same: split everything into tables and join them later. In MongoDB you have two choices every time two things are related:

1. **Embed** the related data inside the same document.
2. **Reference** it: store it in its own document (often in another collection) and keep only its `_id`.

Picking well makes your app fast and your code simple. Picking badly leads to huge documents or lots of slow extra queries.

> **Think of it like this:** Embedding is like writing a friend's phone number directly in your diary next to their name. Referencing is like writing "see contact #42" and keeping the details in a separate address book. The first is faster to read. The second is easier to keep up to date when many pages point to the same person.

## Embedding: keep it in one document

**Embedding** means putting related data *inside* the parent document, as a sub-document or an array.

Here is a customer with their address embedded:

```javascript
use shop

db.customers.insertOne({
  name: "Asha Roy",
  email: "asha@example.com",
  city: "Kolkata",
  isMember: true,
  joinedAt: ISODate("2026-01-15"),
  address: {
    line1: "12 Park Street",
    city: "Kolkata",
    pin: "700016"
  }
})
// → { acknowledged: true, insertedId: ObjectId("...") }
```

Reading the customer and their address is a single, fast query:

```javascript
db.customers.findOne({ email: "asha@example.com" })
```

### Why embedding is often the best choice

- **One read gets everything.** No second query, no join.
- **Atomic updates.** A write to a single document is always all-or-nothing, so you can update the customer and their address together safely.
- **Simple code.** The document looks just like the object your app already uses.

### When embedding becomes a problem

- **The 16 MB limit.** A single MongoDB document cannot be bigger than 16 MB. An array that keeps growing forever will eventually hit it.
- **Big documents are slow.** Even below 16 MB, loading a 2 MB document just to show a name wastes memory and network.
- **Duplicated data.** If you embed the same thing in many places (for example, a product's full details inside every order), changing it means updating many documents.

## Referencing: link to another document

**Referencing** means storing related data in its own document and keeping only its `_id` (or another unique key) in the parent. This is similar to a *foreign key* in SQL.

Here an order references the customer who placed it:

```javascript
const asha = db.customers.findOne({ email: "asha@example.com" })

db.orders.insertOne({
  customerId: asha._id,          // reference to the customers collection
  items: [
    { productId: ObjectId("..."), name: "Notebook", qty: 2, price: 49 }
  ],
  total: 98,
  status: "pending",
  createdAt: new Date()
})
```

To show the order *with* the customer's name, you need a second step. The simplest way is two queries:

```javascript
const order = db.orders.findOne({ status: "pending" })
const customer = db.customers.findOne({ _id: order.customerId })
```

Or you can let MongoDB do the join with the `$lookup` aggregation stage:

```javascript
db.orders.aggregate([
  { $match: { status: "pending" } },
  { $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
  } }
])
// → [{ _id: ..., total: 98, status: "pending", customer: [ { name: "Asha Roy", ... } ] }]
```

> **Note:** You will learn `$lookup` properly in [Joining Collections with lookup](/courses/mongodb/lookup-and-joins). For now, just know that joins exist in MongoDB, but they cost more than reading one document.

### Why referencing is useful

- **No duplication.** The customer lives in one place. Change their email once and every order sees it.
- **Small parent documents.** Orders stay light even if a customer has thousands of them.
- **Independent access.** You can list, search and update customers without touching orders.

## The golden rule

MongoDB's own advice can be summed up in one line:

> **Tip:** **Data that is accessed together should be stored together.** Start by asking "which screens or API calls read this data?" not "what are the entities?"

If your product page always shows the product with its three latest reviews, those reviews probably belong *in* the product document. If reviews are only shown on a separate "all reviews" page, they can live in their own collection.

## Modelling relationships

Let's walk through the common relationship types and the usual choice for each.

### One-to-one

A customer has one address, one profile picture, one settings object. **Embed it.** There is almost never a reason to split a one-to-one relationship.

```javascript
{
  name: "Rahul Sen",
  email: "rahul@example.com",
  settings: { theme: "dark", newsletter: true }
}
```

### One-to-few

A customer has a handful of saved addresses (home, office). The number is small and won't grow much. **Embed an array.**

```javascript
{
  name: "Priya Nair",
  addresses: [
    { label: "home",   city: "Kochi" },
    { label: "office", city: "Bengaluru" }
  ]
}
```

### One-to-many

A customer places many orders over the years: dozens, maybe hundreds. Orders are also viewed on their own (order details page, admin dashboard). **Reference**: each order stores `customerId`.

```javascript
// orders collection
{ customerId: ObjectId("..."), total: 98, status: "shipped" }
{ customerId: ObjectId("..."), total: 1999, status: "delivered" }
```

> **Tip:** Put the reference on the "many" side (the order points to the customer), not as a giant array of order IDs on the customer. That way the customer document never grows.

### One-to-squillions

A sensor sends a reading every second, forever. That is millions of child documents. **Always reference**, from the child to the parent, and never embed or keep an array of IDs.

```javascript
// sensorReadings collection
{ sensorId: "kitchen-1", temp: 24.5, at: ISODate("2026-10-25T08:00:00Z") }
```

### Many-to-many

A product can have many tags, and a tag belongs to many products. In our `shop` data we simply **embed** the tag names as an array, because tags are tiny and rarely change:

```javascript
{ name: "Notebook", tags: ["paper", "school"] }
```

When both sides are big documents (for example students and courses), store an array of references on one or both sides:

```javascript
// students
{ _id: 1, name: "Ken", courseIds: [101, 102] }

// courses
{ _id: 101, title: "Databases 101" }
```

## A quick decision table

| Question | Lean towards embedding | Lean towards referencing |
| --- | --- | --- |
| Is the related data read together with the parent? | Yes, almost always | No, often on its own |
| How many related items? | A few, with a known upper limit | Many, or no upper limit |
| Does the related data change often? | Rarely | Often, and from many places |
| Is the same data shared by many parents? | No | Yes |
| Must parent and child be updated atomically? | Yes | Not necessarily |

## Mixing both: the hybrid approach

You don't have to choose one or the other for a whole relationship. A very common trick is to **reference the full record but embed a few fields you always need**.

Our `orders` already do this. Each item stores the `productId` (a reference) *and* a copy of `name` and `price` at the time of purchase:

```javascript
items: [
  { productId: ObjectId("..."), name: "Gel Pen", qty: 3, price: 15 }
]
```

Now the order page can show "3 x Gel Pen at 15" with one read, and you can still look up the full product if needed. As a bonus, the price in the order stays correct even if the product's price changes next month.

> **Note:** This trick has a name, the **extended reference pattern**. You'll meet it, and several other patterns, in the next lesson.

## Warning signs

Watch out for these, they usually mean your schema needs a change:

- An array that grows every time something happens (every view, every log line, every comment).
- Documents measured in megabytes.
- You keep running `$lookup` for the most common page in your app.
- You update the same copied value in thousands of documents every day.

## Common mistakes

- **Designing like SQL.** Splitting every sub-object into its own collection gives you lots of joins and none of MongoDB's benefits. Start by embedding and split only when you have a reason.
- **Unbounded arrays.** Storing every order ID inside the customer document. Put the reference on the child side instead.
- **Embedding shared data that changes.** Copying a customer's full profile into every order means a change of phone number touches every order. Embed only the stable fields you need for display.
- **Forgetting the read pattern.** Choosing a schema without knowing which queries are most frequent. Write your top 3 queries down first.
- **Forgetting an index on the reference field.** If you look up orders by `customerId`, that field needs an index (coming soon in [Single Field and Compound Indexes](/courses/mongodb/indexes-single-and-compound)).

## Practice

1. A blog post has one author and up to about 20 comments that are always shown on the post page. Design the `posts` document.
2. A video platform stores every "like" with the user who liked it. Popular videos get millions of likes. How would you store likes?
3. For each order item, which fields would you embed and which would you reference?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Embed the comments (few, always read together) and a small author summary
{
  title: "My First Post",
  author: { _id: ObjectId("..."), name: "Maria" },  // extended reference
  body: "Hello world",
  comments: [
    { name: "Asha", text: "Nice post!", at: ISODate("2026-10-20") }
  ]
}

// 2. Millions of likes: one document per like, referencing both sides
// likes collection
{ videoId: ObjectId("..."), userId: ObjectId("..."), at: new Date() }
// Optionally keep a simple counter on the video: { title: "...", likeCount: 1250000 }

// 3. Reference productId; embed name and price (as they were at purchase time) and qty
{ productId: ObjectId("..."), name: "Coffee Mug", qty: 1, price: 249 }
```

</details>

## Key takeaways

- **Embedding** stores related data inside one document. It gives fast, atomic, single-query reads.
- **Referencing** stores an `_id` that points to another document. It avoids duplication and keeps documents small.
- Follow the golden rule: **data used together is stored together**.
- Embed one-to-one and one-to-few; reference one-to-many (from the child) and always reference one-to-squillions.
- Hybrid designs that reference a record but embed a few display fields are common and powerful.
- Never let an array grow without limit; documents have a 16 MB cap.

**Next lesson:** [Data Modelling Patterns](/courses/mongodb/data-modelling-patterns)
