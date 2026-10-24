---
publishDate: 2026-07-01T08:20
title: Big O Notation Explained
slug: big-o-notation-explained
metadescription: Learn what Big O really means, the two rules for simplifying it, and how to read the complexity straight off a piece of C# code.
updateDate: 2026-09-07T08:20
author: ['bishal-biswas']
level: 1
tags: ['complexity', 'big o', 'fundamentals']
course: dsa
---

## What Big O is for

Big O is a short way of saying **how the work grows when the input grows**.

It is not a speed. It does not tell you milliseconds. It tells you shape.

When someone says a method is `O(n)`, they mean: double the input and the work roughly doubles. When they say `O(n^2)`, they mean: double the input and the work goes up about four times.

That is really all it is. A label for a growth pattern.

## Reading the notation

The `n` is the size of your input. Usually the number of items in an array or list.

- `O(1)` means the work does not depend on `n` at all.
- `O(n)` means the work grows in a straight line with `n`.
- `O(n^2)` means the work grows as `n` multiplied by itself.
- `O(log n)` means the work grows very slowly, roughly one extra step each time `n` doubles.

## The two rules

Big O is deliberately rough. Two rules do all the simplifying.

**Rule one: drop the constants.**

A loop that runs `n` times is `O(n)`. Three loops one after another, each running `n` times, is `3n` operations, which is still `O(n)`. The 3 goes.

**Rule two: keep only the biggest term.**

If a method does `n^2 + n + 50` operations, the `n` and the `50` stop mattering as `n` grows. It is `O(n^2)`.

```csharp
static void Example(int[] items)
{
    Console.WriteLine("Starting");             // 1

    foreach (int i in items) Console.Write(i); // n

    for (int a = 0; a < items.Length; a++)     // n * n
    {
        for (int b = 0; b < items.Length; b++) Console.Write(a + b);
    }
}
```

That is `1 + n + n^2` operations. Big O calls it `O(n^2)`.

## O(1), constant time

The work never changes, no matter how big the input.

```csharp
static int First(int[] numbers) => numbers[0];

static bool IsEmpty(List<string> items) => items.Count == 0;

static int Add(int a, int b) => a + b;
```

Reading `numbers[0]` from an array of ten items and one of ten million costs exactly the same. The array knows where item zero lives.

Dictionary and HashSet lookups are also `O(1)` in normal use, which is why they show up everywhere in this course.

## O(n), linear time

You touch each item once.

```csharp
static int Sum(int[] numbers)
{
    int total = 0;
    foreach (int n in numbers) total += n;
    return total;
}
```

Ten items, ten additions. A million items, a million additions. A single loop over the input is the classic `O(n)`.

Note that an early `return` does not change the label. This is still `O(n)`, because the worst case is that the value sits at the end:

```csharp
static bool Contains(int[] numbers, int target)
{
    foreach (int n in numbers)
    {
        if (n == target) return true;
    }
    return false;
}
```

## O(log n), logarithmic time

Each step throws away half the remaining work.

```csharp
static int BinarySearch(int[] sorted, int target)
{
    int low = 0, high = sorted.Length - 1;

    while (low <= high)
    {
        int mid = low + (high - low) / 2;

        if (sorted[mid] == target) return mid;
        if (sorted[mid] < target) low = mid + 1;
        else high = mid - 1;
    }

    return -1;
}
```

With 1,000 items this takes about 10 steps. With 1,000,000 items it takes about 20. With a billion, about 30.

That is why `O(log n)` is so good. Multiplying the data by a thousand adds ten steps.

## O(n log n), linearithmic time

You do a `log n` amount of work for each of `n` items. Every good general purpose sorting algorithm lands here.

```csharp
var numbers = new[] { 5, 2, 9, 1, 7 };
Array.Sort(numbers);   // O(n log n)
```

For practical purposes this is close to `O(n)`. Sorting a million items is fine. Sorting a billion is a different conversation.

## O(n^2), quadratic time

A loop inside a loop over the same data.

