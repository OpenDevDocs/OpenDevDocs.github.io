---
publishDate: 2026-07-09T11:20
title: Building a Stack from Scratch
slug: building-a-stack-from-scratch
metadescription: Implement a stack twice, once on an array and once on a linked list, and see the trade off between resizing and per item memory.
updateDate: 2026-09-07T11:20
author: ['bishal-biswas']
level: 1
tags: ['stack', 'implementation', 'data structures']
course: dsa
---

## Why build one

`Stack<T>` already exists and is fast. Building your own is still worth an hour, because a stack is small enough to hold in your head and it teaches the same trade off that shows up in every other structure.

There are two natural ways to build one, and they fail in different places.

## Version one: on an array

Keep an array and an index saying how many items are in it. The top of the stack is the last filled slot.

```csharp
public class ArrayStack<T>
{
    private T[] items;
    private int count;

    public ArrayStack(int capacity = 4) => items = new T[capacity];

    public int Count => count;
    public bool IsEmpty => count == 0;

    public void Push(T item)
    {
        if (count == items.Length) Grow();

        items[count] = item;
        count++;
    }

    public T Pop()
    {
        if (count == 0) throw new InvalidOperationException("The stack is empty");

        count--;
        T item = items[count];
        items[count] = default!;    // release the reference so it can be collected
        return item;
    }

    public T Peek()
    {
        if (count == 0) throw new InvalidOperationException("The stack is empty");
        return items[count - 1];
    }

    private void Grow()
    {
        var bigger = new T[items.Length * 2];
        Array.Copy(items, bigger, items.Length);
        items = bigger;
    }
}
```

Three details worth pointing out.

**`count` is both the size and the next free index.** After `Push`, `items[count - 1]` is the top. That is why `Peek` subtracts one and `Pop` decrements first.

**`items[count] = default!` in `Pop`.** Without it, the array keeps a reference to the popped object and the garbage collector cannot reclaim it. For a stack that lives a long time, that is a genuine memory leak.

**Growing doubles the array.** Growing by one instead would make every push `O(n)`, and filling the stack `O(n^2)`. Doubling gives amortised `O(1)`, exactly as `List<T>` does.

Using it:

```csharp
var stack = new ArrayStack<int>();
stack.Push(1);
stack.Push(2);
stack.Push(3);

Console.WriteLine(stack.Pop());     // 3
Console.WriteLine(stack.Peek());    // 2
Console.WriteLine(stack.Count);     // 2
```

## The Try methods

Throwing inside a loop is awkward. Add the non throwing pair:

```csharp
public bool TryPop(out T item)
{
    if (count == 0)
    {
        item = default!;
        return false;
    }

    item = Pop();
    return true;
}

public bool TryPeek(out T item)
{
    if (count == 0)
    {
        item = default!;
        return false;
    }

    item = items[count - 1];
    return true;
}
```

## Version two: on a linked list

Push at the head of a linked list. The head is the top of the stack, and nothing ever needs to shift or resize.

```csharp
public class LinkedStack<T>
{
    private class Node
    {
        public T Value;
        public Node? Next;
        public Node(T value, Node? next) { Value = value; Next = next; }
    }

    private Node? head;

    public int Count { get; private set; }
    public bool IsEmpty => head == null;

    public void Push(T item)
    {
        head = new Node(item, head);
        Count++;
    }

    public T Pop()
    {
        if (head == null) throw new InvalidOperationException("The stack is empty");

        T value = head.Value;
        head = head.Next;
        Count--;
        return value;
    }

    public T Peek()
    {
        if (head == null) throw new InvalidOperationException("The stack is empty");
        return head.Value;
    }
}
```

Shorter, and there is no capacity anywhere. Every push allocates exactly one node and every pop drops one.

The nested private `Node` class is the tidy way to do this. Nobody outside needs to know the stack is built from nodes.

## Which one wins

```text
                       Array based            Linked list based
Push                   O(1) amortised         O(1) always
Pop                    O(1)                   O(1)
Peek                   O(1)                   O(1)
Memory per item        just the value         value plus a reference
Occasional pause       yes, when it doubles   never
Cache friendly         yes, one block         no, scattered nodes
Wasted space           up to half the array   none
```

The array version is faster in practice, because the items sit next to each other in memory and the processor cache loves that. `Stack<T>` in .NET is array based for this reason.

The linked version wins when a pause matters. Doubling a huge array copies everything at once, which is a visible stall in a real time system. The linked version never does that.

The linked version also never wastes space, while an array based stack that grew to 1,024 and then popped down to 3 items still holds a 1,024 slot array.

## Making it iterable

```csharp
public IEnumerable<T> AsEnumerable()
{
    for (int i = count - 1; i >= 0; i--) yield return items[i];
}
```

