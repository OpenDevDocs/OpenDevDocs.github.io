---
publishDate: 2026-07-27T18:00
title: Minimum Spanning Tree
slug: minimum-spanning-tree
metadescription: Connect every vertex at the lowest total cost with Kruskal's and Prim's algorithms, and see why greedy choices work here.
updateDate: 2026-09-07T18:00
author: ['bishal-biswas']
level: 3
tags: ['graphs', 'spanning tree', 'greedy']
course: dsa
---

## Connecting everything cheaply

You have towns and possible roads between them, each with a cost. Build the cheapest set of roads that connects every town.

That is a **minimum spanning tree**. Spanning because it reaches every vertex, tree because it has no cycles, minimum because the total weight is as small as possible.

```text
      A ---4--- B
      |  \      |
      8    5    3
      |      \  |
      C ---2--- D
```

Using `C-D` (2), `B-D` (3) and `A-D` (5) connects everything for 10. Any other choice costs more.

A spanning tree of `v` vertices always has exactly `v - 1` edges. One fewer and it is disconnected, one more and it contains a cycle.

## Where it is used

- Network design, laying cable or fibre between locations.
- Clustering, by building the tree and removing the most expensive edges.
- Approximating the travelling salesman problem.
- Image segmentation.
- Circuit board routing.

## Kruskal's algorithm

Sort all edges by weight and add them cheapest first, skipping any that would create a cycle.

That cycle check is the interesting part, and it is what union find is for.

```csharp
record Edge(int From, int To, int Weight);

static List<Edge> Kruskal(int vertexCount, List<Edge> edges)
{
    edges.Sort((a, b) => a.Weight.CompareTo(b.Weight));

    var parent = new int[vertexCount];
    for (int i = 0; i < vertexCount; i++) parent[i] = i;

    int Find(int x)
    {
        while (parent[x] != x)
        {
            parent[x] = parent[parent[x]];    // path compression
            x = parent[x];
        }
        return x;
    }

    bool Union(int a, int b)
    {
        int rootA = Find(a), rootB = Find(b);

        if (rootA == rootB) return false;     // already connected, this makes a cycle

        parent[rootB] = rootA;
        return true;
    }

    var result = new List<Edge>();

    foreach (var edge in edges)
    {
        if (Union(edge.From, edge.To)) result.Add(edge);

        if (result.Count == vertexCount - 1) break;   // done
    }

    return result;
}

var edges = new List<Edge>
{
    new(0, 1, 4),   // A-B
    new(0, 2, 8),   // A-C
    new(0, 3, 5),   // A-D
    new(1, 3, 3),   // B-D
    new(2, 3, 2)    // C-D
};

var tree = Kruskal(4, edges);

Console.WriteLine(tree.Sum(e => e.Weight));   // 10

foreach (var e in tree) Console.WriteLine($"{e.From}-{e.To} costs {e.Weight}");
// 2-3 costs 2, 1-3 costs 3, 0-1 costs 4
```

`Union` returning `false` means both vertices are already in the same component, so adding this edge would close a cycle. Skip it.

The early `break` at `v - 1` edges avoids scanning the rest of a large edge list once the tree is complete.

**Complexity:** `O(e log e)`, dominated by the sort. The union find operations are nearly constant time.

## Prim's algorithm

Grow one tree outward from a starting vertex. Repeatedly add the cheapest edge that reaches somewhere new.

```csharp
static List<(int From, int To, int Weight)> Prim(
    Dictionary<int, List<(int To, int Weight)>> graph, int start)
{
    var inTree = new HashSet<int> { start };
    var result = new List<(int, int, int)>();
    var queue = new PriorityQueue<(int From, int To), int>();

    foreach (var (to, weight) in graph[start]) queue.Enqueue((start, to), weight);

    while (queue.TryDequeue(out var edge, out int weight))
    {
        if (!inTree.Add(edge.To)) continue;      // already reached, skip

        result.Add((edge.From, edge.To, weight));

        foreach (var (next, nextWeight) in graph[edge.To])
        {
            if (!inTree.Contains(next)) queue.Enqueue((edge.To, next), nextWeight);
        }
    }

    return result;
}

var graph = new Dictionary<int, List<(int, int)>>
{
    [0] = new() { (1, 4), (2, 8), (3, 5) },
    [1] = new() { (0, 4), (3, 3) },
    [2] = new() { (0, 8), (3, 2) },
    [3] = new() { (0, 5), (1, 3), (2, 2) }
};

var mst = Prim(graph, 0);
Console.WriteLine(mst.Sum(e => e.Weight));   // 10
```

The structure is almost identical to Dijkstra. The one difference is what the priority holds.

**Dijkstra** uses the total distance from the source.
**Prim** uses the weight of the single edge.

That is genuinely the only change, and it is worth sitting with, because the two algorithms answer very different questions.

**Complexity:** `O(e log v)` with a heap.

## Which one

```text
                  Kruskal                  Prim
Approach          globally cheapest edge   grow one tree outward
Needs             union find               priority queue
Input             edge list                adjacency list
Complexity        O(e log e)               O(e log v)
Better for        sparse graphs            dense graphs
Handles           disconnected graphs      one component only
```

