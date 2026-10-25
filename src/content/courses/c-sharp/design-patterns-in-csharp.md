---
publishDate: 2026-04-27T11:48
title: Design Patterns in C#
slug: design-patterns-in-csharp
metadescription: Implement the most useful design patterns in idiomatic C#, including Singleton, Factory, Builder, Strategy, Observer, Decorator, Repository and Command, and learn which language features make some patterns unnecessary.
updateDate: 2026-09-05T11:48
author: ['bishal-biswas']
level: 4
tags: ['design', 'patterns', 'architecture']
course: c-sharp
---

## What a pattern is

A design pattern is a named solution to a problem that keeps coming up. The value is partly the solution and partly the **name**. Saying "use a strategy here" communicates a whole structure in one word.

Patterns are grouped into three families: **creational** (how objects are made), **structural** (how they are composed) and **behavioural** (how they interact). This topic shows the ones you will actually meet in C# codebases, written the way modern C# writes them.

## Singleton

One instance, shared everywhere. The C# idiom uses `Lazy<T>`, which is thread safe without a lock:

```csharp
sealed class AppConfig
{
    private static readonly Lazy<AppConfig> instance = new(() => new AppConfig());
    public static AppConfig Instance => instance.Value;

    public string ConnectionString { get; } = "Server=...";

    private AppConfig() { }   // nobody else can create one
}

Console.WriteLine(AppConfig.Instance.ConnectionString);
```

Use it sparingly. Singletons are global state, which makes tests hard. With dependency injection you register a service as a singleton instead, and the container handles the single instance without the class knowing.

## Factory Method

Centralise object creation so callers do not depend on concrete types:

```csharp
interface INotification { void Send(string message); }
class EmailNotification : INotification { public void Send(string m) => Console.WriteLine($"Email: {m}"); }
class SmsNotification : INotification { public void Send(string m) => Console.WriteLine($"SMS: {m}"); }

static class NotificationFactory
{
    public static INotification Create(string channel) => channel switch
    {
        "email" => new EmailNotification(),
        "sms" => new SmsNotification(),
        _ => throw new ArgumentException($"Unknown channel {channel}")
    };
}

INotification n = NotificationFactory.Create("sms");
n.Send("Your code is 1234");
```

The switch lives in exactly one place. Adding a channel is a new class and one new arm.

## Builder

For objects with many optional settings, a chain of methods reads better than a constructor with twelve parameters:

```csharp
class HttpRequestBuilder
{
    private string url = "";
    private string method = "GET";
    private readonly Dictionary<string, string> headers = new();
    private string? body;

    public HttpRequestBuilder To(string url) { this.url = url; return this; }
    public HttpRequestBuilder WithMethod(string method) { this.method = method; return this; }
    public HttpRequestBuilder WithHeader(string k, string v) { headers[k] = v; return this; }
    public HttpRequestBuilder WithBody(string body) { this.body = body; return this; }

    public HttpRequestMessage Build()
    {
        var request = new HttpRequestMessage(new HttpMethod(method), url);
        foreach (var (k, v) in headers) request.Headers.Add(k, v);
        if (body != null) request.Content = new StringContent(body);
        return request;
    }
}

var request = new HttpRequestBuilder()
    .To("https://api.example.com/orders")
    .WithMethod("POST")
    .WithHeader("Authorization", "Bearer token")
    .WithBody("{ }")
    .Build();
```

Each method returns `this`, which is what makes the chain work. For simple cases, C# object initialisers and records with `init` properties often make a builder unnecessary.

## Strategy

Swap an algorithm at run time by putting it behind an interface. This is the open closed principle in action:

