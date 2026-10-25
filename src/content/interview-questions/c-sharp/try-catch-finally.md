---
course: c-sharp
slug: try-catch-finally
experienceLevel: fresher
difficulty: easy
tags:
  - exceptions
question: "How does exception handling work with `try`, `catch`, and `finally` in C#?"
answer: |
  Code that might fail goes in a `try` block. If an exception is thrown, the runtime looks for a matching `catch` block, and the `finally` block runs afterward either way.

  - **try** wraps the risky operation, such as reading a file or parsing input.
  - **catch** handles a specific exception type. With several catch blocks, order them from most specific to most general, because the first match wins. `catch (Exception)` catches everything, so use it sparingly, typically at the top level for logging.
  - **finally** always runs, whether the try block succeeded, threw, or returned early, which makes it the place for cleanup. It's skipped only when the process itself dies, for example on a `StackOverflowException` or `Environment.FailFast`.

  An exception object carries a `Message`, a `StackTrace`, and often an `InnerException`. To dispose resources, a `using` statement is usually cleaner than a hand-written `finally`.
codeExample: |
  try
  {
      Console.WriteLine(ParseAge("abc"));
  }
  catch (FormatException ex)             // most specific first
  {
      Console.WriteLine($"Bad input ({ex.GetType().Name})");
  }
  catch (Exception ex)                   // general fallback
  {
      Console.WriteLine($"Unexpected: {ex.Message}");
  }
  finally
  {
      Console.WriteLine("Cleanup runs no matter what");
  }
  // Output: Bad input (FormatException)
  //         Cleanup runs no matter what

  static int ParseAge(string text) => int.Parse(text);
popularity: 9.0
isPublished: true
---
