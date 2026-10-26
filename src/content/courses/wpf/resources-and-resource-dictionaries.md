---
publishDate: 2026-10-25T20:30
title: 'Resources and Resource Dictionaries'
slug: resources-and-resource-dictionaries
metadescription: 'Learn what WPF resources are, how StaticResource and DynamicResource differ, how lookup works, and how to share colours and sizes across CoinJar with resource dictionaries.'
updateDate: 2026-10-25T20:30
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'xaml', 'resources', 'styling']
course: wpf
---

## The problem resources solve

Look at a typical first WPF window. The same green appears on the header, the Save button and the total. The same margin, `12`, appears twenty times. Now the designer says "make the green a bit darker". You hunt through every file and hope you found them all.

A **resource** is a named object that you define once and reuse by name. It is like a contact in your phone: you store the number once, then you just tap "Mum" instead of typing digits every time. Change the number in one place and every call goes to the new one.

Almost anything can be a resource: a brush, a colour, a number, a margin, a style, a template, a converter, even plain text.

## Defining and using a resource

Every element that inherits from `FrameworkElement` (windows, panels, controls) has a `Resources` property. It is a **resource dictionary**: a collection where each item has a key, set with `x:Key`.

```xml
<Window.Resources>
    <SolidColorBrush x:Key="AccentBrush" Color="#2E7D32" />
</Window.Resources>

<StackPanel>
    <TextBlock Text="CoinJar" Foreground="{StaticResource AccentBrush}" />
    <Button Content="Save" Background="{StaticResource AccentBrush}" />
</StackPanel>
```

`{StaticResource AccentBrush}` is a markup extension (you met those in [XAML Namespaces and Markup Extensions](/courses/wpf/xaml-namespaces-and-markup-extensions)). It means "find the resource with this key and use it here".

### Resources that are not brushes

To store simple values such as numbers and text, map the `System` namespace to a prefix:

```xml
<Window xmlns:sys="clr-namespace:System;assembly=mscorlib" ...>
    <Window.Resources>
        <sys:Double x:Key="TitleFontSize">22</sys:Double>
        <sys:String x:Key="AppName">CoinJar</sys:String>
        <Thickness x:Key="CardPadding">16,12</Thickness>
        <CornerRadius x:Key="CardCorner">8</CornerRadius>
        <Color x:Key="AccentColor">#2E7D32</Color>
    </Window.Resources>
</Window>
```

```xml
<TextBlock Text="{StaticResource AppName}" FontSize="{StaticResource TitleFontSize}" />
<Border Padding="{StaticResource CardPadding}" CornerRadius="{StaticResource CardCorner}" />
```

Note the difference between a `Color` (just a colour value) and a `SolidColorBrush` (something that can paint). Properties such as `Background` need a **brush**. You can build a brush from a colour resource:

```xml
<SolidColorBrush x:Key="AccentBrush" Color="{StaticResource AccentColor}" />
```

Brushes get their own lesson in [Brushes, Shapes and Effects](/courses/wpf/brushes-shapes-and-effects).

## How WPF finds a resource

When WPF meets `{StaticResource AccentBrush}`, it searches outward, like asking for something at home before asking the neighbours:

```text
1. The element's own Resources
2. Its parent's Resources, then the grandparent's ... up to the Window
3. Application.Resources (App.xaml)
4. The theme resources of the controls
5. System resources (Windows colours and fonts)
```

The first match wins. This gives you a useful rule:

- put resources used by **one window** in `Window.Resources`
- put resources used **everywhere** in `App.xaml`
- put a resource on a single panel to **override** a shared one just for that area

If no match is found at all, `StaticResource` throws an exception when the window loads, with a message like "Cannot find resource named 'AccentBrush'".

## StaticResource versus DynamicResource

There are two ways to look up a resource.

| | `StaticResource` | `DynamicResource` |
| --- | --- | --- |
| When it looks | once, when the XAML loads | every time the resource changes |
| If the key is missing | exception | silently uses the default value |
| Must be defined earlier in the file | yes | no |
| Speed | a little faster | a little slower |
| Use for | things that never change | things that can change at run time, such as themes |

Here is the difference in action. Both text blocks start green:

```xml
<TextBlock Text="Static"  Foreground="{StaticResource AccentBrush}" />
<TextBlock Text="Dynamic" Foreground="{DynamicResource AccentBrush}" />
```

Now replace the resource from code:

```csharp
Resources["AccentBrush"] = new SolidColorBrush(Colors.DarkOrange);
```

Only the "Dynamic" text turns orange. The static one grabbed the old brush once and kept it. This is the whole trick behind switching between light and dark themes, which you will build in [Light, Dark and Fluent Themes](/courses/wpf/light-dark-and-fluent-themes).

A good default: use `StaticResource` unless you know the value will be swapped while the app runs.

### Order matters for StaticResource

`StaticResource` reads the XAML from top to bottom. This fails, because `AccentColor` is used before it is defined:

