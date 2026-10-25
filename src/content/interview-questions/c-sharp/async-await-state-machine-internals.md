---
course: c-sharp
slug: async-await-state-machine-internals
experienceLevel: senior
difficulty: hard
tags:
  - async
  - clr
question: "How does `async`/`await` work under the hood in C#?"
answer: |
  The compiler rewrites every `async` method into a **state machine**. Locals that must survive an `await` become fields of a generated type, a struct implementing `IAsyncStateMachine` in Release builds. The method body moves into a `MoveNext()` method that switches on an integer state, and the original method becomes a stub that creates the state machine, starts it through a **method builder** (`AsyncTaskMethodBuilder<T>`), and returns the builder's `Task`.

  Each `await` expands into the **awaiter pattern**:

  1. Call `GetAwaiter()` on the awaited value and check `IsCompleted`.
  2. If it's already complete, continue **synchronously**. This fast path allocates nothing extra.
  3. Otherwise, save the state, register `MoveNext` as the continuation through `UnsafeOnCompleted`, and return. On the first real suspension, the builder boxes the state machine onto the heap.
  4. When the operation finishes, the continuation calls `MoveNext` again, which jumps back to the saved state and calls `GetResult()`, returning the value or rethrowing the exception.

  Where the continuation runs depends on the captured `SynchronizationContext` or `TaskScheduler`, which is what `ConfigureAwait(false)` opts out of. Any type with a suitable `GetAwaiter()` is awaitable, which is how `ValueTask` plugs in.
codeExample: |
  // Simplified sketch, not real compiler output: (await LoadAsync()).Length
  struct GetLengthStateMachine : IAsyncStateMachine
  {
      public int State;                  // -1 = running, 0 = suspended at the await
      public AsyncTaskMethodBuilder<int> Builder;
      private TaskAwaiter<string> _awaiter;
      public void MoveNext()
      {
          try
          {
              if (State != 0)            // first call: start the awaited operation
              {
                  _awaiter = LoadAsync().GetAwaiter();
                  if (!_awaiter.IsCompleted)
                  {
                      State = 0;         // slow path: register continuation, return
                      Builder.AwaitUnsafeOnCompleted(ref _awaiter, ref this);
                      return;
                  }
              }                          // fast path: falls through synchronously
              Builder.SetResult(_awaiter.GetResult().Length); // value or rethrow
          }
          catch (Exception ex) { Builder.SetException(ex); }
      }
  }
popularity: 8.8
isPublished: true
---
