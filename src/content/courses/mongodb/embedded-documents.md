---
title: Embedded Documents and Dot Notation
slug: embedded-documents
metadescription: Learn how to store, query and update documents inside documents in MongoDB using dot notation, including arrays of embedded documents and $elemMatch.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'embedded-documents', 'dot-notation', 'queries']
course: mongodb
---
## What you will learn

By the end of this lesson you will know how to:

- Store a document inside another document (an **embedded document**)
- Query nested fields with **dot notation**, like `"shippingAddress.city"`
- Work with **arrays of embedded documents**, like the items in an order
- Update a nested field without wiping out its neighbours
- Spot the two classic traps: exact-match queries and whole-object `$set`

You've already seen small hints of this: the `address` in the first lesson, and the `supplier` in the projections lesson. Now we'll use embedded documents properly, with the `orders` collection of our shop.

## What is an embedded document?

An **embedded document** (also called a *nested* or *sub-document*) is simply a document used as the value of a field:

```javascript
{
  name: "Asha",
  shippingAddress: {            // ← an embedded document
    line1: "12 Park Street",
    city: "Kolkata",
    pincode: "700016"
  }
}
```

The address isn't a separate record somewhere else. It lives **inside** the order, so when you load the order, the address comes with it. No joins, no second query.

> **Think of it like this:** An embedded document is like an envelope inside a parcel. The parcel (the order) holds the products, and inside it there's a small envelope (the shipping address) with its own details. When you pick up the parcel, the envelope comes along.

## Get the sample data ready

This setup is a bit longer, because orders point to customers and products. Paste it all into mongosh:

```javascript
use shop

// Products (our usual five)
db.products.deleteMany({})
db.products.insertMany([
  { name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"] },
  { name: "Gel Pen", category: "stationery", price: 15, stock: 500, tags: ["pen", "school"] },
  { name: "Headphones", category: "electronics", price: 1999, stock: 35, tags: ["audio", "wireless"], rating: 4.5 },
  { name: "USB Cable", category: "electronics", price: 299, stock: 0, tags: ["cable"] },
  { name: "Coffee Mug", category: "kitchen", price: 249, stock: 60, tags: ["ceramic", "gift"], rating: 4.8 }
])

// A quick lookup: product name → _id
var p = {}   // "var" lets you paste this block again without errors
db.products.find().forEach(doc => { p[doc.name] = doc._id })

// Customers
db.customers.deleteMany({})
var c = db.customers.insertMany([
  { name: "Asha", email: "asha@example.com", city: "Kolkata", joinedAt: ISODate("2025-03-10"), isMember: true },
  { name: "Rahul", email: "rahul@example.com", city: "Mumbai", joinedAt: ISODate("2026-01-15"), isMember: false },
  { name: "Priya", email: "priya@example.com", city: "Kolkata", joinedAt: ISODate("2026-06-02"), isMember: true }
]).insertedIds

// Orders, each with an items array and a shippingAddress
db.orders.deleteMany({})
db.orders.insertMany([
  {
    customerId: c[0],
    items: [
      { productId: p["Notebook"], name: "Notebook", qty: 3, price: 49 },
      { productId: p["Gel Pen"], name: "Gel Pen", qty: 10, price: 15 }
    ],
    total: 297,
    status: "delivered",
    shippingAddress: { line1: "12 Park Street", city: "Kolkata", pincode: "700016" },
    createdAt: ISODate("2026-10-02T10:00:00Z")
  },
  {
    customerId: c[1],
    items: [
      { productId: p["Headphones"], name: "Headphones", qty: 1, price: 1999 }
    ],
    total: 1999,
    status: "shipped",
    shippingAddress: { line1: "4 Marine Drive", city: "Mumbai", pincode: "400002" },
    createdAt: ISODate("2026-10-15T14:30:00Z")
  },
  {
    customerId: c[2],
    items: [
      { productId: p["Coffee Mug"], name: "Coffee Mug", qty: 2, price: 249 },
      { productId: p["Gel Pen"], name: "Gel Pen", qty: 2, price: 15 }
    ],
    total: 528,
    status: "pending",
    shippingAddress: { line1: "88 Salt Lake", city: "Kolkata", pincode: "700091" },
    createdAt: ISODate("2026-10-24T09:15:00Z")
  }
])
```

