---
course: c-sharp
slug: explicit-interface-implementation
experienceLevel: mid
difficulty: medium
tags:
  - oop
question: "What is explicit interface implementation in C#, and when do you need it?"
answer: |
  Explicit interface implementation qualifies a member with the interface name, as in `void IAuditor.Log(string msg)`. The member takes no access modifier and isn't callable through the class type; you can only reach it through a reference typed as that interface, or after a cast.

  You need it in two main situations:

  - **Resolving clashes.** Two interfaces declare the same member but need different behavior, so you implement at least one explicitly. The everyday case is `IEnumerable<T>`: its `GetEnumerator()` clashes with the non-generic `IEnumerable.GetEnumerator()`, which is usually implemented explicitly.
  - **Keeping members out of the public API.** An interface may require a member that makes little sense on the concrete type. `List<T>` implements `ICollection<T>.IsReadOnly` explicitly, so it doesn't clutter normal list usage.

  Pitfall: on a struct, calling an explicit member requires converting to the interface, which **boxes** the value. Generic code constrained with `where T : IAuditor` can call it without boxing.
codeExample: |
  var file = new FileLogger();
  file.Log("hi");             // Output: [log] hi    (implicit, public)
  ((IAuditor)file).Log("hi"); // Output: [audit] hi  (explicit)

  IAuditor auditor = file;    // an interface-typed variable needs no cast
  auditor.Log("bye");         // Output: [audit] bye

  interface ILogger { void Log(string msg); }
  interface IAuditor { void Log(string msg); }

  class FileLogger : ILogger, IAuditor
  {
      public void Log(string msg) => Console.WriteLine($"[log] {msg}");

      // No access modifier allowed; reachable only through IAuditor
      void IAuditor.Log(string msg) => Console.WriteLine($"[audit] {msg}");
  }
popularity: 7.4
isPublished: true
---
