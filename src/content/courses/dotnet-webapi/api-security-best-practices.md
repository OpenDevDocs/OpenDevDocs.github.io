---
publishDate: 2026-09-20T15:50
title: API Security Best Practices
slug: api-security-best-practices
metadescription: A practical checklist for hardening an ASP.NET Core Web API, covering the OWASP API risks, secrets, input handling, security headers, logging and dependency hygiene.
updateDate: 2026-09-07T15:50
author: ['bishal-biswas']
level: 4
tags: ['security', 'owasp', 'hardening']
course: dotnet-webapi
---

## Start with the top risk

The OWASP API Security Top 10 puts **broken object level authorization** first, because it is the most common serious flaw in real APIs.

It looks like this:

```csharp
[HttpGet("{id:int}")]
[Authorize]
public async Task<ActionResult<Order>> GetOrder(int id)
{
    return await db.Orders.FindAsync(id);      // any logged in user can read ANY order
}
```

`[Authorize]` confirms the caller is logged in. It says nothing about whether **this** order is theirs. Change the id in the URL and you read someone else's data.

```csharp
[HttpGet("{id:int}")]
[Authorize]
public async Task<ActionResult<OrderResponse>> GetOrder(int id, CancellationToken ct)
{
    string userId = User.FindFirst("sub")!.Value;

    OrderResponse? order = await db.Orders
        .Where(o => o.Id == id && o.CustomerId == userId)     // scoped to the caller
        .Select(o => new OrderResponse(o.Id, o.Total, o.PlacedAt))
        .FirstOrDefaultAsync(ct);

    return order is null ? NotFound() : order;
}
```

Two habits prevent this class of bug. **Scope every query by the current user** rather than filtering afterwards. And return **`404` rather than `403`** when the existence of the record is itself information.

Check this on every endpoint that takes an id. It is the single highest value review you can do.

## Never trust the client

Anything the client controls is untrusted, including things that feel safe.

```csharp
// The client can write whatever it likes here
string userId = Request.Headers["X-User-Id"]!;
int userId = request.UserId;
string role = request.Role;

// Only this came from a signature you verified
string userId = User.FindFirst("sub")!.Value;
```

The same applies to over posting. Accept a request DTO with exactly the fields a client may set, never an entity:

```csharp
// A client sends {"email":"x","isAdmin":true} and becomes an administrator
public IActionResult Create(User user) { }

// Nowhere for isAdmin to land
public IActionResult Create(CreateUserRequest request) { }
```

## Secrets

Rules, in order of importance:

- No secret in `appsettings.json`, in code, or in a Docker image layer.
- User secrets locally, a managed vault or environment variables in production.
- Best of all, a managed identity, so there is no secret to leak.
- Rotate anything that has ever been committed. Deleting the line does not clear git history.
- Never log a secret. Redact tokens, passwords and card numbers before they reach a log.

## Enforce HTTPS

```csharp
app.UseHttpsRedirection();
app.UseHsts();                    // production only
```

```csharp
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
});
```

HSTS tells browsers never to use HTTP for this domain again. It is sticky, so enable it only in production or you will fight your local setup.

## Security headers

A few headers close off whole categories of attack. Add them once in middleware:

```csharp
app.Use(async (context, next) =>
{
    IHeaderDictionary headers = context.Response.Headers;

    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "no-referrer";
    headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";

    headers.Remove("Server");
    headers.Remove("X-Powered-By");

    await next();
});
```

`nosniff` stops a browser guessing a content type and executing JSON as script. `frame-ancestors 'none'` prevents clickjacking. Removing `Server` stops advertising your stack version.

Also turn off the Kestrel server header at the source:

```csharp
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);
```

## Rate limiting

Without it, one client can exhaust your database connections, and a login endpoint can be brute forced.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("api", limiter =>
    {
        limiter.PermitLimit = 100;
        limiter.Window = TimeSpan.FromMinutes(1);
    });

    // Much tighter on authentication
    options.AddFixedWindowLimiter("auth", limiter =>
    {
        limiter.PermitLimit = 5;
        limiter.Window = TimeSpan.FromMinutes(15);
    });

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

