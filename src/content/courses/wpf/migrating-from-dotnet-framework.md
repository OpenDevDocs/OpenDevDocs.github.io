---
publishDate: 2026-10-25T21:01
title: 'Migrating from .NET Framework to Modern .NET'
slug: migrating-from-dotnet-framework
metadescription: 'Move an old WPF app from .NET Framework 4.x to .NET 10: check dependencies, switch packages.config to PackageReference, convert to an SDK style csproj, use the Upgrade Assistant and handle App.config.'
updateDate: 2026-10-25T21:01
author: ['bishal-biswas']
level: 4
tags: ['wpf', 'migration', 'dotnet-framework', 'csproj']
course: wpf
---

## Why this lesson exists

WPF is almost 20 years old. Many companies have WPF apps that were built on **.NET Framework**, the original Windows only version of .NET (versions 1.0 to 4.8.1). You may well inherit one at work.

.NET Framework 4.8.1 is the last version. Microsoft still supports it as part of Windows, but it gets no new features. Modern **.NET** (5, 6, 7, 8, 9, 10 and onward) is where everything new happens:

- Much faster: startup, collections, JSON, LINQ and the garbage collector have all improved.
- New C# versions. .NET Framework projects are stuck on C# 7.3 by default. Everything in this course, from records to partial properties, needs modern .NET.
- WPF itself gets updates there: the Fluent theme, `OpenFolderDialog`, bug fixes and accessibility work.
- Side by side and self-contained deployment, as in [Publishing and Packaging WPF Apps](/courses/wpf/publishing-and-packaging-wpf-apps).
- .NET 10 is a **long term support** (LTS) release, supported for three years.

The good news: WPF on .NET 10 is the same WPF. XAML, bindings, styles and controls work as before. Most of a migration is about the project file, packages and a few old APIs.

## What does not come along

Check these first, because they decide how hard the move is:

| Old technology | On modern .NET |
| --- | --- |
| WPF and Windows Forms | Supported (Windows only) |
| `App.config`, `ConfigurationManager`, `Settings.settings` | Still work, see below |
| WCF **client** (calling a service) | Available as `System.ServiceModel.*` NuGet packages |
| WCF **server** (hosting a service) | Not included; the community project CoreWCF fills the gap |
| .NET Remoting, creating new AppDomains, Code Access Security | Not supported |
| XBAP (WPF in the browser) | Not supported |
| Old third party control suites | Need a version built for modern .NET |

The last row is usually the real work. A NuGet package or a vendor DLL that only exists for .NET Framework can block the whole migration. List every dependency and check each one before you start.

## Step 1: prepare on .NET Framework

Do the safe steps while the app still runs on the old framework, so you can test each one on its own.

1. **Put the code in source control** (Git) and commit, so every later step can be undone.
2. **Upgrade the app to .NET Framework 4.8.x** if it is older. This removes surprises from very old versions.
3. **Update NuGet packages** to versions that also support modern .NET. Their release notes or NuGet pages list the supported frameworks.
4. **Move from packages.config to PackageReference** (next section).

## Step 2: packages.config to PackageReference

Old projects list their NuGet packages in a separate `packages.config` file and keep the actual DLLs in a `packages` folder next to the solution:

```xml
<?xml version="1.0" encoding="utf-8"?>
<packages>
  <package id="Newtonsoft.Json" version="13.0.3" targetFramework="net48" />
</packages>
```

The project file then points at those DLLs with long `HintPath` entries. Modern projects instead use **PackageReference**: one line per package inside the `.csproj`, and NuGet downloads into a shared cache.

```xml
<ItemGroup>
  <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
</ItemGroup>
```

In Visual Studio, right click `packages.config` (or the **References** node) and choose **Migrate packages.config to PackageReference**. It rewrites the project for you and lists any packages that need attention. Packages that ran PowerShell install scripts or added content files under the old system may need a manual check afterwards.

## Step 3: an SDK style project file

This is the biggest visible change. An old `.csproj` is often hundreds of lines long. It lists every single file:

```xml
<?xml version="1.0" encoding="utf-8"?>
<Project ToolsVersion="15.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <Import Project="$(MSBuildExtensionsPath)\$(MSBuildToolsVersion)\Microsoft.Common.props" />
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <RootNamespace>CoinJar</RootNamespace>
    <TargetFrameworkVersion>v4.8</TargetFrameworkVersion>
    <ProjectGuid>{4F6C2A1B-0000-4D3E-9C8A-123456789ABC}</ProjectGuid>
    <ProjectTypeGuids>{60dc8134-eba5-43b8-bcc9-bb4bc16c2548};{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}</ProjectTypeGuids>
  </PropertyGroup>
  <ItemGroup>
    <Reference Include="PresentationCore" />
    <Reference Include="PresentationFramework" />
    <Reference Include="WindowsBase" />
    <Reference Include="System.Xaml" />
  </ItemGroup>
  <ItemGroup>
    <ApplicationDefinition Include="App.xaml" />
    <Page Include="MainWindow.xaml" />
    <Compile Include="MainWindow.xaml.cs">
      <DependentUpon>MainWindow.xaml</DependentUpon>
    </Compile>
    <Compile Include="Properties\AssemblyInfo.cs" />
    <!-- ...and one line for every other file... -->
  </ItemGroup>
  <Import Project="$(MSBuildToolsPath)\Microsoft.CSharp.targets" />
</Project>
```

An **SDK style** project, the format every project in this course uses, starts with `<Project Sdk="Microsoft.NET.Sdk">`. It includes every `.cs` and `.xaml` file in the folder automatically, and `UseWPF` brings in all the WPF references:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net10.0-windows</TargetFramework>
    <UseWPF>true</UseWPF>
  </PropertyGroup>
</Project>
```

`net10.0-windows` is the **target framework moniker**: .NET 10 with the Windows specific APIs, which WPF needs. You met it in [Understanding the Project Structure](/courses/wpf/understanding-the-project-structure).

### Converting by hand

For a small app, converting by hand is quick and teaches you a lot:

1. Close Visual Studio. Back up the old `.csproj`.
2. Replace its contents with the short SDK style project above.
3. Keep the properties that matter: `RootNamespace`, `AssemblyName`, `ApplicationIcon`.
4. Move each package from `packages.config` into a `PackageReference` and delete `packages.config` and the `packages` folder.
5. Re-add any **project references** (`<ProjectReference Include="..\CoinJar.Data\CoinJar.Data.csproj" />`) and references to DLLs that are not packages.
6. Delete `bin` and `obj`, then build.

You do not need the `Compile`, `Page` and `ApplicationDefinition` items any more. If you keep them, the build fails with "Duplicate Compile items", because the SDK already includes those files.

### The AssemblyInfo clash

Old projects keep their version and title in `Properties/AssemblyInfo.cs`. An SDK style project **generates** those attributes from the `.csproj`. Having both gives errors like:

```text
error CS0579: Duplicate 'System.Reflection.AssemblyTitleAttribute' attribute
```

Choose one place. Either delete the duplicate attributes from `AssemblyInfo.cs` and set `Version`, `Product` and friends in the `.csproj`, or keep the file for now and switch generation off:

```xml
<GenerateAssemblyInfo>false</GenerateAssemblyInfo>
```

Keep the `ThemeInfo` attribute in any case. WPF uses it to find theme resources.

### Nullable and implicit usings

New templates turn on `Nullable` and `ImplicitUsings`. Old code was not written for them, and nullable warnings can number in the thousands. Start with both set to `disable`, get the app working, then turn them on one project at a time. [Fields and properties](/courses/c-sharp/fields-and-properties) and the C# lessons explain what the warnings mean.

## The .NET Upgrade Assistant

Doing all this by hand gets tedious in a solution with 30 projects. The **.NET Upgrade Assistant** is a Microsoft tool that automates the steps above: it converts project files to SDK style, moves packages to PackageReference, updates package versions, retargets the framework and fixes some known API changes.

It comes in two flavours:

- A **Visual Studio extension**. Install it from **Extensions > Manage Extensions**, then right click a project and choose **Upgrade**.
- A **command line tool**:

```powershell
dotnet tool install -g upgrade-assistant
upgrade-assistant upgrade
```

It asks which project to upgrade, which way (in place or side by side) and which target framework, then does the work and reports what it could not fix.

Microsoft is moving this kind of help into AI assisted tooling (GitHub Copilot app modernization), so newer Visual Studio versions may point you there instead. The steps it performs are the same ones described in this lesson, which is why it pays to understand them: you will review and finish whatever the tool leaves behind.

Whichever tool you use, upgrade one project at a time, starting with libraries that have no dependencies of their own, and build and test after each.

## App.config and settings

Old WPF apps keep configuration in `App.config`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <appSettings>
    <add key="DatabaseFileName" value="coinjar.db" />
  </appSettings>
  <connectionStrings>
    <add name="CoinJar" connectionString="Data Source=coinjar.db" />
  </connectionStrings>
</configuration>
```

