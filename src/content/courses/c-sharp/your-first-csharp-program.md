---
publishDate: 2026-04-02T11:02
title: Your First C# Program
slug: your-first-csharp-program
metadescription: Walk through Program.cs line by line, learn what namespaces, classes and the Main method do, and write a program that reads input and prints a reply.
updateDate: 2026-09-05T11:02
author: ['bishal-biswas']
level: 1
tags: ['basics', 'console']
course: c-sharp
---

## The classic Hello World

Here is the traditional form of a C# program, the one you will see in most books and older tutorials:

```csharp
using System;

namespace HelloWorld
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("Hello, World!");
        }
    }
}
```

Let us go through it from the outside in.

### using System;

A `using` directive tells the compiler which **namespace** you want to use without typing its full name. `Console` lives in the `System` namespace. Without the directive you would have to write `System.Console.WriteLine`.

### namespace HelloWorld

A namespace groups related code and prevents name clashes. Two libraries can both have a class called `Logger` as long as they are in different namespaces.

### class Program

All C# code lives inside a class (or a struct, record or interface). `Program` is just the conventional name for the class that starts the app.

### static void Main

`Main` is the **entry point**. When you run the program, .NET looks for this method and calls it.

- `static` means you do not need to create a `Program` object to call it.
- `void` means it returns nothing.
- `string[] args` receives any command line arguments.

### Console.WriteLine

Prints text and moves to a new line. `Console.Write` prints without the line break.

## The modern form

Since C# 9 you can write the same program in one line:

```csharp
Console.WriteLine("Hello, World!");
```

The compiler generates the class and `Main` method for you. This is called **top level statements**. It only works in one file per project, and that file becomes the entry point.

## Statements and semicolons

A **statement** is one instruction. Each ends with a semicolon.

```csharp
Console.WriteLine("First");
Console.WriteLine("Second");
Console.WriteLine("Third");
```

Whitespace does not matter to the compiler. These three could be on one line, but please do not.

## Comments

Comments are notes for humans. The compiler ignores them.

```csharp
// This is a single line comment

/*
   This is a multi line comment.
   It can span several lines.
*/

/// <summary>
/// This is an XML documentation comment. Editors show it as a tooltip.
/// </summary>
```

## Reading input

`Console.ReadLine()` waits for the user to type something and press Enter. It returns a `string`.

```csharp
Console.Write("Enter your name: ");
string? name = Console.ReadLine();
Console.WriteLine("Hello, " + name + "!");
```

The `?` after `string` means the value could be `null`, for example if input is closed. You will learn much more about nullable types later.

## Joining text with interpolation

Putting `+` between strings works, but **string interpolation** is cleaner. Put a `$` before the opening quote and wrap expressions in braces:

```csharp
string name = "Asha";
int age = 25;
Console.WriteLine($"{name} is {age} years old.");
Console.WriteLine($"Next year {name} will be {age + 1}.");
```

## Case matters

C# is **case sensitive**. `Console` and `console` are different names, and only the first exists.

```csharp
Console.WriteLine("Works");
// console.WriteLine("Does not compile");
```

The convention is **PascalCase** for classes, methods and properties (`Console`, `WriteLine`) and **camelCase** for local variables and parameters (`userName`, `args`).

## Compile errors are your friend

Try removing a semicolon and running the program:

```
error CS1002: ; expected
```

The compiler tells you the file, the line and what it expected. Read the message before you change anything. Most beginner errors are a missing semicolon, a missing brace or a misspelled name.

## Quick recap

- `using` imports a namespace so you can use its types by short name.
- `Main` is the entry point, and top level statements let the compiler write it for you.
- Every statement ends with a semicolon, and code blocks live in braces.
- `Console.WriteLine` prints, `Console.ReadLine` reads a line of input.
- String interpolation with `$"..."` is the cleanest way to build text.
- C# is case sensitive, and compiler errors point you at the exact problem.

<code id="code-content" class="language-csharp">
// Program.cs - a complete first program using top level statements
// Greet the user
Console.WriteLine("Welcome to the C# course!");
// Ask for a name and read the reply
Console.Write("What is your name? ");
string? name = Console.ReadLine();
// Ask for an age and convert the text to a number
Console.Write("How old are you? ");
int age = int.Parse(Console.ReadLine() ?? "0");
// Use string interpolation to build the message
Console.WriteLine($"Hello {name}, next year you will be {age + 1}.");
/*
   Sample run:
   What is your name? Asha
   How old are you? 25
   Hello Asha, next year you will be 26.
*/
</code></pre>
