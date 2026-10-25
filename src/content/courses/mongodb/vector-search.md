---
title: Vector Search for AI Workloads
slug: vector-search
metadescription: Learn what embeddings are, how to create a vector search index, and how to find similar documents with the $vectorSearch stage for semantic search and RAG.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'vector-search', 'ai', 'embeddings']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Atlas Search and the search Stage](/courses/mongodb/atlas-search).

## What you will learn

By the end of this lesson you will know:

- What a **vector embedding** is, in plain words
- How **semantic search** differs from keyword search
- How to create a **vector search index** and query it with `$vectorSearch`
- How to **pre-filter** results and read the similarity score
- How vector search fits into an AI app (**RAG**), and where you can run it

> **Note:** Vector search runs on the same `mongot` process as MongoDB Search. You can use it on **MongoDB Atlas** (including the free tier), in a **local Atlas deployment** (Atlas CLI or the `mongodb/mongodb-atlas-local` Docker image), or on **MongoDB Community 8.2+** with `mongot` installed. A plain `mongod` alone can't run `$vectorSearch`.

## Keyword search vs meaning search

Keyword search (last lesson) finds documents that contain the **words** you typed. That's great for "USB cable". It's not great for:

> "a film about a robot who falls in love"

A movie described as "an android discovers human feelings" matches the idea perfectly, but shares almost no words with the question. We need search by **meaning**. This is called **semantic search**.

## What is an embedding?

An **embedding** is a list of numbers that describes the meaning of a piece of text (or an image, or audio). An AI model called an **embedding model** produces it.

```javascript
// Text in, numbers out (real embeddings have hundreds or thousands of numbers)
"an android discovers human feelings"  →  [0.12, -0.03, 0.88, 0.41, ...]
```

A list of numbers like this is called a **vector**. The number of values is its **dimensions**. Popular models produce 512, 1024 or 1536 dimensions.

The magic is this: **texts with similar meanings get vectors that point in similar directions**. So "robot falls in love" and "android discovers feelings" end up close together.

> **Think of it like this:** Imagine a giant map where every sentence is a pin. Sentences about love are in one neighbourhood, sentences about space in another, and "robot romance" sits on the border between them. Vector search is asking "which pins are nearest to my pin?"

MongoDB doesn't create embeddings for you in this lesson's examples. You call an embedding model (from providers such as Voyage AI, OpenAI, or an open-source model you run yourself) and store the resulting array in your documents.

## A tiny example you can follow

Real embeddings are too long to read, so let's use **toy 3-dimensional vectors**. Pretend the three numbers mean "how much action", "how much romance" and "how much sci-fi".

```javascript
use shop
db.movies.insertMany([
  { title: "Space Rescue",  genre: "sci-fi",  year: 2021, plotEmbedding: [0.10, 0.00, 0.90] },
  { title: "Laser Duel",    genre: "action",  year: 2019, plotEmbedding: [0.80, 0.00, 0.60] },
  { title: "Monsoon Love",  genre: "romance", year: 2023, plotEmbedding: [0.00, 0.95, 0.10] },
  { title: "Robot Heart",   genre: "sci-fi",  year: 2024, plotEmbedding: [0.10, 0.60, 0.70] },
  { title: "Street Chase",  genre: "action",  year: 2018, plotEmbedding: [0.95, 0.10, 0.00] }
])
```

In a real app, `plotEmbedding` would be the embedding of each movie's plot, with something like 1024 numbers.

## Creating a vector search index

A vector search index is a search index of type `"vectorSearch"`. You tell it:

- `path`: which field holds the vector
- `numDimensions`: how many numbers each vector has (must match your model)
- `similarity`: how to measure closeness

```javascript
db.movies.createSearchIndex(
  "vector_index",
  "vectorSearch",
  {
    fields: [
      { type: "vector", path: "plotEmbedding", numDimensions: 3, similarity: "cosine" },
      { type: "filter", path: "genre" },
      { type: "filter", path: "year" }
    ]
  }
)
```

The two `filter` entries let us narrow results by `genre` and `year` later.

As with search indexes, wait until it's ready:

```javascript
db.movies.getSearchIndexes("vector_index")
// → [ { name: 'vector_index', type: 'vectorSearch', status: 'READY', queryable: true, ... } ]
```

