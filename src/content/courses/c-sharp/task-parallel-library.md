---
publishDate: 2026-04-21T11:38
title: Task Parallel Library
slug: task-parallel-library
metadescription: Use the Task Parallel Library to run CPU bound work across cores with Task.Run, Parallel.For, Parallel.ForEach, PLINQ and continuations, and learn when parallelism helps and when it hurts.
updateDate: 2026-09-05T11:38
author: ['bishal-biswas']
level: 3
tags: ['parallelism', 'tasks', 'tpl']
course: c-sharp
---

## Concurrency and parallelism

The previous topic used tasks to **wait** efficiently. This one uses them to **work** on several things at once. The difference matters:

- **Concurrency**: dealing with many things at once, often by interleaving. `async` and `await` on a single thread is concurrency.
- **Parallelism**: doing many things at the same moment on different CPU cores.

The **Task Parallel Library (TPL)** in `System.Threading.Tasks` gives you both, built on a pool of worker threads that .NET manages for you.

## Task.Run

The simplest way to push work onto another core:

```csharp
Task<long> task = Task.Run(() =>
{
    long sum = 0;
    for (int i = 0; i < 100_000_000; i++) sum += i;
    return sum;
});

Console.WriteLine("Working in the background...");
long result = await task;
Console.WriteLine(result);
```

The lambda runs on a thread pool thread. The calling thread carries on and picks up the result at the `await`.

Start several and wait for all:

```csharp
Task<int>[] tasks = Enumerable.Range(1, 4)
    .Select(n => Task.Run(() => HeavyCalculation(n)))
    .ToArray();

int[] results = await Task.WhenAll(tasks);
```

## Parallel.For and Parallel.ForEach

For a loop where every pass is independent, the `Parallel` class splits the range across cores automatically:

```csharp
int[] data = Enumerable.Range(1, 1_000_000).ToArray();
long[] squares = new long[data.Length];

Parallel.For(0, data.Length, i =>
{
    squares[i] = (long)data[i] * data[i];
});
```

Each index is handled exactly once, but in no particular order. Writing to a different array slot per iteration is safe. Writing to a shared variable is not, as the next section shows.

```csharp
var files = Directory.GetFiles("images");

Parallel.ForEach(files, file =>
{
    ResizeImage(file);
});
```

### Limiting parallelism

```csharp
var options = new ParallelOptions { MaxDegreeOfParallelism = 4 };
Parallel.ForEach(files, options, file => ResizeImage(file));
```

Useful when the work also hits a database or an API that cannot take unlimited concurrent calls.

### Async bodies

`Parallel.ForEachAsync` runs an async lambda per item with a concurrency limit:

```csharp
await Parallel.ForEachAsync(urls, new ParallelOptions { MaxDegreeOfParallelism = 8 },
    async (url, token) =>
    {
        string html = await client.GetStringAsync(url, token);
        await File.WriteAllTextAsync(Path.GetFileName(url) + ".html", html, token);
    });
```

This is the right tool for "download a thousand things, but only eight at a time".

## The shared state trap

This looks fine and gives the wrong answer:

```csharp
int total = 0;

Parallel.For(0, 100_000, i =>
{
    total += 1;   // race condition
});

Console.WriteLine(total);   // less than 100000
```

`total += 1` is read, add, write. Two threads can read the same value and both write back the same result, losing an increment. Fixes, from best to worst:

**Give each thread its own accumulator** and combine at the end:

```csharp
int total = 0;

Parallel.For(0, 100_000,
    () => 0,                                     // local init per thread
    (i, state, local) => local + 1,              // body works on the local
    local => Interlocked.Add(ref total, local)); // combine once per thread
```

**Use Interlocked** for simple counters:

```csharp
Interlocked.Increment(ref total);
```

**Use a lock**, which serialises access and can kill the benefit of parallelism if the lock is in the hot loop:

```csharp
lock (sync) { total += 1; }
```

Or avoid the problem entirely by writing results into separate slots and summing afterwards. Synchronisation is covered fully in a later topic.

## PLINQ

Add `.AsParallel()` to a LINQ query and the operators run across cores:

