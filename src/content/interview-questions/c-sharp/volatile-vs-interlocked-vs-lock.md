---
course: c-sharp
slug: volatile-vs-interlocked-vs-lock
experienceLevel: senior
difficulty: hard
tags:
  - threading
question: "What is the difference between `volatile`, `Interlocked`, and `lock` in C#?"
answer: |
  They solve different parts of the concurrency problem: **visibility and ordering**, **atomicity**, and **mutual exclusion**.

  **`volatile`**, or the explicit `Volatile.Read` and `Volatile.Write` methods, guarantees that each read sees a fresh value and prevents the compiler, JIT, and CPU from reordering memory operations across it (acquire/release semantics). It does **not** make compound operations atomic: `_count++` on a volatile field is still a read, an add, and a write that another thread can interleave. It fits simple flags, like a stop signal.

  **`Interlocked`** provides **atomic** operations on a single variable: `Increment`, `Decrement`, `Add`, `Exchange`, and `CompareExchange`. They're lock-free and fast, and they include full memory barriers. `CompareExchange` enables lock-free updates: swap only if the value hasn't changed since you read it, otherwise retry.

  **`lock`** gives **mutual exclusion** over an arbitrary block of code, so you can keep **several** variables consistent together, such as a balance plus a transaction history. It's heavier, but it's the easiest to reason about.

  Rule of thumb: use the lightest tool that's still correct. A flag gets `volatile`, a counter gets `Interlocked`, and multi-field invariants get a `lock`. When in doubt, use `lock`.
codeExample: |
  var stats = new Stats();
  Parallel.For(1, 1_001, i => stats.Record(i));
  Console.WriteLine($"{stats.Count} {stats.Max}");   // Output: 1000 1000

  public class Stats
  {
      private int _count;
      private int _max;
      private volatile bool _closed;                  // a flag: visibility is enough
      public int Count => Volatile.Read(ref _count);
      public int Max => Volatile.Read(ref _max);
      public void Close() => _closed = true;
      public void Record(int value)
      {
          if (_closed) return;
          Interlocked.Increment(ref _count);          // atomic counter, lock-free
          int current;                                // lock-free max: retry on conflict
          do
          {
              current = _max;
              if (value <= current) return;
          } while (Interlocked.CompareExchange(ref _max, value, current) != current);
      }
      // _count++ would lose updates here, even on a volatile field
  }
popularity: 7.8
isPublished: true
---
