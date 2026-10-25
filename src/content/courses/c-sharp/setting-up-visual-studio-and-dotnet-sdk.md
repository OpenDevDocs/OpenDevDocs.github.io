---
publishDate: 2026-04-01T11:01
title: Setting Up Visual Studio and .NET SDK
slug: setting-up-visual-studio-and-dotnet-sdk
metadescription: Install the .NET SDK, pick an editor, create your first project from the command line and learn the handful of dotnet commands you will use every day.
updateDate: 2026-09-05T11:01
author: ['bishal-biswas']
level: 1
tags: ['setup', 'tooling']
course: c-sharp
---

## What you need

To write and run C# you need exactly two things:

1. **The .NET SDK**, which includes the compiler, the runtime and the `dotnet` command line tool.
2. **An editor**, so you can write code comfortably.

That is it. There is no separate compiler download and no configuration file to hand write.

## Installing the .NET SDK

Go to the official .NET download page and pick the latest **LTS** (Long Term Support) version of the SDK for your operating system. Run the installer and accept the defaults.

To confirm it worked, open a terminal and type:

```bash
dotnet --version
```

You should see a version number such as `8.0.400` or higher. If the command is not found, close and reopen the terminal so it picks up the new path.

> **Note:** Download the **SDK**, not just the **Runtime**. The runtime only runs programs. The SDK builds them.

## Choosing an editor

You have three good options.

### Visual Studio (Windows and Mac)

The full featured IDE from Microsoft. The **Community** edition is free. During install, tick the **.NET desktop development** workload. This gives you the best debugger and designers, but it is a large download.

### Visual Studio Code (all platforms)

A lightweight editor. Install it, then add the **C# Dev Kit** extension from the extensions panel. This is the most popular choice for learners and for cross platform work, and it is what this course assumes.

### JetBrains Rider (all platforms)

A paid IDE with excellent refactoring tools. Free for students and open source projects.

Any of the three will run every example in this course.

## Creating your first project

The `dotnet` tool can create a project from a template. Open a terminal in the folder where you keep your code and run:

```bash
dotnet new console -n HelloWorld
```

This creates a folder called `HelloWorld` containing:

- `HelloWorld.csproj`: the project file, which tells .NET how to build the app.
- `Program.cs`: your source code.
- `obj/` and `bin/`: build output folders, which you can ignore.

Move into the folder and run the program:

```bash
cd HelloWorld
dotnet run
```

You should see `Hello, World!` printed to the terminal.

## The project file

Open `HelloWorld.csproj`. It is a small XML file:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

</Project>
```

- `OutputType` says this is an executable, not a library.
- `TargetFramework` is the .NET version.
- `ImplicitUsings` adds common namespaces such as `System` automatically.
- `Nullable` turns on nullable reference type warnings, which help you avoid null errors.

You rarely edit this file by hand at the start, but it is good to know what it does.

## The commands you will use every day

```bash
dotnet new console -n MyApp          # create a console project
dotnet run                           # build and run
dotnet build                         # build only, show errors
dotnet add package Newtonsoft.Json   # add a NuGet package
dotnet --info                        # show installed SDKs and runtimes
```

`dotnet run` is the one you will type most. It compiles your code and runs it in one step.

## Running from the editor

In VS Code, open the `HelloWorld` folder, then press `F5`. The C# Dev Kit extension builds the project, starts it and attaches the debugger. You can set a breakpoint by clicking to the left of a line number, and execution will pause there so you can inspect variables.

In Visual Studio, open the `.csproj` file and press `F5` for the same result.

## Quick recap

- The .NET SDK gives you the compiler, runtime and `dotnet` command.
- VS Code with the C# Dev Kit extension is a free, cross platform editor that works well for this course.
- `dotnet new console -n Name` creates a project and `dotnet run` runs it.
- The `.csproj` file describes the project, and you rarely need to edit it early on.

In the next topic you will look closely at what is inside `Program.cs` and write your first real program.

<code id="code-content" class="language-csharp">
// Program.cs created by: dotnet new console -n HelloWorld
// With ImplicitUsings enabled you do not need "using System;"
// Print a greeting
Console.WriteLine("Hello, World!");
// Ask the user for their name
Console.Write("What is your name? ");
string? name = Console.ReadLine();
// Reply using the value they typed
Console.WriteLine($"Nice to meet you, {name}!");
// Show which .NET version is running this program
Console.WriteLine($"Running on .NET {Environment.Version}");
// Run it with:   dotnet run
// Build only:    dotnet build
</code></pre>
