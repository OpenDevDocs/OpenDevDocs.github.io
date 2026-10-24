---
publishDate: 2026-04-10T11:17
title: Polymorphism
slug: polymorphism
metadescription: Treat different objects through a common base type, understand virtual dispatch, method overloading versus overriding, type checks with is and as, and why polymorphism removes if chains.
updateDate: 2026-09-05T11:17
author: ['bishal-biswas']
level: 2
tags: ['oop', 'polymorphism']
course: c-sharp
---

## One name, many forms

Polymorphism means "many shapes". In C# it means you can call the same method on different objects and each one responds in its own way. The caller does not need to know which concrete type it is holding.

```csharp
class Shape
{
    public virtual double Area() => 0;
}

class Circle : Shape
{
    public double Radius { get; set; }
    public override double Area() => Math.PI * Radius * Radius;
}

class Rectangle : Shape
{
    public double Width { get; set; }
    public double Height { get; set; }
    public override double Area() => Width * Height;
}
```

Now a list of shapes can be summed without caring what each one is:

```csharp
List<Shape> shapes = new()
{
    new Circle { Radius = 1 },
    new Rectangle { Width = 2, Height = 3 },
    new Circle { Radius = 2 }
};

double total = 0;
foreach (Shape s in shapes)
{
    total += s.Area();   // calls the right override every time
}
Console.WriteLine($"{total:F2}");   // 21.71
```

That loop is polymorphism. Adding a `Triangle` class later means adding one file. The loop does not change.

## Run time dispatch

When you call a `virtual` method through a base typed variable, .NET looks at the **actual** object at run time and picks its override. This is called **dynamic dispatch** or **late binding**:

```csharp
Shape s = new Circle { Radius = 1 };
Console.WriteLine(s.Area());   // uses Circle.Area, not Shape.Area
```

The variable type (`Shape`) decides what you are allowed to call. The object type (`Circle`) decides which version runs.

## The problem polymorphism solves

Without it, you end up with type checks everywhere:

```csharp
foreach (Shape s in shapes)
{
    if (s is Circle c) total += Math.PI * c.Radius * c.Radius;
    else if (s is Rectangle r) total += r.Width * r.Height;
    // every new shape means editing this block, and every other block like it
}
```

Each `if` chain is a place that must be updated for every new type. With a virtual method, each type owns its own behaviour.

## Overloading versus overriding

Two words that sound alike and mean different things:

- **Overloading**: several methods with the **same name and different parameters** in the same class. Resolved at compile time by the arguments.
- **Overriding**: a derived class **replaces** a virtual method with the same signature. Resolved at run time by the object type.

```csharp
class Printer
{
    public void Print(int n) => Console.WriteLine($"int {n}");        // overload
    public void Print(string s) => Console.WriteLine($"string {s}");  // overload
    public virtual void Header() => Console.WriteLine("Printer");
}

class ColourPrinter : Printer
{
    public override void Header() => Console.WriteLine("Colour printer");   // override
}
```

Overloading is sometimes called compile time polymorphism, overriding is run time polymorphism. The second is what people usually mean by the word.

## Upcasting and downcasting

Storing a `Circle` in a `Shape` variable is an **upcast** and is always safe, so it is implicit. Going back down needs a check:

```csharp
Shape s = new Circle { Radius = 3 };

// Pattern matching, the recommended way
if (s is Circle c)
{
    Console.WriteLine(c.Radius);
}

// as returns null when the type does not match
Rectangle? r = s as Rectangle;
Console.WriteLine(r is null);   // True

// A direct cast throws InvalidCastException on mismatch
Circle definitely = (Circle)s;
```

Use `is` with a pattern almost always. Use a direct cast only when a failure would be a bug worth crashing on.

## Polymorphism through interfaces

Inheritance is not the only route. Any type that implements an interface can be used through that interface, and a class can implement many. The next topics cover abstraction and interfaces in detail, but here is a taste:

```csharp
interface IGreeter
{
    string Greet();
}

class English : IGreeter { public string Greet() => "Hello"; }
class Hindi : IGreeter { public string Greet() => "Namaste"; }

IGreeter[] greeters = { new English(), new Hindi() };
foreach (var g in greeters) Console.WriteLine(g.Greet());
```

## Virtual properties

Properties can be virtual too, which is handy for defaults a subclass can adjust:

```csharp
class Employee
{
    public virtual decimal BonusRate => 0.05m;
}

class Manager : Employee
{
    public override decimal BonusRate => 0.10m;
}
```

## Quick recap

- Polymorphism lets you call one method on many types and get each type's own behaviour.
- Virtual dispatch picks the override based on the object's run time type.
- It replaces `if` chains that check types, so adding a type means adding a class, not editing every loop.
- Overloading is same name, different parameters. Overriding is replacing a virtual method.
- Upcasting is free, downcasting should use `is` with a pattern.
- Interfaces give polymorphism without inheritance.

<code id="code-content" class="language-csharp">
// Polymorphism in C#
abstract class Shape
{
    public abstract double Area();                     // each shape supplies its own
    public virtual string Describe() =&gt; $"{GetType().Name} with area {Area():F2}";
}
class Circle : Shape
{
    public double Radius { get; init; }
    public override double Area() =&gt; Math.PI * Radius * Radius;
}
class Rectangle : Shape
{
    public double Width { get; init; }
    public double Height { get; init; }
    public override double Area() =&gt; Width * Height;
    public override string Describe() =&gt; base.Describe() + (Width == Height ? " (square)" : "");
}
class Triangle : Shape
{
    public double Base { get; init; }
    public double Height { get; init; }
    public override double Area() =&gt; 0.5 * Base * Height;
}
// One list, many types, one loop
List&lt;Shape&gt; shapes = new()
{
    new Circle { Radius = 1 },
    new Rectangle { Width = 2, Height = 2 },
    new Triangle { Base = 4, Height = 3 }
};
double total = 0;
foreach (Shape s in shapes)
{
    Console.WriteLine(s.Describe());   // the right override runs each time
    total += s.Area();
}
Console.WriteLine($"Total: {total:F2}");   // Total: 13.14
// Downcasting safely with a pattern
Shape first = shapes[0];
if (first is Circle c)
    Console.WriteLine($"Radius {c.Radius}");
Rectangle? maybe = first as Rectangle;
Console.WriteLine(maybe is null);          // True
</code></pre>
