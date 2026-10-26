---
publishDate: 2026-10-25T20:07
title: 'XAML Namespaces and Markup Extensions'
slug: xaml-namespaces-and-markup-extensions
metadescription: 'Understand the xmlns lines at the top of every XAML file, how to use your own C# classes with clr-namespace, and how markup extensions like Binding, StaticResource and x:Static work.'
updateDate: 2026-10-25T20:07
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'xaml', 'namespaces', 'markup-extensions']
course: wpf
---

## Those lines at the top

Every XAML file you have seen so far starts with a block of `xmlns` lines:

```xml
<Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        xmlns:local="clr-namespace:CoinJar"
        mc:Ignorable="d">
```

Until now you have just left them alone. This lesson explains what they mean, how to add your own, and then looks at **markup extensions**, the bits in curly braces like `{Binding ...}`.

## Why XAML needs namespaces

In C#, a `using` line tells the compiler where to find a class. `using System.Windows.Controls;` means "when I write `Button`, look in `System.Windows.Controls`".

XAML needs the same thing. When it sees `<Button>`, it has to know which `Button` class you mean. An **XML namespace**, declared with `xmlns`, does that job. Think of it as XAML's version of `using`.

The general shape is:

```text
xmlns:prefix="where to look"
```

After that, you write `prefix:Name` to use something from that place. A namespace without a prefix is the **default namespace**: names without a prefix are looked up there.

## The default namespace: WPF controls

```xml
xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
```

This one has no prefix, so it is the default. It points to all of WPF's own classes: `Window`, `Grid`, `Button`, `TextBox`, brushes, shapes and more. That is why you can write `<Button>` without any prefix.

The value looks like a web address, but WPF never visits it. It is just a unique name. WPF has a built in map from that name to many .NET namespaces, such as `System.Windows.Controls` and `System.Windows.Media`.

## The x: namespace: XAML language features

```xml
xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
```

The `x:` prefix is for features of the XAML language itself, not for any one control. You have already used two of them:

```text
x:Class     Joins this XAML file to a C# class (only on the root element)
x:Name      Gives an element a name, so C# can use it as a field
x:Key       Gives a resource a name inside a resource dictionary
x:Type      Refers to a type, like typeof() in C#
x:Static    Reads a static field or property from C#
x:Null      The value null
```

`x:Key` matters a lot from [Resources and Resource Dictionaries](/courses/wpf/resources-and-resource-dictionaries) onward. You will see `x:Type`, `x:Static` and `x:Null` in action below.

### x:Name or Name?

Many controls also have a normal `Name` property, so both of these work:

```xml
<TextBox x:Name="TitleBox" />
<TextBox Name="TitleBox" />
```

For controls they do the same thing. `x:Name` works on every element, even ones that have no `Name` property, so many people use `x:Name` everywhere to be consistent.

## The d: and mc: namespaces: design time only

```xml
xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
mc:Ignorable="d"
```

These two work as a pair:

- `d:` is for **design time** settings. They only affect the preview in the Visual Studio designer.
- `mc:Ignorable="d"` tells WPF: "when the real app runs, ignore everything with the `d:` prefix".

The most common use is giving the designer a size to preview a control at, without fixing its real size:

```xml
<UserControl ...
             d:DesignWidth="400" d:DesignHeight="300">
```

At run time those two values vanish. You will meet `d:DataContext` later, which gives the designer sample data to show. If you never use the designer, you can delete the `d:` and `mc:` lines, but keeping them does no harm.

## The local: namespace: your own classes

```xml
xmlns:local="clr-namespace:CoinJar"
```

This one points at **your** code. `clr-namespace:CoinJar` means "the C# namespace `CoinJar` in this project". (CLR is the **Common Language Runtime**, the part of .NET that runs your code.) The prefix name `local` is just a habit. You can pick any prefix.

Say you have this class:

```csharp
namespace CoinJar;

public static class AppInfo
{
    public const string Name = "CoinJar";
    public static string Version => "1.0";
}
```

With the `local` prefix you can use it from XAML (here with `x:Static`, explained below):

```xml
<TextBlock Text="{x:Static local:AppInfo.Name}" />
```

### Adding more namespaces

As CoinJar grows, its classes will live in sub namespaces. Add one prefix for each:

```xml
xmlns:vm="clr-namespace:CoinJar.ViewModels"
xmlns:conv="clr-namespace:CoinJar.Converters"
xmlns:models="clr-namespace:CoinJar.Models"
```

Then `<conv:MoneyConverter />` creates a `CoinJar.Converters.MoneyConverter` object. You will write converters in [Value Converters](/courses/wpf/value-converters).

