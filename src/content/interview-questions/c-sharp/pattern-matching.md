---
course: c-sharp
slug: pattern-matching
experienceLevel: mid
difficulty: medium
tags:
  - modern-csharp
question: "What is pattern matching in C#, and how do type, property, relational, and list patterns work?"
answer: |
  **Pattern matching** tests a value against a shape and can extract parts of it in the same step. Patterns work in `is` expressions, `switch` statements, and `switch` expressions, and the compiler checks them for type safety and exhaustiveness.

  Key patterns:

  - **Type pattern:** `shape is Circle c` tests the type and declares `c` (C# 7).
  - **Constant pattern:** `status is "Active"` or `x is null`. Use `is not null` for null checks.
  - **Property pattern:** `order is { Status: "Paid", Total: > 100 }` matches on members, and C# 10 allows nested access like `{ Customer.Country: "IN" }`.
  - **Relational and logical patterns (C# 9):** `< 0`, `>= 18 and < 65`, `not null`.
  - **Positional pattern:** `point is (0, 0)` uses deconstruction.
  - **List pattern (C# 11):** `[1, .., var last]` matches a sequence by shape, where the slice `..` matches any number of elements.

  The discard `_` matches anything. Pattern matching replaces chains of `if`, `as`, and casts with declarative rules, and a switch expression warns you when a case isn't covered.
codeExample: |
  Console.WriteLine(Describe(new Order("Paid", 250m)));   // Output: Big paid order
  Console.WriteLine(Describe(new Order("Pending", 20m))); // Output: Pending
  Console.WriteLine(Describe(42));                        // Output: Positive number
  Console.WriteLine(Describe(new[] { 1, 2, 3 })); // Output: Starts with 1, ends with 3
  Console.WriteLine(Describe(null));                      // Output: Nothing

  static string Describe(object? value) => value switch
  {
      null => "Nothing",                                           // constant
      Order { Status: "Paid", Total: > 100 } => "Big paid order",  // property
      Order o => o.Status,                                         // type
      int and > 0 => "Positive number",                            // relational
      int[] and [1, .., var last] => $"Starts with 1, ends with {last}", // list
      _ => "Something else"                                        // discard
  };

  record Order(string Status, decimal Total);
popularity: 8.2
isPublished: true
---
