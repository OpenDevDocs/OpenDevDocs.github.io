---
course: c-sharp
slug: async-streams-iasyncenumerable
experienceLevel: mid
difficulty: medium
tags:
  - async
  - modern-csharp
question: "What are async streams (`IAsyncEnumerable<T>`) in C#, and when should you use them?"
answer: |
  An **async stream** is a sequence whose items arrive **asynchronously, one at a time**. `IAsyncEnumerable<T>` (C# 8) is the async counterpart of `IEnumerable<T>`: the consumer can `await` each next item instead of waiting for the entire collection.

  You **produce** one with an async iterator: a method marked `async` that returns `IAsyncEnumerable<T>` and uses `yield return`, typically after an `await`. You **consume** it with `await foreach`.

  Use it when data arrives in pieces and you want to process each item right away, without buffering everything:

  - Paging through a REST API one page at a time.
  - Streaming rows from a database with EF Core's `AsAsyncEnumerable()`.
  - Returning streamed responses from ASP.NET Core or gRPC.

  For cancellation, mark the iterator's token parameter with `[EnumeratorCancellation]`, and supply a token at the call site with `.WithCancellation(token)`. .NET 10 includes LINQ operators for async streams in the base library (`System.Linq.AsyncEnumerable`), which previously required the `System.Linq.Async` package.
codeExample: |
  using System.Runtime.CompilerServices;
  await foreach (var product in GetProductsAsync())
  {
      Console.WriteLine(product);             // processed as each page arrives
      if (product == "Item 4") break;         // stop early: no further pages fetched
  }
  // Output: Item 1 through Item 4, one per line
  // Cancellation from the call site flows into the iterator's token
  using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(1));
  try
  {
      await foreach (var p in GetProductsAsync().WithCancellation(cts.Token)) { }
  }
  catch (OperationCanceledException) { Console.WriteLine("Timed out"); }

  static async IAsyncEnumerable<string> GetProductsAsync(
      [EnumeratorCancellation] CancellationToken ct = default)
  {
      for (int page = 1; page <= 100; page++)
      {
          await Task.Delay(100, ct);          // simulated HTTP call for one page
          yield return $"Item {page * 2 - 1}";
          yield return $"Item {page * 2}";
      }
  }
popularity: 7.2
isPublished: true
---
