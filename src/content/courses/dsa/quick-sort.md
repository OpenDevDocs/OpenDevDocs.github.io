---
publishDate: 2026-07-16T14:00
title: Quick Sort
slug: quick-sort
metadescription: Partition around a pivot, sort both sides, and understand why the pivot choice decides between O(n log n) and O(n squared).
updateDate: 2026-09-07T14:00
author: ['bishal-biswas']
level: 2
tags: ['sorting', 'divide and conquer', 'algorithms']
course: dsa
---

## Partition, then recurse

Quick sort picks one element as the **pivot**, rearranges the array so everything smaller is on the left and everything larger is on the right, then sorts each side.

After partitioning, the pivot is in its final position. That is the key insight, and it is why there is no combine step.

```csharp
static void QuickSort(int[] a) => Sort(a, 0, a.Length - 1);

static void Sort(int[] a, int low, int high)
{
    if (low >= high) return;

    int pivotIndex = Partition(a, low, high);

    Sort(a, low, pivotIndex - 1);
    Sort(a, pivotIndex + 1, high);
    // nothing to combine, the pivot is already correct
}

static int Partition(int[] a, int low, int high)
{
    int pivot = a[high];       // use the last element
    int boundary = low;        // everything before this is smaller than the pivot

    for (int i = low; i < high; i++)
    {
        if (a[i] < pivot)
        {
            (a[i], a[boundary]) = (a[boundary], a[i]);
            boundary++;
        }
    }

    (a[boundary], a[high]) = (a[high], a[boundary]);   // pivot into place
    return boundary;
}

int[] numbers = { 10, 80, 30, 90, 40, 50, 70 };
QuickSort(numbers);
Console.WriteLine(string.Join(", ", numbers));   // 10, 30, 40, 50, 70, 80, 90
```

## How partitioning works

`boundary` marks the divide between "confirmed smaller than the pivot" and "not yet decided". Every time a smaller value is found, it is swapped to the boundary and the boundary moves right.

```text
pivot = 70, array = [10, 80, 30, 90, 40, 50, | 70]

i=0  10 < 70   swap with position 0   [10, 80, 30, 90, 40, 50]  boundary=1
i=1  80 > 70   leave it                                          boundary=1
i=2  30 < 70   swap with position 1   [10, 30, 80, 90, 40, 50]  boundary=2
i=3  90 > 70   leave it                                          boundary=2
i=4  40 < 70   swap with position 2   [10, 30, 40, 90, 80, 50]  boundary=3
i=5  50 < 70   swap with position 3   [10, 30, 40, 50, 80, 90]  boundary=4

finally swap the pivot into position 4:  [10, 30, 40, 50, 70, 90, 80]
```

70 is now in its final place. Everything left of it is smaller, everything right is larger.

## The pivot problem

The version above always picks the last element, and that has a nasty failure mode.

On an **already sorted array**, the last element is the largest. So one partition gets everything and the other gets nothing. That gives `n` levels of recursion instead of `log n`, which is `O(n^2)` and likely a stack overflow.

```csharp
var sorted = Enumerable.Range(1, 50_000).ToArray();
QuickSort(sorted);      // O(n^2), and may crash
```

The most innocent looking input is the worst case. That is why pivot selection is not a detail.

## Fixing it: random pivot

```csharp
static readonly Random random = new();

static int PartitionRandom(int[] a, int low, int high)
{
    int choice = random.Next(low, high + 1);
    (a[choice], a[high]) = (a[high], a[choice]);   // swap it to the end, then proceed

    return Partition(a, low, high);
}
```

One extra swap and the worst case becomes astronomically unlikely. No input can be crafted to trigger it, since the attacker cannot predict the random choice.

## Fixing it: median of three

Take the first, middle and last elements and use the middle value of those three.

```csharp
static int MedianOfThree(int[] a, int low, int high)
{
    int mid = low + (high - low) / 2;

    if (a[low] > a[mid]) (a[low], a[mid]) = (a[mid], a[low]);
    if (a[low] > a[high]) (a[low], a[high]) = (a[high], a[low]);
    if (a[mid] > a[high]) (a[mid], a[high]) = (a[high], a[mid]);

    (a[mid], a[high]) = (a[high], a[mid]);   // put the median at the end
    return Partition(a, low, high);
}
```

Deterministic, cheap, and it handles sorted and reverse sorted input perfectly, which are the two cases that occur in practice. This is what most library implementations use.

## Duplicates and three way partitioning

An array of mostly equal values is another weak spot. Standard partitioning puts every equal value on one side, so the split is badly uneven.

Three way partitioning groups them into a middle section that needs no further sorting.

```csharp
static void QuickSort3Way(int[] a, int low, int high)
{
    if (low >= high) return;

    int pivot = a[low];
    int lessThan = low, i = low, greaterThan = high;

    while (i <= greaterThan)
    {
        if (a[i] < pivot)
        {
            (a[lessThan], a[i]) = (a[i], a[lessThan]);
            lessThan++;
            i++;
        }
        else if (a[i] > pivot)
        {
            (a[i], a[greaterThan]) = (a[greaterThan], a[i]);
            greaterThan--;      // do not advance i, the swapped in value is unchecked
        }
        else
        {
            i++;
        }
    }

    QuickSort3Way(a, low, lessThan - 1);
    QuickSort3Way(a, greaterThan + 1, high);
}

int[] many = { 3, 1, 3, 3, 2, 3, 1, 3 };
QuickSort3Way(many, 0, many.Length - 1);
Console.WriteLine(string.Join(", ", many));   // 1, 1, 2, 3, 3, 3, 3, 3
```

This is the Dutch national flag partition from the two pointer topic. On an array of all identical values it becomes `O(n)`.

## The complexity

