---
publishDate: 2026-10-16T10:10
title: Event Hubs and Streaming
slug: event-hubs-and-streaming
metadescription: Ingest high volume event streams with Azure Event Hubs, understand partitions and consumer groups, and process with checkpoints.
updateDate: 2026-09-07T10:10
author: ['bishal-biswas']
level: 3
tags: ['messaging', 'event hubs', 'streaming']
course: azure
---

## What it is

A streaming ingestion service. Millions of events per second, retained for a period, read by many consumers independently.

```text
Service Bus  a message is consumed and gone
Event Hubs   an event is APPENDED to a log and stays for the retention period
```

That difference is everything. Consumers hold a position in the log, can go back, and do not remove anything by reading.

```bash
az eventhubs namespace create \
  --name ehns-shop --resource-group rg-shop-prod-uks \
  --location uksouth --sku Standard --enable-auto-inflate true --maximum-throughput-units 10

az eventhubs eventhub create \
  --name telemetry --namespace-name ehns-shop --resource-group rg-shop-prod-uks \
  --partition-count 8 --retention-time-in-hours 72 \
  --cleanup-policy Delete
```

## Partitions decide parallelism

```text
Partition count is FIXED at creation on Basic and Standard.
Maximum parallel consumers in a group = partition count.
```

Eight partitions means at most eight consumer instances doing useful work. A ninth sits idle.

Choose the partition count from the maximum parallelism you will ever want, not from today's volume. Too few caps throughput permanently; too many adds overhead and makes ordering guarantees narrower.

```text
Low volume, few consumers    4
Typical                      8 to 16
High volume                  32 or more
```

Premium and Dedicated tiers allow increasing partition count, which is one more reason to consider them for anything long lived.

## Partition keys

```csharp
await using var producer = new EventHubProducerClient(
    "ehns-shop.servicebus.windows.net", "telemetry", new DefaultAzureCredential());

// keyed: all events for one device land in the same partition, in order
using var batch = await producer.CreateBatchAsync(
    new CreateBatchOptions { PartitionKey = deviceId });

foreach (var reading in readings)
{
    if (!batch.TryAdd(new EventData(JsonSerializer.SerializeToUtf8Bytes(reading))))
    {
        await producer.SendAsync(batch);
        break;
    }
}

await producer.SendAsync(batch);
```

**Ordering is guaranteed within a partition, not across the hub.** A partition key routes related events together so they stay in order.

Without a key, events are distributed round robin, giving even load and no ordering.

Choose the key as carefully as a Cosmos DB partition key: high cardinality, evenly distributed. A key with three values wastes eight partitions.

## Consumer groups

```bash
az eventhubs eventhub consumer-group create \
  --name analytics --eventhub-name telemetry \
  --namespace-name ehns-shop --resource-group rg-shop-prod-uks

az eventhubs eventhub consumer-group create \
  --name alerting --eventhub-name telemetry \
  --namespace-name ehns-shop --resource-group rg-shop-prod-uks
```

Each consumer group has its own independent position in the stream. Analytics can be an hour behind while alerting is real time, reading exactly the same events.

That is the core value: one ingestion path, many independent readers, no duplication of the data.

Standard tier allows 20 consumer groups per hub, which is more than most designs need.

## Processing with checkpoints

```csharp
var storageClient = new BlobContainerClient(
    new Uri("https://stshopevents.blob.core.windows.net/checkpoints"),
    new DefaultAzureCredential());

var processor = new EventProcessorClient(
    storageClient,
    consumerGroup: "analytics",
    fullyQualifiedNamespace: "ehns-shop.servicebus.windows.net",
    eventHubName: "telemetry",
    credential: new DefaultAzureCredential());

processor.ProcessEventAsync += async args =>
{
    await _analytics.IngestAsync(args.Data.EventBody.ToArray());

    // checkpoint periodically, NOT per event
    if (args.Data.SequenceNumber % 100 == 0)
    {
        await args.UpdateCheckpointAsync(args.CancellationToken);
    }
};

processor.ProcessErrorAsync += args =>
{
    _logger.LogError(args.Exception, "Partition {Partition}", args.PartitionId);
    return Task.CompletedTask;
};

await processor.StartProcessingAsync();
```

A checkpoint records how far a consumer group has read in each partition, stored in a blob container.

**Checkpoint periodically, not per event.** Every checkpoint is a blob write, and doing it per event makes the storage account the bottleneck rather than Event Hubs.

The cost of infrequent checkpointing is reprocessing after a restart, so the interval is a trade between duplicate work and write volume. Every hundred events or every thirty seconds is a reasonable starting point.

The processor also distributes partitions across instances automatically. Start a second instance and partitions rebalance between them.

## Throughput units

```text
1 throughput unit = 1 MB/s in, 2 MB/s out, 1,000 events/s in
```

```bash
az eventhubs namespace update \
  --name ehns-shop --resource-group rg-shop-prod-uks \
  --enable-auto-inflate true --maximum-throughput-units 20
```

Auto inflate raises throughput units automatically under load. It does not lower them, so a spike leaves you paying for the higher level until someone reduces it.

Exceeding the limit produces throttling, visible as `ServerBusy` errors. The SDK retries, and sustained throttling means more units are needed.

Premium and Dedicated tiers use processing units and capacity units instead, with better isolation and no noisy neighbour effects.

## Event Hubs Capture

