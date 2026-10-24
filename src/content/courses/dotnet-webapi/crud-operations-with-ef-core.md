---
publishDate: 2026-09-11T12:50
title: CRUD Operations with EF Core
slug: crud-operations-with-ef-core
metadescription: Read, create, update and delete data with EF Core, understand the change tracker, use AsNoTracking for reads, and avoid the N plus 1 and over fetching traps.
updateDate: 2026-09-07T12:50
author: ['bishal-biswas']
level: 2
tags: ['ef-core', 'crud', 'linq']
course: dotnet-webapi
---

## The change tracker

Before any CRUD makes sense, understand the one idea behind all of it.

When EF Core loads an entity, it keeps a copy of the original values. When you call `SaveChanges`, it compares the current values against that copy and generates SQL for whatever changed.

```csharp
Book book = await db.Books.FindAsync(1);   // tracked, original values remembered
book.Price = 29.99m;                        // just a C# assignment so far
await db.SaveChangesAsync();                // UPDATE Books SET Price = 29.99 WHERE Id = 1
```

There is no `db.Update(book)` in that code. You changed a property and saved. The tracker worked out the rest.

Every state an entity can be in: `Added`, `Unchanged`, `Modified`, `Deleted`, `Detached`. `SaveChanges` turns them into `INSERT`, nothing, `UPDATE`, `DELETE` and nothing.

## Reading

Find by primary key:

```csharp
Book? book = await db.Books.FindAsync(id);
```

`FindAsync` checks the change tracker first, so if the entity is already loaded it returns it without touching the database. That makes it the right choice for a lookup by id.

Query with LINQ:

```csharp
// One item, or null
Book? book = await db.Books.FirstOrDefaultAsync(b => b.Isbn == isbn);

// Many
List<Book> books = await db.Books
    .Where(b => b.Year > 2000 && b.Price < 50)
    .OrderBy(b => b.Title)
    .ToListAsync();

// Just the numbers
int count = await db.Books.CountAsync(b => b.Year > 2000);
bool any = await db.Books.AnyAsync(b => b.AuthorId == 3);
decimal max = await db.Books.MaxAsync(b => b.Price);
```

Two things worth knowing about the single item methods:

- `FirstOrDefaultAsync` returns null when nothing matches. `FirstAsync` throws.
- `SingleOrDefaultAsync` throws if **more than one** matches, which is a useful assertion when you expect uniqueness. It costs an extra row read, so use `First` when you genuinely just want the first.

## Queries are lazy until you materialise them

Building a query runs nothing:

```csharp
IQueryable<Book> query = db.Books.Where(b => b.Year > 2000);   // no SQL yet

if (!string.IsNullOrEmpty(title))
    query = query.Where(b => b.Title.Contains(title));          // still no SQL

if (sortByPrice)
    query = query.OrderBy(b => b.Price);                        // still no SQL

List<Book> results = await query.ToListAsync();                 // now one SQL query runs
```

This composability is what makes filtering and paging clean. The SQL is built once, with every condition in it.

The methods that trigger execution: `ToListAsync`, `FirstOrDefaultAsync`, `SingleAsync`, `CountAsync`, `AnyAsync`, `SumAsync`, `MaxAsync` and their siblings, plus a `foreach`.

## AsNoTracking for reads

Tracking exists so `SaveChanges` can detect changes. If you are only reading, it is pure overhead: EF Core builds a snapshot of every entity it returns.

```csharp
List<Book> books = await db.Books.AsNoTracking().ToListAsync();
```

Faster and less memory. Use it on every read only query, which in an API is most of them.

You can even make it the default and opt in to tracking where you need it:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(cs)
           .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));
```

Better still, project to a DTO. A projection is never tracked, because the result is not an entity:

```csharp
var items = await db.Books
    .Select(b => new BookListItem(b.Id, b.Title, b.Price))
    .ToListAsync();
```

## Creating

```csharp
var book = new Book { Title = "Refactoring", Year = 1999, AuthorId = 2 };

db.Books.Add(book);
await db.SaveChangesAsync();

// book.Id is now populated by the database
```

Several at once:

```csharp
db.Books.AddRange(book1, book2, book3);
await db.SaveChangesAsync();      // one round trip, batched
```

Call `SaveChanges` **once** after adding everything. Calling it inside a loop turns one batched round trip into a hundred.

## Updating

The tracked way, which is the normal way:

```csharp
Book? book = await db.Books.FindAsync(id);
if (book is null) return NotFound();

book.Title = request.Title;
book.Price = request.Price;

await db.SaveChangesAsync();       // UPDATE with only the changed columns
```

Notice that EF Core writes only the columns you touched.

The detached way, when you already have the values and want to skip the read:

```csharp
var book = new Book { Id = id, Title = request.Title, Price = request.Price };

