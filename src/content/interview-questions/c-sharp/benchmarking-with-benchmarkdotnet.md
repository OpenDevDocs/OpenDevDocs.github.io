---
course: c-sharp
slug: benchmarking-with-benchmarkdotnet
experienceLevel: senior
difficulty: medium
tags:
  - performance
question: "How do you benchmark C# code correctly, and why is `Stopwatch` not enough?"
answer: |
  A quick `Stopwatch` loop is misleading for micro-benchmarks, because .NET performance changes while the code runs:

  - **JIT and tiering:** the first calls run unoptimized Tier 0 code, and the method is recompiled later.
  - **Dead-code elimination:** if a result isn't used, the JIT may remove the very work you think you're timing.
  - **Noise:** GC pauses, CPU frequency scaling, and timer resolution all distort single runs.
  - **Wrong configuration:** Debug builds, or running under a debugger, disable optimizations.

  **BenchmarkDotNet** handles all of this. It runs your benchmarks in a separate **Release** process, performs warm-up and pilot iterations to reach a steady state, runs many measured iterations, and reports statistics: mean, error, standard deviation, and outliers. Useful features:

  - `[MemoryDiagnoser]` reports the bytes allocated and GC counts per operation.
  - `[Params]` runs the same benchmark across input sizes.
  - `Baseline = true` shows ratios against a reference implementation.
  - Jobs compare runtimes, such as .NET 8 versus .NET 10.

  Good practice: **return** the result from each benchmark method so it can't be optimized away, use realistic data sizes, and run on a quiet machine. Micro-benchmarks answer narrow questions, so confirm real-world gains with profiling or load tests.
codeExample: |
  using BenchmarkDotNet.Attributes;
  using BenchmarkDotNet.Running;

  BenchmarkRunner.Run<StringJoinBenchmarks>();   // run with: dotnet run -c Release

  [MemoryDiagnoser]                              // adds Allocated and Gen0 columns
  public class StringJoinBenchmarks
  {
      private string[] _items = [];
      [Params(10, 1_000)]                        // benchmark several input sizes
      public int Count;
      [GlobalSetup]
      public void Setup() =>
          _items = Enumerable.Range(0, Count).Select(i => $"item{i}").ToArray();

      [Benchmark(Baseline = true)]
      public string Concat()
      {
          string result = "";
          foreach (var s in _items) result += s;   // O(n^2) copying
          return result;                           // return it: no dead-code elimination
      }
      [Benchmark]
      public string Join() => string.Join("", _items);
  }
popularity: 7.6
isPublished: true
---
