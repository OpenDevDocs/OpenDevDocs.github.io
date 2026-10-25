---
title: Upgrading to MongoDB 8.3
slug: upgrading-to-mongodb-8-3
metadescription: Upgrade to MongoDB 8.3 safely. Learn major vs minor releases, rolling upgrades, featureCompatibilityVersion and the key 8.3 compatibility changes.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 4
tags: ['mongodb', 'upgrade', 'operations', 'replica-set']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- The difference between MongoDB **major** and **minor** releases, and where 8.3 is available
- Which **upgrade paths** lead to 8.3
- What **featureCompatibilityVersion (FCV)** is and why it is a separate step
- How to do a **rolling upgrade** of a replica set with almost no downtime
- Which **compatibility changes** in 8.3 to check before you start

> **Before you start:** this lesson assumes you've read [Replica Sets and Elections](/courses/mongodb/replica-sets), [Shard Draining and Cluster Operations](/courses/mongodb/shard-draining-and-cluster-ops) and [Backups, Snapshots and Point-in-Time Restore](/courses/mongodb/backups-and-restore). You can practise the whole procedure on a local three-member replica set.

## Major and minor releases

Since MongoDB 8.2, releases come in two series:

| | Major releases | Minor releases |
| --- | --- | --- |
| Examples | 7.0, 8.0, 9.0 | 8.2, 8.3 |
| How often | About every two years | Several times between majors |
| Support | Five-year lifecycle | Shorter; you're expected to keep moving to newer releases |
| Where | Atlas and self-managed | Atlas; self-managed only for specific use cases |
| Good for | Teams that want a long, stable support window | Teams that want new features early and upgrade often |

MongoDB says minor releases are just as stable as major ones and fine for production. **8.3 is a minor release** in the 8.x line. Version 8.3.0 came out on 4 May 2026, and it has received many patch releases since.

> **Think of it like this:** Major releases are like a new edition of a textbook, used for years. Minor releases are like the extra chapters a teacher hands out during the year. They are useful and well tested, but you'll only get them if you sign up for the handouts.

### Where can you run 8.3?

- **MongoDB Atlas:** yes. You pick the version for a dedicated cluster in the cluster settings. Free (M0) and Flex clusters are upgraded automatically, so you can't choose.
- **Self-managed (Community and Enterprise Advanced):** starting with 8.2, minor releases are also published for on-premises use, but MongoDB says this is **for specific use cases**, such as Search, Vector Search and enhanced Queryable Encryption. For a general self-managed deployment, the usual recommendation is to stay on the major release (8.0).

> **Note:** On Atlas, if you choose the "Latest Version With Auto Upgrades" option and your cluster moves from a major version to a minor version, you **can't go back** to a major version until the next major is released. Decide deliberately.

> **Note:** MongoDB **9.0**, the next major release, came out in September 2026. It is rolling out on Atlas first, with Community and Enterprise builds announced as coming soon. This course still targets the 8.x line. The same ideas in this lesson (rolling binary upgrade first, FCV step last, burn-in in between) apply to 9.0 too; check the official MongoDB 9.0 release notes and upgrade pages for its exact paths and changes.

## Upgrade paths to 8.3

MongoDB has strict rules about which version you can upgrade from:

| You are on | Path to 8.3 |
| --- | --- |
| **8.2** (FCV `"8.2"`) | Upgrade directly to 8.3. |
| **8.0** (FCV `"8.0"`) | Upgrade directly to 8.3. The docs have dedicated "Upgrade 8.0 to 8.3" procedures. |
| **8.1** | Go 8.1 → 8.2 → 8.3. You can't skip minor releases. |
| **7.0 or older** | First upgrade to the latest **8.0** patch (one major at a time), then to 8.3. |

Two rules sit behind this table:

1. **Between minor releases you must go one step at a time.** 8.1 to 8.3 means stopping at 8.2.
2. **Every step is two steps:** a **binary upgrade** (new `mongod` program) and an **FCV upgrade** (turning on the new features).

> **Tip:** Always upgrade to the **latest patch** of the target version (for example 8.3.x, not 8.3.0). The 8.3 release notes include an advisory about an issue affecting 8.3.0 through 8.3.12, fixed in later patches.

## What is featureCompatibilityVersion?

When you install a new `mongod`, it can do two jobs:

- Run with **old** on-disk formats, so you can still go back to the previous version.
- Run with **new** formats and features, once you are sure you won't go back.

The **featureCompatibilityVersion (FCV)** setting decides which job it does. After the binary upgrade, FCV still says the old version. The new binary runs fine, but features that would write data the old version can't read stay switched off.

> **Think of it like this:** Moving into a new flat, you first carry your boxes in (binary upgrade) but leave the old flat's keys on the hook for a few weeks. Only when you're sure you love the new place do you hand back the old keys (FCV upgrade). After that, moving back is a lot more work.

Check FCV on any member:

```javascript
db.adminCommand({ getParameter: 1, featureCompatibilityVersion: 1 })
// → { featureCompatibilityVersion: { version: '8.2' }, ok: 1 }
```

