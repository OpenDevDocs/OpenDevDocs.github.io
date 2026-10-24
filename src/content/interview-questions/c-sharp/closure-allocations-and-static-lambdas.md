---
course: c-sharp
slug: closure-allocations-and-static-lambdas
experienceLevel: senior
difficulty: hard
tags:
  - delegates
  - performance
question: "What allocations do lambdas and closures cause, and how do `static` lambdas help?"
answer: |
  The cost depends on what a lambda **captures**:

  - **Captures nothing:** the compiler caches the delegate in a static field the first time it's created, so later executions allocate nothing.
  - **Captures only `this`:** the compiler emits an instance method, but a **new delegate** is still allocated each time the lambda expression runs.
  - **Captures locals or parameters:** the compiler hoists them into a **closure object**, a generated "display class", and allocates a **new delegate** that points at it. That's two allocations.

  A subtle trap: the closure object is created when execution **enters the scope** that declares the captured variable, not when the lambda runs. A method that captures a parameter only on a rare error path still pays for the closure on every call. Moving the capturing code into a separate method or a narrower scope fixes it.

  **`static` lambdas** (C# 9), written `static x => x * 2`, make any capture a compile error. They document intent and guarantee the zero-allocation, cached-delegate case.

  When an API must pass state into a callback, prefer **state-passing overloads**, which take the state as an argument instead of capturing it: `ConcurrentDictionary.GetOrAdd(key, factory, arg)` and `string.Create(length, state, action)` are examples.
codeExample: |
  int factor = 3;
  Func<int, int> noCapture = static x => x * 2;    // cached: allocated once, ever
  Func<int, int> captures = x => x * factor;       // closure + delegate allocated
  // Func<int, int> bad = static x => x * factor;  // compile error: static lambda

  var cache = new System.Collections.Concurrent.ConcurrentDictionary<string, string>();
  string prefix = "user:";

  // Captures 'prefix': a closure and a delegate on every call
  string a = cache.GetOrAdd("42", key => prefix + key);

  // State-passing overload: a static lambda, no capture, no per-call allocation
  string b = cache.GetOrAdd("43", static (key, p) => p + key, prefix);
  Console.WriteLine($"{a} {b}");                   // Output: user:42 user:43

  static string Describe(int id, bool isError)
  {
      if (!isError) return $"#{id}";               // still pays for the closure below...
      Func<string> build = () => $"Error for #{id}"; // ...because 'id' is captured
      return build();
  }
popularity: 6.8
isPublished: true
---