Each order has:

- `shippingAddress`: **one** embedded document
- `items`: an **array** of embedded documents, one per product line

## Querying nested fields with dot notation

To reach a field inside an embedded document, write the outer field, a dot, then the inner field. This is **dot notation**. The whole path must be in **quotes**:

```javascript
// Orders shipped to Kolkata
db.orders.find({ "shippingAddress.city": "Kolkata" }, { status: 1, total: 1, _id: 0 })
// → [
//     { total: 297, status: "delivered" },
//     { total: 528, status: "pending" }
//   ]
```

All the operators you know still work on nested fields:

```javascript
// Pincodes starting with "700" (Kolkata area), using a regular expression
db.orders.find({ "shippingAddress.pincode": /^700/ })

// Kolkata orders that are not yet delivered
db.orders.find({ "shippingAddress.city": "Kolkata", status: { $ne: "delivered" } })
// → the pending order from Priya
```

> **Note:** Without quotes, `{ shippingAddress.city: "Kolkata" }` is a JavaScript syntax error. The quotes are not optional.

You can go deeper than one level too. A path like `"seller.address.city"` reaches two levels down. MongoDB allows up to 100 levels of nesting, but in practice two or three is plenty.

### Trap 1: matching the whole embedded document

What if you skip dot notation and write the embedded document directly?

```javascript
db.orders.find({ shippingAddress: { city: "Kolkata" } })
// → nothing!
```

This asks for orders whose `shippingAddress` is **exactly** `{ city: "Kolkata" }`, with no other fields. Our addresses also have `line1` and `pincode`, so nothing matches.

Even the full object must match **field for field, in the same order**:

```javascript
// Matches: same fields, same order
db.orders.find({ shippingAddress: { line1: "12 Park Street", city: "Kolkata", pincode: "700016" } })

// No match: same fields, different order
db.orders.find({ shippingAddress: { city: "Kolkata", line1: "12 Park Street", pincode: "700016" } })
```

> **Tip:** Almost always, use dot notation to query embedded documents. Whole-object matches are fragile.

## Querying arrays of embedded documents

Dot notation also reaches into **arrays** of objects. `"items.name"` means "the `name` of any item in the array":

```javascript
// Orders that include a Gel Pen
db.orders.find({ "items.name": "Gel Pen" }, { status: 1, _id: 0 })
// → [ { status: "delivered" }, { status: "pending" } ]

// Orders with any line of 5 or more units
db.orders.find({ "items.qty": { $gte: 5 } }, { status: 1, _id: 0 })
// → [ { status: "delivered" } ]   (10 Gel Pens)
```

### Trap 2: two conditions, different items

Now let's find orders with **a Gel Pen line where the quantity is under 5**. The obvious query:

```javascript
db.orders.find(
  { "items.name": "Gel Pen", "items.qty": { $lt: 5 } },
  { status: 1, _id: 0 }
)
// → [ { status: "delivered" }, { status: "pending" } ]   (one is wrong!)
```

The delivered order has 10 Gel Pens, so why is it here? Because each condition was checked **separately**: one item is named "Gel Pen" (qty 10), and a **different** item, the Notebook, has qty 3, which is under 5.

To say "the **same** item must pass both conditions", use `$elemMatch`, just like in the last lesson:

```javascript
db.orders.find(
  { items: { $elemMatch: { name: "Gel Pen", qty: { $lt: 5 } } } },
  { status: 1, _id: 0 }
)
// → [ { status: "pending" } ]   (2 Gel Pens, correct)
```

