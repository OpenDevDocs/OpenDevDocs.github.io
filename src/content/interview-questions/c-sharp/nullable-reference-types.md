---
course: c-sharp
slug: nullable-reference-types
experienceLevel: mid
difficulty: medium
tags:
  - modern-csharp
  - types
question: "What are nullable reference types, and how do they help prevent `NullReferenceException`?"
answer: |
  **Nullable reference types (NRT)**, introduced in C# 8, make nullability part of a reference type's declared intent. With the feature enabled, `string` means "never null" and `string?` means "may be null," and the compiler runs **flow analysis** to warn you when you might dereference null or assign null to a non-nullable variable.

  Enable it with `<Nullable>enable</Nullable>` in the project file, which new .NET templates already do, or per file with `#nullable enable`.

  Important details:

  - It's a **compile-time** feature. The annotations don't change runtime types, and nothing stops a null at runtime, so still validate public inputs, for example with `ArgumentNullException.ThrowIfNull`.
  - The **null-forgiving operator** `!` silences a warning when you know better than the compiler. Overusing it defeats the purpose.
  - Attributes such as `[NotNullWhen(true)]` and `[MaybeNull]` describe the null behavior of APIs like `TryGetValue`.

  To migrate an existing codebase, enable it one project or file at a time, fix warnings from the inside out, and then treat nullable warnings as errors.
codeExample: |
  #nullable enable
  string name = "Ada";            // non-nullable: never expected to be null
  string? nickname = null;        // nullable: null is a valid value

  Console.WriteLine(name.Length);             // fine
  // Console.WriteLine(nickname.Length);      // warning CS8602: possible null dereference
  Console.WriteLine(nickname?.Length ?? 0);   // Output: 0

  if (nickname is not null)
      Console.WriteLine(nickname.Length);     // no warning: flow analysis knows

  // name = null;                             // warning: null to non-nullable

  if (TryFind("ada", out string? found))
      Console.WriteLine(found.ToUpper());     // Output: ADA LOVELACE (no warning)

  static bool TryFind(string key,
      [System.Diagnostics.CodeAnalysis.NotNullWhen(true)] out string? value)
  {
      value = key == "ada" ? "Ada Lovelace" : null;
      return value is not null;
  }
popularity: 8.4
isPublished: true
---
