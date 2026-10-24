---
publishDate: 2026-10-25T12:35
title: Application Insights
slug: application-insights
metadescription: Instrument an application with Application Insights, understand sampling, and use the data to find real problems.
updateDate: 2026-09-07T12:35
author: ['bishal-biswas']
level: 2
tags: ['observability', 'application insights', 'apm']
course: azure
---

## Setting it up

```bash
az monitor app-insights component create \
  --app appi-shop --location uksouth --resource-group rg-shop-prod-uks \
  --workspace /subscriptions/.../workspaces/law-shop \
  --application-type web
```

**Create it workspace based.** Classic resources are retired, and workspace based means the telemetry lands in Log Analytics where it can be joined with everything else.

```csharp
builder.Services.AddApplicationInsightsTelemetry(options =>
{
    options.ConnectionString = builder.Configuration["ApplicationInsights:ConnectionString"];
    options.EnableAdaptiveSampling = true;
    options.EnableDependencyTrackingTelemetryModule = true;
});
```

Use the **connection string**, not the instrumentation key. Keys are deprecated, and the connection string carries the regional endpoints, which matters for sovereign clouds and newer regions.

## What arrives automatically

```text
requests       incoming HTTP, with duration and result code
dependencies   outgoing calls: SQL, HTTP, storage, Service Bus, Cosmos
exceptions     unhandled and logged exceptions with stack traces
traces         ILogger output
performanceCounters  CPU, memory, request rate
availabilityResults  results from availability tests
customEvents, customMetrics   what you record yourself
```

Dependency tracking is the strongest part. Every SQL query, HTTP call and storage operation is recorded with duration and success, and it usually reveals the actual cause of slowness on the first look.

```kusto
dependencies
| where timestamp > ago(1h)
| summarize count(), avg(duration), percentile(duration, 95) by type, target
| order by percentile_duration_95 desc
```

## Adding context

```csharp
public class TenantEnricher(IHttpContextAccessor accessor) : ITelemetryInitializer
{
    public void Initialize(ITelemetry telemetry)
    {
        var context = accessor.HttpContext;
        if (context is null) return;

        if (telemetry is ISupportProperties props)
        {
            props.Properties["TenantId"] = context.User.FindFirst("tid")?.Value ?? "unknown";
            props.Properties["Version"] = ThisAssembly.Version;
        }

        telemetry.Context.User.AuthenticatedUserId = context.User.FindFirst("oid")?.Value;
    }
}

builder.Services.AddSingleton<ITelemetryInitializer, TenantEnricher>();
```

A telemetry initialiser adds properties to **everything**, so every request, dependency and exception carries the tenant and version. That turns "the application is slow" into "the application is slow for tenant 42 since version 1.5.0".

Adding version to every telemetry item is the single most useful custom property, because it makes "did the deployment cause this" a query rather than a guess.

## Structured logging

```csharp
_logger.LogInformation(
    "Order {OrderId} placed by {CustomerId} for {Total:C}",
    order.Id, order.CustomerId, order.Total);
```

Named placeholders become queryable properties. String interpolation does not, and this distinction is why one of these is useful and the other is a wall of text.

```kusto
traces
| where message has "Order"
| extend orderId = tostring(customDimensions.OrderId),
         total = todouble(customDimensions.Total)
| where total > 1000
| project timestamp, orderId, total
```

## Custom metrics and events

```csharp
public class CheckoutService(TelemetryClient telemetry)
{
    public async Task<Order> PlaceAsync(Basket basket)
    {
        using var operation = telemetry.StartOperation<RequestTelemetry>("PlaceOrder");

        var order = await _orders.CreateAsync(basket);

        telemetry.TrackEvent("OrderPlaced", new Dictionary<string, string>
        {
            ["PaymentMethod"] = basket.PaymentMethod,
            ["Currency"] = basket.Currency
        });

        telemetry.GetMetric("OrderValue", "Currency").TrackValue(
            (double)order.Total, basket.Currency);

        return order;
    }
}
```

`GetMetric` pre aggregates in the process and sends summaries, so it is not sampled and costs far less than sending each value as an event.

