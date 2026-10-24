---
publishDate: 2026-08-22T13:10
title: Error Handling and Custom Error Pages
slug: error-handling-and-custom-error-pages
metadescription: Show detailed errors in development and friendly pages in production with UseExceptionHandler, add custom 404 and 500 pages with UseStatusCodePagesWithReExecute, log exceptions, and avoid leaking details to users.
updateDate: 2026-09-14T13:10
author: ['bishal-biswas']
level: 2
tags: ['error-handling', 'middleware', 'exceptions']
course: dotnet-mvc
---

## Errors will happen

A database goes down. A user types a product id that does not exist. A bug slips through. What the user sees at that moment says a lot about your app. A stack trace with file paths and SQL looks broken and leaks information. A blank page is confusing. A clear "Something went wrong, we have been notified" page with a link home is what you want.

ASP.NET Core gives you the tools. This topic wires them up.

## Two kinds of failure

**Exceptions** are unexpected. The code threw, the action never finished. These become 500 responses.

**Status codes** are expected. The action returned `NotFound()` or authorization said no. These are 404, 403 and friends, and there is no exception involved.

Each kind needs its own handling.

## Development: the developer exception page

In development you want every detail. The template sets this up:

```csharp
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
```

When an action throws, you get a page with the exception type, message, stack trace, the query string, cookies and headers. It is the fastest way to see what broke. It must never run in production.

Newer templates leave this line out because `WebApplication` enables the developer exception page automatically in the Development environment. Writing it explicitly does no harm.

## Production: the exception handler

For every other environment, the template uses:

```csharp
app.UseExceptionHandler("/Home/Error");
app.UseHsts();
```

When something throws, this middleware catches it, sets the status to 500, and **re executes** the pipeline for the path `/Home/Error`. The user sees whatever that action renders, and the URL in the address bar stays the same as the page that failed.

The template's `Error` action and view are basic. Improve them a little:

```csharp
[ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
public IActionResult Error()
{
    var feature = HttpContext.Features.Get<IExceptionHandlerPathFeature>();

    if (feature is not null)
    {
        _logger.LogError(feature.Error, "Unhandled exception at {Path}", feature.Path);
    }

    return View(new ErrorViewModel
    {
        RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier
    });
}
```

`IExceptionHandlerPathFeature` gives you the original exception and path so you can log them. The `RequestId` shown on the page lets a user quote it to support, and you can search your logs for it.

Do not show `feature.Error.Message` to the user. Log it, then show a generic message.

## Custom pages for status codes

`UseExceptionHandler` does nothing for a 404, because nothing threw. By default the user gets an empty response with the status code. Add this after the exception handler:

```csharp
app.UseStatusCodePagesWithReExecute("/Error/{0}");
```

Whenever a response would go out with a 4xx or 5xx status and an empty body, this re executes the pipeline for `/Error/404`, `/Error/403` and so on. The `{0}` is replaced with the code.

Write a controller to handle it:

```csharp
public class ErrorController : Controller
{
    [Route("Error/{statusCode:int}")]
    public IActionResult Index(int statusCode)
    {
        var feature = HttpContext.Features.Get<IStatusCodeReExecuteFeature>();
        ViewData["OriginalPath"] = feature?.OriginalPath;

        return statusCode switch
        {
            404 => View("NotFound"),
            403 => View("Forbidden"),
            _ => View("Generic", statusCode)
        };
    }
}
```

`IStatusCodeReExecuteFeature` tells you which path the user asked for, useful on a 404 page that suggests alternatives.

There is also `UseStatusCodePagesWithRedirects`, which sends a redirect to the error page instead. Avoid it. The redirect changes the status code to 302 and then 200, so browsers and search engines think the missing page exists. Re execute keeps the real status.

## Which requests are covered

Both middlewares only act when the response body is empty. If your action returns `View("NotFound")` itself with a 404 status, it is left alone. This means you can handle a not found case locally with a specific page and let the middleware handle the generic ones.

Errors thrown while writing the response, after headers have been sent, cannot be caught. They are rare and usually mean a view threw halfway through rendering.

## Handling errors in actions

Some failures are better handled where they happen. A missing record is not an error:

```csharp
var product = await _db.Products.FindAsync(id);
if (product is null)
{
    return NotFound();
}
```

A failed external call might deserve a specific message:

```csharp
try
{
    await _payments.ChargeAsync(order);
}
catch (PaymentDeclinedException ex)
{
    ModelState.AddModelError("", ex.Message);
    return View(order);
}
```

