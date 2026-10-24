---
course: c-sharp
slug: decimal-vs-double-vs-float
experienceLevel: fresher
difficulty: easy
tags:
  - types
question: "What is the difference between `float`, `double`, and `decimal`?"
answer: |
  All three hold fractional numbers, but they differ in base, precision, range, and speed.

  - `float`: 32-bit **binary** floating point, about 6 to 9 significant digits, literal suffix `f`.
  - `double`: 64-bit binary floating point, about 15 to 17 digits, the widest range, and the default for literals like `1.5`.
  - `decimal`: 128-bit **decimal** floating point, 28 to 29 significant digits, a much smaller range, literal suffix `m`.

  Binary types can't represent many base-10 fractions exactly, so `0.1 + 0.2` in `double` is not exactly `0.3`. A `decimal` stores base-10 digits, so such values are exact.

  `float` and `double` run in hardware and are fast; `decimal` math runs in software and is much slower.

  Use `decimal` for money, `double` for scientific and general math, and `float` for large arrays or graphics where memory matters. Avoid comparing doubles with `==`; check whether the difference is within a small tolerance.
codeExample: |
  double d = 0.1 + 0.2;
  decimal m = 0.1m + 0.2m;

  Console.WriteLine(d == 0.3);          // Output: False
  Console.WriteLine(d);                 // Output: 0.30000000000000004
  Console.WriteLine(m == 0.3m);         // Output: True

  float f = 1.0f / 3;                   // f suffix required for float literals
  Console.WriteLine(f);                 // Output: 0.33333334
  Console.WriteLine(1.0 / 3);           // Output: 0.3333333333333333
  Console.WriteLine(1.0m / 3);          // Output: 0.3333333333333333333333333333

  // decimal bad = 19.99;  // compile error: no implicit double-to-decimal
  decimal price = 19.99m;
  Console.WriteLine(price * 3);         // Output: 59.97

  // Compare doubles with a tolerance instead of ==
  Console.WriteLine(Math.Abs(d - 0.3) < 1e-9); // Output: True
popularity: 8.0
isPublished: true
---
