---
publishDate: 2026-10-25T20:37
title: 'Commands and ICommand'
slug: commands-and-icommand
metadescription: 'Learn how the ICommand interface lets buttons, menus and keys call view model code, and write your own RelayCommand with CanExecute and command parameters.'
updateDate: 2026-10-25T20:37
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'mvvm', 'commands', 'icommand']
course: wpf
---

## The problem with Click handlers

In [Introduction to MVVM](/courses/wpf/introduction-to-mvvm) you moved CoinJar's logic into `ExpenseListViewModel`. One piece of glue was left in code-behind:

```csharp
private void Add_Click(object sender, RoutedEventArgs e)
{
    ((ExpenseListViewModel)DataContext).AddExpense();
}
```

The view has to know the view model's type and call its method by hand. There is also no easy way to grey out the button when the form is empty.

A **command** fixes both. A command is an object that represents an action, like "add expense". It knows two things: how to **run** the action and whether the action **can run right now**. A button binds to a command just like a text box binds to a string.

## The ICommand interface

WPF describes a command with the `ICommand` [interface](/courses/c-sharp/interfaces) from `System.Windows.Input`. It is tiny:

```csharp
public interface ICommand
{
    event EventHandler? CanExecuteChanged;
    bool CanExecute(object? parameter);
    void Execute(object? parameter);
}
```

- `Execute` runs the action.
- `CanExecute` answers "may I run now?". When it returns `false`, a bound `Button` or `MenuItem` disables itself.
- `CanExecuteChanged` is an [event](/courses/c-sharp/events) the command raises when the answer to `CanExecute` might have changed. WPF then asks again.
- `parameter` is an optional value from the view, set with `CommandParameter`.

Controls that can take a command have a `Command` property: `Button`, `ToggleButton`, `CheckBox`, `RadioButton`, `MenuItem`, `Hyperlink`, and `KeyBinding` / `MouseBinding`.

## Writing a RelayCommand

You could write one class per action (`AddExpenseCommand`, `DeleteExpenseCommand` ...), but that gets old fast. Instead, write one reusable class that takes the action as a [delegate](/courses/c-sharp/delegates). It "relays" the call to a method on your view model, which is why it is usually called `RelayCommand`.

```csharp
using System.Windows.Input;

namespace CoinJar.ViewModels;

public class RelayCommand : ICommand
{
    private readonly Action _execute;
    private readonly Func<bool>? _canExecute;

    public RelayCommand(Action execute, Func<bool>? canExecute = null)
    {
        _execute = execute;
        _canExecute = canExecute;
    }

    public event EventHandler? CanExecuteChanged;

    public bool CanExecute(object? parameter) => _canExecute?.Invoke() ?? true;

    public void Execute(object? parameter) => _execute();

    // Call this when something that affects CanExecute has changed
    public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
```

`Action` is "a method with no parameters and no result". `Func<bool>` is "a method that returns a bool". If no `canExecute` is given, the command can always run.

## Using the command in a view model

Expose the command as a read only property and create it once, in the constructor. The [lambda expressions](/courses/c-sharp/lambda-expressions) point at your methods:

```csharp
public class ExpenseListViewModel : ViewModelBase
{
    public ExpenseListViewModel()
    {
        AddCommand = new RelayCommand(AddExpense, CanAddExpense);
    }

    public RelayCommand AddCommand { get; }

    private bool CanAddExpense() => !string.IsNullOrWhiteSpace(NewTitle) && NewAmount > 0;

    private void AddExpense()
    {
        Expenses.Add(new Expense { Title = NewTitle.Trim(), Amount = NewAmount, Category = NewCategory });
        NewTitle = "";
        NewAmount = 0;
    }
}
```

`AddExpense` can now be `private`. Nothing outside the view model needs to call it directly.

## Binding a button to a command

In the view, the click handler disappears:

```xml
<Button Content="Add" Command="{Binding AddCommand}" />
```

Delete `Add_Click` from `MainWindow.xaml.cs` too. The code-behind is back to just `InitializeComponent()` and setting the `DataContext`.

