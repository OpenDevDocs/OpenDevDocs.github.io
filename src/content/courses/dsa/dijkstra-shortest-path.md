---
publishDate: 2026-07-27T17:50
title: Dijkstra Shortest Path
slug: dijkstra-shortest-path
metadescription: Find the cheapest route through a weighted graph with a priority queue, and know exactly when Dijkstra does not apply.
updateDate: 2026-09-07T17:50
author: ['bishal-biswas']
level: 3
tags: ['graphs', 'shortest path', 'dijkstra']
course: dsa
---

## When edges have costs

Breadth first search finds the route with the fewest edges. That is only the cheapest route when every edge costs the same.

```text
       A
     2/ \10
     B   C
      \1/
       D
```

Fewest edges from A to D: `A -> C -> D`, two edges, cost 11.
Cheapest from A to D: `A -> B -> D`, two edges, cost 3.

Here they happen to have the same edge count, but in general the cheapest path can have many more edges. Breadth first search cannot see cost at all.

**Dijkstra's algorithm** always expands the cheapest known frontier next, which finds true shortest paths in weighted graphs.

## The idea

Keep a best known distance for every vertex, starting at infinity except for the source.

Repeatedly take the unvisited vertex with the smallest known distance, and check whether going through it improves its neighbours. That check is called **relaxation**.

The key insight: when you take the cheapest unvisited vertex, its distance is **final**. Nothing cheaper can reach it later, because every other route would have to pass through something already more expensive.

That reasoning is exactly why negative edges break the algorithm.

## The implementation

```csharp
static Dictionary<string, int> Dijkstra(
    Dictionary<string, List<(string To, int Weight)>> graph, string start)
{
    var distance = new Dictionary<string, int> { [start] = 0 };
    var settled = new HashSet<string>();
    var queue = new PriorityQueue<string, int>();

    queue.Enqueue(start, 0);

    while (queue.TryDequeue(out string? current, out int currentDistance))
    {
        if (!settled.Add(current)) continue;      // a stale entry, already finalised

        foreach (var (neighbour, weight) in graph[current])
        {
            if (settled.Contains(neighbour)) continue;

            int candidate = currentDistance + weight;

            if (distance.TryGetValue(neighbour, out int best) && best <= candidate) continue;

            distance[neighbour] = candidate;
            queue.Enqueue(neighbour, candidate);   // the old entry stays, and is skipped
        }
    }

    return distance;
}

var roads = new Dictionary<string, List<(string, int)>>
{
    ["A"] = new() { ("B", 2), ("C", 10) },
    ["B"] = new() { ("A", 2), ("D", 1) },
    ["C"] = new() { ("A", 10), ("D", 3) },
    ["D"] = new() { ("B", 1), ("C", 3) }
};

foreach (var (city, cost) in Dijkstra(roads, "A"))
{
    Console.WriteLine($"{city}: {cost}");
}
// A: 0, B: 2, C: 6, D: 3
```

Note `C` costs 6, not 10. The route `A -> B -> D -> C` is cheaper than the direct road.

## Lazy deletion

`PriorityQueue<TElement, TPriority>` has no way to change an item's priority, as covered in the priority queue topic. So when a shorter route is found, the vertex is enqueued **again** and the old entry is left behind.

The `if (!settled.Add(current)) continue;` line at the top of the loop discards those stale entries when they surface.

The queue can therefore hold more entries than there are vertices, bounded by the number of edges. Each is popped in `O(log e)` and skipped instantly, so the cost is small and the code stays simple.

## Rebuilding the route

Same `cameFrom` technique as breadth first search.

