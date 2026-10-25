---
publishDate: 2026-09-06T10:50
title: Model Binding
slug: model-binding
metadescription: Understand how ASP.NET Core turns a raw HTTP request into C# parameters, the six binding sources, the inference rules with ApiController, and how to fix binding when it goes wrong.
updateDate: 2026-09-07T10:50
author: ['bishal-biswas']
level: 2
tags: ['model-binding', 'controllers', 'requests']
course: dotnet-webapi
---

## The problem model binding solves

An HTTP request is text. Your method wants typed C# values. Something has to bridge the gap.

```http
POST /api/books/5/reviews?notify=true HTTP/1.1
Content-Type: application/json

{ "rating": 5, "comment": "Excellent" }
```

```csharp
[HttpPost("{bookId:int}/reviews")]
public IActionResult AddReview(int bookId, bool notify, ReviewDto review)
{
    // bookId = 5, notify = true, review.Rating = 5
}
```

Three values, three different places in the request, and you wrote no parsing code. That is **model binding**.

## The six binding sources

Each attribute tells the framework where to look.

**`[FromRoute]`** reads a segment of the URL path.

```csharp
// GET /api/books/5
[HttpGet("{id:int}")]
public IActionResult Get([FromRoute] int id) => Ok(id);
```

**`[FromQuery]`** reads the query string.

```csharp
// GET /api/books?page=2&size=50
public IActionResult Get([FromQuery] int page, [FromQuery] int size) => Ok();
```

**`[FromBody]`** deserializes the request body, normally JSON.

```csharp
public IActionResult Create([FromBody] Book book) => Ok();
```

**`[FromHeader]`** reads a header.

```csharp
public IActionResult Get([FromHeader(Name = "X-Tenant-Id")] string tenantId) => Ok();
```

**`[FromForm]`** reads form fields and uploaded files.

```csharp
public IActionResult Upload([FromForm] IFormFile file, [FromForm] string title) => Ok();
```

**`[FromServices]`** pulls a registered service out of the DI container.

```csharp
public IActionResult Get([FromServices] IBookService service) => Ok();
```

## You usually do not need the attributes

With `[ApiController]` on the class, the framework infers the source. The rules are short and worth memorising:

1. A parameter whose name matches a **route** template segment comes from the route.
2. A **complex type** comes from the body.
3. A **simple type** such as `int`, `string`, `bool`, `DateTime`, `Guid` or an enum comes from the query string.
4. `IFormFile` and `IFormFileCollection` come from the form.
5. A type registered in DI comes from services.

So this works with no attributes at all:

```csharp
[HttpPost("{bookId:int}/reviews")]
public IActionResult AddReview(int bookId, bool notify, ReviewDto review)
```

`bookId` matches the route. `notify` is simple, so query string. `ReviewDto` is complex, so body.

Add the attributes when the inference is wrong, or when you want the code to be obvious to a reader. Many teams write them out anyway for clarity.

## Only one [FromBody] per action

A request has one body, and reading it consumes the stream. Two `[FromBody]` parameters throw at startup:

```csharp
// Throws: cannot bind two parameters from the body
public IActionResult Create([FromBody] Book book, [FromBody] Author author) => Ok();
```

Wrap them in one type instead:

```csharp
public record CreateBookRequest(Book Book, Author Author);

public IActionResult Create([FromBody] CreateBookRequest request) => Ok();
```

## Binding collections

Query strings can carry lists by repeating the key:

```http
GET /api/books?ids=1&ids=2&ids=3
```

```csharp
public IActionResult GetMany([FromQuery] int[] ids) => Ok(ids);   // [1, 2, 3]
```

JSON arrays bind straight to `List<T>`:

```json
{ "tags": ["clean-code", "refactoring"] }
```

```csharp
public record CreateBookRequest(string Title, List<string> Tags);
```

## Binding a whole object from the query string

For a list endpoint with many filters, a bag of parameters gets ugly:

```csharp
public IActionResult Search(int page, int size, string? title, int? year, string? sort)
```

Group them into a class and bind the whole thing:

```csharp
public class BookQuery
{
    public int Page { get; set; } = 1;
    public int Size { get; set; } = 20;
    public string? Title { get; set; }
    public int? Year { get; set; }
    public string Sort { get; set; } = "title";
}

[HttpGet]
public IActionResult Search([FromQuery] BookQuery query) => Ok(query);
```

```text
GET /api/books?page=2&size=50&title=clean&sort=year
```

`[FromQuery]` is required here, because a complex type would otherwise be inferred as the body. The payoff is real: validation attributes work on the class, defaults live in one place, and Swagger documents each field.

## What happens when binding fails

If a value cannot be converted, the framework records an error in `ModelState`. With `[ApiController]`, that becomes an automatic `400`:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "year": ["The value 'abc' is not valid for Year."]
  }
}
```

A missing value is different from an invalid one. A missing `int` becomes `0`, and a missing `string` becomes `null`. If a value is genuinely required, mark it required rather than hoping for a binding error:

```csharp
public class CreateBookRequest
{
    [Required]
    public string Title { get; set; } = "";

