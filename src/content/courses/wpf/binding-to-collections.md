---
publishDate: 2026-10-25T20:24
title: 'Binding to Collections with ObservableCollection'
slug: binding-to-collections
metadescription: 'Show lists of data with ItemsSource, keep the screen in step with ObservableCollection, bind SelectedItem for a master and detail view, and keep a live total in the CoinJar expense list.'
updateDate: 2026-10-25T20:24
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'data-binding', 'observablecollection', 'listbox']
course: wpf
---

## From one expense to many

So far CoinJar has edited a single `Expense`. A real expense tracker needs a list: every coffee, bus ticket and bill. In this lesson you will:

- show a list of expenses with `ItemsSource`,
- make the list update itself when you add or remove items,
- show the details of whichever expense is selected,
- keep a total that is always correct.

You already know `ListBox` and `ComboBox` from [ComboBox, ListBox, Slider and DatePicker](/courses/wpf/selection-controls), and you know how a single object announces changes from [INotifyPropertyChanged](/courses/wpf/inotifypropertychanged). Now we put them together.

## ItemsSource: hand the list to the control

Until now you added items one by one with `ExpenseList.Items.Add(...)`. With binding you give the control a whole collection instead, through the `ItemsSource` property:

```xml
<ListBox ItemsSource="{Binding Expenses}" />
```

Every control that shows a list of items supports `ItemsSource`: `ListBox`, `ComboBox`, `ListView`, `DataGrid`, `TabControl`, `Menu` and the plain `ItemsControl`. They all inherit it from the same base class, `ItemsControl`.

One rule: use either `Items.Add` or `ItemsSource`, never both on the same control. Setting `ItemsSource` while `Items` already has entries throws an error.

## Where does the list live?

The window needs one object to bind to, and it should hold the list plus anything else the screen shows, such as the total. Create a `ViewModels` folder and add this class:

```csharp
using System.Collections.ObjectModel;
using CoinJar.Models;

namespace CoinJar.ViewModels;

public class ExpenseListViewModel : BindableBase
{
    public ObservableCollection<Expense> Expenses { get; } = new();
}
```

A **view model** is simply a class that holds the data for one screen. The name will make full sense in [Introduction to MVVM](/courses/wpf/introduction-to-mvvm). For now, think of it as "the window's data". It inherits `BindableBase` from the last lesson, so it can announce its own property changes too.

In the window:

```csharp
public partial class MainWindow : Window
{
    private readonly ExpenseListViewModel _vm = new();

    public MainWindow()
    {
        InitializeComponent();
        DataContext = _vm;
    }
}
```

## Why not List of T?

You might try a normal `List<Expense>` first. It shows the items when the window opens. But add a new expense later with `Expenses.Add(...)` and the screen does not change.

The reason is the same as last lesson, one level up. `INotifyPropertyChanged` announces "a property changed". A list needs to announce "an item was added" or "an item was removed". That is a different interface, `INotifyCollectionChanged`, and `List<T>` does not implement it.

`ObservableCollection<T>` does. It works like a `List<T>` (`Add`, `Remove`, `Insert`, `Clear`, indexing, `foreach`) and also raises a `CollectionChanged` event after every change. WPF listens and updates only the rows that changed.

```text
List<T>                   ObservableCollection<T>
  Add(x)  -> silence        Add(x)  -> "item added at 3"
  Remove  -> silence        Remove  -> "item removed at 1"
                            Clear() -> "everything reset"
```

You will find it in `System.Collections.ObjectModel`. If `List<T>` itself is new to you, see [List of T](/courses/c-sharp/list-t).

### Two kinds of change

Keep these two apart, because they are handled by different interfaces:

| Change | Who announces it |
| --- | --- |
| An item is added, removed or moved | `ObservableCollection<T>` (via `INotifyCollectionChanged`) |
| A property of one item changes, such as its `Amount` | The item itself (via `INotifyPropertyChanged`) |

`ObservableCollection<T>` does **not** tell anyone when a property inside an item changes. That is the item's job. This is why `Expense` inherits `BindableBase`.

## Showing something useful for each item

Bind a `ListBox` to a collection of `Expense` objects and each row says `CoinJar.Models.Expense`. WPF does not know which property to show, so it calls `ToString()`.

The quick fix is `DisplayMemberPath`, which names one property to show:

```xml
<ListBox ItemsSource="{Binding Expenses}" DisplayMemberPath="Summary" />
```

