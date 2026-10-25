---
publishDate: 2026-04-23T11:42
title: Attributes
slug: attributes
metadescription: Attach metadata to code with attributes, use the built in ones like Obsolete, Flags and caller info, write custom attributes, read them with reflection and build a tiny validation framework.
updateDate: 2026-09-05T11:42
author: ['bishal-biswas']
level: 3
tags: ['attributes', 'metadata', 'reflection']
course: c-sharp
---

## Metadata on your code

An **attribute** is a note attached to a class, method, property, parameter or assembly. It does nothing by itself. It sits in the compiled metadata waiting for something, the compiler, the runtime or your own code via reflection, to read it and act.

```csharp
[Obsolete("Use CalculateTotalV2 instead")]
public decimal CalculateTotal() => 0;
```

Square brackets before a declaration apply the attribute. Here the compiler reads it and warns anyone who calls the method.

## Built in attributes you will meet

### Obsolete

```csharp
[Obsolete("Use NewMethod")]            // warning
[Obsolete("Removed in v3", error: true)]   // compile error
```

### Flags

Lets an enum represent a combination of values with bitwise operators:

```csharp
[Flags]
enum Permissions
{
    None = 0,
    Read = 1,
    Write = 2,
    Delete = 4
}

var p = Permissions.Read | Permissions.Write;
Console.WriteLine(p);                              // Read, Write
Console.WriteLine(p.HasFlag(Permissions.Write));   // True
```

Without `[Flags]`, the `ToString` would print `3`.

### Conditional

The compiler removes calls to the method unless the symbol is defined:

```csharp
[Conditional("DEBUG")]
static void Trace(string msg) => Console.WriteLine(msg);

Trace("only in debug builds");   // vanishes entirely in release
```

### Caller information

The compiler fills these parameters in at the call site. Perfect for logging:

```csharp
static void Log(string message,
    [CallerMemberName] string member = "",
    [CallerFilePath] string file = "",
    [CallerLineNumber] int line = 0)
{
    Console.WriteLine($"{Path.GetFileName(file)}:{line} {member}: {message}");
}

Log("Starting");   // Program.cs:12 <Main>$: Starting
```

### Serialisation and validation

Libraries define their own. You will see these constantly:

```csharp
using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;

class User
{
    [JsonPropertyName("user_name")]
    [Required, StringLength(50)]
    public string Name { get; set; } = "";

    [JsonIgnore]
    public string Password { get; set; } = "";

    [Range(0, 150)]
    public int Age { get; set; }
}
```

`System.Text.Json` reads the first group to shape the output. ASP.NET Core reads the validation ones to reject bad requests.

## Attribute syntax details

- The `Attribute` suffix is optional: `[Obsolete]` is `ObsoleteAttribute`.
- Positional arguments go to the constructor, named arguments set properties: `[Obsolete("msg", error: true)]`.
- Several attributes can stack or share brackets: `[Required, StringLength(50)]`.
- Arguments must be compile time constants: literals, `typeof(...)`, enums, or arrays of those.

Targets can be made explicit when it is ambiguous:

```csharp
[return: NotNull]
static string Build() => "";

[assembly: InternalsVisibleTo("MyApp.Tests")]
```

## Writing a custom attribute

Inherit from `Attribute` and declare where it may be used:

```csharp
[AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
class MaxLengthAttribute : Attribute
{
    public int Length { get; }
    public string? Message { get; set; }

    public MaxLengthAttribute(int length)
    {
        Length = length;
    }
}

class Product
{
    [MaxLength(20, Message = "Name is too long")]
    public string Name { get; set; } = "";

    [MaxLength(200)]
    public string Description { get; set; } = "";
}
```

`AttributeUsage` restricts where the attribute is allowed. Putting `[MaxLength]` on a method would now be a compile error.

## Reading attributes with reflection

This is where the attribute comes alive:

```csharp
using System.Reflection;

static List<string> Validate(object obj)
{
    var errors = new List<string>();

    foreach (PropertyInfo prop in obj.GetType().GetProperties())
    {
        var rule = prop.GetCustomAttribute<MaxLengthAttribute>();
        if (rule is null) continue;

        if (prop.GetValue(obj) is string s && s.Length > rule.Length)
        {
            errors.Add(rule.Message ?? $"{prop.Name} exceeds {rule.Length} characters");
        }
    }

    return errors;
}

var product = new Product { Name = "A very long product name indeed" };
foreach (string e in Validate(product)) Console.WriteLine(e);
// Name is too long
```

