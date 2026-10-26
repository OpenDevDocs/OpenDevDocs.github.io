---
publishDate: 2026-10-25T20:11
title: 'StackPanel, WrapPanel and DockPanel'
slug: stackpanel-wrappanel-and-dockpanel
metadescription: 'Learn three simple WPF panels: StackPanel for rows and columns of items, WrapPanel for items that flow onto new lines, and DockPanel for docking to the edges.'
updateDate: 2026-10-25T20:11
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'layout', 'panels', 'xaml']
course: wpf
---

## Three panels, three simple ideas

The [Grid](/courses/wpf/the-grid-panel) can do almost any layout, but it needs row and column definitions. For many small jobs a simpler panel is easier to write and easier to read. This lesson covers three of them:

- **StackPanel** puts children in a single line, one after another.
- **WrapPanel** does the same, but starts a new line when it runs out of room.
- **DockPanel** sticks children to the edges (top, bottom, left, right) and gives the rest of the space to the last child.

Each one follows the size, margin and alignment rules you learned in [Layout Basics](/courses/wpf/layout-basics-size-margin-and-alignment). Real windows usually mix several panels, nested inside each other, and the end of this lesson shows how.

## StackPanel

A `StackPanel` stacks its children. By default it stacks them **vertically**, top to bottom, like plates in a pile.

```xml
<StackPanel Margin="16">
    <TextBlock Text="Monthly summary" FontSize="18" />
    <TextBlock Text="Food: 120.00" />
    <TextBlock Text="Transport: 45.50" />
    <TextBlock Text="Bills: 300.00" />
</StackPanel>
```

There are no rows to define and no attached properties to set. The order in the XAML is the order on screen.

### Orientation

Set `Orientation="Horizontal"` to place the children side by side, left to right:

```xml
<StackPanel Orientation="Horizontal" HorizontalAlignment="Right" Margin="8">
    <Button Content="Cancel" Padding="16,4" Margin="0,0,8,0" />
    <Button Content="Save" Padding="16,4" />
</StackPanel>
```

This is the classic way to make a row of dialog buttons. The `Margin` on the first button keeps a small gap between them, because `StackPanel` itself adds no space between items.

### How StackPanel sizes its children

In a vertical `StackPanel`, every child is stretched to the full **width**, but gets only the **height** it asks for. In a horizontal one it is the other way round: full height, but only the width it needs.

The important detail: a vertical `StackPanel` offers its children **unlimited height**. It says "take as much height as you like". That has two effects you need to know:

1. A child with `VerticalAlignment="Stretch"` does not fill the remaining space, because there is no "remaining" space in an infinite direction.
2. A `ListBox` or `ScrollViewer` inside a vertical `StackPanel` never shows a scroll bar. It thinks it has endless room, so it simply grows taller than the window.

```xml
<!-- Problem: the list grows past the bottom of the window and never scrolls -->
<StackPanel>
    <TextBlock Text="Expenses" />
    <ListBox x:Name="ExpenseList" />
</StackPanel>
```

The fix is to use a `Grid` (or a `DockPanel`) for the outer layout, so the list gets a limited height. You will see scrolling in detail in [ScrollViewer and Viewbox](/courses/wpf/scrollviewer-and-viewbox).

Rule of thumb: **use StackPanel for small groups of items that will never need to scroll**, like a few buttons or a few lines of text.

## WrapPanel

A `WrapPanel` lays children out in a line, and when the next child does not fit, it **wraps** onto a new line. It works like words in a paragraph.

```xml
<WrapPanel Margin="8">
    <Button Content="Food" Margin="4" Padding="12,4" />
    <Button Content="Transport" Margin="4" Padding="12,4" />
    <Button Content="Bills" Margin="4" Padding="12,4" />
    <Button Content="Fun" Margin="4" Padding="12,4" />
    <Button Content="Other" Margin="4" Padding="12,4" />
</WrapPanel>
```

Make the window narrow and the buttons flow onto a second row. This is great for tags, filter chips, colour swatches and photo thumbnails.

### Orientation and item sizes

`WrapPanel` also has `Orientation`. The default is `Horizontal` (fill a row, then wrap down). `Vertical` fills a column, then wraps to the right.

To make every item the same size, set `ItemWidth` and `ItemHeight`:

```xml
<!-- Every child gets a 100 x 40 slot, so the rows line up like a grid -->
<WrapPanel ItemWidth="100" ItemHeight="40">
    <Button Content="Food" Margin="4" />
    <Button Content="Transport" Margin="4" />
    <Button Content="Bills" Margin="4" />
</WrapPanel>
```

Without `ItemWidth`, each child is as wide as its content, so the rows have a ragged edge.

## DockPanel

