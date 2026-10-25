---
title: Monitoring with serverStatus and FTDC
slug: monitoring-and-ftdc
metadescription: Learn to monitor MongoDB with serverStatus, currentOp, mongostat and mongotop, and understand what FTDC diagnostic data is and why you should keep it.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'monitoring', 'ftdc', 'operations']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Performance Tuning and Working Set Sizing](/courses/mongodb/performance-tuning).

## What you will learn

By the end of this lesson you will know:

- How to read the most useful parts of `db.serverStatus()`
- How to see, and stop, running operations with `db.currentOp()` and `db.killOp()`
- How to watch a live server with the `mongostat` and `mongotop` tools
- What **FTDC** and the `diagnostic.data` folder are, and why you should never delete them
- Where to find the same information on MongoDB Atlas

All the commands here work on a local `mongod`. `mongostat` and `mongotop` come with the **MongoDB Database Tools**, a separate download from the server.

## Why monitor at all?

Performance tuning (last lesson) is about fixing a problem you already found. **Monitoring** is how you find problems, ideally before your users do.

> **Think of it like this:** A car dashboard shows speed, fuel and engine temperature all the time. You don't stare at it, but you notice when a warning light comes on. A flight recorder (black box) quietly records everything, so after an incident experts can see what happened. In MongoDB, `serverStatus` is the dashboard and **FTDC** is the black box.

## serverStatus: the dashboard

`db.serverStatus()` returns a large document full of counters about the whole server. It is cheap to run, so monitoring tools call it every few seconds.

```javascript
db.serverStatus()
// → { host: 'laptop', version: '8.3.1', process: 'mongod', uptime: 86400,
//     connections: {...}, opcounters: {...}, mem: {...}, wiredTiger: {...}, ... }
```

The full output is hundreds of lines. Let's look at the parts beginners should know.

### Connections

```javascript
db.serverStatus().connections
// → { current: 42, available: 838818, totalCreated: 1290, active: 5, ... }
```

- `current`: open connections right now
- `totalCreated`: connections opened since the server started

If `totalCreated` climbs very fast, your app is probably opening a new connection per request instead of reusing a pool.

### Operation counters

```javascript
db.serverStatus().opcounters
// → { insert: Long(5100), query: Long(98000), update: Long(4200),
//     delete: Long(30), getmore: Long(1500), command: Long(210000) }
```

These count operations **since startup**. They only become useful when you compare two readings. Take one reading, wait 10 seconds, take another, and subtract to get operations per second. That is exactly what `mongostat` does for you.

### Latency

```javascript
db.serverStatus().opLatencies
// → { reads: { latency: Long(29400000), ops: Long(98000) },
//     writes: { latency: Long(8820000), ops: Long(9300) }, ... }
```

`latency` is the total time in **microseconds**. Divide by `ops` for the average: 29,400,000 / 98,000 = 300 microseconds (0.3 ms) per read.

### Memory and cache

```javascript
db.serverStatus().mem
// → { bits: 64, resident: 2310, virtual: 4120, ... }   // in megabytes
```

`resident` is the RAM the `mongod` process is really using. For cache details, look at `db.serverStatus().wiredTiger.cache` as you did in the previous lesson.

### Asking for less

You can switch sections off to keep the output small:

```javascript
db.serverStatus({ wiredTiger: 0, metrics: 0 })
```

## currentOp: what is running right now?

Sometimes the server suddenly feels slow. The first question is: "what is it doing?" `db.currentOp()` lists operations in progress.

Let's show only active operations that have been running for more than 3 seconds:

```javascript
db.currentOp({ active: true, secs_running: { $gt: 3 } })
```

```javascript
{
  inprog: [
    {
      opid: 31842,
      active: true,
      secs_running: Long(47),
      op: 'command',
      ns: 'shop.orders',
      command: { aggregate: 'orders', pipeline: [ { $group: { ... } } ], ... },
      planSummary: 'COLLSCAN',
      client: '10.0.0.12:53122',
      ...
    }
  ],
  ok: 1
}
```

This one has run for 47 seconds and is scanning the whole collection. Someone's report query, probably.

The same information is available as an aggregation stage, which makes filtering easier:

