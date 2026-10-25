---
title: Atlas Search and the search Stage
slug: atlas-search
metadescription: Learn full-text search in MongoDB with search indexes and the $search stage, including fuzzy matching, autocomplete, compound queries and highlights.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'atlas-search', 'full-text-search', 'aggregation']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals) and [Multikey, Text and Wildcard Indexes](/courses/mongodb/multikey-text-wildcard-indexes).

## What you will learn

By the end of this lesson you will know:

- Why a real search engine beats `$regex` and the classic `$text` index
- What a **search index** is and how to create one
- How to run a search with the `$search` aggregation stage and read the **relevance score**
- How to handle typos (**fuzzy**), search-as-you-type (**autocomplete**) and multi-condition searches (**compound**)
- Where you can run search: Atlas, a local Atlas deployment, or MongoDB Community with `mongot`

> **Note:** The product used to be called **Atlas Search**. MongoDB now calls it **MongoDB Search**, because it also runs outside Atlas. The `$search` stage is the same either way.

## Why not just use $regex?

Say a shopper types "wireless headphone" into your search box. You could try:

```javascript
db.products.find({ name: { $regex: "headphone", $options: "i" } })
```

This works for tiny collections, but it has big problems:

- **No ranking.** Every match is equal. The best result isn't first.
- **No typo tolerance.** "hedphones" finds nothing.
- **Slow.** A case-insensitive regex usually can't use an index well, so it scans.
- **No language smarts.** "headphone" doesn't match "headphones" unless you plan for it.

The classic `$text` index helps a bit, but it can't do typo tolerance, autocomplete or highlighting.

> **Think of it like this:** `$regex` is reading every page of a book looking for a word. A search engine is the **index at the back of the book**: it already knows which pages mention "headphones", and it lists the most relevant pages first.

## How MongoDB Search works

MongoDB Search is built on **Apache Lucene**, a popular search library. It runs in a separate process called **mongot**, next to your database (`mongod`).

```text
your app ──→ mongod ──($search)──→ mongot (Lucene search indexes)
                ↑                        │
                └── change streams ──────┘  keeps the index in sync
```

You write documents to MongoDB as usual. `mongot` watches the changes and updates its **search index** automatically, usually within a second or so. Your app never talks to `mongot` directly. It sends a normal aggregation with a `$search` stage, and `mongod` forwards it.

## Where can I run it?

| Option | Good for | Notes |
| --- | --- | --- |
| **MongoDB Atlas** (any tier, including free M0) | Learning and production | Easiest. Free and Flex tiers allow only a few search indexes |
| **Local Atlas deployment** (Atlas CLI or Docker image `mongodb/mongodb-atlas-local`) | Learning on your laptop | One container with `mongod` and `mongot`. Not for production |
| **MongoDB Community 8.2+ with `mongot`** | Self-managed servers | You install and run `mongot` yourself. Public preview at 8.2's launch, generally available since mid-2026 |

A plain `mongod` on its own does **not** support `$search`. You'll get an error unless `mongot` is connected.

The quickest local start with Docker:

```bash
docker run -d -p 27017:27017 --name search-lab mongodb/mongodb-atlas-local
mongosh "mongodb://localhost:27017/?directConnection=true"
```

## Preparing the data

Let's add a short description to our `shop.products` documents so there is real text to search:

```javascript
use shop
db.products.updateOne({ name: "Notebook" },   { $set: { description: "A5 ruled notebook with 200 pages, great for school notes" } })
db.products.updateOne({ name: "Gel Pen" },    { $set: { description: "Smooth blue gel pen for school and office writing" } })
db.products.updateOne({ name: "Headphones" }, { $set: { description: "Wireless over-ear headphones with noise cancelling and 30 hour battery" } })
db.products.updateOne({ name: "USB Cable" },  { $set: { description: "Fast charging USB-C cable, 1 metre, braided" } })
db.products.updateOne({ name: "Coffee Mug" }, { $set: { description: "Ceramic coffee mug, 350 ml, makes a lovely gift" } })
```

## Creating a search index

A search index is different from a normal index. You create it with `createSearchIndex`. The simplest definition is **dynamic mapping**, which indexes every field automatically:

