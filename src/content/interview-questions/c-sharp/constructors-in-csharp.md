---
course: c-sharp
slug: constructors-in-csharp
experienceLevel: fresher
difficulty: easy
tags:
  - oop
question: "What is a constructor, and what types of constructors does C# support?"
answer: |
  A **constructor** is a special method that runs when an object is created. It has the same name as the class, has no return type (not even `void`), and initializes the object's state.

  C# supports several kinds:

  - **Parameterless:** takes no arguments. The compiler adds a default one only if the class declares no constructors.
  - **Parameterized:** takes arguments so callers must supply required data.
  - **Static:** runs once per type, before first use. It can't have parameters or access modifiers.
  - **Private:** blocks instantiation from outside the class, used for singletons and factory methods.
  - **Copy:** takes another instance of the same type and copies its values. You write it yourself, though record classes get one generated.

  Constructors can be overloaded and chained with `: this(...)` to avoid duplicating setup. C# 12 added primary constructors, which put the parameters right after the type name.
codeExample: |
  var guest = new Customer();
  var copy = new Customer(guest);
  Console.WriteLine($"{copy.Name}, {copy.Tier}");    // Output: Guest, Basic

  public class Customer
  {
      public string Name { get; }
      public string Tier { get; }

      public Customer() : this("Guest") { }                  // parameterless
      public Customer(string name) : this(name, "Basic") { } // chained
      public Customer(string name, string tier)              // parameterized
      {
          Name = name;
          Tier = tier;
      }
      public Customer(Customer other) : this(other.Name, other.Tier) { } // copy
  }

  public class AppConfig
  {
      public static readonly AppConfig Instance;
      static AppConfig() => Instance = new AppConfig();  // static: runs once
      private AppConfig() { }            // private: blocks outside `new`
  }
popularity: 8.6
isPublished: true
---
