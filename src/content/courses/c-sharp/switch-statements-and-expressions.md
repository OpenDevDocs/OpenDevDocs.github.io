---
publishDate: 2026-04-05T11:08
title: Switch Statements and Expressions
slug: switch-statements-and-expressions
metadescription: Replace long if else chains with switch statements, then learn the modern switch expression with pattern matching, ranges, when guards and tuples.
updateDate: 2026-09-05T11:08
author: ['bishal-biswas']
level: 1
tags: ['control-flow', 'switch', 'pattern-matching']
course: c-sharp
---

## The switch statement

When you compare one value against many possible options, a `switch` is cleaner than a chain of `else if`:

```csharp
int day = 3;

switch (day)
{
    case 1:
        Console.WriteLine("Monday");
        break;
    case 2:
        Console.WriteLine("Tuesday");
        break;
    case 3:
        Console.WriteLine("Wednesday");
        break;
    default:
        Console.WriteLine("Another day");
        break;
}
```

Each `case` is a possible value. `default` runs when nothing matches. Every case must end with `break` (or `return`, or `throw`). Unlike C and JavaScript, C# does not let you accidentally fall through into the next case.

## Grouping cases

Several values can share one block by stacking the labels:

```csharp
string dayName = "Saturday";

switch (dayName)
{
    case "Saturday":
    case "Sunday":
        Console.WriteLine("Weekend");
        break;
    default:
        Console.WriteLine("Weekday");
        break;
}
```

Strings, numbers, chars, enums and bools all work as switch values.

## Switch expressions

Since C# 8 there is a shorter form that **returns a value**. It uses `=>` arrows and no `break`:

```csharp
int day = 3;

string name = day switch
{
    1 => "Monday",
    2 => "Tuesday",
    3 => "Wednesday",
    _ => "Another day"
};

Console.WriteLine(name);   // Wednesday
```

The `_` is the discard pattern and plays the role of `default`. If no arm matches and there is no `_`, the runtime throws an exception, and the compiler warns you that the switch is not exhaustive.

Switch expressions are what most modern C# code uses. Reach for the statement form only when each case needs several statements.

## Pattern matching in switch

Switch arms are not limited to constants. They can test types, ranges and conditions.

### Relational patterns

```csharp
int score = 72;

string grade = score switch
{
    >= 90 => "A",
    >= 75 => "B",
    >= 50 => "C",
    _ => "F"
};
```

Arms are checked top to bottom, so put the highest threshold first.

### Combining with and, or, not

```csharp
int hour = 14;

string period = hour switch
{
    >= 5 and < 12 => "morning",
    >= 12 and < 17 => "afternoon",
    >= 17 and < 21 => "evening",
    _ => "night"
};
```

### Type patterns

```csharp
object value = 3.14;

string kind = value switch
{
    int i => $"an int: {i}",
    double d => $"a double: {d}",
    string s => $"a string of length {s.Length}",
    null => "nothing",
    _ => "something else"
};
```

Each arm both checks the type and gives you a typed variable to use.

### The when guard

Add an extra condition to any arm with `when`:

```csharp
int quantity = 0;

string message = quantity switch
{
    0 => "Out of stock",
    int q when q < 5 => "Only a few left",
    _ => "In stock"
};
```

## Switching on tuples

You can match on more than one value at once by wrapping them in a tuple:

```csharp
string player1 = "rock";
string player2 = "scissors";

string outcome = (player1, player2) switch
{
    ("rock", "scissors") => "Player 1 wins",
    ("scissors", "paper") => "Player 1 wins",
    ("paper", "rock") => "Player 1 wins",
    var (a, b) when a == b => "Draw",
    _ => "Player 2 wins"
};

Console.WriteLine(outcome);   // Player 1 wins
```

This replaces a wall of nested ifs with a table you can read at a glance.

## Enums make switches safer

Switching on an `enum` is common, and the compiler can tell you when you forgot a value:

```csharp
enum Status { Pending, Active, Closed }

Status status = Status.Active;

string label = status switch
{
    Status.Pending => "Waiting",
    Status.Active => "Live",
    Status.Closed => "Done",
    _ => throw new ArgumentOutOfRangeException(nameof(status))
};
```

## Quick recap

- A `switch` statement compares one value against many cases, and each case ends with `break`.
- Cases never fall through in C#, so stack labels to group them.
- A switch **expression** returns a value using `=>` arms and `_` as the default.
- Arms can use relational patterns like `>= 90`, combined with `and`, `or` and `not`.
- Type patterns give you a typed variable, and `when` adds an extra condition.
- Switching on a tuple matches several values at once.

<code id="code-content" class="language-csharp">
// Switch statements and expressions
int day = 3;
// Classic switch statement, every case needs break
switch (day)
{
    case 1:
        Console.WriteLine("Monday");
        break;
    case 6:
    case 7:
        Console.WriteLine("Weekend");
        break;
    default:
        Console.WriteLine("Midweek");   // runs for 3
        break;
}
// Switch expression returns a value
string name = day switch
{
    1 =&gt; "Monday",
    2 =&gt; "Tuesday",
    3 =&gt; "Wednesday",
    _ =&gt; "Other"
};
Console.WriteLine(name);                // Wednesday
// Relational patterns with and / or
int hour = 14;
string period = hour switch
{
    &gt;= 5 and &lt; 12 =&gt; "morning",
    &gt;= 12 and &lt; 17 =&gt; "afternoon",     // matches
    &gt;= 17 and &lt; 21 =&gt; "evening",
    _ =&gt; "night"
};
Console.WriteLine(period);
// Type patterns with a when guard
object value = 42;
string kind = value switch
{
    int n when n &lt; 0 =&gt; "negative int",
    int n =&gt; $"int {n}",                // matches
    string s =&gt; $"string {s}",
    null =&gt; "null",
    _ =&gt; "unknown"
};
Console.WriteLine(kind);
// Tuple patterns compare several values at once
string outcome = ("rock", "scissors") switch
{
    ("rock", "scissors") or ("scissors", "paper") or ("paper", "rock") =&gt; "Player 1 wins",
    var (a, b) when a == b =&gt; "Draw",
    _ =&gt; "Player 2 wins"
};
Console.WriteLine(outcome);             // Player 1 wins
</code></pre>
