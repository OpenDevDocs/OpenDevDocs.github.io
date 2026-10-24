---
publishDate: 2026-09-15T14:10
title: Writing Custom Middleware
slug: writing-custom-middleware
metadescription: Write middleware three ways, inject scoped services correctly, read and buffer request and response bodies safely, and package it as a clean extension method.
updateDate: 2026-09-07T14:10
author: ['bishal-biswas']
level: 3
tags: ['middleware', 'pipeline', 'logging']
course: dotnet-webapi
---

## Three ways to write it

There is inline middleware, convention based middleware and factory based middleware. Each suits a different size of job.

## Inline, for something small

```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Powered-By"] = "BookStore API";
    await next();
});
```

Perfect for two or three lines. Beyond that, `Program.cs` gets crowded.

## Convention based, the usual choice

A plain class following a naming convention. There is no interface to implement, which looks like magic until you see the two rules.

```csharp
public class RequestLoggingMiddleware
{
    private readonly RequestDelegate next;
    private readonly ILogger<RequestLoggingMiddleware> logger;

    // Rule 1: the constructor takes RequestDelegate first
    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        this.next = next;
        this.logger = logger;
    }

    // Rule 2: a method called InvokeAsync taking HttpContext, returning Task
    public async Task InvokeAsync(HttpContext context)
    {
        logger.LogInformation("--> {Method} {Path}", context.Request.Method, context.Request.Path);

        await next(context);

        logger.LogInformation("<-- {Status}", context.Response.StatusCode);
    }
}
```

Register it:

```csharp
app.UseMiddleware<RequestLoggingMiddleware>();
```

**The lifetime detail that catches everyone:** middleware is created **once**, at startup. It is effectively a singleton. So the constructor can only take singletons.

Scoped services go in `InvokeAsync`, where the container injects them per request:

```csharp
public async Task InvokeAsync(HttpContext context, AppDbContext db, IAuditService audit)
{
    // db and audit are resolved fresh for THIS request
    await audit.LogAsync(context.Request.Path);
    await next(context);
}
```

Put a `DbContext` in the constructor and you get one context shared by every request for the life of the app. That is the captive dependency bug, and here it is not caught at startup.

## Factory based, when you want an interface

`IMiddleware` gives you a real interface and a per request lifetime:

```csharp
public class ApiKeyMiddleware : IMiddleware
{
    private readonly IApiKeyValidator validator;    // scoped is fine here

    public ApiKeyMiddleware(IApiKeyValidator validator) => this.validator = validator;

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        string? key = context.Request.Headers["X-Api-Key"];

        if (key is null || !await validator.IsValidAsync(key))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = "Invalid API key." });
            return;
        }

        await next(context);
    }
}
```

This one must be registered in DI as well as in the pipeline:

```csharp
builder.Services.AddScoped<ApiKeyMiddleware>();
app.UseMiddleware<ApiKeyMiddleware>();
```

Register it **scoped** and the constructor can take scoped services safely, because a new instance is created per request. The tradeoff is a small allocation per request, which is almost never measurable.

Use factory based middleware when you want the interface for testing or when constructor injection of scoped services makes the code clearer.

## Package it as an extension method

Callers should not have to remember the class name:

```csharp
public static class MiddlewareExtensions
{
    public static IApplicationBuilder UseRequestLogging(this IApplicationBuilder app)
        => app.UseMiddleware<RequestLoggingMiddleware>();

    public static IApplicationBuilder UseApiKeyAuth(this IApplicationBuilder app)
        => app.UseMiddleware<ApiKeyMiddleware>();
}
```

```csharp
app.UseRequestLogging();
app.UseApiKeyAuth();
```

Now it reads like the built in middleware, and you can add options later without changing every call site.

## Middleware with options

Pass configuration through the `UseMiddleware` call:

```csharp
public class RequestTimingOptions
{
    public int SlowRequestThresholdMs { get; set; } = 500;
}

public class RequestTimingMiddleware
{
    private readonly RequestDelegate next;
    private readonly RequestTimingOptions options;
    private readonly ILogger<RequestTimingMiddleware> logger;

    public RequestTimingMiddleware(
        RequestDelegate next,
        IOptions<RequestTimingOptions> options,
        ILogger<RequestTimingMiddleware> logger)
    {
        this.next = next;
        this.options = options.Value;
        this.logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var watch = Stopwatch.StartNew();
        await next(context);
        watch.Stop();

        if (watch.ElapsedMilliseconds > options.SlowRequestThresholdMs)
            logger.LogWarning("Slow request: {Path} took {Ms}ms",
                context.Request.Path, watch.ElapsedMilliseconds);
    }
}
```

```csharp
public static IApplicationBuilder UseRequestTiming(
    this IApplicationBuilder app, Action<RequestTimingOptions>? configure = null)
{
    if (configure is not null)
        app.ApplicationServices.GetRequiredService<IOptions<RequestTimingOptions>>();

    return app.UseMiddleware<RequestTimingMiddleware>();
}
```

```csharp
builder.Services.Configure<RequestTimingOptions>(o => o.SlowRequestThresholdMs = 200);
app.UseRequestTiming();
```

