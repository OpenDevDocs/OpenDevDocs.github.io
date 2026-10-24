---
course: c-sharp
slug: shallow-copy-vs-deep-copy
experienceLevel: mid
difficulty: medium
tags:
  - types
  - oop
question: "What is the difference between a shallow copy and a deep copy in C#?"
answer: |
  A **shallow copy** creates a new object and copies each field's value. For value-type fields that's a real copy, but for reference-type fields only the **reference** is copied, so the original and the copy share the same nested objects. Changing a shared list through one object shows up in the other.

  A **deep copy** duplicates the entire object graph, so the copy shares nothing mutable with the original.

  Ways to copy in C#:

  - `MemberwiseClone()`, a protected method on `object`, makes a shallow copy.
  - Record `with` expressions are shallow too: `order with { Id = 2 }` still shares the original's `Lines` list.
  - For deep copies, write copy constructors or a `DeepClone()` method that clones nested objects explicitly. A serialization round-trip, for example with `System.Text.Json`, also works, but it's slower and copies only what the serializer sees.

  Avoid `ICloneable` in public APIs, because it doesn't say whether `Clone()` is deep or shallow. Immutable types sidestep the problem entirely, since sharing unchangeable data is safe.
codeExample: |
  var original = new Order(1, ["Book"]);

  var shallow = original with { Id = 2 };      // copies the reference to Lines
  shallow.Lines.Add("Pen");
  Console.WriteLine(original.Lines.Count);     // Output: 2 (shared list!)

  var deep = original.DeepClone();             // new list with the same items
  deep.Lines.Add("Lamp");
  Console.WriteLine(original.Lines.Count);     // Output: 2 (unaffected)
  Console.WriteLine(deep.Lines.Count);         // Output: 3

  public record Order(int Id, List<string> Lines)
  {
      public Order DeepClone() => this with { Lines = [.. Lines] };
  }
popularity: 7.8
isPublished: true
---
