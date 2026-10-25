---
publishDate: 2026-09-05T10:30
title: Attribute Routing
slug: attribute-routing
metadescription: Learn how route attributes map URLs to actions, how controller and action templates combine, what the token replacements do, and how to name routes and avoid conflicts.
updateDate: 2026-09-07T10:30
author: ['bishal-biswas']
level: 1
tags: ['routing', 'controllers', 'attributes']
course: dotnet-webapi
---

## What routing does

Routing is the step that looks at an incoming URL and decides which piece of your code should run.

```text
GET /api/books/5   ->   BooksController.GetById(5)
```

ASP.NET Core APIs use **attribute routing**, which means the URL pattern is written right next to the method that handles it. You can see the URL and the code in the same place, which is exactly what you want.

## The two levels

Routes are built from two attributes that combine.

`[Route]` on the **controller** gives the shared prefix. The verb attribute on the **action** gives the rest.

```csharp
[Route("api/books")]
public class BooksController : ControllerBase
{
    [HttpGet]                 // GET  /api/books
    public IActionResult GetAll() => Ok();

    [HttpGet("{id}")]         // GET  /api/books/5
    public IActionResult GetById(int id) => Ok();

    [HttpGet("{id}/reviews")] // GET  /api/books/5/reviews
    public IActionResult GetReviews(int id) => Ok();

    [HttpPost]                // POST /api/books
    public IActionResult Create() => Ok();
}
```

The controller template and the action template are joined with a slash. You do not write the slash yourself.

## Token replacement

Writing the controller name twice invites typos. Tokens fix that:

```csharp
[Route("api/[controller]")]
public class BooksController : ControllerBase { }
```

`[controller]` becomes the class name without the `Controller` suffix, so this is `/api/books`. Rename the class and the route follows automatically.

There is also `[action]`, which inserts the method name:

```csharp
[Route("api/[controller]/[action]")]
public class ReportsController : ControllerBase
{
    [HttpGet]                          // GET /api/reports/monthly
    public IActionResult Monthly() => Ok();

    [HttpGet]                          // GET /api/reports/annual
    public IActionResult Annual() => Ok();
}
```

Use `[action]` sparingly. Method names in a URL push you away from REST, where the URL should name a resource rather than an operation. It is genuinely useful for report style endpoints that do not map onto a resource.

## Escaping the prefix

A leading slash or tilde escapes the controller prefix entirely:

```csharp
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    [HttpGet("{id}")]        // /api/books/5     joined as normal
    public IActionResult GetById(int id) => Ok();

    [HttpGet("/health")]     // /health          absolute, ignores the prefix
    public IActionResult Health() => Ok("healthy");
}
```

Use this rarely. An endpoint that escapes its controller's prefix is easy to lose.

## Multiple routes to one action

An action can answer more than one URL. This is most useful when you rename an endpoint and need the old path to keep working:

```csharp
[HttpGet("current")]
[HttpGet("latest")]          // both reach the same code
public IActionResult GetCurrent() => Ok();
```

You can also stack `[Route]` on the controller:

```csharp
[Route("api/books")]
[Route("api/publications")]     // an alias for the whole controller
public class BooksController : ControllerBase { }
```

## Optional and default segments

A `?` makes a route segment optional. A `=` gives it a default:

```csharp
[HttpGet("archive/{year}/{month?}")]
// matches /archive/2026 and /archive/2026/09
public IActionResult Archive(int year, int? month) => Ok();

[HttpGet("list/{page=1}")]
// /list uses page 1, /list/3 uses page 3
public IActionResult List(int page) => Ok();
```

An optional segment must be the **last** one. `{a?}/{b}` is not allowed, because the router could not tell which value it received.

## Catch all segments

Two asterisks capture everything left in the path, slashes included:

```csharp
[HttpGet("files/{**path}")]
// /files/reports/2026/q1.pdf  ->  path = "reports/2026/q1.pdf"
public IActionResult Download(string path) => Ok(path);
```

Handy for file style APIs. Be careful with it, because anything unmatched below that prefix lands here.

## Naming a route

Give a route a name and you can generate URLs to it later:

```csharp
[HttpGet("{id:int}", Name = "GetBookById")]
public ActionResult<Book> GetById(int id) => Ok();

[HttpPost]
public IActionResult Create(Book book)
{
    // ...
    return CreatedAtRoute("GetBookById", new { id = book.Id }, book);
}
```

`CreatedAtAction(nameof(GetById), ...)` does the same thing using the method name, and it survives renames better because the compiler checks it. Prefer `nameof` unless two actions share a method name.

## Route conflicts

Two actions that match the same URL and verb produce an `AmbiguousMatchException` at request time, not at build time. That is a nasty surprise, so learn the shape of it:

```csharp
[HttpGet("{id}")]
public IActionResult GetById(string id) => Ok();

[HttpGet("{name}")]              // conflict, both match /api/books/anything
public IActionResult GetByName(string name) => Ok();
```

The fix is a **constraint**, which makes each route match a narrower set of URLs:

```csharp
[HttpGet("{id:int}")]            // only digits
public IActionResult GetById(int id) => Ok();

[HttpGet("{name:alpha}")]        // only letters
public IActionResult GetByName(string name) => Ok();
```

