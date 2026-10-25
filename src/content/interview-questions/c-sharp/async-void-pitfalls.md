---
course: c-sharp
slug: async-void-pitfalls
experienceLevel: mid
difficulty: medium
tags:
  - async
question: "Why should you avoid `async void` methods in C#?"
answer: |
  An `async void` method gives the caller **no `Task` to observe**, and that breaks the normal async contract in three ways:

  - **It can't be awaited.** The caller continues immediately and can't know when the method finishes, which leads to ordering bugs and races.
  - **Exceptions escape.** An exception thrown inside it can't be caught by the caller. It's raised directly on the `SynchronizationContext` that was active when the method started, or on the thread pool if there was none, which typically **crashes the process**.
  - **It's hard to test.** A test framework can't await it, so failures may be missed or show up in unrelated tests.

  The only legitimate use is **event handlers**, because their delegate signatures require `void`. Even there, keep the handler thin and wrap its body in `try`/`catch`.

  Everywhere else, return `Task` or `Task<T>`. Watch for accidental `async void` lambdas: passing an `async` lambda to a parameter of type `Action`, as with `List<T>.ForEach(async x => ...)`, silently creates one, so nothing awaits the work and its exceptions are lost or fatal.
codeExample: |
  try
  {
      await SaveAsync();                    // Task-returning: awaitable and catchable
  }
  catch (InvalidOperationException ex)
  {
      Console.WriteLine($"Caught: {ex.Message}"); // Output: Caught: Disk full
  }

  // try { SaveVoid(); } catch { }  // useless: SaveVoid returns before it throws,
  //                                // and the exception then crashes the process
  // Hidden async void: List<T>.ForEach takes an Action<T>, so nothing awaits these
  // ids.ForEach(async id => await SaveAsync());

  static async Task SaveAsync()             // do this
  {
      await Task.Delay(10);
      throw new InvalidOperationException("Disk full");
  }

  static async void SaveVoid()              // avoid, except for event handlers
  {
      await Task.Delay(10);
      throw new InvalidOperationException("Disk full");
  }
popularity: 8.5
isPublished: true
---
