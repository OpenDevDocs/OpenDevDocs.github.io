---
title: Shard Draining and Cluster Operations
slug: shard-draining-and-cluster-ops
metadescription: Learn to add and remove shards safely, drain a shard with the MongoDB 8.3 draining commands, manage the balancer and move databases and collections.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'sharding', 'operations', 'balancer']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Sharding: Shard Keys and Chunk Distribution](/courses/mongodb/sharding-fundamentals).

## What you will learn

By the end of this lesson you will know:

- How to **add** a shard and help data spread onto it
- How to **remove** a shard safely by **draining** it first
- The new MongoDB 8.3 draining commands: `startShardDraining`, `shardDrainingStatus`, `stopShardDraining` and `commitShardRemoval`
- How to control the **balancer** and give it a quiet-hours window
- How to move a database's primary shard, an unsharded collection, and switch config server modes

> **Note:** Everything in this lesson is for **self-managed** clusters (MongoDB Community or Enterprise). On **MongoDB Atlas** you don't run these commands: you change the number of shards in the cluster settings and Atlas does the draining for you.

## Cluster operations in plain words

A sharded cluster is not fixed forever. Over its life you will:

- **Add shards** when data or traffic grows
- **Remove shards** when you over-provisioned, want to save money, or retire old hardware
- **Pause the balancer** during busy hours or backups
- **Move things around**, like a small collection or a database's "home" shard

> **Think of it like this:** Running a sharded cluster is like running a chain of warehouses. Opening a new warehouse is easy: you just start sending it boxes. Closing one takes planning: you must move every box out before you hand back the keys.

## First, meet the balancer controls

Almost every cluster operation depends on the **balancer**, the background process that moves chunks between shards. Here are the commands you will use most, run in mongosh connected to `mongos`:

```javascript
sh.getBalancerState()     // → true  (is the balancer allowed to run?)
sh.isBalancerRunning()    // → { mode: 'full', inBalancerRound: false, ... }
sh.stopBalancer()         // turn it off (waits for the current round to finish)
sh.startBalancer()        // turn it back on
```

You can also turn balancing off for one collection only:

```javascript
sh.disableBalancing("shop.orders")
sh.enableBalancing("shop.orders")
```

### A balancing window

Moving chunks uses disk and network. Many teams only let the balancer run at night. You set this "active window" in the `config` database:

```javascript
db.getSiblingDB("config").settings.updateOne(
  { _id: "balancer" },
  { $set: { activeWindow: { start: "23:00", stop: "06:00" } } },
  { upsert: true }
)
```

The times use the server's local time zone. Remove the window with `$unset: { activeWindow: true }`.

> **Warning:** Draining a shard needs the balancer. If the balancer is off, or the window is tiny, draining simply waits and never finishes.

## Adding a shard

Adding capacity is the easy direction. Start a new replica set with `--shardsvr`, initiate it, then register it through `mongos`:

```javascript
sh.addShard("shard3/db-host-3:27018")
// → { shardAdded: 'shard3', ok: 1, ... }
```

The balancer notices the new, empty shard and starts moving chunks to it. This is slow on purpose, so it doesn't overload the cluster.

### Spreading data faster (MongoDB 8.0+)

For a large collection, waiting for the balancer can take days. MongoDB 8.0 lets you reshard a collection **onto the same shard key** with `forceRedistribution`. It rewrites the collection across all current shards in one go, often much faster than chunk-by-chunk migration:

```javascript
db.adminCommand({
  reshardCollection: "shop.orders",
  key: { customerId: 1, createdAt: 1 },   // same key as today
  forceRedistribution: true
})
```

> **Tip:** Resharding copies the whole collection, so the shards need roughly twice the collection plus index size in free disk. Run it during a quiet period.

## Removing a shard: the big picture

Before a shard can leave the cluster, it must be **empty**. Three kinds of things might still live on it:

| What lives on the shard | How it leaves |
| --- | --- |
| **Chunks** of sharded collections | The balancer moves them automatically while draining |
| **Unsharded collections** | You move them with `moveCollection` (MongoDB 8.0+) |
| **Databases whose primary shard** is this shard | You move them with `movePrimary` |

Every database has a **primary shard**. It is the database's "home" shard, where new unsharded collections are created by default.

## Draining with the MongoDB 8.3 commands

Older versions used one command, `removeShard`, which you ran again and again until it said "completed". It mixed starting, checking and finishing into a single command, which confused many people.

