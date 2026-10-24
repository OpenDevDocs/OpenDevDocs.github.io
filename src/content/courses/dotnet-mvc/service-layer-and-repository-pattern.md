---
publishDate: 2026-08-20T12:20
title: Service Layer and Repository Pattern
slug: service-layer-and-repository-pattern
metadescription: Move business logic out of controllers into services, hide data access behind repositories, understand what each layer is responsible for, see when the extra layers are worth it, and keep controllers thin and testable.
updateDate: 2026-09-14T12:20
author: ['bishal-biswas']
level: 3
tags: ['architecture', 'services', 'repository-pattern']
course: dotnet-mvc
---

## The fat controller problem

The CRUD controller from earlier topics talks to the `DbContext` directly. For a small app that is fine. As the app grows, the actions fill up with rules: check stock before adding to the cart, apply a discount, send a confirmation email, log the sale. The controller becomes a few hundred lines of business logic tangled with HTTP details.

Two problems follow. The rules cannot be reused from anywhere else, such as a background job or an API controller. And they cannot be tested without spinning up the whole MVC pipeline.

The fix is to give each concern its own layer.

## The layers

```text
Controller     handles HTTP: binds input, calls a service, picks a view or redirect
Service        holds business rules: what is allowed, what happens, in what order
Repository     handles data access: load, save, query
DbContext      EF Core, the database
```

Each layer only talks to the one below it. The controller never touches the `DbContext`. The service never knows what a view is.

## A service

A service is an ordinary class behind an interface:

```csharp
public interface IOrderService
{
    Task<Order> PlaceOrderAsync(int customerId, IReadOnlyList<CartLine> lines);
}

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orders;
    private readonly IProductRepository _products;
    private readonly IEmailSender _email;

    public OrderService(IOrderRepository orders, IProductRepository products, IEmailSender email)
    {
        _orders = orders;
        _products = products;
        _email = email;
    }

    public async Task<Order> PlaceOrderAsync(int customerId, IReadOnlyList<CartLine> lines)
    {
        if (lines.Count == 0)
        {
            throw new InvalidOperationException("Cannot place an empty order.");
        }

        var order = new Order { CustomerId = customerId, PlacedOn = DateTime.UtcNow };

        foreach (var line in lines)
        {
            var product = await _products.GetAsync(line.ProductId)
                ?? throw new InvalidOperationException($"Product {line.ProductId} not found.");

            if (product.Stock < line.Quantity)
            {
                throw new InvalidOperationException($"Not enough stock for {product.Name}.");
            }

            product.Stock -= line.Quantity;
            order.Lines.Add(new OrderLine { ProductId = product.Id, Quantity = line.Quantity, UnitPrice = product.Price });
        }

        await _orders.AddAsync(order);
        await _orders.SaveAsync();

        await _email.SendAsync("orders@shop.com", "New order", $"Order {order.Id} placed.");

        return order;
    }
}
```

Every rule about placing an order lives here, in one place, with no HTTP in sight. The method can be called from a controller, an API, a test or a scheduled job.

## The thin controller

```csharp
public class CheckoutController : Controller
{
    private readonly IOrderService _orders;
    private readonly ICartService _cart;

    public CheckoutController(IOrderService orders, ICartService cart)
    {
        _orders = orders;
        _cart = cart;
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> PlaceOrder()
    {
        try
        {
            var order = await _orders.PlaceOrderAsync(CurrentCustomerId, _cart.Lines);
            return RedirectToAction("Confirmation", new { id = order.Id });
        }
        catch (InvalidOperationException ex)
        {
            ModelState.AddModelError("", ex.Message);
            return View("Review", _cart);
        }
    }
}
```

The controller binds, delegates, and turns the outcome into a redirect or a view. That is all a controller should do.

## A repository

A repository hides how data is stored. The interface speaks in domain terms:

```csharp
public interface IProductRepository
{
    Task<Product?> GetAsync(int id);
    Task<IReadOnlyList<Product>> GetByCategoryAsync(int categoryId);
    Task<IReadOnlyList<Product>> SearchAsync(string term);
    Task AddAsync(Product product);
    void Remove(Product product);
    Task SaveAsync();
}
```

