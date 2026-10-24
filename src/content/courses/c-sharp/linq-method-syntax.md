---
publishDate: 2026-04-19T11:34
title: LINQ Method Syntax
slug: linq-method-syntax
metadescription: Master the full LINQ method chain, including GroupBy, SelectMany, Join, Distinct, Take and Skip, Zip, Aggregate and set operations, and write your own extension operators.
updateDate: 2026-09-05T11:34
author: ['bishal-biswas']
level: 3
tags: ['linq', 'method-syntax', 'extension-methods']
course: c-sharp
---

## Extension methods

Every LINQ operator is an **extension method** on `IEnumerable<T>`. An extension method is a static method that you call as if it belonged to the type. That is why `numbers.Where(...)` works even though `List<T>` has no `Where` method of its own.

Here is a tiny one of your own, so the mechanism is clear:

```csharp
static class StringExtensions
{
    public static bool IsBlank(this string? s) => string.IsNullOrWhiteSpace(s);
}

Console.WriteLine("   ".IsBlank());   // True
```

The `this` on the first parameter is what makes it an extension. LINQ is a large collection of methods like this in `System.Linq.Enumerable`.

## Partitioning: Take, Skip and friends

```csharp
var numbers = Enumerable.Range(1, 10);   // 1 to 10

numbers.Take(3);                 // 1 2 3
numbers.Skip(7);                 // 8 9 10
numbers.Skip(2).Take(3);         // 3 4 5, this is paging
numbers.TakeWhile(n => n < 4);   // 1 2 3, stops at the first failure
numbers.SkipWhile(n => n < 8);   // 8 9 10
numbers.TakeLast(2);             // 9 10
numbers.Chunk(4);                // [1,2,3,4] [5,6,7,8] [9,10]
```

Paging a list is `Skip((page - 1) * size).Take(size)`.

## Distinct and set operations

```csharp
var a = new[] { 1, 2, 2, 3 };
var b = new[] { 3, 4 };

a.Distinct();        // 1 2 3
a.Union(b);          // 1 2 3 4
a.Intersect(b);      // 3
a.Except(b);         // 1 2
```

`DistinctBy` removes duplicates by a key, which is handy for objects:

```csharp
people.DistinctBy(p => p.Email);
```

## GroupBy

Groups items by a key. Each group has a `Key` and is a sequence of its members:

```csharp
record Sale(string Region, string Product, decimal Amount);

var sales = new List<Sale>
{
    new("North", "Laptop", 1200),
    new("South", "Phone", 800),
    new("North", "Phone", 700),
    new("South", "Laptop", 1100)
};

var byRegion = sales.GroupBy(s => s.Region);

foreach (var group in byRegion)
{
    Console.WriteLine($"{group.Key}: {group.Sum(s => s.Amount)}");
}
// North: 1900
// South: 1900
```

Project each group straight into a summary:

```csharp
var summary = sales
    .GroupBy(s => s.Region)
    .Select(g => new
    {
        Region = g.Key,
        Count = g.Count(),
        Total = g.Sum(s => s.Amount),
        Best = g.MaxBy(s => s.Amount)!.Product
    })
    .OrderByDescending(x => x.Total);
```

`MaxBy` and `MinBy` return the whole item with the largest or smallest key, which saves an `OrderBy().First()`.

## SelectMany: flattening

When each item contains a collection and you want one flat sequence:

```csharp
record Team(string Name, List<string> Members);

var teams = new List<Team>
{
    new("Backend", new() { "Asha", "Ravi" }),
    new("Frontend", new() { "Meera" })
};

var everyone = teams.SelectMany(t => t.Members);              // Asha Ravi Meera

var tagged = teams.SelectMany(t => t.Members, (t, m) => $"{m} ({t.Name})");
// Asha (Backend), Ravi (Backend), Meera (Frontend)
```

## Join

```csharp
record Customer(int Id, string Name);
record Order(int CustomerId, decimal Total);

var customers = new List<Customer> { new(1, "Asha"), new(2, "Ravi") };
var orders = new List<Order> { new(1, 50), new(1, 25), new(2, 80) };

var lines = customers.Join(
    orders,
    c => c.Id,             // key from the outer sequence
    o => o.CustomerId,     // key from the inner sequence
    (c, o) => $"{c.Name} spent {o.Total}");
```

`GroupJoin` gives each customer a collection of their orders instead of one row per order.

## Aggregate: fold everything into one value

`Sum`, `Min` and `Max` are special cases. `Aggregate` lets you write any accumulation:

```csharp
var words = new[] { "C#", "is", "fun" };

string sentence = words.Aggregate((acc, w) => acc + " " + w);   // "C# is fun"

int product = new[] { 1, 2, 3, 4 }.Aggregate(1, (acc, n) => acc * n);   // 24
```

The first form uses the first element as the seed. The second takes an explicit seed.

## Zip: pair two sequences

```csharp
var names = new[] { "Asha", "Ravi" };
var scores = new[] { 90, 75 };

var paired = names.Zip(scores, (n, s) => $"{n}: {s}");   // Asha: 90, Ravi: 75
```

## Ordering by several keys

