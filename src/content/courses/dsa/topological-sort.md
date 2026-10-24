---
publishDate: 2026-07-26T17:40
title: Topological Sort
slug: topological-sort
metadescription: Order tasks so every dependency comes first, detect circular dependencies, and understand the two standard algorithms.
updateDate: 2026-09-07T17:40
author: ['bishal-biswas']
level: 3
tags: ['graphs', 'topological sort', 'dependencies']
course: dsa
---

## Ordering by dependency

You have tasks, and some must happen before others. In what order do you run them?

```text
    install -> build -> test -> deploy
                  \
                   -> lint
```

A **topological sort** produces an order where every task appears after everything it depends on.

It only works on a **directed acyclic graph**. Directed, because dependencies point one way. Acyclic, because if A needs B and B needs A, no valid order exists.

## Where it shows up

- Build systems deciding compilation order.
- Package managers resolving install order.
- Course prerequisites.
- Spreadsheet recalculation.
- Database migrations.
- Task schedulers.
- Class initialisation order.

Any time something says "this must happen before that", this is the algorithm.

## Kahn's algorithm

Count how many things each task waits for. Repeatedly take one that waits for nothing, and reduce the counts of everything it unblocks.

```csharp
static List<string>? TopologicalSort(Dictionary<string, List<string>> graph)
{
    var inDegree = new Dictionary<string, int>();

    foreach (string node in graph.Keys) inDegree.TryAdd(node, 0);

    foreach (var (_, dependents) in graph)
    {
        foreach (string dependent in dependents)
        {
            inDegree.TryAdd(dependent, 0);
            inDegree[dependent]++;
        }
    }

    var ready = new Queue<string>();

    foreach (var (node, degree) in inDegree)
    {
        if (degree == 0) ready.Enqueue(node);
    }

    var order = new List<string>();

    while (ready.Count > 0)
    {
        string node = ready.Dequeue();
        order.Add(node);

        if (!graph.TryGetValue(node, out var dependents)) continue;

        foreach (string dependent in dependents)
        {
            inDegree[dependent]--;

            if (inDegree[dependent] == 0) ready.Enqueue(dependent);
        }
    }

    return order.Count == inDegree.Count ? order : null;   // null means a cycle
}

var build = new Dictionary<string, List<string>>
{
    ["install"] = new() { "build" },
    ["build"] = new() { "test", "lint" },
    ["test"] = new() { "deploy" },
    ["lint"] = new() { "deploy" },
    ["deploy"] = new()
};

Console.WriteLine(string.Join(" -> ", TopologicalSort(build)!));
// install -> build -> test -> lint -> deploy
```

Two details do the real work.

**`inDegree` counts incoming edges**, meaning how many things must finish before this one can start. Zero means it is ready now.

**The final count check detects cycles.** If some nodes never reached an in degree of zero, they are stuck waiting on each other. That is a cycle, and there is no valid order.

Returning `null` rather than throwing lets the caller decide how to report it. In a build tool you would want to name the cycle.

## The result is not unique

`test` and `lint` both become ready at the same moment, so either could come first. Any order satisfying the dependencies is a correct topological sort.

If you want a deterministic result, use a priority queue instead of a plain queue:

```csharp
var ready = new PriorityQueue<string, string>();

foreach (var (node, degree) in inDegree)
{
    if (degree == 0) ready.Enqueue(node, node);   // alphabetical
}
```

Now equally ready tasks come out in a defined order, which makes builds reproducible and tests stable.

## The depth first version

Run a depth first search and record each node **after** its dependents. Reverse the result.

```csharp
static List<string>? TopologicalSortDfs(Dictionary<string, List<string>> graph)
{
    var visited = new HashSet<string>();
    var onPath = new HashSet<string>();
    var order = new List<string>();

    bool Explore(string node)
    {
        if (onPath.Contains(node)) return false;    // cycle
        if (!visited.Add(node)) return true;        // already done

        onPath.Add(node);

        if (graph.TryGetValue(node, out var dependents))
        {
            foreach (string dependent in dependents)
            {
                if (!Explore(dependent)) return false;
            }
        }

        onPath.Remove(node);
        order.Add(node);          // added AFTER everything it depends on
        return true;
    }

    foreach (string node in graph.Keys)
    {
        if (!Explore(node)) return null;
    }

    order.Reverse();
    return order;
}
```

