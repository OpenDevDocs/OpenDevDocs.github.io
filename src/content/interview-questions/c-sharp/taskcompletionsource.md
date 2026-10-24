---
course: c-sharp
slug: taskcompletionsource
experienceLevel: senior
difficulty: hard
tags:
  - async
question: "What is `TaskCompletionSource<T>`, and when would you use it?"
answer: |
  `TaskCompletionSource<T>` (TCS) creates a `Task<T>` that isn't backed by running code: **you decide when it completes** by calling `SetResult`, `SetException`, or `SetCanceled`. Their `Try*` variants return `false` instead of throwing if the task is already complete. Consumers simply `await tcs.Task`.

  Typical uses:

  - **Wrapping callback- or event-based APIs** so they can be awaited: complete the TCS when the event fires, such as a process exiting or a message arriving.
  - **Building coordination primitives**, such as async signals, gates, or an async manual-reset event.

  Production pitfalls:

  - By default, continuations of `tcs.Task` may run **synchronously on the thread that calls `SetResult`**. That thread can end up executing arbitrary awaiting code, possibly while holding locks, which risks deadlocks. Create the TCS with `TaskCreationOptions.RunContinuationsAsynchronously` unless you have a reason not to.
  - **Always complete it.** If no code path ever sets a result, awaiters hang forever. Register cancellation and timeouts that call `TrySetCanceled` or `TrySetException`.
  - Use the `Try*` methods when several paths may race to complete it.

  .NET 5 added a non-generic `TaskCompletionSource` for tasks without a result.
codeExample: |
  using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
  var worker = new Worker();
  _ = Task.Run(async () => { await Task.Delay(200); worker.Finish("report.pdf"); });
  Console.WriteLine(await WaitForCompletionAsync(worker, cts.Token)); // Output: report.pdf

  static Task<string> WaitForCompletionAsync(Worker worker, CancellationToken ct)
  {
      var tcs = new TaskCompletionSource<string>(
          TaskCreationOptions.RunContinuationsAsynchronously); // don't run awaiters inline
      EventHandler<string> onCompleted = (_, result) => tcs.TrySetResult(result);
      worker.Completed += onCompleted;
      var registration = ct.Register(() => tcs.TrySetCanceled(ct)); // always complete
      tcs.Task.ContinueWith(_ =>
      {
          worker.Completed -= onCompleted;          // clean up on every outcome
          registration.Dispose();
      }, TaskScheduler.Default);
      return tcs.Task;
  }

  public class Worker
  {
      public event EventHandler<string>? Completed;
      public void Finish(string file) => Completed?.Invoke(this, file);
  }
popularity: 7.4
isPublished: true
---
