---
publishDate: 2026-10-25T20:59
title: 'Performance and UI Virtualization'
slug: performance-and-virtualization
metadescription: 'Keep CoinJar fast with 100,000 expenses: measure first, understand UI virtualization, avoid the layouts that break it, load data in bulk, and make templates, bindings and brushes cheaper.'
updateDate: 2026-10-25T20:59
author: ['bishal-biswas']
level: 4
tags: ['wpf', 'performance', 'virtualization', 'datagrid']
course: wpf
---

## When is an app slow?

With twenty expenses, CoinJar is instant whatever you do. Import ten years of bank statements, and suddenly the window takes five seconds to open, scrolling stutters and typing in the filter box lags.

For a desktop app, "slow" usually means one of three things:

- **Startup**: the time until the window appears.
- **Responsiveness**: the UI freezes because the UI thread is busy.
- **Smoothness**: scrolling and resizing are jerky because WPF has too many elements to lay out and draw.

This lesson is about all three, with a strong focus on lists, because lists are where most WPF apps get slow.

## Rule one: measure first

Never guess. Developers are famously bad at guessing where time goes. Measure before and after every change.

The simplest tool is `Stopwatch`:

```csharp
var watch = Stopwatch.StartNew();
Expenses = new ObservableCollection<Expense>(items);
Timing = $"Shown in {watch.ElapsedMilliseconds} ms";
```

For a deeper look, Visual Studio has more:

- **Debug > Performance Profiler** (Alt+F2) records CPU usage and shows which methods take the time. Run it on a **Release** build; Debug builds are slower and mislead you.
- **Live Visual Tree** (while debugging) shows every element in the window and how many there are. If one list row has 40 elements and 1,000 rows exist, that is 40,000 elements.

The code panel has a window that loads 100,000 expenses two ways and prints the timings. Try it on your machine.

## What UI virtualization is

Imagine a `ListBox` with 100,000 expenses. Each row is a `ListBoxItem` with a template inside: a `Grid`, a few `TextBlock`s, maybe a `Border`. Creating, measuring and drawing millions of elements would take ages and a lot of memory.

But the window only shows about 20 rows at a time. **UI virtualization** means WPF only creates the rows that are visible (plus a few extra). When you scroll, rows that leave the screen are thrown away and new ones are created for the rows that appear. The data is all there; only the visuals are virtual.

The panel that does this is the `VirtualizingStackPanel`. These controls use it by default:

| Control | Virtualizes by default? |
| --- | --- |
| `ListBox`, `ListView` | Yes |
| `DataGrid` | Yes (rows) |
| `TreeView` | No, turn it on with `VirtualizingPanel.IsVirtualizing="True"` |
| `ItemsControl` | No: its panel is a plain `StackPanel` |

### Recycling

By default, rows that scroll away are destroyed and new ones are created. **Recycling** reuses the old row containers instead and just gives them a new `DataContext`. It is faster and creates less garbage:

```xml
<ListBox ItemsSource="{Binding Expenses}"
         VirtualizingPanel.IsVirtualizing="True"
         VirtualizingPanel.VirtualizationMode="Recycling" />
```

Recycling has one catch: if you change something on a row container in code (say, a colour), that change travels with the container to a different item. Keep per item state in the item or a binding, never on the container.

### Scrolling options

- `VirtualizingPanel.ScrollUnit="Pixel"` scrolls smoothly by pixels. The default, `Item`, jumps a whole row at a time, which is a bit faster but feels jumpy with tall rows.
- `VirtualizingPanel.CacheLength` controls how many extra rows are prepared above and below the visible ones.
- `ScrollViewer.IsDeferredScrollingEnabled="True"` only updates the content when the user releases the scroll bar thumb. Useful when rows are very expensive.

## What breaks virtualization

Virtualization silently turns off in some layouts. The list still works, just slowly. These are the usual suspects.

### A list with unlimited height

