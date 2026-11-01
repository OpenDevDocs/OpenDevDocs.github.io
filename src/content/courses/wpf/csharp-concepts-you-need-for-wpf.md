---
publishDate: 2026-10-25T20:00
title: 'C# Concepts You Need for WPF'
slug: csharp-concepts-you-need-for-wpf
metadescription: 'The C# features WPF and MVVM lean on, from properties, events, partial classes and interfaces to ObservableCollection, lambdas, async and the UI thread, with links to learn each one.'
updateDate: 2026-11-01T09:00
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'csharp', 'prerequisites', 'beginners']
course: wpf
---

## Why this topic exists

A WPF app has two halves: **XAML** describes what the window looks like, and **C#** makes it do things. This course teaches XAML from zero, but it expects you to read C# without getting stuck.

Desktop apps use C# a little differently from web apps. A web request comes in, runs, and finishes. A WPF window stays open, waits for the user, and reacts to clicks and typing for as long as the app runs. That is why **events**, **properties that announce changes** and **the UI thread** matter so much more here.

This topic lists the C# features WPF uses, in the order you will meet them. For each one you get:

- a short explanation in plain words,
- a small piece of real WPF code that uses it,
- a link to the matching topic in the [C# course](/courses/c-sharp/introduction-to-csharp-and-dotnet) for the full story.

The list has three groups:

1. **Know before you start.** You will see these in the first few topics.
2. **Learn as you go.** They appear later in the course.
3. **Can wait.** Good C#, but you will not need it to build CoinJar.

If you already write C# comfortably, skim the samples and go on to [Setting Up Visual Studio and the .NET SDK](/courses/wpf/setting-up-visual-studio-and-the-dotnet-sdk).

## Know before you start

### 1. Classes, objects and properties

Your data lives in classes with properties. CoinJar, the expense tracker you build in this course, starts with this one:

```csharp
public class Expense
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public decimal Amount { get; set; }
    public DateTime Date { get; set; } = DateTime.Today;
}
```

WPF **data binding** only works with **properties**, never with plain fields. `{Binding Title}` in XAML reads the `Title` property, so you must know the difference between a field and a property.

You also need **full properties**, the long form with a private **backing field**. They let you run code whenever the value changes, which is exactly what WPF needs to update the screen:

```csharp
private decimal _amount;

public decimal Amount
{
    get => _amount;
    set
    {
        _amount = value;
        // tell the window that Amount changed (see section 5)
    }
}
```

Learn more: [Classes and Objects](/courses/c-sharp/classes-and-objects), [Fields and Properties](/courses/c-sharp/fields-and-properties), [Variables and Data Types](/courses/c-sharp/variables-and-data-types).

### 2. Partial classes

Every window is split across two files: `MainWindow.xaml` and `MainWindow.xaml.cs`. The build turns the XAML into C# code, and the two halves are joined into one class. That only works because the class is marked `partial`:

```csharp
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();   // created from the XAML half
    }
}
```

`partial` comes back later with CommunityToolkit.Mvvm, where a code generator writes the other half of your view models for you. If you forget `partial` there, you get a build error.

Learn more: [Classes and Objects](/courses/c-sharp/classes-and-objects), [Source Generators](/courses/c-sharp/source-generators) (later, to see how the generated half is made). In this course: [Understanding the Project Structure](/courses/wpf/understanding-the-project-structure).

### 3. Inheritance

`MainWindow : Window` means your window **inherits** everything a WPF window already knows: a title bar, sizing, `Show()` and `Close()`. You will also inherit from `UserControl`, `Application` and, with the toolkit, `ObservableObject`.

```csharp
public partial class App : Application { }
public partial class ExpenseCard : UserControl { }
```

You rarely build deep inheritance trees yourself, but you must understand what a base class gives you and how `override` works, because you will override methods such as `OnStartup`.

Learn more: [Inheritance](/courses/c-sharp/inheritance), [Polymorphism](/courses/c-sharp/polymorphism), [Access Modifiers](/courses/c-sharp/access-modifiers).

### 4. Methods, events and event handlers

A desktop app spends its life waiting for something to happen. A button click is an **event**, and the method that runs is an **event handler**. You connect them in XAML (`Click="AddButton_Click"`) or in C# with `+=`:

```csharp
private void AddButton_Click(object sender, RoutedEventArgs e)
{
    MessageBox.Show("Expense added");
}

// The same connection, written in C#
AddButton.Click += AddButton_Click;
```

Every handler has the same shape: `object sender` (who raised the event) and an `EventArgs` type with the details. Events are built on **delegates**, so read about both.

Learn more: [Events](/courses/c-sharp/events), [Delegates](/courses/c-sharp/delegates), [Methods and Functions](/courses/c-sharp/methods-and-functions). In this course: [Code-Behind and Event Handlers](/courses/wpf/code-behind-and-event-handlers).

### 5. Interfaces

WPF talks to your code through **interfaces**. Implement one, and WPF knows what your class can do. The three you will write most:

- `INotifyPropertyChanged`: "I will tell you when a property changes", so bound controls refresh.
- `ICommand`: "I am an action a button can run", used in MVVM instead of click handlers.
- `IValueConverter`: "I can turn one value into another for display", such as an amount into a colour.

```csharp
public class Expense : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    private void OnPropertyChanged(string name) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
```

Notice that this interface contains an **event**. Interfaces and events work together all the time in WPF.

Learn more: [Interfaces](/courses/c-sharp/interfaces), [Abstraction](/courses/c-sharp/abstraction). In this course: [INotifyPropertyChanged](/courses/wpf/inotifypropertychanged), [Commands and ICommand](/courses/wpf/commands-and-icommand).

### 6. Nullable types and the `?.` operator

New projects turn on **nullable reference types**, so the compiler warns you about values that might be `null`. In WPF you will see `object? sender`, `event ... ? PropertyChanged` and `Expense? SelectedExpense` (nothing is selected yet).

```csharp
Expense? selected = ExpensesList.SelectedItem as Expense;
if (selected is null)
{
    return;
}
```

`?.` calls a member only if the object is not null. `PropertyChanged?.Invoke(...)` is in almost every hand written view model.

Learn more: [Variables and Data Types](/courses/c-sharp/variables-and-data-types), [Operators in C#](/courses/c-sharp/operators-in-csharp), [Classes and Objects](/courses/c-sharp/classes-and-objects).

### 7. Casting with `as`, `is` and `(Type)`

WPF hands you values typed as `object`: the `sender` of an event, `SelectedItem` of a list, the `value` in a converter. You must **cast** them to the real type before you can use them:

```csharp
if (sender is Button button)
{
    button.IsEnabled = false;
}

var expense = (Expense)ExpensesList.SelectedItem;   // throws if it is not an Expense
```

Prefer `is` with a variable name (a **type pattern**): it checks and casts in one step and never throws.

Learn more: [Type Conversion and Casting](/courses/c-sharp/type-conversion-and-casting), [Advanced Pattern Matching](/courses/c-sharp/advanced-pattern-matching).

### 8. Generics and ObservableCollection&lt;T&gt;

A list on screen needs a collection behind it. `List<T>` works, but the screen will not notice when you add or remove an item. `ObservableCollection<T>` raises an event on every change, so the `ListBox` or `DataGrid` updates by itself:

```csharp
public ObservableCollection<Expense> Expenses { get; } = new();

Expenses.Add(new Expense { Title = "Coffee", Amount = 3.50m });   // the list on screen grows
```

The `<T>` is **generics**: the same collection class, made for any type you name.

Learn more: [Generics](/courses/c-sharp/generics), [List&lt;T&gt;](/courses/c-sharp/list-t), [Dictionary&lt;TKey, TValue&gt;](/courses/c-sharp/dictionary-tkey-tvalue). In this course: [Binding to Collections with ObservableCollection](/courses/wpf/binding-to-collections).

### 9. Lambda expressions

A **lambda** is a small inline function. WPF code uses them for commands, short event handlers and code that must run on the UI thread:

```csharp
DeleteCommand = new RelayCommand(() => Expenses.Remove(SelectedExpense!),
                                 () => SelectedExpense is not null);

SaveButton.Click += (sender, e) => Save();
```

The first lambda is what the button does. The second decides whether the button is enabled.

Learn more: [Lambda Expressions](/courses/c-sharp/lambda-expressions), [Delegates](/courses/c-sharp/delegates).

### 10. Attributes

**Attributes** are the labels in square brackets. With CommunityToolkit.Mvvm they replace pages of repeated code: `[ObservableProperty]` writes the change notification and `[RelayCommand]` turns a method into a command.

```csharp
public partial class ExpenseListViewModel : ObservableObject
{
    [ObservableProperty]
    public partial string Title { get; set; } = "";

    [RelayCommand]
    private void Clear() => Title = "";      // becomes ClearCommand
}
```

Before the toolkit you will also meet `[CallerMemberName]`, which fills in the property name for you in `OnPropertyChanged()`.

Learn more: [Attributes](/courses/c-sharp/attributes). In this course: [MVVM with CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm).

## Learn as you go

### 11. async, await and the UI thread

WPF has one **UI thread**. If it is busy, the window freezes and Windows shows "Not Responding". `await` lets slow work (files, databases, web calls) happen without blocking that thread, and then continues on the UI thread so you can update controls safely.

```csharp
private async void LoadButton_Click(object sender, RoutedEventArgs e)
{
    StatusText.Text = "Loading...";
    var expenses = await _storage.LoadAsync();   // the window stays responsive
    StatusText.Text = $"{expenses.Count} expenses";
}
```

Event handlers are the one place where `async void` is fine. Everywhere else, return `Task`. Code on a background thread must use the **Dispatcher** to touch controls.

Learn more: [Async and Await](/courses/c-sharp/async-and-await), [Multithreading](/courses/c-sharp/multithreading). In this course: [Async, Await and a Responsive UI](/courses/wpf/async-await-and-a-responsive-ui), [The Dispatcher and Threading](/courses/wpf/the-dispatcher-and-threading).

### 12. LINQ

Totals, filters and sorting are LINQ one liners:

```csharp
decimal total = Expenses.Sum(e => e.Amount);
var food = Expenses.Where(e => e.Category == "Food").OrderByDescending(e => e.Date);
```

Learn more: [LINQ Fundamentals](/courses/c-sharp/linq-fundamentals), [LINQ Method Syntax](/courses/c-sharp/linq-method-syntax). In this course: [Sorting, Filtering and Grouping with CollectionView](/courses/wpf/sorting-filtering-and-grouping).

### 13. Static members, enums and `nameof`

**Static** members belong to the class itself, not to one object: `Application.Current`, `MessageBox.Show()` and the `DependencyProperty` fields you will register for custom controls. **Enums** name fixed choices like `Visibility.Collapsed` or `MessageBoxResult.Yes`. `nameof(Amount)` gives you the text `"Amount"` without typos.

```csharp
var answer = MessageBox.Show("Delete this expense?", "CoinJar", MessageBoxButton.YesNo);
if (answer == MessageBoxResult.Yes) { /* delete it */ }

OnPropertyChanged(nameof(Total));
```

Learn more: [Fields and Properties](/courses/c-sharp/fields-and-properties), [Variables and Data Types](/courses/c-sharp/variables-and-data-types). In this course: [Dependency Properties](/courses/wpf/dependency-properties).

### 14. Constructors and dependency injection

Later you will let the **Generic Host** create your windows and view models, passing in services through the **constructor**:

```csharp
public partial class MainViewModel(IExpenseStorage storage) : ObservableObject
{
    public Task SaveAsync(IEnumerable<Expense> items) => storage.SaveAsync(items);
}
```

That `(IExpenseStorage storage)` after the class name is a **primary constructor**.

Learn more: [Constructors and Destructor](/courses/c-sharp/constructors-and-destructor), [Dependency Injection Fundamentals](/courses/c-sharp/dependency-injection-fundamentals). In this course: [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host).

### 15. Exceptions, files and `using`

Desktop apps read and write files on the user's PC, and things go wrong: the file is missing or locked. Wrap that work in `try`/`catch`, show a friendly message, and use `using` for streams and database contexts so they close properly.

```csharp
try
{
    await using var stream = File.OpenRead(path);
    var items = await JsonSerializer.DeserializeAsync<List<Expense>>(stream);
}
catch (IOException ex)
{
    MessageBox.Show($"Could not read your data: {ex.Message}");
}
```

Learn more: [Exception Handling](/courses/c-sharp/exception-handling), [File Handling](/courses/c-sharp/file-handling), [IDisposable and Resource Management](/courses/c-sharp/idisposable-and-resource-management). In this course: [Saving Data to JSON Files](/courses/wpf/saving-data-to-json-files), [Error Handling and Logging](/courses/wpf/error-handling-and-logging).

### 16. Records (optional)

**Records** are handy for small messages that view models send to each other:

```csharp
public record ExpenseAddedMessage(Expense Expense);
```

Learn more: [Records](/courses/c-sharp/records). In this course: [Messaging Between ViewModels](/courses/wpf/messaging-between-viewmodels).

## Can wait

You can build all of CoinJar without these:

- **Locks and low level threads.** The Dispatcher and `async` cover what a typical WPF app needs. See [Synchronization and Thread Safety](/courses/c-sharp/synchronization-and-thread-safety) when you share data between threads.
- **Writing your own source generators.** The toolkit uses one, but you only use its attributes.
- **Reflection, Span&lt;T&gt;, unsafe code and pointers.** Advanced topics for library and performance work.

## Your checklist

| C# concept | Where WPF uses it | C# topic |
| --- | --- | --- |
| Properties and backing fields | Everything you bind to | [Fields and Properties](/courses/c-sharp/fields-and-properties) |
| Partial classes | `MainWindow.xaml` + `.xaml.cs`, the toolkit | [Classes and Objects](/courses/c-sharp/classes-and-objects) |
| Inheritance | `Window`, `UserControl`, `ObservableObject` | [Inheritance](/courses/c-sharp/inheritance) |
| Events and delegates | Clicks, `PropertyChanged` | [Events](/courses/c-sharp/events) |
| Interfaces | `INotifyPropertyChanged`, `ICommand`, converters | [Interfaces](/courses/c-sharp/interfaces) |
| Nullable `?` and `?.` | `sender`, selected items, events | [Operators in C#](/courses/c-sharp/operators-in-csharp) |
| Casting | `sender`, `SelectedItem`, converters | [Type Conversion and Casting](/courses/c-sharp/type-conversion-and-casting) |
| Generics | `ObservableCollection<T>` | [Generics](/courses/c-sharp/generics) |
| Lambdas | Commands, short handlers | [Lambda Expressions](/courses/c-sharp/lambda-expressions) |
| Attributes | `[ObservableProperty]`, `[RelayCommand]` | [Attributes](/courses/c-sharp/attributes) |
| async and the UI thread | Loading and saving without freezing | [Async and Await](/courses/c-sharp/async-and-await) |

If you can follow the view model in the code panel, you are ready for WPF. Building for the web instead? The [MVC](/courses/dotnet-mvc/csharp-concepts-you-need-for-mvc) and [Web API](/courses/dotnet-webapi/csharp-concepts-you-need-for-web-api) courses have their own version of this list.

## Quick recap

- WPF apps stay open and react to the user, so events, change notification and the UI thread matter more than in web apps.
- Before you start, know properties and backing fields, partial classes, inheritance, events, interfaces, nullable types, casting, generics, lambdas and attributes.
- Learn `async` with the UI thread, LINQ, static members, dependency injection, exceptions and files as the course reaches them.
- Low level threading, reflection and performance features can wait.
- Each concept links to a full topic in the C# course when you want to go deeper.

<code id="code-content" class="language-csharp">
// ViewModels/ExpenseListViewModel.cs
// A hand written CoinJar view model that uses the "know before you start" C# features.
// The numbers match the sections of this topic.
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
namespace CoinJar.ViewModels;
// 5. Interface: INotifyPropertyChanged lets bound controls refresh themselves
public abstract class ViewModelBase : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;      // 4 + 6. a nullable event
    // 10. [CallerMemberName] fills in the property name for us
    protected void OnPropertyChanged([CallerMemberName] string? name = null) =&gt;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));   // 6. ?. operator
}
// 3. Inheritance: Expense gets OnPropertyChanged from ViewModelBase
public class Expense : ViewModelBase
{
    private string _title = "";
    private decimal _amount;
    public string Title
    {
        get =&gt; _title;
        set { _title = value; OnPropertyChanged(); }               // 1. full property
    }
    public decimal Amount
    {
        get =&gt; _amount;
        set { _amount = value; OnPropertyChanged(); }
    }
}
// 5. Interface: ICommand is what a Button's Command property calls
public class RelayCommand(Action execute, Func&lt;bool&gt;? canExecute = null) : ICommand
{
    public event EventHandler? CanExecuteChanged;                   // 4. an event
    public bool CanExecute(object? parameter) =&gt; canExecute?.Invoke() ?? true;
    public void Execute(object? parameter) =&gt; execute();
    public void RaiseCanExecuteChanged() =&gt; CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
public class ExpenseListViewModel : ViewModelBase
{
    private Expense? _selectedExpense;                              // 6. nothing selected yet
    // 8. Generics: ObservableCollection tells the ListBox about every Add and Remove
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = new();
    public Expense? SelectedExpense
    {
        get =&gt; _selectedExpense;
        set
        {
            _selectedExpense = value;
            OnPropertyChanged();
            DeleteCommand.RaiseCanExecuteChanged();                 // re-check the button
        }
    }
    public decimal Total =&gt; Expenses.Sum(e =&gt; e.Amount);           // 12. LINQ
    public RelayCommand AddCommand { get; }
    public RelayCommand DeleteCommand { get; }
    public ExpenseListViewModel()
    {
        // 9. Lambdas: what each button does, and when Delete is allowed
        AddCommand = new RelayCommand(() =&gt;
            Expenses.Add(new Expense { Title = "Coffee", Amount = 3.50m }));   // 1. object initializer
        DeleteCommand = new RelayCommand(
            () =&gt; Expenses.Remove(SelectedExpense!),
            () =&gt; SelectedExpense is not null);
        // 4. Subscribe to an event with +=, and use 13. nameof
        Expenses.CollectionChanged += (sender, e) =&gt; OnPropertyChanged(nameof(Total));
    }
}
// In MainWindow.xaml (the other half of the partial MainWindow class):
//
//   &lt;ListBox ItemsSource="{Binding Expenses}" DisplayMemberPath="Title"
//            SelectedItem="{Binding SelectedExpense}" /&gt;
//   &lt;TextBlock Text="{Binding Total, StringFormat=Total: {0:C}}" /&gt;
//   &lt;Button Content="Add" Command="{Binding AddCommand}" /&gt;
//   &lt;Button Content="Delete" Command="{Binding DeleteCommand}" /&gt;
</code></pre>
