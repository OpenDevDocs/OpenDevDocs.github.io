---
course: c-sharp
slug: static-constructors-and-type-initialization
experienceLevel: senior
difficulty: hard
tags:
  - clr
question: "How do static constructors and type initialization work in .NET?"
answer: |
  A **static constructor**, `static MyType() { ... }`, initializes a type's static state. The runtime guarantees it runs **at most once per type**, and once **per closed generic type**. It runs before the first instance is created or any static member is accessed.

  It's also **thread-safe**: if several threads trigger initialization at once, one runs the static constructor and the others block until it finishes. That guarantee is what makes `static readonly` singletons safe without locks.

  If the static constructor **throws**, the runtime wraps the error in a `TypeInitializationException`, and the type stays **permanently unusable** for the rest of the process.

  **`beforefieldinit`** is a subtle detail. If a type has static field initializers but **no explicit static constructor**, the compiler marks it `beforefieldinit`, which allows the runtime to run initialization at any time before the first static field access, possibly earlier than you expect. Adding an explicit static constructor, even an empty one, removes the flag and gives precise "on first use" timing, at a small performance cost.

  Also, circular dependencies between static constructors can **deadlock** when two threads initialize the types in opposite orders. Keep static constructors trivial: no I/O and no blocking.
codeExample: |
  Console.WriteLine("Start");
  Console.WriteLine(Config.Name);        // the static constructor runs just before this
  Console.WriteLine(Config.Name);        // ...and only once
  // Output: Start, Static constructor, ProdConfig, ProdConfig (one per line)
  for (int i = 1; i <= 2; i++)
  {
      try { _ = Broken.Value; }
      catch (TypeInitializationException) { Console.WriteLine($"Attempt {i} failed"); }
  }   // the type stays unusable for the life of the process
  Console.WriteLine(Cache<int>.Created != Cache<string>.Created); // Output: True
  static class Config
  {
      public static readonly string Name;
      static Config()                    // explicit: no beforefieldinit, precise timing
      {
          Console.WriteLine("Static constructor");
          Name = "ProdConfig";
      }
  }
  static class Broken
  {
      public static readonly int Value;
      static Broken() => Value = int.Parse("oops");   // throws; remembered forever
  }
  static class Cache<T> { public static readonly Guid Created = Guid.NewGuid(); } // per T
popularity: 6.2
isPublished: true
---