The `order.Add` sits after the loop, so a node is only recorded once everything downstream of it has been recorded. Reversing at the end puts dependencies first.

This is postorder traversal, exactly as in the tree topic.

`onPath` detects cycles the same way as directed cycle detection, and must be removed on the way out.

## Which version to use

**Kahn's** is easier to explain, gives natural cycle reporting, and has no recursion depth limit. It also tells you which nodes are stuck, which is what a user needs to see.

**Depth first** is shorter and needs no in degree bookkeeping, but risks a stack overflow on deep dependency chains.

Kahn's is the better default, especially in a tool that must report errors clearly.

## Reporting the cycle

Saying "there is a cycle" is not helpful. Naming it is.

```csharp
static List<string>? FindCycle(Dictionary<string, List<string>> graph)
{
    var visited = new HashSet<string>();
    var path = new List<string>();
    var onPath = new HashSet<string>();

    List<string>? Explore(string node)
    {
        if (onPath.Contains(node))
        {
            int start = path.IndexOf(node);
            var cycle = path.GetRange(start, path.Count - start);
            cycle.Add(node);                  // close the loop for readability
            return cycle;
        }

        if (!visited.Add(node)) return null;

        path.Add(node);
        onPath.Add(node);

        if (graph.TryGetValue(node, out var dependents))
        {
            foreach (string dependent in dependents)
            {
                var found = Explore(dependent);
                if (found != null) return found;
            }
        }

        path.RemoveAt(path.Count - 1);
        onPath.Remove(node);
        return null;
    }

    foreach (string node in graph.Keys)
    {
        var cycle = Explore(node);
        if (cycle != null) return cycle;
    }

    return null;
}

var broken = new Dictionary<string, List<string>>
{
    ["a"] = new() { "b" },
    ["b"] = new() { "c" },
    ["c"] = new() { "a" }
};

Console.WriteLine(string.Join(" -> ", FindCycle(broken)!));   // a -> b -> c -> a
```

`path.IndexOf(node)` finds where the loop began, and everything from there onward is the cycle itself. The part of the path before it is just how you got there.

## Levels, for parallel execution

Kahn's algorithm can group tasks that can run at the same time. Freeze the queue size, exactly as with breadth first search.

```csharp
static List<List<string>> ParallelStages(Dictionary<string, List<string>> graph)
{
    var inDegree = new Dictionary<string, int>();

    foreach (string node in graph.Keys) inDegree.TryAdd(node, 0);

    foreach (var (_, dependents) in graph)
    {
        foreach (string dependent in dependents)
        {
            inDegree.TryAdd(dependent, 0);
            inDegree[dependent]++;
        }
    }

    var ready = new Queue<string>();

    foreach (var (node, degree) in inDegree)
    {
        if (degree == 0) ready.Enqueue(node);
    }

    var stages = new List<List<string>>();

    while (ready.Count > 0)
    {
        int count = ready.Count;              // freeze
        var stage = new List<string>();

        for (int i = 0; i < count; i++)
        {
            string node = ready.Dequeue();
            stage.Add(node);

            if (!graph.TryGetValue(node, out var dependents)) continue;

            foreach (string dependent in dependents)
            {
                if (--inDegree[dependent] == 0) ready.Enqueue(dependent);
            }
        }

        stages.Add(stage);
    }

    return stages;
}

foreach (var stage in ParallelStages(build))
{
    Console.WriteLine(string.Join(", ", stage));
}
// install
// build
// test, lint
// deploy
```

Everything in one stage can run in parallel. The number of stages is the minimum time the whole job could take with unlimited workers, which is the **critical path length**.

## Course prerequisites

The same algorithm, phrased as a real problem.

```csharp
static bool CanFinishAll(int courseCount, int[][] prerequisites)
{
    var graph = new List<int>[courseCount];
    for (int i = 0; i < courseCount; i++) graph[i] = new List<int>();

    var inDegree = new int[courseCount];

    foreach (var pair in prerequisites)
    {
        graph[pair[1]].Add(pair[0]);      // pair[1] must come before pair[0]
        inDegree[pair[0]]++;
    }

    var ready = new Queue<int>();

    for (int i = 0; i < courseCount; i++)
    {
        if (inDegree[i] == 0) ready.Enqueue(i);
    }

    int finished = 0;

    while (ready.Count > 0)
    {
        int course = ready.Dequeue();
        finished++;

        foreach (int next in graph[course])
        {
            if (--inDegree[next] == 0) ready.Enqueue(next);
        }
    }

    return finished == courseCount;
}

Console.WriteLine(CanFinishAll(2, new[] { new[] { 1, 0 } }));                  // True
Console.WriteLine(CanFinishAll(2, new[] { new[] { 1, 0 }, new[] { 0, 1 } }));  // False
```

