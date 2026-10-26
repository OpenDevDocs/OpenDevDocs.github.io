---
publishDate: 2026-10-25T20:55
title: 'Drag and Drop'
slug: drag-and-drop
metadescription: 'Add drag and drop to CoinJar: drop CSV files from Explorer to import expenses, drag an expense onto a category to change it, and reorder a list, while keeping the logic in the view model.'
updateDate: 2026-10-25T20:55
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'drag-and-drop', 'events', 'files']
course: wpf
---

## What drag and drop is

**Drag and drop** means picking something up with the mouse, carrying it, and letting go over a place that knows what to do with it. People expect it in desktop apps: drag a file into a window, drag a row to a new position, drag a card into a column.

Every drag has two sides:

- The **drag source**: where the drag starts (a row in a list, a file in Explorer).
- The **drop target**: where it ends (a category box, the whole window).

Between them travels a **data object**: a small parcel that holds the dragged thing, labelled with a **format** that says what kind of thing it is. The drop target reads the label and decides whether it wants the parcel.

In this lesson CoinJar gets three drag and drop features:

1. Drop a CSV file from Explorer anywhere on the window to import expenses.
2. Drag an expense onto a category box to change its category.
3. Drag a row inside the list to reorder it.

## The drop target side

Start with the easier half. Any `UIElement` can be a drop target. You switch it on with `AllowDrop="True"` and handle a few [routed events](/courses/wpf/code-behind-and-event-handlers):

| Event | When it fires | Your job |
| --- | --- | --- |
| `DragEnter` | The mouse carrying data enters the element | Show "you can drop here" |
| `DragOver` | Repeatedly while the mouse moves over it | Say which effect is allowed |
| `DragLeave` | The mouse leaves again | Undo the highlight |
| `Drop` | The user lets go | Read the data and act |

Each event also has a `Preview` twin (`PreviewDrop` and so on) that runs first, from the window down.

### Accepting files from Explorer

When you drag files out of Explorer, the data object holds a list of full paths in the format `DataFormats.FileDrop`. Here is the whole window as a target:

```xml
<Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar"
        AllowDrop="True" DragOver="Window_DragOver" Drop="Window_Drop">
    ...
</Window>
```

```csharp
private void Window_DragOver(object sender, DragEventArgs e)
{
    // Files: show the "copy" cursor. Anything else: show the "no" cursor.
    e.Effects = e.Data.GetDataPresent(DataFormats.FileDrop)
        ? DragDropEffects.Copy
        : DragDropEffects.None;
    e.Handled = true;
}

private void Window_Drop(object sender, DragEventArgs e)
{
    if (e.Data.GetData(DataFormats.FileDrop) is string[] files)
        _viewModel.ImportFiles(files);
}
```

`e.Data` is the data object. `GetDataPresent` asks "do you hold this format?" and `GetData` takes it out. `GetData` returns `object`, so the `is string[] files` [pattern](/courses/c-sharp/advanced-pattern-matching) checks and casts in one step.

`e.Effects` controls the mouse cursor. The common values are `Copy`, `Move`, `Link` and `None`. Setting `None` shows the "not allowed" cursor, and the `Drop` event will not fire.

### Keep the work in the view model

Look at what the handler does: it only unpacks the paths and calls the view model. Reading the CSV file is app logic, so it lives in `ExpenseListViewModel`, where you can test it (see [Unit Testing ViewModels](/courses/wpf/unit-testing-viewmodels)):

```csharp
// Lines look like: 2026-10-01,Food,12.50,Lunch
public void ImportFiles(IEnumerable<string> paths)
{
    int added = 0;
    foreach (string path in paths.Where(p => p.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)))
    {
        foreach (string line in File.ReadLines(path).Skip(1)) // skip the header
        {
            string[] parts = line.Split(',');
            if (parts.Length < 3) continue;
            if (!DateTime.TryParse(parts[0], CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime date)) continue;
            if (!decimal.TryParse(parts[2], NumberStyles.Number, CultureInfo.InvariantCulture, out decimal amount)) continue;
            string category = Categories.Contains(parts[1]) ? parts[1] : "Other";
            string title = parts.Length > 3 ? parts[3] : category;
            Expenses.Add(new Expense { Title = title, Amount = amount, Category = category, Date = date });
            added++;
        }
    }
    StatusText = added == 0 ? "No expenses found in the dropped files." : $"Imported {added} expenses.";
}
```

