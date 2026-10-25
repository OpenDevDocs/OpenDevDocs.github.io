---
publishDate: 2026-07-03T08:50
title: Best, Average and Worst Case
slug: best-average-and-worst-case
metadescription: See how the same algorithm can be fast or slow depending on the input, and learn why worst case is the number you plan around.
updateDate: 2026-09-07T08:50
author: ['bishal-biswas']
level: 1
tags: ['complexity', 'analysis', 'fundamentals']
course: dsa
---

## The same code, three answers

Ask how long a linear search takes and the honest answer is "it depends where the item is".

```csharp
static int IndexOf(int[] numbers, int target)
{
    for (int i = 0; i < numbers.Length; i++)
    {
        if (numbers[i] == target) return i;
    }
    return -1;
}
```

- If the target is first, one comparison. That is the **best case**.
- If it is somewhere random, about half the array. That is the **average case**.
- If it is last or missing, the whole array. That is the **worst case**.

Best case is `O(1)`, average and worst are `O(n)`.

When someone gives a single Big O without saying which, they almost always mean worst case.

## Why worst case is the default

Best case is nearly useless for planning. Any search is `O(1)` in the best case, because the item might be first. That tells you nothing.

Worst case gives you a promise: **it will never be slower than this**. Promises are what you build systems on.

It also protects you from bad luck and from attackers. If your average is fast but your worst case is terrible, someone can feed you exactly the input that hits the worst case.

## Seeing all three

```csharp
static int Search(int[] numbers, int target)
{
    int comparisons = 0;

    for (int i = 0; i < numbers.Length; i++)
    {
        comparisons++;
        if (numbers[i] == target)
        {
            Console.WriteLine($"Found after {comparisons} comparisons");
            return i;
        }
    }

    Console.WriteLine($"Not found after {comparisons} comparisons");
    return -1;
}

var data = Enumerable.Range(1, 1000).ToArray();

Search(data, 1);      // 1 comparison       best
Search(data, 500);    // 500 comparisons    average
Search(data, 1000);   // 1000 comparisons   worst
Search(data, 9999);   // 1000 comparisons   worst
```

## Where the gap really bites

Quick sort is the famous example.

```csharp
static void QuickSort(int[] a, int low, int high)
{
    if (low >= high) return;

    int pivot = a[high];
    int boundary = low;

    for (int i = low; i < high; i++)
    {
        if (a[i] < pivot)
        {
            (a[i], a[boundary]) = (a[boundary], a[i]);
            boundary++;
        }
    }

    (a[boundary], a[high]) = (a[high], a[boundary]);

    QuickSort(a, low, boundary - 1);
    QuickSort(a, boundary + 1, high);
}
```

If each pivot lands near the middle, the array halves every time and you get `O(n log n)`.

If each pivot is the smallest or largest value, one side is empty and the other has everything. Now it is `O(n^2)`.

When does that happen with this code, which always picks the last element as the pivot? On an **already sorted array**. The most innocent looking input is the worst one.

```csharp
var sorted = Enumerable.Range(1, 20_000).ToArray();
QuickSort(sorted, 0, sorted.Length - 1);   // O(n^2), and may overflow the stack
```

The fix is to pick the pivot randomly or from the middle, which makes the bad case essentially impossible to hit by accident.

## Hash tables

A dictionary lookup is `O(1)` on average and `O(n)` in the worst case.

The worst case happens when every key lands in the same bucket, turning the table into a list. With normal data and a sane hash function this never happens, which is why everyone quotes the average.

It is worth knowing the worst case exists though. Deliberately crafted keys that all collide are a real denial of service technique, which is why modern runtimes randomise their string hashing.

## Amortised, a different idea

**Amortised** is not the same as average. Average is about which input you got. Amortised is about spreading one expensive operation across many cheap ones.

```csharp
var list = new List<int>();

for (int i = 0; i < 1000; i++)
{
    list.Add(i);   // usually O(1), occasionally O(n)
}
```

`List<T>` keeps an internal array. When it fills up, it allocates a new array of double the size and copies everything, which is `O(n)`.

