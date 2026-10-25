---
course: c-sharp
slug: is-vs-as-operators
experienceLevel: fresher
difficulty: easy
tags:
  - types
question: "What is the difference between the `is` and `as` operators in C#?"
answer: |
  Both deal with runtime type checks, but they return different things.

  - `is` **tests** a type and returns a `bool`. Since C# 7, `obj is Customer c` also declares a typed variable that is assigned only when the test succeeds. It never throws, and `null` never matches.
  - `as` **attempts a cast** and returns `null` on failure instead of throwing. Because of that, it only works with reference types and nullable value types.

  A direct cast like `(Customer)obj` throws `InvalidCastException` on a mismatch, which is what you want when a wrong type means a bug.

  The modern recommendation is `if (obj is Customer c)`. It checks and casts in one step and works with value types too. The classic pitfall with `as` is skipping the null check, which turns a clear cast error into a confusing `NullReferenceException` later.
codeExample: |
  object?[] items = ["hello", 42, null, new Customer("Ada")];

  foreach (object? item in items)
  {
      if (item is Customer c)                 // test + cast in one step
          Console.WriteLine($"Customer {c.Name}");
      else if (item is int n)                 // works with value types too
          Console.WriteLine($"Number {n}");
  }
  // Output: Customer Ada
  //         Number 42

  object obj = "hello";
  Customer? maybe = obj as Customer;          // no exception, just null
  Console.WriteLine(maybe is null);           // Output: True
  // int x = obj as int;                      // compile error: int can't be null
  int? y = obj as int?;                       // OK: nullable value type

  try { var cust = (Customer)obj; }           // direct cast
  catch (InvalidCastException) { Console.WriteLine("Cast failed"); }
  // Output: Cast failed

  record Customer(string Name);
popularity: 8.1
isPublished: true
---
