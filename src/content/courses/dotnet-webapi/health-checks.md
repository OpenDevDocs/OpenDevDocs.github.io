---
publishDate: 2026-09-25T17:30
title: Health Checks
slug: health-checks
metadescription: Add liveness and readiness endpoints so load balancers and orchestrators know when your API is healthy, write custom checks, and return a useful JSON report.
updateDate: 2026-09-07T17:30
author: ['bishal-biswas']
level: 3
tags: ['health-checks', 'monitoring', 'deployment']
course: dotnet-webapi
---

## What a health check is for

A health check is an endpoint that answers one question: is this instance able to serve traffic?

Three things ask it:

- A **load balancer**, deciding whether to send requests here
- An **orchestrator** such as Kubernetes, deciding whether to restart the container
- A **monitoring system**, deciding whether to wake somebody up

Without one, a load balancer keeps sending traffic to an instance whose database connection died, and every request fails.

## The simplest possible check

```csharp
builder.Services.AddHealthChecks();

var app = builder.Build();

app.MapHealthChecks("/health");
```

`GET /health` now returns `200 Healthy` or `503 Unhealthy`.

That alone is worth having. It proves the process is running and can serve a request.

## Liveness versus readiness

The distinction that makes health checks actually useful. Getting it wrong causes restart loops or dropped requests.

**Liveness** asks: is this process alive, or is it stuck and in need of a restart?

It must **not** check dependencies. If your database goes down and your liveness check fails, the orchestrator restarts every instance. Restarting does not fix the database, so you now have a database outage plus a restart storm.

**Readiness** asks: can this instance serve traffic right now?

This one **does** check dependencies. If the database is unreachable, the instance is not ready, so the load balancer stops sending it traffic. Nothing is restarted, and when the database recovers the instance rejoins by itself.

Use tags to separate them:

```csharp
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: new[] { "live" })
    .AddDbContextCheck<AppDbContext>("database", tags: new[] { "ready" })
    .AddCheck<RedisHealthCheck>("redis", tags: new[] { "ready" });
```

```csharp
// Liveness: no dependencies, so a failure genuinely means restart me
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live")
});

// Readiness: dependencies included
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

## Ready made checks

A community package covers most dependencies:

```bash
dotnet add package AspNetCore.HealthChecks.SqlServer
dotnet add package AspNetCore.HealthChecks.Redis
dotnet add package AspNetCore.HealthChecks.Uris
```

```csharp
builder.Services.AddHealthChecks()
    .AddSqlServer(connectionString, name: "sql", tags: new[] { "ready" })
    .AddRedis(redisConnection, name: "redis", tags: new[] { "ready" })
    .AddUrlGroup(new Uri("https://payments.example.com/health"),
                 name: "payment-gateway",
                 failureStatus: HealthStatus.Degraded,      // not fatal
                 tags: new[] { "ready" });
```

Note `failureStatus: HealthStatus.Degraded` on the external service. A payment provider being down should not take your whole API out of the load balancer if most endpoints still work.

For EF Core specifically, `AddDbContextCheck` calls `CanConnectAsync`:

```csharp
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database", tags: new[] { "ready" });
```

## Writing a custom check

Implement `IHealthCheck`:

```csharp
public class DiskSpaceHealthCheck : IHealthCheck
{
    private const long MinimumFreeBytes = 1024L * 1024 * 1024;   // 1 GB

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        var drive = new DriveInfo(Path.GetPathRoot(AppContext.BaseDirectory)!);

        var data = new Dictionary<string, object>
        {
            ["drive"] = drive.Name,
            ["freeGb"] = Math.Round(drive.AvailableFreeSpace / 1024d / 1024 / 1024, 2)
        };

        if (drive.AvailableFreeSpace < MinimumFreeBytes)
            return Task.FromResult(HealthCheckResult.Unhealthy(
                $"Only {data["freeGb"]} GB free.", data: data));

        if (drive.AvailableFreeSpace < MinimumFreeBytes * 5)
            return Task.FromResult(HealthCheckResult.Degraded(
                $"Low disk space: {data["freeGb"]} GB free.", data: data));

        return Task.FromResult(HealthCheckResult.Healthy("Disk space is fine.", data));
    }
}
```

```csharp
builder.Services.AddHealthChecks()
    .AddCheck<DiskSpaceHealthCheck>("disk", tags: new[] { "ready" });
```

Three statuses, and the middle one is underused:

- **`Healthy`**, working normally
- **`Degraded`**, working but not well. Still returns `200` by default, so the instance stays in the load balancer while monitoring notices.
- **`Unhealthy`**, not working. Returns `503`.

A check can inject services, so it can query a database or call another API:

```csharp
public class MigrationsHealthCheck : IHealthCheck
{
    private readonly AppDbContext db;

    public MigrationsHealthCheck(AppDbContext db) => this.db = db;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        IEnumerable<string> pending = await db.Database.GetPendingMigrationsAsync(ct);

