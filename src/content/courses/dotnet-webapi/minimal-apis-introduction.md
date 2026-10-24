---
publishDate: 2026-09-07T11:10
title: Minimal APIs Introduction
slug: minimal-apis-introduction
metadescription: Write endpoints directly in Program.cs with MapGet and MapPost, use TypedResults for clean OpenAPI output, and keep a growing minimal API organised.
updateDate: 2026-09-07T11:10
author: ['bishal-biswas']
level: 1
tags: ['minimal-apis', 'endpoints', 'routing']
course: dotnet-webapi
---

## What a minimal API is

A minimal API is an endpoint defined as a lambda instead of a class and a method. No controller, no attributes, no base class.

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/api/books", () => new[] { "Clean Code", "Refactoring" });

app.Run();
```

Five lines and you have a working JSON API. That is the appeal. There is far less to read before you reach the code that matters.

Minimal APIs are not a lesser version of controllers. They run on the same routing, the same model binding and the same dependency injection. What they drop is the MVC layer on top: filters, model state, the controller lifecycle.

## The Map methods

There is one method per HTTP verb:

```csharp
app.MapGet("/api/books", () => books);
app.MapPost("/api/books", (Book book) => { });
app.MapPut("/api/books/{id:int}", (int id, Book book) => { });
app.MapPatch("/api/books/{id:int}", (int id, BookPatch patch) => { });
app.MapDelete("/api/books/{id:int}", (int id) => { });
```

And a general one for anything else:

```csharp
app.MapMethods("/api/books", new[] { "HEAD", "OPTIONS" }, () => Results.Ok());
```

Each takes a route pattern and a **handler**. The handler can be a lambda, a local function, or a reference to a normal method.

## Parameters bind the same way

The rules you learned for controllers apply, with one difference worth remembering.

```csharp
// Route parameter: name matches the template
app.MapGet("/api/books/{id:int}", (int id) => id);

// Query string: simple types
app.MapGet("/api/search", (string term, int page) => new { term, page });

// Body: complex types
app.MapPost("/api/books", (CreateBookRequest request) => request);

// Services: anything registered in DI
app.MapGet("/api/books", (IBookService service) => service.GetAll());

// The raw HTTP objects, when you need them
app.MapGet("/api/raw", (HttpContext context) => context.Request.Path.Value);
```

**The difference:** a complex type is always assumed to come from the **body**. Controllers with `[ApiController]` will read a complex type from the query string if you ask with `[FromQuery]`, and so will minimal APIs, but you must be explicit:

```csharp
app.MapGet("/api/books", ([AsParameters] BookQuery query) => query);
```

`[AsParameters]` fills the object's properties from the route and query string. Without it you would get a body binding on a `GET`, which does not work.

## Returning results

Return a value and it becomes `200` with JSON. For anything else, use `Results`:

```csharp
app.MapGet("/api/books/{id:int}", (int id) =>
{
    var book = books.FirstOrDefault(b => b.Id == id);
    return book is null ? Results.NotFound() : Results.Ok(book);
});
```

Notice the ternary works here, unlike in a controller with `ActionResult<T>`. Both branches return `IResult`, so C# has no trouble.

## Use TypedResults for better documentation

`Results.Ok(book)` returns `IResult`, which tells Swagger nothing. `TypedResults.Ok(book)` returns `Ok<Book>`, which tells it everything:

```csharp
app.MapGet("/api/books/{id:int}",
    Results<Ok<Book>, NotFound> (int id) =>
        books.FirstOrDefault(b => b.Id == id) is Book book
            ? TypedResults.Ok(book)
            : TypedResults.NotFound());
```

The return type `Results<Ok<Book>, NotFound>` says in the type system that this endpoint returns either a `200` with a `Book` or a `404`. Swagger documents both, and the compiler rejects any other result.

The syntax looks odd because the return type sits between the lambda's `=>` and its parameter list. That is required whenever you write an explicit return type on a lambda.

Use `TypedResults` for endpoints you are documenting properly, and plain `Results` for quick internal ones.

## Adding metadata

Chain methods onto a `Map` call to describe it:

```csharp
app.MapGet("/api/books/{id:int}", GetBook)
   .WithName("GetBookById")
   .WithTags("Books")
   .WithSummary("Fetch a single book")
   .WithDescription("Returns 404 when the id does not exist.")
   .WithOpenApi()
   .Produces<Book>(StatusCodes.Status200OK)
   .Produces(StatusCodes.Status404NotFound)
   .RequireAuthorization()
   .CacheOutput();
```

These do exactly what the equivalent controller attributes do. The difference is that they are ordinary method calls, so you can write a helper that applies a set of them to many endpoints at once.

## Keeping Program.cs from exploding

Fifty endpoints in one file is unreadable. The standard fix is an extension method per resource, in its own file.

```csharp
// Endpoints/BookEndpoints.cs
public static class BookEndpoints
{
    public static IEndpointRouteBuilder MapBookEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/books").WithTags("Books");

        group.MapGet("/", GetAll);
        group.MapGet("/{id:int}", GetById);
        group.MapPost("/", Create);
        group.MapDelete("/{id:int}", Delete);

