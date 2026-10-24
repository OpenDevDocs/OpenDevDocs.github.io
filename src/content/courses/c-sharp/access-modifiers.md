---
publishDate: 2026-04-09T11:15
title: Access Modifiers
slug: access-modifiers
metadescription: Control who can see and use your code with public, private, protected, internal and their combinations, and learn the encapsulation habits that keep classes safe.
updateDate: 2026-09-05T11:15
author: ['bishal-biswas']
level: 2
tags: ['oop', 'encapsulation']
course: c-sharp
---

## Why hide anything?

If every field and method is public, any code anywhere can change anything. A class becomes impossible to reason about because its state can be altered from a thousand places. **Encapsulation** means a class keeps its internals private and exposes only a small, safe surface. Access modifiers are how you draw that line.

## The five modifiers

| Modifier | Who can access |
| --- | --- |
| `public` | Anyone, anywhere |
| `private` | Only code inside the same class |
| `protected` | The same class and classes that inherit from it |
| `internal` | Any code in the same project (assembly) |
| `protected internal` | Same project, or subclasses anywhere |
| `private protected` | Subclasses in the same project only |

You will use the first four constantly and the last two almost never.

## private is the default for members

If you write no modifier on a field or method, it is `private`:

```csharp
class Account
{
    decimal balance;              // private
    void Audit() { }              // private

    public decimal GetBalance() => balance;
}
```

Write `private` explicitly anyway. It tells readers you chose it on purpose.

## public: the interface of the class

Anything `public` is a promise. Other code will depend on it, so changing it later may break them. Keep the public surface as small as possible:

```csharp
class Account
{
    private decimal balance;
    private List<string> history = new();

    public decimal Balance => balance;

    public void Deposit(decimal amount)
    {
        if (amount <= 0) throw new ArgumentException("Must be positive");
        balance += amount;
        Log($"Deposit {amount}");
    }

    private void Log(string entry) => history.Add($"{DateTime.Now}: {entry}");
}
```

`Log` and `history` are implementation details. Callers do not need them, and hiding them means you can change how logging works without touching anyone else.

## protected: for subclasses

`protected` members are hidden from the outside but visible to classes that inherit. Use it for helpers that derived classes need:

```csharp
class Shape
{
    protected string Describe(double area) => $"{GetType().Name} with area {area:F1}";
}

class Circle : Shape
{
    public double Radius { get; set; }
    public string Info() => Describe(Math.PI * Radius * Radius);   // allowed
}

var c = new Circle { Radius = 2 };
// c.Describe(1);   // error: protected
```

## internal: for the whole project

`internal` means "anyone in this project, nobody outside it". It is the default for classes if you write no modifier:

```csharp
internal class JsonHelper     // usable across this project, invisible to other projects
{
    public static string Serialize(object o) => "...";
}
```

When you build a library, `internal` lets you share helper classes between your own files without making them part of the public API.

## Class level modifiers

Top level classes can be `public` or `internal` only. Nested classes can use any modifier:

```csharp
public class Outer
{
    private class Secret { }        // only Outer can use it
    protected class ForChildren { }
    public class Shared { }
}
```

## Access modifiers on properties

A property can have a more restrictive setter than getter, which is one of the most useful combinations:

```csharp
public int Count { get; private set; }
public string Id { get; protected set; }
```

The accessor modifier must be **more** restrictive than the property itself.

## A worked example

```csharp
public class Thermostat
{
    private double target = 20;                 // hidden state
    protected double Tolerance { get; set; } = 0.5;   // for subclasses
    internal int SensorId { get; set; }         // for the rest of this project

    public double Target                        // the public surface
    {
        get => target;
        set
        {
            if (value < 5 || value > 30)
                throw new ArgumentOutOfRangeException(nameof(value), "5 to 30 only");
            target = value;
        }
    }

    public bool NeedsHeating(double current) => current < target - Tolerance;
}
```

The rest of the program can set a target and ask whether heating is needed. It cannot bypass the range check, cannot see the tolerance and cannot mess with the sensor id unless it is in the same project.

## A simple rule

Start with `private`. Widen to `protected` if a subclass needs it, `internal` if another class in the project needs it, and `public` only when it is part of what the class is for. It is easy to make something more visible later. Making it less visible breaks callers.

## Quick recap

- `public` is visible everywhere, `private` only inside the class.
- `protected` adds subclasses, `internal` adds the whole project.
- Members default to `private`, classes default to `internal`.
- Keep the public surface small so the class is easy to change and hard to misuse.
- A property can have a `private set` or `protected set` for controlled writes.
- Start private and widen only when there is a reason.

<code id="code-content" class="language-csharp">
// Access modifiers in action
public class Thermostat
{
    private double target = 20;                        // class only
    protected double Tolerance { get; set; } = 0.5;    // class and subclasses
    internal int SensorId { get; set; }                // whole project
    public double Target                               // everyone
    {
        get =&gt; target;
        set
        {
            if (value &lt; 5 || value &gt; 30)
                throw new ArgumentOutOfRangeException(nameof(value), "5 to 30 only");
            target = value;
        }
    }
    public bool NeedsHeating(double current) =&gt; current &lt; target - Tolerance;
    private void Log(string msg) =&gt; Console.WriteLine($"[log] {msg}");
    public void Report(double current)
    {
        Log($"current {current}, target {target}");    // private helper used internally
    }
}
public class SmartThermostat : Thermostat
{
    public void MakeStrict() =&gt; Tolerance = 0.1;       // protected member is visible here
}
var t = new SmartThermostat { SensorId = 7 };         // internal: same project, fine
t.Target = 22;                                         // public setter with validation
t.MakeStrict();
Console.WriteLine(t.NeedsHeating(21.85));              // True with strict tolerance
t.Report(21.85);
// t.Tolerance = 1;      // error: protected
// t.target = 50;        // error: private
// t.Log("x");           // error: private
try
{
    t.Target = 40;                                     // rejected by the setter
}
catch (ArgumentOutOfRangeException ex)
{
    Console.WriteLine(ex.ParamName);                   // value
}
</code></pre>
