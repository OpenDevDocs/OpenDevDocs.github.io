---
publishDate: 2026-04-26T11:46
title: Benchmarking with BenchmarkDotNet
slug: benchmarking-with-benchmarkdotnet
metadescription: Measure performance properly with BenchmarkDotNet, set up a benchmark project, compare implementations, read the results table, track allocations with the memory diagnoser and avoid the mistakes that make Stopwatch numbers lie.
updateDate: 2026-09-05T11:46
author: ['bishal-biswas']
level: 4
tags: ['performance', 'benchmarking', 'tooling']
course: c-sharp
---

## Why Stopwatch is not enough

The obvious way to measure code is a `Stopwatch` around it:

```csharp
var sw = Stopwatch.StartNew();
DoWork();
Console.WriteLine(sw.ElapsedMilliseconds);
```

The number you get is misleading for several reasons:

- The first call includes **JIT compilation** time. The second call is much faster.
- The CPU has not warmed up its caches or branch predictors.
- A **garbage collection** may or may not happen during the run.
- Debug builds are slow and unoptimised. Release builds inline and remove code.
- The compiler may **eliminate** work whose result is never used.
- One run tells you nothing about variance.

Real benchmarking means warming up, running many iterations, using a release build, keeping the results alive and reporting statistics. **BenchmarkDotNet** does all of that.

## Setting up

Create a console project and add the package:

```bash
dotnet new console -n Benchmarks
cd Benchmarks
dotnet add package BenchmarkDotNet
```

Write a class with `[Benchmark]` methods and run it:

```csharp
using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Running;

public class StringJoinBenchmarks
{
    private readonly string[] parts = Enumerable.Range(1, 100).Select(i => i.ToString()).ToArray();

    [Benchmark(Baseline = true)]
    public string Concat()
    {
        string result = "";
        foreach (string p in parts) result += p + ",";
        return result;
    }

    [Benchmark]
    public string Builder()
    {
        var sb = new StringBuilder();
        foreach (string p in parts) sb.Append(p).Append(',');
        return sb.ToString();
    }

    [Benchmark]
    public string Join() => string.Join(",", parts) + ",";
}

class Program
{
    static void Main() => BenchmarkRunner.Run<StringJoinBenchmarks>();
}
```

Run it in release mode. This is not optional:

```bash
dotnet run -c Release
```

BenchmarkDotNet builds a separate process per benchmark, warms up, runs enough iterations to get stable numbers and prints a table.

## Reading the results

```
| Method  | Mean       | Error    | StdDev   | Ratio | Gen0   | Allocated |
|-------- |-----------:|---------:|---------:|------:|-------:|----------:|
| Concat  | 4,812.3 ns | 21.40 ns | 18.91 ns |  1.00 | 3.1250 |   26.2 KB |
| Builder |   612.7 ns |  4.12 ns |  3.85 ns |  0.13 | 0.1450 |    1.2 KB |
| Join    |   398.5 ns |  2.90 ns |  2.71 ns |  0.08 | 0.0980 |    0.8 KB |
```

- **Mean**: the average time per call. Here in nanoseconds.
- **Error and StdDev**: how much the measurements varied. Small relative to the mean means a trustworthy result.
- **Ratio**: relative to the baseline. `Builder` takes 13 percent of the time of `Concat`.
- **Gen0**: garbage collections per thousand operations.
- **Allocated**: bytes allocated per call.

The allocation columns only appear with the memory diagnoser, which you should always enable.

## The memory diagnoser

```csharp
[MemoryDiagnoser]
public class StringJoinBenchmarks
{
    // ...
}
```

Time is only half the story. A method that allocates heavily creates GC pressure that slows down everything else in the app, and that cost does not show up in its own timing. The `Allocated` column reveals it.

## Parameters

Test across input sizes with `[Params]`. Each value produces its own row:

```csharp
[MemoryDiagnoser]
public class SearchBenchmarks
{
    [Params(10, 1_000, 100_000)]
    public int Size;

    private List<int> list = new();
    private HashSet<int> set = new();

    [GlobalSetup]
    public void Setup()
    {
        list = Enumerable.Range(0, Size).ToList();
        set = new HashSet<int>(list);
    }

    [Benchmark] public bool ListContains() => list.Contains(Size - 1);
    [Benchmark] public bool SetContains() => set.Contains(Size - 1);
}
```

`[GlobalSetup]` runs once per parameter combination and is not timed. This benchmark shows the list going from faster at 10 items to hundreds of times slower at 100,000, which is exactly the kind of insight a single `Stopwatch` run cannot give you.

