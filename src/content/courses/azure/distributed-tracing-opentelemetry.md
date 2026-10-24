---
publishDate: 2026-10-26T12:40
title: Distributed Tracing and OpenTelemetry
slug: distributed-tracing-opentelemetry
metadescription: Trace a request across services with OpenTelemetry on Azure, and understand context propagation, spans and sampling.
updateDate: 2026-09-07T12:40
author: ['bishal-biswas']
level: 3
tags: ['observability', 'opentelemetry', 'tracing']
course: azure
---

## The problem

A request touches an API, a queue, a worker and a database. Something is slow. Logs from each service exist and nothing connects them.

Distributed tracing connects them: one trace ID follows the request through every service, and each operation is a span with a parent.

```text
Trace     the whole journey, one ID
Span      one operation within it, with a parent
Context   the trace and span IDs, propagated between services
```

## W3C Trace Context

The standard that makes this work across languages and vendors.

```http
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
             │  │                                │                │
             │  trace-id (32 hex)                span-id (16 hex) flags
             version
```

Every service reads this header, creates a child span, and passes an updated header onward. Azure services propagate it, and the .NET SDK handles it automatically.

That is why tracing generally works without effort, and why it breaks when something in the path strips headers.

## Setting it up

```bash
dotnet add package Azure.Monitor.OpenTelemetry.AspNetCore
```

```csharp
builder.Services.AddOpenTelemetry()
    .UseAzureMonitor(options =>
    {
        options.ConnectionString = builder.Configuration["ApplicationInsights:ConnectionString"];
        options.SamplingRatio = 0.2f;
    })
    .WithTracing(tracing =>
    {
        tracing
            .AddSource("Shop.Orders")
            .AddAspNetCoreInstrumentation(o =>
            {
                o.RecordException = true;
                o.Filter = context => !context.Request.Path.StartsWithSegments("/healthz");
            })
            .AddHttpClientInstrumentation()
            .AddSqlClientInstrumentation(o => o.SetDbStatementForText = true);
    })
    .WithMetrics(metrics =>
    {
        metrics
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddRuntimeInstrumentation()
            .AddMeter("Shop.Orders");
    });
```

The Azure Monitor distribution wires OpenTelemetry to Application Insights, so traces, metrics and logs all arrive in one place.

**Filter out health checks.** They are the highest volume and lowest value traces in any application, and excluding them cuts volume noticeably.

## Custom spans

```csharp
public class OrderService
{
    private static readonly ActivitySource Source = new("Shop.Orders", "1.0.0");

    public async Task<Order> PlaceAsync(Basket basket, CancellationToken token)
    {
        using var activity = Source.StartActivity("PlaceOrder");
        activity?.SetTag("order.item_count", basket.Items.Count);
        activity?.SetTag("order.currency", basket.Currency);
        activity?.SetTag("tenant.id", basket.TenantId);

        try
        {
            using (var reserve = Source.StartActivity("ReserveStock"))
            {
                reserve?.SetTag("stock.items", basket.Items.Count);
                await _stock.ReserveAsync(basket, token);
            }

            var order = await _repository.CreateAsync(basket, token);

            activity?.SetTag("order.id", order.Id);
            activity?.SetTag("order.total", (double)order.Total);
            activity?.SetStatus(ActivityStatusCode.Ok);

            return order;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.AddException(ex);
            throw;
        }
    }
}
```

`ActivitySource` is the .NET API, and it maps directly to OpenTelemetry tracers. The source name must be registered with `AddSource`, or the spans are created and never exported.

That is the most common reason custom spans do not appear.

## Semantic conventions

```csharp
activity?.SetTag("http.request.method", "POST");
activity?.SetTag("url.full", uri.ToString());
activity?.SetTag("server.address", host);
activity?.SetTag("db.system", "mssql");
activity?.SetTag("db.namespace", "shop");
activity?.SetTag("messaging.system", "servicebus");
activity?.SetTag("messaging.destination.name", "orders");
```

Standard attribute names mean any tracing backend understands them. Custom names work and lose the automatic visualisations and queries that the conventions enable.

Use the conventions for anything they cover, and your own names for genuinely domain specific attributes.

## Propagation across a queue

