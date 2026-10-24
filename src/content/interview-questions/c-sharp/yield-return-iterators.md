---
course: c-sharp
slug: yield-return-iterators
experienceLevel: mid
difficulty: medium
tags:
  - collections
  - linq
question: "How does `yield return` work in C#?"
answer: |
  A method that contains `yield return` is an **iterator**. It returns `IEnumerable<T>` or `IEnumerator<T>`, and instead of building a whole collection up front, it produces items **one at a time, on demand**.

  The compiler rewrites the method into a hidden **state machine** class. Calling the method doesn't run its body. The body runs only when someone enumerates the result: each `MoveNext()` call executes code up to the next `yield return`, hands back that value, and pauses there, remembering its position and local variables. `yield break` ends the sequence early.

  Consequences:

  - **Laziness:** you can model huge or even infinite sequences, and a consumer that takes only the first few items never pays for the rest. LINQ's `Where` and `Select` work this way.
  - **Late validation:** argument checks inside an iterator don't run until the first `MoveNext()`. Validate in a regular wrapper method that then calls the iterator, often a local function.
  - **Re-execution:** each `foreach` over the result starts the method from scratch, repeating any expensive work or side effects.
codeExample: |
  foreach (int n in Fibonacci().Take(8))
      Console.Write($"{n} ");               // Output: 0 1 1 2 3 5 8 13
  Console.WriteLine();
  try { Range(-1); }                        // throws now, not at the first MoveNext()
  catch (ArgumentOutOfRangeException) { Console.WriteLine("Validated eagerly"); }

  static IEnumerable<int> Fibonacci()       // infinite, but lazy
  {
      (int a, int b) = (0, 1);
      while (true)
      {
          yield return a;                   // pauses here until the next MoveNext()
          (a, b) = (b, a + b);
      }
  }
  static IEnumerable<int> Range(int count)
  {
      ArgumentOutOfRangeException.ThrowIfNegative(count); // runs immediately
      return Iterate();

      IEnumerable<int> Iterate()            // the local iterator does the lazy part
      {
          for (int i = 0; i < count; i++) yield return i;
      }
  }
popularity: 8.3
isPublished: true
---
