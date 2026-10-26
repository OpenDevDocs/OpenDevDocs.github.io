---
publishDate: 2026-10-25T21:00
title: 'Publishing and Packaging WPF Apps'
slug: publishing-and-packaging-wpf-apps
metadescription: 'Ship CoinJar to other PCs: framework-dependent versus self-contained, single file and ReadyToRun builds, publish profiles, version info, and the installer options MSIX, ClickOnce and Velopack.'
updateDate: 2026-10-25T21:00
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'publishing', 'deployment', 'dotnet']
course: wpf
---

## From "works on my machine" to "works on yours"

So far you have run CoinJar with F5 or `dotnet run`. That builds a **Debug** version into `bin/Debug` and runs it with the .NET SDK on your PC. Your friend's PC has no SDK, maybe no .NET at all, and certainly no Visual Studio.

**Publishing** means producing a folder (or a single file) that contains everything needed to run the app on another PC. **Packaging** goes one step further and wraps it in an installer with a Start menu entry, an uninstaller and maybe automatic updates.

This lesson covers both, step by step.

## Build versus publish

`dotnet build` compiles your code so you can run and debug it. `dotnet publish` compiles in **Release** mode (optimised, no debug checks) and copies everything the app needs into one output folder:

```bash
dotnet publish
```

```text
CoinJar -> C:\Projects\CoinJar\CoinJar\bin\Release\net10.0-windows\publish\
```

Since .NET 8, `dotnet publish` uses the Release configuration by default. Open that folder: you see `CoinJar.exe`, `CoinJar.dll`, your library `CoinJar.Core.dll`, the NuGet package DLLs (CommunityToolkit, EF Core, Hosting), `appsettings.json` and a `runtimes` folder with native SQLite files for several platforms.

Copy that folder to another PC, double click `CoinJar.exe`, and it runs, if that PC has the right .NET runtime. Which brings us to the first big choice.

## Framework-dependent or self-contained

### Framework-dependent

A **framework-dependent** app contains only your code and your packages. It uses the .NET runtime that is installed on the PC. For a WPF app that means the **.NET Desktop Runtime** version 10, which users can download from Microsoft.

- Small: around 9 MB for CoinJar when published for Windows x64.
- Gets .NET security fixes through Windows Update or the runtime installer.
- If the runtime is missing, Windows shows a message with a link to download it. Not every user will follow it.

This is the default when you do not say otherwise.

### Self-contained

A **self-contained** app brings its own copy of the .NET runtime. Users install nothing.

```bash
dotnet publish -c Release -r win-x64 --self-contained
```

- Large: well over 100 MB, because the whole runtime, including WPF, is inside.
- Always runs, on any 64 bit Windows 10 or 11 PC.
- You ship .NET security fixes yourself, by publishing a new version.

The `-r win-x64` part is the **runtime identifier** (RID): the operating system and processor you publish for. Self-contained needs one, because the runtime is different per platform. Common choices are `win-x64` (most PCs), `win-arm64` (ARM laptops such as Snapdragon based ones) and `win-x86` (old 32 bit Windows).

Neither choice is wrong. For an app that friends or customers download, self-contained avoids support questions. For an app inside a company where the runtime is installed everywhere, framework-dependent is lighter.

## One file instead of a folder

A folder of 40 files is easy to break: someone copies only the exe and wonders why it does not start. **Single file** publishing bundles everything into one exe:

```bash
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true
```

Look at the output and you will still find a few DLLs next to the exe: `wpfgfx_cor3.dll`, `PresentationNative_cor3.dll`, `e_sqlite3.dll` and friends. These are **native libraries**, written in C or C++ rather than .NET. By default they stay outside. Add one more property to pull them inside too:

```bash
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
```

Now the output is `CoinJar.exe` plus `appsettings.json`. The settings file stays outside on purpose: it is content, not code, and users or admins may edit it. That is why CoinJar sets `ContentRootPath = AppContext.BaseDirectory` in the host, as in [App Settings and Configuration](/courses/wpf/app-settings-and-configuration): it finds the file next to the exe, wherever that is.

### Making the file smaller

The self-contained single file for CoinJar is about 140 MB. Two options help:

- `-p:EnableCompressionInSingleFile=true` compresses the bundled files. CoinJar shrinks to roughly 70 MB. Startup is a little slower, because files are decompressed into memory.
- **Trimming** removes unused code, but WPF does not support it. `-p:PublishTrimmed=true` fails with error NETSDK1168 ("WPF is not supported or recommended with trimming enabled"). WPF finds so much by reflection at run time (XAML, bindings, styles) that a trimmer cannot know what is safe to remove.

**Native AOT**, which compiles the whole app to machine code, is not supported for WPF either, for the same reason.

## Faster startup with ReadyToRun

Normally, .NET compiles your code to machine code while the app runs, method by method, the first time each one is called. That is the **JIT** (just in time) compiler, and it costs time at startup.

**ReadyToRun** compiles most of it ahead of time, during publish:

```bash
dotnet publish -c Release -r win-x64 --self-contained -p:PublishReadyToRun=true
```

