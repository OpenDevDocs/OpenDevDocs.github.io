---
course: c-sharp
slug: tiered-compilation-and-dynamic-pgo
experienceLevel: senior
difficulty: hard
tags:
  - clr
  - performance
question: "What are tiered compilation and Dynamic PGO in .NET?"
answer: |
  **Tiered compilation**, on by default since .NET Core 3.0, compiles hot methods more than once to balance startup time against peak speed:

  - **Tier 0:** the first call gets a quick, lightly optimized compilation, so startup is fast. Precompiled **ReadyToRun** code can serve as this initial tier too.
  - **Tier 1:** the runtime counts calls, and methods that turn out to be hot (by default, after about 30 calls) are recompiled in the background with full optimizations.
  - **On-Stack Replacement (OSR):** a method stuck in a long-running loop can switch to optimized code in the middle of that loop.

  **Dynamic PGO** (profile-guided optimization), on by default since .NET 8, makes Tier 1 smarter. Tier 0 code is instrumented to record how the program actually behaves: which concrete types appear at virtual and interface call sites, and which branches are taken. Tier 1 then uses that profile for **guarded devirtualization** (a fast, inlinable call for the common type, with a fallback), better inlining, and hot/cold code layout.

  Practical consequences: code gets faster after it warms up, so benchmarks must include warm-up. Startup-sensitive apps may tune `TieredCompilation`, `TieredPGO`, or `TieredCompilationQuickJitForLoops`, or use ReadyToRun or Native AOT instead.
codeExample: |
  // MyApp.csproj: tiering settings (the first two are the defaults)
  // <PropertyGroup>
  //   <TieredCompilation>true</TieredCompilation>   <!-- Tier 0, then Tier 1 -->
  //   <TieredPGO>true</TieredPGO>                   <!-- Dynamic PGO (.NET 8+) -->
  //   <PublishReadyToRun>true</PublishReadyToRun>   <!-- precompiled startup code -->
  // </PropertyGroup>

  IShape shape = new Circle(2);
  double total = 0;
  for (int i = 0; i < 10_000_000; i++)   // OSR can optimize this loop mid-run
  {
      // Dynamic PGO sees that 'shape' is almost always a Circle and emits roughly:
      //   if (shape is Circle c) { inlined c.Area() } else { shape.Area() }
      total += shape.Area();
  }
  Console.WriteLine(total > 0);          // Output: True

  interface IShape { double Area(); }
  sealed class Circle(double r) : IShape { public double Area() => Math.PI * r * r; }
popularity: 7.2
isPublished: true
---
