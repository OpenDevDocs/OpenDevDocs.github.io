---
publishDate: 2026-07-09T11:10
title: Stack Data Structure
slug: stack-data-structure
metadescription: Understand last in first out ordering, when a stack is the right tool, and how it powers undo, bracket matching and expression evaluation.
updateDate: 2026-09-07T11:10
author: ['bishal-biswas']
level: 1
tags: ['stack', 'lifo', 'data structures']
course: dsa
---

## A pile of plates

A stack is a pile. You put things on the top, and you take things from the top. The one you added last is the one you get first.

That rule has a name: **LIFO**, last in first out.

```csharp
var stack = new Stack<string>();

stack.Push("first");
stack.Push("second");
stack.Push("third");

Console.WriteLine(stack.Pop());     // third
Console.WriteLine(stack.Peek());    // second, still there
Console.WriteLine(stack.Count);     // 2
```

Three operations do everything:

- **Push** puts an item on top.
- **Pop** removes and returns the top item.
- **Peek** returns the top item without removing it.

All three are `O(1)`.

## The empty stack

`Pop` and `Peek` throw `InvalidOperationException` on an empty stack. Guard with `Count`, or use the `Try` methods.

```csharp
var stack = new Stack<int>();

if (stack.TryPop(out int value)) Console.WriteLine(value);
else Console.WriteLine("Nothing to pop");

if (stack.Count > 0) Console.WriteLine(stack.Peek());
```

`TryPop` and `TryPeek` return `false` instead of throwing, which is usually the cleaner choice inside a loop.

## Iteration order

`foreach` walks from the top down, and so does `ToArray`.

```csharp
var stack = new Stack<int>();
stack.Push(1);
stack.Push(2);
stack.Push(3);

foreach (int n in stack) Console.Write(n + " ");   // 3 2 1
```

Building a stack from a collection pushes the items in order, so the **last** item of the collection ends up on top:

```csharp
var fromArray = new Stack<int>(new[] { 1, 2, 3 });
Console.WriteLine(fromArray.Peek());   // 3
```

That catches people out. If you want the first item on top, reverse the source.

## Matching brackets

The problem a stack was made for. Push every opening bracket. When a closing bracket arrives, the top of the stack must be its partner.

```csharp
static bool IsBalanced(string input)
{
    var pairs = new Dictionary<char, char>
    {
        [')'] = '(',
        [']'] = '[',
        ['}'] = '{'
    };

    var open = new Stack<char>();

    foreach (char c in input)
    {
        if (c is '(' or '[' or '{')
        {
            open.Push(c);
        }
        else if (pairs.TryGetValue(c, out char expected))
        {
            if (open.Count == 0 || open.Pop() != expected) return false;
        }
    }

    return open.Count == 0;
}

Console.WriteLine(IsBalanced("{[()]}"));   // True
Console.WriteLine(IsBalanced("{[(])}"));   // False
Console.WriteLine(IsBalanced("(("));       // False
```

The final `open.Count == 0` matters. Without it, a string of only opening brackets passes.

Every compiler, JSON parser and code editor does a version of this.

## Undo history

Every editor keeps a stack of previous states. Undo pops one.

```csharp
var history = new Stack<string>();
string text = "";

void Type(string s)
{
    history.Push(text);      // save the state before changing it
    text += s;
}

void Undo()
{
    if (history.TryPop(out string? previous)) text = previous;
}

Type("Hello");
Type(" world");
Console.WriteLine(text);     // Hello world

Undo();
Console.WriteLine(text);     // Hello

Undo();
Console.WriteLine(text);     // (empty)
```

Add a second stack for redo and you have the full pattern. Undo pops from history and pushes onto redo, and redo does the reverse.

## Evaluating expressions

Postfix notation puts the operator after its operands, so `3 4 + 2 *` means `(3 + 4) * 2`. A stack evaluates it in one pass.

```csharp
static int EvaluatePostfix(string expression)
{
    var stack = new Stack<int>();

    foreach (string token in expression.Split(' '))
    {
        if (int.TryParse(token, out int number))
        {
            stack.Push(number);
            continue;
        }

        int b = stack.Pop();
        int a = stack.Pop();      // the second operand comes off first

        stack.Push(token switch
        {
            "+" => a + b,
            "-" => a - b,
            "*" => a * b,
            "/" => a / b,
            _ => throw new InvalidOperationException($"Unknown operator {token}")
        });
    }

    return stack.Pop();
}

Console.WriteLine(EvaluatePostfix("3 4 + 2 *"));       // 14
Console.WriteLine(EvaluatePostfix("5 1 2 + 4 * + 3 -"));  // 14
```

