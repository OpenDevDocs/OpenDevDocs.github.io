---
course: c-sharp
slug: what-is-a-delegate
experienceLevel: fresher
difficulty: medium
tags:
  - delegates
question: "What is a delegate in C#?"
answer: |
  A **delegate** is a type-safe reference to a method. It defines a method signature (parameter types and return type), and a delegate variable can point to any method with a matching signature and call it later.

  Think of it as a way to pass behavior around as a value. That makes delegates the foundation for:

  - **Callbacks:** telling a method what to do when its work finishes.
  - **Events:** buttons, timers, and other publishers notify subscribers through delegates.
  - **LINQ and higher-order methods:** `Where`, `Select`, and `List<T>.Sort` accept delegates, usually written as lambdas.

  You can declare your own delegate type, as in `delegate int Operation(int a, int b);`, but most code uses the built-in generic delegates `Func<...>` and `Action<...>`. Delegates are type-safe: assigning a method with the wrong signature is a compile error, not a runtime crash.
codeExample: |
  Operation op = Add;                   // point the delegate at a method
  Console.WriteLine(op(3, 4));          // Output: 7

  op = Multiply;                        // retarget it to another method
  Console.WriteLine(op(3, 4));          // Output: 12

  op = (a, b) => a - b;                 // or use a lambda
  Console.WriteLine(Apply(op, 10, 3));  // Output: 7

  // Built-in generic delegate: no custom declaration needed
  Func<int, int, int> max = Math.Max;
  Console.WriteLine(max(8, 5));         // Output: 8

  static int Add(int a, int b) => a + b;
  static int Multiply(int a, int b) => a * b;
  static int Apply(Operation operation, int x, int y) => operation(x, y); // callback

  delegate int Operation(int a, int b); // the delegate type: a method signature
popularity: 8.5
isPublished: true
---
