---
publishDate: 2026-07-14T13:00
title: Divide and Conquer
slug: divide-and-conquer
metadescription: Split a problem in half, solve both halves, combine the answers, and understand why that pattern turns linear work into logarithmic depth.
updateDate: 2026-09-07T13:00
author: ['bishal-biswas']
level: 2
tags: ['recursion', 'divide and conquer', 'algorithms']
course: dsa
---

## Three steps

Divide and conquer is a recursion pattern with a fixed shape.

1. **Divide.** Split the problem into smaller pieces of the same kind.
2. **Conquer.** Solve each piece, usually by recursing.
3. **Combine.** Put the answers together.

Merge sort, quick sort, binary search and many others are all this shape. Recognising it means you already understand half of each algorithm before you read it.

## The simplest example

Find the maximum in an array. The loop version is obvious, but writing it this way shows the pattern with nothing else in the way.

```csharp
static int Max(int[] numbers, int low, int high)
{
    if (low == high) return numbers[low];            // one item, done

    int mid = low + (high - low) / 2;

    int leftMax = Max(numbers, low, mid);            // conquer the left
    int rightMax = Max(numbers, mid + 1, high);      // conquer the right

    return Math.Max(leftMax, rightMax);              // combine
}

int[] numbers = { 3, 7, 1, 9, 4 };
Console.WriteLine(Max(numbers, 0, numbers.Length - 1));   // 9
```

Note `low + (high - low) / 2` rather than `(low + high) / 2`. For very large indexes the second version can overflow. The habit is worth forming.

## Why the halving matters

Splitting in half means the depth of the recursion is `log n`, not `n`.

```text
n = 1,000,000
depth = 20

n = 1,000,000,000
depth = 30
```

Each level does `O(n)` work in total, spread across all the pieces. `log n` levels times `O(n)` per level gives `O(n log n)`, which is where sorting's famous bound comes from.

## Merge sort

The clearest divide and conquer algorithm. Splitting is trivial and all the intelligence is in the combine step.

```csharp
static void MergeSort(int[] a, int low, int high)
{
    if (low >= high) return;                 // 0 or 1 items, already sorted

    int mid = low + (high - low) / 2;

    MergeSort(a, low, mid);
    MergeSort(a, mid + 1, high);
    Merge(a, low, mid, high);
}

static void Merge(int[] a, int low, int mid, int high)
{
    var merged = new int[high - low + 1];
    int i = low, j = mid + 1, k = 0;

    while (i <= mid && j <= high)
    {
        merged[k++] = a[i] <= a[j] ? a[i++] : a[j++];
    }

    while (i <= mid) merged[k++] = a[i++];
    while (j <= high) merged[k++] = a[j++];

    Array.Copy(merged, 0, a, low, merged.Length);
}

int[] data = { 5, 2, 9, 1, 7, 3 };
MergeSort(data, 0, data.Length - 1);
Console.WriteLine(string.Join(", ", data));   // 1, 2, 3, 5, 7, 9
```

Splitting takes no thought at all, and merging two sorted halves is `O(n)`. Total `O(n log n)`, always.

## Quick sort

The mirror image. Partitioning does the intelligent work, and combining is free.

```csharp
static void QuickSort(int[] a, int low, int high)
{
    if (low >= high) return;

    int pivotIndex = Partition(a, low, high);

    QuickSort(a, low, pivotIndex - 1);
    QuickSort(a, pivotIndex + 1, high);
    // nothing to combine, the pivot is already in its final place
}

static int Partition(int[] a, int low, int high)
{
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
    return boundary;
}
```

Merge sort and quick sort are the same pattern with the effort moved to opposite ends. That is a genuinely useful way to remember both.

## Binary search

Divide and conquer where you discard one half instead of solving it.

```csharp
static int BinarySearch(int[] sorted, int target, int low, int high)
{
    if (low > high) return -1;

    int mid = low + (high - low) / 2;

    if (sorted[mid] == target) return mid;

    return sorted[mid] < target
        ? BinarySearch(sorted, target, mid + 1, high)
        : BinarySearch(sorted, target, low, mid - 1);
}
```

Because only one half is explored, the total work is `O(log n)` rather than `O(n log n)`.

## Counting inversions

A problem with no obvious efficient solution until you see it as a merge.

An inversion is a pair where a larger value appears before a smaller one. Counting them measures how far from sorted an array is. The direct approach checks every pair, which is `O(n^2)`.

The merge sort version is `O(n log n)`, because the merge step can count them almost for free.

```csharp
static long CountInversions(int[] a, int low, int high)
{
    if (low >= high) return 0;

    int mid = low + (high - low) / 2;

    long count = CountInversions(a, low, mid)
               + CountInversions(a, mid + 1, high);

    // merge, counting as we go
    var merged = new int[high - low + 1];
    int i = low, j = mid + 1, k = 0;

    while (i <= mid && j <= high)
    {
        if (a[i] <= a[j])
        {
            merged[k++] = a[i++];
        }
        else
        {
            count += mid - i + 1;      // a[i..mid] are all greater than a[j]
            merged[k++] = a[j++];
        }
    }

    while (i <= mid) merged[k++] = a[i++];
    while (j <= high) merged[k++] = a[j++];

    Array.Copy(merged, 0, a, low, merged.Length);
    return count;
}

int[] values = { 2, 4, 1, 3, 5 };
Console.WriteLine(CountInversions(values, 0, values.Length - 1));   // 3
```

