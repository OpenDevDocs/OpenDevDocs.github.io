---
publishDate: 2026-07-25T17:20
title: Breadth First Search
slug: breadth-first-search
metadescription: Explore a graph level by level with a queue, find shortest paths in unweighted graphs, and solve grid and maze problems.
updateDate: 2026-09-07T17:20
author: ['bishal-biswas']
level: 2
tags: ['graphs', 'bfs', 'shortest path']
course: dsa
---

## Explore in rings

Breadth first search visits everything one step away, then everything two steps away, and so on.

Because it explores in order of distance, **the first time it reaches a vertex is always by the shortest path**. That property is what makes it so useful.

It needs a queue, and a visited set to stop it going round in circles.

```csharp
static void BreadthFirst(Dictionary<string, List<string>> graph, string start)
{
    var visited = new HashSet<string> { start };
    var queue = new Queue<string>();
    queue.Enqueue(start);

    while (queue.Count > 0)
    {
        string current = queue.Dequeue();
        Console.Write(current + " ");

        foreach (string neighbour in graph[current])
        {
            if (visited.Add(neighbour)) queue.Enqueue(neighbour);
        }
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

BreadthFirst(graph, "A");   // A B C D E F
```

## Mark on enqueue, not on dequeue

This is the mistake almost everyone makes once.

```csharp
// Wrong: the same vertex can be queued several times
while (queue.Count > 0)
{
    string current = queue.Dequeue();
    if (!visited.Add(current)) continue;

    foreach (string n in graph[current]) queue.Enqueue(n);
}

// Right: each vertex enters the queue exactly once
foreach (string n in graph[current])
{
    if (visited.Add(n)) queue.Enqueue(n);
}
```

The wrong version still produces the correct answer, but the queue can grow to hold every edge in the graph. On a dense graph that is a serious memory problem.

`visited.Add` returning `false` when the item is already present is what makes the right version a single line.

## Shortest path in an unweighted graph

Track the distance alongside each vertex.

```csharp
static Dictionary<string, int> ShortestDistances(
    Dictionary<string, List<string>> graph, string start)
{
    var distance = new Dictionary<string, int> { [start] = 0 };
    var queue = new Queue<string>();
    queue.Enqueue(start);

    while (queue.Count > 0)
    {
        string current = queue.Dequeue();

        foreach (string neighbour in graph[current])
        {
            if (distance.ContainsKey(neighbour)) continue;

            distance[neighbour] = distance[current] + 1;
            queue.Enqueue(neighbour);
        }
    }

    return distance;
}

foreach (var (vertex, steps) in ShortestDistances(graph, "A"))
{
    Console.WriteLine($"{vertex}: {steps}");
}
// A: 0, B: 1, C: 1, D: 2, E: 2, F: 2
```

The distance dictionary doubles as the visited set, which is neat. A vertex has a recorded distance exactly when it has been seen.

This only works because every edge costs the same. With weights, a longer route measured in edges can be cheaper, and you need Dijkstra's algorithm.

## Rebuilding the route

Record where you came from, then walk backwards.

```csharp
static List<string> ShortestPath(
    Dictionary<string, List<string>> graph, string start, string goal)
{
    var cameFrom = new Dictionary<string, string?> { [start] = null };
    var queue = new Queue<string>();
    queue.Enqueue(start);

    while (queue.Count > 0)
    {
        string current = queue.Dequeue();

        if (current == goal) break;      // found it, stop early

        foreach (string neighbour in graph[current])
        {
            if (cameFrom.ContainsKey(neighbour)) continue;

            cameFrom[neighbour] = current;
            queue.Enqueue(neighbour);
        }
    }

    if (!cameFrom.ContainsKey(goal)) return new List<string>();   // unreachable

    var path = new List<string>();

    for (string? at = goal; at != null; at = cameFrom[at]) path.Add(at);

    path.Reverse();
    return path;
}

Console.WriteLine(string.Join(" -> ", ShortestPath(graph, "A", "F")));   // A -> C -> F
```

The `cameFrom` dictionary is the standard technique for every path finding algorithm. Store one parent per vertex, then walk back from the goal and reverse.

## Level by level

Freezing the queue size separates the levels, exactly as with trees.

