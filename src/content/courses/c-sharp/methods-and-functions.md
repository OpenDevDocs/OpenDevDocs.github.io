---
publishDate: 2026-04-06T11:10
title: Methods and Functions
slug: methods-and-functions
metadescription: Define and call methods in C#, understand signatures, static versus instance methods, expression bodied members, local functions and why small methods matter.
updateDate: 2026-09-05T11:10
author: ['bishal-biswas']
level: 1
tags: ['methods', 'functions']
course: c-sharp
---

## What is a method?

A method is a named block of code you can run whenever you need it. In C# every function lives inside a class, so the word **method** is used instead of function, but the idea is the same.

```csharp
static void SayHello()
{
    Console.WriteLine("Hello!");
}

SayHello();
SayHello();
```

Define it once, call it as many times as you like.

## Anatomy of a method

```csharp
static int Add(int a, int b)
{
    return a + b;
}
```

Reading left to right:

- `static`: belongs to the class, not to an object. Top level programs need this for now.
- `int`: the **return type**, the kind of value the method gives back.
- `Add`: the name. Methods use PascalCase.
- `(int a, int b)`: the **parameters**, inputs the caller must supply.
- `return a + b;`: hands a value back and ends the method.

The return type, name and parameters together are the method **signature**.

## Calling a method

```csharp
int result = Add(2, 3);
Console.WriteLine(result);      // 5
Console.WriteLine(Add(10, 20)); // 30
```

The values you pass in are called **arguments**. They are copied into the parameters.

## Methods that return nothing

Use `void` when the method does work but has no value to hand back:

```csharp
static void PrintLine(string text)
{
    Console.WriteLine("--- " + text + " ---");
}

PrintLine("Menu");
```

A `void` method can still use `return;` on its own to exit early.

## Expression bodied methods

If the whole body is a single expression, you can write it with an arrow:

```csharp
static int Square(int n) => n * n;
static bool IsEven(int n) => n % 2 == 0;
static void Log(string msg) => Console.WriteLine($"[LOG] {msg}");
```

This is very common in modern C# for short helpers.

## Static and instance methods

A **static** method belongs to the class. An **instance** method belongs to an object and can use that object's data.

```csharp
class Counter
{
    private int count = 0;

    public void Increment()      // instance method, uses count
    {
        count++;
    }

    public int Get() => count;

    public static Counter CreateStartingAt(int start)   // static, no object needed
    {
        var c = new Counter();
        c.count = start;
        return c;
    }
}

var counter = Counter.CreateStartingAt(10);
counter.Increment();
Console.WriteLine(counter.Get());   // 11
```

`Math.Max`, `int.Parse` and `Console.WriteLine` are all static. You call them on the type, never on an instance.

## Local functions

A method can contain its own helper method, visible only inside it:

```csharp
static int SumOfSquares(int[] numbers)
{
    int total = 0;
    foreach (int n in numbers)
    {
        total += Square(n);
    }
    return total;

    int Square(int x) => x * x;   // local function
}
```

Local functions keep small helpers next to the one place that uses them.

## Scope inside methods

Variables declared inside a method exist only while that method runs. Two methods can each have a variable called `total` without clashing:

```csharp
static void First()
{
    int total = 1;
    Console.WriteLine(total);
}

static void Second()
{
    int total = 2;    // a completely different variable
    Console.WriteLine(total);
}
```

## Recursion

A method can call itself. Each call must move towards a stopping condition, or it will run forever and crash with a `StackOverflowException`:

```csharp
static int Factorial(int n)
{
    if (n <= 1) return 1;            // base case
    return n * Factorial(n - 1);     // recursive case
}

Console.WriteLine(Factorial(5));     // 120
```

## Why small methods matter

A method should do one thing, and its name should say what that thing is. Compare:

```csharp
// One big block
Console.WriteLine("Welcome");
double price = 100;
double tax = price * 0.18;
Console.WriteLine($"Total: {price + tax}");
```

with:

```csharp
static double CalculateTax(double price) => price * 0.18;
static void ShowTotal(double price) => Console.WriteLine($"Total: {price + CalculateTax(price)}");

ShowTotal(100);
```

The second version can be tested, reused and read without running it in your head.

## Quick recap

- A method has a return type, a name and a parameter list, and it lives inside a class.
- `return` hands back a value and ends the method, and `void` means no value.
- Expression bodied methods use `=>` for one line bodies.
- Static methods belong to the class, instance methods belong to an object.
- Local functions and recursion are both plain methods with a twist.
- Small, well named methods are easier to read, test and reuse.

<code id="code-content" class="language-csharp">
// Methods and functions in C#
// A method with parameters and a return value
static int Add(int a, int b)
{
    return a + b;
}
// A void method does work but returns nothing
static void PrintLine(string text)
{
    Console.WriteLine($"--- {text} ---");
}
// Expression bodied methods for one liners
static int Square(int n) =&gt; n * n;
static bool IsEven(int n) =&gt; n % 2 == 0;
// A method with a local helper function
static int SumOfSquares(int[] numbers)
{
    int total = 0;
    foreach (int n in numbers)
        total += Sq(n);
    return total;
    int Sq(int x) =&gt; x * x;          // only visible in here
}
// Recursion: a method calling itself with a base case
static int Factorial(int n) =&gt; n &lt;= 1 ? 1 : n * Factorial(n - 1);
// Calling them
PrintLine("Results");
Console.WriteLine(Add(2, 3));                    // 5
Console.WriteLine(Square(7));                    // 49
Console.WriteLine(IsEven(10));                   // True
Console.WriteLine(SumOfSquares(new[] { 1, 2, 3 })); // 14
Console.WriteLine(Factorial(5));                 // 120
// Static methods are called on the type, not an object
Console.WriteLine(Math.Max(3, 9));               // 9
</code></pre>
