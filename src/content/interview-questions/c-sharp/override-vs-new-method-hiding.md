---
course: c-sharp
slug: override-vs-new-method-hiding
experienceLevel: mid
difficulty: medium
tags:
  - oop
question: "What is the difference between `override` and `new` (method hiding) in C#?"
answer: |
  `override` gives you **runtime (virtual) dispatch**: the method that runs depends on the actual type of the object, not the type of the variable. It only compiles if the base member is `virtual`, `abstract`, or already an `override`.

  `new` is **method hiding**: the derived class declares a separate member that happens to share the name. Calls bind to the compile-time type of the reference, so if `b` is declared as `Base`, `b.Hidden()` runs the base version even when the object is a `Derived`.

  If you redeclare the member without either keyword, it is still hidden, but the compiler warns (CS0108, or CS0114 when the base member is `virtual`). Writing `new` only documents that the hiding is intentional and silences the warning; the behavior is the same.

  Hiding is usually a smell: the same object behaves differently depending on the variable's declared type, which breaks polymorphism and surprises callers. Reserve `new` for collisions you can't avoid, such as a third-party base class later adding a member with your member's name.
codeExample: |
  Base b = new Derived();
  Derived d = (Derived)b; // same object, different variable type

  b.Speak();  // Output: Derived.Speak (override: the object's type wins)
  b.Hidden(); // Output: Base.Hidden   (new: the variable's type wins)
  d.Hidden(); // Output: Derived.Hidden

  class Base
  {
      public virtual void Speak() => Console.WriteLine("Base.Speak");
      public void Hidden() => Console.WriteLine("Base.Hidden");
  }

  class Derived : Base
  {
      public override void Speak() => Console.WriteLine("Derived.Speak");
      public new void Hidden() => Console.WriteLine("Derived.Hidden");
  }
popularity: 8.6
isPublished: true
---
