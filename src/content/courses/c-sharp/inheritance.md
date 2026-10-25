---
publishDate: 2026-04-09T11:16
title: Inheritance
slug: inheritance
metadescription: Build class hierarchies with base and derived classes, call base constructors, override members, seal what should not change and know when composition beats inheritance.
updateDate: 2026-09-05T11:16
author: ['bishal-biswas']
level: 2
tags: ['oop', 'inheritance']
course: c-sharp
---

## What inheritance is

Inheritance lets one class build on another. The **derived** class gets everything the **base** class has, and can add more or change some of it.

```csharp
class Animal
{
    public string Name { get; set; } = "";

    public void Eat() => Console.WriteLine($"{Name} is eating");
}

class Dog : Animal
{
    public void Bark() => Console.WriteLine($"{Name} says woof");
}

var dog = new Dog { Name = "Rex" };
dog.Eat();    // inherited from Animal
dog.Bark();   // defined in Dog
```

The colon means "Dog is an Animal". Every `Dog` has a `Name` and can `Eat` without repeating that code.

## Is-a relationships

Use inheritance only when the derived class genuinely **is a** kind of the base class. A `Dog` is an `Animal`. A `SavingsAccount` is a `BankAccount`. A `Car` is not an `Engine`. It **has** one, which is a different relationship called composition.

## Base class constructors

If the base class has a constructor with parameters, the derived class must call it with `: base(...)`:

```csharp
class Animal
{
    public string Name { get; }

    public Animal(string name)
    {
        Name = name;
    }
}

class Dog : Animal
{
    public string Breed { get; }

    public Dog(string name, string breed) : base(name)
    {
        Breed = breed;
    }
}
```

The base constructor runs first, then the derived one. If the base has a parameterless constructor, the call is made for you automatically.

## Overriding members

A base class can mark a method as `virtual`, which means "derived classes may replace this". The derived class uses `override`:

```csharp
class Animal
{
    public virtual string Speak() => "...";
}

class Dog : Animal
{
    public override string Speak() => "Woof";
}

class Cat : Animal
{
    public override string Speak() => "Meow";
}
```

Without `virtual` on the base, `override` is a compile error. This is deliberate. A class author decides what can be changed.

### Calling the base version

An override can still use the original with `base.`:

```csharp
class Puppy : Dog
{
    public override string Speak() => base.Speak() + " (squeaky)";
}
```

## Every class inherits from object

If you write no base class, your class inherits from `System.Object`. That is where `ToString`, `Equals` and `GetHashCode` come from, and they are virtual:

```csharp
class Point
{
    public int X { get; set; }
    public int Y { get; set; }

    public override string ToString() => $"({X}, {Y})";
}

Console.WriteLine(new Point { X = 1, Y = 2 });   // (1, 2)
```

Overriding `ToString` is the most common override you will write.

## Protected members

`protected` members are for derived classes only. They are the natural home for state the hierarchy shares but callers should not touch:

```csharp
class Account
{
    protected decimal Balance { get; set; }
}

class SavingsAccount : Account
{
    public void AddInterest(decimal rate) => Balance += Balance * rate;
}
```

## Hiding with new (avoid)

If you write a method with the same name as a base method but without `override`, you **hide** it and get a warning. Adding `new` silences the warning:

```csharp
class Base { public void Show() => Console.WriteLine("Base"); }
class Derived : Base { public new void Show() => Console.WriteLine("Derived"); }

Base b = new Derived();
b.Show();   // Base, hiding does not use the run time type
```

This is almost always a mistake. Use `virtual` and `override`.

## Sealed classes and methods

`sealed` stops further inheritance:

```csharp
sealed class FinalConfig { }
// class Custom : FinalConfig { }   // error

class Dog : Animal
{
    public sealed override string Speak() => "Woof";   // nobody can override again
}
```

Seal classes that were not designed to be extended. Many library classes are sealed for this reason, and it also gives the runtime a small speed boost.

## Single inheritance only

A class can have only **one** base class. C# does not allow `class A : B, C` for classes. If you need a type to play several roles, use interfaces, which are covered soon.

## When not to inherit

Deep hierarchies are hard to change. Before inheriting, ask whether the derived class needs to be usable everywhere the base is. If you only want to reuse some code, hold an instance instead:

```csharp
class Logger { public void Log(string m) => Console.WriteLine(m); }

class OrderService
{
    private readonly Logger logger = new();   // has a Logger, is not a Logger

    public void Place() => logger.Log("Order placed");
}
```

This is **composition**, and it is usually the better choice.

## Quick recap

- `class Derived : Base` gives the derived class every member of the base.
- Call the base constructor with `: base(...)` when it needs arguments.
- Mark methods `virtual` to allow `override` in derived classes, and use `base.` to reuse the original.
- Every class inherits `ToString`, `Equals` and `GetHashCode` from `object`.
- `sealed` prevents further inheritance, and `new` hiding should be avoided.
- Prefer composition when the relationship is "has a" rather than "is a".

<code id="code-content" class="language-csharp">
// Inheritance in C#
class Animal
{
    public string Name { get; }
    protected int Energy { get; set; } = 10;      // shared with subclasses only
    public Animal(string name) =&gt; Name = name;
    public void Eat() =&gt; Energy += 5;              // inherited as is
    public virtual string Speak() =&gt; "...";        // can be overridden
    public override string ToString() =&gt; $"{GetType().Name} {Name} (energy {Energy})";
}
class Dog : Animal
{
    public string Breed { get; }
    public Dog(string name, string breed) : base(name) =&gt; Breed = breed;   // base ctor first
    public override string Speak() =&gt; "Woof";
    public void Fetch() =&gt; Energy -= 3;            // protected member is accessible
}
sealed class Puppy : Dog                           // nobody can inherit from Puppy
{
    public Puppy(string name) : base(name, "unknown") { }
    public override string Speak() =&gt; base.Speak() + " (squeaky)";   // reuse base version
}
class Cat : Animal
{
    public Cat(string name) : base(name) { }
    public override string Speak() =&gt; "Meow";
}
var rex = new Dog("Rex", "Labrador");
rex.Eat();
rex.Fetch();
Console.WriteLine(rex);                 // Dog Rex (energy 12)
Console.WriteLine(rex.Speak());         // Woof
var pup = new Puppy("Bolt");
Console.WriteLine(pup.Speak());         // Woof (squeaky)
// A derived object can be stored in a base typed variable
Animal a = new Cat("Misty");
Console.WriteLine(a.Speak());           // Meow, override still runs
Console.WriteLine(a is Cat);            // True
</code></pre>
