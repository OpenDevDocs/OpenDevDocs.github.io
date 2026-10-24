---
course: c-sharp
slug: primary-constructors
experienceLevel: mid
difficulty: medium
tags:
  - modern-csharp
question: "What are primary constructors in C# 12, and how do they differ between classes and records?"
answer: |
  A **primary constructor** declares constructor parameters directly after the type name, as in `public class OrderService(IOrderRepository repo, ILogger<OrderService> logger)`. Records have had them since C# 9, and C# 12 brought them to all classes and structs.

  The key difference is what the parameters become:

  - In a **record**, each positional parameter becomes a public `init`-only property, plus `Deconstruct` and value equality.
  - In a **class or struct**, the parameters are just parameters that stay **in scope throughout the type body**. They don't become properties or public fields. If a member uses one, the compiler captures it in a hidden private field.

  Details worth knowing for classes:

  - Captured parameters are mutable and can't be marked `readonly`. Assign one to a `readonly` field or property if you need that guarantee.
  - Every other constructor must chain to the primary constructor with `: this(...)`.
  - Don't both capture a parameter and copy it into a field. That stores the value twice, and the compiler warns about it (CS9124).

  Their most popular use is DI in services, where they remove field-plus-constructor boilerplate.
codeExample: |
  var service = new OrderService(new InMemoryRepo(), maxItems: 3);
  Console.WriteLine(service.Place("Book"));   // Output: Placed Book (1/3)

  var dto = new OrderDto(1, "Book");
  Console.WriteLine(dto.Item);                // Output: Book (a real property)
  // Console.WriteLine(service.repo);         // compile error: not a member

  public class OrderService(IOrderRepository repo, int maxItems)
  {
      public int MaxItems { get; } = maxItems;        // copied into a property
      public string Place(string item)                // 'repo' captured implicitly
      {
          repo.Add(item);
          return $"Placed {item} ({repo.Count}/{MaxItems})";
      }
  }

  public record OrderDto(int Id, string Item);        // public init properties
  public interface IOrderRepository { void Add(string item); int Count { get; } }
  public class InMemoryRepo : IOrderRepository
  {
      private readonly List<string> _items = [];
      public void Add(string item) => _items.Add(item);
      public int Count => _items.Count;
  }
popularity: 7.0
isPublished: true
---
