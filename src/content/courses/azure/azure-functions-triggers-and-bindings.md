---
publishDate: 2026-10-09T08:10
title: 'Azure Functions: Triggers and Bindings'
slug: azure-functions-triggers-and-bindings
metadescription: Write Azure Functions with the trigger and binding model, and understand what the platform does for you at each step.
updateDate: 2026-09-07T08:10
author: ['bishal-biswas']
level: 2
tags: ['compute', 'functions', 'serverless']
course: azure
---

## The model

A function is a piece of code with one trigger and any number of bindings.

```text
Trigger    what causes the function to run. Exactly one.
Input binding   data fetched before your code runs.
Output binding  data written after your code returns.
```

The point is that connection handling, polling, retries and serialisation are the platform's job, not yours.

```csharp
[Function("ProcessOrder")]
[BlobOutput("receipts/{id}.json")]
public static string Run(
    [QueueTrigger("orders")] Order order,
    [BlobInput("templates/receipt.json")] string template,
    FunctionContext context)
{
    var logger = context.GetLogger("ProcessOrder");
    logger.LogInformation("Processing order {Id}", order.Id);

    return BuildReceipt(order, template);
}
```

That reads a queue, reads a blob, and writes a blob, with no client objects and no connection code.

## The isolated worker model

```text
In process     the function ran inside the host process. RETIRED in November 2026.
Isolated worker  your code runs in its own process. The only model now.
```

In process support for .NET ended on 10 November 2026. Anything still on it needs migrating, and the changes are mechanical: `FunctionName` becomes `Function`, `ILogger` injection changes, and `HttpRequest` becomes `HttpRequestData`.

The isolated model is better anyway. You control the dependency injection container, the .NET version is independent of the host, and middleware works normally.

```csharp
var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();
builder.Services.AddApplicationInsightsTelemetryWorkerService();
builder.Services.AddSingleton<IOrderRepository, OrderRepository>();

builder.Build().Run();
```

## Triggers worth knowing

```csharp
// HTTP
[Function("GetOrder")]
public async Task<HttpResponseData> GetOrder(
    [HttpTrigger(AuthorizationLevel.Function, "get", Route = "orders/{id}")]
    HttpRequestData req,
    string id)
{
    var order = await _repository.GetAsync(id);
    var response = req.CreateResponse(HttpStatusCode.OK);
    await response.WriteAsJsonAsync(order);
    return response;
}

// Timer, using a CRON expression with SIX fields, seconds first
[Function("NightlyReconcile")]
public async Task Reconcile([TimerTrigger("0 0 2 * * *")] TimerInfo timer)
{
    await _reconciler.RunAsync();
}

// Service Bus
[Function("HandlePayment")]
public async Task Handle(
    [ServiceBusTrigger("payments", Connection = "ServiceBus")] PaymentMessage message)
{
    await _payments.ApplyAsync(message);
}

// Blob, using Event Grid rather than polling
[Function("ThumbnailImage")]
public async Task Thumbnail(
    [BlobTrigger("uploads/{name}", Source = BlobTriggerSource.EventGrid)] Stream image,
    string name)
{
    await _images.CreateThumbnailAsync(image, name);
}
```

**The timer CRON has six fields, not five.** Seconds come first. `0 0 2 * * *` is 2am daily; `0 2 * * *` interpreted as five fields would be wrong, and this catches everyone who knows Unix cron.

**Blob triggers should use Event Grid.** The default polling scanner can take minutes on a busy container and is not guaranteed for containers with many blobs. Event Grid delivers in seconds and scales properly.

## Connections use identity, not strings

```json
{
  "ServiceBus__fullyQualifiedNamespace": "sb-shop-prod.servicebus.windows.net",
  "Storage__blobServiceUri": "https://stshopprod.blob.core.windows.net",
  "Storage__queueServiceUri": "https://stshopprod.queue.core.windows.net"
}
```

Instead of `Connection` pointing at a connection string, point it at a prefix with these properties and the binding authenticates with the function app's managed identity.

