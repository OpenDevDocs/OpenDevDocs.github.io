---
publishDate: 2026-10-16T10:00
title: Service Bus Queues and Topics
slug: service-bus-queues-and-topics
metadescription: Use Azure Service Bus for reliable messaging with queues, topics, sessions and dead letter handling.
updateDate: 2026-09-07T10:00
author: ['bishal-biswas']
level: 2
tags: ['messaging', 'service bus', 'integration']
course: azure
---

## Queues and topics

```text
Queue   one message, one consumer. Competing consumers share the load.
Topic   one message, many subscriptions. Each subscriber gets a copy.
```

```bash
az servicebus namespace create \
  --name sb-shop-prod --resource-group rg-shop-prod-uks \
  --location uksouth --sku Standard

az servicebus queue create \
  --name orders --namespace-name sb-shop-prod --resource-group rg-shop-prod-uks \
  --max-delivery-count 5 \
  --lock-duration PT5M \
  --default-message-time-to-live P14D \
  --enable-dead-lettering-on-message-expiration true

az servicebus topic create \
  --name order-events --namespace-name sb-shop-prod --resource-group rg-shop-prod-uks

az servicebus topic subscription create \
  --name fulfilment --topic-name order-events \
  --namespace-name sb-shop-prod --resource-group rg-shop-prod-uks
```

```text
Basic     queues only, no topics. Rarely the right choice.
Standard  topics, sessions, shared throughput. Most workloads.
Premium   dedicated resources, predictable latency, vnet, larger messages, geo DR
```

## Sending and receiving

```csharp
builder.Services.AddSingleton(sp => new ServiceBusClient(
    "sb-shop-prod.servicebus.windows.net",
    new DefaultAzureCredential()));

var sender = client.CreateSender("orders");
await sender.SendMessageAsync(new ServiceBusMessage(JsonSerializer.Serialize(order))
{
    MessageId = order.Id,               // enables duplicate detection
    ContentType = "application/json",
    Subject = "OrderPlaced",
    CorrelationId = correlationId,
    ApplicationProperties = { ["tenantId"] = order.TenantId }
});
```

```csharp
var processor = client.CreateProcessor("orders", new ServiceBusProcessorOptions
{
    MaxConcurrentCalls = 10,
    AutoCompleteMessages = false,
    PrefetchCount = 20
});

processor.ProcessMessageAsync += async args =>
{
    try
    {
        var order = args.Message.Body.ToObjectFromJson<Order>();
        await _handler.HandleAsync(order, args.CancellationToken);
        await args.CompleteMessageAsync(args.Message);
    }
    catch (ValidationException ex)
    {
        // never going to succeed, so do not retry it
        await args.DeadLetterMessageAsync(args.Message, "ValidationFailed", ex.Message);
    }
    catch (Exception)
    {
        // transient: abandon so it is retried
        await args.AbandonMessageAsync(args.Message);
    }
};

processor.ProcessErrorAsync += args =>
{
    _logger.LogError(args.Exception, "Service Bus error in {Source}", args.ErrorSource);
    return Task.CompletedTask;
};

await processor.StartProcessingAsync();
```

`AutoCompleteMessages = false` is important. With it true, a message is completed even when your handler throws, which silently loses work.

## Peek lock

The default receive mode, and understanding it prevents most problems.

```text
1. The message is locked for the lock duration, invisible to others
2. Your handler runs
3. Complete    the message is removed
   Abandon     the lock is released and it is redelivered immediately
   Dead letter it moves aside for investigation
   Defer       it stays, retrievable only by sequence number
4. If the lock expires first, it is redelivered automatically
```

**Set the lock duration longer than the handler takes.** A five minute lock and a six minute handler means the message is redelivered while still being processed, and completing it then fails with a lock lost error.

For genuinely long work, renew the lock:

```csharp
processor = client.CreateProcessor("orders", new ServiceBusProcessorOptions
{
    MaxAutoLockRenewalDuration = TimeSpan.FromMinutes(30)
});
```

## Dead letter queue

Every queue and subscription has one, automatically.

```text
Messages arrive there when
  delivery count exceeds max-delivery-count
  the handler dead letters explicitly
  the message expires, if enabled
  a subscription filter evaluation fails
```

