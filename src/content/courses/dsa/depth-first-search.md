---
publishDate: 2026-07-26T17:30
title: Depth First Search
slug: depth-first-search
metadescription: Follow each path to its end before backtracking, and use depth first search for cycle detection, components and connectivity.
updateDate: 2026-09-07T17:30
author: ['bishal-biswas']
level: 2
tags: ['graphs', 'dfs', 'traversal']
course: dsa
---

## Go deep first

Depth first search follows one path as far as it goes, then backs up and tries the next branch.

Breadth first spreads out in rings. Depth first dives.

The difference is one line: a stack instead of a queue, or simply recursion, which uses the call stack.

```csharp
static void DepthFirst(Dictionary<string, List<string>> graph, string start,
                       HashSet<string>? visited = null)
{
    visited ??= new HashSet<string>();

    if (!visited.Add(start)) return;      // already been here

    Console.Write(start + " ");

    foreach (string neighbour in graph[start])
    {
        DepthFirst(graph, neighbour, visited);
    }
}

var graph = new Dictionary<string, List<string>>
{
    ["A"] = new() { "B", "C" },
    ["B"] = new() { "A", "D", "E" },
    ["C"] = new() { "A", "F" },
    ["D"] = new() { "B" },
    ["E"] = new() { "B", "F" },
    ["F"] = new() { "C", "E" }
};

DepthFirst(graph, "A");   // A B D E F C
```

The `visited` set is not optional. Without it, any cycle sends this into infinite recursion.

## The iterative version

Swap the queue in breadth first search for a stack and you get depth first.

```csharp
static void DepthFirstIterative(Dictionary<string, List<string>> graph, string start)
{
    var visited = new HashSet<string>();
    var stack = new Stack<string>();
    stack.Push(start);

    while (stack.Count > 0)
    {
        string current = stack.Pop();

        if (!visited.Add(current)) continue;

        Console.Write(current + " ");

        foreach (string neighbour in graph[current]) stack.Push(neighbour);
    }
}
```

One important difference from the breadth first version: here you must check `visited` on **pop**, not on push. A vertex can legitimately be pushed several times before it is first popped, and skipping the duplicates on the way out is correct and simpler.

The visiting order also reverses, because a stack returns items in the opposite order to how they went in. Push the neighbours in reverse if the exact order matters.

Use the iterative version on deep graphs. Recursion on a graph of a million vertices in a chain will overflow the stack.

## Depth first or breadth first?

```text
                        Depth first          Breadth first
Data structure          stack or recursion   queue
Explores                one path fully       level by level
Finds shortest path     no                   yes, unweighted
Memory                  O(depth)             O(width)
Natural for             cycles, components,  shortest paths, levels,
                        topological sort     nearest anything
```

Memory is the practical difference people forget. On a wide shallow graph, breadth first can hold an enormous level in the queue while depth first only holds the current path. On a deep narrow graph the opposite is true.

**Depth first does not find shortest paths.** It finds *a* path. If you need the shortest one in an unweighted graph, use breadth first.

## Counting components

```csharp
static int CountComponents(Dictionary<string, List<string>> graph)
{
    var visited = new HashSet<string>();
    int components = 0;

    foreach (string vertex in graph.Keys)
    {
        if (visited.Contains(vertex)) continue;

        components++;
        DepthFirst(graph, vertex, visited);
    }

    return components;
}
```

The outer loop over every vertex is what finds disconnected pieces. A single search only reaches its own component.

## Counting islands in a grid

The same algorithm, on an implicit graph. This is probably the most commonly asked graph question there is.