The app starts faster, especially on slow PCs. The price is a bigger file, because it contains both the machine code and the original code. Measure the difference on your app, as recommended in [Performance and UI Virtualization](/courses/wpf/performance-and-virtualization).

## Publish profiles: stop typing long commands

Those commands are getting long. A **publish profile** is a small XML file that stores the settings. Save it as `Properties/PublishProfiles/win-x64.pubxml` in the app project:

```xml
<?xml version="1.0" encoding="utf-8"?>
<Project>
  <PropertyGroup>
    <Configuration>Release</Configuration>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    <SelfContained>true</SelfContained>
    <PublishSingleFile>true</PublishSingleFile>
    <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
    <EnableCompressionInSingleFile>true</EnableCompressionInSingleFile>
    <PublishReadyToRun>true</PublishReadyToRun>
    <DebugType>none</DebugType>
    <PublishDir>bin\publish\win-x64\</PublishDir>
  </PropertyGroup>
</Project>
```

Then publish with one short command:

```bash
dotnet publish -p:PublishProfile=win-x64
```

`DebugType` `none` leaves out the `.pdb` debug symbol file of the app. (A referenced library such as `CoinJar.Core` may still bring its own `.pdb`, which you can simply leave out when you zip the folder.)

In Visual Studio, right click the project and choose **Publish**. The wizard creates the same kind of `.pubxml` file for you, and the Publish button runs it. Put the profile in source control so everyone on the team publishes the same way.

## Version and file details

Users and support staff look at **Properties > Details** of the exe to see which version they have. Set it in the `.csproj`:

```xml
<PropertyGroup>
  <Product>CoinJar</Product>
  <Company>OpenDevDocs</Company>
  <Copyright>Copyright 2026 OpenDevDocs</Copyright>
  <Version>1.0.0</Version>
</PropertyGroup>
```

`Version` becomes both the product version and the file version (`1.0.0.0`). Raise it with every release. You can read it in code, for example to show in an About box or to write at the top of the log file from [Error Handling and Logging](/courses/wpf/error-handling-and-logging):

```csharp
Version? version = typeof(App).Assembly.GetName().Version; // 1.0.0.0
```

To give the exe its own icon in Explorer and the taskbar, add an `.ico` file to the project and point to it:

```xml
<PropertyGroup>
  <ApplicationIcon>Assets\coinjar.ico</ApplicationIcon>
</PropertyGroup>
```

The window icon is separate: set `Icon="Assets/coinjar.ico"` on the `Window`, as in [Images, Icons and Media](/courses/wpf/images-and-media).

## Where your data lives after installing

An installed app usually lives in `C:\Program Files`, which normal users cannot write to. That is why CoinJar has always stored its data elsewhere:

- The SQLite database and log files in `%LocalAppData%\CoinJar` (see [SQLite with Entity Framework Core](/courses/wpf/sqlite-with-ef-core)).
- User settings in `%AppData%` or `%LocalAppData%`.

Never write next to the exe at run time. It works on your PC and fails after installation. It also means an update can replace the program files without touching the user's expenses.

## Installers and updates

A zip file of the publish folder is a perfectly good way to share a small tool. For a real product, you want an installer. There are several options; here is what each is for, in general terms.

### MSIX

**MSIX** is Windows' modern package format. It installs cleanly, uninstalls without leftovers, and can update itself from a web address or come from the Microsoft Store. In Visual Studio you add a **Windows Application Packaging Project** to the solution, reference the WPF project, and publish that. MSIX packages must be signed with a certificate.

### ClickOnce

**ClickOnce** is an older Microsoft technology that is still supported for modern .NET in Visual Studio's Publish wizard. It installs per user without admin rights and checks a web or network location for updates when the app starts. Simple, and good for internal company apps.

### Velopack and classic installers

**Velopack** is a popular open source installer and auto update framework for desktop apps. You give its command line tool your publish folder and it builds a setup exe and update packages. Your app calls a small library at startup to check for and apply updates.

Classic installer builders such as **Inno Setup** and the **WiX Toolset** turn your publish folder into a traditional setup wizard or an `.msi` file. They are flexible but leave updates to you.

### Code signing

Windows SmartScreen warns about downloaded programs it does not recognise ("Windows protected your PC"). Signing your exe and installer with a **code signing certificate** proves who made them and builds trust over time. For anything you distribute publicly, budget for a certificate.

## A release checklist

1. Raise `Version` in the `.csproj`.
2. Run the tests: `dotnet test` (see [Unit Testing ViewModels](/courses/wpf/unit-testing-viewmodels)).
3. Publish with your profile: `dotnet publish -p:PublishProfile=win-x64`.
4. Run the published exe on a clean PC or virtual machine, not only on your own.
5. Check the log file and that existing data still loads (database migrations ran).
6. Package, sign and upload.

## Common mistakes

