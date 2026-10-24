---
publishDate: 2026-09-22T16:40
title: RESTful API Design Best Practices
slug: restful-api-design-best-practices
metadescription: Practical rules for designing an API people enjoy using, covering resource naming, nesting, actions that are not CRUD, idempotency, dates, nulls and consistency.
updateDate: 2026-09-07T16:40
author: ['bishal-biswas']
level: 3
tags: ['api-design', 'rest', 'best-practices']
course: dotnet-webapi
---

## Name resources, not actions

The URL identifies a **thing**. The HTTP method says what you are doing to it.

```text
Bad                              Good
GET  /api/getAllBooks            GET    /api/books
POST /api/createBook             POST   /api/books
POST /api/updateBook/5           PUT    /api/books/5
POST /api/deleteBook/5           DELETE /api/books/5
GET  /api/getBooksByAuthor/3     GET    /api/books?authorId=3
```

The good column has four URLs for four operations, and you could have guessed all of them.

## Plural nouns, lowercase, hyphens

```text
/api/books                       plural, even for a single item below it
/api/books/5
/api/purchase-orders             hyphens, not camelCase or underscores
```

Three conventions worth following simply because they are conventions:

**Plural.** `/api/books/5` reads as "book 5 in the books collection". Mixing `/api/book/5` and `/api/books` means clients have to remember which is which.

**Lowercase.** Paths are case sensitive in the spec. Lowercase removes the question.

**Hyphens.** `/api/purchase-orders` is more readable than `/api/purchaseorders`, and search engines treat hyphens as word separators.

## Nest only one level

Nesting shows ownership:

```text
GET    /api/books/5/reviews          reviews of book 5
POST   /api/books/5/reviews          add a review to book 5
```

Beyond one level it gets unusable:

```text
GET /api/authors/3/books/5/reviews/9/comments/2      too much
```

Once you have the review id, you do not need the path to it. Address it directly:

```text
GET /api/reviews/9/comments/2
```

Rule of thumb: nest to show a relationship on the collection, then let each resource have its own top level URL.

## Filter with the query string, not the path

```text
Bad                                  Good
/api/books/year/2008                 /api/books?year=2008
/api/books/author/3/year/2008        /api/books?authorId=3&year=2008
/api/books/sorted-by-price           /api/books?sort=price
```

The path identifies a resource. The query string narrows a collection. Keeping that split means one endpoint handles every combination of filters instead of one endpoint per combination.

## Actions that are not CRUD

Not everything is create, read, update or delete. Publishing an article, cancelling an order, resetting a password.

Three legitimate approaches.

**Model the state as a field and `PATCH` it.** The most RESTful:

```http
PATCH /api/articles/5
{ "status": "published" }
```

**Treat the action as a sub resource and `POST` to it.** The most practical, and very common:

```http
POST /api/articles/5/publish
POST /api/orders/9/cancel
POST /api/users/3/password-reset
```

**Create a resource representing the action**, when the action itself has a lifecycle:

```http
POST /api/refunds
{ "orderId": 9, "amount": 25.00, "reason": "damaged" }
```

The second is what most APIs do, and purists dislike it. It is fine. Consistency across your API matters more than winning the argument.

## Be consistent above all

One inconsistency costs more than any single design flaw, because it forces clients to special case.

Pick one answer to each of these and never deviate:

- Are collections wrapped in an envelope or returned as a bare array?
- Is paging in the body or in headers?
- Do you use `404` or `403` for a record the caller may not see?
- Are dates always UTC ISO 8601?
- Is it `createdAt` or `created_at` or `CreatedAt`?
- Do errors always use problem details?
- Do you return the created object on `POST`, or just a `Location` header?

Write the answers down. A short conventions document is worth more than a long style guide.

## Dates and times

Always **UTC**, always **ISO 8601**:

```json
{ "createdAt": "2026-09-07T16:40:00Z" }
```

The `Z` matters. Without it, a client cannot know the timezone and will guess wrong.

Never send a local time and never send a format like `07/09/2026`, which means two different days depending on where the reader lives.

Use `DateOnly` when there is no time component:

