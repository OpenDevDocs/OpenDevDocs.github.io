---
publishDate: 2026-04-29T11:52
title: Roslyn Compiler Platform
slug: roslyn-compiler-platform
metadescription: Explore Roslyn, the open source C# compiler with a public API, parse code into syntax trees, query the semantic model, write a custom analyzer and code fix, and script C# at run time.
updateDate: 2026-09-05T11:52
author: ['bishal-biswas']
level: 4
tags: ['roslyn', 'compiler', 'tooling']
course: c-sharp
---

## A compiler you can call

Most compilers are black boxes: source goes in, binary comes out. **Roslyn** is the C# and Visual Basic compiler rewritten in C# with every stage exposed as a library. You can parse code into a tree, ask what type an expression has, rewrite code, report diagnostics and compile in memory, all from your own program.

This is what powers IntelliSense, refactorings, analyzers, code fixes, `dotnet format`, source generators and the C# scripting engine. Understanding Roslyn is understanding how the tooling around you works, and it lets you build your own.

## The pipeline

1. **Parsing**: text becomes a **syntax tree**, a full representation of the code including whitespace and comments.
2. **Binding**: the **semantic model** resolves names to symbols, works out types and checks rules.
3. **Emit**: IL is generated into an assembly.

Analyzers plug in after binding. Source generators plug in before emit. You can stop at any stage.

## Getting started

```bash
dotnet add package Microsoft.CodeAnalysis.CSharp
```

## Syntax trees

Parse a snippet and walk it:

```csharp
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

string code = """
    class Greeter
    {
        public string Greet(string name) => $"Hello {name}";
        private int count;
    }
    """;

SyntaxTree tree = CSharpSyntaxTree.ParseText(code);
CompilationUnitSyntax root = tree.GetCompilationUnitRoot();

foreach (var cls in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
{
    Console.WriteLine($"class {cls.Identifier}");

    foreach (var method in cls.Members.OfType<MethodDeclarationSyntax>())
    {
        Console.WriteLine($"  method {method.Identifier} returns {method.ReturnType}");
    }
}
// class Greeter
//   method Greet returns string
```

Every construct is a node type: `ClassDeclarationSyntax`, `MethodDeclarationSyntax`, `InvocationExpressionSyntax` and hundreds more. `DescendantNodes()` flattens the tree so LINQ can query it.

Syntax trees are **immutable** and **round trippable**. `root.ToFullString()` gives back the exact original text, whitespace included. That is what makes safe refactoring possible.

## Syntax errors

A tree is produced even for broken code, with error nodes and diagnostics:

```csharp
var broken = CSharpSyntaxTree.ParseText("class { int x = ; }");

foreach (var d in broken.GetDiagnostics())
{
    Console.WriteLine(d);   // (1,7): error CS1001: Identifier expected ...
}
```

Editors rely on this to keep colouring and completion working while you type.

## The semantic model

Syntax tells you a token says `name`. Semantics tells you it is a parameter of type `string`. Create a compilation with references, then ask:

```csharp
var compilation = CSharpCompilation.Create("Demo")
    .AddReferences(MetadataReference.CreateFromFile(typeof(object).Assembly.Location))
    .AddSyntaxTrees(tree);

SemanticModel model = compilation.GetSemanticModel(tree);

var method = root.DescendantNodes().OfType<MethodDeclarationSyntax>().First();
IMethodSymbol symbol = model.GetDeclaredSymbol(method)!;

Console.WriteLine(symbol.ReturnType);                 // string
Console.WriteLine(symbol.Parameters[0].Type);         // string
Console.WriteLine(symbol.DeclaredAccessibility);      // Public
Console.WriteLine(symbol.ContainingType.Name);        // Greeter

var interpolation = root.DescendantNodes().OfType<InterpolatedStringExpressionSyntax>().First();
TypeInfo info = model.GetTypeInfo(interpolation);
Console.WriteLine(info.Type);                         // string
```

