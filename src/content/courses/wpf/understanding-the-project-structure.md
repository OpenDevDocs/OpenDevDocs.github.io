---
publishDate: 2026-10-25T20:03
title: 'Understanding the Project Structure'
slug: understanding-the-project-structure
metadescription: 'Walk through every file in a new WPF project: the .csproj, App.xaml, MainWindow.xaml, their code-behind files, AssemblyInfo.cs and the bin and obj folders.'
updateDate: 2026-10-25T20:03
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'project-structure', 'csproj', 'beginners']
course: wpf
---

## Why look at the files

In [Your First WPF App](/courses/wpf/your-first-wpf-app) you only touched two files. A new project actually has a few more, and each one has a job. Knowing what they do means you will not be scared to open them, and you will know where to look when something breaks.

Create a fresh project to follow along. From now on the course uses the name **CoinJar**, the expense tracker you will grow during the course:

```powershell
dotnet new wpf -n CoinJar
cd CoinJar
```

## The file list

After the command, the folder looks like this:

```text
CoinJar/
  CoinJar.csproj        The project file: settings for the build
  App.xaml              The application: start up window and shared resources
  App.xaml.cs           C# code for the application
  AssemblyInfo.cs       Tells WPF where to look for theme files
  MainWindow.xaml       The main window's look
  MainWindow.xaml.cs    The main window's C# code
```

After your first build, two more folders appear:

```text
  bin/                  The finished program (CoinJar.exe and friends)
  obj/                  Temporary build files
```

Let us go through them one by one.

## CoinJar.csproj: the project file

The **project file** tells the .NET SDK how to build your app. It is written in XML and it is short:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net10.0-windows</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <UseWPF>true</UseWPF>
  </PropertyGroup>

</Project>
```

Each setting in plain words:

- `OutputType` `WinExe` means "make a Windows program with a window". A plain `Exe` would also open a black console window next to your app.
- `TargetFramework` `net10.0-windows` means ".NET 10, Windows only". The `-windows` part is what gives you access to WPF.
- `Nullable` `enable` turns on warnings when something might be `null`. It helps you catch bugs early.
- `ImplicitUsings` `enable` adds common `using` lines (like `using System;`) to every file for you.
- `UseWPF` `true` switches on WPF itself: the libraries and the XAML compiler.

Notice what is **not** in the file: a list of your source files. The SDK picks up every `.cs` and `.xaml` file in the folder automatically. Add a new file and it is part of the project straight away.

Later lessons add **NuGet packages** here. A **package** is a library someone else wrote that you can download into your project. For example:

```powershell
dotnet add package CommunityToolkit.Mvvm
```

That command adds one line to the project file:

```xml
<ItemGroup>
  <PackageReference Include="CommunityToolkit.Mvvm" Version="8.4.2" />
</ItemGroup>
```

You will use this package in [MVVM with CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm).

## App.xaml: the application

`App.xaml` describes the **application** as a whole, not any single window:

```xml
<Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:local="clr-namespace:CoinJar"
             StartupUri="MainWindow.xaml">
    <Application.Resources>

    </Application.Resources>
</Application>
```

Two things to notice:

- `StartupUri="MainWindow.xaml"` says which window to open when the app starts. Change it to another window file and that one opens first.
- `Application.Resources` is a place for things the whole app shares, such as colours and styles. It is empty for now. You will fill it in [Resources and Resource Dictionaries](/courses/wpf/resources-and-resource-dictionaries).

## App.xaml.cs: the application's code

This file is the C# half of `App.xaml`:

```csharp
using System.Windows;

namespace CoinJar;

public partial class App : Application
{
}
```

It is empty, and that is fine. The class inherits from `Application`, which already knows how to start up and shut down. You add code here when you want to do something at start up, like load settings or show a splash screen. The next lesson, [The Application and Window Classes](/courses/wpf/the-application-and-window-classes), shows how.

`namespace CoinJar;` is a **file scoped namespace**: the whole file belongs to the `CoinJar` namespace, without extra curly braces.

## Where is Main?

In a console app you write a `Main` method, the place where the program begins. A WPF project has no `Main` in your files. So where does it start?

The build creates one for you. When it compiles `App.xaml`, it writes a hidden C# file with a `Main` method that looks roughly like this:

```csharp
[STAThread]
public static void Main()
{
    CoinJar.App app = new CoinJar.App();
    app.InitializeComponent(); // reads StartupUri and other App.xaml settings
    app.Run();                 // shows the window and waits for clicks and keys
}
```

`app.Run()` starts the **message loop**: a loop that waits for things like mouse clicks and key presses and hands them to your windows. It only finishes when the app closes. `[STAThread]` is a setting WPF needs for its UI thread. You do not need to remember these details. Just know that `App.xaml` is effectively your starting point.

## MainWindow.xaml and MainWindow.xaml.cs

These two files are one window split in two:

- `MainWindow.xaml` holds the **look**: controls, layout, colours.
- `MainWindow.xaml.cs` holds the **behaviour**: C# that runs when things happen. This is called the **code-behind**.

The starting code-behind:

```csharp
using System.Windows;

