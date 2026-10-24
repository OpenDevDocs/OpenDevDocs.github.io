---
course: c-sharp
slug: lambda-expressions
experienceLevel: fresher
difficulty: easy
tags:
  - delegates
question: "What are lambda expressions in C#?"
answer: |
  A **lambda expression** is an anonymous function written inline with the `=>` operator: parameters on the left, the body on the right. `x => x * 2` takes `x` and returns `x * 2`.

  There are two forms:

  - **Expression lambdas** have a single expression as the body: `(a, b) => a + b`.
  - **Statement lambdas** use a braced block, with `return` when they produce a value.

  A lambda converts to a delegate type such as `Func<int, int>` or `Action<string>`, and the compiler infers the parameter types from that target. Lambdas are everywhere in LINQ, as in `orders.Where(o => o.Total > 100)`. A lambda can also become an expression tree, which is how EF Core turns queries into SQL.

  Lambdas can also **capture** variables from the surrounding method. Since C# 10, lambdas have a natural type, so `var square = (int x) => x * x;` compiles.
codeExample: |
  Func<int, int> square = x => x * x;              // expression lambda
  Func<int, int, int> add = (a, b) => a + b;
  Action<string> greet = name => Console.WriteLine($"Hi, {name}!");

  Func<int, string> classify = n =>                // statement lambda
  {
      if (n < 0) return "negative";
      return n == 0 ? "zero" : "positive";
  };

  Console.WriteLine(square(5));        // Output: 25
  Console.WriteLine(add(2, 3));        // Output: 5
  greet("Ada");                        // Output: Hi, Ada!
  Console.WriteLine(classify(-4));     // Output: negative

  int[] numbers = [1, 2, 3, 4, 5, 6];
  var evens = numbers.Where(n => n % 2 == 0);      // lambdas power LINQ
  Console.WriteLine(string.Join(", ", evens));     // Output: 2, 4, 6

  var cube = (int x) => x * x * x;                 // natural type (C# 10)
  Console.WriteLine(cube(3));          // Output: 27
popularity: 8.0
isPublished: true
---
