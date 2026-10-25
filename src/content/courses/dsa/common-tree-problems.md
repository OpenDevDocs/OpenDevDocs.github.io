---
publishDate: 2026-07-23T16:20
title: Common Tree Problems
slug: common-tree-problems
metadescription: Work through the tree questions that come up again and again, and see the three patterns that solve almost all of them.
updateDate: 2026-09-07T16:20
author: ['bishal-biswas']
level: 2
tags: ['trees', 'problems', 'interview']
course: dsa
---

## Three patterns cover most of it

Nearly every tree problem is one of three shapes.

**Return a value up from the children.** Height, sum, count, diameter. Compute both sides, combine.

**Pass a value down to the children.** Depth, path so far, allowed range. State flows from parent to child.

**Level order with a queue.** Anything about levels, widths or shortest distance.

Recognise which one applies and the code follows.

## Pattern one: bring a value up

```csharp
public class TreeNode
{
    public int Value;
    public TreeNode? Left;
    public TreeNode? Right;

    public TreeNode(int value) => Value = value;
}

static int Height(TreeNode? node) =>
    node == null ? -1 : 1 + Math.Max(Height(node.Left), Height(node.Right));

static int Sum(TreeNode? node) =>
    node == null ? 0 : node.Value + Sum(node.Left) + Sum(node.Right);

static int CountLeaves(TreeNode? node)
{
    if (node == null) return 0;
    if (node.Left == null && node.Right == null) return 1;

    return CountLeaves(node.Left) + CountLeaves(node.Right);
}
```

## Diameter, and returning two things

The diameter is the longest path between any two nodes, which may not pass through the root.

The naive version computes the height at every node, giving `O(n^2)`. The good version computes the height once and tracks the best diameter as a side effect.

```csharp
static int Diameter(TreeNode? root)
{
    int best = 0;

    int Measure(TreeNode? node)
    {
        if (node == null) return -1;

        int left = Measure(node.Left);
        int right = Measure(node.Right);

        best = Math.Max(best, left + right + 2);    // path through this node

        return 1 + Math.Max(left, right);           // height, for the caller
    }

    Measure(root);
    return best;
}
```

This is the trick worth learning: **return one thing and record another**. The recursion returns the height because that is what the parent needs, while the answer accumulates in a captured variable.

Now `O(n)`, one traversal.

## Maximum path sum

The same trick with a twist. Values can be negative, so a subtree that would reduce the total is simply dropped.

```csharp
static int MaxPathSum(TreeNode root)
{
    int best = int.MinValue;

    int Measure(TreeNode? node)
    {
        if (node == null) return 0;

        int left = Math.Max(0, Measure(node.Left));    // discard negative branches
        int right = Math.Max(0, Measure(node.Right));

        best = Math.Max(best, node.Value + left + right);

        return node.Value + Math.Max(left, right);     // only one side can continue up
    }

    Measure(root);
    return best;
}
```

Two different quantities are at play. The **answer** may use both children, since a path can go down one side, through the node, and down the other. The **return value** can only use one side, because a path continuing upward cannot fork.

Confusing those two is the standard mistake here.

## Pattern two: pass a value down

```csharp
static void PrintPaths(TreeNode? node, List<int> path)
{
    if (node == null) return;

    path.Add(node.Value);

    if (node.Left == null && node.Right == null)
    {
        Console.WriteLine(string.Join(" -> ", path));
    }
    else
    {
        PrintPaths(node.Left, path);
        PrintPaths(node.Right, path);
    }

    path.RemoveAt(path.Count - 1);      // backtrack
}
```

Does a root to leaf path add up to a target?

```csharp
static bool HasPathSum(TreeNode? node, int target)
{
    if (node == null) return false;

    if (node.Left == null && node.Right == null) return node.Value == target;

    int remaining = target - node.Value;

    return HasPathSum(node.Left, remaining) || HasPathSum(node.Right, remaining);
}
```

Subtracting as you descend is neater than accumulating, because the base case becomes a simple equality check.

The leaf test must come before the null test does its work. Returning `target == 0` on null would wrongly accept a node with one missing child.

## Pattern three: level order

