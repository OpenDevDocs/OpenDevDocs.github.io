---
publishDate: 2026-10-14T09:40
title: 'Cosmos DB: Model, Partitioning and Consistency'
slug: cosmos-db-fundamentals
metadescription: Model data for Azure Cosmos DB, choose a partition key that will not fail at scale, and pick the right consistency level.
updateDate: 2026-09-07T09:40
author: ['bishal-biswas']
level: 3
tags: ['databases', 'cosmos db', 'nosql']
course: azure
---

## What it is

A globally distributed NoSQL database with guaranteed latency and throughput. You choose consistency, and it replicates to any region you enable.

```bash
az cosmosdb create \
  --name cosmos-shop --resource-group rg-shop-prod-uks \
  --locations regionName=uksouth failoverPriority=0 isZoneRedundant=true \
  --default-consistency-level Session \
  --enable-automatic-failover true

az cosmosdb sql database create \
  --account-name cosmos-shop --resource-group rg-shop-prod-uks --name shop

az cosmosdb sql container create \
  --account-name cosmos-shop --resource-group rg-shop-prod-uks \
  --database-name shop --name orders \
  --partition-key-path /customerId \
  --throughput 400
```

## APIs

```text
NoSQL (SQL API)   the native one. Best features, best tooling. Use this.
MongoDB           wire protocol compatible, for existing MongoDB applications
Cassandra         for existing Cassandra applications
Gremlin           graph
Table             compatible with Table Storage
```

The API is chosen at account creation and cannot be changed. Use NoSQL unless you are migrating something that speaks another protocol.

## The partition key decides everything

This is the most consequential decision in Cosmos DB, and **it cannot be changed after creation**. Getting it wrong means creating a new container and migrating.

```text
A good partition key
  has high cardinality, so there are many distinct values
  spreads reads and writes evenly
  appears in most of your queries
  keeps any single logical partition under 20 GB
```

```text
Good     /customerId, /tenantId, /deviceId
Bad      /country       few values, and one is far bigger than the rest
Bad      /status        a handful of values, and one holds most documents
Bad      /createdDate   all of today's writes hit one partition
```

**A hot partition throttles even when the account has plenty of throughput.** Request units are divided evenly across physical partitions, so one partition receiving most of the traffic hits its share of the limit while the rest sit idle.

That is the failure people meet in production, and it is invisible in testing with small data.

## Synthetic keys

When no single field works, combine fields.

```csharp
public class Order
{
    public string id { get; set; } = Guid.NewGuid().ToString();

    // synthetic partition key: enough cardinality, still queryable
    public string partitionKey => $"{TenantId}-{CustomerId}";

    public string TenantId { get; set; } = default!;
    public string CustomerId { get; set; } = default!;
    public decimal Total { get; set; }
    public string Status { get; set; } = default!;
}
```

Or add a bucket suffix when one value is genuinely too large:

```csharp
public string partitionKey => $"{DeviceId}-{DateTime.UtcNow:yyyyMM}";
```

That splits a busy device across monthly partitions, at the cost of needing a cross partition query to read its whole history.

## Model for the query, not for normalisation

Relational instincts produce bad Cosmos DB designs. Joins across containers do not exist.

```csharp
// embed what is read together
public class Order
{
    public string id { get; set; } = default!;
    public string customerId { get; set; } = default!;

    // embedded, because an order is always read with its lines
    public List<OrderLine> Lines { get; set; } = new();

    // denormalised, because the order view shows the customer name
    public string CustomerName { get; set; } = default!;

    public decimal Total { get; set; }
    public DateTimeOffset PlacedAt { get; set; }
}
```

```text
Embed when     the data is read together, is bounded, and changes together
Reference when the data is large, unbounded, or shared across many documents
```

An order with its lines: embed. A customer with every order they ever placed: reference, because it is unbounded.

Denormalised copies go stale, and the change feed is how you keep them consistent.

