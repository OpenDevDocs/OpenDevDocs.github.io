---
publishDate: 2026-04-11T11:19
title: Interfaces
slug: interfaces
metadescription: Define contracts with interfaces, implement several on one class, program against abstractions, use default interface methods and the built in interfaces every C# developer meets.
updateDate: 2026-09-05T11:19
author: ['bishal-biswas']
level: 2
tags: ['oop', 'interfaces']
course: c-sharp
---

## What an interface is

An interface is a **contract**. It lists members a type promises to provide, with no implementation of its own:

```csharp
interface IShape
{
    double Area();
    double Perimeter();
}
```

Any class that implements `IShape` must supply both methods. The interface says what, the class says how.

Interface names start with a capital `I` by convention. Members are public automatically, so you do not write `public` inside.

## Implementing an interface

```csharp
class Circle : IShape
{
    public double Radius { get; set; }

    public double Area() => Math.PI * Radius * Radius;
    public double Perimeter() => 2 * Math.PI * Radius;
}

class Square : IShape
{
    public double Side { get; set; }

    public double Area() => Side * Side;
    public double Perimeter() => 4 * Side;
}
```

Leave out `Perimeter` and the compiler stops you: "Circle does not implement interface member IShape.Perimeter()".

## Programming against the interface

Code that accepts `IShape` works with every current and future implementation:

```csharp
static void Report(IShape shape)
{
    Console.WriteLine($"Area {shape.Area():F2}, perimeter {shape.Perimeter():F2}");
}

Report(new Circle { Radius = 1 });
Report(new Square { Side = 2 });

List<IShape> shapes = new() { new Circle { Radius = 2 }, new Square { Side = 3 } };
```

`Report` has no idea about circles or squares. That is the point. You can add a `Triangle` tomorrow and `Report` needs no change.

## Multiple interfaces

A class inherits from one base class but can implement as many interfaces as it likes:

```csharp
interface IPrintable { void Print(); }
interface ISaveable { void Save(string path); }

class Document : IPrintable, ISaveable
{
    public string Text { get; set; } = "";
    public void Print() => Console.WriteLine(Text);
    public void Save(string path) => File.WriteAllText(path, Text);
}
```

Each interface is a role. A `Document` can be handed to anything that needs an `IPrintable` and to anything that needs an `ISaveable`.

## Interfaces can have properties

```csharp
interface INamed
{
    string Name { get; }
}

interface IAgeing
{
    int Age { get; set; }
}
```

A getter only property in the interface can still have a setter in the class. The interface sets the minimum.

## Interface inheritance

An interface can extend another:

```csharp
interface IReadable { string Read(); }
interface IWritable { void Write(string s); }
interface IStorage : IReadable, IWritable { }

class MemoryStorage : IStorage
{
    private string data = "";
    public string Read() => data;
    public void Write(string s) => data = s;
}
```

## Default interface methods

Since C# 8 an interface member can have a body. Classes that do not override it get the default:

```csharp
interface ILogger
{
    void Log(string message);

    void LogError(string message) => Log("ERROR: " + message);
}

class ConsoleLogger : ILogger
{
    public void Log(string message) => Console.WriteLine(message);
}

ILogger logger = new ConsoleLogger();
logger.LogError("Disk full");   // ERROR: Disk full
```

This lets you add members to a public interface without breaking every class that implements it. Note that the default is only reachable through the interface type, not through `ConsoleLogger` directly.

## Explicit implementation

If two interfaces declare the same member name, or you want a member hidden unless the object is used as that interface, implement it explicitly:

```csharp
interface IEnglish { string Greet(); }
interface IHindi { string Greet(); }

class Greeter : IEnglish, IHindi
{
    string IEnglish.Greet() => "Hello";
    string IHindi.Greet() => "Namaste";
}

var g = new Greeter();
Console.WriteLine(((IEnglish)g).Greet());   // Hello
Console.WriteLine(((IHindi)g).Greet());     // Namaste
// g.Greet();   // error: not visible on the class itself
```

## Built in interfaces you will meet

.NET is built on interfaces. A few show up constantly:

- `IEnumerable<T>`: anything `foreach` can loop over. Every collection implements it.
- `IComparable<T>`: lets `Sort` order your objects.
- `IEquatable<T>`: defines equality for your type.
- `IDisposable`: for objects that hold resources and need cleanup with `using`.

Implementing `IComparable<T>` is a nice example:

```csharp
class Student : IComparable<Student>
{
    public string Name { get; set; } = "";
    public int Grade { get; set; }

    public int CompareTo(Student? other) => Grade.CompareTo(other?.Grade ?? 0);
}

var students = new List<Student>
{
    new() { Name = "Asha", Grade = 88 },
    new() { Name = "Ravi", Grade = 72 }
};
students.Sort();   // uses CompareTo
```

## Interfaces and testing

Because code depends on the interface rather than a concrete class, you can swap in a fake during tests:

```csharp
interface IEmailSender { void Send(string to, string body); }

class FakeEmailSender : IEmailSender
{
    public List<string> Sent = new();
    public void Send(string to, string body) => Sent.Add(to);
}
```

The real sender talks to a mail server. The fake just records calls. The code under test cannot tell the difference. This is the foundation of dependency injection, covered later.

## Quick recap

- An interface is a contract of members with no state, and names start with `I`.
- A class implements an interface with a colon and must provide every member.
- Write methods that accept the interface so they work with any implementation.
- A class can implement many interfaces, one for each role it plays.
- Default interface methods add behaviour without breaking implementers.
- `IEnumerable<T>`, `IComparable<T>` and `IDisposable` are the built in ones you meet first.

<code id="code-content" class="language-csharp">
// Interfaces in C#
interface IShape
{
    double Area();
    string Name { get; }
    // Default implementation, available through the interface
    string Describe() =&gt; $"{Name} with area {Area():F2}";
}
interface IPrintable
{
    void Print();
}
class Circle : IShape, IPrintable          // one class, two roles
{
    public double Radius { get; init; }
    public string Name =&gt; "Circle";
    public double Area() =&gt; Math.PI * Radius * Radius;
    public void Print() =&gt; Console.WriteLine(((IShape)this).Describe());
}
class Square : IShape
{
    public double Side { get; init; }
    public string Name =&gt; "Square";
    public double Area() =&gt; Side * Side;
}
class Student : IComparable&lt;Student&gt;       // built in interface used by Sort
{
    public string Name { get; init; } = "";
    public int Grade { get; init; }
    public int CompareTo(Student? other) =&gt; Grade.CompareTo(other?.Grade ?? 0);
}
// Code against the interface, not the concrete type
static void Report(IShape shape) =&gt; Console.WriteLine(shape.Describe());
Report(new Circle { Radius = 1 });         // Circle with area 3.14
Report(new Square { Side = 2 });           // Square with area 4.00
IPrintable p = new Circle { Radius = 2 };
p.Print();
var students = new List&lt;Student&gt;
{
    new() { Name = "Asha", Grade = 88 },
    new() { Name = "Ravi", Grade = 72 },
    new() { Name = "Meera", Grade = 95 }
};
students.Sort();                           // uses CompareTo
Console.WriteLine(string.Join(", ", students.Select(s =&gt; s.Name)));   // Ravi, Asha, Meera
</code></pre>