```javascript
db.products.createSearchIndex("default", { mappings: { dynamic: true } })
// → default
```

The index builds in the background. Check its status:

```javascript
db.products.getSearchIndexes()
// → [ { id: '6718...', name: 'default', status: 'READY', queryable: true,
//       latestDefinition: { mappings: { dynamic: true } }, ... } ]
```

Wait until `queryable` is `true` before searching.

> **Tip:** Dynamic mapping is perfect for learning. In production, list only the fields you search (`dynamic: false` plus a `fields` map). The index is smaller and faster.

On Atlas you can also create search indexes in the web UI, on the cluster's **Search** tab.

## Your first $search

`$search` is an aggregation stage, and it must be the **first** stage in the pipeline. The `text` operator searches words in one or more fields:

```javascript
db.products.aggregate([
  {
    $search: {
      index: "default",
      text: { query: "school", path: ["name", "description", "tags"] }
    }
  },
  { $project: { _id: 0, name: 1, score: { $meta: "searchScore" } } }
])
```

```javascript
[
  { name: 'Gel Pen', score: 0.82 },
  { name: 'Notebook', score: 0.79 }
]
```

Results come back **sorted by relevance**, highest score first. `{ $meta: "searchScore" }` shows that score. Your numbers will differ: scores depend on how often a word appears in a document and how rare it is overall.

### Words, not exact strings

Search breaks text into **tokens** (roughly, words) using an **analyzer**. The default analyzer, `lucene.standard`, lowercases words and splits on spaces and punctuation. So searching "WIRELESS" finds "Wireless".

You can choose a language analyzer like `lucene.english` in the index definition. It also reduces words to their root, so "headphone" matches "headphones".

## Handling typos with fuzzy

Real users make typos. Add `fuzzy` to allow a few wrong letters:

```javascript
db.products.aggregate([
  {
    $search: {
      text: {
        query: "hedphones",
        path: "name",
        fuzzy: { maxEdits: 1 }
      }
    }
  },
  { $project: { _id: 0, name: 1 } }
])
// → [ { name: 'Headphones' } ]
```

`maxEdits` is how many single-letter changes are allowed (1 or 2). If you leave out `index`, MongoDB uses the index named `default`.

## Search as you type with autocomplete

Autocomplete needs the field indexed with the `autocomplete` type. Let's create a second, explicit index:

```javascript
db.products.createSearchIndex("products_autocomplete", {
  mappings: {
    dynamic: false,
    fields: {
      name: [
        { type: "string" },
        { type: "autocomplete" }
      ]
    }
  }
})
```

Now partial words match:

```javascript
db.products.aggregate([
  {
    $search: {
      index: "products_autocomplete",
      autocomplete: { query: "hea", path: "name" }
    }
  },
  { $limit: 5 },
  { $project: { _id: 0, name: 1 } }
])
// → [ { name: 'Headphones' } ]
```

Your app calls this on each keystroke (with a small delay) to show suggestions.

## Combining conditions with compound

Real search boxes mix "must match" text with filters like price. The `compound` operator has four clauses:

| Clause | Meaning | Affects score? |
| --- | --- | --- |
| `must` | Must match | Yes |
| `should` | Nice to match; ranks higher if it does | Yes |
| `filter` | Must match | No |
| `mustNot` | Must not match | No |

Let's find products about "gift" or "school" that cost at most 300, preferring items in the `kitchen` category:

```javascript
db.products.aggregate([
  {
    $search: {
      compound: {
        must: [
          { text: { query: "gift school", path: ["description", "tags"] } }
        ],
        filter: [
          { range: { path: "price", lte: 300 } }
        ],
        should: [
          { text: { query: "kitchen", path: "category" } }
        ]
      }
    }
  },
  { $project: { _id: 0, name: 1, price: 1, score: { $meta: "searchScore" } } }
])
```

```javascript
[
  { name: 'Coffee Mug', price: 249, score: 2.1 },
  { name: 'Gel Pen', price: 15, score: 0.8 },
  { name: 'Notebook', price: 49, score: 0.7 }
]
```

A query with several words (`"gift school"`) matches documents containing **any** of them by default. The Coffee Mug is first because it matched the `should` clause too.

