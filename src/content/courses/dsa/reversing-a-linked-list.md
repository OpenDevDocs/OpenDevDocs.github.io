---
publishDate: 2026-07-08T10:50
title: Reversing a Linked List
slug: reversing-a-linked-list
metadescription: Reverse a linked list in place with three references, understand why the order of assignments matters, and see the recursive version too.
updateDate: 2026-09-07T10:50
author: ['bishal-biswas']
level: 2
tags: ['linked list', 'pointers', 'interview']
course: dsa
---

## The most asked linked list question

Turn this:

```text
1 -> 2 -> 3 -> 4 -> null
```

into this:

```text
4 -> 3 -> 2 -> 1 -> null
```

without allocating a new list.

It is asked constantly because it looks trivial and then quietly punishes anyone who does not think about the order of assignments.

## Why it is not obvious

The natural first attempt:

```csharp
current.Next = previous;
current = current.Next;    // wrong, this is now previous
```

The moment you repoint `current.Next` backwards, you have destroyed the only way to reach the rest of the list. The second line then walks the wrong way.

So you need to **save the next node before you overwrite the link**.

## Three references

```csharp
public static Node<T>? Reverse<T>(Node<T>? head)
{
    Node<T>? previous = null;
    Node<T>? current = head;

    while (current != null)
    {
        Node<T>? next = current.Next;   // 1. save the rest of the list
        current.Next = previous;        // 2. flip this link backwards
        previous = current;             // 3. move previous forward
        current = next;                 // 4. move current forward
    }

    return previous;                    // the old tail is the new head
}
```

Four lines in a strict order. Swapping any two breaks it.

The return value is `previous`, not `current`. When the loop ends, `current` is `null` and `previous` is sitting on the last real node, which is the new head.

## Tracing it

Starting with `1 -> 2 -> 3 -> null`:

```text
start        previous = null    current = 1      list: 1 -> 2 -> 3

pass 1       next = 2
             1.Next = null
             previous = 1       current = 2      list: 1 -> null,  2 -> 3

pass 2       next = 3
             2.Next = 1
             previous = 2       current = 3      list: 2 -> 1 -> null,  3

pass 3       next = null
             3.Next = 2
             previous = 3       current = null   list: 3 -> 2 -> 1 -> null

return 3
```

Writing out three passes by hand is the fastest way to make this stick.

## Running it

```csharp
var head = new Node<int>(1)
{
    Next = new Node<int>(2)
    {
        Next = new Node<int>(3) { Next = new Node<int>(4) }
    }
};

static void Print<T>(Node<T>? node)
{
    var parts = new List<string>();
    for (var c = node; c != null; c = c.Next) parts.Add(c.Value!.ToString()!);
    Console.WriteLine(string.Join(" -> ", parts) + " -> null");
}

Print(head);                 // 1 -> 2 -> 3 -> 4 -> null
head = Reverse(head);
Print(head);                 // 4 -> 3 -> 2 -> 1 -> null
```

Reassigning `head` matters. The old head is now the tail, so keeping the old reference leaves you looking at a one item list.

Time is `O(n)`, space is `O(1)`. Nothing is allocated.

## The recursive version

Shorter to write, harder to see at first.

```csharp
public static Node<T>? ReverseRecursive<T>(Node<T>? head)
{
    if (head == null || head.Next == null) return head;   // base case

    var newHead = ReverseRecursive(head.Next);   // reverse everything after head

    head.Next.Next = head;    // the node after head now points back at head
    head.Next = null;         // head becomes the tail

    return newHead;
}
```

The trick is `head.Next.Next = head`. At that moment `head.Next` is still the node that used to follow `head`, and it is now the tail of the reversed part. Pointing its `Next` at `head` appends `head` to the end.

Setting `head.Next = null` is essential. Skip it and the last two nodes point at each other, creating a cycle.

This is `O(n)` time but `O(n)` space, because of the call stack. On a list of a million nodes it will overflow. The loop version is the one to use in real code.

## Reversing only part of a list

Reverse from position `left` to position `right`, counting from 1.

