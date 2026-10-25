---
title: Replica Sets and Elections
slug: replica-sets
metadescription: Learn how MongoDB replica sets keep copies of your data, how elections pick a new primary, and how to run and test a 3-member replica set on your own computer.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'replica-set', 'high-availability', 'elections']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Read Preferences and Replica Set Reads](/courses/mongodb/read-preferences). You'll need MongoDB installed locally (from *Installing MongoDB Community 8*) to follow the hands-on part.

## What you will learn

By the end of this lesson you will know:

- What a **replica set** is and why production systems use one
- The roles members can play: **primary**, **secondary**, **arbiter**, **hidden** and **delayed**
- How the **oplog** keeps members in sync
- How an **election** chooses a new primary, and why you want an odd number of voters
- How to start a **3-member replica set** on your laptop, watch a failover, and change its configuration

## Why replica sets?

If your whole app depends on **one** database server, then when that server dies, your app dies. Disks fail. Data centres lose power. Cloud machines get restarted for maintenance.

A **replica set** is a group of MongoDB servers (called **members**) that all keep a copy of the same data. If one fails, another takes over automatically, usually within seconds. This is called **high availability**.

> **Think of it like this:** A replica set is like a cricket team with a captain and vice-captains. The captain (primary) makes the calls. The vice-captains (secondaries) follow every decision closely. If the captain gets injured, the team quickly picks a new captain from the vice-captains, and the match continues.

Replica sets give you:

- **Automatic failover**: a new primary is chosen if the old one goes down.
- **Redundancy**: several copies of your data, ideally in different data centres.
- **Maintenance without downtime**: you can upgrade or restart members one at a time.
- **Optional read scaling**: secondaries can serve some reads (previous lesson).

Every MongoDB Atlas cluster is a replica set with at least 3 members, which is why Atlas features like change streams and transactions just work.

## Member roles

### Primary

Exactly **one** member is the primary at any time. It receives **all writes**.

### Secondaries

Secondaries copy everything the primary does and apply it to their own data. They're ready to become the primary if needed.

### Special kinds of secondaries

| Kind | What it's for | Key setting |
| --- | --- | --- |
| **Priority 0** | Holds data and votes, but can never become primary (e.g. a small server in a far-away region). | `priority: 0` |
| **Hidden** | Invisible to apps, so it receives no normal reads. Good for backups or reporting. | `hidden: true`, `priority: 0` |
| **Delayed** | Stays deliberately behind, for example 1 hour. If someone deletes data by mistake, the delayed member still has it for a while. | `secondaryDelaySecs: 3600`, `priority: 0`, `hidden: true` |

### Arbiter

An **arbiter** holds **no data**. It only votes in elections, as a tie-breaker. It's cheap to run, but it can't help with redundancy and it makes `w: "majority"` writes harder to satisfy when a data member is down. Use three data-bearing members instead whenever you can.

### Limits

- A replica set can have up to **50 members**.
- At most **7 members can vote**. Others are set to `votes: 0` (and must also have `priority: 0`).

## The oplog: how members stay in sync

The primary records every write in a special capped collection called the **oplog** (operations log), stored at `local.oplog.rs`. Secondaries constantly read the primary's oplog and replay each entry on their own copy.

```text
PRIMARY                         SECONDARY
1. insert order 5001   ──────▶  1. insert order 5001
2. update stock        ──────▶  2. update stock
3. delete cart         ──────▶  3. delete cart  (a few ms later)
```

The oplog has a fixed size. Old entries are removed as new ones arrive. If a secondary is offline so long that the entries it needs are gone, it can't catch up by replaying. It then has to copy all data again from scratch (an **initial sync**).

> **Note:** The oplog is also what powers change streams (*Change Streams* lesson) and point-in-time backups (next lesson).

## Elections: choosing a new primary

Members send each other a small "are you alive?" message called a **heartbeat** every 2 seconds.

If the secondaries can't reach the primary for **10 seconds** (the default `electionTimeoutMillis`), an eligible secondary calls an **election**:

1. It asks the other voting members: "Vote for me?"
2. Members vote yes if the candidate's data is at least as up to date as theirs.
3. If the candidate gets votes from a **majority** of all voting members, it becomes the new primary.

With default settings, a new primary is usually ready within about **12 seconds** of the old one failing. During that short window, writes can't be accepted. Modern drivers wait and **retry** a failed write once automatically (**retryable writes**, on by default), so apps often don't even notice.

### Why majority, and why an odd number?

