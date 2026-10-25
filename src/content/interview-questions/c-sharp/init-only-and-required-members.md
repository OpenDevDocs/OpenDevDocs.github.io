---
course: c-sharp
slug: init-only-and-required-members
experienceLevel: mid
difficulty: medium
tags:
  - modern-csharp
question: "What are `init`-only setters and `required` members in C#?"
answer: |
  Both let you keep object-initializer syntax, `new Order { Id = 1 }`, while enforcing rules that used to require constructors.

  An **`init` accessor** (C# 9) makes a property settable only during object creation: in a constructor, a field initializer, an object initializer, or a `with` expression. After that it's read-only, so you get immutable objects without writing a constructor for every combination of properties.

  The **`required` modifier** (C# 11) makes the compiler insist that callers set a member in the object initializer. Forgetting it is a compile error (CS9035), not a runtime surprise. It works on properties with `init` or `set`, and on fields.

  If a constructor already sets every required member, mark it with `[SetsRequiredMembers]` so callers using that constructor aren't forced to repeat them.

  Together they suit DTOs and configuration objects: `public required string Name { get; init; }` means "must be provided, and can't change afterward." Note that `required` is a compiler check, so reflection-based code can still skip it.
codeExample: |
  var order = new Order { Id = 42, Customer = "Ada" };  // both required members set
  // var bad = new Order { Id = 1 };   // compile error CS9035: Customer is required
  // order.Id = 7;                     // compile error: init-only after creation

  var copy = order with { Customer = "Grace" };         // init is allowed in 'with'
  Console.WriteLine($"{copy.Id} {copy.Customer}");      // Output: 42 Grace

  var quick = new Order(7, "Linus");   // constructor satisfies required members
  Console.WriteLine(quick.Customer);    // Output: Linus

  public record Order
  {
      public required int Id { get; init; }
      public required string Customer { get; init; }
      public string Notes { get; init; } = "";          // optional, still immutable

      public Order() { }

      [System.Diagnostics.CodeAnalysis.SetsRequiredMembers]
      public Order(int id, string customer) => (Id, Customer) = (id, customer);
  }
popularity: 7.3
isPublished: true
---