```bash
az eventhubs eventhub update \
  --name telemetry --namespace-name ehns-shop --resource-group rg-shop-prod-uks \
  --enable-capture true \
  --capture-interval 300 --capture-size-limit 314572800 \
  --destination-name EventHubArchive.AzureBlockBlob \
  --storage-account /subscriptions/.../storageAccounts/stshoplake \
  --blob-container raw \
  --archive-name-format 'telemetry/{Namespace}/{EventHub}/{PartitionId}/{Year}/{Month}/{Day}/{Hour}{Minute}{Second}'
```

Capture writes the stream to Blob Storage or Data Lake automatically, in Avro format, with no consumer to write or run.

It is the simplest path from a stream to a data lake, and the archive path format gives the partitioned layout analytics engines expect.

Note the retention period still applies to the hub itself. Capture is what preserves data beyond it.

## Kafka compatibility

```properties
bootstrap.servers=ehns-shop.servicebus.windows.net:9093
security.protocol=SASL_SSL
sasl.mechanism=OAUTHBEARER
```

Event Hubs speaks the Kafka protocol on Standard tier and above, so existing Kafka producers and consumers work by changing configuration.

Useful for migrating off self managed Kafka without rewriting applications. Not everything in the Kafka ecosystem is supported, so check specific features before committing.

## Event Hubs or the alternatives

```text
Event Hubs   high volume ingestion, replay, many independent consumers
Service Bus  individual work items with delivery guarantees
Event Grid   discrete notifications, pushed and filtered
```

Use Event Hubs when volume is high, consumers are several and independent, and replay matters. Telemetry, clickstreams, logs and IoT are the typical cases.

Do not use it as a work queue. There is no per message completion, no dead letter queue and no redelivery of a single event, so a poison event must be handled in your own code.

## Quick recap

- Events are appended to a log and stay for the retention period, so reading does not remove them.
- Partition count caps parallelism and is fixed at creation on Standard.
- Ordering is guaranteed within a partition, and a partition key is what keeps related events together.
- Consumer groups each hold their own position, so one stream serves many independent readers.
- Checkpoint periodically rather than per event, or blob writes become the bottleneck.
- Auto inflate raises throughput units and never lowers them.
- Capture writes the stream to a data lake with no consumer to run.

<code id="code-content" class="language-csharp">
// SERVICE BUS: a message is consumed and gone.
// EVENT HUBS: an event is APPENDED TO A LOG and stays for the retention
// period. Consumers hold a POSITION, can go back, and remove nothing.
//
// PARTITIONS DECIDE PARALLELISM, and the count is FIXED AT CREATION on
// Standard. Eight partitions means at most eight useful consumers; a ninth
// sits idle. Choose from the MAXIMUM PARALLELISM YOU WILL EVER WANT.
//   az eventhubs eventhub create --name telemetry --partition-count 8 \
//     --retention-time-in-hours 72
//
// ORDERING IS GUARANTEED WITHIN A PARTITION, NOT ACROSS THE HUB. A
// partition key routes related events together so they stay in order.
// Choose it like a Cosmos DB partition key: high cardinality, even spread.
// A key with three values wastes eight partitions.
using var batch = await producer.CreateBatchAsync(
    new CreateBatchOptions { PartitionKey = deviceId });
foreach (var reading in readings)
    if (!batch.TryAdd(new EventData(JsonSerializer.SerializeToUtf8Bytes(reading))))
        { await producer.SendAsync(batch); break; }
await producer.SendAsync(batch);
//
// CONSUMER GROUPS each hold their OWN position. Analytics can be an hour
// behind while alerting is real time, reading THE SAME EVENTS. That is the
// core value: one ingestion path, many independent readers, no duplication.
//
var processor = new EventProcessorClient(
    checkpointBlobContainer, consumerGroup: "analytics",
    "ehns-shop.servicebus.windows.net", "telemetry", new DefaultAzureCredential());
//
processor.ProcessEventAsync += async args =&gt;
{
    await _analytics.IngestAsync(args.Data.EventBody.ToArray());
//
    // CHECKPOINT PERIODICALLY, NOT PER EVENT. Every checkpoint is a BLOB
    // WRITE, and doing it per event makes storage the bottleneck rather
    // than Event Hubs. The cost of infrequent checkpoints is reprocessing
    // after a restart, so it is a trade. Every 100 events is a fair start.
    if (args.Data.SequenceNumber % 100 == 0)
        await args.UpdateCheckpointAsync(args.CancellationToken);
};
await processor.StartProcessingAsync();
// The processor also DISTRIBUTES PARTITIONS across instances automatically
// and rebalances when one starts or stops.
//
// THROUGHPUT UNITS: 1 TU = 1 MB/s in, 2 MB/s out, 1,000 events/s in.
// AUTO INFLATE RAISES THEM AND NEVER LOWERS THEM, so a spike leaves you
// paying the higher rate until someone reduces it. Exceeding the limit
// gives ServerBusy errors, which the SDK retries.
//
// CAPTURE writes the stream to Blob or Data Lake in Avro automatically,
// with NO CONSUMER TO WRITE OR RUN. The simplest path from stream to lake,
// and the archive path format gives the partitioned layout analytics wants.
//   --archive-name-format 'telemetry/{EventHub}/{PartitionId}/{Year}/{Month}/{Day}/...'
//
// KAFKA PROTOCOL is supported on Standard and above, so existing producers
// and consumers work by changing configuration. Not the whole ecosystem.
//
// DO NOT USE IT AS A WORK QUEUE. There is no per message completion, no
// dead letter queue and no redelivery of a single event, so a poison event
// must be handled in your own code.
</code></pre>
