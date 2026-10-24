---
publishDate: 2026-07-24T17:00
title: Graph Basics and Terminology
slug: graph-basics-and-terminology
metadescription: Learn what a graph is, the vocabulary you need to read any graph algorithm, and how to recognise a graph problem in disguise.
updateDate: 2026-09-07T17:00
author: ['bishal-biswas']
level: 2
tags: ['graphs', 'terminology', 'data structures']
course: dsa
---

## Things and connections

A graph is a set of **things** and the **connections** between them.

That is deliberately vague, because graphs are deliberately general. Cities and roads. People and friendships. Web pages and links. Tasks and their prerequisites. Files and their imports.

```text
    A --- B
    |     |
    C --- D
     \   /
       E
```

The things are **vertices**, also called nodes. The connections are **edges**.

## A tree is a graph

Everything from the tree topics still applies, because a tree is just a graph with two extra rules: it is connected, and it has no cycles.

Graphs drop both rules. A graph can have cycles, can be in several disconnected pieces, and a vertex can have any number of connections without any notion of parent or child.

That freedom is why graph algorithms need a `visited` set. Trees cannot loop back on themselves, so tree traversals do not. Graphs can, and forgetting the visited set gives you an infinite loop.

## The vocabulary

**Vertex, or node.** One thing in the graph.

**Edge.** A connection between two vertices.

**Adjacent, or neighbours.** Two vertices joined by an edge.

**Degree.** How many edges touch a vertex. In a directed graph, **in degree** counts arrows arriving and **out degree** counts arrows leaving.

**Path.** A sequence of vertices where each consecutive pair is joined by an edge.

**Cycle.** A path that returns to where it started.

**Connected.** There is a path between every pair of vertices.

**Component.** One connected piece of a graph. A graph in three separate pieces has three components.

## Directed or undirected

**Undirected** edges go both ways. Friendship, a road you can drive either direction, a shared border.

```text
A --- B      A is next to B, and B is next to A
```

**Directed** edges go one way. Following someone on social media, a one way street, "task A must finish before task B".

```text
A --> B      A points to B, but B does not point to A
```

This single choice changes almost everything downstream. In an undirected graph, adding an edge means adding it in both directions.

```csharp
// Undirected: both directions
graph["A"].Add("B");
graph["B"].Add("A");

// Directed: one direction only
graph["A"].Add("B");
```

Forgetting the second line in an undirected graph is the single most common graph bug.

## Weighted or unweighted

An **unweighted** graph just records that a connection exists.

A **weighted** graph attaches a number to each edge: distance, cost, time, capacity, probability.

```text
A --5-- B
|       |
3       2
|       |
C --1-- D
```

The distinction decides which algorithm you use. Breadth first search finds shortest paths in unweighted graphs. Weighted graphs need Dijkstra's algorithm or something like it.

## Dense or sparse

**Dense** means most possible edges exist. With `v` vertices there are up to `v * (v - 1) / 2` possible undirected edges.

**Sparse** means far fewer. A road network is sparse, since a city connects to a handful of neighbours, not to every other city.

Most real graphs are sparse, and that shapes how you store them. The next topic covers this in detail.

## Special shapes worth naming

**Complete graph.** Every vertex connects to every other.

**Bipartite graph.** Vertices split into two groups, with edges only between groups, never inside one. Students and courses, jobs and workers.

**Directed acyclic graph, or DAG.** Directed with no cycles. This is the shape of dependency problems: build steps, course prerequisites, spreadsheet formulas, task schedules. Topological sort works only on a DAG.

**Tree.** Connected, undirected and acyclic. A graph with `v` vertices is a tree exactly when it is connected and has `v - 1` edges.

## Recognising a graph problem

The words are usually a giveaway.

- "shortest path", "fewest steps", "minimum cost to get from X to Y"
- "is it possible to reach", "are these connected"
- "dependencies", "prerequisites", "must happen before"
- "cycle", "circular reference", "deadlock"
- "groups", "clusters", "islands", "regions"
- "network", "friends of friends", "recommendations"

Some are graphs in disguise, and spotting that is the real skill.

**A grid is a graph.** Each cell is a vertex, and adjacent cells are joined by edges. Maze solving, flood fill and island counting are all graph traversals.

```csharp
// The neighbours of cell (row, col) in a grid
int[] dRow = { -1, 1, 0, 0 };
int[] dCol = { 0, 0, -1, 1 };
```

**Word ladders are graphs.** Each word is a vertex, and two words are joined if they differ by one letter. "Fewest steps from cold to warm" is then a shortest path problem.

**State puzzles are graphs.** Each configuration is a vertex, and each legal move is an edge. Solving a puzzle in the fewest moves is a shortest path.

## Modelling one in C#

