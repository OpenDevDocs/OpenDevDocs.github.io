---
course: c-sharp
slug: recent-csharp-features
experienceLevel: senior
difficulty: medium
tags:
  - modern-csharp
question: "What are the most notable language features added in C# 12, 13, and 14?"
answer: |
  Highlights by version:

  **C# 12 (.NET 8)**

  - **Primary constructors** for classes and structs, not just records.
  - **Collection expressions:** `int[] a = [1, 2, 3];`, with the spread operator `..` to combine sequences.
  - Default values for lambda parameters, `using` aliases for any type, and inline arrays for fixed-size buffers.

  **C# 13 (.NET 9)**

  - **`params` collections:** `params` now works with `Span<T>`, `ReadOnlySpan<T>`, `List<T>`, and interfaces like `IEnumerable<T>`, not just arrays.
  - Support for the new **`System.Threading.Lock`** type in `lock` statements.
  - `ref` locals and `unsafe` code in async methods and iterators, plus ref structs that implement interfaces and the `allows ref struct` anti-constraint.
  - **Partial properties**, useful for source generators.

  **C# 14 (.NET 10)**

  - **Extension members:** new `extension` blocks that add extension **properties** and static members, not just methods.
  - The **`field` keyword**, which lets a property accessor use the compiler-generated backing field without declaring it.
  - **Null-conditional assignment:** `customer?.Name = "Ada";`.
  - `nameof` with unbound generic types, such as `nameof(List<>)`, implicit span conversions, and partial constructors and events.

  In an interview, mention the ones you've actually used and why they helped.
codeExample: |
  // C# 12: collection expressions and spread
  int[] odds = [1, 3, 5];
  List<int> all = [.. odds, 7, 9];

  // C# 13: params collections accept spans, so this call allocates no array
  Console.WriteLine(Sum(1, 2, 3));                     // Output: 6
  static int Sum(params ReadOnlySpan<int> values)
  {
      int total = 0;
      foreach (int v in values) total += v;
      return total;
  }
  // C# 14: null-conditional assignment and an extension property
  Person? person = null;
  person?.Name = "Ada";                                // skipped: person is null
  Console.WriteLine("  ".IsBlank);                     // Output: True

  public class Person(string name)                     // C# 12: primary constructor
  {
      public string Name { get; set => field = value.Trim(); } = name; // C# 14: field
  }
  public static class StringExtensions                 // C# 14: extension members
  {
      extension(string s) { public bool IsBlank => string.IsNullOrWhiteSpace(s); }
  }
popularity: 8.0
isPublished: true
---
