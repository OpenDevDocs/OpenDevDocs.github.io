---
publishDate: 2026-04-14T11:24
title: Stack<T>
slug: stack-t
metadescription: Work with last in, first out data using Stack, push and pop items, and apply stacks to undo history, bracket matching, expression evaluation and depth first search.
updateDate: 2026-09-05T11:24
author: ['bishal-biswas']
level: 2
tags: ['collections', 'stack', 'generics']
course: c-sharp
---

## Last in, first out

A stack is a pile of plates. You put a plate on top and you take a plate from the top. The last one added is the first one removed: **LIFO**.

```csharp
var stack = new Stack<string>();
stack.Push("first");
stack.Push("second");
stack.Push("third");

Console.WriteLine(stack.Pop());    // third
Console.WriteLine(stack.Pop());    // second
Console.WriteLine(stack.Count);    // 1
```

- `Push` adds to the top.
- `Pop` removes and returns the top.
- `Peek` returns the top without removing it.

## Safe access

Like a queue, `Pop` and `Peek` throw on an empty stack. Use `Count` or the `Try` methods:

```csharp
var stack = new Stack<int>();

if (stack.TryPop(out int top))
{
    Console.WriteLine(top);
}
else
{
    Console.WriteLine("Nothing to pop");
}

if (stack.TryPeek(out int next)) Console.WriteLine(next);
```

## Iteration order

`foreach` walks from the **top** down, and so does `ToArray`:

```csharp
var stack = new Stack<int>(new[] { 1, 2, 3 });   // 3 is on top

foreach (int n in stack)
{
    Console.Write(n + " ");   // 3 2 1
}
```

Note that filling a stack from a collection pushes the items in order, so the last item ends up on top.

## Undo history

Every editor keeps a stack of actions. Undo pops the most recent one:

```csharp
var history = new Stack<string>();
string text = "";

void Type(string s)
{
    history.Push(text);   // save the state before the change
    text += s;
}

void Undo()
{
    if (history.TryPop(out string? previous)) text = previous;
}

Type("Hello");
Type(" world");
Console.WriteLine(text);   // Hello world
Undo();
Console.WriteLine(text);   // Hello
Undo();
Console.WriteLine(text);   // (empty)
```

A second stack for redo completes the pattern.

## Matching brackets

A classic interview question with a clean stack solution. Push every opening bracket, and when you see a closing one, the top of the stack must be its partner:

```csharp
static bool IsBalanced(string input)
{
    var pairs = new Dictionary<char, char> { [')'] = '(', [']'] = '[', ['}'] = '{' };
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

## Evaluating postfix expressions

Reverse Polish notation puts the operator after its operands. A stack evaluates it in one pass:

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
        int a = stack.Pop();
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

Console.WriteLine(EvaluatePostfix("3 4 + 2 *"));   // 14
```

Notice the order of the two pops. The second operand comes off first.

## Depth first search

Replace the queue in a breadth first search with a stack and you get depth first:

```csharp
var toVisit = new Stack<string>();
toVisit.Push("A");

while (toVisit.Count > 0)
{
    string node = toVisit.Pop();
    if (!visited.Add(node)) continue;
    foreach (string next in graph[node]) toVisit.Push(next);
}
```

## The call stack

The name is not a coincidence. When one method calls another, .NET pushes a frame with the local variables and the return address. When the method returns, the frame is popped. Recursing too deep overflows this stack, which is where `StackOverflowException` gets its name. An explicit `Stack<T>` is often the way to turn a deep recursive algorithm into a loop that cannot overflow.

## Quick recap

- A stack is last in, first out: `Push` on top, `Pop` from the top.
- `Peek` looks without removing, and `TryPop` and `TryPeek` avoid exceptions.
- `foreach` visits from the top down.
- Stacks power undo history, bracket matching and postfix evaluation.
- Swapping a queue for a stack turns breadth first search into depth first.

<code id="code-content" class="language-csharp">
// Stack&lt;T&gt; in C#
// Push on top, Pop from the top
var plates = new Stack&lt;string&gt;();
plates.Push("first");
plates.Push("second");
plates.Push("third");
Console.WriteLine(plates.Peek());      // third
Console.WriteLine(plates.Pop());       // third
Console.WriteLine(plates.Count);       // 2
foreach (string p in plates)
    Console.Write(p + " ");            // second first
Console.WriteLine();
// Undo history
var history = new Stack&lt;string&gt;();
string text = "";
void Type(string s) { history.Push(text); text += s; }
void Undo() { if (history.TryPop(out string? prev)) text = prev; }
Type("Hello");
Type(" world");
Undo();
Console.WriteLine(text);               // Hello
// Bracket matching
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
    return open.Count == 0;
}
Console.WriteLine(IsBalanced("{[()]}"));   // True
Console.WriteLine(IsBalanced("{[(])}"));   // False
// Postfix evaluation
static int Eval(string expr)
{
    var s = new Stack&lt;int&gt;();
    foreach (string t in expr.Split(' '))
    {
        if (int.TryParse(t, out int n)) { s.Push(n); continue; }
        int b = s.Pop(), a = s.Pop();  // second operand comes off first
        s.Push(t == "+" ? a + b : t == "-" ? a - b : t == "*" ? a * b : a / b);
    }
    return s.Pop();
}
Console.WriteLine(Eval("3 4 + 2 *"));      // 14
</code></pre>