## Avoiding dead code elimination

If a benchmark computes a value and throws it away, the JIT may delete the work and you measure nothing:

```csharp
[Benchmark]
public void Bad()
{
    int x = ExpensiveCalculation();   // may be removed entirely
}

[Benchmark]
public int Good() => ExpensiveCalculation();   // returned, so it must run
```

Return the result, or store it in a field. BenchmarkDotNet consumes return values so they count as used.

## Comparing runtimes

One attribute compares the same code across .NET versions:

```csharp
[SimpleJob(RuntimeMoniker.Net80)]
[SimpleJob(RuntimeMoniker.Net90)]
public class MyBenchmarks { }
```

Useful when deciding whether an upgrade is worth it, and for library authors supporting several targets.

## Practical rules

1. **Benchmark the real thing.** A micro benchmark of `List.Add` tells you little about your app. Benchmark the method your profiler flagged.
2. **Profile first, benchmark second.** A profiler tells you where time goes. A benchmark tells you whether a change helped.
3. **Use realistic data.** Sorting an already sorted array or parsing an empty string gives useless numbers.
4. **Watch allocations as much as time.** In server code, allocation rate often matters more.
5. **Do not benchmark in debug, on battery, or with other heavy apps running.** Noise swamps the signal.
6. **Keep the baseline.** Always mark the current implementation as `Baseline = true` so the ratio column tells the story.

## A typical workflow

You suspect a method is slow. Run a profiler such as the one in Visual Studio or `dotnet-trace` to confirm it is actually hot. Copy the method into a benchmark project as the baseline, write your improved version beside it, run in release, and read the ratio and allocated columns. If the improvement is real and meaningful, apply it. If it is a two percent gain with worse readability, do not.

## Quick recap

- `Stopwatch` timings are skewed by JIT, warm up, GC and debug builds.
- BenchmarkDotNet handles warm up, iterations, statistics and process isolation.
- Mark methods with `[Benchmark]`, set one as `Baseline = true`, run with `dotnet run -c Release`.
- Add `[MemoryDiagnoser]` to see allocations, which matter as much as time.
- `[Params]` tests across sizes and `[GlobalSetup]` prepares data outside the timing.
- Return results so the JIT cannot eliminate the work, and profile before you benchmark.

<code id="code-content" class="language-csharp">
// Benchmarking with BenchmarkDotNet
// dotnet add package BenchmarkDotNet
// dotnet run -c Release
using System.Text;
using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Running;
[MemoryDiagnoser]                                  // adds Gen0 and Allocated columns
public class StringJoinBenchmarks
{
    [Params(10, 1_000)]                            // one row per size
    public int Count;
    private string[] parts = Array.Empty&lt;string&gt;();
    [GlobalSetup]                                  // not timed, runs once per Params value
    public void Setup()
        =&gt; parts = Enumerable.Range(1, Count).Select(i =&gt; i.ToString()).ToArray();
    [Benchmark(Baseline = true)]
    public string Concat()
    {
        string result = "";
        foreach (string p in parts) result += p + ",";   // allocates a new string every pass
        return result;                                   // returned so the JIT cannot drop it
    }
    [Benchmark]
    public string Builder()
    {
        var sb = new StringBuilder();
        foreach (string p in parts) sb.Append(p).Append(',');
        return sb.ToString();
    }
    [Benchmark]
    public string Join() =&gt; string.Join(",", parts) + ",";
}
[MemoryDiagnoser]
public class LookupBenchmarks
{
    [Params(10, 100_000)]
    public int Size;
    private List&lt;int&gt; list = new();
    private HashSet&lt;int&gt; set = new();
    [GlobalSetup]
    public void Setup()
    {
        list = Enumerable.Range(0, Size).ToList();
        set = new HashSet&lt;int&gt;(list);
    }
    [Benchmark(Baseline = true)] public bool ListContains() =&gt; list.Contains(Size - 1);
    [Benchmark] public bool SetContains() =&gt; set.Contains(Size - 1);
}
class Program
{
    static void Main(string[] args)
    {
        // Runs every benchmark class in the assembly and prints result tables
        BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args);
    }
}
/*
| Method  | Count | Mean       | Ratio | Gen0   | Allocated |
|-------- |------ |-----------:|------:|-------:|----------:|
| Concat  | 1000  | 412.8 us   |  1.00 | 250.0  | 2.1 MB    |
| Builder | 1000  |   6.9 us   |  0.02 |   1.2  | 10.4 KB   |
| Join    | 1000  |   4.1 us   |  0.01 |   0.9  |  7.8 KB   |
*/
</code></pre>