The format matches the CSV export from [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes), so a user can export, edit in a spreadsheet and drop the file back in. Numbers and dates use `InvariantCulture` because a file must read the same on every PC. File reading itself is covered in the C# lesson on [file handling](/courses/c-sharp/file-handling).

This is the general pattern for drag and drop in MVVM: **the view handles mouse events, the view model gets plain values**. Mouse positions and `DragEventArgs` stay in code-behind, which is fine because they are pure view work.

## The drag source side

To start a drag from your own control, call `DragDrop.DoDragDrop`:

```csharp
var data = new DataObject(typeof(Expense), expense);
DragDrop.DoDragDrop(row, data, DragDropEffects.Move);
```

The three arguments are the element the drag starts from, the parcel, and the effects you allow. Here the format is the `Expense` type itself. Any string works as a format too, such as `"CoinJar.Expense"`.

`DoDragDrop` does not return until the user drops or cancels (Esc cancels for free). Its return value tells you which effect happened, for example `Move` or `None`.

### When to start the drag

You cannot simply start a drag on mouse down: then a plain click to select a row would also begin a drag. The usual recipe is:

1. On mouse down, remember where the mouse was.
2. On mouse move, while the button is still down, check how far it moved.
3. Once it moved further than the system's drag distance, start the drag.

```csharp
private Point _dragStart;

private void List_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e) =>
    _dragStart = e.GetPosition(null);

private void List_PreviewMouseMove(object sender, MouseEventArgs e)
{
    if (e.LeftButton != MouseButtonState.Pressed) return;

    Vector moved = _dragStart - e.GetPosition(null);
    if (Math.Abs(moved.X) < SystemParameters.MinimumHorizontalDragDistance &&
        Math.Abs(moved.Y) < SystemParameters.MinimumVerticalDragDistance) return;

    // Which row is under the mouse?
    if (ItemsControl.ContainerFromElement(ExpenseList, (DependencyObject)e.OriginalSource)
        is not ListBoxItem row || row.DataContext is not Expense expense) return;

    DragDrop.DoDragDrop(row, new DataObject(typeof(Expense), expense), DragDropEffects.Move);
}
```

`SystemParameters.MinimumHorizontalDragDistance` is the user's Windows setting (a few pixels), so your app behaves like every other app. The `Preview` events are used because the `ListBox` handles normal mouse events itself for selection.

### Finding the dragged item

`e.OriginalSource` is the exact element under the mouse, often a `TextBlock` deep inside the row's [data template](/courses/wpf/data-templates). `ItemsControl.ContainerFromElement` walks up the [visual tree](/courses/wpf/logical-and-visual-trees) from there to the `ListBoxItem` that holds it. The item's `DataContext` is the `Expense` behind the row.

## Dropping on a category

Now the category boxes on the right. They come from an `ItemsControl` over the category names, and each box is a drop target:

```xml
<ItemsControl ItemsSource="{Binding Categories}">
    <ItemsControl.ItemTemplate>
        <DataTemplate>
            <Border Padding="12" Margin="0,0,0,8" BorderBrush="Gray" BorderThickness="1"
                    Background="Transparent" AllowDrop="True"
                    DragEnter="Category_DragEnter" DragOver="Category_DragOver"
                    DragLeave="Category_DragLeave" Drop="Category_Drop">
                <TextBlock Text="{Binding}" FontWeight="SemiBold" />
            </Border>
        </DataTemplate>
    </ItemsControl.ItemTemplate>
</ItemsControl>
```

Note `Background="Transparent"`. An element with no background is invisible to the mouse in its empty areas, so it would only accept drops right on top of the text. Transparent is "painted with nothing", which still counts as a surface.

```csharp
private void Category_DragEnter(object sender, DragEventArgs e)
{
    if (e.Data.GetDataPresent(typeof(Expense)))
        ((Border)sender).Background = Brushes.LightSkyBlue; // "you can drop here"
}

private void Category_DragLeave(object sender, DragEventArgs e) =>
    ((Border)sender).Background = Brushes.Transparent;

private void Category_DragOver(object sender, DragEventArgs e)
{
    if (!e.Data.GetDataPresent(typeof(Expense))) return; // files: let the window decide
    e.Effects = DragDropEffects.Move;
    e.Handled = true;
}

private void Category_Drop(object sender, DragEventArgs e)
{
    var box = (Border)sender;
    box.Background = Brushes.Transparent;
    if (e.Data.GetData(typeof(Expense)) is not Expense expense) return;
    if (box.DataContext is string category)
        _viewModel.ChangeCategory(expense, category);
    e.Handled = true;
}
```

