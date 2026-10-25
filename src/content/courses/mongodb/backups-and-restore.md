---
title: Backups, Snapshots and Point-in-Time Restore
slug: backups-and-restore
metadescription: Learn how to back up and restore MongoDB with mongodump, filesystem snapshots and Atlas Cloud Backup, and how point-in-time restore undoes mistakes.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'backup', 'restore', 'atlas']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Replica Sets and Elections](/courses/mongodb/replica-sets) and [Import, Export and Data Migration Tools](/courses/mongodb/import-export-and-tools), where `mongodump` and `mongorestore` were introduced.

## What you will learn

By the end of this lesson you will know:

- Why a replica set is **not** a backup
- Two simple questions that decide your backup plan: **how much data can you lose** and **how fast must you recover**
- How to make and restore consistent backups with **mongodump** and **mongorestore**
- How **filesystem snapshots** work and when to use them
- What **Atlas Cloud Backup** and **point-in-time restore** do, in plain words

## A replica set is not a backup

In the last lesson you saw that a replica set keeps several copies of your data. So why back up?

Because a replica set copies **everything**, including mistakes. If someone runs this by accident:

```javascript
db.orders.deleteMany({})
```

the primary deletes every order, and a few milliseconds later every secondary does the same. All your copies are now equally empty.

A **backup** is a copy of your data **from an earlier moment**, kept somewhere separate, so you can go back in time.

> **Think of it like this:** A replica set is like having three keys to your house: lose one and you still get in. A backup is like a photo album of how each room looked last week: if a room gets wrecked, you know exactly how to put it back.

Backups protect you from:

- Human mistakes (wrong delete, bad update, a buggy migration)
- Bugs in your app that slowly corrupt data
- Ransomware or a malicious user
- Losing a whole data centre or cloud region

## Two questions to ask first

Before choosing tools, answer two questions:

| Question | Name | Example answer |
| --- | --- | --- |
| How much recent data can we afford to lose? | **RPO** (Recovery Point Objective) | "At most 1 hour of orders" |
| How quickly must we be running again? | **RTO** (Recovery Time Objective) | "Within 30 minutes" |

A nightly backup means you could lose up to 24 hours of data. If that's not acceptable, you need more frequent backups or **point-in-time restore**, which we'll cover below.

## Your backup options at a glance

| Method | Good for | Point-in-time? | Notes |
| --- | --- | --- | --- |
| `mongodump` / `mongorestore` | Small to medium databases, dev copies, Atlas free tier | Only the moment of the dump | Free, simple, slow for big data |
| Filesystem snapshots | Large self-managed deployments | Snapshot moment only | Fast; needs LVM, a cloud disk snapshot, or similar |
| Atlas Cloud Backup | Atlas dedicated clusters (M10+) | Yes, with Continuous Cloud Backup | Fully managed |
| Ops Manager / Cloud Manager | Large self-managed deployments | Yes | Paid MongoDB products for your own servers |

## Backups with mongodump

You already know `mongodump` from the tools lesson. For backups, a few extra options matter.

### A consistent backup of a replica set

A dump of a busy database takes time. Writes that happen **during** the dump can make the result slightly inconsistent: some collections were copied before a change, others after it.

The `--oplog` option fixes this. While dumping, it also records every write from the oplog into an `oplog.bson` file. At restore time, those writes are replayed so everything lines up to **one moment**: the end of the dump.

```bash
mongodump --uri="mongodb://localhost:27017,localhost:27018,localhost:27019/?replicaSet=rs0" \
  --oplog --gzip --archive=full-2026-10-25.gz
```

```powershell
mongodump --uri="mongodb://localhost:27017,localhost:27018,localhost:27019/?replicaSet=rs0" `
  --oplog --gzip --archive=full-2026-10-25.gz
```

> **Note:** `--oplog` only works for a **full dump** of a replica set member: you can't combine it with `--db`, `--collection` or `--query`, and it doesn't work through a sharded cluster's `mongos`.

### Restoring it

Restore with `--oplogReplay` so the recorded writes are applied too:

```bash
mongorestore --uri="mongodb://localhost:27017/?replicaSet=rs0" \
  --oplogReplay --gzip --archive=full-2026-10-25.gz --drop
```

`--drop` replaces each collection with the backup version instead of mixing old and new documents.

### Restoring just one collection

Usually you don't want to roll back the **whole** database just to fix one mistake. You can pull out a single collection, and even restore it under a new name so you can compare first:

```bash
mongorestore --gzip --archive=full-2026-10-25.gz \
  --nsInclude="shop.orders" --nsFrom="shop.orders" --nsTo="shop.orders_restored"
```

Now `shop.orders_restored` holds yesterday's orders. You can check them in mongosh and copy back only what's missing:

```javascript
use shop
db.orders_restored.countDocuments()
// → 1284

