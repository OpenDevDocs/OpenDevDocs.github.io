---
publishDate: 2026-10-25T20:27
title: 'The DataGrid Control'
slug: the-datagrid-control
metadescription: 'Show CoinJar expenses in an editable WPF DataGrid: columns, formatting, template columns, editing, selection, row details and keeping a total in sync.'
updateDate: 2026-10-25T20:27
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'datagrid', 'data-binding', 'controls']
course: wpf
---

## What a DataGrid is and why you want one

A **DataGrid** is a table control. Each object in a collection becomes a **row**, and each property you choose becomes a **column**. Think of a spreadsheet that is wired straight to your C# objects.

A `ListBox` with a [data template](/courses/wpf/data-templates) can show a list nicely, but a `DataGrid` gives you a lot for free:

- column headers you can click to sort
- columns the user can resize and reorder
- editing cells in place, with the changes written back to your objects
- adding and deleting rows
- single or multiple selection

For CoinJar, an expense tracker, a grid of expenses (title, category, date, amount) is exactly the right fit. In this lesson you will build that grid step by step.

## The starting point

We keep the pieces from the earlier lessons. An `Expense` class raises `PropertyChanged` (from [INotifyPropertyChanged](/courses/wpf/inotifypropertychanged)), and the window's data lives in an `ObservableCollection<Expense>` (from [Binding to Collections](/courses/wpf/binding-to-collections)).

```csharp
public class ExpenseListViewModel : INotifyPropertyChanged
{
    public ObservableCollection<Expense> Expenses { get; } = new();

    // PropertyChanged plumbing as in earlier lessons...
}
```

The class that holds a window's data is often called a **view model**. You will learn the full pattern in [Introduction to MVVM](/courses/wpf/introduction-to-mvvm). For now it is just a class we set as the window's `DataContext`.

```csharp
public MainWindow()
{
    InitializeComponent();
    DataContext = new ExpenseListViewModel();
}
```

## The quickest grid: auto generated columns

Point `ItemsSource` at the collection and you are done:

```xml
<DataGrid ItemsSource="{Binding Expenses}" />
```

By default `AutoGenerateColumns` is `True`. The grid looks at the public properties of `Expense` and makes one column per property. It even picks a sensible column type: a `bool` becomes a check box column and an `enum` becomes a combo box column.

This is great for a quick look at your data, but you rarely ship it:

- the headers are the raw property names (`Id`, `Amount`)
- money and dates are not formatted
- you cannot choose the order or the width

If you only need small tweaks, the `AutoGeneratingColumn` event lets you rename or skip a column while it is created:

```csharp
private void Grid_AutoGeneratingColumn(object sender, DataGridAutoGeneratingColumnEventArgs e)
{
    if (e.PropertyName == "Id")
    {
        e.Cancel = true;          // do not show the Id column
    }
}
```

For a real screen, define the columns yourself.

## Defining your own columns

Set `AutoGenerateColumns="False"` and list the columns inside `DataGrid.Columns`:

```xml
<DataGrid ItemsSource="{Binding Expenses}"
          AutoGenerateColumns="False">
    <DataGrid.Columns>
        <DataGridTextColumn Header="Title" Binding="{Binding Title}" Width="*" />
        <DataGridTextColumn Header="Category" Binding="{Binding Category}" Width="120" />
        <DataGridTextColumn Header="Date" Binding="{Binding Date, StringFormat=d}" Width="Auto" />
        <DataGridTextColumn Header="Amount" Binding="{Binding Amount, StringFormat=N2}" Width="100" />
    </DataGrid.Columns>
</DataGrid>
```

Each column has a `Header` and a `Binding`. The binding path is relative to **one row's object**, so `{Binding Title}` means "the `Title` of this expense".

### Column widths

`Width` accepts the same ideas you met in [The Grid Panel](/courses/wpf/the-grid-panel):

| Value | Meaning |
| --- | --- |
| `120` | a fixed width in device independent pixels |
| `Auto` | fit the widest cell or header |
| `SizeToHeader` | fit the header text only |
| `SizeToCells` | fit the cells only |
| `*` or `2*` | share the leftover space |

Giving `Title` a `*` width means it soaks up any spare space, so the grid always fills the window.

## The built in column types

WPF ships five column types:

| Column | Shows | Good for |
| --- | --- | --- |
| `DataGridTextColumn` | text, edits with a `TextBox` | strings and numbers |
| `DataGridCheckBoxColumn` | a check box | `bool` values |
| `DataGridComboBoxColumn` | a combo box when editing | picking one value from a list |
| `DataGridHyperlinkColumn` | a clickable link | `Uri` values |
| `DataGridTemplateColumn` | anything you design | everything else |

### A combo box column for the category

CoinJar has five categories: Food, Transport, Bills, Fun and Other. A combo box column stops people typing "fod" by mistake.

There is one catch. Columns are **not** part of the visual tree (see [Logical and Visual Trees](/courses/wpf/logical-and-visual-trees)), so a column cannot inherit the window's `DataContext`. A plain `{Binding Categories}` on the column's `ItemsSource` finds nothing. The simple fix is a resource:

```xml
<Window.Resources>
    <x:Array x:Key="Categories" Type="sys:String">
        <sys:String>Food</sys:String>
        <sys:String>Transport</sys:String>
        <sys:String>Bills</sys:String>
        <sys:String>Fun</sys:String>
        <sys:String>Other</sys:String>
    </x:Array>
</Window.Resources>

<DataGridComboBoxColumn Header="Category"
                        ItemsSource="{StaticResource Categories}"
                        SelectedItemBinding="{Binding Category}" />
```

The `sys` prefix is declared on the window as `xmlns:sys="clr-namespace:System;assembly=mscorlib"`. Notice the binding property is `SelectedItemBinding`, not `Binding`. You will learn much more about resources in [Resources and Resource Dictionaries](/courses/wpf/resources-and-resource-dictionaries).

### Template columns for full control

A `DataGridTemplateColumn` takes two data templates: one for showing the cell and one for editing it.

```xml
<DataGridTemplateColumn Header="Date" Width="130" SortMemberPath="Date">
    <DataGridTemplateColumn.CellTemplate>
        <DataTemplate>
            <TextBlock Text="{Binding Date, StringFormat=d}" Margin="4,0" />
        </DataTemplate>
    </DataGridTemplateColumn.CellTemplate>
    <DataGridTemplateColumn.CellEditingTemplate>
        <DataTemplate>
            <DatePicker SelectedDate="{Binding Date}" />
        </DataTemplate>
    </DataGridTemplateColumn.CellEditingTemplate>
</DataGridTemplateColumn>
```

Now the date shows as text, but turns into a `DatePicker` when the user edits it. A template column does not know what to sort by, so set `SortMemberPath` if you want its header to be clickable for sorting.

## Formatting money

You might try `StringFormat=C` on a text column to show the amount as currency. It looks right, but editing breaks: the edit box now contains "$12.50", and converting that text back to a `decimal` fails because of the currency symbol. The cell gets a red border and the value is not saved.

A template column solves this neatly. Show the currency in the normal template, and edit the plain number:

```xml
<DataGridTemplateColumn Header="Amount" Width="110" SortMemberPath="Amount">
    <DataGridTemplateColumn.CellTemplate>
        <DataTemplate>
            <TextBlock Text="{Binding Amount, StringFormat=C}"
                       HorizontalAlignment="Right" Margin="4,0" />
        </DataTemplate>
    </DataGridTemplateColumn.CellTemplate>
    <DataGridTemplateColumn.CellEditingTemplate>
        <DataTemplate>
            <TextBox Text="{Binding Amount, StringFormat=N2}" TextAlignment="Right" />
        </DataTemplate>
    </DataGridTemplateColumn.CellEditingTemplate>
</DataGridTemplateColumn>
```

The currency symbol comes from the **culture** that the binding uses. WPF bindings use US English unless you tell them otherwise, which is why you may see "$" on a PC set to another country. The [Data Binding Basics](/courses/wpf/data-binding-basics) lesson showed how to make WPF use the user's own culture.

## Editing, adding and deleting rows

Editing is on by default. Double click a cell (or press F2) to edit, then press Enter or move to another cell to commit. Press Escape to cancel. The new value is written into the `Expense` object through the binding.

A few properties control what users may do:

```xml
<DataGrid IsReadOnly="False"
          CanUserAddRows="True"
          CanUserDeleteRows="True"
          CanUserSortColumns="True"
          CanUserReorderColumns="True"
          CanUserResizeColumns="True" />
```

