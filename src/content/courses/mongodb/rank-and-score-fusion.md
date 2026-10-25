---
title: Hybrid Search with rankFusion and scoreFusion
slug: rank-and-score-fusion
metadescription: Learn hybrid search in MongoDB. Combine keyword and vector search results with $rankFusion (reciprocal rank fusion) and $scoreFusion (score-based fusion).
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'hybrid-search', 'vector-search', 'aggregation']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Atlas Search and the search Stage](/courses/mongodb/atlas-search) and [Vector Search for AI Workloads](/courses/mongodb/vector-search).

## What you will learn

By the end of this lesson you will know:

- What **hybrid search** is and why it often beats keyword or vector search alone
- How `$rankFusion` merges results using **Reciprocal Rank Fusion (RRF)**
- How to give each input a **weight** and see the score breakdown
- How `$scoreFusion` merges results using their actual **scores**, with normalization
- Which stage to pick, and which versions support them

| Stage | Available |
| --- | --- |
| `$rankFusion` | MongoDB 8.0 and later |
| `$scoreFusion` | MongoDB 8.3 and later (it was a preview in 8.2) |

Both are normal aggregation stages. If your input pipelines use `$search` or `$vectorSearch` you need `mongot` (Atlas, a local Atlas deployment, or Community 8.2+ with `mongot`). But you can also feed them plain `$match` + `$sort` pipelines, which work on any local `mongod` of the right version. We'll start with that so you can try it straight away.

## Why hybrid search?

Each kind of search has a blind spot:

| Search type | Great at | Weak at |
| --- | --- | --- |
| Keyword (`$search`) | Exact words, product codes, names ("USB-C", "Asha Roy") | Synonyms and meaning ("earphones" vs "headphones") |
| Vector (`$vectorSearch`) | Meaning, paraphrases, "find things like this" | Exact terms, rare words, codes |

**Hybrid search** runs both and merges the two ranked lists into one. Documents that do well in **both** lists rise to the top.

> **Think of it like this:** You ask two friends to recommend restaurants. One knows every place by name and cuisine. The other just "gets" what kind of evening you want. A restaurant both friends mention is probably a safe bet. Fusion is how you combine their two lists fairly.

## The problem with "just add the scores"

Why not add the `$search` score and the `$vectorSearch` score together? Because they are on **different scales**. A search score might be 0.5 or 14.2 depending on the words. A vector score is always between 0 and 1. Adding them lets the bigger scale win every time.

There are two fixes:

1. **Ignore scores, use positions** (1st, 2nd, 3rd...). That's what `$rankFusion` does.
2. **Rescale the scores to the same range first**, then combine. That's what `$scoreFusion` does.

## $rankFusion: combining by rank

`$rankFusion` uses **Reciprocal Rank Fusion (RRF)**. For each document, and for each input list it appears in, it adds:

```text
weight / (60 + rank)
```

`rank` is the document's position in that list (1 for first place). `60` is a fixed constant that MongoDB uses to keep things smooth. A document missing from a list gets nothing from that list.

So first place is worth 1/61 = 0.0164, second place 1/62 = 0.0161, and so on. Appearing in two lists roughly doubles your score.

### A local example with the shop data

Let's rank products for a "good value" page by merging two lists:

- **cheapest**: in-stock products, sorted by price
- **topRated**: rated products, sorted by rating

```javascript
use shop
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          cheapest: [
            { $match: { stock: { $gt: 0 } } },
            { $sort: { price: 1 } }
          ],
          topRated: [
            { $match: { rating: { $exists: true } } },
            { $sort: { rating: -1 } }
          ]
        }
      }
    }
  },
  { $project: { _id: 0, name: 1, price: 1, rating: 1, score: { $meta: "score" } } }
])
```

```javascript
[
  { name: 'Coffee Mug', price: 249,  rating: 4.8, score: 0.03226 },
  { name: 'Headphones', price: 1999, rating: 4.5, score: 0.03175 },
  { name: 'Gel Pen',    price: 15,               score: 0.01639 },
  { name: 'Notebook',   price: 49,               score: 0.01613 }
]
```

Let's check the Coffee Mug by hand. It is 3rd in `cheapest` and 1st in `topRated`:

```text
1/(60 + 3) + 1/(60 + 1) = 0.01587 + 0.01639 = 0.03226
```

The Gel Pen is the cheapest product, but it only appears in one list, so it scores lower. The USB Cable is missing completely because it has `stock: 0`.

Notice that each document appears **only once** in the output, even though some came from both pipelines. `$rankFusion` removes duplicates for you.

