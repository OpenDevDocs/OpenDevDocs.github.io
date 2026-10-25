---
publishDate: 2026-04-29T11:53
title: Source Generators
slug: source-generators
metadescription: Generate C# code at compile time with incremental source generators, understand the pipeline and why they replace reflection, build a generator driven by an attribute, and use the ones already in .NET.
updateDate: 2026-09-05T11:53
author: ['bishal-biswas']
level: 4
tags: ['roslyn', 'source-generators', 'performance']
course: c-sharp
---

## Code that writes code, at compile time

A **source generator** is a Roslyn component that runs during compilation, inspects your code and **adds new source files** to the build. The generated code is compiled together with yours, so it is fully typed, debuggable and as fast as anything you wrote by hand.

Compare the two ways to turn an object into JSON:

- **Reflection** looks up properties by name at run time, on every call, with boxing and string lookups. It is slow, and a trimmer cannot see what will be asked for.
- **A generator** reads the class once at compile time and emits a `Serialize` method that writes each property directly. No lookup, no boxing, trim safe, AOT compatible.

That trade is why .NET is moving generators into every corner: JSON, logging, regular expressions, interop, dependency injection and more.

## Generators you already use

Even if you never write one, you will use these:

**System.Text.Json**

```csharp
[JsonSerializable(typeof(Person))]
partial class AppJsonContext : JsonSerializerContext { }

string json = JsonSerializer.Serialize(person, AppJsonContext.Default.Person);
```

**Regex**

```csharp
partial class Validator
{
    [GeneratedRegex(@"^\d{3}-\d{4}$")]
    private static partial Regex PhonePattern();
}

bool ok = Validator.PhonePattern().IsMatch("555-1234");
```

The regex is compiled to C# at build time instead of interpreted at run time.

**Logging**

```csharp
partial class OrderService
{
    [LoggerMessage(Level = LogLevel.Information, Message = "Order {OrderId} placed for {Total}")]
    partial void LogOrderPlaced(int orderId, decimal total);
}
```

**Interop** with `[LibraryImport]`, seen in the unsafe topic, generates marshalling code that used to be produced at run time.

The pattern in every case: you write a `partial` declaration with an attribute, and the generator supplies the body.

## How a generator runs

1. The compiler parses all source files.
2. Each generator receives the compilation and looks for what it cares about, usually an attribute.
3. The generator produces strings of C# and adds them as new syntax trees.
4. The compiler compiles everything together.

Generators can only **add** code. They cannot modify or remove your files. That is why the `partial` keyword is essential: your half and the generated half of a class merge into one.

## Incremental generators

Modern generators implement `IIncrementalGenerator`. The IDE runs generators on every keystroke, so they must be fast. The incremental model is a pipeline of steps that cache their results. Only the steps whose inputs changed run again.

```csharp
[Generator]
public class ToStringGenerator : IIncrementalGenerator
{
    public void Initialize(IncrementalGeneratorInitializationContext context)
    {
        // Step 1: find every class marked with our attribute
        var classes = context.SyntaxProvider.ForAttributeWithMetadataName(
            "Demo.AutoToStringAttribute",
            predicate: static (node, _) => node is ClassDeclarationSyntax,
            transform: static (ctx, _) => (INamedTypeSymbol)ctx.TargetSymbol);

        // Step 2: emit one file per class
        context.RegisterSourceOutput(classes, static (spc, symbol) =>
        {
            spc.AddSource($"{symbol.Name}.ToString.g.cs", Generate(symbol));
        });
    }

    private static string Generate(INamedTypeSymbol type)
    {
        var props = type.GetMembers().OfType<IPropertySymbol>()
            .Select(p => $"{p.Name} = {{{p.Name}}}");

        return $$"""
            namespace {{type.ContainingNamespace}};

            partial class {{type.Name}}
            {
                public override string ToString() => $"{{type.Name}} { {{string.Join(", ", props)}} }";
            }
            """;
    }
}
```

`ForAttributeWithMetadataName` is the fast path: the compiler indexes attributes so the generator only looks at marked classes instead of scanning the whole project.

The user's side:

```csharp
namespace Demo;

[AttributeUsage(AttributeTargets.Class)]
public class AutoToStringAttribute : Attribute { }

[AutoToString]
public partial class Customer
{
    public string Name { get; set; } = "";
    public int Age { get; set; }
}

Console.WriteLine(new Customer { Name = "Asha", Age = 30 });
// Customer { Name = Asha, Age = 30 }
```

The `ToString` override exists at compile time. Hover over it in the editor and you can navigate to the generated file.

## Project setup

A generator is a class library that targets `netstandard2.0`, because it runs inside the compiler process which may be on any .NET version:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netstandard2.0</TargetFramework>
    <LangVersion>latest</LangVersion>
    <EnforceExtendedAnalyzerRules>true</EnforceExtendedAnalyzerRules>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.CodeAnalysis.CSharp" Version="4.8.0" PrivateAssets="all" />
  </ItemGroup>
