---
publishDate: 2026-07-25T17:10
title: Graph Representations
slug: graph-representations
metadescription: Compare adjacency lists, adjacency matrices and edge lists, and pick the storage that matches how you will use the graph.
updateDate: 2026-09-07T17:10
author: ['bishal-biswas']
level: 2
tags: ['graphs', 'representation', 'data structures']
course: dsa
---

## Three ways to store a graph

The algorithm you write barely changes. The storage decides whether it is fast or slow, and whether it fits in memory at all.

```text
    A --- B
    |     |
    C --- D
```

## Adjacency list

Each vertex keeps a list of its neighbours. This is the default, and the right answer most of the time.

```csharp
var graph = new Dictionary<string, List<string>>
{
    ["A"] = new() { "B", "C" },
    ["B"] = new() { "A", "D" },
    ["C"] = new() { "A", "D" },
    ["D"] = new() { "B", "C" }
};

foreach (string neighbour in graph["A"]) Console.WriteLine(neighbour);   // B, C
```

**Memory:** `O(v + e)`. You store each vertex once and each edge once, or twice if undirected.

**Find the neighbours of a vertex:** `O(1)` to get the list, then `O(degree)` to walk it. This is what every traversal does, and it is why the adjacency list wins.

**Check whether a specific edge exists:** `O(degree)`, because you scan the list.

For integer vertices, an array of lists is leaner:

```csharp
var graph = new List<int>[5];
for (int i = 0; i < graph.Length; i++) graph[i] = new List<int>();

void AddEdge(int from, int to)
{
    graph[from].Add(to);
    graph[to].Add(from);      // undirected
}
```

Use a `HashSet<int>` instead of a `List<int>` if you need `O(1)` edge checks and do not care about the order of neighbours.

## Adjacency matrix

A grid of booleans. `matrix[i, j]` says whether there is an edge from `i` to `j`.

```csharp
int vertexCount = 4;
var matrix = new bool[vertexCount, vertexCount];

void AddEdge(int from, int to)
{
    matrix[from, to] = true;
    matrix[to, from] = true;      // undirected
}

AddEdge(0, 1);   // A to B
AddEdge(0, 2);   // A to C
AddEdge(1, 3);   // B to D
AddEdge(2, 3);   // C to D

Console.WriteLine(matrix[0, 1]);   // True
Console.WriteLine(matrix[0, 3]);   // False
```

```text
     A  B  C  D
  A  0  1  1  0
  B  1  0  0  1
  C  1  0  0  1
  D  0  1  1  0
```

An undirected graph gives a symmetric matrix, which means you are storing everything twice.

**Memory:** `O(v^2)`, always. A graph with 10,000 vertices and only 20,000 edges still needs 100 million cells. That is the killer.

**Check a specific edge:** `O(1)`. This is the one thing it is genuinely better at.

**Find the neighbours of a vertex:** `O(v)`, because you scan a whole row even if there is only one neighbour. This is what makes traversals slow on sparse graphs.

For weights, use numbers instead of booleans:

```csharp
var weights = new int[vertexCount, vertexCount];

for (int i = 0; i < vertexCount; i++)
{
    for (int j = 0; j < vertexCount; j++)
    {
        if (i != j) weights[i, j] = int.MaxValue;    // no edge
    }
}

weights[0, 1] = 5;
```

Using `int.MaxValue` for "no edge" is conventional, but it overflows the moment you add two of them. Use a large sentinel like `1_000_000` instead if you plan to add path lengths.

## Edge list

Just a list of the edges, with no per vertex structure.

```csharp
record Edge(int From, int To, int Weight = 1);

var edges = new List<Edge>
{
    new(0, 1, 5),
    new(0, 2, 3),
    new(1, 3, 2),
    new(2, 3, 1)
};
```

**Memory:** `O(e)`, the smallest of the three.

**Find the neighbours of a vertex:** `O(e)`, you scan everything. Terrible for traversal.

So why use it? Because some algorithms work on edges directly and never ask for a vertex's neighbours.

**Kruskal's minimum spanning tree** sorts all edges by weight and adds them one by one. An edge list is exactly the right shape.

**Bellman Ford** relaxes every edge repeatedly, again a straight pass over the list.

It is also the natural input format. Files and database tables usually give you edges, and you convert to an adjacency list once at the start.

```csharp
static Dictionary<int, List<int>> ToAdjacencyList(List<Edge> edges)
{
    var graph = new Dictionary<int, List<int>>();

    foreach (var edge in edges)
    {
        if (!graph.TryGetValue(edge.From, out var fromList))
        {
            graph[edge.From] = fromList = new List<int>();
        }

        fromList.Add(edge.To);

        if (!graph.TryGetValue(edge.To, out var toList))
        {
            graph[edge.To] = toList = new List<int>();
        }

        toList.Add(edge.From);
    }

    return graph;
}
```

## The comparison

```text
                            Adjacency list   Adjacency matrix   Edge list
Memory                      O(v + e)         O(v^2)             O(e)
Add an edge                 O(1)             O(1)               O(1)
Remove an edge              O(degree)        O(1)               O(e)
Check an edge exists        O(degree)        O(1)               O(e)
Get all neighbours          O(degree)        O(v)               O(e)
Iterate all edges           O(v + e)         O(v^2)             O(e)
Best for                    almost everything dense graphs      edge based algorithms
```

## Choosing

**Use an adjacency list** unless you have a specific reason not to. Traversals, shortest paths, cycle detection, topological sort all want neighbours quickly, and real graphs are sparse.