```csharp
public class Graph
{
    private readonly Dictionary<string, List<string>> edges = new();

    public void AddVertex(string name)
    {
        if (!edges.ContainsKey(name)) edges[name] = new List<string>();
    }

    public void AddEdge(string from, string to, bool directed = false)
    {
        AddVertex(from);
        AddVertex(to);

        edges[from].Add(to);

        if (!directed) edges[to].Add(from);
    }

    public IReadOnlyList<string> Neighbours(string vertex) =>
        edges.TryGetValue(vertex, out var list) ? list : Array.Empty<string>();

    public IEnumerable<string> Vertices => edges.Keys;

    public int Degree(string vertex) => Neighbours(vertex).Count;
}

var graph = new Graph();
graph.AddEdge("A", "B");
graph.AddEdge("A", "C");
graph.AddEdge("B", "D");
graph.AddEdge("C", "D");

Console.WriteLine(string.Join(", ", graph.Neighbours("A")));   // B, C
Console.WriteLine(graph.Degree("D"));                          // 2
```

`AddVertex` before adding an edge means a vertex mentioned only as a destination still gets its own entry. Without that, `Neighbours` on a leaf throws.

## Counting components

The first real graph algorithm, and a good check that the model works.

```csharp
static int CountComponents(Graph graph)
{
    var visited = new HashSet<string>();
    int components = 0;

    foreach (string vertex in graph.Vertices)
    {
        if (visited.Contains(vertex)) continue;

        components++;
        Explore(graph, vertex, visited);
    }

    return components;
}

static void Explore(Graph graph, string vertex, HashSet<string> visited)
{
    if (!visited.Add(vertex)) return;      // already seen

    foreach (string next in graph.Neighbours(vertex)) Explore(graph, next, visited);
}

var islands = new Graph();
islands.AddEdge("A", "B");
islands.AddEdge("C", "D");
islands.AddVertex("E");

Console.WriteLine(CountComponents(islands));   // 3
```

The outer loop matters. Starting from one vertex only reaches its own component, so you must try every vertex that has not been visited yet.

`visited.Add` returning `false` when the item was already present handles the check and the insert in one call, which is the idiom you will see in every graph algorithm from here on.

## Quick recap

- A graph is vertices and edges, with no restrictions on shape.
- A tree is a connected acyclic graph, so graphs need a `visited` set and trees do not.
- Undirected edges must be added in both directions.
- Weighted graphs need Dijkstra, unweighted ones only need breadth first search.
- A directed acyclic graph is the shape of every dependency problem.
- Grids, word ladders and puzzle states are all graphs in disguise.
- Counting components needs an outer loop over all vertices, not just one start.

<code id="code-content" class="language-csharp">
// Vertices and edges, with no restrictions on shape
public class Graph
{
    private readonly Dictionary&lt;string, List&lt;string&gt;&gt; edges = new();
    public void AddVertex(string name)
    {
        if (!edges.ContainsKey(name)) edges[name] = new List&lt;string&gt;();
    }
    public void AddEdge(string from, string to, bool directed = false)
    {
        AddVertex(from);
        AddVertex(to);
        edges[from].Add(to);
        if (!directed) edges[to].Add(from);     // forgetting this is THE common bug
    }
    public IReadOnlyList&lt;string&gt; Neighbours(string v) =&gt;
        edges.TryGetValue(v, out var list) ? list : Array.Empty&lt;string&gt;();
    public IEnumerable&lt;string&gt; Vertices =&gt; edges.Keys;
    public int Degree(string v) =&gt; Neighbours(v).Count;
}
var graph = new Graph();
graph.AddEdge("A", "B");
graph.AddEdge("A", "C");
graph.AddEdge("B", "D");
graph.AddEdge("C", "D");
Console.WriteLine(string.Join(", ", graph.Neighbours("A")));   // B, C
Console.WriteLine(graph.Degree("D"));                          // 2
// Graphs can have cycles, so every traversal needs a visited set.
// Trees cannot, which is why tree traversals do not need one.
static void Explore(Graph g, string vertex, HashSet&lt;string&gt; visited)
{
    if (!visited.Add(vertex)) return;           // Add returns false if already seen
    foreach (string next in g.Neighbours(vertex)) Explore(g, next, visited);
}
// Counting components: the OUTER loop is what finds disconnected pieces
static int CountComponents(Graph g)
{
    var visited = new HashSet&lt;string&gt;();
    int components = 0;
    foreach (string vertex in g.Vertices)
    {
        if (visited.Contains(vertex)) continue;
        components++;
        Explore(g, vertex, visited);
    }
    return components;
}
var islands = new Graph();
islands.AddEdge("A", "B");
islands.AddEdge("C", "D");
islands.AddVertex("E");
Console.WriteLine(CountComponents(islands));   // 3
// A GRID is a graph: each cell is a vertex, adjacent cells are edges
int[] dRow = { -1, 1, 0, 0 };
int[] dCol = { 0, 0, -1, 1 };
// So are word ladders (words differing by one letter) and puzzle states.
</code></pre>