The time between the binary upgrade and the FCV upgrade is called the **burn-in period**. MongoDB recommends running on the new binaries for a while, watching your monitoring, and only then raising FCV.

## Before you upgrade: the checklist

Don't skip these. Most upgrade problems come from a missed step here.

1. **Read the compatibility changes** for 8.3 (summary below) and search your code for anything affected.
2. **Check your drivers.** Make sure your driver version supports 8.3 (see the driver's compatibility table).
3. **Check FCV** on every member. It must match the version you are upgrading **from** (`"8.2"` or `"8.0"`).
4. **Check member health.** No member should be in `RECOVERING` or `ROLLBACK`:

   ```javascript
   rs.status().members.map((m) => `${m.name} ${m.stateStr}`)
   // → [ 'db1:27017 PRIMARY', 'db2:27017 SECONDARY', 'db3:27017 SECONDARY' ]
   ```

5. **Take a backup** and make sure you can restore it.
6. **Rehearse in staging** with a copy of production data and your real app.

If FCV is not yet set to your current version, set it first on the primary:

```javascript
db.adminCommand({ setFeatureCompatibilityVersion: "8.2", confirm: true })
// → { ok: 1 }
```

The `confirm: true` field is required. It is MongoDB's way of asking "are you sure?", because raising FCV makes downgrades harder.

## Rolling upgrade of a replica set

A **rolling upgrade** upgrades one member at a time, so the replica set keeps serving traffic the whole time. Your app only notices one short election.

Here is the order, using a three-member set (`db1` primary, `db2` and `db3` secondaries):

### Step 1: upgrade each secondary, one at a time

Connect to `db2` and shut it down cleanly:

```javascript
// mongosh connected to db2
db.adminCommand({ shutdown: 1 })
```

Replace the `mongod` binary with 8.3. If you installed from a package manager, upgrade the package. Then start it with the **same** config file:

```bash
# Example for a package-manager install on Linux
sudo apt-get install -y mongodb-org   # or yum / dnf / zypper, pinned to the 8.3 packages
sudo systemctl start mongod
```

Wait until `db2` is back to `SECONDARY` and has caught up:

```javascript
rs.status().members.find((m) => m.name.startsWith("db2")).stateStr
// → 'SECONDARY'
```

Then repeat for `db3`. Never take down two members at once, or you lose the majority.

### Step 2: step down the primary

Connect to the primary (`db1`) and ask it to hand over:

```javascript
rs.stepDown()
```

An election picks one of the already-upgraded secondaries as the new primary. Your drivers notice within seconds and retry writes automatically (retryable writes are on by default).

### Step 3: upgrade the old primary

Once `rs.status()` shows another member as `PRIMARY`, shut down `db1`, replace its binary and start it again, exactly like the secondaries.

```javascript
db.version()
// → '8.3.13'   (run on each member to confirm)
```

### Step 4: burn in, then raise FCV

Run your normal workload for a while (many teams wait days or a couple of weeks). Watch error rates, latency and logs. When you are happy, connect to the **primary** and run:

```javascript
db.adminCommand({ setFeatureCompatibilityVersion: "8.3", confirm: true })
// → { ok: 1 }
```

The command waits until the change reaches a majority of members. If it is interrupted, it is safe to run again on the primary.

> **Warning:** Don't raise FCV while an initial sync is running on any member. It would restart the sync. Wait for every member to be healthy first.

## Sharded clusters: the order matters

For a sharded cluster the idea is the same, but the order is fixed:

1. **Stop the balancer** so no chunks move during the upgrade:

   ```javascript
   // mongosh connected to a mongos
   sh.stopBalancer()
   sh.getBalancerState()
   // → false
   ```

2. **Upgrade the config server replica set** (rolling, as above).
3. **Upgrade each shard** (each is a replica set, rolling, as above).
4. **Upgrade every `mongos`** router.
5. **Start the balancer** again with `sh.startBalancer()`.
6. After burn-in, run `setFeatureCompatibilityVersion: "8.3"` **through a `mongos`**.

> **Note:** On Atlas, all of this is done for you when you change the version in the cluster settings. You still need to do the checklist (compatibility changes, drivers, staging test) yourself.

## 8.3 compatibility changes worth checking

These are some of the behaviour changes listed in the 8.3 release notes. Read the full "Compatibility Changes in MongoDB 8.3" page for the complete list.

| Area | What changed in 8.3 |
| --- | --- |
| **Sharded clusters** | DDL operations (like creating collections or indexes) and `applyOps` must be run through `mongos`, not directly on a shard. |
| **Shard removal** | `removeShard` is **deprecated**. Use `startShardDraining`, `shardDrainingStatus`, `stopShardDraining` and `commitShardRemoval` instead. |
| **2dsphere indexes** | New `2dsphere` indexes default to index version 4. Before you **downgrade** FCV below 8.3, drop version 4 `2dsphere` indexes. |
| **Geospatial data** | If a document has both GeoJSON and legacy coordinate pairs, GeoJSON now wins. You may need to rebuild some indexes. |
| **Upserts** | An upsert whose result is larger than the BSON size limit now returns error code `10334` (`BSONObjectTooLarge`) instead of `17419`/`17420`. Update code that checks those numbers. |
| **Time series** | `timeField` can't start with `$`, and creating or hinting an index named `_id_` on a time series collection now errors. |
| **Date maths** | `$dateAdd` and `$dateSubtract` with units other than milliseconds give a slightly different result (one second greater) for dates **before 1970**. This also affects `$setWindowFields` and `$densify`. |
| **Strings** | The `chars` argument of `$trim`, `$ltrim` and `$rtrim` is limited to 4,096 characters. |
| **serverStatus** | The `service` field was removed from the `serverStatus` output. Update monitoring scripts that read it. |

Here is a quick way to find code that still calls the deprecated shard command:

```bash
grep -rn "removeShard" ./scripts ./ops
```

## What you get after raising FCV

Once FCV is `"8.3"`, you can use everything new in the release. Some highlights covered elsewhere in this course:

- `$scoreFusion` for hybrid search is generally available (see [Hybrid Search with rankFusion and scoreFusion](/courses/mongodb/rank-and-score-fusion)).
- `arrayIndexAs` and `$$IDX` in `$map`, `$filter` and `$reduce` (see [Array Index Access with IDX and arrayIndexAs](/courses/mongodb/array-index-access)).
- New expressions such as `$hash`, `$createObjectId`, `$serializeEJSON` and `$deserializeEJSON` (see [Expression Operators: hash, createObjectId and EJSON](/courses/mongodb/expression-operators)).
- `$toString`, `$convert` (with a new `base` option), `$toArray` and `$toObject` handle more types (see [Conversion Operators: convert, toObject and toArray](/courses/mongodb/conversion-operators)).
- The **cost-based ranker** is used as the default backup for multi-planning on eligible queries (see [The Cost-Based Ranker](/courses/mongodb/cost-based-ranker)).

MongoDB also reports throughput and latency improvements of up to 40% on some workloads. Measure your own before and after.

## If you need to go back

Starting in 8.3, you can downgrade FCV from `"8.3"` to `"8.2"`, and MongoDB supports downgrading one version at a time (8.3 to 8.2).

- **Before raising FCV:** going back is easy. Do a rolling restart with the old binaries.
- **After raising FCV:** first remove any data that uses new 8.3-only features (for example version 4 `2dsphere` indexes), then lower FCV, then swap binaries.

```javascript
db.adminCommand({ setFeatureCompatibilityVersion: "8.2", confirm: true })
```

This is exactly why the burn-in period exists. Find problems **before** you raise FCV, while the way back is still simple.

## Common mistakes

- **Raising FCV straight after the binary upgrade.** You lose the easy way back. Burn in first.
- **Skipping a minor release.** From 8.1 you must go through 8.2 before 8.3.
- **Upgrading two members at the same time.** You can lose the majority and stop all writes. One member at a time, secondaries first.
- **Forgetting the balancer.** On sharded clusters, stop it before the upgrade and start it again afterwards.
- **Not checking drivers and monitoring scripts.** Old drivers, error-code checks or scripts that read removed `serverStatus` fields can break quietly.

## Practice

1. Your replica set runs 8.1 with FCV `"8.1"`. List the version steps to reach 8.3 with FCV `"8.3"`.
2. Write the command that shows the current FCV, and the command that raises it to 8.3.
3. Put these sharded-cluster steps in the right order: upgrade `mongos`, upgrade shards, stop balancer, raise FCV, upgrade config servers, start balancer.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. 8.1 (FCV 8.1)
//    → binaries 8.2, burn in, FCV "8.2"
//    → binaries 8.3, burn in, FCV "8.3"

// 2.
db.adminCommand({ getParameter: 1, featureCompatibilityVersion: 1 })
db.adminCommand({ setFeatureCompatibilityVersion: "8.3", confirm: true })

// 3.
// stop balancer → upgrade config servers → upgrade shards
// → upgrade mongos → start balancer → (after burn-in) raise FCV via mongos
```

</details>

## Key takeaways

- 8.3 is a **minor release** in the 8.x line. It's available on Atlas, and for self-managed deployments only for specific use cases. MongoDB 9.0, the next major, has since been released.
- You can reach 8.3 directly from **8.0** or **8.2**. From another minor (like 8.1) you must step through each minor release.
- Every upgrade is two steps: **binaries** first (rolling, secondaries then primary), then **FCV** after a burn-in period.
- Run `setFeatureCompatibilityVersion` with `confirm: true` on the primary (or through `mongos` for sharded clusters).
- Read the **compatibility changes** first: DDL through `mongos`, deprecated `removeShard`, 2dsphere v4, new upsert error code and more.

**Next lesson:** [Capacity Planning and Cost Optimisation](/courses/mongodb/capacity-planning)