```csharp
people
    .OrderBy(p => p.LastName)
    .ThenByDescending(p => p.Age)
    .ThenBy(p => p.FirstName);
```

Using `OrderBy` twice would throw away the first ordering. Always use `ThenBy` for secondary keys. `Reverse` flips the whole sequence.

## Sequence generators

```csharp
Enumerable.Range(1, 5);              // 1 2 3 4 5
Enumerable.Repeat("x", 3);           // x x x
Enumerable.Empty<int>();             // an empty sequence of the right type
```

## Conversion and lookup

```csharp
var dict = people.ToDictionary(p => p.Id);                // key to object
var byName = people.ToDictionary(p => p.Id, p => p.Name); // key to value
var lookup = orders.ToLookup(o => o.CustomerId);          // key to many, never throws on duplicates

foreach (var o in lookup[1]) Console.WriteLine(o.Total);
```

`ToLookup` is what you want when one key maps to several items. `ToDictionary` throws on duplicate keys.

## Index in Select

The overload of `Select` with two parameters passes the index:

```csharp
var numbered = names.Select((name, i) => $"{i + 1}. {name}");
```

## Writing your own operator

Because LINQ is just extension methods over `IEnumerable<T>`, you can add operators. `yield return` builds a lazy sequence:

```csharp
static class MyLinq
{
    public static IEnumerable<T> EveryOther<T>(this IEnumerable<T> source)
    {
        bool take = true;
        foreach (T item in source)
        {
            if (take) yield return item;
            take = !take;
        }
    }
}

Enumerable.Range(1, 6).EveryOther();   // 1 3 5
```

Your operator chains with all the built in ones and is just as lazy.

## Quick recap

- LINQ operators are extension methods, and you can write your own with `this` and `yield return`.
- `Take`, `Skip`, `TakeWhile` and `Chunk` slice sequences, and `Skip` plus `Take` is paging.
- `Distinct`, `Union`, `Intersect` and `Except` are set operations.
- `GroupBy` groups by key, `SelectMany` flattens, `Join` matches two sequences.
- `Aggregate` folds a sequence into one value, `Zip` pairs two sequences.
- Use `ThenBy` for secondary sort keys and `ToLookup` for one to many maps.

<code id="code-content" class="language-csharp">
// LINQ method syntax
record Sale(string Region, string Product, decimal Amount);
var sales = new List&lt;Sale&gt;
{
    new("North", "Laptop", 1200), new("South", "Phone", 800),
    new("North", "Phone", 700),   new("South", "Laptop", 1100),
    new("North", "Tablet", 400)
};
// GroupBy with a projected summary, MaxBy picks the whole item
var summary = sales
    .GroupBy(s =&gt; s.Region)
    .Select(g =&gt; new { Region = g.Key, Total = g.Sum(s =&gt; s.Amount), Best = g.MaxBy(s =&gt; s.Amount)!.Product })
    .OrderByDescending(x =&gt; x.Total);
foreach (var s in summary)
    Console.WriteLine($"{s.Region}: {s.Total} (best: {s.Best})");
// Partitioning and paging
var numbers = Enumerable.Range(1, 10);
Console.WriteLine(string.Join(" ", numbers.Skip(2).Take(3)));         // 3 4 5
Console.WriteLine(string.Join(" ", numbers.TakeWhile(n =&gt; n &lt; 4)));   // 1 2 3
Console.WriteLine(numbers.Chunk(4).Count());                          // 3
// Set operations
int[] a = { 1, 2, 2, 3 }, b = { 3, 4 };
Console.WriteLine(string.Join(" ", a.Distinct()));        // 1 2 3
Console.WriteLine(string.Join(" ", a.Union(b)));          // 1 2 3 4
Console.WriteLine(string.Join(" ", a.Except(b)));         // 1 2
// SelectMany flattens, Zip pairs, Aggregate folds
record Team(string Name, List&lt;string&gt; Members);
var teams = new List&lt;Team&gt; { new("Backend", new() { "Asha", "Ravi" }), new("Frontend", new() { "Meera" }) };
Console.WriteLine(string.Join(", ", teams.SelectMany(t =&gt; t.Members)));   // Asha, Ravi, Meera
var scores = new[] { 90, 75, 88 };
Console.WriteLine(string.Join(", ", teams.SelectMany(t =&gt; t.Members).Zip(scores, (m, s) =&gt; $"{m}:{s}")));
Console.WriteLine(new[] { 1, 2, 3, 4 }.Aggregate(1, (acc, n) =&gt; acc * n));   // 24
// ToLookup for one key to many items
var lookup = sales.ToLookup(s =&gt; s.Product);
Console.WriteLine(lookup["Phone"].Count());               // 2
// A custom lazy operator using yield return
static class MyLinq
{
    public static IEnumerable&lt;T&gt; EveryOther&lt;T&gt;(this IEnumerable&lt;T&gt; source)
    {
        bool take = true;
        foreach (T item in source) { if (take) yield return item; take = !take; }
    }
}
Console.WriteLine(string.Join(" ", Enumerable.Range(1, 6).EveryOther()));   // 1 3 5
</code></pre>
