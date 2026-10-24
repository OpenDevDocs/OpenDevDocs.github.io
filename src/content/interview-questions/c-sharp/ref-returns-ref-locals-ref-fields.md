---
course: c-sharp
slug: ref-returns-ref-locals-ref-fields
experienceLevel: senior
difficulty: hard
tags:
  - memory
  - performance
question: "What are `ref` returns, `ref` locals, and `ref` fields in C#?"
answer: |
  They let you work with a **reference to storage** instead of a copy of the value, which matters for large structs and in-place updates.

  - A **`ref` return** (C# 7) hands the caller a reference to existing storage, such as an array element.
  - A **`ref` local** is an alias for a storage location: `ref Particle p = ref particles[i];` lets you update the element in place.
  - **`ref readonly`** returns and locals give read-only access without copying.

  The compiler enforces **safety rules** (escape analysis) so a reference never outlives its storage. You can't return a `ref` to a local, for example.

  **`ref` fields** (C# 11) let a `ref struct` store a reference as a field, which is how `Span<T>` is implemented. The `scoped` keyword restricts a reference so it can't escape the current method.

  The BCL uses these features in high-performance APIs. `CollectionsMarshal.AsSpan(list)` exposes a `List<T>`'s backing array as a span, and `CollectionsMarshal.GetValueRefOrAddDefault(dictionary, key, out exists)` returns a `ref` to a dictionary value, so a counter update needs one hash lookup instead of two. Don't change the collection's size while holding such a reference.
codeExample: |
  using System.Runtime.InteropServices;
  // ref return + ref local: update an array element in place, with no struct copy
  var particles = new Particle[3];
  ref Particle first = ref FindFastest(particles);
  first.Speed = 99;
  Console.WriteLine(particles[0].Speed);       // Output: 99 (the array was modified)

  // One hash lookup per word instead of TryGetValue plus an indexer set
  var counts = new Dictionary<string, int>();
  foreach (var word in "to be or not to be".Split(' '))
  {
      ref int count = ref CollectionsMarshal.GetValueRefOrAddDefault(counts, word, out _);
      count++;                                  // writes straight into the dictionary
  }
  Console.WriteLine(counts["be"]);             // Output: 2

  static ref Particle FindFastest(Particle[] items)
  {
      int best = 0;
      for (int i = 1; i < items.Length; i++)
          if (items[i].Speed > items[best].Speed) best = i;
      return ref items[best];                   // a reference to the element itself
      // returning ref to a local variable here would be a compile error
  }
  struct Particle { public double X, Y, Z, Speed; }
popularity: 6.5
isPublished: true
---
