---
publishDate: 2026-09-08T11:40
title: DTOs and Why You Need Them
slug: dtos-and-why-you-need-them
metadescription: Learn why returning database entities is dangerous, how request and response DTOs fix over posting and data leaks, and how to shape and organise them well.
updateDate: 2026-09-07T11:40
author: ['bishal-biswas']
level: 2
tags: ['dto', 'design', 'security']
course: dotnet-webapi
---

## What a DTO is

DTO stands for **Data Transfer Object**. It is a plain class or record whose only job is to carry data across a boundary, in this case the boundary between your API and its clients.

An **entity** is what you store. A **DTO** is what you send and receive. They are often similar. They should never be the same class.

```csharp
// Entity: what the database holds
public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool IsAdmin { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<Order> Orders { get; set; } = new();
}

// DTO: what the client is allowed to see
public record UserResponse(int Id, string Email, DateTime CreatedAt);
```

## Reason one: you will leak data

Return the entity above and every client receives the password hash and the admin flag:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<User>> Get(int id) => await db.Users.FindAsync(id);
```

```json
{
  "id": 1,
  "email": "asha@example.com",
  "passwordHash": "$2a$11$N9qo8uLOickgx2ZMRZoMy...",
  "isAdmin": false,
  "createdAt": "2026-01-04T09:12:00Z",
  "orders": []
}
```

You can hide fields with `[JsonIgnore]`, and people do. The problem is that it is **opt out**. Add a column called `InternalRiskScore` next year and it ships to every client the moment the migration runs, silently.

A DTO is **opt in**. A new column appears in the response only when someone deliberately adds it to the DTO. That difference matters more than any single field.

## Reason two: over posting

The mirror image of a leak. If you accept the entity as input, a client can set anything on it:

```csharp
[HttpPost]
public async Task<ActionResult<User>> Create(User user) { /* ... */ }
```

```http
POST /api/users
Content-Type: application/json

{ "email": "attacker@example.com", "password": "x", "isAdmin": true }
```

Model binding sets `IsAdmin = true`, you save it, and you have just created an administrator. This is called **over posting** or **mass assignment**, and it is one of the most common real API vulnerabilities.

A request DTO makes it impossible, because there is nowhere for the extra field to land:

```csharp
public record CreateUserRequest(string Email, string Password);
```

Unknown JSON properties are ignored by default. `isAdmin` in the body simply goes nowhere.

## Reason three: your API stops depending on your schema

Rename a column and every client breaks. With DTOs, the rename stays inside your code:

```csharp
// The entity changed: Name split into two columns
public class Customer
{
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
}

// The API contract did not change
public record CustomerResponse(int Id, string Name);

// One line absorbs the difference
new CustomerResponse(c.Id, $"{c.FirstName} {c.LastName}");
```

Your database and your public contract now change at their own pace, which is exactly what you want.

## Reason four: circular references

EF Core entities point at each other. An `Order` has a `Customer`, and that `Customer` has a list of `Order` objects. Serialize one and you get an infinite loop, or the confusing error that follows it.

You can configure `ReferenceHandler.IgnoreCycles` to paper over it, but the output is then unpredictable. A flat DTO has no cycles, because you chose exactly which fields it holds.

## Reason five: you send less data

An entity carries every column. A list screen usually needs three of them.

```csharp
// 20 columns per row, times 500 rows
var products = await db.Products.ToListAsync();

// 3 columns per row, and the database only reads those columns
var products = await db.Products
    .Select(p => new ProductListItem(p.Id, p.Name, p.Price))
    .ToListAsync();
```

That `Select` runs on the database, so the saving is real, not just at the JSON layer.

## Separate DTOs for input and output

Do not use one DTO in both directions. Their needs differ.

```csharp
// Input: what the client may set. No Id, the server assigns it.
public record CreateBookRequest(string Title, string Author, int Year, decimal Price);

// Input for updates: often the same, sometimes different rules
public record UpdateBookRequest(string Title, string Author, int Year, decimal Price);

// Input for a partial update: everything optional
public record PatchBookRequest(string? Title, string? Author, int? Year, decimal? Price);

// Output: includes server generated fields
public record BookResponse(
    int Id, string Title, string Author, int Year, decimal Price, DateTime CreatedAt);

// Output for a list: smaller, because a list view shows less
public record BookListItem(int Id, string Title, decimal Price);
```

That is five types for one resource, and it looks like a lot until the first time each one saves you. A create request has no `Id`. A response has no `Password`. A list item has no description. One shared class cannot express any of that.

## Records are a good fit

A DTO is data with no behaviour, which is exactly what a `record` is for:

```csharp
public record BookResponse(int Id, string Title, decimal Price);
```

You get a constructor, immutability, value equality and a readable `ToString` in one line.

One caveat. If you need validation attributes, the positional syntax gets awkward, and a `record` with properties reads better:

```csharp
public record CreateBookRequest
{
    [Required, StringLength(200)]
    public string Title { get; init; } = "";

    [Range(1000, 2100)]
    public int Year { get; init; }
}
```

Use positional records for responses, and property style records or classes for requests that need validation.

## Mapping between them

For a small API, write the mapping by hand:

```csharp
private static BookResponse ToResponse(Book book) =>
    new(book.Id, book.Title, book.Author, book.Year, book.Price, book.CreatedAt);