### Which similarity?

| `similarity` | Measures | Use when |
| --- | --- | --- |
| `cosine` | The angle between vectors | Safe default for most text models |
| `dotProduct` | Angle and length | Your model's docs say vectors are normalised and recommend it |
| `euclidean` | Straight-line distance | Your model's docs recommend it, often for images |

> **Tip:** Check your embedding model's documentation. It usually tells you the dimensions and the best similarity function.

## Your first $vectorSearch

Our question is "a romantic film about robots". Pretend the embedding model turned it into `[0.05, 0.70, 0.60]` (lots of romance, quite a bit of sci-fi).

`$vectorSearch` must be the **first** stage of the pipeline:

```javascript
db.movies.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "plotEmbedding",
      queryVector: [0.05, 0.70, 0.60],
      numCandidates: 50,
      limit: 3
    }
  },
  { $project: { _id: 0, title: 1, genre: 1, score: { $meta: "vectorSearchScore" } } }
])
```

```javascript
[
  { title: 'Robot Heart',  genre: 'sci-fi',  score: 0.994 },
  { title: 'Monsoon Love', genre: 'romance', score: 0.911 },
  { title: 'Space Rescue', genre: 'sci-fi',  score: 0.826 }
]
```

"Robot Heart" wins: it's both romantic and sci-fi. Notice that **no words matched at all**. The search worked purely on meaning.

The score runs from 0 to 1. Higher means more similar.

### What the fields mean

| Field | Meaning |
| --- | --- |
| `index` | Name of the vector search index |
| `path` | Field holding the vectors |
| `queryVector` | The embedding of the user's question (same model, same dimensions!) |
| `numCandidates` | How many nearest neighbours to consider before picking the top results |
| `limit` | How many documents to return |
| `filter` | Optional pre-filter on fields indexed as `filter` |
| `exact` | Optional. `true` compares against every vector (slow, perfect). Default `false` |

### ANN vs exact search

By default `$vectorSearch` runs an **approximate nearest neighbour (ANN)** search. It uses a clever graph structure (called HNSW) to find very close matches quickly, without comparing your query against every single vector.

- `numCandidates` controls the trade-off: more candidates means better accuracy but a slower query. A good starting point is **10 to 20 times** your `limit`.
- For small collections, or to check accuracy, use **exact nearest neighbour (ENN)** with `exact: true` and no `numCandidates`:

```javascript
db.movies.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "plotEmbedding",
      queryVector: [0.05, 0.70, 0.60],
      exact: true,
      limit: 3
    }
  }
])
```

## Pre-filtering

Often you want "similar movies, but only from 2020 onwards" or "only sci-fi". Use `filter`. It narrows the search **before** finding neighbours, so you still get a full `limit` of results.

```javascript
db.movies.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "plotEmbedding",
      queryVector: [0.05, 0.70, 0.60],
      numCandidates: 50,
      limit: 3,
      filter: { $and: [ { genre: "sci-fi" }, { year: { $gte: 2020 } } ] }
    }
  },
  { $project: { _id: 0, title: 1, year: 1, score: { $meta: "vectorSearchScore" } } }
])
```

```javascript
[
  { title: 'Robot Heart',  year: 2024, score: 0.994 },
  { title: 'Space Rescue', year: 2021, score: 0.826 }
]
```

Filter fields **must** be declared as `type: "filter"` in the index, or the query errors. Filters support common operators like `$eq`, `$in`, `$gt`, `$lt`, `$and` and `$or`.

> **Note:** You can also add a `$match` **after** `$vectorSearch` (a post-filter). That runs on the results only, so you may end up with fewer than `limit` documents. Prefer the built-in `filter` when you can.

## Vector search in an AI app (RAG)

The most common AI use is **RAG**, short for **Retrieval-Augmented Generation**. A chatbot answers questions using **your** documents instead of guessing.

```text
1. User asks:   "What is your return policy for headphones?"
2. Your app:    turns the question into an embedding
3. MongoDB:     $vectorSearch finds the 5 most relevant help articles
4. Your app:    sends the question + those 5 articles to a language model
5. The model:   writes an answer based on the articles
```

Here's the retrieval part in Node.js. `getEmbedding()` stands for a call to your embedding provider's API:

