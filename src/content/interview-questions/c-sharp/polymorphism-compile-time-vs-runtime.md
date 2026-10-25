---
course: c-sharp
slug: polymorphism-compile-time-vs-runtime
experienceLevel: fresher
difficulty: easy
tags:
  - oop
question: "What is polymorphism, and what is the difference between compile-time and runtime polymorphism?"
answer: |
  **Polymorphism** means "many forms": the same call can do different things depending on the types involved. C# has two kinds, distinguished by when the method to run is chosen.

  **Compile-time (static) polymorphism** is resolved by the compiler. Method overloading is the main example: `Print(int)` and `Print(string)` share a name, and the compiler picks one based on the argument types. Operator overloading works the same way.

  **Runtime (dynamic) polymorphism** is resolved while the program runs. A base class declares a `virtual` or `abstract` method, derived classes `override` it, and a call through a base-type reference runs the version for the object's **actual** type. Interface implementations behave the same way.

  Runtime polymorphism is what lets you write code against a general type, such as a `List<Shape>`, and add new shapes later without changing the loop that uses them.
codeExample: |
  List<Shape> shapes = [new Circle(1), new Square(2)];
  foreach (Shape s in shapes)   // runtime: the object's actual type picks Area()
      Console.WriteLine($"{s.Name}: {s.Area():F2}");
  // Output: Circle: 3.14
  //         Square: 4.00

  // Compile-time: the compiler picks the overload from the argument type
  Printer.Print(42);       // Output: int 42
  Printer.Print("hi");     // Output: string hi

  abstract class Shape
  {
      public string Name => GetType().Name;
      public abstract double Area();
  }
  class Circle(double r) : Shape { public override double Area() => Math.PI * r * r; }
  class Square(double side) : Shape { public override double Area() => side * side; }

  static class Printer
  {
      public static void Print(int value) => Console.WriteLine($"int {value}");
      public static void Print(string value) => Console.WriteLine($"string {value}");
  }
popularity: 9.0
isPublished: true
---