```csharp
var dlqReceiver = client.CreateReceiver("orders",
    new ServiceBusReceiverOptions { SubQueue = SubQueue.DeadLetter });

var messages = await dlqReceiver.ReceiveMessagesAsync(maxMessages: 50);
foreach (var message in messages)
{
    _logger.LogWarning("Dead lettered: {Reason} {Description}",
        message.DeadLetterReason, message.DeadLetterErrorDescription);
}
```

**Alert on dead letter queue depth.** A dead letter queue nobody watches is lost work that nobody knows about, and this is the most common operational gap with Service Bus.

```bash
az monitor metrics alert create \
  --name dlq-not-empty --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../namespaces/sb-shop-prod \
  --condition "total DeadletteredMessages > 0" \
  --window-size 15m --evaluation-frequency 5m \
  --action /subscriptions/.../actionGroups/ag-oncall
```

## Topic filters

```bash
# only high value orders
az servicebus topic subscription rule create \
  --name high-value --subscription-name fraud-check \
  --topic-name order-events --namespace-name sb-shop-prod \
  --resource-group rg-shop-prod-uks \
  --filter-sql-expression "total > 1000"

# by a custom property
az servicebus topic subscription rule create \
  --name uk-only --subscription-name uk-fulfilment \
  --topic-name order-events --namespace-name sb-shop-prod \
  --resource-group rg-shop-prod-uks \
  --filter-sql-expression "country = 'GB' AND messageType = 'OrderPlaced'"
```

Filters operate on **application properties and system properties, not the body.** Anything you want to filter on must be set as a property when sending.

Every new subscription starts with a default rule matching everything. Delete it when adding your own, or the subscription receives every message regardless of your filter.

Correlation filters are cheaper than SQL filters and cover most cases:

```bash
az servicebus topic subscription rule create \
  --name order-placed --subscription-name fulfilment \
  --topic-name order-events --namespace-name sb-shop-prod \
  --resource-group rg-shop-prod-uks \
  --correlation-id OrderPlaced
```

## Sessions for ordering

```bash
az servicebus queue create \
  --name orders --namespace-name sb-shop-prod --resource-group rg-shop-prod-uks \
  --enable-session true
```

```csharp
await sender.SendMessageAsync(new ServiceBusMessage(body)
{
    SessionId = order.CustomerId    // all messages for one customer are ordered
});

var sessionProcessor = client.CreateSessionProcessor("orders",
    new ServiceBusSessionProcessorOptions
    {
        MaxConcurrentSessions = 10,
        MaxConcurrentCallsPerSession = 1
    });
```

Sessions give ordered, exclusive processing per session ID. One consumer holds a session at a time, so messages within it are handled in order.

The cost is parallelism: a session is processed by one consumer, so a single hot session becomes a bottleneck. Choose the session ID with the same care as a partition key.

## Duplicate detection

```bash
az servicebus queue create \
  --name orders --namespace-name sb-shop-prod --resource-group rg-shop-prod-uks \
  --enable-duplicate-detection true \
  --duplicate-detection-history-time-window PT10M
```

Messages with the same `MessageId` within the window are discarded. It protects against a sender retrying after a timeout when the first send actually succeeded.

It is not a substitute for idempotent handlers, since the window is finite and delivery is still at least once.

## Scheduled and deferred messages

```csharp
// send later
var sequenceNumber = await sender.ScheduleMessageAsync(
    new ServiceBusMessage(body),
    DateTimeOffset.UtcNow.AddHours(24));

await sender.CancelScheduledMessageAsync(sequenceNumber);

// defer: keep it, but come back to it
await args.DeferMessageAsync(args.Message);
var deferred = await receiver.ReceiveDeferredMessageAsync(sequenceNumber);
```

Scheduled messages replace a timer table for delayed work like reminders. Deferral is for out of order arrivals, where you must wait for a prerequisite before processing.

Store the sequence number for a deferred message, since it is the only way to retrieve it.

## Service Bus or Event Grid or Event Hubs

```text
Service Bus  commands and work items. Ordering, transactions, dead letters.
Event Grid   reactive notifications. Something happened, tell whoever cares.
Event Hubs   high volume telemetry streams. Millions per second, replayable.
```

