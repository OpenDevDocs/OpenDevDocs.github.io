---
course: c-sharp
slug: ref-out-in-parameters
experienceLevel: fresher
difficulty: medium
tags:
  - basics
question: "What is the difference between `ref`, `out`, and `in` parameters in C#?"
answer: |
  All three pass an argument **by reference**, so the method works with the caller's variable instead of a copy. They differ in who initializes it and who may change it.

  - `ref`: the variable **must be initialized** before the call, and the method can read and modify it.
  - `out`: the caller doesn't need to initialize it, but the method **must assign** it before returning. It's the standard way to return extra results, as in `int.TryParse(text, out int value)`.
  - `in` (C# 7.2): a **read-only** reference, mainly used to avoid copying large structs.

  A common confusion: passing a class instance without `ref` already lets the method modify the object's contents, but assigning a new object to the parameter doesn't affect the caller's variable. With `ref`, that reassignment is visible to the caller.

  The `ref` and `out` keywords must appear at both the declaration and the call site.
codeExample: |
  int counter = 1;
  Increment(ref counter);
  Console.WriteLine(counter);                // Output: 2

  if (TryDivide(10, 4, out double result))
      Console.WriteLine(result);             // Output: 2.5

  var point = (X: 3.0, Y: 4.0);
  Console.WriteLine(Length(in point));       // Output: 5

  var list = new List<int> { 1 };
  Replace(list);
  Console.WriteLine(list.Count);             // Output: 2 (modified, not replaced)
  ReplaceRef(ref list);
  Console.WriteLine(list.Count);             // Output: 0 (caller's variable replaced)

  static void Increment(ref int value) => value++;
  static bool TryDivide(int a, int b, out double quotient)
  {
      quotient = b == 0 ? 0 : (double)a / b; // out must be assigned before returning
      return b != 0;
  }
  static double Length(in (double X, double Y) v) => Math.Sqrt(v.X * v.X + v.Y * v.Y);
  static void Replace(List<int> items) { items.Add(2); items = []; }
  static void ReplaceRef(ref List<int> items) => items = [];
popularity: 9.1
isPublished: true
---
