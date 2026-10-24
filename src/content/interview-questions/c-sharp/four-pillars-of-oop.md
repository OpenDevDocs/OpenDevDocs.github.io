---
course: c-sharp
slug: four-pillars-of-oop
experienceLevel: fresher
difficulty: easy
tags:
  - oop
question: "What are the four pillars of object-oriented programming, and how does C# support them?"
answer: |
  The four pillars are encapsulation, abstraction, inheritance, and polymorphism. C# has a language feature for each:

  - **Encapsulation** bundles data with the code that works on it and hides internal state. C# uses access modifiers (`private`, `public`, and others) and properties, so outside code changes state only through controlled members.
  - **Abstraction** exposes what an object does while hiding how it does it. C# uses interfaces and `abstract` classes to define contracts that callers depend on.
  - **Inheritance** lets a class reuse and extend another class with the `:` syntax, as in `class SavingsAccount : Account`. C# allows one base class plus any number of interfaces.
  - **Polymorphism** lets one call behave differently depending on the object's actual type. C# supports it through `virtual` and `override` methods, interface implementations, and method overloading.

  Together they make code easier to change, test, and reuse.
codeExample: |
  Account account = new SavingsAccount();  // polymorphism: base-type variable
  account.Deposit(100);
  Console.WriteLine(account.Describe());    // Output: Savings: 100

  // Abstraction: callers depend on what, not how
  public interface IDescribable { string Describe(); }

  public abstract class Account : IDescribable
  {
      // Encapsulation: state is private, changed only through methods
      private decimal _balance;
      protected decimal Balance => _balance;
      public void Deposit(decimal amount)
      {
          if (amount <= 0) throw new ArgumentException("Amount must be positive");
          _balance += amount;
      }
      public abstract string Describe();
  }

  // Inheritance: reuses Deposit and Balance from Account
  public class SavingsAccount : Account
  {
      public override string Describe() => $"Savings: {Balance}"; // polymorphism
  }
popularity: 9.4
isPublished: true
---
