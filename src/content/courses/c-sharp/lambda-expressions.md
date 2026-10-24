---
publishDate: 2026-04-16T11:29
title: Lambda Expressions
slug: lambda-expressions
metadescription: Write concise inline functions with lambda syntax, understand captured variables and closures, use statement lambdas, and see how lambdas power LINQ, events and callbacks.
updateDate: 2026-09-05T11:29
author: ['bishal-biswas']
level: 3
tags: ['lambdas', 'functional', 'delegates']
course: c-sharp
---

## A function without a name

A lambda expression is a small anonymous method written inline. Instead of declaring a method, giving it a name and referring to it elsewhere, you write the logic right where it is used:

```csharp
// Named method
static bool IsEven(int n) => n % 2 == 0;
var evens = numbers.Where(IsEven);

// Lambda, same thing
var evens = numbers.Where(n => n % 2 == 0);
```

Read `n => n % 2 == 0` as "n goes to n mod 2 equals 0". The part before the arrow is the parameter list, the part after is the body.

## Syntax variations

```csharp
Func<int, int> square = x => x * x;                 // one parameter, no brackets needed
Func<int, int, int> add = (a, b) => a + b;          // two parameters need brackets
Func<int> random = () => Random.Shared.Next(100);   // no parameters
Action<string> print = s => Console.WriteLine(s);   // returns nothing
```

The compiler works out the parameter types from the delegate type. You can spell them out if it helps or if the compiler cannot infer them:

```csharp
Func<int, int, int> add = (int a, int b) => a + b;
```

## Statement lambdas

When the body needs more than one expression, use braces and an explicit `return`:

```csharp
Func<int, string> describe = n =>
{
    if (n < 0) return "negative";
    if (n == 0) return "zero";
    return "positive";
};

Console.WriteLine(describe(-5));   // negative
```

If a statement lambda grows past a few lines, it probably wants to be a named method.

## Lambdas are delegates

A lambda has no type of its own. It becomes whatever delegate type it is assigned to. That is why `var x = n => n * 2;` did not compile before C# 10, and why it now infers `Func<int, int>`:

```csharp
var twice = (int n) => n * 2;   // Func<int, int>
Console.WriteLine(twice(4));    // 8
```

Most of the time you never assign a lambda to a variable. You pass it straight into a method that expects a delegate.

## Captured variables and closures

A lambda can use variables from the surrounding method. It **captures** them, and keeps them alive for as long as the lambda exists:

```csharp
int threshold = 10;
Func<int, bool> isBig = n => n > threshold;

Console.WriteLine(isBig(15));   // True

threshold = 20;
Console.WriteLine(isBig(15));   // False, the lambda sees the current value
```

The lambda captures the **variable**, not a copy of its value. Change the variable and the lambda sees the change. A lambda plus its captured variables is called a **closure**.

### A counter factory

```csharp
static Func<int> MakeCounter()
{
    int count = 0;
    return () => ++count;
}

var counterA = MakeCounter();
var counterB = MakeCounter();

Console.WriteLine(counterA());   // 1
Console.WriteLine(counterA());   // 2
Console.WriteLine(counterB());   // 1, its own count
```

`count` would normally vanish when `MakeCounter` returns. Because the lambda captured it, it lives on. Each call to `MakeCounter` creates a separate `count`.

### The loop capture trap

```csharp
var actions = new List<Action>();

for (int i = 0; i < 3; i++)
{
    actions.Add(() => Console.Write(i + " "));
}

foreach (var a in actions) a();   // 3 3 3
```

All three lambdas share the single `i` from the `for` loop, and by the time they run it is `3`. Copy it into a fresh variable inside the loop body:

```csharp
for (int i = 0; i < 3; i++)
{
    int copy = i;
    actions.Add(() => Console.Write(copy + " "));   // 0 1 2
}
```

A `foreach` loop does not have this problem because each pass gets its own variable.

## Where lambdas are used

### LINQ

```csharp
var names = people
    .Where(p => p.Age >= 18)
    .OrderBy(p => p.Name)
    .Select(p => p.Name.ToUpper());
```

### List methods

```csharp
numbers.RemoveAll(n => n < 0);
int first = numbers.Find(n => n > 100);
numbers.Sort((a, b) => b.CompareTo(a));   // descending
```

### Events and callbacks

```csharp
button.Clicked += (sender, e) => Console.WriteLine("Clicked");
timer.Elapsed += (s, e) => Refresh();
```

### Deferred work

```csharp
Task.Run(() => DoHeavyWork());
```

## Expression bodied members are not lambdas

The arrow in `public int Area => Width * Height;` looks the same but it is an **expression bodied member**, a shorthand for a method or property body. It is not a delegate and captures nothing. The two just share a symbol.

## Discards

If a lambda must accept a parameter it does not use, name it `_`:

```csharp
button.Clicked += (_, _) => Console.WriteLine("Clicked");
```

## Static lambdas

Mark a lambda `static` to guarantee it captures nothing. The compiler will refuse if you accidentally use an outer variable, which avoids hidden allocations in performance sensitive code:

```csharp
Func<int, int> pure = static n => n * 2;
```

## Quick recap

- A lambda is an inline anonymous method: `parameters => body`.
- Use braces and `return` for bodies with several statements.
- A lambda takes the type of the delegate it is assigned to, usually `Func` or `Action`.
- Lambdas capture surrounding variables by reference, forming closures.
- Copy loop variables before capturing them in a `for` loop.
- LINQ, list methods, events and tasks all run on lambdas.

<code id="code-content" class="language-csharp">
// Lambda expressions in C#
// Expression lambdas of different shapes
Func&lt;int, int&gt; square = x =&gt; x * x;
Func&lt;int, int, int&gt; add = (a, b) =&gt; a + b;
Func&lt;int&gt; roll = () =&gt; Random.Shared.Next(1, 7);
Action&lt;string&gt; shout = s =&gt; Console.WriteLine(s.ToUpper());
Console.WriteLine(square(6));      // 36
Console.WriteLine(add(2, 3));      // 5
shout("hello");                    // HELLO
// Statement lambda with several lines
Func&lt;int, string&gt; describe = n =&gt;
{
    if (n &lt; 0) return "negative";
    if (n == 0) return "zero";
    return "positive";
};
Console.WriteLine(describe(-4));   // negative
// Closures capture the variable, not a copy
int threshold = 10;
Func&lt;int, bool&gt; isBig = n =&gt; n &gt; threshold;
Console.WriteLine(isBig(15));      // True
threshold = 20;
Console.WriteLine(isBig(15));      // False
// A counter factory: each call gets its own captured count
static Func&lt;int&gt; MakeCounter()
{
    int count = 0;
    return () =&gt; ++count;
}
var counter = MakeCounter();
counter(); counter();
Console.WriteLine(counter());      // 3
// The loop capture trap and its fix
var actions = new List&lt;Action&gt;();
for (int i = 0; i &lt; 3; i++)
{
    int copy = i;                  // fresh variable per pass
    actions.Add(() =&gt; Console.Write(copy + " "));
}
foreach (var a in actions) a();    // 0 1 2
Console.WriteLine();
// Lambdas feeding LINQ and list methods
var numbers = new List&lt;int&gt; { 5, -2, 12, 7, -9 };
numbers.RemoveAll(n =&gt; n &lt; 0);
numbers.Sort((a, b) =&gt; b.CompareTo(a));
Console.WriteLine(string.Join(" ", numbers.Select(n =&gt; n * 10)));   // 120 70 50
</code></pre>
