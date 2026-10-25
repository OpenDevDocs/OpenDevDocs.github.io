---
publishDate: 2026-07-16T13:40
title: Insertion Sort
slug: insertion-sort
metadescription: Sort the way you sort playing cards in your hand, and see why this simple algorithm is the one real sorting libraries fall back on.
updateDate: 2026-09-07T13:40
author: ['bishal-biswas']
level: 1
tags: ['sorting', 'algorithms', 'beginner']
course: dsa
---

## How you sort cards

Pick up cards one at a time. For each new card, slide it left past every card bigger than it until it lands in the right spot.

That is insertion sort, and it is the only simple sort that people actually perform naturally.

```csharp
static void InsertionSort(int[] a)
{
    for (int i = 1; i < a.Length; i++)
    {
        int current = a[i];      // the card being placed
        int j = i - 1;

        while (j >= 0 && a[j] > current)
        {
            a[j + 1] = a[j];     // shift right to make room
            j--;
        }

        a[j + 1] = current;      // drop it in
    }
}

int[] numbers = { 5, 2, 9, 1, 7 };
InsertionSort(numbers);
Console.WriteLine(string.Join(", ", numbers));   // 1, 2, 5, 7, 9
```

Start at index 1, not 0, because a single item is already sorted.

Notice it **shifts**, it does not swap. One value is held aside, everything larger moves right one place, and then it drops in. That is roughly a third of the memory writes swapping would need.

## Watching it

```csharp
static void InsertionSortVerbose(int[] a)
{
    for (int i = 1; i < a.Length; i++)
    {
        int current = a[i];
        int j = i - 1;

        while (j >= 0 && a[j] > current)
        {
            a[j + 1] = a[j];
            j--;
        }

        a[j + 1] = current;
        Console.WriteLine($"Placed {current}: {string.Join(", ", a)}");
    }
}

InsertionSortVerbose(new[] { 5, 2, 9, 1, 7 });
```

Output:

```text
Placed 2: 2, 5, 9, 1, 7
Placed 9: 2, 5, 9, 1, 7
Placed 1: 1, 2, 5, 9, 7
Placed 7: 1, 2, 5, 7, 9
```

The left side is always sorted. Each pass grows it by one.

## Why the best case is genuinely useful

On sorted data, `a[j] > current` is false immediately every time, so the inner loop never runs.

```text
Best case     O(n)      already sorted
Average case  O(n^2)
Worst case    O(n^2)    sorted backwards
Space         O(1)      in place
Stable        yes
```

Bubble sort also gets `O(n)` on sorted input, but insertion sort is better across the whole range of nearly sorted inputs, not just perfectly sorted ones.

The precise statement: insertion sort runs in `O(n + d)` where `d` is the number of inversions, meaning pairs that are out of order. If each item is at most `k` positions from where it belongs, it is `O(n * k)`.

That is why it shines on data that is almost in order, which is extremely common in practice. Log entries arriving slightly out of sequence, a sorted list with a few new items appended, sensor readings with occasional jitter.

```csharp
var nearlySorted = Enumerable.Range(1, 10_000).ToArray();
nearlySorted[500] = 9_999;      // one item badly out of place

InsertionSort(nearlySorted);    // still very fast
```

## Stability

Insertion sort is stable, and the reason is the strict `>` in the loop condition.

```csharp
while (j >= 0 && a[j] > current)   // stable, stops at an equal value
while (j >= 0 && a[j] >= current)  // not stable, shifts past equal values
```

With `>`, an item stops as soon as it meets an equal one, so it stays behind it. That preserves the original relative order.

## The real reason it matters

Insertion sort is not a curiosity. It is inside the sorting library you actually use.

Every serious implementation of quick sort or merge sort switches to insertion sort once the pieces get small, typically under 16 items.

```csharp
static void HybridSort(int[] a, int low, int high)
{
    if (high - low < 16)
    {
        InsertionSortRange(a, low, high);
        return;
    }

    int mid = low + (high - low) / 2;
    HybridSort(a, low, mid);
    HybridSort(a, mid + 1, high);
    Merge(a, low, mid, high);
}

static void InsertionSortRange(int[] a, int low, int high)
{
    for (int i = low + 1; i <= high; i++)
    {
        int current = a[i];
        int j = i - 1;

        while (j >= low && a[j] > current)
        {
            a[j + 1] = a[j];
            j--;
        }

        a[j + 1] = current;
    }
}
```

Why does an `O(n^2)` algorithm win on small arrays? Because Big O hides constants, and on 10 items the constants are all that is left. Insertion sort has almost no overhead: no recursion, no allocation, no partitioning, and it reads memory in a straight line.

