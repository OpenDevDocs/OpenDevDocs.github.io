---
publishDate: 2026-09-13T13:30
title: Service Layer and Business Logic
slug: service-layer-and-business-logic
metadescription: Move business rules out of controllers into a service layer, return results instead of throwing for expected failures, and keep the HTTP layer thin and testable.
updateDate: 2026-09-07T13:30
author: ['bishal-biswas']
level: 2
tags: ['architecture', 'services', 'design']
course: dotnet-webapi
---

## The fat controller problem

Here is a controller doing everything. It works, and it is a maintenance problem:

```csharp
[HttpPost]
public async Task<IActionResult> PlaceOrder(PlaceOrderRequest request)
{
    if (await db.Orders.AnyAsync(o => o.IdempotencyKey == request.Key))
        return Conflict(new { error = "Duplicate order." });

    var customer = await db.Customers.FindAsync(request.CustomerId);
    if (customer is null) return NotFound();

    if (customer.IsBlocked) return Forbid();

    decimal total = 0;
    foreach (var line in request.Lines)
    {
        var product = await db.Products.FindAsync(line.ProductId);
        if (product is null) return BadRequest($"Unknown product {line.ProductId}");
        if (product.Stock < line.Quantity) return Conflict($"Not enough {product.Name}");

        total += product.Price * line.Quantity;
        product.Stock -= line.Quantity;
    }

    if (total > 500) total *= 0.95m;
    if (customer.IsPremium) total *= 0.9m;

    var order = new Order { CustomerId = customer.Id, Total = total };
    db.Orders.Add(order);
    await db.SaveChangesAsync();

    await emailSender.SendAsync(customer.Email, $"Order {order.Id} confirmed");

    return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
}
```

Four problems, all of which get worse over time.

**You cannot test the rules without HTTP.** The discount logic is real business behaviour, and reaching it requires a web request.

**You cannot reuse it.** When a background job or an admin endpoint needs to place an order, you copy the method.

**Two concerns are tangled.** Status codes and pricing rules sit in the same fifty lines.

**It only grows.** Every new rule lands here, because that is where the last one went.

## What a service layer is

A **service** is a class that owns the business rules for one area. It knows nothing about HTTP. No `IActionResult`, no `HttpContext`, no status codes.

```csharp
public interface IOrderService
{
    Task<Result<OrderResponse>> PlaceOrderAsync(PlaceOrderCommand command, CancellationToken ct = default);
    Task<OrderResponse?> GetByIdAsync(int id, CancellationToken ct = default);
}
```

The controller becomes a translator:

```csharp
[HttpPost]
public async Task<IActionResult> PlaceOrder(PlaceOrderRequest request, CancellationToken ct)
{
    Result<OrderResponse> result = await orderService.PlaceOrderAsync(request.ToCommand(), ct);

    return result.Status switch
    {
        ResultStatus.Success   => CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value),
        ResultStatus.NotFound  => NotFound(new { error = result.Error }),
        ResultStatus.Conflict  => Conflict(new { error = result.Error }),
        ResultStatus.Forbidden => Forbid(),
        _                      => BadRequest(new { error = result.Error })
    };
}
```

Read the request, call the service, map the outcome to a status code. That is the entire job of a controller.

## Do not throw for expected failures

"Product out of stock" is not exceptional. It happens every day. Exceptions are for the unexpected: a database that is down, a bug.

Using exceptions for ordinary outcomes has real costs. They are slow, they hide the possible outcomes from the method signature, and they turn `catch` blocks into control flow.

A **result type** puts the outcomes in the signature where the compiler and the reader can see them:

```csharp
public enum ResultStatus { Success, NotFound, Conflict, Invalid, Forbidden }

public class Result<T>
{
    public ResultStatus Status { get; private init; }
    public T? Value { get; private init; }
    public string? Error { get; private init; }

    public bool IsSuccess => Status == ResultStatus.Success;

    public static Result<T> Success(T value) => new() { Status = ResultStatus.Success, Value = value };
    public static Result<T> NotFound(string error) => new() { Status = ResultStatus.NotFound, Error = error };
    public static Result<T> Conflict(string error) => new() { Status = ResultStatus.Conflict, Error = error };
    public static Result<T> Invalid(string error) => new() { Status = ResultStatus.Invalid, Error = error };
    public static Result<T> Forbidden(string error) => new() { Status = ResultStatus.Forbidden, Error = error };
}
```

