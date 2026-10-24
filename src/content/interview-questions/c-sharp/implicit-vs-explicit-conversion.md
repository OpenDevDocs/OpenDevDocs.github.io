---
course: c-sharp
slug: implicit-vs-explicit-conversion
experienceLevel: fresher
difficulty: easy
tags:
  - types
question: "What is the difference between implicit and explicit type conversion in C#?"
answer: |
  An **implicit conversion** happens automatically because it can't fail, such as widening `int` to `long` or treating a derived class as its base class or an interface it implements.

  An **explicit conversion**, or cast, is required when data could be lost or the conversion could fail, so the compiler makes you state it on purpose:

  - `(int)9.99` truncates the fraction and gives `9`.
  - Narrowing, like `long` to `int`, silently wraps around on overflow by default. Use a `checked` block or expression to throw `OverflowException` instead.
  - Casting a base-type reference to a derived type compiles, but throws `InvalidCastException` at runtime if the object isn't actually that type.

  Your own types can define conversions with `implicit operator` and `explicit operator`. Make a conversion implicit only when it can never throw or lose information.

  To turn strings into numbers, casts don't work; use `Parse`, `TryParse`, or `Convert`.
codeExample: |
  int small = 123;
  long big = small;               // implicit: widening, always safe

  double price = 9.99;
  int whole = (int)price;         // explicit: truncates toward zero
  Console.WriteLine(whole);       // Output: 9

  long huge = 3_000_000_000;
  int wrapped = (int)huge;        // explicit: overflows silently
  Console.WriteLine(wrapped);     // Output: -1294967296
  // int safe = checked((int)huge); // throws OverflowException at runtime

  object obj = "text";
  string s = (string)obj;         // explicit downcast: succeeds
  // var sb = (System.Text.StringBuilder)obj; // throws InvalidCastException

  Celsius temp = new(25);
  double degrees = (double)temp;  // user-defined explicit conversion
  Console.WriteLine(degrees);     // Output: 25

  readonly record struct Celsius(double Degrees)
  {
      public static explicit operator double(Celsius c) => c.Degrees;
  }
popularity: 7.8
isPublished: true
---