db.Books.Update(book);             // marks EVERY property as modified
await db.SaveChangesAsync();
```

This saves a `SELECT` but writes every column, including any you did not set, which will overwrite them with defaults. Only use it when your object genuinely holds the complete current state.

## Bulk updates without loading

EF Core 7 added `ExecuteUpdate` and `ExecuteDelete`, which run a single SQL statement and never load anything:

```csharp
// One UPDATE statement, no entities loaded, no change tracking
await db.Books
    .Where(b => b.Year < 1990)
    .ExecuteUpdateAsync(s => s.SetProperty(b => b.IsArchived, true));

// One DELETE statement
await db.Books
    .Where(b => b.IsDeleted && b.DeletedAt < cutoff)
    .ExecuteDeleteAsync();
```

These are dramatically faster for bulk work. Two caveats: they run immediately rather than waiting for `SaveChanges`, and they bypass the change tracker, so entities already in memory will be stale.

## Deleting

```csharp
Book? book = await db.Books.FindAsync(id);
if (book is null) return NotFound();

db.Books.Remove(book);
await db.SaveChangesAsync();
```

Most production systems prefer a **soft delete**, which keeps the row and hides it:

```csharp
book.IsDeleted = true;
book.DeletedAt = DateTime.UtcNow;
await db.SaveChangesAsync();
```

Combine that with a global query filter (`HasQueryFilter(b => !b.IsDeleted)`) and deleted rows disappear from every query automatically, while remaining recoverable and preserving foreign keys.

## The N plus 1 problem

The most common EF Core performance bug, and it is easy to write by accident:

```csharp
List<Book> books = await db.Books.ToListAsync();          // 1 query

foreach (Book book in books)
{
    Console.WriteLine(book.Author.Name);                   // 1 query EACH
}
```

One hundred books means one hundred and one queries. Load the related data in the same query with `Include`:

```csharp
List<Book> books = await db.Books
    .Include(b => b.Author)
    .ToListAsync();                                        // 1 query with a JOIN
```

Or, better for an API, project only what you need:

```csharp
var items = await db.Books
    .Select(b => new BookListItem(b.Id, b.Title, b.Author.Name))
    .ToListAsync();                                        // 1 query, 3 columns
