---
publishDate: 2026-10-25T20:36
title: 'Introduction to MVVM'
slug: introduction-to-mvvm
metadescription: 'Learn what the Model, View and ViewModel parts of MVVM are, why WPF apps use the pattern, and how to move CoinJar logic out of code-behind into a view model.'
updateDate: 2026-10-25T20:36
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'mvvm', 'architecture', 'viewmodel']
course: wpf
---

## Why your code-behind gets messy

Up to now most of the logic in CoinJar has lived in `MainWindow.xaml.cs`. A button click handler reads text boxes, creates an expense, adds it to a list and updates the total. That works for a small window, but it causes problems as the app grows:

- The logic is glued to the window. You cannot test "adding an expense updates the total" without opening a real window.
- Changing the look (for example swapping a `ListBox` for a `DataGrid`) means touching the logic too.
- Handlers grow long, because every small rule ends up in the window class.

**MVVM** (Model, View, ViewModel) is a pattern that splits this code into three parts with clear jobs. It is the standard way to build WPF apps, and the rest of this course uses it. The good news: you already know the two features MVVM is built on, [data binding](/courses/wpf/data-binding-basics) and [INotifyPropertyChanged](/courses/wpf/inotifypropertychanged).

## The three parts

Think of a restaurant:

- The **kitchen** holds the food and the recipes. That is the **Model**.
- The **dining room** is what guests see and touch. That is the **View**.
- The **waiter** carries orders between the two and knows what each table needs. That is the **ViewModel**.

In code:

| Part | What it is | CoinJar example |
| --- | --- | --- |
| Model | Plain C# classes for your data and business rules. No UI code. | `Expense`, later a service that saves expenses |
| View | XAML (plus a tiny bit of code-behind) that draws the screen | `MainWindow.xaml` |
| ViewModel | A C# class that holds the state of one screen and the actions it can do | `ExpenseListViewModel` |

The arrows only point one way:

```text
View  ---(bindings)--->  ViewModel  ---(calls)--->  Model
View  <--(PropertyChanged)-- ViewModel
```

The view knows its view model (through `DataContext`). The view model knows the model. The view model **never** knows the view: it has no reference to `MainWindow`, no `TextBox`, no `MessageBox`. It just exposes properties, and the bindings do the rest.

## Folder layout

A common layout for an MVVM project looks like this:

```text
CoinJar/
  Models/
    Expense.cs
  ViewModels/
    ViewModelBase.cs
    ExpenseListViewModel.cs
  Views/              (more screens later in the course)
  App.xaml
  MainWindow.xaml
```

Folders are only a convention. They become namespaces like `CoinJar.Models` and `CoinJar.ViewModels`, which keeps things easy to find.

## Step 1: the Model

The model is a normal class. It does not need to know that WPF exists.

```csharp
namespace CoinJar.Models;

public class Expense
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public decimal Amount { get; set; }
    public string Category { get; set; } = "Other";
    public DateTime Date { get; set; } = DateTime.Today;
}
```

If you need a refresher on properties, see [fields and properties](/courses/c-sharp/fields-and-properties) in the C# course.

## Step 2: a base class for view models

Every view model needs `INotifyPropertyChanged`, so it makes sense to write that code once. This small base class has a `SetProperty` helper that stores a new value and raises `PropertyChanged` only when the value really changed.

If you followed [INotifyPropertyChanged](/courses/wpf/inotifypropertychanged), this is the same idea as the `BindableBase` class from that lesson. We give it a new name here, `ViewModelBase`, and put it in the `ViewModels` folder, because from now on only view models inherit from it.

```csharp
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace CoinJar.ViewModels;

public abstract class ViewModelBase : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? name = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        OnPropertyChanged(name);
        return true;
    }
}
```

Two C# ideas are doing the work here:

- `SetProperty<T>` is a [generic](/courses/c-sharp/generics) method, so one helper works for `string`, `decimal`, `DateTime` and anything else.
- `[CallerMemberName]` is an [attribute](/courses/c-sharp/attributes) that makes the compiler fill in the name of the property that called the method. You never type `"NewTitle"` as a string, so a rename cannot break it.

## Step 3: the ViewModel

The view model holds everything the screen shows and everything the screen can do. For the main CoinJar window that is: the list of expenses, the fields of the "add" form, the list of categories and the total.

```csharp
public class ExpenseListViewModel : ViewModelBase
{
    private string _newTitle = "";
    private decimal _newAmount;
    private string _newCategory = "Food";

    public ObservableCollection<Expense> Expenses { get; } = [];
    public string[] Categories { get; } = ["Food", "Transport", "Bills", "Fun", "Other"];

    public string NewTitle
    {
        get => _newTitle;
        set => SetProperty(ref _newTitle, value);
    }

    public decimal NewAmount
    {
        get => _newAmount;
        set => SetProperty(ref _newAmount, value);
    }

    public string NewCategory
    {
        get => _newCategory;
        set => SetProperty(ref _newCategory, value);
    }

    public decimal Total => Expenses.Sum(e => e.Amount);
}
```

