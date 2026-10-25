---
publishDate: 2026-09-01T09:10
title: Setting Up the .NET SDK and Tools
slug: setting-up-the-dotnet-sdk-and-tools
metadescription: Install the .NET SDK, check it works from the terminal, pick an editor, and learn the handful of dotnet CLI commands you will use every day.
updateDate: 2026-09-07T09:10
author: ['bishal-biswas']
level: 1
tags: ['setup', 'dotnet-cli', 'tools']
course: dotnet-webapi
---

## What you actually need

To build a Web API you need three things:

1. The **.NET SDK**, which contains the compiler, the runtime and the `dotnet` command
2. An **editor**, such as Visual Studio, Visual Studio Code or Rider
3. A way to **send test requests**, such as the built in Swagger page or a `.http` file

That is it. No web server to install, no database to set up yet. The SDK ships with a server called Kestrel that runs your API locally.

## Installing the .NET SDK

Go to the official download page at `dotnet.microsoft.com/download` and pick the latest **LTS** version. LTS means Long Term Support, so it gets fixes for three years. Choose the **SDK**, not the Runtime. The Runtime can only run apps. The SDK can build them.

On Windows you can also use winget:

```bash
winget install Microsoft.DotNet.SDK.8
```

On macOS with Homebrew:

```bash
brew install --cask dotnet-sdk
```

On Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y dotnet-sdk-8.0
```

## Checking that it worked

Open a fresh terminal. A new terminal matters, because the installer changes your PATH and an old window will not see it.

```bash
dotnet --version
```

You should see something like `8.0.404`. If you get "command not found", close every terminal, open a new one, and try again. If it still fails, the installer did not add `dotnet` to your PATH.

To see everything installed on the machine:

```bash
dotnet --info
```

This prints your SDK versions, your runtimes and your operating system. It is the first thing to paste when you ask someone for help.

## Choosing an editor

Any of these work well. Pick the one you are comfortable with.

**Visual Studio** on Windows is the heaviest option and the most guided. It has a visual debugger, NuGet package UI and scaffolding menus. Install the "ASP.NET and web development" workload.

**Visual Studio Code** is light and cross platform. Install the **C# Dev Kit** extension. This gives you IntelliSense, debugging and test running.

**JetBrains Rider** is a paid cross platform IDE that many .NET developers prefer.

This course uses the terminal for commands so it works with all three.

## The dotnet CLI commands you will use

Almost everything you do goes through the `dotnet` command. Here are the ones that matter.

**Create a project** from a template:

```bash
dotnet new webapi -n MyApi
```

**Restore** the NuGet packages a project depends on. Modern commands do this automatically, so you rarely run it alone:

```bash
dotnet restore
```

**Build** the project, which compiles it and reports errors:

```bash
dotnet build
```

**Run** the project. This builds first, then starts the server:

```bash
dotnet run
```

**Watch** the project. This is the one you will actually use. It restarts the API whenever you save a file:

```bash
dotnet watch run
```

**Add a NuGet package** to the project in the current folder:

```bash
dotnet add package Serilog.AspNetCore
```

**Run tests** in a test project:

```bash
dotnet test
```

To see every available template:

```bash
dotnet new list
```

## Solutions, for when one project is not enough

A real API usually grows into several projects: the API itself, a class library for your data code, and a test project. A **solution** file groups them so one command builds them all.

```bash
dotnet new sln -n Shop

dotnet new webapi -n Shop.Api
dotnet new classlib -n Shop.Data
dotnet new xunit -n Shop.Tests

dotnet sln add Shop.Api Shop.Data Shop.Tests
```

Then let one project use another:

```bash
dotnet add Shop.Api reference Shop.Data
```

Now `dotnet build` at the solution level builds everything in the right order. You do not need this on day one, but it is good to know the shape.

## Trusting the local HTTPS certificate

ASP.NET Core serves HTTPS locally using a self signed development certificate. Your browser will not trust it until you say so:

```bash
dotnet dev-certs https --trust
```

Run this once per machine. On Windows and macOS a prompt appears. Accept it. Without this you get certificate warnings every time you open the API in a browser.

## Global tools

Some tools install once and work everywhere. The Entity Framework Core tool is the one you will need later for database migrations:

```bash
dotnet tool install --global dotnet-ef
```

Check it:

```bash
dotnet ef --version
```

To update it later:

```bash
dotnet tool update --global dotnet-ef
```

## A quick smoke test

Let us prove the whole toolchain works before moving on:

```bash
dotnet new webapi -n HelloApi
cd HelloApi
dotnet run
```

The terminal prints something like:

```text
Now listening on: https://localhost:7042
Now listening on: http://localhost:5042
```

Open the HTTPS address in a browser and add `/swagger` to the end. You should see a documentation page listing the sample endpoint. Press `Ctrl+C` in the terminal to stop the server.

If you got that far, your machine is ready.

## Common problems

**The port is already in use.** Another copy of the API is still running. Close it, or change the port in `Properties/launchSettings.json`.

**`dotnet` is not recognised.** Your PATH is stale. Open a new terminal. On Linux, log out and back in.

**The browser warns about the certificate.** You skipped `dotnet dev-certs https --trust`.

**Packages fail to restore.** You are offline, or behind a proxy that blocks `nuget.org`.

## Quick recap

- Install the .NET **SDK**, not just the runtime, and prefer the latest LTS version.
- Confirm the install with `dotnet --version` in a brand new terminal.
- `dotnet new`, `dotnet build`, `dotnet run` and `dotnet watch run` cover most daily work.
- `dotnet watch run` restarts the API on every save, so use it while developing.
- Run `dotnet dev-certs https --trust` once so local HTTPS stops warning you.
- Install `dotnet-ef` as a global tool now. You will need it when the database chapters start.

<code id="code-content" class="language-csharp">
// Program.cs - a first API you can use to confirm your setup works.
// 1) dotnet new webapi -n HelloApi
// 2) cd HelloApi
// 3) dotnet watch run
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
// A plain text endpoint: the simplest thing that can possibly work
app.MapGet("/", () =&gt; "The API is running.");
// A JSON endpoint. The framework serializes the object for you.
app.MapGet("/api/environment", (IWebHostEnvironment env) =&gt; new
{
    Application  = env.ApplicationName,
    Environment  = env.EnvironmentName,                       // Development
    DotNetVersion = Environment.Version.ToString(),           // e.g. 8.0.11
    Os           = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
    StartedAtUtc = DateTime.UtcNow
});
// A health endpoint you can call to check the server is awake
app.MapGet("/api/ping", () =&gt; Results.Ok(new { status = "ok" }));
app.Run();
</code></pre>
