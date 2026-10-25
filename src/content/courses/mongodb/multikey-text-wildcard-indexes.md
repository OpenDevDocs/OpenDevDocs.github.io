---
title: Multikey, Text and Wildcard Indexes
slug: multikey-text-wildcard-indexes
metadescription: Learn how MongoDB indexes arrays with multikey indexes, searches words with text indexes, and handles unpredictable fields with wildcard indexes.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'indexes', 'text-search', 'arrays']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- How a **multikey index** lets you search inside arrays quickly
- The one big rule about multikey compound indexes
- How to build a **text index** and search words with `$text`
- How to sort search results by relevance
- When a **wildcard index** helps with fields you can't predict

> **Before you start:** this lesson assumes you've read [Single Field and Compound Indexes](/courses/mongodb/indexes-single-and-compound) and [Working with Arrays](/courses/mongodb/working-with-arrays).

## Multikey indexes: indexing arrays

Our products have a `tags` array:

```javascript
{ name: "Notebook", tags: ["paper", "school"] }
{ name: "Gel Pen",  tags: ["pen", "school"] }
```

A common query is "all products tagged school":

```javascript
use shop
db.products.find({ tags: "school" })
```

To make this fast, create a normal-looking index on `tags`:

```javascript
db.products.createIndex({ tags: 1 })
// → tags_1
```

MongoDB notices that `tags` holds arrays and automatically makes it a **multikey index**. Instead of one entry per document, it adds **one entry per array element**:

```text
index entry → document
cable       → USB Cable
ceramic     → Coffee Mug
gift        → Coffee Mug
paper       → Notebook
pen         → Gel Pen
school      → Notebook
school      → Gel Pen
...
```

> **Think of it like this:** In a recipe book's index, a single recipe like "Paneer Butter Masala" appears under *paneer*, *butter*, *tomato* and *cream*. One recipe, many index entries. A multikey index does the same for each value in an array.

You don't need any special option. You can see it in `explain`:

```javascript
db.products.find({ tags: "school" }).explain().queryPlanner.winningPlan.inputStage
// → { stage: 'IXSCAN', keyPattern: { tags: 1 }, isMultiKey: true, ... }
```

### Arrays of embedded documents

Multikey indexes also work on fields inside arrays of objects. Our orders have an `items` array:

```javascript
db.orders.createIndex({ "items.productId": 1 })

// "Which orders contain this product?"
db.orders.find({ "items.productId": ObjectId("...") })
```

When you need several conditions to match **the same** array element, use `$elemMatch`. The index still helps:

```javascript
db.orders.createIndex({ "items.name": 1, "items.qty": 1 })

db.orders.find({ items: { $elemMatch: { name: "Gel Pen", qty: { $gte: 5 } } } })
```

### The parallel arrays rule

A compound index can include **at most one array field per document**. If you try to index two array fields that are both arrays in the same document, MongoDB refuses:

```javascript
db.demo.insertOne({ sizes: ["S", "M"], colors: ["red", "blue"] })
db.demo.createIndex({ sizes: 1, colors: 1 })
// → MongoServerError: cannot index parallel arrays [colors] [sizes]
```

The reason: it would need an entry for every combination (S-red, S-blue, M-red, M-blue), which can explode in size. Compound multikey indexes are fine when only one of the fields is an array, like `{ category: 1, tags: 1 }`.

> **Warning:** Huge arrays mean huge indexes. An array with 5,000 elements adds 5,000 index entries for that one document. Keep indexed arrays reasonably small.

## Text indexes: searching for words

What if a user types "wireless headphones" in a search box? A normal index can only find **exact** values. It can't find documents that *contain* a word somewhere in a sentence.

Let's give our products a short description first:

```javascript
db.products.updateOne({ name: "Headphones" }, { $set: { description: "Wireless over-ear headphones with deep bass" } })
db.products.updateOne({ name: "Coffee Mug" },  { $set: { description: "Ceramic mug, a perfect gift for coffee lovers" } })
db.products.updateOne({ name: "Notebook" },    { $set: { description: "Ruled paper notebook for school and office" } })
```

Now create a **text index** on the fields you want to search:

```javascript
db.products.createIndex({ name: "text", description: "text" })
// → name_text_description_text
```

A text index breaks text into words, drops very common words (like "the", "a", "for"), and reduces words to their root (so "lovers" also matches "lover"). This is called **stemming**.

> **Think of it like this:** A text index is like the keyword index of a cookbook. It doesn't store whole sentences. It stores important words, each pointing to the pages where they appear.

### Searching with `$text`

Use the `$text` operator with `$search`:

```javascript
db.products.find({ $text: { $search: "wireless" } }, { name: 1, _id: 0 })
// → [ { name: 'Headphones' } ]
```

Several words mean **any** of them (OR):

```javascript
db.products.find({ $text: { $search: "coffee school" } }, { name: 1, _id: 0 })
// → [ { name: 'Coffee Mug' }, { name: 'Notebook' } ]
```

Put a phrase in escaped quotes to require the exact phrase, and use a minus sign to exclude a word:

```javascript
// Must contain the phrase "deep bass"
db.products.find({ $text: { $search: "\"deep bass\"" } })

// Contains "ceramic" but not "notebook"
db.products.find({ $text: { $search: "ceramic -notebook" } })
```

Searches are case-insensitive by default.

### Sorting by relevance

Every match gets a **relevance score**. You can return it and sort by it with `$meta: "textScore"`:

```javascript
db.products.find(
  { $text: { $search: "coffee mug gift" } },
  { name: 1, score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })
// → [ { _id: ..., name: 'Coffee Mug', score: 2.4 } ]   (your exact score may differ)
```

