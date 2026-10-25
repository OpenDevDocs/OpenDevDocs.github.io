---
course: c-sharp
slug: task-whenall-vs-waitall
experienceLevel: mid
difficulty: medium
tags:
  - async
question: "What is the difference between `Task.WhenAll`, `Task.WaitAll`, and `Task.WhenAny`?"
answer: |
  All three coordinate several tasks, but they differ in blocking and in what they wait for.

  - `Task.WhenAll(tasks)` returns a **new task** that completes when all the input tasks complete. You `await` it, so no thread is blocked while waiting. With `Task<T>` inputs, awaiting it gives you a `T[]` of results in input order.
  - `Task.WaitAll(tasks)` **blocks the calling thread** until every task finishes. It wastes a thread, can deadlock on a UI or legacy ASP.NET thread, and wraps failures in an `AggregateException`. Avoid it in async code.
  - `Task.WhenAny(tasks)` returns a task that completes as soon as **any one** input task completes, and hands you that task. Use it for timeouts or racing requests; `WaitAny` is its blocking twin.

  To get real concurrency, **start** all the tasks first and then await them together. Awaiting each one right after creating it runs them sequentially.

  When several tasks fail, `await Task.WhenAll(...)` rethrows only the first exception, so inspect the returned task's `Exception` property to see them all. .NET 9 also added `Task.WhenEach`, which yields tasks as they complete.
codeExample: |
  using System.Diagnostics;

  var sw = Stopwatch.StartNew();

  // Start all three first, then await them together: ~1 s total, not ~3 s
  Task<string> a = LoadAsync("users", 1000);
  Task<string> b = LoadAsync("orders", 1000);
  Task<string> c = LoadAsync("stock", 1000);
  string[] results = await Task.WhenAll(a, b, c);
  Console.WriteLine($"{string.Join(", ", results)} in ~{sw.Elapsed.TotalSeconds:F0}s");
  // Output: users, orders, stock in ~1s

  // WhenAny: race the real work against a timeout
  Task<string> slow = LoadAsync("report", 5000);
  Task winner = await Task.WhenAny(slow, Task.Delay(500));
  Console.WriteLine(winner == slow ? "Report ready" : "Timed out"); // Output: Timed out

  // Task.WaitAll(a, b, c);   // blocks the thread: avoid in async code

  static async Task<string> LoadAsync(string name, int ms)
  {
      await Task.Delay(ms);
      return name;
  }
popularity: 8.1
isPublished: true
---
