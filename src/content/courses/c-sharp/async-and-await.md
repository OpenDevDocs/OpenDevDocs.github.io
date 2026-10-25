---
publishDate: 2026-04-21T11:37
title: Async and Await
slug: async-and-await
metadescription: Write non blocking code with async and await, understand what a Task is and what await really does, run work concurrently with WhenAll, cancel with tokens and avoid the classic async pitfalls.
updateDate: 2026-09-05T11:37
author: ['bishal-biswas']
level: 3
tags: ['async', 'tasks', 'concurrency']
course: c-sharp
---

## Waiting without blocking

Some operations take a long time and do no CPU work while they wait: downloading a file, reading from disk, querying a database. If your code sits and blocks, a desktop app freezes and a web server wastes a thread that could serve someone else.

**Asynchronous** code starts the operation, gives the thread back, and resumes when the result arrives.

```csharp
// Blocking: the thread does nothing useful for the whole download
string html = client.GetStringAsync(url).Result;

// Asynchronous: the thread is free until the download finishes
string html = await client.GetStringAsync(url);
```

## Task

A `Task` represents work that will finish in the future. `Task<T>` is one that produces a value of type `T`. Async methods return them instead of the raw result:

```csharp
Task<string> download = client.GetStringAsync(url);   // started, not finished
// do other things
string html = await download;                         // wait for it here
```

Think of a `Task<string>` as a promise of a string.

## async and await

Mark a method `async` and you can use `await` inside it. `await` pauses the method until the task completes, without blocking the thread, then continues with the result:

```csharp
static async Task<int> CountWordsAsync(string path)
{
    string text = await File.ReadAllTextAsync(path);
    return text.Split(' ').Length;
}

int words = await CountWordsAsync("essay.txt");
Console.WriteLine(words);
```

Three rules of the signature:

- An async method returns `Task` (no result), `Task<T>` (a result) or `ValueTask` for hot paths.
- Name it with the `Async` suffix by convention.
- The body writes `return value;`, not `return Task.FromResult(value)`. The compiler wraps it.

## What await actually does

When execution reaches an `await` on a task that has not finished:

1. The method returns to its caller immediately, handing back an incomplete `Task`.
2. The rest of the method is registered as a **continuation**.
3. When the awaited task finishes, the continuation runs, picking up exactly where it left off.

The method is effectively split into pieces at each `await`. Everything after it is scheduled for later. That is why async code looks sequential but does not block.

If the task is already complete, `await` just takes the result and carries on. There is no pause.

## Async all the way

Once a method awaits, its caller must await it, and so on up to the top. Top level statements can await directly, and `Main` can be `async Task Main()`:

```csharp
static async Task Main()
{
    await RunAsync();
}
```

Blocking on a task with `.Result` or `.Wait()` in the middle of an async chain is the number one cause of deadlocks in UI and older ASP.NET apps. Do not do it.

## Running things concurrently

Awaiting one call after another runs them in sequence:

```csharp
var a = await GetAsync("https://a.example");   // 1 second
var b = await GetAsync("https://b.example");   // 1 second
// total: 2 seconds
```

Start both, then await both:

```csharp
Task<string> taskA = GetAsync("https://a.example");
Task<string> taskB = GetAsync("https://b.example");

string[] results = await Task.WhenAll(taskA, taskB);
// total: about 1 second
```

`Task.WhenAll` waits for every task. `Task.WhenAny` returns as soon as the first one finishes, useful for timeouts and racing sources.

## Exceptions in async code

An exception thrown inside an async method is stored in the task and rethrown when you `await` it. `try` and `catch` work as normal:

```csharp
try
{
    string html = await client.GetStringAsync("https://bad.example");
}
catch (HttpRequestException ex)
{
    Console.WriteLine($"Request failed: {ex.Message}");
}
```

With `WhenAll`, if several tasks fail, `await` throws only the first exception. The rest are on `task.Exception.InnerExceptions`.

## Cancellation

Long operations should be cancellable. The pattern is a `CancellationToken` passed all the way down:

```csharp
static async Task ProcessAsync(CancellationToken token)
{
    for (int i = 0; i < 100; i++)
    {
        token.ThrowIfCancellationRequested();
        await Task.Delay(100, token);
        Console.WriteLine($"Step {i}");
    }
}

using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(1));

try
{
    await ProcessAsync(cts.Token);
}
catch (OperationCanceledException)
{
    Console.WriteLine("Cancelled");
}
```

Most built in async methods accept a token. Pass it through rather than ignoring it.

## Task.Delay, not Thread.Sleep

`Thread.Sleep` blocks the thread. `Task.Delay` returns a task that completes later and frees the thread in between:

```csharp
await Task.Delay(1000);   // wait one second without blocking
```

## CPU bound work

`async` is for waiting on I/O. For heavy calculation you need another thread, and `Task.Run` gives you one from the thread pool:

```csharp
int result = await Task.Run(() => CrunchNumbers(data));
```

Use it in desktop apps to keep the UI responsive. In a web server, avoid it. The server already has a thread per request and `Task.Run` just adds overhead.

## Common mistakes

**async void**: only for event handlers. The caller cannot await it or catch its exceptions. Everywhere else return `Task`.

**Forgetting await**: calling an async method without awaiting starts it and discards the result. The compiler warns you. Exceptions vanish silently.

**Blocking with .Result**: deadlocks in UI contexts and wastes threads everywhere else.

**Async in constructors**: not allowed. Use a static `CreateAsync` factory method.

## ValueTask

`ValueTask<T>` avoids allocating a `Task` when the result is often already available, such as a cache hit. Use it only in measured hot paths. `Task` is the right default.

## Quick recap

- `async` and `await` let code wait for I/O without blocking a thread.
- `Task` is a future result, `Task<T>` a future value, and async methods return them.
- `await` splits the method and resumes it when the task completes.
- Start tasks first and use `Task.WhenAll` to run them concurrently.
- Pass a `CancellationToken` through long operations and catch `OperationCanceledException`.
- Never block with `.Result` or `.Wait()`, and avoid `async void` outside event handlers.

<code id="code-content" class="language-csharp">
// Async and await in C#
// An async method returns Task&lt;T&gt; and awaits I/O style work
static async Task&lt;string&gt; FetchAsync(string name, int ms, CancellationToken token = default)
{
    await Task.Delay(ms, token);          // stands in for a network call
    return $"{name} done after {ms}ms";
}
// Sequential: total time is the sum
var watch = System.Diagnostics.Stopwatch.StartNew();
Console.WriteLine(await FetchAsync("A", 300));
Console.WriteLine(await FetchAsync("B", 300));
Console.WriteLine($"Sequential: {watch.ElapsedMilliseconds}ms");
// Concurrent: start both, then await both
watch.Restart();
Task&lt;string&gt; taskA = FetchAsync("A", 300);
Task&lt;string&gt; taskB = FetchAsync("B", 300);
string[] results = await Task.WhenAll(taskA, taskB);
Console.WriteLine(string.Join(" | ", results));
Console.WriteLine($"Concurrent: {watch.ElapsedMilliseconds}ms");
// WhenAny: react to whichever finishes first
Task&lt;string&gt; fast = FetchAsync("fast", 100);
Task&lt;string&gt; slow = FetchAsync("slow", 1000);
Task&lt;string&gt; winner = await Task.WhenAny(fast, slow);
Console.WriteLine($"First: {await winner}");
// Exceptions surface at the await
static async Task FailAsync()
{
    await Task.Delay(10);
    throw new InvalidOperationException("boom");
}
try { await FailAsync(); }
catch (InvalidOperationException ex) { Console.WriteLine($"Caught: {ex.Message}"); }
// Cancellation with a token
using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(200));
try
{
    await FetchAsync("long job", 5000, cts.Token);
}
catch (OperationCanceledException)
{
    Console.WriteLine("Cancelled after 200ms");
}
// CPU bound work goes to the thread pool
int sum = await Task.Run(() =&gt; Enumerable.Range(1, 1_000_000).Sum());
Console.WriteLine(sum);
</code></pre>