## Queries

```csharp
var query = new QueryDefinition(
    "SELECT * FROM c WHERE c.customerId = @customerId AND c.Status = @status")
    .WithParameter("@customerId", customerId)
    .WithParameter("@status", "Pending");

using var iterator = container.GetItemQueryIterator<Order>(
    query,
    requestOptions: new QueryRequestOptions
    {
        PartitionKey = new PartitionKey(customerId),
        MaxItemCount = 100
    });

while (iterator.HasMoreResults)
{
    var page = await iterator.ReadNextAsync();
    Console.WriteLine($"RU charge: {page.RequestCharge}");
    foreach (var order in page) { /* ... */ }
}
```

**Always set `PartitionKey` in the request options when you know it.** Without it the query fans out to every physical partition, costing many times more request units.

The single most useful habit: log `RequestCharge` during development. A query costing 200 RU instead of 3 is visible immediately, and invisible if you never look.

## Point reads are the cheapest operation

```csharp
var order = await container.ReadItemAsync<Order>(
    id: orderId,
    partitionKey: new PartitionKey(customerId));
```

A point read by id and partition key costs 1 RU for a 1 KB document. The equivalent query costs several times more.

Design so the common access path is a point read, which usually means the id is something you already know.

## Consistency levels

```text
Strong             linearisable. Highest cost, no multi region writes.
Bounded staleness  lags by at most N operations or T seconds.
Session            read your own writes within a session. THE DEFAULT, and right.
Consistent prefix  reads never see out of order writes.
Eventual           cheapest, fastest, weakest.
```

Session consistency is the right default and what most applications want: a user always sees their own writes, and may briefly see stale data written by someone else.

```csharp
var client = new CosmosClient(endpoint, credential, new CosmosClientOptions
{
    ConsistencyLevel = ConsistencyLevel.Session,
    ApplicationRegion = Regions.UKSouth,
    ConnectionMode = ConnectionMode.Direct
});
```

Reads at strong consistency cost twice the request units of eventual. Choosing strong "to be safe" doubles the bill for a guarantee most applications do not need.

## Global distribution

```bash
az cosmosdb update --name cosmos-shop --resource-group rg-shop-prod-uks \
  --locations regionName=uksouth failoverPriority=0 isZoneRedundant=true \
  --locations regionName=northeurope failoverPriority=1 isZoneRedundant=true

az cosmosdb update --name cosmos-shop --resource-group rg-shop-prod-uks \
  --enable-multiple-write-locations true
```

Adding a region is one command and takes minutes. `ApplicationRegion` in the client then routes reads to the nearest replica.

Multi region writes remove the cross region write latency and introduce conflicts, which are resolved last write wins by default or by a stored procedure you provide.

Each additional region multiplies the cost, since throughput is provisioned per region.

## The change feed

```csharp
var processor = container
    .GetChangeFeedProcessorBuilder<Order>("order-projections", HandleChangesAsync)
    .WithInstanceName(Environment.MachineName)
    .WithLeaseContainer(leaseContainer)
    .Build();

await processor.StartAsync();

async Task HandleChangesAsync(
    IReadOnlyCollection<Order> changes, CancellationToken token)
{
    foreach (var order in changes)
    {
        await _search.IndexAsync(order);
        await _projections.UpdateCustomerTotalsAsync(order);
    }
}
```

A persistent, ordered log of changes per partition. It is how denormalised copies stay in sync, how search indexes are updated, and how events reach other systems.

Note the change feed gives creates and updates, and deletes only if you use soft deletes with a time to live.

## Time to live

```bash
az cosmosdb sql container update \
  --account-name cosmos-shop --resource-group rg-shop-prod-uks \
  --database-name shop --name sessions --ttl 3600
```

Documents are deleted automatically after the time to live expires, using leftover throughput rather than provisioned request units.

For session state, caches and event data with a retention period, this removes the cleanup job entirely.

## Quick recap

