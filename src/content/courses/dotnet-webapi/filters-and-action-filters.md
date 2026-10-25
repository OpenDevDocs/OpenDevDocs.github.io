---
publishDate: 2026-09-16T14:30
title: Filters and Action Filters
slug: filters-and-action-filters
metadescription: Use the MVC filter pipeline to run code around your actions. Write action, result, exception and authorization filters, control their order, and inject services correctly.
updateDate: 2026-09-07T14:30
author: ['bishal-biswas']
level: 3
tags: ['filters', 'mvc', 'cross-cutting']
course: dotnet-webapi
---

## Where filters sit

Middleware wraps the whole request. Filters wrap the **action**, after routing and after model binding. That difference is the reason filters exist: a filter can see the bound model and can replace the result.

```text
Middleware
  └─ Routing
      └─ Authorization filters
          └─ Resource filters
              └─ Model binding
                  └─ Action filters
                      └─ ACTION METHOD
                  └─ Action filters
              └─ Exception filters
          └─ Result filters
              └─ RESULT EXECUTION
          └─ Result filters
```

## The five kinds

**Authorization filters** run first. They decide whether the request may continue at all.

**Resource filters** run just after authorization and wrap everything else, including model binding. Good for caching, because you can skip the whole pipeline.

**Action filters** run immediately before and after the action. They see the bound arguments and can change the result. This is the one you will write most often.

**Exception filters** catch exceptions thrown by the action. Narrower than a global handler, so use them only for something action specific.

**Result filters** run around the execution of the result, so before and after the response is written.

## Your first action filter

```csharp
public class LogActionFilter : IActionFilter
{
    private readonly ILogger<LogActionFilter> logger;

    public LogActionFilter(ILogger<LogActionFilter> logger) => this.logger = logger;

    public void OnActionExecuting(ActionExecutingContext context)
    {
        logger.LogInformation("Starting {Action} with {Count} arguments",
            context.ActionDescriptor.DisplayName, context.ActionArguments.Count);
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
        logger.LogInformation("Finished with {Result}", context.Result?.GetType().Name);
    }
}
```

Prefer the async version when you do any I/O:

```csharp
public class AuditFilter : IAsyncActionFilter
{
    private readonly IAuditService audit;

    public AuditFilter(IAuditService audit) => this.audit = audit;

    public async Task OnActionExecutionAsync(
        ActionExecutingContext context, ActionExecutionDelegate next)
    {
        await audit.RecordAsync(context.HttpContext.Request.Path);

        ActionExecutedContext executed = await next();     // runs the action

        if (executed.Exception is null)
            await audit.RecordSuccessAsync();
    }
}
```

Implement one or the other, never both. If a class implements both, only the async version runs.

## Short circuiting

Set `context.Result` before calling `next` and the action never runs:

```csharp
public class RequireTenantFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(
        ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!context.HttpContext.Request.Headers.ContainsKey("X-Tenant-Id"))
        {
            context.Result = new BadRequestObjectResult(new { error = "X-Tenant-Id is required." });
            return;                                        // the action never runs
        }

        await next();
    }
}
```

This is how validation and authorization filters work.

## Reading and changing arguments

`context.ActionArguments` holds the bound parameters by name. You can inspect and modify them:

```csharp
public void OnActionExecuting(ActionExecutingContext context)
{
    if (context.ActionArguments.TryGetValue("request", out object? value)
        && value is CreateBookRequest request)
    {
        // The model is already bound and validated by this point
    }

    // Force a maximum page size regardless of what the client asked for
    if (context.ActionArguments.TryGetValue("size", out object? size) && size is int s && s > 100)
        context.ActionArguments["size"] = 100;
}
```

Middleware cannot do this. It runs before binding, so there is no model to read.

## Changing the result

A result filter can rewrite what goes back:

```csharp
public class EnvelopeFilter : IAsyncResultFilter
{
    public async Task OnResultExecutionAsync(
        ResultExecutingContext context, ResultExecutionDelegate next)
    {
        if (context.Result is ObjectResult { Value: not null } result &&
            result.StatusCode is null or >= 200 and < 300)
        {
            result.Value = new
            {
                success = true,
                data = result.Value,
                timestamp = DateTime.UtcNow
            };
        }

        await next();
    }
}
```

Every successful response is now wrapped in an envelope, with no change to any action. Whether an envelope is a good API design is a separate argument, but the mechanism is useful.

## Four ways to apply a filter

**Globally**, to every action:

```csharp
builder.Services.AddControllers(options =>
{
    options.Filters.Add<AuditFilter>();
    options.Filters.Add(new RequireHttpsAttribute());
});
```

**On a controller**, to every action in it:

```csharp
[ServiceFilter(typeof(AuditFilter))]
public class BooksController : ControllerBase { }
```

**On an action:**

```csharp
[ServiceFilter(typeof(AuditFilter))]
[HttpPost]
public IActionResult Create(CreateBookRequest request) => Ok();
```