It still works. In an SDK style project, `App.config` is copied to the output as `CoinJar.dll.config`, and `ConfigurationManager` reads it as before. For WPF projects, `System.Configuration.ConfigurationManager` is part of the Windows Desktop runtime, so old code like this compiles unchanged:

```csharp
string file = ConfigurationManager.AppSettings["DatabaseFileName"] ?? "coinjar.db";
string? cs = ConfigurationManager.ConnectionStrings["CoinJar"]?.ConnectionString;
```

The same goes for `Properties/Settings.settings`, the old user settings designer: `Properties.Settings.Default.LastCategory` and `Save()` keep working.

Some sections of `App.config` are ignored on modern .NET, though:

- `<startup>` with `supportedRuntime`: the target framework now lives in the `.csproj` and `runtimeconfig.json`.
- `<runtime>` with `assemblyBinding` redirects: modern .NET resolves versions itself. Delete them.
- `<system.serviceModel>` for WCF: the WCF client packages are configured in code instead.

### Should you switch to appsettings.json?

Not on day one. Get the app running on .NET 10 with `App.config` first. Later, move configuration to `appsettings.json` and the Generic Host, as in [App Settings and Configuration](/courses/wpf/app-settings-and-configuration) and [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host). That gives you environment specific files, user secrets and the options pattern. One change at a time.

## Step 4: build, fix, test

After the project converts and the framework changes, build. Typical errors and their fixes:

- **A type or namespace is missing.** The API moved to a NuGet package (for example `System.Data.SqlClient` became `Microsoft.Data.SqlClient`), or it no longer exists. The documentation page of the type says which.
- **Behaviour changes.** A few defaults differ, for example `Process.Start` with a URL or document no longer opens it unless you set `UseShellExecute = true`.
- **Windows Forms dialogs.** If old code uses `System.Windows.Forms.FolderBrowserDialog`, either add `<UseWindowsForms>true</UseWindowsForms>` or switch to WPF's own `OpenFolderDialog` from [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes).
- **Binary serialization.** `BinaryFormatter` was removed from modern .NET for security reasons. Move saved data to JSON with `System.Text.Json`, as in [Saving Data to JSON Files](/courses/wpf/saving-data-to-json-files).

Then test everything a user does, not only the parts you changed. If the app has no tests, now is a good time to add some for the core logic (see [Unit Testing ViewModels](/courses/wpf/unit-testing-viewmodels)).

## A migration plan in short

```text
1. Commit everything. Create a branch.
2. Inventory: list packages, DLLs, WCF, Remoting, BinaryFormatter, third party controls.
3. On .NET Framework: go to 4.8.x, update packages, move to PackageReference. Test.
4. Convert each project to SDK style (Upgrade Assistant or by hand), libraries first.
5. Retarget to net10.0-windows. Fix build errors.
6. Test the whole app. Ship.
7. Later: Nullable, ImplicitUsings, appsettings.json, the Generic Host, MVVM Toolkit.
```

Step 7 is where the rest of this course comes in. Once the app is on modern .NET, every technique from the previous lessons is available to it.

## Common mistakes

- **Migrating and refactoring at the same time.** Change the platform first, keep the code the same, and ship. Then improve.
- **Skipping the dependency check.** One unsupported vendor DLL found late can stop the project.
- **Leaving old Compile items in the SDK project.** The build reports duplicate items. Remove them.
- **Duplicate assembly attributes.** Delete them from `AssemblyInfo.cs` or set `GenerateAssemblyInfo` to `false`.
- **Turning on Nullable at once.** Thousands of warnings hide the real errors. Do it later, step by step.
- **Keeping binding redirects.** They do nothing on modern .NET. Delete the `<runtime>` section.

## Quick recap