- `IsReadOnly="True"` turns off all editing. You can also set it on a single column.
- `CanUserAddRows` shows an empty "new item" row at the bottom. Typing in it creates a new `Expense`. This only works when the class has a public constructor with no parameters.
- `CanUserDeleteRows` lets the user press Delete to remove the selected rows from the collection.

Because `Expenses` is an `ObservableCollection`, the collection you hold in C# changes too. Nothing needs copying back.

## Selection

The grid tracks what the user selected. Bind `SelectedItem` to a property to know which expense is highlighted:

```xml
<DataGrid ItemsSource="{Binding Expenses}"
          SelectedItem="{Binding SelectedExpense}"
          SelectionMode="Single"
          SelectionUnit="FullRow" />
```

- `SelectionMode` is `Single` or `Extended` (the default, which allows Ctrl and Shift clicks).
- `SelectionUnit` is `FullRow`, `Cell` or `CellOrRowHeader`.
- With `Extended`, read `grid.SelectedItems` in code to get every selected row.

`SelectedItem` binds two way by default, so the view model can also select a row by setting `SelectedExpense`.

## Row details

**Row details** are an extra area that opens under a row. They are good for information that does not deserve its own column:

```xml
<DataGrid RowDetailsVisibilityMode="VisibleWhenSelected">
    <DataGrid.RowDetailsTemplate>
        <DataTemplate>
            <TextBlock Margin="24,4" Foreground="Gray"
                       Text="{Binding Id, StringFormat='Expense #{0}'}" />
        </DataTemplate>
    </DataGrid.RowDetailsTemplate>
</DataGrid>
```

`RowDetailsVisibilityMode` can be `Collapsed`, `Visible` (every row) or `VisibleWhenSelected`.

## Making the grid easier to read

A handful of properties give a cleaner look without any styling knowledge:

```xml
<DataGrid AlternatingRowBackground="#F5F7FA"
          GridLinesVisibility="Horizontal"
          HeadersVisibility="Column"
          RowHeight="28"
          FrozenColumnCount="1" />
```

- `AlternatingRowBackground` stripes every second row.
- `GridLinesVisibility` is `All`, `Horizontal`, `Vertical` or `None`.
- `HeadersVisibility="Column"` hides the grey row header strip on the left.
- `FrozenColumnCount="1"` keeps the first column visible while scrolling sideways.

For deeper changes, such as coloured rows, you will use `RowStyle` and `CellStyle` in [Styles and Setters](/courses/wpf/styles-and-setters) and [Triggers](/courses/wpf/triggers).

## Keeping a total in sync

CoinJar shows a total under the grid. It must update when a row is added, removed **or edited**. `ObservableCollection` only tells you about adds and removes, so we also listen to each expense's `PropertyChanged` event (a C# [event](/courses/c-sharp/events)):

```csharp
public ExpenseListViewModel()
{
    Expenses.CollectionChanged += (s, e) =>
    {
        if (e.NewItems != null)
            foreach (Expense x in e.NewItems) x.PropertyChanged += Expense_PropertyChanged;
        if (e.OldItems != null)
            foreach (Expense x in e.OldItems) x.PropertyChanged -= Expense_PropertyChanged;
        OnPropertyChanged(nameof(Total));
    };
}

private void Expense_PropertyChanged(object? sender, PropertyChangedEventArgs e)
{
    if (e.PropertyName == nameof(Expense.Amount))
        OnPropertyChanged(nameof(Total));
}

public decimal Total => Expenses.Sum(x => x.Amount);
```

`Total` is a calculated property using [LINQ](/courses/c-sharp/linq-fundamentals). We just announce "Total changed" whenever something that affects it changes, and the bound `TextBlock` asks for the new value.

## Common mistakes

- **Columns appear twice.** You defined columns but forgot `AutoGenerateColumns="False"`, so you get yours plus the generated ones.
- **The combo box column is empty.** Its `ItemsSource` used a normal `{Binding}`. Columns have no `DataContext`, so use a `StaticResource`.
- **Edits do not stick on a currency column.** `StringFormat=C` cannot be converted back. Use a template column or `N2` for editing.
- **No "new row" appears.** The item class has no parameterless constructor, or the grid or column is read only.
- **The total does not change after editing.** You only listened to `CollectionChanged`. Item edits raise `PropertyChanged` on the item, not on the collection.
- **Slow with thousands of rows.** Do not put the grid inside a `StackPanel` or `ScrollViewer`. It then gets infinite height and turns off virtualization. Give it a `Grid` row with `*` height instead. More on this in [Performance and Virtualization](/courses/wpf/performance-and-virtualization).

