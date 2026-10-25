---
title: The Cost-Based Ranker
slug: cost-based-ranker
metadescription: How the MongoDB query planner picks a plan, from multi-planner trial runs to the cost-based ranker (CBR) in MongoDB 8.3, and how to spot it in explain.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'query-planner', 'explain', 'performance']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- How MongoDB's classic **multi-planner** picks a plan by "racing" candidate plans
- What a **cost-based ranker** (CBR) is, and how it picks a plan by *estimating* instead of racing
- How MongoDB 8.3 combines the two: multi-planning with a CBR **backup**
- Where to see the planner's decisions: `explain()` fields, the plan cache and `serverStatus`
- What you, as a developer, should actually do about it

> **Before you start:** this lesson assumes you've read [explain and Query Plans](/courses/mongodb/explain-and-query-plans).

> **Version check:** The cost-based ranker described here is part of **MongoDB 8.3**. In the official 8.3 release notes it appears under the **8.3.3** patch release (June 2026), and the related `explain()` fields are marked "New in version 8.3.3". If you run MongoDB 8.0 or 8.2, your server uses the classic multi-planner only. Everything in the first half of this lesson applies to every version.

## The planner's job, in one picture

Remember from the last lesson: when a query could be answered in several ways, MongoDB builds several **candidate plans**. For example, with indexes on `{ category: 1, price: 1 }` and `{ price: 1 }`, this query has at least two options:

```javascript
use shop
db.products.find({ category: "electronics", price: { $lt: 1000 } })
```

- **Plan A:** scan `category_1_price_1` for electronics under 1000.
- **Plan B:** scan `price_1` for everything under 1000, then throw away non-electronics.

Someone has to decide. That's the planner. There are two broad ways to decide:

1. **Try them** and see which is faster (the multi-planner).
2. **Estimate** how much work each would take, without running them (a cost-based ranker).

> **Think of it like this:** You need to pick the fastest route to college. Option one: send three friends on three routes at the same time and see who arrives first. Option two: look at a map, count the distance and the traffic lights, and calculate which route *should* be fastest. The first is a race. The second is a cost estimate.

## The classic way: the multi-planner

For many years MongoDB has used the **multi-planner**. Here's what it does when a new query shape arrives:

1. Build all reasonable candidate plans.
2. Run them **side by side** for a short **trial period**, taking turns doing small units of work.
3. Stop when one plan has produced a full first batch of results, or when a work limit is reached.
4. Give each plan a **score**, mostly based on how many results it produced for the work it did.
5. The highest score wins. The winner finishes the query, and the others are thrown away.

In short, the official docs describe the winner as the plan that returns the most results during the trial while doing the least work.

You can watch this race with the `allPlansExecution` mode:

```javascript
db.products.find({ category: "electronics", price: { $lt: 1000 } })
  .explain("allPlansExecution")
  .executionStats.allPlansExecution
// → [
//   { nReturned: 1, totalKeysExamined: 1, totalDocsExamined: 1, ... },   // compound index plan
//   { nReturned: 1, totalKeysExamined: 4, totalDocsExamined: 4, ... }    // price_1 plan
// ]
```

The compound-index plan got the same result with less work, so it won.

### Why the race is usually great

- It measures **real** performance on **your** data, not a guess.
- It's simple and has served MongoDB well for years.

### Where the race struggles

- **Every candidate costs time.** With many indexes there can be many plans, and racing all of them takes CPU before the real work even starts.
- **The race is short.** A plan that looks good for the first few hundred documents might be terrible over the whole query, and vice versa.
- **No result, no clear winner.** If none of the plans manages to return results during the trial (for example, a query with very few matches deep in a large collection), the scores tell the planner very little, and the trial can drag on.

## The new way: a cost-based ranker

A **cost-based ranker** (CBR) chooses a plan **without running it**. Instead it:

1. Looks at each step (each **stage**, like `IXSCAN`, `FETCH` or `SORT`) of each candidate plan.
2. Estimates how many documents or index keys each stage will handle. This guess is called a **cardinality estimate** ("cardinality" just means "how many").
3. Turns those estimates into a **cost**, using a cost formula for each kind of stage.
4. Adds up the costs. The plan with the **lowest total cost** wins.

Most SQL databases (PostgreSQL, MySQL, SQL Server) have always worked this way. MongoDB 8.3 brings the idea to MongoDB.

### How does it estimate "how many"?

According to the 8.3 explain documentation, the estimate for each stage comes from one of these sources:

| Source (`ceSource`) | Plain-English meaning |
| --- | --- |
| `sampling` | MongoDB looks at a small **sample** of the collection and scales up. |
| `heuristics` | A set of built-in rules of thumb. Used only when sampling fails. |
| `metadata` | Facts MongoDB already knows, like how many documents the collection has. |
| `code` | Values the server can compute directly, for example a constant. |
| `mixed` | A combination of the above. |

