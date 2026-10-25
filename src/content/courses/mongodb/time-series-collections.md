---
title: Time Series and Capped Collections
slug: time-series-collections
metadescription: Learn how to store sensor readings and other time-stamped data efficiently with time series collections, and when to use fixed-size capped collections.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'time-series', 'capped-collections', 'iot']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What **time series data** is and why it needs a special collection type
- How to create a **time series collection** with `timeField`, `metaField` and `granularity`
- How to insert, query and summarise readings, and expire old data automatically
- The limits of time series collections
- What a **capped collection** is, and when to pick it over a TTL index

## What is time series data?

**Time series data** is a list of measurements taken over time. Each measurement has three parts:

1. **When** it was measured (a timestamp)
2. **What** was measured (a sensor, a stock symbol, a server)
3. **The values** (temperature, price, CPU usage)

Examples are everywhere: a temperature sensor reporting every minute, a fitness band counting steps, a website logging page views, stock prices ticking every second.

This kind of data has a special shape. It **only grows**, it is almost **never updated**, and you usually ask questions about **time ranges** ("average temperature per hour yesterday").

> **Think of it like this:** A normal collection is like a box of loose index cards. A time series collection is like a diary with one page per day per sensor: readings that belong together are written on the same page, so it's quick to flip to "Sensor A, last Tuesday".

## Why not a normal collection?

You *can* store readings in a normal collection, one document per reading. But with millions of readings you pay for:

- Repeating the same sensor info in every single document
- One index entry per reading
- Lots of disk space

A **time series collection** fixes this. Behind the scenes, MongoDB groups readings from the same source and time window into **buckets** and stores them in a compressed, column-like format. You still insert and query normal-looking documents. MongoDB does the grouping for you.

The result: far less disk space, smaller indexes, and faster time-range queries.

## Creating a time series collection

You must create a time series collection **explicitly** with `db.createCollection()`. Let's store temperature readings from sensors in a warehouse:

```javascript
use shop

db.createCollection("sensorReadings", {
  timeseries: {
    timeField: "timestamp",
    metaField: "sensor",
    granularity: "minutes"
  }
})
// → { ok: 1 }
```

Here's what each option means:

| Option | Required? | Meaning |
| --- | --- | --- |
| `timeField` | Yes | The field holding the date of each reading. Must be a real `Date`. |
| `metaField` | No (but recommended) | The field that says *which source* the reading came from. Readings with the same meta value are grouped together. |
| `granularity` | No | Roughly how often readings arrive: `"seconds"` (default), `"minutes"` or `"hours"`. |

`show collections` marks it so you can tell it apart:

```javascript
show collections
// → customers
//   orders
//   products
//   sensorReadings  [time-series]
```

> **Tip:** Pick the `granularity` closest to how often **one** source reports. If each sensor sends a reading every 5 minutes, choose `"minutes"`.

### Custom bucket sizes

Instead of `granularity`, you can set the bucket size in seconds yourself with `bucketMaxSpanSeconds` and `bucketRoundingSeconds`. The two values must be the same:

```javascript
db.createCollection("pageViews", {
  timeseries: {
    timeField: "viewedAt",
    metaField: "page",
    bucketMaxSpanSeconds: 3600,
    bucketRoundingSeconds: 3600
  }
})
```

Most beginners never need this. `granularity` is fine.

## Inserting readings

Insert readings like normal documents. Put the source details inside the `metaField`:

```javascript
db.sensorReadings.insertMany([
  { sensor: { id: "T-01", room: "cold-store" }, timestamp: ISODate("2026-10-25T08:00:00Z"), tempC: 3.9, humidity: 71 },
  { sensor: { id: "T-01", room: "cold-store" }, timestamp: ISODate("2026-10-25T08:05:00Z"), tempC: 4.1, humidity: 70 },
  { sensor: { id: "T-01", room: "cold-store" }, timestamp: ISODate("2026-10-25T08:10:00Z"), tempC: 4.6, humidity: 69 },
  { sensor: { id: "T-02", room: "packing" },    timestamp: ISODate("2026-10-25T08:00:00Z"), tempC: 24.2, humidity: 52 },
  { sensor: { id: "T-02", room: "packing" },    timestamp: ISODate("2026-10-25T08:05:00Z"), tempC: 24.8, humidity: 50 },
  { sensor: { id: "T-02", room: "packing" },    timestamp: ISODate("2026-10-25T09:00:00Z"), tempC: 26.1, humidity: 48 }
])
// → { acknowledged: true, insertedIds: { '0': ObjectId('...'), ... } }
```

> **Note:** A time series collection stores readings best when they arrive **roughly in time order**. That's the natural case for sensors, so you rarely need to think about it.

