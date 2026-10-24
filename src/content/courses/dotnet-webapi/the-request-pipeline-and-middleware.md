---
publishDate: 2026-09-15T14:00
title: The Request Pipeline and Middleware
slug: the-request-pipeline-and-middleware
metadescription: Understand how a request travels through the ASP.NET Core middleware pipeline, why the order of Use calls matters, and what each built in middleware does.
updateDate: 2026-09-07T14:00
author: ['bishal-biswas']
level: 2
tags: ['middleware', 'pipeline', 'aspnet-core']
course: dotnet-webapi
---

## What the pipeline is

Every request that reaches your API passes through a chain of components before it hits your endpoint, and passes back through the same chain on the way out.

Each component is a **middleware**. Each one can inspect the request, change it, pass it along, or stop it and answer immediately.

```csharp
app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

That is the pipeline. Five lines, and a request goes through them top to bottom.

## The onion

The best mental picture is layers of an onion. A request goes **in** through each layer, reaches the endpoint at the centre, then comes back **out** through the same layers in reverse.

```text
Request  →  Logging  →  HTTPS  →  Auth  →  Endpoint
                                              ↓
Response ←  Logging  ←  HTTPS  ←  Auth  ←  Endpoint
```

You can see it directly with inline middleware:

```csharp
app.Use(async (context, next) =>
{
    Console.WriteLine("A: on the way in");
    await next();                          // everything below runs here
    Console.WriteLine("A: on the way out");
});

app.Use(async (context, next) =>
{
    Console.WriteLine("B: on the way in");
    await next();
    Console.WriteLine("B: on the way out");
});

app.MapGet("/", () => "hello");
```

Output for one request:

```text
A: on the way in
B: on the way in
B: on the way out
A: on the way out
```

Code before `await next()` runs on the way in. Code after it runs on the way out. That is the whole model.

## Short circuiting

Do not call `next()` and the pipeline stops there. The layers below never run, and the response goes straight back out:

```csharp
app.Use(async (context, next) =>
{
    if (!context.Request.Headers.ContainsKey("X-Api-Key"))
    {
        context.Response.StatusCode = 401;
        await context.Response.WriteAsJsonAsync(new { error = "API key required." });
        return;                            // short circuit: nothing below runs
    }

    await next();
});
```

This is how authentication, rate limiting and caching work. They answer the request themselves when they can.

## Use, Run and Map

Three methods, three behaviours.

**`Use`** adds a middleware that can call the next one:

```csharp
app.Use(async (context, next) => { await next(); });
```

**`Run`** adds a **terminal** middleware. There is no `next`, so nothing after it ever runs:

```csharp
app.Run(async context => await context.Response.WriteAsync("Not found"));
```

**`Map`** branches the pipeline on a path prefix:

```csharp
app.Map("/admin", admin =>
{
    admin.UseMiddleware<AdminAuditMiddleware>();     // only for /admin/*
    admin.Run(async ctx => await ctx.Response.WriteAsync("Admin area"));
});
```

There is also `MapWhen` and `UseWhen` for branching on any condition:

```csharp
// Branches and never rejoins the main pipeline
app.MapWhen(ctx => ctx.Request.Query.ContainsKey("debug"), branch =>
{
    branch.Run(async ctx => await ctx.Response.WriteAsync("debug mode"));
});

// Branches, then rejoins the main pipeline
app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/api"), branch =>
{
    branch.UseMiddleware<ApiKeyMiddleware>();
});
```

`UseWhen` is the one you usually want, because the request continues normally afterwards.

## Order is everything

This is the part that causes real bugs. Middleware runs in the order you register it, and several pairs only work one way round.

**`UseAuthentication` must come before `UseAuthorization`.** Authentication works out **who** you are and populates `context.User`. Authorization checks **what** you may do. Reverse them and every authenticated request is rejected, because authorization sees an empty user.

**`UseCors` must come before `UseAuthentication` and `UseAuthorization`.** A browser preflight is an `OPTIONS` request with no credentials. If auth runs first it rejects the preflight, and the browser blocks the real request with a CORS error that has nothing to do with CORS configuration.

**`UseRouting` must come before `UseAuthorization`.** Authorization needs to know which endpoint was matched so it can read that endpoint's `[Authorize]` attributes.

**Exception handling goes first.** It can only catch exceptions thrown by middleware **below** it.

**Response compression and caching go early**, so they wrap everything they need to compress or cache.

**`UseStaticFiles` goes early**, so a request for an image short circuits before hitting routing and auth.

## The standard order

Learn this shape and you will rarely be wrong:

```csharp
var app = builder.Build();

// 1. Exception handling, outermost so it catches everything below
if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}

// 2. Transport
app.UseHttpsRedirection();

// 3. Static files, short circuit before the expensive layers
app.UseStaticFiles();

// 4. Routing: works out which endpoint matches
app.UseRouting();

// 5. CORS, after routing and before auth
app.UseCors();

// 6. Who are you, then what may you do
app.UseAuthentication();
app.UseAuthorization();

// 7. Your own cross cutting middleware
app.UseMiddleware<RequestLoggingMiddleware>();

// 8. Rate limiting and caching
app.UseRateLimiter();
app.UseOutputCache();

// 9. The endpoints themselves
app.MapControllers();

