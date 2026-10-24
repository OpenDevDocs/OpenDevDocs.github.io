---
course: c-sharp
slug: object-memory-layout
experienceLevel: senior
difficulty: hard
tags:
  - clr
  - memory
question: "What does a .NET object look like in memory, and what does that mean for performance?"
answer: |
  On 64-bit .NET, every reference-type object carries **16 bytes of overhead** before its fields:

  - An **object header** (8 bytes), stored just before the address a reference points to. It holds thin-lock information, an index into the sync block table when a `lock` needs more state, or the cached default hash code.
  - A **MethodTable pointer** (8 bytes), at the address the reference points to. It identifies the object's exact type and leads to the virtual method table, interface map, and type metadata. Type checks, casts, and virtual calls all start here.

  The fields follow, and the runtime may **reorder** them in classes to reduce padding. The minimum object size is **24 bytes**, even for an empty class, and arrays additionally store their length.

  Performance consequences:

  - **Many tiny objects are expensive:** a class wrapping a single `int` costs 24 bytes plus GC tracking. For large counts, structs or arrays of primitives are far denser.
  - **Locality:** an array of `Point` structs is one contiguous block that caches well, while an array of `Point` classes is an array of pointers to objects scattered around the heap.
  - **Boxing** a value type pays the full object overhead for every box.
codeExample: |
  // 64-bit sizes: header + MethodTable pointer + fields, 8-byte aligned
  Console.WriteLine(Measure(() => new object()));              // Output: 24
  Console.WriteLine(Measure(() => new Wrapper { Value = 1 })); // Output: 24 (one int)
  Console.WriteLine(Measure(() => new int[0]));                // Output: 24 (length)

  // Locality: structs are stored inline; classes are pointers to scattered objects
  var dense = new PointStruct[1_000_000];   // one ~8 MB block
  var sparse = new PointClass[1_000_000];   // 8 MB of references...
  for (int i = 0; i < sparse.Length; i++)
      sparse[i] = new PointClass();         // ...plus 1,000,000 separate 24-byte objects

  static long Measure(Func<object> create)
  {
      const int N = 100_000;
      var keep = new object[N];
      long before = GC.GetAllocatedBytesForCurrentThread();
      for (int i = 0; i < N; i++) keep[i] = create();
      long after = GC.GetAllocatedBytesForCurrentThread();
      GC.KeepAlive(keep);
      return (after - before) / N;
  }

  class Wrapper { public int Value; }
  struct PointStruct { public int X, Y; }
  class PointClass { public int X, Y; }
popularity: 6.8
isPublished: true
---
