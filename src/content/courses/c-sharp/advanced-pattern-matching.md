---
publishDate: 2026-04-25T11:44
title: Advanced Pattern Matching
slug: advanced-pattern-matching
metadescription: Go beyond basic switch with property, positional, list, relational and combinator patterns, nested patterns, is expressions and the exhaustiveness checks that make pattern matching safe.
updateDate: 2026-09-05T11:44
author: ['bishal-biswas']
level: 4
tags: ['pattern-matching', 'modern-csharp']
course: c-sharp
---

## Patterns everywhere

You have already used patterns in `switch` expressions and `is` checks. This topic goes through the complete toolkit. Every pattern answers the question "does this value have this shape, and if so, what parts do I want?".

Patterns work in three places:

```csharp
if (obj is Pattern) { }             // is expression
var result = value switch { Pattern => ..., };   // switch expression
switch (value) { case Pattern: ...; }             // switch statement
```

## Type and declaration patterns

```csharp
object o = 42;

if (o is int n && n > 40) Console.WriteLine($"big int {n}");
if (o is string) Console.WriteLine("text");
if (o is not null) Console.WriteLine("has a value");
```

The declaration pattern `int n` both tests the type and binds a variable. Because `&&` short circuits, `n` is safe to use on the right.

## Constant patterns

```csharp
string Classify(object o) => o switch
{
    0 => "zero",
    "" => "empty string",
    null => "null",
    true => "yes",
    _ => "something"
};
```

## Relational patterns

Compare against a constant with `<`, `<=`, `>`, `>=`:

```csharp
string Bmi(double value) => value switch
{
    < 18.5 => "underweight",
    < 25 => "normal",
    < 30 => "overweight",
    _ => "obese"
};
```

## Combinators: and, or, not

Build compound patterns without lambdas:

```csharp
bool IsLetter(char c) => c is (>= 'a' and <= 'z') or (>= 'A' and <= 'Z');

bool IsWeekend(DayOfWeek d) => d is DayOfWeek.Saturday or DayOfWeek.Sunday;

if (status is not (Status.Closed or Status.Cancelled)) { }
```

Brackets group as you would expect. `not` is especially readable for null checks: `if (x is not null)`.

## Property patterns

Match on the properties of an object, nested as deep as you like:

```csharp
record Address(string City, string Country);
record Customer(string Name, int Age, Address Address, bool IsVip);

string Shipping(Customer c) => c switch
{
    { IsVip: true } => "free express",
    { Address.Country: "India", Age: >= 60 } => "free standard",
    { Address: { Country: "India" } } => "flat rate",
    _ => "international"
};
```

`Address.Country` is an extended property pattern, shorthand for the nested form on the line below it. Property patterns can also bind:

```csharp
if (customer is { Address.City: var city, IsVip: true })
{
    Console.WriteLine($"VIP in {city}");
}
```

## Positional patterns

Any type with a `Deconstruct` method, which includes positional records and tuples, can be matched by position:

```csharp
record Point(int X, int Y);

string Quadrant(Point p) => p switch
{
    (0, 0) => "origin",
    (> 0, > 0) => "first",
    (< 0, > 0) => "second",
    (< 0, < 0) => "third",
    (> 0, < 0) => "fourth",
    _ => "on an axis"
};
```

Combine positional and property patterns, and name the whole thing with `var` or a type:

```csharp
if (p is Point(var x, _) { Y: > 100 } far)
{
    Console.WriteLine($"{far} is far up with x = {x}");
}
```

## Tuple patterns

Switch on several values at once by bundling them:

```csharp
string Traffic(string light, bool pedestrian) => (light, pedestrian) switch
{
    ("green", false) => "go",
    ("green", true) => "wait for pedestrian",
    ("yellow", _) => "slow down",
    ("red", _) => "stop",
    _ => throw new ArgumentException("unknown light")
};
```

This replaces nested `if` statements with a table.

## List patterns

Since C# 11, arrays and lists can be matched by their elements:

```csharp
string Describe(int[] values) => values switch
{
    [] => "empty",
    [var only] => $"just {only}",
    [var first, var second] => $"pair {first} and {second}",
    [var first, .., var last] => $"starts {first}, ends {last}",
};

Describe(new[] { 1, 2, 3, 4 });   // starts 1, ends 4
```

`..` is a **slice pattern** matching any number of elements. Capture the slice with `var`:

```csharp
if (args is ["--config", var path, .. var rest])
{
    Console.WriteLine($"config at {path}, {rest.Length} other args");
}
```

Command line parsing becomes a switch expression.

## The when guard

When a pattern cannot express a condition, add a guard:

```csharp
string Ticket(Customer c) => c switch
{
    { Age: < 12 } => "child",
    { Age: >= 65 } => "senior",
    var adult when adult.Name.StartsWith("Dr") => "professional",
    _ => "adult"
};
```

Prefer real patterns over `when`. The compiler can reason about patterns for exhaustiveness. It cannot reason about guards.

