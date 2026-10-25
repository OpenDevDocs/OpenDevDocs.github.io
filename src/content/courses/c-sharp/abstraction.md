---
publishDate: 2026-04-10T11:18
title: Abstraction
slug: abstraction
metadescription: Hide complexity behind simple interfaces with abstract classes and methods, the template method pattern, and learn when to choose an abstract class over an interface.
updateDate: 2026-09-05T11:18
author: ['bishal-biswas']
level: 2
tags: ['oop', 'abstraction']
course: c-sharp
---

## What abstraction means

Abstraction is showing **what** something does while hiding **how**. When you press a car's brake pedal you do not think about hydraulics. The pedal is the abstraction.

In C# this shows up in two ways:

1. Well designed classes expose simple public methods and hide the messy details.
2. **Abstract classes** define a shape that other classes must fill in.

The first is a habit you have already been building. This topic is about the second.

## Abstract classes

An `abstract` class cannot be created directly. It exists only to be inherited:

```csharp
abstract class Shape
{
    public abstract double Area();

    public void Print() => Console.WriteLine($"Area: {Area():F2}");
}

// var s = new Shape();   // error: cannot create an instance of an abstract class
```

`Area` is an **abstract method**. It has no body. Every non abstract class that inherits from `Shape` **must** override it, or the compiler refuses to build.

```csharp
class Circle : Shape
{
    public double Radius { get; set; }
    public override double Area() => Math.PI * Radius * Radius;
}

var c = new Circle { Radius = 1 };
c.Print();   // Area: 3.14
```

`Print` is a normal method. It is written once in the base and works for every shape because it calls the abstract `Area` and trusts the subclass to provide it.

## Abstract versus virtual

- `virtual`: has a default body. Overriding is **optional**.
- `abstract`: has no body. Overriding is **required**.

Use `abstract` when there is no sensible default. There is no default area for "a shape". Use `virtual` when there is a reasonable one that some subclasses will tweak.

## Abstract properties

Properties can be abstract too:

```csharp
abstract class Vehicle
{
    public abstract int Wheels { get; }
    public abstract string Category { get; }

    public override string ToString() => $"{Category} with {Wheels} wheels";
}

class Bike : Vehicle
{
    public override int Wheels => 2;
    public override string Category => "Bicycle";
}
```

## The template method pattern

The most useful thing an abstract class does is define the **skeleton** of an algorithm and let subclasses fill in the steps:

```csharp
abstract class ReportGenerator
{
    // The template: fixed order, cannot be changed by subclasses
    public void Generate()
    {
        var data = LoadData();
        var body = Format(data);
        Save(body);
    }

    protected abstract List<string> LoadData();
    protected abstract string Format(List<string> data);

    protected virtual void Save(string content)
    {
        Console.WriteLine("Saving:\n" + content);
    }
}

class SalesReport : ReportGenerator
{
    protected override List<string> LoadData() => new() { "Jan: 100", "Feb: 150" };
    protected override string Format(List<string> data) => string.Join("\n", data);
}

new SalesReport().Generate();
```

`Generate` is the abstraction. Callers use it and never see the three steps. Each report type only writes the parts that differ.

## Abstract classes can have state

Unlike interfaces, an abstract class can hold fields, constructors and full implementations. This makes it a good base when subclasses share real code and data:

```csharp
abstract class Account
{
    protected decimal Balance { get; private set; }

    protected Account(decimal opening)
    {
        Balance = opening;
    }

    public void Deposit(decimal amount) => Balance += amount;

    public abstract decimal MonthlyFee();
}

class Premium : Account
{
    public Premium(decimal opening) : base(opening) { }
    public override decimal MonthlyFee() => 0;
}
```

The constructor is `protected` because only subclasses will ever call it.

## Abstract class or interface?

Both let you program against a shape rather than a concrete type. Choose based on what you need:

| Need | Choose |
| --- | --- |
| Shared fields, constructors or real implementation | Abstract class |
| A type that can play several roles at once | Interface |
| A contract that unrelated classes will implement | Interface |
| A family of closely related classes with common code | Abstract class |

A class can inherit from only one base class but implement many interfaces. When in doubt, start with an interface. You can always add an abstract base class that implements it later.

## Hiding complexity in everyday code

Abstraction is not only about the `abstract` keyword. This method is an abstraction too:

```csharp
public static string LoadConfig(string path)
{
    // reads the file, parses JSON, validates keys, applies defaults
    // caller sees one line and one result
}
```

Every time you name a chunk of work and hide its details behind a method, you are abstracting. Abstract classes just make the compiler enforce it across a family of types.

## Quick recap

- Abstraction shows what a thing does and hides how it does it.
- An `abstract` class cannot be instantiated and exists to be inherited.
- `abstract` members have no body and must be overridden. `virtual` members have a default.
- The template method pattern puts the fixed steps in the base and the variable steps in subclasses.
- Abstract classes can hold state and constructors, interfaces cannot hold instance state.
- Prefer interfaces for contracts across unrelated types, abstract classes for shared code in a family.

<code id="code-content" class="language-csharp">
// Abstraction with abstract classes and the template method
abstract class ReportGenerator
{
    // The template: fixed order of steps, hidden from callers
    public void Generate()
    {
        var data = LoadData();
        var body = Format(data);
        Save(body);
    }
    // Steps subclasses must supply
    protected abstract List&lt;string&gt; LoadData();
    protected abstract string Format(List&lt;string&gt; data);
    // A step with a sensible default
    protected virtual void Save(string content)
    {
        Console.WriteLine($"[{Title}]");
        Console.WriteLine(content);
    }
    public abstract string Title { get; }
}
class SalesReport : ReportGenerator
{
    public override string Title =&gt; "Sales";
    protected override List&lt;string&gt; LoadData() =&gt; new() { "Jan: 100", "Feb: 150", "Mar: 120" };
    protected override string Format(List&lt;string&gt; data) =&gt; string.Join(" | ", data);
}
class CsvReport : ReportGenerator
{
    public override string Title =&gt; "CSV";
    protected override List&lt;string&gt; LoadData() =&gt; new() { "a", "b", "c" };
    protected override string Format(List&lt;string&gt; data) =&gt; string.Join(",", data);
    protected override void Save(string content) =&gt; Console.WriteLine($"Would write {content.Length} bytes to report.csv");
}
// Callers only ever see Generate()
ReportGenerator[] reports = { new SalesReport(), new CsvReport() };
foreach (var r in reports)
{
    r.Generate();
}
// var bad = new ReportGenerator();   // error: abstract class
</code></pre>
