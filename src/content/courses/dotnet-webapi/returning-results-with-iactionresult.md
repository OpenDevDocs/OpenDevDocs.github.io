---
publishDate: 2026-09-06T11:00
title: Returning Results with IActionResult
slug: returning-results-with-iactionresult
metadescription: Compare IActionResult, ActionResult of T and plain return types, learn every helper method on ControllerBase, and see the minimal API equivalents on Results.
updateDate: 2026-09-07T11:00
author: ['bishal-biswas']
level: 1
tags: ['controllers', 'responses', 'status-codes']
course: dotnet-webapi
---

## Three ways to return

An action method can return a value, a result, or both. Each choice trades convenience against control.

**Return the type directly** when there is exactly one outcome:

```csharp
[HttpGet]
public List<Book> GetAll() => books;      // always 200 OK with JSON
```

**Return `IActionResult`** when you need different status codes:

```csharp
[HttpGet("{id:int}")]
public IActionResult GetById(int id)
{
    var book = books.FirstOrDefault(b => b.Id == id);
    return book is null ? NotFound() : Ok(book);
}
```

**Return `ActionResult<T>`** to get both. This is the one to reach for by default:

```csharp
[HttpGet("{id:int}")]
public ActionResult<Book> GetById(int id)
{
    var book = books.FirstOrDefault(b => b.Id == id);
    if (book is null) return NotFound();
    return book;                          // implicit 200 OK
}
```

## Why ActionResult of T wins

The difference is what the framework can tell about your action without running it.

With `IActionResult`, the return type says nothing. Swagger shows an empty response schema unless you add `[ProducesResponseType(typeof(Book), 200)]` by hand, and generated clients get `object`.

With `ActionResult<Book>`, the success type is in the signature. Swagger reads it, the client generator reads it, and you only annotate the **failure** codes:

```csharp
[HttpGet("{id:int}")]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public ActionResult<Book> GetById(int id) { /* ... */ }
```

It works through an implicit conversion. C# quietly wraps `return book;` into an `OkObjectResult`, and `return NotFound();` into a `NotFoundResult`. Both fit in the same return type.

One quirk to know: the implicit conversion cannot happen inside a ternary, because C# cannot pick a common type for the two branches.

```csharp
// Does not compile
return book is null ? NotFound() : book;

// Either add a cast
return book is null ? NotFound() : (ActionResult<Book>)book;

// Or, more readably, use an if
if (book is null) return NotFound();
return book;
```

## The helper methods

`ControllerBase` gives you a helper for every response you will realistically send.

Success:

```csharp
Ok()                                   // 200, no body
Ok(value)                              // 200 with JSON
Created(uri, value)                    // 201 with a Location header
CreatedAtAction(nameof(GetById), new { id }, value)
CreatedAtRoute("GetBookById", new { id }, value)
Accepted(uri, value)                   // 202
NoContent()                            // 204
```

Client errors:

```csharp
BadRequest()                           // 400
BadRequest(value)                      // 400 with a body
BadRequest(ModelState)                 // 400 with validation details
Unauthorized()                         // 401
Forbid()                               // 403
NotFound()                             // 404
NotFound(value)                        // 404 with a body
Conflict(value)                        // 409
UnprocessableEntity(value)             // 422
ValidationProblem()                    // 400 in problem details shape
Problem(detail, statusCode: 503)       // any code in problem details shape
```

Anything else:

```csharp
StatusCode(418)
StatusCode(503, new { error = "Database unavailable" })
```

Content and files:

```csharp
Content("plain text", "text/plain")
File(bytes, "application/pdf", "invoice.pdf")
PhysicalFile(path, "image/png")
Redirect("https://example.com")
```

## CreatedAtAction, done properly

A `201` should tell the client where the new resource lives. `CreatedAtAction` builds that URL from a route, so it stays correct even when you change the URL later:

```csharp
[HttpGet("{id:int}", Name = nameof(GetById))]
public ActionResult<Book> GetById(int id) { /* ... */ }

[HttpPost]
public ActionResult<Book> Create(CreateBookRequest request)
{
    var book = service.Create(request);
    return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
}
```

```http
HTTP/1.1 201 Created
Location: https://api.example.com/api/books/7

{ "id": 7, "title": "Refactoring", "year": 1999 }
```

Two things go wrong here often. If the anonymous object's property name does not match the route parameter (`new { bookId = ... }` when the route says `{id}`), the `Location` header comes out wrong or empty. And if the target action is in another controller, use the overload that takes a controller name.

## Forbid versus returning 403

`Forbid()` is not the same as `StatusCode(403)`. `Forbid()` goes through the authentication scheme, which lets it do the right thing per scheme, such as redirecting for cookies or writing a `WWW-Authenticate` header for JWT. For an API with a single JWT scheme the visible result is the same, but `Forbid()` is the correct call and it keeps working if you add another scheme later.

The same applies to `Unauthorized()` versus `StatusCode(401)`.

## Async actions

