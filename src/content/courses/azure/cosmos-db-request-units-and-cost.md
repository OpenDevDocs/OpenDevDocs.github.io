---
publishDate: 2026-10-15T09:45
title: 'Cosmos DB: Request Units, Indexing and Cost'
slug: cosmos-db-request-units-and-cost
metadescription: Understand Cosmos DB request units, choose between provisioned and serverless throughput, and stop paying for capacity you do not use.
updateDate: 2026-09-07T09:45
author: ['bishal-biswas']
level: 3
tags: ['databases', 'cosmos db', 'cost']
course: azure
---

## What a request unit is

A single currency for CPU, memory and IO. Every operation costs some number of request units, and you provision or consume them per second.

```text
Point read, 1 KB document        1 RU
Insert, 1 KB document            ~5 RU
Query hitting one partition      5 to 50 RU, depending
Query fanning out                tens to thousands
Delete                           ~5 RU
```

The point of the abstraction is that cost is predictable and measurable per operation, which is unusual and genuinely useful.

## Measure everything

```csharp
var response = await container.ReadItemAsync<Order>(id, new PartitionKey(customerId));
_logger.LogInformation("Read cost {RU} RU", response.RequestCharge);

var page = await iterator.ReadNextAsync();
_logger.LogInformation("Query cost {RU} RU for {Count} items",
    page.RequestCharge, page.Count);
```

Log the request charge in development and you will find expensive operations immediately. A query returning ten documents for 900 RU is fanning out, and the fix is usually the partition key or a missing index.

## Throughput models

```text
Standard provisioned  a fixed RU/s. You pay for it whether used or not.
Autoscale             scales between 10 percent and the maximum. Costs 1.5x the base rate.
Serverless            pay per request. No provisioning, lower limits.
```

```bash
# provisioned
az cosmosdb sql container throughput update \
  --account-name cosmos-shop --resource-group rg-shop-prod-uks \
  --database-name shop --name orders --throughput 1000

# autoscale
az cosmosdb sql container throughput update \
  --account-name cosmos-shop --resource-group rg-shop-prod-uks \
  --database-name shop --name orders --max-throughput 4000

# serverless is an account level choice at creation
az cosmosdb create --name cosmos-shop-dev --resource-group rg-shop-dev-uks \
  --capabilities EnableServerless --locations regionName=uksouth
```

## The autoscale arithmetic

Autoscale bills at 1.5 times the standard rate for the RU/s actually used, with a floor of 10 percent of the maximum.

```text
Autoscale max 4,000 RU/s
  minimum billed          400 RU/s, always
  at 4,000 RU/s sustained cost equals 6,000 RU/s provisioned
```

So autoscale is cheaper when usage varies and more expensive when it is steady.

```text
Steady load, predictable       standard provisioned
Variable load, unpredictable   autoscale
Peaks more than 3x the average autoscale, clearly
Development and intermittent   serverless
```

If a container runs near its maximum most of the time, switch to standard provisioned and save a third.

## Serverless

```text
No minimum charge, pay only for consumed RUs
Maximum 5,000 RU/s per container
Maximum 1 TB per container
Single region only
No SLA on throughput
```

Right for development, low traffic applications and spiky workloads with long idle periods. Wrong for anything needing multiple regions or sustained throughput.

Serverless is chosen at account creation and cannot be changed, so a development account and a production account are separate resources.

## Database or container throughput

```bash
# shared across every container in the database
az cosmosdb sql database throughput update \
  --account-name cosmos-shop --resource-group rg-shop-prod-uks \
  --name shop --throughput 1000

# dedicated to one container
az cosmosdb sql container throughput update \
  --account-name cosmos-shop --resource-group rg-shop-prod-uks \
  --database-name shop --name orders --throughput 1000
```

```text
Database level   shared, cheaper for many small containers, minimum 400 RU/s total
Container level  dedicated and predictable, minimum 400 RU/s EACH
```

Twenty containers at container level costs a minimum of 8,000 RU/s. The same twenty sharing database throughput can run on 400.

The trade off is that shared throughput means one busy container can starve the others, so keep anything performance sensitive on its own throughput.

## Throttling

```text
HTTP 429  Too Many Requests, with a retry after header
```

```csharp
var client = new CosmosClient(endpoint, credential, new CosmosClientOptions
{
    MaxRetryAttemptsOnRateLimitedRequests = 9,
    MaxRetryWaitTimeOnRateLimitedRequests = TimeSpan.FromSeconds(30)
});
```

The SDK retries 429 responses automatically, honouring the retry after header. Some throttling is normal and healthy, since it means you are using the capacity you bought.

Sustained throttling is not. Check whether it is a genuine capacity shortage or a hot partition:

```kusto
CDBPartitionKeyRUConsumption
| where TimeGenerated > ago(1h)
| summarize TotalRU = sum(RequestCharge) by PartitionKey
| top 10 by TotalRU desc
```

If one partition key dominates, more throughput will not help. That is a data model problem.

## Indexing costs writes

Every property is indexed by default, and every index costs request units on write.

```json
{
  "indexingMode": "consistent",
  "includedPaths": [
    { "path": "/customerId/?" },
    { "path": "/Status/?" },
    { "path": "/PlacedAt/?" }
  ],
  "excludedPaths": [
    { "path": "/*" },
    { "path": "/Lines/*" },
    { "path": "/_etag/?" }
  ],
  "compositeIndexes": [
    [
      { "path": "/customerId", "order": "ascending" },
      { "path": "/PlacedAt", "order": "descending" }
    ]
  ]
}
```

Excluding everything and including only what is queried can cut write costs substantially on documents with many properties or large nested arrays.

