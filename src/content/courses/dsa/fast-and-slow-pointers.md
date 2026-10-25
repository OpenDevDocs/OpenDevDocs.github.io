---
publishDate: 2026-07-08T11:00
title: Fast and Slow Pointers
slug: fast-and-slow-pointers
metadescription: Move two pointers at different speeds to find the middle of a list, detect cycles, and locate where a loop begins, all in one pass with no extra memory.
updateDate: 2026-09-07T11:00
author: ['bishal-biswas']
level: 2
tags: ['linked list', 'two pointers', 'cycle detection']
course: dsa
---

## Two runners on a track

Send two runners round a track, one at twice the speed of the other. Two things follow.

When the fast one reaches the end, the slow one is exactly halfway. And if the track is a loop, the fast one eventually laps the slow one and they meet.

Those two facts solve a surprising number of linked list problems, in one pass and with no extra memory.

## Finding the middle

The obvious way needs two passes: count the nodes, then walk half that many.

With two speeds it takes one:

```csharp
public static Node<T>? FindMiddle<T>(Node<T>? head)
{
    var slow = head;
    var fast = head;

    while (fast?.Next != null)
    {
        slow = slow!.Next;
        fast = fast.Next.Next;
    }

    return slow;
}
```

Every pass moves `slow` one node and `fast` two. When `fast` runs out, `slow` is at the middle.

```csharp
// 1 -> 2 -> 3 -> 4 -> 5      middle is 3
// 1 -> 2 -> 3 -> 4           middle is 3, the second of the two
```

For an even length list this returns the second of the two middle nodes. If you want the first, stop one step earlier:

```csharp
while (fast.Next != null && fast.Next.Next != null)
{
    slow = slow.Next;
    fast = fast.Next.Next;
}
```

Which one you want depends on the problem, and getting it wrong is a common off by one.

## Detecting a cycle

A linked list with a cycle has no `null`. Walking it normally never ends.

```text
1 -> 2 -> 3 -> 4
          ^    |
          +----+
```

The obvious fix is a `HashSet` of visited nodes, which works but costs `O(n)` memory.

Floyd's cycle detection does it in `O(1)`:

```csharp
public static bool HasCycle<T>(Node<T>? head)
{
    var slow = head;
    var fast = head;

    while (fast?.Next != null)
    {
        slow = slow!.Next;
        fast = fast.Next.Next;

        if (slow == fast) return true;
    }

    return false;
}
```

If there is no cycle, `fast` hits `null` and the loop ends. If there is one, both pointers end up inside the loop, and since `fast` gains one position per step it must eventually land on `slow`.

Reference equality is what `slow == fast` checks, which is exactly right. Two nodes with the same value are not the same node.

```csharp
var a = new Node<int>(1);
var b = new Node<int>(2);
var c = new Node<int>(3);

a.Next = b; b.Next = c; c.Next = b;   // cycle back to b

Console.WriteLine(HasCycle(a));       // True
```

## Finding where the cycle starts

The neat part. After the two pointers meet, move one of them back to the head and advance both **one step at a time**. They meet again exactly at the start of the cycle.

```csharp
public static Node<T>? FindCycleStart<T>(Node<T>? head)
{
    var slow = head;
    var fast = head;

    while (fast?.Next != null)
    {
        slow = slow!.Next;
        fast = fast.Next.Next;

        if (slow != fast) continue;

        // they met, now find the entry point
        slow = head;

        while (slow != fast)
        {
            slow = slow!.Next;
            fast = fast!.Next;
        }

        return slow;
    }

    return null;
}
```

Why does that work? Call the distance from the head to the cycle start `a`, and the distance from the cycle start to the meeting point `b`.

When they meet, `slow` has walked `a + b` and `fast` has walked twice that. The extra distance `fast` covered is whole laps of the cycle. Working it through, the distance from the meeting point back round to the cycle start is exactly `a`, the same as the distance from the head.

So two pointers moving one step each, one from the head and one from the meeting point, arrive together.

## Measuring the cycle length

```csharp
public static int CycleLength<T>(Node<T>? head)
{
    var slow = head;
    var fast = head;

    while (fast?.Next != null)
    {
        slow = slow!.Next;
        fast = fast.Next.Next;

        if (slow != fast) continue;

        int length = 1;
        var walker = fast!.Next;

        while (walker != fast)
        {
            walker = walker!.Next;
            length++;
        }

        return length;
    }

    return 0;
}
```

Once you have any node inside the cycle, walking until you come back to it counts the length.

## The Nth node from the end

A different gap based trick. Move one pointer `n` nodes ahead, then move both together. When the leader reaches the end, the follower is `n` from the end.

```csharp
public static Node<T>? NthFromEnd<T>(Node<T>? head, int n)
{
    var lead = head;

    for (int i = 0; i < n; i++)
    {
        if (lead == null) return null;   // the list is shorter than n
        lead = lead.Next;
    }

    var behind = head;

    while (lead != null)
    {
        lead = lead.Next;
        behind = behind!.Next;
    }

    return behind;
}
```

One pass, no counting, no extra memory.

Removing that node needs a sentinel so that removing the head is not a special case:

```csharp
public static Node<T>? RemoveNthFromEnd<T>(Node<T>? head, int n)
{
    var sentinel = new Node<T>(default!) { Next = head };
    var lead = sentinel;
    var behind = sentinel;

    for (int i = 0; i <= n; i++) lead = lead.Next!;

    while (lead != null)
    {
        lead = lead.Next;
        behind = behind.Next!;
    }

    behind.Next = behind.Next!.Next;
    return sentinel.Next;
}
```

## Palindrome check in O(1) space

Combining the middle finder with a reversal.

```csharp
public static bool IsPalindrome(Node<int>? head)
{
    if (head?.Next == null) return true;

    // find the middle
    var slow = head;
    var fast = head;
    while (fast?.Next != null)
    {
        slow = slow!.Next;
        fast = fast.Next.Next;
    }

    // reverse the second half
    Node<int>? previous = null;
    var current = slow;
    while (current != null)
    {
        var next = current.Next;
        current.Next = previous;
        previous = current;
        current = next;
    }

    // compare the two halves
    var front = head;
    var back = previous;

    while (back != null)
    {
        if (front!.Value != back.Value) return false;
        front = front.Next;
        back = back.Next;
    }

    return true;
}
```

Copying the values into a list and checking that is easier to read and `O(n)` space. This version is what interviewers are after when they say "without extra memory".

## Beyond linked lists

The same idea works on any sequence where each step leads to exactly one next step.

```csharp
// Is this number happy? Repeatedly sum the squares of the digits.
static bool IsHappy(int n)
{
    static int Next(int x)
    {
        int sum = 0;
        while (x > 0) { int d = x % 10; sum += d * d; x /= 10; }
        return sum;
    }

    int slow = n, fast = Next(n);

    while (fast != 1 && slow != fast)
    {
        slow = Next(slow);
        fast = Next(Next(fast));
    }

    return fast == 1;
}

Console.WriteLine(IsHappy(19));   // True
Console.WriteLine(IsHappy(2));    // False, it loops forever
```

Any process that repeats will eventually cycle, and this detects it without remembering every value seen.

## Quick recap

- Two pointers at different speeds solve list problems in one pass with `O(1)` memory.
- When the fast pointer reaches the end, the slow one is at the middle.
- If they ever meet, there is a cycle. If fast hits `null`, there is not.
- Reset one pointer to the head after they meet, walk both at one step, and they meet at the cycle start.
- Compare with `==` on references, not values.
- A fixed gap between pointers finds the Nth node from the end in one pass.
- The same technique detects cycles in any repeating sequence, not just lists.

<code id="code-content" class="language-csharp">
public class Node&lt;T&gt;
{
    public T Value { get; set; }
    public Node&lt;T&gt;? Next { get; set; }
    public Node(T value) =&gt; Value = value;
}
// Middle in one pass: slow moves 1, fast moves 2
static Node&lt;T&gt;? FindMiddle&lt;T&gt;(Node&lt;T&gt;? head)
{
    var slow = head; var fast = head;
    while (fast?.Next != null) { slow = slow!.Next; fast = fast.Next.Next; }
    return slow;
}
// Floyd's cycle detection: O(1) memory instead of a HashSet
static bool HasCycle&lt;T&gt;(Node&lt;T&gt;? head)
{
    var slow = head; var fast = head;
    while (fast?.Next != null)
    {
        slow = slow!.Next;
        fast = fast.Next.Next;
        if (slow == fast) return true;      // reference equality, not value
    }
    return false;
}
var a = new Node&lt;int&gt;(1); var b = new Node&lt;int&gt;(2); var c = new Node&lt;int&gt;(3);
a.Next = b; b.Next = c; c.Next = b;         // cycle back to b
Console.WriteLine(HasCycle(a));             // True
// Where does the cycle start? Reset one pointer to the head, then step both by 1.
static Node&lt;T&gt;? FindCycleStart&lt;T&gt;(Node&lt;T&gt;? head)
{
    var slow = head; var fast = head;
    while (fast?.Next != null)
    {
        slow = slow!.Next; fast = fast.Next.Next;
        if (slow != fast) continue;
        slow = head;
        while (slow != fast) { slow = slow!.Next; fast = fast!.Next; }
        return slow;
    }
    return null;
}
Console.WriteLine(FindCycleStart(a)?.Value);   // 2
// A fixed gap finds the Nth node from the end in one pass
static Node&lt;T&gt;? NthFromEnd&lt;T&gt;(Node&lt;T&gt;? head, int n)
{
    var lead = head;
    for (int i = 0; i &lt; n; i++) { if (lead == null) return null; lead = lead.Next; }
    var behind = head;
    while (lead != null) { lead = lead.Next; behind = behind!.Next; }
    return behind;
}
// The same trick detects cycles in any repeating sequence
static int NextHappy(int x)
{
    int sum = 0;
    while (x &gt; 0) { int d = x % 10; sum += d * d; x /= 10; }
    return sum;
}
int s = 19, f = NextHappy(19);
while (f != 1 &amp;&amp; s != f) { s = NextHappy(s); f = NextHappy(NextHappy(f)); }
Console.WriteLine(f == 1);                  // True, 19 is a happy number
</code></pre>