Note that `ResultStatus` is not a list of HTTP codes. It is a list of **outcomes**. The controller decides that `NotFound` means `404`. A background job might decide it means "log and skip".

Keep throwing for genuine failures. A missing connection string or a null reference should reach your global exception handler and become a `500`.

## Commands, not request DTOs

A small but useful separation. The request DTO is shaped by HTTP and JSON. The command is shaped by the operation.

```csharp
// The API contract. Changes when clients need it to.
public record PlaceOrderRequest(int CustomerId, List<OrderLineRequest> Lines, string IdempotencyKey);

// What the service needs. Changes when the business does.
public record PlaceOrderCommand(int CustomerId, IReadOnlyList<OrderLine> Lines, string IdempotencyKey);
```

For a small API this is extra ceremony and passing the DTO straight through is fine. It becomes worth doing when the same operation is called from several places, because each caller then builds the same command from its own input.

## Services should be small

One service per area, not one service for the application. `OrderService`, `InventoryService`, `PricingService`, not `BusinessService`.

Services can call other services, so a rule that stands alone becomes its own class:

```csharp
public interface IPricingService
{
    decimal CalculateTotal(IEnumerable<OrderLine> lines, Customer customer);
}
```

Now the pricing rules are one small class you can unit test with no database, no HTTP and no mocking framework at all.

## Where the transaction goes

The service owns the unit of work. It decides what commits together.

```csharp
public async Task<Result<OrderResponse>> PlaceOrderAsync(PlaceOrderCommand command, CancellationToken ct)
{
    // validate, build the order, reduce the stock ...

    await db.SaveChangesAsync(ct);      // one commit for everything above
    return Result<OrderResponse>.Success(response);
}
```

A controller that calls two services and expects them to be atomic is a design smell. If two operations must succeed together, they belong behind one service method.

## Side effects after the commit

The email in the original controller is a real bug hiding in plain sight. If sending fails, the order is already saved and the client gets a `500` for an order that exists.

Two ways to fix it. Either treat the send as best effort and swallow its failure:

```csharp
await db.SaveChangesAsync(ct);

try
{
    await emailSender.SendAsync(customer.Email, $"Order {order.Id} confirmed", ct);
}
catch (Exception ex)
{
    logger.LogError(ex, "Confirmation email failed for order {OrderId}", order.Id);
    // the order is still valid, so do not fail the request
}
```

Or, better, queue it and let a background service send it. That gets its own topic later.

## What goes where

A quick map to settle the usual arguments.

**Controller:** read the request, call one service, map the result to a status code. No `if` statements about business rules, no database access.

**Service:** business rules, orchestration across repositories, transaction boundaries, calls to other services.

**Repository or DbContext:** queries and persistence only. No business rules.

**Entity:** the data, and rules that are genuinely about that single object, such as a method that keeps two fields consistent.

**DTO:** the shape crossing the API boundary. No behaviour.

## Do not build layers you do not need

