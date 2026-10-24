---
course: c-sharp
slug: for-vs-foreach
experienceLevel: fresher
difficulty: easy
tags:
  - basics
question: "What is the difference between `for` and `foreach` loops in C#?"
answer: |
  A `for` loop is **index-based**: you control the counter, the condition, and the step. A `foreach` loop **iterates over a sequence**, visiting each element once without an index.

  Use `for` when you need the index, want to skip elements or loop backward, or need to assign array elements, because the `foreach` iteration variable is read-only.

  Use `foreach` whenever you just need each item. It's more readable and works on anything enumerable: arrays, lists, dictionaries, LINQ results, and your own types that expose a `GetEnumerator()` method.

  Pitfall: you can't add or remove items in a `List<T>` while a `foreach` loop is iterating over it. The next iteration throws `InvalidOperationException`. Loop backward with `for`, or use `RemoveAll`.

  For arrays and lists, the performance difference is negligible. C# also has `while`, which checks its condition before each pass, and `do-while`, which always runs its body at least once.
codeExample: |
  int[] scores = [70, 85, 90];

  // for: index access, and you can assign elements
  for (int i = 0; i < scores.Length; i++)
  {
      scores[i] += 5;
  }

  // foreach: simpler when you only need each value
  foreach (int score in scores)
  {
      Console.Write($"{score} ");       // Output: 75 90 95
      // score = 0;                     // compile error: read-only variable
  }
  Console.WriteLine();

  var names = new List<string> { "Ada", "Bob", "Cy" };
  // foreach (var n in names) names.Remove(n); // throws InvalidOperationException

  for (int i = names.Count - 1; i >= 0; i--)   // safe: remove while going backward
  {
      if (names[i].StartsWith('B')) names.RemoveAt(i);
  }
  Console.WriteLine(string.Join(", ", names));  // Output: Ada, Cy
popularity: 7.2
isPublished: true
---