**Custom metrics are not sampled.** For anything used in an alert or a business dashboard, that matters, because sampled events give approximate counts.

## Sampling

The most misunderstood part.

```text
Adaptive sampling   the SDK reduces volume automatically under load. On by default.
Fixed rate sampling a set percentage, consistent across services.
Ingestion sampling  applied at the service, after data is sent.
```

```csharp
builder.Services.Configure<TelemetryConfiguration>(config =>
{
    config.DefaultTelemetrySink.TelemetryProcessorChainBuilder
        .UseAdaptiveSampling(maxTelemetryItemsPerSecond: 20, excludedTypes: "Exception;Event")
        .Build();
});
```

**Sampling keeps whole operations together.** If a request is sampled in, its dependencies, traces and exceptions come with it, so a sampled trace is still complete and readable.

Exclude exceptions from sampling. A rare exception is exactly what you need to see, and sampling it away defeats the purpose.

```kusto
requests
| where timestamp > ago(1h)
| summarize actual = count(), estimated = sum(itemCount)
```

`itemCount` is the sampling multiplier. Counting rows without it under reports, sometimes by a factor of ten, and this catches people writing their first business report from Application Insights.

## Live metrics

```text
A real time stream, unsampled, with no ingestion delay.
```

The live metrics stream shows requests, failures and dependency calls as they happen. During a deployment, watching it is the fastest way to see whether something has broken, because the normal telemetry pipeline is a few minutes behind.

## Availability tests

```bash
az monitor app-insights web-test create \
  --resource-group rg-shop-prod-uks --name shop-availability \
  --app-insights appi-shop --location uksouth \
  --web-test-kind standard --defined-web-test-name shop-health \
  --request-url https://shop.example.com/healthz \
  --frequency 300 --locations "uk-south" "us-east" "japan-east" \
  --ssl-check true --ssl-lifetime-check 30
```

Requests from several locations, alerting when the site is unreachable. Note `--ssl-lifetime-check`, which warns before a certificate expires.

Test from at least three locations, and alert when two or more fail. A single location failing is usually that location.

## Finding real problems

```kusto
// what actually costs the most time, in total
requests
| where timestamp > ago(24h)
| summarize totalMs = sum(duration), count = count(), avgMs = avg(duration) by name
| order by totalMs desc
```

An endpoint taking 50ms called a million times matters more than one taking 8 seconds called twice. Sorting by total time finds what to optimise; sorting by average finds what is annoying.

```kusto
// dependencies causing failures
dependencies
| where timestamp > ago(24h)
| where success == false
| summarize count() by type, target, resultCode
| order by count_ desc
```

```kusto
// exceptions grouped, with an example
exceptions
| where timestamp > ago(24h)
| summarize count = count(), example = any(outerMessage)
  by type, problemId
| order by count desc
```

```kusto
// did the deployment do this
requests
| where timestamp > ago(6h)
| extend version = tostring(customDimensions.Version)
| summarize failureRate = 100.0 * countif(success == false) / count(),
            p95 = percentile(duration, 95)
  by version, bin(timestamp, 15m)
| render timechart
```

That last one is why the version property is worth adding to everything.

## Cost control

```bash
az monitor app-insights component update \
  --app appi-shop --resource-group rg-shop-prod-uks \
  --sampling-percentage 20

az monitor app-insights component billing update \
  --app appi-shop --resource-group rg-shop-prod-uks \
  --cap 50 --stop-sending-notification-email true
```

```text
Sample more aggressively in high volume services
Reduce ILogger verbosity, since Information level is often noise
Set a daily cap, so a runaway loop does not produce a large bill
Use custom metrics rather than events where you only need numbers
```

A daily cap does stop ingestion when reached, so set it above normal volume rather than at it, and alert when it is approached.

## Quick recap