The EF Core implementation is straightforward:

```csharp
public class EfProductRepository : IProductRepository
{
    private readonly AppDbContext _db;

    public EfProductRepository(AppDbContext db) => _db = db;

    public Task<Product?> GetAsync(int id) =>
        _db.Products.Include(p => p.Category).FirstOrDefaultAsync(p => p.Id == id);

    public async Task<IReadOnlyList<Product>> GetByCategoryAsync(int categoryId) =>
        await _db.Products.Where(p => p.CategoryId == categoryId).OrderBy(p => p.Name).ToListAsync();

    public async Task<IReadOnlyList<Product>> SearchAsync(string term) =>
        await _db.Products.Where(p => p.Name.Contains(term)).ToListAsync();

    public async Task AddAsync(Product product) => await _db.Products.AddAsync(product);

    public void Remove(Product product) => _db.Products.Remove(product);

    public Task SaveAsync() => _db.SaveChangesAsync();
}
```

Query methods are named after what they mean, not how they work. `GetByCategoryAsync` is clearer to a reader than a `Where` clause repeated in three controllers.

## Sharing one save across repositories

If a service uses two repositories and both wrap the same `DbContext` (which they do, because the context is scoped), calling `SaveAsync` on either one saves everything. That is convenient but hidden. Many teams make it explicit with a **unit of work**:

```csharp
public interface IUnitOfWork
{
    IProductRepository Products { get; }
    IOrderRepository Orders { get; }
    Task<int> SaveAsync();
}
```

The service asks for `IUnitOfWork`, touches several repositories, and calls `SaveAsync` once. All changes commit in one transaction.

## Registering the layers

```csharp
builder.Services.AddScoped<IProductRepository, EfProductRepository>();
builder.Services.AddScoped<IOrderRepository, EfOrderRepository>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<ICartService, CartService>();
```

Scoped is right for all of them. They share the request's `DbContext`.

## Is this worth it?

Honest answer: not always. EF Core's `DbContext` is already a unit of work and `DbSet<T>` is already a repository. Wrapping them adds files and can hide useful features like `Include` behind a fixed interface.

The layers earn their keep when:

- Business rules are more than a few lines and are used from more than one place.
- You want to unit test rules without a database.
- The data source might change, or there is more than one.
- Several people work on the app and need clear boundaries.

For a small app with simple CRUD, a service layer that uses the `DbContext` directly, with no repository, is a good middle ground. Add repositories later if the queries get repeated.

## Where exceptions belong

Services throw when a rule is broken. Controllers catch and turn the failure into something the user can see. Avoid returning `bool` or `null` for "it failed" from a service; the reason gets lost. A small result type or a specific exception carries the message.

## Folder layout

```text
Controllers/
Services/
  IOrderService.cs
  OrderService.cs
Repositories/
  IProductRepository.cs
  EfProductRepository.cs
Data/
  AppDbContext.cs
Models/
ViewModels/
```

Larger apps split these into separate projects: a `Web` project with controllers and views, an `Application` project with services, and an `Infrastructure` project with EF Core. The interfaces live where they are used, not where they are implemented, so `Web` and `Application` never reference EF Core.

## Quick recap

- Controllers handle HTTP, services hold business rules, repositories handle data access.
- A service is a class behind an interface with no reference to views or requests, so it can be reused and tested.
- A repository names queries in domain terms and hides EF Core behind an interface.
- A unit of work groups repositories so a service saves once and everything commits together.
- Skip repositories in small apps, but keep controllers thin by moving rules into services as soon as they grow.
- Throw specific exceptions from services and turn them into user messages in controllers.

<code id="code-content" class="language-csharp">
// Repositories/IProductRepository.cs
public interface IProductRepository
{
    Task&lt;Product?&gt; GetAsync(int id);
    Task&lt;IReadOnlyList&lt;Product&gt;&gt; SearchAsync(string? term);
    Task AddAsync(Product product);
    void Remove(Product product);
}

// Repositories/IOrderRepository.cs
public interface IOrderRepository
{
    Task&lt;Order?&gt; GetAsync(int id);
    Task AddAsync(Order order);
}

