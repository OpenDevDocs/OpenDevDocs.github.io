---
publishDate: 2026-04-15T11:27
title: Delegates
slug: delegates
metadescription: Store methods in variables with delegates, pass behaviour as parameters, combine multicast delegates and use the built in Action, Func and Predicate types.
updateDate: 2026-09-05T11:27
author: ['bishal-biswas']
level: 3
tags: ['delegates', 'functional']
course: c-sharp
---

## A variable that holds a method

So far variables have held data. A **delegate** is a type whose variables hold a **method**. You can pass it around, store it in a list and call it later, without knowing in advance which method it will be.

```csharp
delegate int MathOperation(int a, int b);

static int Add(int a, int b) => a + b;
static int Multiply(int a, int b) => a * b;

MathOperation op = Add;
Console.WriteLine(op(2, 3));   // 5

op = Multiply;
Console.WriteLine(op(2, 3));   // 6
```

The `delegate` line declares a type: any method that takes two `int` and returns an `int` fits. `op` can then hold any method with that shape.

## Passing behaviour into a method

The real power is letting a caller decide part of what a method does:

```csharp
delegate bool Filter(int number);

static List<int> Where(List<int> source, Filter test)
{
    var result = new List<int>();
    foreach (int n in source)
    {
        if (test(n)) result.Add(n);
    }
    return result;
}

static bool IsEven(int n) => n % 2 == 0;
static bool IsBig(int n) => n > 10;

var numbers = new List<int> { 1, 4, 9, 12, 15, 20 };
Console.WriteLine(string.Join(" ", Where(numbers, IsEven)));   // 4 12 20
Console.WriteLine(string.Join(" ", Where(numbers, IsBig)));    // 12 15 20
```

`Where` does the looping once. The test is plugged in. This is the idea behind all of LINQ.

## The built in delegate types

You rarely declare your own delegate type any more. .NET provides generic ones that cover almost every shape:

### Action: returns nothing

```csharp
Action greet = () => Console.WriteLine("Hello");
Action<string> greetName = name => Console.WriteLine($"Hello {name}");
Action<string, int> report = (name, score) => Console.WriteLine($"{name}: {score}");

greet();
greetName("Asha");
report("Ravi", 90);
```

`Action<T1, T2, ...>` takes up to sixteen parameters and returns `void`.

### Func: returns a value

The **last** type parameter is the return type:

```csharp
Func<int, int> square = n => n * n;
Func<int, int, int> add = (a, b) => a + b;
Func<string> now = () => DateTime.Now.ToString("HH:mm");

Console.WriteLine(square(5));    // 25
Console.WriteLine(add(2, 3));    // 5
Console.WriteLine(now());
```

### Predicate: returns bool

`Predicate<T>` is the same as `Func<T, bool>` and is used by list methods such as `Find` and `RemoveAll`:

```csharp
Predicate<int> isEven = n => n % 2 == 0;
var numbers = new List<int> { 1, 2, 3, 4 };
Console.WriteLine(numbers.Find(isEven));   // 2
```

The `=>` lambda syntax is covered fully in a later topic. Here it is simply the quickest way to make a delegate.

## Rewriting Where with Func

```csharp
static List<int> Where(List<int> source, Func<int, bool> test)
{
    var result = new List<int>();
    foreach (int n in source)
        if (test(n)) result.Add(n);
    return result;
}

Where(numbers, n => n > 10);
```

Same method, no custom delegate type needed.

## Multicast delegates

A delegate can hold **several** methods. Use `+=` to add and `-=` to remove. Calling it calls every method in order:

```csharp
Action<string> notify = msg => Console.WriteLine($"Email: {msg}");
notify += msg => Console.WriteLine($"SMS: {msg}");
notify += msg => Console.WriteLine($"Push: {msg}");

notify("Order shipped");
// Email: Order shipped
// SMS: Order shipped
// Push: Order shipped
```

This is the foundation of events, the next topic. With a `Func`, only the return value of the last method is kept, so multicast is mainly useful for `Action`.

## Null delegates

An uninitialised delegate is `null`, and calling it throws. Use the null conditional invoke:

```csharp
Action? onDone = null;
onDone?.Invoke();   // does nothing, no exception
```

## Delegates as fields and properties

A class can expose a delegate so callers customise its behaviour:

```csharp
class Button
{
    public Action? OnClick { get; set; }

    public void Click()
    {
        Console.WriteLine("Button pressed");
        OnClick?.Invoke();
    }
}

var button = new Button();
button.OnClick = () => Console.WriteLine("Saving...");
button.Click();
```

The button knows nothing about saving. It just calls whatever it was given.

## Method groups

When a method already exists, you can pass its name directly without a lambda. This is called a **method group** conversion:

```csharp
static void Print(string s) => Console.WriteLine(s);

var words = new List<string> { "a", "b" };
words.ForEach(Print);   // same as words.ForEach(s => Print(s));
```

## Quick recap

- A delegate is a type that holds a method with a particular signature.
- Passing a delegate lets the caller plug behaviour into a method.
- `Action` returns nothing, `Func` returns a value, `Predicate` returns `bool`.
- Delegates can be combined with `+=` to call several methods at once.
- Use `?.Invoke()` to call a delegate that might be null.
- A method name on its own converts to a delegate automatically.

<code id="code-content" class="language-csharp">
// Delegates in C#
// A custom delegate type: any method taking two ints and returning an int
delegate int MathOperation(int a, int b);
static int Add(int a, int b) =&gt; a + b;
static int Multiply(int a, int b) =&gt; a * b;
MathOperation op = Add;
Console.WriteLine(op(2, 3));            // 5
op = Multiply;
Console.WriteLine(op(2, 3));            // 6
// Passing behaviour into a method with Func
static List&lt;int&gt; Where(List&lt;int&gt; source, Func&lt;int, bool&gt; test)
{
    var result = new List&lt;int&gt;();
    foreach (int n in source)
        if (test(n)) result.Add(n);
    return result;
}
var numbers = new List&lt;int&gt; { 1, 4, 9, 12, 15, 20 };
Console.WriteLine(string.Join(" ", Where(numbers, n =&gt; n % 2 == 0)));   // 4 12 20
Console.WriteLine(string.Join(" ", Where(numbers, n =&gt; n &gt; 10)));       // 12 15 20
// Built in delegate types
Action&lt;string&gt; log = msg =&gt; Console.WriteLine($"[log] {msg}");
Func&lt;int, int&gt; square = n =&gt; n * n;
Predicate&lt;int&gt; isBig = n =&gt; n &gt; 10;
log("started");
Console.WriteLine(square(7));                    // 49
Console.WriteLine(numbers.FindAll(isBig).Count); // 3
// Multicast: one call, several methods
Action&lt;string&gt; notify = m =&gt; Console.WriteLine($"Email: {m}");
notify += m =&gt; Console.WriteLine($"SMS: {m}");
notify("Order shipped");
// A class exposing a delegate for customisation
class Button
{
    public Action? OnClick { get; set; }
    public void Click() =&gt; OnClick?.Invoke();    // safe if nobody subscribed
}
var button = new Button();
button.OnClick = () =&gt; Console.WriteLine("Saving...");
button.Click();
</code></pre>
