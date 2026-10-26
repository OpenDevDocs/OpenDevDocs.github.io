---
publishDate: 2026-10-25T20:28
title: 'Sorting, Filtering and Grouping with CollectionView'
slug: sorting-filtering-and-grouping
metadescription: 'Use ICollectionView and CollectionViewSource to sort, filter, search and group CoinJar expenses without touching the original ObservableCollection.'
updateDate: 2026-10-25T20:28
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'collectionview', 'data-binding', 'datagrid']
course: wpf
---

## The problem: one list, many ways to look at it

CoinJar keeps all expenses in one `ObservableCollection<Expense>`. The user wants to:

- see the newest expenses first
- show only "Food" expenses
- search for "bus"
- see expenses grouped by category, with a subtotal per group

You could build a new list every time with [LINQ](/courses/c-sharp/linq-fundamentals) and swap it in. That works, but it is wasteful and you lose things like the selected row. WPF has a better tool: the **collection view**.

## What a collection view is

A **collection view** is a layer that sits between your collection and the control. It does not copy your data. It only decides **which** items are visible, in **what order**, and in **which groups**.

```text
ObservableCollection<Expense>   (all data, never reordered)
        |
  ICollectionView               (sort, filter, group, current item)
        |
DataGrid / ListBox              (shows what the view says)
```

A good everyday comparison: your collection is a pile of receipts in a drawer. The collection view is the way you lay them out on the table. You can sort them by date or put only the food receipts on the table, and the drawer is untouched.

In fact, every time you bind an `ItemsControl` to a collection, WPF quietly creates a default view for it. That is how a `DataGrid` can sort when you click a header: it sorts the view, not your list.

## Getting the view in code

The interface is `ICollectionView` from `System.ComponentModel`. Ask WPF for the default view of a collection:

```csharp
using System.ComponentModel;
using System.Windows.Data;

ICollectionView view = CollectionViewSource.GetDefaultView(Expenses);
```

For an `ObservableCollection` this returns a `ListCollectionView`, which supports everything in this lesson.

A tidy pattern is to expose the view as a property and bind the grid to it:

```csharp
public ObservableCollection<Expense> Expenses { get; } = new();
public ICollectionView ExpensesView { get; }

public ExpenseListViewModel()
{
    ExpensesView = CollectionViewSource.GetDefaultView(Expenses);
}
```

```xml
<DataGrid ItemsSource="{Binding ExpensesView}" />
```

Binding to `Expenses` would give the same default view, but naming it makes your intent clear.

## Sorting

Add `SortDescription` objects. Each one names a property and a direction:

```csharp
ExpensesView.SortDescriptions.Add(
    new SortDescription(nameof(Expense.Date), ListSortDirection.Descending));
```

Add more than one to sort by several keys. The first one wins, the next one breaks ties:

```csharp
ExpensesView.SortDescriptions.Clear();
ExpensesView.SortDescriptions.Add(new SortDescription("Category", ListSortDirection.Ascending));
ExpensesView.SortDescriptions.Add(new SortDescription("Amount", ListSortDirection.Descending));
```

The property names are strings, so a typo fails silently. `nameof(Expense.Date)` lets the compiler check the name for you.

### Faster custom sorting

Sort descriptions use reflection to read the values, which is slow for very large lists. A `ListCollectionView` also has a `CustomSort` property that takes an `IComparer`. You give it a comparer class, and it is much faster:

```csharp
public class NewestFirst : IComparer
{
    public int Compare(object? a, object? b)
        => ((Expense)b!).Date.CompareTo(((Expense)a!).Date);
}

((ListCollectionView)ExpensesView).CustomSort = new NewestFirst();
```

`IComparer` here is the non generic one from `System.Collections`. For a few hundred expenses, plain `SortDescriptions` are fine.

## Filtering

The `Filter` property takes a method that receives one item and returns `true` to keep it. It is a [delegate](/courses/c-sharp/delegates), so a [lambda expression](/courses/c-sharp/lambda-expressions) works:

```csharp
ExpensesView.Filter = item =>
{
    var e = (Expense)item;
    return e.Category == "Food";
};
```

The item arrives as `object`, so you cast it. Set `Filter = null` to show everything again.

### Filters that change: call Refresh

Usually the filter depends on something the user types or picks. The view does not know that your search text changed, so you tell it with `Refresh()`:

