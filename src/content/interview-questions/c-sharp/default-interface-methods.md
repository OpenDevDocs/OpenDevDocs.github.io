---
course: c-sharp
slug: default-interface-methods
experienceLevel: mid
difficulty: medium
tags:
  - oop
  - modern-csharp
question: "What are default interface methods, and how do they change the choice between an abstract class and an interface?"
answer: |
  Since C# 8, an interface member can include a body, called a **default implementation**. Implementing classes get it automatically and can supply their own version instead. It needs runtime support: .NET Core 3.0 or later, not .NET Framework.

  Its main purpose is **API evolution**: a library can add a member to a published interface without breaking every existing implementer.

  The default member belongs to the interface, not the class. If the class doesn't implement it, you can call it only through an interface-typed reference, not through a variable of the class type.

  What doesn't change: interfaces still can't have instance fields or instance constructors, so they hold no per-object state. (C# 11's `static abstract` members are a separate, generic-math feature.)

  So the decision is mostly the same:

  - Use an **interface** for a capability contract that unrelated types can implement, several at once.
  - Use an **abstract class** when implementers need shared state, constructors, `protected` helpers, or a common base implementation.

  Treat default methods as a versioning tool, not a route to multiple inheritance of behavior.
codeExample: |
  ILogger logger = new ConsoleLogger();
  logger.LogError("Disk full"); // Output: [ERROR] Disk full

  var concrete = new ConsoleLogger();
  // concrete.LogError("x");    // compile error: not a member of ConsoleLogger
  ((ILogger)concrete).LogError("x"); // Output: [ERROR] x

  public interface ILogger
  {
      void Log(string message);

      // Added in v2 of the library; existing implementers still compile
      void LogError(string message) => Log($"[ERROR] {message}");
  }

  public class ConsoleLogger : ILogger
  {
      public void Log(string message) => Console.WriteLine(message);
  }
popularity: 7.6
isPublished: true
---
