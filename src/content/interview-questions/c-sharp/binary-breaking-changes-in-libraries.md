---
course: c-sharp
slug: binary-breaking-changes-in-libraries
experienceLevel: senior
difficulty: hard
tags:
  - clr
  - design
question: "Which changes to a public .NET library are binary-breaking or source-breaking?"
answer: |
  A **binary-breaking** change breaks code that was compiled against the old version and isn't recompiled: it fails at runtime, typically with `MissingMethodException` or `TypeLoadException`. A **source-breaking** change breaks consumers only when they recompile. Common binary-breaking changes:

  - Removing or renaming a public type or member, or changing a parameter or return type.
  - **Adding a parameter to an existing method, even an optional one.** The signature changes, so old callers can't find it. Add a new overload instead.
  - Changing a **field to a property**, or the reverse, because the IL for accessing each is different.
  - Changing a `class` to a `struct`, or the reverse.
  - Adding an `abstract` member to a public abstract class, or a member without a default implementation to a public interface.

  **Silent** breaks are worse: `const` values and **default parameter values** are baked into the caller's IL at compile time, so changing them has no effect until consumers recompile.

  Common source-only breaks include renaming a parameter, which breaks named arguments, and adding an overload that makes existing calls ambiguous.

  Enable **package validation** (`<EnablePackageValidation>true</EnablePackageValidation>`), to check compatibility against a baseline version. Follow SemVer, and deprecate with `[Obsolete]` for a version before removing anything.
codeExample: |
  // v1.0 of a library
  public static class Pricing
  {
      public const decimal VatRate = 0.20m;              // baked into callers' IL
      public static decimal Total(decimal net) => net * (1 + VatRate);
  }
  // v2.0: each change below breaks consumers compiled against v1.0
  public static class PricingV2
  {
      public const decimal VatRate = 0.21m;              // silent: old callers keep 0.20
      public static decimal Total(decimal net, bool round = false) =>   // binary break:
          round ? decimal.Round(net * (1 + VatRate), 2)    // Total(decimal) is gone
                : net * (1 + VatRate);
  }

  // A non-breaking v2.0: keep the old signature and add an overload
  public static class PricingSafe
  {
      public static readonly decimal VatRate = 0.21m;    // read at runtime, not baked in
      public static decimal Total(decimal net) => Total(net, round: false);
      public static decimal Total(decimal net, bool round) =>
          round ? decimal.Round(net * (1 + VatRate), 2) : net * (1 + VatRate);
  }

  // In the .csproj: <EnablePackageValidation>true</EnablePackageValidation>
popularity: 6.8
isPublished: true
---
