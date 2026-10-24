---
course: c-sharp
slug: method-overloading-vs-overriding
experienceLevel: fresher
difficulty: easy
tags:
  - oop
question: "What is the difference between method overloading and method overriding?"
answer: |
  **Overloading** means defining several methods with the **same name but different parameter lists** (a different number, type, or order of parameters), usually in the same class. The compiler picks one based on the arguments, at compile time. A different return type alone isn't enough to overload a method.

  **Overriding** means a derived class **replaces the implementation** of a base-class method with the **same signature**. The base method must be `virtual` or `abstract`, the derived one is marked `override`, and the choice happens at runtime based on the object's actual type.

  Quick comparison:

  - Overloading: same class, different signatures, compile-time binding, no special keywords.
  - Overriding: base and derived classes, same signature, runtime binding, `virtual` and `override`.

  A third, rarer option is method hiding with the `new` modifier, which is not true overriding.
codeExample: |
  var calc = new Calculator();
  Console.WriteLine(calc.Add(2, 3));         // Output: 5    (int version)
  Console.WriteLine(calc.Add(2.5, 3.25));    // Output: 5.75 (double version)
  Console.WriteLine(calc.Add(1, 2, 3));      // Output: 6    (three parameters)

  Animal pet = new Dog();
  Console.WriteLine(pet.Speak());            // Output: Woof (override wins)

  class Calculator
  {
      // Overloads: same name, different parameter lists
      public int Add(int a, int b) => a + b;
      public double Add(double a, double b) => a + b;
      public int Add(int a, int b, int c) => a + b + c;
      // public double Add(int a, int b) => a + b; // compile error: return type alone
  }

  class Animal { public virtual string Speak() => "..."; }

  class Dog : Animal
  {
      public override string Speak() => "Woof"; // same signature, new behavior
  }
popularity: 9.3
isPublished: true
---
