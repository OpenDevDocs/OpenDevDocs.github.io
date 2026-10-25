---
publishDate: 2026-07-07T10:30
title: Doubly Linked List
slug: doubly-linked-list
metadescription: Add a previous reference to every node so you can walk backwards, delete in constant time, and build things like an LRU cache.
updateDate: 2026-09-07T10:30
author: ['bishal-biswas']
level: 2
tags: ['linked list', 'nodes', 'data structures']
course: dsa
---

## The missing link

A singly linked list has one problem that keeps coming up: to remove a node, you need the node before it, and there is no way back.

A **doubly linked list** fixes that by giving every node two references.

```text
null <- [10] <-> [20] <-> [30] -> null
        head              tail
```

Each node knows its neighbour on both sides. The list keeps a reference to both ends.

## The node

```csharp
public class Node<T>
{
    public T Value { get; set; }
    public Node<T>? Next { get; set; }
    public Node<T>? Previous { get; set; }

    public Node(T value) => Value = value;
}
```

One extra field, and a surprising number of operations get easier.

## Adding at both ends

```csharp
public class DoublyLinkedList<T>
{
    private Node<T>? head;
    private Node<T>? tail;
    public int Count { get; private set; }

    public void AddLast(T value)
    {
        var node = new Node<T>(value) { Previous = tail };

        if (tail != null) tail.Next = node;
        else head = node;             // the list was empty

        tail = node;
        Count++;
    }

    public void AddFirst(T value)
    {
        var node = new Node<T>(value) { Next = head };

        if (head != null) head.Previous = node;
        else tail = node;             // the list was empty

        head = node;
        Count++;
    }
}
```

Both are `O(1)`. The empty list check appears in both, because when the list is empty the new node is simultaneously the head and the tail.

## Removing a known node in O(1)

This is the payoff.

```csharp
public void Remove(Node<T> node)
{
    if (node.Previous != null) node.Previous.Next = node.Next;
    else head = node.Next;            // it was the head

    if (node.Next != null) node.Next.Previous = node.Previous;
    else tail = node.Previous;        // it was the tail

    node.Next = null;
    node.Previous = null;             // help the collector, avoid stale links
    Count--;
}
```

Four lines of rewiring and no searching at all. In a singly linked list this is `O(n)` because you have to find the previous node first.

## Walking both ways

```csharp
public IEnumerable<T> Forward()
{
    for (var current = head; current != null; current = current.Next)
        yield return current.Value;
}

public IEnumerable<T> Backward()
{
    for (var current = tail; current != null; current = current.Previous)
        yield return current.Value;
}
```

Backwards iteration is free. On a singly linked list it means reversing the list or filling a stack first.

## Inserting either side

```csharp
public void InsertBefore(Node<T> node, T value)
{
    var fresh = new Node<T>(value) { Next = node, Previous = node.Previous };

    if (node.Previous != null) node.Previous.Next = fresh;
    else head = fresh;

    node.Previous = fresh;
    Count++;
}
```

Order matters here. Set the new node's links first, then repoint the neighbours, then finally repoint `node.Previous`. Doing that last line first would lose the reference you still need.

## The cost of the extra reference

- **Memory.** One more reference per node, 8 bytes on 64 bit. For a million small nodes that is meaningful.
- **Bookkeeping.** Every insert and remove updates twice as many links, and every one is a chance for a bug.

The classic bug is updating one direction and forgetting the other, which leaves a list that looks correct walking forwards and is broken walking backwards. Write a check for it while developing:

```csharp
public bool IsConsistent()
{
    for (var c = head; c != null; c = c.Next)
    {
        if (c.Next != null && c.Next.Previous != c) return false;
        if (c.Previous != null && c.Previous.Next != c) return false;
    }
    return true;
}
```

## The built in LinkedList of T

.NET's `LinkedList<T>` is already doubly linked, so in real code you rarely write your own.

```csharp
var list = new LinkedList<string>();

var b = list.AddLast("b");
list.AddFirst("a");
list.AddAfter(b, "c");

Console.WriteLine(string.Join(" ", list));            // a b c
Console.WriteLine(list.Last?.Previous?.Value);        // b

list.Remove(b);                                       // O(1), node in hand
Console.WriteLine(string.Join(" ", list));            // a c
```

Every `Add` method returns the node it created. Hold onto those nodes and removal stays `O(1)`.

## Where it earns its keep: an LRU cache

The best known real use. A cache with a size limit that evicts whatever was used longest ago.

The trick is combining two structures. A dictionary gives `O(1)` lookup by key. A doubly linked list gives `O(1)` reordering and eviction.

