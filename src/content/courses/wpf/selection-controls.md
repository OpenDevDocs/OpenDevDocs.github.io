---
publishDate: 2026-10-25T20:17
title: 'ComboBox, ListBox, Slider and DatePicker'
slug: selection-controls
metadescription: 'Learn the WPF controls for choosing values: ComboBox and ListBox with SelectedItem and SelectionChanged, Slider for numbers in a range, and DatePicker for dates.'
updateDate: 2026-10-25T20:17
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'controls', 'combobox', 'listbox', 'datepicker']
course: wpf
---

## Choosing instead of typing

Typing is slow and easy to get wrong. When the user should pick from a known set of values, a selection control is faster and safer:

| Control | Use it to pick |
| --- | --- |
| `ComboBox` | One item from a drop down list. Saves space. |
| `ListBox` | One or more items from a list that is always visible. |
| `Slider` | A number in a range, by dragging a thumb. |
| `DatePicker` | A date, from a pop up calendar. |

In this lesson you will finish the CoinJar "add expense" form. The category becomes a `ComboBox`, the date a `DatePicker`, and added expenses appear in a `ListBox`. As in the earlier control lessons, everything is wired up in code-behind with `x:Name`. In [Binding to Collections](/courses/wpf/binding-to-collections) you will replace much of this code with data binding.

## What ComboBox and ListBox have in common

`ComboBox` and `ListBox` both come from the same base class, called `Selector`. A **selector** is a control that shows a list of items and remembers which one is selected. So they share these members:

- `Items`: the collection of items in the list.
- `ItemsSource`: an alternative way to fill the list, from any C# collection.
- `SelectedItem`: the selected item, or `null` if nothing is selected.
- `SelectedIndex`: the position of the selected item, counting from 0. It is `-1` when nothing is selected.
- `SelectionChanged`: the event that fires when the selection changes.

Learn them once on a `ComboBox` and they work the same on a `ListBox` (and later on the [DataGrid](/courses/wpf/the-datagrid-control)).

## ComboBox

A `ComboBox` shows the selected item and opens a drop down list when clicked.

### Items written in XAML

The simplest way is to list the items in XAML:

```xml
<ComboBox x:Name="CategoryCombo" SelectedIndex="0" Width="160">
    <ComboBoxItem Content="Food" />
    <ComboBoxItem Content="Transport" />
    <ComboBoxItem Content="Bills" />
    <ComboBoxItem Content="Fun" />
    <ComboBoxItem Content="Other" />
</ComboBox>
```

`SelectedIndex="0"` selects the first item at start up, so the box is never empty.

Watch out: here `SelectedItem` is a **`ComboBoxItem`**, not a `string`. To get the text, read its `Content`:

```csharp
var item = (ComboBoxItem)CategoryCombo.SelectedItem;
string category = (string)item.Content;
```

### Items from code with ItemsSource

Usually the items come from your C# code. Then set `ItemsSource` to a collection, such as an array or a `List<string>`:

```csharp
public MainWindow()
{
    InitializeComponent();

    CategoryCombo.ItemsSource = new[] { "Food", "Transport", "Bills", "Fun", "Other" };
    CategoryCombo.SelectedIndex = 0;
}
```

Now each item **is** a `string`, so `SelectedItem` is a string too:

```csharp
string? category = CategoryCombo.SelectedItem as string;
```

`as string` gives `null` instead of an exception when nothing is selected. That is why the result is `string?`.

You can fill a list with `Items.Add(...)` **or** with `ItemsSource`, but not both at once. Setting `ItemsSource` and then calling `Items.Add` throws an `InvalidOperationException`.

### Reacting to a new selection

```csharp
private void CategoryCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
{
    if (CategoryCombo.SelectedItem is string category)
    {
        StatusText.Text = $"Category: {category}";
    }
}
```

The `is string category` pattern checks the type and creates the variable in one step. `e.AddedItems` and `e.RemovedItems` also tell you exactly what changed.

### Editable combo boxes