```csharp
static List<int> RightSideView(TreeNode? root)
{
    var result = new List<int>();
    if (root == null) return result;

    var queue = new Queue<TreeNode>();
    queue.Enqueue(root);

    while (queue.Count > 0)
    {
        int count = queue.Count;

        for (int i = 0; i < count; i++)
        {
            var node = queue.Dequeue();

            if (i == count - 1) result.Add(node.Value);   // last of this level

            if (node.Left != null) queue.Enqueue(node.Left);
            if (node.Right != null) queue.Enqueue(node.Right);
        }
    }

    return result;
}
```

Minimum depth, which is where level order genuinely beats recursion:

```csharp
static int MinDepth(TreeNode? root)
{
    if (root == null) return 0;

    var queue = new Queue<(TreeNode Node, int Depth)>();
    queue.Enqueue((root, 1));

    while (queue.Count > 0)
    {
        var (node, depth) = queue.Dequeue();

        if (node.Left == null && node.Right == null) return depth;   // first leaf wins

        if (node.Left != null) queue.Enqueue((node.Left, depth + 1));
        if (node.Right != null) queue.Enqueue((node.Right, depth + 1));
    }

    return 0;
}
```

Breadth first stops at the first leaf it meets, which is by definition the shallowest. Recursion would explore every branch to the bottom.

Zigzag order, which just reverses alternate levels:

```csharp
static List<List<int>> ZigzagLevelOrder(TreeNode? root)
{
    var result = new List<List<int>>();
    if (root == null) return result;

    var queue = new Queue<TreeNode>();
    queue.Enqueue(root);
    bool leftToRight = true;

    while (queue.Count > 0)
    {
        int count = queue.Count;
        var level = new List<int>();

        for (int i = 0; i < count; i++)
        {
            var node = queue.Dequeue();
            level.Add(node.Value);

            if (node.Left != null) queue.Enqueue(node.Left);
            if (node.Right != null) queue.Enqueue(node.Right);
        }

        if (!leftToRight) level.Reverse();
        result.Add(level);
        leftToRight = !leftToRight;
    }

    return result;
}
```

## Serialising and rebuilding

Turning a tree into a string and back is a good test of understanding traversals.

```csharp
static string Serialise(TreeNode? node)
{
    if (node == null) return "#";

    return $"{node.Value},{Serialise(node.Left)},{Serialise(node.Right)}";
}

static TreeNode? Deserialise(string data)
{
    var parts = new Queue<string>(data.Split(','));
    return Build(parts);
}

static TreeNode? Build(Queue<string> parts)
{
    string token = parts.Dequeue();

    if (token == "#") return null;

    return new TreeNode(int.Parse(token))
    {
        Left = Build(parts),
        Right = Build(parts)
    };
}

var root = new TreeNode(1)
{
    Left = new TreeNode(2),
    Right = new TreeNode(3) { Left = new TreeNode(4) }
};

string text = Serialise(root);
Console.WriteLine(text);              // 1,2,#,#,3,4,#,#,#
var rebuilt = Deserialise(text);
```

The `#` markers for null are essential. Without them the structure is ambiguous, and preorder alone cannot be rebuilt.

## Building from two traversals

Preorder alone is ambiguous, but preorder plus inorder is not.

Preorder gives the root. Finding that root in the inorder sequence splits it into the left and right subtrees.

```csharp
static TreeNode? BuildTree(int[] preorder, int[] inorder)
{
    var indexOf = new Dictionary<int, int>();
    for (int i = 0; i < inorder.Length; i++) indexOf[inorder[i]] = i;

    int position = 0;

    TreeNode? Build(int low, int high)
    {
        if (low > high) return null;

        int value = preorder[position++];       // preorder gives the next root
        int mid = indexOf[value];               // its position splits inorder

        return new TreeNode(value)
        {
            Left = Build(low, mid - 1),         // left subtree first, matching preorder
            Right = Build(mid + 1, high)
        };
    }

    return Build(0, inorder.Length - 1);
}

var tree = BuildTree(new[] { 3, 9, 20, 15, 7 }, new[] { 9, 3, 15, 20, 7 });
```

The dictionary turns the "find the root in inorder" step from `O(n)` into `O(1)`, making the whole build `O(n)` instead of `O(n^2)`.

