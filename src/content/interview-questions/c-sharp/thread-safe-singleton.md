---
course: c-sharp
slug: thread-safe-singleton
experienceLevel: mid
difficulty: medium
tags:
  - design
  - threading
question: "How do you implement a thread-safe singleton in C#?"
answer: |
  A singleton guarantees a single instance, so the danger is two threads creating it at the same time. C# offers several correct options:

  - **Static readonly field:** `public static readonly Config Instance = new();`. The runtime runs type initialization exactly once and makes other threads wait until it finishes, so this is thread-safe with no locks. The instance is created before its first use.
  - **`Lazy<T>`:** `new Lazy<Config>(() => new Config())` defers creation until `.Value` is first read and is thread-safe by default. It's the usual choice when construction is expensive or might not be needed at all.
  - **Double-checked locking:** check for `null`, take a `lock`, and check again. It works when written carefully, but it's easy to get subtly wrong and offers nothing over `Lazy<T>`, so avoid hand-rolling it.

  In modern applications, prefer a regular class registered with `AddSingleton` in the DI container. You still get one instance, but without a static access point, so consumers stay testable. Remember that a singleton is shared global state: its own members must be thread-safe too.
codeExample: |
  var (s1, s2) = (AppSettings.Instance, AppSettings.Instance);
  Console.WriteLine(object.ReferenceEquals(s1, s2));  // Output: True

  Parallel.For(0, 10, i => _ = ReportCache.Instance); // many threads, one instance
  Console.WriteLine(ReportCache.CreatedCount);        // Output: 1

  public sealed class AppSettings
  {
      // Option 1: static readonly field, initialized once by the runtime
      public static readonly AppSettings Instance = new();
      private AppSettings() { }
  }

  public sealed class ReportCache
  {
      // Option 2: Lazy<T>, thread-safe by default, created on first .Value
      private static readonly Lazy<ReportCache> _lazy = new(() => new ReportCache());
      public static ReportCache Instance => _lazy.Value;
      public static int CreatedCount;

      private ReportCache() => Interlocked.Increment(ref CreatedCount);
  }

  // Option 3 (preferred in apps): a normal class + services.AddSingleton<T>()
popularity: 8.8
isPublished: true
---
