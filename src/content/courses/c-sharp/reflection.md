---
publishDate: 2026-04-23T11:41
title: Reflection
slug: reflection
metadescription: Inspect types, properties and methods at run time with System.Reflection, create objects and invoke members dynamically, understand the cost, and see where frameworks rely on it.
updateDate: 2026-09-05T11:41
author: ['bishal-biswas']
level: 3
tags: ['reflection', 'metadata']
course: c-sharp
---

## Code that looks at code

Normally you know the types you work with when you write the program. **Reflection** lets a program examine types at **run time**: what properties does this object have, what methods, what attributes, and then read, write or call them by name.

It is how JSON serialisers turn any object into text, how test frameworks find your test methods, how dependency injection containers build objects, and how ORMs map classes to tables. You will not use it every day, but you will use libraries built on it every day.

## Getting a Type

Everything starts with a `System.Type` object, the description of a type:

```csharp
Type t1 = typeof(string);               // from a type name at compile time
Type t2 = "hello".GetType();            // from an object at run time
Type? t3 = Type.GetType("System.Int32"); // from a string, null if not found

Console.WriteLine(t1.Name);           // String
Console.WriteLine(t1.FullName);       // System.String
Console.WriteLine(t1.Namespace);      // System
Console.WriteLine(t1.IsClass);        // True
Console.WriteLine(t2.BaseType?.Name); // Object
```

## Listing members

```csharp
class Person
{
    public string Name { get; set; } = "";
    public int Age { get; set; }
    private string secret = "hidden";

    public string Greet(string greeting) => $"{greeting}, {Name}";
}

Type type = typeof(Person);

foreach (var prop in type.GetProperties())
{
    Console.WriteLine($"Property {prop.Name} : {prop.PropertyType.Name}");
}
// Property Name : String
// Property Age : Int32

foreach (var method in type.GetMethods())
{
    Console.WriteLine($"Method {method.Name}");
}
// Greet, plus get_Name, set_Name, ToString, Equals and the rest inherited from object
```

By default only public members are returned. Pass **binding flags** to see more:

```csharp
using System.Reflection;

var privateFields = type.GetFields(BindingFlags.NonPublic | BindingFlags.Instance);
foreach (var f in privateFields) Console.WriteLine(f.Name);   // secret
```

## Reading and writing properties by name

```csharp
var person = new Person { Name = "Asha", Age = 30 };

PropertyInfo ageProp = typeof(Person).GetProperty("Age")!;

object? value = ageProp.GetValue(person);
Console.WriteLine(value);            // 30

ageProp.SetValue(person, 31);
Console.WriteLine(person.Age);       // 31
```

This is the engine inside every "map this object to a dictionary" or "copy matching properties" helper:

```csharp
static Dictionary<string, object?> ToDictionary(object obj)
{
    return obj.GetType()
        .GetProperties()
        .ToDictionary(p => p.Name, p => p.GetValue(obj));
}

foreach (var (key, val) in ToDictionary(person))
{
    Console.WriteLine($"{key} = {val}");
}
```

## Invoking methods

```csharp
MethodInfo greet = typeof(Person).GetMethod("Greet")!;

object? result = greet.Invoke(person, new object[] { "Hello" });
Console.WriteLine(result);   // Hello, Asha
```

Arguments go in an `object[]`, and the return comes back as `object`. Static methods pass `null` as the instance.

## Creating objects

```csharp
Type type = typeof(Person);

object instance = Activator.CreateInstance(type)!;

// With constructor arguments
object list = Activator.CreateInstance(typeof(List<int>), 100)!;   // capacity 100

// From a type name in a config file
Type? pluginType = Type.GetType("MyApp.Plugins.CsvExporter, MyApp");
var plugin = (IExporter)Activator.CreateInstance(pluginType!)!;
```

That last form is how plugin systems load implementations chosen at run time.

## Generic types at run time

```csharp
Type open = typeof(List<>);                          // generic definition, no argument
Type closed = open.MakeGenericType(typeof(string));  // List<string>
var list = Activator.CreateInstance(closed);

Console.WriteLine(typeof(List<int>).IsGenericType);              // True
Console.WriteLine(typeof(List<int>).GetGenericArguments()[0]);   // System.Int32
```

## Assemblies

An assembly is a compiled `.dll` or `.exe`. You can scan every type in one:

```csharp
Assembly current = Assembly.GetExecutingAssembly();

var testClasses = current.GetTypes()
    .Where(t => t.Name.EndsWith("Tests") && t.IsClass);

foreach (var t in testClasses) Console.WriteLine(t.FullName);
```

Test runners do exactly this, then look for methods with a `[Test]` or `[Fact]` attribute. Attributes are the next topic and are the usual partner of reflection.

## Reading attributes

```csharp
[Obsolete("Use Person2")]
class Person { }

var attr = typeof(Person).GetCustomAttribute<ObsoleteAttribute>();
Console.WriteLine(attr?.Message);   // Use Person2
```

## The cost

Reflection is slow compared to direct code, often a hundred times slower per call, because every lookup is a string search and every invoke boxes its arguments. Mitigations:

- Cache `PropertyInfo` and `MethodInfo` objects instead of looking them up on every call.
- Build a delegate once with `MethodInfo.CreateDelegate` or expression trees, then call the delegate.
- Use **source generators** for serialisers and mappers, which move the work to compile time. That topic comes later.

Reflection also breaks when code is trimmed for AOT compilation, because the trimmer cannot see what you will ask for by name. Modern libraries lean on source generators for this reason.

## dynamic

The `dynamic` keyword is reflection with nicer syntax. Member lookup happens at run time:

```csharp
dynamic d = new Person { Name = "Ravi" };
Console.WriteLine(d.Name);          // works
Console.WriteLine(d.Missing);       // RuntimeBinderException at run time
```

Useful for interop with COM or scripting languages. Avoid it elsewhere, since you lose every compile time check.

## Quick recap

- Reflection inspects and manipulates types, members and attributes at run time.
- `typeof` and `GetType` give you a `Type`, and `GetProperties`, `GetMethods` and `GetFields` list members.
- `GetValue`, `SetValue` and `Invoke` read, write and call members by name.
- `Activator.CreateInstance` builds objects from a `Type`, including ones named in config.
- It is slow and trimming unfriendly, so cache lookups or prefer source generators.
- Frameworks for serialisation, testing and dependency injection are built on it.

<code id="code-content" class="language-csharp">
// Reflection in C#
using System.Reflection;
class Person
{
    public string Name { get; set; } = "";
    public int Age { get; set; }
    private string secret = "hidden";
    public string Greet(string greeting) =&gt; $"{greeting}, {Name}";
    public static Person Default() =&gt; new() { Name = "Anonymous" };
}
var person = new Person { Name = "Asha", Age = 30 };
Type type = person.GetType();
// Inspect the type
Console.WriteLine($"{type.Name} in {type.Namespace ?? "global"}, base {type.BaseType?.Name}");
foreach (PropertyInfo p in type.GetProperties())
    Console.WriteLine($"  property {p.Name} : {p.PropertyType.Name}");
foreach (FieldInfo f in type.GetFields(BindingFlags.NonPublic | BindingFlags.Instance))
    Console.WriteLine($"  private field {f.Name} = {f.GetValue(person)}");
// Read and write a property by name
PropertyInfo age = type.GetProperty("Age")!;
age.SetValue(person, (int)age.GetValue(person)! + 1);
Console.WriteLine(person.Age);                             // 31
// Invoke methods by name, instance and static
MethodInfo greet = type.GetMethod("Greet")!;
Console.WriteLine(greet.Invoke(person, new object[] { "Hello" }));   // Hello, Asha
MethodInfo factory = type.GetMethod("Default")!;
var made = (Person)factory.Invoke(null, null)!;
Console.WriteLine(made.Name);                              // Anonymous
// Create instances from a Type, including closed generics
var fresh = (Person)Activator.CreateInstance(type)!;
Type listType = typeof(List&lt;&gt;).MakeGenericType(typeof(string));
var list = (System.Collections.IList)Activator.CreateInstance(listType)!;
list.Add("built at run time");
Console.WriteLine($"{listType.Name} with {list.Count} item");
// A generic object to dictionary helper, the core of every serialiser
static Dictionary&lt;string, object?&gt; ToDictionary(object obj)
    =&gt; obj.GetType().GetProperties().ToDictionary(p =&gt; p.Name, p =&gt; p.GetValue(obj));
foreach (var (key, value) in ToDictionary(person))
    Console.WriteLine($"{key} = {value}");
// Scan the current assembly for types
int typeCount = Assembly.GetExecutingAssembly().GetTypes().Count(t =&gt; t.IsClass);
Console.WriteLine($"Classes in this assembly: {typeCount}");
</code></pre>
