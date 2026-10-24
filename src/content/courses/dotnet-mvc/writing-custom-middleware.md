---
publishDate: 2026-08-22T13:20
title: Writing Custom Middleware
slug: writing-custom-middleware
metadescription: Turn an inline app.Use lambda into a reusable middleware class with an InvokeAsync method, inject services correctly, register it with an extension method, and build practical examples for request logging, security headers and maintenance mode.
updateDate: 2026-09-14T13:20
author: ['bishal-biswas']
level: 3
tags: ['middleware', 'pipeline', 'advanced']
course: dotnet-mvc
---

## From lambda to class

The pipeline topic showed an inline middleware:

```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers["X-App-Version"] = "1.4.2";
    await next();
});
```

Inline is fine for a few lines. When the logic grows, or you want to test it, or reuse it in another project, turn it into a class. The shape is always the same.

## The middleware class

```csharp
public class AppVersionMiddleware
{
    private readonly RequestDelegate _next;

    public AppVersionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers["X-App-Version"] = "1.4.2";
        await _next(context);
    }
}
```

Three rules make a class a middleware:

1. The constructor takes a `RequestDelegate` called `next`. That is the rest of the pipeline.
2. There is a public method called `InvokeAsync` (or `Invoke`) that takes an `HttpContext` and returns a `Task`.
3. It calls `_next(context)` to continue, or does not, to short circuit.

There is no interface or base class. The framework finds the method by name.

## Registering it

```csharp
app.UseMiddleware<AppVersionMiddleware>();
```

The convention is to wrap that in an extension method so `Program.cs` reads like the built in calls:

```csharp
public static class AppVersionMiddlewareExtensions
{
    public static IApplicationBuilder UseAppVersion(this IApplicationBuilder app)
    {
        return app.UseMiddleware<AppVersionMiddleware>();
    }
}
```

```csharp
app.UseAppVersion();
```

## Lifetime and services

A middleware class is created **once**, when the app starts. That makes it a singleton. Two consequences follow:

- Constructor parameters must be singletons or things available at startup, such as `ILogger<T>`, `IOptions<T>` or `IWebHostEnvironment`.
- Scoped services such as a `DbContext` must **not** go in the constructor. Ask for them as parameters of `InvokeAsync` instead, and the framework resolves them per request:

```csharp
public async Task InvokeAsync(HttpContext context, AppDbContext db)
{
    // db is scoped to this request
    await _next(context);
}
```

Also avoid instance fields that change per request. Many requests run through the same instance at the same time.

## Example: request timing

```csharp
public class RequestTimingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestTimingMiddleware> _logger;

    public RequestTimingMiddleware(RequestDelegate next, ILogger<RequestTimingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var watch = Stopwatch.StartNew();

        await _next(context);

        watch.Stop();
        if (watch.ElapsedMilliseconds > 500)
        {
            _logger.LogWarning("Slow request: {Method} {Path} took {Ms} ms",
                context.Request.Method, context.Request.Path, watch.ElapsedMilliseconds);
        }
    }
}
```

The code after `await _next` runs when the response is complete. That is where timing, cleanup and response inspection go.

## Example: maintenance mode

This one short circuits. When a flag is on, every request gets a 503 page and nothing further runs:

```csharp
public class MaintenanceModeMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IOptionsMonitor<MaintenanceOptions> _options;

    public MaintenanceModeMiddleware(RequestDelegate next, IOptionsMonitor<MaintenanceOptions> options)
    {
        _next = next;
        _options = options;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (_options.CurrentValue.Enabled && !context.Request.Path.StartsWithSegments("/admin"))
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.ContentType = "text/html";
            await context.Response.WriteAsync("<h1>Back soon</h1><p>We are doing some maintenance.</p>");
            return;
        }

        await _next(context);
    }
}
```

`IOptionsMonitor` reads the current value each time, so flipping the setting in `appsettings.json` takes effect without a restart.

## Example: security headers

A middleware is the natural home for headers every response should carry:

```csharp
public async Task InvokeAsync(HttpContext context)
{
    context.Response.OnStarting(() =>
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        return Task.CompletedTask;
    });

    await _next(context);
}
```

`OnStarting` runs just before headers are sent. It is the safe place to set headers when you are not sure whether something further down will write the response first. Setting headers after the body has started throws.

## Rules about the response

- You cannot change headers or the status code after the body has started to be written. Set them before `await _next` or in `OnStarting`.
- Do not read `context.Request.Body` unless you enable buffering first with `context.Request.EnableBuffering()`, and reset the position afterwards, or the model binder will find an empty body.
- To inspect the response body, swap `context.Response.Body` for a `MemoryStream` before calling `_next`, then copy it to the original stream. This is expensive and best avoided.

## Passing data down the pipeline

`context.Items` is a per request dictionary. A middleware can put something there for later components to read:

```csharp
context.Items["TenantId"] = tenantId;
await _next(context);
```

```csharp
var tenantId = (int)HttpContext.Items["TenantId"]!;
```

For anything more structured, write it to a scoped service that both the middleware and the controller ask for.

## Factory based middleware

