---
course: c-sharp
slug: struct-vs-class
experienceLevel: fresher
difficulty: easy
tags:
  - types
  - oop
question: "What is the difference between a `struct` and a `class` in C#?"
answer: |
  The core difference is **value vs reference semantics**. A `struct` is a value type, so assigning it or passing it to a method copies the whole value. A `class` is a reference type, so assignment copies a reference and both variables share one object.

  Other differences:

  - Structs can't inherit from another struct or class (they can implement interfaces), and they're implicitly sealed.
  - A struct variable can't be `null` unless declared nullable, as in `Money?`.
  - Casting a struct to `object` or an interface **boxes** it, which allocates.
  - Since C# 10, a struct can declare an explicit parameterless constructor.

  Choose a struct for small, immutable values representing a single concept, like `Point`, `DateTime`, or `Money`. A common rule of thumb is 16 bytes or less, and `readonly struct` makes the immutability explicit. Use a class for larger objects, things with identity, or anything that needs inheritance.
codeExample: |
  Money price = new(19.99m, "USD");
  Money copy = price;                  // full copy of the value
  Console.WriteLine(copy.Amount);      // Output: 19.99

  Money empty = default;               // default struct: all fields zeroed
  Console.WriteLine(empty.Currency is null); // Output: True

  object boxed = price;                // boxing: copies the struct to the heap
  Console.WriteLine(boxed is Money);   // Output: True

  Customer c1 = new("Ada");
  Customer c2 = c1;                    // copies only the reference
  c2.Name = "Grace";
  Console.WriteLine(c1.Name);          // Output: Grace (same object)
  // Money none = null;                // compile error: a struct can't be null

  public readonly struct Money(decimal amount, string currency)
  {
      public decimal Amount { get; } = amount;
      public string Currency { get; } = currency;
  }

  public class Customer(string name) { public string Name { get; set; } = name; }
popularity: 9.2
isPublished: true
---
