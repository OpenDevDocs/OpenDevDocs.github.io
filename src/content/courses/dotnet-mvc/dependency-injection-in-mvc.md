---
publishDate: 2026-08-18T11:50
title: Dependency Injection in MVC
slug: dependency-injection-in-mvc
metadescription: Understand how ASP.NET Core creates your controllers and hands them the services they need, the difference between transient, scoped and singleton lifetimes, how to register your own services, and how to inject into views and filters.
updateDate: 2026-09-14T11:50
author: ['bishal-biswas']
level: 2
tags: ['dependency-injection', 'services', 'architecture']
course: dotnet-mvc
---

## Who creates the controller?

You never write `new ProductsController()`. The framework does it for every request. And when the controller's constructor asks for an `AppDbContext`, the framework provides one. This is **dependency injection** (DI), and it is built into ASP.NET Core from the ground up.

The idea is simple. A class says what it needs in its constructor. Something else, the **container**, works out how to build those things and passes them in.

```csharp
public class ProductsController : Controller
{
    private readonly AppDbContext _db;
    private readonly IEmailSender _email;

    public ProductsController(AppDbContext db, IEmailSender email)
    {
        _db = db;
        _email = email;
    }
}
```

The controller does not know where the database context came from or which email sender is in use. It only knows the interface. That makes it easy to swap the real email sender for a fake one in tests, or for a different provider in production.

## Registering services

The container only knows about services that were registered in `Program.cs`. The line `builder.Services.AddControllersWithViews()` registers everything MVC needs. `AddDbContext` registers the context. Your own services go alongside:

```csharp
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<IProductRepository, EfProductRepository>();
builder.Services.AddSingleton<IClock, SystemClock>();
```

Each line says "when something asks for this interface, build this class". If the class itself has constructor parameters, the container resolves those too, all the way down.

Asking for a service that was never registered throws an exception at request time with a clear message naming the missing type.

## The three lifetimes

The method you use to register decides how long an instance lives.

**Transient**: a new instance every time it is requested. Use it for light, stateless classes.

```csharp
builder.Services.AddTransient<IPriceFormatter, PriceFormatter>();
```

**Scoped**: one instance per HTTP request. Everything in the same request that asks for it gets the same object. Use it for anything that holds request state, such as a `DbContext` or a unit of work.

```csharp
builder.Services.AddScoped<ICartService, CartService>();
```

**Singleton**: one instance for the life of the app. Use it for expensive shared things that are safe to use from many threads at once: caches, configuration, HTTP clients, a clock.

```csharp
builder.Services.AddSingleton<IRateTable, RateTable>();
```

## The rule that catches everyone

A singleton must not depend on a scoped service. The singleton is created once and would hold on to the first request's scoped instance forever. With a `DbContext` that means one connection shared by every user, which breaks in strange ways.

In development, the framework checks for this and throws on startup with a message about "captive dependencies". If you truly need scoped data inside a singleton, inject `IServiceScopeFactory` and create a scope when you need it.

The safe direction is: transient and scoped can depend on anything; singletons can only depend on other singletons.

## Interfaces are not required

You can register a class by itself:

```csharp
builder.Services.AddScoped<CartService>();
```

Then ask for `CartService` in a constructor. Interfaces are useful when you want to swap implementations, especially in tests. For a class that will only ever have one implementation, registering the concrete type is fine.

## Injecting into views

A view can ask for a service with `@inject`. This is handy for small bits of data that many pages need, such as the current site settings:

```cshtml
@inject ISiteSettings Settings

<footer>@Settings.CompanyName</footer>
```

Keep this for cross cutting things. Views that pull their main data through `@inject` are hard to test and hide what the page depends on. Pass the main data through the model.

## Injecting into other places

- **View components** and **tag helpers** take services in their constructor exactly like controllers.
- **Filters** can take services if you register them with `[ServiceFilter]` or `[TypeFilter]`, covered in the filters topic.
- **Middleware** takes singletons in its constructor and scoped services as parameters to `InvokeAsync`.
- **Action methods** can take a service directly with `[FromServices]` when only one action needs it:

```csharp
public IActionResult Export([FromServices] IReportBuilder reports)
```

## Registering built in helpers

Some framework services are worth knowing about:

```csharp
builder.Services.AddHttpClient<IStockService, HttpStockService>(c =>
    c.BaseAddress = new Uri("https://stock.example.com"));

builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();
```

