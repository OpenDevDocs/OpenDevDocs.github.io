---
course: c-sharp
slug: nullable-value-types
experienceLevel: fresher
difficulty: easy
tags:
  - types
question: "What are nullable value types (`int?`), and how do you work with them?"
answer: |
  A **nullable value type** can hold either a value or `null`. `int?` is shorthand for `Nullable<int>`, a struct that pairs the value with a flag. Use it for optional data, such as a nullable database column.

  Ways to work with one:

  - `HasValue` checks for a value, and `Value` returns it but throws `InvalidOperationException` if there is none.
  - `GetValueOrDefault()` returns the value or the type's default.
  - `??` provides a fallback: `age ?? 18`.
  - `is int n` tests and unwraps in one step.
  - **Lifted operators** propagate null: `5 + null` is `null`, and relational comparisons like `<` return `false` when either side is null.

  Converting `int` to `int?` is implicit. Going back needs an explicit cast, which throws if the value is null.

  This differs from **nullable reference types** (C# 8), where `string?` is only a compile-time annotation, not a different runtime type.
codeExample: |
  int? age = null;
  Console.WriteLine(age.HasValue);            // Output: False
  Console.WriteLine(age.GetValueOrDefault()); // Output: 0
  Console.WriteLine(age ?? 18);               // Output: 18

  // int a = age.Value;     // throws InvalidOperationException at runtime
  // int b = age;           // compile error: needs an explicit cast

  int? next = age + 1;       // lifted operator: null + 1 is null
  Console.WriteLine(next is null);            // Output: True
  Console.WriteLine(age > 10);                // Output: False

  age = 30;                  // implicit conversion from int to int?
  if (age is int years)      // test and unwrap in one step
  {
      Console.WriteLine(years + 1);           // Output: 31
  }
popularity: 8.0
isPublished: true
---
