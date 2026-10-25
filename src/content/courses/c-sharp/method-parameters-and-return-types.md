---
publishDate: 2026-04-07T11:11
title: Method Parameters and Return Types
slug: method-parameters-and-return-types
metadescription: Master optional and named parameters, params arrays, ref and out, passing by value versus reference, tuples for multiple returns and method overloading.
updateDate: 2026-09-05T11:11
author: ['bishal-biswas']
level: 1
tags: ['methods', 'parameters']
course: c-sharp
---

## Passing by value

By default, C# copies the argument into the parameter. Changing the parameter does not touch the caller's variable:

```csharp
static void TryToChange(int number)
{
    number = 100;
}

int x = 5;
TryToChange(x);
Console.WriteLine(x);   // 5, unchanged
```

This is true for all value types: `int`, `double`, `bool`, `struct` and so on.

## Reference types behave differently

When you pass an object, the **reference** is copied, not the object. Both names point to the same thing, so changes to its contents are visible to the caller:

```csharp
static void AddItem(List<string> items)
{
    items.Add("new");
}

var list = new List<string>();
AddItem(list);
Console.WriteLine(list.Count);   // 1
```

But reassigning the parameter to a brand new object does not affect the caller:

```csharp
static void Replace(List<string> items)
{
    items = new List<string> { "other" };   // only changes the local copy of the reference
}
```

## Optional parameters

Give a parameter a default value and callers can leave it out:

```csharp
static void Greet(string name, string greeting = "Hello")
{
    Console.WriteLine($"{greeting}, {name}!");
}

Greet("Asha");            // Hello, Asha!
Greet("Asha", "Namaste"); // Namaste, Asha!
```

Optional parameters must come after all required ones.

## Named arguments

You can name arguments at the call site. This makes calls with many parameters readable and lets you skip optional ones in the middle:

```csharp
static void CreateUser(string name, int age = 18, bool isAdmin = false)
{
    Console.WriteLine($"{name}, {age}, admin: {isAdmin}");
}

CreateUser("Ravi", isAdmin: true);      // skips age
CreateUser(age: 30, name: "Meera");     // any order
```

## params for a variable number of arguments

`params` lets a method accept any number of values, which arrive as an array:

```csharp
static int Sum(params int[] numbers)
{
    int total = 0;
    foreach (int n in numbers) total += n;
    return total;
}

Console.WriteLine(Sum());            // 0
Console.WriteLine(Sum(1, 2, 3));     // 6
Console.WriteLine(Sum(new[] { 4, 5 }));   // 9, an array works too
```

`params` must be the last parameter.

## ref: share the caller's variable

`ref` passes the variable itself, not a copy. The method can change it and the caller sees the change:

```csharp
static void Double(ref int number)
{
    number *= 2;
}

int value = 21;
Double(ref value);
Console.WriteLine(value);   // 42
```

The keyword is required at both the definition and the call, so it is always obvious when a method can change your variable. Use `ref` sparingly. Returning a new value is usually clearer.

## out: return extra values

`out` is like `ref` but the method **must** assign the parameter before returning. The caller does not need to initialise it. This is how `TryParse` works:

```csharp
static bool TryDivide(int a, int b, out int result)
{
    if (b == 0)
    {
        result = 0;
        return false;
    }
    result = a / b;
    return true;
}

if (TryDivide(10, 2, out int answer))
{
    Console.WriteLine(answer);   // 5
}
```

Declaring the variable inline with `out int answer` is the modern style.

## in: read only reference

`in` passes a reference but forbids changes. It is a performance trick for large structs and you will rarely need it early on:

```csharp
static double Length(in Vector3 v) => Math.Sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z);
```

## Returning multiple values with tuples

Instead of `out`, a method can return a **tuple**, which is a small bundle of named values:

```csharp
static (int min, int max) MinMax(int[] numbers)
{
    int min = numbers[0], max = numbers[0];
    foreach (int n in numbers)
    {
        if (n < min) min = n;
        if (n > max) max = n;
    }
    return (min, max);
}

var stats = MinMax(new[] { 4, 9, 1, 7 });
Console.WriteLine($"{stats.min} to {stats.max}");   // 1 to 9

// Or unpack straight into variables
var (low, high) = MinMax(new[] { 4, 9, 1, 7 });
```

Tuples are the cleanest way to return two or three related values. For anything bigger, create a class or record.

## Method overloading

Several methods can share a name if their parameter lists differ. The compiler picks the right one from the arguments:

```csharp
static double Area(double radius) => Math.PI * radius * radius;
static double Area(double width, double height) => width * height;

Console.WriteLine(Area(2));        // circle
Console.WriteLine(Area(3, 4));     // rectangle
```

Overloads must differ by parameter **types or count**. Differing only by return type is not allowed. `Console.WriteLine` has around twenty overloads, which is why it accepts almost anything.

## Quick recap

- Value types are copied into parameters, reference types share the same object.
- Optional parameters have defaults, and named arguments make calls readable.
- `params` accepts any number of arguments as an array.
- `ref` lets a method change the caller's variable, `out` forces it to assign one.
- Return a tuple like `(int min, int max)` to hand back several values.
- Overloading gives one name several parameter lists.

<code id="code-content" class="language-csharp">
// Method parameters and return types
// Optional parameters and named arguments
static void CreateUser(string name, int age = 18, bool isAdmin = false)
    =&gt; Console.WriteLine($"{name}, {age}, admin: {isAdmin}");
CreateUser("Asha");                          // Asha, 18, admin: False
CreateUser("Ravi", isAdmin: true);           // Ravi, 18, admin: True
// params: any number of arguments
static int Sum(params int[] numbers)
{
    int total = 0;
    foreach (int n in numbers) total += n;
    return total;
}
Console.WriteLine(Sum(1, 2, 3, 4));          // 10
// Value types are copied
static void TryToChange(int n) =&gt; n = 100;
int x = 5;
TryToChange(x);
Console.WriteLine(x);                        // 5
// ref shares the caller's variable
static void Double(ref int n) =&gt; n *= 2;
Double(ref x);
Console.WriteLine(x);                        // 10
// out returns an extra value, must be assigned
static bool TryDivide(int a, int b, out int result)
{
    result = b == 0 ? 0 : a / b;
    return b != 0;
}
if (TryDivide(10, 2, out int answer))
    Console.WriteLine(answer);               // 5
// Tuples return several values at once
static (int min, int max) MinMax(int[] values)
{
    int min = values[0], max = values[0];
    foreach (int v in values)
    {
        if (v &lt; min) min = v;
        if (v &gt; max) max = v;
    }
    return (min, max);
}
var (low, high) = MinMax(new[] { 4, 9, 1, 7 });
Console.WriteLine($"{low} to {high}");       // 1 to 9
// Overloading: same name, different parameters
static double Area(double r) =&gt; Math.PI * r * r;
static double Area(double w, double h) =&gt; w * h;
Console.WriteLine(Area(3, 4));               // 12
</code></pre>
