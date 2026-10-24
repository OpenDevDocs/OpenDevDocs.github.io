---
publishDate: 2026-04-22T11:40
title: Synchronization and Thread Safety
slug: synchronization-and-thread-safety
metadescription: Protect shared state from race conditions with lock, Interlocked, Monitor, SemaphoreSlim and concurrent collections, understand deadlocks and immutability, and learn the rules for writing thread safe code.
updateDate: 2026-09-05T11:40
author: ['bishal-biswas']
level: 3
tags: ['threads', 'concurrency', 'locks']
course: c-sharp
---

## The race condition

Two threads share a counter:

```csharp
int counter = 0;

void Increment()
{
    for (int i = 0; i < 100_000; i++) counter++;
}

var t1 = new Thread(Increment);
var t2 = new Thread(Increment);
t1.Start(); t2.Start();
t1.Join(); t2.Join();

Console.WriteLine(counter);   // less than 200000, and different every run
```

`counter++` is three steps: read the value, add one, write it back. If both threads read `5` at the same moment, both write `6`, and one increment is lost. This is a **race condition**, and it is the fundamental problem of shared state.

Code is **thread safe** when it behaves correctly no matter how many threads use it at once. Getting there means either not sharing, or sharing carefully.

## lock

The `lock` statement lets only one thread at a time into a block of code:

```csharp
int counter = 0;
object sync = new();

void Increment()
{
    for (int i = 0; i < 100_000; i++)
    {
        lock (sync)
        {
            counter++;
        }
    }
}
```

A thread that reaches `lock (sync)` while another holds it waits until the lock is released at the closing brace. The three steps now happen without interruption.

Rules for the lock object:

- Use a private `object` field dedicated to locking. Since .NET 9 there is a `Lock` type for this purpose.
- Never lock on `this`, a string or a public object. Other code could lock on the same thing and deadlock you.
- Keep the locked region as small as possible. Everything inside runs one thread at a time.

## Interlocked

For single arithmetic operations on a number, `Interlocked` uses a CPU instruction that does the read, modify and write atomically, with no lock at all:

```csharp
int counter = 0;

void Increment()
{
    for (int i = 0; i < 100_000; i++)
    {
        Interlocked.Increment(ref counter);
    }
}
```

Also `Decrement`, `Add`, `Exchange` and `CompareExchange`. Much faster than a lock for counters and flags.

## What needs protecting

Every piece of state that is **both shared and mutable**. Local variables are safe. Objects that never change after creation are safe. Everything else that more than one thread touches needs a strategy.

The classic mistake is protecting writes but not reads. If one thread writes a field under a lock and another reads it without the lock, the reader may see a stale or half written value. Put both sides under the same lock.

## Thread safe collections

`List<T>` and `Dictionary<TKey, TValue>` are not thread safe. Two threads adding at once can corrupt them. `System.Collections.Concurrent` has replacements:

```csharp
using System.Collections.Concurrent;

var counts = new ConcurrentDictionary<string, int>();

Parallel.ForEach(words, word =>
{
    counts.AddOrUpdate(word, 1, (key, existing) => existing + 1);
});

var queue = new ConcurrentQueue<string>();
var bag = new ConcurrentBag<int>();
```

`AddOrUpdate` and `GetOrAdd` do the check and the write as one atomic step. A `ContainsKey` followed by an indexer set is still a race even on a concurrent dictionary.

## SemaphoreSlim: limiting access

A lock allows one thread. A semaphore allows **N**. It is the standard way to limit concurrent calls to an external service, and it works with `async`:

```csharp
var gate = new SemaphoreSlim(3);   // at most 3 at once

async Task CallApiAsync(string url)
{
    await gate.WaitAsync();
    try
    {
        await client.GetStringAsync(url);
    }
    finally
    {
        gate.Release();
    }
}
```

`lock` cannot be used across an `await`. `SemaphoreSlim(1)` is the async friendly equivalent of a lock.

## Deadlocks

Thread A holds lock 1 and waits for lock 2. Thread B holds lock 2 and waits for lock 1. Both wait forever:

```csharp
lock (a) { lock (b) { } }   // thread 1
lock (b) { lock (a) { } }   // thread 2
```

Prevention: always acquire locks in the same order everywhere, hold as few as possible, and never call unknown code, such as an event handler, while holding a lock.

The other famous deadlock is blocking on an async task with `.Result` from a UI or old ASP.NET thread. The continuation needs that thread, and the thread is waiting for the continuation.

## Immutability is thread safety for free

An object that cannot change cannot be corrupted. Records with `init` properties, `readonly` fields and `ImmutableList<T>` need no locks at all:

