---
title: ObjectId and the _id Field
slug: objectid-and-id-field
metadescription: Understand the _id field and ObjectId in MongoDB. Learn how ObjectIds are built, how to query by _id, and when to use your own custom IDs.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'objectid', 'primary-key', 'documents']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What the `_id` field is and the rules it follows
- What an **ObjectId** is made of, and how to read its creation time
- How to find a document by its `_id` (and the most common beginner mistake)
- When to use your own custom `_id` values instead
- How to work with ObjectIds in a Node.js app

## Every document needs an ID

Think about a school. Two students might both be called "Rahul Sharma", so the school gives each one a unique **roll number**. The roll number never repeats and never changes, so it always points to exactly one student.

In MongoDB, that roll number is the **`_id` field**.

> **Think of it like this:** `_id` is a document's roll number, or its Aadhaar or passport number. Names can repeat; the `_id` never does.

Every document in a normal collection **must** have an `_id`, and it must be **unique** within that collection. In SQL terms, `_id` is the **primary key**.

## MongoDB adds an _id for you

If you insert a document without an `_id`, one is created automatically:

```javascript
use shop

db.products.insertOne({ name: "Sketchbook", category: "stationery", price: 120, stock: 40, tags: ["paper", "art"] })
```

```javascript
{
  acknowledged: true,
  insertedId: ObjectId("6718d4e2a1b2c3d4e5f60718")
}
```

Look at the stored document:

```javascript
db.products.findOne({ name: "Sketchbook" })
```

```javascript
{
  _id: ObjectId("6718d4e2a1b2c3d4e5f60718"),
  name: "Sketchbook",
  category: "stationery",
  price: 120,
  stock: 40,
  tags: ["paper", "art"]
}
```

The `_id` is always the **first** field, even though we never typed it.

> **Note:** Strictly speaking, it's usually the **driver** (mongosh or your app's MongoDB library) that creates the ObjectId, just before sending the document. If one arrives without an `_id`, the server adds it. Either way, you get one.

## The rules of _id

| Rule | What it means |
| --- | --- |
| **Required** | Every document has one. MongoDB adds an ObjectId if you don't. |
| **Unique** | No two documents in the same collection can share an `_id`. |
| **Immutable** | Once a document is saved, its `_id` can't be changed. |
| **Indexed** | MongoDB automatically creates a unique index called `_id_` on every collection, so lookups by `_id` are very fast. |
| **Almost any type** | It can be an ObjectId, string, number, date or even a document. It **cannot** be an array, a regular expression or `undefined`. |

Uniqueness is only *per collection*. A product and an order *could* have the same `_id` value, because they live in different collections.

You can see the automatic index yourself:

```javascript
db.products.getIndexes()
// → [ { v: 2, key: { _id: 1 }, name: "_id_" } ]
```

## What is an ObjectId?

An **ObjectId** is MongoDB's default ID type. It's **12 bytes** long, usually written as **24 hexadecimal characters** (digits 0-9 and letters a-f):

```text
6718d4e2  a1b2c3d4e5  f60718
└──┬───┘  └────┬───┘  └──┬─┘
 time     random     counter
4 bytes   5 bytes    3 bytes
```

Each part has a job:

1. **Timestamp (4 bytes):** the moment the ObjectId was created, in seconds since 1 January 1970.
2. **Random value (5 bytes):** chosen once per running program (process), so two different computers or apps don't clash.
3. **Counter (3 bytes):** goes up by one for each new ObjectId the program makes, starting from a random number. This keeps IDs unique even within the same second.

> **Think of it like this:** An ObjectId is like a ticket stamped with *the time*, *which ticket machine printed it*, and *the ticket's serial number*. Even if two machines print tickets at the same second, the machine part is different, so the tickets never match.

Why not just use 1, 2, 3...? Because counting needs a central "counter keeper". With many app servers inserting at once, they'd all have to ask it for the next number, which is slow. ObjectIds can be made **anywhere, instantly**, with no coordination, and still be (almost certainly) unique.