The new primary needs votes from **more than half of all voting members**, not just more than half of the ones still reachable. This stops two halves of a broken network from each picking their own primary.

| Voting members | Majority needed | Members that can fail |
| --- | --- | --- |
| 1 | 1 | 0 |
| 2 | 2 | 0 |
| 3 | 2 | **1** |
| 4 | 3 | 1 |
| 5 | 3 | **2** |
| 7 | 4 | 3 |

Look at the table: 4 members survive no more failures than 3. That's why replica sets use an **odd number** of voting members, with **3** being the usual minimum and **5** common for important systems.

> **Think of it like this:** A group of 4 friends voting on a restaurant can end 2–2 and nobody eats. A group of 3 or 5 always has a winner.

### Priority

Each member has a **priority** from 0 to 1000 (default `1`). In an election, members with higher priority are preferred. A member with `priority: 0` will never become primary. Use priority to say "the server in our main data centre should normally be primary".

## Hands-on: a 3-member replica set on your laptop

We'll run three `mongod` processes on one computer, on ports 27017, 27018 and 27019. In real life they'd be three separate machines.

> **Warning:** If MongoDB already runs on port 27017 (for example as a Windows service, or the single-node set from *Change Streams*), stop it first, or pick three other ports and use them everywhere below.

### Step 1: start three members

**macOS / Linux:**

```bash
mkdir -p ~/rs-demo/db1 ~/rs-demo/db2 ~/rs-demo/db3

mongod --replSet rs0 --port 27017 --dbpath ~/rs-demo/db1 --fork --logpath ~/rs-demo/db1.log
mongod --replSet rs0 --port 27018 --dbpath ~/rs-demo/db2 --fork --logpath ~/rs-demo/db2.log
mongod --replSet rs0 --port 27019 --dbpath ~/rs-demo/db3 --fork --logpath ~/rs-demo/db3.log
```

`--fork` runs each one in the background.

**Windows (PowerShell):** each `Start-Process` opens a new window running one member. Leave them open.

```powershell
New-Item -ItemType Directory -Force C:\rs-demo\db1, C:\rs-demo\db2, C:\rs-demo\db3

Start-Process mongod -ArgumentList "--replSet rs0 --port 27017 --dbpath C:\rs-demo\db1"
Start-Process mongod -ArgumentList "--replSet rs0 --port 27018 --dbpath C:\rs-demo\db2"
Start-Process mongod -ArgumentList "--replSet rs0 --port 27019 --dbpath C:\rs-demo\db3"
```

### Step 2: initiate the set

Connect to one member and give it the full member list:

```bash
mongosh --port 27017
```

```javascript
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "localhost:27017" },
    { _id: 1, host: "localhost:27018" },
    { _id: 2, host: "localhost:27019" }
  ]
})
// → { ok: 1 }
```

After a few seconds the prompt changes to `rs0 [direct: primary] test>`.

### Step 3: check the status

```javascript
rs.status().members.map(m => ({ name: m.name, state: m.stateStr, health: m.health }))
// → [
//     { name: 'localhost:27017', state: 'PRIMARY', health: 1 },
//     { name: 'localhost:27018', state: 'SECONDARY', health: 1 },
//     { name: 'localhost:27019', state: 'SECONDARY', health: 1 }
//   ]
```

`health: 1` means the member is reachable. `rs.status()` on its own prints much more, including each member's last applied write time (`optimeDate`).

### Step 4: connect the right way

Exit and reconnect using **all three hosts and the set name**. This lets mongosh (and any driver) find the primary on its own and follow it after a failover:

```bash
mongosh "mongodb://localhost:27017,localhost:27018,localhost:27019/shop?replicaSet=rs0"
```

Insert some data:

```javascript
db.products.insertOne({ name: "Notebook", category: "stationery", price: 49, stock: 120 })
```

### Step 5: watch a failover

Ask the current primary to step down. This triggers an election, just like a crash would, but politely:

```javascript
rs.stepDown()
```

Wait a few seconds and check again:

```javascript
rs.status().members.map(m => ({ name: m.name, state: m.stateStr }))
// → [
//     { name: 'localhost:27017', state: 'SECONDARY' },
//     { name: 'localhost:27018', state: 'PRIMARY' },
//     { name: 'localhost:27019', state: 'SECONDARY' }
//   ]
```

A new primary was elected. Because you connected with the replica set connection string, your mongosh session follows it automatically:

```javascript
db.products.findOne({ name: "Notebook" })
// → { _id: ObjectId('...'), name: 'Notebook', ... }   still there
```

To simulate a real crash, shut down the new primary completely (use its port):