// Repositories/IUnitOfWork.cs
public interface IUnitOfWork
{
    IProductRepository Products { get; }
    IOrderRepository Orders { get; }
    Task&lt;int&gt; SaveAsync();
}

// Repositories/EfProductRepository.cs
public class EfProductRepository : IProductRepository
{
    private readonly AppDbContext _db;
    public EfProductRepository(AppDbContext db) =&gt; _db = db;

    public Task&lt;Product?&gt; GetAsync(int id) =&gt;
        _db.Products.Include(p =&gt; p.Category).FirstOrDefaultAsync(p =&gt; p.Id == id);

    public async Task&lt;IReadOnlyList&lt;Product&gt;&gt; SearchAsync(string? term)
    {
        var query = _db.Products.AsQueryable();
        if (!string.IsNullOrWhiteSpace(term))
            query = query.Where(p =&gt; p.Name.Contains(term));
        return await query.OrderBy(p =&gt; p.Name).ToListAsync();
    }

    public async Task AddAsync(Product product) =&gt; await _db.Products.AddAsync(product);
    public void Remove(Product product) =&gt; _db.Products.Remove(product);
}

// Repositories/EfUnitOfWork.cs
public class EfUnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _db;
    public IProductRepository Products { get; }
    public IOrderRepository Orders { get; }

    public EfUnitOfWork(AppDbContext db)
    {
        _db = db;
        Products = new EfProductRepository(db);
        Orders = new EfOrderRepository(db);
    }

    public Task&lt;int&gt; SaveAsync() =&gt; _db.SaveChangesAsync();
}

// Services/OrderService.cs
public class OrderService : IOrderService
{
    private readonly IUnitOfWork _uow;
    private readonly IEmailSender _email;

    public OrderService(IUnitOfWork uow, IEmailSender email)
    {
        _uow = uow;
        _email = email;
    }

    public async Task&lt;Order&gt; PlaceOrderAsync(int customerId, IReadOnlyList&lt;CartLine&gt; lines)
    {
        if (lines.Count == 0)
            throw new InvalidOperationException("Cannot place an empty order.");

        var order = new Order { CustomerId = customerId, PlacedOn = DateTime.UtcNow };

        foreach (var line in lines)
        {
            var product = await _uow.Products.GetAsync(line.ProductId)
                ?? throw new InvalidOperationException($"Product {line.ProductId} not found.");

            if (product.Stock &lt; line.Quantity)
                throw new InvalidOperationException($"Not enough stock for {product.Name}.");

            product.Stock -= line.Quantity;
            order.Lines.Add(new OrderLine
            {
                ProductId = product.Id,
                Quantity = line.Quantity,
                UnitPrice = product.Price
            });
        }

        await _uow.Orders.AddAsync(order);
        await _uow.SaveAsync();   // stock changes and the order commit together

        await _email.SendAsync("orders@shop.com", "New order", $"Order {order.Id} placed.");
        return order;
    }
}

// Program.cs
builder.Services.AddScoped&lt;IUnitOfWork, EfUnitOfWork&gt;();
builder.Services.AddScoped&lt;IProductRepository, EfProductRepository&gt;();
builder.Services.AddScoped&lt;IOrderService, OrderService&gt;();

// Controllers/CheckoutController.cs
public class CheckoutController : Controller
{
    private readonly IOrderService _orders;
    private readonly ICartService _cart;

    public CheckoutController(IOrderService orders, ICartService cart)
    {
        _orders = orders;
        _cart = cart;
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; PlaceOrder()
    {
        try
        {
            var order = await _orders.PlaceOrderAsync(CurrentCustomerId(), _cart.Lines);
            _cart.Clear();
            return RedirectToAction("Confirmation", new { id = order.Id });
        }
        catch (InvalidOperationException ex)
        {
            ModelState.AddModelError("", ex.Message);
            return View("Review", _cart);
        }
    }

    private int CurrentCustomerId() =&gt;
        int.Parse(User.FindFirst("CustomerId")!.Value);
}
</code></pre>
