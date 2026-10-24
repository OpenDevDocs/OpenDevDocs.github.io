---
publishDate: 2026-09-24T17:10
title: Rate Limiting
slug: rate-limiting
metadescription: Protect your API from abuse and overload with the built in rate limiter. Compare the four algorithms, partition by user or IP, and return helpful 429 responses.
updateDate: 2026-09-07T17:10
author: ['bishal-biswas']
level: 3
tags: ['rate-limiting', 'security', 'performance']
course: dotnet-webapi
---

## Why you need it

Without a limit, one client can take your API down. Sometimes maliciously, more often by accident: a retry loop with no backoff, a script left running overnight, a mobile app polling every second because of a bug.

Rate limiting also blocks specific attacks. A login endpoint with no limit can be brute forced. A password reset endpoint can be used to spam someone's inbox.

.NET 7 added a built in rate limiter. Before that everyone used a third party package.

## The four algorithms

Each behaves differently under bursts, and the difference matters.

**Fixed window.** A counter that resets on a schedule. 100 requests per minute means the counter clears at the top of each minute.

Simple, and it has the boundary problem: 100 requests at 10:00:59 and 100 more at 10:01:00 means 200 requests in one second, all allowed.

**Sliding window.** Divides the window into segments and moves it continuously. Smooths out the boundary problem at the cost of tracking more state.

**Token bucket.** A bucket holds tokens, refilled at a steady rate. Each request takes one. An idle client accumulates tokens and can burst, then is limited to the refill rate.

This is usually the best fit for an API, because it allows a legitimate burst while capping the sustained rate.

**Concurrency.** Limits how many requests run **at the same time**, not how many per period. Right for protecting an expensive downstream resource such as a report generator.

## Setting it up

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddFixedWindowLimiter("fixed", limiter =>
    {
        limiter.PermitLimit = 100;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
        limiter.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });

    options.AddSlidingWindowLimiter("sliding", limiter =>
    {
        limiter.PermitLimit = 100;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.SegmentsPerWindow = 6;               // ten second segments
    });

    options.AddTokenBucketLimiter("bucket", limiter =>
    {
        limiter.TokenLimit = 100;                    // the burst size
        limiter.TokensPerPeriod = 10;                // the sustained rate
        limiter.ReplenishmentPeriod = TimeSpan.FromSeconds(1);
        limiter.AutoReplenishment = true;
    });

    options.AddConcurrencyLimiter("concurrent", limiter =>
    {
        limiter.PermitLimit = 5;
        limiter.QueueLimit = 10;
    });
});

var app = builder.Build();

app.UseRateLimiter();      // after UseRouting and after authentication
```

**`QueueLimit`** decides what happens to a request over the limit. Zero rejects immediately. Anything higher makes it wait for a slot. Queueing adds latency, so prefer rejecting for a public API and queueing only for a protected internal resource.

## Applying it

```csharp
[EnableRateLimiting("bucket")]
public class BooksController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll() => Ok();

    [HttpGet("health")]
    [DisableRateLimiting]
    public IActionResult Health() => Ok();
}
```

```csharp
app.MapGet("/api/books", GetBooks).RequireRateLimiting("bucket");

app.MapGroup("/api/auth").RequireRateLimiting("auth");
```

Or globally, with a per endpoint override:

```csharp
options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    RateLimitPartition.GetTokenBucketLimiter(
        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = 200,
            TokensPerPeriod = 20,
            ReplenishmentPeriod = TimeSpan.FromSeconds(1)
        }));
```

## Partitioning, the part that matters most

A single global limiter is almost always wrong. A limit of 100 per minute across all users means one busy client locks everyone out.

Partition by caller, so each gets their own bucket:

```csharp
options.AddPolicy("per-user", context =>
{
    // Authenticated users get a generous limit, keyed by their id
    if (context.User.Identity?.IsAuthenticated == true)
    {
        return RateLimitPartition.GetTokenBucketLimiter(
            partitionKey: context.User.FindFirst("sub")!.Value,
            factory: _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = 200,
                TokensPerPeriod = 20,
                ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                AutoReplenishment = true
            });
    }

    // Anonymous callers get a tighter limit, keyed by IP
    return RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 20,
            Window = TimeSpan.FromMinutes(1)
        });
});
```

The partition key can be anything: a user id, an API key, a tenant id, an IP.

A caution on IP addresses. Behind a load balancer or CDN, `RemoteIpAddress` is the proxy, so every request shares one partition. Configure forwarded headers so the real client IP comes through:

```csharp
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownProxies.Add(IPAddress.Parse("10.0.0.1"));
});