## Reading the request body

The request body is a **forward only stream**. Read it once and it is gone, so model binding downstream gets nothing.

To read it and still let the endpoint work, enable buffering and rewind:

```csharp
public async Task InvokeAsync(HttpContext context)
{
    context.Request.EnableBuffering();     // allows the stream to be re read

    using var reader = new StreamReader(
        context.Request.Body,
        Encoding.UTF8,
        detectEncodingFromByteOrderMarks: false,
        leaveOpen: true);                  // do NOT close the stream

    string body = await reader.ReadToEndAsync();

    context.Request.Body.Position = 0;     // rewind so model binding can read it

    logger.LogDebug("Body: {Body}", body);

    await next(context);
}
```

Three details, all of which cause bugs if missed. `EnableBuffering` must be called before reading. `leaveOpen: true` stops the reader disposing the stream. And the position must be reset to zero.

Two warnings. This buffers the whole body in memory, so guard it by size and content type. And request bodies contain passwords and card numbers, so never log them unfiltered.

## Reading the response body

Harder, because the response stream writes straight to the network. You have to swap in your own stream:

```csharp
public async Task InvokeAsync(HttpContext context)
{
    Stream original = context.Response.Body;
    using var buffer = new MemoryStream();
    context.Response.Body = buffer;

    try
    {
        await next(context);

        buffer.Position = 0;
        string responseText = await new StreamReader(buffer).ReadToEndAsync();

        logger.LogDebug("Response: {Body}", responseText);

        buffer.Position = 0;
        await buffer.CopyToAsync(original);      // send it on to the real stream
    }
    finally
    {
        context.Response.Body = original;        // always restore it
    }
}
```

This defeats streaming and buffers whole responses in memory. Use it for debugging in development, not in production.

## Always call next, or answer

Every path through your middleware must either call `next` or produce a response. Miss one and the request hangs until it times out:

```csharp
public async Task InvokeAsync(HttpContext context)
{
    if (context.Request.Path.StartsWithSegments("/health"))
    {
        // Bug: neither answers nor continues. The request hangs.
        return;
    }

    await next(context);
}
```

## Testing middleware

Middleware is testable without a server, using `DefaultHttpContext`:

```csharp
[Fact]
public async Task Missing_api_key_returns_401()
{
    var context = new DefaultHttpContext();
    context.Response.Body = new MemoryStream();

    bool nextCalled = false;
    RequestDelegate next = _ => { nextCalled = true; return Task.CompletedTask; };

    var middleware = new ApiKeyMiddleware(new AlwaysInvalidValidator());
    await middleware.InvokeAsync(context, next);

    Assert.Equal(401, context.Response.StatusCode);
    Assert.False(nextCalled);
}
```

Fast, and it proves the short circuit actually short circuits.

## Middleware or filter?

Both wrap a request. The dividing line is simple.

**Middleware** runs for every request, sees the raw `HttpContext`, and works before model binding. Use it for application wide concerns: logging, security headers, exception handling, API keys.

**Filters** run after routing and model binding, so they see the bound model and can replace the result. Use them for endpoint specific concerns: validating a request object, checking ownership of a resource.

If you need the typed request model, it has to be a filter. Middleware runs too early.

## Quick recap

- Inline `app.Use` for two or three lines. A class for anything larger.
- Convention based middleware needs a `RequestDelegate` constructor parameter and an `InvokeAsync(HttpContext)` method.
- It is created **once**, so the constructor takes singletons only. Scoped services go in `InvokeAsync`.
- `IMiddleware` gives you an interface and a per request instance, at the cost of a DI registration.
- Wrap registration in an extension method so it reads like built in middleware.
- To read the request body, call `EnableBuffering`, use `leaveOpen: true`, and reset `Position` to zero.
- Reading the response body means swapping the stream and restoring it in a `finally`.
- Every path must call `next` or write a response, or the request hangs.
- Test with `DefaultHttpContext` and a fake `RequestDelegate`.

<code id="code-content" class="language-csharp">
// Three styles of middleware, with the lifetime and stream traps handled.
using System.Diagnostics;
using System.Text;
using Microsoft.Extensions.Options;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddScoped&lt;IApiKeyValidator, ApiKeyValidator&gt;();
builder.Services.AddScoped&lt;ApiKeyMiddleware&gt;();          // IMiddleware must be registered
builder.Services.Configure&lt;RequestTimingOptions&gt;(o =&gt; o.SlowRequestThresholdMs = 200);
var app = builder.Build();
app.UseRequestTiming();      // convention based, with options
app.UseApiKeyAuth();         // factory based, can inject scoped services in its constructor
if (app.Environment.IsDevelopment())
    app.UseBodyLogging();    // buffers bodies in memory: development only