- **Shipping the Debug folder.** It is slower and depends on your PC. Always publish.
- **Forgetting `--self-contained` or the runtime.** The app shows a "you must install .NET" message on the user's PC.
- **Native DLLs left beside a single file exe.** Add `IncludeNativeLibrariesForSelfExtract`, or ship the whole folder.
- **Trying to trim.** WPF does not support trimming or Native AOT. Use compression instead.
- **Writing files next to the exe.** It fails under Program Files. Use `LocalApplicationData`.
- **Testing only on your own PC.** Your PC has the SDK, your fonts, your data and your settings. A clean virtual machine finds the missing pieces.

## Quick recap

- `dotnet publish` makes a Release build with everything the app needs in one folder.
- Framework-dependent is small but needs the .NET Desktop Runtime; self-contained (`-r win-x64 --self-contained`) is large but needs nothing.
- `PublishSingleFile` plus `IncludeNativeLibrariesForSelfExtract` gives one exe; `EnableCompressionInSingleFile` makes it smaller.
- `PublishReadyToRun` speeds up startup. Trimming and Native AOT are not supported for WPF.
- Store the settings in a `.pubxml` publish profile and set `Version`, `Product` and `ApplicationIcon` in the `.csproj`.
- MSIX, ClickOnce, Velopack and classic installers add installing, uninstalling and updates. Sign what you ship.

<code id="code-content" class="language-xml">
&lt;!-- CoinJar.csproj --&gt;
&lt;Project Sdk="Microsoft.NET.Sdk"&gt;
  &lt;PropertyGroup&gt;
    &lt;OutputType&gt;WinExe&lt;/OutputType&gt;
    &lt;TargetFramework&gt;net10.0-windows&lt;/TargetFramework&gt;
    &lt;Nullable&gt;enable&lt;/Nullable&gt;
    &lt;ImplicitUsings&gt;enable&lt;/ImplicitUsings&gt;
    &lt;UseWPF&gt;true&lt;/UseWPF&gt;
  &lt;/PropertyGroup&gt;
  &lt;!-- What Windows shows in the file's Properties &gt; Details tab --&gt;
  &lt;PropertyGroup&gt;
    &lt;Product&gt;CoinJar&lt;/Product&gt;
    &lt;Company&gt;OpenDevDocs&lt;/Company&gt;
    &lt;Copyright&gt;Copyright 2026 OpenDevDocs&lt;/Copyright&gt;
    &lt;Version&gt;1.0.0&lt;/Version&gt;
  &lt;/PropertyGroup&gt;
  &lt;ItemGroup&gt;
    &lt;PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.14"&gt;
      &lt;IncludeAssets&gt;runtime; build; native; contentfiles; analyzers; buildtransitive&lt;/IncludeAssets&gt;
      &lt;PrivateAssets&gt;all&lt;/PrivateAssets&gt;
    &lt;/PackageReference&gt;
    &lt;PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="10.0.14" /&gt;
    &lt;PackageReference Include="Microsoft.Extensions.Hosting" Version="10.0.14" /&gt;
  &lt;/ItemGroup&gt;
  &lt;ItemGroup&gt;
    &lt;ProjectReference Include="..\CoinJar.Core\CoinJar.Core.csproj" /&gt;
  &lt;/ItemGroup&gt;
  &lt;ItemGroup&gt;
    &lt;!-- Settings file next to the exe, also after publishing --&gt;
    &lt;None Update="appsettings.json" CopyToOutputDirectory="PreserveNewest" /&gt;
  &lt;/ItemGroup&gt;
&lt;/Project&gt;
&lt;!-- Properties/PublishProfiles/win-x64.pubxml --&gt;
&lt;!-- Use it with: dotnet publish -p:PublishProfile=win-x64 --&gt;
&lt;Project&gt;
  &lt;PropertyGroup&gt;
    &lt;Configuration&gt;Release&lt;/Configuration&gt;
    &lt;RuntimeIdentifier&gt;win-x64&lt;/RuntimeIdentifier&gt;
    &lt;!-- Bring the .NET runtime along: users install nothing --&gt;
    &lt;SelfContained&gt;true&lt;/SelfContained&gt;
    &lt;!-- One .exe instead of a folder of DLLs --&gt;
    &lt;PublishSingleFile&gt;true&lt;/PublishSingleFile&gt;
    &lt;!-- WPF and SQLite native DLLs go inside the .exe too --&gt;
    &lt;IncludeNativeLibrariesForSelfExtract&gt;true&lt;/IncludeNativeLibrariesForSelfExtract&gt;
    &lt;!-- Smaller file, slightly slower first start --&gt;
    &lt;EnableCompressionInSingleFile&gt;true&lt;/EnableCompressionInSingleFile&gt;
    &lt;!-- Precompiled code: faster startup, bigger file --&gt;
    &lt;PublishReadyToRun&gt;true&lt;/PublishReadyToRun&gt;
    &lt;!-- No .pdb debug files in the output --&gt;
    &lt;DebugType&gt;none&lt;/DebugType&gt;
    &lt;PublishDir&gt;bin\publish\win-x64\&lt;/PublishDir&gt;
  &lt;/PropertyGroup&gt;
&lt;/Project&gt;
</code></pre>