```csharp
static void PrintLevels(Dictionary<string, List<string>> graph, string start)
{
    var visited = new HashSet<string> { start };
    var queue = new Queue<string>();
    queue.Enqueue(start);

    int level = 0;

    while (queue.Count > 0)
    {
        int count = queue.Count;      // freeze before enqueuing children

        Console.Write($"Level {level}: ");

        for (int i = 0; i < count; i++)
        {
            string current = queue.Dequeue();
            Console.Write(current + " ");

            foreach (string n in graph[current])
            {
                if (visited.Add(n)) queue.Enqueue(n);
            }
        }

        Console.WriteLine();
        level++;
    }
}
```

Useful for "friends of friends", "everything within three hops", and anything where distance bands matter.

## On a grid

The most common practical use. The grid is the graph, and neighbours are computed rather than stored.

```csharp
static int ShortestPathInMaze(char[,] maze, (int Row, int Col) start, (int Row, int Col) goal)
{
    int rows = maze.GetLength(0), cols = maze.GetLength(1);

    int[] dRow = { -1, 1, 0, 0 };
    int[] dCol = { 0, 0, -1, 1 };

    var distance = new int[rows, cols];
    for (int r = 0; r < rows; r++)
        for (int c = 0; c < cols; c++) distance[r, c] = -1;

    distance[start.Row, start.Col] = 0;

    var queue = new Queue<(int Row, int Col)>();
    queue.Enqueue(start);

    while (queue.Count > 0)
    {
        var (row, col) = queue.Dequeue();

        if ((row, col) == goal) return distance[row, col];

        for (int d = 0; d < 4; d++)
        {
            int r = row + dRow[d];
            int c = col + dCol[d];

            if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
            if (maze[r, c] == '#') continue;              // wall
            if (distance[r, c] != -1) continue;           // already visited

            distance[r, c] = distance[row, col] + 1;
            queue.Enqueue((r, c));
        }
    }

    return -1;   // unreachable
}

char[,] maze =
{
    { '.', '.', '#', '.' },
    { '#', '.', '#', '.' },
    { '.', '.', '.', '.' },
    { '.', '#', '#', '.' }
};

Console.WriteLine(ShortestPathInMaze(maze, (0, 0), (3, 3)));   // 6
```

Using `-1` in the distance array as "not visited" saves allocating a separate visited grid.

## Multi source BFS

Start from several places at once by enqueuing all of them before the loop. Every vertex then gets its distance to the **nearest** source, in a single pass.

```csharp
static int[,] DistanceToNearestExit(char[,] grid)
{
    int rows = grid.GetLength(0), cols = grid.GetLength(1);
    var distance = new int[rows, cols];
    var queue = new Queue<(int, int)>();

    for (int r = 0; r < rows; r++)
    {
        for (int c = 0; c < cols; c++)
        {
            if (grid[r, c] == 'E')
            {
                distance[r, c] = 0;
                queue.Enqueue((r, c));          // every exit is a source
            }
            else
            {
                distance[r, c] = -1;
            }
        }
    }

    int[] dRow = { -1, 1, 0, 0 };
    int[] dCol = { 0, 0, -1, 1 };

    while (queue.Count > 0)
    {
        var (row, col) = queue.Dequeue();

        for (int d = 0; d < 4; d++)
        {
            int r = row + dRow[d], c = col + dCol[d];

            if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
            if (grid[r, c] == '#' || distance[r, c] != -1) continue;

            distance[r, c] = distance[row, col] + 1;
            queue.Enqueue((r, c));
        }
    }

    return distance;
}
```

This is one of the most useful tricks in the whole topic. Running a separate search from every source would be `O(sources * cells)`. This is `O(cells)`.

Rotting oranges, spreading fire, distance to the nearest hospital, all the same pattern.

## Word ladder

The graph is never built. Neighbours are generated on demand.

```csharp
static int LadderLength(string start, string end, HashSet<string> words)
{
    if (!words.Contains(end)) return 0;

    var visited = new HashSet<string> { start };
    var queue = new Queue<(string Word, int Steps)>();
    queue.Enqueue((start, 1));

    while (queue.Count > 0)
    {
        var (word, steps) = queue.Dequeue();

        if (word == end) return steps;

        var letters = word.ToCharArray();

        for (int i = 0; i < letters.Length; i++)
        {
            char original = letters[i];

            for (char c = 'a'; c <= 'z'; c++)
            {
                if (c == original) continue;

                letters[i] = c;
                string candidate = new string(letters);

                if (words.Contains(candidate) && visited.Add(candidate))
                {
                    queue.Enqueue((candidate, steps + 1));
                }
            }

            letters[i] = original;
        }
    }

    return 0;
}

var dictionary = new HashSet<string> { "hot", "dot", "dog", "lot", "log", "cog" };
Console.WriteLine(LadderLength("hit", "cog", dictionary));   // 5
```

