---
publishDate: 2026-10-25T20:38
title: 'MVVM with CommunityToolkit.Mvvm'
slug: mvvm-with-communitytoolkit-mvvm
metadescription: 'Replace hand written INotifyPropertyChanged and RelayCommand code with CommunityToolkit.Mvvm: ObservableObject, [ObservableProperty], [RelayCommand] and async commands.'
updateDate: 2026-10-25T20:38
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'mvvm', 'communitytoolkit', 'source-generators']
course: wpf
---

## Why use a toolkit?

In the last two lessons you wrote MVVM by hand: a `ViewModelBase` with `SetProperty`, a `RelayCommand`, and setters that call `RaiseCanExecuteChanged`. Doing it once is the best way to understand MVVM. Doing it in every app is boring, and every line of boilerplate is a place for a bug.

**CommunityToolkit.Mvvm** (often called the MVVM Toolkit) is a free, open source library from Microsoft and the .NET community that does this work for you. It gives you:

- `ObservableObject`: a ready made base class with `INotifyPropertyChanged` and `SetProperty`.
- `[ObservableProperty]`: an attribute that writes the property and its change notification for you.
- `[RelayCommand]`: an attribute that turns a method into a command property.
- `RelayCommand`, `AsyncRelayCommand` and their generic versions, for when you want to create commands yourself.
- A messenger for talking between view models, covered in [Messaging Between ViewModels](/courses/wpf/messaging-between-viewmodels).

The attributes work through **source generators**: compiler add-ons that write extra C# code while your project builds. You never see that code in your files, but it is compiled into your app. The C# course has a whole lesson on [source generators](/courses/c-sharp/source-generators) if you are curious how they work.

From this lesson onward, every CoinJar view model uses the toolkit.

## Install the package

From the project folder:

```bash
dotnet add package CommunityToolkit.Mvvm
```

In Visual Studio you can also right click the project, choose **Manage NuGet Packages**, and search for `CommunityToolkit.Mvvm`. Your `.csproj` gets a line like this:

```xml
<PackageReference Include="CommunityToolkit.Mvvm" Version="8.4.2" />
```

## ObservableObject and [ObservableProperty]

Here is one property written by hand, the way you did it before:

```csharp
private string _newTitle = "";

public string NewTitle
{
    get => _newTitle;
    set => SetProperty(ref _newTitle, value);
}
```

With the toolkit it becomes one line:

```csharp
using CommunityToolkit.Mvvm.ComponentModel;

namespace CoinJar.ViewModels;

public partial class ExpenseListViewModel : ObservableObject
{
    [ObservableProperty]
    public partial string NewTitle { get; set; } = "";
}
```

Three things matter here:

1. The class inherits from `ObservableObject`.
2. The class is `partial`. The generator writes the other half of the class in a hidden file, and C# joins the two halves.
3. The property is a **partial property**: you declare it, and the generator writes the body that stores the value and raises `PropertyChanged`.

Partial properties need C# 13 or newer. A .NET 10 project uses C# 14 by default, so this just works.

### The older field form

Many tutorials (and older projects) put the attribute on a private field instead:

```csharp
[ObservableProperty]
private string newTitle = "";   // generates a public NewTitle property
```

This still works, and the generator turns `newTitle` (or `_newTitle`) into a property called `NewTitle`. The partial property form is the newer, recommended style: you see the real property name in your code and it works better with other C# features. This course uses partial properties.

## Reacting when a property changes

Sometimes setting one property should do something else. The toolkit generates **partial methods** you can fill in. For a property called `NewTitle` you get `OnNewTitleChanging` and `OnNewTitleChanged`:

```csharp
partial void OnNewTitleChanged(string value)
{
    // Runs after NewTitle got a new value
    StatusText = value.Length > 40 ? "That title is quite long" : "";
}
```

You only write the ones you need. If you do not write them, they cost nothing.

### Dependent properties

When another property depends on this one, add `[NotifyPropertyChangedFor]`. The generator then raises `PropertyChanged` for both:

```csharp
[ObservableProperty]
[NotifyPropertyChangedFor(nameof(FormIsValid))]
public partial decimal NewAmount { get; set; }

public bool FormIsValid => !string.IsNullOrWhiteSpace(NewTitle) && NewAmount > 0;
```

