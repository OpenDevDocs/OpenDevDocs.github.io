---
title: Update Operators and Upserts
slug: update-operators-and-upserts
metadescription: Learn MongoDB's field update operators ($inc, $unset, $rename, $min, $max, $mul, $currentDate) and how upserts insert a document when none matches.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'crud', 'update', 'upsert']
course: mongodb
---
## What you will learn

By the end of this lesson you will know how to:

- Add to or subtract from a number with `$inc`
- Remove a field with `$unset` and rename one with `$rename`
- Use `$mul`, `$min`, `$max` and `$currentDate`
- Combine several operators in one update
- Use an **upsert** to update a document, or create it if it doesn't exist yet

In the last lesson you used `$set` to change values. `$set` is great, but many updates are really questions like "add 1 to the view count" or "lower the price only if the new one is cheaper". MongoDB has an operator for each of these.

## Get the sample data ready

Start from a clean copy of the `shop` products. You can re-run this any time to reset:

```javascript
use shop

db.products.deleteMany({})
db.products.insertMany([
  { name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"] },
  { name: "Gel Pen", category: "stationery", price: 15, stock: 500, tags: ["pen", "school"] },
  { name: "Headphones", category: "electronics", price: 1999, stock: 35, tags: ["audio", "wireless"], rating: 4.5 },
  { name: "USB Cable", category: "electronics", price: 299, stock: 0, tags: ["cable"] },
  { name: "Coffee Mug", category: "kitchen", price: 249, stock: 60, tags: ["ceramic", "gift"], rating: 4.8 }
])
```

## The field update operators

Here is the toolbox for this lesson. All of them go in the second argument of `updateOne()` or `updateMany()`.

| Operator | What it does | Example |
| --- | --- | --- |
| `$set` | Set a field to a value | `{ $set: { price: 59 } }` |
| `$unset` | Remove a field | `{ $unset: { rating: "" } }` |
| `$inc` | Add to a number (use a negative to subtract) | `{ $inc: { stock: -2 } }` |
| `$mul` | Multiply a number | `{ $mul: { price: 0.9 } }` |
| `$rename` | Rename a field | `{ $rename: { stock: "quantity" } }` |
| `$min` | Set only if the new value is **smaller** | `{ $min: { price: 199 } }` |
| `$max` | Set only if the new value is **bigger** | `{ $max: { rating: 4.9 } }` |
| `$currentDate` | Set a field to the current date | `{ $currentDate: { updatedAt: true } }` |
| `$setOnInsert` | Set a field only when an upsert inserts | see the upsert section |

There are also array operators like `$push` and `$pull`. They get their own lesson: [Working with Arrays](/courses/mongodb/working-with-arrays).

## `$inc`: add or subtract

`$inc` changes a number **by** an amount, instead of **to** an amount. This is perfect for counters and stock.

A customer buys 2 Gel Pens. Let's reduce the stock by 2:

```javascript
db.products.updateOne({ name: "Gel Pen" }, { $inc: { stock: -2 } })

db.products.findOne({ name: "Gel Pen" }, { stock: 1, _id: 0 })
// → { stock: 498 }
```

A delivery arrives with 50 USB Cables:

```javascript
db.products.updateOne({ name: "USB Cable" }, { $inc: { stock: 50 } })
// stock: 0 → 50
```

Why not read the stock, subtract in your code, and `$set` the new value? Because two shoppers could do that at the same moment. Both read 500, both write 498, and one sale is lost. `$inc` happens **on the server in one step**, so two `$inc: -2` calls always end at 496.

> **Think of it like this:** `$set` is telling the cashier "the till now has 500 rupees". `$inc` is saying "add 20 rupees to whatever is in the till". If two people do it at once, only the second way gives the right total.

If the field doesn't exist, `$inc` creates it starting from zero:

```javascript
db.products.updateOne({ name: "Notebook" }, { $inc: { views: 1 } })
// Notebook now has views: 1
```

### A safe stock update

Here's a real-world trick. To sell 3 Headphones **only if** there are at least 3 in stock, put the check in the filter:

```javascript
db.products.updateOne(
  { name: "Headphones", stock: { $gte: 3 } },
  { $inc: { stock: -3 } }
)
// → matchedCount: 1, modifiedCount: 1   (stock: 35 → 32)
```

If stock were 2, the filter wouldn't match, `matchedCount` would be `0`, and stock would never go negative. Your app checks `matchedCount` to know if the sale worked.

## `$unset`: remove a field

`$unset` deletes a field from the document. The value you give doesn't matter; an empty string `""` is the usual choice:

```javascript
db.products.updateOne({ name: "Coffee Mug" }, { $unset: { rating: "" } })

db.products.findOne({ name: "Coffee Mug" })
// → { _id: ObjectId("..."), name: "Coffee Mug", category: "kitchen", price: 249, stock: 60, tags: [ "ceramic", "gift" ] }
```

