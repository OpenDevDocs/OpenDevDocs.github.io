---
publishDate: 2026-09-23T17:00
title: Response Caching and Output Caching
slug: response-caching-and-output-caching
metadescription: Serve repeated requests without touching the database. Compare in memory caching, response caching with Cache-Control, output caching and distributed caching, and learn when to invalidate.
updateDate: 2026-09-07T17:00
author: ['bishal-biswas']
level: 3
tags: ['caching', 'performance', 'redis']
course: dotnet-webapi
---

## Four different caches

The word caching covers several things in ASP.NET Core, and mixing them up wastes time. Here is the map.

**In memory caching (`IMemoryCache`)** stores objects in your process. You control what goes in and when it comes out. Per server.

**Distributed caching (`IDistributedCache`)** stores serialized data in Redis or SQL Server. Shared by every server.

**Response caching** sends `Cache-Control` headers so the **browser and proxies** cache the response. The cache is not on your server at all.

**Output caching** stores the full response **on your server** and replays it without running the endpoint. Added in .NET 7 and the best default for an API.

## In memory caching

The simplest and most useful. Cache the result of an expensive query:

```csharp
builder.Services.AddMemoryCache();
```

```csharp
public class BookService
{
    private readonly IMemoryCache cache;
    private readonly AppDbContext db;

    public async Task<List<CategoryDto>> GetCategoriesAsync(CancellationToken ct)
    {
        return await cache.GetOrCreateAsync("categories", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
            entry.SetSize(1);

            return await db.Categories
                .Select(c => new CategoryDto(c.Id, c.Name))
                .ToListAsync(ct);
        }) ?? new List<CategoryDto>();
    }
}
```

`GetOrCreateAsync` returns the cached value or runs the factory and stores it. One method, no manual check.

Two expiration policies, and you usually want both:

```csharp
entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);   // hard limit
entry.SlidingExpiration = TimeSpan.FromMinutes(5);                  // reset on each access
```

Sliding alone can keep an item alive forever if it is accessed often enough. Absolute alone drops popular items. Together, an item stays while it is used and never gets more than 30 minutes stale.

**Set a size limit**, or a memory cache grows until the process runs out:

```csharp
builder.Services.AddMemoryCache(options =>
{
    options.SizeLimit = 1024;         // in units you define
});
```

Once `SizeLimit` is set, **every** entry must call `SetSize` or the add throws.

## Cache stampede

A subtle problem worth knowing. When a popular cache entry expires, every concurrent request misses at once and all of them hit the database.

`GetOrCreateAsync` does not lock, so a hundred concurrent requests run the factory a hundred times. Guard it:

```csharp
private static readonly SemaphoreSlim Gate = new(1, 1);

public async Task<List<CategoryDto>> GetCategoriesAsync(CancellationToken ct)
{
    if (cache.TryGetValue("categories", out List<CategoryDto>? cached))
        return cached!;

    await Gate.WaitAsync(ct);
    try
    {
        // Check again: another request may have filled it while we waited
        if (cache.TryGetValue("categories", out cached))
            return cached!;

        List<CategoryDto> categories = await db.Categories
            .Select(c => new CategoryDto(c.Id, c.Name))
            .ToListAsync(ct);

        cache.Set("categories", categories, TimeSpan.FromMinutes(30));
        return categories;
    }
    finally
    {
        Gate.Release();
    }
}
```

The second check inside the lock is the important part.

## Output caching

The most useful for an API, because it caches the whole response on your server:

```csharp
builder.Services.AddOutputCache(options =>
{
    options.AddBasePolicy(policy => policy.Expire(TimeSpan.FromSeconds(30)));

    options.AddPolicy("Long", policy => policy.Expire(TimeSpan.FromMinutes(10)));

    options.AddPolicy("ByQuery", policy => policy
        .Expire(TimeSpan.FromMinutes(5))
        .SetVaryByQuery("page", "pageSize", "sort")
        .Tag("books"));
});

var app = builder.Build();

app.UseOutputCache();      // after UseRouting, before the endpoints
```