> **Think of it like this:** Sampling is like tasting one spoonful to judge a whole pot of dal. You don't eat the whole pot, but one good spoonful tells you a lot about the salt.

## MongoDB 8.3: multi-planning with a CBR backup

MongoDB 8.3 does **not** throw the multi-planner away. Instead the two work as a team. The official docs say that, starting in MongoDB 8.3, the default way to choose a plan for eligible queries is **multi-planning with a cost-based ranker as the backup**.

Here's the flow, step by step:

```text
New query shape arrives
        │
        ▼
Multi-planner runs a short trial race
        │
        ├── Found a plan that returns results quickly?  ──►  Use it (classic behaviour)
        │
        └── No clear winner in the short trial?
                    │
                    ▼
        Built-in rules decide:
          • keep racing with the multi-planner, or
          • hand over to the CBR, which estimates the cost
            of every stage and picks the cheapest plan
                    │
                    ▼
        Winning plan is stored in the plan cache
```

A few important details from the docs:

- It's **on by default** for **eligible** queries in 8.3. The documentation doesn't list exactly which queries are eligible.
- The CBR is a **backup**. The docs say MongoDB currently invokes the CBR for only a small share of queries. For most everyday queries you'll still see the classic multi-planner choose the plan.
- Whichever mechanism wins, the chosen plan goes into the **same plan cache** and is reused for queries with the same shape.
- The 8.3 release notes also mention improved tail latency (fewer occasional slow queries) when the CBR takes over from a multi-planner trial that would otherwise run long.

> **Note:** "Tail latency" means the slowest few percent of requests. Users notice those, even if the average is fast. Cutting long trial races helps exactly there.

## Seeing it in explain()

When the CBR picks the plan, `explain()` shows extra fields on the winning plan and on each stage inside it. These fields are new in **MongoDB 8.3.3**:

| Field | Meaning |
| --- | --- |
| `costEstimate` | Estimated cost of this stage, in abstract "cost units". The CBR picks the plan with the lowest top-level `costEstimate`. |
| `cardinalityEstimate` | Estimated number of documents or keys this stage produces. |
| `numKeysEstimate` | Estimated number of index keys the plan will scan. |
| `numDocsEstimate` | Estimated number of documents scanned. |
| `estimatesMetadata.ceSource` | Where the estimate came from: `sampling`, `heuristics`, `metadata`, `code` or `mixed`. |

The shape looks like this (values are illustrative):

```javascript
{
  queryPlanner: {
    winningPlan: {
      isCached: false,
      stage: 'FETCH',
      costEstimate: 0.41,
      cardinalityEstimate: 12,
      estimatesMetadata: { ceSource: 'sampling' },
      inputStage: {
        stage: 'IXSCAN',
        indexName: 'category_1_price_1',
        costEstimate: 0.18,
        cardinalityEstimate: 12,
        numKeysEstimate: 12,
        estimatesMetadata: { ceSource: 'sampling' }
      }
    },
    rejectedPlans: [ /* ... each with its own costEstimate ... */ ]
  }
}
```

If those `...Estimate` fields are **missing**, the classic multi-planner made the choice. In 8.3.3 `executionStats` also has a `score` field, described as the score of the winning plan chosen by the multi-planner.

> **Tip:** Compare the estimates with reality. Run `explain("executionStats")` and compare `cardinalityEstimate` / `numKeysEstimate` with the real `nReturned` and `totalKeysExamined`. If the guesses are wildly off, that's useful information when you investigate a slow query.

> **Warning:** On a tiny practice collection like our 5 products, the multi-planner finds a winner instantly, so you'll almost never see CBR fields locally. That's expected, not a bug.

## Seeing it in serverStatus

MongoDB 8.3 also adds counters under `metrics.query.cbr` in `serverStatus`, so you can see how often the CBR is involved on a server:

```javascript
db.serverStatus().metrics.query.cbr
```

The release notes list fields such as `count`, `choseWinningPlan`, `numPlans`, `micros`, `samplingMicros`, `numPlansFailedCostEstimation`, `numPlansTiedCostEstimation` and a `histograms` sub-document. Going by their names, they track things like how often the CBR ran, how often it picked the winner, how many plans it costed and how much time it spent. Check the `serverStatus` reference for your exact version for the precise meaning of each one. You'll learn more about `serverStatus` in [Monitoring with serverStatus and FTDC](/courses/mongodb/monitoring-and-ftdc).

> **Note:** The 8.3 release notes also mention new CBR metrics in `$queryStats`. Availability of `$queryStats` depends on your deployment, so check the docs before relying on it.

## The plan cache: the same for both