</Project>
```

The consuming project references it as an analyzer, not as a normal dependency:

```xml
<ProjectReference Include="../Demo.Generators/Demo.Generators.csproj"
                  OutputItemType="Analyzer"
                  ReferenceOutputAssembly="false" />
```

To see the generated files on disk, add `<EmitCompilerGeneratedFiles>true</EmitCompilerGeneratedFiles>` to the consuming project and look under `obj/`.

## Debugging a generator

Generators run inside the compiler, so a breakpoint in the generator project does nothing by default. Two approaches work:

- Write **unit tests** with `Microsoft.CodeAnalysis.CSharp.SourceGenerators.Testing`, passing source text in and asserting on the generated output. This is the primary way to develop generators.
- Add `Debugger.Launch()` in `Initialize` temporarily to attach a debugger when the build runs.

## Rules of good generators

- **Mark output with the file name suffix `.g.cs`** and a header comment so readers know not to edit it.
- **Never do I/O or read the file system.** Generators must be pure functions of the compilation.
- **Keep the pipeline steps small and equatable.** Cached results are compared by equality, and passing whole syntax nodes or symbols through defeats caching. Extract only the data you need into a record.
- **Emit diagnostics** for misuse, for example the attribute on a non partial class, rather than generating broken code.
- **Generate `partial` members** so users can still add their own code to the type.

## Generators or reflection?

| Concern | Reflection | Source generator |
| --- | --- | --- |
| Run time cost | High per call | None |
| Startup | Slow on first use | Instant |
| Trimming and AOT | Breaks | Works |
| Debugging | Opaque | Step into generated code |
| Effort to build | Low | Higher |
| Handles unknown types at run time | Yes | No |

Reflection still wins when the types are genuinely unknown until run time, such as a plugin loaded from disk. For everything known at compile time, generators are the better tool, and the framework is following that rule.

## Quick recap

- Source generators add C# files during compilation based on what they find in your code.
- JSON, regex, logging and interop in .NET already use them behind `partial` declarations and attributes.
- They replace reflection with compile time code that is fast, trim safe and debuggable.
- Implement `IIncrementalGenerator`, find targets with `ForAttributeWithMetadataName`, emit with `AddSource`.
- The generator project targets `netstandard2.0` and is referenced as an analyzer.
- Test generators with the testing package, and keep pipeline steps small and cacheable.

<code id="code-content" class="language-csharp">
// Source generators: the generator project (targets netstandard2.0)
// PackageReference: Microsoft.CodeAnalysis.CSharp, PrivateAssets="all"
using System.Collections.Immutable;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
// Only the data we need flows through the pipeline, so caching works
record ClassInfo(string Namespace, string Name, ImmutableArray&lt;string&gt; Properties);
[Generator]
public class AutoToStringGenerator : IIncrementalGenerator
{
    public void Initialize(IncrementalGeneratorInitializationContext context)
    {
        // Step 1: find classes marked [AutoToString] using the indexed fast path
        IncrementalValuesProvider&lt;ClassInfo&gt; classes = context.SyntaxProvider
            .ForAttributeWithMetadataName(
                "Demo.AutoToStringAttribute",
                predicate: static (node, _) =&gt; node is ClassDeclarationSyntax,
                transform: static (ctx, _) =&gt;
                {
                    var type = (INamedTypeSymbol)ctx.TargetSymbol;
                    var props = type.GetMembers().OfType&lt;IPropertySymbol&gt;()
                        .Where(p =&gt; p.DeclaredAccessibility == Accessibility.Public)
                        .Select(p =&gt; p.Name)
                        .ToImmutableArray();
                    return new ClassInfo(type.ContainingNamespace.ToDisplayString(), type.Name, props);
                });
        // Step 2: emit one .g.cs file per class, only re run when that class changes
        context.RegisterSourceOutput(classes, static (spc, info) =&gt;
        {
            string body = string.Join(", ", info.Properties.Select(p =&gt; $"{p} = {{{p}}}"));
            string source = $$"""
                // &lt;auto-generated/&gt;  Do not edit. Produced by AutoToStringGenerator.
                namespace {{info.Namespace}};
                partial class {{info.Name}}
                {
                    public override string ToString() =&gt; $"{{info.Name}} { {{body}} }";
                }
                """;
            spc.AddSource($"{info.Name}.AutoToString.g.cs", source);
        });
    }
}
// ---------------------------------------------------------------
// The consuming project: references the generator as an Analyzer
// &lt;ProjectReference Include="..\Demo.Generators\Demo.Generators.csproj"
//                   OutputItemType="Analyzer" ReferenceOutputAssembly="false" /&gt;
namespace Demo
{
    [AttributeUsage(AttributeTargets.Class)]
    public class AutoToStringAttribute : Attribute { }
    [AutoToString]
    public partial class Customer          // partial: the generator supplies the other half
    {
        public string Name { get; set; } = "";
        public int Age { get; set; }
    }
}
// Usage: ToString exists at compile time, no reflection at run time
var customer = new Demo.Customer { Name = "Asha", Age = 30 };
Console.WriteLine(customer);             // Customer { Name = Asha, Age = 30 }
</code></pre>
