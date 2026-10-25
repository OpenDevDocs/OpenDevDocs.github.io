---
title: "Mongoose ODM: Schemas, Models and Middleware"
slug: mongoose-odm
metadescription: Learn Mongoose 9 step by step. Define schemas and models, validate data, run pre and post middleware, and join documents with populate.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 4
tags: ['mongodb', 'mongoose', 'nodejs', 'odm']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What an **ODM** is and when Mongoose is worth using
- How to define a **schema** and turn it into a **model**
- How Mongoose **validates** data before it reaches MongoDB
- How **middleware** (pre and post hooks) lets you run code around saves and queries
- How **populate** fills in referenced documents for you

> **Before you start:** this lesson assumes you've read [Node.js Driver and Connection Pooling](/courses/mongodb/nodejs-driver-and-connection-pooling) and [Embedding vs Referencing](/courses/mongodb/schema-design-embedding-vs-referencing).

## What is an ODM?

**ODM** stands for *Object Document Mapper*. It is a library that sits between your code and the database and gives your documents a fixed shape, rules and helper methods.

The plain `mongodb` driver is happy to save anything. A typo like `prcie: 49` goes straight into the database. **Mongoose** adds a layer that says "a product must have a name, and its price must be a number of at least 0" and stops bad data early.

> **Think of it like this:** The plain driver is a blank notebook. Mongoose is a printed form with labelled boxes. You can still write what you need, but the form makes it hard to forget a box or write a word where a number should go.

| Plain driver | Mongoose |
| --- | --- |
| No built-in shape for documents | Schemas describe every field |
| You write validation yourself | Built-in validators (required, min, enum, ...) |
| Raw documents | Model instances with methods |
| Manual `$lookup` or extra queries for references | `populate()` helper |
| A bit faster, less overhead | A bit slower, more convenience |

## Which version?

The current major version of Mongoose is **9.x** (released November 2025). Mongoose 8.x is still maintained, but new projects should start on 9. Mongoose 9 uses the MongoDB Node.js driver 7 under the hood and needs **Node.js 20.19 or newer**.

```bash
npm install mongoose
```

> **Note:** The biggest change in Mongoose 9 is that **pre middleware no longer receives a `next()` callback**. You write hooks as `async` functions instead. If you copy older tutorials that call `next()`, they will break. This lesson uses the modern style.

## Connecting

Mongoose keeps one default connection (with its own driver pool) for the whole app. Connect once at startup:

```javascript
// db.js
import mongoose from "mongoose";

export async function connectDb() {
  await mongoose.connect(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/shop", {
    maxPoolSize: 20 // driver pool options work here too
  });
  console.log("Mongoose connected to", mongoose.connection.name);
}
// → Mongoose connected to shop
```

The database name (`shop`) comes from the end of the URI. To close the connection at shutdown, call `await mongoose.disconnect()`.

## Schemas: describing your documents

A **schema** lists the fields a document can have, their types and their rules. Let's describe a product from our shop:

```javascript
// models/Product.js
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["stationery", "electronics", "kitchen"]
    },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    tags: [String],
    rating: { type: Number, min: 1, max: 5 }
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);
```

Let's read it line by line:

- `type` says what kind of value the field holds.
- `required: true` means the field must be present.
- `trim: true` removes spaces at the start and end of text.
- `enum` lists the only allowed values.
- `min` and `max` set number limits.
- `default` fills in a value when none is given.
- `tags: [String]` means "an array of strings".
- `{ timestamps: true }` asks Mongoose to manage `createdAt` and `updatedAt`.

## Models: the tool you actually use

A **model** is a class built from a schema. It is linked to one collection and has all the CRUD methods.

```javascript
// models/Product.js (continued)
export const Product = mongoose.model("Product", productSchema);
```

Mongoose turns the name `"Product"` into the collection name `products` (lowercase and plural). That matches our running example.

Now use it:

