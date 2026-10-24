---
publishDate: 2026-07-04T09:10
title: Dynamic Arrays and Lists
slug: dynamic-arrays-and-lists
metadescription: Learn how List of T grows behind the scenes, why Add is cheap and Insert at the front is not, and when to preallocate capacity.
updateDate: 2026-09-07T09:10
author: ['bishal-biswas']
level: 1
tags: ['arrays', 'list', 'amortised']
course: dsa
---

## The problem lists solve

An array has a fixed size. Most of the time you do not know the size in advance.

You could allocate a new array every time you add an item, but that is `O(n)` per add and `O(n^2)` overall. Unusable.

A **dynamic array** solves this by keeping spare room. `List<T>` is C#'s dynamic array.

## Count and Capacity

A list has two different sizes and understanding the difference explains everything else.

- **Count** is how many items you have put in.
- **Capacity** is how many the internal array can hold before it must grow.

```csharp
var list = new List<int>();
Console.WriteLine($"Count {list.Count}, Capacity {list.Capacity}");   // 0, 0

list.Add(1);
Console.WriteLine($"Count {list.Count}, Capacity {list.Capacity}");   // 1, 4

list.Add(2); list.Add(3); list.Add(4);
Console.WriteLine($"Count {list.Count}, Capacity {list.Capacity}");   // 4, 4

list.Add(5);
Console.WriteLine($"Count {list.Count}, Capacity {list.Capacity}");   // 5, 8
```

The list started with room for 4. On the fifth add it was full, so it allocated an array of 8, copied the 4 existing items over, and added the new one.

## Watching it double

```csharp
var list = new List<int>();
int capacity = list.Capacity;

for (int i = 1; i <= 1000; i++)
{
    list.Add(i);

    if (list.Capacity != capacity)
    {
        Console.WriteLine($"Item {i}: capacity {capacity} -> {list.Capacity}");
        capacity = list.Capacity;
    }
}
```

Output:

```text
Item 1: capacity 0 -> 4
Item 5: capacity 4 -> 8
Item 9: capacity 8 -> 16
Item 17: capacity 16 -> 32
Item 33: capacity 32 -> 64
...
Item 513: capacity 512 -> 1024
```

Ten resizes for a thousand items. The resizes get rarer exactly as fast as they get more expensive, which is the whole trick.

## Why doubling gives amortised O(1)

Adding 1,000 items causes copies of 4, 8, 16, 32 and so on up to 512. That total is under 1,024, which is less than one extra copy per item.

So although a single `Add` can be `O(n)`, the average across many adds is constant. This is **amortised O(1)**.

If the list grew by one slot each time instead of doubling, every add would copy everything, and adding `n` items would be `O(n^2)`. Doubling is what makes it work.

## Preallocating

If you know roughly how many items you will add, say so:

```csharp
var list = new List<int>(1000);
Console.WriteLine(list.Capacity);   // 1000
Console.WriteLine(list.Count);      // 0, still empty

for (int i = 0; i < 1000; i++) list.Add(i);   // no resizing at all
```

One allocation instead of ten, and no copying. On hot paths this is a real win and costs you one number.

## The operations and what they cost

```csharp
var items = new List<string> { "a", "b", "c" };

string first = items[0];          // O(1)
items[0] = "z";                   // O(1)
int count = items.Count;          // O(1)

items.Add("d");                   // O(1) amortised
items.RemoveAt(items.Count - 1);  // O(1), nothing to shift

items.Insert(0, "start");         // O(n), everything shifts right
items.RemoveAt(0);                // O(n), everything shifts left
items.Remove("b");                // O(n), search then shift
items.Contains("b");              // O(n)
items.IndexOf("b");               // O(n)
```

The pattern: **the end is cheap, the front is expensive.** An array cannot shift items for free.

## The mistake this causes

Building a list in reverse by inserting at the front:

```csharp
// O(n^2): every insert shifts every existing item
var result = new List<int>();
foreach (int n in source) result.Insert(0, n);
```

```csharp
// O(n): add at the end, then reverse once
var result = new List<int>(source);
result.Reverse();
```

For 100,000 items the first version does about 5 billion shifts. The second does 100,000 adds and one pass.

## Removing while looping

You cannot remove from a list you are iterating.

