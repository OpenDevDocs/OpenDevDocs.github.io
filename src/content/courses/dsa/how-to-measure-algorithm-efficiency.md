---
publishDate: 2026-07-01T08:10
title: How to Measure Algorithm Efficiency
slug: how-to-measure-algorithm-efficiency
metadescription: Learn why stopwatch timings mislead you, how to count operations instead, and how input growth reveals which code will scale.
updateDate: 2026-09-07T08:10
author: ['bishal-biswas']
level: 1
tags: ['fundamentals', 'complexity', 'measurement']
course: dsa
---

## Why not just time it?

The obvious way to compare two pieces of code is to run both and see which finishes first.

```csharp
using System.Diagnostics;

var watch = Stopwatch.StartNew();
DoTheWork();
Console.WriteLine($"{watch.ElapsedMilliseconds} ms");
```

This is useful, but it answers a smaller question than you think. The number you get depends on your processor, how busy your machine is, whether the data was already in cache, and how much test data you used.

Run the same code on a colleague's laptop and you get a different number. Run it on production data and you may get a wildly different number.

Timing tells you how fast this code was on this machine today. It does not tell you what happens when the data gets ten times bigger.

## Count the work instead

A stable measure ignores the machine and counts **how many basic operations** the code performs.

```csharp
static int SumAll(int[] numbers)
{
    int total = 0;              // 1 operation

    foreach (int n in numbers)  // runs n times
    {
        total += n;             // 1 operation each pass
    }

    return total;               // 1 operation
}
```

For an array of `n` items this is roughly `n + 2` operations. Double the array, double the work. That statement is true on any machine, in any year.

## Growth is the real question

The number that matters is not "how long does it take", it is **"what happens when the input grows"**.

Compare these two.

```csharp
// Touches every item once
static bool ContainsZero(int[] numbers)
{
    foreach (int n in numbers)
    {
        if (n == 0) return true;
    }
    return false;
}
```

```csharp
// Touches every pair of items
static bool HasDuplicate(int[] numbers)
{
    for (int i = 0; i < numbers.Length; i++)
    {
        for (int j = i + 1; j < numbers.Length; j++)
        {
            if (numbers[i] == numbers[j]) return true;
        }
    }
    return false;
}
```

With 1,000 items the first does about 1,000 checks and the second does about 500,000. With 10,000 items, the first does 10,000 and the second does roughly 50 million.

The first grew ten times. The second grew a hundred times. That gap is what efficiency analysis is about.

## Watching growth in code

You can see the shape without any timing at all. Just count.

```csharp
static long CountPairChecks(int n)
{
    long checks = 0;

    for (int i = 0; i < n; i++)
    {
        for (int j = i + 1; j < n; j++) checks++;
    }

    return checks;
}

foreach (int n in new[] { 100, 200, 400, 800 })
{
    Console.WriteLine($"n = {n}  checks = {CountPairChecks(n)}");
}
```

Output:

```text
n = 100  checks = 4950
n = 200  checks = 19900
n = 400  checks = 79800
n = 800  checks = 319600
```

Every time `n` doubles, the work goes up about four times. That is the signature of nested loops.

## Constants stop mattering

Suppose one method does `3n` operations and another does `n * n`.

For `n = 5`, the first does 15 and the second does 25. Close enough to not care.

For `n = 1,000`, the first does 3,000 and the second does 1,000,000.

For `n = 1,000,000`, the first does 3 million and the second does a trillion.

The `3` never mattered. The **shape** of the growth did. This is why efficiency analysis drops constants and keeps only the fastest growing part. A method doing `5n + 200` operations and one doing `n` operations belong in the same category.

## Only count what grows

When you analyse a method, ignore the setup that runs a fixed number of times.

```csharp
static double Average(int[] numbers)
{
    if (numbers.Length == 0) return 0;   // runs once, ignore
    int total = 0;                       // runs once, ignore

    foreach (int n in numbers) total += n;   // runs n times, this is the answer

    return (double)total / numbers.Length;   // runs once, ignore
}
```

The loop decides everything. This method's cost grows in a straight line with the array size.

## Nested and sequential loops

