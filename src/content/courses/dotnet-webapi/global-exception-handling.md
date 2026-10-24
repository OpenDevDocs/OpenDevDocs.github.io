---
publishDate: 2026-09-16T14:20
title: Global Exception Handling
slug: global-exception-handling
metadescription: Catch every unhandled exception in one place, map custom exceptions to status codes with IExceptionHandler, return consistent problem details, and avoid leaking stack traces.
updateDate: 2026-09-07T14:20
author: ['bishal-biswas']
level: 3
tags: ['exceptions', 'error-handling', 'middleware']
course: dotnet-webapi
---

## Why one place

Without a global handler, error handling spreads everywhere:

```csharp
[HttpGet("{id:int}")]
public async Task<IActionResult> GetById(int id)
{
    try
    {
        return Ok(await service.GetByIdAsync(id));
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed");
        return StatusCode(500, new { error = "Something went wrong" });
    }
}
```

Copy that into forty actions and you get forty chances to format the error differently, forty places to forget the logging, and a lot of noise around the code that matters.

Handle it once. Every action then contains only the happy path, and every error looks the same to clients.

## What happens with no handler at all

In **development**, `UseDeveloperExceptionPage()` returns a full stack trace. Useful for you, and it must never reach production. A stack trace tells an attacker your framework version, your file paths and your library list.

In **production** with nothing configured, the connection is closed or an empty `500` is returned. The client learns nothing and neither do you, because nothing is logged in a structured way.

Neither is acceptable. Configure a handler.

## IExceptionHandler, the modern way

.NET 8 introduced `IExceptionHandler`. It is the approach to use for new code, because handlers are ordinary DI classes that can be chained and tested.

Start with a handler for your own exception types:

```csharp
public class AppExceptionHandler : IExceptionHandler
{
    private readonly ILogger<AppExceptionHandler> logger;

    public AppExceptionHandler(ILogger<AppExceptionHandler> logger) => this.logger = logger;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext context, Exception exception, CancellationToken ct)
    {
        (int status, string title) = exception switch
        {
            NotFoundException     => (StatusCodes.Status404NotFound, "Resource not found"),
            ValidationException   => (StatusCodes.Status400BadRequest, "Validation failed"),
            ConflictException     => (StatusCodes.Status409Conflict, "Conflict"),
            ForbiddenException    => (StatusCodes.Status403Forbidden, "Forbidden"),
            _                     => (0, "")
        };

        if (status == 0) return false;      // not ours, let the next handler try

        logger.LogWarning(exception, "Handled {Type}: {Message}",
            exception.GetType().Name, exception.Message);

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = exception.Message,          // safe: our own exceptions carry safe messages
            Instance = context.Request.Path
        };
        problem.Extensions["traceId"] = context.TraceIdentifier;

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(problem, ct);

        return true;                        // handled, stop here
    }
}
```

Returning `false` is the important part. It means "this is not an exception I know about", and the next handler in the chain gets a turn.

Then a fallback that catches everything else:

```csharp
public class UnhandledExceptionHandler : IExceptionHandler
{
    private readonly ILogger<UnhandledExceptionHandler> logger;
    private readonly IHostEnvironment env;

    public UnhandledExceptionHandler(ILogger<UnhandledExceptionHandler> logger, IHostEnvironment env)
    {
        this.logger = logger;
        this.env = env;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext context, Exception exception, CancellationToken ct)
    {
        logger.LogError(exception, "Unhandled exception on {Path}", context.Request.Path);

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An unexpected error occurred",
            // The real message only in development. Never leak internals to clients.
            Detail = env.IsDevelopment() ? exception.ToString() : "Please try again later.",
            Instance = context.Request.Path
        };
        problem.Extensions["traceId"] = context.TraceIdentifier;

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(problem, ct);

        return true;
    }
}
```

Register them in order. The first that returns `true` wins:

```csharp
builder.Services.AddExceptionHandler<AppExceptionHandler>();
builder.Services.AddExceptionHandler<UnhandledExceptionHandler>();  // fallback, last
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();     // must be first in the pipeline
```

`UseExceptionHandler()` goes at the **top**, because it can only catch exceptions from middleware registered below it.

## Custom exception types

Define exceptions that carry meaning, so the handler has something to map:

```csharp
public abstract class AppException : Exception
{
    protected AppException(string message) : base(message) { }
}

public class NotFoundException : AppException
{
    public NotFoundException(string resource, object key)
        : base($"{resource} with id {key} was not found.") { }
}

public class ConflictException : AppException
{
    public ConflictException(string message) : base(message) { }
}

public class ForbiddenException : AppException
{
    public ForbiddenException(string message) : base(message) { }
}
```

