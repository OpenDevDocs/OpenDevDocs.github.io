---
publishDate: 2026-10-12T09:05
title: Files, Queues and Tables
slug: files-queues-and-tables
metadescription: Use Azure Files for shared drives, Storage Queues for simple messaging, and Table Storage for cheap key value data.
updateDate: 2026-09-07T09:05
author: ['bishal-biswas']
level: 2
tags: ['storage', 'files', 'queues', 'tables']
course: azure
---

## Azure Files

An SMB or NFS share that machines mount like any network drive. It is what you reach for when an application expects a file path rather than an object store.

```bash
az storage share-rm create \
  --name shared --storage-account stshopprod \
  --resource-group rg-shop-prod-uks \
  --quota 1024 --enabled-protocols SMB
```

```bash
# Linux
sudo mount -t cifs //stshopprod.file.core.windows.net/shared /mnt/shared \
  -o vers=3.1.1,credentials=/etc/smbcredentials/stshopprod.cred,serverino

# Windows
net use Z: \\stshopprod.file.core.windows.net\shared /user:AZURE\stshopprod
```

**Port 445 is blocked by most internet providers and many corporate networks.** SMB shares that work in Azure and not from the office are almost always this. The fix is a VPN, ExpressRoute or a private endpoint, not a firewall rule on the share.

```text
Standard  HDD backed, transaction based pricing
Premium   SSD backed, provisioned capacity, low latency
```

Premium file shares are provisioned: you pay for the size you allocate, whether used or not, and get IOPS proportional to it.

## Identity based access to Files

```bash
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --enable-files-aadds true
```

Without this, mounting uses the storage account key as a password, which means every machine with the mount has full account access. Entra ID authentication for file shares fixes that, and supports NTFS permissions properly.

Worth the setup for anything beyond a scratch share.

## Azure File Sync

```bash
az storagesync create --name sync-shop --resource-group rg-shop-prod-uks --location uksouth
```

Keeps a Windows Server file share synchronised with Azure Files, with cloud tiering so rarely used files live only in Azure while appearing present locally.

The common use is replacing a file server without changing how anyone works.

## Storage Queues

Simple, cheap messaging. Not a full message broker.

```bash
az storage queue create --name orders --account-name stshopprod --auth-mode login

az storage message put --queue-name orders --account-name stshopprod \
  --content "order-1042" --auth-mode login

az storage message peek --queue-name orders --account-name stshopprod --auth-mode login
```

```csharp
var client = new QueueClient(
    new Uri("https://stshopprod.queue.core.windows.net/orders"),
    new DefaultAzureCredential());

await client.SendMessageAsync(JsonSerializer.Serialize(order));

QueueMessage[] messages = await client.ReceiveMessagesAsync(
    maxMessages: 16,
    visibilityTimeout: TimeSpan.FromMinutes(5));

foreach (var message in messages)
{
    await ProcessAsync(message.Body.ToString());
    await client.DeleteMessageAsync(message.MessageId, message.PopReceipt);
}
```

The model is important. Receiving a message makes it **invisible** for the visibility timeout rather than removing it. If your code crashes before deleting it, the message reappears and another worker picks it up.

That gives at least once delivery, so processing must be idempotent.

**Set the visibility timeout longer than the work takes.** Too short and a second worker starts the same message while the first is still going, which produces duplicate side effects that are confusing to diagnose.

```text
Message size    64 KB maximum
Queue size      up to the account limit, effectively unlimited
Retention       7 days default, 7 days maximum
Ordering        best effort, not guaranteed
```

For a message larger than 64 KB, put the payload in a blob and queue the reference.

## Poison messages

```csharp
if (message.DequeueCount > 5)
{
    await poisonQueue.SendMessageAsync(message.Body);
    await client.DeleteMessageAsync(message.MessageId, message.PopReceipt);
    _logger.LogError("Message failed {Count} times: {Id}", message.DequeueCount, message.MessageId);
    return;
}
```

`DequeueCount` tells you how many times a message has been picked up. Without this check, a message that always fails is retried forever, blocking nothing but wasting effort and filling logs.

Azure Functions does this automatically with a `-poison` queue. Hand written consumers must do it themselves.

## Table Storage

A NoSQL key value store. Cheap, fast for the access pattern it supports, and inflexible about everything else.

```csharp
var client = new TableClient(
    new Uri("https://stshopprod.table.core.windows.net"),
    "Orders",
    new DefaultAzureCredential());

await client.CreateIfNotExistsAsync();

var entity = new TableEntity("customer-42", "order-1042")
{
    ["Total"] = 129.99,
    ["Status"] = "Pending",
    ["PlacedAt"] = DateTimeOffset.UtcNow
};

await client.AddEntityAsync(entity);

// point read: the only genuinely fast query
var found = await client.GetEntityAsync<TableEntity>("customer-42", "order-1042");

// partition scan: acceptable
var pending = client.QueryAsync<TableEntity>(
    e => e.PartitionKey == "customer-42" && e.GetString("Status") == "Pending");
```

