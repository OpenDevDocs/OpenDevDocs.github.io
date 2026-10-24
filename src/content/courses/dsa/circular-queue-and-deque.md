---
publishDate: 2026-07-10T11:40
title: Circular Queue and Deque
slug: circular-queue-and-deque
metadescription: Build a fixed size queue on a wrapping array, and learn the double ended queue that handles both ends in constant time.
updateDate: 2026-09-07T11:40
author: ['bishal-biswas']
level: 2
tags: ['queue', 'deque', 'circular buffer']
course: dsa
---

## The problem with a simple array queue

Keep a head index and a tail index into an array. Enqueue writes at the tail, dequeue reads at the head.

```text
[ A , B , C , _ , _ ]
  ^           ^
head        tail
```

Dequeue twice:

```text
[ _ , _ , C , _ , _ ]
          ^   ^
        head tail
```

Now the two slots at the front are wasted. Enqueue twice more and the tail runs off the end of an array that is over half empty.

## Wrapping around

The fix is to let the indexes wrap back to the start using `%`.

```text
[ E , F , C , D , _ ]
          ^       ^
        head    tail (wrapped to index 0, then 1)
```

There is no real "end" any more. The array is treated as a circle.

```csharp
public class CircularQueue<T>
{
    private readonly T[] items;
    private int head;
    private int count;

    public CircularQueue(int capacity) => items = new T[capacity];

    public int Count => count;
    public bool IsEmpty => count == 0;
    public bool IsFull => count == items.Length;

    public void Enqueue(T item)
    {
        if (IsFull) throw new InvalidOperationException("The queue is full");

        int tail = (head + count) % items.Length;
        items[tail] = item;
        count++;
    }

    public T Dequeue()
    {
        if (IsEmpty) throw new InvalidOperationException("The queue is empty");

        T item = items[head];
        items[head] = default!;                 // release the reference
        head = (head + 1) % items.Length;
        count--;
        return item;
    }

    public T Peek() => IsEmpty
        ? throw new InvalidOperationException("The queue is empty")
        : items[head];
}
```

Storing `head` and `count` rather than `head` and `tail` avoids a classic ambiguity. With two indexes, head equal to tail could mean either full or empty. With a count, there is no confusion.

The tail is derived: `(head + count) % capacity`.

```csharp
var queue = new CircularQueue<string>(3);

queue.Enqueue("a");
queue.Enqueue("b");
Console.WriteLine(queue.Dequeue());   // a
queue.Enqueue("c");
queue.Enqueue("d");                   // wraps into the slot "a" left behind

Console.WriteLine(queue.Dequeue());   // b
Console.WriteLine(queue.Dequeue());   // c
Console.WriteLine(queue.Dequeue());   // d
```

Every operation is `O(1)` and nothing is ever allocated after construction. This is exactly how `Queue<T>` works inside, except that it grows instead of throwing when full.

## Iterating in order

```csharp
public IEnumerable<T> InOrder()
{
    for (int i = 0; i < count; i++) yield return items[(head + i) % items.Length];
}
```

The `%` turns the physical positions back into logical order.

## A ring buffer that overwrites

A common variation. Instead of refusing when full, overwrite the oldest item. Perfect for "keep the last N log lines" or a sensor reading history.

```csharp
public class RingBuffer<T>
{
    private readonly T[] items;
    private int next;
    private int count;

    public RingBuffer(int size) => items = new T[size];

    public void Add(T item)
    {
        items[next] = item;
        next = (next + 1) % items.Length;
        if (count < items.Length) count++;
    }

    public IEnumerable<T> OldestFirst()
    {
        int start = count < items.Length ? 0 : next;
        for (int i = 0; i < count; i++) yield return items[(start + i) % items.Length];
    }
}

var recent = new RingBuffer<string>(3);
recent.Add("one");
recent.Add("two");
recent.Add("three");
recent.Add("four");     // overwrites "one"

Console.WriteLine(string.Join(", ", recent.OldestFirst()));   // two, three, four
```

Fixed memory, no allocation while running, and the oldest data falls off automatically.

## The deque

A **deque**, short for double ended queue, allows adding and removing at both ends in `O(1)`.

```text
AddFirst  <-  [ A , B , C ]  ->  AddLast
RemoveFirst <-             ->  RemoveLast
```

It is a queue and a stack at once. .NET does not ship a dedicated `Deque<T>`, but `LinkedList<T>` gives you all four operations:

```csharp
var deque = new LinkedList<int>();

deque.AddLast(2);
deque.AddLast(3);
deque.AddFirst(1);

Console.WriteLine(string.Join(" ", deque));   // 1 2 3

Console.WriteLine(deque.First!.Value);        // 1
deque.RemoveFirst();

Console.WriteLine(deque.Last!.Value);         // 3
deque.RemoveLast();

Console.WriteLine(string.Join(" ", deque));   // 2
```

All four are `O(1)`. The cost is a node allocation per item and poor cache behaviour, which matters on hot paths.

## An array based deque

If you need the speed, the circular array handles both ends just as well. Moving the head backwards needs a small adjustment, because `-1 % length` is `-1` in C#, not `length - 1`.

