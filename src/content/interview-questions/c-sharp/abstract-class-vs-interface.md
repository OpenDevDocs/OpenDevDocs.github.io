---
course: c-sharp
slug: abstract-class-vs-interface
experienceLevel: fresher
difficulty: medium
tags:
  - oop
question: "What is the difference between an abstract class and an interface in C#?"
answer: |
  Both define members that other types must provide, but they model different relationships.

  An **abstract class** is a partial base class. It can't be instantiated, but it can have fields, constructors, implemented methods, `abstract` members that subclasses must override, and any access modifiers. A class can inherit from only **one** class.

  An **interface** is a contract for a capability. A class or struct can implement **many** interfaces. Interfaces have no instance fields or constructors. Since C# 8 they can include default method implementations and static members, but still no per-object state.

  How to choose:

  - An abstract class for an "is-a" family that shares code and state, such as `Shape` with `Circle` and `Square`.
  - An interface for a "can-do" ability shared by unrelated types, such as `IComparable` or `IDisposable`.

  Many designs use both: an interface as the contract plus an abstract base class with shared defaults.
codeExample: |
  Shape[] shapes = [new Circle(2), new Square(3)];
  foreach (var s in shapes)
      Console.WriteLine($"{s.Name}: {s.Area():F1}");
  // Output: Circle: 12.6 and Square: 9.0 (one per line)

  // Interface: a capability any type can add, several at once
  public interface IResizable { void Resize(double factor); }

  // Abstract class: shared state + shared code + required members
  public abstract class Shape(string name)
  {
      public string Name { get; } = name;   // state
      public abstract double Area();        // subclasses must implement
  }

  public class Circle(double r) : Shape("Circle"), IResizable
  {
      private double _r = r;
      public override double Area() => Math.PI * _r * _r;
      public void Resize(double factor) => _r *= factor;
  }
  public class Square(double side) : Shape("Square")
  {
      public override double Area() => side * side;
  }
popularity: 9.7
isPublished: true
---
