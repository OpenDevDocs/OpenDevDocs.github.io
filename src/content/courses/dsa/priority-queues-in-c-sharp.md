---
publishDate: 2026-07-24T16:40
title: Priority Queues in C Sharp
slug: priority-queues-in-c-sharp
metadescription: Use the built in PriorityQueue in .NET, handle ties and custom priorities, and know the one operation it deliberately leaves out.
updateDate: 2026-09-07T16:40
author: ['bishal-biswas']
level: 2
tags: ['heaps', 'priority queue', 'collections']
course: dsa
---

## The built in one

.NET has `PriorityQueue<TElement, TPriority>`, built on a heap. Lower priority values come out first.

```csharp
var queue = new PriorityQueue<string, int>();

queue.Enqueue("write report", 3);
queue.Enqueue("fix production bug", 1);
queue.Enqueue("reply to email", 2);

while (queue.Count > 0)
{
    Console.WriteLine(queue.Dequeue());
}
// fix production bug
// reply to email
// write report
```

The element and the priority are **separate**. That is the design decision worth understanding: you never have to make your type comparable, and the priority can be anything.

## The operations

```csharp
var queue = new PriorityQueue<string, int>();

queue.Enqueue("task", 5);                       // O(log n)
string next = queue.Dequeue();                  // O(log n), the lowest priority
string look = queue.Peek();                     // O(1)
int count = queue.Count;                        // O(1)

if (queue.TryDequeue(out string? item, out int priority))
{
    Console.WriteLine($"{item} at priority {priority}");
}

if (queue.TryPeek(out string? head, out int headPriority))
{
    Console.WriteLine($"Next is {head}");
}

queue.Clear();
```

`TryDequeue` and `TryPeek` give you the priority as well, which the plain versions do not.

## Bulk loading

Adding many items at once is faster than enqueuing them one at a time, because it heapifies in `O(n)` rather than doing `n` sift ups.

```csharp
var items = new List<(string, int)>
{
    ("low", 10),
    ("urgent", 1),
    ("normal", 5)
};

var queue = new PriorityQueue<string, int>(items);

Console.WriteLine(queue.Dequeue());   // urgent
```

`EnqueueRange` adds many to an existing queue:

```csharp
queue.EnqueueRange(new[] { ("a", 4), ("b", 2) });
queue.EnqueueRange(new[] { "x", "y", "z" }, 7);   // all at the same priority
```

## Highest priority first

The default is lowest first. For the opposite, either negate the priority or pass a reversed comparer.

```csharp
// Negate: simple, works for numbers
var byHighest = new PriorityQueue<string, int>();
byHighest.Enqueue("low", -1);
byHighest.Enqueue("high", -10);

Console.WriteLine(byHighest.Dequeue());   // high
```

```csharp
// Reversed comparer: clearer, and works for any type
var reversed = new PriorityQueue<string, int>(
    Comparer<int>.Create((a, b) => b.CompareTo(a)));

reversed.Enqueue("low", 1);
reversed.Enqueue("high", 10);

Console.WriteLine(reversed.Dequeue());    // high
```

The comparer version is safer. Negating breaks on `int.MinValue`, whose negation overflows.

## Ties are not stable

Two items with the same priority come out in an unspecified order. A heap makes no promise about equal elements.

```csharp
var queue = new PriorityQueue<string, int>();
queue.Enqueue("first", 1);
queue.Enqueue("second", 1);
queue.Enqueue("third", 1);

// The order out is not guaranteed to be first, second, third
```

If insertion order must break ties, put a sequence number in the priority.

```csharp
var stable = new PriorityQueue<string, (int Priority, long Sequence)>();
long sequence = 0;

void Add(string item, int priority) => stable.Enqueue(item, (priority, sequence++));

Add("first", 1);
Add("second", 1);
Add("third", 1);

while (stable.Count > 0) Console.WriteLine(stable.Dequeue());
// first, second, third
```

Tuples compare field by field, so the sequence number only matters when the priorities tie. This is the standard fix and it costs almost nothing.

## Custom priority types

Any type works with a comparer.