```text
Best case     O(n log n)   pivot always near the middle
Average case  O(n log n)   with a sensible pivot
Worst case    O(n^2)       pivot always the smallest or largest
Space         O(log n)     recursion only, no buffer
Stable        no
```

Quick sort is usually **faster than merge sort in practice** despite the same average complexity, for two reasons. It sorts in place, so no buffer and no copying. And partitioning reads memory in a straight line, which the processor cache rewards.

## Limiting the recursion depth

Always recurse into the smaller side and loop on the larger one. That caps stack depth at `O(log n)` even if the partitioning goes badly.

```csharp
static void QuickSortSafe(int[] a, int low, int high)
{
    while (low < high)
    {
        int p = MedianOfThree(a, low, high);

        if (p - low < high - p)
        {
            QuickSortSafe(a, low, p - 1);   // recurse into the smaller side
            low = p + 1;                    // loop on the larger side
        }
        else
        {
            QuickSortSafe(a, p + 1, high);
            high = p - 1;
        }
    }
}
```

## What .NET actually does

`Array.Sort` uses **introsort**, a hybrid:

- Quick sort with a median of three pivot for the bulk of the work.
- Switch to **insertion sort** for partitions under 16 elements.
- Switch to **heap sort** if recursion goes deeper than `2 * log n`, which guarantees `O(n log n)` in the worst case.

Best of all three. The heap sort fallback removes the `O(n^2)` risk entirely, which is why `Array.Sort` is safe on any input.

```csharp
Array.Sort(numbers);                              // introsort, not stable
var stable = numbers.OrderBy(n => n).ToArray();   // stable, allocates
```

## Quickselect

Partitioning also finds the Kth smallest element without sorting everything. Only recurse into the side that contains the answer.

```csharp
static int QuickSelect(int[] a, int k)
{
    int low = 0, high = a.Length - 1;

    while (low <= high)
    {
        int p = PartitionRandom(a, low, high);

        if (p == k) return a[p];

        if (p < k) low = p + 1;
        else high = p - 1;
    }

    throw new ArgumentOutOfRangeException(nameof(k));
}

int[] values = { 7, 10, 4, 3, 20, 15 };
Console.WriteLine(QuickSelect(values, 2));   // 7, the third smallest
```

`O(n)` on average, because the work halves each step: `n + n/2 + n/4 + ...` sums to `2n`.

## Quick recap

- Partition around a pivot, then sort each side. The pivot lands in its final place.
- Always picking the last element makes sorted input the worst case.
- A random pivot or median of three fixes that, cheaply.
- Three way partitioning handles many duplicates efficiently.
- Average `O(n log n)`, worst `O(n^2)`, `O(log n)` space, not stable.
- It usually beats merge sort in practice because it sorts in place.
- `Array.Sort` uses introsort, which adds a heap sort fallback to remove the worst case.

<code id="code-content" class="language-csharp">
// Partition around a pivot, then sort each side. No combine step needed.
static void Sort(int[] a, int low, int high)
{
    if (low &gt;= high) return;
    int p = Partition(a, low, high);
    Sort(a, low, p - 1);
    Sort(a, p + 1, high);       // the pivot is already in its final place
}
static int Partition(int[] a, int low, int high)
{
    int pivot = a[high], boundary = low;
    for (int i = low; i &lt; high; i++)
        if (a[i] &lt; pivot) { (a[i], a[boundary]) = (a[boundary], a[i]); boundary++; }
    (a[boundary], a[high]) = (a[high], a[boundary]);
    return boundary;
}
int[] numbers = { 10, 80, 30, 90, 40, 50, 70 };
Sort(numbers, 0, numbers.Length - 1);
Console.WriteLine(string.Join(", ", numbers));   // 10,30,40,50,70,80,90
// Always taking the last element makes SORTED input the worst case: O(n^2).
// Median of three fixes the cases that actually happen.
static int MedianOfThree(int[] a, int low, int high)
{
    int mid = low + (high - low) / 2;
    if (a[low] &gt; a[mid]) (a[low], a[mid]) = (a[mid], a[low]);
    if (a[low] &gt; a[high]) (a[low], a[high]) = (a[high], a[low]);
    if (a[mid] &gt; a[high]) (a[mid], a[high]) = (a[high], a[mid]);
    (a[mid], a[high]) = (a[high], a[mid]);
    return Partition(a, low, high);
}
// Three way partitioning: many duplicates become O(n) instead of lopsided
static void QuickSort3Way(int[] a, int low, int high)
{
    if (low &gt;= high) return;
    int pivot = a[low], lt = low, i = low, gt = high;
    while (i &lt;= gt)
    {
        if (a[i] &lt; pivot) { (a[lt], a[i]) = (a[i], a[lt]); lt++; i++; }
        else if (a[i] &gt; pivot) { (a[i], a[gt]) = (a[gt], a[i]); gt--; }  // i stays
        else i++;
    }
    QuickSort3Way(a, low, lt - 1);
    QuickSort3Way(a, gt + 1, high);
}
int[] many = { 3, 1, 3, 3, 2, 3, 1, 3 };
QuickSort3Way(many, 0, many.Length - 1);
Console.WriteLine(string.Join(",", many));       // 1,1,2,3,3,3,3,3
// Quickselect: the Kth smallest without sorting everything, O(n) average
static int QuickSelect(int[] a, int k)
{
    int low = 0, high = a.Length - 1;
    while (low &lt;= high)
    {
        int p = MedianOfThree(a, low, high);
        if (p == k) return a[p];
        if (p &lt; k) low = p + 1; else high = p - 1;   // only recurse into one side
    }
    throw new ArgumentOutOfRangeException(nameof(k));
}
Console.WriteLine(QuickSelect(new[] { 7, 10, 4, 3, 20, 15 }, 2));   // 7
</code></pre>
