---
publishDate: 2026-04-17T11:30
title: Generics
slug: generics
metadescription: Write classes and methods that work with any type while staying type safe, understand type parameters and inference, and see why generics beat object and casting.
updateDate: 2026-09-05T11:30
author: ['bishal-biswas']
level: 3
tags: ['generics', 'types']
course: c-sharp
---

## The problem generics solve

Suppose you want a class that holds a pair of values. Without generics you have two bad options. Write one class per type:

```csharp
class IntPair { public int First; public int Second; }
class StringPair { public string First; public string Second; }
// and so on forever
```

Or use `object` and give up type safety:

```csharp
class ObjectPair { public object First; public object Second; }

var p = new ObjectPair { First = 1, Second = "two" };
int n = (int)p.Second;   // compiles, crashes at run time
```

Generics give you one class that works for **any** type and still lets the compiler check everything.

## A generic class

```csharp
class Pair<T>
{
    public T First { get; set; }
    public T Second { get; set; }

    public Pair(T first, T second)
    {
        First = first;
        Second = second;
    }

    public void Swap() => (First, Second) = (Second, First);
}
```

`T` is a **type parameter**, a placeholder filled in when the class is used:

```csharp
var ints = new Pair<int>(1, 2);
var words = new Pair<string>("hello", "world");

ints.Swap();
Console.WriteLine(ints.First);      // 2
Console.WriteLine(words.Second);    // world

// var bad = new Pair<int>(1, "two");   // error: cannot convert string to int
```

`Pair<int>` and `Pair<string>` are two distinct types. Each knows exactly what it holds.

## You have been using generics all along

`List<T>`, `Dictionary<TKey, TValue>`, `HashSet<T>`, `Queue<T>`, `Func<T, TResult>` and `Action<T>` are all generic. When you wrote `List<string>`, you filled in `T`.

## Multiple type parameters

```csharp
class KeyValue<TKey, TValue>
{
    public TKey Key { get; }
    public TValue Value { get; }

    public KeyValue(TKey key, TValue value)
    {
        Key = key;
        Value = value;
    }
}

var entry = new KeyValue<string, int>("age", 30);
```

The convention is `T` for a single parameter and `T` plus a descriptive word for several.

## Generic methods

A method can have its own type parameter, independent of its class:

```csharp
static void Swap<T>(ref T a, ref T b)
{
    T temp = a;
    a = b;
    b = temp;
}

int x = 1, y = 2;
Swap(ref x, ref y);           // T inferred as int
Console.WriteLine($"{x} {y}");   // 2 1

string s1 = "a", s2 = "b";
Swap(ref s1, ref s2);         // T inferred as string
```

The compiler **infers** `T` from the arguments, so you rarely write `Swap<int>(...)` by hand.

### A useful generic method

```csharp
static T FirstOrDefault<T>(List<T> items, Func<T, bool> test, T fallback)
{
    foreach (T item in items)
    {
        if (test(item)) return item;
    }
    return fallback;
}

var nums = new List<int> { 3, 8, 12 };
Console.WriteLine(FirstOrDefault(nums, n => n > 5, -1));    // 8
Console.WriteLine(FirstOrDefault(nums, n => n > 50, -1));   // -1
```

## Generic interfaces

Interfaces can be generic too, and most of .NET's core interfaces are:

```csharp
interface IRepository<T>
{
    void Add(T item);
    T? GetById(int id);
    List<T> GetAll();
}

class InMemoryRepository<T> : IRepository<T>
{
    private readonly List<T> items = new();

    public void Add(T item) => items.Add(item);
    public T? GetById(int id) => id < items.Count ? items[id] : default;
    public List<T> GetAll() => new(items);
}

var users = new InMemoryRepository<string>();
users.Add("Asha");
Console.WriteLine(users.GetById(0));   // Asha
```

## The default keyword

Inside generic code you cannot write `null` or `0` because you do not know what `T` is. `default` gives the default value for whatever `T` turns out to be: `null` for reference types, `0` for numbers, `false` for `bool`:

```csharp
static T GetOrDefault<T>(T[] array, int index)
{
    return index < array.Length ? array[index] : default!;
}
```

## What generics cannot do without help

Inside `Pair<T>`, you cannot call `First + Second` or `First.CompareTo(Second)`. The compiler only knows `T` is some type, so only `object` members are available. To use more, you add **constraints**, which the next topic covers.

## Why generics are fast

When you use `List<int>`, the runtime creates a specialised version that stores `int` directly. There is no boxing and no casting. Generic code is as fast as hand written code for each type, which is why `List<T>` replaced the old `ArrayList` entirely.

## Naming and reading generics

- `T` alone for one parameter: `List<T>`.
- `T` plus a word for clarity: `Dictionary<TKey, TValue>`, `Func<TInput, TResult>`.
- Read `Dictionary<string, List<int>>` from the outside in: a dictionary whose keys are strings and whose values are lists of ints.

## Quick recap

- Generics let one class or method work with any type while staying fully type checked.
- `T` is a type parameter, filled in when the type is used: `Pair<int>`, `Pair<string>`.
- Generic methods infer their type parameters from the arguments.
- Generic interfaces such as `IRepository<T>` describe contracts over any type.
- `default` stands in for the default value of an unknown `T`.
- Generic code is as fast as type specific code because the runtime specialises it.

<code id="code-content" class="language-csharp">
// Generics in C#
// A generic class: T is filled in by the user
class Pair&lt;T&gt;
{
    public T First { get; set; }
    public T Second { get; set; }
    public Pair(T first, T second) =&gt; (First, Second) = (first, second);
    public void Swap() =&gt; (First, Second) = (Second, First);
    public override string ToString() =&gt; $"({First}, {Second})";
}
var ints = new Pair&lt;int&gt;(1, 2);
var words = new Pair&lt;string&gt;("hello", "world");
ints.Swap();
Console.WriteLine(ints);                 // (2, 1)
Console.WriteLine(words);                // (hello, world)
// A generic method with type inference
static T FirstMatch&lt;T&gt;(IEnumerable&lt;T&gt; items, Func&lt;T, bool&gt; test, T fallback)
{
    foreach (T item in items)
        if (test(item)) return item;
    return fallback;
}
var nums = new List&lt;int&gt; { 3, 8, 12 };
Console.WriteLine(FirstMatch(nums, n =&gt; n &gt; 5, -1));        // 8
Console.WriteLine(FirstMatch(new[] { "a", "bb" }, n =&gt; n.Length &gt; 1, "none"));   // bb
// A generic interface and implementation
interface IRepository&lt;T&gt;
{
    void Add(T item);
    T? GetById(int id);
    int Count { get; }
}
class InMemoryRepository&lt;T&gt; : IRepository&lt;T&gt;
{
    private readonly List&lt;T&gt; items = new();
    public void Add(T item) =&gt; items.Add(item);
    public T? GetById(int id) =&gt; id &lt; items.Count ? items[id] : default;   // default for unknown T
    public int Count =&gt; items.Count;
}
record User(string Name);
var repo = new InMemoryRepository&lt;User&gt;();
repo.Add(new User("Asha"));
repo.Add(new User("Ravi"));
Console.WriteLine(repo.GetById(1)?.Name);   // Ravi
Console.WriteLine(repo.GetById(9) is null); // True
Console.WriteLine(repo.Count);              // 2
</code></pre>
