---
title: Multi-Region and Global Clusters
slug: multi-region-clusters
metadescription: Spread MongoDB across regions to survive outages and serve users nearby, using replica set tags, read preferences, zone sharding and Atlas Global Clusters.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 4
tags: ['mongodb', 'replica-set', 'sharding', 'atlas']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- Why teams run MongoDB in **more than one region**
- How to place replica set members so a whole region can fail safely
- How to send reads to the **nearest** region with tags and read preferences
- How **zone sharding** and **Atlas Global Clusters** keep each user's data in their part of the world
- What multi-region costs in latency and money

> **Before you start:** this lesson assumes you've read [Read Preferences and Replica Set Reads](/courses/mongodb/read-preferences), [Replica Sets and Elections](/courses/mongodb/replica-sets) and [Sharding: Shard Keys and Chunk Distribution](/courses/mongodb/sharding-fundamentals). Most examples here need several servers or a paid Atlas cluster, so read along and try the small local parts.

## Why go multi-region?

A *region* is a group of data centres in one area, like Mumbai, Frankfurt or Virginia. A normal replica set lives in one region, often spread across a few data centres (called *availability zones*) there.

Teams spread a cluster across regions for three main reasons:

| Reason | What it means |
| --- | --- |
| **Survive a region outage** | If a whole region goes dark, the database keeps working from another one. |
| **Low latency** | Users in Europe read from a server in Europe instead of waiting for India. |
| **Data residency** | Laws may require EU customer data to stay in the EU. |

> **Think of it like this:** A single-region cluster is one big shop in one city. Multi-region is a chain of branches. If one city floods, the other branches stay open, and every customer can visit the branch closest to home.

## Replica sets across regions

The simplest multi-region setup is **one replica set with members in several regions**. Remember the election rule: a new primary needs votes from a **majority** of members.

So the question is: if we lose any one region, is a majority still alive?

| Layout (members per region) | Lose one region... | Safe? |
| --- | --- | --- |
| 3 in Mumbai | Everything is gone | No |
| 2 Mumbai + 1 Singapore | Lose Mumbai → only 1 of 3 left | No |
| 2 Mumbai + 2 Singapore | Lose either → 2 of 4, not a majority | No |
| 2 Mumbai + 2 Singapore + 1 Frankfurt | Lose any one → at least 3 of 5 left | Yes |
| 1 + 1 + 1 in three regions | Lose any one → 2 of 3 left | Yes |

The pattern is clear: you need **at least three regions**, and no single region can hold a majority of votes.

> **Tip:** The third region doesn't have to be big. A small member there acts as the "tie-breaker" that keeps elections working when one main region fails.

### Setting it up (self-managed)

Here is a five-member replica set across three regions. We give each member a **tag** that names its region, and a **priority** so the primary normally stays in Mumbai, close to our app servers:

```javascript
rs.initiate({
  _id: "shopRS",
  members: [
    { _id: 0, host: "mum-a.shop.internal:27017", priority: 3, tags: { region: "ap-south-1" } },
    { _id: 1, host: "mum-b.shop.internal:27017", priority: 3, tags: { region: "ap-south-1" } },
    { _id: 2, host: "sgp-a.shop.internal:27017", priority: 2, tags: { region: "ap-southeast-1" } },
    { _id: 3, host: "sgp-b.shop.internal:27017", priority: 2, tags: { region: "ap-southeast-1" } },
    { _id: 4, host: "fra-a.shop.internal:27017", priority: 1, tags: { region: "eu-central-1" } }
  ]
})
// → { ok: 1 }
```

What this gives you:

- **Normal days:** one of the Mumbai members (priority 3) is primary.
- **Mumbai goes down:** the Singapore members (priority 2) win the next election. Three of five members are still up, so a majority exists.
- **Frankfurt** (priority 1) only becomes primary if both other regions are in trouble.

### Writes still go to one place

A replica set has **one primary**. Every write, from every user in the world, goes to that single region.

With `w: "majority"`, the write also waits until a majority of members have it. In our layout that means at least one member outside Mumbai must confirm, which adds the network round trip to Singapore (tens of milliseconds).

> **Note:** This is the price of safety. A majority write survives the loss of a whole region. If you really need local writes in several regions, you need **zone sharding** (later in this lesson).