Automatic instrumentation covers HTTP. Messaging needs the context carried in the message.

```csharp
// sending
using var activity = Source.StartActivity("SendOrderMessage", ActivityKind.Producer);

var message = new ServiceBusMessage(JsonSerializer.Serialize(order));

if (activity is not null)
{
    message.ApplicationProperties["traceparent"] = activity.Id;
    if (activity.TraceStateString is not null)
    {
        message.ApplicationProperties["tracestate"] = activity.TraceStateString;
    }
}

await sender.SendMessageAsync(message);
```

```csharp
// receiving
processor.ProcessMessageAsync += async args =>
{
    args.Message.ApplicationProperties.TryGetValue("traceparent", out var parent);

    using var activity = Source.StartActivity(
        "ProcessOrderMessage",
        ActivityKind.Consumer,
        parentId: parent?.ToString());

    activity?.SetTag("messaging.system", "servicebus");
    activity?.SetTag("messaging.message.id", args.Message.MessageId);

    await _handler.HandleAsync(args.Message, args.CancellationToken);
    await args.CompleteMessageAsync(args.Message);
};
```

The Azure Service Bus SDK does much of this automatically now, and knowing the mechanism matters because a broken trace across a queue is almost always the context not being carried.

**A trace that stops at a queue boundary is the most common tracing gap**, and this is the fix.

## Sampling across services

```csharp
.UseAzureMonitor(options => { options.SamplingRatio = 0.2f; })
```

Sampling must be **consistent across services**, or a trace is partially collected: the API sampled in, the worker sampled out, and the trace has a hole.

The Azure Monitor distribution uses a hash of the trace ID, so the same trace is sampled the same way everywhere. That is what makes the ratio safe to apply per service.

Do not use different ratios in different services unless you understand exactly what that produces.

## Querying traces

```kusto
let traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
union requests, dependencies, traces, exceptions
| where operation_Id == traceId
| project timestamp, itemType, name, target, duration,
          success, message, cloud_RoleName
| order by timestamp asc
```

```kusto
// where time is spent, per service
dependencies
| where timestamp > ago(1h)
| summarize totalMs = sum(duration), calls = count(),
            p95 = percentile(duration, 95)
  by cloud_RoleName, type, target
| order by totalMs desc
```

```kusto
// traces crossing more than three services, which are often the slow ones
requests
| where timestamp > ago(1h)
| summarize services = dcount(cloud_RoleName), totalMs = sum(duration)
  by operation_Id
| where services > 3
| order by totalMs desc
| take 20
```

`cloud_RoleName` identifies the service, and setting it correctly is what makes cross service queries meaningful.

```csharp
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource
        .AddService(
            serviceName: "shop-api",
            serviceVersion: ThisAssembly.Version,
            serviceInstanceId: Environment.MachineName));
```

## Exporting elsewhere

```csharp
.WithTracing(tracing => tracing
    .AddOtlpExporter(options =>
    {
        options.Endpoint = new Uri("http://otel-collector:4317");
    }));
```

OpenTelemetry is vendor neutral. The same instrumentation exports to Application Insights, Jaeger, Grafana Tempo, Honeycomb or anything speaking OTLP, and you can export to more than one at once.

That is the practical argument for OpenTelemetry over a vendor SDK: the instrumentation in your code outlives the choice of backend.

## Running a collector

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  batch:
    timeout: 5s
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
  attributes:
    actions:
      - key: http.request.header.authorization
        action: delete

exporters:
  azuremonitor:
    connection_string: "${APPLICATIONINSIGHTS_CONNECTION_STRING}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, attributes, batch]
      exporters: [azuremonitor]
