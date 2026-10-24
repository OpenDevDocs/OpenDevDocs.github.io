---
course: c-sharp
slug: task-exception-propagation
experienceLevel: senior
difficulty: hard
tags:
  - async
  - exceptions
question: "How do exceptions propagate in tasks (`AggregateException`, `Task.WhenAll`, and unobserved exceptions)?"
answer: |
  A faulted task stores its exceptions in an `AggregateException`, exposed through `task.Exception`. How you observe the task determines what you see:

  - `await task` rethrows the **first inner exception**, unwrapped, with its original stack trace preserved through `ExceptionDispatchInfo`.
  - `task.Wait()` and `task.Result` throw the **`AggregateException` itself**, so you have to dig into `InnerExceptions`.
  - `task.GetAwaiter().GetResult()` blocks like `.Result` but throws the first inner exception unwrapped.

  With `Task.WhenAll`, several tasks may fail, but `await` still surfaces **only the first** exception. To see every failure, keep a reference to the `WhenAll` task and inspect its `Exception.InnerExceptions` in the `catch` block.

  **Unobserved exceptions:** if a faulted task is never awaited or inspected, the exception is silently lost. When the task is garbage collected, `TaskScheduler.UnobservedTaskException` fires, but since .NET 4.5 that doesn't crash the process by default. Exceptions escaping `async void` methods, by contrast, are rethrown on the synchronization context or thread pool and **do** crash the process.

  Fire-and-forget work should therefore catch and log its own exceptions.
codeExample: |
  var whenAll = Task.WhenAll(FailAsync("A", 10), FailAsync("B", 20), OkAsync());
  try { await whenAll; }
  catch (Exception ex)
  {
      Console.WriteLine($"await saw: {ex.Message}");    // Output: await saw: A failed
      foreach (var inner in whenAll.Exception!.InnerExceptions)
          Console.WriteLine($"  also: {inner.Message}"); // Output: A failed, B failed
  }

  try { FailAsync("C", 0).Wait(); }
  catch (AggregateException ae)                          // .Wait()/.Result wrap it
  {
      Console.WriteLine(ae.InnerException!.Message);     // Output: C failed
  }

  TaskScheduler.UnobservedTaskException += (_, e) =>     // last-chance logging only
      Console.WriteLine($"Unobserved: {e.Exception.InnerException?.Message}");

  static async Task FailAsync(string name, int ms)
  {
      await Task.Delay(ms);
      throw new InvalidOperationException($"{name} failed");
  }
  static async Task OkAsync() => await Task.Delay(5);
popularity: 7.8
isPublished: true
---