## Exhaustiveness

A switch expression must handle every possible input or the compiler warns, and the runtime throws `SwitchExpressionException` for an unhandled case. With a closed set the compiler can verify completeness:

```csharp
bool b = true;
string s = b switch { true => "yes", false => "no" };   // no discard needed
```

For enums and class hierarchies the compiler cannot know the set is closed, so include a discard arm that throws. That turns "forgot a case" into a loud failure rather than a silent wrong answer:

```csharp
_ => throw new ArgumentOutOfRangeException(nameof(shape))
```

The compiler also flags an arm that can never be reached because an earlier arm already covers it. Order arms from specific to general.

## Patterns replacing visitor code

Before patterns, handling a class hierarchy meant virtual methods or a visitor. Now a switch over types with deconstruction is often clearer, especially when the logic belongs outside the classes:

```csharp
abstract record Expr;
record Num(double Value) : Expr;
record Add(Expr Left, Expr Right) : Expr;
record Mul(Expr Left, Expr Right) : Expr;

static double Eval(Expr e) => e switch
{
    Num(var v) => v,
    Add(var l, var r) => Eval(l) + Eval(r),
    Mul(var l, var r) => Eval(l) * Eval(r),
    _ => throw new ArgumentException("unknown expression")
};

Eval(new Add(new Num(2), new Mul(new Num(3), new Num(4))));   // 14
```

An interpreter in ten lines.

## Quick recap

- Patterns test the shape of a value and bind its parts, in `is`, switch expressions and switch statements.
- Relational patterns compare to constants, and `and`, `or`, `not` combine patterns.
- Property patterns match nested object state, positional patterns use `Deconstruct`.
- Tuple patterns switch on several values, list patterns match sequences with `..` slices.
- Use `when` only for conditions a pattern cannot express.
- Include a throwing discard arm so an unhandled case fails loudly.

<code id="code-content" class="language-csharp">
// Advanced pattern matching
record Address(string City, string Country);
record Customer(string Name, int Age, Address Address, bool IsVip);
record Point(int X, int Y);
abstract record Expr;
record Num(double Value) : Expr;
record Add(Expr Left, Expr Right) : Expr;
record Mul(Expr Left, Expr Right) : Expr;
// Property patterns with nesting and relational patterns
static string Shipping(Customer c) =&gt; c switch
{
    { IsVip: true } =&gt; "free express",
    { Address.Country: "India", Age: &gt;= 60 } =&gt; "free standard",
    { Address.Country: "India" } =&gt; "flat rate",
    _ =&gt; "international"
};
var asha = new Customer("Asha", 65, new Address("Kolkata", "India"), false);
var ravi = new Customer("Ravi", 30, new Address("Berlin", "Germany"), false);
Console.WriteLine(Shipping(asha));       // free standard
Console.WriteLine(Shipping(ravi));       // international
// Positional patterns with relational sub patterns
static string Quadrant(Point p) =&gt; p switch
{
    (0, 0) =&gt; "origin",
    (&gt; 0, &gt; 0) =&gt; "first",
    (&lt; 0, &gt; 0) =&gt; "second",
    (&lt; 0, &lt; 0) =&gt; "third",
    (&gt; 0, &lt; 0) =&gt; "fourth",
    _ =&gt; "on an axis"
};
Console.WriteLine(Quadrant(new Point(-3, 4)));   // second
// Combinators
static bool IsLetter(char c) =&gt; c is (&gt;= 'a' and &lt;= 'z') or (&gt;= 'A' and &lt;= 'Z');
Console.WriteLine($"{IsLetter('q')} {IsLetter('7')}");   // True False
// Tuple patterns as a decision table
static string Traffic(string light, bool pedestrian) =&gt; (light, pedestrian) switch
{
    ("green", false) =&gt; "go",
    ("green", true) =&gt; "wait",
    ("yellow", _) =&gt; "slow down",
    _ =&gt; "stop"
};
Console.WriteLine(Traffic("green", true));       // wait
// List patterns with slices for command line parsing
static string Parse(string[] args) =&gt; args switch
{
    [] =&gt; "no arguments",
    ["--help"] =&gt; "show help",
    ["--config", var path, .. var rest] =&gt; $"config {path}, {rest.Length} more",
    [var first, ..] =&gt; $"starts with {first}"
};
Console.WriteLine(Parse(new[] { "--config", "app.json", "-v", "-q" }));   // config app.json, 2 more
// A tiny interpreter using type and positional patterns
static double Eval(Expr e) =&gt; e switch
{
    Num(var v) =&gt; v,
    Add(var l, var r) =&gt; Eval(l) + Eval(r),
    Mul(var l, var r) =&gt; Eval(l) * Eval(r),
    _ =&gt; throw new ArgumentException("unknown expression")
};
Console.WriteLine(Eval(new Add(new Num(2), new Mul(new Num(3), new Num(4)))));   // 14
</code></pre>
