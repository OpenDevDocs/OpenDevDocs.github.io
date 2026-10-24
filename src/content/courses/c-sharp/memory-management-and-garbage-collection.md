---
publishDate: 2026-04-20T11:35
title: Memory Management and Garbage Collection
slug: memory-management-and-garbage-collection
metadescription: Understand the stack and the heap, how the .NET garbage collector finds and frees unreachable objects, generations, the large object heap, and how to avoid leaks and unnecessary allocations.
updateDate: 2026-09-05T11:35
author: ['bishal-biswas']
level: 3
tags: ['memory', 'garbage-collection', 'performance']
course: c-sharp
---

## You do not free memory by hand

In C and C++ you allocate memory and must remember to free it. Forget, and the program leaks. Free twice, and it crashes. C# removes that burden. The **garbage collector (GC)** watches every object you create and reclaims the memory once nothing can reach it any more.

That does not mean you can ignore memory. Knowing how the GC works helps you write programs that are fast and do not hold onto things they should have let go.

## The stack and the heap

.NET uses two areas of memory.

**The stack** is a small, fast region tied to method calls. When a method starts, its local variables are pushed on. When it returns, they are popped off. Value types like `int`, `double`, `bool` and structs live here when they are locals.

**The heap** is a large region for objects created with `new`. Class instances, arrays, strings and boxed values live here. The variable on the stack holds only a **reference**, an address pointing into the heap.

```csharp
int count = 5;                       // value on the stack
var list = new List<int>();          // reference on the stack, object on the heap
```

When `count` goes out of scope it is simply gone. When `list` goes out of scope, the reference is gone, but the `List` object on the heap stays until the GC notices nobody points to it.

## Reachability

The GC does not count references. It asks a simpler question: **starting from the roots, can this object be reached?** Roots are things that are definitely alive: local variables on every thread's stack, static fields and a few runtime internals.

```csharp
var a = new Person("Asha");   // reachable through a
var b = a;                    // reachable through a and b
a = null;                     // still reachable through b
b = null;                     // unreachable, eligible for collection
```

Two objects that reference each other but are reachable from nothing else are still garbage. Circular references are not a problem in .NET.

## Generations

Collecting the whole heap every time would be slow. The GC uses the observation that **most objects die young**. The heap is split into generations:

- **Generation 0**: brand new objects. Collected very often and very quickly.
- **Generation 1**: objects that survived one collection. A buffer between young and old.
- **Generation 2**: long lived objects. Collected rarely.

A gen 0 collection only scans gen 0. Survivors are promoted to gen 1, then gen 2. The result is that temporary objects, which are most of what a program creates, are cleaned up cheaply, and long lived objects like caches and configuration are left alone.

```csharp
Console.WriteLine(GC.CollectionCount(0));   // how many gen 0 collections so far
Console.WriteLine(GC.CollectionCount(2));   // usually far fewer
Console.WriteLine(GC.GetGeneration(list));  // which generation an object is in
```

## What a collection does

1. **Mark**: walk from the roots and flag every reachable object.
2. **Sweep**: everything unflagged is garbage.
3. **Compact**: move the survivors together so free space is one contiguous block.

Compacting is why allocation in .NET is so fast. There is no searching for a free slot. New objects go at the end, and the pointer moves forward.

## The large object heap

Objects of 85,000 bytes or more, mostly big arrays, go to the **large object heap (LOH)**. It is collected with gen 2 and is not compacted by default because moving huge blocks is expensive. Allocating many large arrays repeatedly is a common cause of memory growth. Reuse them, or rent from `ArrayPool<T>`:

```csharp
using System.Buffers;

byte[] buffer = ArrayPool<byte>.Shared.Rent(100_000);
try
{
    // use buffer
}
finally
{
    ArrayPool<byte>.Shared.Return(buffer);
}
```

## Leaks in a garbage collected language

A leak in .NET is not forgotten memory. It is memory that is **still reachable** but no longer wanted. The usual suspects:

### Event subscriptions

A long lived publisher keeps every subscriber alive:

```csharp
class Dashboard
{
    public Dashboard(DataFeed feed)
    {
        feed.Updated += Refresh;   // feed now roots this dashboard
    }

    private void Refresh(object? s, EventArgs e) { }
}
```

If `feed` lives for the whole program, closed dashboards are never collected. Unsubscribe when done.

### Static collections

```csharp
static List<Request> AllRequests = new();   // grows forever unless something removes entries
```

Statics are roots. Anything they reference is immortal.

### Caches without limits

A dictionary used as a cache with no eviction is a leak by design. Use `MemoryCache` with size limits or expiry.

### Captured variables

A lambda stored for a long time keeps everything it captured alive, including large objects you only needed briefly.

## Reducing allocations

The GC is fast, but not free. In hot paths, fewer allocations means fewer collections:

- Prefer `struct` for small, short lived values that would otherwise be tiny heap objects.
- Use `StringBuilder` instead of repeated string concatenation.
- Avoid boxing: `object o = 42;` allocates. Generics avoid this.
- Reuse buffers and lists instead of creating new ones in loops.
- Use `Span<T>` to slice arrays and strings without copying, covered later.

Measure before optimising. A profiler or `BenchmarkDotNet` will show where allocations actually happen.

## Forcing a collection

`GC.Collect()` exists, and you almost never want it. The GC tunes itself based on allocation patterns, and forcing collections interferes with that. The one legitimate use is in benchmarks, to start from a clean state.

## Watching memory

```csharp
Console.WriteLine(GC.GetTotalMemory(forceFullCollection: false));   // bytes currently allocated
Console.WriteLine(Environment.WorkingSet);                          // process memory from the OS
```

For real investigations, use the `dotnet-counters` and `dotnet-gcdump` tools or the memory profiler in Visual Studio.

## Quick recap

- Value type locals live on the stack, objects created with `new` live on the heap.
- The GC frees objects that are no longer reachable from the roots. Reference counting is not used.
- Generations let the GC collect short lived objects cheaply and leave old objects alone.
- Large objects go to the LOH, which is rarely collected and not compacted.
- Leaks in .NET are objects that are still reachable: event handlers, statics, unbounded caches.
- Reduce allocations in hot paths, and measure before you optimise.

<code id="code-content" class="language-csharp">
// Memory and the garbage collector
using System.Buffers;
class Person
{
    public string Name { get; }
    public Person(string name) =&gt; Name = name;
}
// Stack vs heap: value on the stack, object on the heap
int count = 5;
var asha = new Person("Asha");
Console.WriteLine($"{count} {asha.Name}");
// Reachability decides what is garbage
var a = new Person("Temp");
var b = a;
a = null;                      // still reachable through b
Console.WriteLine(b.Name);
b = null;                      // now unreachable, eligible for collection
// Watch generations and collections
long before = GC.GetTotalMemory(false);
var junk = new List&lt;byte[]&gt;();
for (int i = 0; i &lt; 1000; i++)
    junk.Add(new byte[1024]);  // many short lived allocations
Console.WriteLine($"Gen of junk list: {GC.GetGeneration(junk)}");
junk = null;
GC.Collect();                  // only for demonstration, never in normal code
GC.WaitForPendingFinalizers();
long after = GC.GetTotalMemory(true);
Console.WriteLine($"Freed roughly {(before - after) / 1024} KB");
Console.WriteLine($"Gen0: {GC.CollectionCount(0)}, Gen2: {GC.CollectionCount(2)}");
// Large arrays go to the large object heap, so rent and return them
byte[] buffer = ArrayPool&lt;byte&gt;.Shared.Rent(100_000);
try
{
    buffer[0] = 1;             // use the buffer
}
finally
{
    ArrayPool&lt;byte&gt;.Shared.Return(buffer);   // reuse instead of reallocating
}
// A static collection is a root: everything in it lives forever
static class Registry
{
    public static List&lt;Person&gt; Everyone { get; } = new();
}
Registry.Everyone.Add(new Person("Immortal"));
Console.WriteLine(Registry.Everyone.Count);   // 1, and it will never be collected
</code></pre>
