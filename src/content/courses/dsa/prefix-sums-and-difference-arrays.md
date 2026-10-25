---
publishDate: 2026-07-06T10:00
title: Prefix Sums and Difference Arrays
slug: prefix-sums-and-difference-arrays
metadescription: Precompute running totals so any range sum becomes one subtraction, and use difference arrays to apply many range updates in one pass.
updateDate: 2026-09-07T10:00
author: ['bishal-biswas']
level: 2
tags: ['arrays', 'prefix sums', 'preprocessing']
course: dsa
---

## Answering the same question many times

Given an array, what is the sum from index 2 to index 7? And from 0 to 4? And from 3 to 9?

The direct way loops over the range every time:

```csharp
static int RangeSum(int[] numbers, int from, int to)
{
    int sum = 0;
    for (int i = from; i <= to; i++) sum += numbers[i];
    return sum;
}
```

That is `O(n)` per question. Ask a thousand questions about a large array and you feel it.

A **prefix sum** array does the work once and answers every question in `O(1)`.

## Building the prefix array

Each slot holds the total of everything before it.

```csharp
static int[] BuildPrefix(int[] numbers)
{
    var prefix = new int[numbers.Length + 1];   // one longer, starting with 0

    for (int i = 0; i < numbers.Length; i++)
    {
        prefix[i + 1] = prefix[i] + numbers[i];
    }

    return prefix;
}

int[] numbers = { 3, 1, 4, 1, 5, 9, 2, 6 };
int[] prefix = BuildPrefix(numbers);

Console.WriteLine(string.Join(", ", prefix));
// 0, 3, 4, 8, 9, 14, 23, 25, 31
```

The extra leading zero is worth the small oddity. It removes every special case for ranges that start at index 0.

## Answering in one subtraction

```csharp
static int RangeSum(int[] prefix, int from, int to)
{
    return prefix[to + 1] - prefix[from];
}

Console.WriteLine(RangeSum(prefix, 2, 5));   // 4 + 1 + 5 + 9 = 19
Console.WriteLine(RangeSum(prefix, 0, 3));   // 3 + 1 + 4 + 1 = 9
Console.WriteLine(RangeSum(prefix, 4, 4));   // 5
```

`prefix[to + 1]` is everything up to and including `to`. `prefix[from]` is everything before `from`. Subtract and the overlap cancels.

Cost: `O(n)` once to build, `O(1)` per query. For `q` queries that is `O(n + q)` instead of `O(n * q)`.

## Watch the overflow

Prefix sums add everything up, so they overflow much sooner than the original values.

```csharp
static long[] BuildPrefixSafe(int[] numbers)
{
    var prefix = new long[numbers.Length + 1];
    for (int i = 0; i < numbers.Length; i++) prefix[i + 1] = prefix[i] + numbers[i];
    return prefix;
}
```

Use `long` unless you are certain of the range.

## Subarrays summing to a target

Prefix sums plus a dictionary solves a problem sliding windows cannot, because it works with negative numbers.

```csharp
static int CountSubarraysWithSum(int[] numbers, int target)
{
    var counts = new Dictionary<int, int> { [0] = 1 };   // one empty prefix
    int running = 0, total = 0;

    foreach (int n in numbers)
    {
        running += n;

        if (counts.TryGetValue(running - target, out int seen)) total += seen;

        counts[running] = counts.GetValueOrDefault(running) + 1;
    }

    return total;
}

Console.WriteLine(CountSubarraysWithSum(new[] { 1, 1, 1 }, 2));        // 2
Console.WriteLine(CountSubarraysWithSum(new[] { 3, 4, -7, 1, 3 }, 0)); // 3
```

The idea: if the running total is `R` now and was `R - target` at some earlier point, the values in between sum to `target`. The dictionary remembers how many times each running total has been seen.

The `[0] = 1` seed handles subarrays that start at index 0. Forgetting it is the classic bug here.

## Two dimensional prefix sums

The same idea on a grid. Each cell holds the sum of the rectangle from the top left corner to it.

```csharp
static int[,] BuildPrefix2D(int[,] grid)
{
    int rows = grid.GetLength(0), cols = grid.GetLength(1);
    var prefix = new int[rows + 1, cols + 1];

    for (int r = 0; r < rows; r++)
    {
        for (int c = 0; c < cols; c++)
        {
            prefix[r + 1, c + 1] = grid[r, c]
                                 + prefix[r, c + 1]
                                 + prefix[r + 1, c]
                                 - prefix[r, c];      // added twice, remove once
        }
    }

    return prefix;
}

static int RectangleSum(int[,] prefix, int r1, int c1, int r2, int c2)
{
    return prefix[r2 + 1, c2 + 1]
         - prefix[r1, c2 + 1]
         - prefix[r2 + 1, c1]
         + prefix[r1, c1];      // removed twice, add back once
}
```