```csharp
interface IShippingStrategy { decimal Calculate(decimal weight); }
class StandardShipping : IShippingStrategy { public decimal Calculate(decimal w) => 5 + w * 0.5m; }
class ExpressShipping : IShippingStrategy { public decimal Calculate(decimal w) => 15 + w * 1.0m; }

class Checkout
{
    private readonly IShippingStrategy shipping;
    public Checkout(IShippingStrategy shipping) => this.shipping = shipping;
    public decimal Total(decimal goods, decimal weight) => goods + shipping.Calculate(weight);
}

var checkout = new Checkout(new ExpressShipping());
```

In C#, a `Func<decimal, decimal>` is often enough instead of a one method interface. Use the interface when the strategy needs state or several methods.

## Observer

One object notifies many others when something happens. C# has this built in as **events**:

```csharp
class StockTicker
{
    public event EventHandler<decimal>? PriceChanged;

    public void Update(decimal price) => PriceChanged?.Invoke(this, price);
}

var ticker = new StockTicker();
ticker.PriceChanged += (s, p) => Console.WriteLine($"Chart: {p}");
ticker.PriceChanged += (s, p) => { if (p > 100) Console.WriteLine("Alert!"); };
ticker.Update(105);
```

You rarely implement the classic `IObserver` interface by hand. `IObservable<T>` exists for the Reactive Extensions library when you need composition over streams of events.

## Decorator

Add behaviour to an object by wrapping it in another object with the same interface:

```csharp
interface IDataSource { string Read(); }

class FileSource : IDataSource
{
    public string Read() => File.ReadAllText("data.txt");
}

class CachingSource : IDataSource
{
    private readonly IDataSource inner;
    private string? cache;

    public CachingSource(IDataSource inner) => this.inner = inner;

    public string Read() => cache ??= inner.Read();
}

class LoggingSource : IDataSource
{
    private readonly IDataSource inner;
    public LoggingSource(IDataSource inner) => this.inner = inner;

    public string Read()
    {
        Console.WriteLine("Reading...");
        return inner.Read();
    }
}

IDataSource source = new LoggingSource(new CachingSource(new FileSource()));
```

Each decorator does one thing and passes through to the next. Stack them in any order. ASP.NET Core middleware and `HttpClient` handlers are decorator chains.

## Repository

Hide data access behind a collection like interface so business code never sees SQL:

```csharp
interface ICustomerRepository
{
    Customer? GetById(int id);
    IEnumerable<Customer> Find(Func<Customer, bool> predicate);
    void Add(Customer customer);
}

class InMemoryCustomerRepository : ICustomerRepository
{
    private readonly List<Customer> items = new();
    public Customer? GetById(int id) => items.FirstOrDefault(c => c.Id == id);
    public IEnumerable<Customer> Find(Func<Customer, bool> p) => items.Where(p);
    public void Add(Customer c) => items.Add(c);
}
```

Tests use the in memory version. Production uses one backed by Entity Framework or Dapper. Business code cannot tell the difference.

## Command

Turn an action into an object so it can be queued, logged or undone:

```csharp
interface ICommand
{
    void Execute();
    void Undo();
}

class AddTextCommand : ICommand
{
    private readonly StringBuilder doc;
    private readonly string text;

    public AddTextCommand(StringBuilder doc, string text) => (this.doc, this.text) = (doc, text);

    public void Execute() => doc.Append(text);
    public void Undo() => doc.Length -= text.Length;
}

var document = new StringBuilder();
var history = new Stack<ICommand>();

void Run(ICommand c) { c.Execute(); history.Push(c); }

Run(new AddTextCommand(document, "Hello"));
Run(new AddTextCommand(document, " World"));
history.Pop().Undo();
Console.WriteLine(document);   // Hello
```

## Patterns C# makes unnecessary

Some classic patterns exist to work around missing language features. C# has the features:

- **Iterator**: `yield return` and `IEnumerable<T>`.
- **Observer**: events.
- **Strategy and Command** for simple cases: delegates and lambdas.
- **Null Object**: `?.` and `??` operators, or an empty implementation.
- **Visitor** for closed hierarchies: pattern matching on types.
- **Prototype**: records with `with` expressions.