## Keeping CanExecute up to date

Try it now and you will notice a bug: the button starts disabled (the form is empty) and **stays** disabled after you type. WPF asked `CanExecute` once, and nobody told it the answer changed.

The fix is to raise `CanExecuteChanged` whenever an input to `CanAddExpense` changes. Those inputs are `NewTitle` and `NewAmount`:

```csharp
public string NewTitle
{
    get => _newTitle;
    set
    {
        if (SetProperty(ref _newTitle, value))
            AddCommand.RaiseCanExecuteChanged();
    }
}
```

Do the same in the `NewAmount` setter. This is why `SetProperty` returns a `bool`: you only react when the value really changed. Also bind the title box with `UpdateSourceTrigger=PropertyChanged`, otherwise `NewTitle` only changes when the box loses focus.

### The CommandManager shortcut

There is another way you will see online. WPF has a `CommandManager.RequerySuggested` event that fires after many user actions (key presses, focus changes, clicks). A command can pass its own event through to it:

```csharp
public event EventHandler? CanExecuteChanged
{
    add => CommandManager.RequerySuggested += value;
    remove => CommandManager.RequerySuggested -= value;
}
```

Now WPF re-checks every command automatically. It is convenient, but it runs `CanExecute` very often, and it does not fire when a value changes in the background (for example after data loads). Raising the event yourself is more predictable, and it is what [CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm) does too. This lesson uses the manual way.

## Command parameters

Sometimes the action needs to know **which** item to work on. A "Delete" button inside each row of the list is a good example. The view passes the item with `CommandParameter`, and a generic `RelayCommand<T>` hands it to your method with the right type:

```csharp
public class RelayCommand<T> : ICommand
{
    private readonly Action<T?> _execute;
    private readonly Func<T?, bool>? _canExecute;

    public RelayCommand(Action<T?> execute, Func<T?, bool>? canExecute = null)
    {
        _execute = execute;
        _canExecute = canExecute;
    }

    public event EventHandler? CanExecuteChanged;

    public bool CanExecute(object? parameter) => _canExecute?.Invoke((T?)parameter) ?? true;

    public void Execute(object? parameter) => _execute((T?)parameter);

    public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
```

In the view model:

```csharp
DeleteCommand = new RelayCommand<Expense>(DeleteExpense, e => e is not null);

public RelayCommand<Expense> DeleteCommand { get; }

private void DeleteExpense(Expense? expense)
{
    if (expense is not null) Expenses.Remove(expense);
}
```

### Reaching the command from inside a template

Inside an `ItemTemplate`, the `DataContext` of each row is the `Expense`, not the view model. So `{Binding DeleteCommand}` would look for a `DeleteCommand` property on `Expense` and fail. Use a `RelativeSource` binding to climb up to the window and use **its** `DataContext`:

```xml
<ListBox ItemsSource="{Binding Expenses}">
    <ListBox.ItemTemplate>
        <DataTemplate>
            <DockPanel>
                <Button DockPanel.Dock="Right" Content="Delete"
                        Command="{Binding DataContext.DeleteCommand,
                                  RelativeSource={RelativeSource AncestorType=Window}}"
                        CommandParameter="{Binding}" />
                <TextBlock Text="{Binding Title}" />
            </DockPanel>
        </DataTemplate>
    </ListBox.ItemTemplate>
</ListBox>
```

`CommandParameter="{Binding}"` with no path means "the current row's data", so the clicked `Expense` is passed in. You saw templates like this in [Data Templates](/courses/wpf/data-templates).

## Keyboard shortcuts and menus

Commands are not only for buttons. A `KeyBinding` runs a command when a key combination is pressed, and a `MenuItem` can bind to the same command. All of them enable and disable together:

```xml
<Window.InputBindings>
    <KeyBinding Key="Enter" Modifiers="Control" Command="{Binding AddCommand}" />
</Window.InputBindings>

<Menu>
    <MenuItem Header="_Expense">
        <MenuItem Header="_Add" Command="{Binding AddCommand}" InputGestureText="Ctrl+Enter" />
    </MenuItem>
</Menu>
```

