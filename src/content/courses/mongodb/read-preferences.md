---
title: Read Preferences and Replica Set Reads
slug: read-preferences
metadescription: Learn how MongoDB read preferences decide which replica set member serves your reads, with the five modes, maxStalenessSeconds and tag sets explained simply.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'read-preference', 'replica-set', 'scaling']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Read and Write Concerns](/courses/mongodb/read-and-write-concerns). To really *see* reads moving between servers you need a replica set with more than one member; the next lesson shows how to start a 3-member set locally.

## What you will learn

By the end of this lesson you will know:

- What a **read preference** is and how it differs from read concern
- The five read preference **modes** and when to use each one
- What **stale reads** are and how `maxStalenessSeconds` limits them
- How **tag sets** send reads to servers in a particular region or role
- How to set a read preference in mongosh, the connection string and Node.js

## Who answers your reads?

A replica set has one **primary** and usually two or more **secondaries**, all holding the same data. Writes always go to the primary. But reads have a choice.

A **read preference** tells the driver **which member** should answer a read.

> **Think of it like this:** A restaurant has a head chef (the primary) and two assistant chefs (secondaries) who copy every recipe change a moment later. Ordering from the head chef guarantees the latest menu. Ordering from an assistant might be faster when the head chef is busy, but the assistant may not have heard about a change made seconds ago.

Don't mix it up with read concern:

| Setting | Question it answers |
| --- | --- |
| **Read preference** | *Which server* should answer? |
| **Read concern** | *How sure* must the data be? (`local`, `majority`, ...) |

## The five modes

| Mode | Reads go to | If that's not possible |
| --- | --- | --- |
| `primary` | The primary only. **Default.** | Error |
| `primaryPreferred` | The primary | A secondary |
| `secondary` | Secondaries only | Error |
| `secondaryPreferred` | A secondary | The primary |
| `nearest` | The member with the lowest network delay, primary or secondary | — |

### primary (the default)

Every read sees the newest writes. This is the right answer for most apps, most of the time. If you're unsure, keep it.

### primaryPreferred

Normal reads go to the primary. During an **election** (the few seconds when the set is choosing a new primary) reads can fall back to a secondary instead of failing. Good for pages that should keep working, even if slightly out of date, while the cluster recovers.

### secondary and secondaryPreferred

Send reads to secondaries, keeping load off the primary. Useful for heavy **reports and analytics** that don't need up-to-the-second data. `secondaryPreferred` is the safer of the two because it still works if every secondary is down.

### nearest

The driver measures how long each member takes to respond and picks one of the fastest (within a small window, 15 ms by default). Great for **global apps** with members in several regions: a user in Mumbai reads from the Mumbai member, a user in Frankfurt from the Frankfurt member.

## The catch: stale reads

Secondaries copy writes **asynchronously**, which means "a little later, in the background". Usually that's milliseconds. But under heavy load or network problems, a secondary can fall seconds or minutes behind. This delay is called **replication lag**.

Reading from a lagging secondary gives you **stale** (old) data:

```text
08:00:00  primary:    order 5001 status → "shipped"
08:00:00  secondary:  order 5001 status = "pending"   (hasn't copied yet)
08:00:02  secondary:  order 5001 status → "shipped"   (caught up)
```

So any mode other than `primary` may return slightly old data. That's fine for a product catalogue or a monthly report. It's **not** fine for "show me the order I just placed".

> **Warning:** Reading from secondaries does not make writes faster, and secondaries do just as much write work as the primary (they copy every write). Read preference spreads **reads**, not writes. To scale writes, you need sharding.

### Limiting staleness with maxStalenessSeconds

You can tell the driver to skip secondaries that are too far behind:

```text
mongodb://host1,host2,host3/shop?replicaSet=rs0&readPreference=secondaryPreferred&maxStalenessSeconds=120
```

Now any secondary that's estimated to be more than 120 seconds behind the primary is ignored.

- The smallest allowed value is **90 seconds**. The driver estimates lag by checking members every so often, so it can't be more precise than that.
- It works with every mode **except** `primary` (which never reads from secondaries anyway).

## Setting a read preference

### In mongosh

For one query, add `.readPref()` to the cursor:

```javascript
use shop

db.orders.find({ status: "delivered" }).readPref("secondaryPreferred")
```

For everything on this connection:

```javascript
db.getMongo().setReadPref("secondaryPreferred")

db.getMongo().getReadPrefMode()
// → secondaryPreferred
```

To see which member actually answered a query, look at the `serverInfo` part of its explain output:

```javascript
db.orders.find().readPref("secondary").explain().serverInfo
// → { host: 'my-laptop', port: 27018, version: '8.x.x', ... }
```

Port 27018 is a secondary in the 3-member set from the next lesson. With the default `primary` mode you'd see the primary's port instead.

### In the connection string

```text
mongodb+srv://asha@cluster0.abcde.mongodb.net/shop?readPreference=secondaryPreferred
```

### In Node.js

Set it on the client, a database, a collection, or a single operation. The closest setting wins:

```javascript
import { MongoClient, ReadPreference } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017,localhost:27018,localhost:27019/?replicaSet=rs0");
const shop = client.db("shop");

// Normal app reads: primary (default)
const orders = shop.collection("orders");

// A collection handle just for reports
const reportOrders = shop.collection("orders", {
  readPreference: ReadPreference.SECONDARY_PREFERRED
});

const monthlySales = await reportOrders.aggregate([
  { $match: { status: "delivered" } },
  { $group: { _id: { $month: "$createdAt" }, revenue: { $sum: "$total" } } }
]).toArray();

// Or for one operation
const count = await orders.countDocuments({}, { readPreference: "secondaryPreferred" });
```

> **Tip:** A common pattern is to keep the app's normal reads on `primary` and point only reporting or export jobs at `secondaryPreferred`. You get fresh data for users and spare the primary from heavy reports.

## Tag sets: choosing specific members

Sometimes you want reads to go to a **particular** group of members, for example servers in one region, or a member set aside for analytics. You do this with **tags**.

### Step 1: tag the members

Tags are simple `key: "value"` labels on each member in the replica set config. An admin adds them like this:

```javascript
const cfg = rs.conf()
cfg.members[0].tags = { region: "ap-south", use: "app" }
cfg.members[1].tags = { region: "ap-south", use: "reports" }
cfg.members[2].tags = { region: "eu-central", use: "app" }
rs.reconfig(cfg)
```

> **Note:** On Atlas you don't set tags by hand. Atlas tags members for you (for example by region, cloud provider and node type), and you can use those tags in the connection string. Atlas also offers dedicated **analytics nodes** for this exact purpose.

### Step 2: use the tags in a read preference

A **tag set list** is tried **in order**. The driver uses the first tag set that matches at least one member:

```javascript
db.orders.find({ status: "delivered" }).readPref("secondary", [
  { use: "reports" },   // first choice: the reports member
  { region: "ap-south" }, // otherwise: any secondary in ap-south
  {}                      // otherwise: any secondary at all
])
```

The empty `{}` at the end means "anything". Without it, the read fails if no member matches.

In a connection string, each `readPreferenceTags` parameter is one tag set, and an empty value is the `{}` fallback:

```text
mongodb://host1,host2,host3/shop?replicaSet=rs0&readPreference=secondary&readPreferenceTags=use:reports&readPreferenceTags=
```

- Tags **can't** be used with `primary` mode.
- With `nearest`, tags filter both the primary and secondaries.

## A note on hedged reads

Older MongoDB guides mention **hedged reads**, an option for sharded clusters that sent the same read to two members and used whichever answered first. It was removed in MongoDB 8.1. If a query still asks for it, the server ignores the option and logs a warning. You don't need it.

## Choosing a read preference

| Situation | Mode |
| --- | --- |
| Normal app pages, checkout, "my orders" | `primary` |
| Must keep serving reads during an election, slight staleness OK | `primaryPreferred` |
| Heavy reports and exports | `secondaryPreferred` (or `secondary` with tags) |
| Users spread across continents, slight staleness OK | `nearest` |
| Reads inside a transaction | `primary` (required) |

## Common mistakes

- **Using secondaries to "scale" a busy app.** Every secondary still has to apply all writes. If the primary is overloaded by writes, read preference won't help. Add indexes, fix queries, or shard.
- **Reading your own writes from a secondary.** A user updates their profile and immediately sees the old value. Read from the primary, or use a causally consistent session.
- **Using `secondary` with only one secondary.** If that member goes down, all those reads fail. Prefer `secondaryPreferred`.
- **Setting `maxStalenessSeconds` below 90.** The driver rejects it with an error.
- **Forgetting the empty `{}` fallback in tag sets.** If the tagged member is down, the reads fail instead of using another member.

## Practice

1. In mongosh, run a query on `orders` that prefers secondaries, for this query only.
2. Write a connection string for replica set `rs0` (hosts `db1:27017`, `db2:27017`, `db3:27017`) that uses `nearest` and ignores members more than 2 minutes behind.
3. In Node.js, create a `products` collection handle that reads from secondaries tagged `{ use: "reports" }`, falling back to any secondary.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1
db.orders.find({ status: "pending" }).readPref("secondaryPreferred")

// 2
const uri = "mongodb://db1:27017,db2:27017,db3:27017/shop?replicaSet=rs0&readPreference=nearest&maxStalenessSeconds=120";

// 3
import { ReadPreference } from "mongodb";

const reportProducts = client.db("shop").collection("products", {
  readPreference: new ReadPreference("secondary", [{ use: "reports" }, {}])
});
```

</details>

## Key takeaways

- A **read preference** decides *which* replica set member answers a read; read concern decides *how sure* the data is.
- The modes are `primary` (default), `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
- Any mode other than `primary` can return **stale** data because secondaries copy writes asynchronously.
- `maxStalenessSeconds` (minimum 90) skips members that are too far behind; **tag sets** target specific members.
- Keep user-facing reads on `primary`; send heavy reports to secondaries.

**Next lesson:** [Replica Sets and Elections](/courses/mongodb/replica-sets)
