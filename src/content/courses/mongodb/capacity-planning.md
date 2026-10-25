---
title: Capacity Planning and Cost Optimisation
slug: capacity-planning
metadescription: Learn how to size MongoDB for RAM, disk, CPU and connections, estimate growth with simple maths, and cut costs with indexes, TTL, archiving and auto-scaling.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 4
tags: ['mongodb', 'capacity-planning', 'performance', 'cost']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- The four resources every MongoDB deployment needs: **RAM, disk, CPU and connections**
- How to **measure** your data and indexes with `db.stats()` and `$collStats`
- How to **estimate growth** with simple back-of-the-envelope maths
- How to check whether your **working set** fits in memory
- Practical ways to **cut costs** without hurting performance

> **Before you start:** this lesson assumes you've read [Performance Tuning and Working Set Sizing](/courses/mongodb/performance-tuning), [Monitoring with serverStatus and FTDC](/courses/mongodb/monitoring-and-ftdc) and [Atlas Data Federation and Online Archive](/courses/mongodb/data-federation-and-online-archive). All the measuring commands work on a local MongoDB.

## Why plan capacity at all?

Capacity planning answers one question: **how big does my database server need to be, now and next year?**

Get it wrong in one direction and the app becomes slow or falls over on your busiest day. Get it wrong in the other direction and you pay every month for hardware that sits idle.

> **Think of it like this:** Planning capacity is like choosing a flat. Too small, and you trip over boxes every day. Too big, and you pay rent for empty rooms. The goal is "comfortable now, with a spare room for next year".

## The four resources

| Resource | What uses it | Warning signs |
| --- | --- | --- |
| **RAM** | The WiredTiger cache (hot documents and indexes), connections, sorts | Lots of disk reads, slow queries, cache always full |
| **Disk** | Data, indexes, the oplog, logs; plus **IOPS** (reads/writes per second) | Disk over 80% full, high disk latency |
| **CPU** | Query work, compression, aggregation, TLS | CPU constantly above 70–80% |
| **Connections** | Every open client connection (about 1 MB of RAM each) | Connection count near the limit, pool timeouts |

Most performance problems in MongoDB come back to **RAM**, so we start there.

## Step 1: measure what you have

You can't plan without numbers. Start with the whole database:

```javascript
use shop
db.stats({ scale: 1024 * 1024 }) // show sizes in MB
```

```javascript
// → {
//     db: 'shop',
//     collections: 4,
//     objects: 1250340,
//     avgObjSize: 812,          // bytes per document (not scaled)
//     dataSize: 968.2,          // uncompressed data, MB
//     storageSize: 310.5,       // on disk after compression, MB
//     indexes: 11,
//     indexSize: 142.7,         // all indexes, MB
//     ...
//   }
```

Three numbers matter most:

- **`dataSize`**: how big your documents are without compression.
- **`storageSize`**: how much disk they really use (compressed).
- **`indexSize`**: how much space the indexes need. Indexes are what you most want in RAM.

For one collection, use the `$collStats` stage:

```javascript
db.orders.aggregate([
  { $collStats: { storageStats: { scale: 1024 * 1024 } } },
  { $project: {
      "storageStats.count": 1,
      "storageStats.size": 1,
      "storageStats.storageSize": 1,
      "storageStats.totalIndexSize": 1,
      "storageStats.indexSizes": 1
  } }
])
// → [ { storageStats: { size: 812.4, count: 1000000, storageSize: 251.3,
//       totalIndexSize: 98.6, indexSizes: { _id_: 41.2, status_1_createdAt_1: 57.4 } } } ]
```

Now you know exactly which collections and indexes take up space.

## Step 2: estimate growth

Next, work out how fast the data grows. A simple formula is enough:

```text
future data = average document size × new documents per day × days kept
```

Let's do it for our shop's `orders`:

| Input | Value |
| --- | --- |
| Average order document | about 0.8 KB (from `avgObjSize`) |
| New orders per day | 20,000 (expected next year) |
| How long we keep orders on the cluster | 2 years (730 days) |

```text
0.8 KB × 20,000 × 730 ≈ 11.7 GB of uncompressed data
```

Then adjust for real life:

- **Compression.** WiredTiger compresses data on disk. In the measurement above, `storageSize` was about a third of `dataSize`, so plan for roughly **4 GB on disk**. Use your own ratio, not a guess.
- **Indexes.** Ours were about 40% of `storageSize`. Add roughly **1.6 GB**.
- **The oplog.** Replica sets keep a log of recent writes. By default it is 5% of free disk space (at least 990 MB, at most 50 GB).
- **Headroom.** Keep at least **30–50% free disk** for growth, index builds, compaction and surprises.

