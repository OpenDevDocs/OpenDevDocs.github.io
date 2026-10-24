---
course: c-sharp
slug: boxing-and-unboxing
experienceLevel: fresher
difficulty: easy
tags:
  - types
  - performance
question: "What are boxing and unboxing in C#?"
answer: |
  **Boxing** converts a value type to `object` or to an interface it implements. The runtime allocates an object on the managed heap, copies the value into it, and returns a reference. **Unboxing** is the reverse: an explicit cast that checks the type and copies the value back out.

  Unboxing is strict: a boxed `int` must be unboxed as `int` (or `int?`). Unboxing it as `long` throws `InvalidCastException`, even though `int` normally converts to `long` implicitly.

  Each box costs a heap allocation, a copy, and extra garbage collection work, which adds up in hot loops. The box is also a separate copy, so changing the original variable doesn't affect it.

  Generics are the main fix. The legacy `ArrayList` stores items as `object`, so every `int` added to it is boxed, while `List<int>` stores ints directly with no boxing.
codeExample: |
  using System.Collections;

  int number = 42;
  object boxed = number;          // boxing: heap allocation + copy
  number = 100;
  Console.WriteLine(boxed);       // Output: 42 (the box holds its own copy)

  int unboxed = (int)boxed;       // unboxing: type check + copy
  // long wrong = (long)boxed;    // compiles, but throws InvalidCastException
  long ok = (int)boxed;           // unbox as int first, then widen to long

  var legacy = new ArrayList();
  legacy.Add(1);                  // boxes every int
  int first = (int)legacy[0]!;    // cast needed to unbox

  var modern = new List<int>();
  modern.Add(1);                  // no boxing: stored as int
  int firstGeneric = modern[0];   // no cast, no unboxing
popularity: 9.2
isPublished: true
---