```csharp
record Job(string Name, int Severity, DateTime Raised);

var jobs = new PriorityQueue<Job, Job>(Comparer<Job>.Create((a, b) =>
{
    int bySeverity = a.Severity.CompareTo(b.Severity);
    return bySeverity != 0 ? bySeverity : a.Raised.CompareTo(b.Raised);
}));

jobs.Enqueue(new Job("disk full", 1, DateTime.Now), null!);
```

Using the element as its own priority is common, though it does mean storing it twice. Passing a small key is usually tidier:

```csharp
var byKey = new PriorityQueue<Job, (int Severity, DateTime Raised)>();

void Add(Job job) => byKey.Enqueue(job, (job.Severity, job.Raised));
```

## What it deliberately does not do

**There is no way to change an item's priority.** No `UpdatePriority`, no `Remove`. A heap cannot find an arbitrary item without scanning, so the API leaves it out.

This matters for Dijkstra's algorithm, which classically wants to decrease a node's distance. Two standard workarounds:

**Lazy deletion.** Enqueue the item again with the new priority and ignore stale copies when they come out.

```csharp
var queue = new PriorityQueue<string, int>();
var bestKnown = new Dictionary<string, int>();

void Improve(string node, int distance)
{
    if (bestKnown.TryGetValue(node, out int current) && current <= distance) return;

    bestKnown[node] = distance;
    queue.Enqueue(node, distance);      // an older, worse entry may still be in there
}

while (queue.TryDequeue(out string? node, out int distance))
{
    if (distance > bestKnown[node]) continue;    // stale copy, skip it

    // process node
}
```

The queue can hold more entries than there are items, but each is popped in `O(log n)` and skipped instantly. This is what almost everyone does.

**A separate index.** Maintain a dictionary from item to heap position and write your own sift methods. Faster in theory, and rarely worth the complexity.

## Practical examples

**A task scheduler:**

```csharp
record Task(string Name, DateTime RunAt);

var scheduled = new PriorityQueue<Task, DateTime>();

scheduled.Enqueue(new Task("backup", DateTime.Now.AddHours(2)), DateTime.Now.AddHours(2));
scheduled.Enqueue(new Task("cleanup", DateTime.Now.AddMinutes(5)), DateTime.Now.AddMinutes(5));

var soonest = scheduled.Peek();
Console.WriteLine($"Next: {soonest.Name}");   // cleanup
```

**Merging K sorted lists:**

```csharp
static List<int> MergeSorted(List<int[]> lists)
{
    var result = new List<int>();
    var queue = new PriorityQueue<(int Value, int List, int Index), int>();

    for (int i = 0; i < lists.Count; i++)
    {
        if (lists[i].Length > 0) queue.Enqueue((lists[i][0], i, 0), lists[i][0]);
    }

    while (queue.TryDequeue(out var entry, out _))
    {
        result.Add(entry.Value);

        int nextIndex = entry.Index + 1;

        if (nextIndex < lists[entry.List].Length)
        {
            int nextValue = lists[entry.List][nextIndex];
            queue.Enqueue((nextValue, entry.List, nextIndex), nextValue);
        }
    }

    return result;
}

var lists = new List<int[]>
{
    new[] { 1, 4, 7 },
    new[] { 2, 5, 8 },
    new[] { 3, 6, 9 }
};

Console.WriteLine(string.Join(", ", MergeSorted(lists)));
// 1, 2, 3, 4, 5, 6, 7, 8, 9
```

The queue only ever holds one item per list, so it is `O(n log k)` with `O(k)` memory. Merging them one pair at a time would be `O(n * k)`.

**A running median with two heaps:**

```csharp
var lowerHalf = new PriorityQueue<int, int>(Comparer<int>.Create((a, b) => b.CompareTo(a)));
var upperHalf = new PriorityQueue<int, int>();

void AddNumber(int value)
{
    lowerHalf.Enqueue(value, value);
    upperHalf.Enqueue(lowerHalf.Dequeue(), lowerHalf.Peek());   // move the largest across

    if (upperHalf.Count > lowerHalf.Count)
    {
        int moved = upperHalf.Dequeue();
        lowerHalf.Enqueue(moved, moved);
    }
}

double Median() => lowerHalf.Count > upperHalf.Count
    ? lowerHalf.Peek()
    : (lowerHalf.Peek() + upperHalf.Peek()) / 2.0;
```