```csharp
static (Dictionary<string, int> Distance, Dictionary<string, string?> CameFrom)
    DijkstraWithPaths(Dictionary<string, List<(string To, int Weight)>> graph, string start)
{
    var distance = new Dictionary<string, int> { [start] = 0 };
    var cameFrom = new Dictionary<string, string?> { [start] = null };
    var settled = new HashSet<string>();
    var queue = new PriorityQueue<string, int>();

    queue.Enqueue(start, 0);

    while (queue.TryDequeue(out string? current, out int currentDistance))
    {
        if (!settled.Add(current)) continue;

        foreach (var (neighbour, weight) in graph[current])
        {
            int candidate = currentDistance + weight;

            if (distance.TryGetValue(neighbour, out int best) && best <= candidate) continue;

            distance[neighbour] = candidate;
            cameFrom[neighbour] = current;
            queue.Enqueue(neighbour, candidate);
        }
    }

    return (distance, cameFrom);
}

static List<string> BuildPath(Dictionary<string, string?> cameFrom, string goal)
{
    if (!cameFrom.ContainsKey(goal)) return new List<string>();

    var path = new List<string>();

    for (string? at = goal; at != null; at = cameFrom[at]) path.Add(at);

    path.Reverse();
    return path;
}

var (distances, parents) = DijkstraWithPaths(roads, "A");
Console.WriteLine(string.Join(" -> ", BuildPath(parents, "C")));   // A -> B -> D -> C
```

## Stopping early

If you only need one destination, stop as soon as it is settled.

```csharp
while (queue.TryDequeue(out string? current, out int currentDistance))
{
    if (!settled.Add(current)) continue;

    if (current == goal) return currentDistance;    // its distance is final

    // ... relax neighbours
}
```

Returning at that moment is safe precisely because a settled vertex's distance never changes again.

## Negative weights break it

This is the limitation that matters.

```text
    A --1--> B
    |        |
    4       -3
    |        |
    +------> C
```

Dijkstra settles `C` at 4 immediately, because 4 is the smallest available. It never revisits it. But `A -> B -> C` costs `1 + (-3) = -2`, which is cheaper.

The whole algorithm rests on "the cheapest unvisited vertex is final". A negative edge can always make a settled vertex cheaper later, so the assumption fails.

Use **Bellman Ford** instead. It relaxes every edge `v - 1` times, which is `O(v * e)`, slower but correct with negative weights. It also detects negative cycles, where a loop reduces the total forever and no shortest path exists.

```csharp
static Dictionary<string, int>? BellmanFord(
    List<(string From, string To, int Weight)> edges,
    IEnumerable<string> vertices,
    string start)
{
    var distance = vertices.ToDictionary(v => v, _ => int.MaxValue);
    distance[start] = 0;

    int count = distance.Count;

    for (int pass = 0; pass < count - 1; pass++)
    {
        foreach (var (from, to, weight) in edges)
        {
            if (distance[from] == int.MaxValue) continue;

            if (distance[from] + weight < distance[to])
            {
                distance[to] = distance[from] + weight;
            }
        }
    }

    // one more pass: anything that still improves means a negative cycle
    foreach (var (from, to, weight) in edges)
    {
        if (distance[from] != int.MaxValue && distance[from] + weight < distance[to])
        {
            return null;
        }
    }

    return distance;
}
```

The `distance[from] == int.MaxValue` guard prevents overflow. Adding a weight to `int.MaxValue` wraps around to a negative number and produces nonsense.

## Complexity

With a binary heap, `O((v + e) log v)`.

Each vertex is settled once, and each edge can cause one enqueue. Every heap operation is `O(log v)`.

A simple version without a heap, scanning for the minimum each time, is `O(v^2)`. That is actually better on a very dense graph where `e` approaches `v^2`.

## A star, briefly

If you know roughly which direction the goal lies, you can steer the search towards it. **A star** adds an estimate of the remaining distance to the priority.

```csharp
int priority = distanceSoFar + Heuristic(neighbour, goal);
queue.Enqueue(neighbour, priority);
```

For a grid, the heuristic is usually straight line distance or Manhattan distance.

The heuristic must never **overestimate** the true remaining cost, or the result can be wrong. An estimate of zero makes A star identical to Dijkstra.

This is what game pathfinding and route planners use, because it explores a small fraction of the map.

