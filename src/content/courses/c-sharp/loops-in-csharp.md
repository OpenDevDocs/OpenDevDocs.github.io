---
publishDate: 2026-04-05T11:09
title: Loops in C#
slug: loops-in-csharp
metadescription: Repeat work with for, foreach, while and do while loops, control them with break and continue, and pick the right loop for each job.
updateDate: 2026-09-05T11:09
author: ['bishal-biswas']
level: 1
tags: ['control-flow', 'loops']
course: c-sharp
---

## Why loops

Printing the numbers 1 to 5 by hand is five lines. Printing 1 to 5000 is not something you want to type. A loop runs the same block over and over until a condition says stop.

## The for loop

Use `for` when you know how many times to repeat, or when you need a counter:

```csharp
for (int i = 1; i <= 5; i++)
{
    Console.WriteLine(i);
}
```

The header has three parts separated by semicolons:

1. **Initialiser**: `int i = 1` runs once at the start.
2. **Condition**: `i <= 5` is checked before every pass. When false, the loop ends.
3. **Iterator**: `i++` runs after every pass.

You can count down, or step by more than one:

```csharp
for (int i = 10; i >= 0; i -= 2)
{
    Console.Write(i + " ");   // 10 8 6 4 2 0
}
```

The counter `i` only exists inside the loop.

## Looping over an array with for

```csharp
string[] names = { "Asha", "Ravi", "Meera" };

for (int i = 0; i < names.Length; i++)
{
    Console.WriteLine($"{i}: {names[i]}");
}
```

Arrays start at index 0, so the last index is `Length - 1`. That is why the condition is `<` and not `<=`. Getting this wrong throws an `IndexOutOfRangeException`.

## The foreach loop

When you just want every item and do not care about the index, `foreach` is simpler and safer:

```csharp
string[] names = { "Asha", "Ravi", "Meera" };

foreach (string name in names)
{
    Console.WriteLine(name);
}
```

It works on arrays, lists, dictionaries, strings and anything else that can be enumerated. You cannot modify the collection while iterating it, and you cannot assign to the loop variable. Both are features.

`foreach` is the loop you will write most often in C#.

## The while loop

Use `while` when you do not know in advance how many passes you need. The condition is checked **before** each pass:

```csharp
int balance = 100;
int week = 0;

while (balance > 0)
{
    balance -= 30;
    week++;
}

Console.WriteLine($"Ran out in week {week}");   // week 4
```

If the condition is false at the start, the body never runs at all.

### Reading input until valid

```csharp
int number;

while (!int.TryParse(Console.ReadLine(), out number))
{
    Console.WriteLine("Please enter a whole number:");
}

Console.WriteLine($"Thanks, you entered {number}");
```

## The do while loop

`do while` checks the condition **after** each pass, so the body always runs at least once. It fits menus and prompts:

```csharp
string answer;

do
{
    Console.Write("Continue? (y/n) ");
    answer = Console.ReadLine() ?? "n";
} while (answer == "y");
```

## break and continue

`break` leaves the loop immediately. `continue` skips the rest of the current pass and moves to the next one:

```csharp
for (int i = 1; i <= 10; i++)
{
    if (i % 2 == 0) continue;   // skip even numbers
    if (i > 7) break;           // stop after 7
    Console.Write(i + " ");     // 1 3 5 7
}
```

In a nested loop, `break` only exits the inner loop. If you need to leave both, put the loops in a method and `return`.

## Nested loops

A loop inside a loop is how you handle grids and tables:

```csharp
for (int row = 1; row <= 3; row++)
{
    for (int col = 1; col <= 3; col++)
    {
        Console.Write(row * col + "\t");
    }
    Console.WriteLine();
}
```

Keep nesting shallow. Two levels is normal, three is a sign that some of the work belongs in its own method.

## Infinite loops

A loop whose condition is always true never stops unless something inside breaks out. Sometimes that is intentional, for example a game loop or a server that waits for requests:

```csharp
while (true)
{
    string? command = Console.ReadLine();
    if (command == "quit") break;
    Console.WriteLine($"You typed {command}");
}
```

Accidental infinite loops usually come from forgetting to change the variable the condition depends on.

## Choosing the right loop

- **Known count or need the index**: `for`.
- **Every item in a collection**: `foreach`.
- **Repeat until something happens**: `while`.
- **Must run at least once**: `do while`.

## Quick recap

- `for` has an initialiser, a condition and an iterator, and it is ideal for counting.
- `foreach` visits every item and is the most common loop in C#.
- `while` checks first, `do while` checks after, so `do while` always runs once.
- `break` exits the loop and `continue` skips to the next pass.
- Array indexes run from `0` to `Length - 1`.

<code id="code-content" class="language-csharp">
// Loops in C#
// for: count with an index
for (int i = 1; i &lt;= 3; i++)
{
    Console.Write(i + " ");          // 1 2 3
}
Console.WriteLine();
// foreach: every item, no index needed
string[] names = { "Asha", "Ravi", "Meera" };
foreach (string name in names)
{
    Console.WriteLine(name);
}
// while: repeat until a condition changes
int balance = 100;
int week = 0;
while (balance &gt; 0)
{
    balance -= 30;
    week++;
}
Console.WriteLine($"Ran out in week {week}");   // week 4
// do while: always runs at least once
int attempts = 0;
do
{
    attempts++;
} while (attempts &lt; 1);
Console.WriteLine($"Attempts: {attempts}");    // 1
// break and continue
for (int i = 1; i &lt;= 10; i++)
{
    if (i % 2 == 0) continue;        // skip evens
    if (i &gt; 7) break;                // stop after 7
    Console.Write(i + " ");          // 1 3 5 7
}
Console.WriteLine();
// Nested loops for a small multiplication table
for (int row = 1; row &lt;= 3; row++)
{
    for (int col = 1; col &lt;= 3; col++)
    {
        Console.Write(row * col + "\t");
    }
    Console.WriteLine();
}
</code></pre>
