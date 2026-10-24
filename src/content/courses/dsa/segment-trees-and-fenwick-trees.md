---
publishDate: 2026-07-22T16:10
title: Segment Trees and Fenwick Trees
slug: segment-trees-and-fenwick-trees
metadescription: Answer range sum and range minimum queries while the data keeps changing, with both queries and updates in O(log n).
updateDate: 2026-09-07T16:10
author: ['bishal-biswas']
level: 4
tags: ['trees', 'ranges', 'expert']
course: dsa
---

## When prefix sums are not enough

A prefix sum array answers any range sum in `O(1)`. It has one fatal flaw: **the moment a value changes, the whole array is stale**.

```text
                    Range query    Point update
Plain array         O(n)           O(1)
Prefix sums         O(1)           O(n) to rebuild
Segment tree        O(log n)       O(log n)
Fenwick tree        O(log n)       O(log n)
```

If your data is read only, use prefix sums. If it changes while you are querying it, you need one of these.

## The segment tree idea

Build a tree where each node stores the answer for a range. The root covers everything, its children cover the two halves, and leaves cover single elements.

```text
                [0..5] sum=25
              /               \
      [0..2] sum=9         [3..5] sum=16
      /       \             /        \
  [0..1]=4   [2]=5     [3..4]=11    [5]=5
   /    \                /   \
[0]=1  [1]=3          [3]=4  [4]=7
```

Any range you ask about is covered by `O(log n)` of these nodes, so a query only needs to combine a handful of stored answers.

## Building it

Store the tree in an array, using the same index arithmetic as a heap.

```csharp
public class SegmentTree
{
    private readonly int[] tree;
    private readonly int size;

    public SegmentTree(int[] values)
    {
        size = values.Length;
        tree = new int[4 * size];      // 4n is always enough room
        Build(values, 1, 0, size - 1);
    }

    private void Build(int[] values, int node, int low, int high)
    {
        if (low == high)
        {
            tree[node] = values[low];   // a leaf holds one element
            return;
        }

        int mid = low + (high - low) / 2;

        Build(values, 2 * node, low, mid);
        Build(values, 2 * node + 1, mid + 1, high);

        tree[node] = tree[2 * node] + tree[2 * node + 1];   // combine the children
    }
}
```

`4 * size` looks arbitrary. The tree is not always perfectly complete, so `2n` is not always enough, and `4n` always is. It is the standard safe allocation.

Node 1 is the root, and node `k` has children `2k` and `2k + 1`. Starting at 1 rather than 0 makes that arithmetic work.

Building is `O(n)`, since every node is filled exactly once.

## Querying a range

Three cases at every node: the range misses entirely, covers entirely, or overlaps partly.

```csharp
public int RangeSum(int from, int to) => Query(1, 0, size - 1, from, to);

private int Query(int node, int low, int high, int from, int to)
{
    if (to < low || high < from) return 0;          // no overlap, contributes nothing

    if (from <= low && high <= to) return tree[node]; // fully covered, use the stored sum

    int mid = low + (high - low) / 2;

    return Query(2 * node, low, mid, from, to)
         + Query(2 * node + 1, mid + 1, high, from, to);
}
```

The "fully covered" case is what makes it fast. Whole subtrees are answered from one stored value instead of being walked.

Only `O(log n)` nodes are ever partially covered, so the query is `O(log n)`.

## Updating a value

Change the leaf, then fix every ancestor on the way back up.

```csharp
public void Update(int index, int value) => Update(1, 0, size - 1, index, value);

private void Update(int node, int low, int high, int index, int value)
{
    if (low == high)
    {
        tree[node] = value;
        return;
    }

    int mid = low + (high - low) / 2;

    if (index <= mid) Update(2 * node, low, mid, index, value);
    else Update(2 * node + 1, mid + 1, high, index, value);

    tree[node] = tree[2 * node] + tree[2 * node + 1];   // recompute this node
}
```

Only one path from root to leaf is touched, so this is `O(log n)`.

