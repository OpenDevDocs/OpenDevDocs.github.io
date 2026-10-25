---
publishDate: 2026-07-30T19:00
title: Bit Manipulation
slug: bit-manipulation
metadescription: Work directly with the bits inside a number to build flags, compact sets and the tricks that solve certain problems instantly.
updateDate: 2026-09-07T19:00
author: ['bishal-biswas']
level: 3
tags: ['bits', 'operators', 'optimisation']
course: dsa
---

## Numbers are bits

An `int` is 32 bits. Working with those bits directly is sometimes far simpler and faster than the arithmetic alternative.

```csharp
int n = 13;

Console.WriteLine(Convert.ToString(n, 2));              // 1101
Console.WriteLine(Convert.ToString(n, 2).PadLeft(8, '0'));   // 00001101
```

`13` is `8 + 4 + 1`, so bits 3, 2 and 0 are set.

## The operators

```csharp
int a = 12;   // 1100
int b = 10;   // 1010

Console.WriteLine(a & b);    // 8   1000   AND: 1 only where both are 1
Console.WriteLine(a | b);    // 14  1110   OR: 1 where either is 1
Console.WriteLine(a ^ b);    // 6   0110   XOR: 1 where they differ
Console.WriteLine(~a);       // -13        NOT: flips every bit
Console.WriteLine(a << 1);   // 24  11000  shift left, doubles
Console.WriteLine(a >> 1);   // 6   0110   shift right, halves
```

Shifting is multiplication and division by powers of two. `n << 3` is `n * 8` and `n >> 2` is `n / 4`. The compiler already does this for you, so use it for clarity about bits, not for speed.

Careful with negative numbers. `>>` keeps the sign bit, so `-8 >> 1` is `-4`. Use `>>>` in C# 11 or later for an unsigned shift, or cast to `uint`.

## The five essential operations

Almost everything is built from these.

```csharp
static bool IsBitSet(int value, int position) => (value & (1 << position)) != 0;

static int SetBit(int value, int position) => value | (1 << position);

static int ClearBit(int value, int position) => value & ~(1 << position);

static int ToggleBit(int value, int position) => value ^ (1 << position);

static int LowestSetBit(int value) => value & -value;
```

```csharp
int flags = 0;

flags = SetBit(flags, 2);        // 100
flags = SetBit(flags, 0);        // 101

Console.WriteLine(IsBitSet(flags, 2));   // True
Console.WriteLine(IsBitSet(flags, 1));   // False

flags = ClearBit(flags, 2);      // 001
Console.WriteLine(flags);        // 1
```

`1 << position` builds a mask with exactly one bit set. AND with it to test, OR to set, AND with its inverse to clear, XOR to flip.

## The quick tricks

```csharp
// Even or odd, faster and clearer than % 2
bool isEven = (n & 1) == 0;

// Is it a power of two? A power of two has exactly one bit set.
bool isPowerOfTwo = n > 0 && (n & (n - 1)) == 0;

// Clear the lowest set bit
int cleared = n & (n - 1);

// Isolate the lowest set bit
int lowest = n & -n;

// Swap without a temporary variable
a ^= b; b ^= a; a ^= b;
```

The `n & (n - 1)` trick is worth understanding rather than memorising. Subtracting 1 flips the lowest set bit to 0 and everything below it to 1. ANDing then clears exactly that bit.

```text
n     = 12 = 1100
n - 1 = 11 = 1011
n & (n-1) = 1000 = 8      the lowest set bit is gone
```

A power of two has one bit set, so clearing it leaves zero. That is the whole test.

## Counting set bits

```csharp
// Naive: check all 32 positions
static int CountBitsSimple(int n)
{
    int count = 0;

    for (int i = 0; i < 32; i++)
    {
        if ((n & (1 << i)) != 0) count++;
    }

    return count;
}

// Brian Kernighan's: loop once per SET bit
static int CountBits(int n)
{
    int count = 0;

    while (n != 0)
    {
        n &= n - 1;      // clear the lowest set bit
        count++;
    }

    return count;
}

Console.WriteLine(CountBits(13));   // 3
```

The second version loops once per set bit rather than 32 times. For sparse values that is a real difference.