### Rules for input pipelines

Each input pipeline must be a **ranked selection**:

- It may only use: `$search`, `$vectorSearch`, `$match`, `$geoNear`, `$sample`, `$sort`, `$skip`, `$limit`.
- It must be **ranked**: start with `$search`, `$vectorSearch` or `$geoNear`, or contain an explicit `$sort`.
- It must not reshape documents. Do `$project`, `$addFields` and so on **after** `$rankFusion`.
- All pipelines run on the **same collection**.
- Pipeline names can't be empty, start with `$`, or contain a dot.

## Hybrid search: keyword plus vector

Now the real use case. Assume our `movies` collection from the last lesson also has a `plot` text field, a search index called `default`, and the vector index `vector_index`.

```javascript
db.movies.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          semantic: [
            {
              $vectorSearch: {
                index: "vector_index",
                path: "plotEmbedding",
                queryVector: [0.05, 0.70, 0.60],   // embedding of the user's question
                numCandidates: 100,
                limit: 20
              }
            }
          ],
          keyword: [
            {
              $search: {
                index: "default",
                text: { query: "robot love", path: ["title", "plot"] }
              }
            },
            { $limit: 20 }
          ]
        }
      },
      combination: {
        weights: { semantic: 1, keyword: 1 }
      },
      scoreDetails: true
    }
  },
  { $limit: 10 },
  {
    $project: {
      _id: 0,
      title: 1,
      score: { $meta: "score" },
      details: { $meta: "scoreDetails" }
    }
  }
])
```

Some things to notice:

- Give each input a `$limit` (or `limit` in `$vectorSearch`). Fusing the top 20 of each list is plenty for showing 10 results.
- `weights` default to `1`. Raise one to trust that list more, for example `{ semantic: 2, keyword: 1 }`.
- `scoreDetails: true` attaches a breakdown you can read with `{ $meta: "scoreDetails" }`.

A `details` value looks like this (the exact format may change between versions):

```javascript
{
  value: 0.0325,
  description: '... a sentence explaining the RRF formula ...',
  details: [
    { inputPipelineName: 'semantic', rank: 1, weight: 1, value: 0.994, ... },
    { inputPipelineName: 'keyword',  rank: 2, weight: 1, value: 3.1, ... }
  ]
}
```

This is very useful for answering "why is this result first?".

## $scoreFusion: combining by score

`$rankFusion` throws away **how much better** one result is than the next. If the top vector result has a score of 0.99 and the second 0.51, RRF treats them almost the same as 0.99 and 0.98.

`$scoreFusion` (MongoDB 8.3+) keeps that information. It:

1. Takes each pipeline's **score** for each document
2. Optionally **normalizes** the scores to the range 0 to 1
3. Combines them, by **average** (default) or by your own **expression**

> **Think of it like this:** `$rankFusion` is like combining two race results by finishing position. `$scoreFusion` looks at the actual finishing times, so a runner who won by a mile gets more credit than one who won by a nose.

### Normalization options

| `normalization` | What it does |
| --- | --- |
| `"none"` | Use raw scores as they are |
| `"sigmoid"` | Squash each score into 0 to 1 with a smooth S-shaped curve |
| `"minMaxScaler"` | Rescale so the lowest score in the list becomes 0 and the highest becomes 1 |

When mixing `$search` and `$vectorSearch`, pick `sigmoid` or `minMaxScaler` so the two lists are comparable.

### Hybrid search with $scoreFusion

```javascript
db.movies.aggregate([
  {
    $scoreFusion: {
      input: {
        pipelines: {
          semantic: [
            {
              $vectorSearch: {
                index: "vector_index",
                path: "plotEmbedding",
                queryVector: [0.05, 0.70, 0.60],
                numCandidates: 100,
                limit: 20
              }
            }
          ],
          keyword: [
            { $search: { index: "default", text: { query: "robot love", path: ["title", "plot"] } } },
            { $limit: 20 }
          ]
        },
        normalization: "minMaxScaler"
      },
      combination: {
        weights: { semantic: 0.7, keyword: 0.3 }
      },
      scoreDetails: true
    }
  },
  { $limit: 10 },
  { $project: { _id: 0, title: 1, score: { $meta: "score" }, details: { $meta: "scoreDetails" } } }
])
```

### Your own formula

For full control, set `method: "expression"` and write an arithmetic expression. Each pipeline's score is available as a variable with `$$` and the pipeline's name:

```javascript
combination: {
  method: "expression",
  expression: {
    $add: [
      { $multiply: [ "$$semantic", 3 ] },
      "$$keyword"
    ]
  }
}
```

