---
publishDate: 2026-04-20T11:36
title: IDisposable and Resource Management
slug: idisposable-and-resource-management
metadescription: Release files, connections and other unmanaged resources deterministically with IDisposable and using, implement the dispose pattern correctly, and use IAsyncDisposable for async cleanup.
updateDate: 2026-09-05T11:36
author: ['bishal-biswas']
level: 3
tags: ['memory', 'idisposable', 'resources']
course: c-sharp
---

## The garbage collector is not enough

The GC frees **memory**. It knows nothing about file handles, database connections, sockets, or graphics contexts. Those belong to the operating system and are limited. If you open a file and wait for the GC to eventually close it, the file stays locked for an unpredictable time, and if you do it in a loop you run out of handles.

.NET solves this with a convention: any type that holds such a resource implements `IDisposable`, and the user calls `Dispose()` the moment they are done.

```csharp
public interface IDisposable
{
    void Dispose();
}
```

## The using statement

Calling `Dispose` by hand is easy to forget, especially when exceptions are involved. The `using` statement guarantees it:

```csharp
using (var reader = new StreamReader("data.txt"))
{
    Console.WriteLine(reader.ReadLine());
}   // reader.Dispose() runs here, even if ReadLine threw
```

It compiles to a `try` with `Dispose` in the `finally`. The **using declaration** form disposes at the end of the enclosing block and saves a level of indentation:

```csharp
using var connection = new SqlConnection(connectionString);
using var command = connection.CreateCommand();
connection.Open();
// both disposed at the end of the method, in reverse order
```

Rule: if a type implements `IDisposable`, wrap it in `using`. Streams, readers, writers, `HttpClient` responses, database objects, timers and cancellation token sources all qualify.

## Implementing IDisposable

If your class **owns** a disposable, it must be disposable too, so it can pass the call along:

```csharp
class LogWriter : IDisposable
{
    private readonly StreamWriter writer;

    public LogWriter(string path)
    {
        writer = new StreamWriter(path, append: true);
    }

    public void Log(string message) => writer.WriteLine($"{DateTime.Now:HH:mm:ss} {message}");

    public void Dispose()
    {
        writer.Dispose();
    }
}

using (var log = new LogWriter("app.log"))
{
    log.Log("Started");
}
```

This is the common case, and it is this simple. Dispose what you own, nothing more.

## Guarding against double disposal

Callers may dispose twice. Make it harmless:

```csharp
private bool disposed;

public void Dispose()
{
    if (disposed) return;
    writer.Dispose();
    disposed = true;
}

public void Log(string message)
{
    ObjectDisposedException.ThrowIf(disposed, this);
    writer.WriteLine(message);
}
```

## The full dispose pattern

When a class holds an **unmanaged** resource directly, such as a raw OS handle obtained through interop, it also needs a finalizer as a safety net. The standard pattern handles both paths:

```csharp
class NativeResource : IDisposable
{
    private IntPtr handle;
    private bool disposed;

    public NativeResource() => handle = NativeMethods.Open();

    public void Dispose()
    {
        Dispose(disposing: true);
        GC.SuppressFinalize(this);   // finalizer no longer needed
    }

    protected virtual void Dispose(bool disposing)
    {
        if (disposed) return;

        if (disposing)
        {
            // free managed resources here (other IDisposables)
        }

        NativeMethods.Close(handle);  // free unmanaged resource in both paths
        handle = IntPtr.Zero;
        disposed = true;
    }

    ~NativeResource() => Dispose(disposing: false);
}
```

`disposing` is `true` when called from `Dispose` and `false` from the finalizer. In the finalizer you must not touch other managed objects because they may already be gone.

You will rarely need this. Wrapping the handle in a `SafeHandle` subclass is the modern approach and lets you skip the finalizer entirely. But you will see this pattern in existing code, so it is worth recognising.

## IAsyncDisposable

Some cleanup is itself asynchronous, such as flushing a network stream. `IAsyncDisposable` provides `DisposeAsync`, and `await using` calls it:

```csharp
class RemoteLogger : IAsyncDisposable
{
    private readonly Stream stream;

    public RemoteLogger(Stream s) => stream = s;

    public async ValueTask DisposeAsync()
    {
        await stream.FlushAsync();
        await stream.DisposeAsync();
    }
}

await using var logger = new RemoteLogger(networkStream);
```

Modern streams and database connections implement both interfaces.

## Ownership

The hardest part of disposal is deciding **who** disposes. The rule: whoever creates the object disposes it, unless ownership is clearly handed over.

```csharp
// Caller owns the stream and disposes it
using var file = File.OpenRead("data.bin");
Process(file);   // Process must not dispose it

// Or the method takes ownership and documents that
var reader = new StreamReader(File.OpenRead("data.bin"));   // reader now owns the stream
reader.Dispose();   // disposes both
```

Ambiguity here causes bugs in both directions: double disposal or a stream left open.

## HttpClient is the exception

`HttpClient` implements `IDisposable`, but creating and disposing one per request exhausts sockets. Create one and reuse it for the life of the application, or use `IHttpClientFactory` in ASP.NET Core. This is the one famous case where "always use using" is wrong.

## Quick recap

- The GC frees memory, not files, sockets or handles. `IDisposable` covers those.
- Wrap every disposable in `using` so `Dispose` runs even when exceptions occur.
- If your class owns a disposable, implement `IDisposable` and dispose it.
- Make `Dispose` safe to call twice and throw `ObjectDisposedException` on use after disposal.
- The full pattern with a finalizer is only for direct unmanaged resources.
- `IAsyncDisposable` and `await using` handle asynchronous cleanup.

<code id="code-content" class="language-csharp">
// IDisposable and resource management
class LogWriter : IDisposable
{
    private readonly StreamWriter writer;
    private bool disposed;
    public LogWriter(string path)
    {
        writer = new StreamWriter(path, append: true);
        Console.WriteLine("Log opened");
    }
    public void Log(string message)
    {
        ObjectDisposedException.ThrowIf(disposed, this);   // refuse use after disposal
        writer.WriteLine($"{DateTime.Now:HH:mm:ss} {message}");
    }
    public void Dispose()
    {
        if (disposed) return;                              // safe to call twice
        writer.Dispose();                                  // release what we own
        disposed = true;
        Console.WriteLine("Log closed");
    }
}
class RemoteLogger : IAsyncDisposable
{
    private readonly MemoryStream stream = new();
    public async Task WriteAsync(string s)
        =&gt; await stream.WriteAsync(System.Text.Encoding.UTF8.GetBytes(s + "\n"));
    public async ValueTask DisposeAsync()
    {
        await stream.FlushAsync();
        await stream.DisposeAsync();
        Console.WriteLine("Remote logger closed");
    }
}
// using statement: Dispose runs even if an exception is thrown
using (var log = new LogWriter("app.log"))
{
    log.Log("Started");
    log.Log("Working");
}
// using declaration: disposed at the end of the enclosing block
{
    using var log2 = new LogWriter("app.log");
    log2.Log("Second session");
}
// await using for async cleanup
await using (var remote = new RemoteLogger())
{
    await remote.WriteAsync("hello");
}
// Using after disposal throws
var stray = new LogWriter("app.log");
stray.Dispose();
stray.Dispose();                                           // harmless
try { stray.Log("oops"); }
catch (ObjectDisposedException) { Console.WriteLine("Cannot log after dispose"); }
</code></pre>
