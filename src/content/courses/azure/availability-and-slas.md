---
publishDate: 2026-10-27T12:55
title: Designing for Availability and SLAs
slug: availability-and-slas
metadescription: Design for the availability you actually need, understand how composite SLAs work, and know what an SLA does not promise.
updateDate: 2026-09-07T12:55
author: ['bishal-biswas']
level: 3
tags: ['reliability', 'sla', 'architecture']
course: azure
---

## What the numbers mean

```text
99%      3 days 15 hours downtime per year
99.9%    8 hours 46 minutes
99.95%   4 hours 23 minutes
99.99%   52 minutes
99.999%  5 minutes
```

Each additional nine costs roughly ten times more and is roughly ten times harder. Deciding this is a business decision, and it should be made deliberately rather than by defaulting to "as high as possible".

## Composite SLAs multiply

This is the part most people get wrong. A chain of dependencies has a **lower** availability than any of its parts.

```text
Front Door        99.99%
App Service       99.95%
Azure SQL         99.99%
Storage           99.9%

Composite: 0.9999 x 0.9995 x 0.9999 x 0.999 = 99.83%
```

Four services each with a strong SLA give roughly **15 hours** of expected downtime a year, not 52 minutes.

Adding a component always reduces composite availability, unless it is redundant. That is the argument for fewer moving parts in a critical path.

## Redundancy adds, it does not multiply

```text
Two regions in parallel, each 99.95%
Failure probability: 0.0005 x 0.0005 = 0.00000025
Combined availability: 99.999975%
```

Redundant components multiply the **failure** probability, which makes it much smaller. That is why a second region helps so dramatically, and why a single point of failure dominates everything.

The catch: the failover mechanism itself must work, and it becomes the single point of failure. An untested failover is not redundancy.

## Availability zones

```bash
az vm create --name vm-shop-01 --resource-group rg-shop-prod-uks --zone 1
az appservice plan create --name plan-shop --resource-group rg-shop-prod-uks \
  --sku P1v3 --zone-redundant --number-of-workers 3
az sql db update --name shop --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --zone-redundant true
az storage account create --name stshopprod --resource-group rg-shop-prod-uks \
  --sku Standard_ZRS
```

```text
Zonal            pinned to one zone. Survives nothing above a rack failure.
Zone redundant   spread across zones. Survives one datacentre failing.
```

Zone redundancy is the cheapest meaningful availability improvement available. It usually costs a modest premium, needs no application change, and removes an entire category of failure.

**Enable it at creation.** Most services cannot be made zone redundant afterwards.

## What the SLA does not cover

```text
Your code being wrong
A misconfiguration you made
A dependency outside Azure
Data loss, which is a different guarantee
Anything without a zone or redundancy option enabled
Preview features
Free and Basic tiers, which often have no SLA at all
```

**A single instance often has no SLA at all.** App Service, virtual machines and many other services require multiple instances or premium storage to be covered.

The financial remedy is a service credit, typically a percentage of that service's monthly charge. It does not compensate for lost business, which is why the SLA is a design input rather than a protection.

## Designing for a target

Work backwards from the number.

```text
99.9% (8h 46m/year)
  single region, zone redundant, good monitoring, tested backups

99.95% (4h 23m/year)
  zone redundant everywhere, no single instance anything,
  automated deployment and rollback

99.99% (52m/year)
  multi region active passive with automatic failover,
  regularly tested, no manual step in the failover path

99.999% (5m/year)
  multi region active active, no human in any recovery path,
  and a genuine engineering investment
```

Note that 99.99% cannot be reached with any human step in the recovery path. Fifty two minutes a year does not allow for someone waking up.

## Health checks that mean something

```csharp
builder.Services.AddHealthChecks()
    .AddSqlServer(connectionString, name: "database", tags: ["ready"])
    .AddAzureBlobStorage(blobUri, credential, name: "storage", tags: ["ready"])
    .AddRedis(redisConnection, name: "cache", tags: ["ready"])
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"]);

app.MapHealthChecks("/healthz/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live")
});

app.MapHealthChecks("/healthz/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

```text
Liveness   is the process alive? Failing means restart it.
Readiness  can it serve traffic? Failing means stop routing to it.
```

Confusing the two causes real problems. A readiness check that fails because the database is briefly unavailable is correct. A **liveness** check that fails for the same reason restarts every instance, which does not help and makes recovery slower.

Keep liveness cheap and local. Put dependencies in readiness.

## Failing well

```csharp
builder.Services.AddHttpClient<IRecommendationClient, RecommendationClient>()
    .AddStandardResilienceHandler(options =>
    {
        options.Retry.MaxRetryAttempts = 3;
        options.Retry.BackoffType = DelayBackoffType.Exponential;
        options.CircuitBreaker.FailureRatio = 0.5;
        options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(30);
        options.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(15);
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(5);
    });
```

```text
Retry            for transient failures, with backoff and jitter
Circuit breaker  stop calling a failing dependency, and give it room to recover
Timeout          never wait indefinitely
Fallback         a degraded response beats an error
Bulkhead         limit concurrent calls, so one dependency cannot exhaust threads
```

**Graceful degradation is worth more than availability arithmetic.** A shop that cannot show recommendations but can still take orders is available. One that returns a 500 because the recommendation service is down is not.

```csharp
public async Task<IReadOnlyList<Product>> GetRecommendationsAsync(int customerId)
{
    try
    {
        return await _client.GetAsync(customerId);
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "Recommendations unavailable, falling back to popular");
        return await _cache.GetPopularProductsAsync();
    }
}
```

Identify which dependencies are essential and which are not, and make the non essential ones fail softly.

## Testing it

```bash
az webapp restart --name app-shop --resource-group rg-shop-prod-uks
az sql failover-group set-primary --name fg-shop \
  --resource-group rg-shop-prod-uks --server sql-shop-prod-ne