A max heap holds the smaller half and a min heap the larger half. The median sits at one of the two tops. Every insert is `O(log n)`.

## Thread safety

`PriorityQueue<TElement, TPriority>` is not thread safe. There is no concurrent version in the framework, so guard it with a lock, or use `Channel<T>` when you need an async producer and consumer pipeline without priorities.

## Quick recap

- `PriorityQueue<TElement, TPriority>` keeps the element and the priority separate.
- Lowest priority comes out first, so reverse the comparer for highest first.
- Ties come out in an unspecified order, so add a sequence number when it matters.
- Bulk loading in the constructor is `O(n)` rather than `n` separate `O(log n)` inserts.
- There is no way to change a priority, so use lazy deletion with a best known dictionary.
- Merging K sorted lists with it is `O(n log k)` and uses `O(k)` memory.
- Two heaps facing opposite directions give a running median in `O(log n)`.

<code id="code-content" class="language-csharp">
// Element and priority are separate. Lowest priority comes out first.
var queue = new PriorityQueue&lt;string, int&gt;();
queue.Enqueue("write report", 3);
queue.Enqueue("fix production bug", 1);
queue.Enqueue("reply to email", 2);
while (queue.TryDequeue(out string? item, out int priority))
    Console.WriteLine($"{priority}: {item}");     // 1, 2, 3
// Highest first: reverse the comparer. Safer than negating, which overflows.
var byHighest = new PriorityQueue&lt;string, int&gt;(
    Comparer&lt;int&gt;.Create((a, b) =&gt; b.CompareTo(a)));
byHighest.Enqueue("low", 1);
byHighest.Enqueue("high", 10);
Console.WriteLine(byHighest.Dequeue());           // high
// Ties are NOT stable. Add a sequence number when insertion order matters.
var stable = new PriorityQueue&lt;string, (int Priority, long Sequence)&gt;();
long sequence = 0;
void Add(string s, int p) =&gt; stable.Enqueue(s, (p, sequence++));
Add("first", 1); Add("second", 1); Add("third", 1);
while (stable.Count &gt; 0) Console.Write(stable.Dequeue() + " ");   // first second third
Console.WriteLine();
// Bulk load in the constructor: O(n) instead of n separate O(log n) inserts
var bulk = new PriorityQueue&lt;string, int&gt;(new[] { ("low", 10), ("urgent", 1) });
Console.WriteLine(bulk.Dequeue());                // urgent
// There is NO way to change a priority. Use lazy deletion instead.
var work = new PriorityQueue&lt;string, int&gt;();
var bestKnown = new Dictionary&lt;string, int&gt;();
void Improve(string node, int distance)
{
    if (bestKnown.TryGetValue(node, out int current) &amp;&amp; current &lt;= distance) return;
    bestKnown[node] = distance;
    work.Enqueue(node, distance);                 // older worse entries stay in the queue
}
while (work.TryDequeue(out string? node, out int d))
{
    if (d &gt; bestKnown[node]) continue;            // stale copy, skip it
    // process node
}
// Merging K sorted lists: O(n log k) with only k items in the queue
static List&lt;int&gt; MergeSorted(List&lt;int[]&gt; lists)
{
    var result = new List&lt;int&gt;();
    var pq = new PriorityQueue&lt;(int Value, int List, int Index), int&gt;();
    for (int i = 0; i &lt; lists.Count; i++)
        if (lists[i].Length &gt; 0) pq.Enqueue((lists[i][0], i, 0), lists[i][0]);
    while (pq.TryDequeue(out var e, out _))
    {
        result.Add(e.Value);
        int next = e.Index + 1;
        if (next &lt; lists[e.List].Length)
            pq.Enqueue((lists[e.List][next], e.List, next), lists[e.List][next]);
    }
    return result;
}
Console.WriteLine(string.Join(",", MergeSorted(new List&lt;int[]&gt;
    { new[] { 1, 4, 7 }, new[] { 2, 5, 8 }, new[] { 3, 6, 9 } })));
</code></pre>