```javascript
import { connectDb } from "./db.js";
import { Product } from "./models/Product.js";

await connectDb();

// Create
const mug = await Product.create({
  name: "  Coffee Mug ",
  category: "kitchen",
  price: 249,
  stock: 60,
  tags: ["ceramic", "gift"],
  rating: 4.8
});
console.log(mug.name, mug.createdAt);
// → Coffee Mug 2026-10-25T08:00:00.000Z   (spaces trimmed, timestamp added)

// Read
const cheap = await Product.find({ price: { $lt: 100 } }).sort({ price: 1 });
console.log(cheap.map((p) => p.name));
// → [ 'Gel Pen', 'Notebook' ]

// Update
const updated = await Product.findOneAndUpdate(
  { name: "Gel Pen" },
  { $inc: { stock: -10 } },
  { returnDocument: "after" }
);
console.log(updated.stock);
// → 490

// Delete
await Product.deleteOne({ name: "USB Cable" });
```

Filters and update operators are exactly the MongoDB ones you already know. Mongoose just adds checks and conveniences around them.

> **Tip:** In Mongoose 9, prefer `returnDocument: "after"` over the older `new: true` option, which is now deprecated.

### lean(): when you only need plain data

Every result from `find()` is a full Mongoose **document** with methods and change tracking. That costs memory. For read-only API responses, add `.lean()` to get plain JavaScript objects:

```javascript
const list = await Product.find({ category: "stationery" }).lean();
// → [{ _id: ..., name: 'Notebook', price: 49, ... }, ...]  (plain objects, faster)
```

## Validation

Validation runs automatically when you call `save()` or `create()`. Let's try to save a broken product:

```javascript
try {
  await Product.create({ name: "Broken Pen", category: "toys", price: -5 });
} catch (err) {
  console.log(err.name);
  console.log(Object.keys(err.errors));
  console.log(err.errors.price.message);
}
```

Output:

```text
ValidationError
[ 'category', 'price' ]
Path `price` (-5) is less than minimum allowed value (0).
```

Nothing was written to MongoDB. Mongoose caught both mistakes before sending the insert.

### Custom validators

You can write your own rule with `validate`:

```javascript
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    lowercase: true,
    validate: {
      validator: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
      message: (props) => `${props.value} is not a valid email`
    }
  },
  city: String,
  isMember: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now }
});

export const Customer = mongoose.model("Customer", customerSchema);
```

### Validation on updates

Here is a trap. By default, validators **do not run** on `updateOne`, `updateMany` or `findOneAndUpdate`. Turn them on with `runValidators`:

```javascript
await Product.updateOne(
  { name: "Notebook" },
  { $set: { price: -1 } },
  { runValidators: true }
);
// → throws ValidationError: price is less than minimum allowed value (0)
```

> **Warning:** Mongoose validation only protects writes that go **through Mongoose**. Another script using the plain driver or mongosh can still write bad data. For a hard guarantee, also add [JSON Schema validation](/courses/mongodb/schema-validation) on the collection.

## Middleware: pre and post hooks

**Middleware** (also called *hooks*) is code that runs automatically before (`pre`) or after (`post`) an action, such as `save` or `find`.

> **Think of it like this:** Middleware is the security check at an airport. Every passenger (document) goes through it before boarding (saving), and you only had to set up the gate once.

In `models/Product.js`, put the hook code below **between** the schema definition and the `mongoose.model(...)` line. Order matters, as you'll see in a moment.

### A pre('save') hook

Let's keep a `slug` field in sync with the product name, so URLs look like `/products/coffee-mug`:

```javascript
productSchema.add({ slug: { type: String, index: true } });

productSchema.pre("save", async function () {
  // "this" is the document being saved
  if (this.isModified("name")) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, "-");
  }
});
```

Notice three things:

1. We use a normal `function`, not an arrow function, so `this` points to the document.
2. The hook is `async` and has **no `next` parameter** (Mongoose 9 style).
3. `this.isModified("name")` makes sure we only rebuild the slug when the name changes.

To stop a save, just throw an error inside the hook:

```javascript
productSchema.pre("save", async function () {
  if (this.category === "electronics" && this.price < 100) {
    throw new Error("Electronics must cost at least 100");
  }
});
```

> **Note:** Add hooks to the schema **before** calling `mongoose.model(...)`. Hooks added afterwards are ignored.

### A post('save') hook

Post hooks run after the action finishes and receive the saved document. They are good for logging or sending events:

```javascript
productSchema.post("save", function (doc) {
  console.log(`Saved product ${doc.name} (${doc._id})`);
});
// → Saved product Coffee Mug (6718a2f1c3b4e5d6f7a8b9c0)
```

### Query middleware

