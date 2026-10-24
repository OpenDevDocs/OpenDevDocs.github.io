---
publishDate: 2026-07-07T10:20
title: Singly Linked List
slug: singly-linked-list
metadescription: Build a linked list from scratch in C#, understand nodes and references, and see exactly when a linked list beats an array.
updateDate: 2026-09-07T10:20
author: ['bishal-biswas']
level: 1
tags: ['linked list', 'nodes', 'data structures']
course: dsa
---

## Chain instead of a block

An array is one block of memory. A **linked list** is a chain of separate objects, each holding a value and a reference to the next one.

```text
head -> [10 | *] -> [20 | *] -> [30 | null]
```

Each box is a **node**. The last node points at `null`, which is how you know you have reached the end. The list itself only holds a reference to the first node, called the **head**.

Nothing is contiguous. The nodes can be anywhere in memory.

## A node

```csharp
public class Node<T>
{
    public T Value { get; set; }
    public Node<T>? Next { get; set; }

    public Node(T value)
    {
        Value = value;
        Next = null;
    }
}
```

That is the whole idea. A value and a pointer to the next node.

## Building one by hand

```csharp
var first = new Node<int>(10);
var second = new Node<int>(20);
var third = new Node<int>(30);

first.Next = second;
second.Next = third;

Node<int>? current = first;

while (current != null)
{
    Console.Write(current.Value + " -> ");
    current = current.Next;
}
Console.WriteLine("null");
// 10 -> 20 -> 30 -> null
```

That `while (current != null)` walk is the fundamental linked list loop. You will write it constantly.

## A list class

```csharp
public class LinkedList<T>
{
    private Node<T>? head;
    private int count;

    public int Count => count;

    public void AddFirst(T value)
    {
        var node = new Node<T>(value) { Next = head };
        head = node;
        count++;
    }

    public void AddLast(T value)
    {
        var node = new Node<T>(value);
        count++;

        if (head == null)
        {
            head = node;
            return;
        }

        var current = head;
        while (current.Next != null) current = current.Next;

        current.Next = node;
    }

    public bool Contains(T value)
    {
        for (var current = head; current != null; current = current.Next)
        {
            if (EqualityComparer<T>.Default.Equals(current.Value, value)) return true;
        }
        return false;
    }

    public override string ToString()
    {
        var parts = new List<string>();
        for (var current = head; current != null; current = current.Next)
        {
            parts.Add(current.Value?.ToString() ?? "null");
        }
        return string.Join(" -> ", parts);
    }
}
```

Notice `AddFirst` is `O(1)` and `AddLast` is `O(n)`, because it has to walk to the end. Keeping a `tail` reference makes `AddLast` `O(1)` too, at the cost of maintaining one more field.

## Removing

The tricky part: to remove a node, you need the node **before** it, because that is the one whose `Next` has to change.

```csharp
public bool Remove(T value)
{
    if (head == null) return false;

    if (EqualityComparer<T>.Default.Equals(head.Value, value))
    {
        head = head.Next;    // the old head is now unreachable
        count--;
        return true;
    }

    var current = head;

    while (current.Next != null)
    {
        if (EqualityComparer<T>.Default.Equals(current.Next.Value, value))
        {
            current.Next = current.Next.Next;   // skip over it
            count--;
            return true;
        }

        current = current.Next;
    }

    return false;
}
```

Removing the head is a special case, which is why linked list code so often has an `if` at the top for it.

There is no explicit deletion. Once nothing points at a node, the garbage collector reclaims it.

## Inserting in the middle

```csharp
public void InsertAfter(Node<T> node, T value)
{
    node.Next = new Node<T>(value) { Next = node.Next };
    count++;
}
```

This is the linked list superpower. Given the node, inserting is `O(1)` no matter how long the list is. Nothing shifts, because nothing is contiguous.

Compare that with `List<T>.Insert(0, x)`, which moves every single item.

## The honest comparison

```text
Operation                   Array / List<T>   Singly linked list
Access item i               O(1)              O(n)
Insert at front             O(n)              O(1)
Insert at back              O(1) amortised    O(1) with a tail reference
Insert after a known node   O(n)              O(1)
Remove a known node         O(n)              O(n), you need the previous node
Search by value             O(n)              O(n)
Memory per item             just the value    value plus a reference
Cache friendly              yes               no
```