- Create the resource workspace based and use the connection string, not an instrumentation key.
- Dependency tracking usually reveals the real cause of slowness immediately.
- A telemetry initialiser adding version and tenant turns vague reports into queries.
- Named placeholders in log messages become queryable properties; interpolation does not.
- Custom metrics are pre aggregated and not sampled, so use them for alerts and dashboards.
- Sampling keeps operations whole, and `itemCount` is needed for accurate counts.
- Sort by total time to find what to optimise, not by average.

<code id="code-content" class="language-csharp">
// CREATE IT WORKSPACE BASED. Classic resources are retired, and workspace
// based means telemetry lands in Log Analytics with everything else.
// USE THE CONNECTION STRING, not an instrumentation key: keys are
// deprecated, and the connection string carries the regional endpoints.
builder.Services.AddApplicationInsightsTelemetry(options =&gt;
{
    options.ConnectionString = config["ApplicationInsights:ConnectionString"];
    options.EnableAdaptiveSampling = true;
});
//
// A TELEMETRY INITIALISER ADDS PROPERTIES TO EVERYTHING: every request,
// dependency and exception. That turns "the application is slow" into "it
// is slow for tenant 42 since version 1.5.0".
public class TenantEnricher(IHttpContextAccessor accessor) : ITelemetryInitializer
{
    public void Initialize(ITelemetry telemetry)
    {
        if (telemetry is ISupportProperties props)
        {
            props.Properties["TenantId"] = accessor.HttpContext?.User.FindFirst("tid")?.Value;
            // THE SINGLE MOST USEFUL CUSTOM PROPERTY: it makes "did the
            // deployment cause this" a QUERY rather than a guess.
            props.Properties["Version"] = ThisAssembly.Version;
        }
    }
}
//
// NAMED PLACEHOLDERS BECOME QUERYABLE PROPERTIES. String interpolation does
// not, which is why one of these is useful and the other is a wall of text.
_logger.LogInformation("Order {OrderId} placed by {CustomerId} for {Total:C}",
    order.Id, order.CustomerId, order.Total);
//
// GetMetric PRE AGGREGATES IN PROCESS and is NOT SAMPLED, so it costs far
// less and gives exact numbers. Use it for anything driving an alert or a
// business dashboard, where sampled events only approximate.
telemetry.GetMetric("OrderValue", "Currency").TrackValue((double)order.Total, currency);
//
// SAMPLING KEEPS WHOLE OPERATIONS TOGETHER: if a request is sampled in, its
// dependencies, traces and exceptions come with it, so the trace is still
// complete. EXCLUDE EXCEPTIONS: a rare exception is exactly what you need
// to see, and sampling it away defeats the purpose.
//   .UseAdaptiveSampling(maxTelemetryItemsPerSecond: 20,
//                        excludedTypes: "Exception;Event")
//
// itemCount IS THE SAMPLING MULTIPLIER. Counting rows without it UNDER
// REPORTS, sometimes tenfold, and this catches everyone's first business
// report:
//   requests | summarize actual = count(), estimated = sum(itemCount)
//
// WHAT ACTUALLY COSTS THE MOST TIME. An endpoint taking 50ms called a
// million times matters more than one taking 8 seconds called twice.
// Sort by TOTAL to find what to optimise; by AVERAGE to find what annoys.
//   requests | summarize totalMs = sum(duration), count = count() by name
//            | order by totalMs desc
//
//   dependencies | where success == false
//                | summarize count() by type, target, resultCode
//
//   requests | extend version = tostring(customDimensions.Version)
//            | summarize failureRate = 100.0 * countif(success == false) / count()
//              by version, bin(timestamp, 15m) | render timechart
//
// LIVE METRICS is unsampled with NO ingestion delay, which is why it is the
// fastest way to see whether a deployment just broke something. Normal
// telemetry is a few minutes behind.
//
// AVAILABILITY TESTS from at least THREE locations, alerting when TWO or
// more fail: a single location failing is usually that location.
// --ssl-lifetime-check warns before a certificate expires.
//
// COST: sample harder in high volume services, reduce Information level
// noise, prefer metrics to events for numbers, and SET A DAILY CAP so a
// runaway loop cannot produce a large bill. The cap STOPS INGESTION, so set
// it above normal volume and alert when approached.
</code></pre>