```json
{ "publishedOn": "2008-08-01" }
```

Accept UTC on input too, and convert to local time only for display, in the client.

## Nulls and empty collections

**Return an empty array, not null**, for a collection with no items:

```json
{ "tags": [] }        // good, the client can loop
{ "tags": null }      // bad, the client must null check first
```

**Be consistent about omitted fields.** Either always send a null field or never send it. Switching between the two means clients cannot rely on either:

```csharp
options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
```

**An empty search result is `200` with `[]`, not `404`.** The collection exists and contains nothing matching.

## Status codes that tell the truth

Covered in detail earlier, and worth repeating as design advice:

- `200` for a successful read or an update that returns the object
- `201` plus a `Location` header for a create
- `204` for a delete or a silent update
- `400` for malformed input, `422` for input that parses but breaks a rule
- `401` for no or bad credentials, `403` for valid credentials without permission
- `404` for a resource that does not exist
- `409` for a duplicate or a state conflict
- `429` for a rate limit, with `Retry-After`

Never return `200` with `{"success": false}`. Clients then have to parse the body to know whether it worked, and every HTTP tool, cache and monitor is misled.

## Idempotency for creates

`PUT` and `DELETE` are naturally idempotent. `POST` is not, and a flaky network means a client will retry one.

Let the client supply a key:

```http
POST /api/orders
Idempotency-Key: 8f14e45f-ceea-467a-9c1e-4e2f6b2d0c3a

{ "items": [ ... ] }
```

Store the key with the created resource. If the same key arrives again, return the original result rather than creating a second order:

```csharp
Order? existing = await db.Orders
    .FirstOrDefaultAsync(o => o.IdempotencyKey == key, ct);

if (existing is not null)
    return Ok(ToResponse(existing));      // same answer, no duplicate
```

Any endpoint that costs money should have this.

## Return the created resource

After a `POST`, send back the object with its server assigned fields filled in:

```http
HTTP/1.1 201 Created
Location: /api/books/7

{ "id": 7, "title": "Refactoring", "createdAt": "2026-09-07T16:40:00Z" }
```

The client needs the id, and it saves an immediate `GET`.

## Support partial responses when it helps

For a large resource with mobile clients, letting them ask for less is a real win:

```text
GET /api/books/5?fields=id,title,price
```

Do not build this speculatively. Add it when a client actually needs it, and validate the field list against an allow list.

## Document the contract, not the implementation

Your documentation should describe what a client can rely on. Not the database, not the framework.

Say: "Returns up to 100 books. Use `page` and `pageSize`. Sortable by `title`, `year` or `price`."

Do not say: "Queries the Books table using EF Core with AsNoTracking."

## Design for the client

The most useful test. Before building an endpoint, write the client code that would call it:

```javascript
const books = await api.books.search({ author: 'martin', year: 2008, page: 1 });
```

If that reads naturally, the design is good. If you find yourself writing three calls and stitching results together, the API is shaped for your database rather than for the people using it.

A related habit: when a screen always needs a book plus its author plus its review count, consider returning them together rather than making the client fetch three times. Purity is worth less than a fast screen.

## Quick recap

- URLs name resources. HTTP methods are the verbs.
- Use plural, lowercase, hyphenated nouns.
- Nest one level to show ownership, then give each resource a top level URL.
- Filters go in the query string, never in the path.
- For actions that are not CRUD, `PATCH` a state field or `POST` to a sub resource. Be consistent.
- Consistency beats every individual design choice. Write your conventions down.
- Dates are UTC ISO 8601 with a `Z`. Use `DateOnly` when there is no time.
- Return `[]` rather than null, and `200` with `[]` rather than `404` for an empty search.
- Never return `200` with a success flag of false.
- Support an `Idempotency-Key` on any `POST` that costs money.
- Return the created object with its `Location` header.
- Write the client call first. If it reads awkwardly, redesign the endpoint.

