---
publishDate: 2026-10-25T20:09
title: 'Layout Basics: Size, Margin and Alignment'
slug: layout-basics-size-margin-and-alignment
metadescription: 'Learn how WPF decides the size and position of every element: Width and Height, Min and Max sizes, Margin, Padding, and horizontal and vertical alignment.'
updateDate: 2026-10-25T20:09
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'layout', 'xaml', 'beginners']
course: wpf
---

## What layout means in WPF

**Layout** is the job of deciding how big every element is and where it sits in the window. In some older tools you place each button at an exact spot, like sticking notes on a fridge. WPF works differently. You describe what you want ("this button should be in the middle, with some space around it") and WPF works out the exact numbers for you.

This matters because WPF windows can be resized, screens have different sizes, and text can be longer in another language. A layout that is described instead of fixed adapts to all of that.

In this lesson you learn the properties that every element has, no matter which panel it lives in:

- `Width` and `Height` (and their `Min` and `Max` friends)
- `Margin` (space outside an element)
- `Padding` (space inside a control)
- `HorizontalAlignment` and `VerticalAlignment` (where an element sits in the space it gets)

The next lessons, starting with [The Grid Panel](/courses/wpf/the-grid-panel), show the panels that use these properties.

## How WPF does layout: ask, then place

Every time a window opens or changes size, WPF runs a **layout pass** in two steps:

1. **Measure.** The parent asks each child: "How much space would you like?" A button with the text "OK" wants a small amount. A long paragraph wants more.
2. **Arrange.** The parent then tells each child: "Here is the space you actually get." The child places itself inside that space.

You never call these steps yourself. They run on their own. But knowing they exist explains a lot of behaviour. For example, a `Button` inside a `Grid` cell fills the whole cell by default, because the cell offers all its space and the button takes it.

You saw in [Logical and Visual Trees](/courses/wpf/logical-and-visual-trees) that elements are nested inside each other. Layout follows that same tree, from the window down to the smallest piece of text.

## Units: device independent pixels

Sizes in WPF are measured in **device independent pixels** (often shortened to DIPs). One DIP is 1/96 of an inch. On a normal screen at 100% scaling, one DIP is one real pixel. On a screen set to 150% scaling, one DIP becomes 1.5 real pixels.

This means a button that is `Width="100"` looks about the same physical size on every screen. You do not have to do any maths for high resolution displays.

```xml
<!-- 100 DIPs wide on every screen, sharp on 4K too -->
<Button Width="100" Height="32" Content="Save" />
```

Sizes are `double` values, so `Width="120.5"` is allowed, although whole numbers are easier to read.

## Width and Height

By default an element has no fixed size. Its `Width` and `Height` are `Auto`, which means "work it out from my content and my parent". You can set a fixed size when you need one:

```xml
<StackPanel>
    <!-- Fixed size -->
    <Button Width="150" Height="40" Content="Fixed size" />

    <!-- Auto: as wide as the StackPanel, as tall as the text needs -->
    <Button Content="Auto size" />
</StackPanel>
```

A fixed size is simple, but it has a cost. If the text gets longer (for example "Speichern und schließen" in German), it will be cut off. Use fixed sizes for things that really should not change, like an icon button, and let the rest size itself.

### Min and Max sizes

Often you want something in between: "grow with the window, but never get silly". That is what `MinWidth`, `MaxWidth`, `MinHeight` and `MaxHeight` do.

```xml
<!-- Stretches with the window, but stays between 200 and 400 DIPs wide -->
<TextBox MinWidth="200" MaxWidth="400" />
```

A `TextBox` with only a `MinWidth` will never shrink below that, but can still grow. This is the most common pattern for input boxes.

The window itself also has these properties. `MinWidth="400"` on a `Window` stops the user from dragging it so small that your layout breaks.

### ActualWidth and ActualHeight

`Width` is what you **asked for**. `ActualWidth` is what the element **really got** after layout. If you never set `Width`, reading it in code gives `double.NaN` ("not a number"), which is how WPF stores `Auto`. Read `ActualWidth` instead:

```csharp
private void MeasureButton_Click(object sender, RoutedEventArgs e)
{
    // Width is NaN because we never set it. ActualWidth is the real size.
    SizeText.Text = $"Width = {MeasureButton.Width}, ActualWidth = {MeasureButton.ActualWidth:F0}";
}
```

`ActualWidth` is `0` until the element has been laid out for the first time, so do not read it in the window constructor. Read it in a `Loaded` event or later.

## Margin: space outside an element

