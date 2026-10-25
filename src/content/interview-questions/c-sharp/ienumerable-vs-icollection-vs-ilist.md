---
course: c-sharp
slug: ienumerable-vs-icollection-vs-ilist
experienceLevel: mid
difficulty: medium
tags:
  - collections
question: "What is the difference between `IEnumerable<T>`, `ICollection<T>`, and `IList<T>`?"
answer: |
  They form a hierarchy, and each level adds capabilities:

  - `IEnumerable<T>`: **iteration only**, forward and read-only, through `foreach`. It may be lazy, like a LINQ query or an iterator, so it doesn't promise a count, and enumerating it twice can do the work twice.
  - `ICollection<T>`: adds `Count`, `Add`, `Remove`, `Contains`, and `Clear`, for a modifiable, in-memory group of items.
  - `IList<T>`: adds **index-based access**: an indexer, `IndexOf`, `Insert`, and `RemoveAt`. `List<T>` and arrays implement it.

  There are read-only counterparts too: `IReadOnlyCollection<T>` adds only `Count`, and `IReadOnlyList<T>` adds `Count` plus an indexer.

  API design guidance:

  - **Parameters:** accept the least specific type you need, often `IEnumerable<T>`, so callers can pass anything.
  - **Return types:** return something that tells callers what they can rely on. `IReadOnlyList<T>` is a good default for materialized data that callers shouldn't modify.

  A classic pitfall: arrays implement `IList<T>`, but calling `Add` on one throws `NotSupportedException`, because arrays have a fixed size.
codeExample: |
  int[] numbers = [3, 1, 2];

  IEnumerable<int> seq = numbers;        // iterate only
  Console.WriteLine(seq.Count());        // Output: 3 (LINQ Count() extension)

  ICollection<int> col = new List<int>(numbers);
  col.Add(4);                            // count + modification
  Console.WriteLine(col.Count);          // Output: 4

  IList<int> list = new List<int>(numbers);
  list.Insert(0, 9);                     // index-based operations
  Console.WriteLine(list[0]);            // Output: 9

  IList<int> arrayAsList = numbers;
  // arrayAsList.Add(5);                 // throws NotSupportedException: fixed size

  Console.WriteLine(Sum(numbers));       // Output: 6 (any sequence works)
  IReadOnlyList<string> names = GetNames();
  Console.WriteLine(names[0]);           // Output: Ada

  static int Sum(IEnumerable<int> values) => values.Sum();     // least specific in
  static IReadOnlyList<string> GetNames() => ["Ada", "Grace"]; // read-only out
popularity: 8.5
isPublished: true
---