Now a service can be blunt about failure and the HTTP layer stays out of it:

```csharp
public async Task<Book> GetByIdAsync(int id)
{
    Book? book = await db.Books.FindAsync(id);
    return book ?? throw new NotFoundException(nameof(Book), id);
}
```

Note the tradeoff. The service layer topic argued for returning a result instead of throwing for expected failures, and that argument still holds. Exceptions here are the pragmatic option when a failure needs to bubble up through several layers, or in a codebase that already works this way. Pick one style and be consistent.

## Never leak the exception message

The most important security rule in this topic.

An exception message can contain a connection string, a file path, a SQL fragment or a customer's data. In production, clients get a generic message and a trace id. The details go to your logs.

```csharp
Detail = env.IsDevelopment() ? exception.ToString() : "Please try again later."
```

The trace id is what makes this workable. The client reports it, you search your logs for it, and you have the full exception.

## Problem details

RFC 9457 defines a standard error body, and ASP.NET Core has a class for it:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Resource not found",
  "status": 404,
  "detail": "Book with id 42 was not found.",
  "instance": "/api/books/42",
  "traceId": "0HN7GKQ1234:00000003"
}
```

Using it means every error from your API has the same shape, whether it came from model validation, an authorization failure or your own handler. Clients write one error parser.

`AddProblemDetails()` makes the framework use this shape for status code responses that have no body of their own, such as a bare `404`.

## The middleware alternative

Before `IExceptionHandler`, you wrote a middleware. It still works and you will see it in existing code:

```csharp
public class ExceptionMiddleware
{
    private readonly RequestDelegate next;
    private readonly ILogger<ExceptionMiddleware> logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        this.next = next;
        this.logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");

            if (context.Response.HasStarted)
            {
                // Too late to change the response. Log and give up.
                throw;
            }

