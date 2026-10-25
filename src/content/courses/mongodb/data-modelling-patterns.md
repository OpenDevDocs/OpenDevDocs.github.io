---
title: Data Modelling Patterns
slug: data-modelling-patterns
metadescription: Learn classic MongoDB schema patterns like attribute, bucket, computed, extended reference, subset, outlier and schema versioning, with tiny examples.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'schema-design', 'data-modelling', 'patterns']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What a **schema design pattern** is and why it helps
- Seven well-known patterns: **attribute**, **bucket**, **computed**, **extended reference**, **subset**, **outlier** and **schema versioning**
- The problem each pattern solves, with a tiny example
- How to pick a pattern for a real situation

> **Before you start:** this lesson assumes you've read [Embedding vs Referencing](/courses/mongodb/schema-design-embedding-vs-referencing).

## What is a pattern?

A **pattern** is a proven recipe for a common problem. Developers have been building apps on MongoDB for many years, and the same problems keep coming up: documents get too big, a page needs a total that is slow to calculate, the shape of data changes over time.

Instead of inventing a fix every time, you can reach for a named pattern.

> **Think of it like this:** Patterns are like cooking techniques. "Marinate", "slow cook" and "stir fry" are not recipes for one dish. They are tricks you combine to make many dishes. Schema patterns work the same way, and one collection often uses two or three of them.

You do **not** need all of them in every app. Most small apps use none or one. Learn what they are, so you recognise the problem when it shows up.

## 1. Attribute pattern

**Problem:** Your documents have many similar fields, and different documents have different ones. You want to search across all of them.

In our shop, electronics have specs like `color`, `wattage` and `batteryHours`, while stationery has `pages` and `paperType`. Indexing every possible field separately would mean dozens of indexes.

**Before:**

```javascript
{ name: "Headphones", category: "electronics", color: "black", batteryHours: 30 }
{ name: "Notebook",   category: "stationery",  pages: 200, paperType: "ruled" }
```

**After (attribute pattern):** move the varying fields into an array of `{ k, v }` pairs.

```javascript
{ name: "Headphones", category: "electronics",
  attrs: [ { k: "color", v: "black" }, { k: "batteryHours", v: 30 } ] }

{ name: "Notebook", category: "stationery",
  attrs: [ { k: "pages", v: 200 }, { k: "paperType", v: "ruled" } ] }
```

Now **one** index covers every attribute:

```javascript
db.products.createIndex({ "attrs.k": 1, "attrs.v": 1 })

// Find black products
db.products.find({ attrs: { $elemMatch: { k: "color", v: "black" } } })
```

**Use it when:** many optional fields, a "filters" sidebar, product specs, user-defined fields.

## 2. Bucket pattern

**Problem:** You have a huge number of tiny documents that arrive over time, such as sensor readings every minute. Millions of tiny documents waste space and make queries slow.

**Before:** one document per reading.

```javascript
{ sensorId: "kitchen-1", at: ISODate("2026-10-25T08:00:00Z"), temp: 24.1 }
{ sensorId: "kitchen-1", at: ISODate("2026-10-25T08:01:00Z"), temp: 24.3 }
// ... 1,440 of these per sensor per day
```

**After (bucket pattern):** group readings into one document per sensor per hour.

```javascript
{
  sensorId: "kitchen-1",
  hour: ISODate("2026-10-25T08:00:00Z"),
  count: 2,
  sumTemp: 48.4,
  readings: [
    { at: ISODate("2026-10-25T08:00:00Z"), temp: 24.1 },
    { at: ISODate("2026-10-25T08:01:00Z"), temp: 24.3 }
  ]
}
```

New readings are pushed into the current bucket with an upsert:

```javascript
db.sensorBuckets.updateOne(
  { sensorId: "kitchen-1", hour: ISODate("2026-10-25T08:00:00Z"), count: { $lt: 60 } },
  {
    $push: { readings: { at: new Date(), temp: 24.6 } },
    $inc:  { count: 1, sumTemp: 24.6 }
  },
  { upsert: true }
)
```