```csharp
// Throws InvalidOperationException
foreach (int n in numbers)
{
    if (n < 0) numbers.Remove(n);
}
```

Three safe ways, best last:

```csharp
// Loop backwards so removals do not move items you have not seen yet
for (int i = numbers.Count - 1; i >= 0; i--)
{
    if (numbers[i] < 0) numbers.RemoveAt(i);
}

// Build a new list
numbers = numbers.Where(n => n >= 0).ToList();

// One call, one pass, and it does the shifting only once
numbers.RemoveAll(n => n < 0);
```

`RemoveAll` is `O(n)` in total. A loop calling `Remove` is `O(n^2)`.

## Useful list methods

```csharp
var numbers = new List<int> { 5, 3, 8, 1, 9 };

numbers.Sort();                              // in place, O(n log n)
numbers.Reverse();                           // in place, O(n)
numbers.AddRange(new[] { 10, 11 });          // O(m)
numbers.InsertRange(0, new[] { -1, 0 });     // O(n + m)
bool any = numbers.Exists(n => n > 8);       // O(n)
int found = numbers.Find(n => n > 8);        // O(n), 0 if none
var slice = numbers.GetRange(1, 3);          // O(m), a new list
int[] array = numbers.ToArray();             // O(n), a copy
numbers.Clear();                             // O(n), keeps capacity
```

Note `Clear` empties the list but keeps the capacity, so refilling it does not resize again. `TrimExcess` releases the spare room if you really want it back.

## List or array?

Use `List<T>` by default. The growth handling is worth it and indexing costs the same.

Use an array when the size is genuinely fixed, when an API demands one, or when you are counting bytes.

Use a `Queue<T>` if you keep removing from the front, and a `LinkedList<T>` if you keep inserting in the middle. Both of those are `O(n)` on a list and `O(1)` on the right structure.

## Quick recap

- `List<T>` is an array plus spare capacity plus automatic growth.
- `Count` is what you stored, `Capacity` is what fits before the next resize.
- Growth doubles the capacity, giving amortised `O(1)` adds.
- The end of a list is cheap, the front costs `O(n)` every time.
- `Insert(0, ...)` in a loop is the classic accidental `O(n^2)`.
- Use `RemoveAll` rather than `Remove` in a loop.
- Preallocate with `new List<T>(size)` when you know the size.

<code id="code-content" class="language-csharp">
// Count is what you stored, Capacity is what fits before the next resize
var list = new List&lt;int&gt;();
int capacity = list.Capacity;
for (int i = 1; i &lt;= 100; i++)
{
    list.Add(i);
    if (list.Capacity != capacity)
    {
        Console.WriteLine($"item {i}: {capacity} -&gt; {list.Capacity}");
        capacity = list.Capacity;
    }
}
// 0-&gt;4, 4-&gt;8, 8-&gt;16, 16-&gt;32, 32-&gt;64, 64-&gt;128 : doubling gives amortised O(1)
// Know the size? Preallocate and skip every resize.
var sized = new List&lt;int&gt;(1000);
// The end is cheap, the front is expensive
var items = new List&lt;string&gt; { "a", "b", "c" };
items.Add("d");                    // O(1) amortised
items.RemoveAt(items.Count - 1);   // O(1), nothing shifts
items.Insert(0, "start");          // O(n), everything shifts right
items.RemoveAt(0);                 // O(n), everything shifts left
// The classic accidental O(n^2)
var source = Enumerable.Range(1, 5).ToArray();
var slow = new List&lt;int&gt;();
foreach (int n in source) slow.Insert(0, n);      // shifts on every insert
// The O(n) version
var fast = new List&lt;int&gt;(source);
fast.Reverse();
Console.WriteLine(string.Join(",", fast));        // 5,4,3,2,1
// Removing while iterating throws. Use RemoveAll instead.
var numbers = new List&lt;int&gt; { 1, -2, 3, -4, 5 };
numbers.RemoveAll(n =&gt; n &lt; 0);                    // one pass, O(n)
Console.WriteLine(string.Join(",", numbers));     // 1,3,5
// Or loop backwards so removals never move unseen items
for (int i = numbers.Count - 1; i &gt;= 0; i--)
    if (numbers[i] % 2 == 0) numbers.RemoveAt(i);
Console.WriteLine(string.Join(",", numbers));     // 1,3,5
</code></pre>
