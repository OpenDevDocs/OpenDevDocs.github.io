---
publishDate: 2026-10-25T20:35
title: 'Light, Dark and Fluent Themes'
slug: light-dark-and-fluent-themes
metadescription: 'Add light and dark modes to CoinJar with swappable resource dictionaries and DynamicResource, follow the Windows setting, and use the built in Fluent theme with ThemeMode.'
updateDate: 2026-10-25T20:35
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'themes', 'dark-mode', 'fluent', 'styling']
course: wpf
---

## Why themes matter

Many people run Windows in dark mode, and they expect apps to follow. Others pick light mode, or want to choose per app. A **theme** is a complete set of colours (and sometimes styles) that you can swap as a whole, so the same window can look light or dark.

In this lesson you will:

1. build your own light and dark colour sets for CoinJar
2. switch between them while the app runs
3. follow the Windows light or dark setting
4. use the **Fluent theme** that ships with WPF in .NET 9 and later, which gives standard controls a modern Windows 11 look

Everything here builds on two things you already know from [Resources and Resource Dictionaries](/courses/wpf/resources-and-resource-dictionaries): resource dictionary files and `DynamicResource`.

## The idea in one picture

```text
App.xaml MergedDictionaries
   Themes/Light.xaml   <- swap this one file ...
   Themes/Styles.xaml
        |
        v
   {DynamicResource PageBrush} everywhere  ... and everything repaints
```

Both theme files define **the same keys** with different colours. Every element asks for colours with `DynamicResource`. When you replace the theme dictionary, WPF notices that the resources changed and repaints every element that uses them.

## Step 1: two dictionaries with the same keys

Create `Themes/Light.xaml`:

```xml
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <SolidColorBrush x:Key="PageBrush" Color="#F3F5F7" />
    <SolidColorBrush x:Key="CardBrush" Color="#FFFFFF" />
    <SolidColorBrush x:Key="TextBrush" Color="#111827" />
    <SolidColorBrush x:Key="MutedTextBrush" Color="#6B7280" />
    <SolidColorBrush x:Key="BorderBrush" Color="#E5E7EB" />
    <SolidColorBrush x:Key="AccentBrush" Color="#2E7D32" />
</ResourceDictionary>
```

And `Themes/Dark.xaml` with the same keys:

```xml
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <SolidColorBrush x:Key="PageBrush" Color="#16181C" />
    <SolidColorBrush x:Key="CardBrush" Color="#22252B" />
    <SolidColorBrush x:Key="TextBrush" Color="#F3F4F6" />
    <SolidColorBrush x:Key="MutedTextBrush" Color="#9CA3AF" />
    <SolidColorBrush x:Key="BorderBrush" Color="#33373F" />
    <SolidColorBrush x:Key="AccentBrush" Color="#66BB6A" />
</ResourceDictionary>
```

Notice the accent is a lighter green in dark mode. A dark green on a dark background is hard to read. Good dark themes are not just "invert the colours". They use softer backgrounds (dark grey, not pure black) and slightly brighter accents.

Name keys by **purpose** (`CardBrush`, `MutedTextBrush`), never by colour (`WhiteBrush`). In dark mode the "card" is not white.

## Step 2: use DynamicResource for anything themed

Merge one theme in `App.xaml` to start with:

```xml
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <ResourceDictionary Source="Themes/Light.xaml" />
        </ResourceDictionary.MergedDictionaries>
    </ResourceDictionary>
</Application.Resources>
```

Then every themed colour uses `DynamicResource`:

```xml
<Window Background="{DynamicResource PageBrush}"
        Foreground="{DynamicResource TextBrush}">
    <Border Background="{DynamicResource CardBrush}"
            BorderBrush="{DynamicResource BorderBrush}" BorderThickness="1"
            CornerRadius="8" Padding="16">
        <TextBlock Text="Spent this month" Foreground="{DynamicResource MutedTextBrush}" />
    </Border>
</Window>
```

The same goes for setters in your [styles](/courses/wpf/styles-and-setters) and colours inside [control templates](/courses/wpf/control-templates):

```xml
<Style x:Key="Card" TargetType="Border">
    <Setter Property="Background" Value="{DynamicResource CardBrush}" />
    <Setter Property="BorderBrush" Value="{DynamicResource BorderBrush}" />
</Style>
```

If even one place uses `StaticResource` or a hard coded colour like `#FFFFFF`, that spot will stay light when everything else turns dark. That is the most common theme bug.

## Step 3: swap the dictionary at run time

Switching themes means: find the current theme dictionary in the merged list and replace it with the other one. A small helper class keeps this in one place:

```csharp
public static class ThemeService
{
    public static void ApplyColours(bool dark)
    {
        var merged = Application.Current.Resources.MergedDictionaries;

        // Find the dictionary we loaded before, if any
        var old = merged.FirstOrDefault(d =>
            d.Source != null &&
            (d.Source.OriginalString.EndsWith("Themes/Light.xaml") ||
             d.Source.OriginalString.EndsWith("Themes/Dark.xaml")));

        var fresh = new ResourceDictionary
        {
            Source = new Uri($"pack://application:,,,/Themes/{(dark ? "Dark" : "Light")}.xaml")
        };

        if (old != null) merged[merged.IndexOf(old)] = fresh;
        else merged.Insert(0, fresh);
    }
}
```

The `pack://application:,,,/` address is the pack URI format from the resources lesson. It points at a XAML file compiled into the app.

The search matches the full ending `Themes/Light.xaml` on purpose. When the Fluent theme (later in this lesson) is switched on, WPF adds its own dictionary to the same list, and its name (`Fluent.Light.xaml`) also ends in `Light.xaml`. A looser match would replace Fluent's dictionary by mistake.

Call it from anywhere, for example a menu item from [Menus, ToolBars and StatusBars](/courses/wpf/menus-toolbars-and-status-bars):

```csharp
private void DarkMode_Click(object sender, RoutedEventArgs e) => ThemeService.ApplyColours(dark: true);
```

To remember the user's choice next time the app starts, save it in a settings file. You will learn how in [App Settings and Configuration](/courses/wpf/app-settings-and-configuration).

## Step 4: follow the Windows setting

Windows stores the "apps" light or dark choice in the registry, the system's settings database. The value `AppsUseLightTheme` is `1` for light and `0` for dark:

```csharp
using Microsoft.Win32;

public static bool IsWindowsInDarkMode()
{
    object? value = Registry.GetValue(
        @"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
        "AppsUseLightTheme", 1);

    return value is int i && i == 0;
}
```

The last argument (`1`) is the default, used when the value does not exist, for example on older Windows versions. We only **read** this setting. Never change it from your app.

To react when the user flips the setting while CoinJar is open, listen to `SystemEvents.UserPreferenceChanged`, a static [event](/courses/c-sharp/events) from `Microsoft.Win32`:

```csharp
SystemEvents.UserPreferenceChanged += (s, e) =>
{
    if (e.Category == UserPreferenceCategory.General)
    {
        Application.Current.Dispatcher.Invoke(() => ThemeService.ApplyColours(IsWindowsInDarkMode()));
    }
};
```

`Dispatcher.Invoke` makes sure the change runs on the UI thread, because the event may arrive on another thread. That idea is explained in [The Dispatcher and Threading](/courses/wpf/the-dispatcher-and-threading).

## The Fluent theme

So far you changed **your** colours. But the standard controls (buttons, text boxes, combo boxes, scroll bars, the `DataGrid`) still use the classic look, which is always light. Making every control dark by hand would mean templating all of them.

Since .NET 9, WPF includes a **Fluent theme**: modern styles for the standard controls that match Windows 11, with rounded corners, the user's accent colour, and both light and dark versions. On .NET 10 you switch it on with one attribute.

### ThemeMode in XAML

Set `ThemeMode` on the `Application` in `App.xaml`:

```xml
<Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml"
             ThemeMode="System">
</Application>
```

The values are:

| `ThemeMode` | Result |
| --- | --- |
| `None` | no Fluent theme, the classic look (the default) |
| `Light` | Fluent, always light |
| `Dark` | Fluent, always dark |
| `System` | Fluent, following the Windows light or dark setting automatically |

You can also set `ThemeMode` on a single `Window` to give just that window its own mode. Setting it in XAML compiles with no warnings.

### ThemeMode from C#: the WPF0001 error

Changing the theme from code, for example from a settings menu, looks like this:

```csharp
Application.Current.ThemeMode = ThemeMode.Dark;
```

But it fails to build with **error WPF0001**: the API is marked "for evaluation purposes only". The feature is still marked **experimental**, which means its shape may change in a future version. To use it anyway, opt in around the code:

```csharp
#pragma warning disable WPF0001
        Application.Current.ThemeMode = dark ? ThemeMode.Dark : ThemeMode.Light;
#pragma warning restore WPF0001
```

Or turn the check off for the whole project in the `.csproj`:

```xml
<PropertyGroup>
    <NoWarn>$(NoWarn);WPF0001</NoWarn>
</PropertyGroup>
```

The `#pragma` version is better practice: it marks exactly the lines that use an experimental API.

### The older way: merging Fluent.xaml

Before `ThemeMode` existed (and still today), you can load the Fluent styles by merging their dictionary yourself, using a pack URI into the `PresentationFramework.Fluent` assembly:

```xml
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <ResourceDictionary Source="pack://application:,,,/PresentationFramework.Fluent;component/Themes/Fluent.xaml" />
        </ResourceDictionary.MergedDictionaries>
    </ResourceDictionary>
</Application.Resources>
```

