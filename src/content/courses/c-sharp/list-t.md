---
publishDate: 2026-04-11T11:20
title: List<T>
slug: list-t
metadescription: Use List<T>, the everyday collection of C#, to add, remove, find, sort and iterate items, and understand how it differs from an array.
updateDate: 2026-09-05T11:20
author: ['bishal-biswas']
level: 2
tags: ['collections', 'list', 'generics']
course: c-sharp
---

## Arrays first

An array holds a fixed number of items of one type:

```csharp
int[] scores = new int[3];
scores[0] = 90;
scores[1] = 75;
scores[2] = 88;

string[] names = { "Asha", "Ravi", "Meera" };
Console.WriteLine(names.Length);   // 3
Console.WriteLine(names[1]);       // Ravi
```

Arrays are fast and simple, but the size is fixed at creation. You cannot add a fourth name to `names`. For most day to day work you want something that grows.

## Meet List<T>

`List<T>` is a resizable array. The `T` in angle brackets is the **type parameter**: you say what the list holds, and the compiler enforces it.

```csharp
List<string> names = new List<string>();
names.Add("Asha");
names.Add("Ravi");
names.Add("Meera");

Console.WriteLine(names.Count);   // 3
Console.WriteLine(names[0]);      // Asha
```

`names.Add(42)` will not compile because the list holds strings. This is what **generics** buy you: the flexibility of a container and the safety of a fixed type.

### Shorter creation

```csharp
var names = new List<string> { "Asha", "Ravi", "Meera" };
List<int> numbers = new() { 1, 2, 3 };
List<int> more = [4, 5, 6];   // collection expression, C# 12
```

## Adding and inserting

```csharp
var list = new List<string>();
list.Add("b");                     // b
list.Insert(0, "a");               // a b
list.AddRange(new[] { "c", "d" }); // a b c d
```

## Reading items

Use an index, or `foreach`:

```csharp
Console.WriteLine(list[2]);   // c

foreach (string item in list)
{
    Console.Write(item + " ");
}

// Safe access without an exception
if (list.Count > 5) Console.WriteLine(list[5]);
```

Indexes run from `0` to `Count - 1`. Reading outside that range throws `ArgumentOutOfRangeException`.

## Removing items

```csharp
var list = new List<string> { "a", "b", "c", "b" };

list.Remove("b");          // removes the first "b"      -> a c b
list.RemoveAt(0);          // removes by index           -> c b
list.RemoveAll(x => x == "b");   // removes every match -> c
list.Clear();              // empty
```

Do not remove items inside a `foreach` over the same list. It throws. Use `RemoveAll`, or loop backwards with `for`.

## Searching

```csharp
var nums = new List<int> { 5, 12, 8, 21, 3 };

Console.WriteLine(nums.Contains(8));           // True
Console.WriteLine(nums.IndexOf(21));           // 3
Console.WriteLine(nums.Find(n => n > 10));     // 12, first match
Console.WriteLine(nums.FindAll(n => n > 10).Count);   // 2
Console.WriteLine(nums.Exists(n => n < 0));    // False
```

The `n => n > 10` parts are lambda expressions, small inline functions covered in detail later. For now, read `=>` as "goes to".

## Sorting and reversing

```csharp
var nums = new List<int> { 5, 12, 8, 21, 3 };
nums.Sort();      // 3 5 8 12 21
nums.Reverse();   // 21 12 8 5 3

var names = new List<string> { "Ravi", "asha", "Meera" };
names.Sort(StringComparer.OrdinalIgnoreCase);   // asha Meera Ravi
```

For your own classes, `Sort` needs a comparison. The easiest is a lambda:

```csharp
people.Sort((a, b) => a.Age.CompareTo(b.Age));
```

## Lists of objects

Lists hold any type, including your own classes:

```csharp
class Todo
{
    public string Title { get; set; } = "";
    public bool Done { get; set; }
}

var todos = new List<Todo>
{
    new() { Title = "Learn lists" },
    new() { Title = "Practise", Done = true }
};

foreach (var t in todos)
{
    Console.WriteLine($"[{(t.Done ? "x" : " ")}] {t.Title}");
}
```

Because classes are reference types, changing `todos[0].Done = true` changes the object in the list.

## Converting

```csharp
List<int> list = new() { 1, 2, 3 };
int[] array = list.ToArray();
List<int> back = array.ToList();   // needs System.Linq
```

## How it works inside

A `List<T>` wraps an array. When the array fills up, the list allocates a bigger one (usually double) and copies the items over. That is why `Add` is fast on average but `Insert(0, x)` is slow, since every item must shift. If you know roughly how many items you will add, pass a capacity to avoid the copies:

```csharp
var big = new List<int>(10_000);
```

## Quick recap

- Arrays are fixed size, `List<T>` grows as you add.
- `T` is the item type, and the compiler enforces it.
- `Add`, `Insert`, `Remove`, `RemoveAt` and `Clear` change the list.
- `Contains`, `IndexOf`, `Find` and `FindAll` search it.
- `Sort` orders items, and needs a comparison for custom classes.
- Do not modify a list while iterating it with `foreach`.

<code id="code-content" class="language-csharp">
// List&lt;T&gt; in C#
// Create and add
var names = new List&lt;string&gt; { "Asha", "Ravi" };
names.Add("Meera");
names.Insert(0, "Dev");
names.AddRange(new[] { "Priya", "Arjun" });
Console.WriteLine(names.Count);                   // 6
Console.WriteLine(names[0]);                      // Dev
// Search
Console.WriteLine(names.Contains("Ravi"));        // True
Console.WriteLine(names.IndexOf("Meera"));        // 3
Console.WriteLine(names.Find(n =&gt; n.StartsWith("P")));   // Priya
// Remove
names.Remove("Dev");
names.RemoveAt(names.Count - 1);
names.RemoveAll(n =&gt; n.Length &gt; 4);               // drops Meera and Priya
Console.WriteLine(string.Join(", ", names));      // Asha, Ravi
// Sort numbers and objects
var nums = new List&lt;int&gt; { 5, 12, 8, 21, 3 };
nums.Sort();
Console.WriteLine(string.Join(" ", nums));        // 3 5 8 12 21
record Person(string Name, int Age);
var people = new List&lt;Person&gt;
{
    new("Asha", 30),
    new("Ravi", 25),
    new("Meera", 35)
};
people.Sort((a, b) =&gt; a.Age.CompareTo(b.Age));
foreach (var p in people)
{
    Console.WriteLine($"{p.Name} ({p.Age})");
}
// Convert to and from arrays
int[] array = nums.ToArray();
List&lt;int&gt; back = array.ToList();
Console.WriteLine(back.Count);                    // 5
</code></pre>