The `rating` field is gone completely. That's different from `$set: { rating: null }`, which keeps the field but with an empty value.

## `$rename`: rename a field

Maybe your team decides `stock` should be called `quantity`. `$rename` moves the value to the new name:

```javascript
db.products.updateMany({}, { $rename: { stock: "quantity" } })
// → matchedCount: 5, modifiedCount: 5

db.products.findOne({ name: "Notebook" }, { name: 1, quantity: 1, _id: 0 })
// → { name: "Notebook", quantity: 120 }
```

Let's rename it back so the rest of the lesson works:

```javascript
db.products.updateMany({}, { $rename: { quantity: "stock" } })
```

> **Note:** Documents that don't have the old field are simply skipped. No error.

## `$mul`: multiply

`$mul` multiplies a number. Let's give the Coffee Mug a 10% discount by multiplying by 0.9:

```javascript
db.products.updateOne({ name: "Coffee Mug" }, { $mul: { price: 0.9 } })
// price: 249 → 224.1
```

> **Tip:** Normal numbers in MongoDB (and JavaScript) are *floating point*, so some decimal results come out like `53.900000000000006`. For real money, many apps store prices in whole units (paise or cents) or use the exact decimal BSON type `Decimal128` (see [BSON Types and Document Structure](/courses/mongodb/bson-types-and-documents)).

## `$min` and `$max`: only if smaller or bigger

These two compare first, and only update when it makes sense.

`$min` sets the field only if your value is **smaller** than the current one:

```javascript
// Lower the Headphones price to 1799 (current is 1999, so it changes)
db.products.updateOne({ name: "Headphones" }, { $min: { price: 1799 } })
// → modifiedCount: 1

// Try 1899 now. It's bigger than 1799, so nothing happens
db.products.updateOne({ name: "Headphones" }, { $min: { price: 1899 } })
// → modifiedCount: 0
```

`$max` is the opposite. It only updates when your value is **bigger**. This is great for "best score" or "highest bid":

```javascript
db.products.updateOne({ name: "Headphones" }, { $max: { rating: 4.7 } })
// rating: 4.5 → 4.7
```

If the field doesn't exist yet, both `$min` and `$max` simply set it.

## `$currentDate`: stamp the time

`$currentDate` sets a field to the server's current date and time. It's the easiest way to keep an `updatedAt` field:

```javascript
db.products.updateOne(
  { name: "Notebook" },
  { $set: { price: 55 }, $currentDate: { updatedAt: true } }
)

db.products.findOne({ name: "Notebook" }, { price: 1, updatedAt: 1, _id: 0 })
// → { price: 55, updatedAt: ISODate("2026-10-25T08:15:42.120Z") }
```

`true` means "store it as a normal Date". (You can also write `{ $type: "date" }`.)

## Combining operators

You can use several operators in a single update. They all apply together, in one atomic step:

```javascript
// Sell 1 Coffee Mug, record the sale time, and remove an old flag
db.products.updateOne(
  { name: "Coffee Mug" },
  {
    $inc: { stock: -1 },
    $set: { lastSoldAt: new Date() },
    $unset: { onSale: "" }
  }
)
```

There's one rule: **the same field can't appear in two operators** in one update.

```javascript
db.products.updateOne(
  { name: "Gel Pen" },
  { $set: { stock: 100 }, $inc: { stock: 5 } }
)
// → MongoServerError: Updating the path 'stock' would create a conflict at 'stock'
```

MongoDB can't know whether you meant "set to 100" or "add 5", so it refuses.

## Upserts: update or insert

Here's a common situation. You want to count page views per day. On the first visit of the day there's no document yet; on later visits you want to add 1. Without help you'd write:

1. Find today's document.
2. If it exists, `$inc` it. If not, insert it.

That's two steps, and two visitors arriving at once could both insert. An **upsert** (update + insert) does it in one step. Add `{ upsert: true }` as the third argument:

```javascript
db.pageViews.updateOne(
  { page: "/products", day: "2026-10-25" },
  { $inc: { views: 1 } },
  { upsert: true }
)
```

The first time, nothing matches, so MongoDB **inserts** a new document:

```javascript
// → {
//     acknowledged: true,
//     insertedId: ObjectId("..."),
//     matchedCount: 0,
//     modifiedCount: 0,
//     upsertedCount: 1
//   }
```

Run the exact same command again, and this time it **updates**:

```javascript
// → { acknowledged: true, insertedId: null, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 }

db.pageViews.findOne({ page: "/products" }, { _id: 0 })
// → { page: "/products", day: "2026-10-25", views: 2 }
```