A `DockPanel` lets each child **dock** (attach) to one edge of the panel. Think of building a room: first you put a shelf along the top wall, then a desk along the left wall, and whatever floor is left in the middle is for the last piece of furniture.

Children choose an edge with the attached property `DockPanel.Dock`, which can be `Top`, `Bottom`, `Left` or `Right`:

```xml
<DockPanel>
    <TextBlock DockPanel.Dock="Top" Text="Header" Background="SteelBlue" Foreground="White" Padding="8" />
    <TextBlock DockPanel.Dock="Bottom" Text="Status: ready" Background="WhiteSmoke" Padding="8" />
    <TextBlock DockPanel.Dock="Left" Text="Categories" Background="AliceBlue" Padding="8" Width="120" />
    <TextBlock Text="Main content fills the rest" Padding="8" />
</DockPanel>
```

### LastChildFill

By default the **last child fills all the space that is left**, whatever its `DockPanel.Dock` value. That is controlled by `LastChildFill`, which is `True` by default. Set `LastChildFill="False"` if you want the last child to dock to an edge like the others and leave empty space in the middle.

```xml
<!-- A toolbar: one button on the left, two on the right, a gap in between -->
<DockPanel LastChildFill="False">
    <Button DockPanel.Dock="Left" Content="New" />
    <Button DockPanel.Dock="Right" Content="Help" />
    <Button DockPanel.Dock="Right" Content="Settings" />
</DockPanel>
```

### Order matters

Each child takes its edge from **the space that is still free** when its turn comes. So the order of the children changes the result.

```xml
<!-- Top first: the header goes across the full width -->
<DockPanel>
    <Border DockPanel.Dock="Top" Height="40" Background="SteelBlue" />
    <Border DockPanel.Dock="Left" Width="100" Background="AliceBlue" />
    <Border Background="White" />
</DockPanel>

<!-- Left first: the sidebar goes the full height, the header sits beside it -->
<DockPanel>
    <Border DockPanel.Dock="Left" Width="100" Background="AliceBlue" />
    <Border DockPanel.Dock="Top" Height="40" Background="SteelBlue" />
    <Border Background="White" />
</DockPanel>
```

Try both and compare. In the first, the header is wider. In the second, the sidebar is taller. If a child has no `DockPanel.Dock`, it docks `Left`.

## Choosing the right panel

| You want | Use |
| --- | --- |
| A few items in a line, no scrolling | `StackPanel` |
| Items that flow onto new lines | `WrapPanel` |
| Bars along the edges and a big middle area | `DockPanel` |
| Rows and columns that line up, or anything that resizes in shares | `Grid` |
| Exact x and y positions | `Canvas` (next lesson) |

You can always nest them. A `DockPanel` for the window shell, with a horizontal `StackPanel` of buttons docked at the top and a `Grid` in the middle, is very common.

## Adding children from code

Every panel has a `Children` collection. You can add elements to it from code-behind. This is handy when the number of items is not known until the app runs:

```csharp
private void AddTagButton_Click(object sender, RoutedEventArgs e)
{
    var tag = new Button
    {
        Content = TagNameBox.Text,
        Margin = new Thickness(4),
        Padding = new Thickness(12, 4, 12, 4)
    };
    TagPanel.Children.Add(tag);   // TagPanel is a WrapPanel with x:Name="TagPanel"
}
```

`Thickness` is the C# type behind `Margin` and `Padding`. `new Thickness(4)` means 4 on every side, and the four number version is left, top, right, bottom, the same as in XAML.

To set an attached property such as `DockPanel.Dock` from code, use `DockPanel.SetDock(element, Dock.Top)`.

Later, in [Binding to Collections](/courses/wpf/binding-to-collections), you will let WPF create the items for you from a list of data instead of adding controls by hand.

## Common mistakes

- **A list inside a StackPanel that does not scroll.** The vertical `StackPanel` gives it infinite height. Use a `Grid` row with `*` instead.
- **Expecting StackPanel to add spacing.** It does not. Add a `Margin` to the children.
- **Forgetting LastChildFill.** The last child of a `DockPanel` grows to fill the space, which is a surprise if you wanted it to sit on an edge.
- **Putting the "fill" element first in a DockPanel.** The filling child must be last, otherwise it takes all the space and the others get nothing.
- **Deep nesting of StackPanels to fake a grid.** If items must line up in columns, use a `Grid`.

## Quick recap

