---
course: c-sharp
slug: hidden-boxing-and-allocations
experienceLevel: senior
difficulty: hard
tags:
  - performance
  - types
question: "Where can hidden boxing and allocations occur in C# code?"
answer: |
  Common allocations that don't look like `new`:

  - **Structs as interfaces or `object`:** passing a struct to a parameter typed `IComparable`, `object`, or `IEnumerable<T>` boxes it. Generic methods with constraints, such as `where T : IComparable<T>`, avoid the box.
  - **Missing overrides:** calling `Equals`, `GetHashCode`, or `ToString` on a struct that doesn't override them boxes it to reach the `object` implementation.
  - **Interface-typed enumeration:** `foreach` over a `List<T>` stored in an `IEnumerable<T>` variable boxes `List<T>.Enumerator`, while `foreach` over the concrete type uses the struct enumerator directly.
  - **`params object[]` APIs:** each call allocates an array and boxes value-type arguments.
  - **Closures and lambdas:** capturing locals allocates a closure object and a delegate.
  - **LINQ:** each operator allocates an iterator object.
  - **Async methods that suspend:** the state machine moves to the heap.

  Some old traps are gone. String interpolation used to box value types through `string.Format`, but C# 10's interpolated string handlers format them directly, and the JIT has optimized `Enum.HasFlag` to avoid boxing since .NET Core 2.1.

  To find the rest, use BenchmarkDotNet's `[MemoryDiagnoser]` and allocation profiling in Visual Studio or `dotnet-trace`.
codeExample: |
  using System.Collections;

  int total = 0;
  IEnumerable<int> asInterface = new List<int> { 1, 2, 3 };
  foreach (int n in asInterface) total += n;      // boxes List<int>.Enumerator

  var concrete = new List<int> { 1, 2, 3 };
  foreach (int n in concrete) total += n;         // struct enumerator: no allocation

  var point = new Point(1, 2);
  IComparable<Point> boxed = point;               // struct -> interface: boxing
  string text = point.ToString();                 // no override: boxes to call it
  var legacy = new ArrayList { point };           // non-generic collection: boxing

  Console.WriteLine(Max(point, new Point(3, 4)).X); // Output: 3 (constrained: no box)

  static T Max<T>(T a, T b) where T : IComparable<T> => a.CompareTo(b) >= 0 ? a : b;

  struct Point(int x, int y) : IComparable<Point>
  {
      public int X = x, Y = y;
      public int CompareTo(Point other) => (X + Y).CompareTo(other.X + other.Y);
  }
popularity: 7.0
isPublished: true
---
