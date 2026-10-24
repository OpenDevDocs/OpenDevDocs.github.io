---
publishDate: 2026-07-13T12:40
title: Recursion Fundamentals
slug: recursion-fundamentals
metadescription: Learn to write a recursive method that terminates, how the base case and the shrinking step work together, and when recursion is the wrong tool.
updateDate: 2026-09-07T12:40
author: ['bishal-biswas']
level: 1
tags: ['recursion', 'fundamentals', 'functions']
course: dsa
---

## A method that calls itself

Recursion is a method solving a problem by calling itself on a smaller version of the same problem.

```csharp
static int Countdown(int n)
{
    if (n <= 0)
    {
        Console.WriteLine("Liftoff");
        return 0;
    }

    Console.WriteLine(n);
    return Countdown(n - 1);
}

Countdown(3);
// 3
// 2
// 1
// Liftoff
```

Two parts are doing all the work, and every recursive method needs both.

**The base case** is the version small enough to answer directly. Here it is `n <= 0`.

**The recursive case** does a little work and calls itself with a smaller input. Here it is `Countdown(n - 1)`.

Miss the base case and it never stops. Fail to shrink the input and it also never stops.

## Factorial

```csharp
static long Factorial(int n)
{
    if (n <= 1) return 1;             // base case
    return n * Factorial(n - 1);      // recursive case
}

Console.WriteLine(Factorial(5));   // 120
```

Follow `Factorial(4)` through:

```text
Factorial(4)
  = 4 * Factorial(3)
  = 4 * (3 * Factorial(2))
  = 4 * (3 * (2 * Factorial(1)))
  = 4 * (3 * (2 * 1))
  = 24
```

The calls go all the way down to the base case, and only then do the multiplications happen on the way back up. Nothing is calculated until the deepest call returns.

## Trusting the recursion

The hardest part of learning recursion is resisting the urge to trace every call in your head. It does not scale past three levels and it is not necessary.

Instead, assume the recursive call already works.

```csharp
static int Sum(int[] numbers, int index = 0)
{
    if (index == numbers.Length) return 0;                 // nothing left

    return numbers[index] + Sum(numbers, index + 1);       // this item plus the rest
}
```

Read it as: "the sum is this item plus the sum of the rest". If you believe `Sum` works on the rest, the whole thing is obviously correct. That is not a shortcut, it is exactly how induction works.

Three questions are enough:

1. Is there a base case that returns without recursing?
2. Does every recursive call get a strictly smaller input?
3. If the recursive call gives the right answer, does my combination step give the right answer?

Yes to all three means it works.

## Reversing a string

```csharp
static string Reverse(string text)
{
    if (text.Length <= 1) return text;

    return Reverse(text[1..]) + text[0];
}

Console.WriteLine(Reverse("hello"));   // olleh
```

"The reverse is the reverse of everything after the first character, with the first character stuck on the end." One sentence, one line.

Note that `text[1..]` allocates a new string each call, so this is `O(n^2)` in memory traffic. Elegant, not efficient. A loop with two indexes is the practical version.

## When recursion is the right shape

Recursion fits when the data or the problem is itself nested.

**Trees.** A tree node holds subtrees, which are trees. Loops need an explicit stack to handle this. Recursion does not.

```csharp
static int CountNodes(TreeNode? node)
{
    if (node == null) return 0;
    return 1 + CountNodes(node.Left) + CountNodes(node.Right);
}
```

**Directories.** A folder contains folders.

```csharp
static long TotalSize(DirectoryInfo directory)
{
    long total = directory.GetFiles().Sum(f => f.Length);

    foreach (var subdirectory in directory.GetDirectories())
    {
        total += TotalSize(subdirectory);
    }

    return total;
}
```

**Divide and conquer.** Split in half, solve both halves, combine. Merge sort, quick sort and binary search are all this shape.

**Backtracking.** Try an option, recurse, undo it, try the next. Covered in its own topic.

## When a loop is better

If the problem is a straight sequence, use a loop. It is faster, uses no stack, and is usually easier to read.

```csharp
// Recursive: O(n) stack space, and it can overflow
static long FactorialRecursive(int n) => n <= 1 ? 1 : n * FactorialRecursive(n - 1);

// Iterative: O(1) space, no limit
static long FactorialLoop(int n)
{
    long result = 1;
    for (int i = 2; i <= n; i++) result *= i;
    return result;
}
```

Both are `O(n)` time. Only one of them throws `StackOverflowException` on a large input.

## The recursion that must not be written

```csharp
static long Fibonacci(int n)
{
    if (n <= 1) return n;
    return Fibonacci(n - 1) + Fibonacci(n - 2);
}
```

