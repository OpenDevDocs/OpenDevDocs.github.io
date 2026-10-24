---
course: c-sharp
slug: fields-vs-properties
experienceLevel: fresher
difficulty: easy
tags:
  - oop
question: "What is the difference between a field and a property in C#?"
answer: |
  A **field** is a variable that stores data directly in a class or struct. A **property** exposes data through `get` and `set` accessors, which are really methods, so the type controls how the value is read and written.

  - Auto-properties like `public string Name { get; set; }` get a compiler-generated backing field.
  - A setter can validate values before storing them.
  - A computed property derives its value, such as `Area => Width * Height`.
  - `private set` blocks outside writes, and `init` allows assignment only during object initialization.

  Keep fields `private` and expose properties publicly. Data binding and serializers such as `System.Text.Json` work with properties by default, and changing a public field into a property later is a binary-breaking change, so consumers must recompile.

  C# 14's `field` keyword lets an accessor use the compiler-generated backing field without declaring one.
codeExample: |
  public class Product
  {
      private decimal _price;                        // field: raw storage

      public string Name { get; set; } = "";         // auto-property
      public int Id { get; private set; }            // read-only to callers
      public DateTime CreatedAt { get; init; }       // settable only on creation

      public decimal Price                           // validates in the setter
      {
          get => _price;
          set => _price = value >= 0 ? value
              : throw new ArgumentOutOfRangeException(nameof(value));
      }

      public decimal PriceWithTax => Price * 1.2m;   // computed property

      public string Sku                              // C# 14: field keyword
      {
          get;
          set => field = value.Trim().ToUpperInvariant();
      } = "";
  }
popularity: 8.4
isPublished: true
---
