---
publishDate: 2026-09-22T16:30
title: Problem Details and Error Responses
slug: problem-details-and-error-responses
metadescription: Use the RFC 9457 problem details format so every error from your API has one shape, add custom fields, and make validation errors easy for clients to act on.
updateDate: 2026-09-07T16:30
author: ['bishal-biswas']
level: 3
tags: ['errors', 'problem-details', 'api-design']
course: dotnet-webapi
---

## The problem with ad hoc errors

Left alone, an API grows several error shapes:

```json
{ "error": "Book not found" }
{ "message": "Validation failed", "fields": ["title"] }
{ "Error": { "Code": 500, "Text": "Server error" } }
"Something went wrong"
```

Every client then writes a parser that tries all four and gives up. Nobody can write one error handler that works.

## RFC 9457

The IETF standardised an error body. It is called **problem details**, and .NET has a class for it:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Not Found",
  "status": 404,
  "detail": "Book with id 42 was not found.",
  "instance": "/api/books/42"
}
```

Five standard fields:

- **`type`**, a URI identifying the kind of problem. Clients switch on this.
- **`title`**, a short human readable summary. The same for every occurrence of this type.
- **`status`**, the HTTP status code, repeated in the body.
- **`detail`**, an explanation specific to this occurrence.
- **`instance`**, which request produced it.

The content type is `application/problem+json`, so a client can tell an error body from a success body without inspecting it.

The value is not the exact field names. It is that every error looks the same.

## Turning it on

```csharp
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseStatusCodePages();       // gives bodyless responses such as a bare 404 a problem body
app.UseExceptionHandler();
```

`AddProblemDetails` makes the framework produce this shape for status code responses that would otherwise have an empty body.

## Returning one from a controller

`ControllerBase` has helpers:

```csharp
// A general problem
return Problem(
    detail: "The reporting database is offline.",
    statusCode: StatusCodes.Status503ServiceUnavailable,
    title: "Service unavailable");

// A validation problem, from ModelState
return ValidationProblem(ModelState);

// A validation problem, from your own dictionary
return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
{
    ["isbn"] = new[] { "That ISBN is already registered." }
}));
```

In minimal APIs:

```csharp
return Results.Problem(detail: "...", statusCode: 503, title: "Service unavailable");
return Results.ValidationProblem(errors);
```

## Validation errors

With `[ApiController]`, a failing model returns `ValidationProblemDetails` automatically. It is problem details plus an `errors` dictionary:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "title": ["Title is required."],
    "year": ["Year must be between 1000 and 2100."],
    "lines[0].quantity": ["Quantity must be at least 1."]
  }
}
```

The keys are field paths, which is exactly what a client needs to attach messages to form inputs. Nested paths such as `lines[0].quantity` work automatically.

## Adding your own fields

The spec allows extensions, and this is where problem details becomes genuinely useful:

```csharp
var problem = new ProblemDetails
{
    Type = "https://api.example.com/errors/insufficient-stock",
    Title = "Insufficient stock",
    Status = StatusCodes.Status409Conflict,
    Detail = "Only 3 units of SKU-1234 remain.",
    Instance = HttpContext.Request.Path
};

problem.Extensions["sku"] = "SKU-1234";
problem.Extensions["requested"] = 10;
problem.Extensions["available"] = 3;
problem.Extensions["traceId"] = Activity.Current?.Id ?? HttpContext.TraceIdentifier;

return new ObjectResult(problem) { StatusCode = problem.Status };
```

```json
{
  "type": "https://api.example.com/errors/insufficient-stock",
  "title": "Insufficient stock",
  "status": 409,
  "detail": "Only 3 units of SKU-1234 remain.",
  "instance": "/api/orders",
  "sku": "SKU-1234",
  "requested": 10,
  "available": 3,
  "traceId": "00-8a3c...-01"
}
```

A client can now show "Only 3 left, reduce your quantity" without parsing English. That is the difference between an error message and an error a program can act on.

## Use type as the machine readable code

`status` is too coarse. Three different things return `409`, and a client needs to tell them apart. `type` is the field for that:

```text
https://api.example.com/errors/insufficient-stock
https://api.example.com/errors/duplicate-isbn
https://api.example.com/errors/order-already-shipped
```

