---
publishDate: 2026-07-13T12:50
title: The Call Stack and Stack Overflow
slug: the-call-stack-and-stack-overflow
metadescription: See what the runtime stores on every method call, why deep recursion crashes, and the three ways to fix it when it does.
updateDate: 2026-09-07T12:50
author: ['bishal-biswas']
level: 2
tags: ['recursion', 'call stack', 'debugging']
course: dsa
---

## What happens on a call

When one method calls another, the runtime pushes a **stack frame** holding:

- the arguments,
- the local variables,
- where to return to when the method finishes.

When the method returns, the frame is popped and its memory is reclaimed instantly.

This is a stack in the exact sense from earlier in this course. Last in, first out.

```csharp
static void A()
{
    Console.WriteLine("A starts");
    B();
    Console.WriteLine("A finishes");
}

static void B()
{
    Console.WriteLine("B starts");
    C();
    Console.WriteLine("B finishes");
}

static void C() => Console.WriteLine("C runs");

A();
```

Output:

```text
A starts
B starts
C runs
B finishes
A finishes
```

`A` cannot finish until `B` does, and `B` cannot finish until `C` does. The frames unwind in reverse order of creation, which is why the output is symmetrical.

## Seeing the stack

An exception's stack trace is literally a printout of the frames.

```csharp
static void Level3() => throw new InvalidOperationException("Something broke");
static void Level2() => Level3();
static void Level1() => Level2();

try
{
    Level1();
}
catch (Exception ex)
{
    Console.WriteLine(ex.StackTrace);
}
```

The trace reads from the deepest frame upward. That is exactly the order the frames sit on the stack.

You can also read it directly:

```csharp
Console.WriteLine(new System.Diagnostics.StackTrace().FrameCount);
```

## The stack is small

The heap grows to fill available memory. The stack does not. Each thread gets a fixed allocation, typically **1 MB** on Windows for a .NET thread.

A frame holding a few `int` variables might be 50 to 100 bytes. So a million bytes gives you somewhere in the region of 10,000 to 20,000 nested calls before it runs out.

That is plenty for normal code and nowhere near enough for a recursive walk over a large list.

## Overflowing it

```csharp
static int Countdown(int n)
{
    if (n <= 0) return 0;
    return 1 + Countdown(n - 1);
}

Console.WriteLine(Countdown(10_000));    // usually fine
Console.WriteLine(Countdown(1_000_000)); // StackOverflowException
```

Two things make a `StackOverflowException` unusual and unpleasant.

**You cannot catch it.** A `try` block will not help. The process terminates immediately.

**There is no useful stack trace,** because printing one would need stack space that no longer exists.

An infinite recursion produces the same crash within milliseconds:

```csharp
static int Broken(int n) => 1 + Broken(n);   // no base case, no shrinking
```

## Depth is what matters, not call count

Space is set by how deep the recursion goes at its deepest point, not by how many calls happen overall.

```csharp
static long Fibonacci(int n)
{
    if (n <= 1) return n;
    return Fibonacci(n - 1) + Fibonacci(n - 2);
}
```

`Fibonacci(30)` makes about 2.7 million calls but never nests more than 30 deep. Time is `O(2^n)`, space is only `O(n)`.

For trees, depth is what decides everything. A balanced tree of a million nodes is only about 20 levels deep, so recursion is completely safe. A tree that has degenerated into a straight line is a million levels deep, and recursion on it will crash.

## Fix one: convert to a loop

If the recursion is a straight sequence, a loop removes the stack entirely.

```csharp
// Recursive: O(n) stack
static long SumToRecursive(int n) => n <= 0 ? 0 : n + SumToRecursive(n - 1);

// Iterative: O(1) stack
static long SumToLoop(int n)
{
    long total = 0;
    for (int i = 1; i <= n; i++) total += i;
    return total;
}
```

## Fix two: use an explicit stack

When the structure is genuinely nested, you cannot flatten it into a simple loop. You can move the stack from the call stack to the heap, where there is far more room.

```csharp
// Recursive tree traversal, limited by stack depth
static void WalkRecursive(TreeNode? node)
{
    if (node == null) return;

    Console.Write(node.Value + " ");
    WalkRecursive(node.Left);
    WalkRecursive(node.Right);
}

// Same traversal, same order, no recursion
static void WalkIterative(TreeNode? root)
{
    if (root == null) return;

    var stack = new Stack<TreeNode>();
    stack.Push(root);

    while (stack.Count > 0)
    {
        var node = stack.Pop();
        Console.Write(node.Value + " ");

        if (node.Right != null) stack.Push(node.Right);   // right first
        if (node.Left != null) stack.Push(node.Left);     // so left pops first
    }
}
```

