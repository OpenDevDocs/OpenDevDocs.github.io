---
course: c-sharp
slug: weak-references-and-conditionalweaktable
experienceLevel: senior
difficulty: hard
tags:
  - memory
question: "What are `WeakReference<T>` and `ConditionalWeakTable<TKey, TValue>`, and when would you use them?"
answer: |
  A normal reference keeps its target alive. A **weak reference** lets you point at an object **without preventing the GC from collecting it**.

  **`WeakReference<T>`** wraps a target that you read with `TryGetTarget(out T target)`, which returns `false` once the object has been collected. It suits:

  - **Caches of data you can recreate**, where memory pressure should win over hit rate. Often, `MemoryCache` with size limits is the better tool.
  - **Weak event patterns**, where a publisher must not keep subscribers alive, as with WPF's `WeakEventManager`.

  **`ConditionalWeakTable<TKey, TValue>`** attaches extra data to objects **you don't own**, without extending their lifetime. Keys are held weakly, and each value stays alive only as long as its key does, even if the value references the key. That property, known as ephemeron semantics, is something a `Dictionary` with `WeakReference` keys can't provide. Frameworks use it to attach metadata to arbitrary instances.

  Caveats: collection timing is nondeterministic, so code must handle a missing target at any moment. Weak references also add GC overhead, so don't create them by the thousands.
codeExample: |
  using System.Diagnostics;
  using System.Runtime.CompilerServices;

  var cache = new WeakReference<byte[]>(new byte[1_000_000]);
  Console.WriteLine(cache.TryGetTarget(out _));   // Output: True (still alive)

  GC.Collect();                                   // demo only
  Console.WriteLine(cache.TryGetTarget(out _));   // Output: False (collected)

  // Attach data to objects you don't own, without keeping them alive
  var requestTimes = new ConditionalWeakTable<object, Stopwatch>();
  var request = new object();
  requestTimes.Add(request, Stopwatch.StartNew());

  if (requestTimes.TryGetValue(request, out var watch))
      Console.WriteLine($"Elapsed: {watch.ElapsedMilliseconds} ms");

  request = null!;   // once the key is unreachable, its value is collectible too
popularity: 6.8
isPublished: true
---