```csharp
static int CountIslands(char[,] grid)
{
    int rows = grid.GetLength(0), cols = grid.GetLength(1);
    var visited = new bool[rows, cols];
    int islands = 0;

    for (int r = 0; r < rows; r++)
    {
        for (int c = 0; c < cols; c++)
        {
            if (grid[r, c] != '1' || visited[r, c]) continue;

            islands++;
            Flood(grid, visited, r, c);
        }
    }

    return islands;
}

static void Flood(char[,] grid, bool[,] visited, int row, int col)
{
    if (row < 0 || row >= grid.GetLength(0)) return;
    if (col < 0 || col >= grid.GetLength(1)) return;
    if (grid[row, col] != '1' || visited[row, col]) return;

    visited[row, col] = true;

    Flood(grid, visited, row - 1, col);
    Flood(grid, visited, row + 1, col);
    Flood(grid, visited, row, col - 1);
    Flood(grid, visited, row, col + 1);
}

char[,] map =
{
    { '1', '1', '0', '0' },
    { '1', '0', '0', '1' },
    { '0', '0', '1', '1' }
};

Console.WriteLine(CountIslands(map));   // 3
```

Each outer loop hit on an unvisited land cell starts a new island, and the flood marks the whole island so it is counted once.

On a large grid this recursion can overflow. Convert `Flood` to use an explicit `Stack<(int, int)>` if the grid might be big.

## Cycle detection in an undirected graph

Track where you came from, so the edge you arrived on does not count as a cycle.

```csharp
static bool HasCycle(Dictionary<string, List<string>> graph)
{
    var visited = new HashSet<string>();

    bool Explore(string current, string? parent)
    {
        visited.Add(current);

        foreach (string neighbour in graph[current])
        {
            if (neighbour == parent) continue;          // the edge we came in on

            if (visited.Contains(neighbour)) return true;   // reached a visited vertex

            if (Explore(neighbour, current)) return true;
        }

        return false;
    }

    foreach (string vertex in graph.Keys)
    {
        if (!visited.Contains(vertex) && Explore(vertex, null)) return true;
    }

    return false;
}
```

The `neighbour == parent` check is the whole trick. In an undirected graph every edge appears in both directions, so without it every single edge looks like a two vertex cycle.

## Cycle detection in a directed graph

The parent trick does not work here. You need to know whether a vertex is on the **current path**, not merely whether it has been seen.

```csharp
static bool HasCycleDirected(Dictionary<string, List<string>> graph)
{
    var visited = new HashSet<string>();
    var onCurrentPath = new HashSet<string>();

    bool Explore(string current)
    {
        visited.Add(current);
        onCurrentPath.Add(current);

        foreach (string neighbour in graph[current])
        {
            if (onCurrentPath.Contains(neighbour)) return true;   // back edge, a cycle

            if (!visited.Contains(neighbour) && Explore(neighbour)) return true;
        }

        onCurrentPath.Remove(current);     // leaving this vertex, remove it
        return false;
    }

    foreach (string vertex in graph.Keys)
    {
        if (!visited.Contains(vertex) && Explore(vertex)) return true;
    }

    return false;
}

var tasks = new Dictionary<string, List<string>>
{
    ["a"] = new() { "b" },
    ["b"] = new() { "c" },
    ["c"] = new() { "a" }      // circular dependency
};

Console.WriteLine(HasCycleDirected(tasks));   // True
```

Two sets are needed. `visited` prevents re-exploring a vertex, and `onCurrentPath` detects the cycle.

The `onCurrentPath.Remove` on the way out is essential. Forgetting it reports cycles that do not exist, because a vertex reachable by two different paths would look like a loop.

This is how build systems detect circular dependencies, how spreadsheets detect circular references, and how package managers reject impossible dependency graphs.

## Finding all paths

Depth first plus backtracking enumerates every route.

```csharp
static List<List<string>> AllPaths(
    Dictionary<string, List<string>> graph, string start, string goal)
{
    var results = new List<List<string>>();
    var path = new List<string>();
    var onPath = new HashSet<string>();

    void Explore(string current)
    {
        path.Add(current);
        onPath.Add(current);

        if (current == goal)
        {
            results.Add(new List<string>(path));      // copy it
        }
        else
        {
            foreach (string neighbour in graph[current])
            {
                if (!onPath.Contains(neighbour)) Explore(neighbour);
            }
        }

        path.RemoveAt(path.Count - 1);                // undo
        onPath.Remove(current);
    }

    Explore(start);
    return results;
}

foreach (var path in AllPaths(graph, "A", "F"))
{
    Console.WriteLine(string.Join(" -> ", path));
}
```