```csharp
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

Fine for 100 items. Painful at 10,000. Unusable at 1,000,000.

The inner loop starting at `i + 1` halves the work, so it is really `n^2 / 2`. Rule one says the `/ 2` goes. Still `O(n^2)`.

Most `O(n^2)` code in real projects can be made `O(n)` with a hash set:

```csharp
static bool HasDuplicateFast(int[] numbers)
{
    var seen = new HashSet<int>();

    foreach (int n in numbers)
    {
        if (!seen.Add(n)) return true;   // Add returns false if already present
    }

    return false;
}
```

## O(2^n) and O(n!)

These grow so fast they are only usable on tiny inputs.

```csharp
static int Fibonacci(int n)
{
    if (n <= 1) return n;
    return Fibonacci(n - 1) + Fibonacci(n - 2);   // O(2^n)
}
```

`Fibonacci(40)` makes over a billion calls. `Fibonacci(50)` will not finish today. The fix is memoisation, covered later in this course.

`O(n!)` shows up when you generate every possible ordering of a set. With 10 items that is 3.6 million orderings. With 20 it is more than there are grains of sand.

## Putting the sizes side by side

How many operations each shape needs, roughly:

```text
n            O(log n)   O(n)         O(n log n)     O(n^2)
10           3          10           33             100
100          7          100          664            10,000
1,000        10         1,000        9,966          1,000,000
1,000,000    20         1,000,000    19,931,569     1,000,000,000,000
```

The gap between the columns is why this notation is worth learning.

## Reading complexity off code

A practical checklist:

- No loops over the input: `O(1)`.
- One loop over the input: `O(n)`.
- A loop that halves or doubles a value each step: `O(log n)`.
- A loop inside a loop: `O(n^2)`.
- A sort: `O(n log n)`.
- A `Contains` on a list inside a loop: `O(n^2)`, because that call is itself a loop.

Watch out for different inputs. This is not `O(n^2)`, it is `O(n * m)`:

```csharp
foreach (var user in users)          // n
{
    foreach (var role in roles)      // m
    {
        Console.WriteLine($"{user} {role}");
    }
}
```

If `roles` is always about five items, that is effectively `O(n)`. Naming both sizes keeps you honest.

## What Big O ignores

Big O hides constants, and constants sometimes matter. An `O(n)` method that does heavy string work per item can lose to an `O(n log n)` method that does almost nothing per item, at small sizes.

It also assumes `n` gets large. For twenty items, pick whichever version is easier to read.

Big O is for answering "will this still work when the data grows". For everything else, measure.

## Quick recap

- Big O describes how work grows with input size, not how fast code runs.
- Drop constants and keep only the biggest term.
- `O(1)` never changes, `O(log n)` halves the problem, `O(n)` visits every item.
- `O(n log n)` is the sorting bar, `O(n^2)` is a loop inside a loop.
- `O(2^n)` and `O(n!)` are unusable beyond tiny inputs.
- Loops over two different collections are `O(n * m)`, not `O(n^2)`.
- A `List.Contains` inside a loop is quietly quadratic.

<code id="code-content" class="language-csharp">
// O(1) constant: work never depends on input size
static int First(int[] numbers) =&gt; numbers[0];
// O(n) linear: touch every item once
static int Sum(int[] numbers)
{
    int total = 0;
    foreach (int n in numbers) total += n;
    return total;
}
// O(log n) logarithmic: throw away half the work each step
static int BinarySearch(int[] sorted, int target)
{
    int low = 0, high = sorted.Length - 1;
    while (low &lt;= high)
    {
        int mid = low + (high - low) / 2;
        if (sorted[mid] == target) return mid;
        if (sorted[mid] &lt; target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}
// O(n log n): every good general purpose sort
var numbers = new[] { 5, 2, 9, 1, 7 };
Array.Sort(numbers);
// O(n^2) quadratic: a loop inside a loop over the same data
static bool HasDuplicate(int[] items)
{
    for (int i = 0; i &lt; items.Length; i++)
        for (int j = i + 1; j &lt; items.Length; j++)
            if (items[i] == items[j]) return true;
    return false;
}
// The same job in O(n) using a hash set
static bool HasDuplicateFast(int[] items)
{
    var seen = new HashSet&lt;int&gt;();
    foreach (int n in items)
        if (!seen.Add(n)) return true;   // Add returns false if already there
    return false;
}
// O(2^n): every call splits into two more
static int Fib(int n) =&gt; n &lt;= 1 ? n : Fib(n - 1) + Fib(n - 2);
Console.WriteLine(Fib(20));   // fine. Fib(50) will not finish today.
// Two different collections is O(n * m), not O(n^2)
foreach (var user in new[] { "a", "b" })
    foreach (var role in new[] { "admin", "user" })
        Console.WriteLine($"{user} {role}");
</code></pre>
