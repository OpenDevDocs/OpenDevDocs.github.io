---
course: c-sharp
slug: custom-exceptions
experienceLevel: fresher
difficulty: easy
tags:
  - exceptions
question: "How do you create and use a custom exception in C#?"
answer: |
  Create a class that derives from `Exception` (not the legacy `ApplicationException`), and give it a name ending in `Exception`, such as `InsufficientFundsException`.

  Follow the standard conventions:

  - Provide the three common constructors: parameterless, one taking a message, and one taking a message plus an inner exception.
  - Add properties for extra context, such as the requested amount and the available balance, so handlers can react without parsing the message.
  - Skip the old `[Serializable]` attribute and serialization constructor. Formatter-based serialization is obsolete, and that constructor has been marked obsolete since .NET 8.

  Create a custom exception only when callers need to catch that specific failure and handle it differently. If a built-in type already describes the problem, such as `ArgumentException`, `InvalidOperationException`, or `KeyNotFoundException`, throw that instead.
codeExample: |
  try
  {
      Withdraw(balance: 50m, amount: 80m);
  }
  catch (InsufficientFundsException ex)
  {
      Console.WriteLine($"{ex.Message} Short by {ex.Requested - ex.Available}.");
  }
  // Output: Insufficient funds. Short by 30.

  static void Withdraw(decimal balance, decimal amount)
  {
      if (amount > balance) throw new InsufficientFundsException(amount, balance);
  }
  public class InsufficientFundsException : Exception
  {
      public decimal Requested { get; }
      public decimal Available { get; }
      public InsufficientFundsException() { }
      public InsufficientFundsException(string message) : base(message) { }
      public InsufficientFundsException(string message, Exception inner)
          : base(message, inner) { }
      public InsufficientFundsException(decimal requested, decimal available)
          : base("Insufficient funds.") => (Requested, Available) = (requested, available);
  }
popularity: 7.4
isPublished: true
---
