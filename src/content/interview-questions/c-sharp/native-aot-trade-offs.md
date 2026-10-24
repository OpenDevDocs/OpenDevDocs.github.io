---
course: c-sharp
slug: native-aot-trade-offs
experienceLevel: senior
difficulty: hard
tags:
  - clr
  - performance
question: "What is Native AOT in .NET, and what are its trade-offs?"
answer: |
  **Native AOT** compiles your app ahead of time into a **self-contained native executable**. Setting `<PublishAot>true</PublishAot>` and running `dotnet publish` produces a binary with no JIT and no IL to compile at runtime, and the target machine doesn't need a .NET runtime installed.

  Benefits:

  - **Very fast startup.**
  - **Lower memory use** and a **smaller deployment**, because trimming removes unused code.
  - A good fit for containers, serverless functions, and CLI tools.

  Trade-offs:

  - **No runtime code generation:** `Reflection.Emit`, dynamically loaded assemblies, and some dynamic proxies don't work.
  - **Reflection must be statically analyzable.** Trimming removes members reached only through reflection unless they're annotated. The analyzers report trim and AOT warnings at build time, so treat those warnings as errors.
  - **Library compatibility:** code built on runtime reflection needs source-generated alternatives, such as a System.Text.Json `JsonSerializerContext`.
  - **Platform-specific builds:** you publish per OS and architecture, and builds take longer.
  - **Peak throughput can be lower** than JIT-compiled code, because there's no Dynamic PGO to specialize for the running workload.

  ASP.NET Core supports Native AOT for minimal APIs and gRPC, but not for everything, such as MVC. Choose it when startup time and footprint matter more than peak throughput.
codeExample: |
  // MyTool.csproj
  // <PropertyGroup>
  //   <PublishAot>true</PublishAot>
  //   <InvariantGlobalization>true</InvariantGlobalization>  <!-- smaller binary -->
  // </PropertyGroup>
  // Publish:  dotnet publish -c Release -r linux-x64  -> one native executable

  using System.Text.Json;
  using System.Text.Json.Serialization;

  var order = new Order(42, 99.95m);

  // Reflection-based JsonSerializer.Serialize(order) produces trim/AOT warnings;
  // the source-generated context works under trimming and Native AOT
  string json = JsonSerializer.Serialize(order, AppJson.Default.Order);
  Console.WriteLine(json);              // Output: {"Id":42,"Total":99.95}

  // Not supported under Native AOT: runtime code generation such as
  // AssemblyBuilder.DefineDynamicAssembly(...) from Reflection.Emit

  [JsonSerializable(typeof(Order))]
  partial class AppJson : JsonSerializerContext { }

  record Order(int Id, decimal Total);
popularity: 7.6
isPublished: true
---
