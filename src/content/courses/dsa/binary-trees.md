---
publishDate: 2026-07-20T15:20
title: Binary Trees
slug: binary-trees
metadescription: Build a binary tree in C#, understand the array representation, and write the recursive methods that measure, compare and rebuild one.
updateDate: 2026-09-07T15:20
author: ['bishal-biswas']
level: 1
tags: ['trees', 'binary tree', 'data structures']
course: dsa
---

## At most two children

A binary tree limits each node to two children, `Left` and `Right`. That single restriction makes the code dramatically simpler than a general tree, and it costs almost nothing in expressiveness.

```csharp
public class TreeNode
{
    public int Value;
    public TreeNode? Left;
    public TreeNode? Right;

    public TreeNode(int value) => Value = value;
}
```

That is the whole definition. A value and two optional children.

## Building one

```csharp
var root = new TreeNode(1)
{
    Left = new TreeNode(2)
    {
        Left = new TreeNode(4),
        Right = new TreeNode(5)
    },
    Right = new TreeNode(3)
};
```

```text
        1
       / \
      2   3
     / \
    4   5
```

Note that `Left` and `Right` are **ordered**. Swapping them gives a different tree, even though the same values are present.

## The recursive template

Nearly every method on a binary tree looks like this:

```csharp
static ReturnType DoSomething(TreeNode? node)
{
    if (node == null) return baseValue;                 // handle the empty case

    var left = DoSomething(node.Left);                  // solve the left subtree
    var right = DoSomething(node.Right);                // solve the right subtree

    return Combine(node.Value, left, right);            // combine
}
```

This works because a subtree is itself a tree. Learn this shape and most tree problems become filling in three blanks.

## Measuring

```csharp
static int Count(TreeNode? node) =>
    node == null ? 0 : 1 + Count(node.Left) + Count(node.Right);

static int Height(TreeNode? node) =>
    node == null ? -1 : 1 + Math.Max(Height(node.Left), Height(node.Right));

static int Sum(TreeNode? node) =>
    node == null ? 0 : node.Value + Sum(node.Left) + Sum(node.Right);

static int Maximum(TreeNode? node) =>
    node == null ? int.MinValue
                 : Math.Max(node.Value, Math.Max(Maximum(node.Left), Maximum(node.Right)));

Console.WriteLine(Count(root));     // 5
Console.WriteLine(Height(root));    // 2
Console.WriteLine(Sum(root));       // 15
Console.WriteLine(Maximum(root));   // 5
```

Four methods, one shape, different base values and combine steps.

All are `O(n)`, because every node is visited exactly once. Space is `O(height)` for the call stack.

## Searching an unordered binary tree

Without an ordering rule you must check everything.

```csharp
static bool Contains(TreeNode? node, int target)
{
    if (node == null) return false;
    if (node.Value == target) return true;

    return Contains(node.Left, target) || Contains(node.Right, target);
}
```

`||` short circuits, so once the left subtree finds it, the right one is never searched.

This is `O(n)`. Adding an ordering rule makes it `O(log n)`, which is what a binary search tree does.

## Comparing trees

```csharp
static bool AreIdentical(TreeNode? a, TreeNode? b)
{
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;

    return a.Value == b.Value
        && AreIdentical(a.Left, b.Left)
        && AreIdentical(a.Right, b.Right);
}

static bool AreMirrors(TreeNode? a, TreeNode? b)
{
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;

    return a.Value == b.Value
        && AreMirrors(a.Left, b.Right)      // note the crossover
        && AreMirrors(a.Right, b.Left);
}

static bool IsSymmetric(TreeNode? root) =>
    root == null || AreMirrors(root.Left, root.Right);
```

The two null checks are both needed. The first handles two empty trees, the second handles one empty and one not.

## Transforming

```csharp
static TreeNode? Invert(TreeNode? node)
{
    if (node == null) return null;

    (node.Left, node.Right) = (Invert(node.Right), Invert(node.Left));

    return node;
}
```

Mirrors the tree left to right. Famously the question that got a developer rejected by a large tech company, and it is four lines.

```csharp
static TreeNode? Copy(TreeNode? node)
{
    if (node == null) return null;

    return new TreeNode(node.Value)
    {
        Left = Copy(node.Left),
        Right = Copy(node.Right)
    };
}
```

## The array representation

A binary tree does not always need pointers. If the tree is **complete**, meaning every level is full except possibly the last which fills from the left, it fits perfectly into an array.

```text
index:   0   1   2   3   4   5   6
value:   1   2   3   4   5   6   7

              1
            /   \
          2       3
         / \     / \
        4   5   6   7
```

The relationships are pure arithmetic:

```csharp
static int Parent(int i) => (i - 1) / 2;
static int LeftChild(int i) => 2 * i + 1;
static int RightChild(int i) => 2 * i + 2;

int[] tree = { 1, 2, 3, 4, 5, 6, 7 };

Console.WriteLine(tree[LeftChild(0)]);    // 2
Console.WriteLine(tree[RightChild(0)]);   // 3
Console.WriteLine(tree[Parent(4)]);       // 2
```

No node objects, no pointers, and everything sits contiguously in memory, which the processor cache loves.

This only works when the tree is complete. A sparse tree would leave huge gaps. That is exactly why **heaps** are defined as complete trees, and it is what makes them so efficient.

Walking an array based tree:

```csharp
static void PrintArrayTree(int[] tree, int index = 0, string indent = "")
{
    if (index >= tree.Length) return;

    PrintArrayTree(tree, RightChild(index), indent + "    ");
    Console.WriteLine($"{indent}{tree[index]}");
    PrintArrayTree(tree, LeftChild(index), indent + "    ");
}
```