## Complexity

**Time:** `O(v + e)`. Each vertex is dequeued once and each edge is examined once.

**Space:** `O(v)` for the visited set and the queue. The queue holds at most one full level, which on a wide graph can be a large fraction of the vertices.

## Quick recap

- Breadth first search uses a queue and explores in order of distance.
- The first time it reaches a vertex is by a shortest path, in unweighted graphs.
- Mark vertices visited when enqueuing, never when dequeuing.
- Use a `cameFrom` dictionary to rebuild the route.
- Freeze the queue size to process one level at a time.
- Enqueue every source before the loop for multi source distance in one pass.
- With weighted edges, use Dijkstra instead.

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
// A queue explores in rings, so the first arrival is the SHORTEST path
static Dictionary&lt;string, int&gt; Distances(Dictionary&lt;string, List&lt;string&gt;&gt; g, string start)
{
    var distance = new Dictionary&lt;string, int&gt; { [start] = 0 };
    var queue = new Queue&lt;string&gt;();
    queue.Enqueue(start);
    while (queue.Count &gt; 0)
    {
        string current = queue.Dequeue();
        foreach (string n in g[current])
        {
            if (distance.ContainsKey(n)) continue;   // doubles as the visited set
            distance[n] = distance[current] + 1;
            queue.Enqueue(n);                        // mark on ENQUEUE, not dequeue
        }
    }
    return distance;
}
foreach (var (v, d) in Distances(graph, "A")) Console.WriteLine($"{v}: {d}");
// Rebuild the route with a cameFrom dictionary, then reverse
static List&lt;string&gt; Path(Dictionary&lt;string, List&lt;string&gt;&gt; g, string start, string goal)
{
    var cameFrom = new Dictionary&lt;string, string?&gt; { [start] = null };
    var queue = new Queue&lt;string&gt;();
    queue.Enqueue(start);
    while (queue.Count &gt; 0)
    {
        string current = queue.Dequeue();
        if (current == goal) break;
        foreach (string n in g[current])
        {
            if (cameFrom.ContainsKey(n)) continue;
            cameFrom[n] = current;
            queue.Enqueue(n);
        }
    }
    if (!cameFrom.ContainsKey(goal)) return new List&lt;string&gt;();
    var path = new List&lt;string&gt;();
    for (string? at = goal; at != null; at = cameFrom[at]) path.Add(at);
    path.Reverse();
    return path;
}
Console.WriteLine(string.Join(" -&gt; ", Path(graph, "A", "F")));   // A -&gt; C -&gt; F
// On a grid: neighbours are arithmetic, and -1 doubles as "not visited"
char[,] maze = { { '.', '.', '#' }, { '#', '.', '.' }, { '.', '.', '.' } };
int[] dRow = { -1, 1, 0, 0 }, dCol = { 0, 0, -1, 1 };
var dist = new int[3, 3];
for (int r = 0; r &lt; 3; r++) for (int c = 0; c &lt; 3; c++) dist[r, c] = -1;
dist[0, 0] = 0;
var cells = new Queue&lt;(int R, int C)&gt;();
cells.Enqueue((0, 0));
while (cells.Count &gt; 0)
{
    var (row, col) = cells.Dequeue();
    for (int d = 0; d &lt; 4; d++)
    {
        int r = row + dRow[d], c = col + dCol[d];
        if (r &lt; 0 || r &gt;= 3 || c &lt; 0 || c &gt;= 3) continue;
        if (maze[r, c] == '#' || dist[r, c] != -1) continue;
        dist[r, c] = dist[row, col] + 1;
        cells.Enqueue((r, c));
    }
}
Console.WriteLine(dist[2, 2]);       // 4
// MULTI SOURCE: enqueue every source before the loop. One pass, not one per source.
</code></pre>
