---
course: c-sharp
slug: value-types-vs-reference-types
experienceLevel: fresher
difficulty: easy
tags:
  - types
  - memory
question: "What is the difference between value types and reference types in C#?"
answer: |
  The difference is what a variable holds. A **value type** variable contains its data directly, so assignment copies the whole value. A **reference type** variable contains a reference to an object, so assignment copies only the reference, and both variables then share one object.

  - **Value types:** `struct`, `enum`, numeric types, `bool`, and `char`. They can't be `null` unless declared nullable (`int?`).
  - **Reference types:** `class`, `interface`, `delegate`, arrays, `string`, and `record` (but `record struct` is a value type). They can be `null`.

  Where they live is an implementation detail: value-type locals typically sit on the stack, value-type fields are stored inline inside their containing object, and reference-type objects live on the managed heap, where the garbage collector reclaims them.

  Pitfall: a method that receives a class instance can modify the caller's object, while a struct argument is just a copy.
codeExample: |
  var s1 = new PointStruct { X = 1 };
  var s2 = s1;                // copies the whole value
  s2.X = 99;
  Console.WriteLine(s1.X);    // Output: 1  (s1 is unaffected)

  var c1 = new PointClass { X = 1 };
  var c2 = c1;                // copies only the reference
  c2.X = 99;
  Console.WriteLine(c1.X);    // Output: 99 (one shared object)

  ResetStruct(s1);
  ResetClass(c1);
  Console.WriteLine($"{s1.X}, {c1.X}"); // Output: 1, 0

  static void ResetStruct(PointStruct p) => p.X = 0; // modifies a copy
  static void ResetClass(PointClass p) => p.X = 0;   // modifies caller's object

  struct PointStruct { public int X; }
  class PointClass { public int X; }
popularity: 9.6
isPublished: true
---