No key in configuration, nothing to rotate. This is the pattern to use for anything new.

## Return values as output bindings

```csharp
public class OrderResult
{
    [QueueOutput("fulfilment")]
    public string? FulfilmentMessage { get; set; }

    [BlobOutput("receipts/{rand-guid}.json")]
    public string? Receipt { get; set; }

    public HttpResponseData? HttpResponse { get; set; }
}

[Function("PlaceOrder")]
public async Task<OrderResult> PlaceOrder(
    [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req)
{
    var order = await req.ReadFromJsonAsync<Order>();
    var response = req.CreateResponse(HttpStatusCode.Accepted);

    return new OrderResult
    {
        FulfilmentMessage = JsonSerializer.Serialize(order),
        Receipt = BuildReceipt(order),
        HttpResponse = response
    };
}
```

One function, one HTTP response, one queue message, one blob. Setting a property to null skips that output.

## Retries and poison messages

```json
{
  "version": "2.0",
  "extensions": {
    "serviceBus": {
      "maxConcurrentCalls": 16,
      "maxAutoLockRenewalDuration": "00:05:00"
    },
    "queues": {
      "maxDequeueCount": 5,
      "visibilityTimeout": "00:00:30",
      "batchSize": 16
    }
  }
}
```

Queue and Service Bus triggers retry automatically. After `maxDequeueCount` failures, a storage queue message moves to `<queue>-poison`, and a Service Bus message moves to the dead letter queue.

**Something must read the poison queue.** A message that fails five times and is then never looked at is silently lost work, and this is the most common oversight in function apps.

```csharp
[Function("HandlePoisonOrders")]
public async Task HandlePoison([QueueTrigger("orders-poison")] string message)
{
    _logger.LogError("Order permanently failed: {Message}", message);
    await _alerts.RaiseAsync("Order processing failure", message);
}
```

## Idempotency

At least once delivery is the guarantee, which means duplicates happen. A retried function must not charge a card twice.

```csharp
[Function("ChargeCustomer")]
public async Task Charge([ServiceBusTrigger("charges")] ChargeRequest request)
{
    if (await _store.HasProcessedAsync(request.IdempotencyKey))
    {
        _logger.LogInformation("Already processed {Key}", request.IdempotencyKey);
        return;
    }

    await _payments.ChargeAsync(request);
    await _store.MarkProcessedAsync(request.IdempotencyKey);
}
```

Design for duplicates from the start. Adding idempotency after a double charge is a much worse day.

## Durable Functions

For workflows that span calls or need to wait.

```csharp
[Function(nameof(OrderOrchestrator))]
public static async Task<string> RunOrchestrator(
    [OrchestrationTrigger] TaskOrchestrationContext context)
{
    var order = context.GetInput<Order>()!;

    await context.CallActivityAsync("ReserveStock", order);
    await context.CallActivityAsync("ChargeCard", order);

    // wait up to a day for an external confirmation
    using var cts = new CancellationTokenSource();
    var approval = context.WaitForExternalEvent<bool>("Approved");
    var timeout = context.CreateTimer(context.CurrentUtcDateTime.AddDays(1), cts.Token);

    if (approval == await Task.WhenAny(approval, timeout))
    {
        cts.Cancel();
        await context.CallActivityAsync("Ship", order);
        return "shipped";
    }

    await context.CallActivityAsync("Cancel", order);
    return "timed out";
}
```

The orchestrator's state is checkpointed, so it can wait for a day without holding a process open. It must be **deterministic**: no `DateTime.Now`, no `Guid.NewGuid()`, no direct IO, because it replays from history on each resume.

## Local development

```bash
func init ShopFunctions --worker-runtime dotnet-isolated
func new --name ProcessOrder --template "Queue trigger"
func start

az functionapp create \
  --name func-shop --resource-group rg-shop-prod-uks \
  --storage-account stshopfunc --runtime dotnet-isolated \
  --functions-version 4 --flexconsumption-location uksouth
```

