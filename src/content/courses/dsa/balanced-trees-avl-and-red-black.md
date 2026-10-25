---
publishDate: 2026-07-21T15:50
title: Balanced Trees, AVL and Red Black
slug: balanced-trees-avl-and-red-black
metadescription: See why unbalanced search trees fail, how rotations restore balance, and what AVL and red black trees trade against each other.
updateDate: 2026-09-07T15:50
author: ['bishal-biswas']
level: 3
tags: ['trees', 'balancing', 'advanced']
course: dsa
---

## The problem being solved

A binary search tree is `O(log n)` only while it stays bushy. Insert sorted data and it becomes a linked list with `O(n)` operations.

Sorted insertion is not exotic. IDs, timestamps and alphabetical names all arrive in order.

A **self balancing tree** fixes the shape as it goes, so the height stays `O(log n)` no matter what order the data arrives in.

## Rotations

Every balancing scheme is built from one operation: the **rotation**. It changes the shape of the tree while preserving the search order.

A right rotation around `y`:

```text
      y                x
     / \              / \
    x   C    ->      A   y
   / \                  / \
  A   B                B   C
```

`x` moves up, `y` moves down to the right, and `B` changes parents.

Check the ordering. Before: `A < x < B < y < C`. After: `A < x < B < y < C`. Identical. The inorder walk is unchanged, which is exactly why rotations are safe.

```csharp
public class Node
{
    public int Value;
    public Node? Left;
    public Node? Right;
    public int Height = 1;

    public Node(int value) => Value = value;
}

static int HeightOf(Node? n) => n?.Height ?? 0;

static void UpdateHeight(Node n) =>
    n.Height = 1 + Math.Max(HeightOf(n.Left), HeightOf(n.Right));

static Node RotateRight(Node y)
{
    var x = y.Left!;
    var b = x.Right;

    x.Right = y;
    y.Left = b;

    UpdateHeight(y);      // y is now lower, update it first
    UpdateHeight(x);

    return x;             // x is the new root of this subtree
}

static Node RotateLeft(Node x)
{
    var y = x.Right!;
    var b = y.Left;

    y.Left = x;
    x.Right = b;

    UpdateHeight(x);
    UpdateHeight(y);

    return y;
}
```

Updating the lower node's height first matters. The higher node's height depends on it.

## AVL trees

The strictest scheme. For every node, the heights of its two subtrees differ by at most 1.

That difference is the **balance factor**:

```csharp
static int BalanceFactor(Node? n) =>
    n == null ? 0 : HeightOf(n.Left) - HeightOf(n.Right);
```

A factor of `-1`, `0` or `1` is fine. Anything outside that means the node needs rebalancing.

There are four cases, and each has a fixed remedy.

```text
Left Left     balance > 1  and value went left in the left subtree    rotate right
Left Right    balance > 1  and value went right in the left subtree   rotate left then right
Right Right   balance < -1 and value went right in the right subtree  rotate left
Right Left    balance < -1 and value went left in the right subtree   rotate right then left
```

The two double rotations exist because a single rotation on a zigzag shape produces another zigzag. The first rotation straightens it, the second lifts it.

```csharp
static Node Insert(Node? node, int value)
{
    if (node == null) return new Node(value);

    if (value < node.Value) node.Left = Insert(node.Left, value);
    else if (value > node.Value) node.Right = Insert(node.Right, value);
    else return node;                       // duplicates ignored

    UpdateHeight(node);

    int balance = BalanceFactor(node);

    // Left Left
    if (balance > 1 && value < node.Left!.Value) return RotateRight(node);

    // Right Right
    if (balance < -1 && value > node.Right!.Value) return RotateLeft(node);

    // Left Right
    if (balance > 1 && value > node.Left!.Value)
    {
        node.Left = RotateLeft(node.Left);
        return RotateRight(node);
    }

    // Right Left
    if (balance < -1 && value < node.Right!.Value)
    {
        node.Right = RotateRight(node.Right);
        return RotateLeft(node);
    }

    return node;
}

Node? root = null;
foreach (int value in new[] { 10, 20, 30, 40, 50, 25 }) root = Insert(root, value);

Console.WriteLine(root!.Value);              // 30, not 10
Console.WriteLine(HeightOf(root));           // 3, not 6
```

Inserting 10, 20, 30, 40, 50 into a plain search tree gives a straight line of height 5. The AVL tree rebalances into a bushy tree of height 3.

Balancing happens on the way back up the recursion, which is why the rotations sit after the recursive call.

## Why the height stays logarithmic

An AVL tree of height `h` must contain at least `F(h + 3) - 1` nodes, where `F` is the Fibonacci sequence. Fibonacci grows exponentially, so the height grows logarithmically.

The practical result: an AVL tree's height never exceeds about `1.44 * log2(n)`. For a million nodes that is at most 29 levels.

## Red black trees

A looser scheme that trades a slightly taller tree for far less rebalancing work.

Every node is coloured red or black, and five rules hold:

1. Every node is red or black.
2. The root is black.
3. All leaves, treated as null nodes, are black.
4. A red node cannot have a red child.
5. Every path from a node down to any leaf contains the same number of black nodes.

Rules 4 and 5 together bound the height. The longest path can be at most twice the shortest, because the longest alternates red and black while the shortest is all black.

That gives a height of at most `2 * log2(n + 1)`, looser than AVL's `1.44 * log2(n)`.

Rebalancing uses recolouring where possible and rotations only where necessary. Recolouring is cheap, and that is where the saving comes from.

