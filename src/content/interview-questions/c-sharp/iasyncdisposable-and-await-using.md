---
course: c-sharp
slug: iasyncdisposable-and-await-using
experienceLevel: senior
difficulty: medium
tags:
  - memory
  - async
question: "What is `IAsyncDisposable` in C#, and how does `await using` work?"
answer: |
  `IAsyncDisposable` defines a single method, `ValueTask DisposeAsync()`, for types whose cleanup involves **I/O**, such as flushing a buffered stream or closing a network or database connection. Doing that work synchronously in `Dispose()` would block a thread.

  **`await using`** is its counterpart to the `using` statement:

  - `await using var writer = new AsyncLogWriter();` disposes the object at the end of the scope with `await writer.DisposeAsync()`.
  - The compiler generates a `try`/`finally` that awaits `DisposeAsync()` in the `finally`, so cleanup runs even when an exception is thrown.
  - Library code can add `.ConfigureAwait(false)` to the disposal.

  Implementation guidance:

  - Types that own both kinds of resources often implement **both** `IDisposable` and `IAsyncDisposable`. The recommended pattern moves the async cleanup into a `protected virtual ValueTask DisposeAsyncCore()` method.
  - Make disposal idempotent, and don't block on async work inside `Dispose()`.
  - The DI container disposes services asynchronously when their scope is disposed with `DisposeAsync`, as ASP.NET Core does at the end of each request. If a service implements only `IAsyncDisposable` and its scope is disposed synchronously, the container throws.

  `Stream`, `DbConnection`, and `Utf8JsonWriter` already implement it.
codeExample: |
  await using (var log = new AsyncLogWriter("app.log"))
  {
      await log.WriteAsync("Started");
  }   // await log.DisposeAsync() runs here, even if an exception was thrown

  public sealed class AsyncLogWriter(string path) : IAsyncDisposable, IDisposable
  {
      private readonly StreamWriter _writer = new(path, append: true);
      private bool _disposed;
      public Task WriteAsync(string line) => _writer.WriteLineAsync(line);

      public async ValueTask DisposeAsync()
      {
          if (_disposed) return;
          _disposed = true;
          await _writer.FlushAsync();     // I/O: don't block a thread on it
          await _writer.DisposeAsync();
      }
      public void Dispose()               // fallback for synchronous callers
      {
          if (_disposed) return;
          _disposed = true;
          _writer.Dispose();              // flushes synchronously
      }
  }
popularity: 7.0
isPublished: true
---
