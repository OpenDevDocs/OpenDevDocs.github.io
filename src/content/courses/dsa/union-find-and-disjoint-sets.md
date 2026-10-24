---
publishDate: 2026-07-28T18:10
title: Union Find and Disjoint Sets
slug: union-find-and-disjoint-sets
metadescription: Track which items belong to the same group with near constant time merging, using path compression and union by rank.
updateDate: 2026-09-07T18:10
author: ['bishal-biswas']
level: 3
tags: ['graphs', 'union find', 'data structures']
course: dsa
---

## The question it answers

"Are these two things in the same group?" and "merge these two groups", both asked many times.

A depth first search answers the first in `O(v + e)` every time. **Union find**, also called a disjoint set union, answers both in effectively constant time.

Uses:

- Kruskal's minimum spanning tree, for the cycle check.
- Detecting cycles in an undirected graph.
- Counting connected components as edges arrive.
- Grouping accounts that share an email address.
- Percolation and network connectivity.
- Image segmentation.

## The idea

Each group is a tree, and each item points at its parent. The root of the tree is the group's identity.

Two items are in the same group exactly when they have the same root.

```text
group 1:   0 <- 1 <- 3        root is 0
group 2:   2 <- 4            root is 2
```

## The naive version

```csharp
public class SimpleUnionFind
{
    private readonly int[] parent;

    public SimpleUnionFind(int size)
    {
        parent = new int[size];
        for (int i = 0; i < size; i++) parent[i] = i;      // everyone is their own root
    }

    public int Find(int x)
    {
        while (parent[x] != x) x = parent[x];              // walk up to the root
        return x;
    }

    public void Union(int a, int b)
    {
        parent[Find(b)] = Find(a);                         // point one root at the other
    }

    public bool Connected(int a, int b) => Find(a) == Find(b);
}
```

Correct, and it can degenerate badly. Union 0 and 1, then 1 and 2, then 2 and 3, and you get a chain. `Find` then walks the whole chain, giving `O(n)`.

Two small improvements fix that completely.

## Union by rank

Always attach the **shorter** tree under the taller one. That keeps the trees shallow.

```csharp
private readonly int[] rank;

public void Union(int a, int b)
{
    int rootA = Find(a), rootB = Find(b);

    if (rootA == rootB) return;

    if (rank[rootA] < rank[rootB])
    {
        parent[rootA] = rootB;
    }
    else if (rank[rootA] > rank[rootB])
    {
        parent[rootB] = rootA;
    }
    else
    {
        parent[rootB] = rootA;
        rank[rootA]++;          // only when the heights were equal
    }
}
```

Attaching the taller under the shorter would add a level. Attaching the shorter under the taller adds none.

**Union by size** is an alternative, attaching the smaller group under the larger. It performs about the same and gives you group sizes for free, which is often useful.

## Path compression

While walking up to find the root, point everything on the way directly at it. The next lookup is then immediate.

```csharp
public int Find(int x)
{
    if (parent[x] != x) parent[x] = Find(parent[x]);   // point straight at the root
    return parent[x];
}
```

The tree gets flatter every time you query it. This is a self improving data structure, which is unusual and rather elegant.

An iterative version avoids any recursion depth risk:

```csharp
public int Find(int x)
{
    int root = x;
    while (parent[root] != root) root = parent[root];

    while (parent[x] != root)          // second pass, repoint everything
    {
        int next = parent[x];
        parent[x] = root;
        x = next;
    }

    return root;
}
```

Path halving is a one line approximation that is nearly as good:

```csharp
public int Find(int x)
{
    while (parent[x] != x)
    {
        parent[x] = parent[parent[x]];   // skip a generation
        x = parent[x];
    }
    return x;
}
```

## The complete version