## Highlighting matches

Search results often show the matching words in bold. Ask for highlights, then read them with `$meta`:

```javascript
db.products.aggregate([
  {
    $search: {
      text: { query: "battery", path: "description" },
      highlight: { path: "description" }
    }
  },
  { $project: { _id: 0, name: 1, highlights: { $meta: "searchHighlights" } } }
])
```

```javascript
[
  {
    name: 'Headphones',
    highlights: [
      {
        path: 'description',
        texts: [
          { value: 'Wireless over-ear headphones with noise cancelling and 30 hour ', type: 'text' },
          { value: 'battery', type: 'hit' }
        ],
        score: 1.2
      }
    ]
  }
]
```

Parts with `type: 'hit'` are the matched words. Your front end can wrap them in bold.

## Counting results with $searchMeta

For "Showing 1-10 of 248 results", use `$searchMeta`. It returns information about the results instead of the documents:

```javascript
db.products.aggregate([
  {
    $searchMeta: {
      text: { query: "school", path: ["description", "tags"] },
      count: { type: "total" }
    }
  }
])
// → [ { count: { total: Long(2) } } ]
```

`$searchMeta` can also build **facets** (counts per category or price range) when the index maps those fields with facet-friendly types.

## Using $search from Node.js

From an app it's an ordinary aggregation:

```javascript
const results = await db.collection("products").aggregate([
  { $search: { text: { query: userInput, path: ["name", "description"], fuzzy: { maxEdits: 1 } } } },
  { $limit: 10 },
  { $project: { name: 1, price: 1, score: { $meta: "searchScore" } } }
]).toArray();
```

Pass the user's text as `query`. You don't need to escape regex characters, because it isn't a regex.

## Common mistakes

- **Running `$search` on a plain `mongod`.** It needs `mongot`. Use Atlas, the local Atlas image, or Community with `mongot`.
- **Searching before the index is ready.** Check `getSearchIndexes()` until `queryable: true`.
- **Putting `$search` after another stage.** It must be the first stage. Put `$match`, `$limit` and `$project` after it, or use the `filter` clause inside `compound`.
- **Using `$match` for filters after `$search` on large results.** It works, but a `compound.filter` inside `$search` is usually much faster.
- **Autocomplete without the `autocomplete` mapping.** Dynamic mapping doesn't create autocomplete fields. Map the field explicitly.

## Practice

1. Create a dynamic search index named `default` on `products`, then search for "cable" in `name` and `description`, showing the score.
2. Make the search for "cabel" (with a typo) still find the USB Cable.
3. Write a `compound` search: must match "wireless", and price must be 2000 or less.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Index and simple search
db.products.createSearchIndex("default", { mappings: { dynamic: true } })
db.products.aggregate([
  { $search: { text: { query: "cable", path: ["name", "description"] } } },
  { $project: { _id: 0, name: 1, score: { $meta: "searchScore" } } }
])

// 2. Fuzzy search
db.products.aggregate([
  { $search: { text: { query: "cabel", path: "name", fuzzy: { maxEdits: 1 } } } },
  { $project: { _id: 0, name: 1 } }
])

// 3. Compound with a price filter
db.products.aggregate([
  {
    $search: {
      compound: {
        must: [ { text: { query: "wireless", path: ["description", "tags"] } } ],
        filter: [ { range: { path: "price", lte: 2000 } } ]
      }
    }
  },
  { $project: { _id: 0, name: 1, price: 1 } }
])
```

</details>

## Key takeaways

- **MongoDB Search** (formerly Atlas Search) is a Lucene-based search engine that runs in `mongot` alongside `mongod`.
- Create a search index with `createSearchIndex`, then query with the `$search` stage, which must come **first** in the pipeline.
- Results are ranked by relevance. Read the score with `{ $meta: "searchScore" }`.
- Use `fuzzy` for typos, `autocomplete` for search-as-you-type, `compound` for mixed conditions and `highlight` for matched words.
- It runs on Atlas (even free tier), in a local Atlas container, or on MongoDB Community 8.2+ with `mongot`.

**Next lesson:** [Vector Search for AI Workloads](/courses/mongodb/vector-search)