Building `Left` before `Right` matters, because `position` advances as it goes and preorder visits the left subtree first.

## Subtree matching

```csharp
static bool IsSubtree(TreeNode? tree, TreeNode? target)
{
    if (target == null) return true;
    if (tree == null) return false;

    if (AreIdentical(tree, target)) return true;

    return IsSubtree(tree.Left, target) || IsSubtree(tree.Right, target);
}

static bool AreIdentical(TreeNode? a, TreeNode? b)
{
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;

    return a.Value == b.Value
        && AreIdentical(a.Left, b.Left)
        && AreIdentical(a.Right, b.Right);
}
```

`O(n * m)` in the worst case. Serialising both trees and doing a substring search gets it to `O(n + m)`.

## A checklist for tree problems

1. Can each node answer using only its children's answers? Bring a value up.
2. Does a node need to know about its ancestors? Pass a value down.
3. Is the question about levels, width or shortest distance? Use a queue.
4. Is it a search tree? Then inorder is sorted, and you can prune whole subtrees.
5. Is the recursion recomputing something? Return it instead, and record the answer separately.

Always handle null first, and always test with an empty tree, a single node and a one sided tree.

## Quick recap

- Most tree problems bring a value up, pass a value down, or walk level by level.
- Diameter and maximum path sum both return the height and record the answer separately.
- A path continuing upward can only use one child, while the answer can use both.
- Subtract as you descend for path sum problems, so the base case is simple.
- Level order finds minimum depth correctly, because it stops at the first leaf.
- Serialising needs explicit null markers or the structure is ambiguous.
- Preorder plus inorder rebuilds a tree, and a dictionary keeps it `O(n)`.

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
// Pattern 1: bring a value UP. Return the height, record the answer separately.
static int Diameter(TreeNode? root)
{
    int best = 0;
    int Measure(TreeNode? n)
    {
        if (n == null) return -1;
        int left = Measure(n.Left), right = Measure(n.Right);
        best = Math.Max(best, left + right + 2);   // the path THROUGH this node
        return 1 + Math.Max(left, right);          // the height, for the caller
    }
    Measure(root);
    return best;
}
Console.WriteLine(Diameter(root));      // 3
// Max path sum: the answer may use both children, the return value only one
static int MaxPathSum(TreeNode root)
{
    int best = int.MinValue;
    int Measure(TreeNode? n)
    {
        if (n == null) return 0;
        int left = Math.Max(0, Measure(n.Left));   // drop negative branches
        int right = Math.Max(0, Measure(n.Right));
        best = Math.Max(best, n.Value + left + right);
        return n.Value + Math.Max(left, right);    // a path cannot fork going up
    }
    Measure(root);
    return best;
}
Console.WriteLine(MaxPathSum(root));    // 11
// Pattern 2: pass a value DOWN. Subtracting beats accumulating.
static bool HasPathSum(TreeNode? n, int target)
{
    if (n == null) return false;
    if (n.Left == null &amp;&amp; n.Right == null) return n.Value == target;
    return HasPathSum(n.Left, target - n.Value) || HasPathSum(n.Right, target - n.Value);
}
Console.WriteLine(HasPathSum(root, 7));  // True  (1 -&gt; 2 -&gt; 4)
// Pattern 3: level order. Minimum depth stops at the FIRST leaf.
static int MinDepth(TreeNode? root)
{
    if (root == null) return 0;
    var queue = new Queue&lt;(TreeNode Node, int Depth)&gt;();
    queue.Enqueue((root, 1));
    while (queue.Count &gt; 0)
    {
        var (n, depth) = queue.Dequeue();
        if (n.Left == null &amp;&amp; n.Right == null) return depth;
        if (n.Left != null) queue.Enqueue((n.Left, depth + 1));
        if (n.Right != null) queue.Enqueue((n.Right, depth + 1));
    }
    return 0;
}
Console.WriteLine(MinDepth(root));       // 2
// Serialising needs explicit null markers, or the structure is ambiguous
static string Serialise(TreeNode? n) =&gt;
    n == null ? "#" : $"{n.Value},{Serialise(n.Left)},{Serialise(n.Right)}";
Console.WriteLine(Serialise(root));      // 1,2,4,#,#,5,#,#,3,#,#
</code></pre>