## [RelayCommand]: commands from methods

Put `[RelayCommand]` on a method and the toolkit creates a command property for it. The name is the method name plus `Command`:

```csharp
using CommunityToolkit.Mvvm.Input;

[RelayCommand]
private void Delete(Expense? expense)    // generates DeleteCommand
{
    if (expense is not null) Expenses.Remove(expense);
}
```

The method has a parameter, so `DeleteCommand` is an `IRelayCommand<Expense>` and the `CommandParameter` from the view arrives as `expense`. The XAML does not change at all:

```xml
<Button Content="Delete"
        Command="{Binding DataContext.DeleteCommand, RelativeSource={RelativeSource AncestorType=Window}}"
        CommandParameter="{Binding}" />
```

### CanExecute

To add a "can it run?" check, name a method or property with `CanExecute`:

```csharp
[RelayCommand(CanExecute = nameof(CanAdd))]
private void Add()
{
    Expenses.Add(new Expense { Title = NewTitle.Trim(), Amount = NewAmount, Category = NewCategory });
    NewTitle = "";
    NewAmount = 0;
}

private bool CanAdd() => !string.IsNullOrWhiteSpace(NewTitle) && NewAmount > 0;
```

Remember the bug from [Commands and ICommand](/courses/wpf/commands-and-icommand): the button needs to be told when `CanAdd` might change. Instead of writing setters, add `[NotifyCanExecuteChangedFor]` to each input property:

```csharp
[ObservableProperty]
[NotifyCanExecuteChangedFor(nameof(AddCommand))]
public partial string NewTitle { get; set; } = "";

[ObservableProperty]
[NotifyCanExecuteChangedFor(nameof(AddCommand))]
public partial decimal NewAmount { get; set; }
```

Now every time `NewTitle` or `NewAmount` changes, `AddCommand` raises `CanExecuteChanged` and the button updates.

## Async commands

If the method returns a `Task`, the toolkit makes an **async command** (`IAsyncRelayCommand`). A trailing `Async` in the method name is dropped, so `LoadAsync` becomes `LoadCommand`:

```csharp
[RelayCommand]
private async Task LoadAsync()
{
    await Task.Delay(1000); // pretend to read from disk or the web
    Expenses.Add(new Expense { Title = "Cinema", Amount = 11m, Category = "Fun" });
}
```

An async command is much safer than `async void`:

- While the task runs, `LoadCommand.IsRunning` is `true`, so you can show a spinner.
- By default the command cannot run again until the first run finishes, so a double click does not load twice. Set `AllowConcurrentExecutions = true` if you want to allow it.
- With a `CancellationToken` parameter and `IncludeCancelCommand = true`, you also get a `LoadCancelCommand` for a Cancel button.

```xml
<Button Content="Load sample data" Command="{Binding LoadCommand}" />
<TextBlock Text="Loading..."
           Visibility="{Binding LoadCommand.IsRunning, Converter={StaticResource BoolToVisibility}}" />
```

`BoolToVisibility` is a `BooleanToVisibilityConverter` declared in resources, as in [Value Converters](/courses/wpf/value-converters). More on keeping the UI smooth in [Async, Await and a Responsive UI](/courses/wpf/async-await-and-a-responsive-ui) and the C# lesson on [async and await](/courses/c-sharp/async-and-await).

## The model becomes observable too

Until now, editing an expense in place (for example in a `DataGrid`) did not update the total, because `Expense` did not raise `PropertyChanged`. Make it an `ObservableObject` as well:

```csharp
public partial class Expense : ObservableObject
{
    public int Id { get; set; }

    [ObservableProperty]
    public partial string Title { get; set; } = "";

    [ObservableProperty]
    public partial decimal Amount { get; set; }

    [ObservableProperty]
    public partial string Category { get; set; } = "Other";

    [ObservableProperty]
    public partial DateTime Date { get; set; } = DateTime.Today;
}
```

Now the view model can listen to each expense's `PropertyChanged` and refresh `Total` when an amount is edited. The full version in the code panel does this.

## Before and after