```xml
<Window.Resources>
    <SolidColorBrush x:Key="AccentBrush" Color="{StaticResource AccentColor}" />
    <Color x:Key="AccentColor">#2E7D32</Color>
</Window.Resources>
```

Swap the two lines and it works. Define the basics (colours) first and the things built from them (brushes, styles) after.

## Application resources in App.xaml

Resources in `App.xaml` are available to every window in the app:

```xml
<Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml">
    <Application.Resources>
        <SolidColorBrush x:Key="AccentBrush" Color="#2E7D32" />
    </Application.Resources>
</Application>
```

This is fine for a few resources, but `App.xaml` quickly becomes a very long file. The fix is to split resources into separate files.

## Resource dictionary files

A **resource dictionary file** is a XAML file whose root element is `ResourceDictionary`. In Visual Studio, right click a folder, choose Add, then Resource Dictionary. Or create the file by hand. Let us make `Themes/Colors.xaml` in CoinJar:

```xml
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <Color x:Key="AccentColor">#2E7D32</Color>
    <SolidColorBrush x:Key="AccentBrush" Color="{StaticResource AccentColor}" />
    <SolidColorBrush x:Key="CardBrush" Color="#FFFFFF" />
    <SolidColorBrush x:Key="PageBrush" Color="#F3F5F7" />
    <SolidColorBrush x:Key="MutedTextBrush" Color="#6B7280" />
</ResourceDictionary>
```

The WPF project includes `.xaml` files automatically, so there is nothing to add to the `.csproj`.

### Merging dictionaries

A file on its own does nothing. You **merge** it into another dictionary with `MergedDictionaries`:

```xml
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <ResourceDictionary Source="Themes/Colors.xaml" />
            <ResourceDictionary Source="Themes/Sizes.xaml" />
        </ResourceDictionary.MergedDictionaries>

        <!-- Resources that belong to App.xaml itself go here -->
        <SolidColorBrush x:Key="DangerBrush" Color="#C62828" />
    </ResourceDictionary>
</Application.Resources>
```

Two rules to remember:

- Once you use `MergedDictionaries`, you must write an explicit `ResourceDictionary` element, and any extra resources go **inside** it, after the merged list.
- If two merged files define the same key, the one merged **last** wins. Resources defined directly in the dictionary beat all the merged ones.

### Pack URIs

The `Source` above is a relative path. WPF also understands **pack URIs**, a special address format for files compiled into an app. You need them to load a dictionary from another assembly, such as a shared class library made with `dotnet new wpflib`:

```xml
<ResourceDictionary Source="pack://application:,,,/CoinJar.Theme;component/Themes/Colors.xaml" />
```

Read it as: "in this application, in the assembly named `CoinJar.Theme`, the file `Themes/Colors.xaml`". The `,,,` is part of the format, not a typo.

## Using resources from C#

Code behind can read and change resources too:

```csharp
// Throws if the key is not found
var accent = (Brush)FindResource("AccentBrush");

// Returns null if the key is not found
var maybe = TryFindResource("AccentBrush") as Brush;

// App wide resources
Application.Current.Resources["AccentBrush"] = new SolidColorBrush(Colors.Teal);
```

`FindResource` uses the same outward search as XAML, starting from the element you call it on. Everything that uses `DynamicResource` updates at once when you replace a resource.

## System resources

Windows has its own colours and fonts, and the user can change them (for example a high contrast setting for accessibility). WPF exposes them through `SystemColors`, `SystemFonts` and `SystemParameters`. Use the `...Key` versions with `DynamicResource` so your app follows the user's settings:

```xml
<TextBlock Text="Selected"
           Background="{DynamicResource {x:Static SystemColors.HighlightBrushKey}}"
           Foreground="{DynamicResource {x:Static SystemColors.HighlightTextBrushKey}}" />
```

You will come back to this in [Accessibility and Localization](/courses/wpf/accessibility-and-localization).

## Shared or not: x:Shared

By default a resource is created **once** and the same object is handed to everyone who asks for it. That is great for brushes. For something that can only have one parent, such as an `Image` or a `Path` element, sharing breaks things: the element can appear in only one place. Mark it with `x:Shared="False"` to get a fresh copy each time:

```xml
<Path x:Key="CoinIcon" x:Shared="False" Data="M 0,8 A 8,8 0 1 1 16,8 A 8,8 0 1 1 0,8" Fill="Gold" />
```

`x:Shared` only works in compiled XAML, which is what a normal WPF project uses.

## Tips

- **Name resources by purpose, not by look.** `AccentBrush` and `DangerBrush` survive a redesign. `GreenBrush` is wrong the day the accent becomes blue.
- **Keep one kind of thing per file.** `Colors.xaml`, `Sizes.xaml`, `Styles.xaml`. It is easy to find things.
- **Use the XAML designer's error list.** A missing `StaticResource` usually shows there before you run.
- **Converters are resources too.** You have been doing this since [Value Converters](/courses/wpf/value-converters).

## Quick recap

