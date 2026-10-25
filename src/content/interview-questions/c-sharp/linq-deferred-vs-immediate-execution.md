---
course: c-sharp
slug: linq-deferred-vs-immediate-execution
experienceLevel: mid
difficulty: medium
tags:
  - linq
question: "What is the difference between deferred and immediate execution in LINQ?"
answer: |
  With **deferred execution**, defining a query does no work. Operators such as `Where`, `Select`, `OrderBy`, `Skip`, and `Take` return a query object that describes the pipeline, and the work happens only when something **enumerates** it: a `foreach` loop, or a call that needs the results.

  With **immediate execution**, the operator runs the query right away and returns a concrete result. That includes materializing operators like `ToList`, `ToArray`, and `ToDictionary`, and operators that return a single value, such as `Count`, `Sum`, `Max`, `First`, and `Any`.

  Deferred execution enables composition and laziness, but it causes classic bugs:

  - **Multiple enumeration:** each `foreach` or aggregate re-runs the whole query. With EF Core, that's a new database round trip every time.
  - **Surprising results:** the query sees the source as it is when enumerated, not when defined, including later changes to captured variables.
  - **Late exceptions:** errors surface where the query is enumerated, far from where it was written.

  Materialize once with `ToList()` when you need a stable snapshot or will iterate several times.
codeExample: |
  var numbers = new List<int> { 1, 2, 3 };
  int threshold = 1;

  var query = numbers.Where(n => n > threshold);  // deferred: nothing runs yet
  var snapshot = query.ToList();                  // immediate: runs now

  numbers.Add(4);          // change the source...
  threshold = 2;           // ...and a captured variable

  Console.WriteLine(string.Join(", ", query));    // Output: 3, 4 (re-evaluated)
  Console.WriteLine(string.Join(", ", snapshot)); // Output: 2, 3 (frozen result)

  // Multiple enumeration: the Where lambda runs again on every pass
  int calls = 0;
  var tracked = numbers.Where(n => { calls++; return n > 2; });
  _ = tracked.Count();     // 4 calls: enumerates everything
  _ = tracked.Any();       // 3 calls: stops at the first match
  Console.WriteLine(calls);                       // Output: 7
popularity: 9.1
isPublished: true
---