<code id="code-content" class="language-csharp">
// A resource designed by these rules, with the reasoning kept in the comments.
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers().AddJsonOptions(o =&gt;
{
    o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    // Pick one and never change it: either always send nulls or never send them
    o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
var app = builder.Build();
app.MapControllers();
app.Run();
// /api/purchase-orders : plural, lowercase, hyphenated
[ApiController]
[Route("api/purchase-orders")]
[Produces("application/json")]
public class PurchaseOrdersController : ControllerBase
{
    private readonly AppDbContext db;
    public PurchaseOrdersController(AppDbContext db) =&gt; this.db = db;
    // Filters live in the QUERY STRING, so one endpoint serves every combination.
    // Not /api/purchase-orders/status/pending/supplier/3
    [HttpGet]
    public async Task&lt;ActionResult&lt;PagedResult&lt;OrderSummary&gt;&gt;&gt; Search(
        [FromQuery] OrderStatus? status, [FromQuery] int? supplierId,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        IQueryable&lt;PurchaseOrder&gt; query = db.PurchaseOrders.AsNoTracking();
        if (status is not null)     query = query.Where(o =&gt; o.Status == status);
        if (supplierId is not null) query = query.Where(o =&gt; o.SupplierId == supplierId);
        int total = await query.CountAsync(ct);
        List&lt;OrderSummary&gt; items = await query
            .OrderByDescending(o =&gt; o.PlacedAt).ThenBy(o =&gt; o.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(o =&gt; new OrderSummary(o.Id, o.Reference, o.Status, o.Total, o.PlacedAt))
            .ToListAsync(ct);
        // No matches is 200 with an empty array. The collection exists; it is just empty.
        return new PagedResult&lt;OrderSummary&gt;(items, page, pageSize, total);
    }
    [HttpGet("{id:int}", Name = nameof(GetById))]
    public async Task&lt;ActionResult&lt;OrderDetail&gt;&gt; GetById(int id, CancellationToken ct)
    {
        OrderDetail? order = await db.PurchaseOrders
            .Where(o =&gt; o.Id == id)
            .Select(o =&gt; new OrderDetail(
                o.Id, o.Reference, o.Status, o.Total, o.PlacedAt,
                // An empty array, never null. The client can loop without a null check.
                o.Lines.Select(l =&gt; new LineItem(l.Sku, l.Quantity, l.UnitPrice)).ToList()))
            .FirstOrDefaultAsync(ct);
        return order is null ? NotFound() : order;
    }
    // One level of nesting shows ownership. Deeper than this and you should
    // address the child directly at /api/order-lines/{id}.
    [HttpGet("{id:int}/lines")]
    public async Task&lt;ActionResult&lt;List&lt;LineItem&gt;&gt;&gt; GetLines(int id, CancellationToken ct) =&gt;
        await db.OrderLines.Where(l =&gt; l.PurchaseOrderId == id)
            .Select(l =&gt; new LineItem(l.Sku, l.Quantity, l.UnitPrice))
            .ToListAsync(ct);
    // POST with an Idempotency-Key. A retried request after a dropped connection
    // returns the ORIGINAL order instead of creating a second one.
    // Any endpoint that costs money should do this.
    [HttpPost]
    public async Task&lt;ActionResult&lt;OrderDetail&gt;&gt; Create(
        [FromBody] CreateOrderRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            PurchaseOrder? existing = await db.PurchaseOrders
                .FirstOrDefaultAsync(o =&gt; o.IdempotencyKey == idempotencyKey, ct);
            if (existing is not null)
                return Ok(ToDetail(existing));      // same answer, no duplicate
        }
        var order = new PurchaseOrder
        {
            Reference       = $"PO-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}",
            SupplierId      = request.SupplierId,
            Status          = OrderStatus.Draft,
            PlacedAt        = DateTime.UtcNow,       // UTC, always
            IdempotencyKey  = idempotencyKey,
            Lines = request.Lines
                .Select(l =&gt; new OrderLine { Sku = l.Sku, Quantity = l.Quantity, UnitPrice = l.UnitPrice })
                .ToList()
        };
        order.Total = order.Lines.Sum(l =&gt; l.Quantity * l.UnitPrice);
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync(ct);
        // 201, a Location header, and the created object so the client has the id
        return CreatedAtRoute(nameof(GetById), new { id = order.Id }, ToDetail(order));
    }
    // An action that is not CRUD, option A: PATCH the state field. The most RESTful.
    [HttpPatch("{id:int}")]
    public async Task&lt;IActionResult&gt; Patch(int id, [FromBody] PatchOrderRequest patch, CancellationToken ct)
    {
        PurchaseOrder? order = await db.PurchaseOrders.FindAsync(new object[] { id }, ct);
        if (order is null) return NotFound();
        if (patch.Status is not null) order.Status = patch.Status.Value;   // null means leave alone
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
    // Option B: POST to a sub resource. Less pure, more practical, very common.
    // Pick one style and use it everywhere.
    [HttpPost("{id:int}/cancel")]
    public async Task&lt;IActionResult&gt; Cancel(int id, [FromBody] CancelRequest request, CancellationToken ct)
    {
        PurchaseOrder? order = await db.PurchaseOrders.FindAsync(new object[] { id }, ct);
        if (order is null) return NotFound();
        if (order.Status == OrderStatus.Shipped)
            // 409, not 400: the request is valid, the current STATE forbids it
            return Conflict(new ProblemDetails
            {
                Type   = "https://api.example.com/errors/order-already-shipped",
                Title  = "Order already shipped",
                Status = StatusCodes.Status409Conflict,
                Detail = $"Order {order.Reference} shipped on {order.ShippedOn:yyyy-MM-dd} and cannot be cancelled."
            });
        order.Status = OrderStatus.Cancelled;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
    [HttpDelete("{id:int}")]
    public async Task&lt;IActionResult&gt; Delete(int id, CancellationToken ct)
    {
        PurchaseOrder? order = await db.PurchaseOrders.FindAsync(new object[] { id }, ct);
        if (order is null) return NotFound();
        db.PurchaseOrders.Remove(order);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
    private static OrderDetail ToDetail(PurchaseOrder o) =&gt; new(
        o.Id, o.Reference, o.Status, o.Total, o.PlacedAt,
        o.Lines.Select(l =&gt; new LineItem(l.Sku, l.Quantity, l.UnitPrice)).ToList());
}
public enum OrderStatus { Draft, Submitted, Shipped, Cancelled }
// Dates are UTC DateTime and serialize as "2026-09-07T16:40:00Z".
// A date with no time uses DateOnly and serializes as "2026-09-07".
public record OrderSummary(int Id, string Reference, OrderStatus Status, decimal Total, DateTime PlacedAt);
public record OrderDetail(int Id, string Reference, OrderStatus Status, decimal Total,
                          DateTime PlacedAt, List&lt;LineItem&gt; Lines);
public record LineItem(string Sku, int Quantity, decimal UnitPrice);
public record CreateOrderRequest(int SupplierId, List&lt;LineItem&gt; Lines);
public record PatchOrderRequest(OrderStatus? Status);
public record CancelRequest(string? Reason);
public record PagedResult&lt;T&gt;(IReadOnlyList&lt;T&gt; Items, int Page, int PageSize, int TotalCount);
public class PurchaseOrder
{
    public int Id { get; set; }
    public string Reference { get; set; } = "";
    public int SupplierId { get; set; }
    public OrderStatus Status { get; set; }
    public decimal Total { get; set; }
    public DateTime PlacedAt { get; set; }
    public DateOnly? ShippedOn { get; set; }
    public string? IdempotencyKey { get; set; }
    public List&lt;OrderLine&gt; Lines { get; set; } = new();
}
public class OrderLine
{
    public int Id { get; set; }
    public int PurchaseOrderId { get; set; }
    public string Sku { get; set; } = "";
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;PurchaseOrder&gt; PurchaseOrders =&gt; Set&lt;PurchaseOrder&gt;();
    public DbSet&lt;OrderLine&gt; OrderLines =&gt; Set&lt;OrderLine&gt;();
    protected override void OnModelCreating(ModelBuilder b) =&gt;
        b.Entity&lt;PurchaseOrder&gt;().HasIndex(o =&gt; o.IdempotencyKey).IsUnique();
}
</code></pre>
