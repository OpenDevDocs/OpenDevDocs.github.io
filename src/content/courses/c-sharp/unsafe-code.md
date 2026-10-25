---
publishDate: 2026-04-28T11:50
title: Unsafe Code
slug: unsafe-code
metadescription: Understand what the unsafe keyword unlocks in C#, when it is justified, how to enable it, the fixed statement, native interop with P/Invoke, and the safe alternatives that usually make it unnecessary.
updateDate: 2026-09-05T11:50
author: ['bishal-biswas']
level: 4
tags: ['unsafe', 'interop', 'performance']
course: c-sharp
---

## What safe means

Normal C# is **memory safe**. You cannot read past the end of an array, you cannot access an object after it has been freed, and you cannot forge a reference to arbitrary memory. The runtime checks every array index and every cast, and the garbage collector owns object lifetimes. This is why a C# bug is an exception, not a silent corruption or a security hole.

**Unsafe code** switches some of those checks off inside a marked region. You gain raw pointers and direct memory access. You take on responsibility for every rule the runtime was enforcing for you.

## When it is justified

Almost never in application code. The legitimate cases:

- **Interop** with C libraries or operating system APIs that expect pointers.
- **Hot loops** over large buffers where the bounds checks are measurable, and `Span<T>` has already been tried.
- **Custom memory layouts** for hardware, drivers, or binary protocols.
- **Low level libraries** such as image codecs, compression and cryptography.

If your reason is not on that list, you want `Span<T>`, `Memory<T>`, `stackalloc` in a safe context, or `System.Runtime.InteropServices.MemoryMarshal`. Those give you most of the speed with none of the risk.

## Enabling it

The compiler refuses unsafe code unless the project opts in:

```xml
<PropertyGroup>
  <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
</PropertyGroup>
```

This is deliberate friction. A reviewer sees the flag in the project file and knows to look for pointer code.

## The unsafe keyword

Mark a block, a method or a whole type:

```csharp
unsafe
{
    int value = 42;
    int* p = &value;          // pointer to value
    Console.WriteLine(*p);    // 42, dereference
    *p = 100;
    Console.WriteLine(value); // 100
}

static unsafe void Zero(byte* buffer, int length)
{
    for (int i = 0; i < length; i++) buffer[i] = 0;
}

unsafe struct Header
{
    public fixed byte Magic[4];   // inline fixed size array, only allowed in unsafe structs
    public int Length;
}
```

Inside the region, `&` takes an address, `*` dereferences, and pointer arithmetic and indexing work as in C. The next topic goes through pointer syntax in detail. This one is about the rules around it.

## The fixed statement

Managed objects move. The garbage collector compacts the heap and updates every reference, but it cannot update a raw pointer. If you take the address of an array element and the array moves, your pointer now points at garbage.

`fixed` **pins** an object for the duration of a block so the GC leaves it in place:

```csharp
int[] numbers = { 1, 2, 3, 4 };

unsafe
{
    fixed (int* p = numbers)
    {
        for (int i = 0; i < numbers.Length; i++)
        {
            Console.Write(p[i] * 10 + " ");   // 10 20 30 40
        }
    }   // unpinned here
}
```

Strings can be pinned too, giving a `char*`. Keep `fixed` blocks short. A pinned object fragments the heap and slows down collections.

## Stack allocation

`stackalloc` in an unsafe context returns a raw pointer:

```csharp
unsafe
{
    int* buffer = stackalloc int[16];
    buffer[0] = 7;
}
```

In safe code, `stackalloc` gives you a `Span<T>` instead, with bounds checking. Prefer that form. Either way the buffer vanishes when the method returns, so never return a pointer to it.

## Native memory

For buffers that must outlive the method and never move, allocate outside the managed heap:

```csharp
using System.Runtime.InteropServices;

unsafe
{
    byte* raw = (byte*)NativeMemory.Alloc(1024);
    try
    {
        raw[0] = 0xFF;
    }
    finally
    {
        NativeMemory.Free(raw);   // you are the garbage collector now
    }
}
```

Forget the `Free` and you have a genuine C style leak. Wrap native allocations in a class with `IDisposable` and a `SafeHandle` so the cleanup has one home.

## P/Invoke: calling native libraries

The most common reason for unsafe code is talking to C. `DllImport` and the newer `LibraryImport` declare a native function so C# can call it:

```csharp
using System.Runtime.InteropServices;

static partial class Native
{
    [LibraryImport("libc", EntryPoint = "strlen")]
    public static unsafe partial nuint StrLen(byte* s);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);
}
```

