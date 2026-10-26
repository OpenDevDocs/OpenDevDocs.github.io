---
publishDate: 2026-10-25T20:14
title: 'Building Resizable Layouts'
slug: building-resizable-layouts
metadescription: 'Put the layout panels together into a window that resizes well: star sizing, minimum sizes, GridSplitter, Visibility, and changing the layout from code when the window gets narrow.'
updateDate: 2026-10-25T20:14
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'layout', 'gridsplitter', 'responsive']
course: wpf
---

## What a good resizable layout looks like

Users resize windows all the time. They maximise them on a big monitor, snap them to half the screen, or shrink them to sit beside another app. A good WPF window handles all of these without anything overlapping, getting cut off, or leaving a sea of empty space.

You already know the pieces: sizes and alignment from [Layout Basics](/courses/wpf/layout-basics-size-margin-and-alignment), the [Grid](/courses/wpf/the-grid-panel), the [StackPanel, WrapPanel and DockPanel](/courses/wpf/stackpanel-wrappanel-and-dockpanel) and [ScrollViewer](/courses/wpf/scrollviewer-and-viewbox). This lesson is about putting them together. You will build the main window shell of CoinJar: a category sidebar, a list area and a details area that the user can resize by dragging.

A resizable layout follows a few simple rules:

1. **Decide what grows.** Usually one main area gets all the extra space. Everything else stays at its natural size.
2. **Set limits.** Use minimum sizes so nothing gets squashed into uselessness.
3. **Let long content scroll or trim**, instead of pushing everything else off the screen.
4. **Adapt when space is very tight**, for example by hiding a sidebar.

## Rule 1: decide what grows

In a `Grid`, the rows and columns sized with `Auto` or a fixed number stay the same, and the star (`*`) ones share the extra space. So the question "what grows?" becomes "which rows and columns are star sized?".

```xml
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition Height="Auto" />  <!-- toolbar: fixed by its content -->
        <RowDefinition Height="*" />     <!-- content: gets all extra height -->
        <RowDefinition Height="Auto" />  <!-- status bar: fixed by its content -->
    </Grid.RowDefinitions>
    <Grid.ColumnDefinitions>
        <ColumnDefinition Width="180" /> <!-- sidebar: fixed width -->
        <ColumnDefinition Width="2*" />  <!-- list: two thirds of the extra width -->
        <ColumnDefinition Width="*" />   <!-- details: one third of the extra width -->
    </Grid.ColumnDefinitions>
</Grid>
```

When the window doubles in width, the sidebar stays 180 wide and the two content columns get wider, keeping a 2 to 1 ratio. That is usually exactly what you want.

## Rule 2: set limits

Without limits, a user can drag the window down to a tiny size and everything collapses into a mess. Set limits in two places.

**On the window**, so it cannot get too small:

```xml
<Window ... Width="900" Height="560" MinWidth="480" MinHeight="360"
        WindowStartupLocation="CenterScreen">
```

`WindowStartupLocation="CenterScreen"` opens the window in the middle of the screen instead of wherever Windows decides.

**On the rows and columns**, so one area cannot squeeze another out:

```xml
<ColumnDefinition Width="2*" MinWidth="220" />
<ColumnDefinition Width="*" MinWidth="160" MaxWidth="400" />
```

`MaxWidth` on the details column stops it from becoming a huge empty area on a very wide monitor.

### ResizeMode

The window's `ResizeMode` decides whether the user can resize it at all:

| Value | Meaning |
| --- | --- |
| `CanResize` (default) | Normal resizable window with minimise and maximise buttons. |
| `CanResizeWithGrip` | Same, plus a small grip in the bottom right corner. |
| `CanMinimize` | Can be minimised, but not resized or maximised. |
| `NoResize` | Fixed size. Good for small dialogs. |

Main windows should almost always stay resizable. Small dialogs often use `NoResize` with `SizeToContent="WidthAndHeight"`.

## Rule 3: let long content scroll or trim

When text is longer than the space, you have three choices:

- **Wrap** it onto more lines: `TextWrapping="Wrap"`.
- **Trim** it with an ellipsis (...): `TextTrimming="CharacterEllipsis"`.
- **Scroll** it, by putting it in a `ScrollViewer` (or a list, which scrolls by itself).

```xml
<!-- A title that never pushes the layout wider. "Very long expense na..." -->
<TextBlock x:Name="DetailTitle" FontSize="18" TextTrimming="CharacterEllipsis" />
```