Every entity has a **PartitionKey** and a **RowKey**, and together they are the primary key.

```text
PartitionKey + RowKey   a point read. Fastest.
PartitionKey + filter   scans one partition. Acceptable.
Filter only             scans EVERYTHING. Slow and expensive.
```

The design work is choosing the partition key. Get it wrong and every query is a full scan.

```text
Good   customer id, tenant id, date bucket
Bad    a constant, since everything lands in one partition
Bad    a unique id per row, since no partition ever has more than one entity
```

There are no secondary indexes. The standard technique is to store the data more than once with different keys, which feels wrong coming from a relational background and is correct here.

## Table Storage or Cosmos DB

```text
Table Storage  cheap, simple, one region, no indexes
Cosmos DB      global distribution, guaranteed latency, rich indexing, more cost
```

Cosmos DB has a Table API that is compatible, so starting on Table Storage and moving later is possible with limited code change.

Start with Table Storage when the access pattern is genuinely key based and the budget matters. Move when you need global distribution or queries the key structure cannot answer.

## Choosing between all of these

```text
Azure Files      an application needs a file path, or a shared drive
Storage Queues   simple work queues, small messages, minimal cost
Table Storage    cheap key value data with a known access pattern
Blob Storage     anything object shaped, which is most things
Service Bus      when queues need ordering, sessions, topics or transactions
Cosmos DB        when tables need global distribution or real indexing
```

The storage account services are the simple, cheap options. They are frequently the right answer, and they run out of capability in predictable ways.

## Quick recap

- Azure Files needs port 445, which most providers block, and that is the usual mount failure.
- Enable identity based access to Files, or every mounted machine holds the account key.
- A received queue message becomes invisible rather than deleted, giving at least once delivery.
- Set the visibility timeout longer than the work takes, or two workers process one message.
- Check `DequeueCount` and move poison messages aside, since hand written consumers do not do it for you.
- Table Storage is fast only for point reads and partition scans, and has no secondary indexes.
- Duplicating data under different keys is the correct technique in Table Storage, not a mistake.

<code id="code-content" class="language-bash">
# AZURE FILES: an SMB or NFS share mounted like any network drive. What you
# reach for when an application expects a FILE PATH, not an object store.
az storage share-rm create --name shared --storage-account stshopprod \
  --resource-group rg-shop-prod-uks --quota 1024 --enabled-protocols SMB
sudo mount -t cifs //stshopprod.file.core.windows.net/shared /mnt/shared \
  -o vers=3.1.1,credentials=/etc/smbcredentials/stshopprod.cred,serverino
# PORT 445 IS BLOCKED by most internet providers and many corporate
# networks. A share that mounts in Azure and not from the office is almost
# always this. The fix is VPN, ExpressRoute or a private endpoint.
# Without identity based access, mounting uses the ACCOUNT KEY as a
# password, so every machine with the mount has FULL ACCOUNT ACCESS:
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --enable-files-aadds true
# STORAGE QUEUES. THE MODEL MATTERS: receiving makes a message INVISIBLE
# for the visibility timeout, not deleted. Crash before deleting and it
# REAPPEARS for another worker. At least once delivery, so BE IDEMPOTENT.
az storage queue create --name orders --account-name stshopprod --auth-mode login
#   await client.SendMessageAsync(json);
#   var msgs = await client.ReceiveMessagesAsync(16, TimeSpan.FromMinutes(5));
#   ... process ... await client.DeleteMessageAsync(id, popReceipt);
# SET THE VISIBILITY TIMEOUT LONGER THAN THE WORK TAKES, or a second worker
# starts the same message while the first is still running.
#   64 KB max message (put big payloads in a blob, queue the reference)
#   7 day retention max | ordering is BEST EFFORT, not guaranteed
# POISON MESSAGES: check DequeueCount yourself. Functions does this
# automatically with a -poison queue; hand written consumers do not.
#   if (message.DequeueCount &gt; 5) { move aside; delete; log; return; }
# TABLE STORAGE: PartitionKey + RowKey are the primary key, and the ONLY
# fast access path.
#   PartitionKey + RowKey   point read. Fastest.
#   PartitionKey + filter   scans ONE partition. Acceptable.
#   filter only             SCANS EVERYTHING. Slow and expensive.
# The whole design is CHOOSING THE PARTITION KEY. A constant puts
# everything in one partition; a unique id per row gives partitions of one.
# THERE ARE NO SECONDARY INDEXES. Storing the data TWICE under different
# keys is the correct technique here, not a mistake.
# CHOOSING:
#   Files    an app needs a file path      Queues   simple small work items
#   Tables   key based, budget matters     Blobs    anything object shaped
#   Service Bus  ordering, sessions, topics, transactions
#   Cosmos DB    global distribution or real indexing
</code></pre>
