---
publishDate: 2026-10-25T20:01
title: 'Setting Up Visual Studio and the .NET SDK'
slug: setting-up-visual-studio-and-the-dotnet-sdk
metadescription: 'Install the .NET 10 SDK and Visual Studio with the .NET desktop development workload, check that everything works, and learn the other editor options for WPF.'
updateDate: 2026-10-25T20:01
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'visual-studio', 'dotnet', 'setup']
course: wpf
---

## What you need and why

Before you can build a WPF app you need two things on your PC:

1. **The .NET SDK.** SDK means **Software Development Kit**. It is the set of tools that turns your C# and XAML into a program you can run. It includes the compiler, the `dotnet` command and the WPF libraries.
2. **An editor.** This is where you write code. Visual Studio is the most common choice for WPF, but you have other options too.

You also need **Windows**. WPF apps only run on Windows 10 or Windows 11, so the tools for building them are Windows tools as well. If you use a Mac or Linux machine, run Windows in a virtual machine.

This course uses **.NET 10**, the current **LTS** release. LTS means **Long Term Support**: Microsoft fixes bugs and security problems in it for three years, so it is a safe version to learn and build on.

If you have already set things up for the [C# course](/courses/c-sharp/setting-up-visual-studio-and-dotnet-sdk), most of this lesson will be familiar. The one new step is the desktop workload.

## Option 1: Visual Studio (recommended)

**Visual Studio** is Microsoft's full featured editor for .NET. The free **Community** edition is enough for everything in this course. Visual Studio 2026 works, and so does Visual Studio 2022 version 17.14 or newer.

### Step 1: Download the installer

Go to the Visual Studio website and download the Community installer. Run it. A window called the **Visual Studio Installer** opens.

### Step 2: Pick the workload

A **workload** is a bundle of tools for one kind of project. For WPF you need the one called **.NET desktop development**. Tick its box.

```text
Workloads tab
  [x] .NET desktop development      <- this one is required for WPF
  [ ] ASP.NET and web development   (optional, for web apps)
  [ ] .NET Multi-platform App UI    (optional, for MAUI)
```

This workload installs the .NET SDK, the WPF project templates and the XAML designer, so you do not need to install the SDK separately.

### Step 3: Install and sign in

Click **Install** and wait. It can take a while, because the download is a few gigabytes. When it finishes, open Visual Studio. You can sign in with a Microsoft account or skip that for now.

### Already have Visual Studio?

Open the **Visual Studio Installer** from the Start menu, click **Modify** next to your Visual Studio, tick **.NET desktop development** and click **Modify** again. The installer adds the missing parts.

## Option 2: The .NET SDK on its own

Maybe you prefer a lighter editor. In that case install the .NET 10 SDK by itself. You can download it from the official .NET website, or use **winget**, the package manager built into Windows:

```powershell
winget install Microsoft.DotNet.SDK.10
```

Close and reopen your terminal afterwards, so it picks up the new `dotnet` command.

Then choose an editor:

- **Visual Studio Code** with the **C# Dev Kit** extension. Free, light and fast. It has no visual XAML designer, so you write XAML by hand and run the app to see it. That is fine for learning.
- **JetBrains Rider.** A full featured editor that also supports WPF. It is free for non commercial use.

Everything in this course can be done from the command line with the `dotnet` command, so any editor works.

## Check that the SDK works

Open a terminal. In Windows that can be **Windows Terminal**, **PowerShell** or the **Developer PowerShell** inside Visual Studio (menu **View > Terminal**). Type:

```powershell
dotnet --version
```

You should see a version number that starts with `10`, for example:

```text
10.0.401
```

To see every SDK on your machine, use:

```powershell
dotnet --list-sdks
```

It is fine to have older SDKs installed next to the new one. Each project says which version it targets.

If you see an error like "dotnet is not recognized", the SDK is not on your **PATH** (the list of folders Windows searches for commands). Restart the terminal first. If that does not help, restart the PC or reinstall the SDK.

## Check that the WPF templates exist

A **template** is a starting project that `dotnet new` copies for you. Check that the WPF ones are installed:

```powershell
dotnet new list wpf
```

You should see something like this:

```text
Template Name                       Short Name
----------------------------------  --------------------
WPF Application                     wpf
WPF Class Library                   wpflib
WPF Custom Control Library          wpfcustomcontrollib
WPF User Control Library            wpfusercontrollib
```

The one you will use most is `wpf`, which creates a full app with a window. The others are for code you want to share between apps. You will meet `wpfusercontrollib` and `wpfcustomcontrollib` again in [User Controls](/courses/wpf/user-controls) and [Custom Controls](/courses/wpf/custom-controls).

## A quick test project

Let us prove that everything works before the next lesson. In the terminal, go to a folder where you keep your code and run:

```powershell
dotnet new wpf -n HelloWpf
cd HelloWpf
dotnet build
```

Here is what each line does:

- `dotnet new wpf -n HelloWpf` creates a new WPF app in a folder called `HelloWpf`. The `-n` flag sets the name.
- `cd HelloWpf` moves into that folder.
- `dotnet build` compiles the project, without running it.

The last lines of the output should say:

```text
Build succeeded.
    0 Warning(s)
    0 Error(s)
```

If you want to see the window, run:

```powershell
dotnet run
```

An empty window titled **MainWindow** appears. Close it to get your terminal back. In the next lesson, [Your First WPF App](/courses/wpf/your-first-wpf-app), you will put real content in that window.

## Getting around Visual Studio

If you chose Visual Studio, here are the parts of the screen you will use the most:

```text
Solution Explorer   The file tree of your project (right side).
Editor              Where you type XAML and C# (middle).
XAML Designer       A live preview of your XAML window (above or beside the editor).
Properties          Settings for the selected control (bottom right).
Error List          Build errors and warnings (bottom).
Toolbox             Controls you can drag onto the designer (left side).
```

Some handy keyboard shortcuts:

```text
F5              Build and run with the debugger
Ctrl + F5       Build and run without the debugger
Ctrl + Shift+B  Build only
F9              Set or remove a breakpoint on the current line
Ctrl + .        Show quick fixes for the code under the cursor
```

You do not need the Toolbox much. Most WPF developers type XAML by hand, because it is faster and the result is cleaner than dragging controls around. The designer is still handy to check your layout as you type.

## Common problems

- **No WPF templates in Visual Studio.** The **.NET desktop development** workload is missing. Add it with the installer as shown above.
- **The version starts with 8 or 9, not 10.** An older SDK is first on your machine. Install the .NET 10 SDK, then check `dotnet --list-sdks` again.
- **"NETSDK1100: To build a project targeting Windows on this operating system..."** You are trying to build on macOS or Linux. WPF needs Windows.
- **The designer shows an error but the app builds.** The designer is sometimes behind. Build the project (Ctrl + Shift + B) and the preview usually refreshes.
- **Antivirus slows the first build a lot.** The first build downloads and caches a lot of files. Later builds are much faster.

## Tips

- Keep your tools up to date. In Visual Studio use **Help > Check for Updates**.
- Make one folder, such as `C:\Code`, for all your practice projects. Short paths without spaces avoid odd problems.
- Learn the `dotnet` commands even if you use Visual Studio. They help when you read online guides and when you automate builds later.

## Quick recap

- You need Windows, the .NET 10 SDK and an editor to build WPF apps.
- In Visual Studio, install the **.NET desktop development** workload. It includes the SDK and the WPF templates.
- Without Visual Studio, install the SDK (for example with `winget install Microsoft.DotNet.SDK.10`) and use VS Code or Rider.
- `dotnet --version` checks the SDK, and `dotnet new list wpf` checks the templates.
- `dotnet new wpf -n Name`, `dotnet build` and `dotnet run` create, compile and start an app.
- Next up: [Your First WPF App](/courses/wpf/your-first-wpf-app).

<code id="code-content" class="language-xml">
&lt;!-- CoinJar.csproj --&gt;
&lt;!-- This is the project file that "dotnet new wpf -n CoinJar" creates. --&gt;
&lt;!-- If "dotnet build" works on a project like this, your setup is ready. --&gt;
&lt;Project Sdk="Microsoft.NET.Sdk"&gt;
  &lt;PropertyGroup&gt;
    &lt;!-- WinExe: a Windows app with a window and no console --&gt;
    &lt;OutputType&gt;WinExe&lt;/OutputType&gt;
    &lt;!-- .NET 10, Windows only. WPF needs the "-windows" part --&gt;
    &lt;TargetFramework&gt;net10.0-windows&lt;/TargetFramework&gt;
    &lt;!-- Warn when something might be null --&gt;
    &lt;Nullable&gt;enable&lt;/Nullable&gt;
    &lt;!-- Common "using" lines are added for you --&gt;
    &lt;ImplicitUsings&gt;enable&lt;/ImplicitUsings&gt;
    &lt;!-- Turn on WPF for this project --&gt;
    &lt;UseWPF&gt;true&lt;/UseWPF&gt;
  &lt;/PropertyGroup&gt;
&lt;/Project&gt;
</code></pre>
