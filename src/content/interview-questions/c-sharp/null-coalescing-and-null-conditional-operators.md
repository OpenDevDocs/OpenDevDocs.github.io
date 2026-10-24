---
course: c-sharp
slug: null-coalescing-and-null-conditional-operators
experienceLevel: fresher
difficulty: easy
tags:
  - basics
  - types
question: "What do the `??`, `??=`, and `?.` operators do in C#?"
answer: |
  They are shortcuts for handling `null` without writing `if` checks.

  - `??` (**null-coalescing**) returns the left operand if it isn't `null`, otherwise the right one: `name ?? "Guest"`. The right side is evaluated only when needed.
  - `??=` (**null-coalescing assignment**, C# 8) assigns the right side only if the variable is currently `null`: `cache ??= LoadCache();`.
  - `?.` and `?[]` (**null-conditional**) access a member or element only when the object isn't `null`. Otherwise the whole chain short-circuits to `null`: `order?.Customer?.Name`.

  They combine naturally: `customer?.Name ?? "Unknown"` reads a name safely and supplies a default.

  Because a null-conditional expression can produce `null`, reading a value-type member through it gives a nullable type: `list?.Count` is `int?`, not `int`.

  C# 14 adds **null-conditional assignment**: `customer?.Name = "Ada";` assigns only when `customer` isn't `null`.
codeExample: |
  Customer? customer = null;

  string name = customer?.Name ?? "Guest"; // safe read plus a default
  Console.WriteLine(name);                 // Output: Guest

  int? length = customer?.Name.Length;     // value-type member becomes int?
  Console.WriteLine(length is null);       // Output: True

  customer ??= new Customer { Name = "Ada" }; // assigned: it was null
  customer ??= new Customer { Name = "Bob" }; // ignored: already set
  Console.WriteLine(customer.Name);        // Output: Ada

  string[]? tags = null;
  Console.WriteLine(tags?[0] ?? "no tags"); // Output: no tags

  Customer? missing = null;
  missing?.Name = "Zoe";                   // C# 14: skipped because it's null

  class Customer
  {
      public string Name { get; set; } = "";
  }
popularity: 8.2
isPublished: true
---