- The API and the partition key are both fixed at creation, and the partition key is the decision that matters.
- A hot partition throttles even with plenty of throughput, because request units are split per partition.
- Model for how data is read, embedding what is read together and referencing what is unbounded.
- Always pass the partition key on a query, or it fans out to every partition.
- Log the request charge during development, since an expensive query is otherwise invisible.
- Point reads by id and partition key cost 1 RU, so design the common path around them.
- Session consistency is the right default, and strong consistency doubles read cost.

<code id="code-content" class="language-csharp">
// THE PARTITION KEY IS THE MOST CONSEQUENTIAL DECISION, AND IT CANNOT BE
// CHANGED. Getting it wrong means a new container and a migration.
//   good  /customerId, /tenantId, /deviceId
//   bad   /country (few values, uneven), /status (one holds everything),
//         /createdDate (all of today's writes hit ONE partition)
// A HOT PARTITION THROTTLES EVEN WITH PLENTY OF THROUGHPUT: request units
// are split EVENLY across physical partitions, so one busy partition hits
// its share while the rest sit idle. Invisible in testing with small data.
//
// SYNTHETIC KEYS when no single field works:
public string partitionKey =&gt; $"{TenantId}-{CustomerId}";
// Or a bucket suffix when one value is genuinely too large:
//   $"{DeviceId}-{DateTime.UtcNow:yyyyMM}"
//
// MODEL FOR THE QUERY, NOT FOR NORMALISATION. There are no joins.
//   EMBED     read together, bounded, changes together (order + its lines)
//   REFERENCE large, unbounded, or shared (a customer's entire history)
// Denormalised copies go stale, and the CHANGE FEED keeps them in sync.
//
// ALWAYS PASS THE PARTITION KEY, or the query FANS OUT to every physical
// partition and costs many times more.
using var iterator = container.GetItemQueryIterator&lt;Order&gt;(
    new QueryDefinition("SELECT * FROM c WHERE c.customerId = @id")
        .WithParameter("@id", customerId),
    requestOptions: new QueryRequestOptions
    {
        PartitionKey = new PartitionKey(customerId),
        MaxItemCount = 100
    });
while (iterator.HasMoreResults)
{
    var page = await iterator.ReadNextAsync();
    // THE SINGLE MOST USEFUL HABIT: log this during development. A query
    // costing 200 RU instead of 3 is obvious here and invisible otherwise.
    Console.WriteLine($"RU charge: {page.RequestCharge}");
}
//
// A POINT READ IS THE CHEAPEST OPERATION: 1 RU for a 1 KB document, where
// the equivalent query costs several times more. Design the common access
// path so it is a point read.
var order = await container.ReadItemAsync&lt;Order&gt;(orderId, new PartitionKey(customerId));
//
// CONSISTENCY. Session is the right default: a user always sees their own
// writes, and may briefly see stale data written by someone else.
// STRONG READS COST TWICE EVENTUAL. Choosing it "to be safe" doubles the
// bill for a guarantee most applications do not need.
var client = new CosmosClient(endpoint, credential, new CosmosClientOptions
{
    ConsistencyLevel = ConsistencyLevel.Session,
    ApplicationRegion = Regions.UKSouth,
    ConnectionMode = ConnectionMode.Direct
});
//
// THE CHANGE FEED is a persistent ordered log per partition: how projections
// stay in sync, how search indexes update, how events reach other systems.
// It gives creates and updates, and deletes only via soft delete with TTL.
var processor = container
    .GetChangeFeedProcessorBuilder&lt;Order&gt;("order-projections", HandleChangesAsync)
    .WithInstanceName(Environment.MachineName)
    .WithLeaseContainer(leaseContainer)
    .Build();
await processor.StartAsync();
//
// TIME TO LIVE deletes documents automatically using LEFTOVER throughput,
// not provisioned RUs. For sessions and caches it removes the cleanup job.
</code></pre>
