---
publishDate: 2026-07-18T14:40
title: Binary Search
slug: binary-search
metadescription: Halve the search space every step to find items in sorted data, and get the boundary conditions right so it terminates and never misses.
updateDate: 2026-09-07T14:40
author: ['bishal-biswas']
level: 1
tags: ['searching', 'binary search', 'algorithms']
course: dsa
---

## Halving the problem

Looking up a word in a dictionary, you do not start at page 1. You open near the middle, see whether your word is before or after, and repeat on that half.

That is binary search, and it needs one thing: **the data must be sorted**.

```csharp
static int BinarySearch(int[] sorted, int target)
{
    int low = 0, high = sorted.Length - 1;

    while (low <= high)
    {
        int mid = low + (high - low) / 2;

        if (sorted[mid] == target) return mid;

        if (sorted[mid] < target) low = mid + 1;    // answer is in the right half
        else high = mid - 1;                        // answer is in the left half
    }

    return -1;
}

int[] numbers = { 1, 3, 5, 7, 9, 11, 13 };
Console.WriteLine(BinarySearch(numbers, 7));    // 3
Console.WriteLine(BinarySearch(numbers, 4));    // -1
```

## The four details that decide correctness

Binary search is famously easy to get subtly wrong. Four things do it.

**`low <= high`, not `low < high`.** With `<`, a single remaining element is never examined, so searching a one item array fails.

**`mid + 1` and `mid - 1`, not `mid`.** `sorted[mid]` has already been checked. Assigning `low = mid` when `mid == low` leaves the range unchanged and the loop never ends.

**`low + (high - low) / 2`, not `(low + high) / 2`.** For very large indexes, `low + high` overflows and goes negative. This bug lived in Java's standard library for nine years.

**The array must actually be sorted.** Binary search on unsorted data does not throw. It returns wrong answers, quietly.

## Why it is so fast

Each step halves what is left.

```text
items         steps
10            4
1,000         10
1,000,000     20
1,000,000,000 30
```

Multiply the data by a thousand and you add ten steps. Compared with linear search, which multiplies by a thousand, this is the difference between a fast query and a timeout.

Watch it work:

```csharp
static int BinarySearchVerbose(int[] sorted, int target)
{
    int low = 0, high = sorted.Length - 1, step = 0;

    while (low <= high)
    {
        int mid = low + (high - low) / 2;
        step++;

        Console.WriteLine($"Step {step}: checking index {mid}, value {sorted[mid]}");

        if (sorted[mid] == target) return mid;
        if (sorted[mid] < target) low = mid + 1;
        else high = mid - 1;
    }

    return -1;
}

var data = Enumerable.Range(1, 1000).ToArray();
BinarySearchVerbose(data, 742);   // finds it in about 10 steps
```

## The recursive version

```csharp
static int BinarySearchRecursive(int[] sorted, int target, int low, int high)
{
    if (low > high) return -1;

    int mid = low + (high - low) / 2;

    if (sorted[mid] == target) return mid;

    return sorted[mid] < target
        ? BinarySearchRecursive(sorted, target, mid + 1, high)
        : BinarySearchRecursive(sorted, target, low, mid - 1);
}
```

Same logic. The loop version is preferable because it uses no stack, and the depth is only `log n` so recursion buys nothing here.

## Finding the boundaries

The plain version returns *some* match. With duplicates you usually want the first or the last one.

**Leftmost occurrence:**

```csharp
static int FirstIndexOf(int[] sorted, int target)
{
    int low = 0, high = sorted.Length - 1, result = -1;

    while (low <= high)
    {
        int mid = low + (high - low) / 2;

        if (sorted[mid] == target)
        {
            result = mid;
            high = mid - 1;        // found one, keep looking left
        }
        else if (sorted[mid] < target) low = mid + 1;
        else high = mid - 1;
    }

    return result;
}
```

**Rightmost occurrence:**

```csharp
static int LastIndexOf(int[] sorted, int target)
{
    int low = 0, high = sorted.Length - 1, result = -1;

    while (low <= high)
    {
        int mid = low + (high - low) / 2;

        if (sorted[mid] == target)
        {
            result = mid;
            low = mid + 1;         // found one, keep looking right
        }
        else if (sorted[mid] < target) low = mid + 1;
        else high = mid - 1;
    }

    return result;
}

int[] withDuplicates = { 1, 2, 2, 2, 3, 4 };
Console.WriteLine(FirstIndexOf(withDuplicates, 2));   // 1
Console.WriteLine(LastIndexOf(withDuplicates, 2));    // 3
Console.WriteLine(LastIndexOf(withDuplicates, 2) - FirstIndexOf(withDuplicates, 2) + 1);
// 3, the count of matches
```

The pattern is: record the match, then keep searching in the direction you want.

## Insertion point

Where would a value go if you inserted it?

```csharp
static int LowerBound(int[] sorted, int target)
{
    int low = 0, high = sorted.Length;      // note: length, not length - 1

    while (low < high)                      // note: <, not <=
    {
        int mid = low + (high - low) / 2;

        if (sorted[mid] < target) low = mid + 1;
        else high = mid;                    // note: mid, not mid - 1
    }

    return low;
}

int[] numbers = { 1, 3, 5, 7, 9 };
Console.WriteLine(LowerBound(numbers, 5));    // 2, the index of 5
Console.WriteLine(LowerBound(numbers, 6));    // 3, where 6 would go
Console.WriteLine(LowerBound(numbers, 0));    // 0
Console.WriteLine(LowerBound(numbers, 100));  // 5, past the end
```

Notice all three boundary rules are different from the standard version. This is a **half open range** search, where `high` is one past the end. Mixing the two styles is the most common source of binary search bugs, so pick one shape per method and keep it consistent.

## The built in version

