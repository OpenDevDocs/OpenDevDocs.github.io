---
course: c-sharp
slug: task-vs-valuetask
experienceLevel: senior
difficulty: hard
tags:
  - async
  - performance
question: "When should you use `ValueTask<T>` instead of `Task<T>`?"
answer: |
  `Task<T>` is a class, so calling an async method that returns one generally allocates, even when the result is already available. `ValueTask<T>` is a **struct** that wraps either a ready result, a `Task<T>`, or an `IValueTaskSource<T>`. When a method usually **completes synchronously**, such as on a cache hit, returning `ValueTask<T>` avoids that allocation entirely.

  The price is a set of usage restrictions. Because a `ValueTask` may be backed by a pooled object:

  - Await it **only once**.
  - Never await it **concurrently** from multiple consumers.
  - Don't read `.Result` or call `GetAwaiter().GetResult()` until it has completed.
  - Don't store it for later. If you need any of these, call `.AsTask()` once and use the resulting `Task`.

  Guidelines:

  - **Default to `Task`.** It's simpler and safer, and the runtime already caches common completed tasks, such as `Task.CompletedTask` and boolean results.
  - Use `ValueTask<T>` on **hot paths** where synchronous completion is common and profiling shows the allocations matter, or on interfaces whose implementations often complete synchronously, like `Stream.ReadAsync(Memory<byte>)`.
  - Libraries such as sockets and channels also pool the asynchronous path through `IValueTaskSource<T>`.
codeExample: |
  var cache = new PriceCache();
  decimal first = await cache.GetPriceAsync("MSFT");   // miss: truly async
  decimal second = await cache.GetPriceAsync("MSFT");  // hit: no allocation
  Console.WriteLine(second);                           // Output: 420.50

  // Misuse: a ValueTask must be consumed exactly once
  ValueTask<decimal> vt = cache.GetPriceAsync("AAPL");
  decimal a = await vt;
  // decimal b = await vt;               // undefined behavior: awaited twice
  Task<decimal> shareable = cache.GetPriceAsync("AAPL").AsTask(); // convert to reuse

  public class PriceCache
  {
      private readonly Dictionary<string, decimal> _prices = new();
      public ValueTask<decimal> GetPriceAsync(string symbol) =>
          _prices.TryGetValue(symbol, out var price)
              ? ValueTask.FromResult(price)                // sync path: no Task allocated
              : new ValueTask<decimal>(LoadAsync(symbol)); // async path wraps a Task

      private async Task<decimal> LoadAsync(string symbol)
      {
          await Task.Delay(50);                            // simulated network call
          return _prices[symbol] = 420.50m;
      }
  }
popularity: 8.2
isPublished: true
---