Top down, matching what `Stack<T>` does. Implement `IEnumerable<T>` and `foreach` works directly.

## Two stacks making a queue

A well known exercise that shows how far the three operations get you. A queue is first in first out, so you need to reverse the order, and a stack reverses things.

```csharp
public class QueueFromStacks<T>
{
    private readonly Stack<T> inbox = new();
    private readonly Stack<T> outbox = new();

    public void Enqueue(T item) => inbox.Push(item);

    public T Dequeue()
    {
        if (outbox.Count == 0)
        {
            while (inbox.Count > 0) outbox.Push(inbox.Pop());
        }

        if (outbox.Count == 0) throw new InvalidOperationException("The queue is empty");

        return outbox.Pop();
    }
}

var queue = new QueueFromStacks<int>();
queue.Enqueue(1);
queue.Enqueue(2);
queue.Enqueue(3);

Console.WriteLine(queue.Dequeue());   // 1
Console.WriteLine(queue.Dequeue());   // 2
```

Moving everything across looks expensive, but each item moves at most once from inbox to outbox. Across `n` operations that is `O(n)` total, so `Dequeue` is amortised `O(1)`.

The refill only happens when the outbox is empty. Refilling every time would be genuinely `O(n)` per call.

## A stack that reports its minimum

Another favourite. `GetMin` in `O(1)`, by keeping a second stack of minimums.

```csharp
public class MinStack
{
    private readonly Stack<int> values = new();
    private readonly Stack<int> minimums = new();

    public void Push(int value)
    {
        values.Push(value);

        int currentMin = minimums.Count == 0 ? value : Math.Min(value, minimums.Peek());
        minimums.Push(currentMin);
    }

    public int Pop()
    {
        minimums.Pop();
        return values.Pop();
    }

    public int GetMin() => minimums.Peek();
}

var min = new MinStack();
min.Push(5);
min.Push(3);
min.Push(7);

Console.WriteLine(min.GetMin());   // 3
min.Pop();
min.Pop();
Console.WriteLine(min.GetMin());   // 5
```

The two stacks stay the same height, so popping keeps them in step. Memory doubles, and every operation stays `O(1)`.

## Quick recap

- An array based stack keeps `count` as both the size and the next free index.
- Clear the popped slot or the array keeps objects alive.
- Double the capacity when growing, never grow by one.
- A linked list based stack never resizes and never wastes space.
- The array version is faster in practice because of cache locality.
- Two stacks make a queue, amortised `O(1)` if you only refill when empty.
- A parallel stack of minimums gives `O(1)` `GetMin`.

<code id="code-content" class="language-csharp">
// Array based: count is both the size and the next free index
public class ArrayStack&lt;T&gt;
{
    private T[] items = new T[4];
    private int count;
    public int Count =&gt; count;
    public void Push(T item)
    {
        if (count == items.Length)
        {
            var bigger = new T[items.Length * 2];    // double, never grow by one
            Array.Copy(items, bigger, items.Length);
            items = bigger;
        }
        items[count++] = item;
    }
    public T Pop()
    {
        if (count == 0) throw new InvalidOperationException("empty");
        T item = items[--count];
        items[count] = default!;      // release the reference or it leaks
        return item;
    }
    public T Peek() =&gt; count &gt; 0 ? items[count - 1]
                                 : throw new InvalidOperationException("empty");
}
var s = new ArrayStack&lt;int&gt;();
s.Push(1); s.Push(2); s.Push(3);
Console.WriteLine(s.Pop());        // 3
Console.WriteLine(s.Peek());       // 2
// Two stacks make a queue: only refill when the outbox is empty
var inbox = new Stack&lt;int&gt;();
var outbox = new Stack&lt;int&gt;();
void Enqueue(int x) =&gt; inbox.Push(x);
int Dequeue()
{
    if (outbox.Count == 0)
        while (inbox.Count &gt; 0) outbox.Push(inbox.Pop());
    return outbox.Pop();
}
Enqueue(1); Enqueue(2); Enqueue(3);
Console.WriteLine(Dequeue());      // 1, amortised O(1)
// A parallel stack of minimums gives O(1) GetMin
var values = new Stack&lt;int&gt;();
var minimums = new Stack&lt;int&gt;();
void PushMin(int v)
{
    values.Push(v);
    minimums.Push(minimums.Count == 0 ? v : Math.Min(v, minimums.Peek()));
}
PushMin(5); PushMin(3); PushMin(7);
Console.WriteLine(minimums.Peek());   // 3
values.Pop(); minimums.Pop();
values.Pop(); minimums.Pop();
Console.WriteLine(minimums.Peek());   // 5
</code></pre>
