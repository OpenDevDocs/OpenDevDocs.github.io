---
publishDate: 2026-09-03T10:00
title: Request and Response Headers
slug: request-and-response-headers
metadescription: Learn what HTTP headers are, which ones a Web API reads and writes every day, and how to access and set them from ASP.NET Core.
updateDate: 2026-09-07T10:00
author: ['bishal-biswas']
level: 1
tags: ['http', 'headers', 'basics']
course: dotnet-webapi
---

## What is a header?

A header is a name and value pair attached to a request or a response. It carries information **about** the message rather than the message itself.

```http
POST /api/books HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Accept: application/json

{ "title": "Refactoring", "year": 1999 }
```

Everything before the blank line is headers. Everything after is the body. Think of it as an envelope. The address, the stamp and the "fragile" sticker are headers. The letter inside is the body.

Header names are **case insensitive**. `Content-Type` and `content-type` are the same header.

## Headers a client sends you

**`Content-Type`** says what format the body is in. Without it the server has to guess.

```http
Content-Type: application/json
Content-Type: application/x-www-form-urlencoded
Content-Type: multipart/form-data
```

If a client posts JSON without this header, ASP.NET Core answers `415 Unsupported Media Type`.

**`Accept`** says what format the client wants back. This drives content negotiation.

```http
Accept: application/json
Accept: application/xml
```

**`Authorization`** carries credentials. In a modern API this is nearly always a bearer token.

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**`User-Agent`** identifies the client software. Useful in logs, not for decisions.

**`Accept-Language`** says which language the user prefers, such as `en-GB` or `hi-IN`.

**`If-None-Match`** carries a cached `ETag` so the server can answer `304 Not Modified` and skip sending the body again.

## Headers you send back

**`Content-Type`** on the response says what you are returning. ASP.NET Core sets `application/json; charset=utf-8` for you.

**`Location`** points at a newly created resource. Send it with every `201 Created`.

```http
HTTP/1.1 201 Created
Location: /api/books/7
```

**`Cache-Control`** tells clients and proxies how long they may reuse the response.

```http
Cache-Control: public, max-age=60
```

**`ETag`** is a version marker for the body, so clients can ask "has this changed?".

**`Retry-After`** goes with `429` and `503` to say how many seconds to wait.

**`WWW-Authenticate`** goes with `401` to say which scheme you expect.

## Reading headers in ASP.NET Core

Inside a controller, `Request.Headers` is a dictionary:

```csharp
[HttpGet]
public IActionResult Get()
{
    string? agent = Request.Headers.UserAgent;
    string? custom = Request.Headers["X-Client-Version"];

    if (Request.Headers.TryGetValue("X-Tenant-Id", out var tenant))
    {
        // tenant.ToString() has the value
    }

    return Ok();
}
```

A header can legally appear more than once, which is why the value type is `StringValues` rather than `string`. Calling `.ToString()` joins the values with commas. Most of the time there is only one.

## Binding a header to a parameter

Reading the dictionary works, but there is a cleaner way. `[FromHeader]` binds a header straight into a parameter:

```csharp
[HttpGet]
public IActionResult Get([FromHeader(Name = "X-Tenant-Id")] string tenantId)
{
    return Ok(new { tenantId });
}
```

Now the header is part of the method signature, it shows up in Swagger, and validation attributes work on it. This is the approach to prefer.

Make it optional by making the parameter nullable:

```csharp
public IActionResult Get([FromHeader(Name = "X-Tenant-Id")] string? tenantId)
```

In a minimal API the attribute works the same way:

```csharp
app.MapGet("/api/reports",
    ([FromHeader(Name = "X-Tenant-Id")] string tenantId) => Results.Ok(tenantId));
```

## Writing headers

Set them on `Response.Headers` before the response starts:

```csharp
[HttpGet]
public IActionResult Get()
{
    Response.Headers["X-Request-Id"] = Guid.NewGuid().ToString("N");
    Response.Headers.CacheControl = "public, max-age=60";
    return Ok(books);
}
```

There is one rule that trips people up. Once the response body starts being written, the headers are already on the wire and cannot change. Set headers **before** you return, and in middleware, set them before calling `await next(context)` or inside the `OnStarting` callback.

## Custom headers

You can invent your own. The old advice was to prefix them with `X-`, and that convention was formally retired, but it is still everywhere:

```http
X-Request-Id: 3f2a91c4
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-Total-Count: 1204
```

Two practical rules for custom headers.

First, keep them small. Headers travel with every request and some proxies cap the total size at 8 KB.

Second, if a browser needs to read your custom response header, you must expose it in your CORS policy. Browsers hide any header not on the allow list:

```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("https://app.example.com")
              .WithExposedHeaders("X-Total-Count"));
});
```

Forgetting `WithExposedHeaders` is one of the most common "my header is missing but I can see it in the network tab" bugs.

## A worked example: pagination headers

A common pattern is to return the page of data in the body and the paging information in headers:

```csharp
[HttpGet]
public IActionResult GetPage(int page = 1, int size = 20)
{
    var total = books.Count;
    var items = books.Skip((page - 1) * size).Take(size).ToList();

    Response.Headers["X-Total-Count"] = total.ToString();
    Response.Headers["X-Page"] = page.ToString();
    Response.Headers["X-Page-Size"] = size.ToString();

    return Ok(items);
}
```

The body stays a clean array, and clients that care about paging read the headers. The alternative, wrapping everything in an envelope object, is covered in the pagination topic.

## Quick recap

- Headers describe the message. The body is the message.
- Clients commonly send `Content-Type`, `Accept` and `Authorization`.
- Servers commonly send `Content-Type`, `Location`, `Cache-Control` and `ETag`.
- Header names are case insensitive, and a header can appear more than once, hence `StringValues`.
- Prefer `[FromHeader]` over reading `Request.Headers`, because it documents itself and shows in Swagger.
- Set response headers before the body starts. Afterwards it is too late.
- Browsers cannot read custom response headers unless you list them in `WithExposedHeaders`.

<code id="code-content" class="language-csharp">
// Program.cs - reading and writing headers in a small API.
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(options =&gt;
{
    options.AddDefaultPolicy(policy =&gt; policy
        .AllowAnyOrigin()
        .AllowAnyHeader()
        // Without this the browser hides these from JavaScript
        .WithExposedHeaders("X-Total-Count", "X-Request-Id"));
});
var app = builder.Build();
app.UseCors();
// Middleware that stamps every response with a request id.
// Headers must be set BEFORE the body is written, so we do it before await next().
app.Use(async (context, next) =&gt;
{
    string requestId = context.Request.Headers["X-Request-Id"].FirstOrDefault()
                       ?? Guid.NewGuid().ToString("N")[..8];
    context.Response.Headers["X-Request-Id"] = requestId;
    await next();
});
var books = Enumerable.Range(1, 57)
    .Select(i =&gt; new { Id = i, Title = $"Book {i}" })
    .ToList();
// Reading headers the explicit way, through the dictionary
app.MapGet("/api/whoami", (HttpRequest request) =&gt; new
{
    UserAgent = request.Headers.UserAgent.ToString(),
    Accept    = request.Headers.Accept.ToString(),
    Language  = request.Headers.AcceptLanguage.ToString(),
    HasToken  = request.Headers.ContainsKey("Authorization")
});
// Reading a header the clean way: it binds, validates and appears in Swagger
app.MapGet("/api/reports", ([FromHeader(Name = "X-Tenant-Id")] string? tenantId) =&gt;
    string.IsNullOrWhiteSpace(tenantId)
        ? Results.BadRequest(new { error = "X-Tenant-Id header is required." })
        : Results.Ok(new { tenantId, generatedAtUtc = DateTime.UtcNow }));
// Writing headers: paging info in headers, clean array in the body
app.MapGet("/api/books", (HttpResponse response, int page = 1, int size = 20) =&gt;
{
    var items = books.Skip((page - 1) * size).Take(size).ToList();
    response.Headers["X-Total-Count"] = books.Count.ToString();
    response.Headers["X-Page"]        = page.ToString();
    response.Headers["X-Page-Size"]   = size.ToString();
    response.Headers.CacheControl     = "public, max-age=60";
    return Results.Ok(items);
});
// Rate limit style headers alongside a 429 and a Retry-After
app.MapGet("/api/limited", (HttpResponse response) =&gt;
{
    response.Headers["X-RateLimit-Limit"]     = "100";
    response.Headers["X-RateLimit-Remaining"] = "0";
    response.Headers["Retry-After"]           = "30";        // seconds
    return Results.StatusCode(429);
});
app.Run();
</code></pre>
