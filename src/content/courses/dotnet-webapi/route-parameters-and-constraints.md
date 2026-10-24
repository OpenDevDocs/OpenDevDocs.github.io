---
publishDate: 2026-09-05T10:40
title: Route Parameters and Constraints
slug: route-parameters-and-constraints
metadescription: Capture values from the URL, restrict them with built in route constraints such as int, min, range and regex, and write your own custom constraint when the built in ones are not enough.
updateDate: 2026-09-07T10:40
author: ['bishal-biswas']
level: 2
tags: ['routing', 'constraints', 'validation']
course: dotnet-webapi
---

## Capturing a value from the URL

Anything in curly braces in a route template becomes a **route parameter**. The router pulls the value out of the URL and hands it to a matching method parameter.

```csharp
[HttpGet("{id}")]
public IActionResult GetById(int id) => Ok(id);
```

```text
GET /api/books/5     ->  id = 5
```

The name in the braces must match the parameter name. `{id}` fills `int id`. If you write `{bookId}` and the parameter is `id`, the value never arrives and you get the default, which is `0`.

You can capture several:

```csharp
[HttpGet("{year:int}/{month:int}")]
public IActionResult Archive(int year, int month) => Ok(new { year, month });
```

## Why constraints exist

Without a constraint, `{id}` matches anything. That causes two problems.

**Wrong types reach your code.** `/api/books/abc` tries to bind `"abc"` to `int id`, fails, and returns a `400` from model binding. That works, but the error is vague.

**Routes collide.** Two actions with `{id}` and `{slug}` both match every URL, and you get an ambiguous match exception at runtime.

A **constraint** narrows what a segment can match. It is written after a colon:

```csharp
[HttpGet("{id:int}")]
```

Now `/api/books/abc` does not match this route at all. If nothing else matches, the client gets a clean `404`, which is the honest answer: there is no such resource.

This is the key mental shift. A constraint is not validation. It is part of **matching**. A failed constraint means "this route is not for you", not "your input was wrong".

## Built in constraints

Type constraints:

```csharp
[HttpGet("{id:int}")]          // 5
[HttpGet("{price:decimal}")]   // 19.99
[HttpGet("{active:bool}")]     // true
[HttpGet("{id:guid}")]         // 8f14e45f-ceea-467a-9c1e-4e2f6b2d0c3a
[HttpGet("{when:datetime}")]   // 2026-09-07
[HttpGet("{ratio:double}")]    // 0.75
[HttpGet("{count:long}")]      // 9000000000
```

Length constraints on strings:

```csharp
[HttpGet("{code:length(6)}")]        // exactly 6 characters
[HttpGet("{code:length(2,8)}")]      // between 2 and 8
[HttpGet("{code:minlength(3)}")]     // at least 3
[HttpGet("{code:maxlength(20)}")]    // at most 20
```

Value constraints on numbers:

```csharp
[HttpGet("{id:min(1)}")]             // 1 or more
[HttpGet("{id:max(1000)}")]          // 1000 or less
[HttpGet("{page:range(1,100)}")]     // between 1 and 100 inclusive
```

Character class constraints:

```csharp
[HttpGet("{name:alpha}")]            // letters only
[HttpGet("{slug:regex(^[[a-z0-9-]]+$)}")]
```

And the modifier that combines with any of them:

```csharp
[HttpGet("{id:int?}")]               // optional, and an int if present
```

## Chaining constraints

Stack them with more colons. All must pass:

```csharp
[HttpGet("{page:int:min(1)}")]
[HttpGet("{code:alpha:length(3)}")]
[HttpGet("{id:int:range(1,9999)}")]
```

`{page:int:min(1)}` reads as "an integer, and at least 1". A request for `/list/0` simply does not match.

## Escaping brackets in a regex

This one costs people an hour. Inside an **attribute**, square brackets mean token replacement, so `[a-z]` would be treated as a token. You escape them by doubling:

```csharp
// In an attribute: double the brackets
[HttpGet("{slug:regex(^[[a-z0-9-]]+$)}")]
```

```csharp
// In a minimal API string: single brackets, because there is no token replacement
app.MapGet("/books/{slug:regex(^[a-z0-9-]+$)}", (string slug) => slug);
```

Also remember that a route template uses `{` and `}` for parameters, so a regex quantifier such as `\d{4}` will confuse the parser. Prefer a named constraint or move the check into validation when the pattern gets complicated.

## Solving a real collision

You want both of these to work:

```text
GET /api/books/5
GET /api/books/clean-code
```

Without constraints they conflict. With them, each route matches a different shape:

```csharp
[HttpGet("{id:int}")]
public ActionResult<Book> GetById(int id) => Ok();

[HttpGet("{slug:regex(^[[a-z0-9-]]+$)}")]
public ActionResult<Book> GetBySlug(string slug) => Ok();
```

The router scores routes and prefers the more specific match, so digits go to `GetById` and everything else that looks like a slug goes to `GetBySlug`.

## Writing a custom constraint

When the built in ones are not enough, implement `IRouteConstraint`. Here is one that only matches a valid ISBN 13:

