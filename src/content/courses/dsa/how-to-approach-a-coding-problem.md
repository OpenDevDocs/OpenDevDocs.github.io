---
publishDate: 2026-07-31T19:20
title: How to Approach a Coding Problem
slug: how-to-approach-a-coding-problem
metadescription: A repeatable method for tackling any algorithm problem, from clarifying the question to testing the edge cases everyone forgets.
updateDate: 2026-09-07T19:20
author: ['bishal-biswas']
level: 2
tags: ['problem solving', 'method', 'interview']
course: dsa
---

## Have a method

Staring at a problem hoping for inspiration is not a strategy. A repeatable process is, and it works whether you are in an interview or fixing a slow endpoint at work.

Six steps.

## 1. Understand the problem

Before writing anything, answer these.

**What exactly is the input?** Type, size, range of values. Sorted or unsorted. Can it be empty or null.

**What exactly is the output?** A value, an index, a list, a boolean. What should happen when there is no answer.

**What are the constraints?** How large can the input get? This decides which complexity is acceptable.

**What is ambiguous?** Duplicates. Negative numbers. Ties. Case sensitivity. Multiple valid answers.

Then work one small example by hand. Not in your head, on paper.

```text
Input:  [2, 7, 11, 15], target 9
Output: [0, 1]          because 2 + 7 = 9

Questions:
- Exactly one answer, or could there be several?
- Can the same index be used twice?
- Are the numbers sorted? (no)
- Negative numbers allowed? (assume yes)
- Return indexes or values? (indexes)
```

Five minutes here saves an hour of solving the wrong problem.

## 2. Read the constraints for a hint

The input size tells you what complexity is expected.

```text
n up to 10           O(n!) or O(2^n) is fine, use backtracking
n up to 20           O(2^n), bitmask dynamic programming
n up to 100          O(n^3) is fine
n up to 1,000        O(n^2) is fine
n up to 100,000      you need O(n log n)
n up to 1,000,000    you need O(n) or O(n log n)
n up to 1,000,000,000 you need O(log n) or O(1)
```

If `n` is 100,000, a nested loop will not pass. That immediately rules out whole families of approaches and points you towards sorting, hashing or a single pass.

The rough rule for a one second budget is about 100 million simple operations.

## 3. Start with brute force

Write the obvious slow solution first, even if you will not keep it.

It proves you understand the problem, it gives you a correct answer to test against, and it usually reveals the wasted work you are about to eliminate.

```csharp
// Brute force: check every pair
static int[] TwoSum(int[] numbers, int target)
{
    for (int i = 0; i < numbers.Length; i++)
    {
        for (int j = i + 1; j < numbers.Length; j++)
        {
            if (numbers[i] + numbers[j] == target) return new[] { i, j };
        }
    }

    return Array.Empty<int>();
}
```

`O(n^2)`. Correct. Now ask what is being repeated.

## 4. Find the wasted work

Almost every optimisation removes one of these.

**Recomputing something you already knew.** Cache it. This is memoisation and dynamic programming.

**Searching when you could look up.** Use a dictionary or a set. This is the most common fix by far.

**Rechecking data you have already passed.** Use two pointers or a sliding window.

**Checking every possibility when you could discard half.** Sort, then binary search.

**Sorting when you only need the extremes.** Use a heap.

For two sum, the waste is obvious. The inner loop searches for `target - numbers[i]`, and searching is what a hash set does instantly.

```csharp
static int[] TwoSum(int[] numbers, int target)
{
    var seen = new Dictionary<int, int>();     // value to index

    for (int i = 0; i < numbers.Length; i++)
    {
        int needed = target - numbers[i];

        if (seen.TryGetValue(needed, out int j)) return new[] { j, i };

        seen[numbers[i]] = i;
    }

    return Array.Empty<int>();
}
```

`O(n)` time, `O(n)` space. The classic trade.

## 5. Match the problem to a pattern

Most problems are variations on something you have already seen.

```text
Signal in the problem                          Reach for
"contiguous subarray or substring"             sliding window
"sorted array" plus "pair" or "target"         two pointers
"sorted" plus "find"                           binary search
"how many ways" or "min/max cost"              dynamic programming
"shortest path", unweighted                    breadth first search
"shortest path", weighted                      Dijkstra
"all combinations" or "all permutations"       backtracking
"top K" or "K largest"                         heap
"prerequisites" or "ordering"                  topological sort
"duplicates" or "have I seen this"             hash set
"next greater" or "next smaller"               monotonic stack
"prefix" or "autocomplete"                     trie
"are these connected"                          union find or BFS
"parentheses", "nesting", "undo"               stack
"first in first out", "level by level"         queue
```

This table is most of what this course has covered. When you meet a problem, run down it.

## 6. Test properly

The bugs are almost always at the edges. Have a standard list and use it every time.

**Empty input.**

```csharp
TwoSum(Array.Empty<int>(), 9);
```

**One element.**

```csharp
TwoSum(new[] { 5 }, 9);
```

**No valid answer.**

```csharp
TwoSum(new[] { 1, 2 }, 100);
```

**Duplicates.**

```csharp
TwoSum(new[] { 3, 3 }, 6);       // must return [0, 1], not [0, 0]
```

**Negative numbers and zero.**

```csharp
TwoSum(new[] { -3, 4, 3, 90 }, 0);
```

