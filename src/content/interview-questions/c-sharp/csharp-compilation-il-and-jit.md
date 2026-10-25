---
course: c-sharp
slug: csharp-compilation-il-and-jit
experienceLevel: fresher
difficulty: medium
tags:
  - clr
question: "How is C# code compiled and executed, and what are IL and JIT compilation?"
answer: |
  C# runs in two stages. At build time, the **Roslyn** compiler turns source code into **Intermediate Language (IL)**, a CPU-independent instruction set, and stores it with **metadata** describing every type and member in an assembly (`.dll` or `.exe`).

  At runtime, the CLR's **Just-In-Time (JIT) compiler** translates each method's IL into native machine code on its first call. The result is cached for the lifetime of the process, so later calls skip compilation, and methods that never run are never compiled.

  Because IL is platform-neutral, one assembly runs on any OS and CPU with a .NET runtime.

  Three options change when compilation happens:

  - **Tiered compilation** (default since .NET Core 3.0) first compiles quickly, then recompiles hot methods with full optimization.
  - **ReadyToRun** ships precompiled code alongside the IL for faster startup.
  - **Native AOT** (.NET 7+) compiles the whole app into a native executable, with no JIT at runtime.
codeExample: |
  static int Add(int a, int b) => a + b;

  Console.WriteLine(Add(2, 3)); // 1st call: the JIT compiles Add, then runs it
  Console.WriteLine(Add(4, 5)); // later calls reuse the cached native code
  // Output: 5
  //         9

  // IL that Roslyn emits for Add (Release build, as shown by ILSpy):
  //   ldarg.0   // push a onto the evaluation stack
  //   ldarg.1   // push b
  //   add       // pop both, push a + b
  //   ret       // return the value on top of the stack
  // At runtime the JIT turns these into native x64 or Arm64 instructions.
popularity: 8.3
isPublished: true
---