Twenty lines and you have a validation framework. Add more attribute types and the `Validate` method never changes, only the rules do.

## Marker attributes

An attribute with no data still carries meaning. Test frameworks are built on this:

```csharp
[AttributeUsage(AttributeTargets.Method)]
class TestAttribute : Attribute { }

class MathTests
{
    [Test] public void AddsNumbers() => Console.WriteLine(2 + 2 == 4 ? "pass" : "FAIL");
    [Test] public void Divides() => Console.WriteLine(10 / 2 == 5 ? "pass" : "FAIL");
    public void Helper() { }
}

var tests = typeof(MathTests).GetMethods()
    .Where(m => m.GetCustomAttribute<TestAttribute>() != null);

var instance = new MathTests();
foreach (var test in tests)
{
    Console.Write($"{test.Name}: ");
    test.Invoke(instance, null);
}
```

That is the core of xUnit and NUnit in fifteen lines.

## Attributes and source generators

Reflection reads attributes at run time. **Source generators**, covered later, read them at compile time and emit code, which is faster and works with trimming. Modern frameworks are moving that way, but the attribute side looks identical to the user.

## Quick recap

- Attributes attach metadata to code and do nothing until something reads them.
- `Obsolete`, `Flags`, `Conditional` and caller info attributes are read by the compiler.
- Serialisation and validation libraries define attributes read at run time.
- Create your own by inheriting `Attribute` and restricting targets with `AttributeUsage`.
- Read them with `GetCustomAttribute<T>` on a type, property or method.
- Marker attributes plus reflection are how test runners and plugin systems discover code.

<code id="code-content" class="language-csharp">
// Attributes in C#
using System.Reflection;
using System.Runtime.CompilerServices;
// A custom attribute restricted to properties
[AttributeUsage(AttributeTargets.Property)]
class MaxLengthAttribute : Attribute
{
    public int Length { get; }
    public string? Message { get; set; }
    public MaxLengthAttribute(int length) =&gt; Length = length;
}
// A marker attribute for discovering methods
[AttributeUsage(AttributeTargets.Method)]
class TestAttribute : Attribute { }
class Product
{
    [MaxLength(10, Message = "Name is too long")]
    public string Name { get; set; } = "";
    [MaxLength(50)]
    public string Description { get; set; } = "";
}
// A tiny validation framework driven by attributes
static List&lt;string&gt; Validate(object obj)
{
    var errors = new List&lt;string&gt;();
    foreach (PropertyInfo prop in obj.GetType().GetProperties())
    {
        var rule = prop.GetCustomAttribute&lt;MaxLengthAttribute&gt;();
        if (rule is null) continue;
        if (prop.GetValue(obj) is string s &amp;&amp; s.Length &gt; rule.Length)
            errors.Add(rule.Message ?? $"{prop.Name} exceeds {rule.Length} characters");
    }
    return errors;
}
var product = new Product { Name = "Mechanical keyboard", Description = "Short" };
foreach (string e in Validate(product)) Console.WriteLine(e);   // Name is too long
// A tiny test runner driven by a marker attribute
class MathTests
{
    [Test] public void Adds() =&gt; Console.WriteLine(2 + 2 == 4 ? "  pass" : "  FAIL");
    [Test] public void Divides() =&gt; Console.WriteLine(10 / 2 == 5 ? "  pass" : "  FAIL");
    public void NotATest() { }
}
var runner = new MathTests();
foreach (var m in typeof(MathTests).GetMethods().Where(m =&gt; m.GetCustomAttribute&lt;TestAttribute&gt;() != null))
{
    Console.WriteLine(m.Name);
    m.Invoke(runner, null);
}
// Built in: Flags enums and caller info
[Flags] enum Permissions { None = 0, Read = 1, Write = 2, Delete = 4 }
var perms = Permissions.Read | Permissions.Write;
Console.WriteLine($"{perms}, can delete: {perms.HasFlag(Permissions.Delete)}");
static void Log(string msg, [CallerMemberName] string member = "", [CallerLineNumber] int line = 0)
    =&gt; Console.WriteLine($"[{member}:{line}] {msg}");
Log("caller info filled in by the compiler");
</code></pre>
