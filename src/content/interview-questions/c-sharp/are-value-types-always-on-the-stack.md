---
course: c-sharp
slug: are-value-types-always-on-the-stack
experienceLevel: mid
difficulty: medium
tags:
  - memory
  - types
question: "Are value types always stored on the stack in C#?"
answer: |
  No, that's a myth. Where a value lives depends on **where the variable is declared**, not on whether its type is a value type.

  A value-type instance lives on the heap when it is:

  - A **field of a class**: an `int` field is stored inline inside the object, on the managed heap.
  - An **array element**: `new int[1000]` is one heap object holding all 1,000 values.
  - **Boxed**: converting it to `object` or an interface copies it into a heap object.
  - **Captured** by a lambda, or used across an `await` or `yield` in an async method or iterator: the compiler hoists it into a heap-allocated closure or state machine.

  Value-type **locals and parameters** usually do live on the stack or in CPU registers.

  The reverse isn't absolute either: recent .NET JITs can place some small objects that provably don't escape a method on the stack. Storage location is an implementation detail. What actually defines value types is **copy semantics**: assignment copies the data, and each variable holds its own value.
codeExample: |
  var order = new Order();         // the Order object lives on the heap...
  order.Quantity = 5;              // ...and its int field lives inside it

  int[] numbers = new int[1_000];  // one heap object holding 1,000 ints

  int local = 42;                  // a local: typically on the stack (or a register)
  object boxed = local;            // boxing copies the value into a heap object

  int counter = 0;
  Action increment = () => counter++;  // captured: hoisted into a heap closure
  increment();
  Console.WriteLine(counter);      // Output: 1

  var p1 = new Point(1, 2);
  var p2 = p1;                     // what really matters: copy semantics
  p2.X = 10;
  Console.WriteLine(p1.X);         // Output: 1

  class Order { public int Quantity; }
  struct Point(int x, int y) { public int X = x; public int Y = y; }
popularity: 7.9
isPublished: true
---
