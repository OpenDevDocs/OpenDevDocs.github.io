---
title: "Sharding: Shard Keys and Chunk Distribution"
slug: sharding-fundamentals
metadescription: Learn how MongoDB sharding spreads data across servers, how to pick a good shard key, and how chunks, the balancer and mongos work together.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'sharding', 'scaling', 'shard-key']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Replica Sets and Elections](/courses/mongodb/replica-sets).

## What you will learn

By the end of this lesson you will know:

- What **sharding** is and when you actually need it
- The three parts of a sharded cluster: **shards**, **config servers** and **mongos**
- What a **shard key** and a **chunk** are, and how the **balancer** moves chunks
- How to choose a good shard key (and spot a bad one)
- What MongoDB 8.0 added: moving, unsharding and resharding collections, plus **config shards**

## Why shard at all?

When your database gets too big or too busy for one server, you have two choices.

1. **Scale up (vertical scaling):** buy a bigger server with more RAM, CPU and disk.
2. **Scale out (horizontal scaling):** use several normal servers and split the data between them.

Scaling up is simple, but there is always a biggest (and most expensive) server. **Sharding** is MongoDB's way of scaling out. It splits one collection across many servers, called **shards**. Each shard holds only part of the data.

> **Think of it like this:** One library branch can only hold so many books. Instead of building one giant library, the city opens three branches. Books by authors A to H go to branch 1, I to P to branch 2, Q to Z to branch 3. A help desk at the entrance tells you which branch to visit.

> **Note:** Most apps never need sharding. A single replica set handles a lot of data. Shard when you have measured that one replica set is not enough (disk size, write throughput, or working set no longer fitting in RAM), not "just in case".

## The parts of a sharded cluster

A sharded cluster has three kinds of members:

| Part | What it does | Library analogy |
| --- | --- | --- |
| **Shard** | Stores a portion of the data. Each shard is a replica set, so it has its own copies for safety. | A branch library |
| **Config servers** | A replica set that stores the cluster's *metadata*: which data lives on which shard. | The central catalogue |
| **mongos** | A router. Your app connects to `mongos`, and it sends each query to the right shard(s). | The help desk at the entrance |

Your application never talks to a shard directly. It connects to `mongos` with a normal connection string, and to the app it looks like one database.

```text
              your app
                 │
              mongos  (router)  ←── asks ──→  config servers (metadata)
          ┌──────┼──────┐
       shard1  shard2  shard3   (each one is a replica set)
```

## Shard keys: how MongoDB decides where a document goes

To split a collection, MongoDB needs a rule. That rule is the **shard key**: one or more fields that every document in the collection has.

For example, if we shard `orders` on `customerId`, MongoDB looks at each order's `customerId` to decide which shard it lives on.

### Chunks

MongoDB does not track every single document. It groups shard key values into ranges called **chunks** (newer docs also call them *ranges*). Each chunk covers a span of shard key values, and each chunk lives on one shard.

```text
customerId range           lives on
MinKey  → "c-3000"         shard1
"c-3000" → "c-7000"        shard2
"c-7000" → MaxKey          shard3
```

`MinKey` and `MaxKey` are special values that mean "smaller than everything" and "bigger than everything".

The default chunk size is **128 MB**. When a chunk grows past that, it can be split into two.

### The balancer

The **balancer** is a background process that watches how much data each shard holds. If one shard has noticeably more data than the others, the balancer moves chunks from the busy shard to a quieter one. This is called a **chunk migration**.

> **Think of it like this:** The balancer is a librarian who notices branch 1 is overflowing and quietly drives a van of books to branch 3.

Since MongoDB 6.0 the balancer balances by **data size** per shard, not just by number of chunks.

## Ranged vs hashed sharding

There are two main ways to turn shard key values into chunks.

### Ranged sharding

Documents with nearby shard key values sit in the same chunk. This is great for range queries like "all orders for customers c-1000 to c-2000", because they live together.

```javascript
// Ranged shard key on customerId
sh.shardCollection("shop.orders", { customerId: 1 })
```

### Hashed sharding

MongoDB runs the shard key value through a hash function first, then splits on the hash. Neighbouring values end up scattered across shards. This spreads writes evenly, but range queries must ask every shard.

```javascript
// Hashed shard key on customerId
sh.shardCollection("shop.orders", { customerId: "hashed" })
```

| | Ranged | Hashed |
| --- | --- | --- |
| Range queries on the key | Fast (one or few shards) | Slow (all shards) |
| Even write spread | Only if values are well spread | Yes, almost always |
| Good for | Keys with many random-ish values | Ever-increasing keys like timestamps or ObjectIds |

## Choosing a good shard key

The shard key is the most important sharding decision. A good key has three qualities:

1. **High cardinality:** many different possible values. A field with only 3 values (`status: pending/shipped/delivered`) can only ever make 3 chunks, so at most 3 shards get data.
2. **Low frequency:** no single value appears in a huge share of documents. If 40% of orders belong to one giant customer, that customer's chunk can't be split and becomes a **jumbo chunk**.
3. **Not monotonically increasing** (for ranged keys): if every new value is bigger than the last (like `createdAt` or an `ObjectId`), every insert goes to the last chunk on one shard. That shard becomes a *hot shard* while the others sit idle.

It also helps if your most common queries **include the shard key**, so `mongos` can send them to just one shard.

Let's judge some options for our `shop.orders` collection:

| Shard key | Verdict | Why |
| --- | --- | --- |
| `{ status: 1 }` | Bad | Only 3 values, low cardinality |
| `{ createdAt: 1 }` | Bad | Always increasing, all new writes hit one shard |
| `{ createdAt: "hashed" }` | OK for writes | Even spread, but date-range queries hit all shards |
| `{ customerId: 1 }` | Good | Many values, and "my orders" queries target one shard |
| `{ customerId: 1, createdAt: 1 }` | Very good | Splits big customers further, keeps one customer's orders together |

> **Tip:** A compound shard key (two or more fields) is a common fix for a key with low frequency problems. The second field lets MongoDB split one customer's data into several chunks.

### Let MongoDB grade your key

MongoDB 7.0 added the `analyzeShardKey` command. It samples your real data and reports cardinality, frequency and how monotonic a candidate key is.

```javascript
db.adminCommand({
  analyzeShardKey: "shop.orders",
  key: { customerId: 1 }
})
```

You need an index that starts with the candidate key for this to work. Read the output's `keyCharacteristics` section: high `numDistinctValues` and a low `mostCommonValues` share are good signs.

## Sharding a collection step by step

Here is the full flow, run in mongosh while connected to `mongos`.

First, create an index that supports the shard key (needed if the collection already has data):

```javascript
use shop
db.orders.createIndex({ customerId: 1, createdAt: 1 })
```

Then shard the collection:

```javascript
sh.shardCollection("shop.orders", { customerId: 1, createdAt: 1 })
// → { collectionsharded: 'shop.orders', ok: 1, ... }
```

> **Note:** In older versions you had to run `sh.enableSharding("shop")` first. In modern versions `sh.shardCollection()` does that for you, though running it is harmless.

Check the cluster:

```javascript
sh.status()
```

```text
shards
[
  { _id: 'shard1', host: 'shard1/localhost:27018', state: 1 },
  { _id: 'shard2', host: 'shard2/localhost:27028', state: 1 }
]
...
collections: {
  'shop.orders': {
    shardKey: { customerId: 1, createdAt: 1 },
    unique: false,
    balancing: true,
    chunkMetadata: [ { shard: 'shard1', nChunks: 2 }, { shard: 'shard2', nChunks: 1 } ],
    ...
```

To see how much data each shard holds for one collection:

```javascript
db.orders.getShardDistribution()
```

## Targeted vs scatter-gather queries

When a query contains the shard key, `mongos` knows exactly which shard to ask. This is a **targeted query**.

```javascript
// Targeted: includes the shard key prefix
db.orders.find({ customerId: "c-1042" })
```

When it doesn't, `mongos` must ask **every** shard and merge the answers. This is a **scatter-gather** (or *broadcast*) query.

```javascript
// Scatter-gather: no customerId, every shard is asked
db.orders.find({ status: "pending" })
```

You can tell which one happened with `explain()`. A targeted query shows a `SINGLE_SHARD` stage. A broadcast one shows `SHARD_MERGE` with every shard listed.

> **Think of it like this:** Asking the help desk "where is the book by Asha Roy?" sends you to one branch. Asking "which books have a red cover?" means phoning every branch.

Scatter-gather queries are fine for rare reports, but your hottest queries should be targeted.

## Unsharded collections live on shards too

Not every collection needs sharding. A small `customers` collection can stay unsharded. In MongoDB 8.0, an unsharded collection lives on one shard, and you can choose which one with `moveCollection`:

```javascript
db.adminCommand({
  moveCollection: "shop.customers",
  toShard: "shard2"
})
```

This is a heavy operation (it copies the whole collection, takes at least 5 minutes, and blocks writes for about two seconds at the end), so run it in a quiet period.

## Changed your mind? Fixing a shard key

Picking a shard key used to be permanent. Not any more.

| Command | Since | What it does |
| --- | --- | --- |
| `refineCollectionShardKey` | 4.4 | Adds extra fields to the **end** of the existing key |
| `reshardCollection` | 5.0 | Changes to a completely new shard key and rewrites the data |
| `reshardCollection` with `forceRedistribution: true` | 8.0 | Reshards using the **same** key, to spread data quickly onto newly added shards |
| `unshardCollection` | 8.0 | Turns a sharded collection back into an unsharded one on a single shard |

