---
publishDate: 2026-07-23T16:30
title: Heaps Explained
slug: heaps-explained
metadescription: Build a binary heap on a plain array, understand sift up and sift down, and get the minimum or maximum in constant time.
updateDate: 2026-09-07T16:30
author: ['bishal-biswas']
level: 2
tags: ['heaps', 'priority queue', 'data structures']
course: dsa
---

## The question a heap answers

"What is the smallest item right now?" asked repeatedly, while items keep being added and removed.

A sorted list answers it instantly but costs `O(n)` per insert. An unsorted list inserts instantly but costs `O(n)` per lookup.

A **heap** does both in `O(log n)`, by keeping the data only partly ordered. Just ordered enough.

## The heap property

A **min heap** is a binary tree where **every parent is smaller than or equal to its children**.

```text
            1
          /   \
        3       6
       / \     / \
      5   9   8   7
```

That is the only rule. Note what it does **not** say: siblings are unordered, and 5 sits at depth 2 while 7 sits at depth 2 as well with no relationship between them.

This looseness is the point. Full sorting is expensive. This weaker rule is cheap to maintain and still puts the minimum at the root.

A **max heap** flips the comparison so the largest is at the root.

## No pointers needed

A heap is always a **complete** binary tree, meaning every level is full except the last, which fills from the left.

Complete trees fit perfectly into an array.

```text
index:  0   1   2   3   4   5   6
value:  1   3   6   5   9   8   7
```

```csharp
static int Parent(int i) => (i - 1) / 2;
static int LeftChild(int i) => 2 * i + 1;
static int RightChild(int i) => 2 * i + 2;
```

No node objects, no references, and everything sits contiguously in memory. That is a large part of why heaps are fast in practice, not just in theory.

## Sift up: adding an item

Put the new item at the end, then move it up while it is smaller than its parent.

```csharp
public class MinHeap
{
    private readonly List<int> items = new();

    public int Count => items.Count;

    public void Add(int value)
    {
        items.Add(value);          // append at the end
        SiftUp(items.Count - 1);
    }

    private void SiftUp(int index)
    {
        while (index > 0)
        {
            int parent = (index - 1) / 2;

            if (items[parent] <= items[index]) break;   // heap property restored

            (items[parent], items[index]) = (items[index], items[parent]);
            index = parent;
        }
    }
}
```

The new item travels at most the height of the tree, which is `log n`. So `Add` is `O(log n)`.

```text
Add 2 to [1, 3, 6, 5, 9, 8, 7]

append:   [1, 3, 6, 5, 9, 8, 7, 2]     2 is at index 7
parent of 7 is 3, holding 5.  2 < 5, swap.
          [1, 3, 6, 2, 9, 8, 7, 5]     2 is at index 3
parent of 3 is 1, holding 3.  2 < 3, swap.
          [1, 2, 6, 3, 9, 8, 7, 5]     2 is at index 1
parent of 1 is 0, holding 1.  2 > 1, stop.
```

## Sift down: removing the minimum

The root is the answer. Removing it leaves a hole, so move the **last** item into the root and sink it back down.

```csharp
public int RemoveMin()
{
    if (items.Count == 0) throw new InvalidOperationException("The heap is empty");

    int min = items[0];

    items[0] = items[^1];              // last item to the root
    items.RemoveAt(items.Count - 1);

    if (items.Count > 0) SiftDown(0);

    return min;
}

private void SiftDown(int index)
{
    while (true)
    {
        int left = 2 * index + 1;
        int right = 2 * index + 2;
        int smallest = index;

        if (left < items.Count && items[left] < items[smallest]) smallest = left;
        if (right < items.Count && items[right] < items[smallest]) smallest = right;

        if (smallest == index) break;      // both children are larger, done

        (items[index], items[smallest]) = (items[smallest], items[index]);
        index = smallest;
    }
}

public int Peek() => items.Count > 0
    ? items[0]
    : throw new InvalidOperationException("The heap is empty");
```

Swapping with the **smallest** child is essential. Swapping with the larger one would leave that child smaller than its new parent, breaking the rule.

`Peek` is `O(1)`, because the answer is always at index 0.

```csharp
var heap = new MinHeap();
foreach (int value in new[] { 5, 3, 8, 1, 9, 2 }) heap.Add(value);

Console.WriteLine(heap.Peek());        // 1
Console.WriteLine(heap.RemoveMin());   // 1
Console.WriteLine(heap.RemoveMin());   // 2
Console.WriteLine(heap.RemoveMin());   // 3
```

## Building a heap from an array

The obvious way adds items one at a time, which is `O(n log n)`.

There is a better way. Sift down every non leaf node, starting from the last one and working backwards.

```csharp
public static void Heapify(List<int> items)
{
    for (int i = items.Count / 2 - 1; i >= 0; i--)
    {
        SiftDown(items, i);
    }
}
```

This is `O(n)`, not `O(n log n)`.