app.UseRateLimiter();
```

Rate limiting gets its own topic. The point here is that login, registration and password reset need a far tighter limit than the rest of the API.

## Limit the size of everything

Unbounded input is a denial of service waiting to happen.

```csharp
builder.Services.Configure<KestrelServerOptions>(options =>
{
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024;         // 10 MB
    options.Limits.MaxRequestHeadersTotalSize = 32 * 1024;
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);
});
```

Cap page sizes too. A client asking for a million rows should get a hundred:

```csharp
public int Size
{
    get => size;
    set => size = Math.Clamp(value, 1, 100);
}
```

## SQL injection

EF Core parameterises LINQ automatically, so ordinary queries are safe. The danger is raw SQL:

```csharp
// Vulnerable: a search term of "'; DROP TABLE Books; --" is now SQL
var books = await db.Books
    .FromSqlRaw($"SELECT * FROM Books WHERE Title LIKE '%{term}%'")
    .ToListAsync();

// Safe: FromSql with interpolation creates parameters
var books = await db.Books
    .FromSql($"SELECT * FROM Books WHERE Title LIKE {'%' + term + '%'}")
    .ToListAsync();

// Also safe: explicit parameters
var books = await db.Books
    .FromSqlRaw("SELECT * FROM Books WHERE Title LIKE @term",
                new SqlParameter("@term", $"%{term}%"))
    .ToListAsync();
```

`FromSql` with an interpolated string is safe. `FromSqlRaw` with an interpolated string is not. The names are close enough to be dangerous, so check every use.

Dynamic sorting is another gap, because a column name cannot be a parameter. Use an allow list:

```csharp
static readonly HashSet<string> Sortable = new() { "title", "price", "year" };

if (!Sortable.Contains(sortBy)) sortBy = "title";
```

## Do not leak information in errors

In production, clients get a generic message and a trace id. Stack traces, connection strings and SQL fragments stay in your logs.

```csharp
Detail = env.IsDevelopment() ? exception.ToString() : "An unexpected error occurred.";
```

The same applies to authentication. One message for a wrong email and a wrong password, or you have built a user enumeration endpoint.

Timing matters too. If a wrong email returns instantly and a wrong password takes 200 milliseconds because of the hash check, the difference is measurable. Hash a dummy password when the user is not found:

```csharp
if (user is null)
{
    BCrypt.Net.BCrypt.Verify(request.Password, DummyHash);    // burn the same time
    return Unauthorized(new { error = "Invalid email or password." });
}
```

## Log the right things

**Log:** authentication successes and failures, authorization denials, rate limit hits, changes to permissions, and every unhandled exception with a trace id.

**Never log:** passwords, tokens, session cookies, card numbers, or full request bodies from authentication endpoints.

Use structured logging so you can query it:

```csharp
logger.LogWarning("Failed login for {Email} from {Ip}", email, ip);
```

And be careful with user input in log messages. A newline in a username can forge a log line.

## Keep dependencies current

```bash
dotnet list package --vulnerable --include-transitive
dotnet list package --outdated
```

Run the first one in CI and fail the build on a high severity finding. Most real world compromises come from a known vulnerability in a package nobody updated, not from a clever attack.

## Validate everything

Every field, every time. Length, range, format, allowed values.

```csharp
[Required, StringLength(200, MinimumLength = 1)]
public string Title { get; set; } = "";

[Range(0.01, 10000)]
public decimal Price { get; set; }

