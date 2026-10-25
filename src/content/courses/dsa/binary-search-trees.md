---
publishDate: 2026-07-21T15:40
title: Binary Search Trees
slug: binary-search-trees
metadescription: Add an ordering rule to a binary tree so search, insert and delete all become O(log n), and handle the awkward two child deletion case.
updateDate: 2026-09-07T15:40
author: ['bishal-biswas']
level: 2
tags: ['trees', 'binary search tree', 'data structures']
course: dsa
---

## One rule changes everything

A **binary search tree** is a binary tree with one invariant:

> For every node, everything in the left subtree is smaller, and everything in the right subtree is larger.

That single rule turns an `O(n)` search into an `O(log n)` one, because at every node you can discard an entire subtree.

```text
            8
          /   \
        3      10
       / \       \
      1   6       14
         / \      /
        4   7    13
```

Everything left of 8 is under 8. Everything right is over 8. The same is true at every node, all the way down.

## Searching

```csharp
public class TreeNode
{
    public int Value;
    public TreeNode? Left;
    public TreeNode? Right;

    public TreeNode(int value) => Value = value;
}

static bool Contains(TreeNode? node, int target)
{
    while (node != null)
    {
        if (node.Value == target) return true;

        node = target < node.Value ? node.Left : node.Right;
    }

    return false;
}
```

No recursion needed. Compare, go one way, repeat. The number of steps is the height of the tree.

The recursive version reads well too:

```csharp
static bool ContainsRecursive(TreeNode? node, int target)
{
    if (node == null) return false;
    if (node.Value == target) return true;

    return target < node.Value
        ? ContainsRecursive(node.Left, target)
        : ContainsRecursive(node.Right, target);
}
```

## Inserting

New values always become leaves. Walk down as if searching, and when you fall off the tree, that is where the value belongs.

```csharp
static TreeNode Insert(TreeNode? node, int value)
{
    if (node == null) return new TreeNode(value);

    if (value < node.Value) node.Left = Insert(node.Left, value);
    else if (value > node.Value) node.Right = Insert(node.Right, value);
    // equal values are ignored here

    return node;
}

TreeNode? root = null;
foreach (int value in new[] { 8, 3, 10, 1, 6, 14, 4, 7, 13 })
{
    root = Insert(root, value);
}
```

Reassigning `node.Left = Insert(node.Left, value)` is the idiom worth learning. It handles both "the child exists, recurse into it" and "the child is null, create it" with no special case.

Duplicates need a policy. Ignore them, keep a count on each node, or always send them right. Whichever you pick, be consistent, because deletion depends on it.

## Minimum and maximum

Trivially cheap, and both are used by deletion.

```csharp
static TreeNode Minimum(TreeNode node)
{
    while (node.Left != null) node = node.Left;
    return node;
}

static TreeNode Maximum(TreeNode node)
{
    while (node.Right != null) node = node.Right;
    return node;
}
```

Go left forever for the smallest, right forever for the largest.

## Deleting

The one genuinely fiddly operation. There are three cases.

**No children:** just remove it.

**One child:** replace the node with its child.

**Two children:** you cannot simply remove it, because two subtrees need one parent slot. Instead, replace its **value** with the smallest value in the right subtree, then delete that value from the right subtree.

Why the smallest of the right subtree? Because it is the next value in sorted order, so it is larger than everything on the left and smaller than everything else on the right. It slots in perfectly. It also has at most one child by definition, so removing it is one of the easy cases.

```csharp
static TreeNode? Delete(TreeNode? node, int value)
{
    if (node == null) return null;

    if (value < node.Value)
    {
        node.Left = Delete(node.Left, value);
    }
    else if (value > node.Value)
    {
        node.Right = Delete(node.Right, value);
    }
    else
    {
        if (node.Left == null) return node.Right;    // 0 or 1 child
        if (node.Right == null) return node.Left;    // 1 child

        var successor = Minimum(node.Right);         // 2 children
        node.Value = successor.Value;
        node.Right = Delete(node.Right, successor.Value);
    }

    return node;
}

root = Delete(root, 3);
```

The first two `return` statements cover three cases at once. If `Left` is null, returning `Right` works whether `Right` is a node or null.

## The problem: it can degenerate

Insert already sorted values and the tree becomes a linked list.

```csharp
TreeNode? bad = null;
foreach (int value in new[] { 1, 2, 3, 4, 5 }) bad = Insert(bad, value);
```

```text
1
 \
  2
   \
    3
     \
      4
       \
        5
```

Height is `n - 1`. Every operation is `O(n)`. All the benefit is gone.

This is not a rare edge case. Inserting records in ID order, timestamp order or alphabetical order is completely normal, and it produces exactly this.

```text
             Balanced      Degenerate
Search       O(log n)      O(n)
Insert       O(log n)      O(n)
Delete       O(log n)      O(n)
Height       log n         n - 1
```

Two solutions exist. Insert in random order, which is not usually under your control. Or use a self balancing tree, which is the real answer and has its own topic.

## Validating

A common mistake is checking only that each node beats its immediate children. That is not enough.

```text
        10
       /  \
      5    15
          /  \
         6    20      6 is less than 10, so it is in the wrong place
```

Each node satisfies its parent locally, but 6 is in the right subtree of 10 while being smaller than 10. The tree is invalid.

Correct validation carries a permitted range down the tree:

```csharp
static bool IsValid(TreeNode? node, int? min = null, int? max = null)
{
    if (node == null) return true;

    if (min.HasValue && node.Value <= min.Value) return false;
    if (max.HasValue && node.Value >= max.Value) return false;

    return IsValid(node.Left, min, node.Value)
        && IsValid(node.Right, node.Value, max);
}
```