Correct, and catastrophically slow. Each call spawns two more, so the work doubles with every increase in `n`.

`Fibonacci(40)` makes over 300 million calls. `Fibonacci(50)` will not finish in your lifetime.

The problem is repetition, not recursion. `Fibonacci(30)` computes `Fibonacci(10)` thousands of times. Remembering results fixes it completely:

```csharp
static long Fibonacci(int n, Dictionary<int, long>? memo = null)
{
    if (n <= 1) return n;

    memo ??= new Dictionary<int, long>();

    if (memo.TryGetValue(n, out long cached)) return cached;

    long result = Fibonacci(n - 1, memo) + Fibonacci(n - 2, memo);
    memo[n] = result;
    return result;
}

Console.WriteLine(Fibonacci(90));   // instant
```

From `O(2^n)` to `O(n)` by adding a dictionary. This is memoisation, and it is the gateway to dynamic programming.

## Multiple base cases

Some problems need more than one stopping condition.

```csharp
static bool IsPalindrome(string text, int left, int right)
{
    if (left >= right) return true;                    // met in the middle
    if (text[left] != text[right]) return false;       // found a mismatch

    return IsPalindrome(text, left + 1, right - 1);
}

Console.WriteLine(IsPalindrome("racecar", 0, 6));   // True
```

Two base cases here. One for success, one for failure.

## Helper methods

Recursive methods often need extra parameters that callers should not have to supply. Wrap them.

```csharp
public static bool IsPalindrome(string text) => Check(text, 0, text.Length - 1);

private static bool Check(string text, int left, int right)
{
    if (left >= right) return true;
    if (text[left] != text[right]) return false;
    return Check(text, left + 1, right - 1);
}
```

The public method is clean, the private one carries the state. This pattern shows up constantly in tree and backtracking code.

## Quick recap

- Every recursive method needs a base case and a step that shrinks the input.
- Trust that the recursive call works, then check the combination step.
- Recursion fits nested data: trees, folders, divide and conquer, backtracking.
- Use a loop for straight sequences, it is faster and cannot overflow.
- Naive Fibonacci is `O(2^n)` because it recomputes the same values endlessly.
- Memoising turns exponential recursion into linear work.
- Wrap a recursive helper in a clean public method.

<code id="code-content" class="language-csharp">
// Every recursive method: a base case, and a step that shrinks the input
static int Countdown(int n)
{
    if (n &lt;= 0) { Console.WriteLine("Liftoff"); return 0; }   // base case
    Console.WriteLine(n);
    return Countdown(n - 1);                                  // shrinks
}
Countdown(3);
// Trust the recursive call: "this item plus the sum of the rest"
static int Sum(int[] numbers, int index = 0) =&gt;
    index == numbers.Length ? 0 : numbers[index] + Sum(numbers, index + 1);
Console.WriteLine(Sum(new[] { 1, 2, 3, 4 }));   // 10
// Recursion fits nested data. A loop would need its own stack here.
static long TotalSize(DirectoryInfo dir)
{
    long total = dir.GetFiles().Sum(f =&gt; f.Length);
    foreach (var sub in dir.GetDirectories()) total += TotalSize(sub);
    return total;
}
// Straight sequence? Use a loop. O(1) space and it cannot overflow.
static long FactorialLoop(int n)
{
    long result = 1;
    for (int i = 2; i &lt;= n; i++) result *= i;
    return result;
}
Console.WriteLine(FactorialLoop(20));
// Naive Fibonacci is O(2^n): every call spawns two more
static long FibSlow(int n) =&gt; n &lt;= 1 ? n : FibSlow(n - 1) + FibSlow(n - 2);
// Memoise and it becomes O(n). Same recursion, one dictionary.
static long Fib(int n, Dictionary&lt;int, long&gt;? memo = null)
{
    if (n &lt;= 1) return n;
    memo ??= new Dictionary&lt;int, long&gt;();
    if (memo.TryGetValue(n, out long cached)) return cached;
    return memo[n] = Fib(n - 1, memo) + Fib(n - 2, memo);
}
Console.WriteLine(Fib(90));                     // instant
// Two base cases: one for success, one for failure
static bool IsPalindrome(string text) =&gt; Check(text, 0, text.Length - 1);
static bool Check(string t, int left, int right)
{
    if (left &gt;= right) return true;             // met in the middle
    if (t[left] != t[right]) return false;      // mismatch
    return Check(t, left + 1, right - 1);
}
Console.WriteLine(IsPalindrome("racecar"));     // True
</code></pre>