## Reading from the nearest region

Reads are more flexible than writes. A user in Frankfurt can read from the Frankfurt member if a slightly stale result is acceptable.

The read preference **`nearest`** sends reads to the member with the lowest network latency, whether it is the primary or a secondary.

In a Node.js app running in Frankfurt, put it in the connection string:

```javascript
// app servers in Frankfurt
import { MongoClient } from "mongodb";

const uri =
  "mongodb://mum-a.shop.internal,sgp-a.shop.internal,fra-a.shop.internal/" +
  "?replicaSet=shopRS" +
  "&readPreference=nearest" +
  "&maxStalenessSeconds=120";

const client = new MongoClient(uri);
const products = client.db("shop").collection("products");

const cheap = await products.find({ price: { $lt: 100 } }).toArray();
// → served by fra-a (the closest member), unless it is more than 120 s behind
```

`maxStalenessSeconds` is a safety rail. If a secondary has fallen more than 120 seconds behind the primary, the driver skips it. The smallest allowed value is **90 seconds**.

### Steering reads with tags

Sometimes you want a specific region, not just "whatever is nearest". **Tag sets** let you say "prefer members with this tag":

```javascript
const uri =
  "mongodb://mum-a.shop.internal,sgp-a.shop.internal,fra-a.shop.internal/" +
  "?replicaSet=shopRS" +
  "&readPreference=secondaryPreferred" +
  "&readPreferenceTags=region:eu-central-1" + // first choice: a member in Frankfurt
  "&readPreferenceTags=";                      // empty tag set = "otherwise, anyone"
```

The driver tries the tag sets **in order**. The final empty one is a fallback so reads still work if Frankfurt is unavailable.

> **Warning:** Reads from secondaries can be slightly out of date. Never read from a secondary right after writing something the user expects to see (like "your order is placed"). Use the primary, or a causally consistent session, for those reads.

## Multi-region in MongoDB Atlas

In Atlas you don't write `rs.initiate` yourself. When you create or edit a dedicated cluster (M10 and up), you can add regions and choose node types:

| Node type | Can become primary? | Serves | Votes in elections? |
| --- | --- | --- | --- |
| **Electable** | Yes | Normal reads and writes | Yes |
| **Read-only** | No | Low-latency reads in that region | No |
| **Analytics** | No | Heavy reports, isolated from app traffic | No |

You also set the **region priority** order, which decides where the primary normally lives. Atlas warns you if your layout can't survive a region outage.

Atlas adds tags to every node automatically, such as `region`, `provider` and `nodeType`. A common use is sending reporting queries only to analytics nodes:

```text
mongodb+srv://shop-cluster.abcde.mongodb.net/?readPreference=secondary&readPreferenceTags=nodeType:ANALYTICS
```

Your dashboards then never slow down the shop's live traffic.

> **Note:** Free (M0) and Flex clusters run in a single region. Multi-region and Global Clusters need a dedicated paid tier.

## Zone sharding: keeping data local

A replica set copies **all** data to **every** region. That doesn't help with data residency, and writes still go to one primary.

**Zone sharding** solves both. In a sharded cluster you can say "documents for Indian customers live on the shard in Mumbai, and documents for EU customers live on the shard in Frankfurt". Each shard is its own replica set with its own primary, so writes for Indian users stay in India.

> **Think of it like this:** Instead of one central warehouse shipping worldwide, you have a warehouse per continent. Each one stocks the goods for its own customers and ships them quickly.

### Step by step (self-managed)

1. Choose a shard key that **starts with the location field**. Here we use `{ country: 1, _id: 1 }`:

```javascript
sh.shardCollection("shop.customers", { country: 1, _id: 1 })
```

2. Assign each shard to a **zone**:

```javascript
sh.addShardToZone("shardMumbai", "ASIA")
sh.addShardToZone("shardFrankfurt", "EU")
```

3. Tell MongoDB which key ranges belong to which zone:

```javascript
sh.updateZoneKeyRange(
  "shop.customers",
  { country: "IN", _id: MinKey },
  { country: "IN", _id: MaxKey },
  "ASIA"
)

sh.updateZoneKeyRange(
  "shop.customers",
  { country: "DE", _id: MinKey },
  { country: "DE", _id: MaxKey },
  "EU"
)
// → { ok: 1 } for each
```

