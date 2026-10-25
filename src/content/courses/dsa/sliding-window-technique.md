---
publishDate: 2026-07-05T09:50
title: Sliding Window Technique
slug: sliding-window-technique
metadescription: Solve subarray and substring problems in one pass by growing and shrinking a window instead of recomputing from scratch.
updateDate: 2026-09-07T09:50
author: ['bishal-biswas']
level: 2
tags: ['arrays', 'sliding window', 'patterns']
course: dsa
---

## The wasted work

Find the largest sum of any three consecutive numbers:

```csharp
static int MaxSumOfThree(int[] numbers)
{
    int best = int.MinValue;

    for (int i = 0; i + 3 <= numbers.Length; i++)
    {
        int sum = numbers[i] + numbers[i + 1] + numbers[i + 2];
        if (sum > best) best = sum;
    }

    return best;
}
```

This works, but look at what it repeats. The window `[1,2,3]` and the window `[2,3,4]` share two numbers, and we add both again from scratch.

A **sliding window** fixes that. When the window moves one step right, add the number entering and subtract the number leaving.

## Fixed size window

```csharp
static int MaxSum(int[] numbers, int size)
{
    if (numbers.Length < size) return 0;

    int sum = 0;
    for (int i = 0; i < size; i++) sum += numbers[i];   // the first window

    int best = sum;

    for (int end = size; end < numbers.Length; end++)
    {
        sum += numbers[end];            // the item entering
        sum -= numbers[end - size];     // the item leaving

        if (sum > best) best = sum;
    }

    return best;
}

Console.WriteLine(MaxSum(new[] { 2, 1, 5, 1, 3, 2 }, 3));   // 9
```

Two operations per step instead of `size` operations. `O(n)` instead of `O(n * size)`.

The same shape gives a moving average:

```csharp
static double[] MovingAverage(int[] numbers, int size)
{
    var result = new double[numbers.Length - size + 1];
    int sum = 0;

    for (int i = 0; i < numbers.Length; i++)
    {
        sum += numbers[i];
        if (i >= size) sum -= numbers[i - size];
        if (i >= size - 1) result[i - size + 1] = (double)sum / size;
    }

    return result;
}
```

## Variable size window

More interesting, and more common. The window grows until a condition breaks, then shrinks until it holds again.

Longest substring with no repeated characters:

```csharp
static int LongestUnique(string text)
{
    var lastSeen = new Dictionary<char, int>();
    int start = 0, best = 0;

    for (int end = 0; end < text.Length; end++)
    {
        char c = text[end];

        if (lastSeen.TryGetValue(c, out int previous) && previous >= start)
        {
            start = previous + 1;    // jump the window past the earlier copy
        }

        lastSeen[c] = end;
        best = Math.Max(best, end - start + 1);
    }

    return best;
}

Console.WriteLine(LongestUnique("abcabcbb"));   // 3, "abc"
Console.WriteLine(LongestUnique("bbbbb"));      // 1, "b"
Console.WriteLine(LongestUnique("pwwkew"));     // 3, "wke"
```

The `previous >= start` check matters. A character seen before the window started is not inside the window, so it is not a repeat.

## The general shape

Almost every variable window problem looks like this:

```csharp
int start = 0;

for (int end = 0; end < items.Length; end++)
{
    // 1. add items[end] to the window state

    while (/* the window is no longer valid */)
    {
        // 2. remove items[start] from the window state
        start++;
    }

    // 3. the window from start to end is valid, record the answer
}
```

Both `start` and `end` only ever move forward. Each item enters once and leaves once, so the whole thing is `O(n)` even though there is a loop inside a loop.

## Smallest window with a given sum

```csharp
static int SmallestWindow(int[] positives, int target)
{
    int start = 0, sum = 0, best = int.MaxValue;

    for (int end = 0; end < positives.Length; end++)
    {
        sum += positives[end];

        while (sum >= target)
        {
            best = Math.Min(best, end - start + 1);
            sum -= positives[start];
            start++;
        }
    }

    return best == int.MaxValue ? 0 : best;
}

Console.WriteLine(SmallestWindow(new[] { 2, 3, 1, 2, 4, 3 }, 7));   // 2, from [4, 3]
```

Here the window shrinks while it is still valid, because we want the smallest one.

Important limitation: this needs **positive** numbers. With negatives, shrinking the window can increase the sum, so the logic breaks. Use prefix sums with a dictionary for that case.

## Longest window with at most K distinct values