**Symbols** are the semantic objects: `INamedTypeSymbol`, `IMethodSymbol`, `IPropertySymbol`, `ILocalSymbol`. They know about inheritance, overloads, attributes and everything else the compiler knows.

## Compiling and running in memory

```csharp
using System.Reflection;

var program = CSharpSyntaxTree.ParseText("""
    public static class Calc
    {
        public static int Add(int a, int b) => a + b;
    }
    """);

var comp = CSharpCompilation.Create("Dynamic",
    new[] { program },
    new[] { MetadataReference.CreateFromFile(typeof(object).Assembly.Location) },
    new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));

using var ms = new MemoryStream();
var result = comp.Emit(ms);

if (!result.Success)
{
    foreach (var d in result.Diagnostics) Console.WriteLine(d);
    return;
}

Assembly asm = Assembly.Load(ms.ToArray());
var add = asm.GetType("Calc")!.GetMethod("Add")!;
Console.WriteLine(add.Invoke(null, new object[] { 2, 3 }));   // 5
```

Rules engines, plugin systems and online code runners are built this way.

## Scripting

`Microsoft.CodeAnalysis.CSharp.Scripting` runs C# snippets directly, with globals you supply:

```csharp
using Microsoft.CodeAnalysis.CSharp.Scripting;

public class Globals { public int X; public int Y; }

int result = await CSharpScript.EvaluateAsync<int>("X * Y + 1", globals: new Globals { X = 6, Y = 7 });
Console.WriteLine(result);   // 43
```

This is the engine behind `dotnet-script` and the C# Interactive window.

## Analyzers

An **analyzer** inspects code as it compiles and reports diagnostics. Everything that shows as a squiggle from a NuGet package is one. Here is the skeleton of an analyzer that flags methods named with a lowercase letter:

```csharp
using System.Collections.Immutable;
using Microsoft.CodeAnalysis.Diagnostics;

[DiagnosticAnalyzer(LanguageNames.CSharp)]
public class MethodNameAnalyzer : DiagnosticAnalyzer
{
    public static readonly DiagnosticDescriptor Rule = new(
        id: "DEMO001",
        title: "Method names should be PascalCase",
        messageFormat: "Method '{0}' should start with an uppercase letter",
        category: "Naming",
        defaultSeverity: DiagnosticSeverity.Warning,
        isEnabledByDefault: true);

    public override ImmutableArray<DiagnosticDescriptor> SupportedDiagnostics => ImmutableArray.Create(Rule);

    public override void Initialize(AnalysisContext context)
    {
        context.EnableConcurrentExecution();
        context.ConfigureGeneratedCodeAnalysis(GeneratedCodeAnalysisFlags.None);
        context.RegisterSymbolAction(Analyze, SymbolKind.Method);
    }

    private static void Analyze(SymbolAnalysisContext context)
    {
        var method = (IMethodSymbol)context.Symbol;
        if (char.IsLower(method.Name[0]))
        {
            context.ReportDiagnostic(Diagnostic.CreateDiagnostic(Rule, method.Locations[0], method.Name));
        }
    }
}
```

An analyzer lives in its own project targeting `netstandard2.0` and is delivered as a NuGet package or referenced with `<Analyzer Include="..."/>`. Once referenced, the warning appears in the editor and in `dotnet build`, and `.editorconfig` can raise it to an error or silence it per project.

## Code fixes

A **code fix provider** pairs with an analyzer to offer the lightbulb action. It receives the diagnostic, builds a new syntax tree with `SyntaxFactory` or `ReplaceNode`, and returns the modified document. Because trees are immutable, the fix is a pure transformation the IDE can preview before applying.

## Where this leads

- **Source generators**, the next topic, use the same syntax and semantic APIs to write code at compile time.
- **dotnet format** and **EditorConfig** enforcement are analyzers and fixers.
- **Entity Framework** and **ASP.NET** ship analyzers that catch misuse of their APIs.
- **Unit tests for analyzers** use `Microsoft.CodeAnalysis.Testing` to assert diagnostics on sample code.

