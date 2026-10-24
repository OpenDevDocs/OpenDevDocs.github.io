---
publishDate: 2026-07-12T12:20
title: Collision Handling
slug: collision-handling
metadescription: Understand why two keys land in the same bucket, compare chaining with open addressing, and see what makes a hash table degrade.
updateDate: 2026-09-07T12:20
author: ['bishal-biswas']
level: 2
tags: ['hashing', 'collisions', 'internals']
course: dsa
---

## Collisions are certain

A hash table has a fixed number of buckets and an unlimited number of possible keys. By the pigeonhole principle, some keys must share a bucket.

Even with plenty of room, collisions arrive far sooner than intuition suggests. With 365 buckets and only 23 random keys, there is roughly a 50 percent chance two of them collide. That is the birthday problem, and it means collision handling is not an edge case. It is the normal path.

## Seeing one

```csharp
Console.WriteLine("Aa".GetHashCode() % 8);
Console.WriteLine("BB".GetHashCode() % 8);
```

Different strings can easily land in the same bucket. A hash table has to keep working when they do.

## Strategy one: chaining

Each bucket holds a list. Colliding keys are appended to it.

```text
bucket 0: empty
bucket 1: ("cat", 1)
bucket 2: ("dog", 2) -> ("bird", 3) -> ("fish", 4)
bucket 3: empty
```

```csharp
public class ChainedTable<TKey, TValue> where TKey : notnull
{
    private readonly List<(TKey Key, TValue Value)>[] buckets;
    private int count;

    public ChainedTable(int size = 8)
    {
        buckets = new List<(TKey, TValue)>[size];
        for (int i = 0; i < size; i++) buckets[i] = new List<(TKey, TValue)>();
    }

    private int BucketFor(TKey key) => Math.Abs(key.GetHashCode() % buckets.Length);

    public void Put(TKey key, TValue value)
    {
        var bucket = buckets[BucketFor(key)];

        for (int i = 0; i < bucket.Count; i++)
        {
            if (bucket[i].Key.Equals(key))
            {
                bucket[i] = (key, value);
                return;
            }
        }

        bucket.Add((key, value));
        count++;
    }

    public bool Remove(TKey key)
    {
        var bucket = buckets[BucketFor(key)];

        for (int i = 0; i < bucket.Count; i++)
        {
            if (bucket[i].Key.Equals(key))
            {
                bucket.RemoveAt(i);
                count--;
                return true;
            }
        }

        return false;
    }

    public void PrintDistribution()
    {
        for (int i = 0; i < buckets.Length; i++)
        {
            Console.WriteLine($"Bucket {i}: {buckets[i].Count} items");
        }
    }
}
```

Chaining is simple, removal is easy, and the table keeps working past a load factor of 1. The costs are an extra object per bucket and scattered memory, since list nodes live wherever the allocator put them.

This is what .NET's `Dictionary` uses, though it chains through indexes in a flat array rather than separate list objects, which keeps the memory tidy.

## Strategy two: open addressing

No lists. Everything lives in the bucket array itself. If a bucket is taken, look for another one.

**Linear probing** looks at the next slot, then the next.

```csharp
public class LinearProbingTable<TKey, TValue> where TKey : notnull
{
    private readonly TKey?[] keys;
    private readonly TValue?[] values;
    private readonly bool[] occupied;
    private int count;

    public LinearProbingTable(int size = 16)
    {
        keys = new TKey[size];
        values = new TValue[size];
        occupied = new bool[size];
    }

    public void Put(TKey key, TValue value)
    {
        if (count >= keys.Length * 3 / 4) throw new InvalidOperationException("Too full");

        int i = Math.Abs(key.GetHashCode() % keys.Length);

        while (occupied[i])
        {
            if (keys[i]!.Equals(key))
            {
                values[i] = value;        // update in place
                return;
            }

            i = (i + 1) % keys.Length;    // try the next slot
        }

        keys[i] = key;
        values[i] = value;
        occupied[i] = true;
        count++;
    }

    public bool TryGet(TKey key, out TValue value)
    {
        int i = Math.Abs(key.GetHashCode() % keys.Length);
        int steps = 0;

        while (occupied[i] && steps < keys.Length)
        {
            if (keys[i]!.Equals(key))
            {
                value = values[i]!;
                return true;
            }

            i = (i + 1) % keys.Length;
            steps++;
        }

        value = default!;
        return false;
    }
}
```

Everything is in one array, which is excellent for the processor cache. There are no per item allocations at all.

## The deletion problem

Open addressing has a catch that chaining does not.

Suppose keys A and B both hash to slot 3. A takes slot 3, B probes to slot 4. Now delete A and clear slot 3.

Looking up B starts at slot 3, finds it empty, and concludes B is not there. But it is, in slot 4.

The fix is a **tombstone**, a marker meaning "something was deleted here, keep probing".

```csharp
private readonly bool[] deleted;

public bool Remove(TKey key)
{
    int i = Math.Abs(key.GetHashCode() % keys.Length);
    int steps = 0;

    while ((occupied[i] || deleted[i]) && steps < keys.Length)
    {
        if (occupied[i] && keys[i]!.Equals(key))
        {
            occupied[i] = false;
            deleted[i] = true;       // tombstone, not empty
            keys[i] = default;
            values[i] = default;
            count--;
            return true;
        }

        i = (i + 1) % keys.Length;
        steps++;
    }

    return false;
}
```

