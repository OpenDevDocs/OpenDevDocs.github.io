---
course: c-sharp
slug: what-is-the-clr
experienceLevel: fresher
difficulty: easy
tags:
  - clr
question: "What is the CLR (Common Language Runtime), and what does it do?"
answer: |
  The **Common Language Runtime (CLR)** is the execution engine of .NET (CoreCLR in modern .NET). It loads your compiled assemblies and provides the services your code needs while it runs:

  - **JIT compilation:** turns IL into native machine code for the current CPU.
  - **Memory management:** allocates objects, and the garbage collector frees unused ones.
  - **Type safety:** checks casts and array bounds, so invalid operations throw exceptions instead of corrupting memory.
  - **Exception handling:** one structured model shared by all .NET languages.
  - **Threading:** threads, the thread pool, and synchronization primitives.
  - **Interop:** calls into native libraries and COM components.

  Two standards make .NET multi-language. The **Common Type System (CTS)** defines how types are declared and behave, so C#, F#, and VB.NET share them. The **Common Language Specification (CLS)** is a subset of rules that public APIs follow so every .NET language can use them.
codeExample: |
  // Everyday code relies on CLR services
  object boxed = "hello";
  try
  {
      int n = (int)boxed;       // the CLR checks every cast at runtime
  }
  catch (InvalidCastException)
  {
      Console.WriteLine("Invalid cast caught");
  }

  int[] numbers = new int[3];
  try
  {
      numbers[5] = 1;           // ...and every array index
  }
  catch (IndexOutOfRangeException)
  {
      Console.WriteLine("Out-of-bounds write blocked");
  }

  var buffer = new byte[1024];  // no free/delete needed: the GC reclaims it
  Console.WriteLine(Environment.Version); // Output (on .NET 10): 10.0.x
popularity: 8.8
isPublished: true
---
