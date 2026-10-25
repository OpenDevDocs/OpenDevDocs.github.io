---
course: c-sharp
slug: cancellation-tokens
experienceLevel: mid
difficulty: medium
tags:
  - async
question: "How do you cancel an async operation using `CancellationToken`?"
answer: |
  .NET uses **cooperative cancellation**. The caller owns a `CancellationTokenSource`, and the worker receives its `CancellationToken` and is responsible for noticing the request and stopping.

  The pattern:

  1. Create a `CancellationTokenSource`, optionally with a timeout: `new CancellationTokenSource(TimeSpan.FromSeconds(5))` or `cts.CancelAfter(...)`.
  2. Pass `cts.Token` down through every async method, conventionally as the last parameter, named `cancellationToken`.
  3. Hand the token to the APIs you call (`HttpClient`, EF Core, `Task.Delay`, `Stream.ReadAsync`), and call `token.ThrowIfCancellationRequested()` in your own loops.
  4. Call `cts.Cancel()` when the user clicks Cancel, the request is aborted, or a deadline passes.

  Cancellation surfaces as an `OperationCanceledException` (or its subclass `TaskCanceledException`), so catch the base type and treat it as a normal outcome, not an error to log.

  Other tips: combine tokens with `CancellationTokenSource.CreateLinkedTokenSource`, dispose the CTS when you're done, and in ASP.NET Core accept a `CancellationToken` parameter in your endpoint, which is bound to `HttpContext.RequestAborted`.
codeExample: |
  using var cts = new CancellationTokenSource();
  cts.CancelAfter(TimeSpan.FromMilliseconds(300));   // timeout-based cancellation

  try
  {
      await ProcessFilesAsync(["a.txt", "b.txt", "c.txt", "d.txt"], cts.Token);
  }
  catch (OperationCanceledException)                  // also catches TaskCanceledException
  {
      Console.WriteLine("Cancelled cleanly");
  }
  // Output: Processed a.txt
  //         Processed b.txt
  //         Cancelled cleanly

  static async Task ProcessFilesAsync(string[] files, CancellationToken cancellationToken)
  {
      foreach (var file in files)
      {
          cancellationToken.ThrowIfCancellationRequested();  // check in your own loops
          await Task.Delay(120, cancellationToken);          // pass it to every API
          Console.WriteLine($"Processed {file}");
      }
  }
popularity: 8.3
isPublished: true
---
