---
course: c-sharp
slug: diagnosing-production-performance-issues
experienceLevel: senior
difficulty: hard
tags:
  - performance
  - memory
question: "How do you diagnose high CPU, memory growth, or hangs in a production .NET application?"
answer: |
  Work from cheap, broad signals to expensive, precise ones: **metrics, then traces, then dumps**.

  1. **Metrics first.** Use `dotnet-counters`, or your APM and OpenTelemetry dashboards, to see which resource is the problem: CPU usage, GC heap size and collection counts, allocation rate, thread pool queue length and thread count, and exception rate. The pattern points you to a category.
  2. **Traces for CPU and latency.** `dotnet-trace collect` records CPU samples and runtime events with little overhead. Open the trace in PerfView, Visual Studio, or Speedscope and look at the hottest call stacks.
  3. **Dumps for memory and hangs.** `dotnet-gcdump` captures a heap snapshot; compare two snapshots to see which types grow. `dotnet-dump collect` captures the whole process, and `dotnet-dump analyze` lets you run `dumpheap -stat`, `gcroot`, `clrstack -all` for hangs, and `syncblk` for lock owners.

  In containers and Kubernetes, **`dotnet-monitor`** runs as a sidecar and can collect traces and dumps automatically when a trigger fires.

  The usual culprits are sync-over-async, excessive allocations in hot paths, lock contention, unbounded caches, and chatty database access. Reproduce the problem under load, and verify the fix with the same metrics.
codeExample: |
  # Terminal: 1) watch live metrics for a running process
  dotnet-counters monitor --name MyApi --counters System.Runtime

  # 2) CPU or latency problem: record a 30-second trace, then open it in PerfView,
  #    Visual Studio, or Speedscope (add --format speedscope)
  dotnet-trace collect --name MyApi --duration 00:00:00:30

  # 3) Memory growth: take heap snapshots a few minutes apart and compare them
  dotnet-gcdump collect --name MyApi

  # 4) Hang or deep memory analysis: capture a full dump
  dotnet-dump collect --name MyApi
  dotnet-dump analyze core_20260912_101500
  #   > dumpheap -stat            which types use the most memory
  #   > gcroot <object-address>   what keeps an object alive
  #   > clrstack -all             where every thread is (hangs, deadlocks)
  #   > syncblk                   which thread owns which lock

  # Kubernetes: run dotnet-monitor as a sidecar with triggers, such as
  # "collect a trace when CPU stays above 80% for 1 minute"
popularity: 8.2
isPublished: true
---
