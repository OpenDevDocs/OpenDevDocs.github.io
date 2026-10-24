---
publishDate: 2026-07-12T12:10
title: Dictionary and HashSet in Practice
slug: dictionary-and-hashset-in-practice
metadescription: Use Dictionary and HashSet properly in C#, with the access patterns, comparers and grouping tricks that remove most slow code.
updateDate: 2026-09-07T12:10
author: ['bishal-biswas']
level: 1
tags: ['dictionary', 'hashset', 'collections']
course: dsa
---

## The two you will use most

`Dictionary<TKey, TValue>` maps keys to values. `HashSet<T>` remembers whether it has seen something. Both give `O(1)` lookups, and between them they fix most slow code.

## Getting values out

There are four ways, and picking the right one matters.

```csharp
var ages = new Dictionary<string, int>
{
    ["Asha"] = 30,
    ["Ravi"] = 25
};

// 1. The indexer. Throws KeyNotFoundException if missing.
int age = ages["Asha"];

// 2. TryGetValue. One lookup, no exception. The default choice.
if (ages.TryGetValue("Meera", out int found)) Console.WriteLine(found);
else Console.WriteLine("Not found");

// 3. GetValueOrDefault. Cleanest when a default is acceptable.
int safe = ages.GetValueOrDefault("Meera");        // 0
int custom = ages.GetValueOrDefault("Meera", -1);  // -1

// 4. ContainsKey then the indexer. Two lookups, avoid it.
if (ages.ContainsKey("Asha")) Console.WriteLine(ages["Asha"]);
```

Option four is the common habit worth breaking. It hashes the key twice for no benefit. `TryGetValue` does the same work in one pass.

## Adding

```csharp
var ages = new Dictionary<string, int>();

ages["Asha"] = 30;        // adds, or overwrites silently
ages.Add("Ravi", 25);     // adds, throws if the key already exists
ages.TryAdd("Ravi", 99);  // adds only if missing, returns false otherwise

Console.WriteLine(ages["Ravi"]);   // 25, TryAdd did not overwrite
```

Use `Add` when a duplicate key means a bug and you want to hear about it. Use the indexer when overwriting is intended. Use `TryAdd` for "first one wins".

## Counting things

The most common dictionary pattern there is.

```csharp
string[] words = { "apple", "banana", "apple", "cherry", "banana", "apple" };

var counts = new Dictionary<string, int>();

foreach (string word in words)
{
    counts[word] = counts.GetValueOrDefault(word) + 1;
}

foreach (var (word, count) in counts) Console.WriteLine($"{word}: {count}");
// apple: 3, banana: 2, cherry: 1
```

`GetValueOrDefault` returns 0 for a missing key, so the first occurrence becomes 1 with no special case.

A slightly faster variant using `CollectionsMarshal` exists, but this version is clear and fast enough for almost everything.

## Grouping

A dictionary of lists. The pattern is worth memorising because the naive version does three lookups.

```csharp
string[] names = { "Asha", "Ravi", "Anil", "Meera", "Rahul" };

var byLetter = new Dictionary<char, List<string>>();

foreach (string name in names)
{
    char first = name[0];

    if (!byLetter.TryGetValue(first, out var group))
    {
        group = new List<string>();
        byLetter[first] = group;
    }

    group.Add(name);
}

foreach (var (letter, group) in byLetter)
{
    Console.WriteLine($"{letter}: {string.Join(", ", group)}");
}
```

One lookup to check, one to insert when missing, then work on the list directly.

LINQ does it in one line when you do not need the dictionary afterwards:

```csharp
foreach (var group in names.GroupBy(n => n[0]))
{
    Console.WriteLine($"{group.Key}: {string.Join(", ", group)}");
}
```

## HashSet

`HashSet<T>` answers one question fast: have I seen this?

```csharp
var seen = new HashSet<string>();

Console.WriteLine(seen.Add("Asha"));   // True, it was new
Console.WriteLine(seen.Add("Asha"));   // False, already there
Console.WriteLine(seen.Contains("Asha"));   // True
Console.WriteLine(seen.Count);              // 1
```

`Add` returning a bool is the detail worth knowing. It checks and inserts in one operation, which makes duplicate detection a one liner:

```csharp
static bool HasDuplicates(int[] numbers)
{
    var seen = new HashSet<int>();

    foreach (int n in numbers)
    {
        if (!seen.Add(n)) return true;
    }

    return false;
}
```

## Set operations

```csharp
var a = new HashSet<int> { 1, 2, 3, 4 };
var b = new HashSet<int> { 3, 4, 5, 6 };

var union = new HashSet<int>(a);
union.UnionWith(b);                    // 1 2 3 4 5 6

var intersection = new HashSet<int>(a);
intersection.IntersectWith(b);         // 3 4

var difference = new HashSet<int>(a);
difference.ExceptWith(b);              // 1 2

Console.WriteLine(a.IsSubsetOf(union));       // True
Console.WriteLine(a.Overlaps(b));             // True
```

These modify the set they are called on, which is why each example copies first. All of them are `O(n + m)`, far better than nested loops.

## Custom comparers

By default keys compare with `Equals` and `GetHashCode`. A comparer overrides that without touching the type.

Case insensitive string keys:

```csharp
var settings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
{
    ["Theme"] = "dark"
};

Console.WriteLine(settings["theme"]);   // dark
Console.WriteLine(settings["THEME"]);   // dark
```