A **margin** is empty space around the outside of an element. It pushes the element away from its neighbours and from the edges of its parent. Think of it as personal space.

`Margin` takes one, two or four numbers:

```xml
<!-- One value: 10 on all four sides -->
<Button Margin="10" Content="All sides" />

<!-- Two values: left and right = 20, top and bottom = 5 -->
<Button Margin="20,5" Content="Horizontal, vertical" />

<!-- Four values: left, top, right, bottom (clockwise from the left) -->
<Button Margin="0,10,0,20" Content="Left, top, right, bottom" />
```

The order of four values is **left, top, right, bottom**. This is different from CSS on the web, which starts at the top. A handy way to remember the WPF order: it reads like the letters "L T R B".

Margins can be negative, which pulls an element outwards so it overlaps its neighbours. You will rarely need this, but it is useful for small visual tweaks.

### A spacing habit that works

Pick one small number, for example 8, and use multiples of it everywhere: `Margin="8"`, `Margin="0,0,0,16"`. Layouts with consistent spacing look tidy without any extra design work.

## Padding: space inside a control

**Padding** is the space between a control's border and its content. A button with more padding has more room around its text.

```xml
<Button Padding="20,8" Content="Roomy button" />

<Border Background="LightYellow" BorderBrush="Goldenrod" BorderThickness="1" Padding="12">
    <TextBlock Text="The border keeps 12 DIPs of space around this text." />
</Border>
```

`Padding` uses the same one, two or four value format as `Margin`.

The difference in one sentence: **Margin is outside the border, Padding is inside it.** Not every element has `Padding`. Controls such as `Button`, `TextBox` and `Border` do. Simple elements such as `TextBlock` also have it, but panels such as `StackPanel` do not, so use a `Margin` on the children or wrap the panel in a `Border`.

## Horizontal and vertical alignment

When a parent gives an element more space than it needs, alignment decides where the element sits inside that space.

`HorizontalAlignment` can be `Left`, `Center`, `Right` or `Stretch`. `VerticalAlignment` can be `Top`, `Center`, `Bottom` or `Stretch`.

```xml
<Grid Height="120" Background="WhiteSmoke">
    <Button Content="Top left"     HorizontalAlignment="Left"   VerticalAlignment="Top" />
    <Button Content="Centre"       HorizontalAlignment="Center" VerticalAlignment="Center" />
    <Button Content="Bottom right" HorizontalAlignment="Right"  VerticalAlignment="Bottom" />
</Grid>
```

All three buttons share the same `Grid` cell, so they are placed in the same space but in different corners.

### Stretch is the default

For most elements both alignments default to `Stretch`, which means "fill all the space you are given". That is why a button placed straight inside a window covers the whole window. As soon as you set `HorizontalAlignment="Left"` (or anything except `Stretch`), the button shrinks back to the size of its content.

There is one rule to remember: **a fixed `Width` wins over `Stretch`.** If you set `Width="100"` and `HorizontalAlignment="Stretch"`, the element is 100 wide and WPF centres it in the extra space.

### Content alignment

`HorizontalAlignment` moves the whole control. `HorizontalContentAlignment` moves the content inside the control. Compare these two:

```xml
<!-- The whole button is narrow and on the left -->
<Button Content="Narrow button" HorizontalAlignment="Left" />

<!-- The button is full width, but its text sits on the left inside it -->
<Button Content="Text on the left" HorizontalContentAlignment="Left" Padding="10,4" />
```

`VerticalContentAlignment` works the same way. It is often used on a `TextBox` to centre the text vertically when the box is taller than one line.

## Sizing the window to its content

A `Window` normally uses the `Width` and `Height` you give it. For small dialogs it is nicer to let the window wrap around its content. Use `SizeToContent`:

```xml
<Window x:Class="CoinJar.AboutWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="About" SizeToContent="WidthAndHeight" ResizeMode="NoResize">
    <StackPanel Margin="16">
        <TextBlock Text="CoinJar 1.0" FontSize="18" />
        <TextBlock Text="A tiny expense tracker." Margin="0,4,0,12" />
        <Button Content="Close" HorizontalAlignment="Right" Padding="16,4" IsCancel="True" />
    </StackPanel>
</Window>
```

`SizeToContent` can be `Manual` (the default), `Width`, `Height` or `WidthAndHeight`. You met the `Window` class and its properties in [The Application and Window Classes](/courses/wpf/the-application-and-window-classes).

## Common mistakes

