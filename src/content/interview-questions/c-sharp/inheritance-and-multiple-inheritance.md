---
course: c-sharp
slug: inheritance-and-multiple-inheritance
experienceLevel: fresher
difficulty: easy
tags:
  - oop
question: "What is inheritance, and does C# support multiple inheritance?"
answer: |
  **Inheritance** lets a class (the derived class) reuse and extend the members of another class (the base class), using the `:` syntax: `class Dog : Animal`. It models an "is-a" relationship.

  Key rules:

  - Every class ultimately derives from `object`, so it inherits `ToString()`, `Equals()`, and `GetHashCode()`.
  - Derived classes can access `public` and `protected` members, but not `private` ones.
  - Constructors aren't inherited. Every derived constructor calls a base constructor first, implicitly or with `: base(...)`.
  - Marking a class `sealed` prevents further inheritance.

  C# does **not** support multiple class inheritance: a class can have only one base class. This avoids the **diamond problem**, where two parent classes override the same member from a shared ancestor, so it's unclear which version the child gets. Instead, a class can implement any number of interfaces, like `class Duck : Animal, IFlyable, ISwimmable`.
codeExample: |
  var duck = new Duck("Donald");
  Console.WriteLine(duck.Describe());  // Output: Donald can fly and swim
  Console.WriteLine(duck.ToString());  // Output: Duck (inherited from object)

  public class Animal
  {
      protected string Name { get; }
      public Animal(string name) => Name = name;
  }

  public interface IFlyable { void Fly(); }
  public interface ISwimmable { void Swim(); }

  // One base class, any number of interfaces
  public class Duck : Animal, IFlyable, ISwimmable
  {
      public Duck(string name) : base(name) { }  // constructors aren't inherited
      public void Fly() { }
      public void Swim() { }
      public string Describe() => $"{Name} can fly and swim"; // protected member
  }

  // class Robot : Animal, Machine { }  // compile error: only one base class
popularity: 9.0
isPublished: true
---