Wrap the return type in `Task<>` and nothing else changes:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<Book>> GetById(int id)
{
    Book? book = await db.Books.FindAsync(id);
    if (book is null) return NotFound();
    return book;
}
```

## Minimal API equivalents

Minimal APIs use the static `Results` class, and the names line up almost exactly:

```csharp
Results.Ok(value);
Results.Created($"/api/books/{id}", value);
Results.CreatedAtRoute("GetBookById", new { id }, value);
Results.Accepted();
Results.NoContent();
Results.BadRequest(value);
Results.Unauthorized();
Results.Forbid();
Results.NotFound();
Results.Conflict(value);
Results.UnprocessableEntity(value);
Results.Problem(detail: "Database unavailable", statusCode: 503);
Results.ValidationProblem(errors);
Results.StatusCode(418);
Results.Text("plain text", "text/plain");
Results.File(bytes, "application/pdf", "invoice.pdf");
Results.Redirect("https://example.com");
```

For OpenAPI to see the types, use `TypedResults` instead. It returns a specific type rather than the general `IResult`:

```csharp
app.MapGet("/api/books/{id:int}",
    Results<Ok<Book>, NotFound> (int id) =>
        books.FirstOrDefault(b => b.Id == id) is Book b
            ? TypedResults.Ok(b)
            : TypedResults.NotFound());
```

That signature says, in the type system, "this returns either a `200` with a `Book` or a `404`". Swagger documents both without a single attribute, and the compiler stops you returning anything else.

## Do not return your database entity

One habit worth forming now. Returning an EF Core entity directly leaks your schema, can expose fields such as `PasswordHash`, and can trip circular reference errors when navigation properties point at each other.

```csharp
// Leaks everything on the entity
public ActionResult<User> Get(int id) => db.Users.Find(id);

// Returns exactly what the client should see
public ActionResult<UserResponse> Get(int id)
{
    var user = db.Users.Find(id);
    if (user is null) return NotFound();
    return new UserResponse(user.Id, user.Email, user.DisplayName);
}
```

The next topic on DTOs covers this properly.

## Quick recap

- Return a plain type when there is one outcome, and `ActionResult<T>` when there is more than one.
- `ActionResult<T>` puts the success type in the signature, so Swagger and client generators pick it up.
- The implicit conversion does not work in a ternary. Use an `if` and an early return.
- `Ok`, `NotFound`, `BadRequest`, `NoContent`, `Conflict` and friends cover nearly every response.
- `CreatedAtAction` builds the `Location` header for you, so match the route parameter names exactly.
- Prefer `Forbid()` and `Unauthorized()` over raw `StatusCode` calls, because they respect the auth scheme.
- Minimal APIs use `Results.*`, or `TypedResults` with a `Results<...>` return type for full OpenAPI detail.
- Return a DTO, never a database entity.

<code id="code-content" class="language-csharp">
// Controllers/BooksController.cs - every return shape, side by side.
using Microsoft.AspNetCore.Mvc;
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private static readonly List&lt;Book&gt; Books = new()
    {
        new Book { Id = 1, Title = "Clean Code", Year = 2008, InternalCost = 4.50m }
    };
    // 1. Plain type: exactly one outcome, always 200
    [HttpGet]
    public IEnumerable&lt;BookResponse&gt; GetAll() =&gt;
        Books.Select(b =&gt; new BookResponse(b.Id, b.Title, b.Year));
    // 2. ActionResult&lt;T&gt;: typed success plus status helpers. The default choice.
    [HttpGet("{id:int}", Name = nameof(GetById))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult&lt;BookResponse&gt; GetById(int id)
    {
        Book? book = Books.FirstOrDefault(b =&gt; b.Id == id);
        // A ternary will not compile here: C# cannot merge NotFoundResult and BookResponse.
        if (book is null) return NotFound();
        return new BookResponse(book.Id, book.Title, book.Year);   // implicit 200
    }
    // 3. 201 Created. The anonymous object's property must match the {id} route parameter.
    [HttpPost]
    public ActionResult&lt;BookResponse&gt; Create([FromBody] CreateBookRequest request)
    {
        var book = new Book
        {
            Id    = Books.Count == 0 ? 1 : Books.Max(b =&gt; b.Id) + 1,
            Title = request.Title,
            Year  = request.Year
        };
        Books.Add(book);
        var response = new BookResponse(book.Id, book.Title, book.Year);
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, response);
    }
    // 4. 204 No Content: it worked, nothing to send
    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
    {
        Book? book = Books.FirstOrDefault(b =&gt; b.Id == id);
        if (book is null) return NotFound();
        Books.Remove(book);
        return NoContent();
    }
    // 5. 409 Conflict with a useful body
    [HttpPost("import")]
    public IActionResult Import([FromBody] CreateBookRequest request)
    {
        if (Books.Any(b =&gt; b.Title == request.Title))
            return Conflict(new { error = $"'{request.Title}' already exists." });
        return Accepted($"/api/jobs/{Guid.NewGuid():N}");        // 202
    }
    // 6. Problem details for an unusual code, and a file download
    [HttpGet("report")]
    public IActionResult Report(bool databaseUp = true)
    {
        if (!databaseUp)
            return Problem(detail: "The reporting database is offline.",
                           statusCode: StatusCodes.Status503ServiceUnavailable,
                           title: "Service unavailable");
        byte[] csv = System.Text.Encoding.UTF8.GetBytes("id,title\n1,Clean Code\n");
        return File(csv, "text/csv", "books.csv");
    }
}
// The entity: has fields the client must never see
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public int Year { get; set; }
    public decimal InternalCost { get; set; }
}
// The response: exactly what the client is allowed to know
public record BookResponse(int Id, string Title, int Year);
public record CreateBookRequest(string Title, int Year);
</code></pre>