So for orders alone, a disk of around **10–15 GB** gives comfortable room for two years. Repeat for each big collection and add them up.

> **Tip:** Put this calculation in a small spreadsheet and re-check it every few months with real `db.stats()` numbers. Plans are guesses; measurements are facts.

## Step 3: size RAM for the working set

The **working set** is the data and indexes your app touches regularly, for example the last 90 days of orders, all products, and the indexes your queries use. MongoDB is fastest when the working set fits in the **WiredTiger cache**.

By default, the WiredTiger cache uses the larger of:

- **50% of (total RAM − 1 GB)**, or
- **256 MB**

So a server with 16 GB of RAM gets a cache of about 7.5 GB. The rest is used by the operating system's file cache, connections and other memory.

```javascript
const cache = db.serverStatus().wiredTiger.cache
cache["maximum bytes configured"] / 1024 ** 3
// → 7.5          (cache size in GB)

cache["bytes currently in the cache"] / 1024 ** 3
// → 6.9          (how full it is)

cache["pages read into cache"]
// → 18342211     (keeps rising fast? data is being read from disk a lot)
```

A rough rule:

- **Indexes used by your queries** should fit in the cache with room to spare.
- **Hot documents** (the ones read often) should fit in what's left.

If the cache is always full and `pages read into cache` climbs quickly, your working set is bigger than RAM. You can add RAM, shrink the working set (archive old data, remove unused indexes), or spread the data across shards.

> **Note:** Don't simply make the WiredTiger cache bigger with `storage.wiredTiger.engineConfig.cacheSizeGB`. The operating system's file cache also helps MongoDB, and starving it can make things slower. Keep the default unless you have a measured reason to change it.

## Step 4: CPU, IOPS and connections

### CPU

High CPU usually means **inefficient queries**, not too small a server. Before you buy more cores:

- Look for `COLLSCAN` plans with `explain` (see [explain and Query Plans](/courses/mongodb/explain-and-query-plans)).
- On Atlas, check the **Performance Advisor** and **Query Insights** for slow queries and suggested indexes.
- Move heavy reports to analytics nodes or materialised views (see [Aggregation Performance with merge and out](/courses/mongodb/aggregation-performance)).

### IOPS

**IOPS** means input/output operations per second: how many reads and writes the disk can handle. If the working set fits in RAM, most reads never touch the disk and IOPS needs stay low. Write-heavy apps need more IOPS for the journal and checkpoints. On cloud disks, IOPS often depends on disk size or a paid "provisioned IOPS" option.

### Connections

Add up `maxPoolSize` across all app instances (see [Node.js Driver and Connection Pooling](/courses/mongodb/nodejs-driver-and-connection-pooling)) and compare it with what your server or Atlas tier allows:

```javascript
db.serverStatus().connections
// → { current: 182, available: 838678, totalCreated: 4211, ... }
```

## Cost optimisation: spend less, run just as well

Once you know your numbers, you can trim waste. Here are the biggest wins, roughly in order of effort.

### 1. Remove unused indexes

Every index uses disk, RAM and makes writes slower. Find indexes that nobody uses:

```javascript
db.orders.aggregate([
  { $indexStats: {} },
  { $project: { name: 1, ops: "$accesses.ops", since: "$accesses.since" } }
])
// → [ { name: '_id_', ops: 5021133, since: ISODate('2026-09-01...') },
//     { name: 'status_1_createdAt_1', ops: 884210, since: ... },
//     { name: 'legacy_coupon_1', ops: 0, since: ... } ]   ← unused
```

An index with `ops: 0` after weeks of normal traffic is a candidate for removal. Check it isn't used by a monthly job first, then hide it before you drop it:

```javascript
db.orders.hideIndex("legacy_coupon_1")   // stop using it, but keep it
// ...wait and watch for a week...
db.orders.dropIndex("legacy_coupon_1")
```

> **Note:** `$indexStats` counters reset when the server restarts, so look at `since` to know how long they've been counting.

### 2. Delete data you don't need with TTL indexes

Sessions, logs and temporary tokens often pile up forever. A **TTL index** deletes them automatically (see [Partial, Sparse and TTL Indexes](/courses/mongodb/partial-sparse-ttl-indexes)):

```javascript
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }) // 30 days
```

### 3. Archive cold data