namespace CoinJar;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
}
```

### How the two halves join

Look at the first line of `MainWindow.xaml`:

```xml
<Window x:Class="CoinJar.MainWindow" ...>
```

`x:Class="CoinJar.MainWindow"` says "this XAML is part of the C# class `CoinJar.MainWindow`". The class name in C# and the `x:Class` value must match exactly, including the namespace.

The keyword `partial` is what makes this possible. A **partial class** is a class whose code is spread over more than one file. The C# compiler glues the pieces together. One piece is your `MainWindow.xaml.cs`. The other piece is generated from the XAML at build time. If partial classes are new, see [classes and objects](/courses/c-sharp/classes-and-objects).

### What InitializeComponent does

`InitializeComponent()` is a method in that generated piece. When the window is created, it reads your XAML, creates every control and sets their properties. It also fills in the fields for every control with an `x:Name`. That is why you must call it first in the constructor, before you touch any named control.

## AssemblyInfo.cs

This small file has one attribute:

```csharp
using System.Windows;

[assembly: ThemeInfo(
    ResourceDictionaryLocation.None,
    ResourceDictionaryLocation.SourceAssembly
)]
```

It tells WPF where to look for theme files (special style dictionaries) for controls in this project. You will not touch it until you build your own controls in [Custom Controls](/courses/wpf/custom-controls). Leave it as it is. If [attributes](/courses/c-sharp/attributes) like `[assembly: ...]` are new, the C# course explains them.

## The bin and obj folders

These appear when you build:

- **`bin`** holds the output. Inside `bin/Debug/net10.0-windows/` you will find `CoinJar.exe`, `CoinJar.dll` and a few small config files. Double clicking `CoinJar.exe` starts your app.
- **`obj`** holds in between files. Here you can peek at the generated code: `MainWindow.g.cs` and `App.g.cs` (the `g` means "generated"), and `MainWindow.baml`, a compact binary form of your XAML that loads fast.

```text
obj/Debug/net10.0-windows/
  App.g.cs           Generated Main method and App.InitializeComponent
  MainWindow.g.cs    Generated fields for x:Name controls and InitializeComponent
  MainWindow.baml    Your XAML compiled to a binary format
```

You never edit these. They are rebuilt every time. You can delete `bin` and `obj` at any time and the next build creates them again. That trick fixes many strange build problems. Do not put them in source control (Git) either.

## Adding your own folders

As the app grows, you will add folders to keep things tidy. CoinJar will use these:

```text
CoinJar/
  Models/        Plain data classes, like Expense
  ViewModels/    Classes that hold screen state and logic (MVVM)
  Views/         Extra windows and user controls
  Services/      Code that saves data, talks to the web, and so on
  Converters/    Small helpers used in data binding
```

A folder usually becomes part of the namespace. A class in `Models/Expense.cs` goes in `namespace CoinJar.Models;`. You will create these folders as you need them, starting in the data binding lessons.

## Common mistakes

- **Renaming a class in only one place.** If you rename `MainWindow` in C#, also change `x:Class` in the XAML, and `StartupUri` in `App.xaml` if the file name changes too.
- **Deleting `InitializeComponent()`.** The window opens empty and named controls are `null`.
- **Editing files in `obj`.** Your changes vanish on the next build.
- **Adding `<Compile Include=...>` lines by habit from old .NET Framework projects.** Modern projects include files automatically, and listing them again causes "duplicate item" errors.

## Quick recap

- `CoinJar.csproj` holds build settings: `WinExe`, `net10.0-windows` and `UseWPF` are the key ones.
- `App.xaml` and `App.xaml.cs` describe the whole application, and `StartupUri` picks the first window.
- The `Main` method is generated for you from `App.xaml`.
- Each window is a XAML file plus a code-behind file, joined by `x:Class` and `partial`.
- `InitializeComponent()` builds the controls from XAML, so call it first.
- `bin` holds your finished `.exe`, `obj` holds generated files. Both are safe to delete.

<code id="code-content" class="language-xml">
&lt;!-- CoinJar.csproj --&gt;
&lt;Project Sdk="Microsoft.NET.Sdk"&gt;
  &lt;PropertyGroup&gt;
    &lt;OutputType&gt;WinExe&lt;/OutputType&gt;                         &lt;!-- a Windows app, no console --&gt;
    &lt;TargetFramework&gt;net10.0-windows&lt;/TargetFramework&gt;     &lt;!-- .NET 10 on Windows --&gt;
    &lt;Nullable&gt;enable&lt;/Nullable&gt;
    &lt;ImplicitUsings&gt;enable&lt;/ImplicitUsings&gt;
    &lt;UseWPF&gt;true&lt;/UseWPF&gt;                                   &lt;!-- switch WPF on --&gt;
  &lt;/PropertyGroup&gt;
&lt;/Project&gt;
&lt;!-- App.xaml --&gt;
&lt;Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:local="clr-namespace:CoinJar"
             StartupUri="MainWindow.xaml"&gt;
    &lt;!-- StartupUri: the window that opens first --&gt;
    &lt;Application.Resources&gt;
        &lt;!-- Shared colours and styles will go here later --&gt;
    &lt;/Application.Resources&gt;
&lt;/Application&gt;
// App.xaml.cs
using System.Windows;
namespace CoinJar;
// The C# half of App.xaml. Application already knows how to start and stop.
public partial class App : Application
{
}
&lt;!-- MainWindow.xaml --&gt;
&lt;!-- x:Class joins this file to the MainWindow class in MainWindow.xaml.cs --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        xmlns:local="clr-namespace:CoinJar"
        mc:Ignorable="d"
        Title="CoinJar" Height="450" Width="800"&gt;
    &lt;Grid&gt;
        &lt;TextBlock Text="CoinJar is ready to grow." FontSize="18"
                   HorizontalAlignment="Center" VerticalAlignment="Center" /&gt;
    &lt;/Grid&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
namespace CoinJar;
// "partial": the other half of this class is generated from MainWindow.xaml
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent(); // creates the controls described in the XAML
    }
}
</code></pre>