## Querying readings

Queries look exactly like queries on a normal collection:

```javascript
// All readings from sensor T-01 after 08:02
db.sensorReadings.find({
  "sensor.id": "T-01",
  timestamp: { $gt: ISODate("2026-10-25T08:02:00Z") }
})
// → two documents: 4.1 °C at 08:05 and 4.6 °C at 08:10
```

When you create a time series collection with a `metaField`, MongoDB (6.3 and later) automatically adds an index on the `metaField` and `timeField`, so queries like this are fast out of the box.

You can add your own **secondary indexes** too:

```javascript
db.sensorReadings.createIndex({ "sensor.room": 1, timestamp: -1 })
```

### Summarising with aggregation

The real power comes with the aggregation pipeline. Here is the average temperature per sensor per hour, using `$dateTrunc` to round each timestamp down to the hour:

```javascript
db.sensorReadings.aggregate([
  {
    $group: {
      _id: {
        sensor: "$sensor.id",
        hour: { $dateTrunc: { date: "$timestamp", unit: "hour" } }
      },
      avgTemp: { $avg: "$tempC" },
      readings: { $sum: 1 }
    }
  },
  { $sort: { "_id.sensor": 1, "_id.hour": 1 } }
])
// → { _id: { sensor: 'T-01', hour: ISODate('2026-10-25T08:00:00Z') }, avgTemp: 4.2, readings: 3 }
//   { _id: { sensor: 'T-02', hour: ISODate('2026-10-25T08:00:00Z') }, avgTemp: 24.5, readings: 2 }
//   { _id: { sensor: 'T-02', hour: ISODate('2026-10-25T09:00:00Z') }, avgTemp: 26.1, readings: 1 }
```

Time series collections also pair nicely with the window functions from *Window Functions with setWindowFields*, for things like moving averages.

## Deleting old data automatically

Sensor data piles up fast. Often you only need the last 30 days. Add `expireAfterSeconds` when you create the collection, and MongoDB deletes old readings for you:

```javascript
db.createCollection("cpuStats", {
  timeseries: { timeField: "at", metaField: "server", granularity: "seconds" },
  expireAfterSeconds: 60 * 60 * 24 * 30 // 30 days
})
```

You can change it later with `collMod`:

```javascript
db.runCommand({ collMod: "cpuStats", expireAfterSeconds: 60 * 60 * 24 * 7 }) // now 7 days
```

> **Note:** Old data is removed a whole bucket at a time, in the background. A reading may live a little longer than the exact limit. That's normal.

## Limits to know

Time series collections are tuned for "write once, read many". So some things are restricted:

- You **can't convert** a normal collection into a time series collection (or back). Create a new one and copy the data in.
- `timeField` and `metaField` are set at creation and **can't be changed**.
- **Updates are limited.** Treat readings as write-once. Deletes are supported (since MongoDB 7.0), but heavy updating is a sign a time series collection is the wrong choice.
- **Change streams** don't work on time series collections.
- You **can't write** to a time series collection inside a **transaction** (reads are fine).
- **Schema validation** rules and **unique indexes** aren't supported.
- Each document can be at most **4 MB**.

> **Tip:** If you want to see the full, current list, check the "Time Series Collection Limitations" page in the MongoDB manual. It changes between versions.

## Capped collections

A **capped collection** is a different special collection. It has a **fixed maximum size**. When it is full, MongoDB automatically removes the **oldest** documents to make room for new ones.

> **Think of it like this:** A capped collection is like a whiteboard with room for exactly 100 lines. When you write line 101, the oldest line at the top is wiped off. You always have the most recent 100 lines.

Documents in a capped collection always stay in **insertion order**.

### Creating one

You must give a `size` in **bytes**. You can also add `max`, the maximum number of documents. Whichever limit is reached first wins.

```javascript
db.createCollection("activityLog", {
  capped: true,
  size: 1048576, // 1 MB
  max: 1000      // at most 1,000 documents
})
// → { ok: 1 }

db.activityLog.isCapped()
// → true
```

Insert some log lines:

```javascript
db.activityLog.insertMany([
  { at: new Date(), user: "Asha", action: "login" },
  { at: new Date(), user: "Rahul", action: "add-to-cart", product: "Gel Pen" },
  { at: new Date(), user: "Asha", action: "checkout" }
])
```

To read the **newest** entries first, sort by `$natural` (insertion order) backwards:

```javascript
db.activityLog.find().sort({ $natural: -1 }).limit(2)
// → { user: 'Asha', action: 'checkout', ... }
//   { user: 'Rahul', action: 'add-to-cart', ... }
```

You can change the limits later (MongoDB 6.0+):