The `count: { $lt: 60 }` filter keeps each bucket bounded, so the array never grows without limit.

> **Note:** For time-based data, MongoDB's **time series collections** do this bucketing for you automatically. You'll meet them in [Time Series and Capped Collections](/courses/mongodb/time-series-collections). The bucket pattern is still useful for other kinds of grouping, like comments per page.

## 3. Computed pattern

**Problem:** A page shows a value that is expensive to calculate, such as a product's average rating or total sales, and the page is read far more often than the data changes.

**Before:** calculate it on every page view by scanning all reviews.

**After (computed pattern):** store the result and update it when the data changes.

```javascript
// When a new 5-star review arrives for the Coffee Mug:
db.products.updateOne(
  { name: "Coffee Mug" },
  { $inc: { reviewCount: 1, ratingSum: 5 } }
)

// The product now carries ready-made numbers
// { name: "Coffee Mug", reviewCount: 120, ratingSum: 576, ... }
// average rating = ratingSum / reviewCount = 4.8
```

Reading the product now costs nothing extra. You do a tiny bit of work on **write** to save a lot of work on **read**.

**Use it when:** reads vastly outnumber writes: counters, totals, averages, leaderboards.

## 4. Extended reference pattern

**Problem:** You referenced another document to avoid duplication, but now the most common page needs a `$lookup` every time.

**After (extended reference pattern):** keep the reference, and also copy the few fields you always display.

```javascript
// orders
{
  customerId: ObjectId("..."),
  customer: { name: "Asha Roy", city: "Kolkata" },  // copied fields
  total: 98,
  status: "shipped"
}
```

The order list can show the customer's name and city without a join. The full customer record is still one lookup away if needed.

> **Tip:** Copy only fields that rarely change (name, city, SKU), never fast-changing ones (stock level, last login). When a copied field does change, you must update the copies too, for example with `updateMany`.

## 5. Subset pattern

**Problem:** A document has a big array, but the page only ever shows the first few items. Loading the whole thing wastes memory.

A product might have 2,000 reviews, but the product page shows only the latest 5.

**After (subset pattern):** keep the latest few in the product, and all of them in a separate collection.

```javascript
// products
{
  name: "Headphones",
  recentReviews: [
    { by: "Ken",   stars: 5, text: "Great bass" },
    { by: "Maria", stars: 4, text: "Comfy" }
  ]
}

// reviews (every review, referenced by productId)
{ productId: ObjectId("..."), by: "Ken", stars: 5, text: "Great bass" }
```

When a new review arrives, insert it into `reviews` and push it into `recentReviews` while trimming the array to 5 items:

```javascript
db.products.updateOne(
  { name: "Headphones" },
  { $push: { recentReviews: { $each: [ { by: "Priya", stars: 5, text: "Love it" } ],
                              $position: 0, $slice: 5 } } }
)
```

`$position: 0` adds it to the front, and `$slice: 5` keeps only the first five.

## 6. Outlier pattern

**Problem:** Your design works for 99% of documents, but a few are huge exceptions. For example, most books have a handful of buyers in the "customers also bought" list, but a bestseller has hundreds of thousands.

**After (outlier pattern):** keep the normal design, but flag the exceptions and move their overflow elsewhere.

```javascript
// A normal product
{ name: "Gel Pen", buyerIds: [ /* up to 1,000 ids */ ] }

// An outlier
{ name: "Notebook", buyerIds: [ /* first 1,000 ids */ ], hasOverflow: true }

// Overflow documents in another collection
{ productName: "Notebook", page: 2, buyerIds: [ /* next 1,000 ids */ ] }
```

Your app checks `hasOverflow` and only then runs the extra query. Normal documents stay simple and fast.

**Use it when:** "celebrity" users with millions of followers, viral posts, best-selling products.

## 7. Schema versioning pattern

**Problem:** Your app changes. Last year a customer had one `phone` field; now you want a list of contact methods. Rewriting millions of documents at once is risky.

**After (schema versioning pattern):** add a `schemaVersion` field and let old and new shapes live side by side.

