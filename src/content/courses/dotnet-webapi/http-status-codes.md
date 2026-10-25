---
publishDate: 2026-09-03T09:50
title: HTTP Status Codes
slug: http-status-codes
metadescription: Understand the five status code families, learn the dozen codes a real API actually uses, and see the ASP.NET Core helper method that returns each one.
updateDate: 2026-09-07T09:50
author: ['bishal-biswas']
level: 1
tags: ['http', 'status-codes', 'rest']
course: dotnet-webapi
---

## Why status codes matter

The status code is the first thing a client reads. It answers one question before anything else: did this work?

```http
HTTP/1.1 404 Not Found
```

A client can act on that immediately, without parsing a body or reading English text. That is the point. Returning `200 OK` with a body that says `{ "error": "not found" }` forces every client to read your prose. Returning `404` lets any client, in any language, understand instantly.

## The five families

The first digit tells you the category. Learn these five and you can guess the rest.

| Range | Meaning | Who is responsible |
|---|---|---|
| `1xx` | Information, keep going | rare, ignore for now |
| `2xx` | Success | it worked |
| `3xx` | Redirect | look somewhere else |
| `4xx` | Client error | the caller made a mistake |
| `5xx` | Server error | you made a mistake |

The `4xx` versus `5xx` split is the one that matters most. **`4xx` means fix your request. `5xx` means the server is broken.** If your API returns `500` because a user typed a bad email address, you will spend nights chasing alerts that are not really bugs.

## The success codes

**`200 OK`** is the everyday success. Use it for `GET` and for updates where you return the updated object.

```csharp
return Ok(book);
```

**`201 Created`** means a new resource exists. Always include a `Location` header pointing at it.

```csharp
return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
// or in minimal APIs:
return Results.Created($"/api/books/{book.Id}", book);
```

**`204 No Content`** means it worked and there is nothing to send back. This is the normal answer to `DELETE`, and a common answer to `PUT` and `PATCH`.

```csharp
return NoContent();
```

**`202 Accepted`** means you took the request but have not finished it yet. Use it when work goes onto a queue.

```csharp
return Accepted($"/api/jobs/{jobId}");
```

## The client error codes

**`400 Bad Request`** means the request itself is wrong. Missing required field, wrong type, malformed JSON.

```csharp
return BadRequest(new { error = "Year must be greater than 1000." });
```

With `[ApiController]` on your controller, model validation failures return `400` automatically. You rarely write this one by hand.

**`401 Unauthorized`** means "I do not know who you are". The name is misleading. It really means unauthenticated. You get this when the token is missing, expired or invalid.

```csharp
return Unauthorized();
```

**`403 Forbidden`** means "I know who you are, and you are not allowed". The token is valid, the permission is not there.

```csharp
return Forbid();
```

The difference in one line: `401` means log in, `403` means logging in again will not help.

**`404 Not Found`** means the resource does not exist.

```csharp
return NotFound();
```

**`409 Conflict`** means the request clashes with the current state. A duplicate email on signup, or editing a record someone else already changed.

```csharp
return Conflict(new { error = "That email is already registered." });
```

**`422 Unprocessable Entity`** means the JSON parsed fine and the types are right, but the values break a business rule. Some teams use `400` for everything and never touch `422`. Either is acceptable. Be consistent.

**`429 Too Many Requests`** means the caller is going too fast. Rate limiting returns this, along with a `Retry-After` header.

## The server error codes

**`500 Internal Server Error`** is the catch all. An unhandled exception reached the top of your pipeline. The client can do nothing but retry later.

You should almost never write `return StatusCode(500)` by hand. Let your global exception handler produce it, so every failure is logged the same way.

**`503 Service Unavailable`** means the server is up but cannot serve right now, usually because a dependency is down or you are in maintenance.

## A cheat sheet by scenario

| What happened | Code |
|---|---|
| Fetched a list or an item | `200` |
| Created something new | `201` |
| Deleted something | `204` |
| Updated with nothing to return | `204` |
| Body failed validation | `400` |
| No token, or a bad token | `401` |
| Valid token, wrong role | `403` |
| Id does not exist | `404` |
| Duplicate, or a state clash | `409` |
| Caller is rate limited | `429` |
| Your code threw | `500` |

## An empty list is not a 404

This catches everyone once. `GET /api/books?year=1850` finds no books. What do you return?