Old orders you must keep but rarely read can move to cheap storage with **Online Archive**, or be exported to S3 with Data Federation. The cluster gets smaller, so you may fit in a cheaper tier.

### 4. Right-size and auto-scale

- Look at real CPU, RAM and disk graphs over a few weeks. If your cluster rarely goes above 30–40% CPU and the cache has plenty of free space, a smaller tier may do.
- On Atlas, turn on **auto-scaling**. Compute auto-scaling moves the cluster up or down between a minimum and maximum tier you choose. Storage auto-scaling grows the disk before it fills up.

### 5. Save on non-production

- Use **free (M0)** or **Flex** clusters for learning and small dev work.
- **Pause** dedicated dev and test clusters on Atlas when nobody is using them (for example overnight). You pay much less while paused.
- Use smaller tiers for staging than for production, and make sure they get deleted when a project ends.

### 6. Watch the hidden costs

- **Backups:** long snapshot retention costs money. Keep what your recovery policy needs, not more.
- **Data transfer:** traffic between regions or out to the internet is billed. Keep app servers in the same region as the primary.
- **Extra nodes:** analytics and read-only nodes are useful, but each one is another server on the bill.

### Compression choices

WiredTiger compresses collections with **snappy** by default, which is fast with decent savings. **zstd** usually compresses better at a little more CPU cost, which can save disk on large collections:

```javascript
db.createCollection("events", {
  storageEngine: { wiredTiger: { configString: "block_compressor=zstd" } }
})
```

The setting only applies to the new collection. Test with your own data before switching widely.

## A capacity planning checklist

| Question | How to answer it |
| --- | --- |
| How big is my data and how fast is it growing? | `db.stats()`, `$collStats`, growth formula |
| Does my working set fit in RAM? | WiredTiger cache stats, `pages read into cache` |
| Are my queries efficient? | `explain`, Performance Advisor, slow query log |
| Do I have disk headroom? | Keep 30–50% free; storage auto-scaling on Atlas |
| Will connections fit? | Sum of all `maxPoolSize` vs server limits |
| Am I paying for waste? | Unused indexes, data without TTL, idle dev clusters, cross-region traffic |

## Common mistakes

- **Sizing from guesses instead of measurements.** Use `db.stats()` and `$collStats` on real data, then re-check regularly.
- **Buying more CPU for slow queries.** Most CPU problems are missing indexes or heavy pipelines. Fix the queries first.
- **Running disks nearly full.** Index builds and compaction need free space. Keep healthy headroom and alerts at around 80%.
- **Keeping every index "just in case".** Unused indexes cost RAM, disk and write speed. Check `$indexStats`, hide, then drop.
- **Leaving dev and test clusters running 24/7.** Pause or delete them when not in use.

## Practice

1. Your `events` collection gets 500,000 documents a day, each about 0.5 KB, and you keep 90 days. Roughly how much uncompressed data is that?
2. Write the commands to find indexes on `products` that have never been used since the last restart.
3. A server has 32 GB of RAM. Roughly how big is the default WiredTiger cache?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. 0.5 KB × 500,000 × 90 = 22,500,000 KB ≈ 22.5 GB uncompressed
//    (plus indexes, oplog and headroom; then a TTL index of 90 days keeps it there)

// 2.
db.products.aggregate([
  { $indexStats: {} },
  { $match: { "accesses.ops": 0 } },
  { $project: { name: 1, since: "$accesses.since" } }
])

// 3. 50% of (32 GB − 1 GB) = 15.5 GB
```

</details>

## Key takeaways

- Plan for four resources: **RAM, disk (size and IOPS), CPU and connections**.
- **Measure first** with `db.stats()`, `$collStats` and `serverStatus`, then estimate growth with a simple formula plus compression, indexes, oplog and headroom.
- The **working set** (hot data plus the indexes you use) should fit in the WiredTiger cache, which defaults to 50% of (RAM − 1 GB).
- High CPU is usually a **query problem**. Fix plans before buying hardware.
- Cut costs by dropping unused indexes, using **TTL** and **Online Archive**, right-sizing with **auto-scaling**, and pausing idle dev clusters.

## Congratulations!

You've reached the end of the MongoDB course. You started with a single document and finished with replica sets across continents, stream processing, Kubernetes, upgrades and capacity planning. That's a huge journey.

The best way to make it stick is to build something: a small app with real data, a few indexes, an aggregation dashboard and a backup plan. Come back to any lesson whenever you need a refresher.

**Back to the course:** [MongoDB course overview](/courses/mongodb)