Make those URLs resolve to a documentation page explaining the error and what to do. It costs almost nothing and it is the difference between a good API and a frustrating one.

Keep them stable. A `type` is part of your contract, exactly like a field name.

## Adding a trace id to everything

The single most useful customisation. A client reports an id, you find the exact request in your logs:

```csharp
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Instance =
            $"{context.HttpContext.Request.Method} {context.HttpContext.Request.Path}";

        context.ProblemDetails.Extensions["traceId"] =
            Activity.Current?.Id ?? context.HttpContext.TraceIdentifier;

        context.ProblemDetails.Extensions["timestamp"] = DateTime.UtcNow;
    };
});
```

Every problem details response now carries it, including the automatic validation ones.

## Never leak internals in detail

`detail` goes to the client, so it must be safe to read.

```csharp
// Leaks the schema, the table name and possibly the connection
Detail = exception.ToString();

// Safe
Detail = env.IsDevelopment()
    ? exception.ToString()
    : "An unexpected error occurred. Quote the traceId when reporting this.";
```

For your own exception types the message is usually safe, because you wrote it for a client. For anything unexpected, assume it is not.

## Consistency is what matters

Two rules make problem details worth the effort.

**Every error uses it.** Validation failures, `404`s, business rule failures, unhandled exceptions, rate limits. If half your errors use a different shape, clients still need two parsers.

**Success responses never use it.** Problem details is for errors only. Do not wrap successful responses in it.

Get both right and a client writes one function:

```javascript
async function call(url, options) {
  const response = await fetch(url, options);

  if (response.ok) return response.json();

  const problem = await response.json();

  switch (problem.type) {
    case 'https://api.example.com/errors/insufficient-stock':
      return showStock(problem.available);
    default:
      return showError(problem.title, problem.detail, problem.traceId);
  }
}
```

## Should you use it?

The honest answer is that many successful APIs use their own format, often something like `{ "error": { "code": "...", "message": "..." } }`. That works fine.

Problem details wins on three points. It is a standard, so tooling and client generators understand it. ASP.NET Core produces it for free from validation and status codes, so choosing anything else means converting those. And extensions give you structured, actionable data without inventing a schema.

If you pick something else, that is a legitimate choice. What is not legitimate is having no format at all, and discovering four of them a year later.

## Quick recap

- RFC 9457 problem details gives every error one shape, served as `application/problem+json`.
- The fields are `type`, `title`, `status`, `detail` and `instance`.
- `AddProblemDetails` plus `UseStatusCodePages` gives bodyless responses a proper body.
- `[ApiController]` already returns `ValidationProblemDetails` with a field keyed `errors` dictionary.
- Use `Extensions` for structured, actionable data such as the available stock.
- `type` is the machine readable code, not `status`. Make it a documentation URL and keep it stable.
- Add a `traceId` to every problem so clients can quote it and you can find the request.
- Never put an exception message or stack trace in `detail` in production.
- Use it for every error and never for a success, or clients still need two parsers.