Being honest about this matters. For a genuinely simple endpoint, a service adds a file and a hop:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<BookResponse>> GetById(int id, CancellationToken ct)
{
    BookResponse? dto = await db.Books
        .Where(b => b.Id == id)
        .Select(b => new BookResponse(b.Id, b.Title, b.Price))
        .FirstOrDefaultAsync(ct);

    return dto is null ? NotFound() : dto;
}
```

That is fine as it stands. There is no business logic to extract.

Add a service when there **is** logic: rules, several steps, a decision, or something worth unit testing. The signal is not "this is a controller action", it is "this action does more than translate HTTP".

## Quick recap

- A controller reads the request, calls a service, and maps the outcome to a status code.
- A service owns business rules and knows nothing about HTTP.
- Return a result type for expected failures. Keep exceptions for genuinely unexpected ones.
- Result statuses describe outcomes, not HTTP codes. The controller does the mapping.
- Keep services small and focused. `PricingService` beats a catch all `BusinessService`.
- The service owns the transaction. Two services that must be atomic belong behind one method.
- Do side effects such as email after the commit, and do not fail the request when they fail.
- Skip the service layer for endpoints that genuinely have no logic to hold.

<code id="code-content" class="language-csharp">
// The fat controller from the start of this topic, refactored.
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
// ---------- A result type: expected outcomes live in the signature, not in exceptions
public enum ResultStatus { Success, NotFound, Conflict, Invalid, Forbidden }
public class Result&lt;T&gt;
{
    public ResultStatus Status { get; private init; }
    public T? Value { get; private init; }
    public string? Error { get; private init; }
    public bool IsSuccess =&gt; Status == ResultStatus.Success;
    public static Result&lt;T&gt; Success(T value)     =&gt; new() { Status = ResultStatus.Success,   Value = value };
    public static Result&lt;T&gt; NotFound(string e)   =&gt; new() { Status = ResultStatus.NotFound,  Error = e };
    public static Result&lt;T&gt; Conflict(string e)   =&gt; new() { Status = ResultStatus.Conflict,  Error = e };
    public static Result&lt;T&gt; Invalid(string e)    =&gt; new() { Status = ResultStatus.Invalid,   Error = e };
    public static Result&lt;T&gt; Forbidden(string e)  =&gt; new() { Status = ResultStatus.Forbidden, Error = e };
}
// ---------- The controller: read, call, map. Nothing else.
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService orders;
    public OrdersController(IOrderService orders) =&gt; this.orders = orders;
    [HttpGet("{id:int}")]
    public async Task&lt;ActionResult&lt;OrderResponse&gt;&gt; GetById(int id, CancellationToken ct) =&gt;
        await orders.GetByIdAsync(id, ct) is OrderResponse dto ? dto : NotFound();
    [HttpPost]
    public async Task&lt;IActionResult&gt; PlaceOrder(PlaceOrderRequest request, CancellationToken ct)
    {
        Result&lt;OrderResponse&gt; result = await orders.PlaceOrderAsync(
            new PlaceOrderCommand(request.CustomerId, request.Lines, request.IdempotencyKey), ct);
        // The ONLY place that knows about HTTP status codes
        return result.Status switch
        {
            ResultStatus.Success   =&gt; CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value),
            ResultStatus.NotFound  =&gt; NotFound(new { error = result.Error }),
            ResultStatus.Conflict  =&gt; Conflict(new { error = result.Error }),
            ResultStatus.Forbidden =&gt; Forbid(),
            _                      =&gt; BadRequest(new { error = result.Error })
        };
    }
}
// ---------- The service: all the rules, no HTTP anywhere in sight
public interface IOrderService
{
    Task&lt;OrderResponse?&gt; GetByIdAsync(int id, CancellationToken ct = default);
    Task&lt;Result&lt;OrderResponse&gt;&gt; PlaceOrderAsync(PlaceOrderCommand command, CancellationToken ct = default);
}
public class OrderService : IOrderService
{
    private readonly AppDbContext db;
    private readonly IPricingService pricing;
    private readonly IEmailSender email;
    private readonly ILogger&lt;OrderService&gt; logger;
    public OrderService(AppDbContext db, IPricingService pricing,
                        IEmailSender email, ILogger&lt;OrderService&gt; logger)
        =&gt; (this.db, this.pricing, this.email, this.logger) = (db, pricing, email, logger);
    public Task&lt;OrderResponse?&gt; GetByIdAsync(int id, CancellationToken ct = default) =&gt;
        db.Orders.Where(o =&gt; o.Id == id)
                 .Select(o =&gt; new OrderResponse(o.Id, o.CustomerId, o.Total))
                 .FirstOrDefaultAsync(ct);
    public async Task&lt;Result&lt;OrderResponse&gt;&gt; PlaceOrderAsync(PlaceOrderCommand command, CancellationToken ct = default)
    {
        if (await db.Orders.AnyAsync(o =&gt; o.IdempotencyKey == command.IdempotencyKey, ct))
            return Result&lt;OrderResponse&gt;.Conflict("This order was already placed.");
        Customer? customer = await db.Customers.FindAsync(new object[] { command.CustomerId }, ct);
        if (customer is null)  return Result&lt;OrderResponse&gt;.NotFound($"Customer {command.CustomerId} not found.");
        if (customer.IsBlocked) return Result&lt;OrderResponse&gt;.Forbidden("This account is blocked.");
        var lines = new List&lt;OrderLine&gt;();
        foreach (OrderLineRequest requested in command.Lines)
        {
            Product? product = await db.Products.FindAsync(new object[] { requested.ProductId }, ct);
            if (product is null)
                return Result&lt;OrderResponse&gt;.Invalid($"Unknown product {requested.ProductId}.");
            if (product.Stock &lt; requested.Quantity)
                return Result&lt;OrderResponse&gt;.Conflict($"Only {product.Stock} of {product.Name} left.");
            product.Stock -= requested.Quantity;
            lines.Add(new OrderLine(product.Id, requested.Quantity, product.Price));
        }
        // Pricing is its own service: a small class, unit testable with no database
        decimal total = pricing.CalculateTotal(lines, customer);
        var order = new Order
        {
            CustomerId = customer.Id, Total = total,
            IdempotencyKey = command.IdempotencyKey, PlacedAt = DateTime.UtcNow
        };
        db.Orders.Add(order);
        // One commit: the order and every stock reduction, together or not at all
        await db.SaveChangesAsync(ct);
        // Side effects go AFTER the commit, and must not fail a request that already succeeded
        try
        {
            await email.SendAsync(customer.Email, $"Order {order.Id} confirmed", ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Confirmation email failed for order {OrderId}", order.Id);
        }
        return Result&lt;OrderResponse&gt;.Success(new OrderResponse(order.Id, order.CustomerId, order.Total));
    }
}
// ---------- One rule, one small class. No database, no HTTP, trivial to test.
public interface IPricingService { decimal CalculateTotal(IEnumerable&lt;OrderLine&gt; lines, Customer customer); }
public class PricingService : IPricingService
{
    public decimal CalculateTotal(IEnumerable&lt;OrderLine&gt; lines, Customer customer)
    {
        decimal total = lines.Sum(l =&gt; l.UnitPrice * l.Quantity);
        if (total &gt; 500)         total *= 0.95m;   // bulk discount
        if (customer.IsPremium)  total *= 0.90m;   // membership discount
        return Math.Round(total, 2);
    }
}
public record PlaceOrderRequest(int CustomerId, List&lt;OrderLineRequest&gt; Lines, string IdempotencyKey);
public record PlaceOrderCommand(int CustomerId, IReadOnlyList&lt;OrderLineRequest&gt; Lines, string IdempotencyKey);
public record OrderLineRequest(int ProductId, int Quantity);
public record OrderLine(int ProductId, int Quantity, decimal UnitPrice);
public record OrderResponse(int Id, int CustomerId, decimal Total);
public class Order    { public int Id { get; set; } public int CustomerId { get; set; }
                        public decimal Total { get; set; } public string IdempotencyKey { get; set; } = "";
                        public DateTime PlacedAt { get; set; } }
public class Customer { public int Id { get; set; } public string Email { get; set; } = "";
                        public bool IsBlocked { get; set; } public bool IsPremium { get; set; } }
public class Product  { public int Id { get; set; } public string Name { get; set; } = "";
                        public decimal Price { get; set; } public int Stock { get; set; } }
public interface IEmailSender { Task SendAsync(string to, string body, CancellationToken ct = default); }
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Order&gt; Orders =&gt; Set&lt;Order&gt;();
    public DbSet&lt;Customer&gt; Customers =&gt; Set&lt;Customer&gt;();
    public DbSet&lt;Product&gt; Products =&gt; Set&lt;Product&gt;();
}
</code></pre>