### Weights

If a match in `name` should count more than a match in `description`, give it a higher **weight**:

```javascript
db.products.dropIndex("name_text_description_text")

db.products.createIndex(
  { name: "text", description: "text" },
  { weights: { name: 10, description: 2 }, name: "product_search" }
)
```

### Text index rules to remember

- A collection can have **only one** text index. Put all searchable fields in it.
- `$text` can't be combined with a `hint()`, and a query can only have one `$text` expression.
- The default language is English. Use `default_language` when creating the index for other languages, or `"none"` to turn off stemming and stop words.

> **Note:** Text indexes are good for simple keyword search. For typo tolerance, autocomplete, synonyms and better ranking, MongoDB offers **Atlas Search**, covered in [Atlas Search and the search Stage](/courses/mongodb/atlas-search).

## Wildcard indexes: when you can't predict the fields

Sometimes documents have fields that vary a lot. Say each product has a `specs` object, and every category has different keys:

```javascript
db.products.updateOne({ name: "Headphones" }, { $set: { specs: { color: "black", batteryHours: 30 } } })
db.products.updateOne({ name: "USB Cable" },  { $set: { specs: { lengthCm: 100, connector: "USB-C" } } })
db.products.updateOne({ name: "Notebook" },   { $set: { specs: { pages: 200, paperType: "ruled" } } })
```

Users filter on any of these, and sellers can add new keys anytime. You can't create an index for every key in advance.

A **wildcard index** indexes every field under a path, whatever its name:

```javascript
db.products.createIndex({ "specs.$**": 1 })
// → specs.$**_1
```

Now each of these queries can use the same index:

```javascript
db.products.find({ "specs.color": "black" })
db.products.find({ "specs.lengthCm": { $gte: 50 } })
db.products.find({ "specs.pages": 200 })
```

> **Think of it like this:** A normal index is a label on one specific drawer. A wildcard index is a label maker that automatically labels every drawer in a cabinet, including new ones added later.

### Indexing every field

`"$**"` on its own indexes every field in the document. You can narrow it with `wildcardProjection`:

```javascript
db.products.createIndex(
  { "$**": 1 },
  { wildcardProjection: { specs: 1, tags: 1 } }   // only index these paths
)
```

### Compound wildcard indexes

Since MongoDB 7.0 you can mix normal fields and a wildcard in one index. This is great when queries always filter on a known field plus some unknown spec:

```javascript
db.products.createIndex({ category: 1, "specs.$**": 1 })

db.products.find({ category: "electronics", "specs.color": "black" })
```

### Wildcard index limits

- They can't be **unique** and can't be **TTL** indexes.
- They are slightly bigger and slower to maintain than a regular index on a known field.
- If you already know a field is queried often, a normal index on that field is still the better choice.

> **Tip:** The **attribute pattern** from [Data Modelling Patterns](/courses/mongodb/data-modelling-patterns) solves the same "unknown fields" problem with a `{ k, v }` array and a regular compound index. Both approaches are valid. Wildcard indexes let you keep the natural object shape.

## Quick comparison

| Index type | Created with | Best for |
| --- | --- | --- |
| Multikey | `{ tags: 1 }` on an array field (automatic) | Finding documents by a value inside an array |
| Text | `{ name: "text", description: "text" }` | Simple keyword search in sentences |
| Wildcard | `{ "specs.$**": 1 }` | Fields whose names you can't predict |

## Common mistakes

- **Looking for a "multikey" option.** There isn't one. Index an array field normally and MongoDB makes it multikey.
- **Indexing two arrays in one compound index.** You'll get "cannot index parallel arrays". Index them separately or reshape the data.
- **Creating a second text index.** Only one per collection is allowed. Drop the old one and include all fields in a new one.
- **Using a regex instead of a text index for word search.** A regex like `/bass/` can't use an index efficiently in the middle of a string. Use `$text` (or Atlas Search).
- **Using wildcard indexes for everything.** They are a tool for unpredictable fields, not a replacement for well-planned indexes.

## Practice

1. Create an index that makes "find customers whose `favouriteCategories` array contains `kitchen`" fast. What kind of index will it be?
2. Create a text index on `products` that weights `name` three times more than `description`, then search for "gift" and sort by relevance.
3. Customers have a `preferences` object with keys that vary per customer. Create an index that helps queries on any preference, together with `city`.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. A multikey index (automatic, because the field holds arrays)
db.customers.createIndex({ favouriteCategories: 1 })
db.customers.find({ favouriteCategories: "kitchen" })

// 2. Only one text index is allowed, so drop the existing one first
db.products.dropIndex("product_search")
db.products.createIndex(
  { name: "text", description: "text" },
  { weights: { name: 3, description: 1 } }
)
db.products.find(
  { $text: { $search: "gift" } },
  { name: 1, score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })

// 3. A compound wildcard index (MongoDB 7.0+)
db.customers.createIndex({ city: 1, "preferences.$**": 1 })
db.customers.find({ city: "Pune", "preferences.newsletter": true })
```

</details>

## Key takeaways

- Indexing an array field creates a **multikey index** automatically, with one entry per element.
- A compound index can't include two fields that are both arrays in the same document.
- A **text index** breaks text into words; query it with `$text` and sort by `{ $meta: "textScore" }`.
- Only **one** text index per collection, and you can set **weights** per field.
- A **wildcard index** (`"path.$**"`) indexes fields you can't predict; compound wildcard indexes exist since 7.0.
- Use the simplest index that fits your query.

**Next lesson:** [Partial, Sparse and TTL Indexes](/courses/mongodb/partial-sparse-ttl-indexes)