### Classes from another assembly

An **assembly** is a compiled `.dll` or `.exe` file. To use a class from a different one, add `assembly=` after a semicolon. The most common case is .NET's own `System` types:

```xml
xmlns:sys="clr-namespace:System;assembly=System.Runtime"
```

Now you can create plain .NET values in XAML:

```xml
<sys:String x:Key="AppTitle">CoinJar</sys:String>
<sys:Double x:Key="BigFont">22</sys:Double>
```

Some libraries, including WPF toolkits you install from NuGet, give themselves a nice URL style name instead, just like WPF does. Their documentation tells you which `xmlns` line to use.

## Markup extensions: the curly braces

Normally an attribute value is plain text, and a type converter turns it into the right type, as you saw in [XAML Syntax Basics](/courses/wpf/xaml-syntax-basics). But sometimes text is not enough. You want the value to come from somewhere else: another control, a resource, a C# constant.

A **markup extension** is a value in curly braces `{ }`. When WPF sees the brace, it does not treat the text as a plain string. It runs a small piece of code that works out the real value.

```text
{ExtensionName  FirstValue,  Setting=Value,  Setting=Value}
```

The first word is the extension's name. After it come settings, separated by commas.

### Binding: a value from somewhere else

`{Binding}` is the extension you will use most. It creates a live link to a value, so when the source changes, the target updates by itself. This one shows the slider's value in a text block:

```xml
<Slider x:Name="BudgetSlider" Minimum="0" Maximum="1000" Value="250" />
<TextBlock Text="{Binding ElementName=BudgetSlider, Path=Value}" />
```

Drag the slider and the number updates without a single line of C#. Binding has a whole section of its own, starting with [Data Binding Basics](/courses/wpf/data-binding-basics).

### StaticResource and DynamicResource: a shared value

Resources are named, reusable values stored in a `Resources` section. `{StaticResource Key}` looks one up:

```xml
<Window.Resources>
    <SolidColorBrush x:Key="AccentBrush" Color="#2E7D32" />
</Window.Resources>

<TextBlock Text="Total" Foreground="{StaticResource AccentBrush}" />
```

`{DynamicResource Key}` looks the same, but keeps watching. If the resource is replaced while the app runs, the control updates. That is how theme switching works in [Light, Dark and Fluent Themes](/courses/wpf/light-dark-and-fluent-themes).

### x:Static: a C# constant or static property

```xml
<TextBlock Text="{x:Static local:AppInfo.Version}" />
<TextBlock Text="{x:Static sys:Environment.UserName}" />
```

The first reads your own static property. The second reads the Windows user name from .NET. This is handy for values that never change, like app names or built in system colours.

### x:Null and x:Type

```xml
<!-- Remove a background on purpose -->
<Button Content="Plain" Background="{x:Null}" />

<!-- Refer to a type, used a lot in styles -->
<Style TargetType="{x:Type Button}" />
```

In styles you can usually write `TargetType="Button"` and WPF converts it for you. `{x:Type}` is the long form you will see in older code. Styles come in [Styles and Setters](/courses/wpf/styles-and-setters).

### RelativeSource: a value from a nearby element

```xml
<TextBlock Text="{Binding Title, RelativeSource={RelativeSource AncestorType=Window}}" />
```

This shows the title of the window the text block lives in. Notice how one markup extension can sit inside another. WPF works from the inside out.

## Short forms

Markup extensions have a few shortcuts that you will see everywhere:

```xml
<!-- These two are the same: the first value is the Path -->
<TextBlock Text="{Binding Path=Value, ElementName=BudgetSlider}" />
<TextBlock Text="{Binding Value, ElementName=BudgetSlider}" />
```

And every markup extension can also be written with property element syntax. It is longer, but it can help when a value gets complicated:

```xml
<TextBlock>
    <TextBlock.Text>
        <Binding ElementName="BudgetSlider" Path="Value" />
    </TextBlock.Text>
</TextBlock>
```

## Showing a real curly brace

What if you actually want a text block to show `{Hello}`? Start the value with an empty pair of braces `{}`. It tells WPF "the rest is plain text":

```xml
<TextBlock Text="{}{Hello}" />
```

You will see `{}` again in string formats like `StringFormat={}{0:C}` when you format money in bindings.

## Common mistakes

