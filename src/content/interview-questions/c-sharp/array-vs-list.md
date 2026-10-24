---
course: c-sharp
slug: array-vs-list
experienceLevel: fresher
difficulty: easy
tags:
  - collections
question: "What is the difference between an array and a `List<T>` in C#?"
answer: |
  An **array** (`int[]`) has a **fixed size** set when it's created. Its elements are stored contiguously, indexing is very fast, and arrays support multiple dimensions (`int[,]`) and jagged forms (`int[][]`).

  A `List<T>` is a **resizable** collection. Internally it wraps an array, and when that array fills up, the list allocates a bigger one (roughly double the size) and copies the elements over. It adds convenient methods such as `Add`, `Insert`, `Remove`, `Contains`, and `Sort`.

  How to choose:

  - Use an array when the size is known and won't change, or for performance-critical code and APIs that expect arrays.
  - Use `List<T>` when items are added or removed over time.

  If you know roughly how many items a list will hold, pass that capacity to its constructor to avoid repeated resizing. The old non-generic `ArrayList` is legacy: it stores `object` and boxes value types.
codeExample: |
  int[] fixedScores = new int[3];            // size fixed at creation
  fixedScores[0] = 90;
  // fixedScores[3] = 70;                    // throws IndexOutOfRangeException
  Console.WriteLine(fixedScores.Length);     // Output: 3

  var scores = new List<int>(capacity: 4);   // grows as needed
  scores.Add(90);
  scores.Add(75);
  scores.Insert(0, 100);
  scores.Remove(75);
  Console.WriteLine(string.Join(", ", scores)); // Output: 100, 90
  Console.WriteLine(scores.Count);           // Output: 2

  int[] asArray = scores.ToArray();          // convert when an API needs an array
  List<int> backToList = [.. asArray];       // C# 12 collection expression
popularity: 8.4
isPublished: true
---
