---
course: c-sharp
slug: what-are-generics
experienceLevel: fresher
difficulty: easy
tags:
  - generics
question: "What are generics in C#, and why are they useful?"
answer: |
  **Generics** let you write classes, interfaces, and methods with a **type parameter**, a placeholder like `T` that callers fill in with a real type. `List<T>` is one implementation that works as `List<int>`, `List<string>`, or `List<Customer>`.

  Benefits:

  - **Type safety:** the compiler knows the exact element type, so adding a `string` to a `List<int>` is a compile error instead of a runtime crash.
  - **No casts:** reading from a `List<Customer>` returns a `Customer` directly.
  - **Performance:** value types are stored without boxing, unlike the old `ArrayList`, which held everything as `object`.
  - **Reuse:** one algorithm or container works for many types.

  You can declare generic classes (`Box<T>`), generic methods (`Swap<T>`), and generic interfaces (`IRepository<T>`). The compiler usually infers a method's type arguments from the values you pass. Constraints, written as `where T : ...`, restrict which types are allowed.
codeExample: |
  var intBox = new Box<int>(42);
  var textBox = new Box<string>("hello");
  Console.WriteLine(intBox.Value + 1);          // Output: 43 (no cast needed)
  Console.WriteLine(textBox.Value.ToUpper());   // Output: HELLO

  int a = 1, b = 2;
  Swap(ref a, ref b);                  // T inferred as int
  Console.WriteLine($"{a}, {b}");      // Output: 2, 1

  var numbers = new List<int> { 1, 2 };
  // numbers.Add("three");             // compile error: type safety

  static void Swap<T>(ref T x, ref T y) => (x, y) = (y, x);

  public class Box<T>(T value)
  {
      public T Value { get; } = value;
  }
popularity: 8.8
isPublished: true
---
