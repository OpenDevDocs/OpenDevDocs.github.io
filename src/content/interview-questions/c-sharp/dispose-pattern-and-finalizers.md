---
course: c-sharp
slug: dispose-pattern-and-finalizers
experienceLevel: mid
difficulty: medium
tags:
  - memory
question: "What is the Dispose pattern in C#, and how do finalizers relate to it?"
answer: |
  `IDisposable.Dispose()` gives **deterministic cleanup**: the caller, usually through `using`, releases resources at a known point. A **finalizer** (`~MyClass()`) is a **safety net**: the GC calls it on a dedicated finalizer thread at some unknown time after the object becomes unreachable.

  The classic pattern, for a class that owns an **unmanaged** resource directly:

  - `Dispose()` calls `Dispose(true)` and then `GC.SuppressFinalize(this)`.
  - The finalizer calls `Dispose(false)`.
  - `Dispose(bool disposing)` always frees the unmanaged resources, but touches other managed objects only when `disposing` is `true`, since during finalization they may already be finalized.
  - A `_disposed` flag makes disposal idempotent, and methods called afterward throw `ObjectDisposedException` (`ObjectDisposedException.ThrowIf` in .NET 7+).

  Most classes need far less. If a class only holds other `IDisposable` objects, it just implements `Dispose()` and disposes them. It needs no finalizer, and a `sealed` class can skip the `protected virtual Dispose(bool)` overload. For raw OS handles, wrap them in a `SafeHandle` instead of writing a finalizer yourself.
codeExample: |
  public sealed class NativeBuffer : IDisposable
  {
      private readonly IntPtr _memory = Marshal.AllocHGlobal(1024);    // unmanaged
      private readonly FileStream _log = File.OpenWrite("buffer.log"); // managed
      private bool _disposed;

      public void Write(byte value)
      {
          ObjectDisposedException.ThrowIf(_disposed, this);
          Marshal.WriteByte(_memory, value);
      }
      public void Dispose()
      {
          Dispose(disposing: true);
          GC.SuppressFinalize(this);         // cleanup done: skip the finalizer
      }
      ~NativeBuffer() => Dispose(disposing: false); // safety net if Dispose is forgotten
      private void Dispose(bool disposing)
      {
          if (_disposed) return;
          if (disposing) _log.Dispose();     // managed objects: only from Dispose()
          Marshal.FreeHGlobal(_memory);      // unmanaged: always
          _disposed = true;
      }
  }
popularity: 8.6
isPublished: true
---