> **Think of it like this:** An upsert is like a guest book at the door. "If your name is already on the page, add a tick next to it. If not, write your name and give yourself the first tick."

### What does the inserted document contain?

When an upsert inserts, MongoDB builds the new document from two places:

1. The **equality** parts of your filter (`page: "/products"`, `day: "2026-10-25"`)
2. The result of your update operators (`views: 1`)

Filter parts that use operators like `$gt` are **not** copied, because MongoDB can't turn "greater than 5" into a single value.

> **Note:** In mongosh the result shows the new document's id as `insertedId`. In the Node.js driver the same value is called `upsertedId`.

### `$setOnInsert`: values for new documents only

Sometimes you want a field set **only** when the document is created, like `createdAt`. That's what `$setOnInsert` is for. On an update, it's ignored.

Let's add or update a Stapler in the products collection:

```javascript
db.products.updateOne(
  { name: "Stapler" },
  {
    $set: { price: 99, category: "stationery" },
    $setOnInsert: { stock: 0, tags: [], createdAt: new Date() }
  },
  { upsert: true }
)
// First run → inserted: { name: "Stapler", price: 99, category: "stationery", stock: 0, tags: [], createdAt: ISODate("...") }
```

Now change the price and run it again:

```javascript
db.products.updateOne(
  { name: "Stapler" },
  {
    $set: { price: 89, category: "stationery" },
    $setOnInsert: { stock: 0, tags: [], createdAt: new Date() }
  },
  { upsert: true }
)
// Second run → only price changes to 89. stock and createdAt stay as they were.
```

This lets you write one command that works for both "new product" and "existing product".

### Upsert with `updateMany()` and `replaceOne()`

- `updateMany(filter, update, { upsert: true })` updates all matches, or inserts **one** new document if there are none.
- `replaceOne(filter, doc, { upsert: true })` replaces the match, or inserts `doc` if there's none.

> **Warning:** If two upserts with the same filter run at exactly the same moment, both might insert, leaving you with duplicates. The fix is a **unique index** on the filter fields (for example on `name`), which you'll learn in [Single Field and Compound Indexes](/courses/mongodb/indexes-single-and-compound).

## In application code

The Node.js driver uses the same operators and options:

```javascript
// Node.js driver
const result = await db.collection("pageViews").updateOne(
  { page: "/products", day: "2026-10-25" },
  { $inc: { views: 1 } },
  { upsert: true }
);

console.log(result.upsertedId);   // an ObjectId on insert, null on update
```

## Common mistakes

- **Reading, changing in code, then `$set`.** Two users at once can overwrite each other. Use `$inc`, `$min` or `$max` so the server does the math.
- **Using `$inc` on text.** `$inc` only works on numbers. If `stock` was saved as `"120"`, you'll get an error. Store numbers as numbers.
- **Same field in two operators.** `{ $set: { stock: 1 }, $inc: { stock: 1 } }` causes a conflict error. Pick one.
- **Thinking `$unset` and `null` are the same.** `$unset` removes the field; `$set: { x: null }` keeps it with a null value.
- **Forgetting `{ upsert: true }` goes in the third argument.** Putting it inside the update document doesn't work.

## Practice

Reset the data first using the setup block at the top.

1. Add 25 to the Notebook's stock.
2. Remove the `rating` field from every product that has one.
3. Lower the Coffee Mug's price to 199, but only if that's cheaper than its current price.
4. Write an upsert for a product named "Water Bottle" that sets `price: 349` every time, but sets `stock: 10` and `createdAt` only when it's first created.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. $inc with a positive number
db.products.updateOne({ name: "Notebook" }, { $inc: { stock: 25 } })
// stock: 120 → 145

// 2. $unset with updateMany, filtered to documents that have the field
db.products.updateMany({ rating: { $exists: true } }, { $unset: { rating: "" } })
// → matchedCount: 2, modifiedCount: 2

// 3. $min only changes the value if it's smaller
db.products.updateOne({ name: "Coffee Mug" }, { $min: { price: 199 } })
// price: 249 → 199

// 4. Upsert with $setOnInsert
db.products.updateOne(
  { name: "Water Bottle" },
  {
    $set: { price: 349 },
    $setOnInsert: { stock: 10, createdAt: new Date() }
  },
  { upsert: true }
)
```

</details>

## Key takeaways

- `$inc` adds or subtracts on the server, safely, even when many users update at once.
- `$unset` removes a field; `$rename` renames it; `$mul` multiplies it.
- `$min` and `$max` only update when the new value is smaller or bigger.
- `$currentDate` stamps the current time. One update can combine many operators, but not on the same field.
- `{ upsert: true }` updates a match or inserts a new document. Use `$setOnInsert` for fields that belong only to new documents.

**Next lesson:** [Deleting Documents](/courses/mongodb/deleting-documents)