Both formulas use inclusion and exclusion. The overlapping corner is counted twice, so it has to be corrected once.

```csharp
int[,] grid =
{
    { 1, 2, 3 },
    { 4, 5, 6 },
    { 7, 8, 9 }
};

var p = BuildPrefix2D(grid);
Console.WriteLine(RectangleSum(p, 1, 1, 2, 2));   // 5 + 6 + 8 + 9 = 28
```

## Difference arrays, the reverse idea

Prefix sums make range **queries** cheap. A **difference array** makes range **updates** cheap.

The problem: add 5 to every element from index 2 to index 6, then add 3 from index 4 to 8, and so on for a thousand updates. Doing each one directly is `O(n)` per update.

```csharp
static int[] ApplyRangeUpdates(int size, (int From, int To, int Value)[] updates)
{
    var diff = new int[size + 1];

    foreach (var (from, to, value) in updates)
    {
        diff[from] += value;       // start adding here
        diff[to + 1] -= value;     // stop adding after here
    }

    var result = new int[size];
    int running = 0;

    for (int i = 0; i < size; i++)
    {
        running += diff[i];
        result[i] = running;
    }

    return result;
}

var updates = new[] { (1, 3, 5), (2, 4, 3), (0, 1, 2) };
Console.WriteLine(string.Join(", ", ApplyRangeUpdates(6, updates)));
// 2, 7, 8, 8, 3, 0
```

Each update is two writes, so `k` updates cost `O(k)`. One final pass of `O(n)` turns the difference array back into real values.

This is how "how many meetings overlap at each minute" and "how many flights land in each hour" problems are solved.

## When to use which

- Many range sum questions, no changes to the data: **prefix sums**.
- Many range updates, one read at the end: **difference array**.
- Both updates and queries interleaved: a **Fenwick tree** or **segment tree**, covered later.

The middle case catches people out. If the array changes after you build a prefix sum, the prefix sum is stale and you have to rebuild it, which is `O(n)`.

## Quick recap

- A prefix sum array turns any range sum into one subtraction.
- Make it one slot longer with a leading zero to avoid special cases.
- Use `long` for the prefix array, sums overflow long before elements do.
- Prefix sums plus a dictionary count subarrays with a target sum, even with negatives.
- Seed that dictionary with `[0] = 1` or you miss subarrays starting at index 0.
- Two dimensional prefix sums use inclusion and exclusion for the shared corner.
- Difference arrays make many range updates `O(1)` each, with one pass at the end.

<code id="code-content" class="language-csharp">
// Build once: each slot holds the total of everything before it
static long[] BuildPrefix(int[] numbers)
{
    var prefix = new long[numbers.Length + 1];   // leading 0 removes edge cases
    for (int i = 0; i &lt; numbers.Length; i++) prefix[i + 1] = prefix[i] + numbers[i];
    return prefix;
}
int[] numbers = { 3, 1, 4, 1, 5, 9, 2, 6 };
var prefix = BuildPrefix(numbers);
// Query forever in O(1): one subtraction per range
long RangeSum(int from, int to) =&gt; prefix[to + 1] - prefix[from];
Console.WriteLine(RangeSum(2, 5));      // 4+1+5+9 = 19
Console.WriteLine(RangeSum(0, 3));      // 3+1+4+1 = 9
// Prefix sums + dictionary: count subarrays summing to a target (negatives welcome)
static int CountSubarraysWithSum(int[] numbers, int target)
{
    var counts = new Dictionary&lt;int, int&gt; { [0] = 1 };   // seed, or you miss index 0
    int running = 0, total = 0;
    foreach (int n in numbers)
    {
        running += n;
        if (counts.TryGetValue(running - target, out int seen)) total += seen;
        counts[running] = counts.GetValueOrDefault(running) + 1;
    }
    return total;
}
Console.WriteLine(CountSubarraysWithSum(new[] { 3, 4, -7, 1, 3 }, 0));   // 3
// Difference array: many range updates in O(1) each, one pass at the end
static int[] ApplyRangeUpdates(int size, (int From, int To, int Value)[] updates)
{
    var diff = new int[size + 1];
    foreach (var (from, to, value) in updates)
    {
        diff[from] += value;        // start adding here
        diff[to + 1] -= value;      // stop adding after here
    }
    var result = new int[size];
    int running = 0;
    for (int i = 0; i &lt; size; i++) { running += diff[i]; result[i] = running; }
    return result;
}
var updates = new[] { (1, 3, 5), (2, 4, 3), (0, 1, 2) };
Console.WriteLine(string.Join(", ", ApplyRangeUpdates(6, updates)));
// 2, 7, 8, 8, 3, 0
</code></pre>