Trimming only works when the `TextBlock` has a limited width, for example inside a star column. In an `Auto` column it would just grow instead.

A `ToolTip` with the full text is a friendly extra when you trim: `ToolTip="{Binding Text, RelativeSource={RelativeSource Self}}"` shows the whole title on hover. (Bindings are explained in [Data Binding Basics](/courses/wpf/data-binding-basics), so do not worry about the syntax yet.)

## GridSplitter: let the user decide

A `GridSplitter` is a thin bar that the user can drag to resize the rows or columns next to it. It lives in the `Grid` like any other child.

The clearest way is to give the splitter **its own column**:

```xml
<Grid>
    <Grid.ColumnDefinitions>
        <ColumnDefinition Width="180" MinWidth="120" />
        <ColumnDefinition Width="Auto" />              <!-- the splitter's column -->
        <ColumnDefinition Width="*" MinWidth="200" />
    </Grid.ColumnDefinitions>

    <Border Grid.Column="0" Background="AliceBlue" />

    <GridSplitter Grid.Column="1" Width="5"
                  HorizontalAlignment="Stretch" ResizeDirection="Columns"
                  Background="LightGray" />

    <Border Grid.Column="2" Background="White" />
</Grid>
```

Drag the gray bar and the sidebar gets wider or narrower. The `MinWidth` values on the columns stop the user dragging either side too far.

Key properties:

- `Width` (or `Height` for a horizontal splitter) sets how thick the bar is. 4 to 6 DIPs is comfortable to grab.
- `ResizeDirection="Columns"` (or `Rows`) says which way it resizes. It can work this out from the alignment, but being explicit avoids surprises.
- `ShowsPreview="True"` shows a preview line while dragging and only resizes when the mouse is released. This is nicer when the content is slow to redraw.

A splitter between **rows** works the same way: put it in an `Auto` row, set `Height="5"`, `HorizontalAlignment="Stretch"` and `ResizeDirection="Rows"`.

## Rule 4: adapt when space is tight

Sometimes the best answer for a narrow window is a different layout. For example, hide the sidebar when the window is less than 640 DIPs wide. You can do this from code-behind with the window's `SizeChanged` event.

### Visibility

Every element has a `Visibility` property with three values:

- `Visible`: shown normally.
- `Hidden`: invisible, but **still takes up its space** in the layout.
- `Collapsed`: invisible **and takes no space**, as if it was removed.

To make room, you nearly always want `Collapsed`.

### Reacting to SizeChanged

```csharp
private void Window_SizeChanged(object sender, SizeChangedEventArgs e)
{
    bool narrow = e.NewSize.Width < 640;

    Sidebar.Visibility = narrow ? Visibility.Collapsed : Visibility.Visible;
    SidebarSplitter.Visibility = Sidebar.Visibility;

    // A collapsed child still leaves its column behind, so shrink the column too.
    SidebarColumn.Width = narrow ? new GridLength(0) : new GridLength(_sidebarWidth);
}
```

`e.NewSize` is the new size of the window. Note the last line: collapsing the content does not remove a column with a fixed width, so the column itself is set to 0. A `ColumnDefinition` can have an `x:Name` just like a control, which is how the code reaches `SidebarColumn`.

`GridLength` is the C# type behind row heights and column widths. `new GridLength(180)` is a fixed size, `GridLength.Auto` is `Auto` and `new GridLength(2, GridUnitType.Star)` is `2*`.

Later you will learn tidier ways to switch layouts in XAML with [triggers](/courses/wpf/triggers) and [styles](/courses/wpf/styles-and-setters), but the code-behind version is easy to understand and works well.

## Testing your layout

Before you call a layout finished, try these:

- Drag the window to its minimum size. Is everything still usable?
- Maximise it on the biggest screen you have. Is the extra space going somewhere useful?
- Snap it to half the screen with Windows key + Left arrow.
- Change Windows display scaling to 150% (Settings, System, Display). WPF scales everything for you, but check that nothing looks cramped.
- Put very long text in every field. A title of 80 characters should trim or wrap, not break the layout.

## Common mistakes

