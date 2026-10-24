---
publishDate: 2026-07-10T11:30
title: Queue Data Structure
slug: queue-data-structure
metadescription: Understand first in first out ordering, why removing from the front of a list is slow, and how queues drive scheduling and breadth first search.
updateDate: 2026-09-07T11:30
author: ['bishal-biswas']
level: 1
tags: ['queue', 'fifo', 'data structures']
course: dsa
---

## A line at a counter

A queue is a line. People join at the back and leave from the front. Whoever arrived first is served first.

That rule is **FIFO**, first in first out. It is the opposite of a stack.

```csharp
var queue = new Queue<string>();

queue.Enqueue("Asha");
queue.Enqueue("Ravi");
queue.Enqueue("Meera");

Console.WriteLine(queue.Dequeue());   // Asha
Console.WriteLine(queue.Peek());      // Ravi, still waiting
Console.WriteLine(queue.Count);       // 2
```

Three operations, all `O(1)`:

- **Enqueue** adds to the back.
- **Dequeue** removes and returns the front.
- **Peek** returns the front without removing it.

## Guarding the empty case

Like a stack, `Dequeue` and `Peek` throw when the queue is empty.

```csharp
var queue = new Queue<int>();

if (queue.TryDequeue(out int value)) Console.WriteLine(value);
else Console.WriteLine("Nobody waiting");

while (queue.TryDequeue(out int next)) Console.WriteLine(next);
```

That `while (queue.TryDequeue(out var next))` loop is a very common shape. It drains the queue and stops cleanly.

## Iteration order

`foreach` walks from the front to the back, which is the order items will leave.

```csharp
var queue = new Queue<int>(new[] { 1, 2, 3 });

foreach (int n in queue) Console.Write(n + " ");   // 1 2 3
Console.WriteLine(queue.Peek());                   // 1
```

Unlike a stack, building from a collection keeps the natural order.

## Why not just use a list?

You could call `list.Add` and `list.RemoveAt(0)`. It works, and it is slow.

```csharp
var list = new List<int>();

list.Add(1);
list.RemoveAt(0);    // O(n), every remaining item shifts left one place
```

Removing the front of a list moves everything after it. Draining a list of 100,000 items this way does about 5 billion shifts.

`Queue<T>` avoids that with a **circular buffer**. It keeps an array plus a head index and a tail index, and both indexes wrap around with `%` instead of anything moving.

```text
array:  [ _ , _ , C , D , E ]
                  ^       ^
                head    tail
```

Dequeue advances the head. Enqueue advances the tail. Nothing shifts, so both are `O(1)`. The next topic builds one from scratch.

## Breadth first search

The biggest single use of a queue. Explore everything one step away, then everything two steps away, and so on.

```csharp
var graph = new Dictionary<string, string[]>
{
    ["A"] = new[] { "B", "C" },
    ["B"] = new[] { "D" },
    ["C"] = new[] { "D", "E" },
    ["D"] = new[] { "E" },
    ["E"] = Array.Empty<string>()
};

static void BreadthFirst(Dictionary<string, string[]> graph, string start)
{
    var visited = new HashSet<string> { start };
    var queue = new Queue<string>();
    queue.Enqueue(start);

    while (queue.Count > 0)
    {
        string node = queue.Dequeue();
        Console.Write(node + " ");

        foreach (string next in graph[node])
        {
            if (visited.Add(next)) queue.Enqueue(next);   // Add returns false if seen
        }
    }
}

BreadthFirst(graph, "A");   // A B C D E
```

Mark nodes as visited **when you enqueue them**, not when you dequeue them. Otherwise the same node can be queued several times before it is processed once.

Because breadth first explores in order of distance, the first time it reaches a node is by the shortest path. That is why it finds shortest routes in unweighted graphs, and why it is the right tool for maze solving.

## Level by level

Sometimes you need to know which level each item is on. Record the queue size before starting a level, then process exactly that many.

```csharp
static void PrintLevels(Dictionary<string, string[]> graph, string start)
{
    var visited = new HashSet<string> { start };
    var queue = new Queue<string>();
    queue.Enqueue(start);

    int level = 0;

    while (queue.Count > 0)
    {
        int countThisLevel = queue.Count;      // freeze the size

        Console.Write($"Level {level}: ");

        for (int i = 0; i < countThisLevel; i++)
        {
            string node = queue.Dequeue();
            Console.Write(node + " ");

            foreach (string next in graph[node])
            {
                if (visited.Add(next)) queue.Enqueue(next);
            }
        }

        Console.WriteLine();
        level++;
    }
}
```