```csharp
public class ArrayDeque<T>
{
    private readonly T[] items;
    private int head;
    private int count;

    public ArrayDeque(int capacity) => items = new T[capacity];

    public int Count => count;

    public void AddLast(T item)
    {
        items[(head + count) % items.Length] = item;
        count++;
    }

    public void AddFirst(T item)
    {
        head = (head - 1 + items.Length) % items.Length;   // the +length matters
        items[head] = item;
        count++;
    }

    public T RemoveFirst()
    {
        T item = items[head];
        head = (head + 1) % items.Length;
        count--;
        return item;
    }

    public T RemoveLast()
    {
        count--;
        return items[(head + count) % items.Length];
    }
}
```

Adding `items.Length` before the `%` is what turns a negative index into the right positive one. Leaving it out gives an `IndexOutOfRangeException` the first time you call `AddFirst` on a fresh deque.

## Where a deque is the right answer

**Sliding window maximum.** Find the largest value in every window of size `k`. The direct approach is `O(n * k)`. A deque holding indexes in decreasing value order makes it `O(n)`.

```csharp
static int[] MaxOfEachWindow(int[] numbers, int k)
{
    var result = new int[numbers.Length - k + 1];
    var window = new LinkedList<int>();      // holds indexes, not values

    for (int i = 0; i < numbers.Length; i++)
    {
        // drop indexes that have fallen out of the window
        if (window.Count > 0 && window.First!.Value <= i - k) window.RemoveFirst();

        // drop values smaller than the incoming one, they can never win again
        while (window.Count > 0 && numbers[window.Last!.Value] <= numbers[i])
        {
            window.RemoveLast();
        }

        window.AddLast(i);

        if (i >= k - 1) result[i - k + 1] = numbers[window.First!.Value];
    }

    return result;
}

Console.WriteLine(string.Join(", ", MaxOfEachWindow(new[] { 1, 3, -1, -3, 5, 3, 6, 7 }, 3)));
// 3, 3, 5, 5, 6, 7
```

The front of the deque always holds the index of the current window's maximum. Each index enters once and leaves once, so the whole thing is `O(n)` despite the inner `while`.

The key insight is the second step. When a new value arrives, any smaller value still in the window is useless, because the new one is both larger and stays in the window longer.

**Undo and redo with a limit.** Add to one end, and drop from the other when the history gets too long.

**Palindrome checking.** Compare the two ends and remove both, repeatedly.

## Quick recap

- Wrapping indexes with `%` stops a queue from wasting the front of its array.
- Store `head` and `count`, not `head` and `tail`, so full and empty are distinguishable.
- The tail is `(head + count) % capacity`.
- A ring buffer overwrites the oldest item and never allocates after startup.
- A deque adds and removes at both ends in `O(1)`.
- `LinkedList<T>` is the built in deque, at the cost of a node per item.
- Use `(index - 1 + length) % length` when moving backwards, since C# `%` can be negative.
- A deque of indexes solves sliding window maximum in `O(n)`.

<code id="code-content" class="language-csharp">
// Circular queue: store head and count, derive the tail
public class CircularQueue&lt;T&gt;
{
    private readonly T[] items;
    private int head, count;
    public CircularQueue(int capacity) =&gt; items = new T[capacity];
    public int Count =&gt; count;
    public void Enqueue(T item)
    {
        if (count == items.Length) throw new InvalidOperationException("full");
        items[(head + count) % items.Length] = item;    // tail is derived
        count++;
    }
    public T Dequeue()
    {
        if (count == 0) throw new InvalidOperationException("empty");
        T item = items[head];
        items[head] = default!;                         // release the reference
        head = (head + 1) % items.Length;
        count--;
        return item;
    }
}
var q = new CircularQueue&lt;string&gt;(3);
q.Enqueue("a"); q.Enqueue("b");
Console.WriteLine(q.Dequeue());     // a
q.Enqueue("c"); q.Enqueue("d");     // wraps into the slot "a" left behind
Console.WriteLine(q.Dequeue());     // b
// Moving backwards: add the length before % or you get a negative index
int head2 = 0, length = 5;
head2 = (head2 - 1 + length) % length;
Console.WriteLine(head2);           // 4, not -1
// LinkedList&lt;T&gt; is the built in deque: all four ends are O(1)
var deque = new LinkedList&lt;int&gt;();
deque.AddLast(2); deque.AddLast(3); deque.AddFirst(1);
Console.WriteLine(string.Join(" ", deque));   // 1 2 3
deque.RemoveFirst(); deque.RemoveLast();
Console.WriteLine(string.Join(" ", deque));   // 2
// Sliding window maximum in O(n): a deque of indexes in decreasing value order
static int[] MaxOfEachWindow(int[] numbers, int k)
{
    var result = new int[numbers.Length - k + 1];
    var window = new LinkedList&lt;int&gt;();
    for (int i = 0; i &lt; numbers.Length; i++)
    {
        if (window.Count &gt; 0 &amp;&amp; window.First!.Value &lt;= i - k) window.RemoveFirst();
        while (window.Count &gt; 0 &amp;&amp; numbers[window.Last!.Value] &lt;= numbers[i])
            window.RemoveLast();                // smaller values can never win again
        window.AddLast(i);
        if (i &gt;= k - 1) result[i - k + 1] = numbers[window.First!.Value];
    }
    return result;
}
Console.WriteLine(string.Join(",", MaxOfEachWindow(new[] { 1, 3, -1, -3, 5, 3, 6, 7 }, 3)));
// 3,3,5,5,6,7
</code></pre>