The order of the two pops is the classic bug. `b` comes off first because it was pushed second.

## Reversing things

Push everything, pop everything, and you get the reverse for free.

```csharp
static string Reverse(string text)
{
    var stack = new Stack<char>();

    foreach (char c in text) stack.Push(c);

    var builder = new System.Text.StringBuilder();
    while (stack.Count > 0) builder.Append(stack.Pop());

    return builder.ToString();
}

Console.WriteLine(Reverse("hello"));   // olleh
```

Not the fastest way to reverse a string, but it shows the property clearly, and it is exactly how you print a linked list backwards without recursion.

## Depth first search

Replace the queue in a breadth first search with a stack and the traversal goes deep before it goes wide.

```csharp
var graph = new Dictionary<string, string[]>
{
    ["A"] = new[] { "B", "C" },
    ["B"] = new[] { "D" },
    ["C"] = new[] { "D" },
    ["D"] = Array.Empty<string>()
};

var visited = new HashSet<string>();
var toVisit = new Stack<string>();
toVisit.Push("A");

while (toVisit.Count > 0)
{
    string node = toVisit.Pop();
    if (!visited.Add(node)) continue;

    Console.Write(node + " ");

    foreach (string next in graph[node]) toVisit.Push(next);
}
```

`visited.Add` returns `false` if the value was already there, which handles both the check and the insert in one call.

## The call stack

The name is not a coincidence. When one method calls another, the runtime pushes a frame holding the local variables and the return address. Returning pops it.

That is why a deep recursion throws `StackOverflowException`, and why an explicit `Stack<T>` is the standard way to convert a deep recursive algorithm into a loop that cannot overflow.

## When to use one

- Anything with "most recent first" behaviour.
- Undo, back buttons, navigation history.
- Matching or nesting problems, including parsers.
- Converting recursion into iteration.
- Depth first traversal of trees and graphs.

If you catch yourself writing "process the most recently added item next", you want a stack.

## Quick recap

- A stack is last in first out, with `Push`, `Pop` and `Peek` all `O(1)`.
- `Pop` and `Peek` throw when empty, so prefer `TryPop` and `TryPeek`.
- `foreach` and `ToArray` walk from the top down.
- Building a stack from a collection leaves the last item on top.
- Bracket matching needs the final empty check to catch unclosed brackets.
- In postfix evaluation the second operand pops first.
- The call stack is a stack, which is why recursion can be rewritten with one.

<code id="code-content" class="language-csharp">
using System.Text;
// Last in, first out. Push, Pop, Peek are all O(1).
var stack = new Stack&lt;string&gt;();
stack.Push("first"); stack.Push("second"); stack.Push("third");
Console.WriteLine(stack.Pop());        // third
Console.WriteLine(stack.Peek());       // second, not removed
// Empty stacks throw, so prefer the Try methods
var empty = new Stack&lt;int&gt;();
Console.WriteLine(empty.TryPop(out int v) ? v.ToString() : "nothing to pop");
// foreach walks top down
foreach (string s in stack) Console.Write(s + " ");   // second first
Console.WriteLine();
// Bracket matching: push openers, check the top against each closer
static bool IsBalanced(string input)
{
    var pairs = new Dictionary&lt;char, char&gt; { [')'] = '(', [']'] = '[', ['}'] = '{' };
    var open = new Stack&lt;char&gt;();
    foreach (char c in input)
    {
        if (c is '(' or '[' or '{') open.Push(c);
        else if (pairs.TryGetValue(c, out char expected))
            if (open.Count == 0 || open.Pop() != expected) return false;
    }
    return open.Count == 0;            // unclosed brackets fail here
}
Console.WriteLine(IsBalanced("{[()]}"));   // True
Console.WriteLine(IsBalanced("(("));       // False
// Undo history: push the state before every change
var history = new Stack&lt;string&gt;();
string text = "";
void Type(string s) { history.Push(text); text += s; }
void Undo() { if (history.TryPop(out string? prev)) text = prev; }
Type("Hello"); Type(" world"); Undo();
Console.WriteLine(text);               // Hello
// Postfix evaluation: the SECOND operand pops first
static int Eval(string expr)
{
    var s = new Stack&lt;int&gt;();
    foreach (string t in expr.Split(' '))
    {
        if (int.TryParse(t, out int n)) { s.Push(n); continue; }
        int b = s.Pop(), a = s.Pop();
        s.Push(t switch { "+" =&gt; a + b, "-" =&gt; a - b, "*" =&gt; a * b, _ =&gt; a / b });
    }
    return s.Pop();
}
Console.WriteLine(Eval("3 4 + 2 *"));  // 14
</code></pre>