| You want | Write |
| --- | --- |
| One condition on an item field | `{ "items.name": "Gel Pen" }` |
| Several conditions on the **same** item | `{ items: { $elemMatch: { name: "Gel Pen", qty: { $lt: 5 } } } }` |

## Projecting and sorting nested fields

Dot notation works in projections and sorts too:

```javascript
// Show only the city of each order, sorted by city
db.orders.find({}, { "shippingAddress.city": 1, _id: 0 }).sort({ "shippingAddress.city": 1 })
// → [
//     { shippingAddress: { city: "Kolkata" } },
//     { shippingAddress: { city: "Kolkata" } },
//     { shippingAddress: { city: "Mumbai" } }
//   ]

// Show only the item names
db.orders.find({}, { "items.name": 1, _id: 0 })
// → [
//     { items: [ { name: "Notebook" }, { name: "Gel Pen" } ] },
//     { items: [ { name: "Headphones" } ] },
//     { items: [ { name: "Coffee Mug" }, { name: "Gel Pen" } ] }
//   ]
```

## Updating nested fields

### Change one nested field with dot notation

Priya moves to a new flat. Let's update just the first line of her address. First, grab her order:

```javascript
var priyaOrder = db.orders.findOne({ status: "pending" })

db.orders.updateOne(
  { _id: priyaOrder._id },
  { $set: { "shippingAddress.line1": "21 New Town" } }
)

db.orders.findOne({ _id: priyaOrder._id }, { shippingAddress: 1, _id: 0 })
// → { shippingAddress: { line1: "21 New Town", city: "Kolkata", pincode: "700091" } }
```

Only `line1` changed. `city` and `pincode` are untouched.

### Trap 3: `$set` on the whole object replaces it

Compare that with setting the whole embedded document:

```javascript
// Careful! This REPLACES the entire address
db.orders.updateOne(
  { _id: priyaOrder._id },
  { $set: { shippingAddress: { line1: "21 New Town" } } }
)
// → shippingAddress: { line1: "21 New Town" }   city and pincode are gone!
```

`$set` puts the **whole** value you give it in place of the old value. When you want to change part of an embedded document, use dot notation. To get the address back, run the setup block again, then the `var priyaOrder = ...` line (the new orders have new `_id` values).

> **Think of it like this:** `$set: { "shippingAddress.line1": ... }` is correcting one line on the envelope. `$set: { shippingAddress: {...} }` is throwing the envelope away and writing a new one.

### Add and remove nested fields

`$set` with dot notation **adds** a nested field if it's missing, and `$unset` removes one:

```javascript
// Add a landmark to the address
db.orders.updateOne({ _id: priyaOrder._id }, { $set: { "shippingAddress.landmark": "Near the metro" } })

// Remove it again
db.orders.updateOne({ _id: priyaOrder._id }, { $unset: { "shippingAddress.landmark": "" } })
```

If the outer object doesn't exist at all, MongoDB creates it for you:

```javascript
// The order had no "delivery" field; this creates { delivery: { courier: "FastShip" } }
db.orders.updateOne({ _id: priyaOrder._id }, { $set: { "delivery.courier": "FastShip" } })
```

## Updating arrays of embedded documents

All the array operators from the last lesson work with objects too.

### Change one item with the positional `$`

Priya wants one more Gel Pen. We match the item in the filter, then use `"items.$.qty"` to mean "the `qty` of the item that matched":

```javascript
db.orders.updateOne(
  { _id: priyaOrder._id, "items.name": "Gel Pen" },
  { $inc: { "items.$.qty": 1, total: 15 } }
)
// items: Gel Pen qty 2 → 3, total 528 → 543
```

Notice we also increased `total` in the **same** update. Because it's one document, both changes happen together or not at all.

### Add an item with `$push`

```javascript
db.orders.updateOne(
  { _id: priyaOrder._id },
  {
    $push: { items: { productId: p["Notebook"], name: "Notebook", qty: 1, price: 49 } },
    $inc: { total: 49 }
  }
)
```