With `IsEditable="True"`, the user can type a value that is not in the list, like "Gifts". Read what they typed from the `Text` property:

```xml
<ComboBox x:Name="CategoryCombo" IsEditable="True" />
```

```csharp
string category = CategoryCombo.Text.Trim();
```

## ListBox

A `ListBox` shows its items in a visible list. It scrolls by itself when there are many items, as you saw in [ScrollViewer and Viewbox](/courses/wpf/scrollviewer-and-viewbox).

```xml
<ListBox x:Name="ExpenseList" Height="160" SelectionChanged="ExpenseList_SelectionChanged" />
```

```csharp
ExpenseList.Items.Add("Lunch, 12.50");
ExpenseList.Items.Add("Bus ticket, 2.80");
```

### Showing your own objects

You can add any object to a list, not just strings. The list shows it by calling its `ToString()` method. So a class with a good `ToString()` override displays nicely:

```csharp
public class Expense
{
    public string Title { get; set; } = "";
    public decimal Amount { get; set; }

    public override string ToString() => $"{Title}: {Amount:C}";
}
```

```csharp
ExpenseList.Items.Add(new Expense { Title = "Lunch", Amount = 12.50m });

if (ExpenseList.SelectedItem is Expense expense)
{
    StatusText.Text = $"You picked {expense.Title}";
}
```

`SelectedItem` gives you back the real `Expense` object, not just its text. You will learn a much richer way to show objects, with several lines and colours per item, in [Data Templates](/courses/wpf/data-templates). Overriding methods like `ToString` is covered in [Polymorphism](/courses/c-sharp/polymorphism).

### Selecting several items

`SelectionMode` decides how many items the user can select:

- `Single` (default): one item at a time.
- `Multiple`: each click toggles an item on or off.
- `Extended`: like Windows Explorer. Click selects one, Ctrl+click adds or removes one, Shift+click selects a range.

With `Multiple` or `Extended`, read the `SelectedItems` collection:

```csharp
private void DeleteButton_Click(object sender, RoutedEventArgs e)
{
    // Copy the selection first: removing items changes SelectedItems while we loop
    var toRemove = ExpenseList.SelectedItems.Cast<object>().ToList();
    foreach (object item in toRemove)
    {
        ExpenseList.Items.Remove(item);
    }
}
```

The copy with `ToList()` matters. Removing items from a collection while you loop over that same collection throws an exception. `Cast<object>()` is a [LINQ](/courses/c-sharp/linq-fundamentals) method that turns the old style collection into one LINQ can work with.

## Slider

A `Slider` picks a number by dragging a thumb along a track:

```xml
<Slider x:Name="PeopleSlider"
        Minimum="1" Maximum="8" Value="1"
        TickFrequency="1" TickPlacement="BottomRight" IsSnapToTickEnabled="True"
        ValueChanged="PeopleSlider_ValueChanged" />
```

- `Minimum` and `Maximum`: the range. The default range is 0 to 10.
- `Value`: the current number. It is a `double`.
- `TickFrequency` and `TickPlacement`: draw small marks along the track.
- `IsSnapToTickEnabled="True"`: the thumb jumps to the nearest tick, so you get whole numbers here.
- `SmallChange` and `LargeChange`: how far the arrow keys and Page Up or Page Down move it.

```csharp
private void PeopleSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
{
    int people = (int)e.NewValue;
    PeopleText.Text = people == 1 ? "Just me" : $"Split between {people} people";
}
```

`e.OldValue` and `e.NewValue` give the value before and after the change. Note the generic event args type, `RoutedPropertyChangedEventArgs<double>`. See [Generics](/courses/c-sharp/generics) if the angle brackets are new to you.

Without snapping, `Value` can be any `double` such as `3.4172`, so round it (`Math.Round`) before showing it to the user.

## DatePicker

A `DatePicker` is a text box with a calendar button. The user can type a date or pick one from the pop up calendar.

```xml
<DatePicker x:Name="ExpenseDatePicker" SelectedDateFormat="Short"
            SelectedDateChanged="ExpenseDatePicker_SelectedDateChanged" />
```