```javascript
db.runCommand({ collMod: "activityLog", cappedSize: 5242880, cappedMax: 5000 })
```

### Tailable cursors

A capped collection supports a **tailable cursor**: a query that stays open and returns new documents as they're inserted, like `tail -f` on a log file. In Node.js:

```javascript
const cursor = db.collection("activityLog").find({}, { tailable: true, awaitData: true });

for await (const entry of cursor) {
  console.log(entry.user, entry.action);
}
```

For most new apps, **change streams** are the better way to react to new data. Tailable cursors are mostly seen in older code.

### Capped collection limits

- Capped collections **can't be sharded**.
- You **can't write** to them inside a **transaction**.
- Avoid updates that make documents bigger. They can fail because the space is fixed.

### Capped collection or TTL index?

Both remove old data automatically, but in different ways:

| | Capped collection | TTL index |
| --- | --- | --- |
| Removes data based on | Total size or document count | Age (a date field) |
| Example rule | "Keep the last 1 MB of logs" | "Keep logs for 7 days" |
| Write speed under load | Writes are serialised (slower with many writers) | Normal collection speed |
| Can be sharded | No | Yes |

The MongoDB manual recommends **TTL indexes** (from *Partial, Sparse and TTL Indexes*) for most cases. Reach for a capped collection only when you truly want a fixed-size buffer, like "always keep the last 1,000 events".

## Which one should I use?

| Your data | Best choice |
| --- | --- |
| Measurements over time from many sources, mostly read in time ranges | Time series collection |
| A small rolling log where only the latest N entries matter | Capped collection |
| Normal documents that should expire after some time | Normal collection + TTL index |
| Data you update often | Normal collection |

## Common mistakes

- **Storing the timestamp as a string.** `timeField` must be a real date (`new Date()` or `ISODate(...)`). A string like `"2026-10-25"` is rejected.
- **Creating the collection by inserting.** `insertOne()` on a new name creates a *normal* collection. Always call `db.createCollection()` with `timeseries` first.
- **Putting changing values in `metaField`.** The meta field should describe the *source* (sensor id, room), not a measurement. Put temperatures and counts at the top level.
- **Forgetting the size unit for capped collections.** `size` is in **bytes**. `size: 1000` is 1,000 bytes, not 1,000 documents. Use `max` for a document count.
- **Using a capped collection for "keep 30 days".** That's a time rule, so use a TTL index or `expireAfterSeconds` instead.

## Practice

1. Create a time series collection `stepCounts` for a fitness app. Each reading has `recordedAt` (date), `device` (with `userName` and `model`), and `steps`. Readings arrive every few minutes. Keep data for 90 days.
2. Insert three readings for "Maria" and write an aggregation that adds up her steps per day.
3. Create a capped collection `recentSearches` that keeps at most 500 documents and 512 KB.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1
db.createCollection("stepCounts", {
  timeseries: { timeField: "recordedAt", metaField: "device", granularity: "minutes" },
  expireAfterSeconds: 60 * 60 * 24 * 90
})

// 2
db.stepCounts.insertMany([
  { device: { userName: "Maria", model: "Band 5" }, recordedAt: ISODate("2026-10-24T07:00:00Z"), steps: 1200 },
  { device: { userName: "Maria", model: "Band 5" }, recordedAt: ISODate("2026-10-24T18:00:00Z"), steps: 3400 },
  { device: { userName: "Maria", model: "Band 5" }, recordedAt: ISODate("2026-10-25T07:30:00Z"), steps: 900 }
])

db.stepCounts.aggregate([
  { $match: { "device.userName": "Maria" } },
  { $group: {
      _id: { $dateTrunc: { date: "$recordedAt", unit: "day" } },
      totalSteps: { $sum: "$steps" }
  } },
  { $sort: { _id: 1 } }
])
// → { _id: ISODate('2026-10-24T00:00:00Z'), totalSteps: 4600 }
//   { _id: ISODate('2026-10-25T00:00:00Z'), totalSteps: 900 }

// 3
db.createCollection("recentSearches", { capped: true, size: 524288, max: 500 })
```

</details>

## Key takeaways

- **Time series collections** store time-stamped measurements in compressed buckets, saving space and speeding up time-range queries.
- Create them with `db.createCollection()` and a `timeseries` option: `timeField` (required), `metaField` (the source) and `granularity`.
- `expireAfterSeconds` deletes old readings automatically.
- Time series collections are write-once friendly: limited updates, no change streams, no writes in transactions.
- **Capped collections** have a fixed size and drop the oldest documents when full; for age-based cleanup, prefer a TTL index.

**Next lesson:** [GridFS for Large Files](/courses/mongodb/gridfs)