MongoDB 8.3 splits the job into clear steps and **deprecates `removeShard`**:

| Command | What it does |
| --- | --- |
| `startShardDraining` | Tells the balancer to start emptying a shard |
| `shardDrainingStatus` | Shows what is left to move |
| `stopShardDraining` | Cancels the drain and keeps the shard |
| `commitShardRemoval` | Removes the shard once it is empty |

All four need the `clusterManager` role (or a role with the `removeShard` action) and are run against `mongos` on the `admin` database. (MongoDB 9.0 also adds a mongosh shortcut, `sh.shardDrainingStatus()`, for the status check.)

Let's remove a shard called `shard3` step by step.

### Step 1: find the shard's name

```javascript
db.adminCommand({ listShards: 1 })
// → { shards: [ { _id: 'shard1', ... }, { _id: 'shard2', ... }, { _id: 'shard3', ... } ], ok: 1 }
```

### Step 2: make sure the balancer is on, then start draining

```javascript
sh.startBalancer()

db.adminCommand({ startShardDraining: "shard3" })
// → { ok: 1, ... }
```

The command returns straight away. The actual moving happens in the background.

### Step 3: check progress

```javascript
db.adminCommand({ shardDrainingStatus: "shard3" })
```

While work remains, you'll see something like this:

```javascript
{
  msg: 'draining ongoing',
  state: 'ongoing',
  remaining: {
    chunks: Long(14),
    dbs: Long(1),
    jumboChunks: Long(0),
    collectionsToMove: Long(1)
  },
  shard: 'shard3',
  note: 'you need to call moveCollection for collectionsToMove and afterwards movePrimary for the dbsToMove',
  dbsToMove: [ 'shop' ],
  collectionsToMove: [ 'shop.customers' ],
  ok: 1
}
```

Read it like a to-do list:

- `remaining.chunks` goes down by itself as the balancer works.
- `collectionsToMove` lists unsharded collections **you** must move.
- `dbsToMove` lists databases whose primary shard **you** must move.
- `jumboChunks` are chunks too big to move automatically. If this is not zero, you may need to split or clear them (or reshard) before draining can finish.

### Step 4: move unsharded collections

```javascript
db.adminCommand({
  moveCollection: "shop.customers",
  toShard: "shard1"
})
```

Move collections **before** moving the database primary, as the status note says.

### Step 5: move the database primary

```javascript
db.adminCommand({ movePrimary: "shop", to: "shard1" })
// → { ok: 1, ... }
```

### Step 6: wait for "drainingComplete"

Keep checking until the state changes:

```javascript
db.adminCommand({ shardDrainingStatus: "shard3" })
// → { msg: 'draining completed successfully', state: 'drainingComplete', ok: 1, ... }
```

### Step 7: commit the removal

```javascript
db.adminCommand({ commitShardRemoval: "shard3" })
// → { ok: 1, ... }
```

If anything is still on the shard (a chunk, an unsharded collection, or a database primary), the command returns an error instead of removing it. That safety check is the whole point of the new flow.

After this, `listShards` no longer shows `shard3`, and you can shut its servers down.

### Changed your mind?

If you start draining and then decide to keep the shard, cancel it:

```javascript
db.adminCommand({ stopShardDraining: "shard3" })
```

The shard rejoins normal balancing, and over time the balancer moves chunks back onto it.

> **Think of it like this:** `startShardDraining` is putting up a "closing soon" sign. `shardDrainingStatus` is checking how many boxes are left. `stopShardDraining` is taking the sign down. `commitShardRemoval` is handing back the keys, and the landlord checks the warehouse is empty first.

### Things to know while draining

- You **cannot take a cluster backup** while a shard is draining.
- Several shards can drain at the same time.
- Draining may close open **change stream** cursors, and they might not resume cleanly. Warn the teams that use change streams.
- If a big operation like `reshardCollection` is running, draining starts only after it finishes.

### On older versions (8.2 and earlier)

Before 8.3 you use `removeShard`, running the same command to start, check and finish:

```javascript
db.adminCommand({ removeShard: "shard3" })
// first run  → { msg: 'draining started successfully', state: 'started', ... }
// later runs → { msg: 'draining ongoing', state: 'ongoing', remaining: { ... }, ... }
// final run  → { msg: 'removeshard completed successfully', state: 'completed', ... }
```

The same rules apply: move unsharded collections and database primaries before it can complete. On 8.3, prefer the new commands, because `removeShard` is deprecated.

## Config server modes

