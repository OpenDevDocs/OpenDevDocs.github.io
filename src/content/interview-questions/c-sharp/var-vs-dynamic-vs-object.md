---
course: c-sharp
slug: var-vs-dynamic-vs-object
experienceLevel: fresher
difficulty: medium
tags:
  - types
question: "What is the difference between `var`, `dynamic`, and `object`?"
answer: |
  All three can appear to hold "anything", but they differ in when type checking happens.

  - `var` is **compile-time type inference**. The compiler takes the type from the initializer, so `var x = 5;` is exactly `int x = 5;`. It must be initialized and only works for local variables.
  - `object` is the **base type** of every type. It can store any value, but you need a cast to use the real type's members, and value types get boxed.
  - `dynamic` **skips compile-time checks**. Members are resolved at runtime by the Dynamic Language Runtime (DLR), so a typo compiles fine but throws `RuntimeBinderException` when it runs.

  Use `var` freely when the type is obvious. Use `object` only when something truly accepts any type, and prefer generics when you can. Use `dynamic` sparingly, mainly for COM interop or loosely typed data, because it gives up IntelliSense and compile-time safety.
codeExample: |
  var count = 10;              // inferred as int at compile time
  // count = "ten";            // compile error: count is an int

  object boxed = 10;           // any type fits, but the int is boxed
  // int bad = boxed + 1;      // compile error: object has no + operator
  int unboxed = (int)boxed + 1; // cast required

  dynamic dyn = 10;            // type checks move to runtime
  dyn = "ten";                 // allowed: any type, any time
  Console.WriteLine(dyn.Length); // Output: 3 (resolved at runtime)

  try
  {
      Console.WriteLine(dyn.Lenght); // typo compiles fine...
  }
  catch (Microsoft.CSharp.RuntimeBinder.RuntimeBinderException ex)
  {
      Console.WriteLine(ex.Message); // ...but fails when it runs
      // Output: 'string' does not contain a definition for 'Lenght'
  }
popularity: 8.7
isPublished: true
---