Knowing the pattern still helps you recognise the intent in other code. Reaching for the language feature keeps your code shorter.

## Quick recap

- Patterns are named, reusable solutions, and the names improve communication.
- Singleton with `Lazy<T>`, Factory with a switch, Builder with a method chain.
- Strategy swaps algorithms behind an interface, Decorator wraps to add behaviour.
- Observer is built in as events, Command turns actions into undoable objects.
- Repository hides data access so business logic and tests stay independent of the database.
- Prefer language features such as lambdas, `yield`, events and pattern matching when they do the job.

<code id="code-content" class="language-csharp">
// Design patterns in idiomatic C#
using System.Text;
// Singleton with Lazy&lt;T&gt;: thread safe, created on first use
sealed class AppConfig
{
    private static readonly Lazy&lt;AppConfig&gt; instance = new(() =&gt; new AppConfig());
    public static AppConfig Instance =&gt; instance.Value;
    public string Region { get; } = "ap-south-1";
    private AppConfig() { }
}
// Strategy: swap the algorithm behind an interface
interface IShipping { decimal Cost(decimal weight); }
class Standard : IShipping { public decimal Cost(decimal w) =&gt; 5 + w * 0.5m; }
class Express : IShipping { public decimal Cost(decimal w) =&gt; 15 + w; }
// Factory: creation logic in one place
static class ShippingFactory
{
    public static IShipping Create(string kind) =&gt; kind switch
    {
        "express" =&gt; new Express(),
        _ =&gt; new Standard()
    };
}
// Decorator: wrap to add behaviour without changing the wrapped class
class LoggedShipping : IShipping
{
    private readonly IShipping inner;
    public LoggedShipping(IShipping inner) =&gt; this.inner = inner;
    public decimal Cost(decimal w)
    {
        decimal c = inner.Cost(w);
        Console.WriteLine($"  [{inner.GetType().Name}] {w}kg -&gt; {c}");
        return c;
    }
}
// Builder: readable construction of a complex object
class OrderBuilder
{
    private readonly List&lt;string&gt; items = new();
    private string shipping = "standard";
    public OrderBuilder Add(string item) { items.Add(item); return this; }
    public OrderBuilder ShipBy(string kind) { shipping = kind; return this; }
    public (List&lt;string&gt; Items, IShipping Shipping) Build()
        =&gt; (items, new LoggedShipping(ShippingFactory.Create(shipping)));
}
// Command: actions as undoable objects
interface ICommand { void Execute(); void Undo(); }
class AppendCommand : ICommand
{
    private readonly StringBuilder doc; private readonly string text;
    public AppendCommand(StringBuilder d, string t) =&gt; (doc, text) = (d, t);
    public void Execute() =&gt; doc.Append(text);
    public void Undo() =&gt; doc.Length -= text.Length;
}
// Observer: events are the built in form
class Ticker
{
    public event EventHandler&lt;decimal&gt;? PriceChanged;
    public void Update(decimal p) =&gt; PriceChanged?.Invoke(this, p);
}
Console.WriteLine($"Region: {AppConfig.Instance.Region}");
var order = new OrderBuilder().Add("Keyboard").Add("Mouse").ShipBy("express").Build();
Console.WriteLine($"Total shipping: {order.Shipping.Cost(2.5m)}");
var doc = new StringBuilder();
var history = new Stack&lt;ICommand&gt;();
void Run(ICommand c) { c.Execute(); history.Push(c); }
Run(new AppendCommand(doc, "Hello"));
Run(new AppendCommand(doc, " World"));
history.Pop().Undo();
Console.WriteLine(doc);                              // Hello
var ticker = new Ticker();
ticker.PriceChanged += (_, p) =&gt; Console.WriteLine($"  chart drew {p}");
ticker.PriceChanged += (_, p) =&gt; { if (p &gt; 100) Console.WriteLine("  alert!"); };
ticker.Update(105);
</code></pre>
