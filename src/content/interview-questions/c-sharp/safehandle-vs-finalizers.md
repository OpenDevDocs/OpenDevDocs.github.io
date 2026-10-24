---
course: c-sharp
slug: safehandle-vs-finalizers
experienceLevel: senior
difficulty: hard
tags:
  - memory
  - clr
question: "Why is `SafeHandle` preferred over writing your own finalizer for unmanaged resources?"
answer: |
  `SafeHandle` owns exactly one OS handle, and it solves problems that hand-written finalizers get wrong:

  - **Critical finalization:** `SafeHandle` derives from `CriticalFinalizerObject`, so its release code runs even where ordinary finalizers might not.
  - **Reference counting during interop:** while a P/Invoke call is using the handle, the marshaller increments a reference count, so another thread calling `Dispose()` can't close the handle mid-call. Otherwise the OS could reuse the handle value for a different resource, a **handle-recycling** bug with security implications.
  - **Marshalling integration:** P/Invoke signatures can return and accept `SafeHandle` subclasses directly, so a raw `IntPtr` never leaks into your code.
  - **Simpler owners:** your class just holds the `SafeHandle` and implements `IDisposable`. It needs **no finalizer** of its own.

  Hand-written finalizers carry real costs: the object survives at least one extra GC while it waits in the finalization queue, finalizers run on a single thread in no guaranteed order, and an exception thrown in a finalizer crashes the process.

  To implement one, subclass `SafeHandleZeroOrMinusOneIsInvalid` (or `SafeHandle`), override `ReleaseHandle()` to call the native close function, and return the type from your `LibraryImport` declarations. The BCL already provides `SafeFileHandle` and `SafeWaitHandle`.
codeExample: |
  using System.Runtime.InteropServices;
  using Microsoft.Win32.SafeHandles;

  // Windows example; LibraryImport requires AllowUnsafeBlocks in the .csproj
  public sealed class NativeEvent : IDisposable      // no finalizer needed here
  {
      private readonly SafeEventHandle _handle = Native.CreateEventW(0, 1, 0, null);
      public void Dispose() => _handle.Dispose();
  }

  public sealed class SafeEventHandle : SafeHandleZeroOrMinusOneIsInvalid
  {
      public SafeEventHandle() : base(ownsHandle: true) { }
      protected override bool ReleaseHandle() => Native.CloseHandle(handle) != 0;
  }

  internal static partial class Native
  {
      [LibraryImport("kernel32.dll", SetLastError = true,
          StringMarshalling = StringMarshalling.Utf16)]
      internal static partial SafeEventHandle CreateEventW(
          nint attributes, int manualReset, int initialState, string? name);
      [LibraryImport("kernel32.dll", SetLastError = true)]
      internal static partial int CloseHandle(nint handle);
  }
popularity: 7.0
isPublished: true
---
