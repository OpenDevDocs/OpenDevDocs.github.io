---
publishDate: 2026-07-20T15:30
title: Tree Traversals
slug: tree-traversals
metadescription: Visit every node in a tree using preorder, inorder, postorder and level order, and know which order solves which problem.
updateDate: 2026-09-07T15:30
author: ['bishal-biswas']
level: 2
tags: ['trees', 'traversal', 'recursion']
course: dsa
---

## Four orders

There is only one way to walk an array. There are several sensible ways to walk a tree, and each one is the right answer to different questions.

```text
        1
       / \
      2   3
     / \
    4   5
```

- **Preorder:** 1, 2, 4, 5, 3. Node first, then left, then right.
- **Inorder:** 4, 2, 5, 1, 3. Left, then node, then right.
- **Postorder:** 4, 5, 2, 3, 1. Left, then right, then node.
- **Level order:** 1, 2, 3, 4, 5. Top to bottom, left to right.

The first three differ only in **where the node itself is handled**. That is the entire distinction, and it is worth committing to memory.

## The three depth first traversals

```csharp
static void Preorder(TreeNode? node)
{
    if (node == null) return;

    Console.Write(node.Value + " ");   // node first
    Preorder(node.Left);
    Preorder(node.Right);
}

static void Inorder(TreeNode? node)
{
    if (node == null) return;

    Inorder(node.Left);
    Console.Write(node.Value + " ");   // node in the middle
    Inorder(node.Right);
}

static void Postorder(TreeNode? node)
{
    if (node == null) return;

    Postorder(node.Left);
    Postorder(node.Right);
    Console.Write(node.Value + " ");   // node last
}
```

Identical code, one line moved.

## When to use which

**Preorder** processes a node before its children. Use it when the parent must be handled first.

- Copying a tree, since you need a node before you can attach children to it.
- Serialising a tree to a file.
- Printing a directory structure or a document outline.

```csharp
static TreeNode? Copy(TreeNode? node)
{
    if (node == null) return null;

    var copy = new TreeNode(node.Value);      // this node first
    copy.Left = Copy(node.Left);
    copy.Right = Copy(node.Right);

    return copy;
}
```

**Inorder** is the special one. On a **binary search tree** it visits the values in sorted order, which is often the whole reason to use a search tree.

```csharp
static List<int> ToSortedList(TreeNode? node, List<int>? result = null)
{
    result ??= new List<int>();

    if (node == null) return result;

    ToSortedList(node.Left, result);
    result.Add(node.Value);
    ToSortedList(node.Right, result);

    return result;
}
```

It is also how you validate a search tree. If the inorder walk is not strictly increasing, the tree is broken.

```csharp
static bool IsValidSearchTree(TreeNode? node, ref int? previous)
{
    if (node == null) return true;

    if (!IsValidSearchTree(node.Left, ref previous)) return false;

    if (previous.HasValue && node.Value <= previous.Value) return false;
    previous = node.Value;

    return IsValidSearchTree(node.Right, ref previous);
}
```

**Postorder** processes children before their parent. Use it when a node's result depends on its children.

- Deleting a tree, since you must free children before the parent.
- Calculating sizes, like total folder size.
- Evaluating an expression tree, where operands must be computed before the operator.

```csharp
static long TotalSize(FolderNode folder)
{
    long total = folder.OwnFileSize;

    foreach (var child in folder.Children) total += TotalSize(child);   // children first

    return total;
}
```

```csharp
static int Evaluate(ExpressionNode node)
{
    if (node.IsNumber) return node.Value;

    int left = Evaluate(node.Left!);      // both operands first
    int right = Evaluate(node.Right!);

    return node.Operator switch
    {
        '+' => left + right,
        '-' => left - right,
        '*' => left * right,
        '/' => left / right,
        _ => throw new InvalidOperationException()
    };
}
```

## Level order, breadth first

The one that is not naturally recursive. It needs a queue.

```csharp
static void LevelOrder(TreeNode? root)
{
    if (root == null) return;

    var queue = new Queue<TreeNode>();
    queue.Enqueue(root);

    while (queue.Count > 0)
    {
        var node = queue.Dequeue();
        Console.Write(node.Value + " ");

        if (node.Left != null) queue.Enqueue(node.Left);
        if (node.Right != null) queue.Enqueue(node.Right);
    }
}
```

Grouping by level uses the count freezing trick from the queue topic:

```csharp
static List<List<int>> ByLevel(TreeNode? root)
{
    var result = new List<List<int>>();
    if (root == null) return result;

    var queue = new Queue<TreeNode>();
    queue.Enqueue(root);

    while (queue.Count > 0)
    {
        int countThisLevel = queue.Count;      // freeze it
        var level = new List<int>();

        for (int i = 0; i < countThisLevel; i++)
        {
            var node = queue.Dequeue();
            level.Add(node.Value);

            if (node.Left != null) queue.Enqueue(node.Left);
            if (node.Right != null) queue.Enqueue(node.Right);
        }

        result.Add(level);
    }

    return result;
}
```

Level order is what you want for:

- Printing a tree by level.
- Finding the shortest path in an unweighted tree or graph.
- The right side view of a tree, which is the last node of each level.
- Finding the minimum depth, since it stops as soon as it meets a leaf.

## Iterative depth first

Recursion is limited by the call stack. An explicit `Stack<T>` is not.

**Preorder** is easy:

