---
course: c-sharp
slug: executioncontext-synchronizationcontext-asynclocal
experienceLevel: senior
difficulty: hard
tags:
  - async
question: "What is the difference between `ExecutionContext` and `SynchronizationContext`, and how does `AsyncLocal<T>` flow?"
answer: |
  **`SynchronizationContext` decides where a continuation runs.** UI frameworks install one that marshals work back to the UI thread. ASP.NET Core has none, so continuations run on the thread pool. `await` captures it by default, and `ConfigureAwait(false)` opts out.

  **`ExecutionContext` decides which ambient state travels with the logical flow.** It carries `AsyncLocal<T>` values, and whatever is built on them, such as `Activity.Current` for distributed tracing. It flows automatically across `await`, `Task.Run`, thread pool work items, and timers, and `ConfigureAwait(false)` does **not** stop it.

  `AsyncLocal<T>` behaves like a variable scoped to the logical call chain:

  - Values set by a caller are visible in everything it awaits or starts.
  - A value set inside an async callee is **not** visible to the caller after the callee returns, because the context is copy-on-write.
  - `ThreadLocal<T>` and `[ThreadStatic]` don't follow the logical flow. After an `await`, you may resume on a different thread and see a different value, a classic source of bugs when migrating synchronous code.

  `ExecutionContext.SuppressFlow()` stops the flow, for example when starting long-lived background work that shouldn't capture request-scoped state.
codeExample: |
  var local = new AsyncLocal<string>();
  var threadLocal = new ThreadLocal<string>();

  local.Value = "request-42";
  threadLocal.Value = "request-42";

  await Task.Delay(10).ConfigureAwait(false);   // resumes on a thread pool thread

  Console.WriteLine(local.Value);               // Output: request-42 (flowed)
  Console.WriteLine(threadLocal.Value ?? "(null)"); // Output: (null) (other thread)

  await ChildAsync();
  Console.WriteLine(local.Value);               // Output: request-42 (not changed)

  async Task ChildAsync()
  {
      Console.WriteLine(local.Value);           // Output: request-42 (flows down)
      local.Value = "changed-in-child";         // copy-on-write: invisible to caller
      await Task.Yield();
  }
popularity: 7.0
isPublished: true
---