        return app;
    }

    private static async Task<Ok<List<Book>>> GetAll(IBookService service)
        => TypedResults.Ok(await service.GetAllAsync());

    private static async Task<Results<Ok<Book>, NotFound>> GetById(int id, IBookService service)
        => await service.GetByIdAsync(id) is Book book
            ? TypedResults.Ok(book)
            : TypedResults.NotFound();

    // ...
}
```

```csharp
// Program.cs stays short
app.MapBookEndpoints();
app.MapOrderEndpoints();
app.MapAuthEndpoints();
```

Named methods instead of inline lambdas also make the handlers testable, because you can call them directly.

## Validation is the one thing you have to add

Controllers with `[ApiController]` validate the model automatically. Minimal APIs do not. Nothing checks your `[Required]` attributes unless you make it.

The simplest approach is an explicit check:

```csharp
app.MapPost("/api/books", (CreateBookRequest request) =>
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.Title))
        errors["title"] = new[] { "Title is required." };

    if (request.Year < 1000 || request.Year > 2100)
        errors["year"] = new[] { "Year must be between 1000 and 2100." };

    if (errors.Count > 0)
        return Results.ValidationProblem(errors);

    return Results.Created($"/api/books/1", request);
});
```

For anything beyond a couple of fields, use an **endpoint filter** or FluentValidation. Both get their own topics.

## When to choose which style

**Minimal APIs** suit small services, internal tools, health and webhook endpoints, and anything where you want to see the whole API in a few files. They start marginally faster and have slightly less per request overhead.

**Controllers** suit large APIs with many endpoints per resource, teams that rely on filters and conventions, and codebases where the familiar structure helps people find things.

You can use both in one project. There is no penalty. A common split is controllers for the main resources and minimal APIs for health checks, auth and webhooks.

## Quick recap

- A minimal API defines an endpoint as a lambda with `MapGet`, `MapPost` and friends.
- Binding works the same as controllers, except a complex type always comes from the body. Use `[AsParameters]` for query objects.
- Return a value for `200`, or use `Results.*` for other status codes.
- `TypedResults` with a `Results<...>` return type gives Swagger full detail and lets the compiler check you.
- Chain `WithName`, `Produces`, `RequireAuthorization` and similar to add metadata.
- Move endpoints into extension methods per resource so `Program.cs` stays short.
- Minimal APIs do **not** validate models automatically. You must add that yourself.

<code id="code-content" class="language-csharp">
// Program.cs plus Endpoints/BookEndpoints.cs, shown together.
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton&lt;IBookService, InMemoryBookService&gt;();
var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.MapBookEndpoints();          // one line per resource keeps Program.cs readable
app.Run();
// ---------------------------------------------------------------- Endpoints
public static class BookEndpoints
{
    public static IEndpointRouteBuilder MapBookEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/books").WithTags("Books");
        group.MapGet("/",         GetAll).WithName("GetBooks");
        group.MapGet("/{id:int}", GetById).WithName("GetBookById");
        group.MapPost("/",        Create).WithName("CreateBook");
        group.MapDelete("/{id:int}", Delete).WithName("DeleteBook");
        // [AsParameters] fills the object from route and query values.
        // Without it, a complex type would be read from the body, which a GET has none of.
        group.MapGet("/search", ([AsParameters] BookQuery query, IBookService service) =&gt;
            TypedResults.Ok(service.Search(query.Title, query.Page, query.Size)));
        return app;
    }
    // Named handlers, not inline lambdas: readable, reusable and directly testable.
    // The Results&lt;...&gt; return type documents every outcome for Swagger.
    private static Ok&lt;IReadOnlyList&lt;Book&gt;&gt; GetAll(IBookService service) =&gt;
        TypedResults.Ok(service.GetAll());
    private static Results&lt;Ok&lt;Book&gt;, NotFound&gt; GetById(int id, IBookService service) =&gt;
        service.GetById(id) is Book book
            ? TypedResults.Ok(book)
            : TypedResults.NotFound();
    private static Results&lt;Created&lt;Book&gt;, ValidationProblem&gt; Create(
        CreateBookRequest request, IBookService service)
    {
        // Minimal APIs do NOT validate automatically. Check it yourself.
        var errors = new Dictionary&lt;string, string[]&gt;();
        if (string.IsNullOrWhiteSpace(request.Title))
            errors["title"] = new[] { "Title is required." };
        if (request.Year &lt; 1000 || request.Year &gt; 2100)
            errors["year"] = new[] { "Year must be between 1000 and 2100." };
        if (errors.Count &gt; 0) return TypedResults.ValidationProblem(errors);
        Book created = service.Create(request.Title, request.Year);
        return TypedResults.Created($"/api/books/{created.Id}", created);
    }
    private static Results&lt;NoContent, NotFound&gt; Delete(int id, IBookService service) =&gt;
        service.Delete(id) ? TypedResults.NoContent() : TypedResults.NotFound();
}
public record Book(int Id, string Title, int Year);
public record CreateBookRequest(string Title, int Year);
public class BookQuery
{
    public string? Title { get; set; }
    public int Page { get; set; } = 1;
    public int Size { get; set; } = 20;
}
public interface IBookService
{
    IReadOnlyList&lt;Book&gt; GetAll();
    Book? GetById(int id);
    IReadOnlyList&lt;Book&gt; Search(string? title, int page, int size);
    Book Create(string title, int year);
    bool Delete(int id);
}
public class InMemoryBookService : IBookService
{
    private readonly List&lt;Book&gt; books = new() { new Book(1, "Clean Code", 2008) };
    public IReadOnlyList&lt;Book&gt; GetAll() =&gt; books;
    public Book? GetById(int id) =&gt; books.FirstOrDefault(b =&gt; b.Id == id);
    public IReadOnlyList&lt;Book&gt; Search(string? title, int page, int size) =&gt; books
        .Where(b =&gt; title is null || b.Title.Contains(title, StringComparison.OrdinalIgnoreCase))
        .Skip((page - 1) * size).Take(size).ToList();
    public Book Create(string title, int year)
    {
        var book = new Book(books.Count == 0 ? 1 : books.Max(b =&gt; b.Id) + 1, title, year);
        books.Add(book);
        return book;
    }
    public bool Delete(int id) =&gt; GetById(id) is Book b &amp;&amp; books.Remove(b);
}
</code></pre>