## Paths

```csharp
static bool FindPath(TreeNode? node, int target, List<int> path)
{
    if (node == null) return false;

    path.Add(node.Value);

    if (node.Value == target) return true;

    if (FindPath(node.Left, target, path) || FindPath(node.Right, target, path))
    {
        return true;
    }

    path.RemoveAt(path.Count - 1);      // backtrack, this branch was wrong
    return false;
}

var path = new List<int>();
FindPath(root, 5, path);
Console.WriteLine(string.Join(" -> ", path));   // 1 -> 2 -> 5
```

That `RemoveAt` is backtracking, exactly as in the backtracking topic. Without it, failed branches leave their nodes in the path.

Finding the deepest common ancestor of two nodes:

```csharp
static TreeNode? LowestCommonAncestor(TreeNode? node, int a, int b)
{
    if (node == null || node.Value == a || node.Value == b) return node;

    var left = LowestCommonAncestor(node.Left, a, b);
    var right = LowestCommonAncestor(node.Right, a, b);

    if (left != null && right != null) return node;    // found one on each side

    return left ?? right;
}

Console.WriteLine(LowestCommonAncestor(root, 4, 5)?.Value);   // 2
Console.WriteLine(LowestCommonAncestor(root, 4, 3)?.Value);   // 1
```

If both sides return something, this node is where the two paths meet. Otherwise pass along whichever side found something.

## Building from an array

```csharp
static TreeNode? BuildBalanced(int[] sorted, int low, int high)
{
    if (low > high) return null;

    int mid = low + (high - low) / 2;

    return new TreeNode(sorted[mid])
    {
        Left = BuildBalanced(sorted, low, mid - 1),
        Right = BuildBalanced(sorted, mid + 1, high)
    };
}

int[] values = { 1, 2, 3, 4, 5, 6, 7 };
var balanced = BuildBalanced(values, 0, values.Length - 1);
Console.WriteLine(Height(balanced));   // 2, perfectly balanced
```

Taking the middle as the root and recursing on the halves guarantees minimum height. This is how you rebuild a degenerate search tree into a balanced one.

## Quick recap

- A binary tree node has a value and at most two ordered children.
- Nearly every method is: handle null, recurse both sides, combine.
- Traversal is `O(n)` time and `O(height)` space.
- Searching an unordered binary tree is `O(n)`, which is why ordering rules exist.
- A complete binary tree fits in an array, with parent and child found by arithmetic.
- Path finding needs backtracking, so remove the node when a branch fails.
- Building from the middle of a sorted array gives a perfectly balanced tree.

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
// The template: handle null, recurse both sides, combine
static int Count(TreeNode? n) =&gt; n == null ? 0 : 1 + Count(n.Left) + Count(n.Right);
static int Height(TreeNode? n) =&gt; n == null ? -1 : 1 + Math.Max(Height(n.Left), Height(n.Right));
static int Sum(TreeNode? n) =&gt; n == null ? 0 : n.Value + Sum(n.Left) + Sum(n.Right);
Console.WriteLine($"{Count(root)} {Height(root)} {Sum(root)}");   // 5 2 15
// Mirror the tree in four lines
static TreeNode? Invert(TreeNode? n)
{
    if (n == null) return null;
    (n.Left, n.Right) = (Invert(n.Right), Invert(n.Left));
    return n;
}
// A COMPLETE binary tree needs no pointers at all, just arithmetic
static int Parent(int i) =&gt; (i - 1) / 2;
static int LeftChild(int i) =&gt; 2 * i + 1;
static int RightChild(int i) =&gt; 2 * i + 2;
int[] tree = { 1, 2, 3, 4, 5, 6, 7 };
Console.WriteLine(tree[LeftChild(0)]);      // 2
Console.WriteLine(tree[Parent(4)]);         // 2   (this is how heaps work)
// Path finding needs backtracking: remove the node when a branch fails
static bool FindPath(TreeNode? n, int target, List&lt;int&gt; path)
{
    if (n == null) return false;
    path.Add(n.Value);
    if (n.Value == target) return true;
    if (FindPath(n.Left, target, path) || FindPath(n.Right, target, path)) return true;
    path.RemoveAt(path.Count - 1);          // backtrack
    return false;
}
var path = new List&lt;int&gt;();
FindPath(root, 5, path);
Console.WriteLine(string.Join(" -&gt; ", path));   // 1 -&gt; 2 -&gt; 5
// Lowest common ancestor: if both sides find something, this node is the meeting point
static TreeNode? Lca(TreeNode? n, int a, int b)
{
    if (n == null || n.Value == a || n.Value == b) return n;
    var left = Lca(n.Left, a, b);
    var right = Lca(n.Right, a, b);
    if (left != null &amp;&amp; right != null) return n;
    return left ?? right;
}
Console.WriteLine(Lca(root, 4, 3)?.Value);  // 1
// Build from the middle of a sorted array for a perfectly balanced tree
static TreeNode? BuildBalanced(int[] a, int low, int high)
{
    if (low &gt; high) return null;
    int mid = low + (high - low) / 2;
    return new TreeNode(a[mid])
    {
        Left = BuildBalanced(a, low, mid - 1),
        Right = BuildBalanced(a, mid + 1, high)
    };
}
Console.WriteLine(Height(BuildBalanced(new[] { 1, 2, 3, 4, 5, 6, 7 }, 0, 6)));   // 2
</code></pre>