.NET has it built in, and it uses a hardware instruction where available:

```csharp
Console.WriteLine(System.Numerics.BitOperations.PopCount(13));   // 3
```

## XOR, the useful one

XOR has three properties that solve problems no other operator can.

```text
x ^ x = 0        anything with itself is zero
x ^ 0 = x        anything with zero is unchanged
order does not matter
```

**Find the single number that appears once, where everything else appears twice.**

```csharp
static int FindSingle(int[] numbers)
{
    int result = 0;

    foreach (int n in numbers) result ^= n;

    return result;
}

Console.WriteLine(FindSingle(new[] { 4, 1, 2, 1, 2 }));   // 4
```

Every pair cancels itself out, leaving only the unpaired value. `O(n)` time and `O(1)` space, where a hash set would need `O(n)` memory.

**Find the missing number from 0 to n.**

```csharp
static int FindMissing(int[] numbers)
{
    int result = numbers.Length;

    for (int i = 0; i < numbers.Length; i++) result ^= i ^ numbers[i];

    return result;
}

Console.WriteLine(FindMissing(new[] { 3, 0, 1 }));   // 2
```

XORing every index with every value cancels all the matched pairs, leaving the one index with no value.

The sum based version, `expected - actual`, can overflow. XOR never does.

## Bit flags

The classic practical use. Pack many booleans into one number.

```csharp
[Flags]
public enum Permissions
{
    None    = 0,
    Read    = 1 << 0,    // 1
    Write   = 1 << 1,    // 2
    Delete  = 1 << 2,    // 4
    Admin   = 1 << 3,    // 8

    ReadWrite = Read | Write,
    All = Read | Write | Delete | Admin
}

var user = Permissions.Read | Permissions.Write;

Console.WriteLine(user.HasFlag(Permissions.Read));     // True
Console.WriteLine(user.HasFlag(Permissions.Delete));   // False
Console.WriteLine(user);                               // Read, Write

user |= Permissions.Delete;                            // grant
user &= ~Permissions.Write;                            // revoke

Console.WriteLine(user);                               // Read, Delete
```

`1 << 0`, `1 << 1`, `1 << 2` makes the powers of two obvious and avoids the mistake of writing `3` where `4` was meant.

The `[Flags]` attribute makes `ToString` list the names rather than printing a number.

One number holds 32 independent booleans, and combining them is a single instruction.

## Bitmasks for subsets

A number with `n` bits represents any subset of `n` items. Bit `i` means item `i` is included.

```csharp
static void PrintAllSubsets(string[] items)
{
    int total = 1 << items.Length;      // 2^n subsets

    for (int mask = 0; mask < total; mask++)
    {
        var subset = new List<string>();

        for (int i = 0; i < items.Length; i++)
        {
            if ((mask & (1 << i)) != 0) subset.Add(items[i]);
        }

        Console.WriteLine($"[{string.Join(", ", subset)}]");
    }
}

PrintAllSubsets(new[] { "a", "b", "c" });
// [], [a], [b], [a, b], [c], [a, c], [b, c], [a, b, c]
```

No recursion, no backtracking. Counting from 0 to `2^n - 1` enumerates every subset.

This underpins **bitmask dynamic programming**, where the state is "which items have been used". Only practical up to about 20 items, since `2^20` is a million states.

```csharp
// Travelling salesman, sketched
// best[mask, last] = cheapest route visiting exactly the cities in mask, ending at last
var best = new int[1 << cityCount, cityCount];
```

## Compact sets

For a small fixed universe, a bitmask beats a `HashSet` on both speed and memory.

```csharp
// Which letters does this word use?
static int LetterMask(string word)
{
    int mask = 0;

    foreach (char c in word) mask |= 1 << (c - 'a');

    return mask;
}

static bool ShareNoLetters(string a, string b) => (LetterMask(a) & LetterMask(b)) == 0;

Console.WriteLine(ShareNoLetters("abc", "def"));   // True
Console.WriteLine(ShareNoLetters("abc", "cde"));   // False
```

Comparing two 26 letter alphabets becomes a single AND. A `HashSet` version would allocate and hash.

## When not to bother

