---
publishDate: 2026-07-04T09:30
title: Array Traversal Patterns
slug: array-traversal-patterns
metadescription: The handful of loop shapes that solve most array problems, from single pass scanning to running state, pairs and in place partitioning.
updateDate: 2026-09-07T09:30
author: ['bishal-biswas']
level: 1
tags: ['arrays', 'patterns', 'loops']
course: dsa
---

## A small set of shapes

Most array problems are one of a few loop shapes wearing different clothes. Learn the shapes and the problems get much easier to recognise.

## The single pass

Walk once, keep a running answer. This solves more than you would expect.

```csharp
static int Max(int[] numbers)
{
    int best = numbers[0];

    for (int i = 1; i < numbers.Length; i++)
    {
        if (numbers[i] > best) best = numbers[i];
    }

    return best;
}
```

Start at index 1, because index 0 is already the answer so far. Starting at 0 works too, it just wastes one comparison.

The same shape with more state:

```csharp
static (int Min, int Max, long Sum) Summarise(int[] numbers)
{
    int min = numbers[0], max = numbers[0];
    long sum = 0;

    foreach (int n in numbers)
    {
        if (n < min) min = n;
        if (n > max) max = n;
        sum += n;
    }

    return (min, max, sum);
}
```

Three answers, still one pass. Doing three separate `foreach` loops would be three times the memory reads for no benefit.

## Carrying state between items

When the answer depends on what came before, keep a variable for it.

Longest run of equal values:

```csharp
static int LongestRun(int[] numbers)
{
    if (numbers.Length == 0) return 0;

    int best = 1, current = 1;

    for (int i = 1; i < numbers.Length; i++)
    {
        current = numbers[i] == numbers[i - 1] ? current + 1 : 1;
        if (current > best) best = current;
    }

    return best;
}

Console.WriteLine(LongestRun(new[] { 1, 2, 2, 2, 3, 3 }));   // 3
```

The pair of variables, "best so far" and "current", turns up constantly.

Best profit from one buy and one sell is the same shape:

```csharp
static int MaxProfit(int[] prices)
{
    int cheapest = int.MaxValue, best = 0;

    foreach (int price in prices)
    {
        if (price < cheapest) cheapest = price;
        else if (price - cheapest > best) best = price - cheapest;
    }

    return best;
}

Console.WriteLine(MaxProfit(new[] { 7, 1, 5, 3, 6, 4 }));   // 5
```

The obvious solution compares every pair, which is `O(n^2)`. Keeping the cheapest price seen so far makes it `O(n)`.

## Walking backwards

Useful when removing items, or when the answer depends on what comes after.

```csharp
// Remove safely: removals never move items you have not looked at yet
for (int i = list.Count - 1; i >= 0; i--)
{
    if (list[i] < 0) list.RemoveAt(i);
}
```

```csharp
// Running total from the right
static int[] SuffixSums(int[] numbers)
{
    var sums = new int[numbers.Length];
    int total = 0;

    for (int i = numbers.Length - 1; i >= 0; i--)
    {
        total += numbers[i];
        sums[i] = total;
    }

    return sums;
}
```

## Two indexes moving together

One from each end, meeting in the middle.

```csharp
static bool IsPalindrome(string text)
{
    int left = 0, right = text.Length - 1;

    while (left < right)
    {
        if (text[left] != text[right]) return false;
        left++;
        right--;
    }

    return true;
}
```

Or both moving forward at different speeds. This is the two pointer family, covered fully in its own topic.

## Comparing every pair

Sometimes you genuinely need every pair. The key detail is starting the inner loop at `i + 1`.

```csharp
static void PrintPairs(int[] numbers)
{
    for (int i = 0; i < numbers.Length; i++)
    {
        for (int j = i + 1; j < numbers.Length; j++)
        {
            Console.WriteLine($"({numbers[i]}, {numbers[j]})");
        }
    }
}
```

Starting at `i + 1` avoids comparing an item with itself and avoids seeing each pair twice. It is `O(n^2)` either way, but half the work.

Before writing this loop, ask whether a `HashSet` or a `Dictionary` can replace it. It usually can:

```csharp
// O(n^2)
static bool HasPairSummingTo(int[] numbers, int target)
{
    for (int i = 0; i < numbers.Length; i++)
        for (int j = i + 1; j < numbers.Length; j++)
            if (numbers[i] + numbers[j] == target) return true;
    return false;
}

// O(n)
static bool HasPairSummingToFast(int[] numbers, int target)
{
    var seen = new HashSet<int>();

    foreach (int n in numbers)
    {
        if (seen.Contains(target - n)) return true;
        seen.Add(n);
    }

    return false;
}
```

