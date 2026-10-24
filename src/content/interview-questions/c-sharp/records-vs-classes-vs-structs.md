---
course: c-sharp
slug: records-vs-classes-vs-structs
experienceLevel: mid
difficulty: medium
tags:
  - modern-csharp
  - types
question: "What are records in C#, and how do they differ from classes and structs?"
answer: |
  A **record** (C# 9) is a type designed for data. The compiler generates members that classes don't get by default:

  - **Value equality:** two records are equal when their properties are equal, through generated `Equals`, `GetHashCode`, `==`, and `!=`.
  - **`with` expressions** for non-destructive changes: `person with { Age = 31 }` returns a modified copy.
  - A readable `ToString()`, such as `Person { Name = Ada, Age = 30 }`, plus `Deconstruct` for positional records.

  Positional syntax, `record Person(string Name, int Age);`, generates a constructor and init-only properties in one line.

  A plain `record` (or `record class`) is a **reference type**. A `record struct` (C# 10) is a **value type** with the same conveniences. Positional record structs have mutable properties unless you declare them as `readonly record struct`.

  Choose records for DTOs, messages, and immutable value objects. Choose classes for entities with identity and behavior, where two objects with the same data are still different things. Choose structs for small, performance-sensitive values.
codeExample: |
  var ada = new Person("Ada", 30);
  var twin = new Person("Ada", 30);
  Console.WriteLine(ada == twin);        // Output: True (value equality)
  Console.WriteLine(ada);                // Output: Person { Name = Ada, Age = 30 }

  var older = ada with { Age = 31 };     // non-destructive copy
  var (name, age) = older;               // positional deconstruction
  Console.WriteLine($"{name} {age}");    // Output: Ada 31

  var c1 = new Customer { Name = "Ada" };
  var c2 = new Customer { Name = "Ada" };
  Console.WriteLine(c1 == c2);           // Output: False (class: reference equality)

  var p = new Point(1, 2);
  // p.X = 5;                            // compile error: readonly record struct

  public record Person(string Name, int Age);          // reference type
  public readonly record struct Point(int X, int Y);   // value type
  public class Customer { public string Name { get; set; } = ""; }
popularity: 9.0
isPublished: true
---