// Copy back orders that are missing from the live collection
db.orders_restored.aggregate([
  { $merge: { into: "orders", on: "_id", whenMatched: "keepExisting", whenNotMatched: "insert" } }
])
```

### Automating it

A backup you have to remember to run will be forgotten. Schedule it.

**macOS / Linux** with a small script and `cron`:

```bash
#!/usr/bin/env bash
# backup-mongo.sh: daily backup, keep 14 days
set -euo pipefail

BACKUP_DIR="/var/backups/mongodb"
STAMP=$(date +%F)          # e.g. 2026-10-25
mkdir -p "$BACKUP_DIR"

mongodump --uri="mongodb://localhost:27017/?replicaSet=rs0" \
  --oplog --gzip --archive="$BACKUP_DIR/full-$STAMP.gz"

# Delete backups older than 14 days
find "$BACKUP_DIR" -name "full-*.gz" -mtime +14 -delete
```

```bash
# Run it every night at 02:30 (add this line with: crontab -e)
30 2 * * * /usr/local/bin/backup-mongo.sh >> /var/log/mongo-backup.log 2>&1
```

**Windows** with PowerShell and Task Scheduler:

```powershell
# backup-mongo.ps1: daily backup, keep 14 days
$BackupDir = "D:\Backups\MongoDB"
$Stamp = Get-Date -Format "yyyy-MM-dd"
New-Item -ItemType Directory -Force $BackupDir | Out-Null

mongodump --uri="mongodb://localhost:27017/?replicaSet=rs0" `
  --oplog --gzip --archive="$BackupDir\full-$Stamp.gz"

Get-ChildItem $BackupDir -Filter "full-*.gz" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
  Remove-Item
```

```powershell
# Register a daily task at 02:30
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File D:\Scripts\backup-mongo.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:30am
Register-ScheduledTask -TaskName "MongoDB Backup" -Action $Action -Trigger $Trigger
```

> **Tip:** Copy each backup **off the server** too (to cloud storage or another machine). A backup on the same disk dies with that disk.

### When mongodump isn't enough

`mongodump` reads every document through the database, so it gets slow on large data (hundreds of GB and up), and a restore must rebuild every index. For big deployments, use snapshots or a managed backup service instead.

## Filesystem snapshots

A **snapshot** is an instant copy of a whole disk (or volume), taken by the operating system or the cloud provider. Examples: LVM snapshots on Linux, Amazon EBS snapshots, Azure managed disk snapshots, Google Cloud persistent disk snapshots.

Because it copies MongoDB's data files directly, a snapshot is **fast to take and fast to restore**, even for very large databases. Indexes are included as they are, so nothing needs rebuilding.

> **Think of it like this:** `mongodump` is like photocopying every page of a book one at a time. A snapshot is like photographing the whole bookshelf at once.

For a snapshot to be safe:

- MongoDB's **journal** must be on the **same volume** as the data files, so the snapshot catches both at the same instant. (That's the default layout.)
- If the journal is on a different volume, or you're not sure, pause writes on the member during the snapshot.

A common, safe approach is to take the snapshot from a **secondary** (often a hidden one) so the primary is never paused:

```javascript
// On the secondary you will snapshot
db.fsyncLock()     // flush everything to disk and block writes on this member
// → { info: 'now locked against writes, use db.fsyncUnlock() to unlock', lockCount: Long('1'), ok: 1 }
```

```bash
# Take the snapshot with your platform's tool, for example LVM:
sudo lvcreate --size 10G --snapshot --name mdb-snap-20261025 /dev/vg0/mongodb
```

```javascript
db.fsyncUnlock()   // let the member catch up again
```

To restore, stop `mongod`, put the snapshot's files back into the data directory, and start `mongod` again.

> **Warning:** While a member is locked, it falls behind the primary. Unlock it promptly. Never lock the primary on a busy production system.

## Point-in-time restore, in plain words

Nightly backups have a gap problem. Suppose:

- Backup taken at **02:00**
- Someone runs a bad `deleteMany` at **15:42**
- You notice at **16:10**

Restoring the 02:00 backup loses **every** good order from 02:00 to 15:42. What you really want is: "Put everything back exactly as it was at **15:41**."

That's **point-in-time restore** (PITR). It works by combining two things:

1. A **snapshot** taken some time before the mistake (02:00)
2. The **oplog**, the step-by-step record of every write since then

The restore loads the snapshot, then **replays** the oplog writes one by one, and **stops** just before the mistake.

> **Think of it like this:** A snapshot is a photo. The oplog is a video recorded after the photo. To see the room at 15:41, you start from the photo and play the video forward until 15:41, then press pause.

You can build this yourself on self-managed servers by saving the oplog continuously, but it's fiddly and easy to get wrong. In practice people use a managed service: **Atlas Continuous Cloud Backup**, or **Ops Manager** / **Cloud Manager** for self-managed deployments.

## Atlas backups

If your database is on MongoDB Atlas, backups are mostly a matter of switching them on and choosing settings.

### What each tier gets

