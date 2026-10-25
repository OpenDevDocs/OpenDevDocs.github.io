---
course: c-sharp
slug: linq-groupby-and-join
experienceLevel: mid
difficulty: medium
tags:
  - linq
question: "How do `GroupBy` and `Join` work in LINQ?"
answer: |
  **`GroupBy`** splits a sequence into groups that share a key. It returns `IEnumerable<IGrouping<TKey, TElement>>`: each group has a `Key` property and is itself a sequence of its elements, so you usually project it right away with aggregates like `g.Count()` or `g.Sum(...)`. To group by several fields, use an anonymous type or a tuple as the key.

  **`Join`** is an **inner join**: it pairs elements from two sequences whose keys are equal, and elements without a partner are dropped. In LINQ to Objects it builds a hash lookup of the inner sequence, so it runs in roughly linear time.

  For a **left outer join**, the classic pattern is `GroupJoin` followed by `SelectMany` with `DefaultIfEmpty()`. .NET 10 adds dedicated `LeftJoin` and `RightJoin` operators that express this directly.

  With EF Core, both translate to SQL: `GroupBy` with aggregates becomes `GROUP BY`, and `Join` becomes `INNER JOIN`. In practice, navigation properties often make explicit joins unnecessary.
codeExample: |
  Customer[] customers = [new(1, "Ada"), new(2, "Bob"), new(3, "Cy")];
  Order[] orders = [new(1, 50m), new(1, 25m), new(2, 10m)];

  // GroupBy: one group per customer ID, then aggregate each group
  foreach (var g in orders.GroupBy(o => o.CustomerId))
      Console.WriteLine($"Customer {g.Key}: {g.Count()} orders, {g.Sum(o => o.Amount)}");
  // Output: Customer 1: 2 orders, 75
  //         Customer 2: 1 orders, 10

  // Join: an inner join, so Cy (no orders) disappears
  var joined = customers.Join(orders,
      c => c.Id, o => o.CustomerId,
      (c, o) => $"{c.Name}: {o.Amount}");
  Console.WriteLine(string.Join(", ", joined)); // Output: Ada: 50, Ada: 25, Bob: 10

  // Left join the classic way: GroupJoin + DefaultIfEmpty keeps Cy
  var left = customers
      .GroupJoin(orders, c => c.Id, o => o.CustomerId, (c, os) => new { c, os })
      .SelectMany(x => x.os.DefaultIfEmpty(), (x, o) => $"{x.c.Name}: {o?.Amount ?? 0}");
  Console.WriteLine(string.Join(", ", left));
  // Output: Ada: 50, Ada: 25, Bob: 10, Cy: 0

  record Customer(int Id, string Name);
  record Order(int CustomerId, decimal Amount);
popularity: 7.6
isPublished: true
---
