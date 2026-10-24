---
course: c-sharp
slug: built-in-data-types
experienceLevel: fresher
difficulty: easy
tags:
  - types
question: "What are the built-in data types in C#?"
answer: |
  C# has a small set of built-in types, and each keyword is an alias for a .NET type in the `System` namespace, so `int` is `System.Int32`.

  - **Signed integers:** `sbyte` (8-bit), `short` (16), `int` (32), `long` (64)
  - **Unsigned integers:** `byte` (8-bit), `ushort` (16), `uint` (32), `ulong` (64)
  - **Native-sized integers:** `nint` and `nuint` (C# 9), 32 or 64 bits depending on the process
  - **Floating point:** `float` (32-bit), `double` (64-bit), `decimal` (128-bit, base 10)
  - **Other value types:** `bool` and `char` (a 16-bit UTF-16 code unit)
  - **Reference types:** `string` (immutable text), `object` (the base type of every type), and `dynamic` (checked at runtime)

  All numeric types, `bool`, and `char` are value types. Integer literals default to `int` and real literals to `double`. Prefer `int` for everyday numbers and `long` when values may exceed about 2.1 billion.
codeExample: |
  int count = 42;                 // System.Int32, 32-bit
  long big = 8_100_000_000;       // too large for int
  float f = 21.5f;                // f suffix
  double d = 0.75;                // real literals default to double
  decimal price = 19.99m;         // m suffix
  bool ok = true;
  char grade = 'A';               // one UTF-16 code unit
  string name = "Ada";            // reference type

  // object is the base type of all of them
  object[] values = [count, big, f, d, price, ok, grade, name];
  foreach (object v in values)
      Console.Write($"{v.GetType().Name} ");
  // Output: Int32 Int64 Single Double Decimal Boolean Char String

  Console.WriteLine();
  Console.WriteLine(typeof(int) == typeof(System.Int32)); // Output: True
  Console.WriteLine(sizeof(long));   // Output: 8
  Console.WriteLine(nint.Size);      // Output: 8 in a 64-bit process
popularity: 7.5
isPublished: true
---
