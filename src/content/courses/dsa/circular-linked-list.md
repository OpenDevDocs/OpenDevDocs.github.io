---
publishDate: 2026-07-08T10:40
title: Circular Linked List
slug: circular-linked-list
metadescription: Join the tail back to the head to build round robin schedulers and ring buffers, and learn how to loop safely when there is no null.
updateDate: 2026-09-07T10:40
author: ['bishal-biswas']
level: 2
tags: ['linked list', 'circular', 'data structures']
course: dsa
---

## No end

In a normal linked list the last node points at `null`. In a **circular linked list** the last node points back at the first.

```text
   +----------------------+
   v                      |
[10] -> [20] -> [30] -----+
```

There is no end, so there is no `null` to stop at. Every walk has to count or watch for the starting node coming round again.

That sounds like a nuisance, and it is, but it buys you something. Every node can reach every other node, and there is no "first" or "last" unless you decide there is.

## The node is unchanged

```csharp
public class Node<T>
{
    public T Value { get; set; }
    public Node<T>? Next { get; set; }

    public Node(T value) => Value = value;
}
```

Only the wiring changes.

## Building one

Keeping a reference to the **tail** rather than the head turns out to be the neat choice. From the tail, `tail.Next` is the head, so you get both ends for the price of one field.

```csharp
public class CircularList<T>
{
    private Node<T>? tail;
    public int Count { get; private set; }

    public void Add(T value)
    {
        var node = new Node<T>(value);

        if (tail == null)
        {
            node.Next = node;         // points at itself
            tail = node;
        }
        else
        {
            node.Next = tail.Next;    // new node points at the head
            tail.Next = node;         // old tail points at the new node
            tail = node;              // the new node is the tail
        }

        Count++;
    }
}
```

A single node list points at itself. That is not a bug, it is what "circular" means with one item.

Both `Add` at the end and `AddFirst` are `O(1)`, because the tail reference gives you instant access to both ends.

## Walking without a null

Two safe patterns.

**Count the steps:**

```csharp
public override string ToString()
{
    if (tail == null) return "(empty)";

    var parts = new List<string>();
    var current = tail.Next!;          // the head

    for (int i = 0; i < Count; i++)
    {
        parts.Add(current.Value?.ToString() ?? "null");
        current = current.Next!;
    }

    return string.Join(" -> ", parts) + " -> (back to start)";
}
```

**Use a do while and stop when you return to the start:**

```csharp
public bool Contains(T value)
{
    if (tail == null) return false;

    var current = tail.Next!;

    do
    {
        if (EqualityComparer<T>.Default.Equals(current.Value, value)) return true;
        current = current.Next!;
    }
    while (current != tail.Next);

    return false;
}
```

A `do while` rather than a plain `while`, because the condition is false on the very first iteration and a `while` would never run the body.

Writing `while (current != null)` on a circular list gives you an infinite loop. That is the mistake to watch for.

## Removing

```csharp
public bool Remove(T value)
{
    if (tail == null) return false;

    var previous = tail;
    var current = tail.Next!;

    for (int i = 0; i < Count; i++)
    {
        if (EqualityComparer<T>.Default.Equals(current.Value, value))
        {
            if (current == tail && current == tail.Next)
            {
                tail = null;              // the only node
            }
            else
            {
                previous.Next = current.Next;
                if (current == tail) tail = previous;
            }

            Count--;
            return true;
        }

        previous = current;
        current = current.Next!;
    }

    return false;
}
```

Two special cases: removing the only node, and removing the tail. Both are easy to forget.

## Round robin scheduling

The obvious use. Give each participant a turn, forever, in order.

```csharp
public class RoundRobin<T>
{
    private Node<T>? current;

    public void Add(T value)
    {
        var node = new Node<T>(value);

        if (current == null)
        {
            node.Next = node;
            current = node;
            return;
        }

        node.Next = current.Next;
        current.Next = node;
    }

    public T Next()
    {
        if (current == null) throw new InvalidOperationException("Nothing to schedule");

        current = current.Next!;
        return current.Value;
    }
}

var players = new RoundRobin<string>();
players.Add("Asha");
players.Add("Ravi");
players.Add("Meera");

for (int turn = 0; turn < 6; turn++) Console.Write(players.Next() + " ");
```

