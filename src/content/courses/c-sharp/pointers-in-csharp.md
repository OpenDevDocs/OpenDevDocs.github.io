---
publishDate: 2026-04-28T11:51
title: Pointers in C#
slug: pointers-in-csharp
metadescription: Learn pointer syntax in C#, address of and dereference operators, pointer arithmetic, pointers to structs, function pointers, and the unmanaged type rules that decide what you can point at.
updateDate: 2026-09-05T11:51
author: ['bishal-biswas']
level: 4
tags: ['unsafe', 'pointers', 'interop']
course: c-sharp
---

## What a pointer is

A pointer is a variable that holds a **memory address**. Instead of storing a value, it stores where a value lives. Everything in this topic requires an `unsafe` context and `AllowUnsafeBlocks` in the project file, as covered in the previous topic.

```csharp
unsafe
{
    int number = 42;
    int* pointer = &number;

    Console.WriteLine((long)pointer);   // some address, different each run
    Console.WriteLine(*pointer);        // 42, the value at that address
}
```

Two operators do the work:

- `&` is **address of**. `&number` gives the location of `number`.
- `*` is **dereference**. `*pointer` reads or writes whatever is at that location.

`int*` reads as "pointer to int". The type matters because it tells the compiler how many bytes to read and how far to step.

## Writing through a pointer

```csharp
unsafe
{
    int number = 1;
    int* p = &number;

    *p = 99;
    Console.WriteLine(number);   // 99, changed through the pointer

    (*p)++;
    Console.WriteLine(number);   // 100
}
```

This is the same effect as passing by `ref`, and `ref` is what you should use in safe code. Pointers exist for when the address itself must be stored or handed to native code.

## Pointer arithmetic

Adding one to a pointer moves it forward by **one element**, not one byte. For an `int*` that is four bytes, for a `double*` eight:

```csharp
unsafe
{
    int[] values = { 10, 20, 30, 40 };

    fixed (int* start = values)
    {
        int* p = start;
        Console.WriteLine(*p);         // 10
        p++;
        Console.WriteLine(*p);         // 20
        Console.WriteLine(*(p + 2));   // 40
        Console.WriteLine(p[1]);       // 30, indexing is arithmetic plus dereference
        Console.WriteLine(p - start);  // 1, distance in elements
    }
}
```

Nothing stops you writing `*(p + 100)`. It reads memory that is not yours and either returns garbage or crashes. The bounds checks you gave up in the `unsafe` block are exactly the ones that would have caught it.

## Pointers to structs

Access struct members through a pointer with `->`:

```csharp
struct Point
{
    public int X;
    public int Y;
}

unsafe
{
    Point pt = new() { X = 3, Y = 4 };
    Point* p = &pt;

    p->X = 30;                          // same as (*p).X = 30
    Console.WriteLine($"{p->X}, {p->Y}");   // 30, 4
}
```

Arrays of structs are contiguous, so a pointer walks through them naturally:

```csharp
unsafe
{
    Point[] points = new Point[3];
    fixed (Point* first = points)
    {
        for (Point* p = first; p < first + points.Length; p++)
        {
            p->X = (int)(p - first);
        }
    }
}
```

## What you can point at

Only **unmanaged types**: `int`, `double`, `bool`, `char`, enums, other pointers, and structs whose fields are all unmanaged. The compiler rejects anything the GC tracks:

```csharp
unsafe
{
    // string* s;              // error: string is a managed type
    // List<int>* list;        // error
    // object* o;              // error
    char* c;                   // fine, char is unmanaged
}
```

A generic method can require this with the `unmanaged` constraint:

```csharp
static unsafe int SizeOf<T>() where T : unmanaged => sizeof(T);
```

## sizeof

In an unsafe context `sizeof` works on any unmanaged type, including your structs:

```csharp
unsafe
{
    Console.WriteLine(sizeof(int));     // 4
    Console.WriteLine(sizeof(Point));   // 8
    Console.WriteLine(sizeof(char));    // 2
}
```

Struct layout may include padding. `[StructLayout(LayoutKind.Sequential, Pack = 1)]` controls that when matching a native format.

## void pointers

`void*` points at something of unknown type. You cannot dereference it, only cast it to a typed pointer first:

```csharp
unsafe
{
    int n = 5;
    void* anything = &n;
    int* typed = (int*)anything;
    Console.WriteLine(*typed);   // 5
}
```

Native APIs use `void*` for opaque handles and generic buffers.

## Pointers and strings

A `fixed` statement on a string yields a `char*` to its first character. The string is read only, and writing through the pointer is undefined behaviour even though the compiler allows it:

```csharp
unsafe
{
    string text = "hello";
    fixed (char* p = text)
    {
        for (char* c = p; *c != '\0'; c++)
        {
            Console.Write(char.ToUpper(*c));   // HELLO
        }
    }
}
```

