---
course: c-sharp
slug: high-performance-string-handling
experienceLevel: senior
difficulty: hard
tags:
  - strings
  - performance
question: "How do you write allocation-efficient string-processing code in modern C#?"
answer: |
  Strings are immutable, so naive code allocates constantly: every `Substring`, `Split`, `Replace`, `ToLower`, and concatenation creates a new string. In hot paths, those allocations dominate. Modern .NET offers alternatives:

  - **Slice instead of copying:** `text.AsSpan(start, length)` gives a `ReadOnlySpan<char>` view with no allocation. Parsing APIs accept spans, such as `int.Parse(span)` and `span.IndexOf(',')`.
  - **Build strings efficiently:** `string.Create(length, state, (span, s) => ...)` writes directly into the final string's memory. For unknown lengths, reuse a presized `StringBuilder`, or format into a `stackalloc` buffer with `TryFormat`.
  - **Interpolated string handlers** (C# 10): `$"..."` now formats values directly into a pooled buffer, with no boxing and no intermediate strings. `destination.TryWrite(...)` formats an interpolation straight into a span.
  - **Cache the work:** `CompositeFormat.Parse` (.NET 8) pre-parses a repeated format string, and `SearchValues<char>` (.NET 8) precomputes an optimized search for `IndexOfAny`.
  - **Stay in UTF-8** when the data is UTF-8 anyway: `"..."u8` literals (C# 11) and `Utf8JsonWriter` avoid transcoding.
  - **Compare ordinally** with `StringComparison.Ordinal`. It's faster and allocation-free, unlike `ToLower()` comparisons.

  Measure with `[MemoryDiagnoser]` to confirm the allocations actually disappear.
codeExample: |
  using System.Buffers;
  string csv = "  id=42; name=Ada; role=admin  ";

  // Slice and parse without Substring/Split allocations
  ReadOnlySpan<char> line = csv.AsSpan().Trim();
  int eq = line.IndexOf('=');
  int semi = line.IndexOf(';');
  int id = int.Parse(line[(eq + 1)..semi]);
  Console.WriteLine(id);                              // Output: 42

  // SearchValues (.NET 8): a precomputed, vectorized IndexOfAny
  SearchValues<char> separators = SearchValues.Create(";=");
  Console.WriteLine(line.IndexOfAny(separators));     // Output: 2

  // string.Create: write straight into the new string's memory
  string label = string.Create(5, id, (span, value) =>
  {
      "ID".AsSpan().CopyTo(span);
      value.TryFormat(span[2..], out _);             // "42" into the same buffer
      span[4] = '!';
  });
  Console.WriteLine(label);                           // Output: ID42!
  // Format into a stack buffer instead of allocating a string
  Span<char> buffer = stackalloc char[32];
  buffer.TryWrite($"User {id} at {DateTime.UtcNow:HH:mm}", out int written);
popularity: 7.0
isPublished: true
---