```javascript
db.getSiblingDB("admin").aggregate([
  { $currentOp: {} },
  { $match: { secs_running: { $gt: 3 } } },
  { $project: { opid: 1, ns: 1, secs_running: 1, planSummary: 1 } }
])
```

### Stopping a runaway operation

If an operation is hurting everyone, you can stop it with its `opid`:

```javascript
db.killOp(31842)
// → { info: 'attempting to kill op', ok: 1 }
```

> **Warning:** Only kill operations you understand. Killing an index build or an internal replication operation can cause more trouble than it solves. Your own app's queries and reports are usually safe to kill.

## mongostat: a live, per-second view

`mongostat` connects to a server and prints one line per second, like a heartbeat monitor. Run it from your terminal, not inside mongosh:

```bash
mongostat --uri "mongodb://localhost:27017"
```

```text
insert query update delete getmore command dirty  used flushes vsize   res qrw arw net_in net_out conn  time
    12   340     25     *0      10    55|0  0.4% 61.2%       0 4.02G 2.25G 0|0 1|0  112k    1.9m   42  10:15:01
    15   362     22     *0      12    61|0  0.5% 61.3%       0 4.02G 2.25G 0|0 0|0  118k    2.0m   42  10:15:02
```

The columns to watch:

| Column | Meaning | Worry when |
| --- | --- | --- |
| `insert`, `query`, `update`, `delete` | Operations per second | A sudden spike or drop |
| `dirty` | Share of the cache holding changed data not yet written to disk | Stays above about 20% |
| `used` | Share of the cache in use | Pinned near 95% and above |
| `qrw` / `arw` | Queued / active readers and writers | The queued number stays above 0 |
| `conn` | Open connections | Keeps climbing |

Add `--rowcount 10` to stop after 10 lines, or `5` at the end to print every 5 seconds.

## mongotop: which collections are busy?

`mongostat` tells you **how much** work is happening. `mongotop` tells you **where**. It shows how much time the server spent reading and writing each collection:

```bash
mongotop --uri "mongodb://localhost:27017" 5
```

```text
                    ns    total    read    write    2026-10-25T10:20:05Z
           shop.orders    412ms   380ms     32ms
         shop.products     55ms    54ms      1ms
        shop.customers     10ms    10ms      0ms
```

`shop.orders` is doing most of the work, mostly reads. That's where to look for missing indexes.

## Logs: slow queries are already recorded

MongoDB writes operations slower than 100 ms (the default `slowms`) to its log, in JSON format. You can read recent log lines without opening the log file:

```javascript
db.adminCommand({ getLog: "global" }).log
  .filter(line => line.includes("Slow query"))
  .slice(-3)
```

Each slow query line includes the namespace, duration, plan summary and documents examined, the same clues the profiler gives.

> **Note:** MongoDB 8.3 can also log operations that are **still running** past a threshold (the `slowOpInProgressThreshold` setting), so you can spot a long query before it finishes.

## Replication health

On a replica set, check how far behind the secondaries are. This is called **replication lag**:

```javascript
rs.printSecondaryReplicationInfo()
```

```text
source: db2:27017
{ syncedTo: 'Sat Oct 25 2026 10:21:30 GMT+0000', replLag: '0 secs (0 hrs) behind the primary ' }
```

A lag of a few seconds during heavy writes is normal. Minutes of lag means the secondary can't keep up.

## FTDC: the black box

**FTDC** stands for **Full Time Diagnostic Data Capture**. It is a built-in feature, on by default, that records server statistics about once per second and saves them to disk.

### What it records

FTDC captures the output of commands like `serverStatus`, `replSetGetStatus` and some operating system stats (CPU, memory, disk). MongoDB 8.3 also adds connection pool stats on `mongod`.

It records **numbers about the server**, not your documents. Your customers' names and orders are not in FTDC files.

### Where it lives

For `mongod`, FTDC files live in a folder called `diagnostic.data` inside the data directory:

```text
/var/lib/mongodb/             (your dbPath)
├── collection-0-123.wt
├── index-1-123.wt
├── ...
└── diagnostic.data/
    ├── metrics.2026-10-24T08-00-00Z-00000
    ├── metrics.2026-10-25T02-14-10Z-00000
    └── metrics.interim
```

The files are compressed binary, so you can't read them in a text editor. MongoDB support engineers and tools turn them into charts of every metric over time, which makes them extremely useful after an incident.

