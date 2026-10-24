---
publishDate: 2026-04-03T11:05
title: Operators in C#
slug: operators-in-csharp
metadescription: Arithmetic, comparison, logical, assignment and null handling operators in C#, with the precedence rules and integer division traps every beginner hits.
updateDate: 2026-09-05T11:05
author: ['bishal-biswas']
level: 1
tags: ['basics', 'operators']
course: c-sharp
---

## Arithmetic operators

The usual maths symbols work as you would expect:

```csharp
int a = 10, b = 3;
Console.WriteLine(a + b);   // 13
Console.WriteLine(a - b);   // 7
Console.WriteLine(a * b);   // 30
Console.WriteLine(a / b);   // 3
Console.WriteLine(a % b);   // 1
```

### The integer division trap

`10 / 3` printed `3`, not `3.33`. When **both** operands are integers, the result is an integer and the fraction is dropped. To get a fraction, make at least one side a `double`:

```csharp
Console.WriteLine(10 / 3);        // 3
Console.WriteLine(10.0 / 3);      // 3.3333333333333335
Console.WriteLine((double)a / b); // 3.3333333333333335
```

This catches everyone at least once.

### Modulo

`%` gives the remainder after division. It is the standard way to check for even numbers or to wrap values around:

```csharp
Console.WriteLine(7 % 2);    // 1, so 7 is odd
Console.WriteLine(8 % 2);    // 0, so 8 is even
Console.WriteLine(13 % 12);  // 1, like a clock
```

## Increment and decrement

`++` adds one, `--` subtracts one. Where you place them matters when used inside a bigger expression:

```csharp
int i = 5;
int x = i++;   // x is 5, then i becomes 6
int y = ++i;   // i becomes 7, then y is 7
```

Most of the time you use them on their own line, where the difference does not matter.

## Assignment operators

Compound assignment saves typing:

```csharp
int total = 10;
total += 5;    // total = total + 5   -> 15
total -= 3;    // 12
total *= 2;    // 24
total /= 4;    // 6
total %= 4;    // 2
```

## Comparison operators

These always produce a `bool`:

```csharp
int age = 18;
Console.WriteLine(age == 18);   // True
Console.WriteLine(age != 18);   // False
Console.WriteLine(age > 21);    // False
Console.WriteLine(age >= 18);   // True
Console.WriteLine(age < 65);    // True
```

Note that `==` is comparison and `=` is assignment. Writing `if (age = 18)` does not compile in C#, which is one mistake the language protects you from.

Strings compare by content, not by reference:

```csharp
string s1 = "hello";
string s2 = "hel" + "lo";
Console.WriteLine(s1 == s2);   // True
```

## Logical operators

Combine conditions with `&&` (and), `||` (or) and `!` (not):

```csharp
bool hasTicket = true;
bool isAdult = false;

Console.WriteLine(hasTicket && isAdult);   // False
Console.WriteLine(hasTicket || isAdult);   // True
Console.WriteLine(!isAdult);               // True
```

### Short circuit

`&&` stops as soon as one side is false, and `||` stops as soon as one side is true. The right side is never evaluated. This lets you guard against null safely:

```csharp
string? name = null;
if (name != null && name.Length > 3)
{
    Console.WriteLine("Long name");
}
```

Without short circuiting, `name.Length` would throw. There are also `&` and `|` operators that always evaluate both sides, but you rarely want them.

## The ternary operator

A compact `if` that produces a value:

```csharp
int score = 72;
string result = score >= 50 ? "Pass" : "Fail";
Console.WriteLine(result);   // Pass
```

Read it as "if score is at least 50 then Pass, otherwise Fail".

## Null handling operators

### Null coalescing ??

Gives a fallback when the left side is null:

```csharp
string? input = null;
string name = input ?? "Guest";
Console.WriteLine(name);   // Guest
```

### Null coalescing assignment ??=

Assigns only if the variable is currently null:

```csharp
List<int>? numbers = null;
numbers ??= new List<int>();
numbers.Add(1);
```

### Null conditional ?.

Calls a member only if the object is not null, otherwise the whole expression is null:

```csharp
string? text = null;
int? length = text?.Length;
Console.WriteLine(length == null);   // True
```

These three operators are used constantly in real code.

## Operator precedence

Multiplication and division happen before addition and subtraction, just like at school. Comparisons happen after arithmetic, and `&&` binds tighter than `||`.

```csharp
int r = 2 + 3 * 4;          // 14, not 20
bool ok = 5 > 3 && 2 > 1 || false;   // True
```

When in doubt, add brackets. They cost nothing and make your intent obvious:

```csharp
int r2 = (2 + 3) * 4;       // 20
```

## Quick recap

- `/` between two integers drops the fraction. Cast one side to `double` for a real result.
- `%` gives the remainder and is handy for even, odd and wrap around checks.
- Comparisons return `bool`, and `==` is not the same as `=`.
- `&&` and `||` short circuit, so the right side is safe from null errors.
- `??`, `??=` and `?.` make working with nulls short and safe.
- Use brackets when precedence is not obvious.

<code id="code-content" class="language-csharp">
// Operators in C#
int a = 10, b = 3;
// Arithmetic, watch the integer division
Console.WriteLine(a + b);            // 13
Console.WriteLine(a / b);            // 3, fraction dropped
Console.WriteLine((double)a / b);    // 3.333...
Console.WriteLine(a % b);            // 1, remainder
// Compound assignment
int total = 10;
total += 5;                          // 15
total *= 2;                          // 30
// Comparison produces a bool
bool isAdult = total &gt;= 18;          // True
Console.WriteLine(isAdult);
// Logical operators short circuit
string? name = null;
bool longName = name != null &amp;&amp; name.Length &gt; 3;   // safe, right side skipped
Console.WriteLine(longName);         // False
// Ternary picks one of two values
string status = total &gt; 20 ? "high" : "low";
Console.WriteLine(status);           // high
// Null handling operators
string display = name ?? "Guest";    // fallback when null
Console.WriteLine(display);          // Guest
int? length = name?.Length;          // null instead of a crash
Console.WriteLine(length.HasValue);  // False
List&lt;int&gt;? list = null;
list ??= new List&lt;int&gt;();            // assign only if null
list.Add(1);
Console.WriteLine(list.Count);       // 1
// Precedence: multiply before add, brackets to be clear
Console.WriteLine(2 + 3 * 4);        // 14
Console.WriteLine((2 + 3) * 4);      // 20
</code></pre>
