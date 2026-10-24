---
publishDate: 2026-04-08T11:14
title: Fields and Properties
slug: fields-and-properties
metadescription: Understand the difference between fields and properties, write auto properties, add validation in setters, use init only and computed properties, and know when to use readonly.
updateDate: 2026-09-05T11:14
author: ['bishal-biswas']
level: 2
tags: ['oop', 'properties']
course: c-sharp
---

## Fields

A field is a variable that belongs to an object:

```csharp
class Player
{
    public string Name;
    public int Score;
}
```

Public fields work, but they hand out full control. Anyone can set `Score` to a negative number, and if you later want to log every change or validate it, you have to hunt down every place that touches the field.

## Properties

A **property** looks like a field from the outside but runs code when read or written. It has a `get` accessor and a `set` accessor:

```csharp
class Player
{
    private int score;   // the backing field

    public int Score
    {
        get { return score; }
        set
        {
            if (value < 0) throw new ArgumentOutOfRangeException(nameof(value));
            score = value;
        }
    }
}

var p = new Player();
p.Score = 10;              // runs the setter
Console.WriteLine(p.Score);   // runs the getter
// p.Score = -5;           // throws
```

Inside a setter, `value` is the keyword for whatever the caller assigned.

## Auto properties

Most properties just store and return a value. C# lets you skip the backing field:

```csharp
class Player
{
    public string Name { get; set; }
    public int Score { get; set; }
}
```

The compiler creates a hidden field for you. This is the default way to declare data in a class. Use full properties only when you need logic.

### Default values

```csharp
public string Name { get; set; } = "Anonymous";
public List<string> Tags { get; set; } = new();
```

## Read only properties

Leave out the setter and the property can only be set in the constructor:

```csharp
class Player
{
    public string Name { get; }

    public Player(string name)
    {
        Name = name;
    }
}
```

Once built, the name never changes. This is how you make objects that cannot be put into a bad state.

## Private setters

Let the class change a value but not the outside world:

```csharp
class Player
{
    public int Score { get; private set; }

    public void AddPoints(int points)
    {
        Score += points;
    }
}

var p = new Player();
p.AddPoints(10);
// p.Score = 100;   // error: setter is private
```

The class controls the rules. Callers can only go through `AddPoints`.

## Init only properties

`init` lets a property be set with an object initialiser but never again afterwards:

```csharp
class Player
{
    public string Name { get; init; }
    public int Level { get; init; } = 1;
}

var p = new Player { Name = "Asha", Level = 5 };
// p.Name = "Ravi";   // error: init only
```

This gives you the convenience of the initialiser syntax with the safety of read only.

### required

Add `required` and the compiler insists the initialiser sets it:

```csharp
class Player
{
    public required string Name { get; init; }
}

// var p = new Player();   // error: Name must be set
var p = new Player { Name = "Asha" };
```

## Computed properties

A getter can calculate its value instead of storing one:

```csharp
class Rectangle
{
    public double Width { get; set; }
    public double Height { get; set; }

    public double Area => Width * Height;
    public bool IsSquare => Width == Height;
}
```

The arrow form is an expression bodied getter. `Area` has no storage. It is worked out every time it is read.

## Readonly fields

A `readonly` field can only be assigned in its declaration or in a constructor:

```csharp
class Order
{
    private readonly DateTime created = DateTime.Now;
    private readonly List<string> items = new();

    public void Add(string item) => items.Add(item);   // fine, list contents change
    // items = new List<string>();   // error: readonly
}
```

Note the difference from `const`. A `const` is a compile time literal. A `readonly` field can be computed at run time, once.

## Fields or properties?

- **Public data**: always a property. It lets you add logic later without changing callers.
- **Private state**: a private field is fine, and is the usual choice.
- **Never** expose a public field from a class other people use.

Naming: private fields use `camelCase`, often with an underscore prefix (`_score`). Properties use `PascalCase` (`Score`).

## Quick recap

- Fields store data, properties wrap access to it with `get` and `set`.
- Auto properties `{ get; set; }` are the default for public data.
- Drop the setter for read only, or make it `private set` so only the class can change it.
- `init` allows setting through an object initialiser only, and `required` forces it.
- Expression bodied getters compute a value on every read.
- `readonly` fields can be assigned only at declaration or in a constructor.

<code id="code-content" class="language-csharp">
// Fields and properties
class Player
{
    // Private field for internal state
    private readonly DateTime _joined = DateTime.Now;
    // Required init only: must be set in the initialiser, then frozen
    public required string Name { get; init; }
    // Auto property with a default value
    public int Level { get; set; } = 1;
    // Private setter: only this class changes it
    public int Score { get; private set; }
    // Full property with validation in the setter
    private int lives = 3;
    public int Lives
    {
        get =&gt; lives;
        set
        {
            if (value &lt; 0) throw new ArgumentOutOfRangeException(nameof(value));
            lives = value;
        }
    }
    // Computed property, no storage
    public bool IsAlive =&gt; Lives &gt; 0;
    public string Summary =&gt; $"{Name} (L{Level}) {Score} pts, {Lives} lives";
    public void AddPoints(int points) =&gt; Score += points;
}
var p = new Player { Name = "Asha", Level = 4 };
p.AddPoints(150);
p.Lives = 1;
Console.WriteLine(p.Summary);     // Asha (L4) 150 pts, 1 lives
Console.WriteLine(p.IsAlive);     // True
// p.Name = "Ravi";               // error: init only
// p.Score = 999;                 // error: private setter
try
{
    p.Lives = -1;                 // validation throws
}
catch (ArgumentOutOfRangeException)
{
    Console.WriteLine("Lives cannot be negative");
}
</code></pre>
