---
course: c-sharp
slug: what-is-garbage-collection
experienceLevel: fresher
difficulty: easy
tags:
  - memory
question: "What is garbage collection in .NET, and how does it work at a high level?"
answer: |
  **Garbage collection (GC)** is automatic memory management for the managed heap. You allocate objects with `new`, and the garbage collector frees their memory once nothing can use them anymore, so there's no `delete` or `free`.

  At a high level, a collection works in three steps:

  1. **Mark:** starting from the **roots** (static fields, local variables on the stack, CPU registers, and GC handles), the GC finds every object that's still reachable.
  2. **Sweep:** anything unreachable is garbage, and its memory is reclaimed.
  3. **Compact:** surviving objects are moved together to remove gaps.

  Collections run automatically, typically when allocations cross certain thresholds, so you can't predict exactly when an object is freed. The heap is also divided into generations, which keeps most collections fast.

  The GC only manages memory. Release unmanaged resources, such as files and connections, with `IDisposable`, and avoid calling `GC.Collect()` yourself.
codeExample: |
  MakeGarbage();
  Console.WriteLine($"Heap in use: {GC.GetTotalMemory(false):N0} bytes");

  // Gen 0 collections happen often and are cheap
  Console.WriteLine($"Gen 0 collections so far: {GC.CollectionCount(0)}");

  static void MakeGarbage()
  {
      for (int i = 0; i < 100_000; i++)
      {
          // Each array becomes unreachable as soon as the loop moves on,
          // so the GC can reclaim it at the next collection.
          var temp = new byte[1_024];
      }
  }

  // Unmanaged resources still need deterministic cleanup:
  // using var file = File.OpenRead("data.bin");
popularity: 8.9
isPublished: true
---