`InputGestureText` only shows the text in the menu. The `KeyBinding` is what makes the key work. There is more on this in [Keyboard Shortcuts and Focus](/courses/wpf/keyboard-shortcuts-and-focus).

## Built in routed commands

WPF also ships ready made commands such as `ApplicationCommands.Copy`, `ApplicationCommands.Paste` and `ApplicationCommands.Undo`. These are **routed commands**: they travel up the element tree looking for a handler, a bit like routed events. A `TextBox` already handles them, so this works with no code at all:

```xml
<MenuItem Header="Copy" Command="ApplicationCommands.Copy" />
<MenuItem Header="Paste" Command="ApplicationCommands.Paste" />
```

Routed commands are great for text editing features. For your own app actions, view model commands like `RelayCommand` are simpler and fit MVVM better.

## Common mistakes

- **Creating a new command on every read.** `public ICommand AddCommand => new RelayCommand(...)` makes a fresh object each time it is read. Use `{ get; }` and set it once in the constructor.
- **Forgetting `RaiseCanExecuteChanged`.** The button stays disabled (or enabled) forever. Raise it whenever an input of `CanExecute` changes.
- **Binding to the wrong DataContext in a template.** Inside an `ItemTemplate`, use `RelativeSource` (or `ElementName`) to reach the view model.
- **Not handling a null parameter.** `CanExecute` can be called before `CommandParameter` has its value, so treat `null` safely.
- **Using `async void` in Execute for long work.** Errors get lost and the user can click twice. The toolkit's async commands, in the next lesson, solve this.

## Quick recap

- A command is an object with `Execute`, `CanExecute` and a `CanExecuteChanged` event.
- Bind `Command="{Binding AddCommand}"` instead of writing a `Click` handler.
- A reusable `RelayCommand` wraps a method (and an optional "can run" check) as a command.
- Raise `CanExecuteChanged` when the inputs to `CanExecute` change, so buttons enable and disable correctly.
- `CommandParameter` plus `RelayCommand<T>` passes a value, such as the clicked expense.
- `KeyBinding` and `MenuItem` can share the same command.

