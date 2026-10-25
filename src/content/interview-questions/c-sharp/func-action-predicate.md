---
course: c-sharp
slug: func-action-predicate
experienceLevel: mid
difficulty: easy
tags:
  - delegates
question: "What are `Func`, `Action`, and `Predicate` delegates in C#?"
answer: |
  They're built-in generic delegate types, so you rarely need to declare your own:

  - `Func<..., TResult>` represents a method that **returns a value**. The last type argument is the return type: `Func<int, int, int>` takes two `int` values and returns an `int`, and `Func<string>` takes nothing and returns a `string`. Overloads exist for up to 16 parameters.
  - `Action<...>` represents a method that **returns `void`**: `Action<string>` takes a string, and plain `Action` takes nothing.
  - `Predicate<T>` takes a `T` and returns `bool`. It's equivalent to `Func<T, bool>` but predates it, so it appears in older APIs such as `List<T>.FindAll`, `Exists`, and `RemoveAll`. LINQ uses `Func<T, bool>` instead.

  Use them for callbacks, strategies, and anywhere you pass behavior as a parameter, usually as lambdas.

  Declare a custom delegate type only when it adds something: a meaningful domain name, `ref` or `out` parameters, or a signature that must match an external contract. Delegate types with the same signature aren't interchangeable, so a `Predicate<int>` can't be passed where a `Func<int, bool>` is expected.
codeExample: |
  Func<int, int, int> add = (a, b) => a + b;        // returns a value
  Action<string> log = msg => Console.WriteLine($"[log] {msg}"); // returns void
  Predicate<int> isEven = n => n % 2 == 0;          // returns bool

  log($"2 + 3 = {add(2, 3)}");                      // Output: [log] 2 + 3 = 5

  var numbers = new List<int> { 1, 2, 3, 4, 5, 6 };
  List<int> evens = numbers.FindAll(isEven);        // older API: Predicate<T>
  var odds = numbers.Where(n => !isEven(n));        // LINQ: Func<T, bool>
  Console.WriteLine(string.Join(",", evens));       // Output: 2,4,6
  Console.WriteLine(string.Join(",", odds));        // Output: 1,3,5

  // numbers.Where(isEven);   // compile error: Predicate<int> isn't a Func<int, bool>

  Retry(() => Console.WriteLine("Attempt"), times: 2); // Output: Attempt (twice)

  static void Retry(Action action, int times)       // behavior as a parameter
  {
      for (int i = 0; i < times; i++) action();
  }
popularity: 8.4
isPublished: true
---
