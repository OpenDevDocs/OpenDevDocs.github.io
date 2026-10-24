---
course: c-sharp
slug: ref-structs
experienceLevel: senior
difficulty: hard
tags:
  - memory
  - types
question: "What is a `ref struct` in C#, and why does it have so many restrictions?"
answer: |
  A `ref struct` is a struct that is guaranteed to **live only on the stack**. The guarantee exists so the type can safely hold **references to memory that might itself be on the stack**, which is exactly what `Span<T>` and `Utf8JsonReader` do. If a span could escape to the heap, it could outlive the stack frame it points into and become a dangling reference.

  To keep that guarantee, a ref struct:

  - Can't be **boxed** or converted to `object` or an interface type.
  - Can't be a **field of a class** or of a regular struct, only of another ref struct.
  - Can't be **captured** by lambdas, or used as an array element type.
  - Can't live **across an `await` or `yield`**, although since C# 13 ref struct locals are allowed in async methods and iterators between those points.

  C# 13 also relaxed two long-standing limits: ref structs can **implement interfaces** (though they still can't be converted to them), and generic code can accept them through the **`allows ref struct`** anti-constraint.

  C# 11 added **ref fields**, so your own ref structs can hold references like `Span<T>` does, plus the `scoped` keyword to limit how far a reference may escape.
codeExample: |
  var reader = new CsvFieldReader("id,name,price".AsSpan());
  while (reader.TryReadNext(out ReadOnlySpan<char> field))
      Console.Write($"[{field}] ");          // Output: [id] [name] [price]

  // object boxed = reader;                 // compile error: can't box a ref struct
  // Func<int> f = () => reader.Position;   // compile error: can't capture it
  // class Holder { CsvFieldReader r; }     // compile error: not a field of a class

  public ref struct CsvFieldReader
  {
      private ReadOnlySpan<char> _remaining;          // a span field: only in ref structs
      public CsvFieldReader(ReadOnlySpan<char> text) => _remaining = text;
      public int Position { get; private set; }

      public bool TryReadNext(out ReadOnlySpan<char> field)
      {
          if (_remaining.IsEmpty) { field = default; return false; }
          int comma = _remaining.IndexOf(',');
          field = comma < 0 ? _remaining : _remaining[..comma];
          _remaining = comma < 0 ? default : _remaining[(comma + 1)..];
          Position++;
          return true;
      }
  }
popularity: 7.4
isPublished: true
---