Going left tightens the maximum, going right tightens the minimum. Every node must fit inside the window inherited from all its ancestors.

An inorder walk works too, since a valid search tree produces strictly increasing values.

## What a search tree gives you that a hash table does not

A `Dictionary` gives `O(1)` lookup, better than `O(log n)`. So why use a tree?

**Sorted iteration.** An inorder walk gives every value in order, for free.

```csharp
static IEnumerable<int> InOrder(TreeNode? node)
{
    if (node == null) yield break;

    foreach (int value in InOrder(node.Left)) yield return value;
    yield return node.Value;
    foreach (int value in InOrder(node.Right)) yield return value;
}
```

**Range queries.** Everything between two values, without scanning.

```csharp
static void InRange(TreeNode? node, int low, int high, List<int> result)
{
    if (node == null) return;

    if (node.Value > low) InRange(node.Left, low, high, result);      // prune

    if (node.Value >= low && node.Value <= high) result.Add(node.Value);

    if (node.Value < high) InRange(node.Right, low, high, result);    // prune
}
```

The two conditional recursions are the pruning. A whole subtree outside the range is skipped entirely.

**Nearest neighbour.** The largest value below a target, or the smallest above it. A hash table cannot answer this at all.

```csharp
static int? LargestBelow(TreeNode? node, int target)
{
    int? best = null;

    while (node != null)
    {
        if (node.Value < target)
        {
            best = node.Value;      // candidate, but maybe there is a bigger one
            node = node.Right;
        }
        else
        {
            node = node.Left;
        }
    }

    return best;
}
```

## In .NET

You will rarely write one, because the framework has balanced versions.

```csharp
var set = new SortedSet<int> { 8, 3, 10, 1, 6 };

Console.WriteLine(set.Min);                                  // 1
Console.WriteLine(set.Max);                                  // 10
Console.WriteLine(string.Join(", ", set.GetViewBetween(3, 8)));   // 3, 6, 8
Console.WriteLine(set.Contains(6));                          // True

var dictionary = new SortedDictionary<string, int>();
dictionary["banana"] = 2;
dictionary["apple"] = 1;

foreach (var pair in dictionary) Console.WriteLine(pair.Key);   // apple, banana
```

Both are red black trees, so all operations are guaranteed `O(log n)` regardless of insertion order.

`GetViewBetween` is the range query, and it is the reason to choose `SortedSet` over `HashSet`.

## Quick recap

- A binary search tree keeps smaller values left and larger values right, at every node.
- Search, insert and delete are all `O(height)`.
- Insert by walking down until you fall off the tree, using `node.Left = Insert(...)`.
- Deleting a node with two children replaces it with the minimum of its right subtree.
- Inserting sorted data degenerates the tree into a list, making everything `O(n)`.
- Validate with a permitted range, not by comparing with immediate children only.
- Use a tree over a hash table when you need sorted order, ranges or nearest values.

<code id="code-content" class="language-csharp">
public class TreeNode
{
    public int Value;
    public TreeNode? Left, Right;
    public TreeNode(int value) =&gt; Value = value;
}
// Insert: walk down until you fall off the tree. The reassignment idiom
// handles both "recurse into the child" and "create the child".
static TreeNode Insert(TreeNode? node, int value)
{
    if (node == null) return new TreeNode(value);
    if (value &lt; node.Value) node.Left = Insert(node.Left, value);
    else if (value &gt; node.Value) node.Right = Insert(node.Right, value);
    return node;
}
TreeNode? root = null;
foreach (int v in new[] { 8, 3, 10, 1, 6, 14, 4, 7, 13 }) root = Insert(root, v);
// Search: compare, go one way, repeat. No recursion needed.
static bool Contains(TreeNode? node, int target)
{
    while (node != null)
    {
        if (node.Value == target) return true;
        node = target &lt; node.Value ? node.Left : node.Right;
    }
    return false;
}
Console.WriteLine(Contains(root, 6));       // True
// Delete: the two child case swaps in the minimum of the right subtree
static TreeNode Minimum(TreeNode n) { while (n.Left != null) n = n.Left; return n; }
static TreeNode? Delete(TreeNode? node, int value)
{
    if (node == null) return null;
    if (value &lt; node.Value) node.Left = Delete(node.Left, value);
    else if (value &gt; node.Value) node.Right = Delete(node.Right, value);
    else
    {
        if (node.Left == null) return node.Right;      // 0 or 1 child
        if (node.Right == null) return node.Left;      // 1 child
        var successor = Minimum(node.Right);           // 2 children
        node.Value = successor.Value;
        node.Right = Delete(node.Right, successor.Value);
    }
    return node;
}
root = Delete(root, 3);
// Validate with an inherited RANGE, not just parent comparisons
static bool IsValid(TreeNode? n, int? min = null, int? max = null)
{
    if (n == null) return true;
    if (min.HasValue &amp;&amp; n.Value &lt;= min.Value) return false;
    if (max.HasValue &amp;&amp; n.Value &gt;= max.Value) return false;
    return IsValid(n.Left, min, n.Value) &amp;&amp; IsValid(n.Right, n.Value, max);
}
Console.WriteLine(IsValid(root));           // True
// Insert SORTED data and it degenerates into a linked list: everything O(n)
TreeNode? bad = null;
foreach (int v in new[] { 1, 2, 3, 4, 5 }) bad = Insert(bad, v);
// In .NET use the balanced versions. Range queries are the point.
var set = new SortedSet&lt;int&gt; { 8, 3, 10, 1, 6 };
Console.WriteLine(string.Join(",", set.GetViewBetween(3, 8)));   // 3,6,8
Console.WriteLine($"{set.Min} {set.Max}");                       // 1 10
</code></pre>