That resize is rare, and it gets rarer as the list grows, because each doubling covers twice as many future adds. Across 1,000 adds the total copying work is under 2,000 operations. So `Add` is **amortised O(1)**.

You can watch the doublings:

```csharp
var list = new List<int>();
int capacity = list.Capacity;

for (int i = 0; i < 100; i++)
{
    list.Add(i);
    if (list.Capacity != capacity)
    {
        capacity = list.Capacity;
        Console.WriteLine($"Grew to {capacity} after adding item {i + 1}");
    }
}
```

If you know the final size, skip the copying entirely:

```csharp
var list = new List<int>(1000);   // one allocation, no resizes
```

## A table to keep

```text
Algorithm          Best         Average      Worst
Linear search      O(1)         O(n)         O(n)
Binary search      O(1)         O(log n)     O(log n)
Bubble sort        O(n)*        O(n^2)       O(n^2)
Insertion sort     O(n)         O(n^2)       O(n^2)
Merge sort         O(n log n)   O(n log n)   O(n log n)
Quick sort         O(n log n)   O(n log n)   O(n^2)
Heap sort          O(n log n)   O(n log n)   O(n log n)
Hash lookup        O(1)         O(1)         O(n)
```

The star on bubble sort is only true with the early exit optimisation on an already sorted array.

Notice merge sort and heap sort have no bad case at all. That predictability is why merge sort is used where a guarantee matters more than raw average speed.

## Choosing with this in mind

- If a slow response is merely annoying, optimise for the average.
- If a slow response breaks something, or the input can be chosen by a stranger, plan for the worst case.
- Insertion sort has a terrible worst case but a great best case, so it is genuinely the fastest choice on tiny or nearly sorted arrays.
- Merge sort costs more memory and buys you a guarantee.

## Quick recap

- Best, average and worst describe the same algorithm on different inputs.
- Worst case is the default because it is the only promise you can rely on.
- Quick sort is `O(n log n)` on average and `O(n^2)` on already sorted data with a naive pivot.
- Hash lookups are `O(1)` on average and `O(n)` if everything collides.
- Amortised means one expensive step spread over many cheap ones, like `List.Add`.
- Preallocating a list with its final size removes the resizing work entirely.
- Merge sort and heap sort have no worst case surprise.

<code id="code-content" class="language-csharp">
// One algorithm, three different answers depending on the input
static int Search(int[] numbers, int target)
{
    int comparisons = 0;
    for (int i = 0; i &lt; numbers.Length; i++)
    {
        comparisons++;
        if (numbers[i] == target)
        {
            Console.WriteLine($"Found after {comparisons}");
            return i;
        }
    }
    Console.WriteLine($"Not found after {comparisons}");
    return -1;
}
var data = Enumerable.Range(1, 1000).ToArray();
Search(data, 1);       // 1     best case
Search(data, 500);     // 500   average case
Search(data, 9999);    // 1000  worst case
// Quick sort: O(n log n) normally, O(n^2) on sorted input with a last element pivot
static void QuickSort(int[] a, int low, int high)
{
    if (low &gt;= high) return;
    int pivot = a[high], boundary = low;
    for (int i = low; i &lt; high; i++)
        if (a[i] &lt; pivot) { (a[i], a[boundary]) = (a[boundary], a[i]); boundary++; }
    (a[boundary], a[high]) = (a[high], a[boundary]);
    QuickSort(a, low, boundary - 1);
    QuickSort(a, boundary + 1, high);
}
// Amortised is not average: one rare expensive step spread over many cheap ones
var list = new List&lt;int&gt;();
int capacity = list.Capacity;
for (int i = 0; i &lt; 100; i++)
{
    list.Add(i);                      // O(1) usually, O(n) when it doubles
    if (list.Capacity != capacity)
    {
        capacity = list.Capacity;
        Console.WriteLine($"Grew to {capacity} after item {i + 1}");
    }
}
// Know the final size? Preallocate and skip every resize.
var sized = new List&lt;int&gt;(1000);
</code></pre>