Bit tricks are fast and often unreadable. `(n & (n - 1)) == 0` is not obviously a power of two test to most readers.

Use them when:

- Working with genuine bit flags or hardware registers.
- The universe is small and fixed, where a bitmask beats a set.
- Memory really matters, packing booleans instead of using `bool[]`.
- Enumerating subsets.
- A specific trick like XOR gives an `O(1)` space solution.

Otherwise, write the clear version. `n % 2 == 0` is clearer than `(n & 1) == 0`, and the compiler produces the same code.

And when you do use one, comment it.

```csharp
// A power of two has exactly one bit set, so clearing that bit gives zero
bool isPowerOfTwo = n > 0 && (n & (n - 1)) == 0;
```

## Quick recap

- AND tests, OR sets, XOR toggles, and `1 << i` builds a single bit mask.
- `n & (n - 1)` clears the lowest set bit, which makes the power of two test.
- `n & -n` isolates the lowest set bit, which drives Fenwick trees.
- XOR cancels pairs, giving `O(1)` space answers for single and missing numbers.
- Use `[Flags]` enums with `1 << i` values for permissions and options.
- Counting 0 to `2^n - 1` enumerates every subset with no recursion.
- Prefer readable code unless bits are genuinely the point.

<code id="code-content" class="language-csharp">
// AND tests, OR sets, XOR toggles, shift builds the mask
int a = 12, b = 10;                        // 1100 and 1010
Console.WriteLine($"{a &amp; b} {a | b} {a ^ b} {a &lt;&lt; 1} {a &gt;&gt; 1}");   // 8 14 6 24 6
// The five essential operations
static bool IsBitSet(int v, int i) =&gt; (v &amp; (1 &lt;&lt; i)) != 0;
static int SetBit(int v, int i) =&gt; v | (1 &lt;&lt; i);
static int ClearBit(int v, int i) =&gt; v &amp; ~(1 &lt;&lt; i);
static int ToggleBit(int v, int i) =&gt; v ^ (1 &lt;&lt; i);
static int LowestSetBit(int v) =&gt; v &amp; -v;
int flags = SetBit(SetBit(0, 2), 0);       // 101
Console.WriteLine(IsBitSet(flags, 2));     // True
// n &amp; (n-1) clears the lowest set bit. A power of two has only one bit.
int n = 16;
Console.WriteLine(n &gt; 0 &amp;&amp; (n &amp; (n - 1)) == 0);   // True
// Counting set bits: loop once per SET bit, not 32 times
static int CountBits(int x)
{
    int count = 0;
    while (x != 0) { x &amp;= x - 1; count++; }
    return count;
}
Console.WriteLine(CountBits(13));                  // 3
Console.WriteLine(System.Numerics.BitOperations.PopCount(13));   // 3, built in
// XOR cancels pairs: x^x = 0, x^0 = x, order does not matter
static int FindSingle(int[] numbers)
{
    int result = 0;
    foreach (int x in numbers) result ^= x;        // every pair cancels
    return result;
}
Console.WriteLine(FindSingle(new[] { 4, 1, 2, 1, 2 }));   // 4, in O(1) space
// Bit flags: 32 independent booleans in one number
[Flags]
public enum Permissions
{
    None = 0, Read = 1 &lt;&lt; 0, Write = 1 &lt;&lt; 1, Delete = 1 &lt;&lt; 2, Admin = 1 &lt;&lt; 3
}
var user = Permissions.Read | Permissions.Write;
Console.WriteLine(user.HasFlag(Permissions.Read)); // True
user |= Permissions.Delete;                        // grant
user &amp;= ~Permissions.Write;                        // revoke
Console.WriteLine(user);                           // Read, Delete
// Counting 0 to 2^n - 1 enumerates every subset, no recursion needed
string[] items = { "a", "b", "c" };
for (int mask = 0; mask &lt; (1 &lt;&lt; items.Length); mask++)
{
    var subset = new List&lt;string&gt;();
    for (int i = 0; i &lt; items.Length; i++)
        if ((mask &amp; (1 &lt;&lt; i)) != 0) subset.Add(items[i]);
    Console.Write($"[{string.Join(",", subset)}] ");
}
</code></pre>
