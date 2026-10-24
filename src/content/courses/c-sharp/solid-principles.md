---
publishDate: 2026-04-26T11:47
title: SOLID Principles
slug: solid-principles
metadescription: Apply the five SOLID principles in C# with before and after examples for single responsibility, open closed, Liskov substitution, interface segregation and dependency inversion.
updateDate: 2026-09-05T11:47
author: ['bishal-biswas']
level: 4
tags: ['design', 'solid', 'architecture']
course: c-sharp
---

## Why principles

Code that works today still has to be changed tomorrow. The SOLID principles are five guidelines that make change cheaper. They are not rules to apply blindly. Each one addresses a specific way code becomes hard to modify, and knowing the failure it prevents tells you when it applies.

## S: Single Responsibility

**A class should have one reason to change.**

This class has three:

```csharp
class ReportService
{
    public Report Build(int orderId)
    {
        var order = Database.Query($"SELECT * FROM Orders WHERE Id = {orderId}");   // data access
        var report = new Report { Total = order.Lines.Sum(l => l.Price) };          // business logic
        File.WriteAllText($"report-{orderId}.pdf", RenderPdf(report));              // output format
        return report;
    }
}
```

If the database changes, the PDF library changes, or the calculation changes, this file changes. Three teams fight over one class. Split it by responsibility:

```csharp
class OrderRepository
{
    public Order Get(int id) => /* data access only */;
}

class ReportBuilder
{
    public Report Build(Order order) => new Report { Total = order.Lines.Sum(l => l.Price) };
}

class PdfExporter
{
    public void Save(Report report, string path) => File.WriteAllText(path, RenderPdf(report));
}
```

Each class is small, testable on its own and changes for exactly one reason. "Responsibility" means a reason to change, not a single method. A class with ten methods that all serve one purpose is fine.

## O: Open Closed

**Open for extension, closed for modification.** You should be able to add behaviour without editing existing, tested code.

This class must be edited every time a new discount appears:

```csharp
class PriceCalculator
{
    public decimal Apply(decimal price, string customerType) => customerType switch
    {
        "regular" => price,
        "silver" => price * 0.95m,
        "gold" => price * 0.90m,
        // every new tier is a change here, and in every other switch like it
        _ => throw new ArgumentException()
    };
}
```

Extract the varying part behind an abstraction:

```csharp
interface IDiscount
{
    decimal Apply(decimal price);
}

class NoDiscount : IDiscount { public decimal Apply(decimal p) => p; }
class SilverDiscount : IDiscount { public decimal Apply(decimal p) => p * 0.95m; }
class GoldDiscount : IDiscount { public decimal Apply(decimal p) => p * 0.90m; }

class PriceCalculator
{
    public decimal Apply(decimal price, IDiscount discount) => discount.Apply(price);
}
```

A platinum tier is now a new class. `PriceCalculator` is never touched again. Polymorphism and the strategy pattern are how C# achieves this.

## L: Liskov Substitution

**A subclass must be usable anywhere its base class is, without surprises.**

The classic violation:

```csharp
class Rectangle
{
    public virtual int Width { get; set; }
    public virtual int Height { get; set; }
    public int Area => Width * Height;
}

class Square : Rectangle
{
    public override int Width { set { base.Width = value; base.Height = value; } }
    public override int Height { set { base.Width = value; base.Height = value; } }
}

void Stretch(Rectangle r)
{
    r.Width = 5;
    r.Height = 10;
    Console.WriteLine(r.Area);   // 50 expected, but a Square prints 100
}
```

`Square` is a `Rectangle` in geometry, but not in behaviour. Code written against `Rectangle` breaks when handed a `Square`. The fix is to not inherit. Make both implement an `IShape` with an `Area` and no setters that conflict.

Warning signs: an override that throws `NotSupportedException`, an override that ignores its parameters, or a subclass that needs callers to check its type.

## I: Interface Segregation

**Clients should not depend on methods they do not use.**

```csharp
interface IWorker
{
    void Work();
    void Eat();
    void Sleep();
}

class Robot : IWorker
{
    public void Work() { }
    public void Eat() => throw new NotSupportedException();   // forced to implement nonsense
    public void Sleep() => throw new NotSupportedException();
}
```

Split fat interfaces into focused ones:

```csharp
interface IWorkable { void Work(); }
interface IFeedable { void Eat(); }
interface IRestable { void Sleep(); }

class Human : IWorkable, IFeedable, IRestable { /* all three */ }
class Robot : IWorkable { public void Work() { } }
```

A method that only needs to make things work takes `IWorkable`, and a `Robot` fits. Small interfaces are also easier to fake in tests. .NET follows this: `IEnumerable<T>` has one method, `IDisposable` has one method.

## D: Dependency Inversion

**High level code should depend on abstractions, not on low level details.**

