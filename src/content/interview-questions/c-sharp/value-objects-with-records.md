---
course: c-sharp
slug: value-objects-with-records
experienceLevel: senior
difficulty: medium
tags:
  - design
  - modern-csharp
question: "How do you implement a DDD value object in C#?"
answer: |
  A **value object** is defined entirely by its values, not by an identity: two `Money(10, "EUR")` instances are interchangeable. In Domain-Driven Design, value objects are **immutable**, **compared by value**, and **self-validating**, so an invalid instance can't exist. Typical examples are `Money`, `Email`, and `DateRange`. They cure "primitive obsession", where raw `string` and `decimal` values invite mix-ups like adding amounts in different currencies.

  C# **records** are a natural fit, because they generate value equality, `GetHashCode`, and immutable properties with very little code. A `readonly record struct` works well for small values and avoids allocations.

  Implementation guidelines:

  - **Validate in one place:** the constructor, or a static factory such as `Email.Create(input)`.
  - **Add behavior**, such as `Money.Add`, so domain rules live with the data.
  - **Beware `with` expressions** on positional records: `email with { Value = "junk" }` copies the object and sets the property without running the constructor, which bypasses validation. For validated types, use a private constructor with get-only properties, or validate inside `init` accessors.

  With EF Core, map value objects as **owned types** or, since EF Core 8, **complex types**, so they're stored as columns of the owning entity.
codeExample: |
  var price = Money.Of(19.99m, "EUR");
  var total = price.Add(Money.Of(5m, "EUR"));
  Console.WriteLine(total);                             // Output: 24.99 EUR
  Console.WriteLine(price == Money.Of(19.99m, "EUR"));  // Output: True (value equality)

  // price.Add(Money.Of(5m, "USD"));  // throws: currency mismatch (a domain rule)
  // Money.Of(-1m, "EUR");            // throws: invalid values can't exist

  public sealed record Money
  {
      public decimal Amount { get; }           // get-only: 'with' can't bypass validation
      public string Currency { get; }
      private Money(decimal amount, string currency) =>
          (Amount, Currency) = (amount, currency);
      public static Money Of(decimal amount, string currency)
      {
          ArgumentOutOfRangeException.ThrowIfNegative(amount);
          if (currency is not { Length: 3 }) throw new ArgumentException("3-letter code");
          return new Money(decimal.Round(amount, 2), currency.ToUpperInvariant());
      }
      public Money Add(Money other) => other.Currency == Currency
          ? new Money(Amount + other.Amount, Currency)
          : throw new InvalidOperationException("Currency mismatch");
      public override string ToString() => $"{Amount} {Currency}";
  }
popularity: 6.9
isPublished: true
---