            context.Response.Clear();
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new ProblemDetails { Status = 500 });
        }
    }
}
```

The `HasStarted` check matters. If the endpoint already began writing the body, you cannot change the status code, and attempting to write again throws a second, more confusing exception.

Prefer `IExceptionHandler` for new code. It handles this for you and keeps each handler small and testable.

## Do not catch what you cannot fix

A `catch` block that logs and rethrows adds nothing:

```csharp
try
{
    await service.DoWorkAsync();
}
catch (Exception ex)
{
    logger.LogError(ex, "Failed");
    throw;                 // the global handler would have logged this anyway
}
```

Catch locally only when you can genuinely do something: retry, fall back to a default, or add context the handler could not know:

```csharp
try
{
    await paymentGateway.ChargeAsync(order.Total);
}
catch (HttpRequestException ex)
{
    // We can do something useful: convert to a domain failure with context
    throw new ConflictException($"Payment provider unavailable for order {order.Id}.");
}
```

## Cancellation is not an error

When a client disconnects, ASP.NET Core throws `OperationCanceledException`. That is normal, not a failure. Logging it as an error fills your dashboards with noise:

```csharp
if (exception is OperationCanceledException && context.RequestAborted.IsCancellationRequested)
{
    logger.LogInformation("Request cancelled by the client: {Path}", context.Request.Path);
    context.Response.StatusCode = 499;      // a common convention for client closed request
    return true;
}
```

## Quick recap

- Handle exceptions in one place so actions stay clean and every error looks the same.
- `UseExceptionHandler()` must be the first middleware, because it only catches what is below it.
- Implement `IExceptionHandler` and return `false` to pass an exception to the next handler.
- Register a specific handler first and a catch all fallback last.
- Map your own exception types to status codes. Keep HTTP knowledge out of services.
- Never send the exception message to clients in production. Send a trace id and log the rest.
- Use `ProblemDetails` so clients only ever parse one error shape.
- In the older middleware approach, check `Response.HasStarted` before writing.
- Do not catch just to log and rethrow. Catch only when you can act.
- Treat client cancellation as information, not an error.

<code id="code-content" class="language-csharp">
// Global exception handling with IExceptionHandler, the .NET 8 way.
using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddProblemDetails();     // standard shape for framework errors too
// Order matters: the first handler that returns true wins.
builder.Services.AddExceptionHandler&lt;CancellationExceptionHandler&gt;();  // most specific
builder.Services.AddExceptionHandler&lt;AppExceptionHandler&gt;();
builder.Services.AddExceptionHandler&lt;UnhandledExceptionHandler&gt;();     // catch all, last
var app = builder.Build();
// FIRST in the pipeline: it can only catch exceptions from middleware below it
app.UseExceptionHandler();
app.UseHttpsRedirection();
app.MapControllers();
app.Run();
// ---------- Exceptions that carry meaning, so a handler can map them
public abstract class AppException : Exception
{
    protected AppException(string message) : base(message) { }
}
public class NotFoundException  : AppException
{ public NotFoundException(string resource, object key) : base($"{resource} with id {key} was not found.") { } }
public class ConflictException  : AppException { public ConflictException(string m) : base(m) { } }
public class ForbiddenException : AppException { public ForbiddenException(string m) : base(m) { } }
public class BusinessRuleException : AppException { public BusinessRuleException(string m) : base(m) { } }
// ---------- 1. A client disconnecting is normal, not an error worth alerting on
public class CancellationExceptionHandler : IExceptionHandler
{
    private readonly ILogger&lt;CancellationExceptionHandler&gt; logger;
    public CancellationExceptionHandler(ILogger&lt;CancellationExceptionHandler&gt; logger) =&gt; this.logger = logger;
    public ValueTask&lt;bool&gt; TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is not OperationCanceledException || !context.RequestAborted.IsCancellationRequested)
            return ValueTask.FromResult(false);              // not ours, pass it on
        logger.LogInformation("Client cancelled {Method} {Path}",
            context.Request.Method, context.Request.Path);
        context.Response.StatusCode = 499;                   // client closed request
        return ValueTask.FromResult(true);
    }
}
// ---------- 2. Our own exceptions, mapped to honest status codes
public class AppExceptionHandler : IExceptionHandler
{
    private readonly ILogger&lt;AppExceptionHandler&gt; logger;
    public AppExceptionHandler(ILogger&lt;AppExceptionHandler&gt; logger) =&gt; this.logger = logger;
    public async ValueTask&lt;bool&gt; TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        (int status, string title) = exception switch
        {
            NotFoundException     =&gt; (StatusCodes.Status404NotFound,   "Resource not found"),
            ForbiddenException    =&gt; (StatusCodes.Status403Forbidden,  "Forbidden"),
            ConflictException     =&gt; (StatusCodes.Status409Conflict,   "Conflict"),
            BusinessRuleException =&gt; (StatusCodes.Status422UnprocessableEntity, "Rule violated"),
            _                     =&gt; (0, "")
        };
        if (status == 0) return false;                       // let the next handler try
        // A warning, not an error: this is an expected outcome, not a bug
        logger.LogWarning("{Type} on {Path}: {Message}",
            exception.GetType().Name, context.Request.Path, exception.Message);
        await WriteProblem(context, status, title, exception.Message, ct);
        return true;
    }
    internal static async Task WriteProblem(HttpContext context, int status, string title,
                                            string? detail, CancellationToken ct)
    {
        var problem = new ProblemDetails
        {
            Status   = status,
            Title    = title,
            Detail   = detail,
            Instance = context.Request.Path
        };
        // The id the client quotes back to you when they report the failure
        problem.Extensions["traceId"] = Activity.Current?.Id ?? context.TraceIdentifier;
        context.Response.StatusCode  = status;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(problem, ct);
    }
}
// ---------- 3. Everything else. This is a real bug, so log it as an error.
public class UnhandledExceptionHandler : IExceptionHandler
{
    private readonly ILogger&lt;UnhandledExceptionHandler&gt; logger;
    private readonly IHostEnvironment env;
    public UnhandledExceptionHandler(ILogger&lt;UnhandledExceptionHandler&gt; logger, IHostEnvironment env)
        =&gt; (this.logger, this.env) = (logger, env);
    public async ValueTask&lt;bool&gt; TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        logger.LogError(exception, "Unhandled exception on {Method} {Path}",
            context.Request.Method, context.Request.Path);
        // The message can contain a connection string, a file path or customer data.
        // Clients get a trace id. The details stay in the logs.
        string detail = env.IsDevelopment()
            ? exception.ToString()
            : "An unexpected error occurred. Quote the traceId when reporting this.";
        await AppExceptionHandler.WriteProblem(
            context, StatusCodes.Status500InternalServerError,
            "An unexpected error occurred", detail, ct);
        return true;
    }
}
// ---------- The service throws plainly. It knows nothing about HTTP.
public class BookService
{
    public Task&lt;string&gt; GetTitleAsync(int id)
    {
        if (id &lt;= 0) throw new BusinessRuleException("Book ids start at 1.");
        if (id &gt; 100) throw new NotFoundException("Book", id);
        return Task.FromResult($"Book {id}");
    }
}
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly BookService service = new();
    // No try/catch anywhere. Only the happy path.
    [HttpGet("{id:int}")]
    public async Task&lt;ActionResult&lt;string&gt;&gt; GetById(int id) =&gt; await service.GetTitleAsync(id);
    [HttpGet("boom")]
    public IActionResult Boom() =&gt; throw new InvalidOperationException("A real bug, with internals in the message");
}
</code></pre>