Each box's `DataContext` is its category name, because that is the item the template was made for. `ChangeCategory` in the view model just sets `expense.Category`. Since `Expense` is an `ObservableObject`, the row in the list updates by itself.

### Why Handled matters here

Drag events bubble. A drop on a category box travels up to the window next. Setting `e.Handled = true` in the box stops the window's `Drop` handler from also running.

The opposite matters in `DragOver`: when files are dragged over a category box, the box simply returns without setting `Handled`. The event bubbles on to the window, which says "Copy". So files can be dropped anywhere, even on top of the boxes.

## Reordering the list

The list can be both a source and a target. On drop, find the row under the mouse the same way as before and ask the view model to move the item there:

```csharp
private void List_Drop(object sender, DragEventArgs e)
{
    if (e.Data.GetData(typeof(Expense)) is not Expense dragged) return;
    if (ItemsControl.ContainerFromElement(ExpenseList, (DependencyObject)e.OriginalSource)
        is ListBoxItem { DataContext: Expense target })
    {
        _viewModel.Move(dragged, target);
    }
    e.Handled = true;
}
```

```csharp
// ExpenseListViewModel
public void Move(Expense expense, Expense target)
{
    int from = Expenses.IndexOf(expense);
    int to = Expenses.IndexOf(target);
    if (from < 0 || to < 0 || from == to) return;
    Expenses.Move(from, to);
}
```

`ObservableCollection<T>.Move` moves an item and tells the `ListBox` in one change notification, which is smoother than a remove plus an insert (see [Binding to Collections](/courses/wpf/binding-to-collections)).

## Going further

- **A drag preview.** By default only the cursor changes. To show a ghost of the row under the mouse, draw it in an **adorner**, a layer that floats above an element. It is more code, so many apps skip it.
- **Custom cursors.** Handle `GiveFeedback` on the source to set your own cursor.
- **Reusable drag and drop.** If several screens need the same handlers, move them into an attached behavior with an `ICommand` property, as in [Attached Properties and Behaviors](/courses/wpf/attached-properties-and-behaviors). Then the XAML only says `local:DropFiles.Command="{Binding ImportCommand}"`.
- **Ready made libraries.** The open source GongSolutions.WPF.DragDrop package wraps all of this in attached properties, with previews included.

## Common mistakes

- **No Background on the target.** The empty parts of a `Border`, `Grid` or `StackPanel` ignore the mouse. Add `Background="Transparent"`.
- **Forgetting AllowDrop.** Without `AllowDrop="True"`, none of the drag events fire on that element.
- **TextBox targets.** A `TextBox` already handles drag and drop of text and marks the events handled. To drop files on one, use `PreviewDragOver` and `PreviewDrop`, and set `e.Handled = true`.
- **Starting the drag on mouse down.** Normal clicks stop selecting rows. Wait for the minimum drag distance.
- **Running Visual Studio as administrator.** Windows blocks drops from a normal Explorer window into an app that runs elevated. If file drops do nothing while debugging, check this first.
- **Heavy work in the Drop handler.** The drag source waits while you work. For big files, start an async import instead, as in [Async, Await and a Responsive UI](/courses/wpf/async-await-and-a-responsive-ui).

## Quick recap