```javascript
// Old documents (no version field means version 1)
{ name: "Rahul", phone: "98300 00000" }

// New documents
{ name: "Rahul", schemaVersion: 2,
  contacts: [ { type: "mobile", value: "98300 00000" }, { type: "email", value: "rahul@example.com" } ] }
```

Your code reads the version and handles each shape:

```javascript
function getPhones(customer) {
  if ((customer.schemaVersion ?? 1) === 1) return [customer.phone]
  return customer.contacts.filter(c => c.type === "mobile").map(c => c.value)
}
```

You can migrate old documents gradually in the background, or upgrade each one the next time it is saved.

> **Note:** You'll go deeper into this in [Migrations and Schema Evolution](/courses/mongodb/migrations-and-schema-evolution).

## A few more patterns worth knowing

| Pattern | One-line idea |
| --- | --- |
| **Polymorphic** | Different shapes in one collection (e.g. books and headphones in `products`) with a `type` or `category` field. |
| **Approximation** | Update a counter only every 10th or 100th event when an exact number is not needed (e.g. page views). |
| **Tree** | Store hierarchies like categories with `parent` or `ancestors` fields. |
| **Archive** | Move old data (last year's orders) to a separate collection or cheaper storage. |

## Cheat sheet: which pattern for which problem?

| Symptom | Try this pattern |
| --- | --- |
| Too many different optional fields to index | Attribute |
| Millions of tiny time-based documents | Bucket (or time series collections) |
| Same expensive calculation on every read | Computed |
| `$lookup` on your busiest page | Extended reference |
| Big array but only the first few items are shown | Subset |
| A few documents are far bigger than the rest | Outlier |
| Document shape changes between app versions | Schema versioning |

## Common mistakes

- **Using patterns "just because".** Every pattern adds a little complexity. Apply one only when you actually see the problem it solves.
- **Forgetting to keep copies in sync.** Extended reference and subset copy data. Update the copies whenever the source changes, or accept that they can be slightly stale.
- **Unbounded buckets.** A bucket without a size limit is just an unbounded array again. Always cap it (by count or by time).
- **Computed values drifting.** If you update `ratingSum` in one place but forget another code path, the numbers go wrong. Keep the update logic in one function, or recompute occasionally.
- **No default for missing version.** In schema versioning, treat "no `schemaVersion` field" as version 1 so old documents still work.

## Practice

1. A news site shows "total views" on every article. Articles get thousands of views per minute and the exact number does not matter. Which patterns would you combine?
2. A chat app stores messages. Each room gets thousands of messages per day, and the app loads messages 50 at a time. Sketch a bucket document.
3. Write the update that keeps only the 3 newest comments in a post's `recentComments` array when a new comment arrives.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Computed + approximation: store a viewCount on the article,
//    and only increment it by 10 for roughly every 10th view
db.articles.updateOne({ slug: "budget-2026" }, { $inc: { viewCount: 10 } })

// 2. Bucket pattern: one document per room per 50 messages
{
  roomId: "general",
  bucketNo: 17,
  count: 50,
  messages: [
    { from: "Asha", text: "Hi!", at: ISODate("2026-10-25T08:00:00Z") }
    // ... up to 50
  ]
}

// 3. Subset pattern update
db.posts.updateOne(
  { _id: ObjectId("...") },
  { $push: { recentComments: { $each: [ { by: "Ken", text: "Nice!" } ], $position: 0, $slice: 3 } } }
)
```

</details>

## Key takeaways

- Patterns are reusable fixes for common schema problems. Use them only when you have the problem.
- **Attribute** turns many optional fields into a `{ k, v }` array that one index can cover.
- **Bucket** groups many tiny documents into fewer bounded ones.
- **Computed** stores pre-calculated results to make reads cheap.
- **Extended reference** and **subset** copy a little data to avoid joins and huge documents.
- **Outlier** handles rare giants separately, and **schema versioning** lets old and new shapes live together.

**Next lesson:** [Schema Validation with JSON Schema](/courses/mongodb/schema-validation)