- **No minimum sizes.** The window shrinks to a few pixels wide and the layout turns to soup. Always set `MinWidth` and `MinHeight` on the window.
- **Everything star sized.** If the toolbar row is `*`, it grows when the window gets taller. Use `Auto` for bars and headers.
- **A GridSplitter that does nothing.** Usually it is missing `HorizontalAlignment="Stretch"` (for columns) or it is in the same column as other content and covered by it. Give it its own `Auto` column.
- **Using `Hidden` instead of `Collapsed`.** The element disappears, but its space stays.
- **Fixed widths on text.** Text in another language, or with larger fonts, will not fit. Let text size itself and set limits on the containers instead.

## Quick recap

- Decide what grows: star rows and columns take the extra space, `Auto` and fixed ones stay put.
- Set `MinWidth` and `MinHeight` on the window, and `MinWidth` and `MaxWidth` on columns.
- `ResizeMode` controls whether a window can be resized. Keep main windows resizable.
- Long text should wrap, trim (`TextTrimming="CharacterEllipsis"`) or scroll.
- `GridSplitter` in its own `Auto` column lets users drag to resize. Set `ResizeDirection` explicitly.
- `Visibility="Collapsed"` removes an element from the layout. `Hidden` keeps its space.
- The `SizeChanged` event lets code-behind switch the layout when the window is narrow.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Width="900" Height="560" MinWidth="480" MinHeight="360"
        WindowStartupLocation="CenterScreen" SizeChanged="Window_SizeChanged"&gt;
    &lt;Grid&gt;
        &lt;Grid.RowDefinitions&gt;
            &lt;RowDefinition Height="Auto" /&gt;   &lt;!-- toolbar --&gt;
            &lt;RowDefinition Height="*" /&gt;      &lt;!-- main area: all extra height --&gt;
            &lt;RowDefinition Height="Auto" /&gt;   &lt;!-- status bar --&gt;
        &lt;/Grid.RowDefinitions&gt;
        &lt;!-- Toolbar --&gt;
        &lt;Border Grid.Row="0" Background="SteelBlue" Padding="12,8"&gt;
            &lt;DockPanel LastChildFill="False"&gt;
                &lt;TextBlock DockPanel.Dock="Left" Text="CoinJar" Foreground="White" FontSize="18" VerticalAlignment="Center" /&gt;
                &lt;Button DockPanel.Dock="Right" Content="Toggle sidebar" Padding="12,4" Click="ToggleSidebar_Click" /&gt;
            &lt;/DockPanel&gt;
        &lt;/Border&gt;
        &lt;!-- Main area: sidebar | splitter | list | splitter | details --&gt;
        &lt;Grid Grid.Row="1"&gt;
            &lt;Grid.ColumnDefinitions&gt;
                &lt;ColumnDefinition x:Name="SidebarColumn" Width="180" MinWidth="0" /&gt;
                &lt;ColumnDefinition Width="Auto" /&gt;
                &lt;ColumnDefinition Width="2*" MinWidth="220" /&gt;
                &lt;ColumnDefinition Width="Auto" /&gt;
                &lt;ColumnDefinition Width="*" MinWidth="160" MaxWidth="400" /&gt;
            &lt;/Grid.ColumnDefinitions&gt;
            &lt;!-- Sidebar --&gt;
            &lt;Border x:Name="Sidebar" Grid.Column="0" Background="AliceBlue" Padding="8"&gt;
                &lt;StackPanel&gt;
                    &lt;TextBlock Text="Categories" FontWeight="SemiBold" Margin="0,0,0,8" /&gt;
                    &lt;Button Content="All" Margin="0,0,0,4" Click="Category_Click" /&gt;
                    &lt;Button Content="Food" Margin="0,0,0,4" Click="Category_Click" /&gt;
                    &lt;Button Content="Transport" Margin="0,0,0,4" Click="Category_Click" /&gt;
                    &lt;Button Content="Bills" Margin="0,0,0,4" Click="Category_Click" /&gt;
                    &lt;Button Content="Fun" Margin="0,0,0,4" Click="Category_Click" /&gt;
                    &lt;Button Content="Other" Click="Category_Click" /&gt;
                &lt;/StackPanel&gt;
            &lt;/Border&gt;
            &lt;!-- Splitter 1: in its own Auto column, resizes the sidebar --&gt;
            &lt;GridSplitter x:Name="SidebarSplitter" Grid.Column="1" Width="5" HorizontalAlignment="Stretch"
                          ResizeDirection="Columns" Background="LightGray"
                          DragCompleted="SidebarSplitter_DragCompleted" /&gt;
            &lt;!-- List area. A ListBox scrolls by itself. --&gt;
            &lt;DockPanel Grid.Column="2" Margin="8"&gt;
                &lt;TextBlock DockPanel.Dock="Top" x:Name="ListTitle" Text="All expenses" FontSize="16" Margin="0,0,0,6" /&gt;
                &lt;ListBox x:Name="ExpenseList" SelectionChanged="ExpenseList_SelectionChanged"
                         ScrollViewer.HorizontalScrollBarVisibility="Disabled" /&gt;
            &lt;/DockPanel&gt;
            &lt;!-- Splitter 2: resizes the list and details columns --&gt;
            &lt;GridSplitter Grid.Column="3" Width="5" HorizontalAlignment="Stretch"
                          ResizeDirection="Columns" Background="LightGray" /&gt;
            &lt;!-- Details area: the title trims instead of pushing the layout wider --&gt;
            &lt;StackPanel Grid.Column="4" Margin="8"&gt;
                &lt;TextBlock Text="Details" FontWeight="SemiBold" /&gt;
                &lt;TextBlock x:Name="DetailTitle" FontSize="18" Margin="0,6,0,0"
                           TextTrimming="CharacterEllipsis" Text="Select an expense" /&gt;
                &lt;TextBlock x:Name="DetailInfo" TextWrapping="Wrap" Margin="0,6,0,0" Foreground="DimGray" /&gt;
            &lt;/StackPanel&gt;
        &lt;/Grid&gt;
        &lt;!-- Status bar --&gt;
        &lt;Border Grid.Row="2" Background="WhiteSmoke" Padding="12,4"&gt;
            &lt;TextBlock x:Name="StatusText" Text="Drag the gray bars, or make the window narrow." /&gt;
        &lt;/Border&gt;
    &lt;/Grid&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
