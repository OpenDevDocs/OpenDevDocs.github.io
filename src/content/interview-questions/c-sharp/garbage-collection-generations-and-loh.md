---
course: c-sharp
slug: garbage-collection-generations-and-loh
experienceLevel: mid
difficulty: medium
tags:
  - memory
  - performance
question: "How do GC generations (Gen 0, Gen 1, Gen 2) and the Large Object Heap work in .NET?"
answer: |
  The .NET garbage collector is **generational**, because most objects die young.

  - **Gen 0** holds newly allocated small objects. It's collected often, and collections are cheap because most of its objects are already garbage.
  - **Gen 1** receives objects that survive a Gen 0 collection.
  - **Gen 2** holds long-lived objects, such as caches and singletons. A Gen 2 collection is a **full** collection of every generation, the most expensive kind.

  Survivors are **promoted** to the next generation.

  Objects of **85,000 bytes or more**, typically large arrays, go on the **Large Object Heap (LOH)**. The LOH is logically part of Gen 2, so it's collected only during full collections, and by default it isn't compacted. That can cause fragmentation. You can request a one-time compaction with `GCSettings.LargeObjectHeapCompactionMode`. Since .NET 5, pinned objects can also go on a separate Pinned Object Heap.

  Practical takeaways: avoid "mid-life crisis" objects that survive just long enough to reach Gen 2 and then die, and reuse large buffers with `ArrayPool<T>` instead of allocating them repeatedly.
codeExample: |
  object young = new object();
  Console.WriteLine(GC.GetGeneration(young));   // Output: 0 (freshly allocated)

  GC.Collect();                                 // demo only: never do this in production
  Console.WriteLine(GC.GetGeneration(young));   // Output: 1 (survived one collection)

  GC.Collect();
  Console.WriteLine(GC.GetGeneration(young));   // Output: 2 (long-lived now)

  var small = new byte[84_000];
  var large = new byte[85_000];                 // >= 85,000 bytes: Large Object Heap
  Console.WriteLine(GC.GetGeneration(small));   // Output: 0
  Console.WriteLine(GC.GetGeneration(large));   // Output: 2 (the LOH counts as Gen 2)

  // Reuse big buffers instead of allocating new ones each time
  byte[] buffer = System.Buffers.ArrayPool<byte>.Shared.Rent(1_000_000);
  System.Buffers.ArrayPool<byte>.Shared.Return(buffer);

  Console.WriteLine($"Gen0={GC.CollectionCount(0)} Gen2={GC.CollectionCount(2)}");
popularity: 8.7
isPublished: true
---