The selected date is in `SelectedDate`, which is a `DateTime?` (a nullable `DateTime`), because the box can be empty:

```csharp
public MainWindow()
{
    InitializeComponent();

    ExpenseDatePicker.SelectedDate = DateTime.Today;    // start with today
    ExpenseDatePicker.DisplayDateEnd = DateTime.Today;  // no expenses in the future
}

private void SaveButton_Click(object sender, RoutedEventArgs e)
{
    if (ExpenseDatePicker.SelectedDate is DateTime date)
    {
        StatusText.Text = $"Date: {date:d}";
    }
    else
    {
        StatusText.Text = "Please pick a date.";
    }
}
```

Useful properties:

- `SelectedDateFormat`: `Short` (for example 25/10/2026) or `Long` (Sunday, 25 October 2026). The exact look follows the user's culture settings.
- `DisplayDateStart` and `DisplayDateEnd`: the first and last date the calendar allows.
- `BlackoutDates`: individual dates or ranges that cannot be picked.
- `IsTodayHighlighted`: marks today in the calendar (on by default).

If you want a calendar that is always visible instead of a pop up, use the `Calendar` control. It has the same `SelectedDate` and `DisplayDateStart` properties.

## Picking the right control

- A handful of options that should all be visible: radio buttons, from [Buttons, CheckBoxes and RadioButtons](/courses/wpf/buttons-and-toggle-controls).
- Many options, but the user picks one: `ComboBox`.
- The user needs to see the list, or pick several: `ListBox`.
- A number where the exact value does not matter much (volume, zoom, number of people): `Slider`. For an exact value such as a price, use a `TextBox`.
- A date: always a `DatePicker`. Never ask the user to type dates into a plain text box.

## Common mistakes

- **Casting `SelectedItem` to `string` when the items are `ComboBoxItem`s.** It throws an `InvalidCastException`. Either read `Content`, or fill the list from code with `ItemsSource`.
- **Forgetting that nothing may be selected.** `SelectedItem` can be `null` and `SelectedIndex` can be `-1`. Use `is` patterns or check first.
- **Mixing `Items.Add` and `ItemsSource`.** Pick one.
- **Removing items while looping over `SelectedItems`.** Copy to a list first.
- **`ValueChanged` crashing at start up.** Setting `Value` in XAML fires `ValueChanged` during `InitializeComponent`. Guard against controls that are still `null`.
- **Treating `SelectedDate` as a `DateTime`.** It is `DateTime?`. Check it has a value.

## Quick recap

