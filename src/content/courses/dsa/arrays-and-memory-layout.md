---
publishDate: 2026-07-03T09:00
title: Arrays and Memory Layout
slug: arrays-and-memory-layout
metadescription: See how an array actually sits in memory, why indexing is instant, and why a fixed size is the price you pay for that speed.
updateDate: 2026-09-07T09:00
author: ['bishal-biswas']
level: 1
tags: ['arrays', 'memory', 'fundamentals']
course: dsa
---

## A row of boxes

An array is a block of memory big enough to hold a fixed number of items, all the same type, one after another with no gaps.

```csharp
int[] numbers = { 10, 20, 30, 40, 50 };
```

If each `int` takes 4 bytes and the block starts at address 1000, then memory looks like this:

```text
index      0      1      2      3      4
value     10     20     30     40     50
address 1000   1004   1008   1012   1016
```

The addresses go up by 4 every time, because that is the size of an `int`.

## Why indexing is instant

Because the items are evenly spaced, the computer can calculate any address instead of searching for it:

```text
address of item i  =  start address  +  (i * size of one item)
```

For `numbers[3]`: `1000 + (3 * 4) = 1012`.

One multiplication and one addition. It does not matter whether the array has five items or five million. That is what `O(1)` access means, and it is the single biggest reason arrays are everywhere.

```csharp
int[] small = new int[5];
int[] huge = new int[5_000_000];

int a = small[4];         // same cost
int b = huge[4_999_999];  // as this
```

## Creating arrays

```csharp
int[] a = new int[5];                  // five zeros
int[] b = { 1, 2, 3, 4, 5 };           // values given
int[] c = new int[] { 1, 2, 3 };       // the long form
string[] names = new string[3];        // three nulls
bool[] flags = new bool[3];            // three falses
```

A new array is never uninitialised in C#. Numbers start at zero, booleans at false, and reference types at null.

## Reading and writing

```csharp
int[] numbers = { 10, 20, 30, 40, 50 };

Console.WriteLine(numbers[0]);              // 10
Console.WriteLine(numbers[numbers.Length - 1]);  // 50, the last item
Console.WriteLine(numbers[^1]);             // 50, the same thing, newer syntax

numbers[2] = 99;
Console.WriteLine(numbers[2]);              // 99

Console.WriteLine(numbers.Length);          // 5, stored, not counted
```

Indexes start at 0, so the last one is `Length - 1`. Going outside that throws:

```csharp
try
{
    Console.WriteLine(numbers[5]);
}
catch (IndexOutOfRangeException)
{
    Console.WriteLine("There is no index 5 in a 5 item array");
}
```

This check happens on every access. It costs a little, and it is the reason a stray index gives you an exception instead of silently reading someone else's memory.

## The fixed size

The block of memory is reserved once. It cannot grow, because whatever sits after it in memory belongs to something else.

```csharp
int[] numbers = new int[3];
// numbers[3] = 40;   // no room, this throws
```

To "grow" an array you allocate a bigger one and copy:

```csharp
int[] numbers = { 1, 2, 3 };

var bigger = new int[numbers.Length + 1];
Array.Copy(numbers, bigger, numbers.Length);
bigger[3] = 4;

numbers = bigger;
Console.WriteLine(string.Join(", ", numbers));   // 1, 2, 3, 4
```

That copy is `O(n)`. Doing it once per item added is `O(n^2)`, which is exactly why `List<T>` exists and doubles its capacity instead.

`Array.Resize` does the same thing in one line, and it is worth knowing it is not free:

```csharp
Array.Resize(ref numbers, 10);   // allocates a new array and copies
```

## Insert and remove are expensive

Because there are no gaps, inserting in the middle means moving everything after it.

```csharp
static int[] InsertAt(int[] source, int index, int value)
{
    var result = new int[source.Length + 1];

    Array.Copy(source, 0, result, 0, index);                    // before
    result[index] = value;                                      // the new item
    Array.Copy(source, index, result, index + 1, source.Length - index);   // after

    return result;
}

var data = new[] { 1, 2, 4, 5 };
Console.WriteLine(string.Join(", ", InsertAt(data, 2, 3)));   // 1, 2, 3, 4, 5
```

Insert and remove are both `O(n)`. Arrays are excellent at reading and poor at reshaping.

## Cache friendliness

There is a second reason arrays are fast, and it is not in the Big O.