```csharp
private string _searchText = "";
public string SearchText
{
    get => _searchText;
    set
    {
        _searchText = value;
        OnPropertyChanged();
        ExpensesView.Refresh();     // run the filter again
    }
}

private bool FilterExpense(object item)
{
    var e = (Expense)item;
    bool categoryOk = SelectedCategory == "All" || e.Category == SelectedCategory;
    bool textOk = string.IsNullOrWhiteSpace(SearchText)
        || e.Title.Contains(SearchText, StringComparison.OrdinalIgnoreCase);
    return categoryOk && textOk;
}
```

Set the filter once in the constructor (`ExpensesView.Filter = FilterExpense;`) and refresh whenever any input changes. Bind the search box with `UpdateSourceTrigger=PropertyChanged` so it filters as you type (see [Binding Modes and Update Triggers](/courses/wpf/binding-modes-and-update-triggers)):

```xml
<TextBox Text="{Binding SearchText, UpdateSourceTrigger=PropertyChanged}" />
<ComboBox ItemsSource="{Binding CategoryFilters}" SelectedItem="{Binding SelectedCategory}" />
```

## Grouping

Add a `PropertyGroupDescription` to group items that share a value:

```csharp
ExpensesView.GroupDescriptions.Add(new PropertyGroupDescription(nameof(Expense.Category)));
```

The data is now grouped, but the control also needs to know **how to draw a group header**. That is the job of `GroupStyle`:

```xml
<DataGrid ItemsSource="{Binding ExpensesView}">
    <DataGrid.GroupStyle>
        <GroupStyle>
            <GroupStyle.HeaderTemplate>
                <DataTemplate>
                    <TextBlock FontWeight="Bold" Margin="4,8,0,2">
                        <Run Text="{Binding Name, Mode=OneWay}" />
                        <Run Text="{Binding ItemCount, Mode=OneWay, StringFormat=' ({0} items)'}" />
                    </TextBlock>
                </DataTemplate>
            </GroupStyle.HeaderTemplate>
        </GroupStyle>
    </DataGrid.GroupStyle>
</DataGrid>
```

Inside the header template, the `DataContext` is not an `Expense`. It is a `CollectionViewGroup` with three useful properties:

| Property | What it holds |
| --- | --- |
| `Name` | the shared value, for example "Food" |
| `ItemCount` | how many items are in the group |
| `Items` | the items themselves |

`GroupStyle` works the same way on a `ListBox` or `ListView`.

### A subtotal per group

To show the total money per category, pass the group's `Items` to a [value converter](/courses/wpf/value-converters) that adds up the amounts:

```csharp
public class GroupTotalConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        => value is IEnumerable<object> items
            ? items.OfType<Expense>().Sum(e => e.Amount)
            : 0m;

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
```

```xml
<Run Text="{Binding Items, Mode=OneWay, Converter={StaticResource GroupTotal}, StringFormat=C}" />
```

## Declaring a view in XAML with CollectionViewSource

You can also build the view entirely in XAML with a `CollectionViewSource` resource. This is handy when the sorting and grouping never change:

```xml
<Window xmlns:scm="clr-namespace:System.ComponentModel;assembly=WindowsBase" ...>
    <Window.Resources>
        <CollectionViewSource x:Key="ExpensesByCategory" Source="{Binding Expenses}">
            <CollectionViewSource.SortDescriptions>
                <scm:SortDescription PropertyName="Date" Direction="Descending" />
            </CollectionViewSource.SortDescriptions>
            <CollectionViewSource.GroupDescriptions>
                <PropertyGroupDescription PropertyName="Category" />
            </CollectionViewSource.GroupDescriptions>
        </CollectionViewSource>
    </Window.Resources>

    <ListBox ItemsSource="{Binding Source={StaticResource ExpensesByCategory}}" />
</Window>
```

Two details matter here:

- `SortDescription` lives in a different assembly, so it needs the `scm` prefix.
- Bind with `{Binding Source={StaticResource ...}}`, not `{StaticResource ...}` directly. The binding is what unwraps the `CollectionViewSource` into its view.

A `CollectionViewSource` gives you a **separate** view, so two lists on the same window can show the same data sorted differently.

For filtering, it raises a `Filter` event in code behind, where you set `e.Accepted`. Most people find the C# `ICollectionView` approach easier once filters depend on user input.

## Live shaping: re sort when values change

Here is a surprise. You sort by amount, then edit an amount. The row does **not** move. Sorting, filtering and grouping happen when items are added or when you call `Refresh()`, not when a property of an item changes.

You have two options:

1. Call `ExpensesView.Refresh()` after an edit.
2. Turn on **live shaping**, which watches the listed properties for you:

```csharp
if (ExpensesView is ICollectionViewLiveShaping live && live.CanChangeLiveSorting)
{
    live.LiveSortingProperties.Add(nameof(Expense.Amount));
    live.IsLiveSorting = true;
}
```

