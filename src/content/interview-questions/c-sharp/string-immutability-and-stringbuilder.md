---
course: c-sharp
slug: string-immutability-and-stringbuilder
experienceLevel: fresher
difficulty: easy
tags:
  - strings
  - performance
question: "Why are strings immutable in C#, and when should you use `StringBuilder`?"
answer: |
  A `string` object can never change after it's created. Methods like `Replace` and `ToUpper`, and operators like `+`, return a **new** string and leave the original untouched.

  Immutability has real benefits:

  - **Thread safety:** strings can be shared across threads without locks.
  - **Safe keys:** a string's hash code never changes, so it works reliably in a `Dictionary` or `HashSet`.
  - **Interning:** identical literals can share one instance to save memory.
  - **Security:** a validated value, such as a file path, can't be altered afterward.

  The cost shows up in loops. Each `+=` copies the whole string into a new allocation, so building a long string piece by piece does O(n²) work and creates lots of garbage. `StringBuilder` keeps a resizable buffer and appends in place.

  Use `StringBuilder` when you append many times in a loop. For a handful of pieces, concatenation or interpolation is clearer and just as efficient.
codeExample: |
  using System.Text;

  // Slow: each += allocates a new string and copies everything so far
  string csv = "";
  for (int i = 0; i < 1_000; i++)
  {
      csv += i + ",";
  }

  // Fast: appends go into one growing buffer
  var sb = new StringBuilder(capacity: 4_000);   // optional size hint
  for (int i = 0; i < 1_000; i++)
  {
      sb.Append(i).Append(',');
  }
  string result = sb.ToString();
  Console.WriteLine(csv == result);     // Output: True

  // Immutability: the original never changes
  string name = "ada";
  string upper = name.ToUpper();
  Console.WriteLine($"{name} {upper}"); // Output: ada ADA
popularity: 9.3
isPublished: true
---