In the previous lesson you met **config shards**, where the config server replica set also stores app data. You can switch in either direction.

### Dedicated config server to config shard (8.0+)

```javascript
db.adminCommand({ transitionFromDedicatedConfigServer: 1 })
sh.isConfigShardEnabled()
// → { enabled: true, ... }
```

When a config shard is in use, `listShards` shows a shard with `_id: "config"`.

### Config shard back to dedicated config server

Going back means draining all app data off the config shard, just like removing a normal shard. MongoDB 8.0 has `transitionToDedicatedConfigServer` for this. MongoDB 8.3 adds a step-by-step set that mirrors the new draining commands:

| Command (8.3) | Like... |
| --- | --- |
| `startTransitionToDedicatedConfigServer` | `startShardDraining` |
| `getTransitionToDedicatedConfigServerStatus` | `shardDrainingStatus` |
| `stopTransitionToDedicatedConfigServer` | `stopShardDraining` |
| `commitTransitionToDedicatedConfigServer` | `commitShardRemoval` |

```javascript
db.adminCommand({ startTransitionToDedicatedConfigServer: 1 })
db.adminCommand({ getTransitionToDedicatedConfigServerStatus: 1 })
```

As with draining, move any unsharded collections and database primaries off the config shard before committing.

## Health checks before any big operation

Before adding, removing or resharding, run a quick check:

```javascript
sh.status()                                   // shards, balancer, chunk counts
db.adminCommand({ listShards: 1 })            // shard names and hosts
db.getSiblingDB("admin").runCommand({ checkMetadataConsistency: 1 })
```

`checkMetadataConsistency` (MongoDB 7.0+) looks for mismatches between what the config servers think and what the shards actually hold. An empty `cursor.firstBatch` means no problems found.

## Where can you try this?

- **Locally:** build the small cluster from the previous lesson with two shards, insert some data, shard a collection, then drain and remove the second shard. You need MongoDB 8.3 for the new draining commands.
- **Atlas:** these commands are not supported. Use the cluster edit screen to change the shard count.

## Common mistakes

- **Draining with the balancer off.** `shardDrainingStatus` will show the same `remaining` numbers forever. Run `sh.startBalancer()` and check your balancing window.
- **Forgetting unsharded collections and database primaries.** The balancer only moves chunks. Read `collectionsToMove` and `dbsToMove` and handle them yourself.
- **Running `movePrimary` before `moveCollection`.** Move the unsharded collections first, as the status note says.
- **Shutting down the shard's servers before `commitShardRemoval` succeeds.** The shard is still part of the cluster until the commit returns `ok: 1`.
- **Scheduling a backup during a drain.** Backups can't run while a shard is draining. Plan the two separately.

## Practice

1. Write the commands to start draining `shard2` and then check its progress.
2. The status shows `collectionsToMove: [ 'shop.reviews' ]` and `dbsToMove: [ 'shop' ]`. Write the next two commands, in the right order, moving things to `shard1`.
3. Set the balancer to run only between 01:00 and 05:00.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Start and check (MongoDB 8.3+)
sh.startBalancer()
db.adminCommand({ startShardDraining: "shard2" })
db.adminCommand({ shardDrainingStatus: "shard2" })

// 2. Collections first, then the database primary
db.adminCommand({ moveCollection: "shop.reviews", toShard: "shard1" })
db.adminCommand({ movePrimary: "shop", to: "shard1" })
// ...wait for state: 'drainingComplete', then:
db.adminCommand({ commitShardRemoval: "shard2" })

// 3. Balancing window
db.getSiblingDB("config").settings.updateOne(
  { _id: "balancer" },
  { $set: { activeWindow: { start: "01:00", stop: "05:00" } } },
  { upsert: true }
)
```

</details>

## Key takeaways

- Adding a shard is easy: `sh.addShard()`, then let the balancer (or `reshardCollection` with `forceRedistribution`) spread the data.
- Removing a shard means **draining** it: chunks, unsharded collections and database primaries must all leave first.
- MongoDB 8.3 replaces `removeShard` with `startShardDraining`, `shardDrainingStatus`, `stopShardDraining` and `commitShardRemoval`.
- Draining needs the **balancer** running, and you can't back up the cluster during a drain.
- Config servers can switch between **dedicated** and **config shard** modes, and 8.3 adds step-by-step commands for the move back to dedicated.

**Next lesson:** [Performance Tuning and Working Set Sizing](/courses/mongodb/performance-tuning)
