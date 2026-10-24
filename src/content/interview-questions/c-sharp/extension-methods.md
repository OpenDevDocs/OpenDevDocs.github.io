---
course: c-sharp
slug: extension-methods
experienceLevel: fresher
difficulty: medium
tags:
  - oop
  - basics
question: "What are extension methods in C#, and how do they work?"
answer: |
  **Extension methods** let you add methods to an existing type without modifying it, inheriting from it, or recompiling it. You write a `static` method in a `static` class and mark its first parameter with `this`. That parameter's type is the type being extended, and callers use the method as if it were an instance method: `"hello world".WordCount()`.

  How they work:

  - It's compiler sugar: `text.WordCount()` compiles to `StringExtensions.WordCount(text)`, resolved at compile time.
  - The containing namespace must be imported for the method to be visible.
  - They can't access private members of the extended type.
  - If the type already has an instance method with the same signature, the instance method wins.

  All of LINQ is built this way: `Where` and `Select` are extension methods on `IEnumerable<T>`. C# 14 generalizes the idea with **extension members**, which also allow extension properties and static extension members.
codeExample: |
  string sentence = "The quick brown fox";
  Console.WriteLine(sentence.WordCount());       // Output: 4
  Console.WriteLine("".WordCount());             // Output: 0

  // The same call written the long way
  Console.WriteLine(StringExtensions.WordCount(sentence)); // Output: 4

  int[] numbers = [3, 8, 1];
  Console.WriteLine(numbers.SecondLargest());    // Output: 3

  public static class StringExtensions
  {
      // "this" marks the type being extended
      public static int WordCount(this string text) =>
          text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
  }

  public static class EnumerableExtensions
  {
      public static int SecondLargest(this IEnumerable<int> source) =>
          source.OrderDescending().Skip(1).First();
  }
popularity: 8.2
isPublished: true
---
