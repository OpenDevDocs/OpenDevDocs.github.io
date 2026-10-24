---
publishDate: 2026-09-24T17:20
title: Logging with Serilog
slug: logging-with-serilog
metadescription: Replace default logging with Serilog for structured logs, write to files and Seq, enrich with request context, and learn what to log and what never to log.
updateDate: 2026-09-07T17:20
author: ['bishal-biswas']
level: 3
tags: ['logging', 'serilog', 'observability']
course: dotnet-webapi
---

## Structured logging

The idea behind Serilog, and the reason it is worth switching to.

A traditional log line is a string:

```text
Order 4471 placed by customer 92 for 149.99
```

To find every order over 100, you write a regular expression and hope.

A structured log keeps the values as data:

```csharp
logger.LogInformation("Order {OrderId} placed by customer {CustomerId} for {Total}",
    order.Id, customer.Id, order.Total);
```

```json
{
  "@t": "2026-09-07T17:20:00Z",
  "@l": "Information",
  "@mt": "Order {OrderId} placed by customer {CustomerId} for {Total}",
  "OrderId": 4471,
  "CustomerId": 92,
  "Total": 149.99
}
```

Now you can query: `Total > 100`, `CustomerId = 92`, or group by `OrderId`. The message template is stored once, so you can also count every occurrence of the same event.

This is why the placeholders matter:

```csharp
// String interpolation: the values are baked in and unqueryable
logger.LogInformation($"Order {order.Id} placed by {customer.Id}");

// Placeholders: the values are captured as named properties
logger.LogInformation("Order {OrderId} placed by {CustomerId}", order.Id, customer.Id);
```

The first one throws away everything structured logging gives you. It is the single most common mistake.

## Installing

```bash
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.File
dotnet add package Serilog.Sinks.Seq
```

`Serilog.AspNetCore` brings in the core package and the hosting integration.

## Setting it up

```csharp
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithEnvironmentName());

var app = builder.Build();

app.UseSerilogRequestLogging();
```

`UseSerilogRequestLogging` replaces the framework's several log lines per request with one useful summary:

```text
HTTP GET /api/books responded 200 in 14.2ms
```

Put it **early** in the pipeline so it measures everything below it.

## Configuration from appsettings

Keeping it in configuration means you can change log levels without redeploying:

```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.Hosting.Lifetime": "Information",
        "Microsoft.EntityFrameworkCore.Database.Command": "Warning",
        "System": "Warning"
      }
    },
    "WriteTo": [
      { "Name": "Console" },
      {
        "Name": "File",
        "Args": {
          "path": "logs/api-.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 14,
          "formatter": "Serilog.Formatting.Compact.CompactJsonFormatter, Serilog.Formatting.Compact"
        }
      },
      {
        "Name": "Seq",
        "Args": { "serverUrl": "http://localhost:5341" }
      }
    ],
    "Enrich": [ "FromLogContext", "WithMachineName" ],
    "Properties": { "Application": "BookStore.Api" }
  }
}
```

The `Override` section is what makes logs readable. Without it, the framework's `Information` level messages drown out yours. Setting `Microsoft` to `Warning` cuts the noise by an order of magnitude.

## Bootstrap logging

There is a gap: if startup itself fails, the host is not built yet and nothing is logged. Fix it with a two stage setup:

```csharp
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting BookStore API");

    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog(/* full configuration */);

    var app = builder.Build();
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "The application failed to start");
}
finally
{
    Log.CloseAndFlush();      // flush buffered logs before exiting
}
```

`CloseAndFlush` in the `finally` matters. Serilog buffers, and without it the last few entries, including the fatal one, are lost.

## Log levels

| Level | Use for |
|---|---|
| `Verbose` | very detailed tracing, off by default |
| `Debug` | diagnostic detail useful in development |
| `Information` | normal events worth recording: a request, an order placed |
| `Warning` | something unexpected that did not fail: a retry, a slow query |
| `Error` | an operation failed, and someone should look |
| `Fatal` | the application cannot continue |

The distinction people get wrong is `Warning` versus `Error`. A user typing a bad password is `Information` or `Warning`, not `Error`. If `Error` includes ordinary user mistakes, your alerts become noise and real failures get ignored.

## Log context

`LogContext` attaches properties to every log entry inside a scope:

```csharp
app.Use(async (context, next) =>
{
    string correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
                           ?? Guid.NewGuid().ToString("N")[..8];

    using (LogContext.PushProperty("CorrelationId", correlationId))
    using (LogContext.PushProperty("UserId", context.User.FindFirst("sub")?.Value ?? "anonymous"))
    {
        context.Response.Headers["X-Correlation-Id"] = correlationId;
        await next();
    }
});
```

Every log line written during that request now carries `CorrelationId` and `UserId`, without any method passing them along. Searching by correlation id shows the whole story of one request across every layer.