A virtualizing panel needs to know how tall it is, so it can work out which rows fit. Inside a `StackPanel` (vertical) or a `ScrollViewer`, a list is offered infinite height. It then makes itself tall enough for all 100,000 rows and creates every single one.

```xml
<!-- Slow: the ScrollViewer gives the ListBox unlimited height -->
<ScrollViewer>
    <ListBox ItemsSource="{Binding Expenses}" />
</ScrollViewer>

<!-- Fast: the Grid row limits the height, and the ListBox scrolls itself -->
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition Height="Auto" />
        <RowDefinition Height="*" />
    </Grid.RowDefinitions>
    <TextBlock Text="Expenses" />
    <ListBox Grid.Row="1" ItemsSource="{Binding Expenses}" />
</Grid>
```

Put lists in a `Grid` row with `Height="*"` or as the last child of a `DockPanel`, as in [The Grid Panel](/courses/wpf/the-grid-panel) and [StackPanel, WrapPanel and DockPanel](/courses/wpf/stackpanel-wrappanel-and-dockpanel).

### ItemsControl in a ScrollViewer

The pattern from [User Controls](/courses/wpf/user-controls), an `ItemsControl` of `ExpenseCard`s inside a `ScrollViewer`, is perfect for a few dozen cards and terrible for thousands. Either switch to a `ListBox` (the final app does this), or give the `ItemsControl` a virtualizing panel and its own scroll viewer:

```xml
<ItemsControl ItemsSource="{Binding Expenses}"
              VirtualizingPanel.IsVirtualizing="True"
              VirtualizingPanel.VirtualizationMode="Recycling"
              ScrollViewer.CanContentScroll="True">
    <ItemsControl.ItemsPanel>
        <ItemsPanelTemplate>
            <VirtualizingStackPanel />
        </ItemsPanelTemplate>
    </ItemsControl.ItemsPanel>
    <ItemsControl.Template>
        <ControlTemplate TargetType="ItemsControl">
            <ScrollViewer CanContentScroll="True" Focusable="False">
                <ItemsPresenter />
            </ScrollViewer>
        </ControlTemplate>
    </ItemsControl.Template>
</ItemsControl>
```

`ScrollViewer.CanContentScroll="True"` is required: it lets the panel scroll by items instead of the scroll viewer scrolling pixels over a fully built list. Setting it to `False` anywhere turns virtualization off. [Control Templates](/courses/wpf/control-templates) explains the `Template` part.

### Grouping

Grouping with a `CollectionViewSource`, as in [Sorting, Filtering and Grouping](/courses/wpf/sorting-filtering-and-grouping), turns virtualization off unless you ask for it:

```xml
<ListBox ItemsSource="{Binding Source={StaticResource GroupedExpenses}}"
         VirtualizingPanel.IsVirtualizingWhenGrouping="True" />
```

### UI elements as items

If the items in your collection are themselves controls (a list of `Button`s created in code), there is nothing to virtualize: they already exist. Bind to data objects and let a data template create the visuals.

## The DataGrid

The `DataGrid` from [The DataGrid Control](/courses/wpf/the-datagrid-control) virtualizes rows by default. With many columns, turn on column virtualization too:

```xml
<DataGrid ItemsSource="{Binding Expenses}"
          AutoGenerateColumns="False" IsReadOnly="True"
          EnableRowVirtualization="True"
          EnableColumnVirtualization="True"
          VirtualizingPanel.VirtualizationMode="Recycling" />
```

Other `DataGrid` tips:

- Set `AutoGenerateColumns="False"` and define columns yourself. Auto generation uses reflection and may create columns you do not need.
- Use fixed or star widths. `Width="Auto"` columns measure many cells to find the widest one.
- `IsReadOnly="True"` when users do not edit in the grid.

## Loading lots of data

Virtualization fixes the drawing. Loading data has its own traps.

### Do not add 100,000 items one by one