This is worth reaching for whenever the keys come from configuration, headers or user input.

A custom comparer for your own idea of equality:

```csharp
public class LengthComparer : IEqualityComparer<string>
{
    public bool Equals(string? x, string? y) => x?.Length == y?.Length;
    public int GetHashCode(string s) => s.Length.GetHashCode();
}

var byLength = new HashSet<string>(new LengthComparer()) { "cat", "dog", "horse" };
Console.WriteLine(byLength.Count);   // 2, "dog" matched "cat"
```

The rule from the previous topic still applies. If `Equals` says two things are equal, `GetHashCode` must agree.

## Ordering

Neither collection promises any order.

```csharp
var ages = new Dictionary<string, int> { ["Zoe"] = 1, ["Amy"] = 2, ["Bob"] = 3 };

foreach (var key in ages.Keys) Console.WriteLine(key);   // no guaranteed order
```

In practice insertion order often appears, and then breaks the moment something is removed. Never rely on it.

When you need order, sort at the point of use, or pick a different collection:

```csharp
foreach (var pair in ages.OrderBy(p => p.Key)) Console.WriteLine(pair.Key);

var sorted = new SortedDictionary<string, int>(ages);   // always in key order
```

## The refactor to remember

This is the single most valuable habit from this whole topic.

```csharp
// Slow: a search inside a loop, O(n * m)
foreach (var order in orders)
{
    var customer = customers.First(c => c.Id == order.CustomerId);
    Console.WriteLine(customer.Name);
}

// Fast: build a lookup once, O(n + m)
var byId = customers.ToDictionary(c => c.Id);

foreach (var order in orders)
{
    if (byId.TryGetValue(order.CustomerId, out var customer))
    {
        Console.WriteLine(customer.Name);
    }
}
```

With 10,000 orders and 10,000 customers, the first version does up to 100 million comparisons. The second does 20,000 operations.

`ToDictionary` throws on duplicate keys. Use `ToLookup` when keys can repeat:

```csharp
var ordersByCustomer = orders.ToLookup(o => o.CustomerId);

foreach (var order in ordersByCustomer[42]) Console.WriteLine(order);
```

`ToLookup` returns an empty sequence for a missing key rather than throwing, which makes it pleasant to use.

## Quick recap

- Prefer `TryGetValue` over `ContainsKey` followed by the indexer.
- `GetValueOrDefault` makes counting a one liner.
- `Add` on a `HashSet` returns whether the item was new.
- Group with one `TryGetValue`, then add to the list you got back.
- Set operations modify the set they are called on, so copy first.
- Pass `StringComparer.OrdinalIgnoreCase` for case insensitive keys.
- Never rely on enumeration order from a dictionary or set.
- Replacing a search inside a loop with a prebuilt dictionary is the highest value refactor there is.

<code id="code-content" class="language-csharp">
var ages = new Dictionary&lt;string, int&gt; { ["Asha"] = 30, ["Ravi"] = 25 };
// One lookup, no exception. This is the default choice.
if (ages.TryGetValue("Meera", out int found)) Console.WriteLine(found);
else Console.WriteLine("not found");
Console.WriteLine(ages.GetValueOrDefault("Meera", -1));   // -1
// Avoid ContainsKey followed by the indexer, it hashes the key twice
// Counting: GetValueOrDefault returns 0, so the first one becomes 1
string[] words = { "apple", "banana", "apple", "cherry", "banana", "apple" };
var counts = new Dictionary&lt;string, int&gt;();
foreach (string w in words) counts[w] = counts.GetValueOrDefault(w) + 1;
foreach (var (word, count) in counts) Console.WriteLine($"{word}: {count}");
// Grouping: one lookup to check, one to insert, then use the list
var byLetter = new Dictionary&lt;char, List&lt;string&gt;&gt;();
foreach (string name in new[] { "Asha", "Ravi", "Anil" })
{
    if (!byLetter.TryGetValue(name[0], out var group)) byLetter[name[0]] = group = new();
    group.Add(name);
}
// HashSet.Add returns whether the item was new: duplicate detection in one line
static bool HasDuplicates(int[] numbers)
{
    var seen = new HashSet&lt;int&gt;();
    foreach (int n in numbers) if (!seen.Add(n)) return true;
    return false;
}
Console.WriteLine(HasDuplicates(new[] { 1, 2, 3, 2 }));   // True
// Set operations modify the set they are called on, so copy first
var a = new HashSet&lt;int&gt; { 1, 2, 3, 4 };
var b = new HashSet&lt;int&gt; { 3, 4, 5 };
var intersection = new HashSet&lt;int&gt;(a);
intersection.IntersectWith(b);
Console.WriteLine(string.Join(",", intersection));        // 3,4
// Case insensitive keys without touching the type
var settings = new Dictionary&lt;string, string&gt;(StringComparer.OrdinalIgnoreCase)
{
    ["Theme"] = "dark"
};
Console.WriteLine(settings["THEME"]);                     // dark
// The highest value refactor there is: build the lookup once
var customers = new[] { new { Id = 1, Name = "Asha" }, new { Id = 2, Name = "Ravi" } };
var byId = customers.ToDictionary(c =&gt; c.Id);
foreach (int id in new[] { 2, 1 })
    if (byId.TryGetValue(id, out var c)) Console.WriteLine(c.Name);
</code></pre>