Requires `Enrich.FromLogContext()`.

## Enriching the request log

The default request summary is good. Adding a few properties makes it much better:

```csharp
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate =
        "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";

    // Downgrade noisy successes, promote failures
    options.GetLevel = (httpContext, elapsed, ex) =>
        ex is not null || httpContext.Response.StatusCode >= 500 ? LogEventLevel.Error
        : httpContext.Response.StatusCode >= 400 ? LogEventLevel.Warning
        : elapsed > 3000 ? LogEventLevel.Warning
        : httpContext.Request.Path.StartsWithSegments("/health") ? LogEventLevel.Verbose
        : LogEventLevel.Information;

    options.EnrichDiagnosticContext = (diagnostic, httpContext) =>
    {
        diagnostic.Set("UserAgent", httpContext.Request.Headers.UserAgent.ToString());
        diagnostic.Set("ClientIp", httpContext.Connection.RemoteIpAddress?.ToString());
        diagnostic.Set("UserId", httpContext.User.FindFirst("sub")?.Value);
    };
});
```

Sending health check logs to `Verbose` is worth doing on its own. A probe every ten seconds is thousands of useless lines a day.

## Sinks

A **sink** is a destination. Common ones:

```csharp
.WriteTo.Console()                                    // development
.WriteTo.File("logs/api-.log", rollingInterval: RollingInterval.Day)
.WriteTo.Seq("http://localhost:5341")                 // structured log server
.WriteTo.ApplicationInsights(...)                     // Azure
.WriteTo.Elasticsearch(...)
```

**Seq** deserves a mention for development. It runs in one Docker container and gives you a queryable UI over structured logs:

```bash
docker run -d --name seq -e ACCEPT_EULA=Y -p 5341:80 datalust/seq
```

You can then write `Total > 100 and UserId = '92'` and get results. Once you have used structured logs this way, plain text files feel unusable.

Write different levels to different sinks:

```csharp
.WriteTo.Console(restrictedToMinimumLevel: LogEventLevel.Information)
.WriteTo.File("logs/errors-.log", restrictedToMinimumLevel: LogEventLevel.Error)
```

## What not to log

This is the part with real consequences.

**Never log:** passwords, tokens, API keys, session cookies, card numbers, national ID numbers, or full request bodies from authentication endpoints.

Logs go to files, log servers and third party services. They are backed up and often widely readable. A password in a log is a leaked password.

Be careful with objects. Serializing an entity with `{@User}` includes every property, `PasswordHash` among them:

```csharp
// Dumps the whole object, hash included
logger.LogInformation("User logged in {@User}", user);

// Log only what you need
logger.LogInformation("User {UserId} logged in", user.Id);
```

`{@Property}` destructures an object. `{Property}` calls `ToString`. Use `@` deliberately, on DTOs you control, never on entities.

Also watch out for user input in messages. A newline in a username can forge a log line, which matters if anyone reads your logs to investigate an incident.

## Cost

Logging is not free. Every entry is formatted, serialized and written, and a log server charges by volume.

Two habits keep it under control. Set framework namespaces to `Warning`, which usually removes most of the volume. And send health probes and other high frequency noise to `Verbose`.

For an expensive message, check the level first:

```csharp
if (logger.IsEnabled(LogLevel.Debug))
    logger.LogDebug("State: {State}", JsonSerializer.Serialize(complexObject));
```

Without the check, the serialization runs even when the message is discarded.

## Quick recap

- Structured logging keeps values as queryable properties rather than baking them into a string.
- Use placeholders, never string interpolation, or you lose everything structured logging gives you.
- `UseSerilogRequestLogging` replaces several noisy lines per request with one useful summary.
- Configure from `appsettings.json` so levels change without a redeploy.
- Override `Microsoft` and `System` to `Warning`, or framework noise buries your own logs.
- Use a bootstrap logger and `Log.CloseAndFlush()` so startup failures are still recorded.
- Reserve `Error` for real failures. A wrong password is not one.
- `LogContext.PushProperty` attaches a correlation id to every line in a request.
- Send health check logs to `Verbose`.
- Never log secrets, and never destructure an entity with `{@Entity}`.
- Guard expensive log messages with `IsEnabled`.

