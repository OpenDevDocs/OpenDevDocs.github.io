---
publishDate: 2026-04-13T11:22
title: HashSet<T>
slug: hashset-t
metadescription: Keep unique items with HashSet, test membership in constant time, remove duplicates and perform union, intersection and difference operations.
updateDate: 2026-09-05T11:22
author: ['bishal-biswas']
level: 2
tags: ['collections', 'hashset', 'generics']
course: c-sharp
---

## A collection with no duplicates

A `HashSet<T>` stores items with two promises: every item appears **once**, and checking whether an item is present is **fast** no matter how many items there are.

```csharp
var tags = new HashSet<string>();
tags.Add("csharp");
tags.Add("dotnet");
tags.Add("csharp");   // ignored, already present

Console.WriteLine(tags.Count);   // 2
```

`Add` returns `true` if the item was new and `false` if it was already there, which is handy for detecting duplicates.

```csharp
bool added = tags.Add("dotnet");
Console.WriteLine(added);   // False
```

## Membership tests

This is what sets are for:

```csharp
var banned = new HashSet<string> { "spam", "scam", "fake" };

string word = "scam";
if (banned.Contains(word))
{
    Console.WriteLine("Blocked");
}
```

`Contains` on a list scans every item. On a set it hashes the value and jumps straight to it. With a thousand banned words and a million messages, the difference is enormous.

## Removing duplicates

The quickest way to deduplicate a list:

```csharp
var numbers = new List<int> { 1, 2, 2, 3, 3, 3, 4 };
var unique = new HashSet<int>(numbers);

Console.WriteLine(unique.Count);                    // 4
Console.WriteLine(string.Join(" ", unique));        // 1 2 3 4
```

Or in one line with LINQ: `numbers.Distinct().ToList()`.

## No indexes, no order

A set has no `[0]`. You cannot ask for "the third item" because a set does not promise any order. Iterate with `foreach` when you need to see everything:

```csharp
foreach (int n in unique)
{
    Console.Write(n + " ");
}
```

If you need uniqueness **and** sorted order, use `SortedSet<T>`.

## Set operations

Sets shine when you compare groups of things. Each of these modifies the set in place:

```csharp
var a = new HashSet<int> { 1, 2, 3, 4 };
var b = new HashSet<int> { 3, 4, 5, 6 };

a.UnionWith(b);          // everything in either: 1 2 3 4 5 6
```

```csharp
var a = new HashSet<int> { 1, 2, 3, 4 };
var b = new HashSet<int> { 3, 4, 5, 6 };

a.IntersectWith(b);      // only in both: 3 4
```

```csharp
var a = new HashSet<int> { 1, 2, 3, 4 };
var b = new HashSet<int> { 3, 4, 5, 6 };

a.ExceptWith(b);         // in a but not b: 1 2
```

```csharp
var a = new HashSet<int> { 1, 2, 3, 4 };
var b = new HashSet<int> { 3, 4, 5, 6 };

a.SymmetricExceptWith(b);   // in one but not both: 1 2 5 6
```

Because they modify the set, copy first if you need the original afterwards: `new HashSet<int>(a)`.

### Comparison queries

These return a `bool` and leave both sets alone:

```csharp
var required = new HashSet<string> { "read", "write" };
var granted = new HashSet<string> { "read", "write", "delete" };

Console.WriteLine(required.IsSubsetOf(granted));     // True
Console.WriteLine(granted.IsSupersetOf(required));   // True
Console.WriteLine(required.Overlaps(granted));       // True
Console.WriteLine(required.SetEquals(granted));      // False
```

`IsSubsetOf` is a clean way to ask "does this user have every permission we need?".

## A practical example: visited tracking

Sets are the standard tool for remembering what you have already processed:

```csharp
var visited = new HashSet<string>();
var queue = new Queue<string>(new[] { "home", "about", "home", "contact", "about" });

while (queue.Count > 0)
{
    string page = queue.Dequeue();
    if (!visited.Add(page)) continue;   // already seen, skip
    Console.WriteLine($"Crawling {page}");
}
// Crawling home, Crawling about, Crawling contact
```

The `Add` return value does the check and the insert in one step.

## Your own types in a set

Like dictionary keys, set items are located by `GetHashCode` and `Equals`. For a class you must override both, or two objects with the same data will be treated as different. Records do this for you:

```csharp
record Point(int X, int Y);

var points = new HashSet<Point> { new(1, 2), new(1, 2), new(3, 4) };
Console.WriteLine(points.Count);   // 2
```

## Case insensitive sets

```csharp
var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Asha" };
Console.WriteLine(names.Contains("ASHA"));   // True
```

## Quick recap

- A `HashSet<T>` holds each item once and checks membership in constant time.
- `Add` returns `false` for duplicates, which doubles as a "seen before" check.
- Build a set from a list to remove duplicates.
- Sets have no index and no guaranteed order. Use `SortedSet<T>` for order.
- `UnionWith`, `IntersectWith` and `ExceptWith` combine sets, and `IsSubsetOf` compares them.
- Items need proper `Equals` and `GetHashCode`, which records provide automatically.

<code id="code-content" class="language-csharp">
// HashSet&lt;T&gt; in C#
// Unique items only
var tags = new HashSet&lt;string&gt; { "csharp", "dotnet" };
Console.WriteLine(tags.Add("csharp"));        // False, already there
Console.WriteLine(tags.Add("linq"));          // True
Console.WriteLine(tags.Count);                // 3
// Fast membership check
var banned = new HashSet&lt;string&gt; { "spam", "scam" };
Console.WriteLine(banned.Contains("scam"));   // True
// Deduplicate a list
var numbers = new List&lt;int&gt; { 1, 2, 2, 3, 3, 3, 4 };
var unique = new HashSet&lt;int&gt;(numbers);
Console.WriteLine(string.Join(" ", unique));  // 1 2 3 4
// Set operations modify the set in place, so copy first
var a = new HashSet&lt;int&gt; { 1, 2, 3, 4 };
var b = new HashSet&lt;int&gt; { 3, 4, 5, 6 };
var union = new HashSet&lt;int&gt;(a); union.UnionWith(b);
var inter = new HashSet&lt;int&gt;(a); inter.IntersectWith(b);
var diff = new HashSet&lt;int&gt;(a);  diff.ExceptWith(b);
Console.WriteLine(string.Join(" ", union));   // 1 2 3 4 5 6
Console.WriteLine(string.Join(" ", inter));   // 3 4
Console.WriteLine(string.Join(" ", diff));    // 1 2
// Comparison queries
var required = new HashSet&lt;string&gt; { "read", "write" };
var granted = new HashSet&lt;string&gt; { "read", "write", "delete" };
Console.WriteLine(required.IsSubsetOf(granted));   // True
// Track visited items with the Add return value
var visited = new HashSet&lt;string&gt;();
foreach (string page in new[] { "home", "about", "home", "contact" })
{
    if (!visited.Add(page)) continue;         // skip repeats
    Console.WriteLine($"Visiting {page}");
}
// Records give value equality for free
record Point(int X, int Y);
var points = new HashSet&lt;Point&gt; { new(1, 2), new(1, 2) };
Console.WriteLine(points.Count);              // 1
</code></pre>
