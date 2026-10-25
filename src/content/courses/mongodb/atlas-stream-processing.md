---
title: Atlas Stream Processing
slug: atlas-stream-processing
metadescription: Learn Atlas Stream Processing step by step. Read Kafka topics and change streams, aggregate them in time windows, and write results to MongoDB continuously.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 4
tags: ['mongodb', 'atlas', 'stream-processing', 'kafka']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What **stream processing** is and how it differs from running queries on stored data
- The building blocks: **workspace**, **connection registry**, **source**, **pipeline** and **sink**
- How to prototype with `sp.process()` using the built-in **solar sample stream**
- How to group events into **time windows** with `$tumblingWindow`
- How to create, start, monitor and stop a long-running **stream processor**, with a **dead letter queue**

> **Before you start:** this lesson assumes you've read [Change Streams](/courses/mongodb/change-streams), [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals) and [Atlas Data Federation and Online Archive](/courses/mongodb/data-federation-and-online-archive).

> **Note:** Atlas Stream Processing is an **Atlas-only** feature. There is nothing to install locally. You need an Atlas project, a database user with the `atlasAdmin` role, and (to save results) an Atlas cluster. Running stream processors are billed by their tier and running time, so stop the ones you aren't using.

## Data at rest vs data in motion

Everything so far in this course worked on **data at rest**: documents sitting in a collection, waiting for you to query them.

Lots of data is really **data in motion**: a never-ending flow of small events. Clicks on a website. Payments. Temperature readings from sensors. Delivery trucks reporting their location every few seconds.

You could save every event into a collection and run an aggregation every minute. But that is slow, wasteful and always a bit late. **Stream processing** runs the pipeline **continuously** on events as they arrive.

> **Think of it like this:** A normal query is like counting the cars in a car park. Stream processing is like a person standing at the gate with a clicker, counting each car as it drives in. The number is always up to date, and nobody has to walk the whole car park.

**Atlas Stream Processing** lets you do this with the same aggregation syntax you already know.

## The building blocks

| Piece | What it is |
| --- | --- |
| **Stream processing workspace** | The Atlas resource that runs your stream processors. You connect to it with mongosh. (Older docs called it a *stream processing instance*.) |
| **Connection registry** | A list of named connections inside the workspace: Kafka clusters, Atlas clusters, HTTPS endpoints, and the built-in sample stream. |
| **Source** (`$source`) | Where events come from: a Kafka topic or an Atlas change stream. Always the first stage. |
| **Pipeline** | Normal stages like `$match`, `$addFields`, `$project`, plus stream-only stages like windows. |
| **Sink** (`$merge` or `$emit`) | Where results go. `$merge` writes to an Atlas collection, `$emit` writes to a Kafka topic. Always the last stage, and only one per processor. |
| **Stream processor** | One named, saved pipeline that runs non-stop in the workspace. |

```text
Kafka topic or Atlas change stream
        │
        ▼
   $source                         (where events come from)
        │
        ▼
   $match → $addFields → window    (your pipeline)  ──► bad events go to the dead letter queue
        │
        ▼
   $merge or $emit                 (where results go: Atlas collection or Kafka topic)
```

## Step 1: create a workspace and connections

All of this happens in the Atlas UI:

1. In your project, open **Stream Processing** in the left menu and create a **workspace**. Pick a cloud provider and region close to your data.
2. Open the workspace's **Connection Registry** and add:
   - **`sample_stream_solar`**: a built-in sample source that produces fake solar panel readings every second. Perfect for learning.
   - **An Atlas cluster connection**, for example named `mongodb1`, pointing at the cluster where you want to save results.
3. Click **Connect** on the workspace and copy the **mongosh** connection string.

```bash
mongosh "mongodb://<your-workspace-host>/" --tls --authenticationDatabase admin --username <atlas-admin-user>
```

Once connected, you use the special `sp` object instead of `db`.

## Step 2: prototype with sp.process()