`AddHttpClient` gives your service a correctly managed `HttpClient`. `AddMemoryCache` provides `IMemoryCache`. `AddHttpContextAccessor` lets a service outside a controller read the current request through `IHttpContextAccessor`.

`ILogger<T>`, `IConfiguration` and `IWebHostEnvironment` are always available without any registration.

## Options as services

Settings from `appsettings.json` can be injected as typed objects:

```csharp
builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("Smtp"));
```

```csharp
public SmtpEmailSender(IOptions<SmtpSettings> options)
{
    _settings = options.Value;
}
```

The configuration topic goes through this properly.

## Keeping registrations tidy

`Program.cs` grows fast. Group related registrations in an extension method:

```csharp
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddShopServices(this IServiceCollection services)
    {
        services.AddScoped<IProductRepository, EfProductRepository>();
        services.AddScoped<ICartService, CartService>();
        services.AddScoped<IEmailSender, SmtpEmailSender>();
        return services;
    }
}
```

```csharp
builder.Services.AddShopServices();
```

## Quick recap

- Dependency injection means classes declare what they need in their constructor and the container supplies it.
- Register your services in `Program.cs` with `AddTransient`, `AddScoped` or `AddSingleton`.
- Transient is new each time, scoped is one per request, singleton is one for the app.
- A singleton must never depend on a scoped service such as a `DbContext`.
- Use `@inject` in views for small shared services, `[FromServices]` for one off action needs, and constructors everywhere else.
- Group registrations into extension methods to keep `Program.cs` readable.

<code id="code-content" class="language-csharp">
// Services/IEmailSender.cs
public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body);
}

// Services/SmtpEmailSender.cs
public class SmtpEmailSender : IEmailSender
{
    private readonly SmtpSettings _settings;
    private readonly ILogger&lt;SmtpEmailSender&gt; _logger;

    public SmtpEmailSender(IOptions&lt;SmtpSettings&gt; options, ILogger&lt;SmtpEmailSender&gt; logger)
    {
        _settings = options.Value;
        _logger = logger;
    }

    public Task SendAsync(string to, string subject, string body)
    {
        _logger.LogInformation("Sending '{Subject}' to {To} via {Host}", subject, to, _settings.Host);
        // real SMTP call here
        return Task.CompletedTask;
    }
}

// Services/ICartService.cs and CartService.cs (scoped: one per request)
public interface ICartService
{
    Task AddAsync(int productId, int quantity);
    Task&lt;decimal&gt; TotalAsync();
}

public class CartService : ICartService
{
    private readonly AppDbContext _db;
    private readonly IClock _clock;

    public CartService(AppDbContext db, IClock clock)
    {
        _db = db;
        _clock = clock;
    }

    public async Task AddAsync(int productId, int quantity)
    {
        _db.CartLines.Add(new CartLine { ProductId = productId, Quantity = quantity, AddedAt = _clock.UtcNow });
        await _db.SaveChangesAsync();
    }

    public Task&lt;decimal&gt; TotalAsync() =&gt;
        _db.CartLines.SumAsync(l =&gt; l.Quantity * l.Product.Price);
}

// Services/IClock.cs (singleton: stateless and thread safe)
public interface IClock { DateTime UtcNow { get; } }
public class SystemClock : IClock { public DateTime UtcNow =&gt; DateTime.UtcNow; }

// Extensions/ServiceCollectionExtensions.cs
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddShopServices(this IServiceCollection services, IConfiguration config)
    {
        services.Configure&lt;SmtpSettings&gt;(config.GetSection("Smtp"));
        services.AddSingleton&lt;IClock, SystemClock&gt;();
        services.AddScoped&lt;IEmailSender, SmtpEmailSender&gt;();
        services.AddScoped&lt;ICartService, CartService&gt;();
        services.AddHttpClient&lt;IStockService, HttpStockService&gt;(c =&gt;
            c.BaseAddress = new Uri(config["Stock:BaseUrl"]!));
        services.AddMemoryCache();
        return services;
    }
}

// Program.cs
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddShopServices(builder.Configuration);
var app = builder.Build();

// Controllers/CartController.cs
public class CartController : Controller
{
    private readonly ICartService _cart;
    public CartController(ICartService cart) =&gt; _cart = cart;

    [HttpPost]
    public async Task&lt;IActionResult&gt; Add(int productId, int quantity,
        [FromServices] IEmailSender email)
    {
        await _cart.AddAsync(productId, quantity);
        await email.SendAsync("admin@shop.com", "Cart updated", $"Product {productId} added");
        return RedirectToAction("Index");
    }
}
</code></pre>
