---
publishDate: 2026-04-17T11:31
title: Generic Constraints
slug: generic-constraints
metadescription: Use where clauses to tell the compiler what a type parameter can do, with interface, class, struct, new(), base class and notnull constraints, plus generic maths with static abstract members.
updateDate: 2026-09-05T11:31
author: ['bishal-biswas']
level: 3
tags: ['generics', 'constraints']
course: c-sharp
---

## The limitation of plain T

Inside a generic class or method, the compiler knows nothing about `T` except that it is a type. So this does not compile:

```csharp
static T Max<T>(T a, T b)
{
    return a > b ? a : b;   // error: operator > cannot be applied to T
}
```

There is no guarantee that `T` supports `>`. A **constraint** tells the compiler what `T` must be able to do, which unlocks those members inside the method.

## The where clause

Constraints go after the parameter list with `where`:

```csharp
static T Max<T>(T a, T b) where T : IComparable<T>
{
    return a.CompareTo(b) > 0 ? a : b;
}

Console.WriteLine(Max(3, 9));           // 9
Console.WriteLine(Max("pear", "apple"));   // pear
// Max(new object(), new object());     // error: object is not IComparable<object>
```

Now `T` must implement `IComparable<T>`, so `CompareTo` is available, and callers can only pass types that qualify.

## Interface constraints

The most common kind. Require one or more interfaces:

```csharp
interface IEntity
{
    int Id { get; }
}

class Repository<T> where T : IEntity
{
    private readonly Dictionary<int, T> items = new();

    public void Add(T item) => items[item.Id] = item;   // Id is available because of the constraint
    public T? Get(int id) => items.GetValueOrDefault(id);
}
```

Several constraints are separated by commas:

```csharp
static void Process<T>(T item) where T : IEntity, IComparable<T>
```

## Base class constraints

Require that `T` inherits from a class:

```csharp
class Animal { public string Name { get; set; } = ""; }
class Dog : Animal { }

static void PrintNames<T>(List<T> animals) where T : Animal
{
    foreach (T a in animals) Console.WriteLine(a.Name);
}

PrintNames(new List<Dog> { new() { Name = "Rex" } });
```

## class and struct constraints

`where T : class` means `T` must be a reference type. `where T : struct` means a value type:

```csharp
static bool IsNull<T>(T value) where T : class => value is null;

static T? FirstOrNull<T>(List<T> list) where T : struct
{
    return list.Count > 0 ? list[0] : null;   // T? means Nullable<T> here
}
```

The struct constraint is what makes `T?` mean `Nullable<T>` inside the method. Without it, `T?` for a struct would not compile.

## The new() constraint

Allows generic code to create instances with `new T()`. The type must have a public parameterless constructor:

```csharp
static T Create<T>() where T : new()
{
    return new T();
}

static List<T> MakeMany<T>(int count) where T : new()
{
    var list = new List<T>();
    for (int i = 0; i < count; i++) list.Add(new T());
    return list;
}

var dogs = MakeMany<Dog>(3);
```

`new()` must be the last constraint in the list when combined with others.

## The notnull constraint

`where T : notnull` says `T` cannot be a nullable type. It is mostly used for dictionary keys, and it produces a warning rather than an error:

```csharp
class Cache<TKey, TValue> where TKey : notnull
{
    private readonly Dictionary<TKey, TValue> store = new();
}
```

## Combining constraints

```csharp
static T Clone<T>(T source) where T : class, ICloneable, new()
{
    return (T)source.Clone();
}
```

Order: base class or `class` or `struct` first, then interfaces, then `new()` last.

## Constraints on generic classes

Each type parameter gets its own `where`:

```csharp
class Mapper<TSource, TTarget>
    where TSource : class
    where TTarget : class, new()
{
    public TTarget Map(TSource source)
    {
        var target = new TTarget();
        // copy matching properties, reflection covered later
        return target;
    }
}
```

