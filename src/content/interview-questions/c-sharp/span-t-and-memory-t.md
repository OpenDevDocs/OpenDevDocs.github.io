---
course: c-sharp
slug: span-t-and-memory-t
experienceLevel: senior
difficulty: hard
tags:
  - memory
  - performance
question: "What are `Span<T>` and `Memory<T>` in C#, and when do you use each?"
answer: |
  `Span<T>` is a **view over contiguous memory**: a reference plus a length. It can point into an array, a slice of a string (as `ReadOnlySpan<char>`), a `stackalloc` buffer, or native memory, and it gives all of them one bounds-checked API. Slicing a span creates a new view **without copying or allocating**, which is why span-based parsing avoids the garbage that `Substring` and `Split` produce.

  The catch is that `Span<T>` is a **ref struct**, so it can only live on the stack. It can't be a field in a class, be boxed, be captured by a lambda, or be kept alive across an `await`. Those rules are what make it safe to point at stack memory.

  `Memory<T>` is the heap-friendly counterpart. It can be stored in fields and used across `await`, and you call `.Span` when you need to do the actual work synchronously.

  Guidelines:

  - **Synchronous** APIs and hot loops: accept `Span<T>` or `ReadOnlySpan<T>`.
  - **Asynchronous** APIs, or data you need to keep: accept `Memory<T>` or `ReadOnlyMemory<T>`, as `Stream.ReadAsync(Memory<byte>)` does.
  - Prefer the read-only versions for inputs.
codeExample: |
  using System.Globalization;

  string line = "2026-09-11,ORDER-1001,249.99";
  ReadOnlySpan<char> span = line.AsSpan();

  // Parse fields by slicing: no Substring, no Split, no allocations
  int first = span.IndexOf(',');
  int second = span[(first + 1)..].IndexOf(',') + first + 1;
  ReadOnlySpan<char> id = span[(first + 1)..second];
  decimal amount = decimal.Parse(span[(second + 1)..], CultureInfo.InvariantCulture);
  Console.WriteLine($"{id} {amount}");       // Output: ORDER-1001 249.99

  // It works the same way over stack memory
  Span<int> scratch = stackalloc int[4];
  scratch.Fill(7);
  Console.WriteLine(scratch[3]);             // Output: 7

  // Memory<T> survives across await; take .Span only in synchronous code
  Memory<byte> buffer = new byte[4096];
  await using var file = File.OpenRead("data.bin");
  int read = await file.ReadAsync(buffer);   // the Memory<byte> overload
  Console.WriteLine($"Read {read} bytes");

  // class Holder { Span<int> _s; }           // compile error: ref struct as a field
popularity: 8.6
isPublished: true
---