Return **`200` with an empty array**. The collection resource `/api/books` exists. It happens to contain nothing matching your filter. That is a successful query with zero results.

```csharp
[HttpGet]
public IActionResult Search(int? year)
{
    var results = books.Where(b => year is null || b.Year == year).ToList();
    return Ok(results);      // 200 with [] is correct
}
```

Return `404` only when the **thing you addressed** does not exist, such as `GET /api/books/9999`.

## Returning codes in ASP.NET Core

Inside a controller, `ControllerBase` gives you helper methods:

```csharp
Ok(value)                  // 200
Created(uri, value)        // 201
CreatedAtAction(...)       // 201 with a generated Location
NoContent()                // 204
BadRequest(value)          // 400
Unauthorized()             // 401
Forbid()                   // 403
NotFound()                 // 404
Conflict(value)            // 409
StatusCode(418)            // anything else
```

In minimal APIs the same helpers live on the static `Results` class:

```csharp
Results.Ok(value);
Results.Created(uri, value);
Results.NoContent();
Results.BadRequest(value);
Results.NotFound();
Results.Problem(statusCode: 503, title: "Database unavailable");
```

## Tell Swagger what you return

Adding `[ProducesResponseType]` documents the codes an endpoint can return, so Swagger and generated clients know about them:

```csharp
[HttpGet("{id}")]
[ProducesResponseType(typeof(Book), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public IActionResult GetById(int id) { /* ... */ }
```

Use the `StatusCodes` constants rather than raw numbers. `StatusCodes.Status404NotFound` reads better than `404` and cannot be mistyped.

## Quick recap

- The first digit is the family. `2xx` worked, `4xx` is the caller's fault, `5xx` is yours.
- Never return `500` for bad user input. That turns real alerts into noise.
- `200` for reads, `201` plus a `Location` header for creates, `204` for deletes and silent updates.
- `401` means not logged in. `403` means logged in but not allowed.
- `409` is for duplicates and state clashes. `429` is for rate limits.
- A search with no matches is `200` with an empty array, not `404`.
- Use `Ok`, `NotFound` and friends in controllers, and `Results.*` in minimal APIs.

<code id="code-content" class="language-csharp">
// BooksController.cs - one controller showing every status code a real API returns.
using Microsoft.AspNetCore.Mvc;
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private static readonly List&lt;Book&gt; Books = new()
    {
        new Book { Id = 1, Title = "Clean Code",  Year = 2008, Isbn = "978-0132350884" }
    };
    // 200 OK, or 200 with an empty array. A search that matches nothing is NOT a 404.
    [HttpGet]
    [ProducesResponseType(typeof(List&lt;Book&gt;), StatusCodes.Status200OK)]
    public IActionResult Search([FromQuery] int? year)
    {
        var results = Books.Where(b =&gt; year is null || b.Year == year).ToList();
        return Ok(results);
    }
    // 200 when it exists, 404 when the addressed resource does not
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(Book), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetById(int id)
    {
        Book? book = Books.FirstOrDefault(b =&gt; b.Id == id);
        return book is null ? NotFound() : Ok(book);
    }
    // 201 Created with a Location header, 400 for bad input, 409 for a duplicate
    [HttpPost]
    [ProducesResponseType(typeof(Book), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public IActionResult Create([FromBody] Book input)
    {
        if (string.IsNullOrWhiteSpace(input.Title))
            return BadRequest(new { error = "Title is required." });
        if (Books.Any(b =&gt; b.Isbn == input.Isbn))
            return Conflict(new { error = $"ISBN {input.Isbn} already exists." });
        input.Id = Books.Max(b =&gt; b.Id) + 1;
        Books.Add(input);
        return CreatedAtAction(nameof(GetById), new { id = input.Id }, input);
    }
    // 204 No Content: it worked, there is nothing to send back
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult Delete(int id)
    {
        Book? book = Books.FirstOrDefault(b =&gt; b.Id == id);
        if (book is null) return NotFound();
        Books.Remove(book);
        return NoContent();
    }
    // 202 Accepted: work was queued and is not finished yet
    [HttpPost("reindex")]
    public IActionResult Reindex()
    {
        string jobId = Guid.NewGuid().ToString("N");
        return Accepted($"/api/jobs/{jobId}", new { jobId, status = "queued" });
    }
}
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public int Year { get; set; }
    public string Isbn { get; set; } = "";
}
</code></pre>