- `StackPanel` places children in one line. `Orientation` chooses vertical (default) or horizontal.
- A vertical `StackPanel` offers infinite height, so lists inside it never scroll.
- `WrapPanel` flows children onto new lines when space runs out. `ItemWidth` and `ItemHeight` give equal slots.
- `DockPanel` docks children to edges with `DockPanel.Dock`. The last child fills the rest unless `LastChildFill="False"`.
- In a `DockPanel`, the order of children decides who gets the corners.
- Every panel has a `Children` collection you can add to from code-behind.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Width="640" Height="420" MinWidth="420" MinHeight="300"&gt;
    &lt;!-- DockPanel: header on top, status bar at the bottom, sidebar on the left, content fills the rest --&gt;
    &lt;DockPanel&gt;
        &lt;!-- 1. Header. Docked first, so it spans the full width. --&gt;
        &lt;Border DockPanel.Dock="Top" Background="SteelBlue" Padding="12,8"&gt;
            &lt;!-- Inner DockPanel: title on the left, buttons on the right, gap in between --&gt;
            &lt;DockPanel LastChildFill="False"&gt;
                &lt;TextBlock DockPanel.Dock="Left" Text="CoinJar" Foreground="White" FontSize="18" VerticalAlignment="Center" /&gt;
                &lt;StackPanel DockPanel.Dock="Right" Orientation="Horizontal"&gt;
                    &lt;Button Content="Clear tags" Padding="12,4" Margin="0,0,8,0" Click="ClearTagsButton_Click" /&gt;
                    &lt;Button Content="About" Padding="12,4" Click="AboutButton_Click" /&gt;
                &lt;/StackPanel&gt;
            &lt;/DockPanel&gt;
        &lt;/Border&gt;
        &lt;!-- 2. Status bar at the bottom --&gt;
        &lt;Border DockPanel.Dock="Bottom" Background="WhiteSmoke" Padding="12,4"&gt;
            &lt;TextBlock x:Name="StatusText" Text="Ready" /&gt;
        &lt;/Border&gt;
        &lt;!-- 3. Sidebar on the left: a vertical StackPanel of category buttons --&gt;
        &lt;Border DockPanel.Dock="Left" Background="AliceBlue" Width="140" Padding="8"&gt;
            &lt;StackPanel&gt;
                &lt;TextBlock Text="Categories" FontWeight="SemiBold" Margin="0,0,0,8" /&gt;
                &lt;Button Content="Food" Margin="0,0,0,4" Click="CategoryButton_Click" /&gt;
                &lt;Button Content="Transport" Margin="0,0,0,4" Click="CategoryButton_Click" /&gt;
                &lt;Button Content="Bills" Margin="0,0,0,4" Click="CategoryButton_Click" /&gt;
                &lt;Button Content="Fun" Margin="0,0,0,4" Click="CategoryButton_Click" /&gt;
                &lt;Button Content="Other" Click="CategoryButton_Click" /&gt;
            &lt;/StackPanel&gt;
        &lt;/Border&gt;
        &lt;!-- 4. Last child: fills the remaining space --&gt;
        &lt;StackPanel Margin="12"&gt;
            &lt;TextBlock Text="Tags for this expense" FontWeight="SemiBold" /&gt;
            &lt;!-- A horizontal StackPanel: text box and button side by side --&gt;
            &lt;StackPanel Orientation="Horizontal" Margin="0,8,0,8"&gt;
                &lt;TextBox x:Name="TagNameBox" Width="160" Padding="4" Margin="0,0,8,0" /&gt;
                &lt;Button Content="Add tag" Padding="12,4" IsDefault="True" Click="AddTagButton_Click" /&gt;
            &lt;/StackPanel&gt;
            &lt;!-- WrapPanel: tags flow onto new lines when the window is narrow --&gt;
            &lt;WrapPanel x:Name="TagPanel" /&gt;
        &lt;/StackPanel&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
    private void CategoryButton_Click(object sender, RoutedEventArgs e)
    {
        // All five buttons share this handler. sender is the button that was clicked.
        var button = (Button)sender;
        StatusText.Text = $"Category: {button.Content}";
    }
    private void AddTagButton_Click(object sender, RoutedEventArgs e)
    {
        string name = TagNameBox.Text.Trim();
        if (name.Length == 0)
        {
            StatusText.Text = "Type a tag name first.";
            return;
        }
        // Create a new Button in code and add it to the WrapPanel's Children.
        var tag = new Button
        {
            Content = name,
            Margin = new Thickness(0, 0, 6, 6),
            Padding = new Thickness(12, 4, 12, 4)
        };
        tag.Click += (s, args) =&gt; TagPanel.Children.Remove(tag); // click a tag to remove it
        TagPanel.Children.Add(tag);
        TagNameBox.Clear();
        StatusText.Text = $"{TagPanel.Children.Count} tag(s). Click a tag to remove it.";
    }
    private void ClearTagsButton_Click(object sender, RoutedEventArgs e)
    {
        TagPanel.Children.Clear();
        StatusText.Text = "All tags removed.";
    }
    private void AboutButton_Click(object sender, RoutedEventArgs e)
    {
        MessageBox.Show("CoinJar layout demo: DockPanel, StackPanel and WrapPanel.", "About");
    }
}
</code></pre>