Every `Add` to an `ObservableCollection` raises `CollectionChanged`, and the list reacts to each one. If you also recompute the total on every change, that is 100,000 sums over a growing list.

```csharp
// Slow: 100,000 change notifications
foreach (Expense e in items)
    Expenses.Add(e);
```

Build a normal `List<T>` first, then hand it over in one step by replacing the whole collection:

```csharp
[ObservableProperty]
public partial ObservableCollection<Expense> Expenses { get; set; } = [];

// Fast: one PropertyChanged, the list rebinds once
Expenses = new ObservableCollection<Expense>(items);
Total = items.Sum(e => e.Amount);
```

Because `Expenses` is now an `[ObservableProperty]`, the binding notices the new collection. Compute totals once at the end, not per item.

### Keep the UI thread free

Building or loading data can take seconds. Do it on a background thread with `Task.Run` and `await`, so the window stays responsive and can show a progress bar. Then create the collection back on the UI thread, which is where `await` returns you. This is the pattern from [Async, Await and a Responsive UI](/courses/wpf/async-await-and-a-responsive-ui) and [The Dispatcher and Threading](/courses/wpf/the-dispatcher-and-threading):

```csharp
[RelayCommand]
private async Task LoadManyAsync()
{
    IsBusy = true;
    List<Expense> items = await Task.Run(() => CreateSampleData(100_000)); // background
    Expenses = new ObservableCollection<Expense>(items);                  // UI thread
    IsBusy = false;
}
```

For a real database, let EF Core do the work asynchronously (`ToListAsync`), and only load what you show. A list of this year's expenses is faster than all of them, filtered in memory. [LINQ](/courses/c-sharp/linq-fundamentals) queries against the database run in SQLite, not in your app.

## Cheaper templates and bindings

Each visible row runs its template. Small savings per row add up.

- **Fewer elements.** A row built from one `Grid` with three `TextBlock`s is far cheaper than nested `StackPanel`s, `Border`s and a `UserControl` per cell. Check the element count in Live Visual Tree.
- **OneTime bindings for values that never change.** `{Binding Title, Mode=OneTime}` skips listening for changes. It still updates when the row is recycled to a new item.
- **No binding errors.** A failing binding writes a "System.Windows.Data Error" line to the Output window every time it is evaluated. Thousands of those cost real time. Fix them all.
- **Avoid heavy effects.** A `DropShadowEffect` or `BlurEffect` on every row makes scrolling much slower. Use them on a few big elements, not in item templates (see [Brushes, Shapes and Effects](/courses/wpf/brushes-shapes-and-effects)).
- **Converters should be fast.** They run for every row on every update. No file access or database calls inside a converter.

### Freeze your brushes

Brushes, pens and geometries are **freezables**: objects that can be made read only by freezing them. A frozen object cannot change, so WPF stops watching it for changes and can share it between threads. In code:

```csharp
var brush = new SolidColorBrush(Colors.SeaGreen);
brush.Freeze();
```

In XAML, use the presentation options namespace:

```xml
<Window xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        xmlns:po="http://schemas.microsoft.com/winfx/2006/xaml/presentation/options"
        mc:Ignorable="po">
    <Window.Resources>
        <SolidColorBrush x:Key="AmountBrush" Color="SeaGreen" po:Freeze="True" />
    </Window.Resources>
</Window>
```

### Decode images at the size you show

A 4000 by 3000 pixel photo shown as a 64 pixel thumbnail is still decoded at full size, which takes about 48 MB of memory. Ask for a smaller decode with `DecodePixelWidth`. A value converter that turns a file path into a thumbnail is a good place for it:

```csharp
public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
{
    if (value is not string path || !File.Exists(path)) return null!;
    var image = new BitmapImage();
    image.BeginInit();
    image.UriSource = new Uri(path);
    image.DecodePixelWidth = 64;                // decode small, not full size
    image.CacheOption = BitmapCacheOption.OnLoad; // read the file now, then release it
    image.EndInit();
    image.Freeze();                             // frozen: cheaper, and safe to share
    return image;
}
```

