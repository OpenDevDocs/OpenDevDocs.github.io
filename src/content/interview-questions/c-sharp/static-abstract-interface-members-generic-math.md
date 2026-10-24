---
course: c-sharp
slug: static-abstract-interface-members-generic-math
experienceLevel: senior
difficulty: hard
tags:
  - generics
  - modern-csharp
question: "What are static abstract interface members in C#, and how do they enable generic math?"
answer: |
  Before C# 11, interfaces could only describe **instance** members, so generic code had no way to call a static method or an operator on `T`. You couldn't write one `Sum<T>` that worked for `int`, `double`, and `decimal`; you needed an overload per type.

  **Static abstract members** (C# 11, .NET 7) let an interface require implementing types to provide **static** members, including **operators**. Generic code constrained to such an interface can then call `T.Zero`, `T.Parse(...)`, or `a + b` directly. The calls resolve per type argument, and for value types the JIT specializes them, so there's no boxing or virtual dispatch.

  .NET 7 used this to build **generic math**: the numeric types implement interfaces in `System.Numerics` such as `INumber<TSelf>`, `IAdditionOperators<TSelf, TOther, TResult>`, and `IAdditiveIdentity<TSelf, TResult>`. A single method constrained with `where T : INumber<T>` now works for every built-in numeric type, including `Half` and `Int128`, and for your own types.

  Beyond math, the feature enables **static factory contracts**, such as a `static abstract T Create(string input)`, and it powers `IParsable<T>` and `ISpanParsable<T>`.

  One restriction: static abstract members are accessed through a type parameter, not through the interface itself, because the interface has no implementation to call.
codeExample: |
  using System.Numerics;
  Console.WriteLine(Sum<int>([1, 2, 3]));            // Output: 6
  Console.WriteLine(Sum<double>([1.5, 2.5]));        // Output: 4
  Console.WriteLine(Sum<decimal>([0.1m, 0.2m]));     // Output: 0.3
  Console.WriteLine(Sum<Money>([new(5), new(7)]));   // Output: Money { Cents = 12 }
  Console.WriteLine(Average<double>([2, 4, 9]));     // Output: 5

  // Works for any T that defines + and a zero, including your own types
  static T Sum<T>(ReadOnlySpan<T> values)
      where T : IAdditionOperators<T, T, T>, IAdditiveIdentity<T, T>
  {
      T total = T.AdditiveIdentity;        // a static abstract property
      foreach (T v in values) total += v;  // a static abstract operator
      return total;
  }
  // INumber<T> bundles arithmetic, comparison, parsing, and conversions
  static T Average<T>(ReadOnlySpan<T> values) where T : INumber<T> =>
      Sum(values) / T.CreateChecked(values.Length);

  record struct Money(long Cents) : IAdditionOperators<Money, Money, Money>,
                                    IAdditiveIdentity<Money, Money>
  {
      public static Money operator +(Money a, Money b) => new(a.Cents + b.Cents);
      public static Money AdditiveIdentity => new(0);
  }
popularity: 6.8
isPublished: true
---
