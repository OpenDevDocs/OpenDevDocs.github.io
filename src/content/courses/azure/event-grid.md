---
publishDate: 2026-10-16T10:05
title: Event Grid
slug: event-grid
metadescription: React to events across Azure with Event Grid, filter what each handler receives, and handle delivery failures properly.
updateDate: 2026-09-07T10:05
author: ['bishal-biswas']
level: 2
tags: ['messaging', 'event grid', 'events']
course: azure
---

## The model

Event Grid delivers notifications. Something happened, and anyone interested is told.

```text
Publisher    Azure services, or your own application
Topic        where events are published
Subscription who receives them, with filters
Handler      a function, a webhook, a queue, an event hub
```

The difference from Service Bus: Event Grid **pushes** to handlers, and Service Bus is **pulled** by consumers. Event Grid is for reactive notification, Service Bus for work that must be done.

## System topics

Most Azure services publish events with no setup beyond a subscription.

```bash
az eventgrid system-topic create \
  --name st-stshopprod --resource-group rg-shop-prod-uks \
  --location uksouth \
  --source /subscriptions/.../storageAccounts/stshopprod \
  --topic-type Microsoft.Storage.StorageAccounts

az eventgrid system-topic event-subscription create \
  --name thumbnail-on-upload \
  --system-topic-name st-stshopprod --resource-group rg-shop-prod-uks \
  --endpoint /subscriptions/.../functions/ThumbnailImage \
  --endpoint-type azurefunction \
  --included-event-types Microsoft.Storage.BlobCreated \
  --subject-begins-with /blobServices/default/containers/uploads/ \
  --subject-ends-with .jpg
```

That is a thumbnail generator triggered by uploads, with no polling and no scanner.

```text
Blob created or deleted
Resource created, updated or deleted
Key Vault secret near expiry
Container image pushed
Virtual machine state changed
Media job finished
```

The Key Vault expiry event is genuinely useful: a certificate approaching expiry raises an event, so renewal is automated rather than remembered.

## Custom topics

```bash
az eventgrid topic create \
  --name egt-shop --resource-group rg-shop-prod-uks --location uksouth

ENDPOINT=$(az eventgrid topic show --name egt-shop \
  --resource-group rg-shop-prod-uks --query endpoint -o tsv)
```

```csharp
var client = new EventGridPublisherClient(
    new Uri(endpoint), new DefaultAzureCredential());

await client.SendEventAsync(new EventGridEvent(
    subject: $"orders/{order.Id}",
    eventType: "Shop.OrderPlaced",
    dataVersion: "1.0",
    data: new { order.Id, order.CustomerId, order.Total }));
```

**The subject is what filtering uses**, so make it hierarchical and meaningful. `orders/1042` allows a subscription filtered to `orders/`, while a subject of `event` allows nothing useful.

## Filtering

```bash
# by event type and subject
az eventgrid event-subscription create \
  --name high-value-orders --source-resource-id "$TOPIC_ID" \
  --endpoint "$FUNCTION_ID" --endpoint-type azurefunction \
  --included-event-types Shop.OrderPlaced \
  --subject-begins-with orders/

# advanced filters look inside the payload
az eventgrid event-subscription create \
  --name big-orders --source-resource-id "$TOPIC_ID" \
  --endpoint "$FUNCTION_ID" --endpoint-type azurefunction \
  --advanced-filter data.total NumberGreaterThan 1000 \
  --advanced-filter data.country StringIn GB IE
```

Filtering at the subscription means a handler is not invoked at all for events it does not care about. That is cheaper and simpler than filtering inside the handler.

Advanced filters have limits, currently 25 per subscription with a maximum of 5 values each, so keep them simple.

## Delivery and retries

```text
At least once delivery, so duplicates happen
Exponential backoff retry for up to 24 hours by default
2xx from the handler means success
4xx or 5xx means retry, except a few that dead letter immediately
Order is NOT guaranteed
```

**Handlers must be idempotent.** The same event arriving twice must not produce two side effects.

```csharp
[Function("HandleOrderPlaced")]
public async Task Run([EventGridTrigger] CloudEvent cloudEvent)
{
    // the event id is stable across retries
    if (await _store.HasHandledAsync(cloudEvent.Id))
    {
        return;
    }

    var order = cloudEvent.Data!.ToObjectFromJson<OrderPlaced>();
    await _fulfilment.StartAsync(order);
    await _store.MarkHandledAsync(cloudEvent.Id);
}
```

## Dead lettering

```bash
az eventgrid event-subscription update \
  --name high-value-orders --source-resource-id "$TOPIC_ID" \
  --deadletter-endpoint /subscriptions/.../storageAccounts/stshopevents/blobServices/default/containers/deadletter \
  --max-delivery-attempts 10 \
  --event-ttl 1440
```

Without a dead letter destination, an event that cannot be delivered after all retries is **discarded silently**. Configure it on every subscription, and check the container.

## Handler types

```text
Azure Function     the usual choice, with the EventGridTrigger binding
Webhook            any HTTPS endpoint, with a validation handshake
Storage Queue      buffers events for pull based processing
Service Bus        for work that needs Service Bus guarantees
Event Hubs         for high volume onward streaming
Relay Hybrid Connection  reaching something on premises
```

Sending Event Grid events into a Service Bus queue is a useful pattern: reactive delivery from Azure, with Service Bus semantics for processing.