### Remove an item with `$pull`

`$pull` can match objects by one or more of their fields:

```javascript
db.orders.updateOne(
  { _id: priyaOrder._id },
  { $pull: { items: { name: "Notebook" } }, $inc: { total: -49 } }
)
```

This removes every item whose `name` is "Notebook", no matter what its other fields are.

### Change many items with `arrayFilters`

Say the Gel Pen price drops to 12, and you want to update that line in **every** pending order. Name the element (`line`) and describe it in `arrayFilters`:

```javascript
db.orders.updateMany(
  { status: "pending" },
  { $set: { "items.$[line].price": 12 } },
  { arrayFilters: [{ "line.name": "Gel Pen" }] }
)
```

(A real shop would also recalculate `total`. You'll learn neat ways to do that with the aggregation pipeline later.)

## Embed or not?

Embedded documents are perfect when the data **belongs to** its parent and is usually read together with it:

- An order's shipping address and its items
- A product's dimensions or supplier contact
- A user's settings

They're a poor fit when the inner list can grow without limit (remember the 16 MB document limit), or when the same data is shared and edited in many places. For example, our order stores `customerId` instead of copying the whole customer. Choosing between the two is a big topic of its own: [Embedding vs Referencing](/courses/mongodb/schema-design-embedding-vs-referencing).

## Common mistakes

- **Forgetting quotes around dot paths.** Write `"shippingAddress.city"`, not `shippingAddress.city`.
- **Querying with a whole embedded document.** `{ shippingAddress: { city: "Kolkata" } }` needs an exact, same-order match. Use dot notation instead.
- **`$set` on the parent object.** `$set: { shippingAddress: { line1: "..." } }` deletes the other address fields. Use `"shippingAddress.line1"`.
- **Two item conditions without `$elemMatch`.** They can be satisfied by different items. Use `$elemMatch` for "the same item".
- **Positional `$` without the array in the filter.** Include something like `"items.name": "Gel Pen"` in the filter so MongoDB knows which item you mean.

## Practice

Reset the data with the setup block first.

1. Find all orders shipped to Mumbai, showing only `total` and the city.
2. Find orders that contain Headphones with a quantity of exactly 1, using `$elemMatch`.
3. Change the pincode of the delivered order to `"700017"` without touching the rest of the address.
4. In the delivered order, increase the Notebook's quantity by 2 and the total by 98 in one update.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Dot notation in the filter and the projection
db.orders.find(
  { "shippingAddress.city": "Mumbai" },
  { total: 1, "shippingAddress.city": 1, _id: 0 }
)
// → [ { total: 1999, shippingAddress: { city: "Mumbai" } } ]

// 2. $elemMatch so both conditions apply to the same item
db.orders.find({ items: { $elemMatch: { name: "Headphones", qty: 1 } } })
// → Rahul's shipped order

// 3. Dot notation in $set
db.orders.updateOne(
  { status: "delivered" },
  { $set: { "shippingAddress.pincode": "700017" } }
)

// 4. Positional $ plus a second field in the same $inc
db.orders.updateOne(
  { status: "delivered", "items.name": "Notebook" },
  { $inc: { "items.$.qty": 2, total: 98 } }
)
// Notebook qty 3 → 5, total 297 → 395
```

</details>

## Key takeaways

- An embedded document is a document stored as a field's value. It's loaded together with its parent.
- Use quoted **dot notation** (`"shippingAddress.city"`, `"items.name"`) to query, project, sort and update nested fields.
- Matching a whole embedded document requires an exact, same-order match, so prefer dot notation.
- Use `$elemMatch` when several conditions must apply to the same item in an array of objects.
- Update nested fields with `"parent.child"`; setting the parent object replaces it entirely. Use `"items.$.field"` to change a matched array item.

**Next lesson:** [Connecting MongoDB to Your First App](/courses/mongodb/connecting-from-an-app)
