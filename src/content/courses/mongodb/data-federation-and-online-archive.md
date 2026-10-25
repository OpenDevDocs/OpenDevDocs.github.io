---
title: Atlas Data Federation and Online Archive
slug: data-federation-and-online-archive
metadescription: Learn how Atlas Online Archive moves old data to cheap storage automatically, and how Data Federation lets you query clusters and S3 files with one query.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 4
tags: ['mongodb', 'atlas', 'data-federation', 'online-archive']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- Why old, rarely-read data is expensive to keep on a live cluster
- How **Online Archive** moves that data to cheap object storage automatically
- How to query live and archived data **together** with one connection string
- What a **federated database instance** is, and how it reads files in S3, Azure or Google Cloud Storage
- How to export collections to S3 as Parquet or JSON with `$out`

> **Before you start:** this lesson assumes you've read [MongoDB Atlas: Free Cluster Setup](/courses/mongodb/mongodb-atlas-setup), [Aggregation Performance with merge and out](/courses/mongodb/aggregation-performance) and [Multi-Region and Global Clusters](/courses/mongodb/multi-region-clusters).

> **Note:** Both features in this lesson are **Atlas-only**. There is no self-managed version. Online Archive needs a **dedicated** cluster (not the free M0 or Flex tiers). Data Federation is billed by how much data your queries read, so you can try it on small test files for very little cost.

## The problem: old data that nobody reads

Our shop has been running for five years. The `orders` collection has 40 million documents. But look at how it is used:

- The app reads orders from the **last 90 days** almost all the time.
- Orders older than a year are opened maybe once a month, for a refund or an audit.

Yet every old order still sits on the cluster's fast (and expensive) disks, makes indexes bigger, and makes backups slower.

> **Think of it like this:** Your wardrobe is full. You wear this season's clothes every day, but last decade's clothes still take up most of the space. You don't throw them away. You put them in labelled boxes in the attic. They are cheaper to store and you can still fetch them when needed.

Atlas offers two tools for this attic:

| Tool | What it does |
| --- | --- |
| **Online Archive** | Moves old documents from your cluster into Atlas-managed cloud storage on a schedule, and keeps them queryable. |
| **Data Federation** | Lets you query data in many places at once: Atlas clusters, archives, and files in S3, Azure Blob Storage, Google Cloud Storage or HTTP URLs. |

Online Archive is actually built on Data Federation, which is why they appear together.

## Online Archive

### How it works

1. You create an **archiving rule** for a collection, like "orders older than 365 days, based on `createdAt`".
2. On a schedule, Atlas finds documents that match the rule.
3. It copies them to cloud object storage, verifies the copy, and then **deletes them from the cluster**.
4. You can still query them, read-only, through a special connection string.

The cluster gets smaller and faster, and you pay a much lower storage price for the archived data.

### Prepare: index the date field

Atlas has to find matching documents efficiently on every run. Make sure the field used by the rule is indexed:

```javascript
use shop
db.orders.createIndex({ createdAt: 1 })
// → createdAt_1
```

### Create an archiving rule

You create the archive in the Atlas UI (or with the Atlas CLI or Admin API). In the UI:

1. Open your cluster and go to the **Online Archive** tab.
2. Click **Configure Online Archive**, then choose the `shop` database and the `orders` collection.
3. Pick a rule type:
   - **Date Match:** choose `createdAt` and an **Age Limit**, for example `365` days.
   - **Custom Criteria:** write a filter, for example `{ "status": "delivered", "total": { "$lt": 100 } }`.
4. Choose the **partition fields** (explained below).
5. Optionally set a **deletion age limit** so very old archived data is removed for good.
6. Choose a schedule (daily, weekly or monthly) and save.

> **Warning:** You can't switch an archive between Date Match and Custom Criteria later, and you can't change its **partition fields** after creating it. Think about both before you click save.

### Partition fields: how the attic boxes are labelled

Archived data is stored in files grouped by **partition fields**. When a query filters on a partition field, Atlas can open only the matching "boxes" instead of reading everything.

Pick the fields you filter on most when you look up old data. For orders, good choices might be:

- `createdAt` (added automatically for Date Match rules)
- `customerId` (because support staff look up old orders by customer)