You will see this in some tutorials. For new .NET 10 apps, `ThemeMode` is simpler.

## Combining Fluent with your own colours

The neat solution for CoinJar uses both:

- the **Fluent theme** draws the standard controls in light or dark
- **your dictionaries** colour your own surfaces: cards, charts, category chips

Switch both together so they always agree. The full `ThemeService` in the code panel does exactly this, with three choices: Light, Dark and System.

A few things to keep in mind:

- A local `Background` on a control replaces Fluent's background for that control. That is what you want for your own cards, but avoid it on standard controls or they will not follow the theme.
- Your own control templates replace Fluent's look completely. Use `DynamicResource` brushes in them.
- Fluent styles change sizes and padding a little compared with the classic look. Check your layouts after switching it on.

## Tips and common mistakes

- **One element stays light.** It uses `StaticResource` or a hard coded colour. Search your XAML for `#` colours and `StaticResource` brushes.
- **Icons disappear in dark mode.** A black `Path` icon on a dark background. Give icons `Fill="{DynamicResource TextBrush}"`, which is another good reason to use [Path icons](/courses/wpf/brushes-shapes-and-effects) instead of images.
- **Keys missing from one theme.** If `Dark.xaml` forgets a key, `DynamicResource` silently shows nothing. Keep both files in the same order so they are easy to compare.
- **Do not forget high contrast.** Some users need Windows high contrast mode. `SystemParameters.HighContrast` tells you when it is on, and [Accessibility and Localization](/courses/wpf/accessibility-and-localization) covers it.
- **Build error WPF0001.** You set `ThemeMode` from C#. Add the `#pragma` or the `NoWarn` entry.
- **Test both themes.** Click through every window in light and dark mode before shipping.

## Quick recap

- A theme is a swappable set of resources. Make one dictionary per theme with the **same keys**.
- Use `DynamicResource` for every themed colour, in elements, styles and templates.
- Swap the theme by replacing the dictionary in `Application.Current.Resources.MergedDictionaries`.
- Read `AppsUseLightTheme` from the registry to follow Windows, and listen to `SystemEvents.UserPreferenceChanged` for live changes.
- The Fluent theme (`ThemeMode="Light"`, `"Dark"` or `"System"`) gives standard controls a modern look. It is still marked experimental: setting it from C# needs `#pragma warning disable WPF0001`.
- Combine Fluent for controls with your own dictionaries for your surfaces, and switch both together.

<code id="code-content" class="language-csharp">
// Services/ThemeService.cs
using System.Windows;
using Microsoft.Win32;
namespace CoinJar.Services;
public enum AppTheme { Light, Dark, System }
// Keeps the Fluent theme and CoinJar's own colours in step
public static class ThemeService
{
    public static AppTheme Current { get; private set; } = AppTheme.System;
    private static bool _listening;
    public static void Apply(AppTheme theme)
    {
        Current = theme;
        bool dark = theme == AppTheme.Dark || (theme == AppTheme.System &amp;&amp; IsWindowsInDarkMode());
        // 1. Standard controls: the Fluent theme (still experimental, so opt in)
#pragma warning disable WPF0001
        Application.Current.ThemeMode = theme switch
        {
            AppTheme.Light =&gt; ThemeMode.Light,
            AppTheme.Dark =&gt; ThemeMode.Dark,
            _ =&gt; ThemeMode.System
        };
#pragma warning restore WPF0001
        // 2. Our own surfaces: swap Light.xaml and Dark.xaml
        ApplyColours(dark);
        // 3. Follow Windows while the app runs (subscribe once)
        if (!_listening)
        {
            SystemEvents.UserPreferenceChanged += OnUserPreferenceChanged;
            _listening = true;
        }
    }
    public static void ApplyColours(bool dark)
    {
        var merged = Application.Current.Resources.MergedDictionaries;
        var old = merged.FirstOrDefault(d =&gt;
            d.Source != null &amp;&amp;
            (d.Source.OriginalString.EndsWith("Themes/Light.xaml") ||
             d.Source.OriginalString.EndsWith("Themes/Dark.xaml")));
        var fresh = new ResourceDictionary
        {
            Source = new Uri($"pack://application:,,,/Themes/{(dark ? "Dark" : "Light")}.xaml")
        };
        if (old != null) merged[merged.IndexOf(old)] = fresh;
        else merged.Add(fresh);
    }
    public static bool IsWindowsInDarkMode()
    {
        // 1 = light, 0 = dark. We only read this value.
        object? value = Registry.GetValue(
            @"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
            "AppsUseLightTheme", 1);
        return value is int i &amp;&amp; i == 0;
    }
    private static void OnUserPreferenceChanged(object sender, UserPreferenceChangedEventArgs e)
    {
        if (e.Category == UserPreferenceCategory.General &amp;&amp; Current == AppTheme.System)
        {
            // The event may arrive on another thread
            Application.Current.Dispatcher.Invoke(() =&gt; ApplyColours(IsWindowsInDarkMode()));
        }
    }
}
// App.xaml.cs
using System.Windows;
using CoinJar.Services;
namespace CoinJar;
public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        // Later the saved choice comes from a settings file
        ThemeService.Apply(AppTheme.System);
    }
}
&lt;!-- App.xaml --&gt;
&lt;Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml"
             ThemeMode="System"&gt;
    &lt;Application.Resources&gt;
        &lt;ResourceDictionary&gt;
            &lt;ResourceDictionary.MergedDictionaries&gt;
                &lt;!-- ThemeService swaps this for Dark.xaml when needed --&gt;
                &lt;ResourceDictionary Source="Themes/Light.xaml" /&gt;
            &lt;/ResourceDictionary.MergedDictionaries&gt;
        &lt;/ResourceDictionary&gt;
    &lt;/Application.Resources&gt;
