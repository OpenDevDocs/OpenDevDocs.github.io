---
course: c-sharp
slug: readonly-immutable-frozen-collections
experienceLevel: senior
difficulty: hard
tags:
  - collections
  - performance
question: "What is the difference between read-only, immutable, and frozen collections in .NET?"
answer: |
  They offer three different guarantees.

  **Read-only** wrappers and interfaces, such as `ReadOnlyCollection<T>`, `list.AsReadOnly()`, and `IReadOnlyList<T>`, only restrict **your view**. The underlying collection can still change through another reference. They protect encapsulation, not stability or thread safety.

  **Immutable** collections (`System.Collections.Immutable`) **never change after creation**. "Mutating" methods like `Add` return a **new** collection that shares most of its structure with the old one, so they're inherently thread-safe and ideal for snapshots and lock-free state swaps.

  - `ImmutableList<T>` and `ImmutableDictionary<TKey, TValue>` are balanced trees with O(log n) operations, slower to read than mutable ones.
  - `ImmutableArray<T>` is a thin struct over an array. Reads are as fast as an array's, but every change copies the whole array.
  - Use builders, created with `ToBuilder()` or `CreateBuilder()`, to batch many changes efficiently.

  **Frozen** collections (.NET 8), `FrozenDictionary<TKey, TValue>` and `FrozenSet<T>`, are immutable and **optimized for read speed**. Creation is relatively expensive, because it analyzes the keys to pick the fastest lookup strategy, but lookups afterward are faster than a regular `Dictionary`. They're ideal for configuration and lookup tables built once at startup and read on every request.
codeExample: |
  using System.Collections.Frozen;
  using System.Collections.Immutable;

  // Read-only: a view, so changes to the source show through
  var source = new List<string> { "a" };
  IReadOnlyList<string> view = source.AsReadOnly();
  source.Add("b");
  Console.WriteLine(view.Count);               // Output: 2

  // Immutable: "changes" return new instances; the original never changes
  ImmutableList<string> v1 = ImmutableList.Create("a");
  ImmutableList<string> v2 = v1.Add("b");      // shares structure with v1
  Console.WriteLine($"{v1.Count} {v2.Count}"); // Output: 1 2

  var builder = ImmutableArray.CreateBuilder<int>();   // batch changes cheaply
  for (int i = 0; i < 1_000; i++) builder.Add(i);
  ImmutableArray<int> numbers = builder.ToImmutable();

  // Frozen (.NET 8): costly to build once, fastest for repeated reads
  FrozenDictionary<string, int> statusCodes = new Dictionary<string, int>
  {
      ["OK"] = 200, ["NotFound"] = 404, ["ServerError"] = 500
  }.ToFrozenDictionary(StringComparer.OrdinalIgnoreCase);
  Console.WriteLine(statusCodes["notfound"]);  // Output: 404
popularity: 6.8
isPublished: true
---