```

Explicit, debuggable, and the compiler tells you when you forget a field. Many experienced teams never move past this.

When mapping gets repetitive across many types, a library such as AutoMapper or Mapperly takes over. That is the next topic but one.

## Project in the query, not after it

The most valuable habit in this whole topic. Put the `Select` **inside** the LINQ query so EF Core translates it to SQL:

```csharp
// Good: SELECT Id, Title, Price FROM Books
var items = await db.Books
    .Where(b => b.Year > 2000)
    .Select(b => new BookListItem(b.Id, b.Title, b.Price))
    .ToListAsync();

// Wasteful: SELECT * FROM Books, then throw most of it away in memory
var books = await db.Books.Where(b => b.Year > 2000).ToListAsync();
var items = books.Select(b => new BookListItem(b.Id, b.Title, b.Price)).ToList();
```

Both give the same JSON. The first reads three columns from the database. The second reads all of them.

## Where to put them

Group DTOs by feature, not by kind:

```text
DTOs/
├── Books/
│   ├── CreateBookRequest.cs
│   ├── UpdateBookRequest.cs
│   ├── BookResponse.cs
│   └── BookListItem.cs
└── Users/
    ├── RegisterRequest.cs
    └── UserResponse.cs
```

When you work on books, everything you need is in one folder. A flat `DTOs` folder with forty files does not scale.

## Quick recap

- An entity is what you store. A DTO is what you send and receive. Keep them separate.
- Returning entities leaks fields by default, and every new column ships automatically.
- Accepting entities allows over posting, where a client sets `IsAdmin` or another field it should not.
- DTOs decouple your public contract from your database schema so each can change alone.
- Flat DTOs avoid the circular reference problem that EF Core navigation properties create.
- Use separate types for create, update, patch, single response and list item.
- Use `record` for DTOs, and `Select` inside the query so the database only reads the columns you need.

<code id="code-content" class="language-csharp">
// A complete resource done properly: entity in, DTOs out.
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
// ---------- Entity: what the database stores. Never returned, never accepted.
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Author { get; set; } = "";
    public int Year { get; set; }
    public decimal Price { get; set; }
    public decimal SupplierCost { get; set; }      // must never reach a client
    public string InternalNotes { get; set; } = "";// must never reach a client
    public DateTime CreatedAt { get; set; }
    public List&lt;Review&gt; Reviews { get; set; } = new();   // would cause a serialization cycle
}
public class Review { public int Id { get; set; } public Book Book { get; set; } = null!; }
// ---------- Requests: exactly what a client may set. No Id, no cost, no admin flags.
public record CreateBookRequest
{
    [Required, StringLength(200, MinimumLength = 1)] public string Title  { get; init; } = "";
    [Required, StringLength(100)]                    public string Author { get; init; } = "";
    [Range(1000, 2100)]                              public int    Year   { get; init; }
    [Range(0.01, 10000)]                             public decimal Price { get; init; }
}
public record PatchBookRequest(string? Title, string? Author, int? Year, decimal? Price);
// ---------- Responses: exactly what a client is allowed to know.
public record BookResponse(int Id, string Title, string Author, int Year, decimal Price, DateTime CreatedAt);
public record BookListItem(int Id, string Title, decimal Price);   // smaller: a list shows less
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly AppDbContext db;
    public BooksController(AppDbContext db) =&gt; this.db = db;
    // Select INSIDE the query, so SQL reads three columns instead of every column
    [HttpGet]
    public async Task&lt;ActionResult&lt;List&lt;BookListItem&gt;&gt;&gt; GetAll() =&gt;
        await db.Books
            .OrderBy(b =&gt; b.Title)
            .Select(b =&gt; new BookListItem(b.Id, b.Title, b.Price))
            .ToListAsync();
    [HttpGet("{id:int}")]
    public async Task&lt;ActionResult&lt;BookResponse&gt;&gt; GetById(int id)
    {
        BookResponse? dto = await db.Books
            .Where(b =&gt; b.Id == id)
            .Select(b =&gt; new BookResponse(b.Id, b.Title, b.Author, b.Year, b.Price, b.CreatedAt))
            .FirstOrDefaultAsync();
        return dto is null ? NotFound() : dto;
    }
    // A client sending {"title":"x","supplierCost":0} cannot touch SupplierCost:
    // the request DTO has nowhere to put it, so the property is simply ignored.
    [HttpPost]
    public async Task&lt;ActionResult&lt;BookResponse&gt;&gt; Create([FromBody] CreateBookRequest request)
    {
        var book = new Book
        {
            Title     = request.Title,
            Author    = request.Author,
            Year      = request.Year,
            Price     = request.Price,
            CreatedAt = DateTime.UtcNow          // server owned, never client supplied
        };
        db.Books.Add(book);
        await db.SaveChangesAsync();
        var response = ToResponse(book);
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, response);
    }
    [HttpPatch("{id:int}")]
    public async Task&lt;IActionResult&gt; Patch(int id, [FromBody] PatchBookRequest patch)
    {
        Book? book = await db.Books.FindAsync(id);
        if (book is null) return NotFound();
        if (patch.Title  is not null) book.Title  = patch.Title;    // null means leave alone
        if (patch.Author is not null) book.Author = patch.Author;
        if (patch.Year   is not null) book.Year   = patch.Year.Value;
        if (patch.Price  is not null) book.Price  = patch.Price.Value;
        await db.SaveChangesAsync();
        return NoContent();
    }
    // Hand written mapping: explicit, debuggable, and the compiler catches missing fields
    private static BookResponse ToResponse(Book b) =&gt;
        new(b.Id, b.Title, b.Author, b.Year, b.Price, b.CreatedAt);
}
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; options) : base(options) { }
    public DbSet&lt;Book&gt; Books =&gt; Set&lt;Book&gt;();
}
</code></pre>