```csharp
record Config(string Host, int Port);

Config current = new("localhost", 8080);

// "Changing" it creates a new object, the old one is untouched
Config updated = current with { Port = 9090 };
```

Threads that hold a reference to the old config keep seeing a consistent old value. Publishing the new one is a single reference assignment, which is atomic.

## Volatile and memory ordering

Compilers and CPUs reorder reads and writes for speed. In rare lock free code, a flag written on one thread may not become visible to another promptly. `volatile` and `Volatile.Read` and `Write` prevent that. If you find yourself needing them, it is a sign to step back and use a lock, a task or a channel instead. They are hard to get right.

## Channels: sharing by communicating

Rather than sharing a collection, hand items from one thread to another through a `Channel<T>`. A producer writes, a consumer reads, and nobody touches the same state:

```csharp
using System.Threading.Channels;

var channel = Channel.CreateUnbounded<int>();

var producer = Task.Run(async () =>
{
    for (int i = 0; i < 5; i++) await channel.Writer.WriteAsync(i);
    channel.Writer.Complete();
});

await foreach (int item in channel.Reader.ReadAllAsync())
{
    Console.WriteLine(item);
}
```

This is the cleanest model for pipelines and background workers.

## Rules of thumb

1. Prefer not sharing. Give each task its own data and combine results at the end.
2. Prefer immutable data. If it cannot change, it cannot race.
3. Use concurrent collections and `Interlocked` for the simple cases.
4. Use `lock` for compound operations on shared state, and keep it small.
5. Use `SemaphoreSlim` when you need `await` inside the protected region or want to allow N at once.
6. Acquire locks in a consistent order, and never call out while holding one.

## Quick recap

- A race happens when two threads read and write the same state without coordination.
- `lock` gives one thread at a time exclusive access, on a private lock object.
- `Interlocked` does atomic arithmetic without a lock.
- Concurrent collections and their atomic methods replace `List` and `Dictionary` across threads.
- `SemaphoreSlim` limits concurrency and works with `await`.
- Immutability and channels avoid shared mutable state entirely.

<code id="code-content" class="language-csharp">
// Synchronization and thread safety
using System.Collections.Concurrent;
using System.Threading.Channels;
// The race: lost increments
int racy = 0;
Parallel.For(0, 100_000, _ =&gt; racy++);
Console.WriteLine($"Racy: {racy} (expected 100000)");
// Fix 1: lock around the compound operation
int locked = 0;
object sync = new();
Parallel.For(0, 100_000, _ =&gt; { lock (sync) { locked++; } });
Console.WriteLine($"Locked: {locked}");
// Fix 2: Interlocked for a single atomic operation
int atomic = 0;
Parallel.For(0, 100_000, _ =&gt; Interlocked.Increment(ref atomic));
Console.WriteLine($"Interlocked: {atomic}");
// Concurrent collections with atomic update methods
var words = "the cat and the hat and the bat".Split(' ');
var counts = new ConcurrentDictionary&lt;string, int&gt;();
Parallel.ForEach(words, w =&gt; counts.AddOrUpdate(w, 1, (_, n) =&gt; n + 1));
Console.WriteLine($"the: {counts["the"]}, and: {counts["and"]}");
// SemaphoreSlim limits concurrency and works with await
var gate = new SemaphoreSlim(2);
int running = 0, peak = 0;
await Task.WhenAll(Enumerable.Range(1, 6).Select(async i =&gt;
{
    await gate.WaitAsync();
    try
    {
        int now = Interlocked.Increment(ref running);
        InterlockedMax(ref peak, now);
        await Task.Delay(50);
        Interlocked.Decrement(ref running);
    }
    finally { gate.Release(); }
}));
Console.WriteLine($"Peak concurrent: {peak} (limit 2)");
static void InterlockedMax(ref int target, int value)
{
    int current;
    while ((current = target) &lt; value &amp;&amp;
           Interlocked.CompareExchange(ref target, value, current) != current) { }
}
// Immutable data needs no locks
record Config(string Host, int Port);
Config config = new("localhost", 8080);
Config updated = config with { Port = 9090 };
Console.WriteLine($"{config.Port} -&gt; {updated.Port}");
// Channels: share by communicating instead of locking
var channel = Channel.CreateUnbounded&lt;int&gt;();
var producer = Task.Run(async () =&gt;
{
    for (int i = 1; i &lt;= 3; i++) await channel.Writer.WriteAsync(i * i);
    channel.Writer.Complete();
});
await foreach (int item in channel.Reader.ReadAllAsync())
    Console.Write($"{item} ");
Console.WriteLine();
</code></pre>