- `ComboBox` and `ListBox` share `Items`, `ItemsSource`, `SelectedItem`, `SelectedIndex` and `SelectionChanged`.
- Items written as `ComboBoxItem` in XAML give `ComboBoxItem` objects. Items from `ItemsSource` give your own objects.
- Lists show objects with `ToString()`, and `SelectedItem` returns the real object.
- `ListBox.SelectionMode` can be `Single`, `Multiple` or `Extended`. Read `SelectedItems` for several.
- `Slider` picks a `double` between `Minimum` and `Maximum`. `IsSnapToTickEnabled` gives clean steps.
- `DatePicker.SelectedDate` is a `DateTime?`. Limit it with `DisplayDateStart` and `DisplayDateEnd`.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Width="760" Height="480" MinWidth="620" MinHeight="400" FontSize="13"&gt;
    &lt;Grid Margin="16" ColumnDefinitions="300,16,*"&gt;
        &lt;!-- Left: the add expense form --&gt;
        &lt;Grid Grid.Column="0" RowDefinitions="Auto,Auto,Auto,Auto,Auto,Auto,*" ColumnDefinitions="Auto,*"&gt;
            &lt;TextBlock Grid.Row="0" Text="Title" VerticalAlignment="Center" Margin="0,0,8,8" /&gt;
            &lt;TextBox x:Name="TitleBox" Grid.Row="0" Grid.Column="1" Padding="4" Margin="0,0,0,8" /&gt;
            &lt;TextBlock Grid.Row="1" Text="Amount" VerticalAlignment="Center" Margin="0,0,8,8" /&gt;
            &lt;TextBox x:Name="AmountBox" Grid.Row="1" Grid.Column="1" Padding="4" Margin="0,0,0,8" /&gt;
            &lt;!-- ComboBox filled from code with ItemsSource --&gt;
            &lt;TextBlock Grid.Row="2" Text="Category" VerticalAlignment="Center" Margin="0,0,8,8" /&gt;
            &lt;ComboBox x:Name="CategoryCombo" Grid.Row="2" Grid.Column="1" Margin="0,0,0,8" /&gt;
            &lt;!-- DatePicker: limited to today or earlier in the constructor --&gt;
            &lt;TextBlock Grid.Row="3" Text="Date" VerticalAlignment="Center" Margin="0,0,8,8" /&gt;
            &lt;DatePicker x:Name="ExpenseDatePicker" Grid.Row="3" Grid.Column="1" SelectedDateFormat="Short" Margin="0,0,0,8" /&gt;
            &lt;!-- Slider: split the bill between 1 and 8 people, whole numbers only --&gt;
            &lt;TextBlock Grid.Row="4" Text="Split" VerticalAlignment="Center" Margin="0,0,8,0" /&gt;
            &lt;Slider x:Name="PeopleSlider" Grid.Row="4" Grid.Column="1" Minimum="1" Maximum="8" Value="1"
                    TickFrequency="1" TickPlacement="BottomRight" IsSnapToTickEnabled="True"
                    ValueChanged="PeopleSlider_ValueChanged" /&gt;
            &lt;TextBlock x:Name="PeopleText" Grid.Row="5" Grid.Column="1" Text="Just me" Foreground="DimGray" Margin="0,2,0,12" /&gt;
            &lt;StackPanel Grid.Row="6" Grid.ColumnSpan="2"&gt;
                &lt;Button Content="_Add expense" IsDefault="True" Padding="16,4" HorizontalAlignment="Right" Click="AddButton_Click" /&gt;
                &lt;TextBlock x:Name="StatusText" TextWrapping="Wrap" Margin="0,12,0,0" Foreground="DimGray" /&gt;
            &lt;/StackPanel&gt;
        &lt;/Grid&gt;
        &lt;!-- Right: the list of expenses --&gt;
        &lt;DockPanel Grid.Column="2"&gt;
            &lt;DockPanel DockPanel.Dock="Top" Margin="0,0,0,8"&gt;
                &lt;TextBlock Text="Show" VerticalAlignment="Center" Margin="0,0,8,0" /&gt;
                &lt;ComboBox x:Name="FilterCombo" Width="140" HorizontalAlignment="Left"
                          SelectionChanged="FilterCombo_SelectionChanged" /&gt;
            &lt;/DockPanel&gt;
            &lt;DockPanel DockPanel.Dock="Bottom" Margin="0,8,0,0"&gt;
                &lt;Button DockPanel.Dock="Right" Content="_Delete selected" Padding="12,4" Click="DeleteButton_Click" /&gt;
                &lt;TextBlock x:Name="TotalText" VerticalAlignment="Center" FontWeight="SemiBold" /&gt;
            &lt;/DockPanel&gt;
            &lt;!-- Extended: Ctrl+click and Shift+click select several items --&gt;
            &lt;ListBox x:Name="ExpenseList" SelectionMode="Extended" SelectionChanged="ExpenseList_SelectionChanged" /&gt;
        &lt;/DockPanel&gt;
    &lt;/Grid&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using CoinJar.Models;
