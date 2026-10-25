---
course: c-sharp
slug: throw-vs-throw-ex
experienceLevel: fresher
difficulty: medium
tags:
  - exceptions
question: "What is the difference between `throw` and `throw ex` in C#?"
answer: |
  Both rethrow an exception from a `catch` block, but they treat the **stack trace** differently.

  - `throw;` rethrows the current exception **unchanged**, preserving the original stack trace, so logs still point to the line where the error really happened.
  - `throw ex;` throws the same exception object as if it were new, so the stack trace is **reset** to the current line. The information about where the failure originated is lost, which makes debugging much harder.

  Always use `throw;` to rethrow. If you want to add context, throw a new, more meaningful exception and pass the original as its `InnerException`, so the full chain is kept.

  In the rare case where you need to rethrow an exception captured earlier, such as one caught on another thread, use `ExceptionDispatchInfo.Capture(ex).Throw()`, which also preserves the original trace.
codeExample: |
  try
  {
      Process();
  }
  catch (InvalidOperationException ex)
  {
      Console.WriteLine(ex.Message);                 // Output: Order failed
      Console.WriteLine(ex.InnerException?.Message); // Output: Amount must be positive
  }

  static void Process()
  {
      try { Validate(-5); }
      catch (ArgumentException ex)
      {
          // throw ex;  // bad: the stack trace restarts here, Validate disappears
          // throw;     // good: rethrows with the original stack trace
          throw new InvalidOperationException("Order failed", ex); // adds context
      }
  }

  static void Validate(int amount)
  {
      if (amount <= 0) throw new ArgumentException("Amount must be positive");
  }
popularity: 9.0
isPublished: true
---