There are matching `IsLiveFiltering` and `IsLiveGrouping` properties with their own property lists. Live shaping needs the items to raise `PropertyChanged`, which our hand written `Expense` class does.

## The current item

A collection view also remembers a **current item**, a little like a cursor. `ExpensesView.CurrentItem` is the current expense, and methods such as `MoveCurrentToNext()` move it. Set `IsSynchronizedWithCurrentItem="True"` on a list to make its selection follow the current item. Most apps bind `SelectedItem` instead, which is simpler, but you will see the current item in older code.

## Common mistakes

- **The filter never updates.** You forgot `Refresh()` after the search text changed.
- **Groups appear but have no headers.** The view is grouped but the control has no `GroupStyle`.
- **A typo in a sort property.** `"Ammount"` throws no error, it just does nothing useful. Use `nameof`.
- **Editing a sorted grid does not re sort.** That is by design. Use live shaping or `Refresh()`.
- **Changing the original collection order.** Do not sort the `ObservableCollection` itself to change the display. Sort the view.
- **Grouping makes a big list slow.** Grouping switches off item virtualization by default. Setting `VirtualizingPanel.IsVirtualizingWhenGrouping="True"` on the list brings it back. More in [Performance and Virtualization](/courses/wpf/performance-and-virtualization).

## Quick recap

- A collection view sorts, filters and groups a collection for display without changing the collection.
- `CollectionViewSource.GetDefaultView(collection)` returns the view. Expose it as an `ICollectionView` property.
- Sort with `SortDescriptions`, or `CustomSort` for speed. Filter with a `Filter` predicate and call `Refresh()` when inputs change.
- Group with `PropertyGroupDescription` and draw headers with `GroupStyle`. Headers bind to `Name`, `ItemCount` and `Items`.
- `CollectionViewSource` in XAML creates a separate view. Bind to it with `{Binding Source={StaticResource ...}}`.
- Turn on live shaping if rows should move when their values change.

<code id="code-content" class="language-csharp">
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Data;
using CoinJar.Models;
namespace CoinJar.ViewModels;
public class ExpenseListViewModel : INotifyPropertyChanged
{
    // The real data. It is never reordered or filtered.
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = new();
    // The view the grid binds to: sorted, filtered and grouped
    public ICollectionView ExpensesView { get; }
    public string[] CategoryFilters { get; } = { "All", "Food", "Transport", "Bills", "Fun", "Other" };
    private string _searchText = "";
    public string SearchText
    {
        get =&gt; _searchText;
        set { _searchText = value; OnPropertyChanged(); ExpensesView.Refresh(); }
    }
    private string _selectedCategory = "All";
    public string SelectedCategory
    {
        get =&gt; _selectedCategory;
        set { _selectedCategory = value; OnPropertyChanged(); ExpensesView.Refresh(); }
    }
    private bool _groupByCategory;
    public bool GroupByCategory
    {
        get =&gt; _groupByCategory;
        set
        {
            _groupByCategory = value;
            OnPropertyChanged();
            ExpensesView.GroupDescriptions.Clear();
            if (value)
                ExpensesView.GroupDescriptions.Add(new PropertyGroupDescription(nameof(Expense.Category)));
        }
    }
    public ExpenseListViewModel()
    {
        Expenses.Add(new Expense { Id = 1, Title = "Groceries", Amount = 42.80m, Category = "Food", Date = DateTime.Today.AddDays(-2) });
        Expenses.Add(new Expense { Id = 2, Title = "Bus pass", Amount = 30.00m, Category = "Transport", Date = DateTime.Today.AddDays(-5) });
        Expenses.Add(new Expense { Id = 3, Title = "Electricity", Amount = 64.15m, Category = "Bills", Date = DateTime.Today.AddDays(-9) });
        Expenses.Add(new Expense { Id = 4, Title = "Cinema", Amount = 18.50m, Category = "Fun", Date = DateTime.Today });
        Expenses.Add(new Expense { Id = 5, Title = "Lunch", Amount = 9.90m, Category = "Food", Date = DateTime.Today.AddDays(-1) });
        Expenses.Add(new Expense { Id = 6, Title = "Taxi", Amount = 22.00m, Category = "Transport", Date = DateTime.Today.AddDays(-3) });
        ExpensesView = CollectionViewSource.GetDefaultView(Expenses);
        // Newest first
        ExpensesView.SortDescriptions.Add(new SortDescription(nameof(Expense.Date), ListSortDirection.Descending));
        // One filter method that looks at every input
        ExpensesView.Filter = FilterExpense;
        // Re sort automatically when a date is edited
        if (ExpensesView is ICollectionViewLiveShaping live &amp;&amp; live.CanChangeLiveSorting)
        {
            live.LiveSortingProperties.Add(nameof(Expense.Date));
            live.IsLiveSorting = true;
        }
    }
    private bool FilterExpense(object item)
    {
        var e = (Expense)item;
        bool categoryOk = SelectedCategory == "All" || e.Category == SelectedCategory;
        bool textOk = string.IsNullOrWhiteSpace(SearchText)
            || e.Title.Contains(SearchText, StringComparison.OrdinalIgnoreCase);
        return categoryOk &amp;&amp; textOk;
    }
    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null)
        =&gt; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