### Creating ObjectIds yourself

In mongosh you can make a new one any time:

```javascript
new ObjectId()
// → ObjectId("6718d5f0a1b2c3d4e5f60719")
```

You can also rebuild one from its 24-character text form:

```javascript
ObjectId("6718d4e2a1b2c3d4e5f60718")
```

### Reading the creation time

Because the first part is a timestamp, every ObjectId knows roughly when it was created:

```javascript
const doc = db.products.findOne({ name: "Sketchbook" })
doc._id.getTimestamp()
// → ISODate("2026-10-25T08:15:30.000Z")
```

That's a free "created at" time for every document. It only has **one-second** accuracy, though.

### ObjectIds are roughly in time order

Since the time comes first, newer ObjectIds are usually "bigger" than older ones. So sorting by `_id` is close to sorting by creation time:

```javascript
db.products.find().sort({ _id: -1 }).limit(1)   // roughly the newest product
```

> **Warning:** This is only **roughly** right. IDs made in the same second, or by computers with different clocks, may be slightly out of order. If exact time order matters (like messages in a chat), store your own `createdAt: new Date()` field.

### ObjectId to text and back

Apps often need the ID as plain text, for example in a web address like `/products/6718d4e2a1b2c3d4e5f60718`.

```javascript
const id = doc._id
id.toString()
// → 6718d4e2a1b2c3d4e5f60718      (a plain string)
```

To turn that text back into an ObjectId, wrap it again: `ObjectId("6718d4e2a1b2c3d4e5f60718")`.

## Finding a document by _id

This is the fastest possible lookup, thanks to the automatic index:

```javascript
db.products.findOne({ _id: ObjectId("6718d4e2a1b2c3d4e5f60718") })
// → { _id: ObjectId("6718d4e2a1b2c3d4e5f60718"), name: "Sketchbook", ... }
```

### The number one beginner mistake

Searching with the ID as a **plain string**:

```javascript
db.products.findOne({ _id: "6718d4e2a1b2c3d4e5f60718" })
// → null
```

It returns `null`, even though the document exists! Why? An ObjectId and a string are **different types**. The string `"6718d4..."` is not equal to `ObjectId("6718d4...")`, just like the number `5` is not equal to the text `"five"`.

> **Tip:** If a lookup by `_id` mysteriously finds nothing, check you wrapped the value in `ObjectId(...)`.

## Using your own _id values

You don't *have* to use ObjectId. If your data already has a natural unique identifier, you can use it as the `_id`.

**A product code (SKU) as a string:**

```javascript
db.inventory.insertOne({ _id: "SKU-1001", name: "Notebook", stock: 120 })
// → { acknowledged: true, insertedId: "SKU-1001" }

db.inventory.findOne({ _id: "SKU-1001" })
// → { _id: "SKU-1001", name: "Notebook", stock: 120 }
```

**A number:**

```javascript
db.rooms.insertOne({ _id: 101, floor: 1, beds: 2 })
```

**A small document (a "compound" ID):**

```javascript
db.dailyStats.insertOne({ _id: { store: "Kolkata", day: "2026-10-25" }, sales: 54 })
```

### What happens with a duplicate?

Try inserting the same `_id` twice:

```javascript
db.inventory.insertOne({ _id: "SKU-1001", name: "Another Notebook" })
```

```text
MongoServerError: E11000 duplicate key error collection: shop.inventory index: _id_ dup key: { _id: "SKU-1001" }
```

**E11000** is the error code for "duplicate key". MongoDB refuses the insert, and the original document stays safe.

### ObjectId or custom ID?

| Use ObjectId (the default) when... | Use a custom `_id` when... |
| --- | --- |
| You have no natural unique value | You already have a value that is truly unique and never changes |
| Many app servers insert at the same time | You often look documents up by that value |
| You want a free creation timestamp | You want shorter, human-readable IDs (like `"SKU-1001"`) |

> **Warning:** Don't use something that might **change** as the `_id`, such as an email address or a phone number. People change emails, but an `_id` can never be updated. If you need it, you'd have to delete the document and insert a new one.