```csharp
static void PreorderIterative(TreeNode? root)
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

Push right before left. A stack reverses the order, so pushing left first would visit right first.

**Inorder** is the tricky one. Go as far left as possible, then process and turn right.

```csharp
static void InorderIterative(TreeNode? root)
{
    var stack = new Stack<TreeNode>();
    var current = root;

    while (current != null || stack.Count > 0)
    {
        while (current != null)         // dive left, remembering the path
        {
            stack.Push(current);
            current = current.Left;
        }

        current = stack.Pop();
        Console.Write(current.Value + " ");

        current = current.Right;        // now go right
    }
}
```

The outer condition needs both parts. `current != null` means there is more to dive into, and `stack.Count > 0` means there are unfinished nodes to come back to.

**Postorder** iteratively is awkward. The easy route is a modified preorder, reversed.

```csharp
static void PostorderIterative(TreeNode? root)
{
    if (root == null) return;

    var stack = new Stack<TreeNode>();
    var output = new Stack<int>();
    stack.Push(root);

    while (stack.Count > 0)
    {
        var node = stack.Pop();
        output.Push(node.Value);

        if (node.Left != null) stack.Push(node.Left);     // left first this time
        if (node.Right != null) stack.Push(node.Right);
    }

    while (output.Count > 0) Console.Write(output.Pop() + " ");
}
```

Visiting node, right, left and then reversing gives left, right, node. Exactly postorder.

## Traversal as a sequence

`yield return` makes a traversal composable with LINQ, which is often the nicest form.

```csharp
static IEnumerable<int> InorderValues(TreeNode? node)
{
    if (node == null) yield break;

    foreach (int value in InorderValues(node.Left)) yield return value;

    yield return node.Value;

    foreach (int value in InorderValues(node.Right)) yield return value;
}

foreach (int value in InorderValues(root).Where(v => v > 2).Take(2))
{
    Console.WriteLine(value);
}
```

It is lazy, so it stops as soon as the caller stops asking. The cost is nested iterators, which makes it `O(n * height)` in the worst case. For large trees the explicit stack version is faster.

## Choosing quickly

```text
Question                                  Traversal
Copy or serialise the tree                preorder
Print in sorted order (search tree)       inorder
Validate a search tree                    inorder
Delete the tree, or sum up subtree sizes  postorder
Evaluate an expression tree               postorder
Print level by level                      level order
Shortest path or minimum depth            level order
Right side view                           level order
```

## Quick recap

- Preorder, inorder and postorder differ only in where the node is handled.
- Preorder handles parents first, so it suits copying and serialising.
- Inorder gives sorted output on a binary search tree.
- Postorder handles children first, so it suits sizes, deletion and evaluation.
- Level order needs a queue, and freezing the count separates the levels.
- Iterative preorder pushes right before left, since a stack reverses the order.
- Iterative inorder dives left, pops, then turns right.

<code id="code-content" class="language-csharp">
public class TreeNode
{
    public int Value;
    public TreeNode? Left, Right;
    public TreeNode(int value) =&gt; Value = value;
}
var root = new TreeNode(1)
{
    Left = new TreeNode(2) { Left = new TreeNode(4), Right = new TreeNode(5) },
    Right = new TreeNode(3)
};
// Same code, one line moved. That is the whole difference.
static void Preorder(TreeNode? n)   // 1 2 4 5 3   copy, serialise
{
    if (n == null) return;
    Console.Write(n.Value + " ");
    Preorder(n.Left); Preorder(n.Right);
}
static void Inorder(TreeNode? n)    // 4 2 5 1 3   SORTED on a search tree
{
    if (n == null) return;
    Inorder(n.Left);
    Console.Write(n.Value + " ");
    Inorder(n.Right);
}
static void Postorder(TreeNode? n)  // 4 5 2 3 1   sizes, deletion, evaluation
{
    if (n == null) return;
    Postorder(n.Left); Postorder(n.Right);
    Console.Write(n.Value + " ");
}
Preorder(root); Console.WriteLine();
Inorder(root); Console.WriteLine();
Postorder(root); Console.WriteLine();
// Level order needs a queue. Freeze the count to separate the levels.
static List&lt;List&lt;int&gt;&gt; ByLevel(TreeNode? root)
{
    var result = new List&lt;List&lt;int&gt;&gt;();
    if (root == null) return result;
    var queue = new Queue&lt;TreeNode&gt;();
    queue.Enqueue(root);
    while (queue.Count &gt; 0)
    {
        int thisLevel = queue.Count;           // freeze before enqueuing children
        var level = new List&lt;int&gt;();
        for (int i = 0; i &lt; thisLevel; i++)
        {
            var n = queue.Dequeue();
            level.Add(n.Value);
            if (n.Left != null) queue.Enqueue(n.Left);
            if (n.Right != null) queue.Enqueue(n.Right);
        }
        result.Add(level);
    }
    return result;
}
foreach (var level in ByLevel(root)) Console.WriteLine(string.Join(",", level));
// Iterative preorder: push RIGHT first, because a stack reverses the order
static void PreorderIterative(TreeNode? root)
{
    if (root == null) return;
    var stack = new Stack&lt;TreeNode&gt;();
    stack.Push(root);
    while (stack.Count &gt; 0)
    {
        var n = stack.Pop();
        Console.Write(n.Value + " ");
        if (n.Right != null) stack.Push(n.Right);
        if (n.Left != null) stack.Push(n.Left);
    }
}
// Iterative inorder: dive left remembering the path, pop, then turn right
static void InorderIterative(TreeNode? root)
{
    var stack = new Stack&lt;TreeNode&gt;();
    var current = root;
    while (current != null || stack.Count &gt; 0)
    {
        while (current != null) { stack.Push(current); current = current.Left; }
        current = stack.Pop();
        Console.Write(current.Value + " ");
        current = current.Right;
    }
}
PreorderIterative(root); Console.WriteLine();
InorderIterative(root);
</code></pre>