```bash
mongosh --port 27018 --eval "db.adminCommand({ shutdown: 1 })"
```

The two remaining members still form a majority (2 of 3), so one of them becomes primary. Start the stopped member again with its `mongod` command and it rejoins as a secondary, catching up from the oplog.

> **Tip:** Now shut down **two** members. The last one stays a secondary and refuses writes, because 1 out of 3 is not a majority. This is the safety rule in action.

## Changing the configuration

`rs.conf()` shows the current configuration. Here's how to make common changes.

### Give one member a higher priority

```javascript
const cfg = rs.conf()
cfg.members[0].priority = 2   // localhost:27017 should normally be primary
rs.reconfig(cfg)
```

### Add and remove members

```javascript
rs.add({ host: "localhost:27020" })       // a new member (start its mongod first)
rs.add({ host: "localhost:27021", priority: 0, hidden: true }) // a hidden member
rs.remove("localhost:27021")
```

### Make a delayed member

```javascript
const cfg = rs.conf()
cfg.members[2].priority = 0
cfg.members[2].hidden = true
cfg.members[2].secondaryDelaySecs = 3600   // one hour behind
rs.reconfig(cfg)
```

> **Warning:** Run `rs.reconfig()` on the **primary**, and change one thing at a time. Big reconfigurations while members are down can leave the set without a primary.

## Checking replication lag

How far behind are the secondaries? Two helpers answer that:

```javascript
rs.printSecondaryReplicationInfo()
// → source: localhost:27018
//     syncedTo: Sat Oct 25 2026 10:15:02 GMT+0530
//     0 secs (0 hrs) behind the primary
//   source: localhost:27019
//     ...

rs.printReplicationInfo()
// → configured oplog size:   990 MB
//   log length start to end: 3600 secs (1 hrs)
//   ...
```

`rs.printReplicationInfo()` tells you how much **time** your oplog covers. If a secondary is offline for longer than that, it will need a full initial sync. On a busy production system you want this window to be comfortably long, like a day or more.

## Cleaning up

When you're done, shut down all members (connect to each port and run `db.adminCommand({ shutdown: 1 })`, or close the PowerShell windows), and delete the `rs-demo` folder if you like.

## Common mistakes

- **Connecting to one host only.** `mongodb://localhost:27017` without `replicaSet=` may get stuck on a member that is no longer primary. Use all hosts plus `replicaSet=rs0` (or the `mongodb+srv://` string on Atlas).
- **Using an even number of voting members.** Four members tolerate the same failures as three. Add or remove one, or use an arbiter only as a last resort.
- **Putting all members in one place.** Three members on one physical machine or one data centre all fail together. Spread them out in production.
- **Expecting writes with no majority.** If most members are down, the remaining ones won't accept writes. This protects your data; fix the failed members.
- **A tiny oplog.** If the oplog only covers a few minutes, a short outage forces secondaries into a slow full resync. Check `rs.printReplicationInfo()`.

## Practice

1. Start the 3-member set from this lesson and make `localhost:27019` the preferred primary using priority.
2. Step down the current primary and check that `localhost:27019` wins the election.
3. Add a fourth member on port 27020 that never becomes primary and does not vote. What settings does it need?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. On the primary
const cfg = rs.conf()
cfg.members[2].priority = 5      // localhost:27019
rs.reconfig(cfg)

// 2.
rs.stepDown()
// a few seconds later:
rs.status().members.find(m => m.stateStr === "PRIMARY").name
// → 'localhost:27019'
// (a higher-priority member also takes over by itself once it has caught up)

// 3. Start mongod on 27020 with --replSet rs0 first, then:
rs.add({ host: "localhost:27020", priority: 0, votes: 0 })
// A non-voting member must also have priority 0.
```

</details>

## Key takeaways

- A **replica set** is a group of members holding the same data; one **primary** takes writes and **secondaries** copy them through the **oplog**.
- If the primary is unreachable for about 10 seconds, the members hold an **election** and a new primary usually takes over within about 12 seconds.
- A new primary needs votes from a **majority** of voting members, so use an odd number (3 or 5); at most 7 members vote, up to 50 in total.
- **Priority**, **hidden** and **delayed** members let you control who can become primary and keep special copies.
- Always connect with all hosts and `replicaSet=` so drivers follow the primary; check health with `rs.status()` and lag with `rs.printSecondaryReplicationInfo()`.

**Next lesson:** [Backups, Snapshots and Point-in-Time Restore](/courses/mongodb/backups-and-restore)