## You can't change an _id

Let's try to update one anyway:

```javascript
db.inventory.updateOne({ _id: "SKU-1001" }, { $set: { _id: "SKU-2002" } })
```

```text
MongoServerError: Performing an update on the path '_id' would modify the immutable field '_id'
```

MongoDB protects the `_id`. To "change" it, you would insert a copy with the new `_id` and delete the old document.

## Other kinds of unique IDs: UUID

Some systems prefer **UUIDs**, another popular unique ID format (36 characters with dashes). mongosh can create them:

```javascript
UUID()
// → UUID("3b241101-e2bb-4255-8caf-4136c566a962")

db.sessions.insertOne({ _id: UUID(), user: "Ken" })
```

mongosh stores a UUID as compact **binary data**, which is smaller and faster than saving the same text as a string.

## ObjectId in a Node.js app

In an app using the official Node.js driver, you import `ObjectId` from the `mongodb` package. A common case: a web route receives an ID as text and must find the document.

```javascript
import { MongoClient, ObjectId } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017");
const products = client.db("shop").collection("products");

async function getProduct(idFromUrl) {
  // Check the text looks like a valid ObjectId before using it
  if (!ObjectId.isValid(idFromUrl)) {
    return null;
  }
  return products.findOne({ _id: new ObjectId(idFromUrl) });
}

const product = await getProduct("6718d4e2a1b2c3d4e5f60718");
console.log(product?.name);
// → Sketchbook
```

Notice `new ObjectId(idFromUrl)`: the same "wrap the string" rule as in mongosh. Without it, the query would compare a string to an ObjectId and find nothing.

## Common mistakes

- **Querying by `_id` with a plain string.** Wrap it: `{ _id: ObjectId("...") }`. In Node.js: `new ObjectId(id)`.
- **Trying to update `_id`.** It's immutable. Insert a new document with the new ID and delete the old one.
- **Using changeable values (email, phone) as `_id`.** Use them as normal fields with a unique index instead.
- **Relying on ObjectId order for exact timing.** It's only roughly ordered and accurate to one second. Store a real `createdAt` date when order matters.
- **Mixing ID types in one collection.** If some documents use ObjectId and others use strings for the same purpose, lookups become confusing. Pick one style per collection.

## Practice

1. Insert a product without an `_id`, then print the time its ObjectId was created.
2. Create an `employees` collection where the `_id` is the employee code, like `"EMP-001"`, for an employee named Maria. Then find her by `_id`.
3. Explain why `db.products.findOne({ _id: "6718d4e2a1b2c3d4e5f60718" })` returns `null`, and fix the query.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1.
const result = db.products.insertOne({ name: "Paper Clips", category: "stationery", price: 20, stock: 300, tags: ["office"] })
result.insertedId.getTimestamp()
// → ISODate("2026-10-25T08:30:12.000Z")

// 2.
db.employees.insertOne({ _id: "EMP-001", name: "Maria Garcia", city: "Madrid" })
db.employees.findOne({ _id: "EMP-001" })
// → { _id: "EMP-001", name: "Maria Garcia", city: "Madrid" }

// 3. The _id is stored as an ObjectId, but the query uses a string.
//    Different types never match. Wrap the value in ObjectId():
db.products.findOne({ _id: ObjectId("6718d4e2a1b2c3d4e5f60718") })
```

</details>

## Key takeaways

- `_id` is every document's **unique, required, unchangeable** ID, MongoDB's version of a primary key.
- If you don't provide one, you get an **ObjectId**: 12 bytes made of a timestamp, a random value and a counter.
- `getTimestamp()` reveals when an ObjectId was created, and sorting by `_id` is roughly sorting by creation time.
- Query with `ObjectId("...")`, not a plain string, or nothing will match.
- Custom `_id` values (like `"SKU-1001"`) are fine when they're truly unique and never change. Duplicates fail with error **E11000**.

**Next lesson:** [Databases, Collections and Namespaces](/courses/mongodb/databases-and-collections)