Now each row shows the `Summary` property, like "Lunch (Food)". For rows with several pieces, such as a title on the left and an amount on the right, you need a **data template**. That is the topic of [Data Templates](/courses/wpf/data-templates), two lessons from now.

## The selected item

`ListBox.SelectedItem` is the object behind the selected row. It binds two ways by default, so add a property for it on the view model:

```csharp
private Expense? _selectedExpense;
public Expense? SelectedExpense
{
    get => _selectedExpense;
    set => SetProperty(ref _selectedExpense, value);
}
```

```xml
<ListBox ItemsSource="{Binding Expenses}"
         DisplayMemberPath="Summary"
         SelectedItem="{Binding SelectedExpense}" />
```

The type is `Expense?` because nothing may be selected. When the user clicks a row, WPF sets `SelectedExpense`. When your code sets `SelectedExpense`, the list selects that row.

### Master and detail

Now the fun part. Put an edit form next to the list and bind it to the selected expense:

```xml
<StackPanel DataContext="{Binding SelectedExpense}">
    <TextBox Text="{Binding Title, UpdateSourceTrigger=PropertyChanged}" />
    <TextBox Text="{Binding Amount}" />
</StackPanel>
```

Setting `DataContext` on the `StackPanel` means every binding inside it reads from the selected expense. Click a row and the form shows that expense. Type a new title and the row in the list changes as you type, because `Expense` announces the change and the `ListBox` row is bound to it too.

This "list on the left, details on the right" layout is called **master and detail**. You get it with almost no code.

When nothing is selected, `SelectedExpense` is `null` and the form is empty. You can hide it with a trigger or converter later. For now, the code panel wraps the form in a `Border` whose `IsEnabled` is bound to a `HasSelection` property on the view model. The `Border` sits outside the form's `DataContext`, so it can still see the view model.

## Adding and removing items

Add and remove through the collection. The screen follows by itself:

```csharp
public void AddExpense()
{
    var expense = new Expense
    {
        Id = Expenses.Count + 1,
        Title = "New expense",
        Category = "Other",
        Date = DateTime.Today
    };
    Expenses.Add(expense);
    SelectedExpense = expense;   // select it so the user can edit at once
}

public void DeleteSelected()
{
    if (SelectedExpense is not null)
        Expenses.Remove(SelectedExpense);
}
```

The buttons call these methods from code-behind:

```csharp
private void Add_Click(object sender, RoutedEventArgs e) => _vm.AddExpense();
private void Delete_Click(object sender, RoutedEventArgs e) => _vm.DeleteSelected();
```

Later, [Commands and ICommand](/courses/wpf/commands-and-icommand) will let you bind buttons straight to the view model without these handlers.

## A total that is always right

The window should show the sum of all amounts. A computed property is easy:

```csharp
public decimal Total => Expenses.Sum(e => e.Amount);
```

`Sum` comes from [LINQ](/courses/c-sharp/linq-fundamentals). The hard part is knowing *when* to announce that `Total` changed. Two different things can change it:

1. An item is added or removed. The collection raises `CollectionChanged`.
2. An item's `Amount` is edited. That item raises `PropertyChanged`.

So the view model listens to both:

```csharp
public ExpenseListViewModel()
{
    Expenses.CollectionChanged += Expenses_CollectionChanged;
}

private void Expenses_CollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
{
    // Start listening to new items, stop listening to removed ones
    if (e.NewItems is not null)
        foreach (Expense item in e.NewItems)
            item.PropertyChanged += Expense_PropertyChanged;

    if (e.OldItems is not null)
        foreach (Expense item in e.OldItems)
            item.PropertyChanged -= Expense_PropertyChanged;

    OnPropertyChanged(nameof(Total));
}

private void Expense_PropertyChanged(object? sender, PropertyChangedEventArgs e)
{
    if (e.PropertyName == nameof(Expense.Amount))
        OnPropertyChanged(nameof(Total));
}
```

Unsubscribing with `-=` matters. Otherwise a deleted expense could still poke the view model, and it would never be cleaned up from memory.

Then bind it like any other property:

```xml
<TextBlock Text="{Binding Total, StringFormat='Total: {0:C}'}" FontWeight="SemiBold" />
```

### The count is free

`ObservableCollection<T>` also announces its own `Count` property, so this updates with no extra code:

```xml
<TextBlock Text="{Binding Expenses.Count, StringFormat='{}{0} expenses'}" />
```

## A list for the ComboBox too

The category picker is a list as well. A fixed array is enough, because the categories never change while the app runs:

```csharp
public string[] Categories { get; } = { "Food", "Transport", "Bills", "Fun", "Other" };
```

```xml
<ComboBox ItemsSource="{Binding DataContext.Categories,
                        RelativeSource={RelativeSource AncestorType=Window}}"
          SelectedItem="{Binding Category}" />
```

Inside the detail form the `DataContext` is the selected `Expense`, which has no `Categories` property. `RelativeSource` with `AncestorType=Window` climbs up to the window and uses *its* `DataContext`, the view model. It is a common pattern whenever an inner area needs something from the outer one.

## Common mistakes

- **Using `List<T>`.** Items added later never appear. Use `ObservableCollection<T>`.
- **Replacing the whole collection.** `Expenses = new ObservableCollection<Expense>(...)` breaks the link unless the property raises `PropertyChanged`. It is simpler to keep one collection (a get only property, as above) and call `Clear()` and `Add()`.
- **Changing the collection from a background thread.** `ObservableCollection<T>` must be changed on the UI thread, or WPF throws an error. See [The Dispatcher and Threading](/courses/wpf/the-dispatcher-and-threading).
- **Expecting the collection to report item edits.** It reports adds and removes only. Item edits come from the item's own `PropertyChanged`.
- **Mixing `Items.Add` with `ItemsSource`.** Pick one. With binding, always change the collection, not `Items`.
- **Adding thousands of items one by one.** Each `Add` updates the screen. For a big load, build a `List<T>` first and then create the collection from it before setting `DataContext`.

## Quick recap

- `ItemsSource` gives a whole collection to any list control.
- `ObservableCollection<T>` announces adds and removes, so the screen stays in step. `List<T>` does not.
- Item property changes come from the item's own `INotifyPropertyChanged`.
- `DisplayMemberPath` picks one property to show per row. Data templates do more.
- Bind `SelectedItem` to a view model property and set a panel's `DataContext` to it for master and detail.
- Recalculate totals on both `CollectionChanged` and item `PropertyChanged`, and unsubscribe from removed items.
- `RelativeSource AncestorType=Window` reaches the window's `DataContext` from inside a nested one.
- Next, learn to turn values into colours, visibility and more in [Value Converters](/courses/wpf/value-converters).