- **A missing prefix.** Writing `<MoneyConverter />` instead of `<conv:MoneyConverter />` gives "The tag MoneyConverter does not exist in XML namespace ...". Add the prefix and check its `xmlns` line.
- **A wrong namespace name.** `clr-namespace:Coinjar` (small j) does not match `CoinJar`. It is case sensitive.
- **The class is not public.** XAML can only see `public` classes and members.
- **A typo in a resource key.** `{StaticResource AcentBrush}` fails when the window loads. Copy keys rather than retyping them.
- **Using a resource before it is defined.** `StaticResource` looks up the key once, when the XAML is loaded. Define resources above the controls that use them (for example in `Window.Resources` or `App.xaml`).

## Quick recap

- `xmlns` lines are XAML's version of `using`. A prefix like `x:` or `local:` says where a name comes from.
- The default namespace holds WPF's controls. `x:` holds XAML language features like `x:Class`, `x:Name` and `x:Key`.
- `d:` values are for the designer only, and `mc:Ignorable="d"` hides them at run time.
- `clr-namespace:CoinJar` points at your own C# namespace. Add `;assembly=...` for other assemblies.
- Markup extensions in `{ }` compute a value: `Binding`, `StaticResource`, `DynamicResource`, `x:Static`, `x:Null`, `x:Type`, `RelativeSource`.
- Start a value with `{}` to show a real curly brace.
- Next, see how all these elements fit together in [Logical and Visual Trees](/courses/wpf/logical-and-visual-trees).

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        xmlns:local="clr-namespace:CoinJar"
        xmlns:sys="clr-namespace:System;assembly=System.Runtime"
        mc:Ignorable="d"
        Title="{x:Static local:AppInfo.Name}"
        Width="420" SizeToContent="Height"
        d:DesignHeight="300"&gt;
    &lt;!-- d:DesignHeight only affects the Visual Studio designer --&gt;
    &lt;Window.Resources&gt;
        &lt;!-- Resources are defined before the controls that use them --&gt;
        &lt;SolidColorBrush x:Key="AccentBrush" Color="#2E7D32" /&gt;
        &lt;sys:Double x:Key="BigFont"&gt;22&lt;/sys:Double&gt;
        &lt;sys:String x:Key="Tagline"&gt;Every coin counts.&lt;/sys:String&gt;
    &lt;/Window.Resources&gt;
    &lt;StackPanel Margin="20"&gt;
        &lt;!-- x:Static reads a static member of our own class (local: prefix) --&gt;
        &lt;TextBlock FontSize="{StaticResource BigFont}"
                   Foreground="{StaticResource AccentBrush}"
                   FontWeight="Bold"
                   Text="{x:Static local:AppInfo.Name}" /&gt;
        &lt;TextBlock Text="{StaticResource Tagline}" Margin="0,0,0,12" /&gt;
        &lt;!-- x:Static with a .NET type through the sys: prefix --&gt;
        &lt;TextBlock&gt;
            &lt;Run Text="Signed in as " /&gt;
            &lt;Run Text="{x:Static sys:Environment.UserName}" FontWeight="SemiBold" /&gt;
        &lt;/TextBlock&gt;
        &lt;TextBlock Margin="0,4,0,16"&gt;
            &lt;Run Text="Version " /&gt;
            &lt;Run Text="{x:Static local:AppInfo.Version}" /&gt;
        &lt;/TextBlock&gt;
        &lt;!-- Binding to another element: no C# needed --&gt;
        &lt;TextBlock Text="Monthly budget" /&gt;
        &lt;Slider x:Name="BudgetSlider" Minimum="0" Maximum="1000" Value="250"
                IsSnapToTickEnabled="True" TickFrequency="10" /&gt;
        &lt;TextBlock Text="{Binding Value, ElementName=BudgetSlider, StringFormat='{}{0:N0} coins'}"
                   FontSize="16" /&gt;
        &lt;!-- RelativeSource: read the Title of the window we are inside --&gt;
        &lt;TextBlock Margin="0,12,0,0" Foreground="Gray"
                   Text="{Binding Title, RelativeSource={RelativeSource AncestorType=Window}}" /&gt;
        &lt;!-- {} lets us show real curly braces --&gt;
        &lt;TextBlock Text="{}{This text has real braces}" Foreground="Gray" /&gt;
        &lt;!-- x:Null clears the background on purpose --&gt;
        &lt;Button Content="Plain button" Background="{x:Null}" Margin="0,12,0,0"
                HorizontalAlignment="Left" Padding="12,4" /&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// AppInfo.cs
namespace CoinJar;
// XAML can only see public classes and members
public static class AppInfo
{
    public const string Name = "CoinJar";
    public static string Version =&gt; "1.0";
}
</code></pre>