Two loops one after another add up. Two loops nested multiply.

```csharp
// n + n  =>  grows in a straight line
foreach (int n in numbers) Console.WriteLine(n);
foreach (int n in numbers) Console.WriteLine(n * 2);

// n * n  =>  grows as a square
foreach (int a in numbers)
{
    foreach (int b in numbers) Console.WriteLine(a + b);
}
```

A loop that is not nested inside another loop is almost never your problem. A loop inside a loop usually is.

## Hidden loops

The trickiest cases are loops you did not write.

```csharp
foreach (var order in orders)
{
    if (bannedIds.Contains(order.CustomerId))   // a loop, if bannedIds is a List
    {
        Console.WriteLine("Blocked");
    }
}
```

`List<T>.Contains` walks the whole list. So this is a nested loop wearing a disguise. Change `bannedIds` to a `HashSet<int>` and the inner walk disappears.

Methods worth being suspicious about inside a loop: `Contains`, `IndexOf`, `Any`, `First`, `Where`, `Remove` on a list, and building strings with `+=`.

## Memory counts too

Time is not the only cost. Some methods trade extra memory for speed.

```csharp
// No extra memory, but slow lookups
bool found = names.Contains("Asha");

// Extra memory for the set, but instant lookups afterwards
var lookup = new HashSet<string>(names);
bool fast = lookup.Contains("Asha");
```

The set copies every name, so memory grows with the input. That is usually a good trade, but it is a trade, and on very large data it is worth noticing.

## A practical method

When you want to know if code will scale, do this.

1. Find the loops, including hidden ones inside library calls.
2. Ask whether they are sequential or nested.
3. Ask what each loop runs over, and whether that thing grows with the data.
4. Test with data ten times bigger than you expect and see what happens.

Step four catches almost everything. Code that behaves fine at ten times your expected load is rarely the problem.

## Quick recap

- Stopwatch timings depend on your machine, so they cannot answer "will this scale".
- Count operations instead, then look at how that count grows with the input.
- Constants and one off setup lines do not matter, growth shape does.
- Sequential loops add, nested loops multiply.
- `Contains`, `IndexOf` and `First` on a list are loops in disguise.
- Extra memory is a real cost, and often a worthwhile trade for speed.
- Always test with far more data than you expect.

<code id="code-content" class="language-csharp">
using System.Diagnostics;
// Timing tells you about today's machine, counting tells you about growth
static long CountPairChecks(int n)
{
    long checks = 0;
    for (int i = 0; i &lt; n; i++)
        for (int j = i + 1; j &lt; n; j++) checks++;
    return checks;
}
foreach (int n in new[] { 100, 200, 400, 800 })
    Console.WriteLine($"n = {n}  checks = {CountPairChecks(n)}");
// n doubles  =&gt;  checks roughly quadruple. That is a nested loop.
// One loop: work grows in a straight line
static double Average(int[] numbers)
{
    if (numbers.Length == 0) return 0;        // runs once, ignore
    int total = 0;                            // runs once, ignore
    foreach (int n in numbers) total += n;    // runs n times, this is the cost
    return (double)total / numbers.Length;
}
// Two loops nested: work grows as a square
static bool HasDuplicate(int[] numbers)
{
    for (int i = 0; i &lt; numbers.Length; i++)
        for (int j = i + 1; j &lt; numbers.Length; j++)
            if (numbers[i] == numbers[j]) return true;
    return false;
}
// A hidden loop: List.Contains walks the whole list every time
var bannedList = new List&lt;int&gt; { 4, 8, 15 };
var bannedSet  = new HashSet&lt;int&gt; { 4, 8, 15 };
var orders = new[] { 1, 8, 3 };
foreach (int id in orders) if (bannedList.Contains(id)) { }   // nested loop in disguise
foreach (int id in orders) if (bannedSet.Contains(id)) { }    // no inner walk at all
// Measure with far more data than you expect
var watch = Stopwatch.StartNew();
HasDuplicate(Enumerable.Range(0, 20_000).ToArray());
Console.WriteLine($"{watch.ElapsedMilliseconds} ms");
</code></pre>