## Building a new array

When the output is a transformation of the input, allocate once and fill by index.

```csharp
static int[] Doubled(int[] numbers)
{
    var result = new int[numbers.Length];

    for (int i = 0; i < numbers.Length; i++) result[i] = numbers[i] * 2;

    return result;
}
```

Use a `List<T>` when you do not know the output size:

```csharp
static List<int> Evens(int[] numbers)
{
    var result = new List<int>();

    foreach (int n in numbers)
    {
        if (n % 2 == 0) result.Add(n);
    }

    return result;
}
```

## Partitioning in place

Rearranging without allocating anything. One index reads, another writes.

```csharp
// Move all zeros to the end, keeping the order of the rest
static void MoveZerosToEnd(int[] numbers)
{
    int write = 0;

    for (int read = 0; read < numbers.Length; read++)
    {
        if (numbers[read] != 0)
        {
            numbers[write] = numbers[read];
            write++;
        }
    }

    while (write < numbers.Length)
    {
        numbers[write] = 0;
        write++;
    }
}
```

The read index always runs ahead of the write index, so nothing is overwritten before it is copied. This same two index pattern removes duplicates from a sorted array and drives the partition step of quick sort.

## Chunking

Processing in fixed size batches, which matters for database calls and API limits.

```csharp
static void ProcessInChunks(int[] numbers, int size)
{
    for (int start = 0; start < numbers.Length; start += size)
    {
        int length = Math.Min(size, numbers.Length - start);
        var chunk = numbers[start..(start + length)];

        Console.WriteLine($"Chunk: {string.Join(", ", chunk)}");
    }
}

ProcessInChunks(new[] { 1, 2, 3, 4, 5, 6, 7 }, 3);
```

The `Math.Min` is what stops the last chunk running past the end.

## The edge cases to always check

Before you call an array method finished, run it against these.

- An empty array.
- One item.
- All items the same.
- Already sorted, and sorted backwards.
- The answer at index 0, and at the last index.

Most array bugs are off by one errors at the boundaries, and these five inputs find them.

## Quick recap

- One pass with a running answer solves a surprising share of problems.
- A "best so far" plus "current" pair handles runs, streaks and profits.
- Loop backwards when removing items or when the answer depends on later values.
- Start the inner loop at `i + 1` to see each pair once.
- Before writing a nested loop, ask if a hash set turns it into one pass.
- Separate read and write indexes let you rearrange in place with no allocation.
- Test empty, single, sorted, reversed and boundary positions every time.

<code id="code-content" class="language-csharp">
// One pass, running answer: several results without several loops
static (int Min, int Max, long Sum) Summarise(int[] numbers)
{
    int min = numbers[0], max = numbers[0];
    long sum = 0;
    foreach (int n in numbers)
    {
        if (n &lt; min) min = n;
        if (n &gt; max) max = n;
        sum += n;
    }
    return (min, max, sum);
}
Console.WriteLine(Summarise(new[] { 4, 1, 9, 2 }));   // (1, 9, 16)
// "best so far" plus "current": longest run of equal values
static int LongestRun(int[] n)
{
    if (n.Length == 0) return 0;
    int best = 1, current = 1;
    for (int i = 1; i &lt; n.Length; i++)
    {
        current = n[i] == n[i - 1] ? current + 1 : 1;
        if (current &gt; best) best = current;
    }
    return best;
}
Console.WriteLine(LongestRun(new[] { 1, 2, 2, 2, 3 }));   // 3
// Nested loop O(n^2) replaced by a hash set O(n)
static bool HasPairSummingTo(int[] numbers, int target)
{
    var seen = new HashSet&lt;int&gt;();
    foreach (int n in numbers)
    {
        if (seen.Contains(target - n)) return true;
        seen.Add(n);
    }
    return false;
}
Console.WriteLine(HasPairSummingTo(new[] { 2, 7, 11 }, 9));   // True
// Separate read and write indexes rearrange in place, no allocation
static void MoveZerosToEnd(int[] a)
{
    int write = 0;
    for (int read = 0; read &lt; a.Length; read++)
        if (a[read] != 0) a[write++] = a[read];
    while (write &lt; a.Length) a[write++] = 0;
}
var data = new[] { 0, 1, 0, 3, 12 };
MoveZerosToEnd(data);
Console.WriteLine(string.Join(",", data));    // 1,3,12,0,0
// Chunking: Math.Min keeps the last chunk inside the array
for (int start = 0; start &lt; data.Length; start += 2)
{
    int len = Math.Min(2, data.Length - start);
    Console.WriteLine(string.Join(",", data[start..(start + len)]));
}
</code></pre>
