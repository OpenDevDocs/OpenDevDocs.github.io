---
course: c-sharp
slug: defensive-copies-readonly-struct-in
experienceLevel: senior
difficulty: hard
tags:
  - types
  - performance
question: "What are defensive copies of structs, and how do `readonly struct` and `in` parameters help avoid them?"
answer: |
  When the compiler must guarantee that a struct **can't be modified**, but you call a member that **might** modify it, it silently operates on a **copy**. That's a **defensive copy**.

  It happens when you call a **non-readonly** method or property on a struct accessed through a read-only location:

  - A `readonly` field.
  - An `in` parameter or a `ref readonly` local.

  The compiler can't know whether the member mutates `this`, so it copies the struct first to protect the original. For small structs that's negligible. For a 64-byte struct in a tight loop it's a real cost, and mutating methods quietly have no effect, which is also a correctness bug.

  How to avoid them:

  - Declare the type as a **`readonly struct`**. All its fields are read-only and every member is known not to mutate, so no copies are ever needed.
  - On a mutable struct, mark individual non-mutating members `readonly` (C# 8), as in `public readonly double Length()`.
  - Use **`in`** parameters only with `readonly struct` types. With a mutable struct, `in` avoids the copy at the call site but reintroduces defensive copies at every member access inside the method.
codeExample: |
  var holder = new Holder();
  holder.Counter.Increment();              // runs on a defensive copy!
  Console.WriteLine(holder.Counter.Value); // Output: 0 (the field never changed)

  var v = new Vector3D(1, 2, 2);
  Console.WriteLine(Length(in v));         // Output: 3 (readonly struct: no copies)

  static double Length(in Vector3D v) => v.Length(); // safe: v is a readonly struct

  class Holder { public readonly MutableCounter Counter; } // readonly field

  struct MutableCounter
  {
      public int Value;
      public void Increment() => Value++;      // mutates 'this'
      public readonly int Peek() => Value;     // readonly member: no copy needed
  }

  readonly record struct Vector3D(double X, double Y, double Z)
  {
      public double Length() => Math.Sqrt(X * X + Y * Y + Z * Z);
  }
popularity: 7.2
isPublished: true
---
