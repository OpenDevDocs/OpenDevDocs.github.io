---
publishDate: 2026-09-13T13:20
title: Dependency Injection in ASP.NET Core
slug: dependency-injection-in-aspnet-core
metadescription: Register services in the built in container, choose between singleton, scoped and transient, avoid captive dependencies, and use factories, keyed services and the options pattern.
updateDate: 2026-09-07T13:20
author: ['bishal-biswas']
level: 2
tags: ['dependency-injection', 'services', 'architecture']
course: dotnet-webapi
---

## The container is already there

ASP.NET Core has dependency injection built in. There is nothing to install and nothing to configure. `builder.Services` **is** the container.

```csharp
builder.Services.AddScoped<IBookService, BookService>();
```

From that moment, anything that asks for `IBookService` gets a `BookService`, with its own dependencies built and passed in automatically:

```csharp
public class BooksController : ControllerBase
{
    private readonly IBookService service;

    public BooksController(IBookService service) => this.service = service;
}
```

You never write `new BookService(new BookRepository(new AppDbContext(...)))`. The container walks the constructor graph for you.

## The three lifetimes

The lifetime decides how many instances exist and how long they live. This is the part that actually matters.

**Transient**: a new instance every time it is asked for.

```csharp
builder.Services.AddTransient<IPriceCalculator, PriceCalculator>();
```

Use for small, stateless services. Safe by default, because nothing is ever shared.

**Scoped**: one instance per HTTP request. Everything within one request shares it.

```csharp
builder.Services.AddScoped<IBookService, BookService>();
```

Use for anything tied to a request: a `DbContext`, a unit of work, the current user. This is the right default for most business services.

**Singleton**: one instance for the entire application.

```csharp
builder.Services.AddSingleton<ICacheService, MemoryCacheService>();
```

Use for expensive, stateless, thread safe things: caches, configuration holders, HTTP client factories.

If you are unsure, choose **scoped**. It is safe in a web API because the request boundary disposes it.

## Singletons must be thread safe

A singleton is shared by every request at the same time. This is a real bug waiting to happen:

```csharp
public class CounterService                    // registered as a singleton
{
    private int count;
    public void Increment() => count++;        // not atomic, races between requests
}
```

Fix it with a thread safe type or a lock:

```csharp
public class CounterService
{
    private int count;
    public void Increment() => Interlocked.Increment(ref count);
}
```

`Dictionary<K,V>` in a singleton is the same trap. Use `ConcurrentDictionary`.

## Captive dependencies

The most common DI bug, and the container will catch it for you in development.

A singleton created once holds whatever it was given forever. Give it a scoped service, and that scoped service is now effectively a singleton, shared across every request:

```csharp
builder.Services.AddSingleton<ReportCache>();   // lives forever
builder.Services.AddDbContext<AppDbContext>();  // scoped, one per request

public class ReportCache
{
    public ReportCache(AppDbContext db) { }     // captured: one DbContext for the whole app
}
```

A `DbContext` shared across requests is not thread safe and its change tracker grows without limit.

**The rule: a service may only depend on services whose lifetime is equal to or longer than its own.**

| Consumer | May depend on |
|---|---|
| Singleton | singleton only |
| Scoped | scoped, singleton |
| Transient | anything |

ASP.NET Core validates this at startup in development and throws a clear error. Do not disable that check.

If a singleton genuinely needs scoped work, create a scope yourself:

```csharp
public class ReportCache
{
    private readonly IServiceScopeFactory scopeFactory;

    public ReportCache(IServiceScopeFactory scopeFactory) => this.scopeFactory = scopeFactory;

    public async Task RefreshAsync()
    {
        using IServiceScope scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // use db here, disposed at the end of this block
    }
}
```

## Ways to register