The line `count += mid - i + 1` is the whole idea. When a value from the right half is smaller than `a[i]`, it is smaller than everything remaining in the left half too, because that half is sorted. So one comparison counts many inversions at once.

## Fast exponentiation

Divide and conquer on a number rather than an array.

```csharp
static long Power(long baseValue, int exponent)
{
    if (exponent == 0) return 1;

    long half = Power(baseValue, exponent / 2);

    return exponent % 2 == 0 ? half * half : half * half * baseValue;
}

Console.WriteLine(Power(2, 10));   // 1024
```

The naive loop multiplies `n` times. This halves the exponent each step, so it takes `O(log n)` multiplications. Computing `2^1000` takes about 10 steps instead of 1,000.

Calling `Power` once and squaring the result is essential. Writing `Power(b, e/2) * Power(b, e/2)` recomputes the same thing twice and destroys the benefit, turning it straight back into `O(n)`.

## The master theorem, informally

Divide and conquer running times follow a pattern based on how many pieces you make and how much combining costs.

```text
Split into 2, solve both, combine in O(n)     ->  O(n log n)   merge sort
Split into 2, solve one, combine in O(1)      ->  O(log n)     binary search
Split into 2, solve both, combine in O(1)     ->  O(n)         tree traversal
Split into 2, solve both, combine in O(n^2)   ->  O(n^2)       combine dominates
```

The rule of thumb: if the combine step costs `O(n)` and you solve both halves, you get `O(n log n)`. If combining is free, you get `O(n)`. If you only need one half, you get `O(log n)`.

## When it is worth it

Divide and conquer helps when splitting genuinely reduces the work. It does not help when every piece still needs to see all the data.

Watch the cost of splitting and combining. A "clever" version that allocates new arrays at every level can easily be slower than a straightforward loop.

It also parallelises well, since the pieces are independent:

```csharp
Parallel.Invoke(
    () => MergeSort(a, low, mid),
    () => MergeSort(a, mid + 1, high));
```

Only worth doing above a size threshold, because the overhead of starting tasks exceeds the benefit on small pieces.

## Quick recap

- Divide, conquer, combine. Almost every efficient recursive algorithm fits this.
- Halving gives `log n` depth, which is where `O(n log n)` comes from.
- Merge sort splits trivially and combines cleverly, quick sort does the reverse.
- Binary search discards a half instead of solving it, so it is `O(log n)`.
- Counting inversions rides along with the merge step for free.
- Compute a recursive result once and reuse it, never call twice with the same input.
- Use `low + (high - low) / 2` to avoid overflow.

<code id="code-content" class="language-csharp">
// The shape: divide, conquer both halves, combine
static int Max(int[] a, int low, int high)
{
    if (low == high) return a[low];                    // base case
    int mid = low + (high - low) / 2;                  // avoids overflow
    return Math.Max(Max(a, low, mid), Max(a, mid + 1, high));
}
Console.WriteLine(Max(new[] { 3, 7, 1, 9, 4 }, 0, 4));   // 9
// Merge sort: splitting is trivial, combining is clever. Always O(n log n).
static void MergeSort(int[] a, int low, int high)
{
    if (low &gt;= high) return;
    int mid = low + (high - low) / 2;
    MergeSort(a, low, mid);
    MergeSort(a, mid + 1, high);
    var merged = new int[high - low + 1];
    int i = low, j = mid + 1, k = 0;
    while (i &lt;= mid &amp;&amp; j &lt;= high) merged[k++] = a[i] &lt;= a[j] ? a[i++] : a[j++];
    while (i &lt;= mid) merged[k++] = a[i++];
    while (j &lt;= high) merged[k++] = a[j++];
    Array.Copy(merged, 0, a, low, merged.Length);
}
int[] data = { 5, 2, 9, 1, 7, 3 };
MergeSort(data, 0, data.Length - 1);
Console.WriteLine(string.Join(",", data));         // 1,2,3,5,7,9
// Binary search: discard a half rather than solving it, so O(log n)
static int BinarySearch(int[] sorted, int target, int low, int high)
{
    if (low &gt; high) return -1;
    int mid = low + (high - low) / 2;
    if (sorted[mid] == target) return mid;
    return sorted[mid] &lt; target
        ? BinarySearch(sorted, target, mid + 1, high)
        : BinarySearch(sorted, target, low, mid - 1);
}
Console.WriteLine(BinarySearch(data, 7, 0, data.Length - 1));   // 4
// Fast exponentiation: halve the exponent, O(log n) multiplications
static long Power(long b, int e)
{
    if (e == 0) return 1;
    long half = Power(b, e / 2);            // call ONCE and reuse
    return e % 2 == 0 ? half * half : half * half * b;
}
Console.WriteLine(Power(2, 10));            // 1024
// Writing Power(b, e/2) * Power(b, e/2) recomputes it and destroys the benefit
</code></pre>