**Use an adjacency matrix** when the graph is dense, when the vertex count is small and fixed, or when the algorithm needs constant time edge checks. Floyd Warshall's all pairs shortest path is written directly on a matrix.

**Use an edge list** when the algorithm processes edges rather than vertices, such as Kruskal's or Bellman Ford, or as the format you read data in.

The rough rule: if `e` is close to `v^2`, the graph is dense and a matrix is reasonable. If `e` is closer to `v`, it is sparse and the list wins by a huge margin.

```text
Social network: 1,000,000 users, average 200 friends

Adjacency list:   200,000,000 entries
Adjacency matrix: 1,000,000,000,000 cells

The matrix is 5,000 times larger, and almost every cell is false.
```

## Weighted adjacency lists

```csharp
var weighted = new Dictionary<string, List<(string To, int Weight)>>
{
    ["A"] = new() { ("B", 5), ("C", 3) },
    ["B"] = new() { ("A", 5), ("D", 2) },
    ["C"] = new() { ("A", 3), ("D", 1) },
    ["D"] = new() { ("B", 2), ("C", 1) }
};

foreach (var (to, weight) in weighted["A"])
{
    Console.WriteLine($"A to {to} costs {weight}");
}
```

Tuples keep this readable without defining a class. This is the shape Dijkstra's algorithm expects.

## Implicit graphs

Sometimes the best representation is none at all. If the neighbours can be **computed**, do not store them.

A grid:

```csharp
static IEnumerable<(int Row, int Col)> Neighbours(char[,] grid, int row, int col)
{
    int[] dRow = { -1, 1, 0, 0 };
    int[] dCol = { 0, 0, -1, 1 };

    for (int d = 0; d < 4; d++)
    {
        int r = row + dRow[d];
        int c = col + dCol[d];

        if (r < 0 || r >= grid.GetLength(0)) continue;
        if (c < 0 || c >= grid.GetLength(1)) continue;
        if (grid[r, c] == '#') continue;           // a wall

        yield return (r, c);
    }
}
```

A word ladder:

```csharp
static IEnumerable<string> Neighbours(string word, HashSet<string> dictionary)
{
    var letters = word.ToCharArray();

    for (int i = 0; i < letters.Length; i++)
    {
        char original = letters[i];

        for (char c = 'a'; c <= 'z'; c++)
        {
            if (c == original) continue;

            letters[i] = c;
            string candidate = new string(letters);

            if (dictionary.Contains(candidate)) yield return candidate;
        }

        letters[i] = original;      // restore before moving on
    }
}
```

A million cell grid never needs an adjacency structure. The neighbours are arithmetic. This keeps memory at `O(1)` for the graph itself and is how most grid and puzzle problems are solved.

## Quick recap

- An adjacency list stores each vertex's neighbours, using `O(v + e)` memory.
- An adjacency matrix uses `O(v^2)` and gives `O(1)` edge checks.
- An edge list is smallest and suits algorithms that process edges directly.
- Real graphs are sparse, so an adjacency list is the default choice.
- Use a matrix for dense graphs, small fixed vertex counts, or Floyd Warshall.
- Weighted lists hold tuples of destination and weight.
- If neighbours can be computed, do not store the graph at all.

<code id="code-content" class="language-csharp">
// Adjacency list: the default. O(v + e) memory, O(degree) to get neighbours.
var graph = new Dictionary&lt;string, List&lt;string&gt;&gt;
{
    ["A"] = new() { "B", "C" },
    ["B"] = new() { "A", "D" },
    ["C"] = new() { "A", "D" },
    ["D"] = new() { "B", "C" }
};
Console.WriteLine(string.Join(",", graph["A"]));    // B,C
// Adjacency matrix: O(1) edge checks, but O(v^2) memory ALWAYS
var matrix = new bool[4, 4];
void AddEdge(int from, int to) { matrix[from, to] = true; matrix[to, from] = true; }
AddEdge(0, 1); AddEdge(0, 2); AddEdge(1, 3); AddEdge(2, 3);
Console.WriteLine(matrix[0, 1]);                   // True, instantly
// 1,000,000 users x 200 friends: list = 200 million entries,
// matrix = 1 trillion cells. Real graphs are sparse. Use the list.
// Edge list: smallest, and the right shape for Kruskal and Bellman Ford
record Edge(int From, int To, int Weight = 1);
var edges = new List&lt;Edge&gt; { new(0, 1, 5), new(0, 2, 3), new(1, 3, 2) };
// Weighted adjacency list: tuples keep it readable. Dijkstra expects this.
var weighted = new Dictionary&lt;string, List&lt;(string To, int Weight)&gt;&gt;
{
    ["A"] = new() { ("B", 5), ("C", 3) },
    ["B"] = new() { ("A", 5), ("D", 2) }
};
foreach (var (to, weight) in weighted["A"]) Console.WriteLine($"A-&gt;{to} = {weight}");
// IMPLICIT graphs: if neighbours can be COMPUTED, store nothing at all
static IEnumerable&lt;(int Row, int Col)&gt; GridNeighbours(char[,] grid, int row, int col)
{
    int[] dRow = { -1, 1, 0, 0 }, dCol = { 0, 0, -1, 1 };
    for (int d = 0; d &lt; 4; d++)
    {
        int r = row + dRow[d], c = col + dCol[d];
        if (r &lt; 0 || r &gt;= grid.GetLength(0)) continue;
        if (c &lt; 0 || c &gt;= grid.GetLength(1)) continue;
        if (grid[r, c] == '#') continue;               // a wall
        yield return (r, c);
    }
}
// A million cell grid needs no adjacency structure. The neighbours are arithmetic.
</code></pre>
