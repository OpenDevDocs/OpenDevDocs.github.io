---
publishDate: 2026-09-02T09:40
title: HTTP Methods and Verbs
slug: http-methods-and-verbs
metadescription: Learn what GET, POST, PUT, PATCH and DELETE mean, which ones are safe and idempotent, and how to map each one in ASP.NET Core.
updateDate: 2026-09-07T09:40
author: ['bishal-biswas']
level: 1
tags: ['http', 'rest', 'verbs']
course: dotnet-webapi
---

## The method is the verb

Every HTTP request starts with a method. It tells the server what kind of action you want:

```http
GET /api/books/5 HTTP/1.1
```

The URL names the thing. The method names the action. Five methods cover almost everything a REST API does.

## GET: read something

`GET` asks for data and changes nothing.

```http
GET /api/books        return all books
GET /api/books/5      return book 5
```

In ASP.NET Core:

```csharp
[HttpGet]
public IActionResult GetAll() => Ok(books);

[HttpGet("{id}")]
public IActionResult GetById(int id) => Ok(books.First(b => b.Id == id));
```

A `GET` never has a request body. If you need to filter, use the query string:

```http
GET /api/books?year=1999&sort=title
```

Because `GET` changes nothing, browsers and proxies are free to cache the response and to retry it. This is why the rule matters: **never modify data in a GET**. An endpoint like `GET /api/books/5/delete` looks harmless and will eventually be triggered by a link preview or a crawler.

## POST: create something

`POST` sends data to create a new resource.

```http
POST /api/books HTTP/1.1
Content-Type: application/json

{ "title": "Refactoring", "year": 1999 }
```

The server picks the id and tells you where the new thing lives:

```http
HTTP/1.1 201 Created
Location: /api/books/7

{ "id": 7, "title": "Refactoring", "year": 1999 }
```

In ASP.NET Core, `CreatedAtAction` builds that `Location` header for you:

```csharp
[HttpPost]
public IActionResult Create(CreateBookRequest request)
{
    var book = new Book(NextId(), request.Title, request.Year);
    books.Add(book);
    return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
}
```

`POST` is the only common method that is not repeatable. Send it twice and you create two books.

## PUT: replace something

`PUT` replaces a resource completely. You send the whole object, not just the parts you changed.

```http
PUT /api/books/5 HTTP/1.1
Content-Type: application/json

{ "title": "Clean Code", "year": 2008 }
```

```csharp
[HttpPut("{id}")]
public IActionResult Replace(int id, UpdateBookRequest request)
{
    var book = books.FirstOrDefault(b => b.Id == id);
    if (book is null) return NotFound();

    book.Title = request.Title;
    book.Year = request.Year;

    return NoContent();     // 204
}
```

Because it is a full replacement, any field you leave out gets wiped. If you send only `{ "title": "Clean Code" }` the year becomes 0. That is the trap people hit with `PUT`, and it is why `PATCH` exists.

## PATCH: change part of something

`PATCH` sends only the fields you want to change.

```http
PATCH /api/books/5 HTTP/1.1
Content-Type: application/json

{ "year": 2009 }
```

The simplest implementation uses nullable properties, where `null` means "leave it alone":

```csharp
public class PatchBookRequest
{
    public string? Title { get; set; }
    public int? Year { get; set; }
}

[HttpPatch("{id}")]
public IActionResult Patch(int id, PatchBookRequest request)
{
    var book = books.FirstOrDefault(b => b.Id == id);
    if (book is null) return NotFound();

    if (request.Title is not null) book.Title = request.Title;
    if (request.Year is not null) book.Year = request.Year.Value;

    return NoContent();
}
```

There is also a formal standard called JSON Patch, which sends a list of operations. It is powerful and awkward. The nullable approach above covers most real needs.

## DELETE: remove something

```http
DELETE /api/books/5 HTTP/1.1
```

```csharp
[HttpDelete("{id}")]
public IActionResult Delete(int id)
{
    var book = books.FirstOrDefault(b => b.Id == id);
    if (book is null) return NotFound();

    books.Remove(book);
    return NoContent();     // 204
}
```

`DELETE` usually returns `204 No Content`, because there is nothing left to send back.

## Safe and idempotent

Two words come up constantly. They are simple once you see them side by side.

**Safe** means the request does not change anything on the server. Only `GET`, `HEAD` and `OPTIONS` are safe.

**Idempotent** means sending the request once and sending it five times leave the server in the same state.

| Method | Safe | Idempotent | Has a body |
|---|---|---|---|
| GET | yes | yes | no |
| POST | no | no | yes |
| PUT | no | yes | yes |
| PATCH | no | no | usually |
| DELETE | no | yes | no |