Composite indexes are needed for queries ordering by more than one field, and a query without the right composite index will fail rather than run slowly, which is at least clear.

## Bulk operations

```csharp
var client = new CosmosClient(endpoint, credential, new CosmosClientOptions
{
    AllowBulkExecution = true
});

var tasks = orders.Select(order =>
    container.CreateItemAsync(order, new PartitionKey(order.customerId)));

await Task.WhenAll(tasks);
```

Bulk mode groups operations by partition and sends them together, giving far better throughput per RU for imports and batch work.

## Reserved capacity

```text
One or three year commitment on RU/s, up to roughly 65 percent off
```

For a production account with steady throughput, this is the largest available saving and it takes one purchase. Check current consumption first, and commit to the baseline rather than the peak.

## Practical cost control

```bash
az cosmosdb sql container throughput show \
  --account-name cosmos-shop --resource-group rg-shop-prod-uks \
  --database-name shop --name orders \
  --query "resource.{Provisioned:throughput, AutoscaleMax:autoscaleSettings.maxThroughput}"

az monitor metrics list \
  --resource /subscriptions/.../databaseAccounts/cosmos-shop \
  --metric TotalRequestUnits NormalizedRUConsumption \
  --interval PT1H --output table
```

`NormalizedRUConsumption` is the metric that matters. It shows the busiest partition's utilisation as a percentage, so a value near 100 while total consumption looks low is exactly the hot partition signal.

```text
Checklist
  1. Log request charges, and fix the expensive operations first
  2. Exclude unqueried paths from the index
  3. Use point reads where possible
  4. Always pass the partition key
  5. Autoscale for variable load, provisioned for steady
  6. Serverless for development
  7. Time to live instead of cleanup jobs
  8. Reserved capacity once the baseline is known
```

The first item is worth more than the rest combined. Most Cosmos DB overspend is a query pattern, not a pricing choice.

## Quick recap

- A request unit is a single currency for CPU, memory and IO, so cost is measurable per operation.
- Log the request charge in development, since most overspend is a query pattern.
- Autoscale bills at 1.5x with a 10 percent floor, so it wins on variable load and loses on steady.
- Database level throughput is far cheaper for many small containers than per container throughput.
- Some throttling is healthy, and sustained throttling with one dominant partition is a data model problem.
- Everything is indexed by default, and excluding unqueried paths cuts write cost.
- `NormalizedRUConsumption` reveals a hot partition when total consumption looks fine.

<code id="code-content" class="language-bash">
# A REQUEST UNIT is one currency for CPU, memory and IO, so cost is
# measurable PER OPERATION, which is unusual and genuinely useful.
#   point read 1 KB      1 RU     insert 1 KB    ~5 RU
#   single partition query  5-50 RU  FANNED OUT query  tens to thousands
# LOG THE REQUEST CHARGE IN DEVELOPMENT. A query returning ten documents
# for 900 RU is fanning out, and you will never notice if you do not look.
#   response.RequestCharge   /   page.RequestCharge
# THROUGHPUT MODELS:
#   provisioned  fixed RU/s, paid for whether used or not
#   autoscale    scales 10% to max, billed at 1.5x the base rate
#   serverless   pay per request, 5,000 RU/s and 1 TB caps, single region
# THE AUTOSCALE ARITHMETIC. Max 4,000 RU/s means a 400 RU/s FLOOR always,
# and running AT 4,000 costs the same as 6,000 provisioned. So autoscale
# wins on VARIABLE load and loses on STEADY load.
az cosmosdb sql container throughput update --account-name cosmos-shop \
  --resource-group rg-shop-prod-uks --database-name shop --name orders \
  --max-throughput 4000
# DATABASE LEVEL THROUGHPUT IS FAR CHEAPER FOR MANY SMALL CONTAINERS:
# twenty containers at CONTAINER level cost a minimum of 8,000 RU/s. The
# same twenty SHARING database throughput can run on 400. The trade off is
# that one busy container can starve the others.
az cosmosdb sql database throughput update --account-name cosmos-shop \
  --resource-group rg-shop-prod-uks --name shop --throughput 1000
# THROTTLING (HTTP 429) IS RETRIED BY THE SDK automatically. SOME
# THROTTLING IS HEALTHY: it means you are using what you bought.
# SUSTAINED throttling: check whether it is capacity or a HOT PARTITION.
#   CDBPartitionKeyRUConsumption | summarize sum(RequestCharge) by PartitionKey
#   | top 10 by sum_RequestCharge desc
# If one key dominates, MORE THROUGHPUT WILL NOT HELP. It is a data model
# problem.
# EVERYTHING IS INDEXED BY DEFAULT and every index costs RUs ON WRITE.
# Exclude /* and include only what you query. On documents with large
# nested arrays this cuts write cost substantially.
# NormalizedRUConsumption IS THE METRIC THAT MATTERS: it shows the BUSIEST
# PARTITION's utilisation, so near 100 while totals look low is exactly the
# hot partition signal.
az monitor metrics list --resource /subscriptions/.../databaseAccounts/cosmos-shop \
  --metric TotalRequestUnits NormalizedRUConsumption --interval PT1H -o table
# CHECKLIST, in order of value:
#   1. log request charges and fix expensive operations   &lt;- worth more than
#   2. exclude unqueried paths from the index                all the rest
#   3. point reads where possible                            combined
#   4. always pass the partition key
#   5. autoscale for variable, provisioned for steady
#   6. serverless for development
#   7. TTL instead of cleanup jobs
#   8. reserved capacity on the BASELINE, not the peak (~65% off)
</code></pre>