The runtime **marshals** arguments across the boundary. Strings, arrays and structs need care, and pointers pass straight through. `LibraryImport` generates the marshalling code at compile time with a source generator, which is faster and works with AOT. Prefer it for new code.

## What the compiler still protects

Unsafe does not turn C# into C. You still cannot:

- Take a pointer to a reference type field without `fixed`, or to a managed reference at all.
- Store a pointer in an `object`, a generic type argument or most collections.
- Use pointers across `await` or in iterators.

Pointers to unmanaged types only: numbers, enums, pointers themselves, and structs made entirely of those. A `string*` does not exist.

## The cost of getting it wrong

A bug in safe code throws. A bug in unsafe code can:

- Read memory belonging to another object and leak secrets.
- Write over another object and corrupt state silently, with the crash appearing far away later.
- Crash the process with an access violation that no `catch` can handle.
- Introduce exploitable vulnerabilities in code that processes untrusted input.

Treat every unsafe block as a security boundary. Validate lengths before the block, keep the block tiny, and write tests that hammer the edges.

## The safe alternatives checklist

Before reaching for `unsafe`, try in order:

1. `Span<T>` and `ReadOnlySpan<T>` for slicing and parsing without copies.
2. `stackalloc` into a `Span<T>` for small temporary buffers.
3. `MemoryMarshal.Cast`, `MemoryMarshal.AsBytes` and `Unsafe.As` for reinterpreting memory.
4. `ArrayPool<T>` to reuse large buffers.
5. `BinaryPrimitives` for reading and writing binary formats.
6. `LibraryImport` with blittable structs and spans for interop.

In modern .NET, these cover the overwhelming majority of cases that once needed pointers.

## Quick recap

- Safe C# checks every index and cast and manages lifetimes. `unsafe` turns that off in a marked region.
- Enable it with `AllowUnsafeBlocks` in the project file, and expect reviewers to look closely.
- `fixed` pins managed objects so the GC cannot move them out from under a pointer.
- Native memory from `NativeMemory.Alloc` must be freed by hand, ideally inside a disposable wrapper.
- P/Invoke with `LibraryImport` is the main legitimate reason to touch pointers.
- Try `Span<T>`, `MemoryMarshal` and `ArrayPool<T>` first. They usually remove the need.

<code id="code-content" class="language-csharp">
// Unsafe code in C#
// Requires &lt;AllowUnsafeBlocks&gt;true&lt;/AllowUnsafeBlocks&gt; in the .csproj
using System.Runtime.InteropServices;
// An unsafe method that sums a buffer through a raw pointer
static unsafe long SumUnsafe(int* data, int length)
{
    long total = 0;
    int* end = data + length;          // pointer arithmetic
    while (data &lt; end)
    {
        total += *data;                // dereference, no bounds check
        data++;
    }
    return total;
}
// The safe equivalent using Span&lt;T&gt;: bounds checked and nearly as fast
static long SumSafe(ReadOnlySpan&lt;int&gt; data)
{
    long total = 0;
    foreach (int n in data) total += n;
    return total;
}
int[] numbers = Enumerable.Range(1, 1000).ToArray();
unsafe
{
    // fixed pins the array so the GC cannot move it while we hold a pointer
    fixed (int* p = numbers)
    {
        Console.WriteLine(SumUnsafe(p, numbers.Length));   // 500500
    }
    // stackalloc gives a raw pointer inside an unsafe block
    int* small = stackalloc int[4];
    for (int i = 0; i &lt; 4; i++) small[i] = i * i;
    Console.WriteLine($"{small[0]} {small[1]} {small[2]} {small[3]}");   // 0 1 4 9
    // Native memory: you must free it yourself
    byte* raw = (byte*)NativeMemory.Alloc(16);
    try
    {
        for (int i = 0; i &lt; 16; i++) raw[i] = (byte)i;
        Console.WriteLine($"raw[15] = {raw[15]}");
    }
    finally
    {
        NativeMemory.Free(raw);
    }
    // Reinterpret memory: read an int as its four bytes
    int value = 0x01020304;
    byte* bytes = (byte*)&amp;value;
    Console.WriteLine($"{bytes[0]:X2} {bytes[1]:X2} {bytes[2]:X2} {bytes[3]:X2}");   // 04 03 02 01 on little endian
}
Console.WriteLine(SumSafe(numbers));                           // 500500, no unsafe needed
// The safe way to reinterpret: MemoryMarshal instead of pointer casts
Span&lt;int&gt; ints = stackalloc int[] { 0x01020304 };
Span&lt;byte&gt; asBytes = MemoryMarshal.AsBytes(ints);
Console.WriteLine($"{asBytes[0]:X2} {asBytes[3]:X2}");         // 04 01
</code></pre>