```csharp
var primes = Enumerable.Range(2, 1_000_000)
    .AsParallel()
    .Where(IsPrime)
    .ToList();
```

Results may come back in any order. Add `.AsOrdered()` to preserve the source order at a small cost. PLINQ is worth it only when the per item work is heavy. For a cheap `Where`, the overhead of splitting and merging outweighs the gain.

## Continuations

`ContinueWith` schedules work to run when a task finishes. `await` is usually cleaner, but continuations are useful for fire and forget logging:

```csharp
Task.Run(() => Export())
    .ContinueWith(t => Console.WriteLine("Export failed: " + t.Exception?.Message),
                  TaskContinuationOptions.OnlyOnFaulted);
```

## Exceptions in parallel code

If several iterations throw, `Parallel.For` collects them all into an `AggregateException`:

```csharp
try
{
    Parallel.ForEach(files, ProcessFile);
}
catch (AggregateException ex)
{
    foreach (var inner in ex.InnerExceptions)
    {
        Console.WriteLine(inner.Message);
    }
}
```

## When parallelism does not help

- **The work is I/O bound.** Use `async` and `await`. Extra threads just wait in parallel.
- **The work per item is tiny.** Splitting and merging costs more than it saves.
- **The items share state.** Locks serialise the work and you gain nothing.
- **The machine has one core.** Common in small containers.

Rule: measure. A `Stopwatch` around both versions tells you the truth in seconds.

## Quick recap

- The TPL runs CPU bound work on a managed thread pool across cores.
- `Task.Run` offloads one piece of work, `Task.WhenAll` gathers several.
- `Parallel.For` and `Parallel.ForEach` split independent loop iterations across threads.
- `Parallel.ForEachAsync` limits how many async operations run at once.
- Shared mutable state in a parallel loop is a race. Use thread local accumulators or `Interlocked`.
- `AsParallel` parallelises LINQ, and only pays off for heavy per item work.

<code id="code-content" class="language-csharp">
// Task Parallel Library
using System.Diagnostics;
static bool IsPrime(int n)
{
    if (n &lt; 2) return false;
    for (int i = 2; i * i &lt;= n; i++)
        if (n % i == 0) return false;
    return true;
}
int[] numbers = Enumerable.Range(1, 2_000_000).ToArray();
// Sequential baseline
var sw = Stopwatch.StartNew();
int seqCount = numbers.Count(IsPrime);
Console.WriteLine($"Sequential: {seqCount} primes in {sw.ElapsedMilliseconds}ms");
// Parallel.For with thread local accumulators, no race
sw.Restart();
int parCount = 0;
Parallel.For(0, numbers.Length,
    () =&gt; 0,                                             // per thread local
    (i, state, local) =&gt; IsPrime(numbers[i]) ? local + 1 : local,
    local =&gt; Interlocked.Add(ref parCount, local));      // merge once per thread
Console.WriteLine($"Parallel.For: {parCount} primes in {sw.ElapsedMilliseconds}ms");
// PLINQ does the same in one line
sw.Restart();
int plinqCount = numbers.AsParallel().Count(IsPrime);
Console.WriteLine($"PLINQ: {plinqCount} primes in {sw.ElapsedMilliseconds}ms");
// The race condition, shown deliberately
int broken = 0;
Parallel.For(0, 100_000, i =&gt; broken++);                // lost updates
Console.WriteLine($"Racy counter: {broken} (expected 100000)");
// Task.Run for several independent jobs
Task&lt;int&gt;[] jobs = Enumerable.Range(1, 4)
    .Select(n =&gt; Task.Run(() =&gt; Enumerable.Range(1, n * 1000).Sum()))
    .ToArray();
int[] sums = await Task.WhenAll(jobs);
Console.WriteLine(string.Join(", ", sums));
// Parallel.ForEachAsync limits concurrent async work
var ids = Enumerable.Range(1, 10);
await Parallel.ForEachAsync(ids, new ParallelOptions { MaxDegreeOfParallelism = 3 },
    async (id, token) =&gt;
    {
        await Task.Delay(100, token);                     // stands in for an API call
        Console.Write($"{id} ");
    });
Console.WriteLine();
</code></pre>
