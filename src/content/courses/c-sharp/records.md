---
publishDate: 2026-04-24T11:43
title: Records
slug: records
metadescription: Model immutable data with records, get value equality, ToString and deconstruction for free, use with expressions for non destructive changes, and choose between record class and record struct.
updateDate: 2026-09-05T11:43
author: ['bishal-biswas']
level: 3
tags: ['records', 'immutability', 'modern-csharp']
course: c-sharp
---

## The problem with data classes

A class that just carries data needs a surprising amount of code to behave well: a constructor, read only properties, `Equals`, `GetHashCode`, `ToString` and maybe deconstruction. Forty lines for three fields, and every line is a place for a bug.

```csharp
class Point
{
    public int X { get; }
    public int Y { get; }
    public Point(int x, int y) { X = x; Y = y; }
    public override bool Equals(object? o) => o is Point p && p.X == X && p.Y == Y;
    public override int GetHashCode() => HashCode.Combine(X, Y);
    public override string ToString() => $"Point {{ X = {X}, Y = {Y} }}";
}
```

A **record** generates all of that from one line.

## Declaring a record

```csharp
record Point(int X, int Y);
```

That is the whole thing. The **positional** syntax declares a constructor, two `init` only properties and everything listed above:

```csharp
var p = new Point(3, 4);

Console.WriteLine(p);          // Point { X = 3, Y = 4 }
Console.WriteLine(p.X);        // 3
// p.X = 10;                   // error: init only
```

## Value equality

Two records with the same values are equal. Two class instances with the same values are not, because classes compare references:

```csharp
var a = new Point(1, 2);
var b = new Point(1, 2);

Console.WriteLine(a == b);         // True for records
Console.WriteLine(a.Equals(b));    // True
Console.WriteLine(ReferenceEquals(a, b));   // False, still two objects
```

This makes records ideal as dictionary keys, set members and test expectations. `GetHashCode` is consistent with `Equals` automatically.

## Non destructive mutation with with

Records are immutable by default. To "change" one, create a copy with some values replaced:

```csharp
var original = new Point(1, 2);
var moved = original with { X = 10 };

Console.WriteLine(original);   // Point { X = 1, Y = 2 }
Console.WriteLine(moved);      // Point { X = 10, Y = 2 }
```

The `with` expression copies every property, then applies the changes. The original is untouched. Anyone holding a reference to it sees no difference, which is what makes immutable data safe to share across threads and cache freely.

## Deconstruction

Positional records can be unpacked into variables:

```csharp
var (x, y) = new Point(5, 6);
Console.WriteLine($"{x}, {y}");

// And matched positionally
string Describe(Point p) => p switch
{
    (0, 0) => "origin",
    (var px, 0) => $"on the x axis at {px}",
    (0, var py) => $"on the y axis at {py}",
    _ => "somewhere else"
};
```

## Adding members

A record can have a body with methods, extra properties and validation:

```csharp
record Person(string FirstName, string LastName, int Age)
{
    public string FullName => $"{FirstName} {LastName}";

    public bool IsAdult => Age >= 18;

    public Person
    {
        if (Age < 0) throw new ArgumentOutOfRangeException(nameof(Age));
    }
}
```

The block without a name and parameters is the primary constructor body, which runs validation before the properties are set. Note that a `with` expression bypasses it, so validate elsewhere if that matters.

## Property style records

You do not have to use positional syntax. Declare properties yourself when you want more control:

```csharp
record Settings
{
    public string Theme { get; init; } = "light";
    public int FontSize { get; init; } = 14;
    public required string User { get; init; }
}

var s = new Settings { User = "asha" };
var dark = s with { Theme = "dark" };
```

Equality, `ToString` and `with` all still work.

## Inheritance

Records can inherit from records:

```csharp
record Shape(string Name);
record Circle(double Radius) : Shape("Circle");
record Square(double Side) : Shape("Square");

Shape shape = new Circle(2);
Console.WriteLine(shape);   // Circle { Name = Circle, Radius = 2 }
```

