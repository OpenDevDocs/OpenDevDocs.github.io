---
publishDate: 2026-04-18T11:32
title: LINQ Fundamentals
slug: linq-fundamentals
metadescription: Learn what LINQ is, how IEnumerable and deferred execution work, the core operators Where, Select and OrderBy, and how to think in queries instead of loops.
updateDate: 2026-09-05T11:32
author: ['bishal-biswas']
level: 3
tags: ['linq', 'collections']
course: c-sharp
---

## What LINQ is

**Language Integrated Query** is a set of methods for querying collections. Instead of writing a loop with an `if` and a temporary list, you describe what you want and LINQ does the looping:

```csharp
var numbers = new List<int> { 5, 12, 8, 21, 3, 16 };

// Without LINQ
var big = new List<int>();
foreach (int n in numbers)
{
    if (n > 10) big.Add(n);
}

// With LINQ
var big = numbers.Where(n => n > 10).ToList();
```

Both give `12 21 16`. The second says **what** you want. The first says **how** to get it.

LINQ works on anything that implements `IEnumerable<T>`: arrays, lists, dictionaries, sets, strings and results of other LINQ calls. It needs `using System.Linq;`, which implicit usings include.

## The three operators you will use daily

### Where: filter

Keeps the items where the condition is true:

```csharp
var evens = numbers.Where(n => n % 2 == 0);        // 12 8 16
var names = people.Where(p => p.Age >= 18);
```

### Select: transform

Turns each item into something else:

```csharp
var doubled = numbers.Select(n => n * 2);           // 10 24 16 42 6 32
var upper = names.Select(s => s.ToUpper());
var ages = people.Select(p => p.Age);
```

The result type follows the lambda. Selecting `p.Age` from people gives an `IEnumerable<int>`.

### OrderBy: sort

```csharp
var ascending = numbers.OrderBy(n => n);            // 3 5 8 12 16 21
var descending = numbers.OrderByDescending(n => n);
var byName = people.OrderBy(p => p.LastName).ThenBy(p => p.FirstName);
```

Unlike `List.Sort`, LINQ ordering does not change the source. It returns a new sequence.

## Chaining

Each operator returns a sequence, so you can feed one into the next. Read the chain top to bottom:

```csharp
var result = people
    .Where(p => p.Age >= 18)
    .OrderBy(p => p.Name)
    .Select(p => p.Name.ToUpper())
    .ToList();
```

Filter first, then sort, then transform. Putting `Where` early means later steps handle fewer items.

## Deferred execution

This is the most important thing to understand about LINQ. Calling `Where` does **not** run the filter. It builds a query. The query runs only when you iterate it:

```csharp
var numbers = new List<int> { 1, 2, 3 };

var query = numbers.Where(n => n > 1);   // nothing happens yet
numbers.Add(10);

foreach (int n in query)                 // runs now, sees the new item
{
    Console.Write(n + " ");              // 2 3 10
}
```

Two consequences:

- The query reflects the source at the time you **iterate**, not when you **wrote** it.
- Iterating twice runs the query twice. If it is expensive, materialise it once.

## Materialising results

To run the query immediately and keep the results, call one of:

```csharp
List<int> list = query.ToList();
int[] array = query.ToArray();
Dictionary<string, int> dict = people.ToDictionary(p => p.Name, p => p.Age);
HashSet<int> set = query.ToHashSet();
```

Rule of thumb: keep queries lazy while you are building them, and call `ToList` when you are done and want a stable result.

## Getting a single item

```csharp
int first = numbers.First();                       // throws if empty
int firstBig = numbers.First(n => n > 10);         // first match, throws if none
int? maybe = numbers.FirstOrDefault(n => n > 100); // 0 for int, null for reference types
int only = numbers.Single(n => n == 21);           // throws unless exactly one match
int last = numbers.Last();
```

Use `FirstOrDefault` when "nothing found" is normal. Use `First` when it would be a bug.

## Aggregates

These run the query immediately and return one value:

