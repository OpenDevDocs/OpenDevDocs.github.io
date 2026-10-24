---
publishDate: 2026-07-16T13:50
title: Merge Sort
slug: merge-sort
metadescription: Split, sort both halves, then merge them back together for guaranteed O(n log n) sorting that is stable and works on linked lists.
updateDate: 2026-09-07T13:50
author: ['bishal-biswas']
level: 2
tags: ['sorting', 'divide and conquer', 'algorithms']
course: dsa
---

## Split, sort, merge

Merge sort splits the array in half, sorts each half recursively, then merges the two sorted halves back into one.

Splitting is trivial. All the intelligence lives in the merge.

```csharp
static void MergeSort(int[] a)
{
    if (a.Length <= 1) return;

    var buffer = new int[a.Length];      // allocate once, reuse everywhere
    Sort(a, buffer, 0, a.Length - 1);
}

static void Sort(int[] a, int[] buffer, int low, int high)
{
    if (low >= high) return;             // 0 or 1 items

    int mid = low + (high - low) / 2;

    Sort(a, buffer, low, mid);
    Sort(a, buffer, mid + 1, high);
    Merge(a, buffer, low, mid, high);
}

static void Merge(int[] a, int[] buffer, int low, int mid, int high)
{
    int i = low, j = mid + 1, k = low;

    while (i <= mid && j <= high)
    {
        buffer[k++] = a[i] <= a[j] ? a[i++] : a[j++];   // <= keeps it stable
    }

    while (i <= mid) buffer[k++] = a[i++];
    while (j <= high) buffer[k++] = a[j++];

    Array.Copy(buffer, low, a, low, high - low + 1);
}

int[] numbers = { 38, 27, 43, 3, 9, 82, 10 };
MergeSort(numbers);
Console.WriteLine(string.Join(", ", numbers));   // 3, 9, 10, 27, 38, 43, 82
```

Allocating the buffer once rather than inside `Merge` matters. Allocating per merge means `n` allocations, and the garbage collector notices.

## The merge step

This is the part worth understanding properly. Two sorted arrays, one pointer each. Repeatedly take the smaller front item.

```text
left:   3  27  38  43
right:  9  10  82

compare 3 and 9   -> take 3    result: 3
compare 27 and 9  -> take 9    result: 3 9
compare 27 and 10 -> take 10   result: 3 9 10
compare 27 and 82 -> take 27   result: 3 9 10 27
compare 38 and 82 -> take 38   result: 3 9 10 27 38
compare 43 and 82 -> take 43   result: 3 9 10 27 38 43
left is empty, copy the rest   result: 3 9 10 27 38 43 82
```

Each comparison places exactly one item, so merging `n` items is `O(n)`.

The two tail loops are not optional. When one side runs out, the other still has items that must be copied.

## Why it is always O(n log n)

The array halves each level, so there are `log n` levels. Every level merges `n` items in total.

```text
level 0:  [38 27 43 3 9 82 10]              merges n items
level 1:  [38 27 43 3] [9 82 10]            merges n items
level 2:  [38 27] [43 3] [9 82] [10]        merges n items
level 3:  [38] [27] [43] [3] [9] [82] [10]

log n levels  x  O(n) per level  =  O(n log n)
```

Nothing about the input changes this. Sorted, reversed or random, merge sort does the same work. That predictability is its main selling point over quick sort.

## The cost: memory

Merge sort needs `O(n)` extra space for the buffer. Quick sort and heap sort do not.

For a million integers that is 4 MB of extra memory. Usually fine. For very large datasets or memory constrained devices, it can be the deciding factor.

In place merge sort variants exist, but they are complicated and slower in practice. The buffer is the honest trade.

## Stability

Merge sort is stable, and the reason is a single character.

```csharp
buffer[k++] = a[i] <= a[j] ? a[i++] : a[j++];   // stable
buffer[k++] = a[i] <  a[j] ? a[i++] : a[j++];   // not stable
```

With `<=`, a tie takes from the **left** half, which held the earlier items. With `<`, ties take from the right, and equal items swap places.

This is why `OrderBy` in LINQ, which is stable, and `Array.Sort`, which is not, behave differently on ties. Stability matters when sorting by several fields in sequence.

## Bottom up merge sort

The same algorithm with no recursion. Merge pairs of size 1, then pairs of size 2, then 4, and so on.

```csharp
static void MergeSortBottomUp(int[] a)
{
    var buffer = new int[a.Length];

    for (int width = 1; width < a.Length; width *= 2)
    {
        for (int low = 0; low < a.Length - width; low += 2 * width)
        {
            int mid = low + width - 1;
            int high = Math.Min(low + 2 * width - 1, a.Length - 1);

            Merge(a, buffer, low, mid, high);
        }
    }
}
```

No call stack, so no depth limit. Slightly harder to read, and the same complexity.

The `Math.Min` handles the last chunk when the array length is not a power of two.

## Sorting a linked list

Merge sort is the **best** sort for linked lists, which is unusual and worth knowing.

Quick sort needs random access to partition well. Merge sort does not. And merging linked lists needs no extra memory at all, just relinking, so the `O(n)` space cost disappears.

