---
publishDate: 2026-07-11T11:50
title: Monotonic Stack
slug: monotonic-stack
metadescription: Keep a stack in sorted order to answer next greater element, daily temperatures and largest rectangle questions in linear time.
updateDate: 2026-09-07T11:50
author: ['bishal-biswas']
level: 3
tags: ['stack', 'patterns', 'advanced']
course: dsa
---

## A stack with a rule

A **monotonic stack** is an ordinary stack with one extra rule: the values in it always increase, or always decrease, from bottom to top.

Keeping that rule means popping anything that would break it before pushing. Those pops are not wasted work. Each pop is the moment you learn an answer.

The result is a whole family of problems that look like they need nested loops but run in `O(n)`.

## The problem it solves

For every element, find the next element to its right that is larger.

```text
input:   2  1  2  4  3
answer:  4  2  4 -1 -1
```

The obvious solution:

```csharp
static int[] NextGreaterSlow(int[] numbers)
{
    var result = new int[numbers.Length];

    for (int i = 0; i < numbers.Length; i++)
    {
        result[i] = -1;

        for (int j = i + 1; j < numbers.Length; j++)
        {
            if (numbers[j] > numbers[i])
            {
                result[i] = numbers[j];
                break;
            }
        }
    }

    return result;
}
```

`O(n^2)`. Fine for small arrays, painful for large ones.

## The monotonic version

Keep a stack of indexes whose values are still waiting for an answer. Because anything that already had its answer has been popped, the values left in the stack are always decreasing.

```csharp
static int[] NextGreater(int[] numbers)
{
    var result = new int[numbers.Length];
    Array.Fill(result, -1);

    var waiting = new Stack<int>();     // indexes, not values

    for (int i = 0; i < numbers.Length; i++)
    {
        while (waiting.Count > 0 && numbers[waiting.Peek()] < numbers[i])
        {
            result[waiting.Pop()] = numbers[i];   // numbers[i] is the answer for that index
        }

        waiting.Push(i);
    }

    return result;                      // anything still waiting keeps -1
}

Console.WriteLine(string.Join(", ", NextGreater(new[] { 2, 1, 2, 4, 3 })));
// 4, 2, 4, -1, -1
```

Read the `while` loop as: "the number I just arrived at is larger than the top of the stack, so it is that index's answer".

Anything left in the stack at the end never found a larger value, so it keeps `-1`.

## Why it is O(n)

There is a loop inside a loop, but each index is pushed exactly once and popped at most once. That is `2n` operations total, so `O(n)`.

This is the same argument as the sliding window. A nested loop is only quadratic if the inner work can repeat for the same items.

## Storing indexes, not values

Push indexes rather than values. It costs nothing, since `numbers[index]` gives the value back, and it lets you answer distance questions.

Daily temperatures: how many days until it gets warmer?

```csharp
static int[] DaysUntilWarmer(int[] temperatures)
{
    var result = new int[temperatures.Length];
    var waiting = new Stack<int>();

    for (int i = 0; i < temperatures.Length; i++)
    {
        while (waiting.Count > 0 && temperatures[waiting.Peek()] < temperatures[i])
        {
            int day = waiting.Pop();
            result[day] = i - day;      // the distance, not the value
        }

        waiting.Push(i);
    }

    return result;
}

Console.WriteLine(string.Join(", ", DaysUntilWarmer(new[] { 73, 74, 75, 71, 69, 72, 76, 73 })));
// 1, 1, 4, 2, 1, 1, 0, 0
```

Identical structure, one line different.

## Increasing or decreasing?

Only the comparison changes.

```csharp
// Stack values decrease from bottom to top, finds the NEXT GREATER
while (stack.Count > 0 && numbers[stack.Peek()] < numbers[i]) ...

// Stack values increase from bottom to top, finds the NEXT SMALLER
while (stack.Count > 0 && numbers[stack.Peek()] > numbers[i]) ...
```

And to search leftwards instead of rightwards, walk the array backwards:

```csharp
static int[] PreviousSmaller(int[] numbers)
{
    var result = new int[numbers.Length];
    Array.Fill(result, -1);

    var stack = new Stack<int>();

    for (int i = numbers.Length - 1; i >= 0; i--)
    {
        while (stack.Count > 0 && numbers[stack.Peek()] > numbers[i])
        {
            result[stack.Pop()] = numbers[i];
        }

        stack.Push(i);
    }

    return result;
}
```

Four combinations, one template: next or previous, greater or smaller.

## Circular arrays

When the array wraps, walk it twice and use `% length`, pushing only during the first pass.

```csharp
static int[] NextGreaterCircular(int[] numbers)
{
    int n = numbers.Length;
    var result = new int[n];
    Array.Fill(result, -1);

    var stack = new Stack<int>();

    for (int pass = 0; pass < 2 * n; pass++)
    {
        int i = pass % n;

        while (stack.Count > 0 && numbers[stack.Peek()] < numbers[i])
        {
            result[stack.Pop()] = numbers[i];
        }

        if (pass < n) stack.Push(i);    // only push on the first lap
    }

    return result;
}

Console.WriteLine(string.Join(", ", NextGreaterCircular(new[] { 1, 2, 1 })));
// 2, -1, 2
```

