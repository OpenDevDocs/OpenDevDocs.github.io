---
publishDate: 2026-09-08T11:30
title: Minimal APIs versus Controllers
slug: minimal-apis-versus-controllers
metadescription: Compare the two ways to build endpoints in ASP.NET Core side by side, see what each style gives you and costs you, and learn how to pick one or mix both.
updateDate: 2026-09-07T11:30
author: ['bishal-biswas']
level: 2
tags: ['minimal-apis', 'controllers', 'architecture']
course: dotnet-webapi
---

## The same endpoint, both ways

Nothing explains the difference faster than seeing it. Here is one resource written twice.

With a controller:

```csharp
// Controllers/BooksController.cs
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly IBookService service;

    public BooksController(IBookService service) => this.service = service;

    [HttpGet]
    public async Task<ActionResult<List<Book>>> GetAll()
        => await service.GetAllAsync();

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Book>> GetById(int id)
    {
        var book = await service.GetByIdAsync(id);
        if (book is null) return NotFound();
        return book;
    }

    [HttpPost]
    public async Task<ActionResult<Book>> Create(CreateBookRequest request)
    {
        var book = await service.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
    }
}
```

With minimal APIs:

```csharp
// Endpoints/BookEndpoints.cs
var books = app.MapGroup("/api/books").WithTags("Books");

books.MapGet("/", (IBookService service) => service.GetAllAsync());

books.MapGet("/{id:int}", async (int id, IBookService service) =>
    await service.GetByIdAsync(id) is Book book
        ? Results.Ok(book)
        : Results.NotFound());

books.MapPost("/", async (CreateBookRequest request, IBookService service) =>
{
    var book = await service.CreateAsync(request);
    return Results.Created($"/api/books/{book.Id}", book);
});
```

Both compile to endpoints on the same router. Both use the same DI container, the same model binding and the same JSON serializer.

## What controllers give you that minimal APIs do not

**Automatic model validation.** `[ApiController]` checks your data annotations and returns `400` before the action runs. In a minimal API you write a filter or check by hand.

**Action filters and the MVC filter pipeline.** `IActionFilter`, `IResultFilter`, `IExceptionFilter` and `IAuthorizationFilter` give you ordered hooks with rich context. Endpoint filters cover most of this, but they are simpler and there is only one kind.

**Conventions.** Application model conventions can rewrite routes, apply attributes and change behaviour across every controller at once. There is no equivalent for minimal APIs beyond writing your own extension methods.

**`ModelState`.** A single object accumulating binding and validation errors, which filters and actions can read and add to.

**Familiar structure.** A `Controllers` folder with one class per resource is instantly recognisable to any .NET developer. That has real value on a team.

**Some library support.** A few older libraries hook into MVC specifically. Most now support both, but check before you commit.

## What minimal APIs give you that controllers do not

**Less code and less indirection.** No class, no base class, no attributes. The route and the handler sit on the same line.

**Slightly better performance.** No controller instantiation, no MVC filter pipeline, less allocation per request. The difference is small and rarely the deciding factor, but it is real under high load.

**Typed results in the signature.** `Results<Ok<Book>, NotFound>` states every outcome in the type system. The compiler enforces it and OpenAPI reads it without attributes. Controllers need `[ProducesResponseType]` for the same information.

**Composition with plain C#.** Groups and filters are method calls, so you can build helpers, loops and shared configuration with ordinary code rather than attributes and conventions.

**Faster startup.** No assembly scanning for controllers.

## Honest comparison

| | Controllers | Minimal APIs |
|---|---|---|
| Lines per endpoint | more | fewer |
| Automatic validation | yes | no, add a filter |
| Filter pipeline | rich, four kinds | one kind, simpler |
| Documents its own results | needs attributes | via `TypedResults` |
| Per request overhead | slightly higher | slightly lower |
| Familiarity | very high | high and growing |
| Best at | large APIs, many endpoints | small services, focused APIs |

## Common misconceptions

**"Minimal APIs are only for small projects."** They scale fine. With route groups and endpoint classes, a hundred endpoint minimal API is perfectly readable. The word minimal describes the ceremony, not the ambition.

**"Minimal APIs cannot use dependency injection."** They can. Any registered service can be a handler parameter, exactly like a controller constructor.

**"Controllers are legacy."** They are not. Both styles are fully supported and actively developed. Microsoft's own templates offer both.

**"You must pick one."** You do not. See below.

## Mixing both

Both styles register on the same routing system, so they coexist with no cost:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
var app = builder.Build();

app.MapControllers();                 // Controllers/*.cs
app.MapHealthEndpoints();             // minimal
app.MapAuthEndpoints();               // minimal

