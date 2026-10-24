---
publishDate: 2026-07-20T15:10
title: Tree Terminology and Types
slug: tree-terminology-and-types
metadescription: Learn the vocabulary of trees, the difference between height and depth, and which kind of tree solves which kind of problem.
updateDate: 2026-09-07T15:10
author: ['bishal-biswas']
level: 1
tags: ['trees', 'terminology', 'data structures']
course: dsa
---

## A structure that branches

Everything so far has been linear. An array, a list, a stack, a queue. Each item has one thing after it.

A **tree** branches. Each item can have several items below it.

```text
            root
           /    \
         B        C
        / \      /
       D   E    F
```

That shape describes a file system, an organisation chart, a menu, an HTML document, a decision process, and a huge amount of the data you deal with daily.

## The vocabulary

You need these words, because everything else is written in them.

**Node.** One item in the tree.

**Root.** The single node at the top, with nothing above it.

**Edge.** The link between a parent and a child.

**Parent.** The node directly above another. Every node has exactly one, except the root.

**Child.** A node directly below another.

**Siblings.** Nodes sharing the same parent.

**Leaf.** A node with no children.

**Internal node.** A node with at least one child.

**Subtree.** Any node plus everything below it. A subtree is itself a tree, which is why recursion works so naturally here.

**Ancestor and descendant.** Anything above you on the path to the root, and anything below you.

## Depth and height

These two are constantly mixed up, and the difference matters.

**Depth of a node** is the number of edges from the root down to it. The root has depth 0.

**Height of a node** is the number of edges on the longest path down to a leaf. A leaf has height 0.

**Height of the tree** is the height of the root.

```text
            A          depth 0, height 2
           / \
          B   C        depth 1, height 1
         / \
        D   E          depth 2, height 0
```

Depth counts downward from the root. Height counts upward from the leaves.

In code:

```csharp
public class TreeNode
{
    public int Value;
    public TreeNode? Left;
    public TreeNode? Right;

    public TreeNode(int value) => Value = value;
}

static int Height(TreeNode? node)
{
    if (node == null) return -1;      // an empty tree has height -1

    return 1 + Math.Max(Height(node.Left), Height(node.Right));
}

static int Depth(TreeNode? root, int target, int depth = 0)
{
    if (root == null) return -1;
    if (root.Value == target) return depth;

    int left = Depth(root.Left, target, depth + 1);
    return left != -1 ? left : Depth(root.Right, target, depth + 1);
}
```

Returning `-1` for an empty tree is what makes a single node have height 0. Some texts count nodes instead of edges and use 0 and 1. Either is fine, but be consistent, because the off by one propagates everywhere.

## Why height decides performance

Almost every tree operation walks from the root to a leaf. So the cost is the height.

A **balanced** tree, where the two sides of every node are roughly equal, has height `log n`.

```text
n = 1,000          height about 10
n = 1,000,000      height about 20
n = 1,000,000,000  height about 30
```

A **degenerate** tree, where every node has one child, has height `n - 1`. It is a linked list wearing a tree's clothes, and every operation becomes `O(n)`.

```text
    1
     \
      2
       \
        3
         \
          4
```

That is the entire reason balanced trees exist, and it is covered in its own topic.

## Kinds of tree

**General tree.** Any number of children per node.

```csharp
public class GeneralNode<T>
{
    public T Value;
    public List<GeneralNode<T>> Children = new();

    public GeneralNode(T value) => Value = value;
}
```

File systems and organisation charts are this shape.

**Binary tree.** At most two children, called left and right. The two child limit makes the code far simpler, which is why almost all the theory is written about binary trees.

**Full binary tree.** Every node has either 0 or 2 children, never 1.

**Complete binary tree.** Every level is full except possibly the last, which fills from the left. This shape is important because it can be stored in an array with no pointers, which is exactly how heaps work.

**Perfect binary tree.** Every level is completely full. A perfect tree of height `h` has exactly `2^(h+1) - 1` nodes.

**Balanced tree.** The height difference between the two subtrees of every node is small, usually at most 1. This keeps operations `O(log n)`.

**Binary search tree.** A binary tree with an ordering rule: everything left of a node is smaller, everything right is larger. This turns it into a searchable structure.

## Specialised trees you will meet

**Heap.** A complete binary tree where every parent beats its children. Gives instant access to the minimum or maximum. Used for priority queues.

**Trie.** A tree of characters for storing strings. Used for autocomplete and prefix matching.

**AVL and red black trees.** Binary search trees that rebalance themselves on every change, guaranteeing `O(log n)`. `SortedDictionary` in .NET is a red black tree.