        return pending.Any()
            ? HealthCheckResult.Unhealthy($"{pending.Count()} migration(s) pending.")
            : HealthCheckResult.Healthy();
    }
}
```

That one is genuinely useful during a deployment. An instance whose schema is behind should not take traffic.

## A useful JSON response

The default response is the single word `Healthy`. A JSON report tells you which check failed:

```csharp
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";

        var result = new
        {
            status = report.Status.ToString(),
            totalDurationMs = report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                durationMs = e.Value.Duration.TotalMilliseconds,
                description = e.Value.Description,
                error = e.Value.Exception?.Message,
                data = e.Value.Data
            })
        };

        await context.Response.WriteAsJsonAsync(result);
    }
});
```

```json
{
  "status": "Degraded",
  "totalDurationMs": 42.7,
  "checks": [
    { "name": "database", "status": "Healthy", "durationMs": 12.1 },
    { "name": "redis", "status": "Healthy", "durationMs": 3.4 },
    {
      "name": "payment-gateway",
      "status": "Degraded",
      "durationMs": 27.2,
      "description": "Responded 503"
    }
  ]
}
```

Now an on call engineer sees the cause immediately instead of opening a dashboard.

## Do not expose details publicly

That JSON tells an attacker which services you depend on and sometimes their addresses. Protect it:

```csharp
// Public: just the status, no details
app.MapHealthChecks("/health", new HealthCheckOptions
{
    Predicate = _ => false          // run no checks, just prove the process responds
});

