---
course: c-sharp
slug: task-vs-thread
experienceLevel: mid
difficulty: medium
tags:
  - async
  - threading
question: "What is the difference between a `Task` and a `Thread` in C#?"
answer: |
  A `Thread` is an **operating-system thread**: a real unit of execution with its own stack (typically 1 MB reserved on Windows) that you create, start, and manage yourself. Threads are expensive, and you build result passing, error handling, and cancellation yourself.

  A `Task` is a higher-level abstraction: an object representing an **operation that completes in the future**, possibly with a result (`Task<T>`). It isn't tied to a specific thread:

  - CPU-bound tasks started with `Task.Run` are queued to the **thread pool**, which reuses a small set of threads efficiently.
  - I/O-bound tasks, such as `HttpClient.GetAsync`, typically occupy **no thread at all** while waiting. The OS signals completion, and a continuation resumes the code.

  Tasks also provide the composition that raw threads lack: `await`, results, exception propagation, continuations, cancellation tokens, and combinators like `Task.WhenAll`.

  Default to tasks and `async`/`await`. Use a dedicated `Thread` only for special needs, like a loop that runs for the whole app lifetime or specific thread settings (priority, COM apartment state).
codeExample: |
  // Thread: manual, expensive, no built-in result or error propagation
  int threadResult = 0;
  var thread = new Thread(() => threadResult = Compute(20));
  thread.Start();
  thread.Join();                                // block until it finishes
  Console.WriteLine(threadResult);              // Output: 210

  // Task on the thread pool: result, exceptions, and await built in
  int taskResult = await Task.Run(() => Compute(20));
  Console.WriteLine(taskResult);                // Output: 210

  // I/O-bound task: no thread is blocked while the delay is pending
  await Task.Delay(100);

  // Exceptions flow through await
  try { await Task.Run(() => Compute(-1)); }
  catch (ArgumentException ex) { Console.WriteLine(ex.Message); } // Output: n must be >= 0

  static int Compute(int n)
  {
      if (n < 0) throw new ArgumentException("n must be >= 0");
      return Enumerable.Range(1, n).Sum();
  }
popularity: 9.2
isPublished: true
---
