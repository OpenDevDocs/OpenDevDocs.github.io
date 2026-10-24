---
course: c-sharp
slug: limiting-concurrency-in-async-code
experienceLevel: senior
difficulty: hard
tags:
  - async
  - threading
question: "How do you limit concurrency when processing thousands of items asynchronously?"
answer: |
  Firing everything at once with `await Task.WhenAll(items.Select(ProcessAsync))` starts **every** operation immediately. With 10,000 HTTP calls, that can exhaust sockets and connection pools, trip rate limits, overload the downstream service, and spike memory. You need **bounded concurrency**.

  Options:

  - **`Parallel.ForEachAsync`** (.NET 6) is the built-in answer. Set `MaxDegreeOfParallelism`, pass a `CancellationToken`, and write an async body.
  - **`SemaphoreSlim`**: wrap each operation in `await semaphore.WaitAsync()` plus a `try`/`finally` that calls `Release()`. It works with `Task.WhenAll` and gives fine-grained control.
  - **Channels with N consumers** suit pipelines and continuous streams, where producers and consumers run at different speeds and you want backpressure.
  - **`System.Threading.RateLimiting`** (.NET 7) fits when the constraint is requests per time window rather than simultaneous requests, as with a third-party API quota.

  A classic bug is `Parallel.ForEach(items, async item => ...)`. The lambda becomes `async void`, so `Parallel.ForEach` returns before the work finishes and exceptions go unobserved. Use `Parallel.ForEachAsync` for async bodies.

  Choose the limit based on downstream capacity, not the CPU count.
codeExample: |
  var urls = Enumerable.Range(1, 1_000).Select(i => $"https://api.example.com/items/{i}");
  using var http = new HttpClient();

  // Built-in bounded concurrency (.NET 6+): at most 8 requests in flight
  await Parallel.ForEachAsync(urls,
      new ParallelOptions { MaxDegreeOfParallelism = 8 },
      async (url, ct) =>
      {
          using var response = await http.GetAsync(url, ct);
          // process the response...
      });

  // The same limit with SemaphoreSlim, for Task.WhenAll or partial limits
  using var gate = new SemaphoreSlim(initialCount: 8);
  var tasks = urls.Select(async url =>
  {
      await gate.WaitAsync();
      try { return await http.GetStringAsync(url); }
      finally { gate.Release(); }             // always release, even on failure
  });
  string[] bodies = await Task.WhenAll(tasks);

  // Bug: the async lambda becomes async void, so ForEach returns too early
  // Parallel.ForEach(urls, async url => await http.GetAsync(url));
popularity: 8.0
isPublished: true
---