**As a plain attribute**, when the filter needs no dependencies:

```csharp
public class AddHeaderAttribute : ActionFilterAttribute
{
    private readonly string name;
    private readonly string value;

    public AddHeaderAttribute(string name, string value)
    {
        this.name = name;
        this.value = value;
    }

    public override void OnResultExecuting(ResultExecutingContext context)
    {
        context.HttpContext.Response.Headers[name] = value;
    }
}
```

```csharp
[AddHeader("X-Api-Version", "1.0")]
public IActionResult Get() => Ok();
```

## ServiceFilter and TypeFilter

A plain attribute cannot take constructor dependencies, because attribute arguments must be compile time constants. Two attributes solve this.

**`[ServiceFilter(typeof(T))]`** resolves the filter from DI, so it must be registered:

```csharp
builder.Services.AddScoped<AuditFilter>();
```

**`[TypeFilter(typeof(T))]`** creates the filter itself, resolving constructor dependencies from DI but not requiring registration. It also lets you pass extra arguments:

```csharp
[TypeFilter(typeof(CacheFilter), Arguments = new object[] { 60 })]
public IActionResult Get() => Ok();
```

Use `ServiceFilter` when you want to control the lifetime, and `TypeFilter` when you need to pass arguments.

## Order of execution

Filters run in a defined sequence. Within the same type, the **scope** decides:

```text
Global  →  Controller  →  Action        on the way in
Action  →  Controller  →  Global        on the way out
```

Override it with the `Order` property. Lower numbers run first on the way in:

```csharp
public class FirstFilter : ActionFilterAttribute
{
    public FirstFilter() => Order = 1;
}

public class SecondFilter : ActionFilterAttribute
{
    public SecondFilter() => Order = 2;
}
```

Explicit `Order` always beats scope, so a global filter with `Order = -1` runs before an action level filter with the default order of `0`.

## Filters and dependency injection

A filter resolved through `ServiceFilter` or `TypeFilter` can take any service in its constructor, including scoped ones. That is the main advantage over middleware, where scoped services have to be injected into `InvokeAsync`.

A filter registered globally by type is resolved per request too:

```csharp
options.Filters.Add<AuditFilter>();        // resolved from DI, scoped services fine
options.Filters.Add(new AuditFilter(...)); // an instance: effectively a singleton
```

Prefer the generic form.

## Real examples worth having

**Ownership check**, which needs the bound id and the current user:

```csharp
public class MustOwnResourceFilter : IAsyncActionFilter
{
    private readonly AppDbContext db;

    public MustOwnResourceFilter(AppDbContext db) => this.db = db;

    public async Task OnActionExecutionAsync(
        ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (context.ActionArguments.TryGetValue("id", out object? raw) && raw is int id)
        {
            string? userId = context.HttpContext.User.FindFirst("sub")?.Value;

            bool owns = await db.Books.AnyAsync(b => b.Id == id && b.OwnerId == userId);

            if (!owns)
            {
                context.Result = new ForbidResult();
                return;
            }
        }

        await next();
    }
}
```

**Simple response caching**, using a resource filter so even model binding is skipped:

```csharp
public class CacheFilter : IAsyncResourceFilter
{
    private readonly IMemoryCache cache;
    private readonly int seconds;

    public CacheFilter(IMemoryCache cache, int seconds)
    {
        this.cache = cache;
        this.seconds = seconds;
    }

    public async Task OnResourceExecutionAsync(
        ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        string key = context.HttpContext.Request.Path + context.HttpContext.Request.QueryString;

        if (cache.TryGetValue(key, out IActionResult? cached))
        {
            context.Result = cached;          // skip everything below
            return;
        }

        ResourceExecutedContext executed = await next();

        if (executed.Result is OkObjectResult ok)
            cache.Set(key, ok, TimeSpan.FromSeconds(seconds));
    }
}
```

## Filters or middleware?

**Middleware** for anything that applies to every request and does not need the model: security headers, HTTPS, CORS, global exception handling, request logging.

**Filters** for anything that needs the bound arguments, the matched action, or the ability to replace the result: validation, ownership checks, per action caching, response shaping.

If your code refers to a DTO or a specific action, it is a filter.

## Minimal APIs use endpoint filters

Filters are an MVC feature and do not apply to minimal APIs. The equivalent there is `AddEndpointFilter`, covered in the route groups topic. Same idea, simpler model, one kind instead of five.

## Quick recap

- Filters run inside the MVC pipeline, after routing and model binding, so they see the bound model.
- Five kinds: authorization, resource, action, exception and result.
- Action filters are the common case. Use the async interface when you do I/O.
- Set `context.Result` before calling `next` to short circuit the action.
- `ActionArguments` lets a filter read and even change bound parameters.
- Apply filters globally, per controller, per action, or as a plain attribute.
- `[ServiceFilter]` resolves from DI and needs registration. `[TypeFilter]` creates the filter and accepts arguments.
- Order is global, then controller, then action, unless you set `Order` explicitly.
- Use middleware for whole request concerns and filters for anything tied to an action.
- Minimal APIs use endpoint filters instead.