## Generic maths with static abstract members

Since .NET 7 interfaces can declare **static abstract** members, and the numeric types implement interfaces such as `INumber<T>`. This finally lets you write maths over any number type:

```csharp
using System.Numerics;

static T Sum<T>(IEnumerable<T> values) where T : INumber<T>
{
    T total = T.Zero;
    foreach (T v in values) total += v;
    return total;
}

Console.WriteLine(Sum(new[] { 1, 2, 3 }));          // 6
Console.WriteLine(Sum(new[] { 1.5, 2.5 }));         // 4
Console.WriteLine(Sum(new[] { 10m, 0.5m }));        // 10.5
```

`T.Zero` and `+=` work because `INumber<T>` guarantees them. Before this, you needed one overload per numeric type or a slow `dynamic` trick.

## Choosing constraints

Only add the constraints you actually use inside the code. A constraint you do not need shuts out callers for no reason. Start with none and let the compiler errors tell you which you need.

## Quick recap

- Plain `T` only exposes the members of `object`. Constraints unlock more.
- `where T : ISomething` is the everyday constraint and lets you call interface members.
- `class`, `struct` and a base class constrain the kind of type.
- `new()` lets generic code create instances and must come last.
- `notnull` restricts keys and similar to non nullable types.
- `INumber<T>` and static abstract members enable generic maths.

<code id="code-content" class="language-csharp">
// Generic constraints in C#
using System.Numerics;
// Interface constraint unlocks CompareTo
static T Max&lt;T&gt;(T a, T b) where T : IComparable&lt;T&gt;
    =&gt; a.CompareTo(b) &gt; 0 ? a : b;
Console.WriteLine(Max(3, 9));               // 9
Console.WriteLine(Max("pear", "apple"));    // pear
// Base class + new() constraints
class Animal { public string Name { get; set; } = "unnamed"; }
class Dog : Animal { }
static List&lt;T&gt; MakeMany&lt;T&gt;(int count) where T : Animal, new()
{
    var list = new List&lt;T&gt;();
    for (int i = 0; i &lt; count; i++)
        list.Add(new T { Name = $"{typeof(T).Name} {i + 1}" });   // new T() allowed
    return list;
}
foreach (var d in MakeMany&lt;Dog&gt;(2))
    Console.WriteLine(d.Name);              // Dog 1, Dog 2
// struct constraint makes T? mean Nullable&lt;T&gt;
static T? FirstOrNull&lt;T&gt;(List&lt;T&gt; list) where T : struct
    =&gt; list.Count &gt; 0 ? list[0] : null;
Console.WriteLine(FirstOrNull(new List&lt;int&gt;()) is null);   // True
Console.WriteLine(FirstOrNull(new List&lt;int&gt; { 7 }));       // 7
// Repository restricted to entities with an Id
interface IEntity { int Id { get; } }
record Product(int Id, string Name) : IEntity;
class Repository&lt;T&gt; where T : IEntity
{
    private readonly Dictionary&lt;int, T&gt; items = new();
    public void Add(T item) =&gt; items[item.Id] = item;     // Id is known to exist
    public T? Get(int id) =&gt; items.GetValueOrDefault(id);
}
var repo = new Repository&lt;Product&gt;();
repo.Add(new Product(1, "Keyboard"));
Console.WriteLine(repo.Get(1)?.Name);       // Keyboard
// Generic maths with INumber&lt;T&gt;
static T Sum&lt;T&gt;(IEnumerable&lt;T&gt; values) where T : INumber&lt;T&gt;
{
    T total = T.Zero;
    foreach (T v in values) total += v;
    return total;
}
Console.WriteLine(Sum(new[] { 1, 2, 3 }));       // 6
Console.WriteLine(Sum(new[] { 1.5, 2.5 }));      // 4
Console.WriteLine(Sum(new[] { 10m, 0.5m }));     // 10.5
</code></pre>
