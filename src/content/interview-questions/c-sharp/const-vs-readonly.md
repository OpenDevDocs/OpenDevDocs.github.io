---
course: c-sharp
slug: const-vs-readonly
experienceLevel: fresher
difficulty: easy
tags:
  - types
  - basics
question: "What is the difference between `const` and `readonly` in C#?"
answer: |
  Both prevent reassignment, but a `const` is fixed at **compile time**, while a `readonly` field is set at **runtime**, during initialization.

  - `const` must be initialized in its declaration, is implicitly `static`, and is limited to numeric types, `bool`, `char`, `string`, enums, and `null`.
  - `readonly` can be assigned in its declaration or in a constructor, can be instance or `static`, and works with any type.

  Use `const` for true constants like `DaysInWeek`. Use `static readonly` for values computed at startup or with non-constant types, such as a `TimeSpan` or a `Regex`.

  Two pitfalls: the compiler copies a `const` value into every assembly that uses it, so changing a public `const` in a library has no effect on consumers until they recompile. And `readonly` protects only the field, not the object: a `readonly List<int>` can't be replaced, but you can still add items to it.
codeExample: |
  Console.WriteLine(Limits.DaysInWeek);   // Output: 7
  Console.WriteLine(Limits.Timeout);      // Output: 00:00:30

  var cart = new Cart();
  cart.Items.Add("Book");                 // allowed: the list itself is mutable
  // cart.Items = new List<string>();     // compile error: readonly field
  Console.WriteLine(cart.Items.Count);    // Output: 1

  public static class Limits
  {
      public const int DaysInWeek = 7;    // baked into callers at compile time
      // public const TimeSpan Bad = TimeSpan.FromSeconds(30); // compile error
      public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);
  }

  public class Cart
  {
      public readonly List<string> Items;
      public readonly DateTime CreatedAt = DateTime.UtcNow;

      public Cart() => Items = new List<string>(); // constructor may assign
  }
popularity: 9.0
isPublished: true
---