```csharp
class OrderService
{
    private readonly SqlOrderRepository repo = new();       // concrete
    private readonly SmtpEmailSender email = new();         // concrete

    public void Place(Order order)
    {
        repo.Save(order);
        email.Send(order.CustomerEmail, "Thanks!");
    }
}
```

`OrderService` cannot be tested without a SQL database and a mail server, and cannot switch to a different store without editing. Invert it. Depend on interfaces and receive them from outside:

```csharp
interface IOrderRepository { void Save(Order order); }
interface IEmailSender { void Send(string to, string body); }

class OrderService
{
    private readonly IOrderRepository repo;
    private readonly IEmailSender email;

    public OrderService(IOrderRepository repo, IEmailSender email)
    {
        this.repo = repo;
        this.email = email;
    }

    public void Place(Order order)
    {
        repo.Save(order);
        email.Send(order.CustomerEmail, "Thanks!");
    }
}
```

Now `OrderService` knows nothing about SQL or SMTP. Tests pass in fakes. Production passes in real ones. The details depend on the abstraction, not the other way round. The next topic, dependency injection, is the mechanism that wires this up.

## How they fit together

The principles reinforce each other. Single responsibility produces small classes. Small classes have small interfaces. Depending on those interfaces gives you inversion. Inversion lets you extend without modifying. Substitutability keeps all of it honest.

## When to stop

Every abstraction has a cost: another file, another indirection, another thing to name. A three line script does not need five interfaces. Apply a principle when you feel the pain it prevents: a class that changes for many reasons, a switch that grows forever, a test that needs a database. Refactor towards SOLID when the code tells you to, not before.

## Quick recap

- **S**ingle responsibility: one reason to change per class.
- **O**pen closed: add behaviour with new classes, not by editing old ones.
- **L**iskov substitution: subclasses must honour the base class's promises.
- **I**nterface segregation: many small interfaces beat one fat one.
- **D**ependency inversion: depend on interfaces and receive them from outside.
- Apply them in response to real pain, not as a checklist.

<code id="code-content" class="language-csharp">
// SOLID principles in C#
record Order(string CustomerEmail, decimal Total, string Tier);
// S: each class has one reason to change
interface IOrderRepository { void Save(Order order); }           // D: abstractions
interface IEmailSender { void Send(string to, string body); }
interface IDiscount { decimal Apply(decimal price); }             // O: extend with new classes
class NoDiscount : IDiscount { public decimal Apply(decimal p) =&gt; p; }
class GoldDiscount : IDiscount { public decimal Apply(decimal p) =&gt; p * 0.90m; }
class PlatinumDiscount : IDiscount { public decimal Apply(decimal p) =&gt; p * 0.80m; }   // added without editing anything
class InMemoryOrderRepository : IOrderRepository
{
    public List&lt;Order&gt; Saved { get; } = new();
    public void Save(Order order) =&gt; Saved.Add(order);
}
class ConsoleEmailSender : IEmailSender
{
    public void Send(string to, string body) =&gt; Console.WriteLine($"  email to {to}: {body}");
}
// I: small interfaces, a class implements only what it needs
interface IWorkable { void Work(); }
interface IRestable { void Sleep(); }
class Robot : IWorkable { public void Work() =&gt; Console.WriteLine("  robot working"); }
class Human : IWorkable, IRestable
{
    public void Work() =&gt; Console.WriteLine("  human working");
    public void Sleep() =&gt; Console.WriteLine("  human sleeping");
}
// D: high level service depends on abstractions received from outside
class OrderService
{
    private readonly IOrderRepository repo;
    private readonly IEmailSender email;
    private readonly Func&lt;string, IDiscount&gt; discounts;
    public OrderService(IOrderRepository repo, IEmailSender email, Func&lt;string, IDiscount&gt; discounts)
        =&gt; (this.repo, this.email, this.discounts) = (repo, email, discounts);
    public decimal Place(Order order)
    {
        decimal price = discounts(order.Tier).Apply(order.Total);
        repo.Save(order with { Total = price });
        email.Send(order.CustomerEmail, $"Thanks! You paid {price}");
        return price;
    }
}
// Wiring: choose implementations in one place
IDiscount Pick(string tier) =&gt; tier switch
{
    "gold" =&gt; new GoldDiscount(),
    "platinum" =&gt; new PlatinumDiscount(),
    _ =&gt; new NoDiscount()
};
var repository = new InMemoryOrderRepository();
var service = new OrderService(repository, new ConsoleEmailSender(), Pick);
service.Place(new Order("asha@example.com", 100, "gold"));
service.Place(new Order("ravi@example.com", 100, "platinum"));
Console.WriteLine($"Saved {repository.Saved.Count} orders");
// L: both are substitutable wherever IWorkable is expected
foreach (IWorkable w in new IWorkable[] { new Robot(), new Human() }) w.Work();
</code></pre>