```

Relationships and `Include` get a full topic next.

## Transactions

`SaveChanges` is already a transaction. Everything in one call succeeds or fails together:

```csharp
db.Books.Add(book);
db.Orders.Add(order);
await db.SaveChangesAsync();      // both, or neither
```

You only need an explicit transaction when several `SaveChanges` calls must be atomic:

```csharp
await using IDbContextTransaction tx = await db.Database.BeginTransactionAsync();
try
{
    db.Orders.Add(order);
    await db.SaveChangesAsync();

    await inventoryService.ReserveAsync(order.Id);   // needs the order id
    await db.SaveChangesAsync();

    await tx.CommitAsync();
}
catch
{
    await tx.RollbackAsync();
    throw;
}
```

## Always pass the cancellation token

When a client disconnects, ASP.NET Core cancels the request. Pass the token through and the database query stops too:

```csharp
[HttpGet]
public async Task<ActionResult<List<BookListItem>>> GetAll(CancellationToken cancellationToken)
{
    return await db.Books
        .AsNoTracking()
        .Select(b => new BookListItem(b.Id, b.Title, b.Price))
        .ToListAsync(cancellationToken);
}
```

The parameter binds automatically. It costs one word per method and saves wasted database work under load.

## Quick recap

- The change tracker compares current values against the originals, so changing a property and calling `SaveChanges` is enough.
- `FindAsync` looks in the tracker first, which makes it the best lookup by primary key.
- Queries are lazy. Compose `Where` and `OrderBy` freely, and one SQL statement runs at the end.
- Use `AsNoTracking` for read only queries, or project to a DTO, which is never tracked.
- Call `SaveChanges` once after adding a batch, never inside a loop.
- `db.Update(entity)` writes every column. Prefer loading and editing when you only change some fields.
- `ExecuteUpdateAsync` and `ExecuteDeleteAsync` do bulk work in one statement without loading entities.
- `Include` or a projection prevents the N plus 1 problem. Watch for property access inside a loop.
- `SaveChanges` is already transactional. Add an explicit transaction only across multiple saves.
- Accept and pass a `CancellationToken` on every async action.

<code id="code-content" class="language-csharp">
// BooksController.cs - every CRUD operation, written the way you would ship it.
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly AppDbContext db;
    public BooksController(AppDbContext db) =&gt; this.db = db;
    // READ many: projected, so it is untracked and reads only three columns.
    // Note the CancellationToken: it binds automatically and stops the query
    // if the client disconnects.
    [HttpGet]
    public async Task&lt;ActionResult&lt;List&lt;BookListItem&gt;&gt;&gt; GetAll(
        [FromQuery] int? year, [FromQuery] string? title, CancellationToken ct)
    {
        IQueryable&lt;Book&gt; query = db.Books;                 // nothing has run yet
        if (year is not null)  query = query.Where(b =&gt; b.Year == year);
        if (title is not null) query = query.Where(b =&gt; b.Title.Contains(title));
        return await query
            .OrderBy(b =&gt; b.Title)
            .Select(b =&gt; new BookListItem(b.Id, b.Title, b.Price, b.Author.Name))
            .ToListAsync(ct);                              // one SQL query, with a join
    }
    // READ one: FindAsync checks the change tracker before hitting the database
    [HttpGet("{id:int}")]
    public async Task&lt;ActionResult&lt;BookResponse&gt;&gt; GetById(int id, CancellationToken ct)
    {
        BookResponse? dto = await db.Books
            .AsNoTracking()                                // read only, so skip the snapshot
            .Where(b =&gt; b.Id == id)
            .Select(b =&gt; new BookResponse(b.Id, b.Title, b.Year, b.Price, b.Author.Name))
            .FirstOrDefaultAsync(ct);
        return dto is null ? NotFound() : dto;
    }
    // CREATE: Add then one SaveChanges. The database fills in book.Id.
    [HttpPost]
    public async Task&lt;ActionResult&lt;BookResponse&gt;&gt; Create(CreateBookRequest request, CancellationToken ct)
    {
        if (!await db.Authors.AnyAsync(a =&gt; a.Id == request.AuthorId, ct))
            return BadRequest(new { error = $"Author {request.AuthorId} does not exist." });
        var book = new Book
        {
            Title = request.Title, Year = request.Year,
            Price = request.Price, AuthorId = request.AuthorId,
            CreatedAt = DateTime.UtcNow
        };
        db.Books.Add(book);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = book.Id },
            new BookResponse(book.Id, book.Title, book.Year, book.Price, ""));
    }
    // UPDATE: load, change properties, save. EF writes only the changed columns.
    [HttpPut("{id:int}")]
    public async Task&lt;IActionResult&gt; Update(int id, UpdateBookRequest request, CancellationToken ct)
    {
        Book? book = await db.Books.FindAsync(new object[] { id }, ct);
        if (book is null) return NotFound();
        book.Title = request.Title;
        book.Year  = request.Year;
        book.Price = request.Price;
        await db.SaveChangesAsync(ct);                     // UPDATE ... SET Title, Year, Price
        return NoContent();
    }
    // DELETE, done as a soft delete. Pair with HasQueryFilter(b =&gt; !b.IsDeleted)
    // so hidden rows vanish from every query automatically.
    [HttpDelete("{id:int}")]
    public async Task&lt;IActionResult&gt; Delete(int id, CancellationToken ct)
    {
        Book? book = await db.Books.FindAsync(new object[] { id }, ct);
        if (book is null) return NotFound();
        book.IsDeleted = true;
        book.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
    // BULK: one SQL statement, nothing loaded into memory.
    // Runs immediately and bypasses the change tracker.
    [HttpPost("archive-old")]
    public async Task&lt;IActionResult&gt; ArchiveOld([FromQuery] int before, CancellationToken ct)
    {
        int affected = await db.Books
            .Where(b =&gt; b.Year &lt; before &amp;&amp; !b.IsArchived)
            .ExecuteUpdateAsync(s =&gt; s.SetProperty(b =&gt; b.IsArchived, true), ct);
        return Ok(new { archived = affected });
    }
    // An explicit transaction, needed only when several SaveChanges calls must be atomic
    [HttpPost("{id:int}/reorder")]
    public async Task&lt;IActionResult&gt; Reorder(int id, int quantity, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            var order = new PurchaseOrder { BookId = id, Quantity = quantity };
            db.PurchaseOrders.Add(order);
            await db.SaveChangesAsync(ct);                 // we need order.Id below
            await db.Books.Where(b =&gt; b.Id == id)
                .ExecuteUpdateAsync(s =&gt; s.SetProperty(b =&gt; b.LastOrderId, order.Id), ct);
            await tx.CommitAsync(ct);
            return Ok(new { orderId = order.Id });
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }
}
public record BookListItem(int Id, string Title, decimal Price, string AuthorName);
public record BookResponse(int Id, string Title, int Year, decimal Price, string AuthorName);
public record CreateBookRequest(string Title, int Year, decimal Price, int AuthorId);
public record UpdateBookRequest(string Title, int Year, decimal Price);
</code></pre>
