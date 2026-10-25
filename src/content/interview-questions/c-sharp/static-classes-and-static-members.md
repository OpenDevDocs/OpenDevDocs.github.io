---
course: c-sharp
slug: static-classes-and-static-members
experienceLevel: fresher
difficulty: easy
tags:
  - oop
question: "What is a `static` class, and when should you use static members?"
answer: |
  A **static member** belongs to the type itself rather than to any object, so all callers share it and access it through the type name, as with `Math.PI` or `DateTime.Now`.

  A **static class** contains only static members. It can't be instantiated with `new` and can't be inherited. `Math`, `Console`, and `File` are examples, and extension methods must live in a static class.

  A **static constructor** runs once, automatically, before the type is first used, which makes it a good place to initialize static fields.

  Good uses:

  - Stateless helpers, such as `Math.Max`.
  - Constants and shared read-only data.
  - Factory methods like `TimeSpan.FromSeconds`.

  Pitfall: static **mutable** state is shared by the whole application. It isn't thread-safe by default, is hard to reset between tests, and hides dependencies. Prefer instances with dependency injection when a class holds changing state or talks to external systems.
codeExample: |
  Console.WriteLine(TemperatureConverter.ToFahrenheit(100)); // Output: 212
  Console.WriteLine(TemperatureConverter.ConversionCount);   // Output: 1

  var visitor1 = new Visitor();
  var visitor2 = new Visitor();
  Console.WriteLine(Visitor.Total);  // Output: 2 (shared by all instances)

  // var tc = new TemperatureConverter(); // compile error: static class

  public static class TemperatureConverter
  {
      public static int ConversionCount { get; private set; }

      public static double ToFahrenheit(double celsius)
      {
          ConversionCount++;
          return celsius * 9 / 5 + 32;
      }
  }

  public class Visitor
  {
      public static int Total;          // one copy for the whole type
      public Visitor() => Total++;      // every instance updates the shared value
  }
popularity: 8.3
isPublished: true
---
