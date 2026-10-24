---
publishDate: 2026-04-01T11:00
title: Introduction to C# and .NET
slug: introduction-to-csharp-and-dotnet
metadescription: A beginner friendly introduction to C#, the .NET platform it runs on, where the language came from and what you can build with it.
updateDate: 2026-09-05T11:00
author: ['bishal-biswas']
level: 1
tags: ['basics', 'dotnet']
course: c-sharp
---

## What is C#?

C# (pronounced "C sharp") is a modern, general purpose programming language created by Microsoft. It is **statically typed**, which means the compiler checks your code before it runs, and it is **object oriented**, which means you organise code into classes and objects.

If you have written JavaScript or Python before, C# will feel familiar but stricter. The compiler catches a whole category of mistakes before your program ever starts.

## What is .NET?

C# does not run on its own. It runs on **.NET**, a free, open source platform that provides:

- **The runtime (CLR)**: the engine that executes your compiled code, manages memory and handles errors.
- **The base class library**: thousands of ready made classes for strings, files, networking, dates, collections and much more.
- **The SDK and tooling**: the `dotnet` command line tool, compilers and project templates.

Think of C# as the language you write and .NET as everything that makes that writing run.

## A very short history

- **2000**: C# 1.0 is announced alongside the first .NET Framework, led by Anders Hejlsberg.
- **2005**: C# 2.0 adds generics, the feature that makes `List<T>` possible.
- **2007**: C# 3.0 adds LINQ and lambda expressions.
- **2012**: C# 5.0 adds `async` and `await`.
- **2016**: .NET Core arrives, and C# becomes cross platform on Windows, macOS and Linux.
- **2020 onwards**: .NET 5, 6, 7, 8 and beyond unify everything into one platform with a yearly release.

The language you learn today is C# 12 and later, running on modern .NET. Anything called ".NET Framework" is the older Windows only version and you will rarely need it for new work.

## What can you build?

C# is used in a surprising number of places:

- **Web apps and APIs** with ASP.NET Core.
- **Desktop apps** with WPF, WinUI and Avalonia.
- **Mobile apps** with .NET MAUI.
- **Games** with Unity, the most popular game engine in the world.
- **Cloud services** on Azure and AWS.
- **Console tools and scripts** for automation.

## How C# code becomes a program

Here is the journey from source file to running program:

1. You write code in a `.cs` file.
2. The C# compiler turns it into **Intermediate Language (IL)**, a portable set of instructions.
3. At run time the CLR uses a **Just In Time (JIT)** compiler to turn IL into machine code for the CPU it is running on.

This two step process is why one build can run on Windows, macOS and Linux.

## What C# code looks like

You do not need to understand every word yet. Just notice the shape.

```csharp
// A tiny C# program
using System;

class Program
{
    static void Main()
    {
        // Print a message to the screen
        Console.WriteLine("Hello from C#!");

        // Declare a variable with a type
        int year = 2026;
        Console.WriteLine($"The year is {year}");
    }
}
```

A few things stand out:

- Every statement ends with a semicolon.
- Code lives inside braces `{ }`.
- Variables have a type, such as `int`.
- `Console.WriteLine` prints text.

## Top level statements

Modern .NET lets you skip the class and `Main` method wrapper for simple programs:

```csharp
// The same program with top level statements
Console.WriteLine("Hello from C#!");

int year = 2026;
Console.WriteLine($"The year is {year}");
```

Both versions do the same thing. The compiler adds the wrapper for you. This course uses top level statements for short examples and full classes when the structure matters.

## Quick recap

- C# is a statically typed, object oriented language created by Microsoft.
- .NET is the runtime and library platform that C# runs on, and it is free, open source and cross platform.
- Code is compiled to IL and then JIT compiled to machine code when it runs.
- C# powers web, desktop, mobile, game and cloud applications.
- Top level statements let small programs skip the boilerplate.

In the next topic you will install the tools and get ready to write your own code.

<code id="code-content" class="language-csharp">
// Program.cs - your first look at C#
using System;
class Program
{
    static void Main()
    {
        // 1. Printing to the console
        Console.WriteLine("Hello from C#!");
        // 2. Variables have a type
        int year = 2026;
        string language = "C#";
        // 3. String interpolation joins text and values
        Console.WriteLine($"Learning {language} in {year}");
        // 4. The compiler checks types before the program runs
        // int wrong = "text";   // this line would not compile
        // 5. .NET gives you a huge library for free
        Console.WriteLine(Math.Max(10, 42));          // 42
        Console.WriteLine(DateTime.Now.Year);         // current year
    }
}
</code></pre>