app.UseForwardedHeaders();      // before UseRateLimiter
```

Set `KnownProxies` or `KnownNetworks`. Trusting `X-Forwarded-For` from anywhere lets a client set its own IP and bypass the limit entirely.

## Different limits for different endpoints

The single most valuable configuration. Authentication needs a far tighter limit than reads:

```csharp
options.AddFixedWindowLimiter("auth", limiter =>
{
    limiter.PermitLimit = 5;
    limiter.Window = TimeSpan.FromMinutes(15);
});

options.AddTokenBucketLimiter("read", limiter =>
{
    limiter.TokenLimit = 200;
    limiter.TokensPerPeriod = 20;
    limiter.ReplenishmentPeriod = TimeSpan.FromSeconds(1);
});

options.AddConcurrencyLimiter("expensive", limiter =>
{
    limiter.PermitLimit = 3;
    limiter.QueueLimit = 5;
});
```

Five login attempts per fifteen minutes makes brute forcing impractical while barely inconveniencing anyone who mistypes a password.

## A helpful 429

The default rejection is a bare `429` with no body. Tell the client when to come back:

```csharp
options.OnRejected = async (context, ct) =>
{
    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

    if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out TimeSpan retryAfter))
        context.HttpContext.Response.Headers.RetryAfter =
            ((int)retryAfter.TotalSeconds).ToString();

    await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
    {
        Type = "https://api.example.com/errors/rate-limit",
        Title = "Too many requests",
        Status = StatusCodes.Status429TooManyRequests,
        Detail = "Slow down and try again shortly."
    }, ct);
};
```

`Retry-After` is the important part. A well behaved client reads it and backs off. Without it, clients retry immediately and make the problem worse.

Adding the remaining quota to successful responses is also worth doing, so clients can self regulate:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
```

## Log rejections

A spike in `429`s is a signal. It might be an attack, a client bug, or a limit set too low:

```csharp
options.OnRejected = async (context, ct) =>
{
    ILogger logger = context.HttpContext.RequestServices
        .GetRequiredService<ILogger<Program>>();

    logger.LogWarning("Rate limit hit: {Path} from {Ip} user {User}",
        context.HttpContext.Request.Path,
        context.HttpContext.Connection.RemoteIpAddress,
        context.HttpContext.User.FindFirst("sub")?.Value ?? "anonymous");

    // ... write the response
};
```

## The distributed problem

The built in limiter is **in memory and per instance**. Run three instances behind a load balancer with a limit of 100, and a client can make 300.

Three ways to deal with it:

**Divide the limit** by the instance count. Crude, and wrong when scaling is dynamic.

**Rate limit at the gateway.** Azure API Management, AWS API Gateway, nginx and Cloudflare all do this centrally and correctly. This is the usual answer in production.

**Use a Redis backed limiter** from a third party package, which shares state across instances.

Keep the in process limiter anyway. It is a last line of defence if traffic reaches your app another way.

## Where it sits in the pipeline

```csharp
app.UseForwardedHeaders();     // real client IP first
app.UseRouting();
app.UseAuthentication();       // so a limit can key on the user
app.UseAuthorization();
app.UseRateLimiter();          // after auth, before the endpoints
app.MapControllers();
```

Placing it after authentication is what lets you give logged in users a higher limit than anonymous ones.

## Quick recap

- Rate limiting protects against abuse, runaway clients and brute force attacks.
- Fixed window is simplest and has a boundary problem. Sliding window smooths it.
- Token bucket allows a burst and caps the sustained rate. Usually the best fit.
- Concurrency limits simultaneous requests, which suits expensive operations.
- Always partition by user, API key or IP. A single global limit lets one client block everyone.
- Configure forwarded headers with known proxies, or IP partitioning is meaningless behind a load balancer.
- Give authentication endpoints a much tighter limit than reads.
- Return `Retry-After` on a `429`, or clients retry immediately.
- Log rejections. A spike tells you something.
- The built in limiter is per instance. Use a gateway or Redis for a real distributed limit.
- Register `UseRateLimiter` after authentication so limits can key on the user.

