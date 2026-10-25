---
publishDate: 2026-08-27T14:50
title: Caching in MVC
slug: caching-in-mvc
metadescription: Speed up pages by caching data with IMemoryCache and IDistributedCache, caching rendered output with the ResponseCache attribute and output caching middleware, caching view fragments with the cache tag helper, and knowing when each is appropriate.
updateDate: 2026-09-14T14:50
author: ['bishal-biswas']
level: 3
tags: ['caching', 'performance', 'memory-cache']
course: dotnet-mvc
---

## Do the work once

A category menu is built from the database on every page. It changes once a month. That is thousands of identical queries a day for the same twelve rows.

**Caching** means keeping a result and reusing it instead of computing it again. It is the biggest performance win most apps can get, and ASP.NET Core has several layers of it. This topic goes from smallest to largest: cache a value, cache a fragment of a view, cache a whole response.

## Caching data with IMemoryCache

`IMemoryCache` stores objects in the server's memory. Register it and inject it:

```csharp
builder.Services.AddMemoryCache();
```

```csharp
public class CategoryService
{
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;

    public CategoryService(AppDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<List<Category>> GetAllAsync()
    {
        return await _cache.GetOrCreateAsync("categories", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
            return await _db.Categories.OrderBy(c => c.Name).ToListAsync();
        }) ?? new List<Category>();
    }
}
```

`GetOrCreateAsync` checks for the key. If present, it returns the cached value. If not, it runs the factory, stores the result, and returns it. The first call hits the database, the next thirty minutes of calls do not.

Two kinds of expiry:

- **Absolute**: gone after a fixed time, no matter what.
- **Sliding**: gone after a period of no access. Good for things used in bursts.

```csharp
entry.SlidingExpiration = TimeSpan.FromMinutes(5);
```

Combine both so a hot item does not live forever.

## Removing an entry

When the underlying data changes, remove the cached copy so the next request rebuilds it:

```csharp
public async Task AddAsync(Category category)
{
    _db.Categories.Add(category);
    await _db.SaveChangesAsync();
    _cache.Remove("categories");
}
```

This is the hard part of caching: knowing when to invalidate. Put the cache and the code that changes the data in the same service so they cannot drift apart.

## Cache keys

Keys are strings. Include everything that makes the result different:

```csharp
var key = $"products:category:{categoryId}:page:{page}";
```

Two requests with different parameters must not share a key, or one user sees another's results.

## Memory limits

Memory cache has no size limit by default. Set one and give entries a size so the cache evicts old items rather than growing without end:

```csharp
builder.Services.AddMemoryCache(o => o.SizeLimit = 1024);
```

```csharp
entry.Size = 1;
```

Units are up to you. One per entry is fine if entries are similar in size.

## Distributed cache

Memory cache is per server. With several servers, each has its own cache and they go stale at different times. `IDistributedCache` uses a shared store such as Redis:

```csharp
builder.Services.AddStackExchangeRedisCache(o =>
    o.Configuration = builder.Configuration.GetConnectionString("Redis"));
```

The interface stores bytes or strings, so objects need serialising:

```csharp
var json = await _cache.GetStringAsync(key);
if (json is not null)
{
    return JsonSerializer.Deserialize<List<Category>>(json)!;
}

var categories = await _db.Categories.ToListAsync();
await _cache.SetStringAsync(key, JsonSerializer.Serialize(categories), new DistributedCacheEntryOptions
{
    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30)
});
```

Redis is slower than memory but shared and survives app restarts. Many apps use both: memory for very hot data, Redis for the rest.

## Caching a view fragment

The `<cache>` tag helper caches rendered HTML in memory:

```cshtml
<cache expires-after="@TimeSpan.FromMinutes(10)">
    <partial name="_CategoryMenu" model="await Categories.GetAllAsync()" />
</cache>
```

Everything inside renders once every ten minutes. Vary it when the content depends on something:

```cshtml
<cache expires-after="@TimeSpan.FromMinutes(10)" vary-by-user="true">
    <partial name="_Recommendations" />
</cache>

<cache vary-by-route="category" vary-by-query="page">
    ...
</cache>
```

`vary-by-user` keeps a separate copy per logged in user. `vary-by-route` and `vary-by-query` key on those values. The `<distributed-cache>` tag helper does the same through `IDistributedCache`.

## Caching whole responses

For pages that are the same for everyone, cache the entire response. There are two mechanisms.

**Response caching** sets HTTP cache headers so browsers and proxies keep the page:

```csharp
[ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
public IActionResult About() => View();
```

This sends `Cache-Control: public, max-age=300`. The browser will not even ask for the page again for five minutes. The server does no caching itself unless you add `app.UseResponseCaching()`, and even then only for requests that carry no cookies, which rules out most MVC pages.

Use `ResponseCache` with `NoStore = true` on pages that must never be cached, such as anything showing personal data:

```csharp
[ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
```

**Output caching** caches on the server and works regardless of cookies:

```csharp
builder.Services.AddOutputCache(options =>
{
    options.AddPolicy("Products", p => p.Expire(TimeSpan.FromMinutes(5)).SetVaryByQuery("page", "sort"));
});

app.UseOutputCache();
```

```csharp
[OutputCache(PolicyName = "Products")]
public async Task<IActionResult> Index(int page = 1, string? sort = null)
```