- A resource is a named, reusable object stored in a `Resources` dictionary with an `x:Key`.
- Lookup goes from the element up through its parents, the window, `App.xaml`, then themes and system resources.
- `StaticResource` looks once and needs the resource defined earlier. `DynamicResource` follows changes and is the basis of theme switching.
- Split resources into `ResourceDictionary` files and combine them with `MergedDictionaries`. The last merged key wins.
- Pack URIs load dictionaries from other assemblies.
- `FindResource`, `TryFindResource` and the `Resources` indexer work from C#.

<code id="code-content" class="language-xml">
&lt;!-- Themes/Colors.xaml --&gt;
&lt;ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"&gt;
    &lt;!-- Colours first, brushes built from them after --&gt;
    &lt;Color x:Key="AccentColor"&gt;#2E7D32&lt;/Color&gt;
    &lt;SolidColorBrush x:Key="AccentBrush" Color="{StaticResource AccentColor}" /&gt;
    &lt;SolidColorBrush x:Key="PageBrush" Color="#F3F5F7" /&gt;
    &lt;SolidColorBrush x:Key="CardBrush" Color="#FFFFFF" /&gt;
    &lt;SolidColorBrush x:Key="MutedTextBrush" Color="#6B7280" /&gt;
&lt;/ResourceDictionary&gt;
&lt;!-- Themes/Sizes.xaml --&gt;
&lt;ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
                    xmlns:sys="clr-namespace:System;assembly=mscorlib"&gt;
    &lt;sys:Double x:Key="TitleFontSize"&gt;22&lt;/sys:Double&gt;
    &lt;Thickness x:Key="PagePadding"&gt;16&lt;/Thickness&gt;
    &lt;Thickness x:Key="CardPadding"&gt;16,12&lt;/Thickness&gt;
    &lt;CornerRadius x:Key="CardCorner"&gt;8&lt;/CornerRadius&gt;
&lt;/ResourceDictionary&gt;
&lt;!-- App.xaml --&gt;
&lt;Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml"&gt;
    &lt;Application.Resources&gt;
        &lt;ResourceDictionary&gt;
            &lt;ResourceDictionary.MergedDictionaries&gt;
                &lt;ResourceDictionary Source="Themes/Colors.xaml" /&gt;
                &lt;ResourceDictionary Source="Themes/Sizes.xaml" /&gt;
            &lt;/ResourceDictionary.MergedDictionaries&gt;
            &lt;!-- App level resources go inside, after the merged list --&gt;
            &lt;SolidColorBrush x:Key="DangerBrush" Color="#C62828" /&gt;
        &lt;/ResourceDictionary&gt;
    &lt;/Application.Resources&gt;
&lt;/Application&gt;
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:sys="clr-namespace:System;assembly=mscorlib"
        Title="CoinJar" Height="320" Width="460"
        Background="{StaticResource PageBrush}"&gt;
    &lt;Window.Resources&gt;
        &lt;!-- Only this window uses it, so it lives here --&gt;
        &lt;sys:String x:Key="Tagline"&gt;Every coin counts.&lt;/sys:String&gt;
    &lt;/Window.Resources&gt;
    &lt;StackPanel Margin="{StaticResource PagePadding}"&gt;
        &lt;!-- DynamicResource follows changes to AccentBrush --&gt;
        &lt;TextBlock Text="CoinJar" FontWeight="Bold"
                   FontSize="{StaticResource TitleFontSize}"
                   Foreground="{DynamicResource AccentBrush}" /&gt;
        &lt;TextBlock Text="{StaticResource Tagline}" Foreground="{StaticResource MutedTextBrush}" /&gt;
        &lt;Border Background="{StaticResource CardBrush}" Padding="{StaticResource CardPadding}"
                CornerRadius="{StaticResource CardCorner}" Margin="0,16,0,0"&gt;
            &lt;StackPanel&gt;
                &lt;TextBlock Text="Spent this month" Foreground="{StaticResource MutedTextBrush}" /&gt;
                &lt;TextBlock Text="$412.35" FontSize="28" Foreground="{DynamicResource AccentBrush}" /&gt;
                &lt;TextBlock Text="Over budget on Fun" Foreground="{StaticResource DangerBrush}" /&gt;
            &lt;/StackPanel&gt;
        &lt;/Border&gt;
        &lt;Button Content="Change accent" Margin="0,16,0,0" HorizontalAlignment="Left"
                Padding="12,4" Click="ChangeAccent_Click" /&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Media;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
    private void ChangeAccent_Click(object sender, RoutedEventArgs e)
    {
        // Replace the app wide brush. Only DynamicResource users update.
        var current = (SolidColorBrush)FindResource("AccentBrush");
        Application.Current.Resources["AccentBrush"] =
            current.Color == Colors.DarkOrange
                ? new SolidColorBrush(Color.FromRgb(0x2E, 0x7D, 0x32))
                : new SolidColorBrush(Colors.DarkOrange);
    }
}
</code></pre>
