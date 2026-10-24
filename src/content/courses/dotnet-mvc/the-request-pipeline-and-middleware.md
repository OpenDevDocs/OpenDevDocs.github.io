---
publishDate: 2026-08-21T13:00
title: The Request Pipeline and Middleware
slug: the-request-pipeline-and-middleware
metadescription: Understand how every request flows through a chain of middleware in Program.cs, why the order of Use calls matters, what the built in middleware does, and how short circuiting works.
updateDate: 2026-09-14T13:00
author: ['bishal-biswas']
level: 2
tags: ['middleware', 'pipeline', 'program-cs']
course: dotnet-mvc
---

## What happens before your action runs

When a request arrives, it does not go straight to a controller. It passes through a chain of components called **middleware**. Each one can look at the request, change it, do something, and then either pass it on to the next or stop and write a response itself.

The response comes back through the same chain in reverse. So every middleware gets two chances: once on the way in and once on the way out.

```text
Request  -->  HTTPS redirect  -->  Static files  -->  Routing  -->  Auth  -->  Endpoint (your action)
Response <--  HTTPS redirect  <--  Static files  <--  Routing  <--  Auth  <--  Endpoint
```

This chain is the **request pipeline**, and you build it in `Program.cs` with the `app.Use...` calls.

## The pipeline in the template

```csharp
var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
```

Each `Use` line adds one middleware. `MapControllerRoute` adds the last one, the endpoint that runs your controller. Reading top to bottom is reading the order a request travels.

## What each one does

**UseExceptionHandler**: catches any exception thrown further down and re runs the pipeline for `/Home/Error` so the user sees a friendly page. It is first so it can catch everything.

**UseHsts**: adds a header that tells browsers to only use HTTPS for this site in future.

**UseHttpsRedirection**: sends any `http://` request a redirect to `https://`.

**UseStaticFiles**: if the path matches a file in `wwwroot`, sends the file and stops. Nothing after this runs for a CSS file, which is why it comes before routing and authentication.

**UseRouting**: looks at the URL and decides which endpoint will handle it. It does not run the endpoint yet, it just records the decision.

**UseAuthentication**: reads the authentication cookie or token and sets `HttpContext.User`.

**UseAuthorization**: checks whether that user is allowed to reach the chosen endpoint, using `[Authorize]` attributes.

**MapControllerRoute**: runs the endpoint. The controller is created, model binding happens, the action runs, the view renders.

## Order matters

Because each middleware only sees what earlier ones let through, the order is not a matter of style:

- Authorization must come after routing, because it needs to know which endpoint was chosen to read its `[Authorize]` attribute.
- Authorization must come after authentication, because it needs to know who the user is.
- Static files come before authentication so images and CSS do not cost an authentication check. If some files must be protected, serve them from an action instead.
- The exception handler comes first so it wraps everything.
- `UseSession` goes after `UseRouting` and before the endpoints.

Getting this wrong produces confusing errors. If `[Authorize]` seems to be ignored, check that `UseAuthorization` is after `UseRouting`. If `User.Identity` is always empty, check that `UseAuthentication` is present and before `UseAuthorization`.

## Short circuiting

A middleware that writes a response and does not call the next one **short circuits** the pipeline. Static files does this on a match. HTTPS redirection does it for HTTP requests. Authorization does it with a 401 or 403.

You can add your own with `app.Run`, which is always the end of the chain:

```csharp
app.Run(async context =>
{
    await context.Response.WriteAsync("Nothing else runs after this.");
});
```

## Branching with Map and MapWhen

`Map` sends requests with a certain path prefix down a separate branch:

```csharp
app.Map("/health", branch =>
{
    branch.Run(async context => await context.Response.WriteAsync("OK"));
});
```

`MapWhen` branches on any condition:

```csharp
app.MapWhen(
    context => context.Request.Query.ContainsKey("debug"),
    branch => branch.UseDeveloperExceptionPage());
```

`UseWhen` is like `MapWhen` but rejoins the main pipeline afterwards.

## Inline middleware with Use

For something small, write it inline:

```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers["X-App-Version"] = "1.4.2";
    await next();
});
```

The lambda receives the context and a `next` delegate. Code before `await next()` runs on the way in. Code after it runs on the way out, when the response is ready. Forgetting to call `next` short circuits everything after it, usually by accident.

The next topic turns this into a proper class.

## Middleware versus filters

Middleware sees every request, including static files and requests that do not match any route. It knows nothing about MVC: no controllers, no actions, no model state.

Filters run only inside the MVC endpoint and know all about actions, model binding and results. Use middleware for cross cutting concerns that apply to everything, such as logging, headers and error handling. Use filters for things tied to actions, such as validating model state or checking a custom attribute. The filters topic covers them.

## Seeing the pipeline in action

Add a logging line at the top and bottom of an inline middleware and watch the console. Request a page, then a CSS file, then a page that throws. You will see which middleware run for each, and that the CSS request never reaches the logging that comes after `UseStaticFiles`. A few minutes of this makes the whole model click.

## Quick recap

- Every request travels through a chain of middleware built in `Program.cs`, and the response travels back through the same chain.
- The template's order is exception handler, HSTS, HTTPS redirect, static files, routing, authentication, authorization, endpoints.
- Order matters: routing before authorization, authentication before authorization, static files before both.
- A middleware short circuits by writing a response without calling `next`.
- `Map`, `MapWhen` and `UseWhen` create branches, and `app.Use` adds inline middleware.
- Middleware is for everything, filters are for MVC actions.

<code id="code-content" class="language-csharp">
// Program.cs: an annotated pipeline
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddSession();
builder.Services.AddDistributedMemoryCache();

var app = builder.Build();

// 1. Catch everything below. Different handler per environment.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

// 2. Force HTTPS. HTTP requests are redirected and never go further.
app.UseHttpsRedirection();

// 3. Inline middleware: add a header on the way out and log timing.
app.Use(async (context, next) =&gt;
{
    var started = System.Diagnostics.Stopwatch.StartNew();
    context.Response.Headers["X-App-Version"] = "1.4.2";

    await next();     // everything below runs here

    started.Stop();
    app.Logger.LogInformation("{Method} {Path} -&gt; {Status} in {Ms} ms",
        context.Request.Method, context.Request.Path,
        context.Response.StatusCode, started.ElapsedMilliseconds);
});

// 4. Serve wwwroot. A match short circuits: nothing below runs for site.css.
app.UseStaticFiles();

// 5. A branch that answers /health without touching MVC at all.
app.Map("/health", branch =&gt;
{
    branch.Run(async context =&gt;
    {
        context.Response.ContentType = "text/plain";
        await context.Response.WriteAsync("OK");
    });
});

// 6. Decide which endpoint will handle the request.
app.UseRouting();

// 7. Who is the user? Then: are they allowed here?
app.UseAuthentication();
app.UseAuthorization();

// 8. Session must be after routing and before endpoints.
app.UseSession();

// 9. Run the endpoint: controller, model binding, action, view.
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// 10. Anything that matched no route ends here.
app.Run(async context =&gt;
{
    context.Response.StatusCode = 404;
    await context.Response.WriteAsync("No endpoint matched this request.");
});

app.Run();
</code></pre>