`sp.process()` runs a pipeline **interactively**. Results print straight to your terminal. It stops when you press Ctrl+C, after 10 minutes, or after `options.limit` documents. Nothing is saved. It is the playground for trying ideas.

Let's peek at the solar stream:

```javascript
sp.process(
  [{ $source: { connectionName: "sample_stream_solar" } }],
  { limit: 2 }
)
```

Output (shortened):

```javascript
{
  device_id: 'device_1',
  group_id: 2,
  timestamp: '2026-10-25T08:00:01.000+00:00',
  max_watts: 250,
  event_type: 0,
  obs: { watts: 168, temp: 15 },
  _ts: ISODate('2026-10-25T08:00:01.000Z')
}
{
  device_id: 'device_7',
  ...
}
```

Now add a filter, exactly as you would in an aggregation. Only show readings above 200 watts:

```javascript
sp.process(
  [
    { $source: { connectionName: "sample_stream_solar" } },
    { $match: { "obs.watts": { $gt: 200 } } },
    { $project: { _id: 0, device_id: 1, watts: "$obs.watts", temp: "$obs.temp" } }
  ],
  { limit: 5 }
)
// → { device_id: 'device_3', watts: 243, temp: 17 }
// → { device_id: 'device_9', watts: 219, temp: 21 }
// ...
```

Every new reading flows through `$match` and `$project` the moment it arrives.

## Step 3: group events with time windows

A plain `$group` can't work on a stream, because the stream never ends. When would it "finish" so it could output a total?

**Windows** solve this. A window cuts the endless stream into time slices, runs a small pipeline on each slice, and outputs the result when the slice closes.

> **Think of it like this:** A window is like a shop's hourly sales report. Every hour, the cashier closes the hour, adds up what was sold in it, writes down the total, and starts a fresh hour.

There are three window types:

| Window | How the slices look | Example |
| --- | --- | --- |
| `$tumblingWindow` | Fixed, back-to-back, non-overlapping | Sales per minute |
| `$hoppingWindow` | Fixed size, overlapping (e.g. 5 min, starting every 1 min) | Rolling 5-minute average |
| `$sessionWindow` | Grows while events keep coming, closes after a gap | One user's browsing session |

Let's compute the average and maximum power per device, every 10 seconds:

```javascript
sp.process([
  {
    $source: {
      connectionName: "sample_stream_solar",
      timeField: { $dateFromString: { dateString: "$timestamp" } }  // use the event's own time
    }
  },
  {
    $tumblingWindow: {
      interval: { size: NumberInt(10), unit: "second" },
      pipeline: [
        {
          $group: {
            _id: "$device_id",
            avg_watts: { $avg: "$obs.watts" },
            max_watts: { $max: "$obs.watts" },
            readings: { $sum: 1 }
          }
        }
      ]
    }
  }
])
```

Every 10 seconds you see one summary per device:

```javascript
// → { _id: 'device_1', avg_watts: 171.4, max_watts: 189, readings: 10 }
// → { _id: 'device_2', avg_watts: 96.2, max_watts: 140, readings: 10 }
// ...
```

A few details worth knowing:

- `timeField` tells the processor which field holds the **event time**. Without it, Atlas uses the time attached to the message.
- Each processor can have **only one** window stage.
- Events that arrive a little late (by default up to **3 seconds**) still count in their window. You can change this with `allowedLateness`.

## Step 4: save results with $merge

So far, results only print to the terminal. To store them, end the pipeline with `$merge`. In stream processing, `$merge` names a **connection** from the registry plus a database and collection:

```javascript
{
  $merge: {
    into: { connectionName: "mongodb1", db: "solar_db", coll: "device_stats" }
  }
}
```

The result documents appear in `solar_db.device_stats` on your cluster, and your app can query them like any other collection.

## Step 5: create a long-running stream processor

`sp.process()` is only for experiments. For real work, create a **named** processor that runs until you stop it. It survives restarts because Atlas saves **checkpoints** (bookmarks of how far it got).

First, define the pipeline in a variable:

```javascript
let solarPipeline = [
  {
    $source: {
      connectionName: "sample_stream_solar",
      timeField: { $dateFromString: { dateString: "$timestamp" } }
    }
  },
  {
    $validate: {
      validator: {
        $jsonSchema: {
          required: ["device_id", "obs"],
          properties: { device_id: { bsonType: "string" } }
        }
      },
      validationAction: "dlq"     // send bad events to the dead letter queue
    }
  },
  {
    $tumblingWindow: {
      interval: { size: NumberInt(1), unit: "minute" },
      pipeline: [
        {
          $group: {
            _id: { device_id: "$device_id", windowStart: { $meta: "stream.window.start" } },
            avg_watts: { $avg: "$obs.watts" },
            max_temp: { $max: "$obs.temp" }
          }
        }
      ]
    }
  },
  { $merge: { into: { connectionName: "mongodb1", db: "solar_db", coll: "device_minute_stats" } } }
]
```

The `$validate` stage checks each event. With `validationAction: "dlq"`, events that fail are written to a **dead letter queue (DLQ)**, a collection where you can inspect them later instead of losing them silently.

Next, describe where the DLQ lives:

```javascript
let deadLetter = {
  dlq: { connectionName: "mongodb1", db: "solar_db", coll: "dlq" }
}
```

Now create and start the processor:

```javascript
sp.createStreamProcessor("solarStats", solarPipeline, deadLetter)

sp.solarStats.start()
// → { ok: 1 }
```

That's it. It now runs in Atlas around the clock, writing one document per device per minute.

### Managing processors

These are the everyday commands:

```javascript
sp.listStreamProcessors()                 // all processors and their state
sp.listStreamProcessors({ state: "running" })

sp.solarStats.sample()                    // peek at live output (Ctrl+C to stop)
sp.solarStats.stats()                     // counters: input, output, DLQ, state size
sp.solarStats.stop()                      // → { ok: 1 }
sp.solarStats.start()                     // resumes from the last checkpoint
sp.solarStats.drop()                      // delete it for good (stop it first)
```

A trimmed `stats()` output:

```javascript
{
  ok: 1,
  ns: 'myWorkspace',
  stats: {
    name: 'solarStats',
    status: 'running',
    inputMessageCount: Long('7204'),
    outputMessageCount: Long('120'),
    dlqMessageCount: Long('0'),
    ...
  }
}
```

> **Tip:** Keep an eye on `dlqMessageCount`. If it keeps growing, your source is sending events in a shape you didn't expect. Look in the `solar_db.dlq` collection to see what went wrong.

> **Note:** To change a processor's pipeline, stop it and use `sp.solarStats.modify(newPipeline)`. Some changes (like changing the `$source` or the window size) need `{ resumeFromCheckpoint: false }`, which starts it fresh.

## A shop example: live revenue per minute

Let's use our own `shop` data. We'll read the **change stream** of `shop.orders` and keep a running "revenue per minute" collection that a live dashboard can read.

Add a connection called `shopCluster` to your registry pointing at your cluster. Then:

```javascript
sp.createStreamProcessor("revenuePerMinute", [
  // 1. Read every change on shop.orders
  { $source: { connectionName: "shopCluster", db: "shop", coll: "orders" } },

  // 2. Only new orders
  { $match: { operationType: "insert" } },

  // 3. Change events wrap the order in "fullDocument"; unwrap it
  { $replaceRoot: { newRoot: "$fullDocument" } },

  // 4. Add up totals per minute
  {
    $tumblingWindow: {
      interval: { size: NumberInt(1), unit: "minute" },
      pipeline: [
        {
          $group: {
            _id: { $meta: "stream.window.start" },
            revenue: { $sum: "$total" },
            orders: { $sum: 1 }
          }
        }
      ]
    }
  },

  // 5. Save to shop.revenue_per_minute
  { $merge: { into: { connectionName: "shopCluster", db: "shop", coll: "revenue_per_minute" } } }
])

sp.revenuePerMinute.start()
```

Now insert a couple of orders from a normal cluster connection:

```javascript
// connected to the cluster, not the workspace
use shop
db.orders.insertOne({ customerId: ObjectId(), items: [{ name: "Gel Pen", qty: 2, price: 15 }], total: 30, status: "pending", createdAt: new Date() })
db.orders.insertOne({ customerId: ObjectId(), items: [{ name: "Coffee Mug", qty: 1, price: 249 }], total: 249, status: "pending", createdAt: new Date() })
```

About a minute later:

```javascript
db.revenue_per_minute.find().sort({ _id: -1 }).limit(1)
// → [ { _id: ISODate('2026-10-25T08:15:00.000Z'), revenue: 279, orders: 2 } ]
```

Your dashboard reads one tiny document per minute instead of scanning the whole `orders` collection.

## Kafka in one paragraph

**Apache Kafka** is a popular system for moving streams of events between services. Many companies already publish events (payments, clicks, logs) to Kafka **topics**. Atlas Stream Processing can read from a topic with `$source: { connectionName: "myKafka", topic: "payments" }` and write to one with `$emit: { connectionName: "myKafka", topic: "big-payments" }`. The pipeline in the middle is the same as in the examples above.

## Common mistakes

- **Forgetting the sink.** A processor without `$merge` or `$emit` has nowhere to put results. Interactive `sp.process()` prints them, but saved processors need a sink.
- **Using `$group` without a window.** A stream never ends, so a plain `$group` never outputs. Put `$group` inside a window's `pipeline`.
- **Mixing up `sp` and `db`.** Stream commands run on the **workspace** connection. Queries on result collections run on the **cluster** connection.
- **No dead letter queue.** Bad events are dropped silently. Add a DLQ and a `$validate` stage so you can see and fix problems.
- **Leaving experiments running.** Running processors cost money. Use `sp.listStreamProcessors()` and stop or drop what you don't need.

## Practice

1. Write an `sp.process()` call that shows only solar readings where `obs.temp` is above 20, limited to 3 documents.
2. Change the shop example so it only counts orders with a `total` of at least 500.
3. Which command shows how many messages a processor named `revenuePerMinute` has sent to its DLQ?

<details>
<summary>Show a possible answer</summary>

```javascript
// 1.
sp.process(
  [
    { $source: { connectionName: "sample_stream_solar" } },
    { $match: { "obs.temp": { $gt: 20 } } }
  ],
  { limit: 3 }
)

// 2. Add a filter after $replaceRoot
sp.revenuePerMinute.stop()
sp.revenuePerMinute.modify([
  { $source: { connectionName: "shopCluster", db: "shop", coll: "orders" } },
  { $match: { operationType: "insert" } },
  { $replaceRoot: { newRoot: "$fullDocument" } },
  { $match: { total: { $gte: 500 } } },
  {
    $tumblingWindow: {
      interval: { size: NumberInt(1), unit: "minute" },
      pipeline: [
        { $group: { _id: { $meta: "stream.window.start" }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }
      ]
    }
  },
  { $merge: { into: { connectionName: "shopCluster", db: "shop", coll: "revenue_per_minute" } } }
])
sp.revenuePerMinute.start()

// 3. Look at dlqMessageCount in the output
sp.revenuePerMinute.stats()
```

</details>

## Key takeaways

- **Stream processing** runs a pipeline continuously on events as they arrive, instead of on stored documents.
- A stream processor is `$source` → pipeline → one sink (`$merge` to Atlas or `$emit` to Kafka), using named connections from the **connection registry**.
- Use **`sp.process()`** to prototype and **`sp.createStreamProcessor()`** plus `.start()` for long-running work.
- Group endless streams with **windows** (`$tumblingWindow`, `$hoppingWindow`, `$sessionWindow`).
- Add `$validate` and a **dead letter queue** so bad events are kept for inspection. The feature is **Atlas-only** and billed while processors run.

**Next lesson:** [MongoDB on Kubernetes with the Operator](/courses/mongodb/mongodb-on-kubernetes)