app.Run();
```

Modern .NET adds `UseRouting` and `UseAuthorization` automatically if you forget, but registering them explicitly makes the order visible and puts you in control.

## The built in middleware you will meet

**`UseHttpsRedirection`** answers HTTP requests with a redirect to HTTPS.

**`UseHsts`** sends a header telling browsers to only use HTTPS for this domain in future. Production only, because it is sticky and would break local HTTP testing.

**`UseStaticFiles`** serves files from `wwwroot`. Most APIs do not need it.

**`UseRouting`** matches the request to an endpoint. It does not run the endpoint, it only decides which one.

**`UseCors`** adds the headers browsers need for cross origin calls.

**`UseAuthentication`** reads the token or cookie and builds `context.User`.

**`UseAuthorization`** enforces `[Authorize]` on the matched endpoint.

**`UseResponseCompression`** gzips or brotlis the response body.

**`UseRateLimiter`** rejects callers who exceed a limit.

**`UseOutputCache`** serves a stored response without running the endpoint.

**`MapControllers`** and the `Map*` methods are terminal. They run the endpoint.

## HttpContext, the shared object

Every middleware receives the same `HttpContext`. It is how they communicate.

```csharp
app.Use(async (context, next) =>
{
    // The request
    string path = context.Request.Path;
    string method = context.Request.Method;
    string? auth = context.Request.Headers.Authorization;

    // The user, populated by UseAuthentication
    bool loggedIn = context.User.Identity?.IsAuthenticated ?? false;

    // Pass data to later middleware and to your endpoint
    context.Items["RequestStartedAt"] = DateTime.UtcNow;

    // Per request services
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();

    await next();

    // The response, after the endpoint ran
    int status = context.Response.StatusCode;
});
```

`context.Items` is a dictionary that lives for exactly one request. It is the right way to pass a value from middleware to an endpoint.

## Headers must be set before the body

Once the response body starts being written, the headers are already on the wire. Setting one after that throws.

```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Request-Id"] = Guid.NewGuid().ToString("N");  // fine
    await next();
    // context.Response.Headers["X-Elapsed"] = "12";   // may throw: too late
});
```

If you must set a header based on something that happens later, use the `OnStarting` callback. It fires just before the first byte goes out:

```csharp
app.Use(async (context, next) =>
{
    var watch = Stopwatch.StartNew();

    context.Response.OnStarting(() =>
    {
        context.Response.Headers["X-Elapsed-Ms"] = watch.ElapsedMilliseconds.ToString();
        return Task.CompletedTask;
    });

    await next();
});
```

## Quick recap

- The pipeline is a chain of middleware. A request goes in through each layer and back out in reverse.
- Code before `await next()` runs on the way in, code after it runs on the way out.
- Skip `next()` to short circuit, which is how auth and caching answer requests themselves.
- `Use` continues the chain, `Run` is terminal, `Map` and `UseWhen` branch it.
- Order matters. Exception handling first, then CORS, then authentication, then authorization.
- `UseAuthentication` before `UseAuthorization`, and `UseCors` before both, or preflights fail.
- `HttpContext` is shared by every layer, and `context.Items` carries data for one request.
- Set response headers before the body starts, or use `Response.OnStarting`.

<code id="code-content" class="language-csharp">
// Program.cs - the pipeline in the order that works, with the reasons written down.
using System.Diagnostics;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddCors(o =&gt; o.AddDefaultPolicy(p =&gt; p.WithOrigins("https://app.example.com")
                                                       .AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization();
var app = builder.Build();
// 1. OUTERMOST: exception handling can only catch what is registered BELOW it
if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}
// 2. A timing layer near the top, so it measures everything underneath.
//    The header is set in OnStarting because after await next() the response
//    may already have begun and headers would be locked.
app.Use(async (context, next) =&gt;
{
    var watch = Stopwatch.StartNew();
    string requestId = Guid.NewGuid().ToString("N")[..8];
    context.Items["RequestId"] = requestId;              // read later by any layer or endpoint
    context.Response.Headers["X-Request-Id"] = requestId; // safe: body has not started
    context.Response.OnStarting(() =&gt;
    {
        context.Response.Headers["X-Elapsed-Ms"] = watch.ElapsedMilliseconds.ToString();
        return Task.CompletedTask;
    });
    await next();                                        // everything below runs here
    app.Logger.LogInformation("{Id} {Method} {Path} -&gt; {Status} in {Ms}ms",
        requestId, context.Request.Method, context.Request.Path,
        context.Response.StatusCode, watch.ElapsedMilliseconds);
});
app.UseHttpsRedirection();
app.UseStaticFiles();          // a request for an image short circuits before auth
app.UseRouting();              // decides WHICH endpoint matched, does not run it
// CORS before auth: a browser preflight is an OPTIONS request with no credentials.
// Put auth first and the preflight is rejected, which the browser reports as a CORS error.
app.UseCors();
app.UseAuthentication();       // WHO are you -&gt; fills context.User
app.UseAuthorization();        // WHAT may you do -&gt; needs both the user and the matched endpoint
// A short circuiting layer: it answers by itself and nothing below runs.
// UseWhen branches for /api only, then rejoins the main pipeline.
app.UseWhen(ctx =&gt; ctx.Request.Path.StartsWithSegments("/api/internal"), branch =&gt;
{
    branch.Use(async (context, next) =&gt;
    {
        if (!context.Request.Headers.ContainsKey("X-Api-Key"))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = "X-Api-Key header required." });
            return;                                      // short circuit
        }
        await next();
    });
});
// Map branches on a path prefix and does NOT rejoin
app.Map("/admin", admin =&gt;
{
    admin.Run(async ctx =&gt; await ctx.Response.WriteAsync("Admin area"));
});
// 9. Terminal: these actually run your endpoints
app.MapControllers();
app.MapGet("/api/ping", (HttpContext ctx) =&gt; Results.Ok(new
{
    requestId = ctx.Items["RequestId"],                  // set by the timing layer above
    user      = ctx.User.Identity?.Name ?? "anonymous",  // set by UseAuthentication
    path      = ctx.Request.Path.Value
}));
app.Run();
</code></pre>