```

A collector sits between applications and the backend. It batches, filters, strips sensitive attributes and can fan out to several destinations, and applications only need to know about the collector.

Worth running when you have several services or need to change backends without redeploying applications.

## Quick recap

- One trace ID follows a request across services, with each operation a span.
- W3C Trace Context is the propagation standard, and Azure services support it.
- Register the `ActivitySource` name with `AddSource`, or custom spans never export.
- Filter out health checks, since they are the highest volume lowest value traces.
- A trace breaking at a queue boundary means the context is not carried in the message.
- Sampling must be consistent across services, or traces have holes.
- Set `cloud_RoleName` correctly, since cross service queries depend on it.

<code id="code-content" class="language-csharp">
// THE PROBLEM: a request touches an API, a queue, a worker and a database.
// Logs exist in each and NOTHING CONNECTS THEM. Tracing connects them:
//   TRACE  the whole journey, one ID
//   SPAN   one operation, with a parent
//   W3C traceparent header: 00-&lt;32 hex trace&gt;-&lt;16 hex span&gt;-01
// Azure services propagate it and .NET handles it, which is why tracing
// usually works without effort, and why it breaks when something strips headers.
//
builder.Services.AddOpenTelemetry()
    .UseAzureMonitor(options =&gt;
    {
        options.ConnectionString = config["ApplicationInsights:ConnectionString"];
        // SAMPLING MUST BE CONSISTENT ACROSS SERVICES, or a trace is
        // partially collected: API in, worker out, and the trace has a
        // hole. This distribution hashes the trace ID, so the same trace is
        // sampled the same way everywhere.
        options.SamplingRatio = 0.2f;
    })
    .WithTracing(tracing =&gt; tracing
        .AddSource("Shop.Orders")          // REQUIRED, see below
        .AddAspNetCoreInstrumentation(o =&gt;
        {
            o.RecordException = true;
            // HEALTH CHECKS ARE THE HIGHEST VOLUME, LOWEST VALUE TRACES in
            // any application. Excluding them cuts volume noticeably.
            o.Filter = ctx =&gt; !ctx.Request.Path.StartsWithSegments("/healthz");
        })
        .AddHttpClientInstrumentation()
        .AddSqlClientInstrumentation())
    // cloud_RoleName IS WHAT MAKES CROSS SERVICE QUERIES MEANINGFUL:
    .ConfigureResource(r =&gt; r.AddService("shop-api", ThisAssembly.Version));
//
public class OrderService
{
    // THE NAME HERE MUST BE REGISTERED WITH AddSource ABOVE, or the spans
    // are created and NEVER EXPORTED. That is the most common reason custom
    // spans do not appear.
    private static readonly ActivitySource Source = new("Shop.Orders", "1.0.0");
//
    public async Task&lt;Order&gt; PlaceAsync(Basket basket, CancellationToken token)
    {
        using var activity = Source.StartActivity("PlaceOrder");
        // USE SEMANTIC CONVENTIONS where they exist (db.system,
        // messaging.system, http.request.method): any backend understands
        // them, and they drive the automatic visualisations.
        activity?.SetTag("tenant.id", basket.TenantId);
        try
        {
            var order = await _repository.CreateAsync(basket, token);
            activity?.SetStatus(ActivityStatusCode.Ok);
            return order;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.AddException(ex);
            throw;
        }
    }
}
//
// A TRACE THAT STOPS AT A QUEUE BOUNDARY IS THE MOST COMMON GAP. HTTP is
// instrumented automatically; MESSAGING NEEDS THE CONTEXT IN THE MESSAGE.
message.ApplicationProperties["traceparent"] = activity.Id;
// ...and on the receiving side, use it as the PARENT:
using var consumer = Source.StartActivity("ProcessOrderMessage",
    ActivityKind.Consumer, parentId: parent?.ToString());
//
// QUERY ONE WHOLE TRACE:
//   union requests, dependencies, traces, exceptions
//   | where operation_Id == "4bf92f3577b34da6a3ce929d0e0e4736"
//   | project timestamp, itemType, name, duration, cloud_RoleName
//   | order by timestamp asc
//
// OPENTELEMETRY IS VENDOR NEUTRAL: the same instrumentation exports to
// Application Insights, Jaeger, Tempo or anything speaking OTLP, and to
// more than one at once. THE INSTRUMENTATION IN YOUR CODE OUTLIVES THE
// CHOICE OF BACKEND, which is the practical argument for it.
//   .AddOtlpExporter(o =&gt; o.Endpoint = new Uri("http://otel-collector:4317"))
// A COLLECTOR batches, filters, STRIPS SENSITIVE ATTRIBUTES and fans out,
// so applications only need to know about the collector.
</code></pre>
