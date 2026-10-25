---
course: c-sharp
slug: first-vs-firstordefault-vs-single
experienceLevel: mid
difficulty: easy
tags:
  - linq
question: "What is the difference between `First`, `FirstOrDefault`, `Single`, and `SingleOrDefault`?"
answer: |
  All four return one element. They differ in how many matches they expect and what happens otherwise:

  - `First()`: returns the first match, and throws `InvalidOperationException` if there are none.
  - `FirstOrDefault()`: returns the first match, or `default(T)` if there are none, which is `null` for reference types and `0` for `int`. Since .NET 6, an overload lets you pass your own default value.
  - `Single()`: requires **exactly one** match, and throws if there are none or more than one.
  - `SingleOrDefault()`: returns the only match, or the default if there are none. It still throws if there's more than one.

  Choose by intent. Use `Single` when a duplicate would mean a data bug, such as a lookup by unique ID, so the bug surfaces immediately. Use `First` when any match will do, ideally with a defined order. Use the `OrDefault` variants when "not found" is a normal outcome, and check the result.

  `Single` must keep scanning past the first match to prove there isn't a second one. Against a database, it fetches up to two rows.
codeExample: |
  int[] ids = [4, 8, 15, 16];

  Console.WriteLine(ids.First(n => n > 5));                // Output: 8
  Console.WriteLine(ids.FirstOrDefault(n => n > 100));     // Output: 0 (default int)
  Console.WriteLine(ids.FirstOrDefault(n => n > 100, -1)); // Output: -1 (.NET 6+)
  Console.WriteLine(ids.Single(n => n == 15));             // Output: 15

  string[] users = ["ada", "bob"];
  Console.WriteLine(users.SingleOrDefault(u => u == "zoe") ?? "none"); // Output: none

  try { ids.First(n => n > 100); }
  catch (InvalidOperationException) { Console.WriteLine("First: no match"); }

  try { ids.Single(n => n > 5); }        // 8, 15, and 16 all match
  catch (InvalidOperationException) { Console.WriteLine("Single: more than one"); }

  try { ids.SingleOrDefault(n => n > 5); }
  catch (InvalidOperationException) { Console.WriteLine("SingleOrDefault: too many"); }
popularity: 8.8
isPublished: true
---
