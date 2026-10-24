---
publishDate: 2026-04-04T11:07
title: Conditional Statements
slug: conditional-statements
metadescription: Make decisions in C# with if, else if and else, combine conditions, use the ternary operator and learn the habits that keep branching code readable.
updateDate: 2026-09-05T11:07
author: ['bishal-biswas']
level: 1
tags: ['control-flow', 'conditionals']
course: c-sharp
---

## The if statement

An `if` runs a block of code only when a condition is `true`:

```csharp
int temperature = 32;

if (temperature > 30)
{
    Console.WriteLine("It is hot today");
}
```

The condition must be a `bool`. C# will not accept a number or a string in its place, which is different from JavaScript and Python.

```csharp
int count = 5;
// if (count) { }          // error: cannot convert int to bool
if (count > 0) { }         // correct
```

## if and else

`else` runs when the condition is false:

```csharp
int age = 16;

if (age >= 18)
{
    Console.WriteLine("You can vote");
}
else
{
    Console.WriteLine("Not yet");
}
```

## else if chains

Test several conditions in order. The first one that is true wins, and the rest are skipped:

```csharp
int score = 72;

if (score >= 90)
{
    Console.WriteLine("Grade A");
}
else if (score >= 75)
{
    Console.WriteLine("Grade B");
}
else if (score >= 50)
{
    Console.WriteLine("Grade C");
}
else
{
    Console.WriteLine("Fail");
}
```

Order matters. If you checked `score >= 50` first, a score of 95 would print "Grade C" and never reach the A test.

## Braces are optional but recommended

A single statement can follow `if` without braces:

```csharp
if (age >= 18) Console.WriteLine("Adult");
```

This is fine for a one liner, but adding a second line later is a well known bug source:

```csharp
if (age >= 18)
    Console.WriteLine("Adult");
    Console.WriteLine("Welcome");   // always runs, not part of the if
```

Most teams always use braces. It removes the risk entirely.

## Combining conditions

Use `&&` for "both", `||` for "either" and `!` for "not":

```csharp
bool hasTicket = true;
int age = 15;

if (hasTicket && age >= 18)
{
    Console.WriteLine("Enter");
}
else if (hasTicket && age < 18)
{
    Console.WriteLine("Enter with an adult");
}
else
{
    Console.WriteLine("No ticket");
}
```

When a condition gets long, give it a name. A well named `bool` reads better than a long expression:

```csharp
bool isWeekend = day == "Saturday" || day == "Sunday";
bool isOpen = !isWeekend && hour >= 9 && hour < 17;

if (isOpen)
{
    Console.WriteLine("The shop is open");
}
```

## Nested ifs

An `if` inside another `if` works, but deep nesting gets hard to read:

```csharp
if (user != null)
{
    if (user.IsActive)
    {
        if (user.HasPermission)
        {
            Console.WriteLine("Access granted");
        }
    }
}
```

### Early return

Flip the conditions and exit early. The happy path ends up at the bottom, un-indented:

```csharp
if (user == null) return;
if (!user.IsActive) return;
if (!user.HasPermission) return;

Console.WriteLine("Access granted");
```

This is called a **guard clause** and it is one of the most useful habits you can build.

## The ternary operator

When an `if` only chooses between two values, the ternary form is shorter:

```csharp
int age = 20;
string label = age >= 18 ? "adult" : "minor";
Console.WriteLine(label);   // adult
```

Do not nest ternaries. Two levels deep is already hard to read.

## Comparing strings in conditions

Strings compare by content with `==`. For case insensitive checks, use `Equals` with a comparison option:

```csharp
string answer = "Yes";

if (answer.Equals("yes", StringComparison.OrdinalIgnoreCase))
{
    Console.WriteLine("Confirmed");
}
```

## Checking for null

Use `is null` and `is not null`. They are clearer than `== null` and cannot be overridden by a badly written class:

```csharp
string? name = null;

if (name is null)
{
    Console.WriteLine("No name provided");
}

if (name is not null && name.Length > 0)
{
    Console.WriteLine($"Hello {name}");
}
```

## Quick recap

- `if` needs a real `bool`, not a number or string.
- `else if` chains are checked top to bottom, and order matters.
- Always use braces, even for one line, to avoid a classic bug.
- Name complex conditions with a `bool` variable.
- Guard clauses with early `return` flatten nested ifs.
- The ternary `? :` is for choosing between two values, not for logic.

<code id="code-content" class="language-csharp">
// Conditional statements in C#
int score = 72;
bool hasTicket = true;
int age = 16;
// if, else if, else are checked top to bottom
if (score &gt;= 90)
{
    Console.WriteLine("Grade A");
}
else if (score &gt;= 75)
{
    Console.WriteLine("Grade B");
}
else if (score &gt;= 50)
{
    Console.WriteLine("Grade C");   // this one runs
}
else
{
    Console.WriteLine("Fail");
}
// Combine conditions and name them
bool canEnterAlone = hasTicket &amp;&amp; age &gt;= 18;
bool needsAdult = hasTicket &amp;&amp; age &lt; 18;
if (canEnterAlone)
    Console.WriteLine("Enter");
else if (needsAdult)
    Console.WriteLine("Enter with an adult");   // this one runs
else
    Console.WriteLine("No ticket");
// Ternary for a simple choice
string label = age &gt;= 18 ? "adult" : "minor";
Console.WriteLine(label);                        // minor
// Guard clauses flatten nested ifs
string? name = null;
static void Greet(string? person)
{
    if (person is null) return;                  // exit early
    if (person.Length == 0) return;
    Console.WriteLine($"Hello {person}");
}
Greet(name);                                     // prints nothing
Greet("Asha");                                   // Hello Asha
</code></pre>
