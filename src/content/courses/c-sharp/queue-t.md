---
publishDate: 2026-04-13T11:23
title: Queue<T>
slug: queue-t
metadescription: Process items in first in, first out order with Queue, use Enqueue, Dequeue and Peek, and see where queues fit in task scheduling, breadth first search and buffering.
updateDate: 2026-09-05T11:23
author: ['bishal-biswas']
level: 2
tags: ['collections', 'queue', 'generics']
course: c-sharp
---

## First in, first out

A queue works like a line at a ticket counter. The first person to join is the first to be served. In programming terms it is **FIFO**: first in, first out.

```csharp
var queue = new Queue<string>();
queue.Enqueue("Asha");
queue.Enqueue("Ravi");
queue.Enqueue("Meera");

Console.WriteLine(queue.Dequeue());   // Asha
Console.WriteLine(queue.Dequeue());   // Ravi
Console.WriteLine(queue.Count);       // 1
```

- `Enqueue` adds to the back.
- `Dequeue` removes and returns the front.
- `Peek` returns the front without removing it.

## Peeking and checking

`Dequeue` and `Peek` throw `InvalidOperationException` on an empty queue, so check `Count` first, or use the `Try` versions:

```csharp
var queue = new Queue<int>();

if (queue.TryDequeue(out int value))
{
    Console.WriteLine(value);
}
else
{
    Console.WriteLine("Queue is empty");
}

if (queue.TryPeek(out int next))
{
    Console.WriteLine($"Next up: {next}");
}
```

## Draining a queue

The standard pattern for processing everything:

```csharp
var jobs = new Queue<string>(new[] { "resize image", "send email", "backup db" });

while (jobs.Count > 0)
{
    string job = jobs.Dequeue();
    Console.WriteLine($"Running: {job}");
}
```

Passing a collection to the constructor fills the queue in order.

## Why not just use a list?

You could `Add` to the end of a list and `RemoveAt(0)` from the front. But removing the first item of a list shifts every other item down, which gets slow as the list grows. A queue is built for this exact pattern and does it in constant time.

Also, the type tells the reader what the code does. A `Queue<Order>` says "these are processed in order" without a comment.

## Where queues show up

### Task scheduling

A print spooler, a job runner or a message handler takes work from the front and adds new work at the back:

```csharp
var printJobs = new Queue<string>();
printJobs.Enqueue("report.pdf");
printJobs.Enqueue("photo.png");

while (printJobs.TryDequeue(out string? file))
{
    Console.WriteLine($"Printing {file}");
}
```

### Breadth first search

Exploring a graph or tree level by level relies on a queue. Each node visited adds its neighbours to the back:

```csharp
var graph = new Dictionary<string, List<string>>
{
    ["A"] = new() { "B", "C" },
    ["B"] = new() { "D" },
    ["C"] = new() { "D" },
    ["D"] = new()
};

var visited = new HashSet<string>();
var toVisit = new Queue<string>();
toVisit.Enqueue("A");

while (toVisit.Count > 0)
{
    string node = toVisit.Dequeue();
    if (!visited.Add(node)) continue;

    Console.Write(node + " ");   // A B C D
    foreach (string next in graph[node])
    {
        toVisit.Enqueue(next);
    }
}
```

Swap the queue for a stack and the same code does depth first search.

### Buffering

When data arrives faster than it can be handled, a queue holds the overflow. Keyboard input, network packets and log entries all commonly sit in a queue.

## Iterating without removing

`foreach` walks from front to back and leaves the queue intact:

```csharp
foreach (string job in jobs)
{
    Console.WriteLine($"Waiting: {job}");
}
```

## Other operations

```csharp
queue.Contains("Ravi");   // true or false, scans the queue
queue.Clear();            // empty it
queue.ToArray();          // snapshot as an array, front first
```

## PriorityQueue<TElement, TPriority>

Sometimes the most urgent item should come out first regardless of when it arrived. `PriorityQueue` dequeues the item with the **lowest** priority value:

```csharp
var tickets = new PriorityQueue<string, int>();
tickets.Enqueue("Password reset", 3);
tickets.Enqueue("Site down", 1);
tickets.Enqueue("Feature request", 5);

while (tickets.TryDequeue(out string? ticket, out int priority))
{
    Console.WriteLine($"[{priority}] {ticket}");
}
// [1] Site down, [3] Password reset, [5] Feature request
```

## Thread safe queues

`Queue<T>` is not safe to share between threads. When producers and consumers run at the same time, use `ConcurrentQueue<T>` from `System.Collections.Concurrent`, or a `Channel<T>`. Multithreading is covered later in the course.

## Quick recap

- A queue is first in, first out: `Enqueue` at the back, `Dequeue` from the front.
- `Peek` looks without removing, and the `Try` versions avoid exceptions on an empty queue.
- `while (queue.Count > 0)` with `Dequeue` is the standard processing loop.
- Queues drive job scheduling, breadth first search and buffering.
- `PriorityQueue` dequeues by priority instead of arrival order.

<code id="code-content" class="language-csharp">
// Queue&lt;T&gt; in C#
// Enqueue at the back, Dequeue from the front
var line = new Queue&lt;string&gt;();
line.Enqueue("Asha");
line.Enqueue("Ravi");
line.Enqueue("Meera");
Console.WriteLine(line.Peek());          // Asha, still in the queue
Console.WriteLine(line.Dequeue());       // Asha, removed
Console.WriteLine(line.Count);           // 2
// Drain safely with TryDequeue
while (line.TryDequeue(out string? person))
{
    Console.WriteLine($"Serving {person}");
}
Console.WriteLine(line.TryPeek(out _));  // False, empty
// Breadth first search uses a queue
var graph = new Dictionary&lt;string, List&lt;string&gt;&gt;
{
    ["A"] = new() { "B", "C" },
    ["B"] = new() { "D" },
    ["C"] = new() { "D" },
    ["D"] = new()
};
var visited = new HashSet&lt;string&gt;();
var toVisit = new Queue&lt;string&gt;();
toVisit.Enqueue("A");
while (toVisit.Count &gt; 0)
{
    string node = toVisit.Dequeue();
    if (!visited.Add(node)) continue;    // skip nodes seen before
    Console.Write(node + " ");           // A B C D
    foreach (string next in graph[node])
        toVisit.Enqueue(next);
}
Console.WriteLine();
// PriorityQueue: lowest priority number comes out first
var tickets = new PriorityQueue&lt;string, int&gt;();
tickets.Enqueue("Password reset", 3);
tickets.Enqueue("Site down", 1);
tickets.Enqueue("Feature request", 5);
while (tickets.TryDequeue(out string? ticket, out int priority))
{
    Console.WriteLine($"[{priority}] {ticket}");
}
</code></pre>
