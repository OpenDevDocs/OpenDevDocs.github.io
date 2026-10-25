---
publishDate: 2026-07-19T14:50
title: Binary Search on the Answer
slug: binary-search-on-the-answer
metadescription: Use binary search when there is no array to search, by searching the range of possible answers for the boundary where a condition flips.
updateDate: 2026-09-07T14:50
author: ['bishal-biswas']
level: 3
tags: ['binary search', 'patterns', 'advanced']
course: dsa
---

## Searching without an array

Binary search does not really need an array. It needs a **range of candidates** and a way to tell, for any candidate, whether the answer is at least that big.

If the answers form a pattern like `false, false, false, true, true, true`, binary search finds the boundary in `O(log n)` even though nothing is stored anywhere.

This unlocks a category of problems that look nothing like searching.

## The recognisable shape

Ask two questions.

1. **Can I check a specific answer quickly?** Given a candidate `x`, can I decide "is `x` good enough" in `O(n)` or better?
2. **Is the answer monotonic?** If `x` works, does every larger value also work (or every smaller one)?

Yes to both means binary search on the answer applies.

## Integer square root

The simplest example, and a good one to see the shape.

```csharp
static int SquareRoot(int n)
{
    if (n < 2) return n;

    int low = 1, high = n / 2, result = 1;

    while (low <= high)
    {
        long mid = low + (high - low) / 2;

        if (mid * mid == n) return (int)mid;

        if (mid * mid < n)
        {
            result = (int)mid;      // this works, try bigger
            low = (int)mid + 1;
        }
        else
        {
            high = (int)mid - 1;    // too big, go smaller
        }
    }

    return result;
}

Console.WriteLine(SquareRoot(16));   // 4
Console.WriteLine(SquareRoot(17));   // 4
Console.WriteLine(SquareRoot(99));   // 9
```

There is no array. The search space is the numbers from 1 to `n / 2`, and the check is one multiplication.

`mid` is a `long` deliberately. `mid * mid` overflows an `int` for large `n`, which turns a correct algorithm into a wrong one.

## Ship packages within D days

A proper example. Packages must be shipped in order, at most `days` days are allowed, and you need the smallest ship capacity that makes it possible.

```csharp
static int MinimumCapacity(int[] weights, int days)
{
    int low = weights.Max();      // must at least carry the heaviest package
    int high = weights.Sum();     // one day, everything at once

    while (low < high)
    {
        int mid = low + (high - low) / 2;

        if (CanShip(weights, mid, days)) high = mid;    // works, try smaller
        else low = mid + 1;                             // fails, need bigger
    }

    return low;
}

static bool CanShip(int[] weights, int capacity, int days)
{
    int daysNeeded = 1, load = 0;

    foreach (int weight in weights)
    {
        if (load + weight > capacity)
        {
            daysNeeded++;
            load = 0;
        }

        load += weight;
    }

    return daysNeeded <= days;
}

int[] weights = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };
Console.WriteLine(MinimumCapacity(weights, 5));   // 15
```

The two boundaries are the interesting part.

`low` starts at the heaviest package, because no smaller capacity can ever ship it. `high` starts at the total, because that capacity definitely works in one day. Getting these wrong is the usual bug.

Checking one capacity is `O(n)`. Binary searching the range costs `O(log(sum))` checks. Total `O(n log(sum))`, versus trying every capacity which would be `O(n * sum)`.

## Minimum eating speed

Same shape, different story. Piles of bananas, `hours` available, find the slowest eating speed that finishes in time.

```csharp
static int MinimumSpeed(int[] piles, int hours)
{
    int low = 1, high = piles.Max();

    while (low < high)
    {
        int mid = low + (high - low) / 2;

        long needed = 0;
        foreach (int pile in piles) needed += (pile + mid - 1) / mid;   // ceiling divide

        if (needed <= hours) high = mid;
        else low = mid + 1;
    }

    return low;
}

Console.WriteLine(MinimumSpeed(new[] { 3, 6, 7, 11 }, 8));   // 4
```

`(pile + mid - 1) / mid` is integer ceiling division. Writing `pile / mid` rounds down and silently under counts the hours.

## Splitting an array

Split an array into `k` contiguous parts, minimising the largest part sum.

```csharp
static int SplitArray(int[] numbers, int k)
{
    int low = numbers.Max(), high = numbers.Sum();

    while (low < high)
    {
        int mid = low + (high - low) / 2;

        if (PartsNeeded(numbers, mid) <= k) high = mid;
        else low = mid + 1;
    }

    return low;
}

static int PartsNeeded(int[] numbers, int limit)
{
    int parts = 1, current = 0;

    foreach (int n in numbers)
    {
        if (current + n > limit)
        {
            parts++;
            current = 0;
        }

        current += n;
    }

    return parts;
}

Console.WriteLine(SplitArray(new[] { 7, 2, 5, 10, 8 }, 2));   // 18
```

Identical structure to the shipping problem. Once you see one, you see all of them.

## Searching real numbers

With decimals there is no "next value", so loop a fixed number of times or until the range is small enough.