`local.settings.json` holds development configuration and is not deployed. Azurite emulates storage locally, so queue and blob triggers work without touching Azure.

## Quick recap

- One trigger, any number of input and output bindings, with the plumbing handled for you.
- The in process .NET model was retired in November 2026, so use isolated worker.
- Timer CRON expressions have six fields, with seconds first.
- Use Event Grid as the blob trigger source, since polling is slow and not guaranteed.
- Point connections at an identity based prefix so no key lives in configuration.
- Something must read the poison queue, or failed work disappears silently.
- Delivery is at least once, so functions must be idempotent by design.

<code id="code-content" class="language-csharp">
// A function is ONE trigger plus any number of input and output bindings.
// Connection handling, polling, retries and serialisation are the
// platform's job, not yours.
[Function("ProcessOrder")]
[BlobOutput("receipts/{id}.json")]
public static string Run(
    [QueueTrigger("orders")] Order order,
    [BlobInput("templates/receipt.json")] string template)
    =&gt; BuildReceipt(order, template);
// Reads a queue, reads a blob, writes a blob. No client objects at all.
//
// THE IN PROCESS MODEL WAS RETIRED on 10 November 2026. Isolated worker is
// the only model now, and it is better: your own DI container, a .NET
// version independent of the host, and normal middleware.
var builder = FunctionsApplication.CreateBuilder(args);
builder.ConfigureFunctionsWebApplication();
builder.Services.AddSingleton&lt;IOrderRepository, OrderRepository&gt;();
builder.Build().Run();
//
// THE TIMER CRON HAS SIX FIELDS, SECONDS FIRST. This catches everyone who
// knows Unix cron. "0 0 2 * * *" is 2am daily.
[Function("NightlyReconcile")]
public async Task Reconcile([TimerTrigger("0 0 2 * * *")] TimerInfo timer)
    =&gt; await _reconciler.RunAsync();
//
// BLOB TRIGGERS SHOULD USE EVENT GRID. The default polling scanner takes
// minutes on a busy container and is not guaranteed for large ones.
[Function("ThumbnailImage")]
public async Task Thumbnail(
    [BlobTrigger("uploads/{name}", Source = BlobTriggerSource.EventGrid)] Stream image,
    string name) =&gt; await _images.CreateThumbnailAsync(image, name);
//
// CONNECTIONS SHOULD USE IDENTITY, NOT KEYS. Point Connection at a prefix
// with these settings and the binding uses the app's managed identity:
//   ServiceBus__fullyQualifiedNamespace = sb-shop-prod.servicebus.windows.net
//   Storage__blobServiceUri = https://stshopprod.blob.core.windows.net
// Nothing to store, nothing to rotate.
//
// RETRIES AND POISON MESSAGES. After maxDequeueCount failures a message
// goes to &lt;queue&gt;-poison, or to the Service Bus dead letter queue.
// SOMETHING MUST READ IT. A message that fails five times and is never
// looked at is silently lost work. The most common oversight here.
[Function("HandlePoisonOrders")]
public async Task HandlePoison([QueueTrigger("orders-poison")] string message)
{
    _logger.LogError("Order permanently failed: {Message}", message);
    await _alerts.RaiseAsync("Order processing failure", message);
}
//
// DELIVERY IS AT LEAST ONCE, SO DUPLICATES HAPPEN. Design for it from the
// start: adding idempotency after a double charge is a much worse day.
[Function("ChargeCustomer")]
public async Task Charge([ServiceBusTrigger("charges")] ChargeRequest request)
{
    if (await _store.HasProcessedAsync(request.IdempotencyKey)) return;
    await _payments.ChargeAsync(request);
    await _store.MarkProcessedAsync(request.IdempotencyKey);
}
//
// DURABLE FUNCTIONS for workflows that WAIT. State is checkpointed, so an
// orchestrator can wait a day without holding a process open.
// It MUST BE DETERMINISTIC: no DateTime.Now, no Guid.NewGuid(), no direct
// IO, because it REPLAYS FROM HISTORY on every resume.
</code></pre>
