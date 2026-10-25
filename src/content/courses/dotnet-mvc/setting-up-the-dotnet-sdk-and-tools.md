---
publishDate: 2026-08-01T09:10
title: Setting Up the .NET SDK and Tools
slug: setting-up-the-dotnet-sdk-and-tools
metadescription: Install the .NET 10 SDK, check that it works, choose an editor such as Visual Studio, VS Code or Rider, trust the local HTTPS certificate and learn the dotnet commands you will use every day.
updateDate: 2026-09-13T09:10
author: ['bishal-biswas']
level: 1
tags: ['setup', 'dotnet-cli', 'tools']
course: dotnet-mvc
---

## What you need

To build ASP.NET Core MVC apps you need three things:

1. The **.NET SDK**, which contains everything needed to create, build and run .NET apps.
2. A **code editor**.
3. A **web browser** to look at your pages.

All three are free.

## SDK or runtime?

The .NET download page offers two kinds of downloads, and beginners often grab the wrong one.

- The **runtime** can only **run** apps that are already built. Servers use it.
- The **SDK** (Software Development Kit) can **create, build and run** apps. It already includes the runtime.

As a developer, always install the **SDK**.

## Which version?

This course uses **.NET 10**. It is an **LTS** release, which stands for Long Term Support. LTS versions get free updates and security fixes for three years, so they are the safest choice for learning and for real projects.

## Installing the SDK

### Windows

Download the installer from `https://dot.net`, run it and click through the steps. If you prefer the terminal, winget does the same job:

```powershell
winget install Microsoft.DotNet.SDK.10
```

### macOS

Download the macOS installer from `https://dot.net`. Pick **Arm64** for Apple Silicon Macs (M1 and newer) or **x64** for older Intel Macs. Homebrew works too:

```bash
brew install --cask dotnet-sdk
```

### Linux

Most distributions can install .NET from their package manager. On Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y dotnet-sdk-10.0
```

If the package is not found on your Ubuntu version, add the .NET backports repository with `sudo add-apt-repository ppa:dotnet/backports` and run the two commands again. Other distributions are listed on the .NET download page.

## Check that it worked

Close your terminal and open a new one, so it picks up the new `dotnet` command. Then run:

```bash
dotnet --version
```

You should see a version number that starts with 10:

```text
10.0.100
```

To see every SDK installed on your machine:

```bash
dotnet --list-sdks
```

```text
8.0.404 [C:\Program Files\dotnet\sdk]
10.0.100 [C:\Program Files\dotnet\sdk]
```

Having several SDKs side by side is normal and safe. The newest one is used unless a project asks for a specific version.

If you see `'dotnet' is not recognized` or `command not found`, your terminal cannot find the install folder yet. Opening a new terminal, or restarting your computer on Windows, fixes this almost every time.

## Choosing an editor

Any of these work well. Pick one and stick with it for the course.

**Visual Studio** (Windows). The Community edition is free for students, hobby projects and small teams. During install, tick the **ASP.NET and web development** workload. It has the most built in tooling, such as page scaffolding and a visual debugger.

**Visual Studio Code** (Windows, macOS, Linux). A lighter, faster editor. Install the **C# Dev Kit** extension from Microsoft to get code completion, debugging and a Solution Explorer.

**JetBrains Rider** (Windows, macOS, Linux). A full featured IDE that is free for non commercial use, such as learning and personal projects.

This course shows every step with the `dotnet` command line tool, so the instructions work no matter which editor you choose.

## Trust the HTTPS development certificate

While you develop, ASP.NET Core can serve your site on `https://localhost`. For that it needs a local certificate. Trust it once with:

```bash
dotnet dev-certs https --trust
```

On Windows and macOS a confirmation box appears. Click **Yes**. Without this step your browser shows a "Your connection is not private" warning every time you open your app over HTTPS. On some Linux setups the browser may still warn you, which is safe to click past for your own localhost site.