Hooks can also run around queries. Here `this` is the **query**, not a document. A classic use is *soft delete*: hide archived products from every `find`:

```javascript
productSchema.add({ archived: { type: Boolean, default: false } });

productSchema.pre(/^find/, function () {
  // runs before find, findOne, findOneAndUpdate, ...
  this.where({ archived: { $ne: true } });
});
```

Now `Product.find()` automatically skips archived products.

> **Warning:** `save` hooks run for `doc.save()` and `Model.create()`, but **not** for `updateOne()`, `findOneAndUpdate()` or `insertMany()`. Those methods have their own hooks (`pre("updateOne")`, `pre("findOneAndUpdate")`, `pre("insertMany")`). Pick the hook that matches the method you actually call.

## Populate: following references

In the [Embedding vs Referencing](/courses/mongodb/schema-design-embedding-vs-referencing) lesson, orders stored a `customerId`. With Mongoose you declare that link with `ref`:

```javascript
// models/Order.js
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: String,
        qty: { type: Number, min: 1 },
        price: Number
      }
    ],
    total: Number,
    status: { type: String, enum: ["pending", "shipped", "delivered"], default: "pending" }
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
```

Now `populate()` replaces the ID with the real customer document:

```javascript
const order = await Order.findOne({ status: "pending" })
  .populate("customerId", "name email city") // only these customer fields
  .lean();

console.log(order.customerId);
// → { _id: ObjectId("..."), name: 'Asha Roy', email: 'asha@example.com', city: 'Kolkata' }
```

You can populate inside arrays too:

```javascript
await Order.find().populate("items.productId", "name stock");
```

> **Tip:** `populate()` runs an **extra query** per path behind the scenes. That is fine for a few documents, but on big lists it can be slow. For heavy reporting, an aggregation with `$lookup` (or embedding the data you always need) is usually faster.

## Instance methods and statics

You can add your own helpers to a schema:

```javascript
// on a single document
productSchema.methods.isInStock = function () {
  return this.stock > 0;
};

// on the model itself
productSchema.statics.findByCategory = function (category) {
  return this.find({ category });
};

// usage
const pen = await Product.findOne({ name: "Gel Pen" });
console.log(pen.isInStock()); // → true

const kitchen = await Product.findByCategory("kitchen");
```

## Common mistakes

- **Using arrow functions in hooks or methods.** Arrow functions don't have their own `this`, so `this.isModified` crashes. Use `function () {}`.
- **Calling `next()` in Mongoose 9.** Pre hooks no longer get `next`. Make the hook `async` and `throw` to stop it.
- **Expecting validation on updates.** Pass `{ runValidators: true }` to update methods, or validators are skipped.
- **Defining hooks after `mongoose.model()`.** Register all hooks, methods and statics first, then create the model.
- **Populating huge lists.** Each populate is another query. Use `.lean()`, select few fields, or use `$lookup` for big reports.

## Practice

1. Write a `Customer` schema where `email` is required and lowercase, and `isMember` defaults to `false`.
2. Add a `pre("save")` hook to the `Order` schema that calculates `total` from `items` (qty × price).
3. Fetch the 5 newest orders and populate only the customer's `name`.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1.
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  city: String,
  isMember: { type: Boolean, default: false }
});
const Customer = mongoose.model("Customer", customerSchema);

// 2. (register before mongoose.model("Order", orderSchema))
orderSchema.pre("save", async function () {
  this.total = this.items.reduce((sum, item) => sum + item.qty * item.price, 0);
});

// 3.
const latest = await Order.find()
  .sort({ createdAt: -1 })
  .limit(5)
  .populate("customerId", "name")
  .lean();
```

</details>

## Key takeaways

- Mongoose is an **ODM**: schemas give documents a shape, models give you CRUD methods.
- Built-in validators (`required`, `min`, `enum`, custom `validate`) stop bad data before it is written. Use `runValidators` for updates.
- **Middleware** runs code before or after saves and queries. In Mongoose 9, write pre hooks as `async` functions without `next()`.
- `populate()` follows `ref` links for you, but costs extra queries.
- Use `.lean()` for fast, read-only results, and back up Mongoose rules with collection-level schema validation.

**Next lesson:** [Migrations and Schema Evolution](/courses/mongodb/migrations-and-schema-evolution)