```csharp
static Node<int>? MergeSortList(Node<int>? head)
{
    if (head?.Next == null) return head;

    // split with fast and slow pointers
    Node<int>? slow = head, fast = head.Next;

    while (fast?.Next != null)
    {
        slow = slow!.Next;
        fast = fast.Next.Next;
    }

    var right = slow!.Next;
    slow.Next = null;                    // cut the list in two

    return MergeLists(MergeSortList(head), MergeSortList(right));
}

static Node<int>? MergeLists(Node<int>? a, Node<int>? b)
{
    var sentinel = new Node<int>(0);
    var tail = sentinel;

    while (a != null && b != null)
    {
        if (a.Value <= b.Value) { tail.Next = a; a = a.Next; }
        else { tail.Next = b; b = b.Next; }

        tail = tail.Next;
    }

    tail.Next = a ?? b;                  // attach whatever is left
    return sentinel.Next;
}
```

`slow.Next = null` is essential. Without it the two halves stay joined and the recursion never terminates.

`tail.Next = a ?? b` replaces both tail loops, since a linked list tail is already a complete list.

Time is `O(n log n)`, space is `O(log n)` for the recursion only.

## Merging K sorted lists

A practical variation. Merging `k` lists one at a time is `O(n * k)`. Merging them in pairs is `O(n log k)`.

```csharp
static int[] MergeAll(List<int[]> lists)
{
    if (lists.Count == 0) return Array.Empty<int>();

    while (lists.Count > 1)
    {
        var merged = new List<int[]>();

        for (int i = 0; i < lists.Count; i += 2)
        {
            merged.Add(i + 1 < lists.Count ? MergeTwo(lists[i], lists[i + 1]) : lists[i]);
        }

        lists = merged;
    }

    return lists[0];
}

static int[] MergeTwo(int[] a, int[] b)
{
    var result = new int[a.Length + b.Length];
    int i = 0, j = 0, k = 0;

    while (i < a.Length && j < b.Length) result[k++] = a[i] <= b[j] ? a[i++] : b[j++];
    while (i < a.Length) result[k++] = a[i++];
    while (j < b.Length) result[k++] = b[j++];

    return result;
}
```

A priority queue does the same job in one pass, covered in the heaps topic.

## External sorting

Merge sort is how you sort data too large to fit in memory. Read chunks that do fit, sort each one, write it to disk, then merge the sorted files by streaming them.

Only the merge front needs to be in memory, and merging reads sequentially, which is exactly what disks are good at. This is how databases sort tables larger than available RAM.

## Quick recap

- Split in half, sort both halves, merge them back.
- The merge takes the smaller front item repeatedly, so it is `O(n)`.
- Always `O(n log n)`, regardless of the input.
- Needs `O(n)` extra memory, which is its main drawback.
- Use `<=` in the merge comparison to keep it stable.
- Allocate the buffer once, not inside every merge.
- It is the best sort for linked lists, and the basis of sorting data larger than memory.

<code id="code-content" class="language-csharp">
// Split, sort both halves, merge. Always O(n log n).
static void MergeSort(int[] a)
{
    var buffer = new int[a.Length];      // allocate ONCE, not per merge
    Sort(a, buffer, 0, a.Length - 1);
}
static void Sort(int[] a, int[] buffer, int low, int high)
{
    if (low &gt;= high) return;
    int mid = low + (high - low) / 2;
    Sort(a, buffer, low, mid);
    Sort(a, buffer, mid + 1, high);
    Merge(a, buffer, low, mid, high);
}
static void Merge(int[] a, int[] buffer, int low, int mid, int high)
{
    int i = low, j = mid + 1, k = low;
    while (i &lt;= mid &amp;&amp; j &lt;= high)
        buffer[k++] = a[i] &lt;= a[j] ? a[i++] : a[j++];   // &lt;= keeps it stable
    while (i &lt;= mid) buffer[k++] = a[i++];              // tails are not optional
    while (j &lt;= high) buffer[k++] = a[j++];
    Array.Copy(buffer, low, a, low, high - low + 1);
}
int[] numbers = { 38, 27, 43, 3, 9, 82, 10 };
MergeSort(numbers);
Console.WriteLine(string.Join(", ", numbers));   // 3, 9, 10, 27, 38, 43, 82
// Bottom up: same algorithm, no recursion, no depth limit
static void MergeSortBottomUp(int[] a)
{
    var buffer = new int[a.Length];
    for (int width = 1; width &lt; a.Length; width *= 2)
        for (int low = 0; low &lt; a.Length - width; low += 2 * width)
            Merge(a, buffer, low, low + width - 1,
                  Math.Min(low + 2 * width - 1, a.Length - 1));
}
// Merge sort is the BEST sort for linked lists: no random access needed,
// and merging is just relinking, so the O(n) space cost disappears.
public class Node&lt;T&gt; { public T Value; public Node&lt;T&gt;? Next; public Node(T v) =&gt; Value = v; }
static Node&lt;int&gt;? MergeSortList(Node&lt;int&gt;? head)
{
    if (head?.Next == null) return head;
    Node&lt;int&gt;? slow = head, fast = head.Next;        // split with fast and slow
    while (fast?.Next != null) { slow = slow!.Next; fast = fast.Next.Next; }
    var right = slow!.Next;
    slow.Next = null;                                 // essential, or it never ends
    return MergeLists(MergeSortList(head), MergeSortList(right));
}
static Node&lt;int&gt;? MergeLists(Node&lt;int&gt;? a, Node&lt;int&gt;? b)
{
    var sentinel = new Node&lt;int&gt;(0);
    var tail = sentinel;
    while (a != null &amp;&amp; b != null)
    {
        if (a.Value &lt;= b.Value) { tail.Next = a; a = a.Next; }
        else { tail.Next = b; b = b.Next; }
        tail = tail.Next;
    }
    tail.Next = a ?? b;                               // attach whatever is left
    return sentinel.Next;
}
</code></pre>