<code id="code-content" class="language-csharp">
// ViewModels/RelayCommand.cs
using System.Windows.Input;
namespace CoinJar.ViewModels;
// A reusable command that relays Execute/CanExecute to delegates
public class RelayCommand : ICommand
{
    private readonly Action _execute;
    private readonly Func&lt;bool&gt;? _canExecute;
    public RelayCommand(Action execute, Func&lt;bool&gt;? canExecute = null)
    {
        _execute = execute;
        _canExecute = canExecute;
    }
    public event EventHandler? CanExecuteChanged;
    public bool CanExecute(object? parameter) =&gt; _canExecute?.Invoke() ?? true;
    public void Execute(object? parameter) =&gt; _execute();
    // Tell WPF to call CanExecute again
    public void RaiseCanExecuteChanged() =&gt; CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
// Same idea, but with a typed CommandParameter
public class RelayCommand&lt;T&gt; : ICommand
{
    private readonly Action&lt;T?&gt; _execute;
    private readonly Func&lt;T?, bool&gt;? _canExecute;
    public RelayCommand(Action&lt;T?&gt; execute, Func&lt;T?, bool&gt;? canExecute = null)
    {
        _execute = execute;
        _canExecute = canExecute;
    }
    public event EventHandler? CanExecuteChanged;
    public bool CanExecute(object? parameter) =&gt; _canExecute?.Invoke((T?)parameter) ?? true;
    public void Execute(object? parameter) =&gt; _execute((T?)parameter);
    public void RaiseCanExecuteChanged() =&gt; CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using CoinJar.Models;
namespace CoinJar.ViewModels;
public class ExpenseListViewModel : ViewModelBase
{
    private string _newTitle = "";
    private decimal _newAmount;
    private string _newCategory = "Food";
    public ExpenseListViewModel()
    {
        // Create each command once
        AddCommand = new RelayCommand(AddExpense, CanAddExpense);
        DeleteCommand = new RelayCommand&lt;Expense&gt;(DeleteExpense, e =&gt; e is not null);
        Expenses.CollectionChanged += (_, _) =&gt; OnPropertyChanged(nameof(Total));
        Expenses.Add(new Expense { Id = 1, Title = "Coffee", Amount = 3.50m, Category = "Food" });
        Expenses.Add(new Expense { Id = 2, Title = "Bus ticket", Amount = 2.80m, Category = "Transport" });
    }
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = [];
    public string[] Categories { get; } = ["Food", "Transport", "Bills", "Fun", "Other"];
    public decimal Total =&gt; Expenses.Sum(e =&gt; e.Amount);
    public RelayCommand AddCommand { get; }
    public RelayCommand&lt;Expense&gt; DeleteCommand { get; }
    public string NewTitle
    {
        get =&gt; _newTitle;
        set
        {
            // The Add button depends on this value
            if (SetProperty(ref _newTitle, value)) AddCommand.RaiseCanExecuteChanged();
        }
    }
    public decimal NewAmount
    {
        get =&gt; _newAmount;
        set
        {
            if (SetProperty(ref _newAmount, value)) AddCommand.RaiseCanExecuteChanged();
        }
    }
    public string NewCategory
    {
        get =&gt; _newCategory;
        set =&gt; SetProperty(ref _newCategory, value);
    }
    private bool CanAddExpense() =&gt; !string.IsNullOrWhiteSpace(NewTitle) &amp;&amp; NewAmount &gt; 0;
    private void AddExpense()
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
    private void DeleteExpense(Expense? expense)
    {
        if (expense is not null) Expenses.Remove(expense);
    }
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
        Title="CoinJar" Height="460" Width="420"&gt;
    &lt;!-- Ctrl+Enter runs the same command as the button --&gt;
    &lt;Window.InputBindings&gt;
        &lt;KeyBinding Key="Enter" Modifiers="Control" Command="{Binding AddCommand}" /&gt;
    &lt;/Window.InputBindings&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;TextBlock Text="New expense" FontWeight="SemiBold" Margin="0,0,0,6" /&gt;
        &lt;TextBox Text="{Binding NewTitle, UpdateSourceTrigger=PropertyChanged}" Margin="0,0,0,6" /&gt;
        &lt;TextBox Text="{Binding NewAmount, UpdateSourceTrigger=PropertyChanged}" Margin="0,0,0,6" /&gt;
        &lt;ComboBox ItemsSource="{Binding Categories}" SelectedItem="{Binding NewCategory}" Margin="0,0,0,6" /&gt;
        &lt;!-- No Click handler: the button disables itself when CanExecute is false --&gt;
        &lt;Button Content="Add" Command="{Binding AddCommand}" HorizontalAlignment="Left" Padding="16,4" /&gt;
        &lt;ListBox ItemsSource="{Binding Expenses}" Height="180" Margin="0,12,0,6" HorizontalContentAlignment="Stretch"&gt;
            &lt;ListBox.ItemTemplate&gt;
                &lt;DataTemplate&gt;
                    &lt;DockPanel&gt;
                        &lt;!-- Climb to the Window to reach the view model's command --&gt;
                        &lt;Button DockPanel.Dock="Right" Content="Delete" Padding="8,0"
                                Command="{Binding DataContext.DeleteCommand, RelativeSource={RelativeSource AncestorType=Window}}"
                                CommandParameter="{Binding}" /&gt;
                        &lt;TextBlock Text="{Binding Amount, StringFormat=C}" DockPanel.Dock="Right" Margin="0,0,12,0" /&gt;
                        &lt;TextBlock Text="{Binding Title}" /&gt;
                    &lt;/DockPanel&gt;
                &lt;/DataTemplate&gt;
            &lt;/ListBox.ItemTemplate&gt;
        &lt;/ListBox&gt;
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
        DataContext = new ExpenseListViewModel(); // no event handlers needed any more
    }
}
</code></pre>