namespace CoinJar;
public partial class MainWindow : Window
{
    private static readonly string[] Categories = ["Food", "Transport", "Bills", "Fun", "Other"];
    // All expenses live here. The ListBox only shows the ones that match the filter.
    private readonly List&lt;Expense&gt; _expenses = [];
    private int _nextId = 1;
    public MainWindow()
    {
        InitializeComponent();
        // Fill the combo boxes from code, so SelectedItem is a plain string
        CategoryCombo.ItemsSource = Categories;
        CategoryCombo.SelectedIndex = 0;
        FilterCombo.ItemsSource = new[] { "All" }.Concat(Categories).ToList();
        FilterCombo.SelectedIndex = 0;
        // Start with today, and do not allow future dates
        ExpenseDatePicker.SelectedDate = DateTime.Today;
        ExpenseDatePicker.DisplayDateEnd = DateTime.Today;
    }
    private void PeopleSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs&lt;double&gt; e)
    {
        // Value="1" in XAML fires this during InitializeComponent, before PeopleText exists
        if (PeopleText is null) return;
        int people = (int)e.NewValue;
        PeopleText.Text = people == 1 ? "Just me" : $"Split between {people} people";
    }
    private void AddButton_Click(object sender, RoutedEventArgs e)
    {
        if (TitleBox.Text.Trim().Length == 0)
        {
            StatusText.Text = "Please type a title.";
            return;
        }
        if (!decimal.TryParse(AmountBox.Text, NumberStyles.Number, CultureInfo.CurrentCulture, out decimal amount) || amount &lt;= 0)
        {
            StatusText.Text = "The amount must be a positive number.";
            return;
        }
        if (CategoryCombo.SelectedItem is not string category)
        {
            StatusText.Text = "Please pick a category.";
            return;
        }
        if (ExpenseDatePicker.SelectedDate is not DateTime date)
        {
            StatusText.Text = "Please pick a date.";
            return;
        }
        // Your share of the bill
        int people = (int)PeopleSlider.Value;
        var expense = new Expense
        {
            Id = _nextId++,
            Title = TitleBox.Text.Trim(),
            Amount = Math.Round(amount / people, 2),
            Category = category,
            Date = date
        };
        _expenses.Add(expense);
        StatusText.Text = $"Added {expense.Title} ({expense.Amount:C}).";
        TitleBox.Clear();
        AmountBox.Clear();
        PeopleSlider.Value = 1;
        TitleBox.Focus();
        RefreshList();
    }
    private void FilterCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        RefreshList();
    }
    private void ExpenseList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        // SelectedItem is the real Expense object, not just its text
        if (ExpenseList.SelectedItems.Count == 1 &amp;&amp; ExpenseList.SelectedItem is Expense expense)
        {
            StatusText.Text = $"#{expense.Id} {expense.Title}, {expense.Category}, {expense.Date:D}";
        }
        else if (ExpenseList.SelectedItems.Count &gt; 1)
        {
            StatusText.Text = $"{ExpenseList.SelectedItems.Count} expenses selected.";
        }
    }
    private void DeleteButton_Click(object sender, RoutedEventArgs e)
    {
        // Copy the selection first, because we change the data while looping
        var toRemove = ExpenseList.SelectedItems.Cast&lt;Expense&gt;().ToList();
        foreach (Expense expense in toRemove)
        {
            _expenses.Remove(expense);
        }
        StatusText.Text = $"Deleted {toRemove.Count} expense(s).";
        RefreshList();
    }
    private void RefreshList()
    {
        string filter = FilterCombo.SelectedItem as string ?? "All";
        ExpenseList.Items.Clear();
        decimal total = 0;
        foreach (Expense expense in _expenses.OrderByDescending(x =&gt; x.Date))
        {
            if (filter == "All" || expense.Category == filter)
            {
                ExpenseList.Items.Add(expense); // shown with Expense.ToString()
                total += expense.Amount;
            }
        }
        TotalText.Text = $"Total: {total:C}";
    }
}
// Models/Expense.cs
namespace CoinJar.Models;
public class Expense
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public decimal Amount { get; set; }
    public string Category { get; set; } = "";
    public DateTime Date { get; set; }
    // The ListBox calls ToString() to decide what text to show.
    // {0:C} formats money in the user's culture, for example 12.50 with the local currency symbol.
    public override string ToString() =&gt; $"{Date:d}  {Title} ({Category})  {Amount:C}";
}
</code></pre>
