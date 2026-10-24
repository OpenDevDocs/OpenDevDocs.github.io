---
publishDate: 2026-04-27T11:49
title: Dependency Injection Fundamentals
slug: dependency-injection-fundamentals
metadescription: Understand constructor injection, use the Microsoft.Extensions.DependencyInjection container, choose between singleton, scoped and transient lifetimes, register interfaces and options, and avoid captive dependencies and the service locator anti pattern.
updateDate: 2026-09-05T11:49
author: ['bishal-biswas']
level: 4
tags: ['dependency-injection', 'architecture', 'design']
course: c-sharp
---

## The idea in one sentence

A class should **receive** the things it depends on rather than **create** them. That is dependency injection, and it is the practical side of the dependency inversion principle.

```csharp
// Creates its own dependencies: hard to test, hard to change
class OrderService
{
    private readonly SqlOrderRepository repo = new SqlOrderRepository("Server=prod;...");
}

// Receives them: easy to test, easy to change
class OrderService
{
    private readonly IOrderRepository repo;

    public OrderService(IOrderRepository repo)
    {
        this.repo = repo;
    }
}
```

The second version does not know or care which repository it gets. A test passes a fake. Production passes the SQL one.

## Constructor injection

Passing dependencies through the constructor is the standard form. It has three properties that matter:

- The object is **complete** as soon as it exists. There is no half initialised state.
- Dependencies are **visible** in the signature. You can see what a class needs by reading one line.
- They can be **readonly**, so they cannot be swapped out from under the class.

Property injection and method injection exist but are rare. Default to the constructor.

## Manual wiring

For a small program you can wire everything by hand at the top:

```csharp
var repo = new SqlOrderRepository(connectionString);
var email = new SmtpEmailSender(smtpHost);
var service = new OrderService(repo, email);

service.Place(order);
```

This is called the **composition root**: the one place where concrete types are chosen. Everything below it works with interfaces. For a dozen classes this is fine. For a hundred, with lifetimes to manage, you want a container.

## The built in container

.NET ships `Microsoft.Extensions.DependencyInjection`. ASP.NET Core, worker services and MAUI all use it, and a console app can too:

```bash
dotnet add package Microsoft.Extensions.DependencyInjection
```

```csharp
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();

services.AddSingleton<IEmailSender, SmtpEmailSender>();
services.AddScoped<IOrderRepository, SqlOrderRepository>();
services.AddTransient<OrderService>();

using ServiceProvider provider = services.BuildServiceProvider();

var service = provider.GetRequiredService<OrderService>();
service.Place(order);
```

You **register** each service with an interface, an implementation and a lifetime. When you ask for `OrderService`, the container looks at its constructor, sees it needs `IOrderRepository` and `IEmailSender`, creates those, and passes them in. It resolves the whole graph recursively.

## Lifetimes

The lifetime decides how many instances exist and how long they live.

**Transient**: a new instance every time it is requested. Use for lightweight, stateless services.

```csharp
services.AddTransient<IPriceCalculator, PriceCalculator>();
```

**Scoped**: one instance per **scope**. In a web app a scope is one HTTP request. Use for anything tied to a unit of work, such as a database context.

```csharp
services.AddScoped<AppDbContext>();
```

**Singleton**: one instance for the life of the application. Use for configuration, caches, `HttpClient` wrappers and anything expensive to create that is thread safe.

```csharp
services.AddSingleton<ICache, MemoryCache>();
```

In a console app there is no automatic scope. Create one when you need scoped services:

```csharp
using (IServiceScope scope = provider.CreateScope())
{
    var repo = scope.ServiceProvider.GetRequiredService<IOrderRepository>();
}   // scoped services are disposed here
```

## Captive dependencies

The most common DI bug: a singleton that depends on a scoped or transient service. The singleton is created once and holds its dependency forever, so the "scoped" service effectively becomes a singleton, shared across every request:

```csharp
services.AddSingleton<ReportCache>();       // lives forever
services.AddScoped<AppDbContext>();         // meant to be per request

class ReportCache
{
    public ReportCache(AppDbContext db) { }  // captured: this one DbContext is now shared by all requests
}
```

The rule: a service may only depend on services with a lifetime **equal to or longer than** its own. The container can validate this at startup:

```csharp
services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
```

ASP.NET Core does this automatically in development.

## Registering different shapes

```csharp
// Interface to implementation
services.AddSingleton<IClock, SystemClock>();

// Concrete class with no interface
services.AddTransient<OrderService>();

// An existing instance
services.AddSingleton<IConfig>(new FileConfig("app.json"));

// A factory lambda, when construction needs logic
services.AddSingleton<IEmailSender>(sp =>
{
    var config = sp.GetRequiredService<IConfig>();
    return new SmtpEmailSender(config.SmtpHost);
});

// Several implementations of one interface, injected as IEnumerable<T>
services.AddTransient<IValidator, NameValidator>();
services.AddTransient<IValidator, AgeValidator>();

class Validation
{
    public Validation(IEnumerable<IValidator> validators) { }   // gets both
}
```