```csharp
var values = new[] { 1, 3, 5, 7, 9, 11 };
var tree = new SegmentTree(values);

Console.WriteLine(tree.RangeSum(1, 3));   // 3 + 5 + 7 = 15

tree.Update(1, 10);                       // values[1] becomes 10

Console.WriteLine(tree.RangeSum(1, 3));   // 10 + 5 + 7 = 22
```

## Not just sums

Change the combine step and the same structure answers a different question.

```csharp
// Range minimum
tree[node] = Math.Min(tree[2 * node], tree[2 * node + 1]);
// and the no overlap case returns int.MaxValue

// Range maximum
tree[node] = Math.Max(tree[2 * node], tree[2 * node + 1]);
// no overlap returns int.MinValue

// Greatest common divisor over a range
tree[node] = Gcd(tree[2 * node], tree[2 * node + 1]);
// no overlap returns 0
```

The requirement is that the operation is **associative**, so combining in any grouping gives the same answer. Sum, min, max, gcd and bitwise operations all qualify. Average does not, though you can store sums and counts and divide at the end.

The no overlap return value must be the **identity** for the operation: 0 for sum, `int.MaxValue` for min, `int.MinValue` for max.

## The Fenwick tree

A **Fenwick tree**, also called a binary indexed tree, does prefix sums with updates using far less code and memory. It is the tool of choice when sums are all you need.

```csharp
public class FenwickTree
{
    private readonly long[] tree;

    public FenwickTree(int size) => tree = new long[size + 1];   // 1 based

    public void Add(int index, long delta)
    {
        for (int i = index + 1; i < tree.Length; i += i & -i)
        {
            tree[i] += delta;
        }
    }

    public long PrefixSum(int index)
    {
        long sum = 0;

        for (int i = index + 1; i > 0; i -= i & -i)
        {
            sum += tree[i];
        }

        return sum;
    }

    public long RangeSum(int from, int to) => PrefixSum(to) - PrefixSum(from - 1);
}
```

Ten lines of real code, one array, no recursion.

## The bit trick

`i & -i` isolates the lowest set bit of `i`.

```text
i = 12 = 1100
-i     = 0100  (two's complement)
i & -i = 0100 = 4
```

Each entry `tree[i]` covers a block of `i & -i` elements ending at `i`. Adding the lowest bit walks to the next node that also covers this index. Subtracting it walks to the next block down.

Both loops run once per set bit, so both are `O(log n)`.

```csharp
var fenwick = new FenwickTree(6);
var values = new[] { 1, 3, 5, 7, 9, 11 };

for (int i = 0; i < values.Length; i++) fenwick.Add(i, values[i]);

Console.WriteLine(fenwick.RangeSum(1, 3));   // 15

fenwick.Add(1, 7);                           // values[1] goes from 3 to 10

Console.WriteLine(fenwick.RangeSum(1, 3));   // 22
```

Note `Add` takes a **delta**, not a new value. Setting an absolute value means computing the difference first.

## Choosing between them

```text
                     Segment tree           Fenwick tree
Memory               4n                     n
Code                 about 40 lines         about 10 lines
Speed                fast                   faster, better cache use
Sum queries          yes                    yes
Min or max queries   yes                    no
Range updates        yes, with lazy tags    only with two trees
Ease of debugging    easier, explicit       harder, bit tricks
```

**Use a Fenwick tree** for prefix or range sums with point updates. It is smaller, faster and shorter.

**Use a segment tree** when you need minimum, maximum, gcd, or range updates. It is the general purpose one.

## Lazy propagation, briefly

Segment trees can also handle **range updates**, such as "add 5 to everything from index 2 to index 8", in `O(log n)` rather than touching every element.

The trick is to mark a node with "everything below me needs plus 5" and only push that mark down when a query actually visits the children.

```csharp
private void Push(int node, int low, int high)
{
    if (lazy[node] == 0) return;

    tree[node] += lazy[node] * (high - low + 1);

    if (low != high)
    {
        lazy[2 * node] += lazy[node];
        lazy[2 * node + 1] += lazy[node];
    }

    lazy[node] = 0;
}
```

Work is deferred until someone asks for it, so a range update touches only `O(log n)` nodes. This is the same idea as lazy evaluation elsewhere in programming.

