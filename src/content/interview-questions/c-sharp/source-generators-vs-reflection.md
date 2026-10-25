---
course: c-sharp
slug: source-generators-vs-reflection
experienceLevel: senior
difficulty: hard
tags:
  - reflection
  - performance
question: "What are source generators in C#, and why are they replacing runtime reflection in many libraries?"
answer: |
  A **source generator** is a component that plugs into the Roslyn compiler. During the build, it inspects your code's syntax trees and semantic model and **adds new C# source files** to the compilation. It can't modify or remove existing code, only add to it, which is why generated code typically completes `partial` classes and methods that you declare. Modern generators implement `IIncrementalGenerator`, which caches work between edits.

  Reflection does its discovery **at runtime**, on every application start. Moving that work to **compile time** has big benefits:

  - **Faster startup and execution:** no metadata scanning and no `MethodInfo.Invoke`, just direct calls.
  - **Native AOT and trimming compatibility:** the generated code references members statically, so the trimmer keeps what's needed, and nothing requires runtime code generation.
  - **Earlier errors:** misconfigurations become compiler diagnostics instead of runtime exceptions.
  - **Debuggability:** you can open and step through the generated code.

  The BCL uses generators widely: the System.Text.Json `JsonSerializerContext`, `[GeneratedRegex]`, `[LoggerMessage]` for high-performance logging, and `[LibraryImport]` for interop.

  The trade-offs: generators are harder to write and test than reflection code, and a poorly written, non-incremental generator slows down every keystroke in the IDE.
codeExample: |
  using System.Text.Json;
  using System.Text.Json.Serialization;
  using System.Text.RegularExpressions;

  // Regex: generated at compile time instead of parsed and compiled at runtime
  Console.WriteLine(Patterns.Email().IsMatch("ada@example.com")); // Output: True

  // JSON: a serializer generated for this type, with no runtime reflection
  var json = JsonSerializer.Serialize(new Order(1, 99.5m), AppJsonContext.Default.Order);
  Console.WriteLine(json);                  // Output: {"Id":1,"Total":99.5}

  public static partial class Patterns
  {
      [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.IgnoreCase)]
      public static partial Regex Email();  // the body comes from the generator
  }

  [JsonSerializable(typeof(Order))]
  public partial class AppJsonContext : JsonSerializerContext { }

  public record Order(int Id, decimal Total);
popularity: 7.4
isPublished: true
---