## Quick recap

- A `DataGrid` shows a collection as rows and columns, with sorting, resizing, editing and selection built in.
- Turn off `AutoGenerateColumns` and define columns yourself for real screens.
- Use text, check box, combo box, hyperlink and template columns. Template columns have a `CellTemplate` and a `CellEditingTemplate`.
- Columns are not in the visual tree, so give a combo box column its list from a resource.
- Avoid `StringFormat=C` on editable cells. Show currency, edit the plain number.
- `CanUserAddRows`, `CanUserDeleteRows` and `IsReadOnly` control editing. `SelectedItem` tells you the current row.
- Listen to each item's `PropertyChanged` to keep calculated values such as a total up to date.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:sys="clr-namespace:System;assembly=mscorlib"
        Title="CoinJar" Height="450" Width="720"&gt;
    &lt;Window.Resources&gt;
        &lt;!-- The category list for the combo box column --&gt;
        &lt;x:Array x:Key="Categories" Type="sys:String"&gt;
            &lt;sys:String&gt;Food&lt;/sys:String&gt;
            &lt;sys:String&gt;Transport&lt;/sys:String&gt;
            &lt;sys:String&gt;Bills&lt;/sys:String&gt;
            &lt;sys:String&gt;Fun&lt;/sys:String&gt;
            &lt;sys:String&gt;Other&lt;/sys:String&gt;
        &lt;/x:Array&gt;
    &lt;/Window.Resources&gt;
    &lt;Grid Margin="12"&gt;
        &lt;Grid.RowDefinitions&gt;
            &lt;RowDefinition Height="*" /&gt;
            &lt;RowDefinition Height="Auto" /&gt;
        &lt;/Grid.RowDefinitions&gt;
        &lt;!-- The grid sits in a * row so it can virtualize and scroll --&gt;
        &lt;DataGrid ItemsSource="{Binding Expenses}"
                  SelectedItem="{Binding SelectedExpense}"
                  AutoGenerateColumns="False"
                  CanUserAddRows="True"
                  CanUserDeleteRows="True"
                  SelectionMode="Single"
                  HeadersVisibility="Column"
                  GridLinesVisibility="Horizontal"
                  AlternatingRowBackground="#F5F7FA"
                  RowHeight="28"
                  RowDetailsVisibilityMode="VisibleWhenSelected"&gt;
            &lt;DataGrid.Columns&gt;
                &lt;DataGridTextColumn Header="Title" Binding="{Binding Title}" Width="*" /&gt;
                &lt;!-- Columns have no DataContext, so the list comes from a resource --&gt;
                &lt;DataGridComboBoxColumn Header="Category" Width="120"
                                        ItemsSource="{StaticResource Categories}"
                                        SelectedItemBinding="{Binding Category}" /&gt;
                &lt;!-- Show text, edit with a DatePicker --&gt;
                &lt;DataGridTemplateColumn Header="Date" Width="130" SortMemberPath="Date"&gt;
                    &lt;DataGridTemplateColumn.CellTemplate&gt;
                        &lt;DataTemplate&gt;
                            &lt;TextBlock Text="{Binding Date, StringFormat=d}" Margin="4,0"
                                       VerticalAlignment="Center" /&gt;
                        &lt;/DataTemplate&gt;
                    &lt;/DataGridTemplateColumn.CellTemplate&gt;
                    &lt;DataGridTemplateColumn.CellEditingTemplate&gt;
                        &lt;DataTemplate&gt;
                            &lt;DatePicker SelectedDate="{Binding Date}" /&gt;
                        &lt;/DataTemplate&gt;
                    &lt;/DataGridTemplateColumn.CellEditingTemplate&gt;
                &lt;/DataGridTemplateColumn&gt;
                &lt;!-- Show currency, edit a plain number --&gt;
                &lt;DataGridTemplateColumn Header="Amount" Width="110" SortMemberPath="Amount"&gt;
                    &lt;DataGridTemplateColumn.CellTemplate&gt;
                        &lt;DataTemplate&gt;
                            &lt;TextBlock Text="{Binding Amount, StringFormat=C}"
                                       HorizontalAlignment="Right" Margin="4,0"
                                       VerticalAlignment="Center" /&gt;
                        &lt;/DataTemplate&gt;
                    &lt;/DataGridTemplateColumn.CellTemplate&gt;
                    &lt;DataGridTemplateColumn.CellEditingTemplate&gt;
                        &lt;DataTemplate&gt;
                            &lt;TextBox Text="{Binding Amount, StringFormat=N2}" TextAlignment="Right" /&gt;
                        &lt;/DataTemplate&gt;
                    &lt;/DataGridTemplateColumn.CellEditingTemplate&gt;
                &lt;/DataGridTemplateColumn&gt;
            &lt;/DataGrid.Columns&gt;
            &lt;!-- Extra info under the selected row --&gt;
            &lt;DataGrid.RowDetailsTemplate&gt;
                &lt;DataTemplate&gt;
                    &lt;TextBlock Margin="24,4" Foreground="Gray"
                               Text="{Binding Id, StringFormat='Expense #{0}'}" /&gt;
                &lt;/DataTemplate&gt;
            &lt;/DataGrid.RowDetailsTemplate&gt;
        &lt;/DataGrid&gt;
        &lt;!-- The total updates on add, delete and edit --&gt;
        &lt;StackPanel Grid.Row="1" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,8,0,0"&gt;
            &lt;TextBlock Text="Total: " FontWeight="SemiBold" /&gt;
            &lt;TextBlock Text="{Binding Total, StringFormat=C}" FontWeight="SemiBold" /&gt;
        &lt;/StackPanel&gt;
    &lt;/Grid&gt;
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
using System.Collections.Specialized;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using CoinJar.Models;
namespace CoinJar.ViewModels;
public class ExpenseListViewModel : INotifyPropertyChanged
{
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = new();
    private Expense? _selectedExpense;
    public Expense? SelectedExpense
    {
        get =&gt; _selectedExpense;
        set { _selectedExpense = value; OnPropertyChanged(); }
    }
    // A calculated property: always the sum of the current amounts
    public decimal Total =&gt; Expenses.Sum(x =&gt; x.Amount);
    public ExpenseListViewModel()
    {
        // Watch adds and removes, and hook each item's PropertyChanged
        Expenses.CollectionChanged += Expenses_CollectionChanged;
        Expenses.Add(new Expense { Id = 1, Title = "Groceries", Amount = 42.80m, Category = "Food", Date = DateTime.Today.AddDays(-2) });
        Expenses.Add(new Expense { Id = 2, Title = "Bus pass", Amount = 30.00m, Category = "Transport", Date = DateTime.Today.AddDays(-5) });
        Expenses.Add(new Expense { Id = 3, Title = "Electricity", Amount = 64.15m, Category = "Bills", Date = DateTime.Today.AddDays(-9) });
        Expenses.Add(new Expense { Id = 4, Title = "Cinema", Amount = 18.50m, Category = "Fun", Date = DateTime.Today });
    }
    private void Expenses_CollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (e.NewItems != null)
            foreach (Expense x in e.NewItems) x.PropertyChanged += Expense_PropertyChanged;
        if (e.OldItems != null)
            foreach (Expense x in e.OldItems) x.PropertyChanged -= Expense_PropertyChanged;
        OnPropertyChanged(nameof(Total));
    }
    // An edited amount changes the total too
    private void Expense_PropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(Expense.Amount))
            OnPropertyChanged(nameof(Total));
    }
    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null)
        =&gt; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
// Models/Expense.cs
using System.ComponentModel;
using System.Runtime.CompilerServices;
namespace CoinJar.Models;
public class Expense : INotifyPropertyChanged
{
    // A public parameterless constructor (the default one) lets CanUserAddRows work
    public int Id { get; set; }
    private string _title = "";
    public string Title { get =&gt; _title; set { _title = value; OnPropertyChanged(); } }
    private decimal _amount;
    public decimal Amount { get =&gt; _amount; set { _amount = value; OnPropertyChanged(); } }
    private string _category = "Other";
    public string Category { get =&gt; _category; set { _category = value; OnPropertyChanged(); } }
    private DateTime _date = DateTime.Today;
    public DateTime Date { get =&gt; _date; set { _date = value; OnPropertyChanged(); } }
    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null)
        =&gt; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
</code></pre>