```csharp
[HttpGet]
[OutputCache(PolicyName = "ByQuery")]
public async Task<ActionResult<List<BookListItem>>> GetAll() { }
```

```csharp
app.MapGet("/api/categories", GetCategories).CacheOutput("Long");
```

**`SetVaryByQuery` is essential.** Without it, `?page=1` and `?page=2` share a cache entry and every client gets page 1.

The same applies to headers. If a response depends on the user, either vary by the relevant claim or do not cache it at all.

## Cache invalidation with tags

The best feature of output caching. Tag entries, then evict them by tag when the data changes:

```csharp
options.AddPolicy("ByQuery", policy => policy
    .Expire(TimeSpan.FromMinutes(5))
    .Tag("books"));
```

```csharp
[HttpPost]
public async Task<IActionResult> Create(
    CreateBookRequest request, IOutputCacheStore cacheStore, CancellationToken ct)
{
    Book book = await service.CreateAsync(request, ct);

    await cacheStore.EvictByTagAsync("books", ct);      // every book response is now stale

    return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
}
```

Without this, a new book does not appear for five minutes and users think the API is broken. Any endpoint that writes should evict the tags it affects.

## Response caching

This one caches on the **client and proxies**, not on your server. It sends headers:

```csharp
[HttpGet]
[ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]
public IActionResult GetAll() => Ok(books);
```

```http
Cache-Control: public, max-age=60
```

Use it for genuinely public, unchanging data: a country list, a public catalogue. It costs you nothing, because the request never arrives.

Two warnings. Do not use `Location = Any` for anything user specific, because a shared proxy may serve one user's data to another. Use `ResponseCacheLocation.None` with `NoStore = true` for anything private:

```csharp
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
```

And once a response is cached in a browser you cannot recall it. Keep durations short for anything that changes.

## Distributed caching

When you run several instances, an in memory cache means each has its own copy, so a user can see different data depending on which server answers.

```bash
dotnet add package Microsoft.Extensions.Caching.StackExchangeRedis
```

```csharp
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "bookstore:";
});
```

```csharp
public async Task<List<CategoryDto>> GetCategoriesAsync(CancellationToken ct)
{
    string? json = await cache.GetStringAsync("categories", ct);

    if (json is not null)
        return JsonSerializer.Deserialize<List<CategoryDto>>(json)!;

    List<CategoryDto> categories = await db.Categories
        .Select(c => new CategoryDto(c.Id, c.Name))
        .ToListAsync(ct);

    await cache.SetStringAsync("categories",
        JsonSerializer.Serialize(categories),
        new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30) },
        ct);

    return categories;
}
```

`IDistributedCache` only stores byte arrays and strings, so you serialize yourself. Redis output caching also exists, so `CacheOutput` can be shared across instances.

Design for Redis being unavailable. A cache failure should degrade to a slow response, not a broken one:

```csharp
try
{
    json = await cache.GetStringAsync(key, ct);
}
catch (Exception ex)
{
    logger.LogWarning(ex, "Cache unavailable, falling through to the database");
}
```

## ETags and conditional requests

The cheapest possible response is one with no body:

```csharp
[HttpGet("{id:int}")]
public async Task<IActionResult> GetById(int id, CancellationToken ct)
{
    Book? book = await db.Books.FindAsync(new object[] { id }, ct);
    if (book is null) return NotFound();

    string etag = $"\"{Convert.ToBase64String(book.RowVersion)}\"";

    if (Request.Headers.IfNoneMatch == etag)
        return StatusCode(StatusCodes.Status304NotModified);

    Response.Headers.ETag = etag;
    return Ok(new BookResponse(book.Id, book.Title, book.Price));
}
```

The client sends `If-None-Match` with the etag it holds. If nothing changed, it gets `304` and no body. Very effective for mobile clients on slow networks.