.NET strings are null terminated in memory, which is what makes that loop stop, but rely on `Length` rather than the terminator in real code.

## Function pointers

Since C# 9 you can hold a pointer to a **static method** and call it without a delegate allocation:

```csharp
static int Double(int x) => x * 2;

unsafe
{
    delegate*<int, int> fn = &Double;
    Console.WriteLine(fn(21));   // 42
}
```

`delegate*<int, int>` is "function pointer taking int, returning int". Add `unmanaged` for calling native callbacks:

```csharp
delegate* unmanaged<int, int> nativeCallback;
```

This is for interop and extreme hot paths. A `Func<int, int>` is the right tool everywhere else.

## IntPtr and nint

When you need to store an address in safe code, or pass one through a method that is not unsafe, use `nint` (native sized integer) or `IntPtr`:

```csharp
unsafe
{
    int n = 7;
    nint address = (nint)(&n);
    int* back = (int*)address;
    Console.WriteLine(*back);   // 7
}
```

Native handles from the operating system arrive as `IntPtr`. Wrap them in a `SafeHandle` so they are released reliably.

## A realistic example: fast pixel fill

The classic justification. Filling a large image buffer through a pointer avoids a bounds check per pixel:

```csharp
static unsafe void Fill(uint[] pixels, uint colour)
{
    fixed (uint* start = pixels)
    {
        uint* end = start + pixels.Length;
        for (uint* p = start; p < end; p++)
        {
            *p = colour;
        }
    }
}
```

Before shipping this, benchmark it against `pixels.AsSpan().Fill(colour)`. The span version is vectorised and usually wins. That result is the whole lesson of the last two topics: pointers are a tool for interop and for the rare case where measurements prove they help.

## Quick recap

- `&` gives an address, `*` reads or writes the value there, and `T*` is a pointer to `T`.
- Pointer arithmetic moves by whole elements, and indexing is arithmetic plus dereference.
- Use `->` for struct members, `fixed` to pin arrays and strings, `sizeof` for sizes.
- Only unmanaged types can be pointed at. Strings, objects and collections cannot.
- Function pointers call static methods without a delegate, mainly for interop.
- Measure against `Span<T>` first. It is usually faster and always safer.

<code id="code-content" class="language-csharp">
// Pointers in C#
// Requires &lt;AllowUnsafeBlocks&gt;true&lt;/AllowUnsafeBlocks&gt; in the .csproj
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)]
struct Point
{
    public int X;
    public int Y;
    public override string ToString() =&gt; $"({X}, {Y})";
}
static int Double(int x) =&gt; x * 2;
static unsafe void Fill(uint[] pixels, uint colour)
{
    fixed (uint* start = pixels)
    {
        uint* end = start + pixels.Length;
        for (uint* p = start; p &lt; end; p++) *p = colour;   // no bounds check per pixel
    }
}
unsafe
{
    // Address of and dereference
    int number = 42;
    int* p = &amp;number;
    *p = 100;
    Console.WriteLine($"{number} via pointer {*p}");          // 100 via pointer 100
    // Pointer arithmetic over a pinned array
    int[] values = { 10, 20, 30, 40 };
    fixed (int* start = values)
    {
        int* cursor = start + 1;
        Console.WriteLine($"{*cursor} {cursor[1]} {*(cursor + 2)} offset {cursor - start}");   // 20 30 40 offset 1
    }
    // Struct pointers use -&gt; for members, and sizeof works on unmanaged types
    Point pt = new() { X = 3, Y = 4 };
    Point* pp = &amp;pt;
    pp-&gt;X = 30;
    Console.WriteLine($"{*pp} size {sizeof(Point)} bytes");   // (30, 4) size 8 bytes
    // Walking an array of structs
    Point[] points = new Point[3];
    fixed (Point* first = points)
    {
        for (Point* q = first; q &lt; first + points.Length; q++)
            q-&gt;Y = (int)(q - first) * 10;
    }
    Console.WriteLine(string.Join(" ", points));              // (0, 0) (0, 10) (0, 20)
    // void* and casting back
    void* opaque = &amp;number;
    Console.WriteLine(*(int*)opaque);                          // 100
    // Function pointer to a static method
    delegate*&lt;int, int&gt; fn = &amp;Double;
    Console.WriteLine(fn(21));                                 // 42
    // Reading a string through a char*
    fixed (char* text = "hello")
    {
        for (int i = 0; i &lt; 5; i++) Console.Write(char.ToUpper(text[i]));   // HELLO
        Console.WriteLine();
    }
}
uint[] image = new uint[1_000_000];
Fill(image, 0xFF00FF00);
Console.WriteLine($"{image[0]:X8} {image[^1]:X8}");             // FF00FF00 FF00FF00
image.AsSpan().Fill(0xFFFF0000);                                 // the safe, vectorised alternative
Console.WriteLine($"{image[500_000]:X8}");                       // FFFF0000
</code></pre>