The push order is reversed, because a stack returns items in the opposite order to how they went in.

A `Stack<T>` lives on the heap, so it can hold millions of entries. This is the standard fix for "recursion works in testing and crashes in production".

## Fix three: give the thread a bigger stack

Occasionally the recursion is correct and simply needs more room.

```csharp
var thread = new Thread(() =>
{
    Console.WriteLine(Countdown(500_000));
}, 64 * 1024 * 1024);        // 64 MB stack

thread.Start();
thread.Join();
```

Treat this as a last resort. It hides the problem rather than solving it, and it does not scale.

## Tail calls

A **tail call** is a recursive call that is the very last thing a method does, with no work left afterwards.

```csharp
// Not a tail call: the multiplication happens after the call returns
static long Factorial(int n) => n <= 1 ? 1 : n * Factorial(n - 1);

// A tail call: nothing happens after the recursive call
static long FactorialTail(int n, long accumulator = 1) =>
    n <= 1 ? accumulator : FactorialTail(n - 1, accumulator * n);
```

In languages that guarantee tail call optimisation, the second version reuses the same frame and never overflows.

**C# does not guarantee this.** The IL has a `.tail` instruction and the JIT sometimes uses it, but you cannot rely on it. Write the loop instead.

## Async is different

`async` methods do not hold a stack frame while awaiting. The state is stored on the heap in a state machine object.

```csharp
static async Task<int> RecursiveAsync(int n)
{
    if (n <= 0) return 0;
    await Task.Yield();
    return 1 + await RecursiveAsync(n - 1);
}
```

This will not blow the stack the way the synchronous version does, though it allocates a state machine per call, which has its own cost.

## Quick recap

- Every method call pushes a frame with arguments, locals and a return address.
- A stack trace is a printout of those frames.
- The stack is typically 1 MB per thread, so roughly 10,000 nested calls.
- `StackOverflowException` cannot be caught and gives no useful trace.
- Recursion depth decides stack usage, not the total number of calls.
- Convert straight recursion to a loop, and nested recursion to an explicit `Stack<T>`.
- C# does not guarantee tail call optimisation, so do not rely on it.

<code id="code-content" class="language-csharp">
// Each call pushes a frame. Frames unwind in reverse, so output is symmetrical.
static void A() { Console.WriteLine("A starts"); B(); Console.WriteLine("A ends"); }
static void B() { Console.WriteLine("B starts"); C(); Console.WriteLine("B ends"); }
static void C() =&gt; Console.WriteLine("C runs");
A();   // A starts, B starts, C runs, B ends, A ends
// A stack trace is literally a printout of those frames
try { throw new InvalidOperationException("boom"); }
catch (Exception ex) { Console.WriteLine(ex.StackTrace); }
// The stack is ~1 MB per thread, so ~10,000 nested calls
static int Countdown(int n) =&gt; n &lt;= 0 ? 0 : 1 + Countdown(n - 1);
Console.WriteLine(Countdown(10_000));      // fine
// Countdown(1_000_000);                   // StackOverflowException, uncatchable
// Fix one: a straight sequence becomes a loop, O(1) stack
static long SumTo(int n)
{
    long total = 0;
    for (int i = 1; i &lt;= n; i++) total += i;
    return total;
}
// Fix two: genuinely nested? Move the stack to the heap.
public class TreeNode
{
    public int Value;
    public TreeNode? Left, Right;
    public TreeNode(int v) =&gt; Value = v;
}
static void Walk(TreeNode? root)
{
    if (root == null) return;
    var stack = new Stack&lt;TreeNode&gt;();
    stack.Push(root);
    while (stack.Count &gt; 0)
    {
        var node = stack.Pop();
        Console.Write(node.Value + " ");
        if (node.Right != null) stack.Push(node.Right);   // push right first
        if (node.Left != null) stack.Push(node.Left);     // so left pops first
    }
}
var root = new TreeNode(1) { Left = new TreeNode(2), Right = new TreeNode(3) };
Walk(root);                                 // 1 2 3
Console.WriteLine();
// Fix three, last resort: give the thread a bigger stack
var thread = new Thread(() =&gt; Console.WriteLine(Countdown(200_000)), 64 * 1024 * 1024);
thread.Start(); thread.Join();
// C# does NOT guarantee tail call optimisation, so write the loop instead
</code></pre>