<code id="code-content" class="language-csharp">
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.ComponentModel;
using CoinJar.Models;
namespace CoinJar.ViewModels;
// The data for the main window: the list, the selection and the total
public class ExpenseListViewModel : BindableBase
{
    private Expense? _selectedExpense;
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = new();
    public string[] Categories { get; } = { "Food", "Transport", "Bills", "Fun", "Other" };
    public Expense? SelectedExpense
    {
        get =&gt; _selectedExpense;
        set
        {
            if (SetProperty(ref _selectedExpense, value))
                OnPropertyChanged(nameof(HasSelection));
        }
    }
    // Used to enable the detail form only when a row is selected
    public bool HasSelection =&gt; SelectedExpense is not null;
    public decimal Total =&gt; Expenses.Sum(e =&gt; e.Amount);
    public ExpenseListViewModel()
    {
        Expenses.CollectionChanged += Expenses_CollectionChanged;
        // Some sample data so the window is not empty
        Expenses.Add(new Expense { Id = 1, Title = "Lunch", Amount = 8.50m, Category = "Food" });
        Expenses.Add(new Expense { Id = 2, Title = "Bus pass", Amount = 30.00m, Category = "Transport" });
        Expenses.Add(new Expense { Id = 3, Title = "Electricity", Amount = 64.20m, Category = "Bills" });
    }
    public void AddExpense()
    {
        var expense = new Expense
        {
            Id = Expenses.Count == 0 ? 1 : Expenses.Max(e =&gt; e.Id) + 1,
            Title = "New expense",
            Category = "Other",
            Date = DateTime.Today
        };
        Expenses.Add(expense);
        SelectedExpense = expense; // select it so the user can edit straight away
    }
    public void DeleteSelected()
    {
        if (SelectedExpense is not null)
            Expenses.Remove(SelectedExpense);
    }
    private void Expenses_CollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        // Listen to new items and stop listening to removed ones
        if (e.NewItems is not null)
            foreach (Expense item in e.NewItems)
                item.PropertyChanged += Expense_PropertyChanged;
        if (e.OldItems is not null)
            foreach (Expense item in e.OldItems)
                item.PropertyChanged -= Expense_PropertyChanged;
        OnPropertyChanged(nameof(Total));
    }
    private void Expense_PropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(Expense.Amount))
            OnPropertyChanged(nameof(Total));
    }
}
// Models/BindableBase.cs
using System.ComponentModel;
using System.Runtime.CompilerServices;
namespace CoinJar.Models;
public abstract class BindableBase : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        =&gt; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    protected bool SetProperty&lt;T&gt;(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer&lt;T&gt;.Default.Equals(field, value)) return false;
        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }
}
// Models/Expense.cs
namespace CoinJar.Models;
public class Expense : BindableBase
{
    private string _title = "";
    private decimal _amount;
    private string _category = "Other";
    private DateTime _date = DateTime.Today;
    public int Id { get; set; }
    public string Title
    {
        get =&gt; _title;
        set { if (SetProperty(ref _title, value)) OnPropertyChanged(nameof(Summary)); }
    }
    public decimal Amount
    {
        get =&gt; _amount;
        set =&gt; SetProperty(ref _amount, value);
    }
    public string Category
    {
        get =&gt; _category;
        set { if (SetProperty(ref _category, value)) OnPropertyChanged(nameof(Summary)); }
    }
    public DateTime Date
    {
        get =&gt; _date;
        set =&gt; SetProperty(ref _date, value);
    }
    public string Summary =&gt; $"{Title} ({Category})";
}
// MainWindow.xaml.cs
using System.Windows;
using CoinJar.ViewModels;
namespace CoinJar;
public partial class MainWindow : Window
{
    private readonly ExpenseListViewModel _vm = new();
    public MainWindow()
    {
        InitializeComponent();
        DataContext = _vm;
    }
    private void Add_Click(object sender, RoutedEventArgs e) =&gt; _vm.AddExpense();
    private void Delete_Click(object sender, RoutedEventArgs e) =&gt; _vm.DeleteSelected();
}
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Width="640" Height="420"&gt;
    &lt;DockPanel Margin="12"&gt;
        &lt;!-- Total and count update by themselves --&gt;
        &lt;StackPanel DockPanel.Dock="Bottom" Orientation="Horizontal" Margin="0,8,0,0"&gt;
            &lt;TextBlock Text="{Binding Total, StringFormat='Total: {0:C}'}" FontWeight="SemiBold" /&gt;
            &lt;TextBlock Text="{Binding Expenses.Count, StringFormat='{}{0} expenses'}"
                       Margin="16,0,0,0" Foreground="Gray" /&gt;
        &lt;/StackPanel&gt;
        &lt;StackPanel DockPanel.Dock="Bottom" Orientation="Horizontal" Margin="0,8,0,0"&gt;
            &lt;Button Content="Add" Click="Add_Click" Padding="12,4" /&gt;
            &lt;Button Content="Delete" Click="Delete_Click" Padding="12,4" Margin="8,0,0,0" /&gt;
        &lt;/StackPanel&gt;
        &lt;Grid&gt;
            &lt;Grid.ColumnDefinitions&gt;
                &lt;ColumnDefinition Width="*" /&gt;
                &lt;ColumnDefinition Width="*" /&gt;
            &lt;/Grid.ColumnDefinitions&gt;
            &lt;!-- Master: the list --&gt;
            &lt;ListBox ItemsSource="{Binding Expenses}"
                     DisplayMemberPath="Summary"
                     SelectedItem="{Binding SelectedExpense}" /&gt;
            &lt;!-- Detail: bound to whichever expense is selected.
                 The Border still sees the view model, so it can read HasSelection. --&gt;
            &lt;Border Grid.Column="1" Margin="12,0,0,0" IsEnabled="{Binding HasSelection}"&gt;
            &lt;StackPanel DataContext="{Binding SelectedExpense}"&gt;
                &lt;TextBlock Text="Title" /&gt;
                &lt;TextBox Text="{Binding Title, UpdateSourceTrigger=PropertyChanged}" /&gt;
                &lt;TextBlock Text="Amount" Margin="0,8,0,0" /&gt;
                &lt;TextBox Text="{Binding Amount}" /&gt;
                &lt;TextBlock Text="Category" Margin="0,8,0,0" /&gt;
                &lt;ComboBox ItemsSource="{Binding DataContext.Categories, RelativeSource={RelativeSource AncestorType=Window}}"
                          SelectedItem="{Binding Category}" /&gt;
                &lt;TextBlock Text="Date" Margin="0,8,0,0" /&gt;
                &lt;DatePicker SelectedDate="{Binding Date}" /&gt;
            &lt;/StackPanel&gt;
            &lt;/Border&gt;
        &lt;/Grid&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
</code></pre>
