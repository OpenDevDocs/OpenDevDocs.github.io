---
course: c-sharp
slug: cpu-bound-vs-io-bound-async
experienceLevel: mid
difficulty: medium
tags:
  - async
  - performance
question: "When should you use `Task.Run`, and why isn't it needed for I/O-bound work?"
answer: |
  **I/O-bound work** (HTTP calls, database queries, file and network access) spends most of its time waiting on external devices. Truly asynchronous APIs, such as `HttpClient.GetAsync` or `DbContext.SaveChangesAsync`, don't hold a thread while waiting: the OS notifies .NET when the operation completes. Just `await` them. Wrapping them in `Task.Run` only adds a pointless thread hop.

  **CPU-bound work** (image processing, heavy calculations) keeps a thread busy the whole time. `Task.Run` moves that work to the thread pool, which is valuable in **UI apps**: the UI thread stays free to repaint and respond while the computation runs.

  Pitfalls:

  - In **ASP.NET Core**, `Task.Run` inside a request handler just trades one pool thread for another and adds overhead. Run the CPU work directly, or hand truly heavy work to a background queue.
  - Don't wrap **synchronous I/O** in `Task.Run` to fake asynchrony. It still blocks a pool thread, so use the real async API instead.
  - **Libraries** shouldn't use `Task.Run` internally just to look async. Expose synchronous CPU-bound methods and let the caller decide where to run them.
codeExample: |
  // I/O-bound: await the async API directly; no thread waits during the request
  using var http = new HttpClient();
  string html = await http.GetStringAsync("https://example.com");

  // Wasteful: an extra thread hop for work that is already asynchronous
  // string html2 = await Task.Run(() => http.GetStringAsync("https://example.com"));
  // CPU-bound in a UI app: keep the UI thread free while the work runs
  long primes = await Task.Run(() => CountPrimes(2_000_000));
  Console.WriteLine(primes);   // Output: 148933

  // Anti-pattern: fake async that still blocks a pool thread
  // Task<string> ReadAsync(string path) => Task.Run(() => File.ReadAllText(path));
  // Use the real async API instead: File.ReadAllTextAsync(path)

  static long CountPrimes(int limit)
  {
      long count = 0;
      for (int n = 2; n < limit; n++)
      {
          bool prime = true;
          for (int d = 2; d * d <= n && prime; d++) prime = n % d != 0;
          if (prime) count++;
      }
      return count;
  }
popularity: 8.0
isPublished: true
---