## Webhook validation

A webhook subscription is not created until the endpoint proves it wants the events.

```csharp
app.MapPost("/events", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync();
    var events = EventGridEvent.ParseMany(BinaryData.FromString(json));

    foreach (var e in events)
    {
        if (e.EventType == "Microsoft.EventGrid.SubscriptionValidationEvent")
        {
            var data = e.Data.ToObjectFromJson<SubscriptionValidationEventData>();
            return Results.Ok(new { validationResponse = data.ValidationCode });
        }

        await HandleAsync(e);
    }

    return Results.Ok();
});
```

This handshake stops Event Grid being used to flood an arbitrary endpoint. Forgetting it is the usual reason a webhook subscription fails to create.

## Event Grid namespaces and MQTT

```bash
az eventgrid namespace create \
  --name egns-shop --resource-group rg-shop-prod-uks --location uksouth \
  --topic-spaces-configuration "{state:Enabled}"
```

Namespaces add MQTT broker capability for IoT devices and a pull delivery mode, where consumers fetch events rather than having them pushed.

Pull delivery suits consumers that cannot expose an endpoint, or that want to control their own pace.

## Event Grid or Service Bus or Event Hubs

```text
Event Grid   discrete events, reactive, push, filtered, cheap per event
Service Bus  work items, ordering, sessions, transactions, dead letters
Event Hubs   streams, millions per second, replayable, consumer controlled position
```

The distinction that matters: Event Grid tells you something happened, and Service Bus asks you to do something. An order placed event notifying three systems is Event Grid. The instruction to charge a card is Service Bus.

## Quick recap

- Event Grid pushes notifications, and Service Bus is pulled for work that must be done.
- System topics mean Azure services publish events with no setup beyond a subscription.
- Make the subject hierarchical, since it is what subscription filters use.
- Filtering at the subscription means the handler is not invoked at all for irrelevant events.
- Delivery is at least once and unordered, so handlers must be idempotent.
- Without a dead letter destination, undeliverable events are discarded silently.
- The webhook validation handshake is required, and missing it is why subscriptions fail to create.

<code id="code-content" class="language-bash">
# EVENT GRID PUSHES notifications to handlers. SERVICE BUS IS PULLED by
# consumers. Event Grid tells you SOMETHING HAPPENED; Service Bus asks you
# to DO SOMETHING. An order placed event notifying three systems is Event
# Grid. The instruction to charge a card is Service Bus.
# SYSTEM TOPICS: most Azure services publish events with no setup beyond a
# subscription. A thumbnail generator with no polling and no scanner:
az eventgrid system-topic event-subscription create --name thumbnail-on-upload \
  --system-topic-name st-stshopprod --resource-group rg-shop-prod-uks \
  --endpoint /subscriptions/.../functions/ThumbnailImage --endpoint-type azurefunction \
  --included-event-types Microsoft.Storage.BlobCreated \
  --subject-begins-with /blobServices/default/containers/uploads/ \
  --subject-ends-with .jpg
# The Key Vault "secret near expiry" event is genuinely useful: renewal
# becomes automated rather than remembered.
# THE SUBJECT IS WHAT FILTERING USES. Make it hierarchical and meaningful:
# "orders/1042" allows a subscription filtered to "orders/". A subject of
# "event" allows nothing useful.
# FILTER AT THE SUBSCRIPTION, so the handler is NOT INVOKED AT ALL for
# events it does not care about. Cheaper and simpler than filtering inside.
az eventgrid event-subscription create --name big-orders \
  --source-resource-id "$TOPIC_ID" --endpoint "$FUNCTION_ID" \
  --endpoint-type azurefunction --included-event-types Shop.OrderPlaced \
  --advanced-filter data.total NumberGreaterThan 1000 \
  --advanced-filter data.country StringIn GB IE
# DELIVERY IS AT LEAST ONCE AND UNORDERED, with exponential backoff for up
# to 24 hours. HANDLERS MUST BE IDEMPOTENT. The event id is stable across
# retries, so it is the natural deduplication key.
# WITHOUT A DEAD LETTER DESTINATION, AN UNDELIVERABLE EVENT IS DISCARDED
# SILENTLY. Configure it on EVERY subscription, and check the container.
az eventgrid event-subscription update --name high-value-orders \
  --source-resource-id "$TOPIC_ID" --max-delivery-attempts 10 --event-ttl 1440 \
  --deadletter-endpoint /subscriptions/.../containers/deadletter
# HANDLERS: Azure Function (usual), webhook, Storage Queue, Service Bus,
# Event Hubs, Relay for on premises. Sending Event Grid into a SERVICE BUS
# QUEUE is a useful pattern: reactive delivery, Service Bus processing.
# WEBHOOK VALIDATION IS REQUIRED. The subscription is not created until the
# endpoint echoes the validation code, which stops Event Grid being used to
# flood an arbitrary endpoint. Forgetting it is why subscriptions fail:
#   if (e.EventType == "Microsoft.EventGrid.SubscriptionValidationEvent")
#       return Results.Ok(new { validationResponse = data.ValidationCode });
# NAMESPACES add an MQTT broker for IoT and a PULL delivery mode, for
# consumers that cannot expose an endpoint or want their own pace.
az eventgrid namespace create --name egns-shop --resource-group rg-shop-prod-uks \
  --location uksouth --topic-spaces-configuration "{state:Enabled}"
</code></pre>