Catch what you can do something about. Let everything else bubble up to the middleware, which logs it and shows the generic page. Wrapping every action in try catch that just logs and rethrows is noise.

## Exception filters

For errors tied to MVC actions, an exception filter can turn specific exceptions into results. For example, a `NotFoundException` thrown by a service could become a 404 view. The filters topic shows how. The middleware still handles anything the filter does not.

## Error pages for AJAX

A JavaScript call that gets an HTML error page cannot do much with it. Check the `Accept` header and return JSON instead:

```csharp
if (Request.Headers.Accept.ToString().Contains("application/json"))
{
    return StatusCode(500, new { error = "Something went wrong", requestId });
}
```

Or use an exception filter on API controllers that always returns a problem details object.

## Logging

Every unhandled exception should reach the logs. `UseExceptionHandler` logs it automatically at Error level with the full stack trace. Your `Error` action does not need to log again unless you want extra context. The logging topic covers where those logs go.

## Checklist

- Developer exception page in development only.
- `UseExceptionHandler` first in the production pipeline.
- `UseStatusCodePagesWithReExecute` right after it for 404 and 403 pages.
- Error views use a plain layout that does not depend on the database or services, or they may fail too.
- Never show exception messages or stack traces to users.
- Show a request id and log it.

## Quick recap

- Exceptions become 500 responses handled by `UseExceptionHandler`, which re executes the pipeline for an error action.
- Expected status codes such as 404 are handled by `UseStatusCodePagesWithReExecute("/Error/{0}")`.
- Use re execute, not redirects, so the real status code is preserved.
- Read `IExceptionHandlerPathFeature` and `IStatusCodeReExecuteFeature` for details to log and display.
- Handle expected failures inside actions and let the rest bubble up.
- Keep the developer exception page out of production and never leak error details.

<code id="code-content" class="language-csharp">
// Program.cs
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseStatusCodePagesWithReExecute("/Error/{0}");

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();

// Models/ErrorViewModel.cs
public class ErrorViewModel
{
    public string? RequestId { get; set; }
    public bool ShowRequestId =&gt; !string.IsNullOrEmpty(RequestId);
}

// Controllers/HomeController.cs
using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;

public class HomeController : Controller
{
    private readonly ILogger&lt;HomeController&gt; _logger;
    public HomeController(ILogger&lt;HomeController&gt; logger) =&gt; _logger = logger;

    public IActionResult Index() =&gt; View();

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        var feature = HttpContext.Features.Get&lt;IExceptionHandlerPathFeature&gt;();
        if (feature is not null)
        {
            _logger.LogError(feature.Error, "Unhandled exception at {Path}", feature.Path);
        }

        return View(new ErrorViewModel
        {
            RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier
        });
    }
}

// Controllers/ErrorController.cs
public class ErrorController : Controller
{
    private readonly ILogger&lt;ErrorController&gt; _logger;
    public ErrorController(ILogger&lt;ErrorController&gt; logger) =&gt; _logger = logger;

    [Route("Error/{statusCode:int}")]
    public IActionResult Index(int statusCode)
    {
        var feature = HttpContext.Features.Get&lt;IStatusCodeReExecuteFeature&gt;();
        var originalPath = feature?.OriginalPath ?? "";
        ViewData["OriginalPath"] = originalPath;

        if (statusCode == 404)
        {
            _logger.LogWarning("404 for {Path}", originalPath);
            return View("NotFound");
        }

        if (statusCode == 403)
        {
            return View("Forbidden");
        }

        return View("Generic", statusCode);
    }
}

// Views/Shared/Error.cshtml
//
//   @model ErrorViewModel
//   @{ ViewData["Title"] = "Error"; }
//   &lt;h1&gt;Something went wrong&lt;/h1&gt;
//   &lt;p&gt;We have been notified and are looking into it.&lt;/p&gt;
//   @if (Model.ShowRequestId)
//   {
//       &lt;p class="text-muted"&gt;Request ID: &lt;code&gt;@Model.RequestId&lt;/code&gt;&lt;/p&gt;
//   }
//   &lt;a asp-controller="Home" asp-action="Index"&gt;Go to the home page&lt;/a&gt;

// Views/Error/NotFound.cshtml
//
//   @{ ViewData["Title"] = "Page not found"; }
//   &lt;h1&gt;We could not find that page&lt;/h1&gt;
//   &lt;p&gt;The address &lt;code&gt;@ViewData["OriginalPath"]&lt;/code&gt; does not exist.&lt;/p&gt;
//   &lt;a asp-controller="Products" asp-action="Index"&gt;Browse products&lt;/a&gt;
</code></pre>