```csharp
// Interface to implementation, the usual form
builder.Services.AddScoped<IBookService, BookService>();

// A concrete class with no interface
builder.Services.AddScoped<BookService>();

// An instance you already have
builder.Services.AddSingleton<IClock>(new SystemClock());

// A factory, when construction needs logic
builder.Services.AddSingleton<IEmailSender>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    return new SmtpEmailSender(config["Smtp:Host"]!);
});

// Only if nothing else registered it. Useful in library extension methods.
builder.Services.TryAddScoped<IBookService, BookService>();

// Replace a previous registration
builder.Services.Replace(ServiceDescriptor.Scoped<IBookService, CachedBookService>());
```

## Several implementations of one interface

Register more than one and inject them all as a collection:

```csharp
builder.Services.AddScoped<IValidator, TitleValidator>();
builder.Services.AddScoped<IValidator, IsbnValidator>();
builder.Services.AddScoped<IValidator, PriceValidator>();
```

```csharp
public class BookValidator
{
    private readonly IEnumerable<IValidator> validators;

    public BookValidator(IEnumerable<IValidator> validators) => this.validators = validators;

    public List<string> Validate(Book book) =>
        validators.SelectMany(v => v.Validate(book)).ToList();
}
```

Adding a fourth rule is now one registration line. Nothing else changes.

If you ask for a single `IValidator` instead, you get the **last** one registered.

## Keyed services

When you need several implementations and want to pick one by name:

```csharp
builder.Services.AddKeyedScoped<IPaymentGateway, StripeGateway>("stripe");
builder.Services.AddKeyedScoped<IPaymentGateway, RazorpayGateway>("razorpay");
```

```csharp
public class CheckoutService
{
    public CheckoutService([FromKeyedServices("stripe")] IPaymentGateway gateway) { }
}
```

Or resolve at runtime:

```csharp
IPaymentGateway gateway = serviceProvider.GetRequiredKeyedService<IPaymentGateway>(providerName);
```

## The options pattern

Do not inject `IConfiguration` and read magic strings. Bind configuration to a typed class:

```json
{
  "Smtp": {
    "Host": "smtp.example.com",
    "Port": 587,
    "FromAddress": "noreply@example.com"
  }
}
```

```csharp
public class SmtpOptions
{
    public const string SectionName = "Smtp";

    public string Host { get; set; } = "";
    public int Port { get; set; } = 25;
    public string FromAddress { get; set; } = "";
}
```

```csharp
builder.Services.Configure<SmtpOptions>(
    builder.Configuration.GetSection(SmtpOptions.SectionName));
```

```csharp
public class EmailSender
{
    private readonly SmtpOptions options;

    public EmailSender(IOptions<SmtpOptions> options) => this.options = options.Value;
}
```

Three flavours of the interface, and the difference matters:

- **`IOptions<T>`** reads once at startup. Singleton. Use for settings that never change.
- **`IOptionsSnapshot<T>`** re reads per request. Scoped. Use when `appsettings.json` changes should take effect without a restart.
- **`IOptionsMonitor<T>`** can be used in a singleton and supports change notifications.

Validate them at startup so a missing value fails immediately rather than at 3am:

```csharp
builder.Services.AddOptions<SmtpOptions>()
    .Bind(builder.Configuration.GetSection(SmtpOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

## Injecting into minimal APIs and middleware

Minimal API handlers take services as parameters:

```csharp
app.MapGet("/api/books", (IBookService service) => service.GetAll());
```

Middleware is different, and it catches people out. Middleware is constructed **once**, so its constructor can only take singletons. Scoped services go in the `InvokeAsync` method instead, where the container injects them per request:

```csharp
public class AuditMiddleware
{
    private readonly RequestDelegate next;

    public AuditMiddleware(RequestDelegate next) => this.next = next;

    // Scoped services belong here, not in the constructor
    public async Task InvokeAsync(HttpContext context, IAuditService audit)
    {
        await audit.LogAsync(context.Request.Path);
        await next(context);
    }
}
```

## Keep Program.cs organised

Group registrations into extension methods so startup stays readable:

```csharp
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IBookService, BookService>();
        services.AddScoped<IOrderService, OrderService>();
        return services;
    }

    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<AppDbContext>(o => o.UseSqlServer(config.GetConnectionString("Default")));
        services.AddScoped<IBookRepository, BookRepository>();
        return services;
    }
}
```

```csharp
builder.Services
    .AddApplicationServices()
    .AddInfrastructure(builder.Configuration);
