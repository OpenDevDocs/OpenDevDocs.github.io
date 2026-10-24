---
course: c-sharp
slug: generics-implementation-in-the-clr
experienceLevel: senior
difficulty: hard
tags:
  - generics
  - clr
question: "How are generics implemented in the CLR, and how does that differ from Java's type erasure?"
answer: |
  .NET generics are **reified**: type arguments are real at runtime, not just a compile-time check. `List<int>` and `List<string>` are distinct runtime types, `typeof(T)` works inside generic code, and `new T()` works with the `new()` constraint.

  IL is compiled once with open type parameters, and the **JIT** then creates native code per instantiation, with a key distinction:

  - **Value-type arguments** get their own specialized native code. `List<int>` stores raw `int` values with no boxing, and the JIT can fully optimize operations on `T`.
  - **Reference-type arguments** share one native implementation, using a canonical form (`System.__Canon`), because all references have the same size. When shared code needs something type-specific, like `typeof(T)` or creating a `T[]`, it looks it up through a runtime generic dictionary, at a small cost.

  Static fields are stored **per closed type**: `Cache<int>.Count` and `Cache<string>.Count` are separate fields, and each closed type runs its own static constructor.

  Java uses **type erasure**: generic type information is removed at compile time, so a `List<Integer>` is just a `List` at runtime. That forces boxing for primitives and forbids `new T()`, `T.class`, and `instanceof List<String>`. .NET avoids all of these limits.
codeExample: |
  Console.WriteLine(Describe<int>());           // Output: Int32 (reified at runtime)
  Console.WriteLine(Describe<string>());        // Output: String

  Counter<int>.Increment();
  Counter<int>.Increment();
  Counter<string>.Increment();
  Console.WriteLine(Counter<int>.Count);        // Output: 2 (a separate static field)
  Console.WriteLine(Counter<string>.Count);     // Output: 1

  Console.WriteLine(typeof(List<int>) == typeof(List<string>)); // Output: False
  object list = new List<int>();
  Console.WriteLine(list is List<string>);      // Output: False (real runtime type)

  static string Describe<T>() => typeof(T).Name; // impossible under Java-style erasure

  static class Counter<T>
  {
      public static int Count;                   // one per closed type
      public static void Increment() => Count++;
  }
popularity: 7.4
isPublished: true
---