    [Range(1000, 2100)]
    public int Year { get; set; }
}
```

## Binding is case insensitive

`?Page=2`, `?page=2` and `?PAGE=2` all bind to `Page`. The same is true for JSON property names when `PropertyNameCaseInsensitive` is on, which is the default for controllers. You do not need to worry about a client's casing habits.

## Making a route value name differ from the parameter

Sometimes the URL word and the C# name should not match:

```csharp
[HttpGet("{book-id:int}")]
public IActionResult Get([FromRoute(Name = "book-id")] int bookId) => Ok(bookId);
```

The same `Name` option exists on `[FromQuery]` and `[FromHeader]`.

## Custom binding for special formats

When a value needs conversion the framework does not know, write a `IModelBinder`. A common case is a comma separated list:

```http
GET /api/books?ids=1,2,3
```

```csharp
public class CommaSeparatedIntBinder : IModelBinder
{
    public Task BindModelAsync(ModelBindingContext context)
    {
        var value = context.ValueProvider.GetValue(context.ModelName).FirstValue;

        if (string.IsNullOrWhiteSpace(value))
        {
            context.Result = ModelBindingResult.Success(Array.Empty<int>());
            return Task.CompletedTask;
        }

        var parsed = value.Split(',')
            .Select(s => int.TryParse(s.Trim(), out var n) ? n : (int?)null)
            .Where(n => n is not null)
            .Select(n => n!.Value)
            .ToArray();

        context.Result = ModelBindingResult.Success(parsed);
        return Task.CompletedTask;
    }
}
```

```csharp
public IActionResult GetMany([ModelBinder(typeof(CommaSeparatedIntBinder))] int[] ids) => Ok(ids);
```

For a simpler need, a `TypeConverter` on the type itself is often enough and applies everywhere automatically.

## Minimal API binding

Minimal APIs use the same sources with slightly different defaults. The big difference: there is **no inference for complex types from the query string**, and a complex type is assumed to come from the body.

```csharp
app.MapGet("/api/books/{id:int}", (int id) => Results.Ok(id));

app.MapGet("/api/books", ([AsParameters] BookQuery query) => Results.Ok(query));

app.MapPost("/api/books", (CreateBookRequest request) => Results.Ok(request));
```

`[AsParameters]` is the minimal API way to bind a whole object from the route and query string.

A type can also bind itself by implementing a static `TryParse` or `BindAsync`:

```csharp
public record Coordinates(double Lat, double Lon)
{
    public static bool TryParse(string? value, out Coordinates result)
    {
        result = new Coordinates(0, 0);
        var parts = value?.Split(',');
        if (parts?.Length != 2) return false;
        if (!double.TryParse(parts[0], out var lat)) return false;
        if (!double.TryParse(parts[1], out var lon)) return false;
        result = new Coordinates(lat, lon);
        return true;
    }
}

// GET /api/nearby?at=51.5,-0.12
app.MapGet("/api/nearby", (Coordinates at) => Results.Ok(at));
```

## Quick recap

- Model binding turns route segments, query strings, headers, the body and form fields into typed parameters.
- With `[ApiController]`, complex types come from the body and simple types come from the route or query string automatically.
- Only one parameter can be `[FromBody]`, because the body is read once.
- Group many query filters into a class and bind it with `[FromQuery]`.
- Missing values become defaults such as `0` and `null`, so use `[Required]` when a value must be there.
- Binding is case insensitive for both query keys and JSON properties.
- Write an `IModelBinder` for unusual formats, or a static `TryParse` for minimal APIs.

<code id="code-content" class="language-csharp">
// Controllers/BooksController.cs - every binding source in one controller.
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    // 1. Inference in action: no attributes needed.
    //    bookId matches the route, notify is simple so query, review is complex so body.
    // POST /api/books/5/reviews?notify=true
    [HttpPost("{bookId:int}/reviews")]
    public IActionResult AddReview(int bookId, bool notify, ReviewDto review) =&gt;
        Ok(new { bookId, notify, review });
    // 2. The same thing written explicitly. Many teams prefer this for readability.
    [HttpPost("{bookId:int}/notes")]
    public IActionResult AddNote(
        [FromRoute] int bookId,
        [FromQuery] bool notify,
        [FromHeader(Name = "X-Author")] string? author,
        [FromBody]  NoteDto note,
        [FromServices] ILogger&lt;BooksController&gt; logger)
    {
        logger.LogInformation("Note on {BookId} by {Author}", bookId, author ?? "anonymous");
        return Ok(new { bookId, notify, author, note });
    }
    // 3. A bag of filters bound as one object. [FromQuery] is required here,
    //    because a complex type would otherwise be read from the body.
    // GET /api/books?page=2&amp;size=50&amp;title=clean&amp;sort=year
    [HttpGet]
    public IActionResult Search([FromQuery] BookQuery query) =&gt; Ok(query);
    // 4. Arrays from a repeated query key: /api/books/many?ids=1&amp;ids=2&amp;ids=3
    [HttpGet("many")]
    public IActionResult GetMany([FromQuery] int[] ids) =&gt; Ok(new { count = ids.Length, ids });
    // 5. A different name in the URL than in C#
    [HttpGet("by-code/{book-code}")]
    public IActionResult ByCode([FromRoute(Name = "book-code")] string bookCode) =&gt; Ok(bookCode);
    // 6. Form data and a file. Note [FromForm], not [FromBody].
    [HttpPost("{id:int}/cover")]
    public IActionResult UploadCover(int id, [FromForm] IFormFile file, [FromForm] string? caption) =&gt;
        Ok(new { id, file.FileName, file.Length, caption });
}
// Validation attributes work on a bound query object, and Swagger documents each field
public class BookQuery
{
    [Range(1, int.MaxValue)]  public int Page { get; set; } = 1;
    [Range(1, 100)]           public int Size { get; set; } = 20;
    [StringLength(100)]       public string? Title { get; set; }
    [Range(1000, 2100)]       public int? Year { get; set; }
                              public string Sort { get; set; } = "title";
}
public class ReviewDto
{
    [Required, StringLength(1000)] public string Comment { get; set; } = "";
    [Range(1, 5)]                  public int Rating { get; set; }
}
public record NoteDto(string Text);
</code></pre>