<code id="code-content" class="language-csharp">
// Problem details used consistently, with structured extensions and a trace id.
using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
// Every problem details response, including the automatic validation ones,
// gets a traceId and a timestamp added here.
builder.Services.AddProblemDetails(options =&gt;
{
    options.CustomizeProblemDetails = context =&gt;
    {
        context.ProblemDetails.Instance =
            $"{context.HttpContext.Request.Method} {context.HttpContext.Request.Path}";
        context.ProblemDetails.Extensions["traceId"] =
            Activity.Current?.Id ?? context.HttpContext.TraceIdentifier;
        context.ProblemDetails.Extensions["timestamp"] = DateTime.UtcNow;
    };
});
builder.Services.AddExceptionHandler&lt;ProblemExceptionHandler&gt;();
var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();     // a bare 404 or 401 now gets a problem body instead of nothing
app.MapControllers();
app.Run();
// Stable, documented URIs. These are part of your contract, like field names.
// Make them resolve to a page explaining the error and what to do about it.
public static class ErrorTypes
{
    private const string Base = "https://api.example.com/errors/";
    public const string InsufficientStock  = Base + "insufficient-stock";
    public const string DuplicateIsbn      = Base + "duplicate-isbn";
    public const string OrderAlreadyShipped = Base + "order-already-shipped";
    public const string Unexpected         = Base + "unexpected";
}
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    // 1. Validation. [ApiController] produces this automatically, keyed by field path,
    //    which is exactly what a form needs. Nested paths such as
    //    "lines[0].quantity" appear on their own.
    [HttpPost]
    public IActionResult Create([FromBody] CreateOrderRequest request)
    {
        // 2. A business rule failure with STRUCTURED data. The client can act on
        //    this without parsing English.
        const int available = 3;
        if (request.Quantity &gt; available)
        {
            var problem = new ProblemDetails
            {
                Type     = ErrorTypes.InsufficientStock,   // the machine readable code
                Title    = "Insufficient stock",
                Status   = StatusCodes.Status409Conflict,
                Detail   = $"Only {available} units of {request.Sku} remain.",
                Instance = HttpContext.Request.Path
            };
            problem.Extensions["sku"]       = request.Sku;
            problem.Extensions["requested"] = request.Quantity;
            problem.Extensions["available"] = available;
            return new ObjectResult(problem) { StatusCode = problem.Status };
        }
        return Created($"/api/orders/1", new { id = 1 });
    }
    // 3. The shorthand helpers, when no extra data is needed
    [HttpGet("report")]
    public IActionResult Report(bool databaseUp = true) =&gt;
        databaseUp
            ? Ok(new { rows = 42 })
            : Problem(detail:     "The reporting database is offline.",
                      statusCode: StatusCodes.Status503ServiceUnavailable,
                      title:      "Service unavailable");
    // 4. A validation problem you build yourself, for a rule attributes cannot express
    [HttpPost("import")]
    public IActionResult Import([FromBody] CreateOrderRequest request)
    {
        var errors = new Dictionary&lt;string, string[]&gt;();
        if (request.Sku.Length != 8)
            errors["sku"] = new[] { "SKU must be exactly 8 characters." };
        if (request.Quantity &lt;= 0)
            errors["quantity"] = new[] { "Quantity must be at least 1." };
        if (errors.Count &gt; 0)
            return ValidationProblem(new ValidationProblemDetails(errors));
        return Accepted();
    }
}
// 5. Unhandled exceptions get the SAME shape. That consistency is the whole point:
//    a client writes one parser, not one per error source.
public class ProblemExceptionHandler : IExceptionHandler
{
    private readonly IHostEnvironment env;
    private readonly ILogger&lt;ProblemExceptionHandler&gt; logger;
    public ProblemExceptionHandler(IHostEnvironment env, ILogger&lt;ProblemExceptionHandler&gt; logger)
        =&gt; (this.env, this.logger) = (env, logger);
    public async ValueTask&lt;bool&gt; TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        logger.LogError(exception, "Unhandled exception on {Path}", context.Request.Path);
        var problem = new ProblemDetails
        {
            Type     = ErrorTypes.Unexpected,
            Title    = "An unexpected error occurred",
            Status   = StatusCodes.Status500InternalServerError,
            Instance = context.Request.Path,
            // detail goes to the CLIENT. An exception message can contain a
            // connection string, a table name or customer data.
            Detail   = env.IsDevelopment()
                ? exception.ToString()
                : "An unexpected error occurred. Quote the traceId when reporting this."
        };
        problem.Extensions["traceId"] = Activity.Current?.Id ?? context.TraceIdentifier;
        context.Response.StatusCode  = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(problem, ct);
        return true;
    }
}
public class CreateOrderRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(8, MinimumLength = 8)]
    public string Sku { get; set; } = "";
    [System.ComponentModel.DataAnnotations.Range(1, 999)]
    public int Quantity { get; set; }
}
/* What a client writes, once, for the whole API:
async function call(url, options) {
  const response = await fetch(url, options);
  if (response.ok) return response.json();
  const problem = await response.json();          // always application/problem+json
  switch (problem.type) {
    case 'https://api.example.com/errors/insufficient-stock':
      return showStock(problem.available);        // structured, not parsed from prose
    default:
      return showError(problem.title, problem.detail, problem.traceId);
  }
}
*/
</code></pre>