Freezing `queue.Count` into a variable is the whole trick. Reading `queue.Count` inside the loop would keep growing as you enqueue children.

## Task processing

The other everyday use. Work arrives, gets queued, and is handled in arrival order.

```csharp
var jobs = new Queue<string>();

jobs.Enqueue("send-welcome-email");
jobs.Enqueue("generate-invoice");
jobs.Enqueue("resize-avatar");

while (jobs.TryDequeue(out string? job))
{
    Console.WriteLine($"Processing {job}");
}
```

Print spoolers, message brokers, request handling and background workers are all this shape. When some jobs need to jump ahead, you want a `PriorityQueue` instead, covered later.

## Queue or stack?

The only difference is which end you take from, and it changes the behaviour completely.

```text
                 Stack               Queue
Order            last in first out   first in first out
Traversal        depth first         breadth first
Finds            any path            the shortest path
Natural fit      recursion, undo     scheduling, levels
```

Swapping a queue for a stack in a search turns breadth first into depth first, with no other change. That single swap is worth remembering.

## Thread safety

`Queue<T>` is not safe for several threads at once. For producer and consumer work use `ConcurrentQueue<T>`, or `BlockingCollection<T>` when consumers should wait for items to arrive.

```csharp
using System.Collections.Concurrent;

var safe = new ConcurrentQueue<int>();
safe.Enqueue(1);

if (safe.TryDequeue(out int item)) Console.WriteLine(item);
```

## Quick recap

- A queue is first in first out, with `Enqueue`, `Dequeue` and `Peek` all `O(1)`.
- Use `TryDequeue` to drain a queue without exceptions.
- A `List` is a poor queue, because `RemoveAt(0)` is `O(n)`.
- `Queue<T>` uses a circular buffer, so nothing shifts.
- Breadth first search uses a queue and finds shortest paths.
- Mark nodes visited when enqueuing, not when dequeuing.
- Freeze `queue.Count` at the start of a level to process one level at a time.

<code id="code-content" class="language-csharp">
// First in, first out. Enqueue, Dequeue and Peek are all O(1).
var queue = new Queue&lt;string&gt;();
queue.Enqueue("Asha"); queue.Enqueue("Ravi"); queue.Enqueue("Meera");
Console.WriteLine(queue.Dequeue());     // Asha
Console.WriteLine(queue.Peek());        // Ravi
// Drain safely without exceptions
while (queue.TryDequeue(out string? next)) Console.WriteLine($"serving {next}");
// A List makes a bad queue: RemoveAt(0) shifts every remaining item
var list = new List&lt;int&gt; { 1, 2, 3 };
list.RemoveAt(0);                       // O(n). Queue&lt;T&gt; wraps indexes instead.
// Breadth first search: the classic queue algorithm
var graph = new Dictionary&lt;string, string[]&gt;
{
    ["A"] = new[] { "B", "C" },
    ["B"] = new[] { "D" },
    ["C"] = new[] { "D", "E" },
    ["D"] = new[] { "E" },
    ["E"] = Array.Empty&lt;string&gt;()
};
var visited = new HashSet&lt;string&gt; { "A" };
var toVisit = new Queue&lt;string&gt;();
toVisit.Enqueue("A");
while (toVisit.Count &gt; 0)
{
    string node = toVisit.Dequeue();
    Console.Write(node + " ");
    foreach (string n in graph[node])
        if (visited.Add(n)) toVisit.Enqueue(n);   // mark on enqueue, not dequeue
}
Console.WriteLine();                    // A B C D E
// Level by level: freeze the count before processing a level
visited = new HashSet&lt;string&gt; { "A" };
toVisit.Enqueue("A");
int level = 0;
while (toVisit.Count &gt; 0)
{
    int thisLevel = toVisit.Count;      // freezing this is the whole trick
    Console.Write($"Level {level}: ");
    for (int i = 0; i &lt; thisLevel; i++)
    {
        string node = toVisit.Dequeue();
        Console.Write(node + " ");
        foreach (string n in graph[node]) if (visited.Add(n)) toVisit.Enqueue(n);
    }
    Console.WriteLine();
    level++;
}
</code></pre>