There is a second style that implements `IMiddleware`. The class is then created **per request** through DI, so scoped services can go in the constructor. The trade off is that you must register the class as a service too:

```csharp
public class TenantMiddleware : IMiddleware
{
    private readonly AppDbContext _db;
    public TenantMiddleware(AppDbContext db) => _db = db;

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        // use _db
        await next(context);
    }
}
```

```csharp
builder.Services.AddScoped<TenantMiddleware>();
app.UseMiddleware<TenantMiddleware>();
```

Use this when the middleware needs several scoped services and the `InvokeAsync` parameter list would get long.

## Ordering your middleware

Put your middleware where it makes sense relative to the built in ones:

- Security headers and timing: early, right after the exception handler.
- Maintenance mode: before static files if the maintenance page should block those too, otherwise after.
- Anything that needs the user: after `UseAuthentication`.
- Anything that needs to know which endpoint matched: after `UseRouting`, and read `context.GetEndpoint()`.

## Quick recap

- A middleware class has a constructor taking `RequestDelegate` and an `InvokeAsync(HttpContext)` method.
- Register it with `UseMiddleware<T>()`, usually wrapped in a `UseSomething` extension method.
- The class is a singleton, so inject scoped services as `InvokeAsync` parameters, not in the constructor.
- Code before `await _next` runs on the way in, code after runs on the way out, and skipping `_next` short circuits.
- Set headers before the body starts, or in `OnStarting`.
- Use `context.Items` or a scoped service to pass data to later components.

<code id="code-content" class="language-csharp">
// Middleware/RequestTimingMiddleware.cs
using System.Diagnostics;

public class RequestTimingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger&lt;RequestTimingMiddleware&gt; _logger;

    public RequestTimingMiddleware(RequestDelegate next, ILogger&lt;RequestTimingMiddleware&gt; logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var watch = Stopwatch.StartNew();
        context.Response.OnStarting(() =&gt;
        {
            context.Response.Headers["X-Response-Time-Ms"] = watch.ElapsedMilliseconds.ToString();
            return Task.CompletedTask;
        });

        await _next(context);

        watch.Stop();
        if (watch.ElapsedMilliseconds &gt; 500)
        {
            _logger.LogWarning("Slow request: {Method} {Path} took {Ms} ms",
                context.Request.Method, context.Request.Path, watch.ElapsedMilliseconds);
        }
    }
}

// Middleware/MaintenanceModeMiddleware.cs
public class MaintenanceOptions
{
    public bool Enabled { get; set; }
    public string Message { get; set; } = "We are doing some maintenance. Back soon.";
}

public class MaintenanceModeMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IOptionsMonitor&lt;MaintenanceOptions&gt; _options;

    public MaintenanceModeMiddleware(RequestDelegate next, IOptionsMonitor&lt;MaintenanceOptions&gt; options)
    {
        _next = next;
        _options = options;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var opts = _options.CurrentValue;
        var isAdmin = context.Request.Path.StartsWithSegments("/admin");

        if (opts.Enabled &amp;&amp; !isAdmin)
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.Headers["Retry-After"] = "600";
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.WriteAsync($"&lt;h1&gt;Back soon&lt;/h1&gt;&lt;p&gt;{opts.Message}&lt;/p&gt;");
            return;                                   // short circuit
        }

        await _next(context);
    }
}

// Middleware/TenantMiddleware.cs (scoped service as an InvokeAsync parameter)
public class TenantMiddleware
{
    private readonly RequestDelegate _next;
    public TenantMiddleware(RequestDelegate next) =&gt; _next = next;

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        var host = context.Request.Host.Host;
        var tenant = await db.Tenants.FirstOrDefaultAsync(t =&gt; t.Domain == host);

        if (tenant is null)
        {
            context.Response.StatusCode = 404;
            await context.Response.WriteAsync("Unknown site.");
            return;
        }

        context.Items["Tenant"] = tenant;
        await _next(context);
    }
}

// Middleware/MiddlewareExtensions.cs
public static class MiddlewareExtensions
{
    public static IApplicationBuilder UseRequestTiming(this IApplicationBuilder app) =&gt;
        app.UseMiddleware&lt;RequestTimingMiddleware&gt;();

    public static IApplicationBuilder UseMaintenanceMode(this IApplicationBuilder app) =&gt;
        app.UseMiddleware&lt;MaintenanceModeMiddleware&gt;();

    public static IApplicationBuilder UseTenantResolution(this IApplicationBuilder app) =&gt;
        app.UseMiddleware&lt;TenantMiddleware&gt;();
}

// Program.cs
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
builder.Services.Configure&lt;MaintenanceOptions&gt;(builder.Configuration.GetSection("Maintenance"));
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt; o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

var app = builder.Build();

app.UseExceptionHandler("/Home/Error");
app.UseRequestTiming();
app.UseMaintenanceMode();
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseTenantResolution();
app.UseAuthorization();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();

// Controllers/HomeController.cs (reading what the middleware left behind)
public class HomeController : Controller
{
    public IActionResult Index()
    {
        var tenant = (Tenant)HttpContext.Items["Tenant"]!;
        ViewData["Title"] = tenant.Name;
        return View();
    }
}
</code></pre>
