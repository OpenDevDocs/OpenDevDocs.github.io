---
course: c-sharp
slug: access-modifiers
experienceLevel: fresher
difficulty: easy
tags:
  - oop
question: "What are the access modifiers in C#?"
answer: |
  Access modifiers control which code can see a type or member. C# has seven:

  - `public`: accessible from anywhere.
  - `private`: only inside the containing type.
  - `protected`: inside the containing type and types derived from it.
  - `internal`: anywhere in the same assembly (project).
  - `protected internal`: the same assembly **or** derived types in other assemblies.
  - `private protected` (C# 7.2): derived types, but only within the same assembly.
  - `file` (C# 11): the type is visible only in its own source file. It applies to types, not members.

  Defaults matter: class and struct members are `private` unless you say otherwise, top-level types are `internal`, and interface members are `public`.

  Follow the principle of least privilege: start with the most restrictive modifier that works, and widen access only when other code genuinely needs it.
codeExample: |
  // Assembly: MyLibrary
  public class BankAccount
  {
      public string Owner { get; }               // anyone
      private decimal _balance;                  // this class only
      protected decimal Limit = 500;             // this class + subclasses
      internal string BranchCode = "B01";        // this assembly only
      protected internal void Audit() { }        // this assembly OR subclasses
      private protected void Recalculate() { }   // subclasses in this assembly

      public BankAccount(string owner) => Owner = owner;
      public decimal Balance => _balance;
  }

  public class PremiumAccount : BankAccount
  {
      public PremiumAccount(string owner) : base(owner)
      {
          Limit = 5_000;       // OK: protected
          Recalculate();       // OK: private protected, same assembly
          // _balance = 0;     // compile error: private to BankAccount
      }
  }

  file class Helper { }        // visible only in this .cs file
popularity: 9.1
isPublished: true
---
