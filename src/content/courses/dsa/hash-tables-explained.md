---
publishDate: 2026-07-11T12:00
title: Hash Tables Explained
slug: hash-tables-explained
metadescription: See how hashing turns a key into an array index, why lookups are constant time, and what the hash function has to promise.
updateDate: 2026-09-07T12:00
author: ['bishal-biswas']
level: 1
tags: ['hashing', 'dictionary', 'data structures']
course: dsa
---

## The idea

Searching an array means checking items until you find the one you want. That is `O(n)`.

A hash table skips the searching. It **calculates** where an item should live from the item itself.

```text
key "Asha"  ->  hash function  ->  1847362  ->  % 8  ->  bucket 2
```

Put it in bucket 2. Later, run the same calculation and look in bucket 2. No searching at all.

That is the whole idea, and it is why `Dictionary` and `HashSet` are the most useful collections in the framework.

## Building a tiny one

Nothing beats writing it once.

```csharp
public class SimpleHashTable<TKey, TValue> where TKey : notnull
{
    private readonly List<(TKey Key, TValue Value)>[] buckets;

    public SimpleHashTable(int size = 8)
    {
        buckets = new List<(TKey, TValue)>[size];
        for (int i = 0; i < size; i++) buckets[i] = new List<(TKey, TValue)>();
    }

    private int BucketFor(TKey key)
    {
        int hash = key.GetHashCode();
        return Math.Abs(hash % buckets.Length);
    }

    public void Put(TKey key, TValue value)
    {
        var bucket = buckets[BucketFor(key)];

        for (int i = 0; i < bucket.Count; i++)
        {
            if (bucket[i].Key.Equals(key))
            {
                bucket[i] = (key, value);    // replace an existing key
                return;
            }
        }

        bucket.Add((key, value));
    }

    public bool TryGet(TKey key, out TValue value)
    {
        foreach (var entry in buckets[BucketFor(key)])
        {
            if (entry.Key.Equals(key))
            {
                value = entry.Value;
                return true;
            }
        }

        value = default!;
        return false;
    }
}
```

Using it:

```csharp
var table = new SimpleHashTable<string, int>();

table.Put("Asha", 30);
table.Put("Ravi", 25);

Console.WriteLine(table.TryGet("Asha", out int age) ? age : -1);   // 30
Console.WriteLine(table.TryGet("Nobody", out int x) ? x : -1);     // -1
```

Fewer than fifty lines, and it is the real thing in miniature.

## Why lookups are O(1)

Three steps, and none of them depend on how many items are stored.

1. Compute the hash of the key.
2. Reduce it to a bucket index with `%`.
3. Look inside that one bucket.

Step three is only cheap if buckets stay small. That is the whole balancing act, and it depends entirely on the hash function.

## Collisions

Two different keys can land in the same bucket. That is a **collision**, and it is unavoidable. There are infinitely many possible strings and only a fixed number of buckets.

The code above handles it by keeping a list per bucket, which is called **chaining**.

```text
bucket 2:  [("Asha", 30)] -> [("Meera", 41)]
```

Finding a key in a bucket with two entries means comparing two keys. Still fast. A bucket with a thousand entries is a list, and lookups in it are `O(n)`.

That is why a hash table is `O(1)` on average and `O(n)` in the worst case. The next topic covers collision handling in detail.

## The load factor

The load factor is items divided by buckets. Once it gets too high, buckets get crowded and lookups slow down.

Real implementations watch it and **resize**, allocating a bigger bucket array and redistributing everything.

```csharp
private void Resize()
{
    var old = buckets;
    buckets = new List<(TKey, TValue)>[old.Length * 2];
    for (int i = 0; i < buckets.Length; i++) buckets[i] = new List<(TKey, TValue)>();

    foreach (var bucket in old)
    {
        foreach (var entry in bucket) Put(entry.Key, entry.Value);   // rehash
    }
}
```

Every key has to be rehashed, because `hash % 8` and `hash % 16` give different answers. Resizing is `O(n)`, but it happens rarely enough to keep insertion amortised `O(1)`.

.NET grows to the next prime number above double the current size. Primes spread hash values more evenly.

If you know roughly how many items you will store, say so and skip the resizes:

```csharp
var dictionary = new Dictionary<string, int>(10_000);
```

## What a hash function must promise

**Equal objects must produce equal hash codes.** This is not a preference, it is a requirement. Break it and your object will be stored in one bucket and looked for in another, so it simply vanishes.

**Different objects should usually produce different hash codes.** Not required for correctness, but a hash function returning a constant turns the table into one long list.

**It must be fast**, since it runs on every single operation.

**It must be stable while the object is a key.** If you change a field the hash depends on, the object is now in the wrong bucket.

## Getting it right in C#

Override `Equals` and `GetHashCode` together, always.

