---
course: c-sharp
slug: string-vs-system-string
experienceLevel: fresher
difficulty: easy
tags:
  - strings
  - types
question: "What is the difference between `string` and `String` in C#?"
answer: |
  There is no functional difference. `string` is a C# keyword that is an **alias** for the .NET type `System.String`, so both compile to exactly the same IL and behave identically.

  The same pattern applies to the other built-in types: `int` is `System.Int32`, `bool` is `System.Boolean`, and `object` is `System.Object`.

  The only practical difference is scope: `string` is a keyword, so it always works, while `String` needs the `System` namespace imported (implicit usings do this in modern projects). Style guides, including the one used by the .NET runtime team, prefer the keyword everywhere, even for static calls like `string.Join`. Whatever you choose, be consistent across the codebase.
codeExample: |
  string a = "hello";
  String b = "hello";                // same type, different spelling
  System.String c = "hello";         // fully qualified name

  Console.WriteLine(a.GetType() == b.GetType());       // Output: True
  Console.WriteLine(typeof(string) == typeof(String)); // Output: True
  Console.WriteLine(a.GetType().FullName);             // Output: System.String

  // Static members are reachable through either name
  Console.WriteLine(string.Join(", ", a, b));          // Output: hello, hello
  Console.WriteLine(String.IsNullOrEmpty(c));          // Output: False

  // The same idea applies to other built-in types
  Console.WriteLine(typeof(int) == typeof(Int32));     // Output: True
popularity: 7.6
isPublished: true
---
