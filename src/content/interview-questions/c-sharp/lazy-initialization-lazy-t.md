---
course: c-sharp
slug: lazy-initialization-lazy-t
experienceLevel: mid
difficulty: medium
tags:
  - performance
  - threading
question: "What is `Lazy<T>` in C#, and when would you use it?"
answer: |
  `Lazy<T>` defers creating an object until it's **first needed**. You give it a factory, and the factory runs the first time someone reads `.Value`. Every later read returns the same cached instance, and `IsValueCreated` tells you whether that has happened yet.

  Use it when an object is **expensive** to create (a large lookup table, a heavy client) and may never be used on some code paths. It's also a clean way to write a thread-safe singleton.

  Thread safety is controlled by `LazyThreadSafetyMode`:

  - `ExecutionAndPublication` (the default): the factory runs **once**, even under concurrent access, and other threads wait for its result.
  - `PublicationOnly`: several threads may run the factory at the same time, and the first result to finish wins.
  - `None`: no synchronization. It's the fastest option, for single-threaded use only.

  A subtle pitfall: in the default mode, if the factory **throws**, the exception is cached, and every later `.Value` rethrows it without retrying. Use `PublicationOnly` if you need retries. For async initialization, a `Lazy<Task<T>>` works, and for fields there's the lighter `LazyInitializer.EnsureInitialized`.
codeExample: |
  var report = new Lazy<ExpensiveReport>(() =>
  {
      Console.WriteLine("Building report...");
      return new ExpensiveReport();
  });

  Console.WriteLine(report.IsValueCreated);    // Output: False (nothing built yet)
  Console.WriteLine(report.Value.Title);       // Output: Building report...
                                               //         Quarterly report
  Console.WriteLine(report.Value.Title);       // Output: Quarterly report (cached)

  // Exception caching in the default mode: the factory is never retried
  int attempts = 0;
  var flaky = new Lazy<string>(() => { attempts++; throw new TimeoutException(); });
  for (int i = 0; i < 3; i++)
  {
      try { _ = flaky.Value; } catch (TimeoutException) { }
  }
  Console.WriteLine(attempts);                 // Output: 1

  class ExpensiveReport
  {
      public string Title { get; } = "Quarterly report";
  }
popularity: 7.0
isPublished: true
---