Note there is no permanent `visited` set here. A vertex excluded from one path may be needed by another, so only the current path is blocked. That is what makes this backtracking rather than plain traversal.

The number of paths can be exponential, so this is only for small graphs.

## Complexity

**Time:** `O(v + e)`, same as breadth first. Every vertex and edge is examined once.

**Space:** `O(v)` for the visited set, plus `O(depth)` for the recursion. On a long chain the depth is `v`, which is where stack overflows come from.

## Quick recap

- Depth first follows one path to its end before backtracking, using a stack or recursion.
- The visited set is what stops cycles becoming infinite loops.
- In the iterative version, check visited on pop rather than on push.
- Depth first does not find shortest paths, breadth first does.
- Counting components and islands needs an outer loop over every vertex or cell.
- Undirected cycle detection skips the parent edge.
- Directed cycle detection needs a separate "on the current path" set, cleared on the way out.

<code id="code-content" class="language-csharp">
var graph = new Dictionary&lt;string, List&lt;string&gt;&gt;
{
    ["A"] = new() { "B", "C" },
    ["B"] = new() { "A", "D", "E" },
    ["C"] = new() { "A", "F" },
    ["D"] = new() { "B" },
    ["E"] = new() { "B", "F" },
    ["F"] = new() { "C", "E" }
};
// Recursion IS the stack. The visited set stops cycles looping forever.
static void DepthFirst(Dictionary&lt;string, List&lt;string&gt;&gt; g, string v, HashSet&lt;string&gt; seen)
{
    if (!seen.Add(v)) return;
    Console.Write(v + " ");
    foreach (string n in g[v]) DepthFirst(g, n, seen);
}
DepthFirst(graph, "A", new HashSet&lt;string&gt;());     // A B D E F C
Console.WriteLine();
// Iterative: a stack instead of a queue. Check visited on POP, not push.
static void Iterative(Dictionary&lt;string, List&lt;string&gt;&gt; g, string start)
{
    var seen = new HashSet&lt;string&gt;();
    var stack = new Stack&lt;string&gt;();
    stack.Push(start);
    while (stack.Count &gt; 0)
    {
        string current = stack.Pop();
        if (!seen.Add(current)) continue;
        Console.Write(current + " ");
        foreach (string n in g[current]) stack.Push(n);
    }
}
Iterative(graph, "A");
Console.WriteLine();
// Undirected cycle detection: skip the edge you came in on
static bool HasCycle(Dictionary&lt;string, List&lt;string&gt;&gt; g)
{
    var seen = new HashSet&lt;string&gt;();
    bool Explore(string current, string? parent)
    {
        seen.Add(current);
        foreach (string n in g[current])
        {
            if (n == parent) continue;             // without this, every edge looks
            if (seen.Contains(n)) return true;     // like a two vertex cycle
            if (Explore(n, current)) return true;
        }
        return false;
    }
    foreach (string v in g.Keys)
        if (!seen.Contains(v) &amp;&amp; Explore(v, null)) return true;
    return false;
}
Console.WriteLine(HasCycle(graph));                // True
// Directed cycle detection needs TWO sets: visited, and on the current path
static bool HasCycleDirected(Dictionary&lt;string, List&lt;string&gt;&gt; g)
{
    var seen = new HashSet&lt;string&gt;();
    var onPath = new HashSet&lt;string&gt;();
    bool Explore(string current)
    {
        seen.Add(current);
        onPath.Add(current);
        foreach (string n in g[current])
        {
            if (onPath.Contains(n)) return true;   // back edge, a real cycle
            if (!seen.Contains(n) &amp;&amp; Explore(n)) return true;
        }
        onPath.Remove(current);                    // ESSENTIAL on the way out
        return false;
    }
    foreach (string v in g.Keys)
        if (!seen.Contains(v) &amp;&amp; Explore(v)) return true;
    return false;
}
var tasks = new Dictionary&lt;string, List&lt;string&gt;&gt;
{
    ["a"] = new() { "b" }, ["b"] = new() { "c" }, ["c"] = new() { "a" }
};
Console.WriteLine(HasCycleDirected(tasks));        // True, circular dependency
</code></pre>