```csharp
Console.WriteLine(numbers.Count());              // 6
Console.WriteLine(numbers.Count(n => n > 10));   // 3
Console.WriteLine(numbers.Sum());                // 65
Console.WriteLine(numbers.Average());            // 10.83
Console.WriteLine(numbers.Min());                // 3
Console.WriteLine(numbers.Max());                // 21
Console.WriteLine(people.Sum(p => p.Salary));
```

## Checking conditions

```csharp
bool anyBig = numbers.Any(n => n > 20);      // True
bool allPositive = numbers.All(n => n > 0);  // True
bool hasItems = numbers.Any();               // True, cheaper than Count() > 0
bool has8 = numbers.Contains(8);             // True
```

## Working with objects

LINQ shines on lists of objects:

```csharp
record Employee(string Name, string Department, decimal Salary);

var staff = new List<Employee>
{
    new("Asha", "Engineering", 90_000),
    new("Ravi", "Sales", 60_000),
    new("Meera", "Engineering", 110_000),
    new("Dev", "Sales", 55_000)
};

var topEngineers = staff
    .Where(e => e.Department == "Engineering")
    .OrderByDescending(e => e.Salary)
    .Select(e => e.Name);

Console.WriteLine(string.Join(", ", topEngineers));   // Meera, Asha

decimal salesPayroll = staff.Where(e => e.Department == "Sales").Sum(e => e.Salary);
```

## Loops or LINQ?

LINQ is clearer for filtering, transforming and summarising. A plain loop is better when you need to modify items in place, break early on a complex condition or do several unrelated things per item. Do not force everything into a query.

## Quick recap

- LINQ queries collections declaratively and works on any `IEnumerable<T>`.
- `Where` filters, `Select` transforms, `OrderBy` sorts, and they chain.
- Queries are lazy. They run when iterated, and `ToList` runs them now.
- `First`, `FirstOrDefault` and `Single` pick one item, aggregates like `Sum` and `Count` return one value.
- `Any` and `All` answer yes or no questions about a sequence.
- Use loops when you need side effects or early exit on complex logic.

<code id="code-content" class="language-csharp">
// LINQ fundamentals
record Employee(string Name, string Department, decimal Salary);
var staff = new List&lt;Employee&gt;
{
    new("Asha", "Engineering", 90_000),
    new("Ravi", "Sales", 60_000),
    new("Meera", "Engineering", 110_000),
    new("Dev", "Sales", 55_000)
};
// Where filters, OrderBy sorts, Select transforms
var topEngineers = staff
    .Where(e =&gt; e.Department == "Engineering")
    .OrderByDescending(e =&gt; e.Salary)
    .Select(e =&gt; e.Name)
    .ToList();
Console.WriteLine(string.Join(", ", topEngineers));   // Meera, Asha
// Aggregates run immediately
Console.WriteLine(staff.Count(e =&gt; e.Department == "Sales"));   // 2
Console.WriteLine(staff.Sum(e =&gt; e.Salary));                    // 315000
Console.WriteLine(staff.Average(e =&gt; e.Salary));                // 78750
Console.WriteLine(staff.Max(e =&gt; e.Salary));                    // 110000
// Single items
Console.WriteLine(staff.First(e =&gt; e.Salary &lt; 60_000).Name);    // Dev
Console.WriteLine(staff.FirstOrDefault(e =&gt; e.Name == "Zed") is null);   // True
// Any and All
Console.WriteLine(staff.Any(e =&gt; e.Salary &gt; 100_000));          // True
Console.WriteLine(staff.All(e =&gt; e.Salary &gt; 50_000));           // True
// Deferred execution: the query runs when iterated
var numbers = new List&lt;int&gt; { 1, 2, 3 };
var query = numbers.Where(n =&gt; n &gt; 1);      // nothing runs yet
numbers.Add(10);
Console.WriteLine(string.Join(" ", query)); // 2 3 10, sees the added item
var snapshot = query.ToList();              // materialised now
numbers.Add(20);
Console.WriteLine(snapshot.Count);          // 3, unaffected
</code></pre>