No index arithmetic, no wrapping with `%`, no bounds checks. The structure does it.

This is how CPU time slices are handed to processes, and how a turn based game keeps cycling players.

## The Josephus problem

A classic puzzle that circular lists solve almost literally. People stand in a circle, every `k`th person is removed, and you want the last one standing.

```csharp
static int Josephus(int people, int k)
{
    var list = new System.Collections.Generic.LinkedList<int>();
    for (int i = 1; i <= people; i++) list.AddLast(i);

    var current = list.First!;

    while (list.Count > 1)
    {
        for (int step = 1; step < k; step++)
        {
            current = current.Next ?? list.First!;      // wrap by hand
        }

        var toRemove = current;
        current = current.Next ?? list.First!;
        list.Remove(toRemove);
    }

    return list.First!.Value;
}

Console.WriteLine(Josephus(7, 3));   // 4
```

.NET's `LinkedList<T>` is not circular, so `current.Next ?? list.First` does the wrapping. That pattern is worth remembering, since it lets you treat any list as circular without building one.

## Ring buffers

The same idea with an array instead of nodes. A fixed size buffer where the newest item overwrites the oldest.

```csharp
public class RingBuffer<T>
{
    private readonly T[] items;
    private int next;

    public RingBuffer(int size) => items = new T[size];

    public void Add(T value)
    {
        items[next] = value;
        next = (next + 1) % items.Length;   // wrap around
    }

    public IEnumerable<T> InOrder()
    {
        for (int i = 0; i < items.Length; i++) yield return items[(next + i) % items.Length];
    }
}

var recent = new RingBuffer<string>(3);
recent.Add("first");
recent.Add("second");
recent.Add("third");
recent.Add("fourth");          // overwrites "first"

Console.WriteLine(string.Join(", ", recent.InOrder()));   // second, third, fourth
```

The `%` operator is doing what the circular link did. This is how "keep the last 100 log lines" is implemented, with no allocation after startup.

## Quick recap

- The tail points at the head, so there is no `null` and no end.
- Keep a reference to the tail, because `tail.Next` is the head.
- A one node circular list points at itself.
- Stop by counting `Count` steps or by using `do while` until you return to the start.
- `while (current != null)` never ends on a circular list.
- Removal has special cases for the only node and for the tail.
- Round robin schedulers, the Josephus problem and ring buffers are the real uses.

<code id="code-content" class="language-csharp">
public class Node&lt;T&gt;
{
    public T Value { get; set; }
    public Node&lt;T&gt;? Next { get; set; }
    public Node(T value) =&gt; Value = value;
}
// Keep the TAIL: tail.Next is the head, so both ends are O(1)
Node&lt;int&gt;? tail = null;
int count = 0;
void Add(int value)
{
    var node = new Node&lt;int&gt;(value);
    if (tail == null) { node.Next = node; tail = node; }   // points at itself
    else { node.Next = tail.Next; tail.Next = node; tail = node; }
    count++;
}
Add(10); Add(20); Add(30);
// Walk by counting steps, there is no null to stop at
var current = tail!.Next!;
for (int i = 0; i &lt; count; i++) { Console.Write(current.Value + " "); current = current.Next!; }
Console.WriteLine();                        // 10 20 30
// Or do..while until you come back to the start
current = tail.Next!;
do { Console.Write(current.Value + " "); current = current.Next!; }
while (current != tail.Next);
Console.WriteLine();
// NEVER write while (current != null) here. It never ends.
// Round robin: no index maths, no wrapping, the structure handles it
Node&lt;string&gt;? turn = null;
void Join(string name)
{
    var node = new Node&lt;string&gt;(name);
    if (turn == null) { node.Next = node; turn = node; return; }
    node.Next = turn.Next; turn.Next = node;
}
Join("Asha"); Join("Ravi"); Join("Meera");
for (int i = 0; i &lt; 6; i++) { turn = turn!.Next; Console.Write(turn!.Value + " "); }
// A ring buffer does the same job with % instead of links
var items = new string[3];
int next = 0;
void Push(string v) { items[next] = v; next = (next + 1) % items.Length; }
Push("first"); Push("second"); Push("third"); Push("fourth");   // overwrites first
Console.WriteLine();
for (int i = 0; i &lt; items.Length; i++) Console.Write(items[(next + i) % items.Length] + " ");
</code></pre>