```javascript
async function findRelevantArticles(db, question) {
  const queryVector = await getEmbedding(question); // e.g. 1024 numbers

  return db.collection("helpArticles").aggregate([
    {
      $vectorSearch: {
        index: "articles_vector_index",
        path: "embedding",
        queryVector,
        numCandidates: 100,
        limit: 5
      }
    },
    { $project: { _id: 0, title: 1, body: 1, score: { $meta: "vectorSearchScore" } } }
  ]).toArray();
}
```

When you insert an article, you store its embedding alongside it:

```javascript
const body = "Headphones can be returned within 30 days if unopened...";
await db.collection("helpArticles").insertOne({
  title: "Returns: audio products",
  body,
  embedding: await getEmbedding(body)
});
```

> **Warning:** Use the **same embedding model** for stored documents and for queries. Vectors from different models live on different "maps" and can't be compared, even if the dimensions match.

## Storing vectors efficiently

Embeddings are big. A million documents with 1536 dimensions is about 6 GB of vectors as plain doubles. Two features help:

- **Quantization:** set `quantization: "scalar"` or `"binary"` on the vector field in the index. The index stores compressed vectors, using far less RAM, with a small accuracy cost.
- **BSON binary vectors:** drivers can store vectors as a compact `BinData` vector subtype instead of an array of doubles, which shrinks documents on disk.

Start simple with arrays of numbers. Reach for these once your collection grows.

## Vector search plus keyword search

Vector search is great at meaning, but can miss exact terms like product codes ("USB-C") or names. Keyword search is the opposite. The best results often come from using **both** and merging the rankings. That's called **hybrid search**, and it's the topic of the next lesson.

## Common mistakes

- **`numDimensions` doesn't match the model.** If the index says 1536 and your vectors have 1024 numbers, they aren't indexed. Check your model's output size.
- **Mixing embedding models.** Query vectors must come from the same model as the stored vectors.
- **Filtering on a field not in the index.** Add it as `{ type: "filter", path: "..." }` first.
- **`numCandidates` smaller than `limit`.** It must be at least `limit`. Aim for 10 to 20 times higher for good recall.
- **Returning the huge vector field.** Project only the fields you need, or your responses become megabytes of numbers.

## Practice

1. Write a vector search index definition for a `products` collection with 1024-dimension embeddings in a field called `descEmbedding`, using cosine similarity, and allowing filters on `category`.
2. Write a `$vectorSearch` query on that index that returns the 5 nearest products in the `electronics` category, with their scores.
3. Using the toy `movies` collection, find the 2 movies closest to `[0.9, 0.05, 0.1]` (pure action). Which do you expect to win?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Index
db.products.createSearchIndex("products_vector_index", "vectorSearch", {
  fields: [
    { type: "vector", path: "descEmbedding", numDimensions: 1024, similarity: "cosine" },
    { type: "filter", path: "category" }
  ]
})

// 2. Query (queryVector would come from your embedding model)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "products_vector_index",
      path: "descEmbedding",
      queryVector: queryVector,
      numCandidates: 100,
      limit: 5,
      filter: { category: "electronics" }
    }
  },
  { $project: { _id: 0, name: 1, score: { $meta: "vectorSearchScore" } } }
])

// 3. Pure action: expect "Street Chase" first, then "Laser Duel"
db.movies.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "plotEmbedding",
      queryVector: [0.9, 0.05, 0.1],
      numCandidates: 20,
      limit: 2
    }
  },
  { $project: { _id: 0, title: 1, score: { $meta: "vectorSearchScore" } } }
])
```

</details>

## Key takeaways

- An **embedding** is a list of numbers describing meaning. Similar meanings give nearby vectors.
- Create a `vectorSearch` index with the vector `path`, `numDimensions` and `similarity`, plus any `filter` fields.
- `$vectorSearch` must be the first stage. Set `queryVector`, `numCandidates` and `limit`, and read `{ $meta: "vectorSearchScore" }`.
- Use `filter` for pre-filtering, and `exact: true` for small collections or accuracy checks.
- Vector search powers **RAG** chatbots and semantic search. It runs on Atlas, in a local Atlas deployment, or on Community 8.2+ with `mongot`.

**Next lesson:** [Hybrid Search with rankFusion and scoreFusion](/courses/mongodb/rank-and-score-fusion)
