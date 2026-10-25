---
course: c-sharp
slug: sealed-classes-and-devirtualization
experienceLevel: senior
difficulty: medium
tags:
  - performance
  - clr
question: "Does marking classes `sealed` improve performance in .NET? What is devirtualization?"
answer: |
  Yes, modestly and for free. The mechanism is **devirtualization**.

  A `virtual` or interface call normally goes through **indirection**: the runtime loads the object's MethodTable and jumps through a vtable slot or an interface dispatch stub, because a subclass might override the method. It also usually blocks **inlining**, which is what unlocks most other optimizations.

  **Devirtualization** means the JIT proves which implementation will run and emits a **direct call**, which it can then inline. `sealed` helps it prove that: if the static type is a sealed class, or the method is a `sealed override`, no other implementation can exist.

  Sealing also speeds up **type checks and casts**. `obj is MySealedType` becomes a single MethodTable pointer comparison, because no subclass needs to be considered. Array stores of sealed element types can skip some covariance checks too.

  Dynamic PGO already performs **guarded devirtualization** for the common case, so the gains from sealing are smaller than they used to be, but they're reliable and cost nothing. Analyzer **CA1852** flags internal types that could be sealed.

  There's a design benefit as well: sealing by default makes extensibility an explicit decision.
codeExample: |
  Shape s = new Circle(2);
  Circle c = new Circle(2);

  Console.WriteLine(s.Area());   // virtual call unless the JIT can prove the type
  Console.WriteLine(c.Area());   // sealed: a direct call that can be inlined

  object o = c;
  Console.WriteLine(o is Circle);  // Output: True (one MethodTable comparison)

  public abstract class Shape
  {
      public abstract double Area();
  }

  public sealed class Circle(double radius) : Shape   // no subclass can override Area
  {
      public override double Area() => Math.PI * radius * radius;
  }

  // For hot paths, measure with BenchmarkDotNet before and after sealing;
  // analyzer CA1852 lists internal types that can be sealed safely.
popularity: 6.8
isPublished: true
---
