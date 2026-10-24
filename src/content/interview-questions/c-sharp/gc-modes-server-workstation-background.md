---
course: c-sharp
slug: gc-modes-server-workstation-background
experienceLevel: senior
difficulty: hard
tags:
  - memory
  - performance
question: "What are the GC modes in .NET (workstation vs server, background GC), and how do you choose?"
answer: |
  There are two main GC flavors, plus a concurrency setting:

  - **Workstation GC** uses a single heap and runs collections on the thread that triggered them. It favors low memory usage and responsiveness, and it's the default for desktop and console apps.
  - **Server GC** creates **one heap and one dedicated GC thread per logical core** and collects in parallel. It gives higher throughput for busy multi-threaded apps at the cost of more memory, and it's the default for ASP.NET Core apps.
  - **Background GC**, on by default in both modes, performs full Gen 2 collections concurrently with application threads (Gen 0 and Gen 1 collections still pause briefly), which keeps long pauses rare.

  Since .NET 9, Server GC enables **DATAS** (Dynamic Adaptation To Application Sizes) by default. It starts with fewer heaps and adapts to the actual load, which sharply reduces the memory Server GC used to reserve up front, especially in containers.

  Configure these with `<ServerGarbageCollection>` and `<ConcurrentGarbageCollection>` in the project file, in `runtimeconfig.json`, or through `DOTNET_` environment variables. In containers, the GC respects the memory limit, and you can tighten it further with `GCHeapHardLimit`.
codeExample: |
  // MyApi.csproj: explicit GC settings (these are the ASP.NET Core defaults)
  // <PropertyGroup>
  //   <ServerGarbageCollection>true</ServerGarbageCollection>
  //   <ConcurrentGarbageCollection>true</ConcurrentGarbageCollection>
  // </PropertyGroup>
  // Opt out of DATAS (.NET 9+) if a throughput-critical service needs it:
  // <GarbageCollectionAdaptationMode>0</GarbageCollectionAdaptationMode>

  using System.Runtime;

  Console.WriteLine($"Server GC: {GCSettings.IsServerGC}");
  Console.WriteLine($"Latency mode: {GCSettings.LatencyMode}"); // Interactive by default

  // A short latency-sensitive window: avoid blocking full collections
  var previous = GCSettings.LatencyMode;
  GCSettings.LatencyMode = GCLatencyMode.SustainedLowLatency;
  try
  {
      // ...latency-critical work...
  }
  finally
  {
      GCSettings.LatencyMode = previous;
  }
popularity: 7.8
isPublished: true
---
