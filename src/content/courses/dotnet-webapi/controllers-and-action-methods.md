---
publishDate: 2026-09-04T10:20
title: Controllers and Action Methods
slug: controllers-and-action-methods
metadescription: Build your first API controller, learn what ControllerBase and the ApiController attribute give you, and write action methods for every HTTP verb.
updateDate: 2026-09-07T10:20
author: ['bishal-biswas']
level: 1
tags: ['controllers', 'mvc', 'actions']
course: dotnet-webapi
---

## What a controller is

A **controller** is a class that groups related endpoints. One controller per resource is the usual rule. Books go in `BooksController`, orders go in `OrdersController`.

Each public method inside it is an **action method**, and each action handles one kind of request.

```csharp
using Microsoft.AspNetCore.Mvc;

namespace BookStore.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll() => Ok(new[] { "Clean Code", "Refactoring" });
}
```

Save that as `Controllers/BooksController.cs` and `GET /api/books` works. Three ingredients made that happen. Let us look at each.

## Turning controllers on

Minimal APIs work out of the box. Controllers need two lines in `Program.cs`:

```csharp
builder.Services.AddControllers();   // register the MVC services

var app = builder.Build();

app.MapControllers();                // scan for controllers and wire up routes
```

Forget `MapControllers()` and every route returns `404` with no error message. It is the single most common "why is my controller not working" cause.

## ControllerBase, not Controller

There are two base classes and the names are confusingly similar.

**`ControllerBase`** has everything an API needs: `Ok()`, `NotFound()`, `BadRequest()`, model binding, `Request` and `Response`, and `User`.

**`Controller`** inherits from `ControllerBase` and adds view support: `View()`, `ViewBag`, `TempData`, Razor rendering.

An API never returns HTML views, so use **`ControllerBase`**. Inheriting from `Controller` drags in machinery you will never call.

## The class name becomes the route

`[Route("api/[controller]")]` uses a token. `[controller]` is replaced with the class name **minus the word Controller**.

```text
BooksController        ->  /api/books
OrdersController       ->  /api/orders
ShoppingCartController ->  /api/shoppingcart
```

The match is case insensitive, so `/api/Books` works too.

You can always write the route out by hand instead, which is clearer when the class name and the URL should differ:

```csharp
[Route("api/v1/catalogue")]
public class BooksController : ControllerBase { }
```

## What [ApiController] does for you

This one attribute changes several behaviours, and every API controller should have it.

**Automatic model validation.** If the incoming object fails validation, the framework returns `400` with a problem details body before your code runs. Without it you would write this at the top of every action:

```csharp
if (!ModelState.IsValid) return BadRequest(ModelState);   // not needed with [ApiController]
```

**Inferred binding sources.** The framework works out where each parameter comes from. Complex types come from the body, simple types from the route or query string. Without it you would need `[FromBody]` everywhere.

**Problem details for errors.** Error responses follow the RFC 9457 shape automatically, so every client sees the same error format.

**Attribute routing is required.** Conventional routes such as `{controller}/{action}` stop applying, which is what you want in an API.

You can apply it once to a whole project by putting it on an assembly level attribute, but putting it on each controller is clearer.

## Action methods for each verb

Attributes on the method decide which HTTP verb and which sub path it answers.

```csharp
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private static readonly List<Book> Books = new();

    [HttpGet]                                  // GET /api/books
    public IActionResult GetAll() => Ok(Books);

    [HttpGet("{id:int}")]                      // GET /api/books/5
    public IActionResult GetById(int id)
    {
        var book = Books.FirstOrDefault(b => b.Id == id);
        return book is null ? NotFound() : Ok(book);
    }

    [HttpPost]                                 // POST /api/books
    public IActionResult Create(Book book)
    {
        book.Id = Books.Count + 1;
        Books.Add(book);
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
    }

    [HttpPut("{id:int}")]                      // PUT /api/books/5
    public IActionResult Update(int id, Book book) { /* ... */ return NoContent(); }

    [HttpDelete("{id:int}")]                   // DELETE /api/books/5
    public IActionResult Delete(int id) { /* ... */ return NoContent(); }
}
```

Notice the pattern. The verb attribute carries the **extra** part of the route. The controller level `[Route]` carries the shared prefix. They are joined together.

## Return types

You have three choices, and they trade convenience against clarity.

**`IActionResult`** lets you return any status code. Swagger cannot tell what type comes back unless you add `[ProducesResponseType]`.

```csharp
[HttpGet("{id:int}")]
[ProducesResponseType(typeof(Book), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public IActionResult GetById(int id) { /* ... */ }
```

**`ActionResult<T>`** is the best of both. You can return the object directly or a status result, and Swagger knows the type:

```csharp
[HttpGet("{id:int}")]
public ActionResult<Book> GetById(int id)
{
    var book = Books.FirstOrDefault(b => b.Id == id);
    if (book is null) return NotFound();
    return book;                     // implicitly a 200 with the book
}
```

**The plain type** is fine when there is exactly one outcome:

```csharp
[HttpGet]
public List<Book> GetAll() => Books;      // always 200
```

Prefer `ActionResult<T>` for anything that can fail. It documents itself and it keeps `NotFound()` available.

## Async actions

Any action that touches a database or another service should be async. Return `Task<ActionResult<T>>` and await the work:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<Book>> GetById(int id)
{
    Book? book = await db.Books.FindAsync(id);
    return book is null ? NotFound() : book;
}
```

The framework handles the rest. There is a whole topic on why this matters for throughput.

## Constructor injection

Controllers get their dependencies through the constructor, exactly like any other class:

```csharp
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly IBookService service;
    private readonly ILogger<BooksController> logger;

    public BooksController(IBookService service, ILogger<BooksController> logger)
    {
        this.service = service;
        this.logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<Book>>> GetAll()
    {
        logger.LogInformation("Listing all books");
        return await service.GetAllAsync();
    }
}
```

Controllers are created fresh for every request, so they can safely hold per request state. Do not try to cache anything in a field between requests.

The newer primary constructor syntax makes this shorter:

```csharp
public class BooksController(IBookService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<Book>>> GetAll() => await service.GetAllAsync();
}
```

## Keep controllers thin

A controller has one job: translate HTTP into a call, and translate the result back into HTTP. Reading the request, validating, choosing a status code. That is all.

Business rules, database queries and calls to other services belong in a **service** class that the controller injects. When you find a controller action longer than about twenty lines, something in it belongs somewhere else.

## Quick recap

- A controller groups the endpoints for one resource, and each public method is an action.
- Add `AddControllers()` and `MapControllers()` in `Program.cs`, or nothing routes.
- Inherit from `ControllerBase` for APIs. `Controller` is for Razor views.
- `[Route("api/[controller]")]` turns `BooksController` into `/api/books`.
- `[ApiController]` gives you automatic `400` validation, inferred binding and problem details. Always add it.
- Prefer `ActionResult<T>` so you get both a typed success and status helpers such as `NotFound()`.
- Inject dependencies through the constructor and keep the action itself short.

<code id="code-content" class="language-csharp">
// Controllers/BooksController.cs - a complete, conventional API controller.
using Microsoft.AspNetCore.Mvc;
namespace BookStore.Api.Controllers;
[ApiController]                       // 400 on invalid models, inferred binding, problem details
[Route("api/[controller]")]           // BooksController -&gt; /api/books
[Produces("application/json")]
public class BooksController : ControllerBase        // ControllerBase, not Controller
{
    private static readonly List&lt;Book&gt; Books = new()
    {
        new Book { Id = 1, Title = "Clean Code",  Year = 2008 },
        new Book { Id = 2, Title = "Refactoring", Year = 1999 }
    };
    private readonly ILogger&lt;BooksController&gt; logger;
    // Dependencies arrive through the constructor. A new controller per request.
    public BooksController(ILogger&lt;BooksController&gt; logger) =&gt; this.logger = logger;
    // GET /api/books?year=1999
    [HttpGet]
    public ActionResult&lt;IEnumerable&lt;Book&gt;&gt; GetAll([FromQuery] int? year)
    {
        logger.LogInformation("Listing books, year filter {Year}", year);
        return Ok(Books.Where(b =&gt; year is null || b.Year == year).ToList());
    }
    // GET /api/books/5   ->  ActionResult&lt;T&gt; gives a typed 200 plus status helpers
    [HttpGet("{id:int}", Name = nameof(GetById))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult&lt;Book&gt; GetById(int id)
    {
        Book? book = Books.FirstOrDefault(b =&gt; b.Id == id);
        if (book is null) return NotFound();
        return book;                                  // implicit 200 OK
    }
    // POST /api/books   ->  201 plus a Location header pointing at GetById
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public ActionResult&lt;Book&gt; Create([FromBody] Book book)
    {
        // No ModelState check needed: [ApiController] already returned 400 if invalid
        book.Id = Books.Count == 0 ? 1 : Books.Max(b =&gt; b.Id) + 1;
        Books.Add(book);
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
    }
    // PUT /api/books/5   ->  full replacement
    [HttpPut("{id:int}")]
    public IActionResult Update(int id, [FromBody] Book input)
    {
        Book? book = Books.FirstOrDefault(b =&gt; b.Id == id);
        if (book is null) return NotFound();
        book.Title = input.Title;
        book.Year  = input.Year;
        return NoContent();
    }
    // DELETE /api/books/5
    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
    {
        Book? book = Books.FirstOrDefault(b =&gt; b.Id == id);
        if (book is null) return NotFound();
        Books.Remove(book);
        return NoContent();
    }
    // A sub resource route: GET /api/books/5/summary
    [HttpGet("{id:int}/summary")]
    public ActionResult&lt;string&gt; Summary(int id) =&gt;
        Books.FirstOrDefault(b =&gt; b.Id == id) is Book b
            ? $"{b.Title} ({b.Year})"
            : NotFound();
}
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public int Year { get; set; }
}
</code></pre>