- **Fixed sizes everywhere.** Setting `Width` and `Height` on every control gives a layout that looks fine on your screen and breaks on others. Prefer `Auto`, `MinWidth` and the panels you will learn next.
- **Using margins to position things.** `Margin="350,200,0,0"` to move a button to the "right place" is a trap. It breaks the moment the window is resized. Use alignment and panels to position, and margins only for spacing.
- **Mixing up the four value order.** `Margin="10,0,0,0"` is space on the left, not the top.
- **Reading `Width` instead of `ActualWidth`.** `Width` is `NaN` when you did not set it.
- **Wondering why a control fills everything.** That is `Stretch`, the default. Set an alignment to make it shrink to its content.

## Tips

- In the Visual Studio designer, select an element and look at the Layout group in the Properties window. It shows margins and alignment visually, which is a quick way to learn what each value does.
- Use a temporary `Background` (for example `Background="LightPink"`) on a panel or a `Border` to see how much space it really takes. Remove it when you are done.
- `UseLayoutRounding="True"` on the window snaps edges to whole pixels, which can make thin lines and borders look sharper.

## Quick recap

- WPF layout runs in two steps: measure (what do you want?) and arrange (here is what you get).
- Sizes are in device independent pixels, 1/96 of an inch, so they look the same on every screen.
- `Width` and `Height` default to `Auto`. Use `MinWidth` and `MaxWidth` to set limits instead of fixed sizes.
- `ActualWidth` and `ActualHeight` give the real size after layout. `Width` is `NaN` when unset.
- `Margin` is space outside an element, `Padding` is space inside. Four values go left, top, right, bottom.
- `HorizontalAlignment` and `VerticalAlignment` default to `Stretch`. Any other value makes the element shrink to its content.
- `SizeToContent` lets a window wrap around its content, which is great for small dialogs.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Layout Basics" Width="480" Height="420" MinWidth="360" MinHeight="320"
        UseLayoutRounding="True"&gt;
    &lt;!-- The StackPanel stacks children top to bottom. Margin keeps it off the window edges. --&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;!-- A TextBlock heading with space below it (left, top, right, bottom) --&gt;
        &lt;TextBlock Text="Size, margin and alignment" FontSize="20" Margin="0,0,0,12" /&gt;
        &lt;!-- Stretch (the default): fills the full width --&gt;
        &lt;Button Content="Stretch (default)" Margin="0,0,0,8" /&gt;
        &lt;!-- Left, Center and Right shrink the button to its content --&gt;
        &lt;Button Content="Left" HorizontalAlignment="Left" Margin="0,0,0,8" /&gt;
        &lt;Button Content="Center" HorizontalAlignment="Center" Margin="0,0,0,8" /&gt;
        &lt;Button Content="Right" HorizontalAlignment="Right" Margin="0,0,0,8" /&gt;
        &lt;!-- Padding makes room inside the button, around the text --&gt;
        &lt;Button Content="Big padding" HorizontalAlignment="Left" Padding="24,10" Margin="0,0,0,8" /&gt;
        &lt;!-- Full width button, text on the left inside it --&gt;
        &lt;Button Content="Content aligned left" HorizontalContentAlignment="Left" Padding="10,4" Margin="0,0,0,8" /&gt;
        &lt;!-- A TextBox that grows with the window but stays within limits --&gt;
        &lt;TextBox x:Name="NameBox" MinWidth="200" MaxWidth="320" HorizontalAlignment="Left"
                 Padding="4" Margin="0,0,0,8" Text="Resize the window" /&gt;
        &lt;!-- A Border has Padding too: the space between its edge and the text --&gt;
        &lt;Border Background="LightYellow" BorderBrush="Goldenrod" BorderThickness="1" Padding="10"&gt;
            &lt;StackPanel&gt;
                &lt;Button x:Name="MeasureButton" Content="Measure me" HorizontalAlignment="Left"
                        Padding="12,4" Click="MeasureButton_Click" /&gt;
                &lt;TextBlock x:Name="SizeText" Margin="0,8,0,0" Text="Click the button to see its size." /&gt;
            &lt;/StackPanel&gt;
        &lt;/Border&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
    private void MeasureButton_Click(object sender, RoutedEventArgs e)
    {
        // Width is NaN (Auto) because we never set it in XAML.
        // ActualWidth is the size the layout system really gave the button.
        SizeText.Text =
            $"Button: Width = {MeasureButton.Width}, ActualWidth = {MeasureButton.ActualWidth:F0}\n" +
            $"TextBox: ActualWidth = {NameBox.ActualWidth:F0} (between 200 and 320)";
    }
}
</code></pre>
