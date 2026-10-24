---
course: c-sharp
slug: composition-over-inheritance
experienceLevel: mid
difficulty: medium
tags:
  - design
  - oop
question: "What does 'favor composition over inheritance' mean, and how do you apply it in C#?"
answer: |
  It means building behavior by **combining objects** (has-a) rather than by **extending classes** (is-a). Instead of inheriting from a base class to reuse its code, a class holds references to collaborators, usually through interfaces, and delegates work to them.

  Why inheritance causes trouble at scale:

  - **Tight coupling:** a subclass depends on its base class's internals, so base changes can break it (the fragile base class problem).
  - **Rigid hierarchies:** C# allows only one base class, so combinations like "audited, emailed report" lead to an explosion of subclasses.
  - **Fixed at compile time:** you can't swap inherited behavior while the program runs.

  Composition fixes these problems. Collaborators are injected through the constructor, can be replaced with fakes in unit tests, and can be mixed freely.

  Inheritance still fits a genuine is-a relationship with a stable base, and framework extension points such as `ControllerBase` or `DbContext`. The guideline is about the default choice, not a ban.
codeExample: |
  // Inheritance would mean EmailReport : Report, AuditedEmailReport : EmailReport...
  // Composition: combine small collaborators behind interfaces instead
  public interface INotifier { void Send(string message); }
  public interface IAuditLog { void Record(string entry); }

  public class EmailNotifier : INotifier
  {
      public void Send(string message) => Console.WriteLine($"Email: {message}");
  }
  public class ConsoleAudit : IAuditLog
  {
      public void Record(string entry) => Console.WriteLine($"Audit: {entry}");
  }

  public class ReportService(INotifier notifier, IAuditLog audit)
  {
      public void Publish(string name)
      {
          audit.Record($"Published {name}");
          notifier.Send($"{name} is ready"); // swap the notifier without subclassing
      }
  }

  // new ReportService(new EmailNotifier(), new ConsoleAudit()).Publish("Q3");
popularity: 7.8
isPublished: true
---