## The dotnet CLI in five minutes

The `dotnet` command is your main tool. CLI stands for Command Line Interface. Here are the commands you will use again and again:

```bash
dotnet new list                 # show every project template
dotnet new mvc -n ShopApp       # create a new MVC project called ShopApp
dotnet build                    # compile the project and show any errors
dotnet run                      # build and start the app
dotnet watch                    # start the app and reload it when you save a file
dotnet add package Humanizer    # install a NuGet package
dotnet test                     # run unit tests
dotnet publish -c Release       # produce files ready to deploy
```

Every command has built in help. Add `-h` to see the options:

```bash
dotnet new mvc -h
```

## NuGet packages

**NuGet** is the package manager for .NET. It is the same idea as npm for JavaScript or pip for Python. Packages are ready made libraries that other developers share. You can browse them at `https://www.nuget.org`.

When you add a package, it is recorded in your project file:

```xml
<ItemGroup>
  <PackageReference Include="Humanizer" Version="2.14.1" />
</ItemGroup>
```

The next time anyone builds the project, the SDK downloads the same package automatically.

## Global tools

Some tools are installed once for your whole computer instead of per project. You will use these two later in the course:

```bash
dotnet tool install --global dotnet-ef                     # database migrations
dotnet tool install --global dotnet-aspnet-codegenerator   # scaffolding controllers and views
```

To update a tool later, run `dotnet tool update --global dotnet-ef`.

## Pin an SDK version for a project

When a team shares a project, everyone should build with the same SDK. A `global.json` file in the project folder takes care of that:

```bash
dotnet new globaljson --sdk-version 10.0.100 --roll-forward latestFeature
```

This creates:

```json
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature"
  }
}
```

`latestFeature` means "use 10.0.100 or any newer .NET 10 SDK". You do not need this file while learning, but it is good to recognise when you see it.

## Quick recap

- Install the **.NET SDK**, not just the runtime. This course uses .NET 10, an LTS release.
- Check your install with `dotnet --version` and `dotnet --list-sdks`.
- Visual Studio, VS Code with C# Dev Kit, and Rider all work, and the `dotnet` CLI behaves the same in each.
- Run `dotnet dev-certs https --trust` once so HTTPS on localhost works without warnings.
- `dotnet new`, `dotnet run`, `dotnet watch` and `dotnet add package` are the commands you will use most.
- NuGet is where .NET packages come from, and global tools like `dotnet-ef` are installed once per computer.

<code id="code-content" class="language-csharp">
// Program.cs: a tiny console app that proves your .NET setup works
// 1. dotnet new console -n SetupCheck
// 2. cd SetupCheck
// 3. Replace everything in Program.cs with this file
// 4. dotnet run
using System.Runtime.InteropServices;
Console.WriteLine("Your .NET setup is working!");
Console.WriteLine();
// Details about the runtime that is running this code
Console.WriteLine($"Runtime version  : {Environment.Version}");
Console.WriteLine($"Framework        : {RuntimeInformation.FrameworkDescription}");
Console.WriteLine($"Operating system : {RuntimeInformation.OSDescription}");
Console.WriteLine($"Processor type   : {RuntimeInformation.OSArchitecture}");
Console.WriteLine($"Machine name     : {Environment.MachineName}");
// A quick check that everyday C# works too
string[] commands =
{
    "dotnet new mvc -n ShopApp",
    "dotnet run",
    "dotnet watch",
    "dotnet add package &lt;name&gt;"
};
Console.WriteLine();
Console.WriteLine("Commands you will use every day:");
foreach (string command in commands)
{
    Console.WriteLine($"  {command}");
}
// Expected output (your values will differ):
// Your .NET setup is working!
//
// Runtime version  : 10.0.0
// Framework        : .NET 10.0.0
// Operating system : Microsoft Windows 10.0.26100
// Processor type   : X64
// Machine name     : MY-LAPTOP
</code></pre>