az network nsg rule create --nsg-name nsg-app --resource-group rg-shop-prod-uks \
  --name block-redis --priority 100 --access Deny --destination-port-ranges 6379
```

Azure Chaos Studio runs controlled fault injection: killing instances, adding latency, failing over databases.

**An untested failover does not work.** That is not pessimism, it is the consistent experience of everyone who has tried one for the first time during an incident.

Test in production if you can do it safely, and in a production like environment if you cannot.

## Measuring what users experience

```kusto
requests
| where timestamp > ago(30d)
| summarize
    total = count(),
    failed = countif(success == false)
  by bin(timestamp, 1h)
| extend availability = 100.0 * (total - failed) / total
| summarize
    monthlyAvailability = avg(availability),
    worstHour = min(availability)
| extend downtimeMinutes = (100 - monthlyAvailability) / 100 * 43200
```

Azure's SLA measures the platform. This measures what your users actually got, which is the number that matters and is usually lower.

Track it monthly. Trend matters more than any single month.

## Quick recap

- Composite SLAs multiply, so four strong services give roughly 15 hours of downtime a year.
- Redundant components multiply failure probability instead, which is why a second region helps so much.
- Zone redundancy is the cheapest meaningful improvement, and must usually be set at creation.
- Single instance deployments often have no SLA at all.
- 99.99 percent cannot include a human step in the recovery path.
- Keep liveness cheap and local, and put dependencies in readiness.
- Graceful degradation is worth more than the arithmetic, and untested failover does not work.

<code id="code-content" class="language-csharp">
// COMPOSITE SLAs MULTIPLY, and this is what most people get wrong:
//   Front Door 99.99% x App Service 99.95% x SQL 99.99% x Storage 99.9%
//   = 99.83%, which is ROUGHLY 15 HOURS A YEAR, not 52 minutes.
// Adding a component ALWAYS reduces availability unless it is REDUNDANT.
//
// REDUNDANCY MULTIPLIES THE FAILURE PROBABILITY INSTEAD:
//   two regions at 99.95%: 0.0005 x 0.0005 = 99.999975%
// ...provided THE FAILOVER MECHANISM WORKS. An untested failover is not
// redundancy, it is a new single point of failure.
//
// WHAT THE SLA DOES NOT COVER: your code, your misconfiguration, data loss,
// preview features, free tiers, and ANYTHING WITHOUT REDUNDANCY ENABLED.
// A SINGLE INSTANCE OFTEN HAS NO SLA AT ALL. The remedy is a service
// credit, not compensation for lost business.
//
// 99.99% (52 MINUTES A YEAR) CANNOT INCLUDE A HUMAN STEP in the recovery
// path. That does not allow for someone waking up.
//
// LIVENESS vs READINESS, and confusing them causes real problems:
//   LIVENESS   is the process alive? Failing RESTARTS it.
//   READINESS  can it serve traffic? Failing STOPS ROUTING to it.
// A readiness check failing because the database blipped is CORRECT. A
// LIVENESS check failing for the same reason RESTARTS EVERY INSTANCE, which
// does not help and makes recovery slower.
builder.Services.AddHealthChecks()
    .AddSqlServer(connectionString, name: "database", tags: ["ready"])
    .AddRedis(redisConnection, name: "cache", tags: ["ready"])
    .AddCheck("self", () =&gt; HealthCheckResult.Healthy(), tags: ["live"]);
app.MapHealthChecks("/healthz/live",
    new HealthCheckOptions { Predicate = c =&gt; c.Tags.Contains("live") });
app.MapHealthChecks("/healthz/ready",
    new HealthCheckOptions { Predicate = c =&gt; c.Tags.Contains("ready") });
//
builder.Services.AddHttpClient&lt;IRecommendationClient, RecommendationClient&gt;()
    .AddStandardResilienceHandler(options =&gt;
    {
        options.Retry.BackoffType = DelayBackoffType.Exponential;
        // Stop calling a failing dependency and GIVE IT ROOM TO RECOVER:
        options.CircuitBreaker.FailureRatio = 0.5;
        options.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(15);
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(5);
    });
//
// GRACEFUL DEGRADATION IS WORTH MORE THAN THE ARITHMETIC. A shop that
// cannot show recommendations but CAN TAKE ORDERS is available. One
// returning 500 because recommendations are down is not.
public async Task&lt;IReadOnlyList&lt;Product&gt;&gt; GetRecommendationsAsync(int customerId)
{
    try { return await _client.GetAsync(customerId); }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "Recommendations unavailable, falling back");
        return await _cache.GetPopularProductsAsync();   // degraded, not failed
    }
}
//
// ZONE REDUNDANCY IS THE CHEAPEST MEANINGFUL IMPROVEMENT: a modest premium,
// no application change, and an entire category of failure removed. MOST
// SERVICES CANNOT BE MADE ZONE REDUNDANT AFTERWARDS, so enable at creation.
//
// MEASURE WHAT USERS ACTUALLY GOT, which is usually lower than the
// platform SLA and is the number that matters:
//   requests | summarize total = count(), failed = countif(success == false)
//              by bin(timestamp, 1h)
//   | extend availability = 100.0 * (total - failed) / total
</code></pre>
