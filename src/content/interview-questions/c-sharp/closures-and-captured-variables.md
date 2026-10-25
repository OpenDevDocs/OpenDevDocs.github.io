---
course: c-sharp
slug: closures-and-captured-variables
experienceLevel: mid
difficulty: medium
tags:
  - delegates
question: "What is a closure in C#, and what is the captured loop variable problem?"
answer: |
  A **closure** is a lambda or local function that uses variables from its enclosing scope. The key fact is that C# captures the **variable itself, not a snapshot of its value**. The compiler moves captured locals into a hidden, compiler-generated class, and the method and the lambda then share that one storage location. So:

  - Changes made after the lambda is created are visible inside it.
  - Changes made inside the lambda are visible to the outer method.
  - A captured variable lives as long as the delegate does, even after the method returns.

  The classic bug is capturing a `for` loop variable. There's only one `i` for the whole loop, so every lambda created in the loop sees its final value when it eventually runs. The fix is to copy it into a local declared inside the loop body, which gives each iteration its own variable.

  `foreach` hasn't had this problem since C# 5, where each iteration gets a fresh variable. The `for` version still bites people, especially with `Task.Run` callbacks.
codeExample: |
  var actions = new List<Action>();
  for (int i = 0; i < 3; i++)
  {
      actions.Add(() => Console.Write($"{i} "));    // captures the single 'i'
  }
  actions.ForEach(a => a());                        // Output: 3 3 3
  Console.WriteLine();

  actions.Clear();
  for (int i = 0; i < 3; i++)
  {
      int copy = i;                                 // a new variable per iteration
      actions.Add(() => Console.Write($"{copy} "));
  }
  actions.ForEach(a => a());                        // Output: 0 1 2
  Console.WriteLine();

  var counter = MakeCounter();
  Console.WriteLine($"{counter()} {counter()} {counter()}"); // Output: 1 2 3

  static Func<int> MakeCounter()
  {
      int count = 0;              // outlives MakeCounter: captured by the lambda
      return () => ++count;
  }
popularity: 8.0
isPublished: true
---