Processors read memory in blocks, typically 64 bytes at a time, into a small fast cache. Because array items sit next to each other, reading item 0 pulls items 1 through 15 in for free.

That is why looping over an array beats looping over a linked list holding the same values, even though both are `O(n)`.

```csharp
// Every item is already nearby in memory
int total = 0;
foreach (int n in numbers) total += n;
```

Walking an array in order is one of the fastest things a program can do.

## Reference types hold references

An array of objects stores references, not the objects themselves.

```csharp
string[] names = { "Asha", "Ravi", "Meera" };
```

The array holds three references of the same size, each pointing at a string somewhere else in memory. The strings themselves are different lengths, and that is fine, because the array only stores the pointers.

This is also why copying such an array copies the references:

```csharp
var original = new[] { new int[] { 1, 2 }, new int[] { 3, 4 } };
var copy = (int[][])original.Clone();

copy[0][0] = 99;
Console.WriteLine(original[0][0]);   // 99, both point at the same inner array
```

`Clone` gives you a shallow copy. For value types like `int` that is a real copy. For reference types it is not.

## Useful array methods

```csharp
int[] numbers = { 5, 3, 8, 1, 9 };

Array.Sort(numbers);                       // 1, 3, 5, 8, 9
Array.Reverse(numbers);                    // 9, 8, 5, 3, 1
int index = Array.IndexOf(numbers, 5);     // 2
Array.Fill(numbers, 0);                    // 0, 0, 0, 0, 0
Array.Clear(numbers);                      // all back to default

int[] copy = numbers.ToArray();            // a fresh array
int[] slice = numbers[1..4];               // items 1, 2 and 3
```

`Array.Sort` and `Array.Reverse` change the array you pass in. `ToArray` and slicing make new ones.

## When to use a plain array

Use an array when the size is known and fixed, when you need the leanest possible memory, or when you are working with an API that expects one.

Use `List<T>` the rest of the time. It is an array underneath with the growing handled for you.

## Quick recap

- An array is a contiguous block of equally sized slots.
- Index access is `O(1)` because the address is calculated, not searched for.
- The size is fixed, and growing means allocating and copying, which is `O(n)`.
- Insert and remove in the middle shift everything after them.
- Items sitting next to each other makes arrays very cache friendly.
- Arrays of reference types hold references, so `Clone` is a shallow copy.
- Reach for `List<T>` unless you specifically need a fixed size.

<code id="code-content" class="language-csharp">
// A contiguous block, so any index is one calculation away
int[] numbers = { 10, 20, 30, 40, 50 };
// address of item i = start + (i * size of item)  =&gt;  O(1) always
Console.WriteLine(numbers[3]);              // 40
Console.WriteLine(numbers[^1]);             // 50, last item
Console.WriteLine(numbers.Length);          // 5, stored not counted
// Out of range throws instead of reading someone else's memory
try { Console.WriteLine(numbers[5]); }
catch (IndexOutOfRangeException) { Console.WriteLine("no index 5"); }
// Fixed size: growing means allocate a bigger block and copy
int[] small = { 1, 2, 3 };
var bigger = new int[small.Length + 1];
Array.Copy(small, bigger, small.Length);
bigger[3] = 4;
Console.WriteLine(string.Join(", ", bigger));   // 1, 2, 3, 4
Array.Resize(ref small, 10);                    // same work, one line, still O(n)
// Insert in the middle shifts everything after it: O(n)
static int[] InsertAt(int[] source, int index, int value)
{
    var result = new int[source.Length + 1];
    Array.Copy(source, 0, result, 0, index);
    result[index] = value;
    Array.Copy(source, index, result, index + 1, source.Length - index);
    return result;
}
Console.WriteLine(string.Join(", ", InsertAt(new[] { 1, 2, 4, 5 }, 2, 3)));  // 1,2,3,4,5
// Clone is shallow: inner arrays are shared
var grid = new[] { new[] { 1, 2 }, new[] { 3, 4 } };
var copy = (int[][])grid.Clone();
copy[0][0] = 99;
Console.WriteLine(grid[0][0]);              // 99
// The methods worth remembering
int[] values = { 5, 3, 8, 1, 9 };
Array.Sort(values);                          // 1 3 5 8 9, in place
Array.Reverse(values);                       // 9 8 5 3 1, in place
Console.WriteLine(Array.IndexOf(values, 5)); // 2
Console.WriteLine(string.Join(",", values[1..4]));  // 8,5,3
</code></pre>