Equality takes the run time type into account. A `Circle(2)` is never equal to a `Square(2)` even if a base class comparison would say otherwise. A record cannot inherit from a class, and a class cannot inherit from a record.

## record struct

`record` on its own means `record class`, a reference type. `record struct` gives you a value type with the same conveniences:

```csharp
record struct Money(decimal Amount, string Currency);

readonly record struct Coordinate(double Lat, double Lon);
```

Choose `record struct` for small values that are created and discarded a lot, since they avoid heap allocation. Add `readonly` to make it immutable, because a plain `record struct` has settable properties.

## Records or classes?

Use a **record** when the type is defined by its data: DTOs, API responses, configuration, events, messages, coordinates, money. Two instances with the same values should be interchangeable.

Use a **class** when the type has identity or mutable state: a bank account, a connection, a UI control, a service. Two accounts with the same balance are not the same account.

A quick test: if you would naturally compare two instances with `==` and expect their contents to be compared, it is a record.

## Records and JSON

Records serialise and deserialise cleanly with `System.Text.Json`, which understands the positional constructor:

```csharp
record Weather(string City, double Temperature);

string json = JsonSerializer.Serialize(new Weather("Delhi", 34.5));
Weather? back = JsonSerializer.Deserialize<Weather>(json);
```

This is why records dominate in API code.

## Quick recap

- `record Point(int X, int Y);` generates a constructor, init properties, equality, hashing, `ToString` and deconstruction.
- Records compare by value, classes by reference.
- `with` creates a modified copy and leaves the original alone.
- Add methods, computed properties and validation in a body, or declare properties by hand.
- `record struct` is the value type version, and `readonly record struct` makes it immutable.
- Use records for data, classes for things with identity or changing state.

<code id="code-content" class="language-csharp">
// Records in C#
using System.Text.Json;
// One line replaces forty lines of boilerplate
record Point(int X, int Y);
// A record with validation, computed members and a body
record Person(string FirstName, string LastName, int Age)
{
    public string FullName =&gt; $"{FirstName} {LastName}";
    public bool IsAdult =&gt; Age &gt;= 18;
}
// Record inheritance
record Shape(string Name);
record Circle(double Radius) : Shape("Circle");
// A value type record
readonly record struct Money(decimal Amount, string Currency)
{
    public Money Add(Money other) =&gt; this with { Amount = Amount + other.Amount };
}
// ToString and value equality for free
var a = new Point(1, 2);
var b = new Point(1, 2);
Console.WriteLine(a);                      // Point { X = 1, Y = 2 }
Console.WriteLine(a == b);                 // True
Console.WriteLine(ReferenceEquals(a, b));  // False
// with: copy and change, original untouched
var moved = a with { X = 10 };
Console.WriteLine($"{a} -&gt; {moved}");
// Deconstruction and positional patterns
var (x, y) = moved;
Console.WriteLine($"{x}, {y}");
string Where(Point p) =&gt; p switch
{
    (0, 0) =&gt; "origin",
    (_, 0) =&gt; "x axis",
    (0, _) =&gt; "y axis",
    _ =&gt; "elsewhere"
};
Console.WriteLine(Where(new Point(0, 7)));  // y axis
// Records as dictionary keys and set members
var visits = new Dictionary&lt;Point, int&gt; { [new(1, 1)] = 3 };
Console.WriteLine(visits[new Point(1, 1)]); // 3
// Members and inheritance
var asha = new Person("Asha", "Roy", 30);
Console.WriteLine($"{asha.FullName} adult: {asha.IsAdult}");
Shape shape = new Circle(2);
Console.WriteLine(shape);                   // Circle { Name = Circle, Radius = 2 }
// record struct arithmetic and JSON round trip
var total = new Money(10, "INR").Add(new Money(5.5m, "INR"));
Console.WriteLine(total);
string json = JsonSerializer.Serialize(asha);
Console.WriteLine(JsonSerializer.Deserialize&lt;Person&gt;(json) == asha);   // True
</code></pre>