**B tree.** Many children per node, designed to minimise disk reads. Every relational database index is one.

**Segment tree and Fenwick tree.** Store aggregates over ranges, so range queries and updates are both `O(log n)`.

## Trees in the framework

You use trees constantly, usually without noticing.

```csharp
var sorted = new SortedDictionary<string, int>();   // red black tree
var set = new SortedSet<int>();                     // red black tree

sorted["banana"] = 2;
sorted["apple"] = 1;

foreach (var pair in sorted) Console.WriteLine(pair.Key);   // apple, banana
```

The sorted iteration is what the tree buys you. A `Dictionary` cannot do that at any price.

Also `XDocument` and the DOM, expression trees in LINQ, the folder hierarchy in `DirectoryInfo`, and every syntax tree in a compiler.

## Counting things

Basic tree measurements, all following the same recursive shape.

```csharp
static int CountNodes(TreeNode? node) =>
    node == null ? 0 : 1 + CountNodes(node.Left) + CountNodes(node.Right);

static int CountLeaves(TreeNode? node)
{
    if (node == null) return 0;
    if (node.Left == null && node.Right == null) return 1;

    return CountLeaves(node.Left) + CountLeaves(node.Right);
}

static bool IsBalanced(TreeNode? node)
{
    if (node == null) return true;

    if (Math.Abs(Height(node.Left) - Height(node.Right)) > 1) return false;

    return IsBalanced(node.Left) && IsBalanced(node.Right);
}
```

Every one is "handle null, handle this node, recurse into both children". Once that pattern is familiar, most tree code writes itself.

Note that `IsBalanced` as written recomputes heights repeatedly, making it `O(n^2)`. Returning the height and the balance flag together from one traversal makes it `O(n)`.

## Quick recap

- A tree branches, so each node can have several children but only one parent.
- A leaf has no children, and a subtree is any node plus everything below it.
- Depth counts edges down from the root, height counts edges up from the leaves.
- Tree operations cost `O(height)`, which is `log n` when balanced and `n` when degenerate.
- Binary trees allow at most two children, which is why nearly all the theory uses them.
- A complete binary tree can be stored in a plain array, which is how heaps work.
- `SortedDictionary` and `SortedSet` are red black trees, and give you sorted iteration.

<code id="code-content" class="language-csharp">
public class TreeNode
{
    public int Value;
    public TreeNode? Left, Right;
    public TreeNode(int value) =&gt; Value = value;
}
//         1          depth 0, height 2
//        / \
//       2   3        depth 1, height 1
//      / \
//     4   5          depth 2, height 0  (leaves)
var root = new TreeNode(1)
{
    Left = new TreeNode(2) { Left = new TreeNode(4), Right = new TreeNode(5) },
    Right = new TreeNode(3)
};
// Height counts edges UP from the leaves. Empty tree is -1, a leaf is 0.
static int Height(TreeNode? n) =&gt;
    n == null ? -1 : 1 + Math.Max(Height(n.Left), Height(n.Right));
Console.WriteLine(Height(root));            // 2
// Every tree operation walks root to leaf, so cost is O(height).
// Balanced: height is log n.  Degenerate: height is n, and it is a linked list.
// The recursive shape is always: handle null, handle this node, recurse both sides
static int CountNodes(TreeNode? n) =&gt;
    n == null ? 0 : 1 + CountNodes(n.Left) + CountNodes(n.Right);
static int CountLeaves(TreeNode? n)
{
    if (n == null) return 0;
    if (n.Left == null &amp;&amp; n.Right == null) return 1;
    return CountLeaves(n.Left) + CountLeaves(n.Right);
}
Console.WriteLine(CountNodes(root));        // 5
Console.WriteLine(CountLeaves(root));       // 3
static bool IsBalanced(TreeNode? n)
{
    if (n == null) return true;
    if (Math.Abs(Height(n.Left) - Height(n.Right)) &gt; 1) return false;
    return IsBalanced(n.Left) &amp;&amp; IsBalanced(n.Right);
}
Console.WriteLine(IsBalanced(root));        // True
// A general tree allows any number of children
public class GeneralNode&lt;T&gt;
{
    public T Value;
    public List&lt;GeneralNode&lt;T&gt;&gt; Children = new();
    public GeneralNode(T value) =&gt; Value = value;
}
// You already use trees: SortedDictionary and SortedSet are red black trees
var sortedDict = new SortedDictionary&lt;string, int&gt; { ["banana"] = 2, ["apple"] = 1 };
foreach (var pair in sortedDict) Console.WriteLine(pair.Key);   // apple, banana
</code></pre>
