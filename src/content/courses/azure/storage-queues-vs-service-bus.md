---
publishDate: 2026-10-17T10:15
title: Storage Queues versus Service Bus
slug: storage-queues-vs-service-bus
metadescription: Decide between Azure Storage Queues and Service Bus by comparing what each guarantees, what each costs, and where each runs out.
updateDate: 2026-09-07T10:15
author: ['bishal-biswas']
level: 2
tags: ['messaging', 'queues', 'decisions']
course: azure
---

## The short version

```text
Storage Queues  simple, very cheap, few features. Enough surprisingly often.
Service Bus     ordering, topics, sessions, transactions, dead letters, filters.
```

Start with Storage Queues when the requirement is "put work somewhere and process it later". Move to Service Bus when you need a guarantee it does not offer.

## Feature comparison

```text
                        Storage Queue    Service Bus
Message size            64 KB            256 KB Standard, 100 MB Premium
Queue size              up to 500 TB     1 GB to 80 GB
Retention               7 days maximum   unlimited, configurable
Ordering                best effort      FIFO with sessions
Dead letter queue       no, build it     yes, automatic
Topics and subscriptions no              yes
Duplicate detection     no               yes
Transactions            no               yes
Scheduled delivery      visibility delay yes, with cancellation
Push based receive      no, poll         yes, long polling and processor
Cost                    pennies          meaningfully more
```

The three that decide most cases: **dead letter queues, topics and ordering.**

## Cost

Storage Queues are among the cheapest services in Azure, billed per operation with no base charge. A queue processing a few million messages a month costs very little.

Service Bus Standard has a monthly base charge plus per operation cost. Premium is priced per messaging unit and is substantially more.

For a low volume application the difference is real but small. For very high volume, Storage Queues can be dramatically cheaper.

Cost alone rarely decides this. Missing features do.

## Where Storage Queues are enough

```text
Background work triggered by a web request
Image processing after upload
Sending emails
Simple retry of a failed operation
Decoupling a slow step from a request
```

If the work is independent, order does not matter, and one consumer type handles it, Storage Queues do the job.

```csharp
var client = new QueueClient(
    new Uri("https://stshopprod.queue.core.windows.net/thumbnails"),
    new DefaultAzureCredential());

await client.SendMessageAsync(JsonSerializer.Serialize(new { BlobName = name }));
```

You do have to build a little yourself:

```csharp
foreach (var message in await client.ReceiveMessagesAsync(16, TimeSpan.FromMinutes(5)))
{
    if (message.DequeueCount > 5)
    {
        await poisonQueue.SendMessageAsync(message.Body);
        await client.DeleteMessageAsync(message.MessageId, message.PopReceipt);
        _logger.LogError("Poison message after {Count} attempts", message.DequeueCount);
        continue;
    }

    try
    {
        await ProcessAsync(message.Body.ToString());
        await client.DeleteMessageAsync(message.MessageId, message.PopReceipt);
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "Retrying message {Id}", message.MessageId);
        // do nothing: it becomes visible again after the timeout
    }
}
```

That poison handling is what Service Bus gives you automatically. It is about twenty lines, and it is twenty lines you must remember on every consumer.

Azure Functions writes them for you with a `-poison` queue, which is why the Storage Queue plus Functions combination goes further than people expect.

## Where Service Bus earns its cost

**Several consumers need the same message.** Topics deliver a copy to each subscription. With Storage Queues you would write to several queues yourself and handle partial failure.

**Order matters.** Sessions guarantee ordered processing per session ID. Storage Queues are best effort, and under retry they are frequently out of order.

**Messages must not be lost silently.** Automatic dead lettering with a reason, plus alertable metrics.

**Filtering by content.** Subscription filters mean a consumer only receives what it wants, evaluated by the broker.

**Transactions.** Send and complete in one atomic operation, so a crash cannot leave a half done state.

**Scheduled delivery with cancellation.** Storage Queues can delay visibility but cannot cancel a scheduled message.

## The decision

```text
Do several different consumers need the same message?     Service Bus
Does order matter within a stream?                        Service Bus
Do you need a dead letter queue without writing one?      Service Bus
Do consumers need to filter by content?                   Service Bus
Are messages larger than 64 KB?                           Service Bus
Do you need transactional send and receive?               Service Bus
None of the above?                                        Storage Queue
```

## Migration is not hard

Both are queues with similar shapes, and the consumer logic is close enough that moving is a contained change.