## AVL or red black?

```text
                        AVL                     Red black
Height bound            1.44 log n              2 log n
Search                  faster (shorter tree)   slightly slower
Insert and delete       more rotations          fewer rotations
Rebalancing on delete   up to O(log n) rotations at most 3 rotations
Memory per node         an int for the height   one bit for the colour
Best for                read heavy workloads    write heavy workloads
```

**AVL** keeps the tree tighter, so lookups are marginally faster. It pays for that with more rotations on every change. Choose it when reads vastly outnumber writes, such as a lookup table built once.

**Red black** is more relaxed and rebalances less. Choose it for mixed or write heavy workloads. This is why almost every standard library uses one.

## What the framework uses

.NET's `SortedDictionary<TKey, TValue>` and `SortedSet<T>` are red black trees.

```csharp
var sorted = new SortedDictionary<int, string>();

foreach (int i in Enumerable.Range(1, 1_000_000)) sorted[i] = $"value {i}";

Console.WriteLine(sorted[500_000]);   // still O(log n), about 20 comparisons
```

A million sequential inserts, which would destroy a plain search tree, are handled without trouble. That guarantee is precisely what the balancing buys.

Java's `TreeMap` and C++'s `std::map` are also red black trees. It is the default choice across languages.

## Other balancing approaches

**Treap.** Each node gets a random priority and the tree is kept as a heap on those priorities. Balanced on average, and much simpler to implement.

**Splay tree.** Rotates the accessed node to the root on every access. Not balanced at any given moment, but amortised `O(log n)`, and it makes recently used items fast, which suits caches.

**B tree.** Many keys per node, chosen to match a disk page. Every database index uses one, because the cost that matters there is disk reads, not comparisons.

**Skip list.** Not a tree at all, but stacked linked lists giving `O(log n)` on average. Much simpler to make thread safe, which is why Redis uses one.

## When to write one yourself

Almost never. `SortedDictionary` and `SortedSet` cover ordinary needs, and are correct and tested.

Understanding rotations still matters, because it explains why sorted iteration and range queries cost `O(log n)` rather than `O(1)`, and why `SortedDictionary` is slower than `Dictionary` for plain key lookups.

## Quick recap

- Unbalanced search trees degrade to `O(n)`, and sorted input is the common cause.
- A rotation reshapes a subtree without changing the inorder ordering.
- AVL trees keep every balance factor within 1, using four rotation cases.
- Double rotations handle zigzag shapes, which a single rotation cannot fix.
- Red black trees allow up to twice the minimum height and rebalance far less.
- AVL suits read heavy work, red black suits write heavy work.
- `SortedDictionary` and `SortedSet` are red black trees, so use those.

<code id="code-content" class="language-csharp">
public class Node
{
    public int Value;
    public Node? Left, Right;
    public int Height = 1;
    public Node(int value) =&gt; Value = value;
}
static int HeightOf(Node? n) =&gt; n?.Height ?? 0;
static void UpdateHeight(Node n) =&gt; n.Height = 1 + Math.Max(HeightOf(n.Left), HeightOf(n.Right));
static int BalanceFactor(Node? n) =&gt; n == null ? 0 : HeightOf(n.Left) - HeightOf(n.Right);
// A rotation reshapes the tree WITHOUT changing the inorder order
static Node RotateRight(Node y)
{
    var x = y.Left!;
    y.Left = x.Right;
    x.Right = y;
    UpdateHeight(y);          // update the lower node first
    UpdateHeight(x);
    return x;                 // x is the new subtree root
}
static Node RotateLeft(Node x)
{
    var y = x.Right!;
    x.Right = y.Left;
    y.Left = x;
    UpdateHeight(x);
    UpdateHeight(y);
    return y;
}
// AVL insert: rebalance on the way back UP, four cases
static Node Insert(Node? node, int value)
{
    if (node == null) return new Node(value);
    if (value &lt; node.Value) node.Left = Insert(node.Left, value);
    else if (value &gt; node.Value) node.Right = Insert(node.Right, value);
    else return node;
    UpdateHeight(node);
    int balance = BalanceFactor(node);
    if (balance &gt; 1 &amp;&amp; value &lt; node.Left!.Value) return RotateRight(node);   // Left Left
    if (balance &lt; -1 &amp;&amp; value &gt; node.Right!.Value) return RotateLeft(node);  // Right Right
    if (balance &gt; 1 &amp;&amp; value &gt; node.Left!.Value)                             // Left Right
    {
        node.Left = RotateLeft(node.Left);
        return RotateRight(node);
    }
    if (balance &lt; -1 &amp;&amp; value &lt; node.Right!.Value)                           // Right Left
    {
        node.Right = RotateRight(node.Right);
        return RotateLeft(node);
    }
    return node;
}
// Sorted input that would make a plain BST a linked list stays bushy here
Node? root = null;
foreach (int v in new[] { 10, 20, 30, 40, 50, 25 }) root = Insert(root, v);
Console.WriteLine(root!.Value);        // 30, not 10
Console.WriteLine(HeightOf(root));     // 3, not 6
// In practice use the framework: both are red black trees, guaranteed O(log n)
var sorted = new SortedDictionary&lt;int, string&gt;();
foreach (int i in Enumerable.Range(1, 100_000)) sorted[i] = $"v{i}";
Console.WriteLine(sorted[50_000]);     // about 17 comparisons, not 50,000
</code></pre>
