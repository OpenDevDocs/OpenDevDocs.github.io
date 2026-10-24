---
publishDate: 2026-07-18T14:30
title: Linear Search
slug: linear-search
metadescription: The simplest search, when it is genuinely the right choice, and the small changes that make it faster without changing its complexity.
updateDate: 2026-09-07T14:30
author: ['bishal-biswas']
level: 1
tags: ['searching', 'algorithms', 'beginner']
course: dsa
---

## Check every item

Linear search walks the collection from the start until it finds what it is looking for, or runs out.

```csharp
static int IndexOf(int[] a, int target)
{
    for (int i = 0; i < a.Length; i++)
    {
        if (a[i] == target) return i;
    }

    return -1;      // not found
}

int[] numbers = { 4, 8, 15, 16, 23, 42 };
Console.WriteLine(IndexOf(numbers, 15));   // 2
Console.WriteLine(IndexOf(numbers, 99));   // -1
```

Returning `-1` for not found is the .NET convention, matching `Array.IndexOf` and `List.IndexOf`. Returning `null` from an `int?` works too, and is harder to misuse, but breaks convention.

## The complexity

```text
Best case     O(1)      the target is first
Average case  O(n)      about half the array
Worst case    O(n)      the target is last or missing
Space         O(1)
```

The worst case includes every unsuccessful search, which matters. If most lookups fail, you pay full price every time.

## Why it is not always the wrong answer

Linear search has real advantages that people forget when they reach for something clever.

**It needs no preparation.** Binary search requires sorted data, which costs `O(n log n)` up front. A hash set requires building the set, which costs `O(n)`. If you search once, linear search wins outright.

```csharp
// One search: linear is fastest overall
bool found = numbers.Contains(target);          // O(n)

// vs sort then binary search: O(n log n) + O(log n)
Array.Sort(numbers);
bool found = Array.BinarySearch(numbers, target) >= 0;
```

**It works on anything.** Unsorted arrays, linked lists, streams, `IEnumerable` you can only walk once. Binary search needs indexed random access and sorted order.

**It is fast on small collections.** For 10 or 20 items, the branch prediction and cache friendliness of a straight scan beat the arithmetic of a binary search.

**It finds every match, not just one.**

```csharp
static List<int> AllIndexesOf(int[] a, int target)
{
    var result = new List<int>();

    for (int i = 0; i < a.Length; i++)
    {
        if (a[i] == target) result.Add(i);
    }

    return result;
}
```

Binary search finds *a* match, and finding all of them requires extra work to expand outwards.

## Searching by condition

The real strength. Linear search handles any predicate, not just equality.

```csharp
record Person(string Name, int Age, string City);

var people = new[]
{
    new Person("Asha", 30, "Delhi"),
    new Person("Ravi", 25, "Mumbai"),
    new Person("Meera", 35, "Delhi")
};

Person? firstAdult = null;

foreach (var person in people)
{
    if (person.Age >= 30 && person.City == "Delhi")
    {
        firstAdult = person;
        break;
    }
}

Console.WriteLine(firstAdult?.Name);   // Asha
```

The `break` matters. Without it you keep scanning after finding the answer, which turns a lucky `O(1)` into a guaranteed `O(n)`.

LINQ writes the same thing more clearly, and it also stops early:

```csharp
var found = people.FirstOrDefault(p => p.Age >= 30 && p.City == "Delhi");
bool any = people.Any(p => p.City == "Mumbai");
int count = people.Count(p => p.City == "Delhi");
```

`FirstOrDefault` and `Any` stop at the first match. `Count` and `Last` always scan everything.

## Small improvements

None of these change the Big O. Some are still worth knowing.

**Search from both ends.** Halves the average number of iterations.

```csharp
static int IndexOfBidirectional(int[] a, int target)
{
    int left = 0, right = a.Length - 1;

    while (left <= right)
    {
        if (a[left] == target) return left;
        if (a[right] == target) return right;

        left++;
        right--;
    }

    return -1;
}
```

**Move found items forward.** If the same values are searched for repeatedly, moving a hit one place towards the front gradually brings hot items to where they are found quickly. This is called a self organising list, and it is how some caches work.