Notice what is **not** here: no `TextBox`, no `ListBox`, no `using System.Windows.Controls`. The view model describes the screen as data. `NewTitle` is "whatever the user typed in the title box", but the view model does not care that it is a text box.

`Total` is a calculated property. It has no setter, so we must tell WPF when it changes. The collection raises `CollectionChanged` whenever an item is added or removed, so we listen to that in the constructor:

```csharp
public ExpenseListViewModel()
{
    Expenses.CollectionChanged += (_, _) => OnPropertyChanged(nameof(Total));

    // A little sample data so the window is not empty
    Expenses.Add(new Expense { Id = 1, Title = "Coffee", Amount = 3.50m, Category = "Food" });
    Expenses.Add(new Expense { Id = 2, Title = "Bus ticket", Amount = 2.80m, Category = "Transport" });
}
```

The action "add an expense" becomes a normal method:

```csharp
public void AddExpense()
{
    if (string.IsNullOrWhiteSpace(NewTitle) || NewAmount <= 0) return;

    Expenses.Add(new Expense
    {
        Id = Expenses.Count + 1,
        Title = NewTitle.Trim(),
        Amount = NewAmount,
        Category = NewCategory
    });

    // Clear the form. The bindings update the text boxes for us.
    NewTitle = "";
    NewAmount = 0;
}
```

## Step 4: the View

The view only binds. Every `{Binding ...}` path is a property name on the view model.

```xml
<StackPanel Margin="16">
    <TextBlock Text="New expense" FontWeight="SemiBold" />
    <TextBox Text="{Binding NewTitle, UpdateSourceTrigger=PropertyChanged}" />
    <TextBox Text="{Binding NewAmount}" />
    <ComboBox ItemsSource="{Binding Categories}" SelectedItem="{Binding NewCategory}" />
    <Button Content="Add" Click="Add_Click" />

    <ListBox ItemsSource="{Binding Expenses}" DisplayMemberPath="Title" />
    <TextBlock Text="{Binding Total, StringFormat='Total: {0:C}'}" />
</StackPanel>
```

`{0:C}` formats the number as money using the current culture, so a UK user sees pounds and a US user sees dollars. You met this in [value converters](/courses/wpf/value-converters) and [data templates](/courses/wpf/data-templates).

## Step 5: connect the View to the ViewModel

The link between the two is the window's `DataContext`. You can set it in code-behind:

```csharp
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new ExpenseListViewModel();
    }
}
```

Or you can create it directly in XAML:

```xml
<Window x:Class="CoinJar.MainWindow"
        xmlns:vm="clr-namespace:CoinJar.ViewModels"
        ...>
    <Window.DataContext>
        <vm:ExpenseListViewModel />
    </Window.DataContext>
</Window>
```

Both work. The code-behind version is easier to change later, when the view model needs services passed into its constructor. You will do that properly in [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host).

### Design time data context

When you set `DataContext` in code, the Visual Studio designer does not know the type, so IntelliSense in bindings cannot help you. Add a design time hint. It is ignored when the app runs:

```xml
<Window ...
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        mc:Ignorable="d"
        d:DataContext="{d:DesignInstance Type=vm:ExpenseListViewModel}">
```

The `d` and `mc` namespaces are already in the window that `dotnet new wpf` creates.

## What about the button click?

There is one piece of glue left: the `Click="Add_Click"` handler. For now the handler just passes the work on to the view model:

```csharp
private void Add_Click(object sender, RoutedEventArgs e)
{
    ((ExpenseListViewModel)DataContext).AddExpense();
}
```

This is already much better than before, because the real logic lives in the view model. But the view still has to know the view model's type and call a method by hand. In the next lesson, [Commands and ICommand](/courses/wpf/commands-and-icommand), you replace this handler with a binding, and the code-behind becomes empty.

## Is code-behind now forbidden?

No. MVVM is about putting each piece of code in the right place, not about deleting code-behind at any cost. A good rule:

- **Logic about data or rules** (can this be saved? what is the total?) goes in the view model.
- **Logic about pixels** (focus this text box, start an animation, scroll to the end) can stay in code-behind, because it only concerns the view.

## A view model is easy to test

Because the view model has no UI, you can test it with plain code. No window has to open:

```csharp
var vm = new ExpenseListViewModel();
decimal before = vm.Total;

vm.NewTitle = "Lunch";
vm.NewAmount = 12m;
vm.AddExpense();

Console.WriteLine(vm.Total == before + 12m); // True
```

You will write real tests like this in [Unit Testing ViewModels](/courses/wpf/unit-testing-viewmodels).

## Common mistakes

- **Putting UI types in the view model.** If you see `using System.Windows.Controls;` or a `MessageBox.Show` in a view model, something has leaked. Dialogs get their own service in [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes).
- **Forgetting to raise PropertyChanged.** A property with a plain `{ get; set; }` will not update the screen when the view model changes it. Use `SetProperty`.
- **Using `List<T>` for lists.** The screen will not see added items. Use `ObservableCollection<T>`, as in [Binding to Collections](/courses/wpf/binding-to-collections).
- **Forgetting calculated properties.** `Total` depends on the collection, so you must raise `PropertyChanged` for it yourself when the collection changes.
- **Typing binding paths wrong.** A typo like `{Binding NewTitel}` fails silently. Check the Output window in Visual Studio for "BindingExpression path error".