```csharp
public class Point
{
    public int X { get; init; }
    public int Y { get; init; }

    public override bool Equals(object? obj) =>
        obj is Point other && other.X == X && other.Y == Y;

    public override int GetHashCode() => HashCode.Combine(X, Y);
}
```

`HashCode.Combine` does the mixing properly. Writing `X + Y` yourself would make `(1, 2)` and `(2, 1)` collide, and `X ^ Y` would make every point on the diagonal hash to zero.

Records do all of this for you:

```csharp
public record Point(int X, int Y);

var a = new Point(1, 2);
var b = new Point(1, 2);

Console.WriteLine(a == b);                              // True
Console.WriteLine(a.GetHashCode() == b.GetHashCode());  // True

var set = new HashSet<Point> { a };
Console.WriteLine(set.Contains(b));                     // True
```

For any type used as a dictionary key, a `record` is usually the right choice.

## The mutation trap

```csharp
public class MutablePoint
{
    public int X, Y;
    public override int GetHashCode() => HashCode.Combine(X, Y);
    public override bool Equals(object? o) => o is MutablePoint p && p.X == X && p.Y == Y;
}

var point = new MutablePoint { X = 1, Y = 2 };
var set = new HashSet<MutablePoint> { point };

point.X = 99;                          // the hash has changed

Console.WriteLine(set.Contains(point));   // False, even though it is in there
Console.WriteLine(set.Count);             // 1
```

The object is still in the table, in the bucket it hashed to originally. Lookups now compute a different bucket and find nothing. It is unreachable and undeletable.

Use immutable keys. This is the strongest argument for records with `init` properties.

## What you get in .NET

```csharp
var dictionary = new Dictionary<string, int>();   // key to value
var set = new HashSet<string>();                  // just keys
var lookup = new Dictionary<string, List<int>>(); // key to many values
```

Also `ConcurrentDictionary<TKey, TValue>` for multi threaded access, and `FrozenDictionary` for a read only table optimised for lookup speed.

## Quick recap

- A hash table calculates where an item lives instead of searching for it.
- The hash is reduced to a bucket index, usually with `%`.
- Collisions are unavoidable and are commonly handled with a list per bucket.
- Lookups are `O(1)` on average and `O(n)` if everything collides.
- Resizing rehashes every key, so preallocate when you know the size.
- Equal objects must have equal hash codes, always override both together.
- Never mutate a field the hash depends on while the object is a key.

<code id="code-content" class="language-csharp">
// A hash table in miniature: hash the key, reduce to a bucket, look in that bucket
public class SimpleHashTable&lt;TKey, TValue&gt; where TKey : notnull
{
    private readonly List&lt;(TKey Key, TValue Value)&gt;[] buckets;
    public SimpleHashTable(int size = 8)
    {
        buckets = new List&lt;(TKey, TValue)&gt;[size];
        for (int i = 0; i &lt; size; i++) buckets[i] = new();
    }
    private int BucketFor(TKey key) =&gt; Math.Abs(key.GetHashCode() % buckets.Length);
    public void Put(TKey key, TValue value)
    {
        var bucket = buckets[BucketFor(key)];
        for (int i = 0; i &lt; bucket.Count; i++)
            if (bucket[i].Key.Equals(key)) { bucket[i] = (key, value); return; }
        bucket.Add((key, value));           // collision: chain it in this bucket
    }
    public bool TryGet(TKey key, out TValue value)
    {
        foreach (var e in buckets[BucketFor(key)])
            if (e.Key.Equals(key)) { value = e.Value; return true; }
        value = default!;
        return false;
    }
}
var table = new SimpleHashTable&lt;string, int&gt;();
table.Put("Asha", 30);
Console.WriteLine(table.TryGet("Asha", out int age) ? age : -1);   // 30
// Equal objects MUST have equal hash codes. Override both, together.
public record Point(int X, int Y);       // records do this correctly for free
var a = new Point(1, 2);
var b = new Point(1, 2);
Console.WriteLine(a == b);                               // True
Console.WriteLine(a.GetHashCode() == b.GetHashCode());   // True
Console.WriteLine(new HashSet&lt;Point&gt; { a }.Contains(b)); // True
// Doing it by hand: HashCode.Combine mixes properly, X + Y does not
public class ManualPoint
{
    public int X { get; init; }
    public int Y { get; init; }
    public override bool Equals(object? o) =&gt; o is ManualPoint p &amp;&amp; p.X == X &amp;&amp; p.Y == Y;
    public override int GetHashCode() =&gt; HashCode.Combine(X, Y);
}
// Never mutate a field the hash depends on while the object is a key.
// It stays in its original bucket and becomes unreachable.
// Know the size? Preallocate and skip every rehash.
var sized = new Dictionary&lt;string, int&gt;(10_000);
</code></pre>
