---
publishDate: 2026-04-03T11:04
title: Type Conversion and Casting
slug: type-conversion-and-casting
metadescription: Understand implicit and explicit conversions, casting between numeric types, parsing text into numbers safely with TryParse, and the Convert class.
updateDate: 2026-09-05T11:04
author: ['bishal-biswas']
level: 1
tags: ['basics', 'types', 'conversion']
course: c-sharp
---

## Why conversion is needed

C# will not silently mix types. An `int` and a `string` are different things, and putting one where the other is expected is a compile error. When you genuinely need to move a value from one type to another, you convert it, and C# gives you several ways to do that depending on how safe the move is.

## Implicit conversion

When no information can be lost, C# converts for you. A small type fits inside a bigger one without complaint.

```csharp
int whole = 42;
long bigger = whole;      // int fits in long
double fraction = whole;  // int fits in double
Console.WriteLine(fraction);   // 42
```

The safe directions are: `byte` to `short` to `int` to `long` to `float` to `double`. Also `int` to `decimal`.

## Explicit conversion (casting)

Going the other way can lose data, so C# makes you say it out loud with a **cast**. Put the target type in brackets before the value.

```csharp
double price = 9.99;
int rounded = (int)price;
Console.WriteLine(rounded);   // 9, the fraction is chopped off, not rounded

long big = 3_000_000_000L;
int overflow = (int)big;
Console.WriteLine(overflow);  // -1294967296, the value wrapped around
```

A cast says "I know this might lose something, do it anyway". Notice that casting a `double` to `int` **truncates** towards zero. If you want proper rounding, use `Math.Round`.

```csharp
double value = 9.99;
int r = (int)Math.Round(value);   // 10
```

## Checking for overflow

By default an overflowing cast wraps around silently. Wrap the code in `checked` to get an exception instead:

```csharp
long big = 3_000_000_000L;
try
{
    int safe = checked((int)big);
}
catch (OverflowException)
{
    Console.WriteLine("Too big for an int");
}
```

## Converting text to numbers

Input from the console, a file or a web form always arrives as a `string`. To do maths with it you must parse it.

### Parse

`int.Parse` converts a string to an `int`. It throws an exception if the text is not a valid number.

```csharp
int n = int.Parse("123");
Console.WriteLine(n + 1);   // 124

// int bad = int.Parse("abc");   // FormatException
```

Every numeric type has a `Parse` method: `double.Parse`, `decimal.Parse`, `long.Parse` and so on.

### TryParse

`TryParse` never throws. It returns `true` if it worked and puts the value in an `out` variable.

```csharp
Console.Write("Enter a number: ");
string input = Console.ReadLine() ?? "";

if (int.TryParse(input, out int number))
{
    Console.WriteLine($"You entered {number}");
}
else
{
    Console.WriteLine("That was not a number");
}
```

Use `TryParse` whenever the text comes from a user. Use `Parse` only when you are certain the text is valid.

## Converting numbers to text

Every value has a `ToString()` method:

```csharp
int count = 42;
string text = count.ToString();
Console.WriteLine(text + "!");   // 42!
```

You can pass a format string for control over the output:

```csharp
double amount = 1234.5678;
Console.WriteLine(amount.ToString("F2"));   // 1234.57
Console.WriteLine(amount.ToString("N0"));   // 1,235
Console.WriteLine(0.256.ToString("P1"));    // 25.6%
Console.WriteLine(255.ToString("X"));       // FF
```

The same format strings work inside interpolation: `$"{amount:F2}"`.

## The Convert class

`System.Convert` has methods for every combination and handles `null` and rounding a little differently from casting.

```csharp
string text = "42";
int n = Convert.ToInt32(text);          // 42
double d = Convert.ToDouble("3.14");    // 3.14
int rounded = Convert.ToInt32(9.5);     // 10, banker's rounding to nearest even
bool b = Convert.ToBoolean("true");     // True
```

`Convert.ToInt32(null)` returns `0`, whereas `int.Parse(null)` throws. Pick the behaviour you want.

## Boxing and unboxing

Every type, including `int`, can be treated as `object`. Storing a value type in an `object` is called **boxing**, and getting it back is **unboxing** with a cast.

```csharp
int number = 7;
object boxed = number;      // boxing
int back = (int)boxed;      // unboxing
```

Boxing allocates memory, so avoid it in hot loops. You will rarely write it by hand, but it happens behind the scenes with old style collections and some string formatting.

## Quick recap

- Implicit conversion happens when nothing can be lost, for example `int` to `double`.
- A cast such as `(int)value` forces a conversion that might lose data, and it truncates fractions.
- `int.Parse` turns text into a number and throws on bad input, `int.TryParse` returns false instead.
- `ToString("F2")` and friends format numbers as text.
- `Convert` offers a full set of conversions with slightly different null and rounding rules.

<code id="code-content" class="language-csharp">
// Type conversion and casting
// Implicit: small to large, nothing lost
int whole = 42;
double asDouble = whole;                 // 42
long asLong = whole;
// Explicit cast: may lose data, fraction is truncated
double price = 9.99;
int truncated = (int)price;              // 9
int rounded = (int)Math.Round(price);    // 10
// Overflow wraps silently unless you use checked
long big = 3_000_000_000L;
int wrapped = (int)big;                  // negative garbage
try
{
    int safe = checked((int)big);
}
catch (OverflowException)
{
    Console.WriteLine("Overflow caught");
}
// Text to number: Parse throws, TryParse returns false
int parsed = int.Parse("123");
if (int.TryParse("abc", out int result))
    Console.WriteLine(result);
else
    Console.WriteLine("Not a number");   // this branch runs
// Number to text with formats
double amount = 1234.5678;
Console.WriteLine(amount.ToString("F2"));   // 1234.57
Console.WriteLine($"{amount:N0}");          // 1,235
Console.WriteLine($"{0.256:P1}");           // 25.6%
// Convert class handles null and rounds to nearest even
Console.WriteLine(Convert.ToInt32("42"));   // 42
Console.WriteLine(Convert.ToInt32(9.5));    // 10
Console.WriteLine(Convert.ToInt32(8.5));    // 8
Console.WriteLine($"{asDouble} {asLong} {truncated} {rounded} {wrapped} {parsed}");
</code></pre>