[RegularExpression(@"^[a-z0-9-]+$")]
public string Slug { get; set; } = "";
```

Prefer allow lists over deny lists. Listing what is permitted is finite. Listing what is forbidden never is.

Watch out for catastrophic backtracking in regular expressions, where a crafted input causes exponential matching time. Set a timeout:

```csharp
new Regex(pattern, RegexOptions.None, TimeSpan.FromMilliseconds(100));
```

## Disable what you do not use

- Swagger in production, unless it is behind authentication and you have decided it should be public.
- Detailed errors, `EnableSensitiveDataLogging` and the developer exception page.
- Any HTTP method you do not implement.
- Any endpoint left over from debugging. Search for `AllowAnonymous` before every release.

## The checklist

Before going live:

- [ ] Every endpoint taking an id checks ownership, not just authentication.
- [ ] A `FallbackPolicy` requires authentication by default.
- [ ] No `[AllowAnonymous]` remains except on login, registration and health.
- [ ] Request DTOs everywhere. No entity is accepted or returned.
- [ ] No secrets in the repository. Anything ever committed has been rotated.
- [ ] HTTPS enforced, HSTS on in production.
- [ ] Security headers set, `Server` header removed.
- [ ] Rate limiting on, with a tight limit on authentication endpoints.
- [ ] Body size, header size and page size all capped.
- [ ] No `FromSqlRaw` with interpolation. Sort fields come from an allow list.
- [ ] Production errors carry a trace id and nothing else.
- [ ] Login returns the same message and takes the same time for every failure.
- [ ] Structured logging, with secrets redacted.
- [ ] `dotnet list package --vulnerable` is clean and runs in CI.
- [ ] CORS lists specific origins.
- [ ] Swagger and diagnostics disabled or protected.

## Quick recap

- Broken object level authorization is the top API risk. Scope every query by the current user.
- Return `404` instead of `403` when the existence of a record is private.
- Trust only claims from a verified token, never headers, URLs or body fields.
- Use request DTOs so over posting has nowhere to land.
- No secrets in the repository, and rotate anything that ever was.
- Enforce HTTPS, add security headers, and remove the `Server` header.
- Rate limit everything, and rate limit authentication much harder.
- Cap body size, header size and page size.
- `FromSql` with interpolation is safe. `FromSqlRaw` with interpolation is not.
- Generic errors in production, with a trace id for correlation.
- Scan dependencies for known vulnerabilities in CI.

<code id="code-content" class="language-csharp">
// Program.cs - the security hardening that belongs in every production API.
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
// Do not advertise the server software or its version
builder.WebHost.ConfigureKestrel(options =&gt;
{
    options.AddServerHeader = false;
    options.Limits.MaxRequestBodySize         = 10 * 1024 * 1024;   // 10 MB
    options.Limits.MaxRequestHeadersTotalSize = 32 * 1024;
    options.Limits.RequestHeadersTimeout      = TimeSpan.FromSeconds(30);
});
builder.Services.AddControllers();
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddHsts(o =&gt; { o.MaxAge = TimeSpan.FromDays(365); o.IncludeSubDomains = true; });
// Secure by default: an endpoint with no attribute still needs a token
builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization(options =&gt;
{
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser().Build();
});
// Authentication endpoints need a far tighter limit than the rest of the API
builder.Services.AddRateLimiter(options =&gt;
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("api",  l =&gt; { l.PermitLimit = 100; l.Window = TimeSpan.FromMinutes(1); });
    options.AddFixedWindowLimiter("auth", l =&gt; { l.PermitLimit = 5;   l.Window = TimeSpan.FromMinutes(15); });
});
var app = builder.Build();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/error");     // generic body plus a trace id, never a stack trace
    app.UseHsts();
}
app.UseHttpsRedirection();
// Headers that close off whole categories of attack
app.Use(async (context, next) =&gt;
{
    IHeaderDictionary h = context.Response.Headers;
    h["X-Content-Type-Options"]  = "nosniff";                        // no MIME sniffing
    h["X-Frame-Options"]         = "DENY";                           // no clickjacking
    h["Referrer-Policy"]         = "no-referrer";
    h["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
    h.Remove("Server");
    h.Remove("X-Powered-By");
    await next();
});
app.UseRouting();
app.UseCors();                 // specific origins only, never AllowAnyOrigin with credentials
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
app.Run();
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("api")]
public class OrdersController : ControllerBase
{
    private static readonly HashSet&lt;string&gt; Sortable = new() { "total", "placedAt" };
    private readonly AppDbContext db;
    public OrdersController(AppDbContext db) =&gt; this.db = db;
    // THE most important pattern in this topic. [Authorize] alone would let any
    // logged in user read any order simply by changing the id.
    [HttpGet("{id:int}")]
    public async Task&lt;ActionResult&lt;OrderResponse&gt;&gt; GetById(int id, CancellationToken ct)
    {
        string userId = User.FindFirst("sub")!.Value;     // from a VERIFIED token only
        OrderResponse? order = await db.Orders
            .Where(o =&gt; o.Id == id &amp;&amp; o.CustomerId == userId)   // scoped in the query itself
            .Select(o =&gt; new OrderResponse(o.Id, o.Total, o.PlacedAt))
            .FirstOrDefaultAsync(ct);
        // 404, not 403: a 403 would confirm that order 5001 exists
        return order is null ? NotFound() : order;
    }
    [HttpGet]
    public async Task&lt;ActionResult&lt;List&lt;OrderResponse&gt;&gt;&gt; Search(
        [FromQuery] string? sortBy, [FromQuery] int page = 1, [FromQuery] int size = 20,
        CancellationToken ct = default)
    {
        string userId = User.FindFirst("sub")!.Value;
        size = Math.Clamp(size, 1, 100);                  // a client asking for a million gets 100
        // A column name cannot be a parameter, so an allow list is the only safe option
        string sort = sortBy is not null &amp;&amp; Sortable.Contains(sortBy) ? sortBy : "placedAt";
        IQueryable&lt;Order&gt; query = db.Orders.Where(o =&gt; o.CustomerId == userId);
        query = sort == "total" ? query.OrderBy(o =&gt; o.Total) : query.OrderByDescending(o =&gt; o.PlacedAt);
        return await query.Skip((page - 1) * size).Take(size)
            .Select(o =&gt; new OrderResponse(o.Id, o.Total, o.PlacedAt))
            .ToListAsync(ct);
    }
    [HttpGet("search-raw")]
    public async Task&lt;ActionResult&lt;List&lt;Order&gt;&gt;&gt; SearchRaw([FromQuery] string term, CancellationToken ct)
    {
        // VULNERABLE, do not do this. FromSqlRaw with interpolation concatenates:
        //   return await db.Orders.FromSqlRaw($"SELECT * FROM Orders WHERE Note LIKE '%{term}%'")
        //
        // SAFE. FromSql (no Raw) turns the interpolation into real parameters.
        // The names are close enough to be dangerous, so check every use.
        string pattern = $"%{term}%";
        return await db.Orders.FromSql($"SELECT * FROM Orders WHERE Note LIKE {pattern}")
                              .ToListAsync(ct);
    }
    // Accepts a DTO, never the entity. A client sending {"customerId":"999"} has
    // nowhere to put it, so over posting is impossible by construction.
    [HttpPost]
    public async Task&lt;ActionResult&lt;OrderResponse&gt;&gt; Create([FromBody] CreateOrderRequest request, CancellationToken ct)
    {
        var order = new Order
        {
            CustomerId = User.FindFirst("sub")!.Value,    // the server decides, not the client
            Total      = request.Total,
            Note       = request.Note,
            PlacedAt   = DateTime.UtcNow
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = order.Id },
            new OrderResponse(order.Id, order.Total, order.PlacedAt));
    }
}
public record CreateOrderRequest(
    [property: System.ComponentModel.DataAnnotations.Range(0.01, 100000)] decimal Total,
    [property: System.ComponentModel.DataAnnotations.StringLength(500)]   string? Note);
public record OrderResponse(int Id, decimal Total, DateTime PlacedAt);
public class Order
{
    public int Id { get; set; }
    public string CustomerId { get; set; } = "";
    public decimal Total { get; set; }
    public string? Note { get; set; }
    public DateTime PlacedAt { get; set; }
}
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Order&gt; Orders =&gt; Set&lt;Order&gt;();
}
</code></pre>