A query like this on archived data is then cheap:

```javascript
db.orders.find({
  customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0"),
  createdAt: { $lt: ISODate("2025-01-01") }
})
```

A query that filters on a field that isn't a partition field still works, but has to scan much more archived data, which is slower and costs more.

### Querying live and archived data

After you create an archive, the cluster's **Connect** dialog offers three kinds of connection:

| Connection | Reads from | Use it for |
| --- | --- | --- |
| Normal cluster connection | Cluster only | Your app's everyday traffic |
| **Online Archive** | Archive only | Reports on old data without touching the cluster |
| **Cluster and Online Archive** | Both together (read-only) | "Show me all orders for this customer, ever" |

The federated connection string looks a little different from your normal one. In mongosh it works just like any other database:

```javascript
// Connected with the "Cluster and Online Archive" string
use shop
db.orders.countDocuments({ customerId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") })
// → 37   (12 recent orders on the cluster + 25 archived ones)
```

> **Note:** Archive connections are **read-only**. Your app keeps writing new orders through the normal cluster connection. Queries against archived data are slower than cluster queries, so use them for occasional lookups and reports, not for every page load.

### Things to watch out for

- **Don't update documents that are about to be archived.** Once a document matches the rule, it may move at any time. Make sure the rule only catches data that is truly finished, like delivered orders.
- **Keep `_id` values unique.** Online Archive uses `_id` (and the shard key on sharded clusters) to delete what it has archived.
- **Deleting an archive deletes its data.** A few days after you delete an archive, Atlas removes its files for good.

## Data Federation

Online Archive is one special case. **Atlas Data Federation** is the general tool: it lets you run normal MongoDB queries and aggregations on data that lives in many places.

> **Think of it like this:** Data Federation is a librarian who knows where every book is, whether it is on the main shelves, in the basement, or in a partner library across town. You ask one question, and the librarian collects the answer from all places.

### The federated database instance

You start by creating a **federated database instance** in Atlas (under **Data Federation** in the left menu). It doesn't store data itself. It holds a **storage configuration** that says:

- **Stores:** where the data lives (an S3 bucket, an Azure container, a GCS bucket, an Atlas cluster, an online archive, or HTTP URLs).
- **Databases and collections:** the *virtual* names you will query, and which store and path each one reads from.

Here is a small storage configuration. It maps a virtual `lake.orders_history` collection to JSON files in S3, and `lake.orders_live` to the real cluster collection:

```json
{
  "stores": [
    {
      "name": "shopS3",
      "provider": "s3",
      "region": "ap-south-1",
      "bucket": "shop-data-exports",
      "prefix": "orders/",
      "delimiter": "/"
    },
    {
      "name": "shopCluster",
      "provider": "atlas",
      "clusterName": "shop-cluster",
      "projectId": "<your-project-id>"
    }
  ],
  "databases": [
    {
      "name": "lake",
      "collections": [
        {
          "name": "orders_history",
          "dataSources": [{ "storeName": "shopS3", "path": "/{year int}/*" }]
        },
        {
          "name": "orders_live",
          "dataSources": [{ "storeName": "shopCluster", "database": "shop", "collection": "orders" }]
        }
      ]
    }
  ]
}
```

The path `/{year int}/*` is a neat trick. A file at `orders/2024/part-1.json` becomes documents with an extra field `year: 2024`. Queries that filter on `year` only open files in that folder.

> **Tip:** You don't have to write this JSON by hand. The Atlas UI has a visual editor where you drag stores onto virtual collections, and it writes the configuration for you.

### Querying files with MQL

Connect to the federated instance with its own connection string (from its **Connect** button). Then query files as if they were collections:

```javascript
use lake

db.orders_history.find({ year: 2024, status: "delivered" }).limit(2)
// → [ { _id: ..., year: 2024, status: 'delivered', total: 249, ... }, ... ]

db.orders_history.aggregate([
  { $match: { year: 2024 } },
  { $group: { _id: "$status", revenue: { $sum: "$total" } } }
])
// → [ { _id: 'delivered', revenue: 1840230 }, { _id: 'shipped', revenue: 120400 }, ... ]
```

Data Federation can read common file formats, including JSON, BSON, CSV, TSV, Parquet and Avro, compressed or not.