```csharp
public class UnionFind
{
    private readonly int[] parent;
    private readonly int[] size;

    public int GroupCount { get; private set; }

    public UnionFind(int count)
    {
        parent = new int[count];
        size = new int[count];
        GroupCount = count;

        for (int i = 0; i < count; i++)
        {
            parent[i] = i;
            size[i] = 1;
        }
    }

    public int Find(int x)
    {
        while (parent[x] != x)
        {
            parent[x] = parent[parent[x]];   // path halving
            x = parent[x];
        }
        return x;
    }

    public bool Union(int a, int b)
    {
        int rootA = Find(a), rootB = Find(b);

        if (rootA == rootB) return false;    // already together

        if (size[rootA] < size[rootB]) (rootA, rootB) = (rootB, rootA);

        parent[rootB] = rootA;               // smaller under larger
        size[rootA] += size[rootB];
        GroupCount--;

        return true;
    }

    public bool Connected(int a, int b) => Find(a) == Find(b);

    public int SizeOfGroup(int x) => size[Find(x)];
}

var groups = new UnionFind(6);

groups.Union(0, 1);
groups.Union(1, 2);
groups.Union(3, 4);

Console.WriteLine(groups.Connected(0, 2));   // True
Console.WriteLine(groups.Connected(0, 3));   // False
Console.WriteLine(groups.GroupCount);        // 3, being {0,1,2} {3,4} {5}
Console.WriteLine(groups.SizeOfGroup(0));    // 3
```

`Union` returning a bool is the detail that makes it useful in Kruskal's algorithm. `false` means the two were already connected, so this edge would close a cycle.

`GroupCount` starts at `count` and drops by one on every successful union, which gives you the number of connected components for free.

## The complexity

With both optimisations, `m` operations on `n` items cost `O(m * a(n))`, where `a` is the inverse Ackermann function.

That function grows so slowly it is below 5 for any input that fits in the universe. Treat it as constant.

```text
                        Find              Union
Naive                   O(n)              O(n)
Union by rank only      O(log n)          O(log n)
Both optimisations      effectively O(1)  effectively O(1)
```

## Counting islands as they appear

Union find shines when connections arrive over time. A depth first search would have to rerun from scratch after each addition.

```csharp
static List<int> CountIslandsOverTime(int rows, int cols, int[][] additions)
{
    var uf = new UnionFind(rows * cols);
    var isLand = new bool[rows * cols];
    var counts = new List<int>();
    int islands = 0;

    int[] dRow = { -1, 1, 0, 0 };
    int[] dCol = { 0, 0, -1, 1 };

    foreach (var position in additions)
    {
        int row = position[0], col = position[1];
        int index = row * cols + col;

        if (isLand[index])
        {
            counts.Add(islands);
            continue;
        }

        isLand[index] = true;
        islands++;

        for (int d = 0; d < 4; d++)
        {
            int r = row + dRow[d], c = col + dCol[d];

            if (r < 0 || r >= rows || c < 0 || c >= cols) continue;

            int neighbour = r * cols + c;

            if (!isLand[neighbour]) continue;

            if (uf.Union(index, neighbour)) islands--;   // two islands merged into one
        }

        counts.Add(islands);
    }

    return counts;
}
```

Each new land cell adds an island, and every successful merge with a neighbour removes one. `row * cols + col` flattens a grid position into a single index, which is the standard trick for using union find on a grid.

## Detecting a cycle

```csharp
static bool HasCycle(int vertexCount, List<(int From, int To)> edges)
{
    var uf = new UnionFind(vertexCount);

    foreach (var (from, to) in edges)
    {
        if (!uf.Union(from, to)) return true;   // both ends were already connected
    }

    return false;
}

Console.WriteLine(HasCycle(3, new List<(int, int)> { (0, 1), (1, 2), (2, 0) }));   // True
```

Three lines, for undirected graphs. Note this does **not** work for directed graphs, where union find cannot see edge direction.

## Non integer items

Map objects to indexes with a dictionary.

