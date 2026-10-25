---
course: c-sharp
slug: structure-of-a-csharp-program
experienceLevel: fresher
difficulty: easy
tags:
  - basics
question: "What is the basic structure of a C# program, and what are top-level statements?"
answer: |
  A traditional C# program has four parts:

  - `using` directives that import namespaces, such as `using System.Text;`.
  - A namespace that groups related types. C# 10 file-scoped namespaces (`namespace MyApp;`) apply to the whole file without braces.
  - Types (classes, structs, records) that hold the code.
  - A `static Main` method as the entry point. It returns `void`, `int`, `Task`, or `Task<int>` and may take `string[] args`. An `int` result becomes the process exit code, and `async Task Main` lets you use `await`.

  **Top-level statements** (C# 9) remove this boilerplate. You write statements directly in one file, and the compiler generates the `Program` class and entry-point method. You can still use `args`, `await`, and `return` an exit code. Only one file per project may use them.

  Since .NET 6, **implicit usings** (generated `global using` directives) import common namespaces such as `System` and `System.Linq` into every file.
codeExample: |
  // Program.cs, traditional structure
  using System.Text;                  // using directive

  namespace Demo;                     // file-scoped namespace (C# 10)

  public class Program                // a type that holds the entry point
  {
      public static async Task<int> Main(string[] args)
      {
          var sb = new StringBuilder("Args: ");
          sb.Append(args.Length);
          Console.WriteLine(sb);

          await Task.Delay(100);      // allowed because Main is async
          return 0;                   // becomes the process exit code
      }
  }

  // The same program with top-level statements (C# 9), the whole file:
  // using System.Text;
  // var sb = new StringBuilder("Args: ");
  // sb.Append(args.Length);
  // Console.WriteLine(sb);
  // await Task.Delay(100);
  // return 0;
popularity: 7.0
isPublished: true
---