app.Run();
```

A split many teams land on: controllers for the main business resources, where the structure earns its keep, and minimal APIs for the small stuff. Health checks, readiness probes, webhooks, login endpoints and file downloads are all one or two endpoints each and do not need a class.

## How to choose

Ask these in order.

**Is this a small or focused service?** Fewer than about twenty endpoints, one clear job. Minimal APIs will be less code and easier to read end to end.

**Does the team already know MVC well?** Consistency with what people know is worth more than a marginal performance win.

**Do you depend on MVC specific features?** Application model conventions, custom `IActionFilter` implementations, or a library that only integrates with MVC. Stay with controllers.

**Is per request overhead genuinely critical?** A high throughput gateway or a service on a tight latency budget. Minimal APIs shave a little off.

**Still unsure?** Use controllers. The structure costs you a few lines and saves arguments about where code should live.

## Do not let the choice matter too much

Here is the thing worth internalising. If your endpoints are thin, this decision is cheap to reverse.

A controller action or a minimal API handler should do three things: read the request, call a service, turn the result into a response. All the real work lives in a service class that knows nothing about HTTP.

```csharp
// Controller
[HttpPost]
public async Task<ActionResult<Book>> Create(CreateBookRequest request)
{
    var book = await service.CreateAsync(request);
    return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
}

// Minimal API, calling the exact same service
books.MapPost("/", async (CreateBookRequest request, IBookService service) =>
{
    var book = await service.CreateAsync(request);
    return Results.Created($"/api/books/{book.Id}", book);
});
```

The service is identical in both. Switching styles becomes a mechanical change to a thin layer, not a rewrite. That is the real lesson of this topic.

## Quick recap

- Both styles use the same routing, binding, DI and JSON. They differ in ceremony, not capability.
- Controllers give automatic validation, a rich filter pipeline, conventions and `ModelState`.
- Minimal APIs give less code, slightly less overhead, and typed results that document themselves.
- Minimal APIs do scale, do support DI, and controllers are not legacy.
- You can use both in one app, and many teams do: controllers for resources, minimal for the small endpoints.
- Pick controllers when in doubt or when the team knows MVC. Pick minimal for small, focused services.
- Keep handlers thin and call a service, and the choice stays cheap to change later.

<code id="code-content" class="language-csharp">
// Program.cs - both styles in one app, sharing one service.
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();                             // enables the MVC style
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton&lt;IBookService, InMemoryBookService&gt;();
var app = builder.Build();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.MapControllers();                                          // Controllers/BooksController.cs
app.MapSmallEndpoints();                                       // minimal APIs for the small stuff
app.Run();
// -------- Minimal APIs: health, readiness and other one line endpoints.
// These would be pure ceremony as controller classes.
public static class SmallEndpoints
{
    public static IEndpointRouteBuilder MapSmallEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health",  () =&gt; TypedResults.Ok(new { status = "healthy" })).WithTags("Ops");
        app.MapGet("/ready",   (IBookService s) =&gt; TypedResults.Ok(new { ready = s.GetAll().Count &gt;= 0 }));
        app.MapGet("/version", () =&gt; TypedResults.Ok(new { version = "1.4.0" }));
        return app;
    }
}
// -------- Controller: the main resource, where the structure earns its keep.
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly IBookService service;
    public BooksController(IBookService service) =&gt; this.service = service;
    [HttpGet]
    public ActionResult&lt;IReadOnlyList&lt;Book&gt;&gt; GetAll() =&gt; Ok(service.GetAll());
    [HttpGet("{id:int}")]
    public ActionResult&lt;Book&gt; GetById(int id)
    {
        Book? book = service.GetById(id);
        if (book is null) return NotFound();
        return book;
    }
    [HttpPost]
    public ActionResult&lt;Book&gt; Create([FromBody] CreateBookRequest request)
    {
        // No manual validation: [ApiController] already returned 400 if the model was invalid.
        // A minimal API would need an endpoint filter to get this for free.
        Book book = service.Create(request.Title, request.Year);
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
    }
}
// -------- The service both styles call. This is where the real work lives,
// which is exactly why swapping styles is a cheap, mechanical change.
public interface IBookService
{
    IReadOnlyList&lt;Book&gt; GetAll();
    Book? GetById(int id);
    Book Create(string title, int year);
}
public class InMemoryBookService : IBookService
{
    private readonly List&lt;Book&gt; books = new() { new Book(1, "Clean Code", 2008) };
    public IReadOnlyList&lt;Book&gt; GetAll() =&gt; books;
    public Book? GetById(int id) =&gt; books.FirstOrDefault(b =&gt; b.Id == id);
    public Book Create(string title, int year)
    {
        var book = new Book(books.Count == 0 ? 1 : books.Max(b =&gt; b.Id) + 1, title, year);
        books.Add(book);
        return book;
    }
}
public record Book(int Id, string Title, int Year);
public record CreateBookRequest(string Title, int Year);
</code></pre>