```csharp
public static Node<T>? ReverseBetween<T>(Node<T>? head, int left, int right)
{
    if (head == null || left >= right) return head;

    var sentinel = new Node<T>(default!) { Next = head };
    var beforeLeft = sentinel;

    for (int i = 1; i < left; i++) beforeLeft = beforeLeft.Next!;

    var current = beforeLeft.Next!;

    for (int i = 0; i < right - left; i++)
    {
        var moved = current.Next!;
        current.Next = moved.Next;
        moved.Next = beforeLeft.Next;
        beforeLeft.Next = moved;
    }

    return sentinel.Next;
}

Print(ReverseBetween(head, 2, 4));
```

The **sentinel node** is the technique worth stealing. A fake node in front of the real head means "the node before the section" always exists, even when the section starts at position 1. That removes the special case that makes this problem fiddly.

Rather than flipping links, this repeatedly lifts the node after `current` and moves it to the front of the section.

## Where reversal shows up

- Checking whether a linked list is a palindrome: find the middle, reverse the second half, compare.
- Reordering a list as first, last, second, second last and so on.
- Adding two numbers stored as digits in a list, where reversing gives you the units first.

The three reference pattern is a building block, not just a puzzle answer.

## Quick recap

- Save `current.Next` before overwriting it, or you lose the rest of the list.
- The order is: save next, flip the link, advance previous, advance current.
- Return `previous`, because `current` is `null` when the loop ends.
- Reassign your `head` variable, the old head is now the tail.
- The loop version is `O(n)` time and `O(1)` space.
- The recursive version is elegant but costs `O(n)` stack space.
- A sentinel node removes the special case when reversing from position 1.

<code id="code-content" class="language-csharp">
public class Node&lt;T&gt;
{
    public T Value { get; set; }
    public Node&lt;T&gt;? Next { get; set; }
    public Node(T value) =&gt; Value = value;
}
// Three references, and the order of the four lines is everything
static Node&lt;T&gt;? Reverse&lt;T&gt;(Node&lt;T&gt;? head)
{
    Node&lt;T&gt;? previous = null, current = head;
    while (current != null)
    {
        Node&lt;T&gt;? next = current.Next;   // 1. save the rest of the list
        current.Next = previous;        // 2. flip this link backwards
        previous = current;             // 3. advance previous
        current = next;                 // 4. advance current
    }
    return previous;                    // old tail is the new head
}
static void Print&lt;T&gt;(Node&lt;T&gt;? node)
{
    var parts = new List&lt;string&gt;();
    for (var c = node; c != null; c = c.Next) parts.Add(c.Value!.ToString()!);
    Console.WriteLine(string.Join(" -&gt; ", parts) + " -&gt; null");
}
var head = new Node&lt;int&gt;(1) { Next = new Node&lt;int&gt;(2) { Next = new Node&lt;int&gt;(3) } };
Print(head);                    // 1 -&gt; 2 -&gt; 3 -&gt; null
head = Reverse(head);           // reassign, the old head is now the tail
Print(head);                    // 3 -&gt; 2 -&gt; 1 -&gt; null
// Recursive: elegant, but O(n) stack space and it will overflow on long lists
static Node&lt;T&gt;? ReverseRecursive&lt;T&gt;(Node&lt;T&gt;? head)
{
    if (head == null || head.Next == null) return head;
    var newHead = ReverseRecursive(head.Next);
    head.Next.Next = head;      // the next node now points back at head
    head.Next = null;           // essential, or the last two form a cycle
    return newHead;
}
head = ReverseRecursive(head);
Print(head);                    // 1 -&gt; 2 -&gt; 3 -&gt; null
// A sentinel node removes the "section starts at position 1" special case
static Node&lt;T&gt;? ReverseBetween&lt;T&gt;(Node&lt;T&gt;? head, int left, int right)
{
    if (head == null || left &gt;= right) return head;
    var sentinel = new Node&lt;T&gt;(default!) { Next = head };
    var beforeLeft = sentinel;
    for (int i = 1; i &lt; left; i++) beforeLeft = beforeLeft.Next!;
    var current = beforeLeft.Next!;
    for (int i = 0; i &lt; right - left; i++)
    {
        var moved = current.Next!;
        current.Next = moved.Next;
        moved.Next = beforeLeft.Next;
        beforeLeft.Next = moved;
    }
    return sentinel.Next;
}
Print(ReverseBetween(head, 2, 3));   // 1 -&gt; 3 -&gt; 2 -&gt; null
</code></pre>
