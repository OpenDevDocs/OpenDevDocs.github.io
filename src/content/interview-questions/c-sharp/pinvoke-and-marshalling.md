---
course: c-sharp
slug: pinvoke-and-marshalling
experienceLevel: senior
difficulty: hard
tags:
  - clr
  - memory
question: "How does P/Invoke work in .NET, and what is the difference between `DllImport` and `LibraryImport`?"
answer: |
  **P/Invoke** (platform invoke) lets managed code call functions exported from native libraries, such as Win32 APIs or `libc`. You declare a `static extern` or `static partial` method with the library name, and the runtime loads the library and finds the export.

  The hard part is **marshalling**, converting arguments and return values between the two worlds:

  - **Blittable** types, such as `int`, `double`, pointers, and structs containing only blittable fields, have the same memory layout on both sides and pass straight through.
  - **Non-blittable** types need conversion: `string` (which encoding, and who frees it?), `bool` (1 byte or 4?), arrays, and classes. Each conversion costs time and allocations, and mistakes corrupt memory.

  **`DllImport`** relies on marshalling stubs generated **at runtime** when the method is first called. They're opaque and less friendly to trimming and AOT.

  **`LibraryImport`** (.NET 7) is a **source generator**: you write a `partial` method, and the marshalling code is generated **at compile time**, where you can read and step through it. It's AOT-friendly and the recommended choice for new code. It requires `AllowUnsafeBlocks`.

  Also know `SetLastError = true` with `Marshal.GetLastPInvokeError()`, `SafeHandle` for OS handles, and C# 9 function pointers (`delegate* unmanaged`) for callbacks.
codeExample: |
  using System.Runtime.InteropServices;

  // Windows example; LibraryImport requires <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
  Console.WriteLine(Native.GetTickCount64() > 0);       // Output: True

  if (Native.SetEnvironmentVariableW("APP_MODE", "demo") == 0)   // BOOL: 0 = failure
      Console.WriteLine($"Win32 error {Marshal.GetLastPInvokeError()}");
  Console.WriteLine(Environment.GetEnvironmentVariable("APP_MODE")); // Output: demo

  internal static partial class Native
  {
      // Blittable signature: no conversion needed
      [LibraryImport("kernel32.dll")]
      internal static partial ulong GetTickCount64();

      // Strings need an explicit encoding; the stub is generated at compile time
      [LibraryImport("kernel32.dll", SetLastError = true,
          StringMarshalling = StringMarshalling.Utf16)]
      internal static partial int SetEnvironmentVariableW(string name, string? value);

      // Legacy style, with a stub generated at runtime:
      // [DllImport("kernel32.dll")] internal static extern ulong GetTickCount64();
  }
popularity: 6.8
isPublished: true
---