## Options pattern

Configuration values are injected as strongly typed options rather than as raw strings:

```csharp
class SmtpOptions
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 25;
}

services.Configure<SmtpOptions>(o => { o.Host = "smtp.example.com"; o.Port = 587; });

class SmtpEmailSender : IEmailSender
{
    private readonly SmtpOptions options;
    public SmtpEmailSender(IOptions<SmtpOptions> options) => this.options = options.Value;
}
```

In ASP.NET Core, `Configure<SmtpOptions>(configuration.GetSection("Smtp"))` binds it from `appsettings.json`.

## Testing with DI

Because `OrderService` takes interfaces, a test needs no container:

```csharp
class FakeRepo : IOrderRepository
{
    public List<Order> Saved = new();
    public void Save(Order o) => Saved.Add(o);
}

var repo = new FakeRepo();
var service = new OrderService(repo, new FakeEmailSender());

service.Place(new Order(...));

Assert.Single(repo.Saved);
```

This is the payoff. The container is a production convenience. The design is what makes testing easy.

## The service locator anti pattern

Injecting `IServiceProvider` and pulling services out of it inside your class hides the dependencies again:

```csharp
class OrderService
{
    public OrderService(IServiceProvider sp)
    {
        var repo = sp.GetRequiredService<IOrderRepository>();   // hidden dependency
    }
}
```

The constructor lies about what the class needs, and tests must build a container. Ask for what you need directly. The only place that should touch the provider is the composition root.

## Quick recap

- Dependency injection means receiving dependencies through the constructor instead of creating them.
- Choose concrete types in one place, the composition root, and use interfaces everywhere else.
- The built in container resolves constructor graphs from registrations.
- Transient is new each time, scoped is one per request or unit of work, singleton is one for the app.
- Never let a longer lived service capture a shorter lived one. Enable scope validation.
- Inject exactly what a class needs. Never inject the container itself.

<code id="code-content" class="language-csharp">
// Dependency injection with Microsoft.Extensions.DependencyInjection
// dotnet add package Microsoft.Extensions.DependencyInjection
// dotnet add package Microsoft.Extensions.Options
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
record Order(string Customer, decimal Total);
interface IClock { DateTime Now { get; } }
interface IOrderRepository { void Save(Order order); int Count { get; } }
interface IEmailSender { void Send(string to, string body); }
class SmtpOptions { public string Host { get; set; } = "localhost"; public int Port { get; set; } = 25; }
class SystemClock : IClock { public DateTime Now =&gt; DateTime.Now; }
class InMemoryOrderRepository : IOrderRepository
{
    private readonly List&lt;Order&gt; orders = new();
    public InMemoryOrderRepository() =&gt; Console.WriteLine("  repository created");
    public void Save(Order order) =&gt; orders.Add(order);
    public int Count =&gt; orders.Count;
}
class SmtpEmailSender : IEmailSender
{
    private readonly SmtpOptions options;
    public SmtpEmailSender(IOptions&lt;SmtpOptions&gt; options) =&gt; this.options = options.Value;   // options pattern
    public void Send(string to, string body) =&gt; Console.WriteLine($"  [{options.Host}:{options.Port}] to {to}: {body}");
}
// The service asks for exactly what it needs through its constructor
class OrderService
{
    private readonly IOrderRepository repo;
    private readonly IEmailSender email;
    private readonly IClock clock;
    public OrderService(IOrderRepository repo, IEmailSender email, IClock clock)
        =&gt; (this.repo, this.email, this.clock) = (repo, email, clock);
    public void Place(Order order)
    {
        repo.Save(order);
        email.Send(order.Customer, $"Order for {order.Total} placed at {clock.Now:HH:mm}");
    }
}
// Composition root: the one place concrete types and lifetimes are chosen
var services = new ServiceCollection();
services.AddSingleton&lt;IClock, SystemClock&gt;();                        // one for the app
services.AddSingleton&lt;IEmailSender, SmtpEmailSender&gt;();
services.Configure&lt;SmtpOptions&gt;(o =&gt; { o.Host = "smtp.example.com"; o.Port = 587; });
services.AddScoped&lt;IOrderRepository, InMemoryOrderRepository&gt;();     // one per scope
services.AddTransient&lt;OrderService&gt;();                               // new each time
using ServiceProvider provider = services.BuildServiceProvider(
    new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
// Each scope gets its own repository, services inside share it
for (int request = 1; request &lt;= 2; request++)
{
    Console.WriteLine($"Scope {request}");
    using IServiceScope scope = provider.CreateScope();
    var a = scope.ServiceProvider.GetRequiredService&lt;OrderService&gt;();
    var b = scope.ServiceProvider.GetRequiredService&lt;OrderService&gt;();
    a.Place(new Order("asha@example.com", 100));
    b.Place(new Order("ravi@example.com", 50));
    var repo = scope.ServiceProvider.GetRequiredService&lt;IOrderRepository&gt;();
    Console.WriteLine($"  orders in this scope: {repo.Count}");   // 2, shared within the scope
}
</code></pre>