namespace CoinJar;
public partial class MainWindow : Window
{
    private const double NarrowWidth = 640;
    private double _sidebarWidth = 180;   // remembered so we can restore it
    private bool _sidebarWanted = true;   // the user's choice from the toggle button
    private readonly string[] _expenses =
    [
        "Food: Lunch with the team at the new noodle place downtown",
        "Transport: Bus pass",
        "Bills: Electricity",
        "Fun: Cinema tickets",
        "Food: Groceries",
        "Other: Birthday present for a friend"
    ];
    public MainWindow()
    {
        InitializeComponent();
        foreach (string item in _expenses)
        {
            ExpenseList.Items.Add(item);
        }
    }
    private void Window_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        UpdateSidebar(e.NewSize.Width);
    }
    private void ToggleSidebar_Click(object sender, RoutedEventArgs e)
    {
        _sidebarWanted = !_sidebarWanted;
        UpdateSidebar(ActualWidth);
    }
    private void UpdateSidebar(double windowWidth)
    {
        bool show = _sidebarWanted &amp;&amp; windowWidth &gt;= NarrowWidth;
        // Collapsed removes the element from layout. Hidden would keep its space.
        Sidebar.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
        SidebarSplitter.Visibility = Sidebar.Visibility;
        // The column has a fixed width, so shrink it to 0 as well.
        SidebarColumn.Width = show ? new GridLength(_sidebarWidth) : new GridLength(0);
        StatusText.Text = show ? "Sidebar visible" : "Sidebar hidden (narrow window or toggled off)";
    }
    private void SidebarSplitter_DragCompleted(object sender, System.Windows.Controls.Primitives.DragCompletedEventArgs e)
    {
        // Remember the width the user dragged to, so it comes back after hiding
        _sidebarWidth = Math.Max(120, SidebarColumn.ActualWidth);
    }
    private void Category_Click(object sender, RoutedEventArgs e)
    {
        string category = (string)((Button)sender).Content;
        ExpenseList.Items.Clear();
        foreach (string item in _expenses)
        {
            if (category == "All" || item.StartsWith(category + ":"))
            {
                ExpenseList.Items.Add(item);
            }
        }
        ListTitle.Text = category == "All" ? "All expenses" : $"{category} expenses";
    }
    private void ExpenseList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (ExpenseList.SelectedItem is string item)
        {
            DetailTitle.Text = item;
            DetailInfo.Text = $"Full text: {item}. Make the details column narrow to see the title trim.";
        }
    }
}
</code></pre>
