---
publishDate: 2026-04-25T11:45
title: Span<T> and Memory<T>
slug: span-t-and-memory-t
metadescription: Slice arrays, strings and stack memory without copying using Span and ReadOnlySpan, understand the ref struct rules, use Memory for async code and stackalloc for allocation free hot paths.
updateDate: 2026-09-05T11:45
author: ['bishal-biswas']
level: 4
tags: ['performance', 'span', 'memory']
course: c-sharp
---

## Copying is the hidden cost

Parsing a line of text usually means `Substring`, and each call allocates a new string. Processing part of an array usually means copying it into a new one. In a hot loop those copies add up to garbage collections and cache misses.

`Span<T>` is a **view** over a contiguous block of memory. Slicing a span creates another view, not a copy. Nothing is allocated.

```csharp
int[] numbers = { 1, 2, 3, 4, 5, 6 };

Span<int> all = numbers;             // view of the whole array
Span<int> middle = all.Slice(2, 3);  // view of 3 4 5, no copy

middle[0] = 30;
Console.WriteLine(numbers[2]);       // 30, same memory
```

The span sees and changes the original. That is the point.

## What a span can point at

A `Span<T>` can wrap:

- An array or part of one.
- Stack memory from `stackalloc`.
- Native memory from a pointer.

And `ReadOnlySpan<T>` can additionally wrap a `string`, giving you a read only view of its characters:

```csharp
string line = "name=Asha";
ReadOnlySpan<char> span = line;

int eq = span.IndexOf('=');
ReadOnlySpan<char> key = span[..eq];
ReadOnlySpan<char> value = span[(eq + 1)..];

Console.WriteLine(key.SequenceEqual("name"));   // True
Console.WriteLine(value.ToString());             // Asha, allocated only here
```

Range syntax `[..eq]` works on spans just as on arrays. The parse produced zero garbage until the final `ToString`.

## Parsing without allocation

Most .NET parse and format methods accept spans:

```csharp
ReadOnlySpan<char> csv = "10,20,30";
int total = 0;

while (!csv.IsEmpty)
{
    int comma = csv.IndexOf(',');
    ReadOnlySpan<char> part = comma < 0 ? csv : csv[..comma];
    total += int.Parse(part);                          // parses from the span directly
    csv = comma < 0 ? ReadOnlySpan<char>.Empty : csv[(comma + 1)..];
}

Console.WriteLine(total);   // 60
```

`Split` on a string would have allocated an array and three strings. This version allocates nothing.

## stackalloc

Small temporary buffers can live on the stack, where they cost nothing to allocate or free:

```csharp
Span<byte> buffer = stackalloc byte[256];

int written = Encoding.UTF8.GetBytes("hello", buffer);
Console.WriteLine(written);   // 5
```

Keep stack buffers small, a few hundred bytes to a kilobyte. The stack is about a megabyte and overflowing it is fatal. For larger or variable sizes, rent from `ArrayPool<T>` and wrap the rented array in a span.

## The ref struct rules

`Span<T>` is a `ref struct`. It may hold a pointer into the stack, so the compiler forbids anything that could let it outlive its memory:

- It cannot be a field of a class or a normal struct.
- It cannot be boxed or stored in `object`, an interface, or a collection.
- It cannot be captured by a lambda or used in an `async` method across an `await`.
- It cannot be used as a generic type argument, so no `List<Span<int>>`.

These rules are what make spans safe. If you hit one, you need `Memory<T>`.

## Memory<T> for async and storage

`Memory<T>` is the heap friendly cousin. It can be stored in fields, passed through `await` and put in collections. When you need to work on the data, ask for its span:

```csharp
class Parser
{
    private readonly Memory<byte> buffer = new byte[1024];   // allowed, Memory is a normal struct

    public async Task ReadAsync(Stream stream)
    {
        int n = await stream.ReadAsync(buffer);   // Memory works across await
        Process(buffer.Span[..n]);                // hand a Span to synchronous code
    }

    private void Process(ReadOnlySpan<byte> data)
    {
        Console.WriteLine($"{data.Length} bytes");
    }
}
```

Rule: `Span<T>` in synchronous methods, `Memory<T>` when you must store it or cross an `await`. `ReadOnlyMemory<T>` is the read only version.

## Spans over strings

`string` methods that allocate now mostly have span alternatives:

```csharp
ReadOnlySpan<char> s = "  Hello World  ";

ReadOnlySpan<char> trimmed = s.Trim();                  // no allocation
bool starts = trimmed.StartsWith("Hello");
int idx = trimmed.IndexOf("World");
ReadOnlySpan<char> word = trimmed[idx..];

Span<char> upper = stackalloc char[word.Length];
word.ToUpperInvariant(upper);
Console.WriteLine(upper.ToString());   // WORLD
```

`string.Create` and `ISpanFormattable` let you build strings into a span too. This is what makes modern .NET string handling fast.

## Copying and filling

```csharp
Span<int> source = stackalloc int[] { 1, 2, 3 };
Span<int> dest = stackalloc int[3];

source.CopyTo(dest);
dest.Fill(0);
dest.Clear();
dest.Reverse();
bool same = source.SequenceEqual(dest);
```

`CopyTo` throws if the destination is too small. `TryCopyTo` returns `false` instead.

## Where spans pay off

- Parsers and tokenisers for text, CSV, JSON, protocols.
- Binary serialisation and network code.
- Image and audio processing over large arrays.
- Any method called millions of times that currently allocates a `Substring` or a small array.

Where they do not: ordinary business logic. Use them when a profiler shows allocations in a hot path, not by default.

## Quick recap

- `Span<T>` is a view over contiguous memory. Slicing creates another view, never a copy.
- `ReadOnlySpan<char>` gives allocation free string parsing, and most parse methods accept it.
- `stackalloc` puts small buffers on the stack for zero cost allocation.
- Spans are ref structs: no fields in classes, no boxing, no lambdas, no `await`.
- `Memory<T>` lifts those restrictions for storage and async, and gives you a span when needed.
- Use spans in measured hot paths, not everywhere.

<code id="code-content" class="language-csharp">
// Span&lt;T&gt; and Memory&lt;T&gt;
using System.Text;
// A span is a view, not a copy
int[] numbers = { 1, 2, 3, 4, 5, 6 };
Span&lt;int&gt; middle = numbers.AsSpan(2, 3);
middle[0] = 30;
Console.WriteLine(string.Join(" ", numbers));        // 1 2 30 4 5 6
// Allocation free parsing of a key=value line
ReadOnlySpan&lt;char&gt; line = "name=Asha";
int eq = line.IndexOf('=');
ReadOnlySpan&lt;char&gt; key = line[..eq];
ReadOnlySpan&lt;char&gt; value = line[(eq + 1)..];
Console.WriteLine($"{key.SequenceEqual("name")} {value.ToString()}");   // True Asha
// Summing a CSV without Split
static int SumCsv(ReadOnlySpan&lt;char&gt; csv)
{
    int total = 0;
    while (!csv.IsEmpty)
    {
        int comma = csv.IndexOf(',');
        ReadOnlySpan&lt;char&gt; part = comma &lt; 0 ? csv : csv[..comma];
        total += int.Parse(part);                    // parses straight from the span
        csv = comma &lt; 0 ? ReadOnlySpan&lt;char&gt;.Empty : csv[(comma + 1)..];
    }
    return total;
}
Console.WriteLine(SumCsv("10,20,30"));               // 60
// stackalloc for a small temporary buffer
Span&lt;byte&gt; buffer = stackalloc byte[64];
int written = Encoding.UTF8.GetBytes("hello span", buffer);
Console.WriteLine(Encoding.UTF8.GetString(buffer[..written]));
// Span based string operations
ReadOnlySpan&lt;char&gt; text = "  Hello World  ";
ReadOnlySpan&lt;char&gt; word = text.Trim();
word = word[(word.IndexOf(' ') + 1)..];
Span&lt;char&gt; upper = stackalloc char[word.Length];
word.ToUpperInvariant(upper);
Console.WriteLine(upper.ToString());                 // WORLD
// Memory&lt;T&gt; can be stored and used across await, then hands out a span
class Reader
{
    private readonly Memory&lt;byte&gt; buffer = new byte[1024];
    public async Task&lt;int&gt; ReadAsync(Stream stream)
    {
        int n = await stream.ReadAsync(buffer);      // Memory survives the await
        return CountSpaces(buffer.Span[..n]);        // Span for synchronous work
    }
    private static int CountSpaces(ReadOnlySpan&lt;byte&gt; data) =&gt; data.Count((byte)' ');
}
using var stream = new MemoryStream(Encoding.UTF8.GetBytes("one two three"));
Console.WriteLine(await new Reader().ReadAsync(stream));   // 2
</code></pre>
