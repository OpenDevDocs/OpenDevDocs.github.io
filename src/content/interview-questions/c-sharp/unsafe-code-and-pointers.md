---
course: c-sharp
slug: unsafe-code-and-pointers
experienceLevel: senior
difficulty: hard
tags:
  - memory
question: "When is `unsafe` code justified in C#, and what are the risks?"
answer: |
  An `unsafe` context, enabled with `<AllowUnsafeBlocks>true</AllowUnsafeBlocks>`, unlocks C-style features: pointer types (`int*`), the address-of operator (`&`), pointer arithmetic, `sizeof` on any unmanaged type, and the **`fixed`** statement, which **pins** a managed object so the GC can't move it while you hold a pointer to it.

  It can be justified for:

  - **Native interop** with APIs that take raw pointers or complex memory layouts.
  - **Measured hot paths**, such as image processing or parsing, where removing bounds checks or reinterpreting memory produces a real, benchmarked gain.
  - **Working with native or memory-mapped memory** that the GC doesn't manage.

  The risks are the ones C programmers know: **memory corruption**, buffer overruns, dangling pointers, and type confusion. They don't surface as clean exceptions, but as random crashes or security holes later. Long or frequent pinning also **fragments the heap**.

  In modern .NET, you rarely need `unsafe` for performance. `Span<T>` and `stackalloc` without pointers, `MemoryMarshal` for reinterpreting bytes, the `Unsafe` class for targeted operations, and `Vector<T>` or hardware intrinsics for SIMD usually match pointer code while staying mostly safe. When you do use `unsafe`, isolate it in small, well-tested methods and review it like security-sensitive code.
codeExample: |
  int[] data = Enumerable.Range(1, 1_000).ToArray();
  Console.WriteLine(SumUnsafe(data));   // Output: 500500
  Console.WriteLine(SumSafe(data));     // Output: 500500

  // Unsafe: pin the array, then walk it with a raw pointer (no bounds checks)
  static unsafe long SumUnsafe(int[] values)
  {
      long sum = 0;
      fixed (int* start = values)       // pinned: the GC can't move the array
      {
          for (int* p = start, end = start + values.Length; p < end; p++)
              sum += *p;
      }
      return sum;
  }

  // Safe alternative: a span loop, where the JIT can remove bounds checks
  static long SumSafe(ReadOnlySpan<int> values)
  {
      long sum = 0;
      foreach (int v in values) sum += v;
      return sum;
  }
popularity: 6.8
isPublished: true
---
