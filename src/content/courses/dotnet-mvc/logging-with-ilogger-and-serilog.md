---
publishDate: 2026-08-27T15:00
title: Logging with ILogger and Serilog
slug: logging-with-ilogger-and-serilog
metadescription: Write useful logs with ILogger, use structured message templates and log levels correctly, control what is logged with appsettings.json, and replace the default providers with Serilog to write to files, Seq or the cloud with enrichment and request logging.
updateDate: 2026-09-14T15:00
author: ['bishal-biswas']
level: 3
tags: ['logging', 'serilog', 'diagnostics']
course: dotnet-mvc
---

## You cannot fix what you cannot see

When something goes wrong in production, the logs are all you have. A good log tells you what happened, to whom, when, and what the app was doing at the time. A bad log says "Error occurred" and nothing else.

ASP.NET Core has logging built in. Every part of the framework writes to it, and your code should too. This topic covers the built in `ILogger`, then swaps in Serilog for real deployments.

## ILogger

Ask for `ILogger<T>` in any constructor. `T` is the class doing the logging, and it becomes the log's category:

```csharp
public class OrdersController : Controller
{
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(ILogger<OrdersController> logger)
    {
        _logger = logger;
    }

    public IActionResult Details(int id)
    {
        _logger.LogInformation("Showing order {OrderId}", id);
        return View();
    }
}
```

No registration needed. Logging is part of the host.

## Message templates, not string interpolation

Look at the message again:

```csharp
_logger.LogInformation("Showing order {OrderId}", id);
```

Not `$"Showing order {id}"`. The braces are a **template** and `id` is passed separately. This is called **structured logging**. The logging system keeps `OrderId = 42` as a named value alongside the text, so a log store can search for all entries with `OrderId = 42` or group by `OrderId`. With interpolation the number is just part of a string and that is lost.

Name placeholders in PascalCase, and pass values in the same order as the placeholders.

## Log levels

Each message has a level. Pick the one that matches how much someone should care:

| Level | Use for |
| --- | --- |
| `Trace` | Very detailed flow, usually off |
| `Debug` | Values useful while developing |
| `Information` | Normal events: order placed, user logged in |
| `Warning` | Something odd but handled: retry succeeded, cache miss on a hot key |
| `Error` | An operation failed: payment declined, exception caught |
| `Critical` | The app cannot continue: database unreachable at startup |

Pass the exception as the first argument when there is one, so the stack trace is captured:

```csharp
catch (Exception ex)
{
    _logger.LogError(ex, "Failed to charge order {OrderId}", order.Id);
    throw;
}
```

## Controlling what is logged

`appsettings.json` sets the minimum level per category:

```json
"Logging": {
  "LogLevel": {
    "Default": "Information",
    "Microsoft.AspNetCore": "Warning",
    "Microsoft.EntityFrameworkCore.Database.Command": "Information",
    "ShopApp.Services": "Debug"
  }
}
```

Categories match namespace prefixes. `ShopApp.Services` at Debug means every logger in that namespace emits Debug and above. The framework's own chatter is turned down to Warning so your logs are not buried.

Use `appsettings.Development.json` for a noisier setup locally and keep production quieter.

## Scopes

A scope attaches values to every log written inside it. Useful for tying together everything that happened during one operation:

```csharp
using (_logger.BeginScope("Processing order {OrderId} for {Customer}", order.Id, order.CustomerEmail))
{
    _logger.LogInformation("Checking stock");
    _logger.LogInformation("Charging card");
}
```

Both messages carry `OrderId` and `Customer` without repeating them. The framework already opens a scope per request with the request id, which is why you can trace one request across many log lines.

## Why Serilog

The default providers write to the console and the debug window. That is fine for development. In production you want files with rolling by date, or a log server you can search, with the structured values kept intact. **Serilog** is the most popular library for this and plugs straight into `ILogger`. Your logging code does not change at all.

## Installing Serilog

```bash
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.File
dotnet add package Serilog.Sinks.Seq
```

Sinks are destinations. Console comes with the main package. Add file, Seq, Application Insights, Elasticsearch or dozens of others.

## Configuring it

The recommended setup reads configuration from `appsettings.json` so operators can change it without a rebuild:

```csharp
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext());
```

```json
"Serilog": {
  "MinimumLevel": {
    "Default": "Information",
    "Override": {
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore": "Warning"
    }
  },
  "WriteTo": [
    { "Name": "Console" },
    {
      "Name": "File",
      "Args": {
        "path": "logs/shopapp-.log",
        "rollingInterval": "Day",
        "retainedFileCountLimit": 14,
        "outputTemplate": "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] {SourceContext} {Message:lj}{NewLine}{Exception}"
      }
    },
    { "Name": "Seq", "Args": { "serverUrl": "http://localhost:5341" } }
  ],
  "Enrich": [ "FromLogContext", "WithMachineName", "WithThreadId" ]
}
```

