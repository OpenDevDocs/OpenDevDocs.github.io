---
course: c-sharp
slug: solid-principles
experienceLevel: mid
difficulty: medium
tags:
  - design
question: "What are the SOLID principles, and how do they apply to C#?"
answer: |
  SOLID is five design principles for keeping object-oriented code easy to change:

  - **S, Single Responsibility:** a class should have one reason to change. An `InvoiceService` shouldn't also render PDFs and send emails.
  - **O, Open/Closed:** open for extension, closed for modification. Add behavior by writing a new class that implements an interface, not by editing an ever-growing `switch`.
  - **L, Liskov Substitution:** a subtype must work anywhere its base type is expected. A read-only list that throws from an inherited `Add` breaks its callers.
  - **I, Interface Segregation:** prefer small, focused interfaces (`IReader`, `IWriter`) over one fat interface that forces empty or throwing implementations.
  - **D, Dependency Inversion:** high-level code depends on abstractions, not concrete classes. Inject an `IPaymentGateway` through the constructor instead of calling `new StripeGateway()`.

  In .NET, these principles meet in practice through interfaces plus constructor injection with the built-in DI container. Apply them pragmatically: the goal is code that's easy to change and test, not the maximum number of interfaces.
codeExample: |
  // Open/Closed + Dependency Inversion: add discounts without editing Checkout
  public interface IDiscount
  {
      decimal Apply(decimal total);
  }

  public class SeasonalDiscount : IDiscount
  {
      public decimal Apply(decimal total) => total * 0.9m;
  }

  public class LoyaltyDiscount : IDiscount     // new behavior = a new class
  {
      public decimal Apply(decimal total) => total - 5m;
  }

  public class Checkout(IEnumerable<IDiscount> discounts) // depends on abstractions
  {
      public decimal Total(decimal subtotal) =>
          discounts.Aggregate(subtotal, (total, d) => d.Apply(total));
  }

  // new Checkout([new SeasonalDiscount(), new LoyaltyDiscount()]).Total(100m)
  // Output: 85.0
popularity: 9.3
isPublished: true
---