**The answer at the very start and the very end.**

**Already sorted, and sorted backwards.** These are the worst cases for several algorithms.

**Very large input**, to check for overflow and timeouts.

Write these as a loop so running them is free.

```csharp
var cases = new (int[] Numbers, int Target, string Expected)[]
{
    (Array.Empty<int>(), 9, "empty"),
    (new[] { 5 }, 9, "empty"),
    (new[] { 3, 3 }, 6, "0,1"),
    (new[] { 2, 7, 11, 15 }, 9, "0,1"),
    (new[] { -3, 4, 3, 90 }, 0, "0,2")
};

foreach (var (numbers, target, expected) in cases)
{
    string actual = string.Join(",", TwoSum(numbers, target));
    if (actual == "") actual = "empty";

    Console.WriteLine($"{(actual == expected ? "pass" : "FAIL")}  got {actual}");
}
```

## Talking through it

If someone is watching, narrate. Silence tells them nothing about how you think.

Say what you are considering and why you are rejecting it. "I could sort first, but that loses the original indexes, and the problem asks for indexes. So a hash map is better here."

Ask when you are unsure rather than assuming. A clarifying question is a good signal, not a bad one.

State the complexity when you finish, and say whether you think it can be improved.

## When you are stuck

**Solve a simpler version.** Ignore a constraint. Solve it for two elements instead of `n`. The general answer often falls out.

**Work a bigger example by hand.** Patterns show up at size five that were invisible at size two.

**Ask what the brute force wastes.** That question alone unlocks most problems.

**Try the other direction.** Backwards through the array. From the goal to the start. Building the answer instead of searching for it.

**Say the problem out loud in plain words.** "I need to find the first thing to the right that is bigger." That phrasing points straight at a monotonic stack in a way the original wording did not.

## The habits that matter at work

The same method applies outside interviews.

**Measure before optimising.** The slow part is rarely where you think it is.

**Know your data sizes.** Code that is fine for 100 rows may be unusable at 100,000, and that is entirely predictable.

**Watch for searches inside loops.** `Contains`, `First`, `Any` and `IndexOf` on a list inside a loop. This is the most common real world performance bug there is.

**Prefer clear code until it is proven slow.** A readable `O(n log n)` beats an unreadable `O(n)` that nobody dares touch.

## Quick recap

- Clarify the input, output, constraints and ambiguities before writing code.
- Let the input size tell you which complexity you need.
- Write the brute force first, then ask what work it repeats.
- Most optimisations replace searching with lookup, or recomputing with caching.
- Match the wording of the problem to a known pattern.
- Test empty, single, duplicate, negative, boundary and sorted inputs every time.
- When stuck, simplify the problem or work a bigger example by hand.

<code id="code-content" class="language-csharp">
// 1. Brute force first. It proves you understand the problem.
static int[] TwoSumSlow(int[] numbers, int target)
{
    for (int i = 0; i &lt; numbers.Length; i++)
        for (int j = i + 1; j &lt; numbers.Length; j++)
            if (numbers[i] + numbers[j] == target) return new[] { i, j };
    return Array.Empty&lt;int&gt;();
}
// 2. Ask what it repeats. Here: searching for target - numbers[i].
// 3. Replace searching with lookup. That is the most common fix there is.
static int[] TwoSum(int[] numbers, int target)
{
    var seen = new Dictionary&lt;int, int&gt;();      // value -&gt; index
    for (int i = 0; i &lt; numbers.Length; i++)
    {
        if (seen.TryGetValue(target - numbers[i], out int j)) return new[] { j, i };
        seen[numbers[i]] = i;
    }
    return Array.Empty&lt;int&gt;();
}
// O(n^2) becomes O(n). Memory buys the speed.
// 4. Let the constraints tell you the target complexity:
//    n &lt;= 20        O(2^n) backtracking is fine
//    n &lt;= 1,000     O(n^2) is fine
//    n &lt;= 100,000   you need O(n log n)
//    n &lt;= 1,000,000 you need O(n)
// 5. Test the edges. Every time, the same list.
var cases = new (int[] Numbers, int Target, string Expected)[]
{
    (Array.Empty&lt;int&gt;(), 9, "empty"),      // empty input
    (new[] { 5 }, 9, "empty"),             // one element
    (new[] { 1, 2 }, 100, "empty"),        // no answer
    (new[] { 3, 3 }, 6, "0,1"),            // duplicates
    (new[] { -3, 4, 3, 90 }, 0, "0,2"),    // negatives and zero
    (new[] { 2, 7, 11, 15 }, 9, "0,1")     // the normal case
};
foreach (var (numbers, target, expected) in cases)
{
    string actual = string.Join(",", TwoSum(numbers, target));
    if (actual == "") actual = "empty";
    Console.WriteLine($"{(actual == expected ? "pass" : "FAIL")}  got {actual}");
}
// 6. Match the wording to a pattern:
//    "contiguous subarray"      -&gt; sliding window
//    "sorted" + "pair"          -&gt; two pointers
//    "how many ways"            -&gt; dynamic programming
//    "shortest path" unweighted -&gt; breadth first search
//    "top K"                    -&gt; heap
//    "next greater"             -&gt; monotonic stack
//    "prerequisites"            -&gt; topological sort
</code></pre>