No matter who picks the plan, MongoDB doesn't want to plan the same query shape again and again. It stores the winner in the **plan cache**:

```javascript
// Look at cached plans for the products collection
db.products.aggregate([ { $planCacheStats: {} } ])

// Clear the cache for the collection (handy while experimenting)
db.products.getPlanCache().clear()
```

Things that clear or refresh cached plans include:

- Restarting the `mongod` server (the cache lives in memory only).
- Creating or dropping an index on the collection, or other changes to the collection's definition.
- The cache running out of room (the least recently used entries are dropped first).

> **Note:** As you saw last lesson, `explain()` ignores the plan cache and doesn't add entries to it. It always shows a fresh planning decision.

## Is there a switch to turn the CBR on or off?

The official 8.3 documentation describes the CBR as the default for eligible queries, but it does **not** document a public setting for turning it off or forcing it on. So this course doesn't show one. Don't copy random parameter names from forums or old bug tickets into a production server.

If the planner picks a bad plan for one of your queries, the supported tools are the same in every 8.x version:

- **Add or fix an index** so the good plan is obviously better (often the real fix; use the ESR rule).
- **`hint()`** to force an index while testing:

  ```javascript
  db.products.find({ category: "electronics", price: { $lt: 1000 } }).hint({ category: 1, price: 1 })
  ```

- **Query settings** (`setQuerySettings`, MongoDB 8.0+) to pin index choices for a query shape on the server, without changing app code. You'll learn them in [Query Settings and Index Hints](/courses/mongodb/query-settings-and-hints).

## Multi-planner vs cost-based ranker

| | Multi-planner | Cost-based ranker |
| --- | --- | --- |
| How it decides | Runs candidates for a short trial and scores them | Estimates each stage's cardinality and cost |
| Uses real execution? | Yes, a short trial | No, estimates (often from sampling) |
| Strength | Measures your real data | Doesn't waste time racing many plans; helps when the trial finds no clear winner |
| Weakness | Trials can be slow or misleading | Estimates can be wrong |
| Where in MongoDB | All versions | 8.3+, as a backup for eligible queries |
| Shows in explain | `executionStats.score` (8.3.3+) | `costEstimate`, `cardinalityEstimate`, `estimatesMetadata` (8.3.3+) |

## Common mistakes

- **Assuming the CBR runs for every query.** In 8.3 it's a backup, invoked for a small share of queries. Most plans are still chosen by the multi-planner.
- **Expecting CBR fields on old servers.** `costEstimate` and friends only exist in 8.3.3 and later. On 8.0 you won't see them.
- **Trusting an estimate over the real numbers.** Estimates are guesses. Always confirm with `explain("executionStats")`.
- **Using undocumented knobs.** If you can't find a setting in the official docs for your version, don't use it in production. Fix indexes, or use `hint()` and query settings.
- **Forgetting the plan cache while testing.** A cached plan can hide your index change. Clear the cache or rely on `explain()`, which ignores it.

## Practice

1. With indexes `{ category: 1, price: 1 }` and `{ price: 1 }` on `products`, run the electronics-under-1000 query with `explain("allPlansExecution")`. Which plan did more work during the trial?
2. Write the command that lists the plan cache entries for `products`, then the one that clears them.
3. You're on MongoDB 8.3.3 and a winning plan shows `estimatesMetadata: { ceSource: 'heuristics' }`. In plain words, what does that tell you?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Compare totalKeysExamined / totalDocsExamined for each candidate
db.products.find({ category: "electronics", price: { $lt: 1000 } })
  .explain("allPlansExecution")
  .executionStats.allPlansExecution
// The price_1 plan examines more keys and documents (every product under 1000),
// so the category_1_price_1 plan wins.

// 2.
db.products.aggregate([ { $planCacheStats: {} } ])
db.products.getPlanCache().clear()

// 3. The cost-based ranker chose this plan, and for this stage it could not
//    estimate from a sample, so it fell back to built-in rules of thumb.
//    Double-check the plan with explain("executionStats") before trusting it.
```

</details>

## Key takeaways

- The **query planner** must choose between candidate plans. It can **race** them or **estimate** them.
- The classic **multi-planner** races plans in a short trial and picks the one with the most results for the least work.
- A **cost-based ranker** estimates each stage's cardinality and cost, and picks the cheapest plan without running it.
- In **MongoDB 8.3**, multi-planning with a **CBR backup** is the default for eligible queries; the CBR steps in only when the trial doesn't find a clear winner.
- Spot CBR decisions in explain via `costEstimate`, `cardinalityEstimate` and `estimatesMetadata.ceSource` (8.3.3+), and server-wide via `serverStatus().metrics.query.cbr`.
- Both mechanisms share the **plan cache**. To steer a query, fix indexes or use `hint()` and query settings, not undocumented switches.

**Next lesson:** [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals)