## Quick recap

- MVVM splits a screen into a **Model** (data and rules), a **View** (XAML) and a **ViewModel** (screen state and actions).
- The view talks to the view model only through bindings and `DataContext`. The view model never references the view.
- A `ViewModelBase` with `SetProperty` keeps `INotifyPropertyChanged` code short.
- Calculated properties like `Total` need a manual `OnPropertyChanged` when their inputs change.
- Code-behind is fine for pure view work. Logic belongs in the view model, where it is easy to test.
- Next up: commands, so buttons can call the view model without a click handler.

<code id="code-content" class="language-csharp">
// ViewModels/ViewModelBase.cs
using System.ComponentModel;
using System.Runtime.CompilerServices;
namespace CoinJar.ViewModels;
// Shared INotifyPropertyChanged code for every view model
public abstract class ViewModelBase : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        =&gt; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    // Stores the value and raises PropertyChanged only when it really changed
    protected bool SetProperty&lt;T&gt;(ref T field, T value, [CallerMemberName] string? name = null)
    {
        if (EqualityComparer&lt;T&gt;.Default.Equals(field, value)) return false;
        field = value;
        OnPropertyChanged(name);
        return true;
    }
}
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using CoinJar.Models;
namespace CoinJar.ViewModels;
// The state and actions of the main CoinJar screen. No UI types in here.
public class ExpenseListViewModel : ViewModelBase
{
    private string _newTitle = "";
    private decimal _newAmount;
    private string _newCategory = "Food";
    public ExpenseListViewModel()
    {
        // Total is calculated, so tell the view when the list changes
        Expenses.CollectionChanged += (_, _) =&gt; OnPropertyChanged(nameof(Total));
        Expenses.Add(new Expense { Id = 1, Title = "Coffee", Amount = 3.50m, Category = "Food" });
        Expenses.Add(new Expense { Id = 2, Title = "Bus ticket", Amount = 2.80m, Category = "Transport" });
    }
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = [];
    public string[] Categories { get; } = ["Food", "Transport", "Bills", "Fun", "Other"];
    public string NewTitle
    {
        get =&gt; _newTitle;
        set =&gt; SetProperty(ref _newTitle, value);
    }
    public decimal NewAmount
    {
        get =&gt; _newAmount;
        set =&gt; SetProperty(ref _newAmount, value);
    }
    public string NewCategory
    {
        get =&gt; _newCategory;
        set =&gt; SetProperty(ref _newCategory, value);
    }
    public decimal Total =&gt; Expenses.Sum(e =&gt; e.Amount);
    public void AddExpense()
    {
        if (string.IsNullOrWhiteSpace(NewTitle) || NewAmount &lt;= 0) return;
        Expenses.Add(new Expense
        {
            Id = Expenses.Count + 1,
            Title = NewTitle.Trim(),
            Amount = NewAmount,
            Category = NewCategory
        });
        // Clear the form; the bindings update the text boxes
        NewTitle = "";
        NewAmount = 0;
    }
}
// Models/Expense.cs
namespace CoinJar.Models;
// Plain data class. It does not know WPF exists.
public class Expense
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public decimal Amount { get; set; }
    public string Category { get; set; } = "Other";
    public DateTime Date { get; set; } = DateTime.Today;
}
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        xmlns:vm="clr-namespace:CoinJar.ViewModels"
        mc:Ignorable="d"
        d:DataContext="{d:DesignInstance Type=vm:ExpenseListViewModel}"
        Title="CoinJar" Height="420" Width="420"&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;TextBlock Text="New expense" FontWeight="SemiBold" Margin="0,0,0,6" /&gt;
        &lt;TextBox Text="{Binding NewTitle, UpdateSourceTrigger=PropertyChanged}" Margin="0,0,0,6" /&gt;
        &lt;TextBox Text="{Binding NewAmount}" Margin="0,0,0,6" /&gt;
        &lt;ComboBox ItemsSource="{Binding Categories}" SelectedItem="{Binding NewCategory}" Margin="0,0,0,6" /&gt;
        &lt;!-- Still a click handler; the next lesson swaps it for a command --&gt;
        &lt;Button Content="Add" Click="Add_Click" HorizontalAlignment="Left" Padding="16,4" /&gt;
        &lt;ListBox ItemsSource="{Binding Expenses}" DisplayMemberPath="Title" Height="160" Margin="0,12,0,6" /&gt;
        &lt;TextBlock Text="{Binding Total, StringFormat='Total: {0:C}'}" FontWeight="Bold" /&gt;
    &lt;/StackPanel&gt;
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
        DataContext = new ExpenseListViewModel(); // connect View and ViewModel
    }
    // Thin glue: pass the work to the view model
    private void Add_Click(object sender, RoutedEventArgs e)
    {
        ((ExpenseListViewModel)DataContext).AddExpense();
    }
}
</code></pre>