| Hand written (lessons 37 and 38) | With the toolkit |
| --- | --- |
| `ViewModelBase` class you maintain | `ObservableObject` from the package |
| Field plus full property with `SetProperty` | `[ObservableProperty] public partial ...` |
| `RelayCommand` class you maintain | `[RelayCommand]` on a method |
| `AddCommand.RaiseCanExecuteChanged()` in setters | `[NotifyCanExecuteChangedFor(nameof(AddCommand))]` |
| `async void` handlers | `IAsyncRelayCommand` with `IsRunning` |

You can now delete `ViewModelBase.cs` and `RelayCommand.cs` from CoinJar.

## Common mistakes

- **Forgetting `partial`.** Both the class and the property must be `partial`, or you get a compile error such as "partial property must have an implementation part".
- **Binding to the method name.** `[RelayCommand]` on `Add()` creates `AddCommand`. Bind to `AddCommand`, not `Add`.
- **Writing to a backing field directly.** If you set a field yourself, no notification is raised. Always set the property.
- **Mixing old and new styles by accident.** It is fine to use the field form in old code, but do not put `[ObservableProperty]` on both a field and a property with the same name.
- **Inheriting from `ObservableObject` twice.** If your class already has a base class, use the `[ObservableObject]` or `[INotifyPropertyChanged]` class attributes instead. Prefer the base class when you can.

## Quick recap

- Install `CommunityToolkit.Mvvm` and inherit view models from `ObservableObject`.
- `[ObservableProperty] public partial string Title { get; set; }` writes the notifying property for you, in a `partial` class.
- Fill in `partial void OnTitleChanged(...)` to react to changes, and use `[NotifyPropertyChangedFor]` for dependent properties.
- `[RelayCommand]` turns a method into `NameCommand`. Use `CanExecute = nameof(...)` and `[NotifyCanExecuteChangedFor]` to enable and disable it.
- Methods that return `Task` become async commands with `IsRunning` and protection against double runs.
- Next, in [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host), you stop creating view models with `new`.

