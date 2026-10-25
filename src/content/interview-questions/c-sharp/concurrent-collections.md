---
course: c-sharp
slug: concurrent-collections
experienceLevel: mid
difficulty: medium
tags:
  - collections
  - threading
question: "What are concurrent collections, and when should you use `ConcurrentDictionary<TKey, TValue>`?"
answer: |
  The standard collections, such as `List<T>` and `Dictionary<TKey, TValue>`, aren't safe to modify from multiple threads at once: concurrent writes can corrupt their internal state. The `System.Collections.Concurrent` namespace provides thread-safe alternatives that need no external `lock`:

  - `ConcurrentDictionary<TKey, TValue>`: fine-grained locking for writes and lock-free reads.
  - `ConcurrentQueue<T>` and `ConcurrentStack<T>`: lock-free FIFO and LIFO collections.
  - `ConcurrentBag<T>`: an unordered collection optimized for threads that both add and remove items.
  - `BlockingCollection<T>`: a producer/consumer wrapper that blocks consumers until items arrive.

  The key rule is to use the **atomic methods** instead of check-then-act sequences. `if (!dict.ContainsKey(k)) dict[k] = v;` is still a race, even on a `ConcurrentDictionary`, because another thread can act between the two calls. Use `TryAdd`, `GetOrAdd`, `AddOrUpdate`, `TryUpdate`, and `TryRemove`.

  Use `ConcurrentDictionary` for shared caches, counters, and registries updated by many threads. Skip it for single-threaded data, or for data built once and then only read, where immutable or frozen collections fit better.
codeExample: |
  using System.Collections.Concurrent;

  var hits = new ConcurrentDictionary<string, int>();
  string[] pages = ["/home", "/about", "/home", "/home", "/about"];

  Parallel.ForEach(pages, page =>
  {
      // Atomic read-modify-write: safe across threads
      hits.AddOrUpdate(page, 1, (_, count) => count + 1);
  });

  Console.WriteLine(hits["/home"]);     // Output: 3
  Console.WriteLine(hits["/about"]);    // Output: 2

  // A race even on a concurrent dictionary: two separate calls
  // if (!hits.ContainsKey(key)) hits[key] = 0;
  hits.TryAdd("/contact", 0);           // one atomic call instead

  var queue = new ConcurrentQueue<int>();
  Parallel.For(0, 100, queue.Enqueue);
  Console.WriteLine(queue.Count);       // Output: 100
popularity: 7.9
isPublished: true
---