<code id="code-content" class="language-csharp">
// Serilog set up properly: bootstrap logging, request logging, correlation ids.
// dotnet add package Serilog.AspNetCore Serilog.Sinks.Seq
using Serilog;
using Serilog.Context;
using Serilog.Events;
using Microsoft.AspNetCore.Mvc;
// Stage 1: a bootstrap logger, so a failure DURING startup is still recorded
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .CreateBootstrapLogger();
try
{
    Log.Information("Starting BookStore API");
    var builder = WebApplication.CreateBuilder(args);
    // Stage 2: the real logger, read from appsettings so levels change without a redeploy
    builder.Host.UseSerilog((context, services, configuration) =&gt; configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()               // required for PushProperty below
        .Enrich.WithMachineName()
        .Enrich.WithEnvironmentName()
        .Enrich.WithProperty("Application", "BookStore.Api"));
    builder.Services.AddControllers();
    var app = builder.Build();
    // Early in the pipeline, so it measures everything below it
    app.UseSerilogRequestLogging(options =&gt;
    {
        options.MessageTemplate =
            "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
        options.GetLevel = (http, elapsed, ex) =&gt;
            ex is not null || http.Response.StatusCode &gt;= 500       ? LogEventLevel.Error
            : http.Response.StatusCode &gt;= 400                       ? LogEventLevel.Warning
            : elapsed &gt; 3000                                        ? LogEventLevel.Warning
            // A probe every ten seconds is thousands of useless lines a day
            : http.Request.Path.StartsWithSegments("/health")       ? LogEventLevel.Verbose
            : LogEventLevel.Information;
        options.EnrichDiagnosticContext = (diagnostic, http) =&gt;
        {
            diagnostic.Set("UserAgent", http.Request.Headers.UserAgent.ToString());
            diagnostic.Set("ClientIp",  http.Connection.RemoteIpAddress?.ToString());
            diagnostic.Set("UserId",    http.User.FindFirst("sub")?.Value ?? "anonymous");
        };
    });
    // Every log line inside this request now carries CorrelationId and UserId,
    // with no method having to pass them along.
    app.Use(async (context, next) =&gt;
    {
        string correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
                               ?? Guid.NewGuid().ToString("N")[..8];
        using (LogContext.PushProperty("CorrelationId", correlationId))
        using (LogContext.PushProperty("UserId", context.User.FindFirst("sub")?.Value ?? "anonymous"))
        {
            context.Response.Headers["X-Correlation-Id"] = correlationId;
            await next();
        }
    });
    app.MapControllers();
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "The application failed to start");
}
finally
{
    // Serilog buffers. Without this the fatal entry above is never written.
    Log.CloseAndFlush();
}
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly ILogger&lt;OrdersController&gt; logger;
    public OrdersController(ILogger&lt;OrdersController&gt; logger) =&gt; this.logger = logger;
    [HttpPost]
    public IActionResult Create([FromBody] CreateOrderRequest request)
    {
        // WRONG: interpolation bakes the values into a string. Nothing is queryable,
        // and every message is a different template so they cannot be counted.
        //   logger.LogInformation($"Order for customer {request.CustomerId}");
        // RIGHT: named placeholders become properties you can filter and group by
        logger.LogInformation("Order placed by customer {CustomerId} for {Total}",
            request.CustomerId, request.Total);
        if (request.Total &gt; 10_000)
            // Unexpected but not a failure. Reserve Error for things needing action.
            logger.LogWarning("Unusually large order {Total} from customer {CustomerId}",
                request.Total, request.CustomerId);
        // NEVER destructure an entity. {@User} dumps every property, PasswordHash included.
        //   logger.LogInformation("Created for {@User}", user);
        // Log the id, or destructure a DTO you control.
        logger.LogInformation("Order summary {@Summary}",
            new { request.CustomerId, request.Total, ItemCount = request.Items.Count });
        return Ok();
    }
    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        // A wrong password is Information or Warning, never Error. Log the email
        // and the outcome. Never the password, and never the whole request body.
        logger.LogWarning("Failed login attempt for {Email}", request.Email);
        return Unauthorized();
    }
    [HttpGet("diagnostics")]
    public IActionResult Diagnostics()
    {
        // Without the check, the serialization runs even when Debug is disabled
        if (logger.IsEnabled(LogLevel.Debug))
            logger.LogDebug("Full state {State}",
                System.Text.Json.JsonSerializer.Serialize(new { cached = 42, pending = 7 }));
        return Ok();
    }
}
public record CreateOrderRequest(int CustomerId, decimal Total, List&lt;string&gt; Items);
public record LoginRequest(string Email, string Password);
/* appsettings.json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",                                   // cuts most of the noise
        "Microsoft.Hosting.Lifetime": "Information",
        "Microsoft.EntityFrameworkCore.Database.Command": "Warning",
        "System": "Warning"
      }
    },
    "WriteTo": [
      { "Name": "Console" },
      { "Name": "File", "Args": {
          "path": "logs/api-.log", "rollingInterval": "Day", "retainedFileCountLimit": 14 } },
      { "Name": "Seq", "Args": { "serverUrl": "http://localhost:5341" } }
    ],
    "Enrich": [ "FromLogContext", "WithMachineName" ]
  }
}
   Run Seq locally for a queryable log UI:
     docker run -d --name seq -e ACCEPT_EULA=Y -p 5341:80 datalust/seq
   Then query:  Total &gt; 100 and CustomerId = 92
*/
</code></pre>