```csharp
static double SquareRootPrecise(double n)
{
    double low = 0, high = Math.Max(1, n);

    for (int i = 0; i < 100; i++)      // 100 halvings is far beyond double precision
    {
        double mid = (low + high) / 2;

        if (mid * mid < n) low = mid;
        else high = mid;
    }

    return low;
}

Console.WriteLine(SquareRootPrecise(2));   // 1.4142135623730951
```

A fixed iteration count is safer than `while (high - low > 0.000001)`, which can loop forever when floating point rounding stops the range shrinking.

## The template

```csharp
static int BinarySearchAnswer(int lowestPossible, int highestPossible, Func<int, bool> works)
{
    int low = lowestPossible, high = highestPossible;

    while (low < high)
    {
        int mid = low + (high - low) / 2;

        if (works(mid)) high = mid;     // this works, is there something smaller?
        else low = mid + 1;             // does not work, go bigger
    }

    return low;
}

Console.WriteLine(BinarySearchAnswer(1, 100, x => x * x >= 50));   // 8
```

For the **largest** value that works, flip the assignments and round `mid` upward to avoid an infinite loop:

```csharp
while (low < high)
{
    int mid = low + (high - low + 1) / 2;    // round up

    if (works(mid)) low = mid;
    else high = mid - 1;
}
```

Rounding up matters here. With `low = 3, high = 4`, rounding down gives `mid = 3`, and `low = mid` leaves everything unchanged forever.

## Getting it right

**Choose the boundaries carefully.** `low` should be the smallest conceivable answer and `high` the largest known to work. Too narrow and you miss the answer, too wide and you may overflow.

**Make sure the condition is monotonic.** If `works(5)` is true but `works(6)` is false and `works(7)` is true again, binary search finds nothing meaningful.

**Test the check function separately.** Most bugs here are in the check, not the search. Verify it by hand on a couple of values before trusting the result.

**Watch for overflow** in `mid * mid` and in sums. Use `long`.

## Quick recap

- Binary search needs a range and a monotonic yes or no test, not an array.
- Ask: can I check one candidate quickly, and does the answer stay good as it grows?
- Set `low` to the smallest possible answer and `high` to one that definitely works.
- Use `while (low < high)` with `high = mid` for the smallest working value.
- For the largest working value, round `mid` up or the loop never ends.
- Use ceiling division when counting how many groups or hours are needed.
- For decimals, run a fixed number of iterations instead of comparing to an epsilon.

<code id="code-content" class="language-csharp">
// No array needed. Just a range of candidates and a monotonic yes/no test.
static int BinarySearchAnswer(int lowest, int highest, Func&lt;int, bool&gt; works)
{
    int low = lowest, high = highest;
    while (low &lt; high)
    {
        int mid = low + (high - low) / 2;
        if (works(mid)) high = mid;      // works, is there something smaller?
        else low = mid + 1;              // fails, go bigger
    }
    return low;
}
Console.WriteLine(BinarySearchAnswer(1, 100, x =&gt; x * x &gt;= 50));   // 8
// Integer square root: search 1..n/2, check with one multiplication
static int SquareRoot(int n)
{
    if (n &lt; 2) return n;
    int low = 1, high = n / 2, result = 1;
    while (low &lt;= high)
    {
        long mid = low + (high - low) / 2;      // long, or mid * mid overflows
        if (mid * mid &lt;= n) { result = (int)mid; low = (int)mid + 1; }
        else high = (int)mid - 1;
    }
    return result;
}
Console.WriteLine(SquareRoot(99));       // 9
// Ship packages in D days: the BOUNDARIES are where the thinking happens
static int MinimumCapacity(int[] weights, int days)
{
    int low = weights.Max();             // cannot be smaller than the heaviest item
    int high = weights.Sum();            // this definitely works, in one day
    while (low &lt; high)
    {
        int mid = low + (high - low) / 2;
        if (CanShip(weights, mid, days)) high = mid;
        else low = mid + 1;
    }
    return low;
}
static bool CanShip(int[] weights, int capacity, int days)
{
    int needed = 1, load = 0;
    foreach (int w in weights)
    {
        if (load + w &gt; capacity) { needed++; load = 0; }
        load += w;
    }
    return needed &lt;= days;
}
Console.WriteLine(MinimumCapacity(new[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 }, 5));   // 15
// Counting groups or hours? Use CEILING division, not plain division.
int pile = 7, speed = 3;
Console.WriteLine((pile + speed - 1) / speed);   // 3 hours, not 2
// For the LARGEST working value, round mid UP or the loop never ends
// int mid = low + (high - low + 1) / 2;  if (works(mid)) low = mid; else high = mid - 1;
// For decimals, run a fixed number of iterations instead of an epsilon test
double lo = 0, hi = 2;
for (int i = 0; i &lt; 100; i++) { double m = (lo + hi) / 2; if (m * m &lt; 2) lo = m; else hi = m; }
Console.WriteLine(lo);                   // 1.4142135623730951
</code></pre>
