---
course: c-sharp
slug: parse-vs-tryparse-vs-convert
experienceLevel: fresher
difficulty: easy
tags:
  - types
question: "What is the difference between the `Parse`, `TryParse`, and `Convert` methods in C#?"
answer: |
  All three turn data such as strings into typed values, but they handle bad input differently.

  - `int.Parse` **throws** on failure: `FormatException` for text like `"abc"`, `OverflowException` when the number is out of range, and `ArgumentNullException` for `null`.
  - `int.TryParse` **never throws** for bad input. It returns a `bool` and delivers the number through an `out` parameter, which makes it the right choice for user input.
  - `Convert.ToInt32` accepts many types, including `object` and anything implementing `IConvertible`. It returns `0` for `null`, and it rounds doubles with **banker's rounding** (to the nearest even number), so `Convert.ToInt32(2.5)` is `2` and `Convert.ToInt32(3.5)` is `4`, whereas a cast always truncates.

  Parsing is also culture-sensitive: on a German-locale machine, `double.Parse("1.5")` returns `15` because the period is the thousands separator there. For machine-readable data such as files, JSON, or config values, pass `CultureInfo.InvariantCulture`.
codeExample: |
  using System.Globalization;

  int a = int.Parse("123");                 // 123
  // int.Parse("abc");                      // throws FormatException
  // int.Parse("99999999999");              // throws OverflowException

  if (int.TryParse("abc", out int b))
      Console.WriteLine(b);
  else
      Console.WriteLine("Invalid number");  // Output: Invalid number

  string? missing = null;
  Console.WriteLine(Convert.ToInt32(missing)); // Output: 0 (Parse would throw)
  Console.WriteLine(Convert.ToInt32(2.5));  // Output: 2 (banker's rounding)
  Console.WriteLine(Convert.ToInt32(3.5));  // Output: 4
  Console.WriteLine((int)3.5);              // Output: 3 (cast truncates)

  // Culture-safe parsing for machine data
  double rate = double.Parse("1.5", CultureInfo.InvariantCulture);
  Console.WriteLine(rate * 2);              // Output: 3
popularity: 7.9
isPublished: true
---
