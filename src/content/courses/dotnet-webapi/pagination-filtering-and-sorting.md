---
publishDate: 2026-09-21T16:20
title: Pagination, Filtering and Sorting
slug: pagination-filtering-and-sorting
metadescription: Stop returning entire tables. Build offset and cursor pagination, compose safe filters, allow list sortable fields, and shape a paged response clients can use.
updateDate: 2026-09-07T16:20
author: ['bishal-biswas']
level: 3
tags: ['pagination', 'filtering', 'performance']
course: dotnet-webapi
---

## The endpoint that will fall over

```csharp
[HttpGet]
public async Task<ActionResult<List<Book>>> GetAll() => await db.Books.ToListAsync();
```

This is fine with fifty books. At half a million it loads every row into memory, serializes megabytes of JSON, and takes the API down.

Every collection endpoint needs paging from the first day. Adding it later is a breaking change.

## Offset pagination

The familiar approach. Skip a number of rows, take the next batch:

```csharp
var items = await db.Books
    .OrderBy(b => b.Title)
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync(ct);
```

```text
GET /api/books?page=2&pageSize=20
```

Simple, and it lets a client jump to any page. Two limits, one small and one large.

**The client controls the size.** Clamp it, or someone asks for a million:

```csharp
pageSize = Math.Clamp(pageSize, 1, 100);
page = Math.Max(page, 1);
```

**`OrderBy` is not optional.** Without it, SQL Server does not guarantee a stable order, so page 2 can repeat rows from page 1. If your sort field is not unique, add a tiebreaker:

```csharp
.OrderBy(b => b.Title).ThenBy(b => b.Id)
```

## Shaping the response

The client needs the total to draw page numbers. Two ways to send it.

**An envelope**, which is the most common:

```csharp
public class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }

    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasPrevious => Page > 1;
    public bool HasNext => Page < TotalPages;
}
```

```json
{
  "items": [ { "id": 1, "title": "Clean Code" } ],
  "page": 2,
  "pageSize": 20,
  "totalCount": 1204,
  "totalPages": 61,
  "hasPrevious": true,
  "hasNext": true
}
```

**Headers**, keeping the body a clean array:

```csharp
Response.Headers["X-Total-Count"] = total.ToString();
Response.Headers["X-Page"] = page.ToString();
```

Remember `WithExposedHeaders` in your CORS policy, or the browser hides them.

Either works. The envelope is easier for clients and is what most APIs do. Pick one and use it for every collection.

## Two queries, one round trip each

You need the page and the total:

```csharp
IQueryable<Book> query = db.Books.Where(b => b.Year > 2000);

int total = await query.CountAsync(ct);              // SELECT COUNT(*)

List<BookListItem> items = await query
    .OrderBy(b => b.Title).ThenBy(b => b.Id)
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .Select(b => new BookListItem(b.Id, b.Title, b.Price))
    .ToListAsync(ct);
```

Note the filter is applied **before** the count, so the total reflects the filter. Getting that backwards gives clients wrong page numbers.

`CountAsync` on a very large table is itself slow. If it hurts, either cache an approximate total or switch to cursor pagination.

## The deep page problem

`Skip(100000)` makes the database read and discard a hundred thousand rows. Page 1 is instant, page 5000 is not.

There is also a correctness problem. If a row is inserted while a user pages through, rows shift and one gets skipped or repeated.

For an admin screen where nobody goes past page 10, offset paging is fine. For an infinite scroll feed, use a cursor.

## Cursor pagination

Instead of "skip 100000 rows", say "give me rows after this one":

```csharp
IQueryable<Book> query = db.Books.OrderBy(b => b.Id);

if (cursor is not null)
{
    int afterId = DecodeCursor(cursor);
    query = query.Where(b => b.Id > afterId);        // an index seek, not a scan
}

List<Book> items = await query.Take(pageSize + 1).ToListAsync(ct);

bool hasMore = items.Count > pageSize;
if (hasMore) items.RemoveAt(items.Count - 1);

string? nextCursor = hasMore ? EncodeCursor(items[^1].Id) : null;
```

```json
{
  "items": [ ... ],
  "nextCursor": "eyJpZCI6MTIzfQ==",
  "hasMore": true
}
```