```csharp
public class LruCache<TKey, TValue> where TKey : notnull
{
    private readonly int capacity;
    private readonly Dictionary<TKey, LinkedListNode<(TKey Key, TValue Value)>> map = new();
    private readonly LinkedList<(TKey Key, TValue Value)> order = new();

    public LruCache(int capacity) => this.capacity = capacity;

    public bool TryGet(TKey key, out TValue value)
    {
        if (!map.TryGetValue(key, out var node))
        {
            value = default!;
            return false;
        }

        order.Remove(node);          // O(1), we hold the node
        order.AddFirst(node);        // most recently used goes to the front
        value = node.Value.Value;
        return true;
    }

    public void Put(TKey key, TValue value)
    {
        if (map.TryGetValue(key, out var existing))
        {
            order.Remove(existing);
            map.Remove(key);
        }
        else if (map.Count >= capacity)
        {
            var oldest = order.Last!;         // least recently used
            order.RemoveLast();
            map.Remove(oldest.Value.Key);
        }

        map[key] = order.AddFirst((key, value));
    }
}
```

Using it:

```csharp
var cache = new LruCache<string, int>(2);

cache.Put("a", 1);
cache.Put("b", 2);
cache.TryGet("a", out _);   // "a" is now the most recent
cache.Put("c", 3);          // evicts "b", not "a"

Console.WriteLine(cache.TryGet("b", out _));   // False
Console.WriteLine(cache.TryGet("a", out _));   // True
```

Every operation is `O(1)`. Neither structure could do this alone, and that is the lesson worth taking away: combining two data structures often beats finding one perfect one.

## Singly or doubly?

Use **singly** when you only ever move forward and want the smallest node. Stacks and simple queues fit here.

Use **doubly** when you need backwards iteration, or when you hold node references and want `O(1)` removal. Caches, undo history and browser back and forward buttons fit here.

## Quick recap

- A doubly linked node stores `Next` and `Previous`.
- Removing a node you already hold becomes `O(1)`, with no search.
- Backwards iteration is free.
- Both ends need the empty list special case when adding.
- Rewire the new node first, then its neighbours, or you lose references.
- The extra reference costs memory and doubles the bookkeeping.
- A dictionary plus a doubly linked list gives an `O(1)` LRU cache.

<code id="code-content" class="language-csharp">
// Two references per node is the whole difference
public class Node&lt;T&gt;
{
    public T Value { get; set; }
    public Node&lt;T&gt;? Next { get; set; }
    public Node&lt;T&gt;? Previous { get; set; }
    public Node(T value) =&gt; Value = value;
}
// Remove a node you already hold: O(1), no searching
void Remove(Node&lt;int&gt; node, ref Node&lt;int&gt;? head, ref Node&lt;int&gt;? tail)
{
    if (node.Previous != null) node.Previous.Next = node.Next;
    else head = node.Next;                    // it was the head
    if (node.Next != null) node.Next.Previous = node.Previous;
    else tail = node.Previous;                // it was the tail
    node.Next = node.Previous = null;
}
// The built in LinkedList&lt;T&gt; is already doubly linked
var list = new LinkedList&lt;string&gt;();
var b = list.AddLast("b");
list.AddFirst("a");
list.AddAfter(b, "c");
Console.WriteLine(string.Join(" ", list));          // a b c
Console.WriteLine(list.Last?.Previous?.Value);      // b, walking backwards is free
list.Remove(b);                                     // O(1), node in hand
// Dictionary + doubly linked list = an O(1) LRU cache
var capacity = 2;
var map = new Dictionary&lt;string, LinkedListNode&lt;(string K, int V)&gt;&gt;();
var order = new LinkedList&lt;(string K, int V)&gt;();
void Put(string key, int value)
{
    if (map.TryGetValue(key, out var existing)) { order.Remove(existing); map.Remove(key); }
    else if (map.Count &gt;= capacity)
    {
        var oldest = order.Last!;             // least recently used
        order.RemoveLast();
        map.Remove(oldest.Value.K);
    }
    map[key] = order.AddFirst((key, value));
}
bool TryGet(string key, out int value)
{
    if (!map.TryGetValue(key, out var node)) { value = 0; return false; }
    order.Remove(node); order.AddFirst(node);  // touch moves it to the front
    value = node.Value.V; return true;
}
Put("a", 1); Put("b", 2); TryGet("a", out _); Put("c", 3);   // evicts "b"
Console.WriteLine(TryGet("b", out _));        // False
Console.WriteLine(TryGet("a", out _));        // True
</code></pre>
