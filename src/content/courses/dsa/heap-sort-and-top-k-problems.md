---
publishDate: 2026-07-24T16:50
title: Heap Sort and Top K Problems
slug: heap-sort-and-top-k-problems
metadescription: Sort in place with a heap, and learn the top K pattern that avoids sorting the whole dataset for a handful of results.
updateDate: 2026-09-07T16:50
author: ['bishal-biswas']
level: 3
tags: ['heaps', 'sorting', 'top k']
course: dsa
---

## Heap sort

Selection sort's cost is entirely in "find the smallest remaining item", which it does by scanning, `O(n)`.

A heap answers that in `O(log n)`. Swap the scan for a heap and selection sort becomes `O(n log n)`.

The clever part is doing it **in place**, with no extra memory at all.

```csharp
static void HeapSort(int[] a)
{
    // 1. turn the array into a max heap, O(n)
    for (int i = a.Length / 2 - 1; i >= 0; i--) SiftDown(a, i, a.Length);

    // 2. repeatedly move the largest to the end
    for (int end = a.Length - 1; end > 0; end--)
    {
        (a[0], a[end]) = (a[end], a[0]);    // the maximum goes to its final place
        SiftDown(a, 0, end);                // fix the shrunken heap
    }
}

static void SiftDown(int[] a, int index, int size)
{
    while (true)
    {
        int left = 2 * index + 1;
        int right = 2 * index + 2;
        int largest = index;

        if (left < size && a[left] > a[largest]) largest = left;
        if (right < size && a[right] > a[largest]) largest = right;

        if (largest == index) break;

        (a[index], a[largest]) = (a[largest], a[index]);
        index = largest;
    }
}

int[] numbers = { 5, 2, 9, 1, 7, 3 };
HeapSort(numbers);
Console.WriteLine(string.Join(", ", numbers));   // 1, 2, 3, 5, 7, 9
```

A **max** heap is used, not a min heap. Removing the maximum puts it at the end of the array, and repeating fills the array from the right in ascending order.

The `size` parameter shrinks each pass, which is what keeps the sorted tail untouched.

## The comparison

```text
                 Heap sort     Quick sort      Merge sort
Best             O(n log n)    O(n log n)      O(n log n)
Average          O(n log n)    O(n log n)      O(n log n)
Worst            O(n log n)    O(n^2)          O(n log n)
Space            O(1)          O(log n)        O(n)
Stable           no            no              yes
Speed in practice slowest      fastest         middle
```

Heap sort is the only one with a guaranteed `O(n log n)` **and** `O(1)` space. On paper it dominates.

In practice it is the slowest of the three, because sifting jumps around the array. Index 0 to index 1 to index 3 to index 7 defeats the processor cache, while quick sort's partition scans straight through memory.

Its real role is as a **safety net**. .NET's `Array.Sort` uses introsort, which runs quick sort but switches to heap sort if recursion goes too deep. That converts quick sort's `O(n^2)` worst case into a guarantee, at no cost in the normal case.

## Top K, the pattern that matters

Far more useful day to day. You have a million records and you want the ten largest.

The obvious approach sorts everything, `O(n log n)`, then takes ten.

The heap approach keeps only `k` items, giving `O(n log k)` and `O(k)` memory.

```csharp
static List<int> TopK(IEnumerable<int> numbers, int k)
{
    var smallest = new PriorityQueue<int, int>();      // a MIN heap

    foreach (int n in numbers)
    {
        smallest.Enqueue(n, n);

        if (smallest.Count > k) smallest.Dequeue();    // drop the smallest
    }

    var result = new List<int>();
    while (smallest.Count > 0) result.Add(smallest.Dequeue());

    result.Reverse();
    return result;
}

var data = new[] { 3, 1, 5, 12, 2, 11, 7, 9 };
Console.WriteLine(string.Join(", ", TopK(data, 3)));   // 12, 11, 9
```

The counter intuitive part: **to find the largest K, use a min heap.**

The heap holds the best `k` seen so far, and its root is the **weakest** of those. Each new value is compared with that weakest one, and if the heap grows past `k`, the weakest is dropped.

Using a max heap would put the strongest at the root, which is the one item you never want to remove.

## Why it wins

```text
n = 1,000,000, k = 10

Sort everything:  1,000,000 * log2(1,000,000)  =  about 20,000,000 operations
                  plus memory for the whole dataset

Heap of size k:   1,000,000 * log2(10)         =  about 3,300,000 operations
                  plus memory for 10 items
```

Six times less work and a hundred thousand times less memory.

The memory point is often the decisive one. Top K with a heap works on a **stream**. You never need the whole dataset in memory at once, which means it works on a file larger than RAM or on data arriving over a network.

```csharp
static List<string> TopLinesByLength(string path, int k)
{
    var heap = new PriorityQueue<string, int>();

    foreach (string line in File.ReadLines(path))      // streamed, never fully loaded
    {
        heap.Enqueue(line, line.Length);
        if (heap.Count > k) heap.Dequeue();
    }

    var result = heap.UnorderedItems.Select(x => x.Element).ToList();
    result.Sort((a, b) => b.Length.CompareTo(a.Length));
    return result;
}
```

## Top K with objects

```csharp
record Product(string Name, decimal Revenue);

static List<Product> TopSellers(IEnumerable<Product> products, int k)
{
    var heap = new PriorityQueue<Product, decimal>();

    foreach (var product in products)
    {
        heap.Enqueue(product, product.Revenue);
        if (heap.Count > k) heap.Dequeue();
    }

    return heap.UnorderedItems
               .Select(x => x.Element)
               .OrderByDescending(p => p.Revenue)
               .ToList();
}
```

