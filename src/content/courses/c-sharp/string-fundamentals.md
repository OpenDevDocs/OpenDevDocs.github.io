---
publishDate: 2026-04-04T11:06
title: String Fundamentals
slug: string-fundamentals
metadescription: Work with text in C#, from interpolation and the most useful string methods to immutability, StringBuilder, verbatim and raw string literals.
updateDate: 2026-09-05T11:06
author: ['bishal-biswas']
level: 1
tags: ['basics', 'strings']
course: c-sharp
---

## Creating strings

A `string` is a sequence of characters wrapped in double quotes:

```csharp
string greeting = "Hello, world";
string empty = "";
string alsoEmpty = string.Empty;
```

Strings are **reference types** but behave like values when compared. Two strings with the same characters are equal.

## Joining strings

You can join with `+`, but **interpolation** is clearer for anything beyond two pieces:

```csharp
string first = "Asha";
string last = "Roy";

string full1 = first + " " + last;
string full2 = $"{first} {last}";
Console.WriteLine(full2);   // Asha Roy
```

Inside the braces you can put any expression, and a colon adds a format:

```csharp
double price = 19.5;
Console.WriteLine($"Total: {price * 2:F2}");   // Total: 39.00
Console.WriteLine($"{DateTime.Now:yyyy-MM-dd}");
```

`string.Join` is the best way to join many items with a separator:

```csharp
string[] fruits = { "apple", "banana", "cherry" };
Console.WriteLine(string.Join(", ", fruits));   // apple, banana, cherry
```

## Escape sequences

Some characters need a backslash:

```csharp
Console.WriteLine("She said \"hi\"");   // She said "hi"
Console.WriteLine("Line one\nLine two");
Console.WriteLine("Tab\tseparated");
Console.WriteLine("C:\\Users\\Asha");
```

### Verbatim strings

Put `@` before the quote and backslashes are taken literally. Handy for file paths and regular expressions:

```csharp
string path = @"C:\Users\Asha\Documents";
```

### Raw string literals

Since C# 11, three quotes start a raw string. Nothing inside is escaped, and it can span lines. Perfect for JSON or HTML:

```csharp
string json = """
    {
        "name": "Asha",
        "age": 25
    }
    """;
```

The closing quotes decide the indentation, so the leading spaces are stripped.

## Strings are immutable

Once created, a string never changes. Every method that seems to modify a string actually returns a **new** one:

```csharp
string name = "asha";
name.ToUpper();
Console.WriteLine(name);   // asha, unchanged

name = name.ToUpper();
Console.WriteLine(name);   // ASHA
```

Forgetting to use the return value is a classic mistake.

## The most useful methods

```csharp
string s = "  Hello, World  ";

Console.WriteLine(s.Length);                 // 16
Console.WriteLine(s.Trim());                 // "Hello, World"
Console.WriteLine(s.ToUpper());              // "  HELLO, WORLD  "
Console.WriteLine(s.ToLower());              // "  hello, world  "
Console.WriteLine(s.Contains("World"));      // True
Console.WriteLine(s.StartsWith("  He"));     // True
Console.WriteLine(s.IndexOf("o"));           // 6
Console.WriteLine(s.Replace("World", "C#")); // "  Hello, C#  "
Console.WriteLine(s.Trim().Substring(0, 5)); // "Hello"
```

### Splitting

```csharp
string csv = "red,green,blue";
string[] colours = csv.Split(',');
Console.WriteLine(colours.Length);   // 3
Console.WriteLine(colours[1]);       // green
```

### Checking for empty

```csharp
string? input = "   ";
Console.WriteLine(string.IsNullOrEmpty(input));       // False
Console.WriteLine(string.IsNullOrWhiteSpace(input));  // True
```

`IsNullOrWhiteSpace` is usually what you want when validating user input.

## Indexing and characters

You can read one character with square brackets. Indexes start at zero.

```csharp
string word = "C#";
Console.WriteLine(word[0]);   // C
Console.WriteLine(word[1]);   // #

foreach (char c in "abc")
{
    Console.Write(c + " ");   // a b c
}
```

You cannot assign to `word[0]` because strings are immutable.

## Comparing strings

`==` compares content and is case sensitive. For case insensitive comparison, use `Equals` with a comparison option:

```csharp
string a = "Hello";
string b = "hello";

Console.WriteLine(a == b);   // False
Console.WriteLine(a.Equals(b, StringComparison.OrdinalIgnoreCase));   // True
```

## StringBuilder for heavy work

Because each `+` creates a new string, building a long string in a loop is wasteful. `StringBuilder` grows a buffer in place:

```csharp
using System.Text;

var sb = new StringBuilder();
for (int i = 1; i <= 5; i++)
{
    sb.Append(i).Append(", ");
}
sb.Length -= 2;   // remove the trailing comma and space
Console.WriteLine(sb.ToString());   // 1, 2, 3, 4, 5
```

For a handful of joins, plain interpolation is fine. Reach for `StringBuilder` when you loop.

## Quick recap

- Use `$"..."` interpolation to build strings and `string.Join` to combine many.
- `@"..."` keeps backslashes literal, `"""..."""` raw strings keep everything literal.
- Strings never change. Methods return a new string, so use the result.
- `Trim`, `Split`, `Contains`, `Replace`, `Substring` and `IsNullOrWhiteSpace` cover most daily work.
- Compare with `==` for exact matches and `Equals` with `OrdinalIgnoreCase` to ignore case.
- Use `StringBuilder` when you build text in a loop.

<code id="code-content" class="language-csharp">
// String fundamentals
using System.Text;
string first = "Asha";
string last = "Roy";
// Interpolation with formatting
string full = $"{first} {last}";
double price = 19.5;
Console.WriteLine($"{full} owes {price * 2:F2}");   // Asha Roy owes 39.00
// Verbatim and raw strings
string path = @"C:\Users\Asha";
string json = """
    { "name": "Asha" }
    """;
Console.WriteLine(path);
Console.WriteLine(json);
// Strings are immutable, so use the returned value
string s = "  hello world  ";
s = s.Trim().ToUpper();
Console.WriteLine(s);                       // HELLO WORLD
// Everyday methods
Console.WriteLine(s.Contains("WORLD"));     // True
Console.WriteLine(s.Replace("WORLD", "C#")); // HELLO C#
Console.WriteLine(s.Substring(0, 5));       // HELLO
Console.WriteLine(s[0]);                    // H
string[] parts = "red,green,blue".Split(',');
Console.WriteLine(string.Join(" | ", parts)); // red | green | blue
// Validation and comparison
Console.WriteLine(string.IsNullOrWhiteSpace("   "));   // True
Console.WriteLine("Hello".Equals("hello", StringComparison.OrdinalIgnoreCase)); // True
// StringBuilder for loops
var sb = new StringBuilder();
for (int i = 1; i &lt;= 5; i++)
{
    sb.Append(i);
    if (i &lt; 5) sb.Append(", ");
}
Console.WriteLine(sb.ToString());           // 1, 2, 3, 4, 5
</code></pre>