- A drag has a source, a target and a data object labelled with a format.
- Targets need `AllowDrop="True"`, a hit testable background, and handlers for `DragOver` (set `e.Effects`) and `Drop` (read `e.Data`).
- Files from Explorer arrive as `string[]` in `DataFormats.FileDrop`.
- Start your own drags with `DragDrop.DoDragDrop`, but only after the mouse moved the system's minimum drag distance.
- `ItemsControl.ContainerFromElement` finds the row, and its `DataContext` is the item.
- Use `e.Handled` to decide whether an event should bubble on to the window.
- Keep the real work in view model methods that take plain values.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Width="720" Height="440"
        AllowDrop="True" DragOver="Window_DragOver" Drop="Window_Drop"&gt;
    &lt;!-- The whole window accepts CSV files from Explorer --&gt;
    &lt;DockPanel Margin="16"&gt;
        &lt;TextBlock DockPanel.Dock="Bottom" Text="{Binding StatusText}" Margin="0,12,0,0" /&gt;
        &lt;Grid&gt;
            &lt;Grid.ColumnDefinitions&gt;
                &lt;ColumnDefinition Width="*" /&gt;
                &lt;ColumnDefinition Width="16" /&gt;
                &lt;ColumnDefinition Width="200" /&gt;
            &lt;/Grid.ColumnDefinitions&gt;
            &lt;!-- Drag source: start a drag when the mouse moves far enough with the button down.
                 It is also a drop target, so rows can be reordered. --&gt;
            &lt;ListBox x:Name="ExpenseList" ItemsSource="{Binding Expenses}" AllowDrop="True"
                     HorizontalContentAlignment="Stretch"
                     PreviewMouseLeftButtonDown="List_PreviewMouseLeftButtonDown"
                     PreviewMouseMove="List_PreviewMouseMove"
                     DragOver="List_DragOver" Drop="List_Drop"&gt;
                &lt;ListBox.ItemTemplate&gt;
                    &lt;DataTemplate&gt;
                        &lt;Grid&gt;
                            &lt;Grid.ColumnDefinitions&gt;
                                &lt;ColumnDefinition Width="*" /&gt;
                                &lt;ColumnDefinition Width="90" /&gt;
                                &lt;ColumnDefinition Width="Auto" /&gt;
                            &lt;/Grid.ColumnDefinitions&gt;
                            &lt;TextBlock Text="{Binding Title}" /&gt;
                            &lt;TextBlock Grid.Column="1" Text="{Binding Category}" Opacity="0.7" /&gt;
                            &lt;TextBlock Grid.Column="2" Text="{Binding Amount, StringFormat=C}" /&gt;
                        &lt;/Grid&gt;
                    &lt;/DataTemplate&gt;
                &lt;/ListBox.ItemTemplate&gt;
            &lt;/ListBox&gt;
            &lt;!-- Drop targets: one box per category --&gt;
            &lt;ItemsControl Grid.Column="2" ItemsSource="{Binding Categories}"&gt;
                &lt;ItemsControl.ItemTemplate&gt;
                    &lt;DataTemplate&gt;
                        &lt;!-- Background="Transparent" so the empty area can be hit by the mouse --&gt;
                        &lt;Border Margin="0,0,0,8" Padding="12" CornerRadius="6"
                                BorderBrush="Gray" BorderThickness="1" Background="Transparent"
                                AllowDrop="True"
                                DragEnter="Category_DragEnter" DragOver="Category_DragOver"
                                DragLeave="Category_DragLeave" Drop="Category_Drop"&gt;
                            &lt;TextBlock Text="{Binding}" FontWeight="SemiBold" /&gt;
                        &lt;/Border&gt;
                    &lt;/DataTemplate&gt;
                &lt;/ItemsControl.ItemTemplate&gt;
            &lt;/ItemsControl&gt;
        &lt;/Grid&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using CoinJar.Models;
