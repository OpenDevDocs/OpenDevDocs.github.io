---
publishDate: 2026-07-12T12:30
title: Frequency Counting Patterns
slug: frequency-counting-patterns
metadescription: Turn counting into a problem solving tool, with the dictionary and fixed array patterns that solve anagrams, duplicates and majority elements.
updateDate: 2026-09-07T12:30
author: ['bishal-biswas']
level: 2
tags: ['hashing', 'counting', 'patterns']
course: dsa
---

## Counting is a technique

"How many times does each thing appear" sounds like bookkeeping, not an algorithm. But once you have those counts, a whole category of problems becomes trivial, and almost always in `O(n)`.

The signal to look for: **anything asking about duplicates, uniqueness, majority, or matching one collection against another.**

## The basic count

```csharp
static Dictionary<T, int> Count<T>(IEnumerable<T> items) where T : notnull
{
    var counts = new Dictionary<T, int>();

    foreach (T item in items)
    {
        counts[item] = counts.GetValueOrDefault(item) + 1;
    }

    return counts;
}

var counts = Count("mississippi");

foreach (var (c, n) in counts.OrderByDescending(p => p.Value))
{
    Console.WriteLine($"{c}: {n}");
}
// i: 4, s: 4, p: 2, m: 1
```

One pass, `O(n)` time and `O(k)` space where `k` is the number of distinct values.

LINQ writes it shorter, at the cost of a little speed:

```csharp
var counts = "mississippi".GroupBy(c => c).ToDictionary(g => g.Key, g => g.Count());
```

## The fixed array version

When the possible values are a small known range, an array beats a dictionary. No hashing, no allocation per entry, and better cache behaviour.

```csharp
static int[] CountLowercase(string text)
{
    var counts = new int[26];

    foreach (char c in text) counts[c - 'a']++;

    return counts;
}

var counts = CountLowercase("hello");
Console.WriteLine(counts['l' - 'a']);   // 2
```

The `c - 'a'` trick works because characters are numbers. Use it whenever the alphabet is fixed: lowercase letters, digits, DNA bases, small enums.

## Finding the first non repeating character

Two passes. Count everything, then scan in order for the first count of 1.

```csharp
static char? FirstUnique(string text)
{
    var counts = new int[26];

    foreach (char c in text) counts[c - 'a']++;

    foreach (char c in text)
    {
        if (counts[c - 'a'] == 1) return c;
    }

    return null;
}

Console.WriteLine(FirstUnique("swiss"));      // w
Console.WriteLine(FirstUnique("aabb"));       // (null)
```

The second pass walks the original string, not the counts, which is what preserves the order.

## Anagram checking

Count up with one string and down with the other. If any count goes negative, they differ.

```csharp
static bool AreAnagrams(string a, string b)
{
    if (a.Length != b.Length) return false;

    var counts = new int[26];

    foreach (char c in a) counts[c - 'a']++;

    foreach (char c in b)
    {
        if (--counts[c - 'a'] < 0) return false;
    }

    return true;
}

Console.WriteLine(AreAnagrams("listen", "silent"));   // True
```

The length check first is not just an optimisation. Without it, `"aab"` and `"ab"` would pass.

## Finding duplicates

```csharp
// Does any value appear twice?
static bool HasDuplicate<T>(IEnumerable<T> items)
{
    var seen = new HashSet<T>();

    foreach (T item in items)
    {
        if (!seen.Add(item)) return true;
    }

    return false;
}

// Which values appear more than once?
static List<T> Duplicates<T>(IEnumerable<T> items) where T : notnull
{
    var counts = new Dictionary<T, int>();

    foreach (T item in items) counts[item] = counts.GetValueOrDefault(item) + 1;

    return counts.Where(p => p.Value > 1).Select(p => p.Key).ToList();
}

Console.WriteLine(string.Join(", ", Duplicates(new[] { 1, 2, 3, 2, 4, 3 })));   // 2, 3
```

Use a `HashSet` when you only need yes or no, and a `Dictionary` when you need the counts.

## The majority element

Which value appears more than half the time? Counting gives an easy `O(n)` answer with `O(n)` memory.

```csharp
static int? Majority(int[] numbers)
{
    var counts = new Dictionary<int, int>();

    foreach (int n in numbers)
    {
        counts[n] = counts.GetValueOrDefault(n) + 1;
        if (counts[n] > numbers.Length / 2) return n;
    }

    return null;
}
```

There is a beautiful `O(1)` memory version, the Boyer Moore voting algorithm.

```csharp
static int MajorityVoting(int[] numbers)
{
    int candidate = numbers[0];
    int votes = 0;

    foreach (int n in numbers)
    {
        if (votes == 0) candidate = n;

        votes += n == candidate ? 1 : -1;
    }

    return candidate;
}

Console.WriteLine(MajorityVoting(new[] { 2, 2, 1, 1, 1, 2, 2 }));   // 2
```

Think of it as each value cancelling out one different value. If one value has a strict majority, it cannot be fully cancelled.

This only holds if a majority definitely exists. If it might not, verify with a second pass.

## Top K frequent items

```csharp
static List<T> TopK<T>(IEnumerable<T> items, int k) where T : notnull
{
    var counts = new Dictionary<T, int>();

    foreach (T item in items) counts[item] = counts.GetValueOrDefault(item) + 1;

    return counts.OrderByDescending(p => p.Value)
                 .Take(k)
                 .Select(p => p.Key)
                 .ToList();
}

string[] words = { "a", "b", "a", "c", "b", "a" };
Console.WriteLine(string.Join(", ", TopK(words, 2)));   // a, b
```

Sorting makes this `O(n log n)`. Bucket sort by frequency gets it to `O(n)`, since counts are bounded by `n`:

```csharp
static List<T> TopKLinear<T>(IReadOnlyCollection<T> items, int k) where T : notnull
{
    var counts = new Dictionary<T, int>();
    foreach (T item in items) counts[item] = counts.GetValueOrDefault(item) + 1;

    var buckets = new List<T>[items.Count + 1];

    foreach (var (item, count) in counts)
    {
        buckets[count] ??= new List<T>();
        buckets[count].Add(item);
    }

    var result = new List<T>();

    for (int frequency = buckets.Length - 1; frequency > 0 && result.Count < k; frequency--)
    {
        if (buckets[frequency] == null) continue;

        foreach (T item in buckets[frequency])
        {
            result.Add(item);
            if (result.Count == k) break;
        }
    }

    return result;
}
```

Index the buckets by frequency, then read from the top down. No comparisons, no sorting.

## Comparing two collections

```csharp
static bool SameContents<T>(IEnumerable<T> a, IEnumerable<T> b) where T : notnull
{
    var counts = new Dictionary<T, int>();

    foreach (T item in a) counts[item] = counts.GetValueOrDefault(item) + 1;

    foreach (T item in b)
    {
        if (!counts.TryGetValue(item, out int n) || n == 0) return false;
        counts[item] = n - 1;
    }

    return counts.Values.All(n => n == 0);
}

Console.WriteLine(SameContents(new[] { 1, 2, 2, 3 }, new[] { 3, 2, 1, 2 }));   // True
Console.WriteLine(SameContents(new[] { 1, 2 }, new[] { 1, 2, 2 }));           // False
```

The final `All` check catches the case where the first collection has leftovers.

## Sliding window with counts

Combining counting with a window solves "find all anagrams of this pattern in this text" in `O(n)`.

```csharp
static List<int> FindAnagramPositions(string text, string pattern)
{
    var result = new List<int>();
    if (pattern.Length > text.Length) return result;

    var need = new int[26];
    var window = new int[26];

    foreach (char c in pattern) need[c - 'a']++;

    for (int i = 0; i < text.Length; i++)
    {
        window[text[i] - 'a']++;

        if (i >= pattern.Length) window[text[i - pattern.Length] - 'a']--;

        if (i >= pattern.Length - 1 && window.AsSpan().SequenceEqual(need))
        {
            result.Add(i - pattern.Length + 1);
        }
    }

    return result;
}

Console.WriteLine(string.Join(", ", FindAnagramPositions("cbaebabacd", "abc")));   // 0, 6
```

Comparing two 26 slot arrays is a fixed cost, so the whole scan stays `O(n)`.

## Quick recap

- Counting turns duplicate, uniqueness and majority questions into `O(n)` problems.
- Use a `Dictionary` for open ended values, an `int[]` for a fixed small alphabet.
- `GetValueOrDefault` removes the "first time seen" special case.
- Count up with one collection and down with the other to compare them.
- The Boyer Moore voting algorithm finds a majority in `O(1)` memory.
- Bucketing by frequency gives top K in `O(n)` without sorting.
- Counts plus a sliding window find all anagram positions in one pass.

<code id="code-content" class="language-csharp">
// Dictionary counting: GetValueOrDefault removes the "first time" special case
var counts = new Dictionary&lt;char, int&gt;();
foreach (char c in "mississippi") counts[c] = counts.GetValueOrDefault(c) + 1;
foreach (var (c, n) in counts.OrderByDescending(p =&gt; p.Value))
    Console.WriteLine($"{c}: {n}");             // i:4 s:4 p:2 m:1
// Fixed alphabet? An int[26] beats a dictionary: no hashing, no allocation
static int[] CountLowercase(string text)
{
    var result = new int[26];
    foreach (char c in text) result[c - 'a']++;  // 'c' - 'a' == 2
    return result;
}
// First non repeating character: count, then scan the ORIGINAL for order
static char? FirstUnique(string text)
{
    var n = CountLowercase(text);
    foreach (char c in text) if (n[c - 'a'] == 1) return c;
    return null;
}
Console.WriteLine(FirstUnique("swiss"));        // w
// Anagrams: count up with one, down with the other
static bool AreAnagrams(string a, string b)
{
    if (a.Length != b.Length) return false;      // not just an optimisation
    var n = new int[26];
    foreach (char c in a) n[c - 'a']++;
    foreach (char c in b) if (--n[c - 'a'] &lt; 0) return false;
    return true;
}
Console.WriteLine(AreAnagrams("listen", "silent"));   // True
// Boyer Moore voting: majority element in O(1) memory
static int Majority(int[] numbers)
{
    int candidate = numbers[0], votes = 0;
    foreach (int n in numbers)
    {
        if (votes == 0) candidate = n;
        votes += n == candidate ? 1 : -1;        // each value cancels a different one
    }
    return candidate;
}
Console.WriteLine(Majority(new[] { 2, 2, 1, 1, 1, 2, 2 }));   // 2
// Counts plus a sliding window: every anagram position in O(n)
static List&lt;int&gt; FindAnagramPositions(string text, string pattern)
{
    var result = new List&lt;int&gt;();
    if (pattern.Length &gt; text.Length) return result;
    var need = new int[26];
    var window = new int[26];
    foreach (char c in pattern) need[c - 'a']++;
    for (int i = 0; i &lt; text.Length; i++)
    {
        window[text[i] - 'a']++;
        if (i &gt;= pattern.Length) window[text[i - pattern.Length] - 'a']--;
        if (i &gt;= pattern.Length - 1 &amp;&amp; window.AsSpan().SequenceEqual(need))
            result.Add(i - pattern.Length + 1);
    }
    return result;
}
Console.WriteLine(string.Join(",", FindAnagramPositions("cbaebabacd", "abc")));  // 0,6
</code></pre>