Tombstones accumulate. A table with heavy insert and delete traffic fills up with them and slows down, so it eventually has to be rebuilt. This is the main reason chaining is more common in general purpose libraries.

## Clustering

Linear probing has a second weakness. Occupied slots form runs, and runs grow, because a long run is a bigger target for the next collision.

Two common alternatives:

- **Quadratic probing** steps by 1, 4, 9, 16 instead of 1, 2, 3, 4. This scatters probes and breaks up clusters.
- **Double hashing** uses a second hash function to choose the step size, so different keys probe in different patterns.

## What actually degrades a table

Two things, and only two.

**A bad hash function.** If keys clump into a few buckets, lookups become list scans no matter which strategy you use.

```csharp
public class BadKey
{
    public int Id { get; init; }
    public override int GetHashCode() => 1;                 // everything collides
    public override bool Equals(object? o) => o is BadKey k && k.Id == Id;
}
```

Insert 10,000 of these and every operation is `O(n)`. Correct, and unusably slow.

**A high load factor.** As the table fills, probe sequences lengthen. Real implementations resize once the load factor crosses a threshold, typically around 0.75 for open addressing and about 1.0 for chaining.

## Deliberate collisions

Because a hash table degrades to `O(n)` when everything collides, an attacker who can choose your keys can force that. Send a form with thousands of parameter names that all hash to the same bucket, and a server that stores them in a dictionary spends all its time scanning lists.

This was a widespread vulnerability, and the fix was **randomised hashing**. .NET seeds string hashing with a random value per process, so an attacker cannot precompute colliding keys.

That is also why `"abc".GetHashCode()` gives a different number in different runs, and why you must never store a hash code or use it as a database key.

```csharp
// Wrong. This number changes between runs.
string cacheKey = text.GetHashCode().ToString();

// Right. A stable hash you control.
using var sha = System.Security.Cryptography.SHA256.Create();
string stable = Convert.ToHexString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(text)));
```

## Which strategy to pick

You almost never pick, because `Dictionary<TKey, TValue>` already made a good choice. When you do write your own:

- **Chaining** for general use, unpredictable load, and frequent deletion.
- **Open addressing** for small fixed size tables where cache performance matters and deletion is rare.

The far more important decision is the hash function. Get that right and either strategy performs well. Get it wrong and neither saves you.

## Quick recap

- Collisions are guaranteed, and arrive sooner than intuition suggests.
- Chaining keeps a list per bucket, and handles deletion cleanly.
- Open addressing stores everything in one array, which is cache friendly.
- Deleting under open addressing needs tombstones, or later lookups fail.
- Linear probing forms clusters, which quadratic probing and double hashing avoid.
- A constant or clumping hash function turns any table into a list.
- String hash codes are randomised per process, so never persist them.

<code id="code-content" class="language-csharp">
// Chaining: one list per bucket. Simple, and deletion is easy.
public class ChainedTable&lt;TKey, TValue&gt; where TKey : notnull
{
    private readonly List&lt;(TKey Key, TValue Value)&gt;[] buckets;
    public ChainedTable(int size = 8)
    {
        buckets = new List&lt;(TKey, TValue)&gt;[size];
        for (int i = 0; i &lt; size; i++) buckets[i] = new();
    }
    private int BucketFor(TKey k) =&gt; Math.Abs(k.GetHashCode() % buckets.Length);
    public void Put(TKey key, TValue value)
    {
        var bucket = buckets[BucketFor(key)];
        for (int i = 0; i &lt; bucket.Count; i++)
            if (bucket[i].Key.Equals(key)) { bucket[i] = (key, value); return; }
        bucket.Add((key, value));
    }
    public bool Remove(TKey key)
    {
        var bucket = buckets[BucketFor(key)];
        for (int i = 0; i &lt; bucket.Count; i++)
            if (bucket[i].Key.Equals(key)) { bucket.RemoveAt(i); return true; }
        return false;
    }
}
// Open addressing with linear probing: everything lives in one array
var keys = new string?[16];
var occupied = new bool[16];
void Put(string key)
{
    int i = Math.Abs(key.GetHashCode() % keys.Length);
    while (occupied[i])
    {
        if (keys[i] == key) return;
        i = (i + 1) % keys.Length;      // taken, try the next slot
    }
    keys[i] = key; occupied[i] = true;
}
Put("cat"); Put("dog");
// Deleting here needs a TOMBSTONE, not an empty slot, or probes stop too early:
//   A and B both hash to 3, B probed to 4. Clear slot 3 and B becomes unreachable.
// A constant hash code is correct and unusably slow
public class BadKey
{
    public int Id { get; init; }
    public override int GetHashCode() =&gt; 1;              // everything collides
    public override bool Equals(object? o) =&gt; o is BadKey k &amp;&amp; k.Id == Id;
}
// String hash codes are randomised per process. Never persist them.
using var sha = System.Security.Cryptography.SHA256.Create();
string stable = Convert.ToHexString(
    sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes("hello")));
Console.WriteLine(stable[..16]);        // same in every run, unlike GetHashCode
</code></pre>