using CoinJar.ViewModels;
namespace CoinJar;
public partial class MainWindow : Window
{
    private readonly ExpenseListViewModel _viewModel = new();
    private Point _dragStart;
    public MainWindow()
    {
        InitializeComponent();
        DataContext = _viewModel;
    }
    // ----- Drag source: the list -----
    private void List_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e) =&gt;
        _dragStart = e.GetPosition(null);
    private void List_PreviewMouseMove(object sender, MouseEventArgs e)
    {
        if (e.LeftButton != MouseButtonState.Pressed) return;
        // Only start after the mouse moved a few pixels, so normal clicks still select.
        Vector moved = _dragStart - e.GetPosition(null);
        if (Math.Abs(moved.X) &lt; SystemParameters.MinimumHorizontalDragDistance &amp;&amp;
            Math.Abs(moved.Y) &lt; SystemParameters.MinimumVerticalDragDistance) return;
        // Which row is under the mouse?
        if (ItemsControl.ContainerFromElement(ExpenseList, (DependencyObject)e.OriginalSource)
            is not ListBoxItem row || row.DataContext is not Expense expense) return;
        // Package the expense and start. DoDragDrop waits until the drop is over.
        var data = new DataObject(typeof(Expense), expense);
        DragDrop.DoDragDrop(row, data, DragDropEffects.Move);
    }
    // ----- Drop target: reordering inside the list -----
    private void List_DragOver(object sender, DragEventArgs e)
    {
        if (!e.Data.GetDataPresent(typeof(Expense))) return; // files: let the window decide
        e.Effects = DragDropEffects.Move;
        e.Handled = true; // stop the window's handler from changing the effect
    }
    private void List_Drop(object sender, DragEventArgs e)
    {
        if (e.Data.GetData(typeof(Expense)) is not Expense dragged) return;
        if (ItemsControl.ContainerFromElement(ExpenseList, (DependencyObject)e.OriginalSource)
            is ListBoxItem { DataContext: Expense target })
        {
            _viewModel.Move(dragged, target);
        }
        e.Handled = true;
    }
    // ----- Drop targets: the category boxes -----
    private void Category_DragEnter(object sender, DragEventArgs e)
    {
        if (e.Data.GetDataPresent(typeof(Expense)))
            ((Border)sender).Background = Brushes.LightSkyBlue; // "you can drop here"
    }
    private void Category_DragLeave(object sender, DragEventArgs e) =&gt;
        ((Border)sender).Background = Brushes.Transparent;
    private void Category_DragOver(object sender, DragEventArgs e)
    {
        if (!e.Data.GetDataPresent(typeof(Expense))) return;
        e.Effects = DragDropEffects.Move;
        e.Handled = true;
    }
    private void Category_Drop(object sender, DragEventArgs e)
    {
        var box = (Border)sender;
        box.Background = Brushes.Transparent;
        if (e.Data.GetData(typeof(Expense)) is not Expense expense) return;
        if (box.DataContext is string category)
            _viewModel.ChangeCategory(expense, category);
        e.Handled = true; // the window's Drop handler should not see this one
    }
    // ----- Drop target: files from Explorer, anywhere on the window -----
    private void Window_DragOver(object sender, DragEventArgs e)
    {
        e.Effects = e.Data.GetDataPresent(DataFormats.FileDrop) ? DragDropEffects.Copy : DragDropEffects.None;
        e.Handled = true;
    }
    private void Window_Drop(object sender, DragEventArgs e)
    {
        if (e.Data.GetData(DataFormats.FileDrop) is string[] files)
            _viewModel.ImportFiles(files);
    }
}
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using System.Globalization;
using System.IO;
using CoinJar.Models;
using CommunityToolkit.Mvvm.ComponentModel;
namespace CoinJar.ViewModels;
public partial class ExpenseListViewModel : ObservableObject
{
    public ExpenseListViewModel()
    {
        Expenses.Add(new Expense { Title = "Coffee", Amount = 3.50m, Category = "Other" });
        Expenses.Add(new Expense { Title = "Train ticket", Amount = 12m, Category = "Other" });
        Expenses.Add(new Expense { Title = "Cinema", Amount = 9m, Category = "Other" });
    }
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = [];
    public string[] Categories { get; } = ["Food", "Transport", "Bills", "Fun", "Other"];
    [ObservableProperty]
    public partial string StatusText { get; set; } = "Drag an expense onto a category, or drop a CSV file here.";
    // Called by the view when an expense is dropped on a category.
    public void ChangeCategory(Expense expense, string category)
    {
        if (expense.Category == category) return;
        expense.Category = category; // Expense is observable, so the row updates
        StatusText = $"{expense.Title} is now in {category}";
    }
    // Called by the view when files are dropped. Lines look like: 2026-10-01,Food,12.50,Lunch
    public void ImportFiles(IEnumerable&lt;string&gt; paths)
    {
        int added = 0;
        foreach (string path in paths.Where(p =&gt; p.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)))
        {
            foreach (string line in File.ReadLines(path).Skip(1)) // skip the header row
            {
                string[] parts = line.Split(',');
                if (parts.Length &lt; 3) continue;
                if (!DateTime.TryParse(parts[0], CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime date)) continue;
                if (!decimal.TryParse(parts[2], NumberStyles.Number, CultureInfo.InvariantCulture, out decimal amount)) continue;
                string category = Categories.Contains(parts[1]) ? parts[1] : "Other";
                string title = parts.Length &gt; 3 ? parts[3] : category;
                Expenses.Add(new Expense { Title = title, Amount = amount, Category = category, Date = date });
                added++;
            }
        }
        StatusText = added == 0 ? "No expenses found in the dropped files." : $"Imported {added} expenses.";
    }
    // Called by the view to reorder the list.
    public void Move(Expense expense, Expense target)
    {
        int from = Expenses.IndexOf(expense);
        int to = Expenses.IndexOf(target);
        if (from &lt; 0 || to &lt; 0 || from == to) return;
        Expenses.Move(from, to);
    }
}
</code></pre>