Two rows matter most.

**Access by index is `O(n)`.** There is no arithmetic that finds node 500. You walk. This alone rules linked lists out of most work.

**Cache friendliness.** Array items sit next to each other, so reading one pulls its neighbours into the processor cache for free. Linked list nodes are scattered, so every step is potentially a cache miss. In practice, looping over a `List<int>` can be several times faster than a linked list holding the same values, despite both being `O(n)`.

## When a linked list is genuinely right

- You constantly insert and remove in the middle **and** you already hold the node.
- You need to splice two lists together in `O(1)`.
- You are implementing something where nodes are handed out, such as an LRU cache combining a dictionary with a linked list.
- You are writing a stack or queue and want guaranteed `O(1)` with no resize pauses.

For everything else, `List<T>` wins, usually by a lot.

## The built in LinkedList of T

.NET has one, and it is doubly linked.

```csharp
var list = new System.Collections.Generic.LinkedList<string>();

var b = list.AddLast("b");
list.AddFirst("a");
list.AddAfter(b, "c");

foreach (string item in list) Console.Write(item + " ");   // a b c

list.Remove(b);           // O(1), you hold the node
Console.WriteLine();
Console.WriteLine(list.Count);   // 2
```

`AddAfter` and `Remove` take a `LinkedListNode<T>`, and both are `O(1)`. `list.Remove("b")` by value is `O(n)`, because it has to find the node first.

## The classic problems

Linked lists appear constantly in interviews because they force you to think carefully about references.

- Reverse a list.
- Find the middle in one pass.
- Detect a cycle.
- Merge two sorted lists.
- Remove the Nth node from the end.

The next few topics cover the two techniques that solve nearly all of them: careful pointer rewiring, and fast and slow pointers.

## Quick recap

- A linked list is nodes holding a value and a reference to the next node.
- The head is the only entry point, and `null` marks the end.
- Walking with `while (current != null)` is the fundamental loop.
- `AddFirst` is `O(1)`, `AddLast` is `O(n)` without a tail reference.
- To remove a node you need the one before it, so the head is always a special case.
- Access by index is `O(n)`, which rules linked lists out of most everyday work.
- Scattered nodes are cache unfriendly, so arrays often win even at the same Big O.

<code id="code-content" class="language-csharp">
// A node: a value plus a reference to the next node
public class Node&lt;T&gt;
{
    public T Value { get; set; }
    public Node&lt;T&gt;? Next { get; set; }
    public Node(T value) { Value = value; Next = null; }
}
// Build a chain by hand
var first  = new Node&lt;int&gt;(10);
var second = new Node&lt;int&gt;(20);
first.Next = second;
second.Next = new Node&lt;int&gt;(30);
// The fundamental loop: walk until you hit null
for (var current = first; current != null; current = current.Next)
    Console.Write(current.Value + " -&gt; ");
Console.WriteLine("null");                 // 10 -&gt; 20 -&gt; 30 -&gt; null
// AddFirst is O(1): point the new node at the old head
Node&lt;int&gt;? head = first;
head = new Node&lt;int&gt;(5) { Next = head };
Console.WriteLine(head.Value);             // 5
// Insert after a known node is O(1): nothing shifts
void InsertAfter(Node&lt;int&gt; node, int value) =&gt;
    node.Next = new Node&lt;int&gt;(value) { Next = node.Next };
InsertAfter(second, 25);                   // 5 -&gt; 10 -&gt; 20 -&gt; 25 -&gt; 30
// Remove needs the PREVIOUS node, so the head is a special case
bool Remove(ref Node&lt;int&gt;? h, int value)
{
    if (h == null) return false;
    if (h.Value == value) { h = h.Next; return true; }
    for (var c = h; c.Next != null; c = c.Next)
        if (c.Next.Value == value) { c.Next = c.Next.Next; return true; }
    return false;
}
Remove(ref head, 20);                      // 5 -&gt; 10 -&gt; 25 -&gt; 30
// The built in one is doubly linked: O(1) when you hold the node
var builtIn = new System.Collections.Generic.LinkedList&lt;string&gt;();
var b = builtIn.AddLast("b");
builtIn.AddFirst("a");
builtIn.AddAfter(b, "c");
builtIn.Remove(b);                         // O(1)
Console.WriteLine(string.Join(" ", builtIn));   // a c
</code></pre>
