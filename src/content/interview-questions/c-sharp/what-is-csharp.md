---
course: c-sharp
slug: what-is-csharp
experienceLevel: fresher
difficulty: easy
tags:
  - basics
question: "What is C#, and what are its key features?"
answer: |
  C# is a modern, general-purpose programming language from Microsoft that runs on .NET. It is object-oriented at its core, with strong support for functional-style code.

  Key features:

  - **Statically typed and type-safe:** the compiler checks types before the program runs, which catches many bugs early.
  - **Object-oriented:** classes, interfaces, inheritance, and encapsulation are built in.
  - **Functional features:** lambdas, LINQ queries, pattern matching, and records.
  - **Managed runtime:** code runs on the CLR, and a garbage collector frees unused memory for you.
  - **Cross-platform:** modern .NET runs on Windows, Linux, and macOS.
  - **Versatile:** web APIs with ASP.NET Core, desktop apps, cloud services, mobile apps with .NET MAUI, and games with Unity.

  The language evolves quickly, with a new version roughly every year alongside each .NET release. C# 14 shipped with .NET 10 in November 2025.
codeExample: |
  // Several C# features in one small program (top-level statements)
  List<Product> products =
  [
      new("Laptop", 1200m),
      new("Mouse", 25m),
      new("Monitor", 300m)
  ];

  // LINQ and lambdas
  var affordable = products.Where(p => p.Price < 500m).OrderBy(p => p.Price);

  foreach (var p in affordable)
  {
      // Pattern matching in a switch expression
      string label = p.Price switch
      {
          < 50m => "budget",
          _ => "standard"
      };
      Console.WriteLine($"{p.Name}: {label}"); // string interpolation
  }
  // Output: Mouse: budget
  //         Monitor: standard

  record Product(string Name, decimal Price); // concise immutable type
popularity: 8.5
isPublished: true
---
