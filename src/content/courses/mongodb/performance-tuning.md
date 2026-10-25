---
title: Performance Tuning and Working Set Sizing
slug: performance-tuning
metadescription: Learn what the working set is, how the WiredTiger cache uses RAM, and a step-by-step method to find and fix slow MongoDB queries.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'performance', 'indexes', 'wiredtiger']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [explain and Query Plans](/courses/mongodb/explain-and-query-plans) and [Single Field and Compound Indexes](/courses/mongodb/indexes-single-and-compound).

## What you will learn

By the end of this lesson you will know:

- What the **working set** is and why it should fit in RAM
- How the **WiredTiger cache** uses memory, and how to check it
- How to measure data and index sizes
- A simple, repeatable order for tuning: **find, explain, fix, measure**
- How to use the **database profiler** and `$indexStats` to find slow queries and unused indexes

Everything in this lesson works on a local `mongod`. A few commands (like the profiler) are limited on Atlas free and Flex tiers, where Atlas gives you its own Query Profiler page instead.

## Why performance is mostly about memory

Reading from RAM is thousands of times faster than reading from disk. MongoDB is fast when the data it needs **right now** is already in memory.

> **Think of it like this:** Your desk is RAM and the filing cabinet across the room is disk. If the papers you use every day fit on your desk, you work quickly. If your desk is too small, you keep walking to the cabinet and back, and everything slows down.

## The working set

The **working set** is the part of your data and indexes that your app touches regularly.

It is usually much smaller than the whole database. A shop with five years of orders might only read the last month's orders often. So the working set is:

- the **indexes** your queries use (these are read on almost every query), plus
- the **documents** that are read or written often (recent orders, popular products, active users)

**Goal:** the working set should fit in the WiredTiger cache. When it doesn't, MongoDB constantly evicts pages from memory and reads them back from disk. Queries that took 2 ms suddenly take 200 ms.

## The WiredTiger cache

**WiredTiger** is MongoDB's storage engine. It keeps a cache of recently used data and index pages in RAM.

By default the cache size is the **larger** of:

- 50% of (total RAM minus 1 GB), or
- 256 MB

So a server with 16 GB of RAM gets a cache of about 7.5 GB. The rest of the RAM is still useful: the operating system uses it to cache files, and MongoDB uses some for connections and query work.

### Checking the cache

`db.serverStatus()` reports the cache numbers. Let's pull out the important ones:

```javascript
const c = db.serverStatus().wiredTiger.cache
({
  maxBytes:     c["maximum bytes configured"],
  inCache:      c["bytes currently in the cache"],
  dirty:        c["tracked dirty bytes in the cache"],
  readIntoCache: c["pages read into cache"]
})
// → { maxBytes: 7784628224, inCache: 1203411005, dirty: 1048576, readIntoCache: 18233 }
```

How to read it:

| Number | Healthy sign | Warning sign |
| --- | --- | --- |
| `inCache` vs `maxBytes` | Some headroom, or full but stable | Always at about 95-100% of max |
| `dirty` | Small share of the cache | Large and growing (writes can't keep up) |
| `readIntoCache` | Grows slowly | Grows fast all the time (data keeps coming back from disk) |

### Changing the cache size

Usually you leave the default alone. If you run other programs on the same server (not recommended), or run several `mongod` processes in containers, you can set it in `mongod.conf`:

```yaml
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4
```

MongoDB 8.2 also added `cacheSizePct`, which sets the cache as a percentage of RAM instead of a fixed number. That is handy for containers that move between machine sizes.

> **Warning:** Making the cache bigger than the default rarely helps and can starve the operating system. Fix indexes and queries first.

## Measuring data and index sizes

To guess the working set, first find out how big things are. For one collection:

```javascript
use shop
db.orders.dataSize()        // uncompressed size of documents, in bytes
db.orders.storageSize()     // compressed size on disk
db.orders.totalIndexSize()  // size of all indexes, in bytes
```

For the whole database, `db.stats()` accepts a scale. Passing `1024 * 1024` shows megabytes:

```javascript
db.stats(1024 * 1024)
// → { db: 'shop', collections: 3, objects: 1250000, dataSize: 2048.5,
//     storageSize: 690.2, indexes: 9, indexSize: 310.7, ... }
```

### A quick working set estimate

Let's estimate for our shop:

| Piece | Size | Hot? |
| --- | --- | --- |
| All indexes | 310 MB | Yes, assume all of it |
| Orders from the last 30 days | about 5% of 2 GB = 100 MB | Yes |
| Products and customers | 80 MB | Yes |
| Old orders | 1.8 GB | No, rarely read |

Working set is roughly 310 + 100 + 80 = **about 490 MB**. A 2 GB cache has plenty of room. A 256 MB cache (say, a tiny container) would struggle.

> **Tip:** Indexes are almost always "hot". If `totalIndexSize()` alone is bigger than your cache, you need more RAM, fewer or smaller indexes, or sharding.

## A tuning method: find, explain, fix, measure

Random tweaking wastes time. Follow these steps in order.

### Step 1: find the slow queries

Turn on the **database profiler** for slow operations only. Level `1` records operations slower than `slowms`:

```javascript
db.setProfilingLevel(1, { slowms: 100 })
// → { was: 0, slowms: 100, sampleRate: 1, ok: 1 }
```

Use the app for a while, then look at the slowest recent operations:

```javascript
db.system.profile.find(
  {},
  { op: 1, ns: 1, millis: 1, planSummary: 1, docsExamined: 1, nreturned: 1 }
).sort({ millis: -1 }).limit(5)
```

```javascript
[
  {
    op: 'query', ns: 'shop.orders', millis: 812,
    planSummary: 'COLLSCAN', docsExamined: 1250000, nreturned: 12
  },
  ...
]
```

`COLLSCAN` plus 1.25 million documents examined for 12 results is a big red flag.

> **Note:** Even with the profiler off, MongoDB writes operations slower than 100 ms to its log file. The profiler just makes them easier to query. Set it back to `0` when you are done, because level `2` (log everything) adds real overhead.

### Step 2: explain the query

Copy the slow query and run it with `explain("executionStats")`:

```javascript
db.orders.find({ status: "pending", customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") })
  .sort({ createdAt: -1 })
  .explain("executionStats").executionStats
// → { nReturned: 12, totalKeysExamined: 0, totalDocsExamined: 1250000, executionTimeMillis: 790, ... }
```

The key ratio is **docs examined per document returned**. Here it is about 100,000 to 1. Ideally it is close to 1 to 1.

### Step 3: fix it

Most fixes are one of these:

1. **Add the right index.** Use the **ESR rule**: **E**quality fields first, then **S**ort fields, then **R**ange fields.

   ```javascript
   // Equality: customerId, status. Sort: createdAt.
   db.orders.createIndex({ customerId: 1, status: 1, createdAt: -1 })
   ```

2. **Return less data.** Use a projection and a `limit`, so less is read and sent over the network.

   ```javascript
   db.orders.find(
     { customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0"), status: "pending" },
     { _id: 0, total: 1, createdAt: 1 }
   ).sort({ createdAt: -1 }).limit(20)
   ```

3. **Make it a covered query.** If the filter, sort and projection only use indexed fields (and you exclude `_id`), MongoDB answers from the index alone and `totalDocsExamined` becomes `0`.

4. **Change the schema.** If you always load an order with its items, embed them. If a document keeps growing (like an unbounded array of comments), move that data to its own collection.

### Step 4: measure again

Rerun the `explain`. You want to see an `IXSCAN`, and keys examined close to documents returned:

```javascript
// → { nReturned: 12, totalKeysExamined: 12, totalDocsExamined: 12, executionTimeMillis: 1, ... }
```

From 790 ms to 1 ms. Then check the profiler again to find the next slowest query.

## Remove indexes nobody uses

Indexes speed up reads, but every index costs RAM and slows down every write (each insert must update every index). `$indexStats` shows how often each index has been used since the server started:

```javascript
db.products.aggregate([{ $indexStats: {} }, { $project: { name: 1, "accesses.ops": 1 } }])
// → [ { name: '_id_', accesses: { ops: Long(5320) } },
//     { name: 'category_1_price_1', accesses: { ops: Long(18210) } },
//     { name: 'tags_1', accesses: { ops: Long(0) } } ]
```

`tags_1` has zero uses. Before dropping it, you can **hide** it to test safely. A hidden index is still maintained but the planner ignores it:

```javascript
db.products.hideIndex("tags_1")
// watch for a few days; if nothing gets slower:
db.products.dropIndex("tags_1")
// if something did get slower:
db.products.unhideIndex("tags_1")
```

> **Note:** `$indexStats` counters reset when the server restarts, and each replica set member counts separately. Look at a long enough period, and on every member that serves reads.

## Write performance tips

Reads get most of the attention, but writes can be slow too.

- **Batch writes** with `insertMany` or `bulkWrite` instead of thousands of single calls.
- **Keep the number of indexes reasonable.** Each extra index adds work to every write.
- **Pick the write concern you need.** `w: "majority"` is safest and is the default. Lowering it is rarely worth the risk.
- **Avoid huge, growing documents.** Rewriting a 10 MB document to add one comment is expensive.

## A tuning checklist

| Check | Command | Good result |
| --- | --- | --- |
| Slow queries | `db.system.profile.find().sort({ millis: -1 })` | Nothing over your target |
| Query plan | `.explain("executionStats")` | `IXSCAN`, low docs examined |
| Index sizes | `db.orders.totalIndexSize()` | Fits easily in cache |
| Cache pressure | `db.serverStatus().wiredTiger.cache` | Stable, not constantly full of dirty pages |
| Unused indexes | `$indexStats` | No indexes with `ops: 0` |

## Common mistakes

- **Buying a bigger server before checking indexes.** One missing index can make a query 1,000 times slower. Always explain first.
- **Leaving the profiler at level 2.** It records every operation and slows the server. Use level 1 with a sensible `slowms`, and turn it off afterwards.
- **Indexing every field "just in case".** Unused indexes waste RAM and slow writes. Check `$indexStats` and hide, then drop, the useless ones.
- **Ignoring sort order in compound indexes.** An index on `{ createdAt: 1, customerId: 1 }` doesn't help a query that filters on `customerId` and sorts by `createdAt`. Follow the ESR rule.
- **Measuring on a cold server.** The first run after a restart reads from disk. Run a query a couple of times before judging its speed.

## Practice

1. Turn on the profiler for operations slower than 50 ms, then write a query that shows the 3 slowest operations on `shop.orders`.
2. This query is slow: `db.products.find({ category: "electronics", price: { $lt: 1000 } }).sort({ rating: -1 })`. Write an index using the ESR rule.
3. Write the commands to hide, and later drop, an index called `stock_1`.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Profiler and slowest operations
db.setProfilingLevel(1, { slowms: 50 })
db.system.profile.find({ ns: "shop.orders" }).sort({ millis: -1 }).limit(3)

// 2. Equality (category), Sort (rating), Range (price)
db.products.createIndex({ category: 1, rating: -1, price: 1 })

// 3. Hide first, drop when you're sure
db.products.hideIndex("stock_1")
db.products.dropIndex("stock_1")
```

</details>

## Key takeaways

- The **working set** is the data and indexes your app uses often. Keep it inside the **WiredTiger cache** (by default about half of RAM minus 1 GB).
- Check cache pressure with `db.serverStatus().wiredTiger.cache` and sizes with `dataSize()`, `totalIndexSize()` and `db.stats()`.
- Tune in order: **find** slow queries (profiler), **explain** them, **fix** (index, projection, schema), then **measure** again.
- The **ESR rule** (Equality, Sort, Range) is the quickest way to design a good compound index.
- Unused indexes cost RAM and write speed. Find them with `$indexStats`, hide them, then drop them.

**Next lesson:** [Monitoring with serverStatus and FTDC](/courses/mongodb/monitoring-and-ftdc)