## What to cache, and what not to

**Good candidates:** reference data such as countries and categories, expensive aggregations, public catalogues, anything read far more often than it is written.

**Do not cache:** anything user specific unless the key includes the user, anything that must be immediately correct such as stock levels or balances, or anything that changes on almost every read.

Before adding a cache, measure. A cache adds a failure mode, an invalidation problem and a class of bug where users see stale data. Adding an index or fixing an N plus 1 often gives a bigger win with none of that.

## Quick recap

- `IMemoryCache` for per server object caching, `IDistributedCache` for shared, output caching for whole responses on your server, response caching for the browser and proxies.
- `GetOrCreateAsync` is the one line pattern for memory caching.
- Combine absolute and sliding expiration, and set a `SizeLimit` with `SetSize` on every entry.
- Guard against a stampede with a semaphore and a second check inside the lock.
- Output caching is the best default for an API. Always `SetVaryByQuery` for paged endpoints.
- Tag output cache entries and call `EvictByTagAsync` from every write.
- Never use `ResponseCacheLocation.Any` for user specific data.
- Use Redis once you run more than one instance, and degrade gracefully when it is down.
- ETags and `304` responses skip the body entirely.
- Measure first. An index or a fixed N plus 1 is often a bigger win than a cache.

<code id="code-content" class="language-csharp">
// The four caches, each used where it fits.
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
// 1. In memory. A size limit stops it growing until the process dies.
builder.Services.AddMemoryCache(options =&gt; options.SizeLimit = 1024);
// 2. Distributed, for when more than one instance runs
builder.Services.AddStackExchangeRedisCache(options =&gt;
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName  = "bookstore:";
});
// 3. Output caching: the whole response, stored on this server
builder.Services.AddOutputCache(options =&gt;
{
    options.AddBasePolicy(p =&gt; p.Expire(TimeSpan.FromSeconds(30)));
    options.AddPolicy("Reference", p =&gt; p.Expire(TimeSpan.FromMinutes(30)).Tag("reference"));
    options.AddPolicy("BookList",  p =&gt; p
        .Expire(TimeSpan.FromMinutes(5))
        // ESSENTIAL. Without it, ?page=1 and ?page=2 share one entry
        // and every client is served page 1.
        .SetVaryByQuery("page", "pageSize", "sort")
        .Tag("books"));
});
builder.Services.AddScoped&lt;CategoryService&gt;();
var app = builder.Build();
app.UseRouting();
app.UseOutputCache();          // after routing, before the endpoints
app.MapControllers();
app.Run();
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly AppDbContext db;
    public BooksController(AppDbContext db) =&gt; this.db = db;
    // Output cached and varied by the paging parameters
    [HttpGet]
    [OutputCache(PolicyName = "BookList")]
    public async Task&lt;ActionResult&lt;List&lt;BookListItem&gt;&gt;&gt; GetAll(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =&gt;
        await db.Books.AsNoTracking()
            .OrderBy(b =&gt; b.Title).ThenBy(b =&gt; b.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(b =&gt; new BookListItem(b.Id, b.Title, b.Price))
            .ToListAsync(ct);
    // ETag plus 304: the cheapest response is one with no body at all
    [HttpGet("{id:int}")]
    public async Task&lt;IActionResult&gt; GetById(int id, CancellationToken ct)
    {
        Book? book = await db.Books.AsNoTracking().FirstOrDefaultAsync(b =&gt; b.Id == id, ct);
        if (book is null) return NotFound();
        string etag = $"\"{Convert.ToBase64String(book.RowVersion)}\"";
        if (Request.Headers.IfNoneMatch == etag)
            return StatusCode(StatusCodes.Status304NotModified);
        Response.Headers.ETag = etag;
        return Ok(new BookListItem(book.Id, book.Title, book.Price));
    }
    // Every write evicts the tags it affects. Without this, a new book does not
    // appear for five minutes and users assume the API is broken.
    [HttpPost]
    public async Task&lt;IActionResult&gt; Create(
        [FromBody] CreateBookRequest request, IOutputCacheStore cacheStore, CancellationToken ct)
    {
        var book = new Book { Title = request.Title, Price = request.Price };
        db.Books.Add(book);
        await db.SaveChangesAsync(ct);
        await cacheStore.EvictByTagAsync("books", ct);
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
    }
    // Response caching: the browser and proxies cache this, so the request never
    // reaches us. Only for genuinely public data. Location.Any on user specific
    // data can serve one person's response to another.
    [HttpGet("public-catalogue")]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
    public IActionResult PublicCatalogue() =&gt; Ok(new[] { "Clean Code", "Refactoring" });
    // Anything private must say so explicitly
    [HttpGet("my-shelf")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public IActionResult MyShelf() =&gt; Ok(new { userId = User.FindFirst("sub")?.Value });
}
public class CategoryService
{
    // A semaphore stops a stampede: when a hot entry expires, a hundred concurrent
    // requests would otherwise all run the factory at once.
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private const string Key = "categories";
    private readonly IMemoryCache memory;
    private readonly IDistributedCache distributed;
    private readonly AppDbContext db;
    private readonly ILogger&lt;CategoryService&gt; logger;
    public CategoryService(IMemoryCache memory, IDistributedCache distributed,
                           AppDbContext db, ILogger&lt;CategoryService&gt; logger)
        =&gt; (this.memory, this.distributed, this.db, this.logger) = (memory, distributed, db, logger);
    public async Task&lt;List&lt;CategoryDto&gt;&gt; GetFromMemoryAsync(CancellationToken ct)
    {
        if (memory.TryGetValue(Key, out List&lt;CategoryDto&gt;? cached)) return cached!;
        await Gate.WaitAsync(ct);
        try
        {
            // The second check matters: another request may have filled it while we waited
            if (memory.TryGetValue(Key, out cached)) return cached!;
            List&lt;CategoryDto&gt; categories = await db.Categories
                .Select(c =&gt; new CategoryDto(c.Id, c.Name)).ToListAsync(ct);
            memory.Set(Key, categories, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30),  // hard limit
                SlidingExpiration               = TimeSpan.FromMinutes(5),   // resets on access
                Size = 1                          // required once SizeLimit is set
            });
            return categories;
        }
        finally { Gate.Release(); }
    }
    public async Task&lt;List&lt;CategoryDto&gt;&gt; GetFromRedisAsync(CancellationToken ct)
    {
        // A cache being down should mean a SLOW response, not a broken one
        try
        {
            string? json = await distributed.GetStringAsync(Key, ct);
            if (json is not null) return JsonSerializer.Deserialize&lt;List&lt;CategoryDto&gt;&gt;(json)!;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis unavailable, falling through to the database");
        }
        List&lt;CategoryDto&gt; categories = await db.Categories
            .Select(c =&gt; new CategoryDto(c.Id, c.Name)).ToListAsync(ct);
        try
        {
            await distributed.SetStringAsync(Key, JsonSerializer.Serialize(categories),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30) },
                ct);
        }
        catch (Exception ex) { logger.LogWarning(ex, "Could not write to Redis"); }
        return categories;
    }
}
public record BookListItem(int Id, string Title, decimal Price);
public record CategoryDto(int Id, string Name);
public record CreateBookRequest(string Title, decimal Price);
public class Book     { public int Id { get; set; } public string Title { get; set; } = "";
                        public decimal Price { get; set; }
                        public byte[] RowVersion { get; set; } = Array.Empty&lt;byte&gt;(); }
public class Category { public int Id { get; set; } public string Name { get; set; } = ""; }
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Book&gt; Books =&gt; Set&lt;Book&gt;();
    public DbSet&lt;Category&gt; Categories =&gt; Set&lt;Category&gt;();
}
</code></pre>