You may never write an analyzer, but knowing that every squiggle is a small C# program running on a syntax tree demystifies the whole toolchain.

## Quick recap

- Roslyn is the C# compiler as a library: parse, bind, analyze and emit from your own code.
- Syntax trees are immutable, complete and round trippable, and LINQ queries them.
- The semantic model turns syntax into symbols with types, accessibility and relationships.
- You can compile to memory and run the result, or evaluate scripts with globals.
- Analyzers report diagnostics during compilation, and code fixes rewrite trees to resolve them.
- Editors, formatters, framework warnings and source generators are all built on this API.

<code id="code-content" class="language-csharp">
// Roslyn compiler platform
// dotnet add package Microsoft.CodeAnalysis.CSharp
using System.Reflection;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
string code = """
    public static class Greeter
    {
        public static string Greet(string name) =&gt; $"Hello {name}";
        public static int add(int a, int b) =&gt; a + b;
    }
    """;
// 1. Parse into a syntax tree and query it with LINQ
SyntaxTree tree = CSharpSyntaxTree.ParseText(code);
var root = tree.GetCompilationUnitRoot();
foreach (var m in root.DescendantNodes().OfType&lt;MethodDeclarationSyntax&gt;())
{
    string note = char.IsLower(m.Identifier.Text[0]) ? "  &lt;- not PascalCase" : "";
    Console.WriteLine($"method {m.Identifier} returns {m.ReturnType}{note}");
}
// 2. Build a compilation and ask the semantic model about symbols
var compilation = CSharpCompilation.Create("Demo",
    new[] { tree },
    new[] { MetadataReference.CreateFromFile(typeof(object).Assembly.Location),
            MetadataReference.CreateFromFile(Assembly.Load("System.Runtime").Location) },
    new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
SemanticModel model = compilation.GetSemanticModel(tree);
var greet = root.DescendantNodes().OfType&lt;MethodDeclarationSyntax&gt;().First();
IMethodSymbol symbol = model.GetDeclaredSymbol(greet)!;
Console.WriteLine($"{symbol.ContainingType.Name}.{symbol.Name}: {symbol.Parameters[0].Type} -&gt; {symbol.ReturnType}");
var interpolated = root.DescendantNodes().OfType&lt;InterpolatedStringExpressionSyntax&gt;().First();
Console.WriteLine($"interpolation has type {model.GetTypeInfo(interpolated).Type}");
// 3. Report compile errors from broken code without crashing
var broken = CSharpSyntaxTree.ParseText("class { int x = ; }");
foreach (var d in broken.GetDiagnostics().Take(2))
    Console.WriteLine(d.GetMessage());
// 4. Emit to memory, load and run the compiled code
using var ms = new MemoryStream();
EmitResult result = compilation.Emit(ms);
if (result.Success)
{
    Assembly asm = Assembly.Load(ms.ToArray());
    var type = asm.GetType("Greeter")!;
    Console.WriteLine(type.GetMethod("Greet")!.Invoke(null, new object[] { "Roslyn" }));   // Hello Roslyn
    Console.WriteLine(type.GetMethod("add")!.Invoke(null, new object[] { 2, 3 }));         // 5
}
else
{
    foreach (var d in result.Diagnostics) Console.WriteLine(d);
}
// 5. Rewrite the tree: rename the badly cased method, original text is untouched
var badMethod = root.DescendantNodes().OfType&lt;MethodDeclarationSyntax&gt;().First(m =&gt; m.Identifier.Text == "add");
var fixedRoot = root.ReplaceNode(badMethod, badMethod.WithIdentifier(SyntaxFactory.Identifier("Add")));
Console.WriteLine(fixedRoot.ToFullString().Contains("int Add("));   // True
</code></pre>
