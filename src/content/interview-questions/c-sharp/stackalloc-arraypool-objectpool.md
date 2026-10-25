---
course: c-sharp
slug: stackalloc-arraypool-objectpool
experienceLevel: senior
difficulty: hard
tags:
  - memory
  - performance
question: "How do `stackalloc`, `ArrayPool<T>`, and object pooling reduce GC pressure?"
answer: |
  All three avoid short-lived heap allocations in hot paths, which means fewer garbage collections and steadier latency.

  **`stackalloc`** allocates a buffer on the **stack**. It's freed automatically when the method returns, with no GC involvement, and assigned to a `Span<T>` it needs no `unsafe` code. Keep it **small**, typically well under a kilobyte: stack space is limited, and a large or input-sized `stackalloc` can crash the process with a `StackOverflowException`, which can't be caught.

  **`ArrayPool<T>.Shared`** lends out arrays that you return when you're done. The rules matter:

  - `Rent(n)` may return a **larger** array than requested, so track the length you actually use.
  - The array may contain **old data** from a previous renter.
  - Return it **exactly once**, in a `finally` block, and never touch it afterward. Pass `clearArray: true` for sensitive data.

  A common hybrid pattern uses `stackalloc` for small sizes and falls back to the pool for large ones.

  **Object pooling**, such as `ObjectPool<T>` from `Microsoft.Extensions.ObjectPool`, reuses expensive objects like `StringBuilder` instances or parsers, resetting them on return.

  Pooling adds complexity and invites subtle bugs like use-after-return, so apply it where a profiler shows allocation pressure, not everywhere.
codeExample: |
  using System.Buffers;

  Console.WriteLine(Checksum("hello world"));           // small input: stack buffer
  Console.WriteLine(Checksum(new string('x', 10_000))); // large input: pooled buffer

  static int Checksum(string text)
  {
      const int StackLimit = 256;
      byte[]? rented = null;
      Span<byte> buffer = text.Length <= StackLimit
          ? stackalloc byte[StackLimit]                         // no heap allocation
          : (rented = ArrayPool<byte>.Shared.Rent(text.Length)); // may be larger
      try
      {
          int length = System.Text.Encoding.ASCII.GetBytes(text, buffer);
          int sum = 0;
          foreach (byte b in buffer[..length]) sum += b;        // use only 'length'
          return sum;
      }
      finally
      {
          if (rented is not null) ArrayPool<byte>.Shared.Return(rented); // exactly once
      }
  }
popularity: 7.6
isPublished: true
---
