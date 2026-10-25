---
publishDate: 2026-07-15T13:30
title: Selection Sort
slug: selection-sort
metadescription: Repeatedly select the smallest remaining item, and learn why this sort minimises writes but never gets faster on sorted data.
updateDate: 2026-09-07T13:30
author: ['bishal-biswas']
level: 1
tags: ['sorting', 'algorithms', 'beginner']
course: dsa
---

## Pick the smallest, put it in front

Selection sort splits the array into a sorted part at the front and an unsorted part behind it. Each pass finds the smallest item in the unsorted part and swaps it into place.

```csharp
static void SelectionSort(int[] a)
{
    for (int position = 0; position < a.Length - 1; position++)
    {
        int smallest = position;

        for (int i = position + 1; i < a.Length; i++)
        {
            if (a[i] < a[smallest]) smallest = i;
        }

        if (smallest != position)
        {
            (a[position], a[smallest]) = (a[smallest], a[position]);
        }
    }
}

int[] numbers = { 64, 25, 12, 22, 11 };
SelectionSort(numbers);
Console.WriteLine(string.Join(", ", numbers));   // 11, 12, 22, 25, 64
```

The inner loop only tracks an **index**, not the value. That is what keeps swapping to one operation per pass.

## Watching it

```csharp
static void SelectionSortVerbose(int[] a)
{
    for (int position = 0; position < a.Length - 1; position++)
    {
        int smallest = position;

        for (int i = position + 1; i < a.Length; i++)
        {
            if (a[i] < a[smallest]) smallest = i;
        }

        (a[position], a[smallest]) = (a[smallest], a[position]);

        Console.WriteLine($"Pass {position + 1}: {string.Join(", ", a)}");
    }
}

SelectionSortVerbose(new[] { 64, 25, 12, 22, 11 });
```

Output:

```text
Pass 1: 11, 25, 12, 22, 64
Pass 2: 11, 12, 25, 22, 64
Pass 3: 11, 12, 22, 25, 64
Pass 4: 11, 12, 22, 25, 64
```

Exactly one swap per pass, and the sorted region grows from the left.

## The defining property: few writes

This is what makes selection sort worth knowing.

```text
Algorithm        Comparisons     Swaps
Bubble sort      O(n^2)          O(n^2)
Insertion sort   O(n^2)          O(n^2) shifts
Selection sort   O(n^2)          O(n)
```

Selection sort does at most `n - 1` swaps, no matter how scrambled the input is. Every other simple sort does up to `n^2 / 2` moves.

That matters when writing is far more expensive than reading. Writing to flash memory or EEPROM wears it out physically, and each cell has a limited number of write cycles. Selection sort minimises exactly that cost.

For sorting in normal memory, the comparisons dominate and this advantage does not show up.

## The complexity

```text
Best case     O(n^2)    even on sorted input
Average case  O(n^2)
Worst case    O(n^2)
Space         O(1)      sorts in place
Stable        no        the swap can jump equal items over each other
```

Notice the best case. Bubble sort and insertion sort both finish in `O(n)` on already sorted data. Selection sort does not, because it must scan the entire remaining array to prove which item is smallest. There is no early exit to add.

Fully predictable, and never fast.

## Why it is not stable

The swap moves an item across the array, possibly jumping it past an equal item.

```text
[4a, 4b, 1]

Pass 1: smallest is 1 at index 2, swap with index 0
[1, 4b, 4a]      4a and 4b have changed places
```

Two equal values, original order reversed. That is instability.

A stable version exists if you shift instead of swap, but shifting reintroduces `O(n^2)` writes and throws away the only advantage.

```csharp
static void SelectionSortStable(int[] a)
{
    for (int position = 0; position < a.Length - 1; position++)
    {
        int smallest = position;

        for (int i = position + 1; i < a.Length; i++)
        {
            if (a[i] < a[smallest]) smallest = i;
        }

        int value = a[smallest];

        while (smallest > position)          // shift everything right
        {
            a[smallest] = a[smallest - 1];
            smallest--;
        }

        a[position] = value;
    }
}
```

## Both ends at once

Find the smallest and the largest in the same pass and place both.

