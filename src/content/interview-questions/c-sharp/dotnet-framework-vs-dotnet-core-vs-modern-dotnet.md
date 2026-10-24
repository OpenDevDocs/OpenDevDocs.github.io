---
course: c-sharp
slug: dotnet-framework-vs-dotnet-core-vs-modern-dotnet
experienceLevel: fresher
difficulty: easy
tags:
  - clr
  - basics
question: "What is the difference between .NET Framework, .NET Core, and modern .NET (.NET 5 and later)?"
answer: |
  They are three generations of one platform. **.NET Framework** is the original Windows-only runtime, **.NET Core** is its cross-platform, open-source rewrite, and **modern .NET** (.NET 5 and later) unified the line under the single name .NET.

  - **.NET Framework:** Windows only. Version 4.8.x is the final release; it is in maintenance mode, getting security and reliability fixes but no new features.
  - **.NET Core (1.0 to 3.1):** cross-platform, open source, modular, much faster, and installable side by side.
  - **Modern .NET:** .NET 5 dropped "Core" from the name, and a new major version ships every November. Even-numbered releases get long-term support (LTS) and odd-numbered ones get standard-term support (STS). .NET 10, released in November 2025, is the current LTS.

  Target modern .NET for every new project. Keep .NET Framework only for legacy apps that depend on technologies it alone supports, such as ASP.NET Web Forms or .NET Remoting.
codeExample: |
  using System.Runtime.InteropServices;

  // Reports which runtime the app is running on
  Console.WriteLine(RuntimeInformation.FrameworkDescription);
  // Output depends on the TargetFramework in the .csproj:
  //   net48         -> .NET Framework 4.8.x  (Windows only)
  //   netcoreapp3.1 -> .NET Core 3.1.x
  //   net10.0       -> .NET 10.0.x           (Windows, Linux, macOS)

  // Built-in symbols let one codebase target several platforms
  #if NETFRAMEWORK
  Console.WriteLine("Legacy .NET Framework build");
  #elif NET5_0_OR_GREATER
  Console.WriteLine("Modern .NET build");
  #endif
popularity: 8.0
isPublished: true
---
