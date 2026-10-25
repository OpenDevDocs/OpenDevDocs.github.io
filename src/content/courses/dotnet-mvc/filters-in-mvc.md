---
publishDate: 2026-08-23T13:30
title: Filters in MVC
slug: filters-in-mvc
metadescription: Learn the five filter types, authorization, resource, action, exception and result, where each runs in the action pipeline, how to write filters as attributes or services, and how to apply them to one action, one controller or the whole app.
updateDate: 2026-09-14T13:30
author: ['bishal-biswas']
level: 3
tags: ['filters', 'attributes', 'pipeline']
course: dotnet-mvc
---

## Code that wraps actions

Middleware wraps the whole request. **Filters** wrap the action. They run inside the MVC endpoint, after routing has chosen the action and before or after it executes, and they know about MVC things: the controller, the action, the arguments, model state and the result.

You have already used filters. `[Authorize]`, `[ValidateAntiForgeryToken]` and `[ResponseCache]` are all filters. This topic shows how they work and how to write your own.

## The five types

Filters run in a fixed order, each type at its own stage:

```text
1. Authorization filters     Is the user allowed? Runs first, can stop everything.
2. Resource filters          Wrap everything below, including model binding. Good for caching.
      Model binding happens here
3. Action filters            Run just before and just after the action method.
4. Exception filters         Handle exceptions thrown by the action or later filters.
5. Result filters            Run just before and just after the result (usually a view) executes.
```

For most needs you will write action filters and the occasional exception or result filter.

## Writing an action filter

The easiest way is to inherit from `ActionFilterAttribute` and override the method you need:

```csharp
public class LogActionAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var name = context.ActionDescriptor.DisplayName;
        Console.WriteLine($"Starting {name}");
    }

    public override void OnActionExecuted(ActionExecutedContext context)
    {
        var name = context.ActionDescriptor.DisplayName;
        Console.WriteLine($"Finished {name}");
    }
}
```

Apply it to an action or a controller:

```csharp
[LogAction]
public class ProductsController : Controller
{
}
```

`OnActionExecuting` runs before the action. It can inspect `context.ActionArguments` (the bound parameters) and `context.ModelState`. Setting `context.Result` here skips the action entirely.

`OnActionExecuted` runs after. It can inspect or replace `context.Result` and see `context.Exception`.

## A useful one: validate model state

Instead of writing `if (!ModelState.IsValid) return View(model);` in every POST action, a filter can do it:

```csharp
public class ValidateModelAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.ModelState.IsValid)
        {
            var controller = (Controller)context.Controller;
            var model = context.ActionArguments.Values.FirstOrDefault();
            context.Result = controller.View(model);
        }
    }
}
```

With `[ValidateModel]` on the action, the view is returned with errors before the action body runs. Some teams love this, others prefer the explicit check. Both are fine.

## The async version

For filters that await something, implement `IAsyncActionFilter` instead:

```csharp
public class TimingFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var watch = Stopwatch.StartNew();

        var executed = await next();    // runs the action

        watch.Stop();
        executed.HttpContext.Response.Headers["X-Action-Ms"] = watch.ElapsedMilliseconds.ToString();
    }
}
```

`next()` runs the action and returns the executed context. Code before it is "executing", code after is "executed". Implement one or the other, not both the sync and async interfaces.

## Filters with dependencies

An attribute cannot receive services through its constructor, because attributes are created by the compiler. Two attributes get around that.

`[TypeFilter]` creates the filter through DI, so it can have constructor parameters:

```csharp
public class AuditFilter : IAsyncActionFilter
{
    private readonly IAuditLog _audit;
    public AuditFilter(IAuditLog audit) => _audit = audit;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        await _audit.RecordAsync(context.HttpContext.User.Identity?.Name, context.ActionDescriptor.DisplayName);
        await next();
    }
}
```

```csharp
[TypeFilter(typeof(AuditFilter))]
public IActionResult Delete(int id)
```

`[ServiceFilter]` does the same but requires the filter to be registered as a service first, which lets you control its lifetime:

```csharp
builder.Services.AddScoped<AuditFilter>();
```

```csharp
[ServiceFilter(typeof(AuditFilter))]
```

## Exception filters

An exception filter turns an exception into a result. It only sees exceptions from the action and from action or result filters, not from middleware or model binding:

```csharp
public class NotFoundExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is EntityNotFoundException)
        {
            context.Result = new NotFoundResult();
            context.ExceptionHandled = true;
        }
    }
}
```

With this applied, a service can throw `EntityNotFoundException` and the user gets a 404 instead of a 500. Set `ExceptionHandled` or the exception keeps going.

## Result filters

A result filter runs around the result execution, which for a view means around rendering:

```csharp
public class AddFooterDataAttribute : ResultFilterAttribute
{
    public override void OnResultExecuting(ResultExecutingContext context)
    {
        if (context.Result is ViewResult view)
        {
            view.ViewData["Year"] = DateTime.UtcNow.Year;
        }
    }
}
```

This adds a value to every view without touching the actions. A view component or `@inject` is often cleaner for real data, but result filters are the tool when you must touch the result itself, for example to add a header to file downloads.

## Global filters

To apply a filter to every action in the app, add it when registering MVC:

```csharp
builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add<TimingFilter>();
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});
```

`AutoValidateAntiforgeryTokenAttribute` is a good example. Applied globally, every POST is protected and you never forget `[ValidateAntiForgeryToken]` again.

## Scope and order

Filters at three levels combine: global, then controller, then action. For "executing" methods they run global first, action last. For "executed" methods the order reverses, like nested boxes.

Within the same level, the `Order` property decides. Lower values run first. Most filters leave it at the default.

## Filters or middleware?

| Question | Use |
| --- | --- |
| Does it apply to static files and non MVC endpoints too? | Middleware |
| Does it need the action, arguments or model state? | Filter |
| Does it need to swap the result? | Filter |
| Does it need to run only for certain controllers? | Filter |
| Is it about the whole request lifecycle, such as timing or headers? | Middleware |

When both would work, prefer middleware. It is simpler and more general.

## Quick recap

- Filters wrap the action inside the MVC endpoint and run in a fixed order: authorization, resource, action, exception, result.
- Inherit from `ActionFilterAttribute` for simple attributes, or implement `IAsyncActionFilter` for async work.
- Set `context.Result` in an executing method to skip the action.
- Use `[TypeFilter]` or `[ServiceFilter]` when a filter needs services from DI.
- Exception filters map exceptions to results, and result filters wrap view rendering.
- Add filters globally in `AddControllersWithViews` to apply them everywhere.

<code id="code-content" class="language-csharp">
// Filters/ValidateModelAttribute.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

public class ValidateModelAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        if (context.ModelState.IsValid) return;

        var controller = (Controller)context.Controller;
        var model = context.ActionArguments.Values.FirstOrDefault(v =&gt; v is not null &amp;&amp; !v.GetType().IsPrimitive);
        context.Result = controller.View(model);
    }
}

// Filters/AuditFilter.cs (needs a service, so it is used through TypeFilter)
public class AuditFilter : IAsyncActionFilter
{
    private readonly IAuditLog _audit;
    public AuditFilter(IAuditLog audit) =&gt; _audit = audit;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User.Identity?.Name ?? "anonymous";
        var action = context.ActionDescriptor.DisplayName ?? "";
        var id = context.ActionArguments.TryGetValue("id", out var v) ? v?.ToString() : null;

        await _audit.RecordAsync(user, action, id);
        await next();
    }
}

// Filters/NotFoundExceptionFilter.cs
public class EntityNotFoundException : Exception
{
    public EntityNotFoundException(string message) : base(message) { }
}

public class NotFoundExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is EntityNotFoundException)
        {
            context.Result = new ViewResult { ViewName = "NotFound", StatusCode = 404 };
            context.ExceptionHandled = true;
        }
    }
}

// Filters/TimingFilter.cs (global)
public class TimingFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var watch = System.Diagnostics.Stopwatch.StartNew();
        var executed = await next();
        watch.Stop();
        executed.HttpContext.Response.Headers["X-Action-Ms"] = watch.ElapsedMilliseconds.ToString();
    }
}

// Program.cs
builder.Services.AddScoped&lt;IAuditLog, DbAuditLog&gt;();
builder.Services.AddControllersWithViews(options =&gt;
{
    options.Filters.Add&lt;TimingFilter&gt;();
    options.Filters.Add&lt;NotFoundExceptionFilter&gt;();
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});

// Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private readonly IProductService _products;
    public ProductsController(IProductService products) =&gt; _products = products;

    // The service throws EntityNotFoundException; the filter turns it into a 404 view.
    public async Task&lt;IActionResult&gt; Details(int id) =&gt;
        View(await _products.GetAsync(id));

    [HttpPost]
    [ValidateModel]                            // returns the view with errors before the body runs
    public async Task&lt;IActionResult&gt; Create(CreateProductViewModel vm)
    {
        await _products.CreateAsync(vm);
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [TypeFilter(typeof(AuditFilter))]          // who deleted what, recorded before the action
    public async Task&lt;IActionResult&gt; Delete(int id)
    {
        await _products.DeleteAsync(id);
        return RedirectToAction(nameof(Index));
    }
}
</code></pre>