- .NET Framework 4.8.1 is the end of the line. Modern .NET is faster, gets new C# and WPF features, and .NET 10 is LTS.
- WPF, XAML, `App.config` and `Settings.settings` all keep working. WCF hosting, Remoting, AppDomains and `BinaryFormatter` do not.
- Prepare on the old framework: Git, 4.8.x, updated packages, PackageReference instead of `packages.config`.
- Convert to an SDK style `.csproj` with `TargetFramework` `net10.0-windows` and `UseWPF`, by hand or with the .NET Upgrade Assistant.
- Fix duplicate assembly attributes, disable Nullable and implicit usings at first, then build, fix and test.
- Modernise (appsettings.json, the Generic Host, MVVM) only after the app runs on the new platform.

<code id="code-content" class="language-xml">
&lt;!-- CoinJar.csproj --&gt;
&lt;Project Sdk="Microsoft.NET.Sdk"&gt;
  &lt;PropertyGroup&gt;
    &lt;OutputType&gt;WinExe&lt;/OutputType&gt;
    &lt;TargetFramework&gt;net10.0-windows&lt;/TargetFramework&gt;
    &lt;UseWPF&gt;true&lt;/UseWPF&gt;
    &lt;RootNamespace&gt;CoinJar&lt;/RootNamespace&gt;
    &lt;!-- The old Properties/AssemblyInfo.cs still has the version attributes --&gt;
    &lt;GenerateAssemblyInfo&gt;false&lt;/GenerateAssemblyInfo&gt;
    &lt;!-- Old code was written without these. Turn them on later, one at a time. --&gt;
    &lt;Nullable&gt;disable&lt;/Nullable&gt;
    &lt;ImplicitUsings&gt;disable&lt;/ImplicitUsings&gt;
  &lt;/PropertyGroup&gt;
  &lt;!-- Was packages.config --&gt;
  &lt;ItemGroup&gt;
    &lt;PackageReference Include="Newtonsoft.Json" Version="13.0.3" /&gt;
  &lt;/ItemGroup&gt;
  &lt;!-- Keeps the Settings designer working in Visual Studio --&gt;
  &lt;ItemGroup&gt;
    &lt;None Update="Properties\Settings.settings"&gt;
      &lt;Generator&gt;SettingsSingleFileGenerator&lt;/Generator&gt;
      &lt;LastGenOutput&gt;Settings.Designer.cs&lt;/LastGenOutput&gt;
    &lt;/None&gt;
    &lt;Compile Update="Properties\Settings.Designer.cs"&gt;
      &lt;AutoGen&gt;True&lt;/AutoGen&gt;
      &lt;DesignTimeSharedInput&gt;True&lt;/DesignTimeSharedInput&gt;
      &lt;DependentUpon&gt;Settings.settings&lt;/DependentUpon&gt;
    &lt;/Compile&gt;
  &lt;/ItemGroup&gt;
&lt;/Project&gt;
&lt;!-- App.config --&gt;
&lt;configuration&gt;
  &lt;appSettings&gt;
    &lt;add key="DatabaseFileName" value="coinjar.db" /&gt;
  &lt;/appSettings&gt;
  &lt;connectionStrings&gt;
    &lt;add name="CoinJar" connectionString="Data Source=coinjar.db" /&gt;
  &lt;/connectionStrings&gt;
&lt;/configuration&gt;
// Properties/AssemblyInfo.cs
using System.Reflection;
using System.Windows;
[assembly: AssemblyTitle("CoinJar")]
[assembly: AssemblyProduct("CoinJar")]
[assembly: AssemblyVersion("1.4.0.0")]
[assembly: ThemeInfo(ResourceDictionaryLocation.None, ResourceDictionaryLocation.SourceAssembly)]
// LegacySettings.cs
using System.Configuration;
using Newtonsoft.Json;
namespace CoinJar
{
    // Old style code, unchanged by the migration: it still compiles on .NET 10.
    public static class LegacySettings
    {
        public static string DatabaseFileName
        {
            get { return ConfigurationManager.AppSettings["DatabaseFileName"] ?? "coinjar.db"; }
        }
        public static string LastCategory
        {
            get { return Properties.Settings.Default.LastCategory; }
            set { Properties.Settings.Default.LastCategory = value; Properties.Settings.Default.Save(); }
        }
        public static string ToJson(object value)
        {
            return JsonConvert.SerializeObject(value, Formatting.Indented);
        }
    }
}
</code></pre>

