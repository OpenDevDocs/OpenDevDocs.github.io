---
publishDate: 2026-07-02T08:40
title: Space Complexity
slug: space-complexity
metadescription: Understand the memory side of an algorithm, tell auxiliary space from total space, and see why recursion costs memory you did not allocate.
updateDate: 2026-09-07T08:40
author: ['bishal-biswas']
level: 1
tags: ['complexity', 'memory', 'fundamentals']
course: dsa
---

## Memory is a cost too

Time complexity asks how the work grows. **Space complexity** asks how the memory grows.

Both use Big O and both follow the same rules. The only difference is what you count.

This matters more than it looks. A method that is fast but allocates a copy of a huge dataset can crash a server that a slower, leaner method would have survived.

## Auxiliary space

Almost always, when someone says "the space complexity", they mean **auxiliary space**: the extra memory the algorithm uses on top of the input.

The input itself is not counted, because you had to have it either way.

```csharp
static int Sum(int[] numbers)
{
    int total = 0;                     // one int, regardless of input size
    foreach (int n in numbers) total += n;
    return total;
}
```

The array might hold a million items, but this method allocates one `int`. Auxiliary space is `O(1)`.

## O(1) space, constant

The extra memory does not grow with the input.

```csharp
static void Reverse(int[] numbers)
{
    int left = 0, right = numbers.Length - 1;

    while (left < right)
    {
        (numbers[left], numbers[right]) = (numbers[right], numbers[left]);
        left++;
        right--;
    }
}
```

Two `int` variables and a swap. Nothing here grows. This is called reversing **in place**.

## O(n) space, linear

You allocate something that grows with the input.

```csharp
static int[] ReverseCopy(int[] numbers)
{
    var result = new int[numbers.Length];   // grows with the input

    for (int i = 0; i < numbers.Length; i++)
    {
        result[i] = numbers[numbers.Length - 1 - i];
    }

    return result;
}
```

Same job, but now you hold two full arrays at once. Time is still `O(n)`, space went from `O(1)` to `O(n)`.

Neither version is better. The in place one is leaner, the copying one does not destroy the original. Pick based on what the caller needs.

## The classic trade

Speeding code up almost always costs memory. Here is the trade in its purest form:

```csharp
// O(1) space, O(n^2) time
static bool HasDuplicateSlow(int[] numbers)
{
    for (int i = 0; i < numbers.Length; i++)
    {
        for (int j = i + 1; j < numbers.Length; j++)
        {
            if (numbers[i] == numbers[j]) return true;
        }
    }
    return false;
}

// O(n) space, O(n) time
static bool HasDuplicateFast(int[] numbers)
{
    var seen = new HashSet<int>();          // grows with the input
    foreach (int n in numbers)
    {
        if (!seen.Add(n)) return true;
    }
    return false;
}
```

The fast version is normally the right call. But if you are processing a 20 gigabyte file on a machine with 8 gigabytes of memory, the slow one is the only one that runs.

## Recursion uses memory you did not allocate

This catches people out. Every recursive call keeps its own local variables and return address on the call stack, and that stack is memory.

```csharp
static int Factorial(int n)
{
    if (n <= 1) return 1;
    return n * Factorial(n - 1);
}
```

`Factorial(1000)` puts 1,000 frames on the stack before any of them return. There is no `new` anywhere in this method, but its space complexity is `O(n)`.

The loop version is `O(1)` space:

```csharp
static long FactorialLoop(int n)
{
    long result = 1;
    for (int i = 2; i <= n; i++) result *= i;
    return result;
}
```

The call stack is also much smaller than the heap, typically a megabyte or so. Recurse a few hundred thousand deep and you get a `StackOverflowException`, which cannot be caught.

## Recursion depth, not call count

The space is set by how **deep** the recursion goes, not how many calls happen in total.

```csharp
static int Fib(int n)
{
    if (n <= 1) return n;
    return Fib(n - 1) + Fib(n - 2);
}
```

`Fib(30)` makes over a million calls, but never more than 30 frames are alive at once. Time is `O(2^n)`, space is only `O(n)`.