Images in general were covered in [Images, Icons and Media](/courses/wpf/images-and-media).

## Faster startup

- **Do less in constructors.** Load data after the window is shown, asynchronously, not in the `MainWindow` or view model constructor.
- **Register services lazily.** The host only creates a singleton when something first asks for it. Avoid resolving everything at startup.
- **ReadyToRun.** Publishing with ReadyToRun compiles your code ahead of time so less work happens at startup. You will see how in [Publishing and Packaging WPF Apps](/courses/wpf/publishing-and-packaging-wpf-apps).

## Common mistakes

- **Optimising without measuring.** You speed up the wrong thing and make the code harder to read.
- **Measuring a Debug build.** Always compare Release builds.
- **A ListBox in a ScrollViewer or StackPanel.** Every row is created. Give lists a limited height.
- **`ScrollViewer.CanContentScroll="False"`.** Smooth pixel scrolling the old way, and virtualization is off. Use `VirtualizingPanel.ScrollUnit="Pixel"` instead.
- **Grouping without `IsVirtualizingWhenGrouping`.** The list gets slow the moment you group.
- **Adding items one at a time in a loop.** Replace the collection in one step.
- **Heavy work on the UI thread.** Use `Task.Run` and `await` for anything slow.

## Quick recap

- Measure with `Stopwatch` and the Visual Studio profiler, on Release builds.
- UI virtualization creates rows only for what is visible. `ListBox`, `ListView` and `DataGrid` do it by default, `ItemsControl` and `TreeView` need help.
- Use `VirtualizationMode="Recycling"` and `ScrollUnit="Pixel"` for fast, smooth lists.
- Lists need a limited height. Infinite height, `CanContentScroll="False"` and grouping without `IsVirtualizingWhenGrouping` break virtualization.
- Load data off the UI thread and swap in a whole new collection.
- Keep templates small, fix binding errors, freeze brushes and decode images at display size.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        xmlns:po="http://schemas.microsoft.com/winfx/2006/xaml/presentation/options"
        mc:Ignorable="po"
        Title="CoinJar: 100,000 expenses" Width="760" Height="520"&gt;
    &lt;Window.Resources&gt;
        &lt;!-- po:Freeze makes the brush read only: WPF stops watching it for changes --&gt;
        &lt;SolidColorBrush x:Key="AmountBrush" Color="SeaGreen" po:Freeze="True" /&gt;
    &lt;/Window.Resources&gt;
    &lt;DockPanel Margin="12"&gt;
        &lt;StackPanel DockPanel.Dock="Top" Orientation="Horizontal" Margin="0,0,0,8"&gt;
            &lt;Button Content="Load 100,000 (fast)" Command="{Binding LoadManyCommand}" Margin="0,0,8,0" /&gt;
            &lt;Button Content="Load one by one (slow)" Command="{Binding LoadOneByOneCommand}" Margin="0,0,16,0" /&gt;
            &lt;TextBlock Text="{Binding Timing}" VerticalAlignment="Center" /&gt;
        &lt;/StackPanel&gt;
        &lt;TextBlock DockPanel.Dock="Bottom" Margin="0,8,0,0" FontWeight="Bold"
                   Text="{Binding Total, StringFormat=Total: {0:C}}" /&gt;
        &lt;!-- Virtualization: only the visible rows exist as real controls.
             The DataGrid fills the rest of the DockPanel, so its height is limited
             and it scrolls itself. Never put it inside a StackPanel or ScrollViewer. --&gt;
        &lt;DataGrid ItemsSource="{Binding Expenses}"
                  AutoGenerateColumns="False" IsReadOnly="True"
                  EnableRowVirtualization="True"
                  EnableColumnVirtualization="True"
                  VirtualizingPanel.IsVirtualizing="True"
                  VirtualizingPanel.VirtualizationMode="Recycling"
                  VirtualizingPanel.ScrollUnit="Pixel"
                  ScrollViewer.IsDeferredScrollingEnabled="False"&gt; &lt;!-- True: redraw only when the thumb is released --&gt;
            &lt;DataGrid.Columns&gt;
                &lt;DataGridTextColumn Header="Date" Binding="{Binding Date, StringFormat=d, Mode=OneTime}" Width="110" /&gt;
                &lt;DataGridTextColumn Header="Title" Binding="{Binding Title, Mode=OneTime}" Width="*" /&gt;
                &lt;DataGridTextColumn Header="Category" Binding="{Binding Category, Mode=OneTime}" Width="110" /&gt;
                &lt;DataGridTextColumn Header="Amount" Binding="{Binding Amount, StringFormat=C, Mode=OneTime}" Width="110"&gt;
                    &lt;DataGridTextColumn.ElementStyle&gt;
                        &lt;Style TargetType="TextBlock"&gt;
                            &lt;Setter Property="Foreground" Value="{StaticResource AmountBrush}" /&gt;
                            &lt;Setter Property="HorizontalAlignment" Value="Right" /&gt;
                        &lt;/Style&gt;
                    &lt;/DataGridTextColumn.ElementStyle&gt;
                &lt;/DataGridTextColumn&gt;
            &lt;/DataGrid.Columns&gt;
        &lt;/DataGrid&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using CoinJar.ViewModels;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new ExpenseListViewModel();
    }
}
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using System.Diagnostics;
using CoinJar.Models;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
namespace CoinJar.ViewModels;
public partial class ExpenseListViewModel : ObservableObject
{
    private static readonly string[] Categories = ["Food", "Transport", "Bills", "Fun", "Other"];
    // Replaced as a whole when a big batch arrives: one notification instead of 100,000.
    [ObservableProperty]
    public partial ObservableCollection&lt;Expense&gt; Expenses { get; set; } = [];
    [ObservableProperty]
    public partial decimal Total { get; set; }
    [ObservableProperty]
    public partial string Timing { get; set; } = "";
    [ObservableProperty]
    public partial bool IsBusy { get; set; }
    [RelayCommand]
    private async Task LoadManyAsync()
    {
        IsBusy = true;
        var watch = Stopwatch.StartNew();
        // 1. Build the data off the UI thread, so the window stays responsive.
        List&lt;Expense&gt; items = await Task.Run(() =&gt; CreateSampleData(100_000));
        long built = watch.ElapsedMilliseconds;
        // 2. Hand the finished list to the UI in one go.
        Expenses = new ObservableCollection&lt;Expense&gt;(items);
        Total = items.Sum(e =&gt; e.Amount); // computed once, not on every change
        Timing = $"Built in {built} ms, shown in {watch.ElapsedMilliseconds - built} ms";
        IsBusy = false;
    }
    // The slow way, for comparison: every Add raises CollectionChanged.
    [RelayCommand]
    private void LoadOneByOne()
    {
        var watch = Stopwatch.StartNew();
        Expenses = [];
        foreach (Expense e in CreateSampleData(100_000)) Expenses.Add(e);
        Total = Expenses.Sum(e =&gt; e.Amount);
        Timing = $"Added one by one in {watch.ElapsedMilliseconds} ms";
    }
    private static List&lt;Expense&gt; CreateSampleData(int count)
    {
        var random = new Random(42);
        var list = new List&lt;Expense&gt;(count);
        for (int i = 1; i &lt;= count; i++)
        {
            list.Add(new Expense
            {
                Id = i,
                Title = $"Expense {i}",
                Amount = Math.Round((decimal)(random.NextDouble() * 100), 2),
                Category = Categories[random.Next(Categories.Length)],
                Date = DateTime.Today.AddDays(-random.Next(365))
            });
        }
        return list;
    }
}
</code></pre>