### How big it gets

FTDC keeps itself tidy. When the folder reaches its size limit, the oldest files are deleted automatically.

| Setting | Default | Meaning |
| --- | --- | --- |
| `diagnosticDataCollectionEnabled` | `true` | FTDC on or off |
| `diagnosticDataCollectionPeriodMillis` | `1000` | How often it samples (1 second) |
| `diagnosticDataCollectionDirectorySizeMB` | **500** in 8.3 (was 200) | Maximum folder size |
| `diagnosticDataCollectionFileSizeMB` | `10` | Size of each file before a new one starts |

MongoDB 8.3 raised the default folder size from 200 MB to 500 MB, so you keep a longer history.

You can check a value with `getParameter`:

```javascript
db.adminCommand({ getParameter: 1, diagnosticDataCollectionDirectorySizeMB: 1 })
// → { diagnosticDataCollectionDirectorySizeMB: 500, ok: 1 }
```

If you need even more history, set it at startup in `mongod.conf`:

```yaml
setParameter:
  diagnosticDataCollectionDirectorySizeMB: 1000
```

> **Warning:** Don't delete `diagnostic.data` to save space, and don't switch FTDC off. It uses very little CPU and disk, and without it nobody can investigate what happened during an outage. If disk is tight, lower the size limit instead.

### What about mongos?

`mongos` has no data directory, so FTDC for `mongos` is written to a folder next to its log file. If `mongos` runs without a log file, set `diagnosticDataCollectionDirectoryPath` to choose a folder.

## Monitoring on Atlas

On MongoDB Atlas you rarely need these commands, because Atlas collects them for you:

- **Metrics** charts: connections, operations, cache, replication lag and disk, over days or weeks
- **Real-Time Performance Panel**: a live view similar to `mongostat` and `mongotop`
- **Query Profiler** and **Performance Advisor**: slow queries and index suggestions
- **Alerts**: email or chat notifications when a metric crosses a threshold

Atlas also keeps FTDC data, which support can use if you open a ticket. Some commands, like `db.killOp()`, are limited on free and Flex tiers.

## Common mistakes

- **Reading `opcounters` as a rate.** They are totals since startup. Compare two readings, or use `mongostat`.
- **Deleting the `diagnostic.data` folder.** It is small, self-cleaning and vital for investigations. Lower the size limit if you must.
- **Killing operations blindly.** Check `ns`, `command` and `client` in `currentOp` first, and avoid internal or replication operations.
- **Only looking when something breaks.** Know your normal numbers (connections, ops per second, cache use) so you can recognise abnormal ones.
- **Running `mongostat` inside mongosh.** It is a separate command-line tool. Run it in your terminal.

## Practice

1. Write a mongosh expression that prints only the number of current connections.
2. List operations on `shop.orders` that have been running longer than 10 seconds, showing just their `opid` and `secs_running`.
3. Check FTDC's maximum folder size on your server and explain what happens when the limit is reached.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Current connections only
db.serverStatus().connections.current

// 2. Long-running operations on shop.orders
db.getSiblingDB("admin").aggregate([
  { $currentOp: {} },
  { $match: { ns: "shop.orders", secs_running: { $gt: 10 } } },
  { $project: { _id: 0, opid: 1, secs_running: 1 } }
])

// 3. Folder size limit (500 MB by default in 8.3, 200 MB before)
db.adminCommand({ getParameter: 1, diagnosticDataCollectionDirectorySizeMB: 1 })
// When the folder reaches the limit, MongoDB deletes the oldest metrics files.
```

</details>

## Key takeaways

- `db.serverStatus()` is the dashboard: connections, operation counters, latency, memory and cache.
- `db.currentOp()` (or `$currentOp`) shows what is running now, and `db.killOp()` stops a runaway operation.
- `mongostat` shows server activity every second and `mongotop` shows which collections are busy.
- **FTDC** records server metrics every second into `diagnostic.data`. It holds stats, not your data. Keep it on.
- MongoDB 8.3 raised the FTDC folder default from 200 MB to 500 MB. On Atlas, metrics, alerts and profilers are built in.

**Next lesson:** [Query Settings and Index Hints](/courses/mongodb/query-settings-and-hints)
