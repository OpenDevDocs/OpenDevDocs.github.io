---
course: c-sharp
slug: equals-and-gethashcode-contract
experienceLevel: mid
difficulty: medium
tags:
  - types
  - collections
question: "Why must you override `GetHashCode()` when you override `Equals()`?"
answer: |
  Because hash-based collections rely on a contract between the two methods: **if two objects are equal, they must return the same hash code**. Unequal objects may share a hash code; that's just a collision.

  `Dictionary<TKey, TValue>` and `HashSet<T>` first use `GetHashCode()` to pick a bucket, then call `Equals()` only on the items in that bucket. If you override `Equals()` to compare values but keep the default `GetHashCode()`, which is based on object identity, two equal objects usually land in different buckets. Lookups then fail, and a `HashSet` happily stores "duplicates". The compiler warns about this (CS0659).

  Guidelines:

  - Compute the hash from the same fields that `Equals()` compares, using `HashCode.Combine`.
  - Use immutable fields. If a key's hash changes after insertion, the collection can't find it anymore.
  - Implement `IEquatable<T>` for a strongly typed `Equals(T)`, which also avoids boxing for structs.
  - Overload `==` and `!=` consistently if you change equality semantics.

  Records generate all of this for you, based on their properties.
codeExample: |
  var set = new HashSet<Point> { new(1, 2) };
  Console.WriteLine(set.Contains(new Point(1, 2)));          // Output: True

  var broken = new HashSet<BrokenPoint> { new(1, 2) };
  Console.WriteLine(broken.Contains(new BrokenPoint(1, 2))); // Output: False (typically)

  public sealed class Point(int x, int y) : IEquatable<Point>
  {
      public int X { get; } = x;
      public int Y { get; } = y;

      public bool Equals(Point? o) => o is not null && X == o.X && Y == o.Y;
      public override bool Equals(object? obj) => Equals(obj as Point);
      public override int GetHashCode() => HashCode.Combine(X, Y); // same fields
  }

  public sealed class BrokenPoint(int x, int y)
  {
      public int X { get; } = x;
      public int Y { get; } = y;

      public override bool Equals(object? obj) =>
          obj is BrokenPoint p && p.X == X && p.Y == Y;
      // GetHashCode not overridden: identity-based hash, warning CS0659
  }
popularity: 8.5
isPublished: true
---