## Do you need this?

Honestly, rarely in application code. These structures belong to competitive programming, and to specialised systems like time series databases and analytics engines.

They are worth understanding because they demonstrate the last big idea in this course: **precompute partial answers so a query never has to look at all the data**. That principle powers database indexes, materialised views and caching layers everywhere.

## Quick recap

- Prefix sums break when the data changes, so use these when it does.
- A segment tree stores the answer for a range at each node, giving `O(log n)` queries and updates.
- Allocate `4n` for the tree array, and root the tree at index 1.
- A query has three cases: no overlap, full cover, and partial overlap.
- Any associative operation works, with the correct identity for the no overlap case.
- A Fenwick tree does prefix sums in a tenth of the code, using `i & -i`.
- Fenwick for sums, segment tree for anything else.

<code id="code-content" class="language-csharp">
// Segment tree: each node stores the answer for a range. Root is index 1.
public class SegmentTree
{
    private readonly int[] tree;
    private readonly int size;
    public SegmentTree(int[] values)
    {
        size = values.Length;
        tree = new int[4 * size];               // 4n is always enough
        Build(values, 1, 0, size - 1);
    }
    private void Build(int[] v, int node, int low, int high)
    {
        if (low == high) { tree[node] = v[low]; return; }
        int mid = low + (high - low) / 2;
        Build(v, 2 * node, low, mid);
        Build(v, 2 * node + 1, mid + 1, high);
        tree[node] = tree[2 * node] + tree[2 * node + 1];
    }
    public int RangeSum(int from, int to) =&gt; Query(1, 0, size - 1, from, to);
    private int Query(int node, int low, int high, int from, int to)
    {
        if (to &lt; low || high &lt; from) return 0;          // no overlap: identity
        if (from &lt;= low &amp;&amp; high &lt;= to) return tree[node]; // fully covered: stored answer
        int mid = low + (high - low) / 2;
        return Query(2 * node, low, mid, from, to)
             + Query(2 * node + 1, mid + 1, high, from, to);
    }
    public void Update(int index, int value) =&gt; Update(1, 0, size - 1, index, value);
    private void Update(int node, int low, int high, int index, int value)
    {
        if (low == high) { tree[node] = value; return; }
        int mid = low + (high - low) / 2;
        if (index &lt;= mid) Update(2 * node, low, mid, index, value);
        else Update(2 * node + 1, mid + 1, high, index, value);
        tree[node] = tree[2 * node] + tree[2 * node + 1];
    }
}
var tree = new SegmentTree(new[] { 1, 3, 5, 7, 9, 11 });
Console.WriteLine(tree.RangeSum(1, 3));    // 15
tree.Update(1, 10);
Console.WriteLine(tree.RangeSum(1, 3));    // 22
// Swap the combine step for Math.Min / Math.Max / Gcd. Any ASSOCIATIVE operation
// works, as long as the no overlap case returns that operation's identity.
// Fenwick tree: prefix sums in a tenth of the code. i &amp; -i isolates the lowest bit.
public class FenwickTree
{
    private readonly long[] tree;
    public FenwickTree(int size) =&gt; tree = new long[size + 1];   // 1 based
    public void Add(int index, long delta)                       // DELTA, not a value
    {
        for (int i = index + 1; i &lt; tree.Length; i += i &amp; -i) tree[i] += delta;
    }
    public long PrefixSum(int index)
    {
        long sum = 0;
        for (int i = index + 1; i &gt; 0; i -= i &amp; -i) sum += tree[i];
        return sum;
    }
    public long RangeSum(int from, int to) =&gt; PrefixSum(to) - PrefixSum(from - 1);
}
var fenwick = new FenwickTree(6);
int[] values = { 1, 3, 5, 7, 9, 11 };
for (int i = 0; i &lt; values.Length; i++) fenwick.Add(i, values[i]);
Console.WriteLine(fenwick.RangeSum(1, 3));  // 15
fenwick.Add(1, 7);                          // 3 becomes 10
Console.WriteLine(fenwick.RangeSum(1, 3));  // 22
</code></pre>