// Converters/GroupTotalConverter.cs
using System.Globalization;
using System.Windows.Data;
using CoinJar.Models;
namespace CoinJar.Converters;
// Adds up the amounts of the items in one group
public class GroupTotalConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        =&gt; value is IEnumerable&lt;object&gt; items ? items.OfType&lt;Expense&gt;().Sum(e =&gt; e.Amount) : 0m;
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        =&gt; throw new NotSupportedException();
}
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:conv="clr-namespace:CoinJar.Converters"
        Title="CoinJar" Height="480" Width="720"&gt;
    &lt;Window.Resources&gt;
        &lt;conv:GroupTotalConverter x:Key="GroupTotal" /&gt;
    &lt;/Window.Resources&gt;
    &lt;DockPanel Margin="12"&gt;
        &lt;!-- Filter bar --&gt;
        &lt;StackPanel DockPanel.Dock="Top" Orientation="Horizontal" Margin="0,0,0,8"&gt;
            &lt;TextBlock Text="Search:" VerticalAlignment="Center" Margin="0,0,6,0" /&gt;
            &lt;TextBox Width="180" Text="{Binding SearchText, UpdateSourceTrigger=PropertyChanged}" /&gt;
            &lt;TextBlock Text="Category:" VerticalAlignment="Center" Margin="16,0,6,0" /&gt;
            &lt;ComboBox Width="120" ItemsSource="{Binding CategoryFilters}" SelectedItem="{Binding SelectedCategory}" /&gt;
            &lt;CheckBox Content="Group by category" IsChecked="{Binding GroupByCategory}"
                      VerticalAlignment="Center" Margin="16,0,0,0" /&gt;
        &lt;/StackPanel&gt;
        &lt;DataGrid ItemsSource="{Binding ExpensesView}" AutoGenerateColumns="False"
                  HeadersVisibility="Column" IsReadOnly="True"
                  VirtualizingPanel.IsVirtualizingWhenGrouping="True"&gt;
            &lt;DataGrid.Columns&gt;
                &lt;DataGridTextColumn Header="Title" Binding="{Binding Title}" Width="*" /&gt;
                &lt;DataGridTextColumn Header="Category" Binding="{Binding Category}" Width="110" /&gt;
                &lt;DataGridTextColumn Header="Date" Binding="{Binding Date, StringFormat=d}" Width="110" /&gt;
                &lt;DataGridTextColumn Header="Amount" Binding="{Binding Amount, StringFormat=C}" Width="100" /&gt;
            &lt;/DataGrid.Columns&gt;
            &lt;!-- How a group header looks. DataContext is a CollectionViewGroup. --&gt;
            &lt;DataGrid.GroupStyle&gt;
                &lt;GroupStyle&gt;
                    &lt;GroupStyle.HeaderTemplate&gt;
                        &lt;DataTemplate&gt;
                            &lt;TextBlock FontWeight="Bold" Margin="4,8,0,2"&gt;
                                &lt;Run Text="{Binding Name, Mode=OneWay}" /&gt;
                                &lt;Run Text="{Binding ItemCount, Mode=OneWay, StringFormat=' ({0} items, '}" /&gt;
                                &lt;Run Text="{Binding Items, Mode=OneWay, Converter={StaticResource GroupTotal}, StringFormat=C}" /&gt;
                                &lt;Run Text=")" /&gt;
                            &lt;/TextBlock&gt;
                        &lt;/DataTemplate&gt;
                    &lt;/GroupStyle.HeaderTemplate&gt;
                &lt;/GroupStyle&gt;
            &lt;/DataGrid.GroupStyle&gt;
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
// Models/Expense.cs
using System.ComponentModel;
using System.Runtime.CompilerServices;
namespace CoinJar.Models;
public class Expense : INotifyPropertyChanged
{
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