&lt;/Application&gt;
&lt;!-- Themes/Light.xaml --&gt;
&lt;ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"&gt;
    &lt;SolidColorBrush x:Key="PageBrush" Color="#F3F5F7" /&gt;
    &lt;SolidColorBrush x:Key="CardBrush" Color="#FFFFFF" /&gt;
    &lt;SolidColorBrush x:Key="TextBrush" Color="#111827" /&gt;
    &lt;SolidColorBrush x:Key="MutedTextBrush" Color="#6B7280" /&gt;
    &lt;SolidColorBrush x:Key="BorderBrush" Color="#E5E7EB" /&gt;
    &lt;SolidColorBrush x:Key="AccentBrush" Color="#2E7D32" /&gt;
&lt;/ResourceDictionary&gt;
&lt;!-- Themes/Dark.xaml --&gt;
&lt;ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"&gt;
    &lt;!-- Same keys, darker surfaces, brighter accent --&gt;
    &lt;SolidColorBrush x:Key="PageBrush" Color="#16181C" /&gt;
    &lt;SolidColorBrush x:Key="CardBrush" Color="#22252B" /&gt;
    &lt;SolidColorBrush x:Key="TextBrush" Color="#F3F4F6" /&gt;
    &lt;SolidColorBrush x:Key="MutedTextBrush" Color="#9CA3AF" /&gt;
    &lt;SolidColorBrush x:Key="BorderBrush" Color="#33373F" /&gt;
    &lt;SolidColorBrush x:Key="AccentBrush" Color="#66BB6A" /&gt;
&lt;/ResourceDictionary&gt;
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Height="340" Width="460"
        Background="{DynamicResource PageBrush}"
        Foreground="{DynamicResource TextBrush}"&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;StackPanel Orientation="Horizontal" Margin="0,0,0,16"&gt;
            &lt;TextBlock Text="Theme:" VerticalAlignment="Center" Margin="0,0,8,0" /&gt;
            &lt;!-- Standard controls are drawn by the Fluent theme --&gt;
            &lt;ComboBox x:Name="ThemePicker" Width="120" SelectionChanged="ThemePicker_SelectionChanged"&gt;
                &lt;ComboBoxItem Content="System" IsSelected="True" /&gt;
                &lt;ComboBoxItem Content="Light" /&gt;
                &lt;ComboBoxItem Content="Dark" /&gt;
            &lt;/ComboBox&gt;
        &lt;/StackPanel&gt;
        &lt;!-- Our own surface uses DynamicResource so it follows the swap --&gt;
        &lt;Border Background="{DynamicResource CardBrush}" BorderBrush="{DynamicResource BorderBrush}"
                BorderThickness="1" CornerRadius="8" Padding="16,12"&gt;
            &lt;StackPanel&gt;
                &lt;TextBlock Text="Spent this month" Foreground="{DynamicResource MutedTextBrush}" /&gt;
                &lt;TextBlock Text="$412.35" FontSize="28" FontWeight="Bold"
                           Foreground="{DynamicResource AccentBrush}" /&gt;
                &lt;TextBox Text="Search expenses" Margin="0,12,0,0" /&gt;
                &lt;CheckBox Content="Show only this month" IsChecked="True" Margin="0,8,0,0" /&gt;
            &lt;/StackPanel&gt;
        &lt;/Border&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using CoinJar.Services;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
    private void ThemePicker_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        // Ignore the event raised while the window is still loading
        if (!IsLoaded) return;
        string choice = (string)((ComboBoxItem)ThemePicker.SelectedItem).Content;
        ThemeService.Apply(Enum.Parse&lt;AppTheme&gt;(choice));
    }
}
</code></pre>