```csharp
public class IsbnConstraint : IRouteConstraint
{
    public bool Match(
        HttpContext? httpContext,
        IRouter? route,
        string routeKey,
        RouteValueDictionary values,
        RouteDirection routeDirection)
    {
        if (!values.TryGetValue(routeKey, out var raw) || raw is null)
            return false;

        string value = raw.ToString()!.Replace("-", "");

        return value.Length == 13 && value.All(char.IsDigit);
    }
}
```

Register it with a name in `Program.cs`:

```csharp
builder.Services.Configure<RouteOptions>(options =>
{
    options.ConstraintMap.Add("isbn", typeof(IsbnConstraint));
});
```

And use it like any built in constraint:

```csharp
[HttpGet("isbn/{code:isbn}")]
public ActionResult<Book> GetByIsbn(string code) => Ok();
```

`Match` must be fast and must not touch a database. It runs on every candidate request. Checking a format is fine. Checking whether the record exists is not, because that belongs in the action, where you can return a proper `404`.

## Constraints are not validation

Worth saying twice, because it decides how your API behaves.

A **constraint** failing means no route matched, so the client gets `404 Not Found`.

**Validation** failing means the route matched, your code ran, and the input was rejected, so the client gets `400 Bad Request` with a message explaining what was wrong.

Use constraints to disambiguate routes and to reject obviously wrong shapes. Use validation attributes on your models for business rules, because those give the caller a useful message.

```csharp
// Constraint: /api/books/0 gives a bare 404
[HttpGet("{id:int:min(1)}")]

// Validation: gives 400 with "Page must be between 1 and 100"
public class PageQuery
{
    [Range(1, 100, ErrorMessage = "Page must be between 1 and 100")]
    public int Page { get; set; } = 1;
}
```

## Quick recap

- `{name}` in a route template captures a URL segment into a parameter with the same name.
- A constraint after a colon narrows what the segment can match, for example `{id:int}`.
- Constraints take part in **matching**, so a failure gives `404`, not `400`.
- Chain them with more colons, as in `{page:int:min(1)}`.
- Inside attributes, escape regex square brackets by doubling them: `[[a-z]]`.
- Constraints resolve collisions such as `/books/5` versus `/books/clean-code`.
- Implement `IRouteConstraint` and register it in `ConstraintMap` for custom rules. Keep `Match` fast.
- Use validation, not constraints, when the caller deserves an explanation.

<code id="code-content" class="language-csharp">
// Program.cs - route parameters and constraints, including a custom one.
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);
// Register the custom constraint under the name "isbn"
builder.Services.Configure&lt;RouteOptions&gt;(options =&gt;
{
    options.ConstraintMap.Add("isbn", typeof(IsbnConstraint));
});
var app = builder.Build();
var books = new List&lt;Book&gt;
{
    new Book(1, "clean-code",  "Clean Code",  "9780132350884", 2008),
    new Book(2, "refactoring", "Refactoring", "9780201485677", 1999)
};
// {id:int} only matches digits, so /api/books/clean-code never reaches here
app.MapGet("/api/books/{id:int}", (int id) =&gt;
    books.FirstOrDefault(b =&gt; b.Id == id) is Book b ? Results.Ok(b) : Results.NotFound());
// A different shape, so no ambiguity with the route above.
// Note: single square brackets here, because minimal API strings do not do token replacement.
app.MapGet("/api/books/{slug:regex(^[a-z0-9-]+$)}", (string slug) =&gt;
    books.FirstOrDefault(b =&gt; b.Slug == slug) is Book b ? Results.Ok(b) : Results.NotFound());
// Our custom constraint: only a 13 digit ISBN gets through
app.MapGet("/api/books/isbn/{code:isbn}", (string code) =&gt;
    books.FirstOrDefault(b =&gt; b.Isbn == code.Replace("-", "")) is Book b
        ? Results.Ok(b)
        : Results.NotFound());
// Chained constraints: an integer, and at least 1. /api/books/page/0 gives 404.
app.MapGet("/api/books/page/{page:int:min(1)}", (int page) =&gt;
    Results.Ok(new { page, items = books.Skip((page - 1) * 10).Take(10) }));
// Optional segment. It must be the last one in the template.
app.MapGet("/api/books/archive/{year:int:range(1900,2100)}/{month:int:range(1,12)?}",
    (int year, int? month) =&gt; Results.Ok(new
    {
        year,
        month,
        scope = month is null ? "whole year" : "single month"
    }));
// Catch all: /api/files/reports/2026/q1.pdf  ->  path = "reports/2026/q1.pdf"
app.MapGet("/api/files/{**path}", (string path) =&gt; Results.Ok(new { path }));
app.Run();
record Book(int Id, string Slug, string Title, string Isbn, int Year);
// A custom constraint. Match runs on every candidate request, so keep it cheap
// and never touch a database here.
public class IsbnConstraint : IRouteConstraint
{
    public bool Match(HttpContext? httpContext, IRouter? route, string routeKey,
                      RouteValueDictionary values, RouteDirection routeDirection)
    {
        if (!values.TryGetValue(routeKey, out object? raw) || raw is null)
            return false;
        string value = raw.ToString()!.Replace("-", "");
        return value.Length == 13 &amp;&amp; value.All(char.IsDigit);
    }
}
</code></pre>