Now the balancer moves every customer with `country: "IN"` to `shardMumbai` and every `country: "DE"` customer to `shardFrankfurt`. New inserts land on the right shard straight away.

```javascript
db.customers.insertOne({ name: "Priya Nair", email: "priya@example.com", country: "IN", isMember: true })
// stored on shardMumbai

db.customers.insertOne({ name: "Ken Weber", email: "ken@example.com", country: "DE", isMember: false })
// stored on shardFrankfurt
```

## Atlas Global Clusters

**Global Clusters** are Atlas's managed version of zone sharding. You pick zones on a world map (for example "Asia", "Europe", "Americas"), and Atlas creates a shard per zone and maps countries to zones for you.

The main rule: sharded collections in a Global Cluster use a compound shard key whose **first field is `location`**, holding a country (or region) code such as `"IN"` or `"DE"`:

```javascript
// Each document carries its location
db.customers.insertOne({
  location: "IN",
  name: "Asha Roy",
  email: "asha@example.com",
  city: "Kolkata"
})
```

When you shard the collection in the Atlas UI with **Global Writes** enabled, you choose the second shard key field (often `_id` or a user ID). Atlas then routes each document to the zone that serves that country. Users in India get fast local writes *and* their data stays in the Asia zone.

> **Tip:** Global Clusters only help if your app knows each user's location and includes it in queries. A query that filters on `location: "IN"` goes straight to one zone. A query without `location` must ask **every** zone, which is slow across continents.

## The costs of going global

Multi-region is powerful, but not free:

- **Latency on writes.** Majority writes wait for at least one other region.
- **Data transfer fees.** Cloud providers charge for traffic between regions. Replication across regions adds up.
- **More servers.** Five members instead of three, or a shard per continent, means a bigger bill.
- **More complexity.** You need to think about stale reads, zone keys and failover tests.

Start with a single-region replica set across availability zones. Move to multi-region when an outage or your users' location truly demands it.

## Common mistakes

- **Using only two regions.** With equal members in two regions, losing either one loses the majority, and no primary can be elected. Use at least three regions.
- **Expecting local writes from a replica set.** All writes go to the single primary. Use zone sharding or Global Clusters for local writes.
- **Reading your own writes from a far secondary.** Secondaries can lag. Read from the primary (or use a causally consistent session) when freshness matters.
- **Global Cluster queries without `location`.** They fan out to every zone. Always include the location field in filters for that collection.
- **Ignoring cross-region transfer costs.** Check your cloud bill after enabling multi-region replication.

## Practice

1. You have members in Delhi and Chennai only, three in Delhi and two in Chennai. What happens if Delhi goes offline? How would you fix the layout?
2. Write a connection string for an app in Singapore that reads from the nearest member, but never from one more than 2 minutes behind.
3. Write the zone range command that sends all `country: "US"` customers to a zone called `"AMERICAS"`.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Only 2 of 5 members remain, which is not a majority. No primary can be
//    elected, so writes stop. Fix: add a third region, e.g. 2 Delhi + 2 Chennai
//    + 1 Hyderabad, so losing any one region still leaves 3 of 5.

// 2.
const uri =
  "mongodb://del-a.shop.internal,che-a.shop.internal,hyd-a.shop.internal/" +
  "?replicaSet=shopRS&readPreference=nearest&maxStalenessSeconds=120";

// 3.
sh.updateZoneKeyRange(
  "shop.customers",
  { country: "US", _id: MinKey },
  { country: "US", _id: MaxKey },
  "AMERICAS"
)
```

</details>

## Key takeaways

- Multi-region clusters help you **survive region outages**, **serve users nearby** and meet **data residency** rules.
- Use **at least three regions** and make sure no single region holds a majority of votes. Use `priority` to choose where the primary normally lives.
- A replica set has **one primary**, so writes go to one region. Reads can go **nearest**, guarded by `maxStalenessSeconds` and tag sets.
- **Zone sharding** pins ranges of data to shards in chosen regions. **Atlas Global Clusters** do this for you using a `location` shard key field.
- Multi-region adds write latency, transfer fees and complexity. Adopt it when you truly need it.

**Next lesson:** [Atlas Data Federation and Online Archive](/courses/mongodb/data-federation-and-online-archive)