**Kruskal** on sparse graphs, where sorting a short edge list is cheap. It also naturally produces a minimum spanning **forest** when the graph is disconnected, one tree per component.

**Prim** on dense graphs, where the edge list is huge but each vertex is reached quickly.

## Why greedy works here

Greedy algorithms usually fail. Here it provably works, thanks to the **cut property**.

> Take any way of splitting the vertices into two groups. The cheapest edge crossing that split is in some minimum spanning tree.

Kruskal's takes the cheapest edge that joins two different components, which is exactly such a crossing edge. Prim's takes the cheapest edge crossing between "in the tree" and "not in the tree", also exactly such an edge.

Both are always making a provably safe choice, which is why the greedy result is optimal rather than merely good.

## Checking connectivity

If the result has fewer than `v - 1` edges, the graph was disconnected.

```csharp
var tree = Kruskal(vertexCount, edges);

if (tree.Count < vertexCount - 1)
{
    Console.WriteLine("The graph is not connected, this is a spanning forest");
}
```

## Maximum spanning tree

Sort descending and everything else is unchanged.

```csharp
edges.Sort((a, b) => b.Weight.CompareTo(a.Weight));
```

Useful when the weights are strengths or capacities rather than costs.

## Clustering with it

A neat application. Build the tree, then remove the `k - 1` most expensive edges. What remains is `k` clusters, and the split maximises the distance between them.

```csharp
static List<Edge> ClusterInto(int vertexCount, List<Edge> edges, int clusters)
{
    var tree = Kruskal(vertexCount, edges);

    // drop the most expensive edges to break the tree into clusters
    return tree.OrderBy(e => e.Weight).Take(tree.Count - (clusters - 1)).ToList();
}
```

This is single linkage clustering, and it comes free once you have the spanning tree.

## Quick recap

- A minimum spanning tree connects every vertex with `v - 1` edges at the lowest total cost.
- Kruskal sorts all edges and adds the cheapest that does not create a cycle.
- Union find is what makes Kruskal's cycle check fast.
- Prim grows one tree outward, always adding the cheapest edge leaving it.
- Prim and Dijkstra differ only in what the priority holds.
- The cut property is why the greedy choice is provably optimal here.
- Fewer than `v - 1` edges in the result means the graph was disconnected.

<code id="code-content" class="language-csharp">
record Edge(int From, int To, int Weight);
// Kruskal: sort every edge, add the cheapest that does not close a cycle
static List&lt;Edge&gt; Kruskal(int vertexCount, List&lt;Edge&gt; edges)
{
    edges.Sort((a, b) =&gt; a.Weight.CompareTo(b.Weight));
    var parent = new int[vertexCount];
    for (int i = 0; i &lt; vertexCount; i++) parent[i] = i;
    int Find(int x)
    {
        while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x]; }
        return x;
    }
    bool Union(int a, int b)
    {
        int ra = Find(a), rb = Find(b);
        if (ra == rb) return false;              // same component: this makes a cycle
        parent[rb] = ra;
        return true;
    }
    var result = new List&lt;Edge&gt;();
    foreach (var e in edges)
    {
        if (Union(e.From, e.To)) result.Add(e);
        if (result.Count == vertexCount - 1) break;   // a spanning tree has v-1 edges
    }
    return result;
}
var edges = new List&lt;Edge&gt;
{
    new(0, 1, 4), new(0, 2, 8), new(0, 3, 5), new(1, 3, 3), new(2, 3, 2)
};
var tree = Kruskal(4, edges);
Console.WriteLine(tree.Sum(e =&gt; e.Weight));      // 10
// Prim: grow ONE tree outward, always taking the cheapest edge leaving it
static List&lt;(int From, int To, int Weight)&gt; Prim(
    Dictionary&lt;int, List&lt;(int To, int Weight)&gt;&gt; graph, int start)
{
    var inTree = new HashSet&lt;int&gt; { start };
    var result = new List&lt;(int, int, int)&gt;();
    var queue = new PriorityQueue&lt;(int From, int To), int&gt;();
    foreach (var (to, w) in graph[start]) queue.Enqueue((start, to), w);
    while (queue.TryDequeue(out var edge, out int weight))
    {
        if (!inTree.Add(edge.To)) continue;
        result.Add((edge.From, edge.To, weight));
        foreach (var (next, nw) in graph[edge.To])
            if (!inTree.Contains(next)) queue.Enqueue((edge.To, next), nw);
    }
    return result;
}
var graph = new Dictionary&lt;int, List&lt;(int, int)&gt;&gt;
{
    [0] = new() { (1, 4), (2, 8), (3, 5) },
    [1] = new() { (0, 4), (3, 3) },
    [2] = new() { (0, 8), (3, 2) },
    [3] = new() { (0, 5), (1, 3), (2, 2) }
};
Console.WriteLine(Prim(graph, 0).Sum(e =&gt; e.Weight));   // 10
// Prim and Dijkstra are the same shape. The ONLY difference:
//   Dijkstra's priority = total distance from the source
//   Prim's priority     = the weight of this one edge
// Maximum spanning tree? Sort descending, change nothing else.
// Fewer than v-1 edges in the result means the graph was disconnected.
</code></pre>