.NET's `Array.Sort` uses introsort, which is quick sort, plus heap sort when recursion gets too deep, plus insertion sort for small partitions. Java, Python and C++ all do something similar.

## Binary insertion sort

The position could be found with a binary search instead of a linear scan.

```csharp
static void BinaryInsertionSort(int[] a)
{
    for (int i = 1; i < a.Length; i++)
    {
        int current = a[i];
        int position = Array.BinarySearch(a, 0, i, current);

        if (position < 0) position = ~position;   // the insertion point

        for (int j = i; j > position; j--) a[j] = a[j - 1];

        a[position] = current;
    }
}
```

Comparisons drop from `O(n)` to `O(log n)` per item. But the shifting is still `O(n)`, so the total is still `O(n^2)`.

Worth it only when comparing is expensive, such as sorting long strings or objects with a costly comparison. For integers the binary search overhead makes it slower.

`Array.BinarySearch` returning a negative number is the standard .NET convention. `~position` converts it to where the item should be inserted.

## Sorting a linked list

Insertion sort is one of the few sorts that works naturally on a linked list, because inserting is `O(1)` once you have found the spot.

```csharp
static Node<int>? InsertionSortList(Node<int>? head)
{
    var sentinel = new Node<int>(0);

    while (head != null)
    {
        var next = head.Next;

        var current = sentinel;
        while (current.Next != null && current.Next.Value < head.Value)
        {
            current = current.Next;
        }

        head.Next = current.Next;    // splice the node in
        current.Next = head;

        head = next;
    }

    return sentinel.Next;
}
```

The sentinel node removes the "inserting at the front" special case, exactly as it did when reversing part of a list.

## Insertion, bubble or selection?

```text
                 Bubble       Selection    Insertion
Best case        O(n)         O(n^2)       O(n)
Average          O(n^2)       O(n^2)       O(n^2)
Writes           many         O(n)         moderate
Stable           yes          no           yes
Nearly sorted    good         no benefit   excellent
Used in real     no           no           yes
libraries
```

Insertion sort wins on almost every measure that matters. If you learn one `O(n^2)` sort properly, make it this one.

## Quick recap

- Insertion sort places each item into the already sorted region to its left.
- It shifts rather than swaps, which is about a third of the writes.
- Best case is `O(n)`, and nearly sorted data stays close to that.
- It is stable, thanks to the strict `>` in the loop.
- Real sorting libraries switch to it for partitions under about 16 items.
- Binary insertion sort cuts comparisons but not shifts, so it is still `O(n^2)`.
- It is the natural sort for linked lists, where insertion is `O(1)`.

<code id="code-content" class="language-csharp">
// Sort the way you sort cards: slide each item left into place
static void InsertionSort(int[] a)
{
    for (int i = 1; i &lt; a.Length; i++)     // index 0 is already "sorted"
    {
        int current = a[i];                // the card in your hand
        int j = i - 1;
        while (j &gt;= 0 &amp;&amp; a[j] &gt; current)   // &gt; keeps it stable
        {
            a[j + 1] = a[j];               // SHIFT, do not swap
            j--;
        }
        a[j + 1] = current;                // drop it in
    }
}
int[] numbers = { 5, 2, 9, 1, 7 };
InsertionSort(numbers);
Console.WriteLine(string.Join(", ", numbers));     // 1, 2, 5, 7, 9
// On sorted data the inner loop never runs at all: O(n)
var nearlySorted = Enumerable.Range(1, 10_000).ToArray();
nearlySorted[500] = 9_999;                         // one item out of place
InsertionSort(nearlySorted);                       // still very fast
// This is why real libraries use it: below ~16 items the constants decide
static void HybridSort(int[] a, int low, int high)
{
    if (high - low &lt; 16) { InsertionRange(a, low, high); return; }
    int mid = low + (high - low) / 2;
    HybridSort(a, low, mid);
    HybridSort(a, mid + 1, high);
    // merge left and right here
}
static void InsertionRange(int[] a, int low, int high)
{
    for (int i = low + 1; i &lt;= high; i++)
    {
        int current = a[i];
        int j = i - 1;
        while (j &gt;= low &amp;&amp; a[j] &gt; current) { a[j + 1] = a[j]; j--; }
        a[j + 1] = current;
    }
}
// Binary insertion: fewer comparisons, same shifting, so still O(n^2).
// Worth it only when comparing is expensive.
static void BinaryInsertionSort(int[] a)
{
    for (int i = 1; i &lt; a.Length; i++)
    {
        int current = a[i];
        int pos = Array.BinarySearch(a, 0, i, current);
        if (pos &lt; 0) pos = ~pos;                   // .NET insertion point convention
        for (int j = i; j &gt; pos; j--) a[j] = a[j - 1];
        a[pos] = current;
    }
}
</code></pre>