```csharp
public class UnionFind<T> where T : notnull
{
    private readonly Dictionary<T, T> parent = new();

    public void Add(T item) => parent.TryAdd(item, item);

    public T Find(T item)
    {
        Add(item);

        while (!parent[item]!.Equals(item))
        {
            parent[item] = parent[parent[item]];
            item = parent[item];
        }

        return item;
    }

    public bool Union(T a, T b)
    {
        T rootA = Find(a), rootB = Find(b);

        if (rootA.Equals(rootB)) return false;

        parent[rootB] = rootA;
        return true;
    }
}

var accounts = new UnionFind<string>();
accounts.Union("asha@mail.com", "asha.b@work.com");
accounts.Union("asha.b@work.com", "a.biswas@old.com");

Console.WriteLine(accounts.Find("asha@mail.com").Equals(accounts.Find("a.biswas@old.com")));
// True, all three belong to the same person
```

Slower than the array version because of hashing, but far more convenient. This is exactly how "merge duplicate accounts" features work.

## When not to use it

**Union find cannot split groups.** Merging is easy, unmerging is not, because path compression has destroyed the original structure. If you need to remove connections, use a different approach and rebuild.

**It does not tell you the path.** It answers whether two items are connected, not how. Use breadth first search for the route.

**It ignores direction.** Union find is for undirected connectivity only.

## Quick recap

- Union find tracks group membership with a forest, where the root identifies the group.
- Union by size or rank keeps the trees shallow.
- Path compression flattens the tree during every lookup.
- With both, operations are effectively `O(1)`.
- `Union` returning `false` means the items were already connected, which detects cycles.
- Track a group count and decrement it on each successful union.
- It cannot split groups, find paths, or handle directed edges.

<code id="code-content" class="language-csharp">
// Each group is a tree. The root is the group's identity.
public class UnionFind
{
    private readonly int[] parent;
    private readonly int[] size;
    public int GroupCount { get; private set; }
    public UnionFind(int count)
    {
        parent = new int[count];
        size = new int[count];
        GroupCount = count;
        for (int i = 0; i &lt; count; i++) { parent[i] = i; size[i] = 1; }
    }
    public int Find(int x)
    {
        while (parent[x] != x)
        {
            parent[x] = parent[parent[x]];      // path halving: flattens as it walks
            x = parent[x];
        }
        return x;
    }
    public bool Union(int a, int b)
    {
        int rootA = Find(a), rootB = Find(b);
        if (rootA == rootB) return false;       // already together
        if (size[rootA] &lt; size[rootB]) (rootA, rootB) = (rootB, rootA);
        parent[rootB] = rootA;                  // smaller group under larger
        size[rootA] += size[rootB];
        GroupCount--;
        return true;
    }
    public bool Connected(int a, int b) =&gt; Find(a) == Find(b);
    public int SizeOfGroup(int x) =&gt; size[Find(x)];
}
var groups = new UnionFind(6);
groups.Union(0, 1);
groups.Union(1, 2);
groups.Union(3, 4);
Console.WriteLine(groups.Connected(0, 2));      // True
Console.WriteLine(groups.GroupCount);           // 3: {0,1,2} {3,4} {5}
Console.WriteLine(groups.SizeOfGroup(0));       // 3
// With both optimisations every operation is effectively O(1).
// Cycle detection in an undirected graph, in three lines
static bool HasCycle(int vertexCount, List&lt;(int From, int To)&gt; edges)
{
    var uf = new UnionFind(vertexCount);
    foreach (var (from, to) in edges)
        if (!uf.Union(from, to)) return true;   // both ends already connected
    return false;
}
Console.WriteLine(HasCycle(3, new List&lt;(int, int)&gt; { (0, 1), (1, 2), (2, 0) }));   // True
// On a grid, flatten the position: index = row * cols + col
int rows = 3, cols = 4, row = 1, col = 2;
int index = row * cols + col;                   // 6
// It CANNOT split groups, find paths, or handle directed edges.
</code></pre>