Replace the default `Logging` section with this `Serilog` one. The file sink creates one file per day and keeps two weeks. Seq is a free local log server with a search UI, worth running while developing.

## Request logging

Serilog can replace the framework's chatty per request logs with one clean line per request:

```csharp
app.UseSerilogRequestLogging();
```

Put it early in the pipeline, after the exception handler. Each request produces a line like:

```text
HTTP GET /Products/Details/5 responded 200 in 14.2 ms
```

With the method, path, status and duration as structured properties.

## Catching startup failures

Anything that throws before the host is built is not logged by the normal pipeline. The classic wrapper in `Program.cs`:

```csharp
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting up");
    // build and run the app
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application failed to start");
}
finally
{
    Log.CloseAndFlush();
}
```

`CloseAndFlush` makes sure buffered log entries are written before the process exits.

## What to log

- Business events at Information: order placed, payment received, user registered. With ids, not whole objects.
- Every caught exception at Error, with the exception object.
- Slow operations at Warning, with the duration.
- Never passwords, card numbers, tokens or full personal records. Logs are copied and kept for a long time.

## Quick recap

- Inject `ILogger<T>` and log with message templates and named placeholders, not string interpolation.
- Choose levels carefully and pass exceptions as the first argument.
- Control noise per namespace in the `Logging` section of `appsettings.json`.
- Scopes attach shared values to every log inside an operation.
- Serilog replaces the default providers through `UseSerilog` and writes to files, Seq or the cloud, configured from `appsettings.json`.
- `UseSerilogRequestLogging` gives one structured line per request, and a bootstrap logger catches startup failures.

<code id="code-content" class="language-csharp">
// Program.cs
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting ShopApp");

    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((context, services, configuration) =&gt; configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Application", "ShopApp"));

    builder.Services.AddControllersWithViews();
    builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
        o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

    var app = builder.Build();

    if (!app.Environment.IsDevelopment())
    {
        app.UseExceptionHandler("/Home/Error");
        app.UseHsts();
    }

    app.UseSerilogRequestLogging(options =&gt;
    {
        options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =&gt;
        {
            diagnosticContext.Set("UserName", httpContext.User.Identity?.Name);
            diagnosticContext.Set("ClientIp", httpContext.Connection.RemoteIpAddress?.ToString());
        };
    });

    app.UseHttpsRedirection();
    app.UseStaticFiles();
    app.UseRouting();
    app.UseAuthorization();
    app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "ShopApp failed to start");
}
finally
{
    Log.CloseAndFlush();
}

// appsettings.json
//
//   "Serilog": {
//     "MinimumLevel": {
//       "Default": "Information",
//       "Override": { "Microsoft.AspNetCore": "Warning", "Microsoft.EntityFrameworkCore": "Warning" }
//     },
//     "WriteTo": [
//       { "Name": "Console" },
//       { "Name": "File", "Args": { "path": "logs/shopapp-.log", "rollingInterval": "Day", "retainedFileCountLimit": 14 } },
//       { "Name": "Seq", "Args": { "serverUrl": "http://localhost:5341" } }
//     ],
//     "Enrich": [ "FromLogContext", "WithMachineName" ]
//   }

// Services/OrderService.cs
public class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    private readonly IPaymentGateway _payments;
    private readonly ILogger&lt;OrderService&gt; _logger;

    public OrderService(AppDbContext db, IPaymentGateway payments, ILogger&lt;OrderService&gt; logger)
    {
        _db = db;
        _payments = payments;
        _logger = logger;
    }

    public async Task&lt;Order&gt; PlaceAsync(Cart cart, string customerId)
    {
        using var scope = _logger.BeginScope("Placing order for {CustomerId} with {LineCount} lines", customerId, cart.Lines.Count);

        var order = new Order { CustomerId = customerId, Total = cart.Total };
        _db.Orders.Add(order);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Order {OrderId} saved with total {Total:C}", order.Id, order.Total);

        var watch = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await _payments.ChargeAsync(order);
            _logger.LogInformation("Order {OrderId} charged in {ElapsedMs} ms", order.Id, watch.ElapsedMilliseconds);
        }
        catch (PaymentException ex)
        {
            _logger.LogError(ex, "Payment failed for order {OrderId}", order.Id);
            order.Status = "PaymentFailed";
            await _db.SaveChangesAsync();
            throw;
        }

        if (watch.ElapsedMilliseconds &gt; 2000)
        {
            _logger.LogWarning("Payment gateway slow: {ElapsedMs} ms for order {OrderId}", watch.ElapsedMilliseconds, order.Id);
        }

        return order;
    }
}
</code></pre>
