---
publishDate: 2026-04-22T11:39
title: Multithreading
slug: multithreading
metadescription: Understand threads in .NET, create and join them, use the thread pool, background versus foreground threads, thread local data, and why tasks are usually the better abstraction.
updateDate: 2026-09-05T11:39
author: ['bishal-biswas']
level: 3
tags: ['threads', 'concurrency']
course: c-sharp
---

## What a thread is

A **thread** is an independent path of execution inside your process. Every program starts with one, the **main thread**. Create more and the operating system runs them at the same time on different cores, or slices time between them on one core.

Tasks and `Parallel` sit on top of threads. Understanding the layer underneath helps you reason about what those tools actually do and debug them when they misbehave.

## Creating a thread

```csharp
using System.Threading;

var worker = new Thread(() =>
{
    for (int i = 0; i < 3; i++)
    {
        Console.WriteLine($"Worker {i} on thread {Environment.CurrentManagedThreadId}");
        Thread.Sleep(100);
    }
});

worker.Start();
Console.WriteLine($"Main continues on thread {Environment.CurrentManagedThreadId}");

worker.Join();   // wait for the worker to finish
Console.WriteLine("Worker done");
```

`Start` begins execution. `Join` blocks the current thread until the other one ends. Without `Join`, the main thread may finish first.

Threads can take a parameter:

```csharp
var t = new Thread(name => Console.WriteLine($"Hello {name}"));
t.Start("Asha");
```

## Naming threads

Names show up in the debugger and in logs, and cost nothing:

```csharp
var t = new Thread(Work) { Name = "ImageProcessor" };
```

## Foreground and background threads

A process stays alive while any **foreground** thread is running. **Background** threads are killed when the last foreground thread ends:

```csharp
var monitor = new Thread(() =>
{
    while (true)
    {
        Console.WriteLine("Still watching...");
        Thread.Sleep(500);
    }
})
{
    IsBackground = true
};

monitor.Start();
Thread.Sleep(1200);
// program exits here and the background thread dies with it
```

New threads are foreground by default. Make housekeeping threads background so they cannot keep the process alive by accident.

## The thread pool

Creating a thread costs about a megabyte of stack and a call into the operating system. For short jobs that is wasteful. The **thread pool** keeps a set of ready threads and hands work to them:

```csharp
ThreadPool.QueueUserWorkItem(_ =>
{
    Console.WriteLine($"Pool thread {Environment.CurrentManagedThreadId}");
});
```

`Task.Run`, `Parallel.For` and the continuations of `await` all use the pool. It grows and shrinks automatically. You almost never create raw threads in modern code. The two cases where you do:

- A long running loop that must not tie up a pool thread, such as a message consumer.
- Work that needs a specific apartment state or stack size.

For those, `Task.Factory.StartNew` with `TaskCreationOptions.LongRunning` gives you a dedicated thread while keeping the `Task` API.

## Each thread has its own stack

Local variables are private to the thread that owns them. Two threads running the same method do not share locals:

```csharp
static void Count()
{
    int local = 0;             // separate copy per thread
    for (int i = 0; i < 1000; i++) local++;
    Console.WriteLine(local);  // always 1000
}

new Thread(Count).Start();
new Thread(Count).Start();
```

Fields, statics and heap objects are **shared**. That is where trouble starts, and the next topic is entirely about it.

## Thread local storage

Sometimes you want a static that is different per thread, for example a per thread random number generator or a buffer:

```csharp
static ThreadLocal<Random> rng = new(() => new Random());

static int Roll() => rng.Value!.Next(1, 7);
```

Each thread that touches `rng.Value` gets its own `Random`. `AsyncLocal<T>` is the equivalent that flows through `await` boundaries, used for things like request ids in web servers.

## Sleeping and yielding

- `Thread.Sleep(ms)` blocks the thread for at least that long. Use it in raw thread code, never in async code.
- `Thread.Yield()` lets another ready thread run, then continues.
- `SpinWait` burns CPU for a very short wait when blocking would be slower.