```text
Storage Queue                Service Bus
SendMessageAsync             SendMessageAsync
ReceiveMessagesAsync         ProcessMessageAsync on a processor
DeleteMessageAsync           CompleteMessageAsync
visibility timeout           lock duration
DequeueCount check           automatic dead lettering
```

Because it is contained, starting with Storage Queues is a reasonable default. You are not committing to anything expensive to undo.

## Both are at least once

Neither gives exactly once delivery, whatever the marketing suggests.

```csharp
public async Task ProcessAsync(OrderMessage message)
{
    if (await _store.HasProcessedAsync(message.IdempotencyKey))
    {
        return;
    }

    await _handler.HandleAsync(message);
    await _store.MarkProcessedAsync(message.IdempotencyKey);
}
```

Duplicates happen in both, so handlers must be idempotent regardless of the choice. Service Bus duplicate detection reduces the window; it does not close it.

## A common hybrid

```text
Storage Queues  high volume, simple, internal work
Service Bus     business events, integration with other systems, anything
                needing ordering or several consumers
```

Nothing forces one choice. Using the cheap option for image resizing and the capable one for order processing is entirely sensible.

## Quick recap

- Storage Queues are very cheap and enough for independent, unordered background work.
- Service Bus earns its cost through topics, sessions, dead letters, filters and transactions.
- The features that decide most cases are dead letter queues, topics and ordering.
- With Storage Queues you write poison handling yourself, unless Functions writes it for you.
- Message size is 64 KB against 256 KB, and retention is 7 days against unlimited.
- Migration between them is a contained change, so starting simple is low risk.
- Both are at least once, so idempotent handlers are required either way.

<code id="code-content" class="language-csharp">
// THE SHORT VERSION:
//   Storage Queues  simple, very cheap, few features. Enough surprisingly often.
//   Service Bus     ordering, topics, sessions, transactions, dead letters.
//                          Storage Queue      Service Bus
//   message size            64 KB             256 KB (100 MB Premium)
//   retention               7 days MAX        unlimited
//   ordering                best effort       FIFO with sessions
//   dead letter queue       NO, build it      yes, automatic
//   topics / filters        no                yes
//   transactions            no                yes
//   cost                    pennies           meaningfully more
//
// THE THREE THAT DECIDE MOST CASES: dead letter queues, topics, ordering.
//
// WITH STORAGE QUEUES YOU WRITE THIS YOURSELF, on every consumer:
foreach (var message in await client.ReceiveMessagesAsync(16, TimeSpan.FromMinutes(5)))
{
    if (message.DequeueCount &gt; 5)
    {
        await poisonQueue.SendMessageAsync(message.Body);
        await client.DeleteMessageAsync(message.MessageId, message.PopReceipt);
        continue;
    }
    try
    {
        await ProcessAsync(message.Body.ToString());
        await client.DeleteMessageAsync(message.MessageId, message.PopReceipt);
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "Retrying {Id}", message.MessageId);
        // do nothing: it becomes visible again after the timeout
    }
}
// Azure Functions writes that for you with a -poison queue, which is why
// Storage Queues plus Functions goes further than people expect.
//
// THE DECISION:
//   several consumers need the SAME message?   -&gt; Service Bus (topics)
//   does ORDER matter within a stream?         -&gt; Service Bus (sessions)
//   want a dead letter queue for free?         -&gt; Service Bus
//   consumers filter BY CONTENT?               -&gt; Service Bus
//   messages over 64 KB?                       -&gt; Service Bus
//   transactional send and receive?            -&gt; Service Bus
//   none of the above?                         -&gt; Storage Queue
//
// MIGRATION IS A CONTAINED CHANGE, so starting simple is low risk:
//   SendMessageAsync      -&gt; SendMessageAsync
//   ReceiveMessagesAsync  -&gt; ProcessMessageAsync on a processor
//   DeleteMessageAsync    -&gt; CompleteMessageAsync
//   visibility timeout    -&gt; lock duration
//   DequeueCount check    -&gt; automatic dead lettering
//
// NEITHER GIVES EXACTLY ONCE, whatever the marketing suggests. Service Bus
// duplicate detection NARROWS the window, it does not close it.
public async Task ProcessAsync(OrderMessage message)
{
    if (await _store.HasProcessedAsync(message.IdempotencyKey)) return;
    await _handler.HandleAsync(message);
    await _store.MarkProcessedAsync(message.IdempotencyKey);
}
//
// A COMMON HYBRID, and entirely sensible: Storage Queues for high volume
// internal work like image resizing, Service Bus for business events and
// anything needing ordering or several consumers.
</code></pre>
