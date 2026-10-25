---
course: c-sharp
slug: linq-performance-pitfalls
experienceLevel: senior
difficulty: hard
tags:
  - linq
  - performance
question: "What are common LINQ performance pitfalls, and when should you avoid LINQ in hot paths?"
answer: |
  LINQ is fast enough for most code, and recent .NET releases have optimized many operators. The real problems come from specific patterns:

  - **Multiple enumeration:** a deferred query runs again every time it's enumerated. Calling `Count()` and then `foreach` on the same query does the work twice, or makes two database round trips with EF Core. Materialize once with `ToList()` when you need the results more than once.
  - **Quadratic lookups:** `orders.Where(o => ids.Contains(o.Id))` with `ids` as a `List<T>` is O(n × m). Build a `HashSet<T>` first.
  - **Sorting to find one item:** `OrderBy(x => x.Price).First()` is O(n log n). Use `MinBy` or `MaxBy` (.NET 6), which are O(n).
  - **Needless materialization:** a `ToList()` in the middle of a chain, or inside a loop, copies entire sequences.
  - **EF Core specifics:** N+1 queries from lazy loading in loops, forgetting `AsNoTracking()` for read-only queries, and calling methods the provider can't translate.

  In **hot paths** that profiling identifies, each LINQ operator costs an iterator allocation and delegate calls. A plain `for` or `foreach` loop over arrays or spans avoids both.

  The rule: write LINQ for clarity, measure with BenchmarkDotNet or a profiler, and rewrite only the hot spots the numbers point to.
codeExample: |
  var orders = Enumerable.Range(1, 100_000).Select(i => new Order(i, i % 500)).ToList();
  var vipIds = Enumerable.Range(1, 1_000).ToList();

  // O(n * m): List.Contains scans the list for every order
  var slow = orders.Where(o => vipIds.Contains(o.CustomerId)).ToList();

  // O(n + m): hash lookups
  var vipSet = vipIds.ToHashSet();
  var fast = orders.Where(o => vipSet.Contains(o.CustomerId)).ToList();

  // An O(n log n) sort just to find one item, vs O(n) MinBy (.NET 6+)
  Order first1 = orders.OrderBy(o => o.CustomerId).First();
  Order first2 = orders.MinBy(o => o.CustomerId)!;

  // Multiple enumeration: this query runs twice
  IEnumerable<Order> query = orders.Where(o => o.CustomerId == 7);
  if (query.Any()) Console.WriteLine(query.Count()); // Output: 200

  // Hot path: a plain loop, with no iterator or delegate allocations
  long sum = 0;
  foreach (var o in orders) sum += o.CustomerId;

  record Order(int Id, int CustomerId);
popularity: 8.0
isPublished: true
---