This makes the semantic score count three times as much as the keyword score. You can use `weights` **or** `expression`, not both.

### Rules for $scoreFusion inputs

The rules are like `$rankFusion`, with one difference. Each pipeline must produce a **score**, not just an order:

- Pipelines starting with `$search`, `$vectorSearch`, or a `$match` using classic `$text` search already have a score.
- Other pipelines (like `$geoNear` or a plain `$match`) need a `$score` stage (MongoDB 8.2+) to give each document a score.

Here is a version you can try on a local 8.3 `mongod` without `mongot`, using the classic text index and a `$score` stage:

```javascript
db.products.createIndex({ description: "text", tags: "text" })

db.products.aggregate([
  {
    $scoreFusion: {
      input: {
        pipelines: {
          text: [ { $match: { $text: { $search: "gift school" } } } ],
          quality: [
            { $match: { rating: { $exists: true } } },
            { $score: { score: "$rating" } }
          ]
        },
        normalization: "minMaxScaler"
      }
    }
  },
  { $project: { _id: 0, name: 1, score: { $meta: "score" } } }
])
```

The `$score` stage turns each document's `rating` into its score for the `quality` pipeline.

## Which one should I use?

| | `$rankFusion` | `$scoreFusion` |
| --- | --- | --- |
| Combines | Positions (ranks) | Actual scores |
| Needs scores? | No, any sorted list works | Yes, each input must produce a score |
| Normalization | Not needed | `none`, `sigmoid` or `minMaxScaler` |
| Custom formula | No, weights only | Yes, `method: "expression"` |
| Version | 8.0+ | 8.3+ (preview in 8.2) |
| Best for | A robust, simple default | Fine-tuning when score gaps matter |

**Rule of thumb:** start with `$rankFusion` and equal weights. It's simple and hard to get badly wrong. Move to `$scoreFusion` when you have test queries and can measure that it improves results.

## Common mistakes

- **Reshaping documents inside an input pipeline.** `$project` or `$addFields` inside `pipelines` is not allowed. Do it after the fusion stage.
- **Forgetting to sort a `$match` pipeline.** For `$rankFusion`, a `$match` without `$sort` isn't ranked, so it's rejected. Add a `$sort`.
- **No limit on inputs.** Fusing every keyword match in a big collection is slow. Limit each input to the top 20 to 100.
- **Mixing raw scores in `$scoreFusion`.** With `normalization: "none"`, search scores usually swamp vector scores. Use `sigmoid` or `minMaxScaler`.
- **Expecting `scoreDetails` in the output automatically.** Turn it on with `scoreDetails: true` **and** project it with `{ $meta: "scoreDetails" }`.

## Practice

1. Using `$rankFusion` on `shop.products`, merge a list of products sorted by `stock` (highest first) with a list sorted by `price` (lowest first). Show the name and the fused score.
2. Repeat it, but make the `stock` list count twice as much.
3. Work out by hand the RRF score of a document that is 2nd in one list and 5th in another, both with weight 1.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Equal weights
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          inStock: [ { $match: {} }, { $sort: { stock: -1 } } ],
          cheap:   [ { $match: {} }, { $sort: { price: 1 } } ]
        }
      }
    }
  },
  { $project: { _id: 0, name: 1, score: { $meta: "score" } } }
])

// 2. Weighted
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          inStock: [ { $match: {} }, { $sort: { stock: -1 } } ],
          cheap:   [ { $match: {} }, { $sort: { price: 1 } } ]
        }
      },
      combination: { weights: { inStock: 2, cheap: 1 } }
    }
  },
  { $project: { _id: 0, name: 1, score: { $meta: "score" } } }
])

// 3. 1/(60+2) + 1/(60+5) = 0.016129 + 0.015385 = 0.031514
```

</details>

## Key takeaways

- **Hybrid search** combines keyword and vector results, so documents strong in both rise to the top.
- `$rankFusion` (8.0+) uses **Reciprocal Rank Fusion**: each list adds `weight / (60 + rank)`. It only needs ranked lists.
- `$scoreFusion` (8.3+) combines real **scores**, after optional `sigmoid` or `minMaxScaler` normalization, by average or your own expression.
- Input pipelines can only select, sort and limit. Reshape documents **after** the fusion stage.
- Turn on `scoreDetails` and read `{ $meta: "scoreDetails" }` to understand why a result ranks where it does.

**Next lesson:** [Role-Based Access Control and Users](/courses/mongodb/rbac-and-users)