```csharp
static int LongestWithKDistinct(string text, int k)
{
    var counts = new Dictionary<char, int>();
    int start = 0, best = 0;

    for (int end = 0; end < text.Length; end++)
    {
        char c = text[end];
        counts[c] = counts.GetValueOrDefault(c) + 1;

        while (counts.Count > k)
        {
            char leaving = text[start];
            counts[leaving]--;
            if (counts[leaving] == 0) counts.Remove(leaving);
            start++;
        }

        best = Math.Max(best, end - start + 1);
    }

    return best;
}

Console.WriteLine(LongestWithKDistinct("eceba", 2));   // 3, "ece"
```

Removing the key when its count hits zero is essential. Without it, `counts.Count` keeps counting characters that already left the window.

## Counting instead of measuring

Sometimes you want how many windows qualify, not how long one is.

```csharp
static int CountSubarraysUnder(int[] positives, int limit)
{
    int start = 0, product = 1, total = 0;

    for (int end = 0; end < positives.Length; end++)
    {
        product *= positives[end];

        while (product >= limit && start <= end)
        {
            product /= positives[start];
            start++;
        }

        total += end - start + 1;    // every window ending at end
    }

    return total;
}

Console.WriteLine(CountSubarraysUnder(new[] { 10, 5, 2, 6 }, 100));   // 8
```

`end - start + 1` counts every valid window that ends at `end`, which avoids listing them.

## Spotting the pattern

A sliding window fits when the problem says:

- **contiguous** subarray or substring, and
- **longest**, **shortest**, **maximum**, **minimum** or **count of** something, and
- the window state can be updated cheaply when an item enters or leaves.

That last condition is the real requirement. Sums, counts and character frequencies update in `O(1)`. A window maximum does not, which is why that particular problem needs a deque.

If the elements do not have to be next to each other, it is not a window problem.

## Quick recap

- A sliding window updates the answer as items enter and leave, instead of recomputing.
- Fixed windows add one item and subtract one item per step.
- Variable windows grow with an outer loop and shrink with an inner `while`.
- Both indexes only move forward, so the whole scan is `O(n)`.
- Remove dictionary keys when their count reaches zero.
- Sum based shrinking needs positive numbers to be correct.
- Look for the words "contiguous" and "longest" or "shortest" as the signal.

<code id="code-content" class="language-csharp">
// Fixed window: add the item entering, subtract the item leaving
static int MaxSum(int[] numbers, int size)
{
    if (numbers.Length &lt; size) return 0;
    int sum = 0;
    for (int i = 0; i &lt; size; i++) sum += numbers[i];
    int best = sum;
    for (int end = size; end &lt; numbers.Length; end++)
    {
        sum += numbers[end] - numbers[end - size];
        if (sum &gt; best) best = sum;
    }
    return best;
}
Console.WriteLine(MaxSum(new[] { 2, 1, 5, 1, 3, 2 }, 3));   // 9
// Variable window: grow with the outer loop, shrink with the inner while
static int SmallestWindow(int[] positives, int target)
{
    int start = 0, sum = 0, best = int.MaxValue;
    for (int end = 0; end &lt; positives.Length; end++)
    {
        sum += positives[end];
        while (sum &gt;= target)
        {
            best = Math.Min(best, end - start + 1);
            sum -= positives[start++];
        }
    }
    return best == int.MaxValue ? 0 : best;
}
Console.WriteLine(SmallestWindow(new[] { 2, 3, 1, 2, 4, 3 }, 7));   // 2
// Longest substring with no repeats: jump start past the earlier copy
static int LongestUnique(string text)
{
    var lastSeen = new Dictionary&lt;char, int&gt;();
    int start = 0, best = 0;
    for (int end = 0; end &lt; text.Length; end++)
    {
        char c = text[end];
        if (lastSeen.TryGetValue(c, out int prev) &amp;&amp; prev &gt;= start) start = prev + 1;
        lastSeen[c] = end;
        best = Math.Max(best, end - start + 1);
    }
    return best;
}
Console.WriteLine(LongestUnique("abcabcbb"));   // 3
// At most K distinct: remove the key when its count hits zero
static int LongestWithKDistinct(string text, int k)
{
    var counts = new Dictionary&lt;char, int&gt;();
    int start = 0, best = 0;
    for (int end = 0; end &lt; text.Length; end++)
    {
        counts[text[end]] = counts.GetValueOrDefault(text[end]) + 1;
        while (counts.Count &gt; k)
        {
            char leaving = text[start++];
            if (--counts[leaving] == 0) counts.Remove(leaving);
        }
        best = Math.Max(best, end - start + 1);
    }
    return best;
}
Console.WriteLine(LongestWithKDistinct("eceba", 2));   // 3
</code></pre>
