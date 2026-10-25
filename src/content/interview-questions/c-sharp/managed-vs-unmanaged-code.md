---
course: c-sharp
slug: managed-vs-unmanaged-code
experienceLevel: fresher
difficulty: easy
tags:
  - clr
  - memory
question: "What is the difference between managed and unmanaged code?"
answer: |
  **Managed code** runs under the control of the CLR. C# compiles to IL, and the runtime handles memory allocation, garbage collection, type-safety checks, and exception handling for you.

  **Unmanaged code** is native machine code that runs directly on the operating system, outside the CLR, such as C and C++ libraries or operating system APIs. The developer allocates and frees memory manually, so memory leaks, dangling pointers, and buffer overruns are real risks.

  In short, managed code trades a little low-level control for safety and productivity, while unmanaged code gives full control over memory and hardware.

  C# can call native code through **P/Invoke** (for C-style functions) and **COM interop**. Managed objects that wrap unmanaged resources, such as file handles or sockets, must release them explicitly through `IDisposable`, because the garbage collector only tracks managed memory.
codeExample: |
  using System.Runtime.InteropServices;

  // Managed: the CLR allocates this list and the GC frees it later
  var names = new List<string> { "Ada", "Linus" };

  // Unmanaged: a native Windows API called through P/Invoke
  uint pid = Native.GetCurrentProcessId();
  Console.WriteLine($"Process ID from native code: {pid}");

  // A managed object wrapping an unmanaged OS file handle:
  // dispose it so the handle is released now, not whenever the GC runs
  using (FileStream file = File.Create("log.txt"))
  {
      file.WriteByte(42);
  }

  static class Native
  {
      [DllImport("kernel32.dll")] // Windows-only native library
      public static extern uint GetCurrentProcessId();
  }
popularity: 7.8
isPublished: true
---
