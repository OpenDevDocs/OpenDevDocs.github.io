---
publishDate: 2026-04-02T11:03
title: Variables and Data Types
slug: variables-and-data-types
metadescription: Learn how to declare variables in C#, the built in value types for numbers, text and booleans, and when to use var, const and nullable types.
updateDate: 2026-09-05T11:03
author: ['bishal-biswas']
level: 1
tags: ['basics', 'types']
course: c-sharp
---

## What is a variable?

A variable is a named box that holds a value. In C# every box has a **type**, which decides what kind of value can go inside.

```csharp
int score = 10;
string playerName = "Asha";
bool isAlive = true;
```

Read `int score = 10;` as "create an integer called score and put 10 in it". Once declared, the type of `score` cannot change. Trying to store text in it is a compile error.

## Declaring and assigning

You can declare first and assign later, but you must assign before you read:

```csharp
int count;          // declared, no value yet
count = 5;          // assigned
Console.WriteLine(count);

int total;
// Console.WriteLine(total);   // error: use of unassigned local variable
```

Several variables of the same type can share one line:

```csharp
int x = 1, y = 2, z = 3;
```

## Numeric types

C# has several number types. The ones you will actually use:

| Type | Size | Range | Example |
| --- | --- | --- | --- |
| `int` | 32 bit | about plus or minus 2.1 billion | `int age = 30;` |
| `long` | 64 bit | about plus or minus 9 quintillion | `long stars = 400_000_000_000L;` |
| `double` | 64 bit | 15 to 16 digits of precision | `double price = 9.99;` |
| `decimal` | 128 bit | 28 to 29 digits, exact for money | `decimal balance = 1234.56m;` |
| `float` | 32 bit | 6 to 9 digits | `float speed = 3.5f;` |
| `byte` | 8 bit | 0 to 255 | `byte level = 200;` |

Two rules of thumb:

- Use `int` for whole numbers and `double` for fractions.
- Use `decimal` for money. `double` rounds in ways that lose pennies.

```csharp
double d = 0.1 + 0.2;
decimal m = 0.1m + 0.2m;
Console.WriteLine(d);   // 0.30000000000000004
Console.WriteLine(m);   // 0.3
```

The suffixes matter: `m` for decimal, `f` for float, `L` for long. Without them the compiler assumes `double` for fractions and `int` for whole numbers.

## Underscores in numbers

Large numbers are easier to read with digit separators:

```csharp
int population = 1_400_000_000;
long bytes = 8_589_934_592L;
```

## Text and characters

- `string` holds text of any length. It is written with double quotes.
- `char` holds exactly one character. It is written with single quotes.

```csharp
string greeting = "Hello";
char first = 'H';
Console.WriteLine(greeting.Length);   // 5
Console.WriteLine(first);             // H
```

## Booleans

`bool` is either `true` or `false`. It is the type of every condition.

```csharp
bool isRaining = false;
bool hasUmbrella = true;
bool getsWet = isRaining && !hasUmbrella;
Console.WriteLine(getsWet);   // False
```

Unlike JavaScript, C# will not treat `0` or an empty string as false. Only `bool` works in an `if`.

## Type inference with var

When the right hand side makes the type obvious, `var` lets the compiler figure it out:

```csharp
var name = "Asha";      // string
var age = 25;           // int
var price = 9.99;       // double
var items = new List<string>();
```

`var` is not a dynamic type. `age` is still an `int` forever. It just saves typing. Use it when the type is clear from the assignment, and write the type out when it helps the reader.

## Constants

A `const` is a value that never changes. It must be assigned when declared, and the value must be known at compile time.

```csharp
const double Pi = 3.14159;
const int MaxPlayers = 4;
// Pi = 3;   // error: cannot assign to a const
```

## Nullable types

Value types such as `int` cannot be `null`. Add `?` to allow it:

```csharp
int? middleScore = null;
Console.WriteLine(middleScore.HasValue);   // False
middleScore = 42;
Console.WriteLine(middleScore.Value);      // 42
```

This is useful for "not yet known" data, such as a form field the user left empty.

## Default values

Every type has a default. You will meet these when you create arrays and class fields:

```csharp
Console.WriteLine(default(int));              // 0
Console.WriteLine(default(bool));             // False
Console.WriteLine(default(string) == null);   // True
```

## Naming rules

- Names start with a letter or underscore and can contain digits after that.
- Local variables use `camelCase`: `firstName`, `totalPrice`.
- Constants and public members use `PascalCase`: `MaxPlayers`.
- Names cannot be keywords. `int class = 1;` will not compile.

## Quick recap

- Every variable has a fixed type, and the compiler checks it.
- `int` for whole numbers, `double` for fractions, `decimal` for money, `bool` for true or false.
- `string` is text in double quotes, `char` is one character in single quotes.
- `var` lets the compiler infer the type but the type is still fixed.
- `const` never changes, and `int?` allows null.

<code id="code-content" class="language-csharp">
// Variables and the built in types
// Whole numbers
int age = 25;
long worldPopulation = 8_000_000_000L;   // L suffix for long
// Fractions
double temperature = 36.6;
decimal price = 19.99m;                   // m suffix for decimal, exact for money
float ratio = 0.75f;                      // f suffix for float
// Text and characters
string name = "Asha";
char grade = 'A';
// True or false
bool isStudent = true;
// var lets the compiler infer the type, still fixed after this line
var city = "Kolkata";                     // string
var year = 2026;                          // int
// Constants never change
const int MaxAttempts = 3;
// Nullable value type for "unknown" values
int? bonus = null;
Console.WriteLine($"{name} ({age}) from {city}, grade {grade}");
Console.WriteLine($"Price: {price}, temp: {temperature}, ratio: {ratio}");
Console.WriteLine($"Student: {isStudent}, attempts: {MaxAttempts}, year: {year}");
Console.WriteLine($"Bonus known: {bonus.HasValue}, population: {worldPopulation}");
// Doubles round, decimals do not
Console.WriteLine(0.1 + 0.2);     // 0.30000000000000004
Console.WriteLine(0.1m + 0.2m);   // 0.3
</code></pre>