For a balanced binary tree with `n` nodes, the depth is about `log n`, so recursive traversal is `O(log n)` space. For a tree shaped like a straight line, the depth is `n`, so it is `O(n)`.

## Space in the sorting algorithms

This is where space complexity decides real choices.

```text
Algorithm        Time            Auxiliary space
Bubble sort      O(n^2)          O(1)
Insertion sort   O(n^2)          O(1)
Merge sort       O(n log n)      O(n)
Quick sort       O(n log n)      O(log n) for the call stack
Heap sort        O(n log n)      O(1)
Counting sort    O(n + k)        O(k)
```

Merge sort needs a full extra array to merge into. Quick sort sorts in place and only pays for its recursion. That is a large part of why `Array.Sort` uses a quick sort variant.

## Watching out for hidden allocations

LINQ allocates. Each step that materialises a result copies the data.

```csharp
// Three full copies of the data
var result = numbers.Where(n => n > 0).ToList()
                    .Select(n => n * 2).ToList()
                    .OrderBy(n => n).ToList();

// One copy, the query stays lazy until the end
var better = numbers.Where(n => n > 0)
                    .Select(n => n * 2)
                    .OrderBy(n => n)
                    .ToList();
```

`ToList` and `ToArray` are the allocation points. Call them once, at the end.

`Substring`, `ToUpper`, `Split` and string `+=` all allocate new strings too.

## Measuring memory

```csharp
long before = GC.GetTotalMemory(true);

var copy = numbers.ToArray();

long after = GC.GetTotalMemory(true);
Console.WriteLine($"Used about {after - before} bytes");
```

Rough, but good enough to confirm that a change did what you expected.

## Quick recap

- Space complexity measures how extra memory grows with the input.
- Auxiliary space excludes the input itself, and is what people usually mean.
- In place algorithms are `O(1)` space, copying ones are `O(n)`.
- Speed is usually bought with memory, and a hash set is the common purchase.
- Recursion costs `O(depth)` stack space even with no allocations.
- Merge sort needs `O(n)` extra space, quick sort and heap sort do not.
- `ToList` and `ToArray` are where LINQ allocates, so call them once.

<code id="code-content" class="language-csharp">
// O(1) auxiliary space: reverse in place, two variables only
static void ReverseInPlace(int[] numbers)
{
    int left = 0, right = numbers.Length - 1;
    while (left &lt; right)
    {
        (numbers[left], numbers[right]) = (numbers[right], numbers[left]);
        left++; right--;
    }
}
// O(n) auxiliary space: same job, but a second array exists
static int[] ReverseCopy(int[] numbers)
{
    var result = new int[numbers.Length];
    for (int i = 0; i &lt; numbers.Length; i++)
        result[i] = numbers[numbers.Length - 1 - i];
    return result;
}
// The classic trade: memory buys speed
static bool DuplicateSlow(int[] n)      // O(n^2) time, O(1) space
{
    for (int i = 0; i &lt; n.Length; i++)
        for (int j = i + 1; j &lt; n.Length; j++)
            if (n[i] == n[j]) return true;
    return false;
}
static bool DuplicateFast(int[] n)      // O(n) time, O(n) space
{
    var seen = new HashSet&lt;int&gt;();
    foreach (int x in n) if (!seen.Add(x)) return true;
    return false;
}
// Recursion costs stack memory even with no allocations
static int Factorial(int n) =&gt; n &lt;= 1 ? 1 : n * Factorial(n - 1);   // O(n) space
static long FactorialLoop(int n)                                    // O(1) space
{
    long result = 1;
    for (int i = 2; i &lt;= n; i++) result *= i;
    return result;
}
// LINQ allocates at ToList / ToArray, so call them once at the end
var numbers = new[] { 3, -1, 4, 1, 5 };
var better = numbers.Where(n =&gt; n &gt; 0).Select(n =&gt; n * 2).OrderBy(n =&gt; n).ToList();
Console.WriteLine(string.Join(", ", better));   // 2, 6, 8, 10
// Rough measurement
long before = GC.GetTotalMemory(true);
var copy = numbers.ToArray();
Console.WriteLine($"about {GC.GetTotalMemory(true) - before} bytes");
</code></pre>