Output caching stores the rendered response and serves it to the next request without running the action. Vary by query, route or header so different pages get different entries. Evict by tag when data changes:

```csharp
options.AddPolicy("Products", p => p.Expire(TimeSpan.FromMinutes(5)).Tag("products"));
```

```csharp
await _outputCache.EvictByTagAsync("products", default);
```

Output caching is for anonymous or identical content. It does not vary by user by default, and a page cached for one user must not be served to another.

## Choosing a layer

| Cache | Scope | Use for |
| --- | --- | --- |
| `IMemoryCache` | One server | Query results, computed values |
| `IDistributedCache` | All servers | Same, when scaled out |
| `<cache>` tag helper | View fragment | Menus, footers, widgets |
| `[ResponseCache]` | Browser and proxies | Static like pages, and `NoStore` for private ones |
| `[OutputCache]` | Server, whole response | Public pages with identical content |

Start with `IMemoryCache` for expensive queries. Add fragment caching for shared widgets. Reach for output caching only on hot public pages.

## Quick recap

- Caching keeps a result so the next request does not compute it again.
- `IMemoryCache.GetOrCreateAsync` caches data with absolute or sliding expiry, and `Remove` invalidates when data changes.
- `IDistributedCache` with Redis shares the cache across servers.
- The `<cache>` tag helper caches rendered fragments and can vary by user, route or query.
- `[ResponseCache]` sets browser cache headers, and `[OutputCache]` caches whole responses on the server.
- Include every parameter in the key, set expiries, and never serve one user's cached content to another.

<code id="code-content" class="language-csharp">
// Services/CategoryService.cs
using Microsoft.Extensions.Caching.Memory;

public class CategoryService : ICategoryService
{
    private const string CacheKey = "categories:all";
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;

    public CategoryService(AppDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task&lt;List&lt;Category&gt;&gt; GetAllAsync()
    {
        return await _cache.GetOrCreateAsync(CacheKey, async entry =&gt;
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);
            entry.SlidingExpiration = TimeSpan.FromMinutes(10);
            entry.Size = 1;
            return await _db.Categories.AsNoTracking().OrderBy(c =&gt; c.Name).ToListAsync();
        }) ?? new List&lt;Category&gt;();
    }

    public async Task AddAsync(Category category)
    {
        _db.Categories.Add(category);
        await _db.SaveChangesAsync();
        _cache.Remove(CacheKey);              // invalidate in the same place data changes
    }
}

// Services/ProductStatsService.cs (distributed cache with JSON)
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;

public class ProductStatsService
{
    private readonly AppDbContext _db;
    private readonly IDistributedCache _cache;

    public ProductStatsService(AppDbContext db, IDistributedCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task&lt;ProductStats&gt; GetAsync(int productId)
    {
        var key = $"stats:product:{productId}";
        var json = await _cache.GetStringAsync(key);
        if (json is not null) return JsonSerializer.Deserialize&lt;ProductStats&gt;(json)!;

        var stats = new ProductStats
        {
            Sold = await _db.OrderLines.Where(l =&gt; l.ProductId == productId).SumAsync(l =&gt; l.Quantity),
            Reviews = await _db.Reviews.CountAsync(r =&gt; r.ProductId == productId)
        };

        await _cache.SetStringAsync(key, JsonSerializer.Serialize(stats), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15)
        });
        return stats;
    }
}

// Program.cs
builder.Services.AddMemoryCache(o =&gt; o.SizeLimit = 2000);
builder.Services.AddStackExchangeRedisCache(o =&gt;
    o.Configuration = builder.Configuration.GetConnectionString("Redis"));
builder.Services.AddOutputCache(options =&gt;
{
    options.AddPolicy("ProductList", p =&gt; p
        .Expire(TimeSpan.FromMinutes(5))
        .SetVaryByQuery("page", "sort", "search")
        .Tag("products"));
});
// ...
app.UseOutputCache();   // after UseRouting

// Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private readonly AppDbContext _db;
    private readonly IOutputCacheStore _outputCache;

    public ProductsController(AppDbContext db, IOutputCacheStore outputCache)
    {
        _db = db;
        _outputCache = outputCache;
    }

    [OutputCache(PolicyName = "ProductList")]     // public page, identical for everyone
    public async Task&lt;IActionResult&gt; Index(int page = 1, string? sort = null, string? search = null)
    {
        var products = await _db.Products.OrderBy(p =&gt; p.Name).Skip((page - 1) * 20).Take(20).ToListAsync();
        return View(products);
    }

    [Authorize]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]   // personal: never cache
    public IActionResult MyOrders() =&gt; View();

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task&lt;IActionResult&gt; Create(Product product)
    {
        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        await _outputCache.EvictByTagAsync("products", default);   // list pages rebuild on next hit
        return RedirectToAction(nameof(Index));
    }
}

// Views/Shared/_Layout.cshtml (fragment caching)
//
//   @inject ICategoryService Categories
//   &lt;cache expires-after="@TimeSpan.FromMinutes(10)"&gt;
//       &lt;partial name="_CategoryMenu" model="await Categories.GetAllAsync()" /&gt;
//   &lt;/cache&gt;
//   &lt;cache expires-after="@TimeSpan.FromMinutes(5)" vary-by-user="true"&gt;
//       &lt;partial name="_Recommendations" /&gt;
//   &lt;/cache&gt;
</code></pre>