```csharp
static void DoubleSelectionSort(int[] a)
{
    int low = 0, high = a.Length - 1;

    while (low < high)
    {
        int smallest = low, largest = low;

        for (int i = low; i <= high; i++)
        {
            if (a[i] < a[smallest]) smallest = i;
            if (a[i] > a[largest]) largest = i;
        }

        (a[low], a[smallest]) = (a[smallest], a[low]);

        // the largest may have just been moved by that swap
        if (largest == low) largest = smallest;

        (a[high], a[largest]) = (a[largest], a[high]);

        low++;
        high--;
    }
}
```

The `if (largest == low)` line is the subtle bit. If the largest value was sitting at `low`, the first swap moved it to `smallest`, so the recorded index is stale. Forgetting this produces a sort that is wrong only on certain inputs, which is the worst kind of bug.

Halves the number of passes. Still `O(n^2)`.

## Selection sort and heap sort

There is a real connection worth knowing.

Selection sort's cost is entirely in "find the smallest remaining item", which takes `O(n)` by scanning.

A heap answers that question in `O(log n)`. Swap the linear scan for a heap and you get **heap sort**, which is `O(n log n)`.

```text
Selection sort:  n passes  x  O(n) to find the minimum      =  O(n^2)
Heap sort:       n passes  x  O(log n) to find the minimum  =  O(n log n)
```

Same algorithm, better data structure. That is the recurring lesson of this whole course, and heap sort has its own topic later.

## When to use it

Almost never in production, but it is the right choice in one narrow case: when writes are genuinely expensive and the array is small.

Learn it because:

- The "select the best remaining" idea appears everywhere.
- It is the clearest demonstration that swapping the data structure changes the complexity.
- It shows that best, average and worst case can all be identical.

For real work, `Array.Sort`.

## Quick recap

- Selection sort finds the smallest remaining item and swaps it into place.
- Track the index during the scan, then do one swap per pass.
- It performs `O(n)` swaps, fewer than any other simple sort.
- It is `O(n^2)` in every case, including already sorted input.
- The long distance swap makes it unstable.
- Selecting from both ends halves the passes, and needs a stale index fix.
- Replacing the linear scan with a heap turns it into `O(n log n)` heap sort.

<code id="code-content" class="language-csharp">
// Find the smallest remaining item, swap it into place. One swap per pass.
static void SelectionSort(int[] a)
{
    for (int position = 0; position &lt; a.Length - 1; position++)
    {
        int smallest = position;
        for (int i = position + 1; i &lt; a.Length; i++)
            if (a[i] &lt; a[smallest]) smallest = i;      // track the INDEX only
        if (smallest != position)
            (a[position], a[smallest]) = (a[smallest], a[position]);
    }
}
int[] numbers = { 64, 25, 12, 22, 11 };
SelectionSort(numbers);
Console.WriteLine(string.Join(", ", numbers));         // 11, 12, 22, 25, 64
// Watch the sorted region grow from the left, one swap at a time
static void Verbose(int[] a)
{
    for (int p = 0; p &lt; a.Length - 1; p++)
    {
        int smallest = p;
        for (int i = p + 1; i &lt; a.Length; i++) if (a[i] &lt; a[smallest]) smallest = i;
        (a[p], a[smallest]) = (a[smallest], a[p]);
        Console.WriteLine($"pass {p + 1}: {string.Join(",", a)}");
    }
}
Verbose(new[] { 64, 25, 12, 22, 11 });
// Its one real advantage: O(n) swaps, whatever the input looks like.
// Matters when writing is expensive (flash memory wears out), not in RAM.
// No early exit is possible: it must scan to prove which item is smallest.
// So best, average and worst are all O(n^2).
// Not stable: a long distance swap can jump one equal value past another
// [4a, 4b, 1]  -&gt;  swap index 0 and 2  -&gt;  [1, 4b, 4a]
// Both ends at once: halves the passes, but watch the stale index
static void DoubleSelection(int[] a)
{
    int low = 0, high = a.Length - 1;
    while (low &lt; high)
    {
        int smallest = low, largest = low;
        for (int i = low; i &lt;= high; i++)
        {
            if (a[i] &lt; a[smallest]) smallest = i;
            if (a[i] &gt; a[largest]) largest = i;
        }
        (a[low], a[smallest]) = (a[smallest], a[low]);
        if (largest == low) largest = smallest;        // the first swap moved it
        (a[high], a[largest]) = (a[largest], a[high]);
        low++; high--;
    }
}
// Replace the O(n) scan with an O(log n) heap and you get heap sort: O(n log n)
</code></pre>