Taking `pageSize + 1` is the trick for knowing whether more exists without a second query.

Cursor paging is **constant time** at any depth and stable when rows are inserted. The cost is that you cannot jump to page 50, only forward and back. For feeds and infinite scroll, that is exactly the right trade.

Encode the cursor as an opaque string so clients treat it as a token and you can change its contents later:

```csharp
static string EncodeCursor(int id) =>
    Convert.ToBase64String(Encoding.UTF8.GetBytes($"{{\"id\":{id}}}"));
```

## Filtering

Compose conditions onto the query. Nothing runs until you materialise it:

```csharp
IQueryable<Book> query = db.Books.AsNoTracking();

if (!string.IsNullOrWhiteSpace(filter.Title))
    query = query.Where(b => b.Title.Contains(filter.Title));

if (filter.MinYear is not null)
    query = query.Where(b => b.Year >= filter.MinYear);

if (filter.MaxPrice is not null)
    query = query.Where(b => b.Price <= filter.MaxPrice);

if (filter.AuthorId is not null)
    query = query.Where(b => b.AuthorId == filter.AuthorId);

if (filter.Tags?.Length > 0)
    query = query.Where(b => b.Tags.Any(t => filter.Tags.Contains(t.Name)));
```

Group the parameters into a class rather than listing eight arguments:

```csharp
public class BookFilter
{
    public string? Title { get; set; }
    public int? MinYear { get; set; }
    public int? MaxPrice { get; set; }
    public int? AuthorId { get; set; }
    public string[]? Tags { get; set; }
}

[HttpGet]
public async Task<ActionResult<PagedResult<BookListItem>>> Search(
    [FromQuery] BookFilter filter, [FromQuery] PageQuery paging, CancellationToken ct)
```

A note on case insensitive search. `Contains` maps to SQL `LIKE`, which is case insensitive under most default collations. Do **not** write `b.Title.ToLower().Contains(term.ToLower())`, because that stops the database using an index. If you need explicit control, set the column collation instead.

## Sorting, safely

A column name cannot be a SQL parameter, so a client controlled sort field is an injection risk with raw SQL and a runtime error with LINQ. Use an allow list:

```csharp
private static readonly Dictionary<string, Expression<Func<Book, object>>> SortMap =
    new(StringComparer.OrdinalIgnoreCase)
    {
        ["title"] = b => b.Title,
        ["year"] = b => b.Year,
        ["price"] = b => b.Price,
        ["created"] = b => b.CreatedAt
    };

private static IQueryable<Book> ApplySort(IQueryable<Book> query, string? sort)
{
    // "price:desc" or just "price"
    string[] parts = (sort ?? "title").Split(':');
    string field = parts[0];
    bool descending = parts.Length > 1 && parts[1].Equals("desc", StringComparison.OrdinalIgnoreCase);

    if (!SortMap.TryGetValue(field, out var selector))
        selector = SortMap["title"];                 // safe default

    query = descending ? query.OrderByDescending(selector) : query.OrderBy(selector);

    return query.ThenBy(b => b.Id);                  // stable tiebreaker
}
```

An unknown field falls back to a default rather than throwing. That is friendlier than a `400` and avoids leaking which columns exist.

## Making it reusable

Once you have written this twice, extract it:

```csharp
public static class QueryableExtensions
{
    public static async Task<PagedResult<TDto>> ToPagedResultAsync<TEntity, TDto>(
        this IQueryable<TEntity> query,
        Expression<Func<TEntity, TDto>> selector,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        int total = await query.CountAsync(ct);

        List<TDto> items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(selector)
            .ToListAsync(ct);

        return new PagedResult<TDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }
}
```

```csharp
return await query
    .OrderBy(b => b.Title).ThenBy(b => b.Id)
    .ToPagedResultAsync(b => new BookListItem(b.Id, b.Title, b.Price), page, size, ct);
```

Every collection endpoint now behaves identically, and the clamping cannot be forgotten.

## Indexes

Paging and filtering are only fast with the right indexes. Index the columns you filter and sort on:

```csharp
builder.HasIndex(b => b.Title);
builder.HasIndex(b => new { b.AuthorId, b.Year });
builder.HasIndex(b => b.CreatedAt);
```

A composite index helps when the leading columns match your query. `(AuthorId, Year)` serves a filter on `AuthorId` alone, and one on both, but not `Year` alone.

Check what actually runs by logging the SQL, and read the query plan when something is slow. Guessing at indexes wastes time.

## Quick recap

- Never return an unbounded collection. Page from the first version.
- Clamp the page size server side. The client does not decide how much work you do.
- Always `OrderBy` with a unique tiebreaker, or pages overlap.
- Return an envelope with items and a total, or send the total in headers, and be consistent.
- Apply filters before counting, so the total matches the filter.
- Deep `Skip` is slow and unstable. Use cursor pagination for feeds and infinite scroll.
- Take `pageSize + 1` rows to detect more without a second query.
- Compose filters onto `IQueryable`. Nothing runs until you materialise it.
- Avoid `ToLower()` in a filter, because it defeats the index.
- Sort fields come from an allow list, with a safe default for unknown values.
- Index whatever you filter and sort on.

<code id="code-content" class="language-csharp">
// Paging, filtering and sorting done once, reusably and safely.
using System.Linq.Expressions;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
public class PagedResult&lt;T&gt;
{
    public IReadOnlyList&lt;T&gt; Items { get; init; } = Array.Empty&lt;T&gt;();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages   =&gt; (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasPrevious =&gt; Page &gt; 1;
    public bool HasNext     =&gt; Page &lt; TotalPages;
}
public class BookFilter
{
    public string? Title { get; set; }
    public int? MinYear { get; set; }
    public decimal? MaxPrice { get; set; }
    public int? AuthorId { get; set; }
}
public class PageQuery
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Sort { get; set; }          // "price:desc"
}
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    // A column name cannot be a SQL parameter, so client controlled sorting needs
    // an allow list. Anything not in here falls back to the default.
    private static readonly Dictionary&lt;string, Expression&lt;Func&lt;Book, object&gt;&gt;&gt; SortMap =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["title"]   = b =&gt; b.Title,
            ["year"]    = b =&gt; b.Year,
            ["price"]   = b =&gt; b.Price,
            ["created"] = b =&gt; b.CreatedAt
        };
    private readonly AppDbContext db;
    public BooksController(AppDbContext db) =&gt; this.db = db;
    // OFFSET paging: GET /api/books?title=clean&amp;minYear=2000&amp;sort=price:desc&amp;page=2&amp;pageSize=20
    [HttpGet]
    public async Task&lt;ActionResult&lt;PagedResult&lt;BookListItem&gt;&gt;&gt; Search(
        [FromQuery] BookFilter filter, [FromQuery] PageQuery paging, CancellationToken ct)
    {
        IQueryable&lt;Book&gt; query = db.Books.AsNoTracking();
        // Compose the filters. Nothing has run yet: this is all one SQL statement.
        if (!string.IsNullOrWhiteSpace(filter.Title))
            // Contains maps to LIKE, which is case insensitive under most collations.
            // Do NOT write .ToLower().Contains(...): it stops the index being used.
            query = query.Where(b =&gt; b.Title.Contains(filter.Title));
        if (filter.MinYear  is not null) query = query.Where(b =&gt; b.Year &gt;= filter.MinYear);
        if (filter.MaxPrice is not null) query = query.Where(b =&gt; b.Price &lt;= filter.MaxPrice);
        if (filter.AuthorId is not null) query = query.Where(b =&gt; b.AuthorId == filter.AuthorId);
        query = ApplySort(query, paging.Sort);
        // Filters are applied BEFORE the count, so the total matches the filter
        return await query.ToPagedResultAsync(
            b =&gt; new BookListItem(b.Id, b.Title, b.Price, b.Year),
            paging.Page, paging.PageSize, ct);
    }
    // CURSOR paging: constant time at any depth, and stable when rows are inserted.
    // The trade is that you can only go forward, never jump to page 50.
    [HttpGet("feed")]
    public async Task&lt;ActionResult&lt;CursorResult&lt;BookListItem&gt;&gt;&gt; Feed(
        [FromQuery] string? cursor, [FromQuery] int limit = 20, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 100);
        IQueryable&lt;Book&gt; query = db.Books.AsNoTracking().OrderBy(b =&gt; b.Id);
        if (cursor is not null &amp;&amp; TryDecodeCursor(cursor, out int afterId))
            query = query.Where(b =&gt; b.Id &gt; afterId);       // an index seek, not a scan
        // limit + 1 tells us whether more exists, without a second query
        List&lt;BookListItem&gt; items = await query
            .Take(limit + 1)
            .Select(b =&gt; new BookListItem(b.Id, b.Title, b.Price, b.Year))
            .ToListAsync(ct);
        bool hasMore = items.Count &gt; limit;
        if (hasMore) items.RemoveAt(items.Count - 1);
        return new CursorResult&lt;BookListItem&gt;
        {
            Items      = items,
            NextCursor = hasMore ? EncodeCursor(items[^1].Id) : null,
            HasMore    = hasMore
        };
    }
    private static IQueryable&lt;Book&gt; ApplySort(IQueryable&lt;Book&gt; query, string? sort)
    {
        string[] parts = (sort ?? "title").Split(':');
        bool descending = parts.Length &gt; 1 &amp;&amp; parts[1].Equals("desc", StringComparison.OrdinalIgnoreCase);
        if (!SortMap.TryGetValue(parts[0], out Expression&lt;Func&lt;Book, object&gt;&gt;? selector))
            selector = SortMap["title"];        // unknown field: fall back, do not throw
        IOrderedQueryable&lt;Book&gt; ordered = descending
            ? query.OrderByDescending(selector)
            : query.OrderBy(selector);
        // A tiebreaker on a unique column. Without it, rows with the same title
        // can appear on two pages or on none.
        return ordered.ThenBy(b =&gt; b.Id);
    }
    private static string EncodeCursor(int id) =&gt;
        Convert.ToBase64String(Encoding.UTF8.GetBytes($"id:{id}"));
    private static bool TryDecodeCursor(string cursor, out int id)
    {
        id = 0;
        try
        {
            string raw = Encoding.UTF8.GetString(Convert.FromBase64String(cursor));
            return raw.StartsWith("id:") &amp;&amp; int.TryParse(raw[3..], out id);
        }
        catch { return false; }
    }
}
// Write it once and every collection endpoint behaves the same. The clamping
// cannot be forgotten, because it lives in here.
public static class QueryableExtensions
{
    public static async Task&lt;PagedResult&lt;TDto&gt;&gt; ToPagedResultAsync&lt;TEntity, TDto&gt;(
        this IQueryable&lt;TEntity&gt; query,
        Expression&lt;Func&lt;TEntity, TDto&gt;&gt; selector,
        int page, int pageSize, CancellationToken ct = default)
    {
        page     = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);      // the client does not decide our workload
        int total = await query.CountAsync(ct);
        List&lt;TDto&gt; items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(selector)                          // projection: only these columns are read
            .ToListAsync(ct);
        return new PagedResult&lt;TDto&gt;
        {
            Items = items, Page = page, PageSize = pageSize, TotalCount = total
        };
    }
}
public class CursorResult&lt;T&gt;
{
    public IReadOnlyList&lt;T&gt; Items { get; init; } = Array.Empty&lt;T&gt;();
    public string? NextCursor { get; init; }
    public bool HasMore { get; init; }
}
public record BookListItem(int Id, string Title, decimal Price, int Year);
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public int Year { get; set; }
    public decimal Price { get; set; }
    public int AuthorId { get; set; }
    public DateTime CreatedAt { get; set; }
}
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Book&gt; Books =&gt; Set&lt;Book&gt;();
    protected override void OnModelCreating(ModelBuilder b)
    {
        // Paging and filtering are only fast with indexes on what you filter and sort by
        b.Entity&lt;Book&gt;().HasIndex(x =&gt; x.Title);
        b.Entity&lt;Book&gt;().HasIndex(x =&gt; new { x.AuthorId, x.Year });
        b.Entity&lt;Book&gt;().HasIndex(x =&gt; x.CreatedAt);
    }
}
</code></pre>