```

## Do not inject the container

```csharp
public class BookService
{
    public BookService(IServiceProvider sp)
    {
        var repo = sp.GetRequiredService<IBookRepository>();   // hidden dependency
    }
}
```

This is the **service locator** anti pattern. The constructor no longer tells the truth about what the class needs, and every test has to build a container. Ask for what you need directly.

The legitimate exceptions are few: `IServiceScopeFactory` inside a singleton that must do scoped work, and framework level code that resolves types chosen at runtime.

## Quick recap

- `builder.Services` is the container. Register with `AddSingleton`, `AddScoped` or `AddTransient`.
- Scoped is one per request and is the right default for business services.
- Singletons live for the app, must be thread safe, and may only depend on other singletons.
- A singleton holding a scoped service is a captive dependency. The container catches it in development.
- Use `IServiceScopeFactory` when a singleton genuinely needs scoped work.
- Register several implementations and inject `IEnumerable<T>` to get them all.
- Keyed services let you pick an implementation by name.
- Bind configuration to typed options and validate them with `ValidateOnStart`.
- Middleware constructors get singletons only. Scoped services go in `InvokeAsync`.
- Never inject `IServiceProvider` into your own services.

<code id="code-content" class="language-csharp">
// Program.cs - registration patterns, lifetimes, and the traps to avoid.
using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
var builder = WebApplication.CreateBuilder(args);
// ---------- Lifetimes
builder.Services.AddSingleton&lt;IClock, SystemClock&gt;();            // stateless, thread safe
builder.Services.AddSingleton&lt;IStatsCache, StatsCache&gt;();        // shared, uses Interlocked
builder.Services.AddScoped&lt;IBookService, BookService&gt;();         // one per request
builder.Services.AddTransient&lt;IPriceCalculator, PriceCalculator&gt;();  // new every time
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt; o.UseInMemoryDatabase("shop"));  // scoped
// ---------- Several implementations, injected as IEnumerable&lt;T&gt;.
// Adding a fourth rule later is one line here and nothing else.
builder.Services.AddScoped&lt;IBookRule, TitleRequiredRule&gt;();
builder.Services.AddScoped&lt;IBookRule, PricePositiveRule&gt;();
builder.Services.AddScoped&lt;IBookRule, YearSensibleRule&gt;();
// ---------- Keyed services: several implementations, chosen by name
builder.Services.AddKeyedScoped&lt;IPaymentGateway, StripeGateway&gt;("stripe");
builder.Services.AddKeyedScoped&lt;IPaymentGateway, RazorpayGateway&gt;("razorpay");
// ---------- A factory registration, for construction that needs logic
builder.Services.AddSingleton&lt;IEmailSender&gt;(sp =&gt;
{
    var options = sp.GetRequiredService&lt;IOptions&lt;SmtpOptions&gt;&gt;().Value;
    return new SmtpEmailSender(options.Host, options.Port);
});
// ---------- Typed options, validated at startup so a missing value fails now, not at 3am
builder.Services.AddOptions&lt;SmtpOptions&gt;()
    .Bind(builder.Configuration.GetSection(SmtpOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
var app = builder.Build();
app.MapGet("/api/books", (IBookService service) =&gt; service.GetAll());
app.MapPost("/api/pay/{provider}", (string provider, IServiceProvider sp) =&gt;
{
    // Runtime selection is one of the few legitimate uses of the provider
    var gateway = sp.GetRequiredKeyedService&lt;IPaymentGateway&gt;(provider);
    return Results.Ok(gateway.Charge(100m));
});
app.Run();
// ---------- A singleton is shared by every request, so it MUST be thread safe
public interface IStatsCache { void RecordHit(); int Hits { get; } }
public class StatsCache : IStatsCache
{
    private int hits;
    public void RecordHit() =&gt; Interlocked.Increment(ref hits);   // count++ would race
    public int Hits =&gt; Volatile.Read(ref hits);
}
// ---------- A singleton that needs scoped work. This is what IServiceScopeFactory is for.
public class ReportRefresher
{
    private readonly IServiceScopeFactory scopeFactory;
    public ReportRefresher(IServiceScopeFactory scopeFactory) =&gt; this.scopeFactory = scopeFactory;
    // WRONG: public ReportRefresher(AppDbContext db)
    // A singleton holding a scoped DbContext is a captive dependency. The container
    // throws at startup in development, and rightly so.
    public async Task&lt;int&gt; RefreshAsync(CancellationToken ct)
    {
        using IServiceScope scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService&lt;AppDbContext&gt;();
        return await db.Books.CountAsync(ct);
    }   // the scope, and the DbContext, are disposed here
}
// ---------- A service that asks for exactly what it needs. No IServiceProvider.
public class BookService : IBookService
{
    private readonly AppDbContext db;
    private readonly IEnumerable&lt;IBookRule&gt; rules;      // every registered rule
    private readonly IClock clock;
    public BookService(AppDbContext db, IEnumerable&lt;IBookRule&gt; rules, IClock clock)
        =&gt; (this.db, this.rules, this.clock) = (db, rules, clock);
    public IReadOnlyList&lt;Book&gt; GetAll() =&gt; db.Books.ToList();
    public List&lt;string&gt; Validate(Book book) =&gt;
        rules.SelectMany(r =&gt; r.Check(book)).ToList();
}
// ---------- Middleware: the constructor gets singletons only.
// Scoped services are injected into InvokeAsync, per request.
public class AuditMiddleware
{
    private readonly RequestDelegate next;
    private readonly IClock clock;                                  // singleton: fine here
    public AuditMiddleware(RequestDelegate next, IClock clock) =&gt; (this.next, this.clock) = (next, clock);
    public async Task InvokeAsync(HttpContext context, IBookService service)   // scoped: goes here
    {
        await next(context);
    }
}
public class SmtpOptions
{
    public const string SectionName = "Smtp";
    [Required] public string Host { get; set; } = "";
    [Range(1, 65535)] public int Port { get; set; } = 25;
}
public interface IClock { DateTime UtcNow { get; } }
public class SystemClock : IClock { public DateTime UtcNow =&gt; DateTime.UtcNow; }
public interface IBookService { IReadOnlyList&lt;Book&gt; GetAll(); List&lt;string&gt; Validate(Book book); }
public interface IBookRule { IEnumerable&lt;string&gt; Check(Book book); }
public class TitleRequiredRule : IBookRule
{ public IEnumerable&lt;string&gt; Check(Book b) { if (string.IsNullOrWhiteSpace(b.Title)) yield return "Title is required."; } }
public class PricePositiveRule : IBookRule
{ public IEnumerable&lt;string&gt; Check(Book b) { if (b.Price &lt;= 0) yield return "Price must be positive."; } }
public class YearSensibleRule : IBookRule
{ public IEnumerable&lt;string&gt; Check(Book b) { if (b.Year &lt; 1000) yield return "Year looks wrong."; } }
public interface IPriceCalculator { decimal WithTax(decimal amount); }
public class PriceCalculator : IPriceCalculator { public decimal WithTax(decimal a) =&gt; a * 1.2m; }
public interface IPaymentGateway { string Charge(decimal amount); }
public class StripeGateway   : IPaymentGateway { public string Charge(decimal a) =&gt; $"stripe:{a}"; }
public class RazorpayGateway : IPaymentGateway { public string Charge(decimal a) =&gt; $"razorpay:{a}"; }
public interface IEmailSender { void Send(string to, string body); }
public class SmtpEmailSender : IEmailSender
{
    private readonly string host; private readonly int port;
    public SmtpEmailSender(string host, int port) =&gt; (this.host, this.port) = (host, port);
    public void Send(string to, string body) =&gt; Console.WriteLine($"[{host}:{port}] {to}");
}
public class Book { public int Id { get; set; } public string Title { get; set; } = "";
                    public decimal Price { get; set; } public int Year { get; set; } }
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Book&gt; Books =&gt; Set&lt;Book&gt;();
}
</code></pre>
