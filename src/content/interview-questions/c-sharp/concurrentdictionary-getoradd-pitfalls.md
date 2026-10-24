---
course: c-sharp
slug: concurrentdictionary-getoradd-pitfalls
experienceLevel: senior
difficulty: hard
tags:
  - threading
  - collections
question: "Is `ConcurrentDictionary.GetOrAdd` completely thread-safe? What is the catch?"
answer: |
  The dictionary itself is always consistent: `GetOrAdd` never corrupts state, and all callers for a key end up with the **same stored value**. The catch is the **value factory**. `ConcurrentDictionary` invokes `valueFactory` **outside its locks**, so if several threads miss the same key at the same moment, the factory can run **multiple times concurrently**. Only one result is stored, and the others are silently discarded.

  That's harmless for cheap, pure factories. It's a real bug when the factory:

  - Is **expensive**, such as a database query or an HTTP call, so a cache stampede multiplies the load.
  - Has **side effects**, such as sending a message.
  - Creates **disposable** objects, because the discarded instances are never disposed.

  The standard fix is to store `Lazy<T>` values: `dict.GetOrAdd(key, k => new Lazy<T>(() => Create(k))).Value`. Losing `Lazy<T>` instances are cheap to discard, and the stored one runs the real factory exactly once.

  The same applies to `AddOrUpdate`, whose update delegate can be retried under contention. Also be aware that `Count`, `Keys`, `Values`, and `ToArray()` acquire **all** internal locks, so avoid them in hot paths. Enumeration is safe, but it isn't a point-in-time snapshot.
codeExample: |
  using System.Collections.Concurrent;

  int factoryRuns = 0;
  var cache = new ConcurrentDictionary<string, string>();
  Parallel.For(0, 8, i =>
      cache.GetOrAdd("report", key =>
      {
          Interlocked.Increment(ref factoryRuns);   // a side effect in the factory
          Thread.Sleep(100);                        // expensive work
          return $"{key} data";
      }));
  Console.WriteLine(factoryRuns);   // Output: often more than 1 (the factory raced)

  // Fix: store Lazy<T>; only the stored Lazy runs the real factory
  int lazyRuns = 0;
  var safeCache = new ConcurrentDictionary<string, Lazy<string>>();
  Parallel.For(0, 8, i =>
      _ = safeCache.GetOrAdd("report", key => new Lazy<string>(() =>
      {
          Interlocked.Increment(ref lazyRuns);
          Thread.Sleep(100);
          return $"{key} data";
      })).Value);
  Console.WriteLine(lazyRuns);      // Output: 1
popularity: 7.2
isPublished: true
---