`UnorderedItems` reads the heap without draining it, which is convenient. As the name warns, the order is meaningless, so sort it if the output order matters.

## Top K frequent

Combining a dictionary with a heap.

```csharp
static List<string> TopKFrequent(IEnumerable<string> words, int k)
{
    var counts = new Dictionary<string, int>();

    foreach (string word in words) counts[word] = counts.GetValueOrDefault(word) + 1;

    var heap = new PriorityQueue<string, int>();

    foreach (var (word, count) in counts)
    {
        heap.Enqueue(word, count);
        if (heap.Count > k) heap.Dequeue();
    }

    var result = heap.UnorderedItems
                     .OrderByDescending(x => x.Priority)
                     .Select(x => x.Element)
                     .ToList();

    return result;
}

var words = new[] { "a", "b", "a", "c", "b", "a", "d" };
Console.WriteLine(string.Join(", ", TopKFrequent(words, 2)));   // a, b
```

Counting is `O(n)`, the heap pass is `O(m log k)` where `m` is the number of distinct words.

## K closest points

Same shape, different measure. Here you want the **smallest** distances, so the comparison flips and you need a max heap.

```csharp
record Point(double X, double Y);

static List<Point> KClosest(IEnumerable<Point> points, int k)
{
    var heap = new PriorityQueue<Point, double>(
        Comparer<double>.Create((a, b) => b.CompareTo(a)));   // max heap

    foreach (var point in points)
    {
        double distanceSquared = point.X * point.X + point.Y * point.Y;

        heap.Enqueue(point, distanceSquared);

        if (heap.Count > k) heap.Dequeue();      // drop the furthest
    }

    return heap.UnorderedItems.Select(x => x.Element).ToList();
}
```

Comparing squared distances avoids the square root entirely. It does not change the ordering, and it is faster.

The rule is easy to remember: **the heap's root should always be the item you are most willing to throw away.**

## The Kth element only

If you want just the Kth value and can rearrange the data, quickselect beats the heap.

```csharp
Console.WriteLine(TopK(data, 5).Last());   // O(n log k) using a heap
// quickselect does the same in O(n) average, but modifies the array
```

Use quickselect for one query on an in memory array. Use a heap for streaming data, or when you want all K values and not just the boundary one.

## Quick recap

- Heap sort builds a max heap, then repeatedly swaps the root to the end.
- It is the only sort that is both guaranteed `O(n log n)` and `O(1)` space.
- It is slow in practice because sifting jumps around memory, so it serves as introsort's safety net.
- For the largest K items, keep a **min** heap of size K, so the weakest is always at the root.
- Top K is `O(n log k)` and only ever holds K items, so it works on streams.
- Flip to a max heap when you want the smallest K.
- Use quickselect when you need only the Kth value from an in memory array.

<code id="code-content" class="language-csharp">
// Heap sort: build a MAX heap, then swap the root to the end, repeatedly
static void HeapSort(int[] a)
{
    for (int i = a.Length / 2 - 1; i &gt;= 0; i--) SiftDown(a, i, a.Length);   // O(n)
    for (int end = a.Length - 1; end &gt; 0; end--)
    {
        (a[0], a[end]) = (a[end], a[0]);     // maximum goes to its final place
        SiftDown(a, 0, end);                 // shrinking size protects the sorted tail
    }
}
static void SiftDown(int[] a, int index, int size)
{
    while (true)
    {
        int left = 2 * index + 1, right = 2 * index + 2, largest = index;
        if (left &lt; size &amp;&amp; a[left] &gt; a[largest]) largest = left;
        if (right &lt; size &amp;&amp; a[right] &gt; a[largest]) largest = right;
        if (largest == index) break;
        (a[index], a[largest]) = (a[largest], a[index]);
        index = largest;
    }
}
int[] numbers = { 5, 2, 9, 1, 7, 3 };
HeapSort(numbers);
Console.WriteLine(string.Join(", ", numbers));    // 1,2,3,5,7,9
// Guaranteed O(n log n) AND O(1) space, but slow in practice: sifting
// jumps around memory. It is introsort's safety net, not its main sort.
// TOP K: to find the LARGEST k, use a MIN heap. The root is the weakest
// item you hold, which is exactly the one you want to throw away.
static List&lt;int&gt; TopK(IEnumerable&lt;int&gt; numbers, int k)
{
    var heap = new PriorityQueue&lt;int, int&gt;();
    foreach (int n in numbers)
    {
        heap.Enqueue(n, n);
        if (heap.Count &gt; k) heap.Dequeue();       // drop the smallest so far
    }
    var result = new List&lt;int&gt;();
    while (heap.Count &gt; 0) result.Add(heap.Dequeue());
    result.Reverse();
    return result;
}
Console.WriteLine(string.Join(",", TopK(new[] { 3, 1, 5, 12, 2, 11, 7, 9 }, 3)));  // 12,11,9
// O(n log k) and only k items in memory, so it works on a STREAM
// n = 1,000,000, k = 10:  3.3 million operations, not 20 million
// Want the SMALLEST k? Flip to a max heap so the furthest is at the root.
record Point(double X, double Y);
var closest = new PriorityQueue&lt;Point, double&gt;(
    Comparer&lt;double&gt;.Create((a, b) =&gt; b.CompareTo(a)));
foreach (var p in new[] { new Point(1, 1), new Point(5, 5), new Point(2, 2) })
{
    closest.Enqueue(p, p.X * p.X + p.Y * p.Y);    // squared, no square root needed
    if (closest.Count &gt; 2) closest.Dequeue();
}
Console.WriteLine(closest.Count);                 // 2
// UnorderedItems reads the heap without draining it. The order is meaningless.
</code></pre>