.NET has it, and the negative return value is genuinely useful.

```csharp
int[] sorted = { 1, 3, 5, 7, 9 };

int found = Array.BinarySearch(sorted, 5);      // 2
int missing = Array.BinarySearch(sorted, 6);    // negative

if (missing < 0)
{
    int insertAt = ~missing;                    // bitwise complement
    Console.WriteLine($"Insert 6 at index {insertAt}");   // 3
}
```

A negative result is the bitwise complement of the insertion point. `~missing` converts it back. This gives you "find it, or tell me where it goes" in one call.

Works on lists too, and with a custom comparer:

```csharp
var list = new List<int> { 1, 3, 5, 7 };
int index = list.BinarySearch(5);

var people = new List<Person>();   // must already be sorted by the same key
int found = people.BinarySearch(new Person("Asha", 0), Comparer<Person>.Create(
    (a, b) => string.CompareOrdinal(a.Name, b.Name)));
```

## Searching a rotated array

A sorted array rotated at some unknown point, like `[4, 5, 6, 7, 0, 1, 2]`. Binary search still works, because at least one half is always properly sorted.

```csharp
static int SearchRotated(int[] a, int target)
{
    int low = 0, high = a.Length - 1;

    while (low <= high)
    {
        int mid = low + (high - low) / 2;

        if (a[mid] == target) return mid;

        if (a[low] <= a[mid])                    // the left half is sorted
        {
            if (a[low] <= target && target < a[mid]) high = mid - 1;
            else low = mid + 1;
        }
        else                                     // the right half is sorted
        {
            if (a[mid] < target && target <= a[high]) low = mid + 1;
            else high = mid - 1;
        }
    }

    return -1;
}

Console.WriteLine(SearchRotated(new[] { 4, 5, 6, 7, 0, 1, 2 }, 0));   // 4
```

Work out which half is sorted, check whether the target lies inside that half's range, and discard accordingly.

## When not to use it

- **Unsorted data.** Sorting first costs `O(n log n)`, so for one search linear is cheaper.
- **A linked list.** No random access, so finding the middle is `O(n)` and the whole benefit disappears.
- **Repeated lookups by key.** A `Dictionary` gives `O(1)`, better than `O(log n)`.
- **Tiny collections.** Under about 20 items a linear scan is usually faster in practice.

Binary search shines when the data is already sorted and you need ordering as well as lookup, such as range queries or "the nearest value below this one".

## Quick recap

- Binary search halves the range each step, giving `O(log n)`.
- The data must be sorted, or it silently returns wrong answers.
- Use `low <= high`, move to `mid + 1` or `mid - 1`, and compute `mid` without overflow.
- To find the first or last duplicate, record the match and keep searching that direction.
- `Array.BinarySearch` returns the bitwise complement of the insertion point when missing.
- The half open variant uses `low < high` and `high = mid`, so do not mix the two styles.
- A rotated sorted array still works, because one half is always sorted.

<code id="code-content" class="language-csharp">
// Halve the range each step. The data MUST be sorted.
static int BinarySearch(int[] sorted, int target)
{
    int low = 0, high = sorted.Length - 1;
    while (low &lt;= high)                       // &lt;= or a single item is never checked
    {
        int mid = low + (high - low) / 2;     // not (low + high) / 2, that overflows
        if (sorted[mid] == target) return mid;
        if (sorted[mid] &lt; target) low = mid + 1;   // mid + 1, mid would loop forever
        else high = mid - 1;
    }
    return -1;
}
int[] numbers = { 1, 3, 5, 7, 9, 11, 13 };
Console.WriteLine(BinarySearch(numbers, 7));      // 3
// With duplicates: record the match, then keep searching in one direction
static int FirstIndexOf(int[] sorted, int target)
{
    int low = 0, high = sorted.Length - 1, result = -1;
    while (low &lt;= high)
    {
        int mid = low + (high - low) / 2;
        if (sorted[mid] == target) { result = mid; high = mid - 1; }   // keep going left
        else if (sorted[mid] &lt; target) low = mid + 1;
        else high = mid - 1;
    }
    return result;
}
int[] dupes = { 1, 2, 2, 2, 3, 4 };
Console.WriteLine(FirstIndexOf(dupes, 2));        // 1
// Insertion point: a HALF OPEN range, note all three rules differ
static int LowerBound(int[] sorted, int target)
{
    int low = 0, high = sorted.Length;             // length, not length - 1
    while (low &lt; high)                             // &lt;, not &lt;=
    {
        int mid = low + (high - low) / 2;
        if (sorted[mid] &lt; target) low = mid + 1;
        else high = mid;                           // mid, not mid - 1
    }
    return low;
}
Console.WriteLine(LowerBound(numbers, 6));        // 3, where 6 would go
// The built in one encodes the insertion point as a negative number
int missing = Array.BinarySearch(numbers, 6);
if (missing &lt; 0) Console.WriteLine($"insert at {~missing}");   // 3
// A rotated sorted array still works: one half is always sorted
static int SearchRotated(int[] a, int target)
{
    int low = 0, high = a.Length - 1;
    while (low &lt;= high)
    {
        int mid = low + (high - low) / 2;
        if (a[mid] == target) return mid;
        if (a[low] &lt;= a[mid])                      // left half is sorted
        {
            if (a[low] &lt;= target &amp;&amp; target &lt; a[mid]) high = mid - 1;
            else low = mid + 1;
        }
        else                                       // right half is sorted
        {
            if (a[mid] &lt; target &amp;&amp; target &lt;= a[high]) low = mid + 1;
            else high = mid - 1;
        }
    }
    return -1;
}
Console.WriteLine(SearchRotated(new[] { 4, 5, 6, 7, 0, 1, 2 }, 0));   // 4
</code></pre>
