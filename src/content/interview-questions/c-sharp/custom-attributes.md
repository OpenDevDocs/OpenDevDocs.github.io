---
course: c-sharp
slug: custom-attributes
experienceLevel: mid
difficulty: medium
tags:
  - reflection
question: "What are attributes in C#, and how do you create and read a custom attribute?"
answer: |
  **Attributes** attach declarative metadata to code elements such as assemblies, types, methods, properties, and parameters. The compiler stores them in the assembly's metadata, and they do nothing on their own: something has to read them, whether that's the compiler, the runtime, a framework, or your own reflection code.

  Familiar examples include `[Obsolete]` (the compiler warns callers), `[Required]` and `[Range]` (validation), `[JsonPropertyName]` (serialization), and `[HttpGet]` (ASP.NET Core routing).

  To create one:

  1. Derive a class from `System.Attribute`, conventionally named with an `Attribute` suffix that you can omit when applying it: `[Audit]` for `AuditAttribute`.
  2. Add `[AttributeUsage]` to control the valid targets, whether it can be applied more than once (`AllowMultiple`), and whether derived classes inherit it (`Inherited`).
  3. Put configuration in constructor parameters and properties. Arguments must be compile-time constants: numbers, strings, enums, or `typeof(...)` expressions.

  Read it at runtime with `GetCustomAttribute<T>()` on a `Type`, `MethodInfo`, or `PropertyInfo`. Since C# 11, attributes can also be generic, as in `[Validator<EmailRule>]`.
codeExample: |
  using System.Reflection;

  foreach (var method in typeof(OrderService).GetMethods())
  {
      var audit = method.GetCustomAttribute<AuditAttribute>();
      if (audit is not null)
          Console.WriteLine($"{method.Name}: audited as '{audit.Category}'");
  }
  // Output: Cancel: audited as 'Orders'

  [AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
  public sealed class AuditAttribute(string category) : Attribute
  {
      public string Category { get; } = category;
      public bool IncludePayload { get; set; }        // optional named argument
  }

  public class OrderService
  {
      [Audit("Orders", IncludePayload = true)]         // the "Attribute" suffix is optional
      public void Cancel(int orderId) { }

      public void Get(int orderId) { }                 // no attribute: not audited
  }
popularity: 7.5
isPublished: true
---