<code id="code-content" class="language-csharp">
// Rate limiting with per user partitioning and endpoint specific limits.
using System.Net;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization();
// Behind a load balancer, RemoteIpAddress is the PROXY, so every request would
// share one partition. KnownProxies matters: trusting X-Forwarded-For from
// anywhere lets a client set its own IP and bypass the limit entirely.
builder.Services.Configure&lt;ForwardedHeadersOptions&gt;(options =&gt;
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownProxies.Add(IPAddress.Parse("10.0.0.1"));
});
builder.Services.AddRateLimiter(options =&gt;
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    // Reads: a token bucket allows a legitimate burst, then caps the sustained rate.
    // Partitioned per user, so one busy client cannot lock everyone else out.
    options.AddPolicy("read", context =&gt;
    {
        if (context.User.Identity?.IsAuthenticated == true)
            return RateLimitPartition.GetTokenBucketLimiter(
                partitionKey: context.User.FindFirst("sub")!.Value,
                factory: _ =&gt; new TokenBucketRateLimiterOptions
                {
                    TokenLimit          = 200,   // burst size
                    TokensPerPeriod     = 20,    // sustained rate
                    ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                    AutoReplenishment   = true,
                    QueueLimit          = 0      // reject rather than queue
                });
        // Anonymous callers get a tighter limit, keyed by IP
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ =&gt; new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
            });
    });
    // Authentication: 5 attempts per 15 minutes makes brute forcing impractical
    // while barely inconveniencing someone who mistypes a password.
    options.AddPolicy("auth", context =&gt;
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ =&gt; new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5, Window = TimeSpan.FromMinutes(15), QueueLimit = 0
            }));
    // Expensive work: limit how many run AT ONCE, not how many per period.
    // A small queue is acceptable here because the alternative is a failed report.
    options.AddConcurrencyLimiter("expensive", limiter =&gt;
    {
        limiter.PermitLimit = 3;
        limiter.QueueLimit  = 5;
        limiter.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
    // A helpful 429. Retry-After is what stops clients hammering you harder.
    options.OnRejected = async (context, ct) =&gt;
    {
        var logger = context.HttpContext.RequestServices.GetRequiredService&lt;ILogger&lt;Program&gt;&gt;();
        logger.LogWarning("Rate limit hit on {Path} from {Ip} for user {User}",
            context.HttpContext.Request.Path,
            context.HttpContext.Connection.RemoteIpAddress,
            context.HttpContext.User.FindFirst("sub")?.Value ?? "anonymous");
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        int retrySeconds = 60;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out TimeSpan retryAfter))
            retrySeconds = (int)retryAfter.TotalSeconds;
        context.HttpContext.Response.Headers.RetryAfter = retrySeconds.ToString();
        await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Type   = "https://api.example.com/errors/rate-limit",
            Title  = "Too many requests",
            Status = StatusCodes.Status429TooManyRequests,
            Detail = $"Rate limit exceeded. Try again in {retrySeconds} seconds."
        }, ct);
    };
});
var app = builder.Build();
app.UseForwardedHeaders();     // real client IP, before anything partitions on it
app.UseRouting();
app.UseAuthentication();       // so the limiter can key on the user
app.UseAuthorization();
app.UseRateLimiter();          // after auth, before the endpoints
app.MapControllers();
// A minimal API group with its own policy
app.MapGroup("/api/auth").RequireRateLimiting("auth")
   .MapPost("/login", ([FromBody] object credentials) =&gt; Results.Ok(new { token = "..." }));
app.Run();
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("read")]
public class BooksController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll([FromQuery] int page = 1)
    {
        // Let clients self regulate rather than discovering the limit by hitting it
        Response.Headers["X-RateLimit-Limit"] = "200";
        return Ok(new[] { "Clean Code", "Refactoring" });
    }
    // A slow report: cap how many run at once so three users cannot exhaust the pool
    [HttpGet("annual-report")]
    [EnableRateLimiting("expensive")]
    public async Task&lt;IActionResult&gt; AnnualReport(CancellationToken ct)
    {
        await Task.Delay(2000, ct);
        return Ok(new { generated = DateTime.UtcNow });
    }
    // Monitoring must never be rate limited, or an outage looks like a limit
    [HttpGet("health")]
    [DisableRateLimiting]
    public IActionResult Health() =&gt; Ok(new { status = "ok" });
}
// NOTE: this limiter is IN MEMORY and PER INSTANCE. Three instances behind a load
// balancer with a limit of 100 allows 300. In production, rate limit at the gateway
// (API Management, nginx, Cloudflare) or use a Redis backed limiter, and keep this
// one as a last line of defence.
</code></pre>