Service Bus is for work that must be done, with delivery guarantees and a dead letter path. It is the right default for business processes.

## Quick recap

- A queue delivers to one consumer, a topic delivers a copy to each subscription.
- Set `AutoCompleteMessages = false`, or a failing handler still completes the message.
- Make the lock duration longer than the handler takes, or renew it explicitly.
- Alert on dead letter depth, since an unwatched dead letter queue is invisible lost work.
- Topic filters see properties, not the body, and the default catch all rule must be deleted.
- Sessions give ordering per session ID at the cost of parallelism.
- Duplicate detection has a finite window and does not replace idempotent handlers.

<code id="code-content" class="language-csharp">
// QUEUE: one message, one consumer. TOPIC: one message, a copy per
// subscription. Standard tier gets topics and sessions; Premium gets
// dedicated resources, vnet and larger messages.
//
// AutoCompleteMessages = false IS IMPORTANT. With it true, a message is
// completed EVEN WHEN YOUR HANDLER THROWS, which silently loses work.
var processor = client.CreateProcessor("orders", new ServiceBusProcessorOptions
{
    MaxConcurrentCalls = 10,
    AutoCompleteMessages = false,
    MaxAutoLockRenewalDuration = TimeSpan.FromMinutes(30)
});
//
processor.ProcessMessageAsync += async args =&gt;
{
    try
    {
        await _handler.HandleAsync(args.Message.Body.ToObjectFromJson&lt;Order&gt;());
        await args.CompleteMessageAsync(args.Message);
    }
    catch (ValidationException ex)
    {
        // NEVER going to succeed, so do not retry it forever
        await args.DeadLetterMessageAsync(args.Message, "ValidationFailed", ex.Message);
    }
    catch (Exception)
    {
        await args.AbandonMessageAsync(args.Message);   // transient: retry
    }
};
//
// PEEK LOCK: the message is LOCKED, not removed. Complete removes it,
// Abandon redelivers immediately, DeadLetter moves it aside, Defer keeps it.
// IF THE LOCK EXPIRES FIRST IT IS REDELIVERED WHILE YOU ARE STILL WORKING,
// and completing then fails with "lock lost". Set the lock duration LONGER
// than the handler takes, or renew it as above.
//
// EVERY QUEUE AND SUBSCRIPTION HAS A DEAD LETTER QUEUE. ALERT ON ITS DEPTH:
// an unwatched dead letter queue is LOST WORK NOBODY KNOWS ABOUT, and it is
// the most common operational gap with Service Bus.
var dlq = client.CreateReceiver("orders",
    new ServiceBusReceiverOptions { SubQueue = SubQueue.DeadLetter });
//   message.DeadLetterReason, message.DeadLetterErrorDescription
//
// TOPIC FILTERS SEE PROPERTIES, NOT THE BODY. Set anything you filter on
// as an application property when sending.
await sender.SendMessageAsync(new ServiceBusMessage(body)
{
    MessageId = order.Id,             // enables duplicate detection
    Subject = "OrderPlaced",
    ApplicationProperties = { ["country"] = "GB" }
});
// EVERY NEW SUBSCRIPTION HAS A DEFAULT RULE MATCHING EVERYTHING. Delete it
// when adding your own, or the subscription receives everything anyway.
//
// SESSIONS give ordered, exclusive processing per SessionId. The cost is
// PARALLELISM: one consumer holds a session, so a hot session is a
// bottleneck. Choose the session ID as carefully as a partition key.
await sender.SendMessageAsync(new ServiceBusMessage(body)
{
    SessionId = order.CustomerId
});
//
// DUPLICATE DETECTION discards repeat MessageIds within a window, which
// protects against a sender retrying a send that actually succeeded. The
// window is FINITE, so it does NOT replace idempotent handlers.
//
// SCHEDULED messages replace a timer table for delayed work. Store the
// sequence number: it is the only way to cancel or retrieve.
var seq = await sender.ScheduleMessageAsync(msg, DateTimeOffset.UtcNow.AddHours(24));
//
// SERVICE BUS commands and work items, with guarantees and dead letters.
// EVENT GRID   reactive notifications: something happened, tell whoever cares.
// EVENT HUBS   high volume replayable telemetry streams.
</code></pre>
