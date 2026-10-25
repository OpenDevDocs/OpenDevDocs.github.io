---
course: c-sharp
slug: enums-in-csharp
experienceLevel: fresher
difficulty: easy
tags:
  - types
question: "What is an `enum` in C#, and how do you use it?"
answer: |
  An `enum` is a value type that defines a set of **named constants**, which makes code more readable than magic numbers: `OrderStatus.Shipped` instead of `2`.

  Key facts:

  - Each member is backed by an integral type, `int` by default. Values start at 0 and increase by 1 unless you assign them explicitly.
  - You can cast between an enum and its underlying number, but nothing checks the result: `(OrderStatus)99` compiles and runs. Validate untrusted input with `Enum.IsDefined`.
  - `ToString()` returns the member name, and `Enum.Parse` or `Enum.TryParse` converts text back to a value.
  - Enums work naturally with `switch` statements and expressions.

  Add the `[Flags]` attribute when members represent combinable options, such as file permissions. Give members power-of-two values, combine them with `|`, and test them with `HasFlag` or `&`.
codeExample: |
  var status = OrderStatus.Shipped;
  Console.WriteLine(status);             // Output: Shipped
  Console.WriteLine((int)status);        // Output: 2

  var unknown = (OrderStatus)99;         // no error, even though 99 isn't defined
  Console.WriteLine(Enum.IsDefined(unknown));            // Output: False

  if (Enum.TryParse("Delivered", out OrderStatus parsed))
      Console.WriteLine(parsed == OrderStatus.Delivered); // Output: True

  var access = Permissions.Read | Permissions.Write;
  Console.WriteLine(access);                             // Output: Read, Write
  Console.WriteLine(access.HasFlag(Permissions.Write));  // Output: True

  enum OrderStatus { Pending, Paid, Shipped, Delivered } // 0, 1, 2, 3

  [Flags]
  enum Permissions
  {
      None = 0,
      Read = 1,
      Write = 2,
      Execute = 4
  }
popularity: 7.4
isPublished: true
---