| Atlas tier | Backups |
| --- | --- |
| **M0 (Free)** | No Atlas backups. Use `mongodump` from your own machine. |
| **Flex** | Automatic daily snapshots, always on. |
| **M10 and above (dedicated)** | **Cloud Backup** with scheduled snapshots, plus optional **Continuous Cloud Backup** for point-in-time restore. |

### Cloud Backup (snapshots)

On dedicated clusters, Atlas takes snapshots using the cloud provider's own snapshot technology. You choose a **backup policy**: how often to snapshot (hourly, daily, weekly, monthly) and how long to keep each kind. You can edit the policy in the Atlas UI under your cluster's **Backup** tab.

### Continuous Cloud Backup (point-in-time restore)

Turn on **Continuous Cloud Backup** and Atlas also keeps the oplog, exactly as described above. You then pick a **restore window**, for example "the last 7 days". Within that window you can restore to **any moment**, not just to a snapshot time.

Restoring is a few clicks:

1. Open the cluster's **Backup** tab and choose **Restore**.
2. Choose **Point in Time**, then pick a date and time (or an exact oplog timestamp).
3. Choose the **target cluster**: the same cluster, or (safer) a different one so you can inspect the result first.

> **Warning:** While a restore is running into a cluster, you can't write to that cluster, and restoring over a live cluster replaces its data. Restoring into a separate cluster and copying back what you need is often the calmer choice.

### Other Atlas backup features

- **Download a snapshot** and restore it on your own server.
- **Multi-region snapshot distribution** copies snapshots to other regions, so a regional outage can't take your backups with it.
- **Backup Compliance Policy** stops anyone, even project owners, from deleting backups or shortening retention. Useful for regulated industries.

## Test your restores

A backup you've never restored is just a hopeful file. Make restore tests a habit:

- Restore last night's backup into a **test** cluster or local server every week or month.
- Check counts and spot-check documents:

```javascript
use shop
db.orders.countDocuments()
db.orders.find().sort({ createdAt: -1 }).limit(1)
```

- Time it. That number is your real **RTO**.
- Write the steps down, so anyone on the team can do it at 3 a.m.

> **Tip:** Follow the **3-2-1 rule**: keep **3** copies of your data, on **2** different kinds of storage, with **1** copy off-site (another region or provider).

## Common mistakes

- **Treating the replica set as the backup.** Deletes and bad updates are copied to every member instantly. You still need backups.
- **Keeping backups only on the database server.** If the server's disk fails or is encrypted by ransomware, the backups go too. Copy them elsewhere.
- **Using `mongoexport` for backups.** JSON/CSV exports can lose types and don't include indexes. Use `mongodump`, snapshots or Atlas backups.
- **Forgetting `--oplogReplay`.** A dump made with `--oplog` should be restored with `--oplogReplay`, or the result may be slightly inconsistent.
- **Never testing a restore.** Many teams discover broken backups during a real emergency. Test regularly.

## Practice

1. Write a single `mongodump` command that makes a consistent, compressed, single-file backup of your local replica set `rs0`.
2. From that backup, restore only `shop.customers` into a new collection `shop.customers_check`.
3. A teammate deleted all `"pending"` orders at 11:20 today. Your last nightly dump is from 02:00, and you're on an Atlas M10 cluster with Continuous Cloud Backup. Describe the safest way to get the orders back.

<details>
<summary>Show a possible answer</summary>

```bash
# 1
mongodump --uri="mongodb://localhost:27017,localhost:27018,localhost:27019/?replicaSet=rs0" \
  --oplog --gzip --archive=full-backup.gz

# 2
mongorestore --gzip --archive=full-backup.gz \
  --nsInclude="shop.customers" --nsFrom="shop.customers" --nsTo="shop.customers_check"
```

```javascript
// 3. In Atlas: Backup tab → Restore → Point in Time → 11:19 today,
//    target = a NEW temporary cluster (not the live one).
//    Then copy the missing orders back to the live cluster, for example:
//
//    mongodump --uri="<temp cluster>" --db=shop --collection=orders \
//      --query='{ "status": "pending" }' --archive=pending.archive
//    mongorestore --uri="<live cluster>" --archive=pending.archive
//
//    Existing orders are skipped (same _id), so only the deleted ones come back.
//    Finally, delete the temporary cluster.
```

</details>

## Key takeaways

- A replica set protects against **server failure**; only a **backup** protects against mistakes, bugs and attacks.
- Decide how much data you can lose (**RPO**) and how fast you must recover (**RTO**) before choosing tools.
- `mongodump --oplog` plus `mongorestore --oplogReplay` gives a consistent backup of a replica set; schedule it and copy it off the server.
- **Filesystem snapshots** are fast for large data; take them from a secondary with the journal on the same volume, or use `db.fsyncLock()`.
- **Point-in-time restore** = snapshot + oplog replay up to a chosen moment; on Atlas M10+ it's **Continuous Cloud Backup**. Always **test** your restores.

**Next lesson:** [Sharding: Shard Keys and Chunk Distribution](/courses/mongodb/sharding-fundamentals)