<code id="code-content" class="language-csharp">
// The five filter types, applied four different ways.
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Caching.Memory;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddMemoryCache();
builder.Services.AddScoped&lt;AuditActionFilter&gt;();     // required for [ServiceFilter]
builder.Services.AddControllers(options =&gt;
{
    // Global: runs for every action. Resolved from DI, so scoped services are fine.
    options.Filters.Add&lt;TimingFilter&gt;();
    options.Filters.Add&lt;EnvelopeResultFilter&gt;();
});
var app = builder.Build();
app.MapControllers();
app.Run();
// ---------- 1. Action filter: sees the bound arguments, can change them and the result
public class ClampPageSizeFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        // Middleware could not do this: it runs before model binding.
        if (context.ActionArguments.TryGetValue("size", out object? raw) &amp;&amp; raw is int size &amp;&amp; size &gt; 100)
            context.ActionArguments["size"] = 100;
    }
    public void OnActionExecuted(ActionExecutedContext context) { }
}
// ---------- 2. Async action filter with a dependency, and a short circuit
public class AuditActionFilter : IAsyncActionFilter
{
    private readonly ILogger&lt;AuditActionFilter&gt; logger;
    public AuditActionFilter(ILogger&lt;AuditActionFilter&gt; logger) =&gt; this.logger = logger;
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!context.HttpContext.Request.Headers.ContainsKey("X-Tenant-Id"))
        {
            context.Result = new BadRequestObjectResult(new { error = "X-Tenant-Id is required." });
            return;                                       // short circuit: the action never runs
        }
        logger.LogInformation("-&gt; {Action}", context.ActionDescriptor.DisplayName);
        ActionExecutedContext executed = await next();    // runs the action
        logger.LogInformation("&lt;- {Result}", executed.Result?.GetType().Name);
    }
}
// ---------- 3. Result filter: rewrites the response body for every successful action
public class EnvelopeResultFilter : IAsyncResultFilter
{
    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        if (context.Result is ObjectResult { Value: not null } result &amp;&amp;
            result.StatusCode is null or (&gt;= 200 and &lt; 300))
        {
            result.Value = new { success = true, data = result.Value, timestamp = DateTime.UtcNow };
        }
        await next();
    }
}
// ---------- 4. Resource filter: wraps model binding too, so a cache hit skips everything
public class CacheFilter : IAsyncResourceFilter
{
    private readonly IMemoryCache cache;
    private readonly int seconds;
    // The int comes from [TypeFilter(..., Arguments = new object[] { 60 })]
    public CacheFilter(IMemoryCache cache, int seconds) =&gt; (this.cache, this.seconds) = (cache, seconds);
    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        string key = context.HttpContext.Request.Path + context.HttpContext.Request.QueryString;
        if (cache.TryGetValue(key, out IActionResult? cached) &amp;&amp; cached is not null)
        {
            context.Result = cached;                      // skip binding, the action, everything
            return;
        }
        ResourceExecutedContext executed = await next();
        if (executed.Result is OkObjectResult ok)
            cache.Set(key, ok, TimeSpan.FromSeconds(seconds));
    }
}
// ---------- 5. A plain attribute filter, for when no dependencies are needed
public class AddHeaderAttribute : ActionFilterAttribute
{
    private readonly string name, value;
    public AddHeaderAttribute(string name, string value) =&gt; (this.name, this.value) = (name, value);
    public override void OnResultExecuting(ResultExecutingContext context) =&gt;
        context.HttpContext.Response.Headers[name] = value;
}
// A global timing filter with an explicit Order. Lower runs first on the way in,
// and explicit Order always beats scope.
public class TimingFilter : IAsyncActionFilter, IOrderedFilter
{
    public int Order =&gt; -100;                             // outermost of all our filters
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var watch = System.Diagnostics.Stopwatch.StartNew();
        await next();
        context.HttpContext.Response.Headers["X-Action-Ms"] = watch.ElapsedMilliseconds.ToString();
    }
}
[ApiController]
[Route("api/[controller]")]
[AddHeader("X-Api-Version", "1.0")]                       // controller scope: every action here
public class BooksController : ControllerBase
{
    // ServiceFilter resolves from DI, so the filter can take constructor dependencies
    [HttpGet]
    [ServiceFilter(typeof(AuditActionFilter))]
    [TypeFilter(typeof(ClampPageSizeFilter))]
    public IActionResult GetAll([FromQuery] int size = 20) =&gt;
        Ok(new { size, note = "size is clamped to 100 by the filter" });
    // TypeFilter creates the filter and can pass extra constructor arguments
    [HttpGet("popular")]
    [TypeFilter(typeof(CacheFilter), Arguments = new object[] { 60 })]
    public IActionResult Popular() =&gt; Ok(new[] { "Clean Code", "Refactoring" });
}
</code></pre>