The second lap resolves anything that had to wrap around. Pushing again on the second lap would leave stale entries behind.

## Largest rectangle in a histogram

The hardest classic, and the clearest demonstration of the technique.

Given bar heights, find the largest rectangle that fits inside them.

```csharp
static int LargestRectangle(int[] heights)
{
    var stack = new Stack<int>();     // indexes with increasing heights
    int best = 0;

    for (int i = 0; i <= heights.Length; i++)
    {
        int current = i == heights.Length ? 0 : heights[i];   // sentinel flushes the stack

        while (stack.Count > 0 && heights[stack.Peek()] > current)
        {
            int height = heights[stack.Pop()];
            int left = stack.Count == 0 ? -1 : stack.Peek();
            int width = i - left - 1;

            best = Math.Max(best, height * width);
        }

        stack.Push(i);
    }

    return best;
}

Console.WriteLine(LargestRectangle(new[] { 2, 1, 5, 6, 2, 3 }));   // 10
```

When a bar is popped, you know both of its limits. The current index `i` is the first bar to its right that is shorter, and the new stack top is the first bar to its left that is shorter. So the popped bar's rectangle can stretch exactly between them.

The trailing `0` sentinel is what forces every remaining bar out of the stack at the end. Without it, an increasing histogram gives the wrong answer.

## Recognising the pattern

Reach for a monotonic stack when a problem asks for:

- The **next** or **previous** element that is **greater** or **smaller**.
- How far until some condition becomes true.
- The span or range over which an element is the maximum or minimum.
- Rectangle and area problems over heights.

The signal is a nested loop where the inner loop scans for the first element satisfying a comparison.

## Quick recap

- A monotonic stack keeps its values always increasing or always decreasing.
- Popping is not waste, each pop is the moment an answer is found.
- Each index is pushed once and popped once, so the whole scan is `O(n)`.
- Store indexes, so you can answer both value and distance questions.
- Flip the comparison for smaller instead of greater, reverse the loop for previous instead of next.
- Circular problems walk twice and push only on the first lap.
- A sentinel value at the end flushes anything still on the stack.

<code id="code-content" class="language-csharp">
// Next greater element in O(n) instead of O(n^2)
static int[] NextGreater(int[] numbers)
{
    var result = new int[numbers.Length];
    Array.Fill(result, -1);
    var waiting = new Stack&lt;int&gt;();          // indexes still without an answer
    for (int i = 0; i &lt; numbers.Length; i++)
    {
        while (waiting.Count &gt; 0 &amp;&amp; numbers[waiting.Peek()] &lt; numbers[i])
            result[waiting.Pop()] = numbers[i];   // each pop is an answer found
        waiting.Push(i);
    }
    return result;                            // anything left keeps -1
}
Console.WriteLine(string.Join(",", NextGreater(new[] { 2, 1, 2, 4, 3 })));  // 4,2,4,-1,-1
// Same shape, distance instead of value: days until it gets warmer
static int[] DaysUntilWarmer(int[] temps)
{
    var result = new int[temps.Length];
    var waiting = new Stack&lt;int&gt;();
    for (int i = 0; i &lt; temps.Length; i++)
    {
        while (waiting.Count &gt; 0 &amp;&amp; temps[waiting.Peek()] &lt; temps[i])
        {
            int day = waiting.Pop();
            result[day] = i - day;            // storing indexes pays off here
        }
        waiting.Push(i);
    }
    return result;
}
Console.WriteLine(string.Join(",", DaysUntilWarmer(new[] { 73, 74, 75, 71, 69, 72, 76, 73 })));
// 1,1,4,2,1,1,0,0
// Flip the comparison for "next smaller", reverse the loop for "previous"
// while (stack.Count &gt; 0 &amp;&amp; numbers[stack.Peek()] &gt; numbers[i]) ...
// Largest rectangle in a histogram: the popped bar's limits are both known
static int LargestRectangle(int[] heights)
{
    var stack = new Stack&lt;int&gt;();
    int best = 0;
    for (int i = 0; i &lt;= heights.Length; i++)
    {
        int current = i == heights.Length ? 0 : heights[i];   // sentinel flushes
        while (stack.Count &gt; 0 &amp;&amp; heights[stack.Peek()] &gt; current)
        {
            int height = heights[stack.Pop()];
            int left = stack.Count == 0 ? -1 : stack.Peek();
            best = Math.Max(best, height * (i - left - 1));
        }
        stack.Push(i);
    }
    return best;
}
Console.WriteLine(LargestRectangle(new[] { 2, 1, 5, 6, 2, 3 }));   // 10
</code></pre>