The edge direction is the thing to get right. "Course 0 is a prerequisite of course 1" means the edge goes from 0 to 1, so 1's in degree increases.

## Complexity

Both algorithms are `O(v + e)`. Every vertex is processed once and every edge is examined once.

## Quick recap

- A topological sort orders a directed acyclic graph so dependencies come first.
- Kahn's algorithm repeatedly takes a node with in degree zero.
- If not every node is emitted, there is a cycle and no valid order exists.
- Use a priority queue for a deterministic, reproducible order.
- The depth first version records nodes after their dependents, then reverses.
- Report the actual cycle, not just its existence, by slicing the current path.
- Freezing the queue size groups tasks that can run in parallel.

<code id="code-content" class="language-csharp">
// Kahn's algorithm: repeatedly take a node that waits for nothing
static List&lt;string&gt;? TopologicalSort(Dictionary&lt;string, List&lt;string&gt;&gt; graph)
{
    var inDegree = new Dictionary&lt;string, int&gt;();
    foreach (string node in graph.Keys) inDegree.TryAdd(node, 0);
    foreach (var (_, dependents) in graph)
        foreach (string d in dependents) { inDegree.TryAdd(d, 0); inDegree[d]++; }
    var ready = new Queue&lt;string&gt;();
    foreach (var (node, degree) in inDegree) if (degree == 0) ready.Enqueue(node);
    var order = new List&lt;string&gt;();
    while (ready.Count &gt; 0)
    {
        string node = ready.Dequeue();
        order.Add(node);
        if (!graph.TryGetValue(node, out var dependents)) continue;
        foreach (string d in dependents)
            if (--inDegree[d] == 0) ready.Enqueue(d);
    }
    // If not everything came out, some nodes wait on each other: a CYCLE
    return order.Count == inDegree.Count ? order : null;
}
var build = new Dictionary&lt;string, List&lt;string&gt;&gt;
{
    ["install"] = new() { "build" },
    ["build"] = new() { "test", "lint" },
    ["test"] = new() { "deploy" },
    ["lint"] = new() { "deploy" },
    ["deploy"] = new()
};
Console.WriteLine(string.Join(" -&gt; ", TopologicalSort(build)!));
// install -&gt; build -&gt; test -&gt; lint -&gt; deploy
// The order is NOT unique. Use a PriorityQueue for a reproducible one.
// Freeze the queue size and you get PARALLEL STAGES instead of a flat list
static List&lt;List&lt;string&gt;&gt; ParallelStages(Dictionary&lt;string, List&lt;string&gt;&gt; graph)
{
    var inDegree = new Dictionary&lt;string, int&gt;();
    foreach (string n in graph.Keys) inDegree.TryAdd(n, 0);
    foreach (var (_, ds) in graph)
        foreach (string d in ds) { inDegree.TryAdd(d, 0); inDegree[d]++; }
    var ready = new Queue&lt;string&gt;();
    foreach (var (n, deg) in inDegree) if (deg == 0) ready.Enqueue(n);
    var stages = new List&lt;List&lt;string&gt;&gt;();
    while (ready.Count &gt; 0)
    {
        int count = ready.Count;               // freeze before enqueuing more
        var stage = new List&lt;string&gt;();
        for (int i = 0; i &lt; count; i++)
        {
            string n = ready.Dequeue();
            stage.Add(n);
            if (!graph.TryGetValue(n, out var ds)) continue;
            foreach (string d in ds) if (--inDegree[d] == 0) ready.Enqueue(d);
        }
        stages.Add(stage);
    }
    return stages;
}
foreach (var stage in ParallelStages(build)) Console.WriteLine(string.Join(", ", stage));
// install / build / test, lint / deploy   -- each stage can run in parallel
</code></pre>
