---
course: c-sharp
slug: any-vs-count
experienceLevel: mid
difficulty: easy
tags:
  - linq
  - performance
question: "Why is `Any()` usually better than `Count() > 0` for checking whether a sequence has elements?"
answer: |
  Because `Any()` answers the question you're actually asking: it stops at the **first** element it finds, while `Count()` may have to walk the **entire** sequence just so you can compare the total with zero.

  How much that matters depends on the source:

  - **Lazy sequences** (LINQ queries and iterators): `Count()` enumerates everything, which can be slow or re-run expensive work, while `Any()` takes at most one step.
  - **Collections** like `List<T>` and arrays: LINQ's `Count()` detects `ICollection<T>` and reads the count directly, so it's fast. But then you should simply use the `Count` or `Length` property, which is what the CA1860 analyzer recommends over calling `Any()`.
  - **EF Core** (`IQueryable<T>`): `Any()` translates to `EXISTS`, which the database can stop evaluating early, while `Count()` becomes `COUNT(*)` over every matching row.

  With a condition, prefer `Any(predicate)` over `Where(predicate).Any()` for readability; both stop at the first match.
codeExample: |
  bool viaAny = Numbers().Any();             // prints 1 dot
  Console.WriteLine();
  bool viaCount = Numbers().Count() > 0;     // prints 10 dots
  Console.WriteLine();

  var list = new List<int> { 1, 2, 3 };
  Console.WriteLine(list.Count > 0);         // best for collections: O(1) property

  // EF Core translation:
  // db.Orders.Any(o => o.Total > 100)       -> SELECT CASE WHEN EXISTS (...) ...
  // db.Orders.Count(o => o.Total > 100) > 0 -> SELECT COUNT(*) FROM Orders WHERE ...

  static IEnumerable<int> Numbers()          // an iterator that shows its work
  {
      for (int i = 1; i <= 10; i++)
      {
          Console.Write(".");
          yield return i;
      }
  }
popularity: 7.7
isPublished: true
---
