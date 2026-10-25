---
course: c-sharp
slug: async-await-basics
experienceLevel: fresher
difficulty: medium
tags:
  - async
question: "What do the `async` and `await` keywords do in C#?"
answer: |
  They let you write asynchronous code that reads like ordinary sequential code.

  - `async` marks a method that uses `await`. Such a method usually returns `Task` (no result) or `Task<T>` (a result of type `T`). Return `void` only for event handlers.
  - `await` pauses the method until the awaited task completes, **without blocking the thread**, then resumes it where it left off.

  This matters most for **I/O-bound** work such as HTTP calls, database queries, and file access. While a request is in flight, a desktop app's UI stays responsive, and a web server can use the thread to serve other requests.

  Two points interviewers like to hear: `async` doesn't create a new thread by itself, and an exception thrown inside an async method is rethrown when you `await` its task. By convention, async method names end in `Async`.
codeExample: |
  Console.WriteLine("Start");
  Task<int> task = GetOrderCountAsync();   // starts running immediately
  Console.WriteLine("Doing other work while waiting...");

  int count = await task;                  // pauses here until the result is ready
  Console.WriteLine($"Orders: {count}");
  // Output: Start
  //         Doing other work while waiting...
  //         Orders: 42

  static async Task<int> GetOrderCountAsync()
  {
      await Task.Delay(500);  // simulated I/O: no thread is blocked while waiting
      return 42;              // wrapped in a Task<int> automatically
  }

  // async void is only for event handlers:
  // saveButton.Click += async (sender, e) => await SaveAsync();
popularity: 9.0
isPublished: true
---