<code id="code-content" class="language-csharp">
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.ComponentModel;
using CoinJar.Models;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
namespace CoinJar.ViewModels;
// partial: the toolkit's source generator writes the other half
public partial class ExpenseListViewModel : ObservableObject
{
    public ExpenseListViewModel()
    {
        Expenses.CollectionChanged += OnExpensesChanged;
        Expenses.Add(new Expense { Id = 1, Title = "Coffee", Amount = 3.50m, Category = "Food" });
        Expenses.Add(new Expense { Id = 2, Title = "Bus ticket", Amount = 2.80m, Category = "Transport" });
    }
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = [];
    public string[] Categories { get; } = ["Food", "Transport", "Bills", "Fun", "Other"];
    public decimal Total =&gt; Expenses.Sum(e =&gt; e.Amount);
    // Each change re-checks AddCommand.CanExecute
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(AddCommand))]
    public partial string NewTitle { get; set; } = "";
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(AddCommand))]
    public partial decimal NewAmount { get; set; }
    [ObservableProperty]
    public partial string NewCategory { get; set; } = "Food";
    [ObservableProperty]
    public partial string StatusText { get; set; } = "";
    // Generated partial method: runs after NewTitle changes
    partial void OnNewTitleChanged(string value)
    {
        StatusText = value.Length &gt; 40 ? "That title is quite long" : "";
    }
    // Generates AddCommand (IRelayCommand)
    [RelayCommand(CanExecute = nameof(CanAdd))]
    private void Add()
    {
        Expenses.Add(new Expense
        {
            Id = Expenses.Count == 0 ? 1 : Expenses.Max(e =&gt; e.Id) + 1,
            Title = NewTitle.Trim(),
            Amount = NewAmount,
            Category = NewCategory
        });
        NewTitle = "";
        NewAmount = 0;
    }
    private bool CanAdd() =&gt; !string.IsNullOrWhiteSpace(NewTitle) &amp;&amp; NewAmount &gt; 0;
    // Generates DeleteCommand (IRelayCommand of Expense)
    [RelayCommand]
    private void Delete(Expense? expense)
    {
        if (expense is not null) Expenses.Remove(expense);
    }
    // Generates LoadCommand (IAsyncRelayCommand) with IsRunning
    [RelayCommand]
    private async Task LoadAsync()
    {
        await Task.Delay(1000); // stand-in for real file or web work
        Expenses.Add(new Expense { Id = Expenses.Count + 1, Title = "Cinema", Amount = 11m, Category = "Fun" });
    }
    // Keep Total correct when items are added, removed or edited
    private void OnExpensesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (e.NewItems is not null)
            foreach (Expense item in e.NewItems) item.PropertyChanged += OnExpenseEdited;
        if (e.OldItems is not null)
            foreach (Expense item in e.OldItems) item.PropertyChanged -= OnExpenseEdited;
        OnPropertyChanged(nameof(Total));
    }
    private void OnExpenseEdited(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(Expense.Amount)) OnPropertyChanged(nameof(Total));
    }
}
// Models/Expense.cs
using CommunityToolkit.Mvvm.ComponentModel;
namespace CoinJar.Models;
// Observable model: edits in the UI raise PropertyChanged
public partial class Expense : ObservableObject
{
    public int Id { get; set; }
    [ObservableProperty]
    public partial string Title { get; set; } = "";
    [ObservableProperty]
    public partial decimal Amount { get; set; }
    [ObservableProperty]
    public partial string Category { get; set; } = "Other";
    [ObservableProperty]
    public partial DateTime Date { get; set; } = DateTime.Today;
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
        Title="CoinJar" Height="520" Width="440"&gt;
    &lt;Window.Resources&gt;
        &lt;BooleanToVisibilityConverter x:Key="BoolToVisibility" /&gt;
    &lt;/Window.Resources&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;TextBlock Text="New expense" FontWeight="SemiBold" Margin="0,0,0,6" /&gt;
        &lt;TextBox Text="{Binding NewTitle, UpdateSourceTrigger=PropertyChanged}" Margin="0,0,0,2" /&gt;
        &lt;TextBlock Text="{Binding StatusText}" Foreground="DarkOrange" Margin="0,0,0,6" /&gt;
        &lt;TextBox Text="{Binding NewAmount, UpdateSourceTrigger=PropertyChanged}" Margin="0,0,0,6" /&gt;
        &lt;ComboBox ItemsSource="{Binding Categories}" SelectedItem="{Binding NewCategory}" Margin="0,0,0,6" /&gt;
        &lt;StackPanel Orientation="Horizontal"&gt;
            &lt;Button Content="Add" Command="{Binding AddCommand}" Padding="16,4" Margin="0,0,8,0" /&gt;
            &lt;Button Content="Load sample data" Command="{Binding LoadCommand}" Padding="16,4" /&gt;
            &lt;TextBlock Text="Loading..." Margin="8,0,0,0" VerticalAlignment="Center"
                       Visibility="{Binding LoadCommand.IsRunning, Converter={StaticResource BoolToVisibility}}" /&gt;
        &lt;/StackPanel&gt;
        &lt;!-- Edit Amount in the grid and the total updates --&gt;
        &lt;DataGrid ItemsSource="{Binding Expenses}" AutoGenerateColumns="False" Height="200" Margin="0,12,0,6"&gt;
            &lt;DataGrid.Columns&gt;
                &lt;DataGridTextColumn Header="Title" Binding="{Binding Title}" Width="*" /&gt;
                &lt;DataGridTextColumn Header="Amount" Binding="{Binding Amount, StringFormat=C}" /&gt;
                &lt;DataGridTemplateColumn&gt;
                    &lt;DataGridTemplateColumn.CellTemplate&gt;
                        &lt;DataTemplate&gt;
                            &lt;Button Content="Delete" Padding="6,0"
                                    Command="{Binding DataContext.DeleteCommand, RelativeSource={RelativeSource AncestorType=Window}}"
                                    CommandParameter="{Binding}" /&gt;
                        &lt;/DataTemplate&gt;
                    &lt;/DataGridTemplateColumn.CellTemplate&gt;
                &lt;/DataGridTemplateColumn&gt;
            &lt;/DataGrid.Columns&gt;
        &lt;/DataGrid&gt;
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
        DataContext = new ExpenseListViewModel();
    }
}
</code></pre>