// Detailed: authenticated only
app.MapHealthChecks("/health/detail", new HealthCheckOptions
{
    ResponseWriter = WriteDetailedJson
}).RequireAuthorization("MonitoringPolicy");
```

Alternatively, bind the detailed endpoint to an internal port that is not exposed publicly.

## Customising the status codes

By default `Degraded` returns `200` and `Unhealthy` returns `503`. Override it if your load balancer expects something else:

```csharp
new HealthCheckOptions
{
    ResultStatusCodes =
    {
        [HealthStatus.Healthy] = StatusCodes.Status200OK,
        [HealthStatus.Degraded] = StatusCodes.Status200OK,
        [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable
    }
}
```

Keeping `Degraded` at `200` is deliberate and usually right. A partially working instance is better than none.

## Kubernetes

The two endpoints map onto the two probes:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 30
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 2

startupProbe:
  httpGet:
    path: /health/live
    port: 8080
  failureThreshold: 30
  periodSeconds: 10
```

A `startupProbe` gives a slow starting app time to warm up without the liveness probe killing it. Once it passes, the other two take over.

## Keep checks fast

Probes run every few seconds. A check that takes five seconds and queries a table is a self inflicted load problem.

```csharp
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database",
        customTestQuery: async (db, ct) => await db.Database.CanConnectAsync(ct));
```

`CanConnectAsync` opens a connection. It does not count rows. That is the right level of detail: you are checking reachability, not correctness.

Set a timeout so a hanging dependency does not hang the probe:

```csharp
.AddCheck<SlowServiceHealthCheck>("slow", timeout: TimeSpan.FromSeconds(3))
```

And exclude health endpoints from logging and rate limiting, or they dominate both.

## Quick recap

- A health check tells load balancers and orchestrators whether this instance can serve traffic.
- Liveness must not check dependencies, or a database outage becomes a restart storm.
- Readiness does check dependencies, so a failing instance is removed from the pool without a restart.
- Separate them with tags and a `Predicate`.
- Use `Degraded` for a non fatal problem. It stays `200`, so the instance keeps serving.
- Write custom checks by implementing `IHealthCheck`. They can inject services.
- A pending migrations check stops an instance with an old schema taking traffic.
- A JSON `ResponseWriter` shows which check failed.
- Keep the detailed report authenticated or internal only.
- Keep checks fast, set timeouts, and exclude health endpoints from logs and rate limits.

<code id="code-content" class="language-csharp">
// Liveness and readiness endpoints, custom checks, and a useful JSON report.
// dotnet add package AspNetCore.HealthChecks.SqlServer
using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddHealthChecks()
    // LIVE: no dependencies. A failure here means "restart me", and restarting
    // must actually be able to fix it. Never put a database check in this group.
    .AddCheck("self", () =&gt; HealthCheckResult.Healthy("The process is running."),
              tags: new[] { "live" })
    // READY: dependencies. A failure removes this instance from the load balancer
    // without restarting anything, and it rejoins on its own when things recover.
    .AddDbContextCheck&lt;AppDbContext&gt;("database", tags: new[] { "ready" })
    .AddCheck&lt;MigrationsHealthCheck&gt;("migrations", tags: new[] { "ready" })
    .AddCheck&lt;DiskSpaceHealthCheck&gt;("disk",
        failureStatus: HealthStatus.Degraded, tags: new[] { "ready" })
    // An external service being down should DEGRADE us, not remove us entirely,
    // if most of the API still works without it.
    .AddCheck&lt;PaymentGatewayHealthCheck&gt;("payment-gateway",
        failureStatus: HealthStatus.Degraded,
        tags: new[] { "ready" },
        timeout: TimeSpan.FromSeconds(3));       // never let a hang stall the probe
builder.Services.AddHttpClient();
builder.Services.AddControllers();
var app = builder.Build();
app.MapControllers();
// Public: proves the process answers, and reveals nothing about our dependencies
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ =&gt; false });
// Liveness for the orchestrator
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check =&gt; check.Tags.Contains("live")
});
// Readiness for the load balancer, with a report saying WHICH check failed
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check =&gt; check.Tags.Contains("ready"),
    // Degraded stays 200 on purpose: a partly working instance beats no instance
    ResultStatusCodes =
    {
        [HealthStatus.Healthy]   = StatusCodes.Status200OK,
        [HealthStatus.Degraded]  = StatusCodes.Status200OK,
        [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable
    },
    ResponseWriter = WriteJsonReport
});
app.Run();
// The report names your dependencies, so keep the detailed version internal
static async Task WriteJsonReport(HttpContext context, HealthReport report)
{
    context.Response.ContentType = "application/json";
    await context.Response.WriteAsync(JsonSerializer.Serialize(new
    {
        status          = report.Status.ToString(),
        totalDurationMs = Math.Round(report.TotalDuration.TotalMilliseconds, 1),
        checks = report.Entries.Select(e =&gt; new
        {
            name        = e.Key,
            status      = e.Value.Status.ToString(),
            durationMs  = Math.Round(e.Value.Duration.TotalMilliseconds, 1),
            description = e.Value.Description,
            error       = e.Value.Exception?.Message,
            data        = e.Value.Data
        })
    }, new JsonSerializerOptions { WriteIndented = true }));
}
// Stops an instance with an out of date schema from taking traffic during a deploy
public class MigrationsHealthCheck : IHealthCheck
{
    private readonly AppDbContext db;
    public MigrationsHealthCheck(AppDbContext db) =&gt; this.db = db;
    public async Task&lt;HealthCheckResult&gt; CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            IEnumerable&lt;string&gt; pending = await db.Database.GetPendingMigrationsAsync(ct);
            return pending.Any()
                ? HealthCheckResult.Unhealthy($"{pending.Count()} migration(s) pending.",
                    data: new Dictionary&lt;string, object&gt; { ["pending"] = pending.ToArray() })
                : HealthCheckResult.Healthy("Schema is up to date.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Cannot reach the database.", ex);
        }
    }
}
// Three statuses, and Degraded is the underused one
public class DiskSpaceHealthCheck : IHealthCheck
{
    private const long OneGb = 1024L * 1024 * 1024;
    public Task&lt;HealthCheckResult&gt; CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        var drive = new DriveInfo(Path.GetPathRoot(AppContext.BaseDirectory)!);
        double freeGb = Math.Round(drive.AvailableFreeSpace / (double)OneGb, 2);
        var data = new Dictionary&lt;string, object&gt; { ["drive"] = drive.Name, ["freeGb"] = freeGb };
        if (drive.AvailableFreeSpace &lt; OneGb)
            return Task.FromResult(HealthCheckResult.Unhealthy($"Only {freeGb} GB free.", data: data));
        if (drive.AvailableFreeSpace &lt; OneGb * 5)
            return Task.FromResult(HealthCheckResult.Degraded($"Low disk space: {freeGb} GB free.", data: data));
        return Task.FromResult(HealthCheckResult.Healthy($"{freeGb} GB free.", data));
    }
}
// A check can inject services, so it can call another API
public class PaymentGatewayHealthCheck : IHealthCheck
{
    private readonly IHttpClientFactory clients;
    public PaymentGatewayHealthCheck(IHttpClientFactory clients) =&gt; this.clients = clients;
    public async Task&lt;HealthCheckResult&gt; CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            HttpClient http = clients.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(2);
            HttpResponseMessage response = await http.GetAsync("https://payments.example.com/health", ct);
            return response.IsSuccessStatusCode
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Degraded($"Responded {(int)response.StatusCode}.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Degraded("Payment gateway unreachable.", ex);
        }
    }
}
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
}
/* Kubernetes probes map straight onto these two endpoints:
livenessProbe:  { httpGet: { path: /health/live,  port: 8080 }, periodSeconds: 30, failureThreshold: 3 }
readinessProbe: { httpGet: { path: /health/ready, port: 8080 }, periodSeconds: 10, failureThreshold: 2 }
startupProbe:   { httpGet: { path: /health/live,  port: 8080 }, periodSeconds: 10, failureThreshold: 30 }
   The startupProbe gives a slow starting app time to warm up without the
   liveness probe killing it first.
*/
</code></pre>