Now `/api/books/5` and `/api/books/clean-code` go to different actions. Constraints get their own topic next.

## How a route is chosen

When several routes could match, ASP.NET Core does not simply take the first one. It scores them, and **more specific wins**:

1. Literal text beats a parameter. `books/featured` beats `books/{id}`.
2. A constrained parameter beats an unconstrained one. `{id:int}` beats `{id}`.
3. A catch all is always last.

This is why you can safely put both of these in one controller:

```csharp
[HttpGet("featured")]            // /api/books/featured  wins for that exact URL
public IActionResult Featured() => Ok();

[HttpGet("{id:int}")]            // /api/books/5
public IActionResult GetById(int id) => Ok();
```

Order in the file does not matter. Specificity does.

## Seeing your routes

When a URL is not behaving, list every registered route. In development, map the endpoint explorer:

```csharp
if (app.Environment.IsDevelopment())
{
    app.MapGet("/routes", (IEnumerable<EndpointDataSource> sources) =>
        string.Join("\n", sources
            .SelectMany(s => s.Endpoints)
            .OfType<RouteEndpoint>()
            .Select(e => $"{e.RoutePattern.RawText}")));
}
```

Swagger also lists everything, which is usually enough.

## Quick recap

- Attribute routing puts the URL pattern next to the method that handles it.
- The controller `[Route]` and the action verb attribute are joined with a slash.
- `[controller]` inserts the class name without the suffix, so renames stay in sync.
- A leading slash escapes the controller prefix. Use it rarely.
- `{id?}` is optional and must come last. `{**path}` catches the rest of the URL.
- Two routes matching the same URL throw at request time. Fix it with constraints such as `{id:int}`.
- More specific routes win, so literal segments beat parameters regardless of file order.

<code id="code-content" class="language-csharp">
// Controllers/BooksController.cs - every attribute routing shape in one file.
using Microsoft.AspNetCore.Mvc;
[ApiController]
[Route("api/[controller]")]              // BooksController -&gt; /api/books
public class BooksController : ControllerBase
{
    private static readonly List&lt;Book&gt; Books = new()
    {
        new Book { Id = 1, Slug = "clean-code",  Title = "Clean Code",  Year = 2008, Featured = true },
        new Book { Id = 2, Slug = "refactoring", Title = "Refactoring", Year = 1999, Featured = false }
    };
    // GET /api/books
    [HttpGet]
    public ActionResult&lt;IEnumerable&lt;Book&gt;&gt; GetAll() =&gt; Ok(Books);
    // GET /api/books/featured
    // A literal segment beats {id:int}, so this wins for this exact URL
    // no matter where it sits in the file.
    [HttpGet("featured")]
    public ActionResult&lt;IEnumerable&lt;Book&gt;&gt; Featured() =&gt;
        Ok(Books.Where(b =&gt; b.Featured));
    // GET /api/books/5      the :int constraint keeps this away from the slug route
    [HttpGet("{id:int}", Name = "GetBookById")]
    public ActionResult&lt;Book&gt; GetById(int id) =&gt;
        Books.FirstOrDefault(b =&gt; b.Id == id) is Book b ? b : NotFound();
    // GET /api/books/clean-code    a different shape, so no ambiguity
    [HttpGet("{slug:regex(^[[a-z0-9-]]+$)}")]
    public ActionResult&lt;Book&gt; GetBySlug(string slug) =&gt;
        Books.FirstOrDefault(b =&gt; b.Slug == slug) is Book b ? b : NotFound();
    // GET /api/books/5/reviews     a nested resource
    [HttpGet("{id:int}/reviews")]
    public ActionResult&lt;object&gt; GetReviews(int id) =&gt;
        Ok(new { bookId = id, reviews = Array.Empty&lt;string&gt;() });
    // GET /api/books/archive/2026        month is optional, so it must come last
    // GET /api/books/archive/2026/09
    [HttpGet("archive/{year:int}/{month:int?}")]
    public ActionResult&lt;object&gt; Archive(int year, int? month) =&gt;
        Ok(new { year, month, matched = month is null ? "whole year" : "one month" });
    // Two URLs, one action. Useful when you rename an endpoint but keep the old path alive.
    [HttpGet("current")]
    [HttpGet("latest")]
    public ActionResult&lt;Book&gt; Current() =&gt; Books.OrderByDescending(b =&gt; b.Year).First();
    // POST /api/books  ->  CreatedAtRoute uses the name given above
    [HttpPost]
    public ActionResult&lt;Book&gt; Create([FromBody] Book book)
    {
        book.Id = Books.Max(b =&gt; b.Id) + 1;
        Books.Add(book);
        return CreatedAtRoute("GetBookById", new { id = book.Id }, book);
    }
    // A leading slash escapes the controller prefix entirely: /book-health
    [HttpGet("/book-health")]
    public IActionResult Health() =&gt; Ok(new { status = "ok", count = Books.Count });
}
public class Book
{
    public int Id { get; set; }
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public int Year { get; set; }
    public bool Featured { get; set; }
}
</code></pre>