Why does idempotency matter? Because networks fail. A client sends `PUT /api/books/5`, the connection drops, and the client does not know whether it worked. If `PUT` is idempotent, the client can simply send it again with no risk. If it were `POST`, retrying might create a duplicate.

`DELETE` is idempotent in the same sense. Delete book 5 twice and book 5 is still gone. The second call returns `404`, but the **state** is the same, and that is what idempotent means.

## The two you will rarely write

`HEAD` is exactly like `GET` but the response has no body. Clients use it to check whether something exists or to read `Content-Length` cheaply. ASP.NET Core answers `HEAD` for your `GET` endpoints automatically.

`OPTIONS` asks which methods a URL supports. The CORS middleware handles this for you, which is the only place most APIs meet it.

## Choosing the right method

Ask yourself two questions:

1. Am I changing anything? If no, use `GET`.
2. Do I know the URL of the thing I am changing? If no, use `POST` to the collection. If yes, use `PUT` for a full replace, `PATCH` for a partial change or `DELETE` to remove it.

And a common question: what about actions that are not create, read, update or delete, such as "publish this article"? Two reasonable answers. Either model the state as a field and `PATCH` it:

```http
PATCH /api/articles/5
{ "status": "published" }
```

Or treat the action as a sub resource and `POST` to it:

```http
POST /api/articles/5/publish
```

Both are used in the wild. Pick one and stay consistent across your API.

## Quick recap

- `GET` reads, `POST` creates, `PUT` replaces, `PATCH` edits part, `DELETE` removes.
- Never change data inside a `GET`. Crawlers and caches will call it.
- `POST` returns `201 Created` with a `Location` header. `PUT`, `PATCH` and `DELETE` usually return `204 No Content`.
- `PUT` replaces the whole object, so missing fields get wiped. Use `PATCH` for partial edits.
- Safe means nothing changes. Idempotent means repeating the call is harmless.
- `GET`, `PUT` and `DELETE` are idempotent. `POST` and `PATCH` are not.

<code id="code-content" class="language-csharp">
// Program.cs - one resource, all five HTTP methods, using minimal APIs.
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
var books = new List&lt;Book&gt;
{
    new Book { Id = 1, Title = "Clean Code", Year = 2008 },
    new Book { Id = 2, Title = "Refactoring", Year = 1999 }
};
// GET: safe and idempotent, no body, cacheable
app.MapGet("/api/books", () =&gt; Results.Ok(books));
app.MapGet("/api/books/{id:int}", (int id) =&gt;
    books.FirstOrDefault(b =&gt; b.Id == id) is Book found
        ? Results.Ok(found)
        : Results.NotFound());
// POST: creates, NOT idempotent, answers 201 plus a Location header
app.MapPost("/api/books", (BookInput input) =&gt;
{
    var book = new Book
    {
        Id    = books.Count == 0 ? 1 : books.Max(b =&gt; b.Id) + 1,
        Title = input.Title,
        Year  = input.Year
    };
    books.Add(book);
    return Results.Created($"/api/books/{book.Id}", book);
});
// PUT: full replacement, idempotent. Fields you leave out get overwritten.
app.MapPut("/api/books/{id:int}", (int id, BookInput input) =&gt;
{
    Book? book = books.FirstOrDefault(b =&gt; b.Id == id);
    if (book is null) return Results.NotFound();
    book.Title = input.Title;
    book.Year  = input.Year;
    return Results.NoContent();
});
// PATCH: partial update. null means "leave this field alone".
app.MapPatch("/api/books/{id:int}", (int id, BookPatch patch) =&gt;
{
    Book? book = books.FirstOrDefault(b =&gt; b.Id == id);
    if (book is null) return Results.NotFound();
    if (patch.Title is not null) book.Title = patch.Title;
    if (patch.Year  is not null) book.Year  = patch.Year.Value;
    return Results.NoContent();
});
// DELETE: idempotent in effect. Deleting twice leaves the same final state.
app.MapDelete("/api/books/{id:int}", (int id) =&gt;
{
    Book? book = books.FirstOrDefault(b =&gt; b.Id == id);
    if (book is null) return Results.NotFound();
    books.Remove(book);
    return Results.NoContent();
});
app.Run();
class Book      { public int Id { get; set; } public string Title { get; set; } = ""; public int Year { get; set; } }
record BookInput(string Title, int Year);            // PUT and POST need every field
record BookPatch(string? Title, int? Year);          // PATCH makes them all optional
</code></pre>