Changing the key with `reshardCollection`:

```javascript
db.adminCommand({
  reshardCollection: "shop.orders",
  key: { customerId: "hashed" }
})
```

Unsharding a collection you no longer need to shard:

```javascript
db.adminCommand({
  unshardCollection: "shop.orders",
  toShard: "shard1"
})
```

> **Warning:** Resharding and unsharding copy the whole collection. The receiving shard needs roughly twice the collection plus index size in free disk. Don't create or drop indexes while they run, and expect any search indexes on the collection to need rebuilding afterwards.

## Config shards: fewer servers for small clusters

A normal cluster has a separate replica set just for config servers. That is three extra machines that store no app data.

MongoDB 8.0 introduced **config shards** (also called *embedded config servers*). A config shard is a config server replica set that **also stores application data**, acting as one of the shards. A small two-shard cluster then needs two replica sets instead of three.

You switch a dedicated config server into a config shard with:

```javascript
db.adminCommand({ transitionFromDedicatedConfigServer: 1 })
```

You can check whether one is in use with `sh.isConfigShardEnabled()`. The next lesson covers moving back to a dedicated config server.

## Where can you try this?

| Where | What you can do |
| --- | --- |
| **Your laptop** | Run a tiny cluster: one config server, one or two shards and a `mongos`, all on different ports |
| **MongoDB Atlas** | Sharded clusters need a dedicated tier (M30 or larger). Free M0 and Flex clusters can't shard |

Here is a minimal local cluster. Run each long-running command in its own terminal, with each `--dbpath` folder created first.

```bash
# 1. Config server replica set
mongod --configsvr --replSet cfg --port 27019 --dbpath ./data/cfg
mongosh --port 27019 --eval "rs.initiate()"

# 2. One shard replica set
mongod --shardsvr --replSet shard1 --port 27018 --dbpath ./data/shard1
mongosh --port 27018 --eval "rs.initiate()"

# 3. The router
mongos --configdb cfg/localhost:27019 --port 27017

# 4. Register the shard with the cluster
mongosh --port 27017 --eval 'sh.addShard("shard1/localhost:27018")'
```

Repeat step 2 with `shard2` on another port and add it too, then connect with `mongosh --port 27017` and practise.

## Common mistakes

- **Sharding too early.** Sharding adds servers, cost and complexity. Tune indexes and size your replica set first.
- **Using a low-cardinality key** like `status` or `country`. You get a few giant chunks that can never be split. Pick a field with many values, or add a second field.
- **Using an ever-increasing ranged key** like `createdAt` or `_id`. All inserts land on one hot shard. Use a hashed key or put a well-spread field first.
- **Forgetting the shard key in hot queries.** Every query without it becomes scatter-gather. Design the key around your most common filters.
- **Connecting the app straight to a shard.** Always connect through `mongos`, or you'll see only part of the data.

## Practice

1. Your `orders` queries are mostly "show this customer's orders, newest first". Write the `sh.shardCollection` call for a good shard key.
2. A teammate suggests `{ createdAt: 1 }` as the shard key for a logs collection with heavy inserts. Explain the problem and suggest a fix.
3. Write the command to move the unsharded `shop.customers` collection to `shard3`.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Customer first (targets one shard), date second (splits big customers)
db.orders.createIndex({ customerId: 1, createdAt: -1 })
sh.shardCollection("shop.orders", { customerId: 1, createdAt: -1 })

// 2. createdAt always increases, so every insert goes to the last chunk
//    on one shard (a hot shard). Use a hashed key instead:
sh.shardCollection("app.logs", { createdAt: "hashed" })
//    or put a well-spread field first, e.g. { deviceId: 1, createdAt: 1 }

// 3. Move an unsharded collection (MongoDB 8.0+)
db.adminCommand({ moveCollection: "shop.customers", toShard: "shard3" })
```

</details>

## Key takeaways

- **Sharding** splits a collection across several replica sets (shards), with **mongos** routing queries and **config servers** storing the map.
- The **shard key** decides where each document lives. Data is grouped into **chunks** that the **balancer** moves between shards.
- A good shard key has many values, no single dominant value, and matches your most common queries.
- **Hashed** keys spread writes evenly; **ranged** keys keep neighbours together for range queries.
- MongoDB 8.0 lets you `moveCollection`, `unshardCollection`, reshard with the same key, and use a **config shard** to save servers.

**Next lesson:** [Shard Draining and Cluster Operations](/courses/mongodb/shard-draining-and-cluster-ops)