app.MapGet("/api/books", () =&gt; new[] { "Clean Code" });
app.Run();
// ---------- 1. Convention based. Created ONCE, so the constructor is singleton only.
public class RequestTimingMiddleware
{
    private readonly RequestDelegate next;                    // required, and first
    private readonly RequestTimingOptions options;
    private readonly ILogger&lt;RequestTimingMiddleware&gt; logger; // singleton: safe here
    public RequestTimingMiddleware(RequestDelegate next,
                                   IOptions&lt;RequestTimingOptions&gt; options,
                                   ILogger&lt;RequestTimingMiddleware&gt; logger)
        =&gt; (this.next, this.options, this.logger) = (next, options.Value, logger);
    // Scoped services belong HERE, injected per request. A DbContext in the
    // constructor above would be shared by every request for the life of the app.
    public async Task InvokeAsync(HttpContext context, IApiKeyValidator perRequestService)
    {
        var watch = Stopwatch.StartNew();
        await next(context);                                  // every path must call next or answer
        watch.Stop();
        if (watch.ElapsedMilliseconds &gt; options.SlowRequestThresholdMs)
            logger.LogWarning("Slow request: {Method} {Path} took {Ms}ms",
                context.Request.Method, context.Request.Path, watch.ElapsedMilliseconds);
    }
}
public class RequestTimingOptions { public int SlowRequestThresholdMs { get; set; } = 500; }
// ---------- 2. Factory based. A real interface, one instance per request.
public class ApiKeyMiddleware : IMiddleware
{
    private readonly IApiKeyValidator validator;    // scoped, and safe in the constructor
    private readonly ILogger&lt;ApiKeyMiddleware&gt; logger;
    public ApiKeyMiddleware(IApiKeyValidator validator, ILogger&lt;ApiKeyMiddleware&gt; logger)
        =&gt; (this.validator, this.logger) = (validator, logger);
    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        if (!context.Request.Path.StartsWithSegments("/api"))
        {
            await next(context);                              // not our concern, pass it on
            return;
        }
        string? key = context.Request.Headers["X-Api-Key"];
        if (key is null || !await validator.IsValidAsync(key))
        {
            logger.LogWarning("Rejected request to {Path}: bad API key", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = "A valid X-Api-Key is required." });
            return;                                           // short circuit, and it DID answer
        }
        await next(context);
    }
}
// ---------- 3. Body logging: the stream handling that people get wrong
public class BodyLoggingMiddleware
{
    private const int MaxBodyBytes = 4096;
    private readonly RequestDelegate next;
    private readonly ILogger&lt;BodyLoggingMiddleware&gt; logger;
    public BodyLoggingMiddleware(RequestDelegate next, ILogger&lt;BodyLoggingMiddleware&gt; logger)
        =&gt; (this.next, this.logger) = (next, logger);
    public async Task InvokeAsync(HttpContext context)
    {
        // --- request body: read it, then rewind so model binding still works
        if (context.Request.ContentLength is &gt; 0 and &lt;= MaxBodyBytes &amp;&amp;
            context.Request.ContentType?.Contains("json") == true)
        {
            context.Request.EnableBuffering();                // allows re reading
            using var reader = new StreamReader(context.Request.Body, Encoding.UTF8,
                detectEncodingFromByteOrderMarks: false, leaveOpen: true);  // do not close it
            string body = await reader.ReadToEndAsync();
            context.Request.Body.Position = 0;                // rewind, or binding gets nothing
            // Real bodies carry passwords and card numbers. Redact before logging.
            logger.LogDebug("Request body: {Body}", Redact(body));
        }
        // --- response body: swap the stream, copy it on, always restore
        Stream original = context.Response.Body;
        using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        try
        {
            await next(context);
            buffer.Position = 0;
            string responseText = await new StreamReader(buffer).ReadToEndAsync();
            logger.LogDebug("Response {Status}: {Body}", context.Response.StatusCode,
                responseText.Length &gt; MaxBodyBytes ? responseText[..MaxBodyBytes] : responseText);
            buffer.Position = 0;
            await buffer.CopyToAsync(original);               // send it to the real network stream
        }
        finally
        {
            context.Response.Body = original;                 // restore even if it threw
        }
    }
    private static string Redact(string json) =&gt; System.Text.RegularExpressions.Regex.Replace(
        json, "\"(password|token|cardNumber)\"\\s*:\\s*\"[^\"]*\"", "\"$1\":\"***\"",
        System.Text.RegularExpressions.RegexOptions.IgnoreCase);
}
// ---------- Extension methods so it reads like built in middleware
public static class MiddlewareExtensions
{
    public static IApplicationBuilder UseRequestTiming(this IApplicationBuilder app) =&gt;
        app.UseMiddleware&lt;RequestTimingMiddleware&gt;();
    public static IApplicationBuilder UseApiKeyAuth(this IApplicationBuilder app) =&gt;
        app.UseMiddleware&lt;ApiKeyMiddleware&gt;();
    public static IApplicationBuilder UseBodyLogging(this IApplicationBuilder app) =&gt;
        app.UseMiddleware&lt;BodyLoggingMiddleware&gt;();
}
public interface IApiKeyValidator { Task&lt;bool&gt; IsValidAsync(string key); }
public class ApiKeyValidator : IApiKeyValidator
{
    public Task&lt;bool&gt; IsValidAsync(string key) =&gt; Task.FromResult(key == "dev-key-123");
}
</code></pre>