## Choosing an algorithm

```text
Situation                            Algorithm
Unweighted graph                     Breadth first search, O(v + e)
Weights, all non negative            Dijkstra, O((v + e) log v)
Negative weights                     Bellman Ford, O(v * e)
Shortest path between all pairs      Floyd Warshall, O(v^3)
Known goal with a good estimate      A star
Dependency ordering, no weights      Topological sort
```

Do not use Dijkstra on an unweighted graph. Breadth first search does the same job without a heap.

## Quick recap

- Dijkstra always expands the cheapest known vertex next.
- A settled vertex's distance is final, which is why it can stop early.
- Use lazy deletion, since a priority queue cannot change priorities.
- Track `cameFrom` to rebuild the actual route.
- Negative weights break the core assumption, so use Bellman Ford there.
- Guard against `int.MaxValue` overflow when relaxing edges.
- A star adds a never overestimating estimate to steer the search towards the goal.

<code id="code-content" class="language-csharp">
// Always expand the CHEAPEST known vertex next. Its distance is then final.
static Dictionary&lt;string, int&gt; Dijkstra(
    Dictionary&lt;string, List&lt;(string To, int Weight)&gt;&gt; graph, string start)
{
    var distance = new Dictionary&lt;string, int&gt; { [start] = 0 };
    var settled = new HashSet&lt;string&gt;();
    var queue = new PriorityQueue&lt;string, int&gt;();
    queue.Enqueue(start, 0);
    while (queue.TryDequeue(out string? current, out int currentDistance))
    {
        if (!settled.Add(current)) continue;      // stale entry, already finalised
        foreach (var (neighbour, weight) in graph[current])
        {
            if (settled.Contains(neighbour)) continue;
            int candidate = currentDistance + weight;
            if (distance.TryGetValue(neighbour, out int best) &amp;&amp; best &lt;= candidate) continue;
            distance[neighbour] = candidate;
            queue.Enqueue(neighbour, candidate);  // lazy deletion: old entry stays
        }
    }
    return distance;
}
var roads = new Dictionary&lt;string, List&lt;(string, int)&gt;&gt;
{
    ["A"] = new() { ("B", 2), ("C", 10) },
    ["B"] = new() { ("A", 2), ("D", 1) },
    ["C"] = new() { ("A", 10), ("D", 3) },
    ["D"] = new() { ("B", 1), ("C", 3) }
};
foreach (var (city, cost) in Dijkstra(roads, "A")) Console.WriteLine($"{city}: {cost}");
// A:0 B:2 C:6 D:3   -- C costs 6 via B and D, not the direct road's 10
// NEGATIVE weights break it. Dijkstra settles a vertex and never revisits it,
// but a negative edge can always make a settled vertex cheaper later.
// Bellman Ford handles them: relax every edge v-1 times, O(v * e)
static Dictionary&lt;string, int&gt;? BellmanFord(
    List&lt;(string From, string To, int Weight)&gt; edges,
    IEnumerable&lt;string&gt; vertices, string start)
{
    var distance = vertices.ToDictionary(v =&gt; v, _ =&gt; int.MaxValue);
    distance[start] = 0;
    for (int pass = 0; pass &lt; distance.Count - 1; pass++)
        foreach (var (from, to, weight) in edges)
        {
            if (distance[from] == int.MaxValue) continue;   // guard against overflow
            if (distance[from] + weight &lt; distance[to]) distance[to] = distance[from] + weight;
        }
    foreach (var (from, to, weight) in edges)               // one more pass
        if (distance[from] != int.MaxValue &amp;&amp; distance[from] + weight &lt; distance[to])
            return null;                                    // a negative cycle
    return distance;
}
// A star: add a never overestimating estimate of the remaining distance
// int priority = distanceSoFar + Heuristic(neighbour, goal);
// A heuristic of zero makes A star exactly Dijkstra.
// Unweighted graph? Use breadth first search. Dijkstra buys you nothing there.
</code></pre>