Why? Because most nodes are near the bottom and barely move. Half the nodes are leaves and do not move at all. A quarter move at most one level. An eighth move at most two. The total sums to less than `2n`.

Starting at `Count / 2 - 1` skips every leaf, since leaves are already valid heaps of one element.

## What a heap does not do

**No searching.** Finding an arbitrary value means scanning the whole array, `O(n)`. A heap only knows about its extreme.

**No sorted iteration.** Walking the array gives you a jumble. The only ordered access is repeatedly removing the root.

**No maximum, in a min heap.** The largest value is somewhere among the leaves and finding it costs `O(n)`. Needing both ends means two heaps, or a different structure.

```text
Operation           Heap        Sorted array     Unsorted array
Find minimum        O(1)        O(1)             O(n)
Remove minimum      O(log n)    O(n)             O(n)
Insert              O(log n)    O(n)             O(1)
Find arbitrary      O(n)        O(log n)         O(n)
Build from n items  O(n)        O(n log n)       O(n)
```

The heap column is the only one with no `O(n)` in the first three rows. That combination is exactly what a priority queue needs.

## A max heap

Flip every comparison, or negate the values in a min heap.

```csharp
public class MaxHeap
{
    private readonly List<int> items = new();

    public void Add(int value)
    {
        items.Add(value);
        int index = items.Count - 1;

        while (index > 0)
        {
            int parent = (index - 1) / 2;

            if (items[parent] >= items[index]) break;    // the only change

            (items[parent], items[index]) = (items[index], items[parent]);
            index = parent;
        }
    }
}
```

Or generically, with a comparer:

```csharp
public class Heap<T>
{
    private readonly List<T> items = new();
    private readonly IComparer<T> comparer;

    public Heap(IComparer<T>? comparer = null) =>
        this.comparer = comparer ?? Comparer<T>.Default;

    // pass Comparer<int>.Create((a, b) => b.CompareTo(a)) for a max heap
}
```

## Where heaps show up

**Priority queues.** Task schedulers, event simulations, print queues.

**Dijkstra's algorithm.** Always process the nearest unvisited node next.

**Heap sort.** Heapify, then remove the root `n` times. `O(n log n)` with `O(1)` extra space.

**Top K problems.** Keep a heap of size `k` and you never sort the whole dataset.

**Median maintenance.** A max heap for the lower half and a min heap for the upper half gives the running median in `O(log n)` per value.

**Merging K sorted lists.** A heap of the current front of each list.

## Quick recap

- A heap keeps every parent smaller than its children, and nothing more.
- That weak rule is cheap to maintain and still gives `O(1)` access to the minimum.
- A heap is a complete tree, so it lives in a plain array with no pointers.
- Adding appends then sifts up, removing swaps in the last item then sifts down.
- Always swap with the smaller child when sifting down.
- Heapifying an existing array is `O(n)`, not `O(n log n)`.
- A heap cannot search, cannot iterate in order, and only knows about one end.

<code id="code-content" class="language-csharp">
// A complete tree lives in a plain array. No pointers at all.
static int Parent(int i) =&gt; (i - 1) / 2;
static int Left(int i) =&gt; 2 * i + 1;
static int Right(int i) =&gt; 2 * i + 2;
var items = new List&lt;int&gt;();
// Add: append at the end, then sift UP while smaller than the parent
void Add(int value)
{
    items.Add(value);
    int index = items.Count - 1;
    while (index &gt; 0)
    {
        int parent = (index - 1) / 2;
        if (items[parent] &lt;= items[index]) break;      // property restored
        (items[parent], items[index]) = (items[index], items[parent]);
        index = parent;
    }
}
// RemoveMin: the root is the answer. Move the LAST item up, then sift DOWN.
int RemoveMin()
{
    int min = items[0];
    items[0] = items[^1];
    items.RemoveAt(items.Count - 1);
    int index = 0;
    while (true)
    {
        int left = 2 * index + 1, right = 2 * index + 2, smallest = index;
        if (left &lt; items.Count &amp;&amp; items[left] &lt; items[smallest]) smallest = left;
        if (right &lt; items.Count &amp;&amp; items[right] &lt; items[smallest]) smallest = right;
        if (smallest == index) break;
        // swap with the SMALLER child, or the property breaks again
        (items[index], items[smallest]) = (items[smallest], items[index]);
        index = smallest;
    }
    return min;
}
foreach (int v in new[] { 5, 3, 8, 1, 9, 2 }) Add(v);
Console.WriteLine(items[0]);          // 1, Peek is O(1)
Console.WriteLine(RemoveMin());       // 1
Console.WriteLine(RemoveMin());       // 2
Console.WriteLine(RemoveMin());       // 3
// Building from an existing array is O(n), not O(n log n).
// Start at Count/2 - 1: everything after that is a leaf and already valid.
// A heap CANNOT search, CANNOT iterate in order, and only knows about one end.
// Finding an arbitrary value, or the maximum of a min heap, is O(n).
// Max heap: flip one comparison
// if (items[parent] &gt;= items[index]) break;
</code></pre>
