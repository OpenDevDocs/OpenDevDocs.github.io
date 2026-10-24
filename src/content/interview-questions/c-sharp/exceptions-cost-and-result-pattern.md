---
course: c-sharp
slug: exceptions-cost-and-result-pattern
experienceLevel: senior
difficulty: hard
tags:
  - exceptions
  - design
question: "Are exceptions expensive in .NET, and when should you use a Result pattern instead?"
answer: |
  Throwing an exception is **far more expensive than returning a value**. The runtime allocates the exception, captures a stack trace, and unwinds frames while it searches for a handler and runs `finally` blocks. A single throw costs microseconds, which is negligible for a rare failure but significant when exceptions drive normal control flow in a hot path. .NET 9 reimplemented exception handling in managed code and made throw and catch substantially faster, but they're still far slower than a return.

  The guideline is to reserve exceptions for **exceptional, unexpected** conditions: bugs, violated invariants, and infrastructure failures the caller can't reasonably anticipate.

  For **expected** failures, make the outcome part of the signature:

  - The **Try-pattern**: `bool TryParse(string s, out int value)` and `TryGetValue`.
  - A **Result type**, such as `Result<T>`, for domain failures like validation errors, "not found", or "insufficient funds". The caller must handle both outcomes explicitly, and no stack unwinding happens.

  Result types have costs too: more verbose code, no stack trace for diagnostics, and callers can still ignore the error. Use them where failures are part of the business logic. Above all, be **consistent**: mixing both styles for the same kind of failure makes APIs confusing.
codeExample: |
  // Expected failure: a Result with no exception; the caller handles both paths
  Result<decimal> result = Withdraw(balance: 50m, amount: 80m);
  Console.WriteLine(result.IsSuccess ? $"New balance {result.Value}" : result.Error);
  // Output: Insufficient funds

  // Try-pattern for parsing user input
  if (!int.TryParse("12x", out int qty)) Console.WriteLine("Invalid quantity");
  // Output: Invalid quantity

  // Exceptions stay for bugs: Withdraw(50m, -5m) throws ArgumentOutOfRangeException
  static Result<decimal> Withdraw(decimal balance, decimal amount)
  {
      ArgumentOutOfRangeException.ThrowIfNegativeOrZero(amount);  // a caller bug
      return amount > balance
          ? Result<decimal>.Fail("Insufficient funds")             // expected outcome
          : Result<decimal>.Ok(balance - amount);
  }

  public readonly record struct Result<T>(bool IsSuccess, T? Value, string? Error)
  {
      public static Result<T> Ok(T value) => new(true, value, null);
      public static Result<T> Fail(string error) => new(false, default, error);
  }
popularity: 7.6
isPublished: true
---