### Joining across sources

Because both virtual collections live in the same federated instance, you can combine live and historical data in one pipeline:

```javascript
db.orders_live.aggregate([
  { $match: { status: "delivered" } },
  { $project: { _id: 0, total: 1, createdAt: 1 } },
  { $unionWith: { coll: "orders_history", pipeline: [{ $project: { _id: 0, total: 1, createdAt: 1 } }] } },
  { $group: { _id: { $year: "$createdAt" }, revenue: { $sum: "$total" } } },
  { $sort: { _id: 1 } }
])
// → revenue per year, from the cluster and S3 together
```

### Exporting to S3 with $out

Data Federation also extends `$out` so it can **write files to cloud storage**. This is a popular way to feed data lakes and analytics tools.

Run this while connected to the federated instance:

```javascript
db.orders_live.aggregate([
  { $match: { createdAt: { $gte: ISODate("2025-01-01"), $lt: ISODate("2026-01-01") } } },
  {
    $out: {
      s3: {
        bucket: "shop-data-exports",
        region: "ap-south-1",
        filename: "orders/2025/",
        format: { name: "parquet", maxFileSize: "200MiB" }
      }
    }
  }
])
```

Because `filename` ends with a slash, the files are written as `orders/2025/1.parquet`, `orders/2025/2.parquet`, and so on. Supported output formats include `json`, `bson`, `csv`, `tsv` (each optionally `.gz`) and `parquet`.

> **Note:** For this to work, the federated instance needs **write** access to the S3 bucket (set up through an AWS IAM role in Atlas), and your database user needs the `atlasAdmin` role or a custom role with the `outToS3` privilege.

## Costs in plain words

Both tools trade **speed** for **lower storage cost**:

- **Cluster storage** is fast and the most expensive per GB.
- **Archived / object storage** is much cheaper per GB.
- **Federated queries** are charged mainly by how much data they **scan**, plus data transfer.

So the golden rule is: **make queries on archived and federated data scan as little as possible**. Filter on partition fields, use folder attributes like `{year int}`, and prefer compact formats like Parquet for large analytics files.

## Common mistakes

- **Archiving data the app still updates.** Archived data is read-only. Only archive documents that are finished, like delivered orders older than a year.
- **Choosing partition fields carelessly.** They can't be changed later. Pick the fields you actually filter on when looking up old data.
- **Pointing the app's main connection at the federated string.** It's read-only and slower. Keep app traffic on the normal cluster connection.
- **Queries without filters on federated data.** A query that scans every file is slow and costs money each time. Always filter on partition fields or path attributes.
- **Expecting these features locally.** Online Archive and Data Federation exist only in Atlas.

## Practice

1. Write the filter for a Custom Criteria archive rule that archives only `delivered` orders.
2. Using the federated connection, write an aggregation that counts archived 2023 orders per status from `lake.orders_history`.
3. Write a `$out` stage that exports `delivered` orders to S3 as gzipped JSON in a folder called `delivered/`.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Custom Criteria filter (entered in the Atlas UI)
{ "status": "delivered" }

// 2.
db.orders_history.aggregate([
  { $match: { year: 2023 } },
  { $group: { _id: "$status", count: { $sum: 1 } } }
])

// 3.
db.orders_live.aggregate([
  { $match: { status: "delivered" } },
  {
    $out: {
      s3: {
        bucket: "shop-data-exports",
        region: "ap-south-1",
        filename: "delivered/",
        format: { name: "json.gz" }
      }
    }
  }
])
```

</details>

## Key takeaways

- Old, rarely-read data makes clusters bigger, slower and more expensive.
- **Online Archive** moves matching documents to cheap storage on a schedule and keeps them queryable (read-only).
- Choose **partition fields** carefully: they decide how cheap archive queries are, and they can't be changed later.
- **Data Federation** lets you query Atlas clusters, archives and files in S3, Azure, GCS or HTTP with normal MQL, and even join them.
- `$out` to S3 exports data as Parquet, JSON, BSON, CSV or TSV. Both features are **Atlas-only** and charged by data scanned.

**Next lesson:** [Atlas Stream Processing](/courses/mongodb/atlas-stream-processing)