```csharp
static int IndexOfAndPromote(int[] a, int target)
{
    for (int i = 0; i < a.Length; i++)
    {
        if (a[i] != target) continue;

        if (i > 0)
        {
            (a[i], a[i - 1]) = (a[i - 1], a[i]);
            return i - 1;
        }

        return i;
    }

    return -1;
}
```

**Stop early on sorted data.** If the collection is sorted, you can give up once you pass where the target would be.

```csharp
static int IndexOfSorted(int[] sorted, int target)
{
    for (int i = 0; i < sorted.Length; i++)
    {
        if (sorted[i] == target) return i;
        if (sorted[i] > target) return -1;    // gone past it, it is not here
    }

    return -1;
}
```

Though if the data is sorted, binary search is almost always the better choice.

## When to stop using it

The moment you search the same collection repeatedly, linear search becomes the wrong answer.

```csharp
// Slow: n searches, each O(m)
foreach (var order in orders)
{
    var customer = customers.FirstOrDefault(c => c.Id == order.CustomerId);
}

// Fast: build once, then O(1) per search
var byId = customers.ToDictionary(c => c.Id);

foreach (var order in orders)
{
    byId.TryGetValue(order.CustomerId, out var customer);
}
```

The break even point is roughly: if you will search more than a handful of times, build the lookup.

```text
Searches   Linear          Sort + binary       Hash set
1          O(n)            O(n log n)          O(n)
10         O(10n)          O(n log n + 10)     O(n + 10)
1,000      O(1000n)        O(n log n + 1000)   O(n + 1000)
```

For one search, linear. For many, hash set. Sorting is worth it when you also need range queries or ordered iteration.

## Quick recap

- Linear search checks each item until it finds a match or runs out.
- Return `-1` for not found to match .NET convention.
- It is `O(n)`, and every failed search costs the full `n`.
- It needs no preparation, works on any sequence, and wins for a single search.
- It handles any condition, not just equality, and can find all matches.
- Always `break` or use `FirstOrDefault` so you stop at the first hit.
- The moment you search repeatedly, build a dictionary instead.

<code id="code-content" class="language-csharp">
// Walk until you find it, or run out. Return -1, matching .NET convention.
static int IndexOf(int[] a, int target)
{
    for (int i = 0; i &lt; a.Length; i++)
        if (a[i] == target) return i;
    return -1;
}
int[] numbers = { 4, 8, 15, 16, 23, 42 };
Console.WriteLine(IndexOf(numbers, 15));       // 2
Console.WriteLine(IndexOf(numbers, 99));       // -1
// It needs no preparation, so for ONE search it beats sorting or hashing
bool once = numbers.Contains(15);              // O(n), nothing built first
// It handles any condition, not just equality
record Person(string Name, int Age, string City);
var people = new[] { new Person("Asha", 30, "Delhi"), new Person("Ravi", 25, "Mumbai") };
var found = people.FirstOrDefault(p =&gt; p.Age &gt;= 30 &amp;&amp; p.City == "Delhi");
Console.WriteLine(found?.Name);                // Asha
// FirstOrDefault and Any stop early. Count and Last always scan everything.
Console.WriteLine(people.Any(p =&gt; p.City == "Mumbai"));    // stops at the match
// It can find every match, which binary search cannot do directly
static List&lt;int&gt; AllIndexesOf(int[] a, int target)
{
    var result = new List&lt;int&gt;();
    for (int i = 0; i &lt; a.Length; i++) if (a[i] == target) result.Add(i);
    return result;
}
// On sorted data you can give up once you pass where it would be
static int IndexOfSorted(int[] sorted, int target)
{
    for (int i = 0; i &lt; sorted.Length; i++)
    {
        if (sorted[i] == target) return i;
        if (sorted[i] &gt; target) return -1;     // gone past it
    }
    return -1;
}
// The moment you search repeatedly, stop using it
var customers = new[] { new { Id = 1, Name = "Asha" }, new { Id = 2, Name = "Ravi" } };
var byId = customers.ToDictionary(c =&gt; c.Id);  // build once
foreach (int id in new[] { 2, 1, 2 })
    if (byId.TryGetValue(id, out var c)) Console.WriteLine(c.Name);   // O(1) each
</code></pre>