## Stopping a thread

There is no safe way to kill a thread from outside. `Thread.Abort` is gone from modern .NET. Instead, the thread checks a flag or a `CancellationToken` and exits on its own:

```csharp
var cts = new CancellationTokenSource();

var t = new Thread(() =>
{
    while (!cts.Token.IsCancellationRequested)
    {
        DoWork();
    }
    Console.WriteLine("Stopped cleanly");
});

t.Start();
Thread.Sleep(1000);
cts.Cancel();
t.Join();
```

## Threads and the UI

Desktop frameworks require that only one thread, the **UI thread**, touches controls. Work on another thread, then marshal the update back:

```csharp
// WPF
Dispatcher.Invoke(() => label.Content = result);

// WinForms
label.Invoke(() => label.Text = result);
```

`await` in a UI event handler does this automatically, which is one more reason to prefer tasks.

## Debugging threads

The Visual Studio **Threads** and **Parallel Stacks** windows show every thread, its name and where it is. Give threads names, log the managed thread id, and you can follow what happened.

## Threads or tasks?

| Use | Choose |
| --- | --- |
| Waiting on I/O | `async` and `await` |
| Short CPU work in parallel | `Task.Run`, `Parallel` |
| A long lived loop | `Task.Factory.StartNew` with `LongRunning` or a dedicated `Thread` |
| Precise control of stack size or apartment state | `Thread` |

Tasks compose, propagate exceptions and results, and cooperate with cancellation. Raw threads do none of that. Reach for them only when you have a reason.

## Quick recap

- A thread is an independent execution path, and every process starts with a main thread.
- `new Thread(...)`, `Start` and `Join` create, run and wait for a thread.
- Background threads die with the process, foreground threads keep it alive.
- The thread pool reuses threads, and tasks are built on it.
- Locals are per thread, fields and statics are shared, `ThreadLocal<T>` gives per thread statics.
- Stop threads cooperatively with a token, and prefer tasks for almost everything.

<code id="code-content" class="language-csharp">
// Multithreading in C#
using System.Threading;
static void Report(string label)
    =&gt; Console.WriteLine($"{label} on thread {Environment.CurrentManagedThreadId}");
// Create, start and join a foreground thread
var worker = new Thread(() =&gt;
{
    for (int i = 0; i &lt; 3; i++)
    {
        Report($"Worker step {i}");
        Thread.Sleep(50);
    }
}) { Name = "Worker" };
worker.Start();
Report("Main continues");
worker.Join();                            // wait for the worker
Console.WriteLine("Worker finished");
// A background thread dies when the process ends
var monitor = new Thread(() =&gt;
{
    while (true) { Thread.Sleep(100); }
}) { IsBackground = true, Name = "Monitor" };
monitor.Start();
// Locals are per thread, so each thread counts to 1000
static void Count()
{
    int local = 0;
    for (int i = 0; i &lt; 1000; i++) local++;
    Console.WriteLine($"Local count: {local}");
}
var t1 = new Thread(Count);
var t2 = new Thread(Count);
t1.Start(); t2.Start();
t1.Join(); t2.Join();
// Thread local storage gives each thread its own Random
var rng = new ThreadLocal&lt;Random&gt;(() =&gt; new Random());
Parallel.For(0, 3, _ =&gt; Report($"Rolled {rng.Value!.Next(1, 7)}"));
// Stop a thread cooperatively with a cancellation token
var cts = new CancellationTokenSource();
var loop = new Thread(() =&gt;
{
    int ticks = 0;
    while (!cts.Token.IsCancellationRequested)
    {
        ticks++;
        Thread.Sleep(10);
    }
    Console.WriteLine($"Loop stopped cleanly after {ticks} ticks");
});
loop.Start();
Thread.Sleep(200);
cts.Cancel();
loop.Join();
// The thread pool reuses threads for short jobs
ThreadPool.QueueUserWorkItem(_ =&gt; Report("Pool job"));
Thread.Sleep(100);
</code></pre>
