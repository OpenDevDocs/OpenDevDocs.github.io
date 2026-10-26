---
publishDate: 2026-10-25T20:58
title: 'Unit Testing ViewModels'
slug: unit-testing-viewmodels
metadescription: 'Test CoinJar''s view models with xUnit: move them into a class library, set up the test project, replace dialogs and storage with fakes, and test properties, commands and messages.'
updateDate: 2026-10-25T20:58
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'testing', 'xunit', 'mvvm']
course: wpf
---

## Why test view models

Every time you change CoinJar, something you did not touch might break. Maybe the total stops updating, or Delete no longer asks first. You could click through the whole app after every change, but you will not, at least not every time.

A **unit test** is a small method that checks one piece of behaviour automatically: "after adding a 9 euro expense, the total is 9 more". A **test project** holds hundreds of them, and running all of them takes a second.

This is where MVVM pays off. Back in [Introduction to MVVM](/courses/wpf/introduction-to-mvvm) you moved the logic out of code-behind into view models. A view model is a plain C# class. It does not need a window, a mouse or a screen, so a test can create one, poke it and check the result. That is the main reason MVVM exists.

## Arrange, act, assert

Every test has the same three steps:

1. **Arrange**: build the object and the world around it.
2. **Act**: do the one thing you are testing.
3. **Assert**: check the result.

```csharp
[Fact]
public void Filter_shows_only_one_category()
{
    // Arrange
    Seed();                       // two expenses: Lunch (Food) and Bus (Transport)
    var vm = CreateViewModel();

    // Act
    vm.SelectedFilter = "Food";

    // Assert
    Expense only = Assert.Single(vm.Expenses);
    Assert.Equal("Lunch", only.Title);
}
```

We use **xUnit**, a popular free test framework. `[Fact]` marks a test method. `Assert` has methods like `Equal`, `True`, `Single` and `Empty`, which throw when the check fails. A thrown assert means a failed test.

Give tests long, clear names. When `Delete_does_nothing_when_the_user_says_no` fails, you know what broke without opening the file.

## Setting up the projects

There are two ways to let a test project see your view models.

### Option 1: reference the WPF app directly

The quick way: make a test project and reference `CoinJar.csproj`. But try it with the plain `xunit` template and the restore fails:

```text
error NU1201: Project CoinJar is not compatible with net10.0 (.NETCoreApp,Version=v10.0).
Project CoinJar supports: net10.0-windows7.0 (.NETCoreApp,Version=v10.0)
```

The app targets `net10.0-windows`, and a project can only reference projects for the same platform or a more general one. So the test project must target `net10.0-windows` too:

```xml
<PropertyGroup>
  <TargetFramework>net10.0-windows</TargetFramework>
</PropertyGroup>
```

That works, and it is fine for a small app. The downside: your tests now pull in all of WPF, and nothing stops a view model from using `MessageBox` or `Window` by accident.

### Option 2 (better): a class library for view models

Put everything that is not a view into a separate **class library** that targets plain `net10.0`:

```text
CoinJar.slnx
CoinJar/              WPF app (net10.0-windows): App, MainWindow, Views, Controls,
                      DialogService, SQLite store, styles
CoinJar.Core/         class library (net10.0): Models, ViewModels, Messages,
                      service interfaces, NavigationService
CoinJar.Tests/        xUnit tests (net10.0): reference CoinJar.Core only
```

Because `CoinJar.Core` targets `net10.0`, it **cannot** reference WPF. If someone adds `MessageBox.Show` to a view model, the build fails. The compiler now guards your MVVM rules for you.

Create it from the command line in the folder above your app:

```bash
dotnet new sln -n CoinJar
dotnet new classlib -n CoinJar.Core -o CoinJar.Core
dotnet new xunit -n CoinJar.Tests -o CoinJar.Tests
dotnet sln add CoinJar/CoinJar.csproj CoinJar.Core/CoinJar.Core.csproj CoinJar.Tests/CoinJar.Tests.csproj

dotnet add CoinJar/CoinJar.csproj reference CoinJar.Core/CoinJar.Core.csproj
dotnet add CoinJar.Tests/CoinJar.Tests.csproj reference CoinJar.Core/CoinJar.Core.csproj
dotnet add CoinJar.Core/CoinJar.Core.csproj package CommunityToolkit.Mvvm
dotnet add CoinJar.Core/CoinJar.Core.csproj package Microsoft.Extensions.Logging.Abstractions
dotnet add CoinJar.Core/CoinJar.Core.csproj package Microsoft.Extensions.DependencyInjection.Abstractions
dotnet add CoinJar.Core/CoinJar.Core.csproj package Microsoft.Extensions.Options
```

With .NET 10, `dotnet new sln` creates a `.slnx` file, the newer and simpler XML solution format. Visual Studio opens it like a `.sln`. In Visual Studio you can do the same with **Add > New Project > Class Library** and **xUnit Test Project**.

Then move `Models`, `ViewModels`, `Messages` and the service interfaces into `CoinJar.Core`. To keep every namespace the same (`CoinJar.Models`, `CoinJar.ViewModels`), set the root namespace of the library:

```xml
<!-- CoinJar.Core/CoinJar.Core.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>CoinJar</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.4.2" />
    <PackageReference Include="Microsoft.Extensions.DependencyInjection.Abstractions" Version="10.0.14" />
    <PackageReference Include="Microsoft.Extensions.Logging.Abstractions" Version="10.0.14" />
    <PackageReference Include="Microsoft.Extensions.Options" Version="10.0.14" />
  </ItemGroup>
</Project>
```

These small packages give the library `ILogger<T>`, the `GetRequiredService` helper used by `NavigationService`, and `IOptions<T>` for settings, without pulling in the whole host or WPF.

One change in XAML: types from another assembly need the assembly name in the `xmlns`:

```xml
xmlns:vm="clr-namespace:CoinJar.ViewModels;assembly=CoinJar.Core"
xmlns:models="clr-namespace:CoinJar.Models;assembly=CoinJar.Core"
```

`DialogService` stays in the app, because it uses `MessageBox` and windows. Only its interface, `IDialogService`, moves to the library. That split is exactly what makes testing possible.

## Fakes: replacing the outside world

`ExpenseListViewModel` needs five things in its constructor: an `IExpenseStore`, an `IDialogService`, an `IMessenger`, an `INavigationService` and a logger. In the app the host passes real ones (see [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host)). A test passes **fakes** instead: small classes that implement the same [interface](/courses/c-sharp/interfaces) but do something simple and predictable.

### A fake dialog service

The real `Confirm` opens a message box and waits for a click. A test cannot click. The fake returns whatever the test told it to, and remembers that it was asked:

```csharp
public class FakeDialogService : IDialogService
{
    public bool ConfirmAnswer { get; set; } = true;
    public int ConfirmCalls { get; private set; }
    public List<string> Messages { get; } = [];
    public string? SaveFileAnswer { get; set; }
    public Action<Expense>? EditAction { get; set; } // what the "user" changes in the dialog

    public void ShowMessage(string message, string title = "CoinJar") => Messages.Add(message);

    public bool Confirm(string message, string title = "Please confirm")
    {
        ConfirmCalls++;
        return ConfirmAnswer;
    }

    public string? PickSaveFile(string suggestedName, string filter) => SaveFileAnswer;
    public string? PickOpenFile(string filter) => null;
    public string? PickFolder() => null;

    public bool EditExpense(Expense expense)
    {
        if (EditAction is null) return false; // like pressing Cancel
        EditAction(expense);
        return true;
    }
}
```

Now a test can say "the user clicks No" with one line: `_dialogs.ConfirmAnswer = false;`.

### The other fakes

- `FakeExpenseStore` keeps expenses in a `List<Expense>` and can be told to throw, to test error handling.
- `FakeNavigationService` records where the view model asked to go.
- For the logger, the logging library already has a fake: `NullLogger<T>.Instance` accepts messages and throws them away.
- For messages, create a **new** `WeakReferenceMessenger()` per test instead of using the shared `Default`, so tests cannot hear each other.

All fakes are in the code panel.

### A helper to build the view model

xUnit creates a new instance of the test class for every test, so fields are fresh each time. Build the view model in one place:

```csharp
public class ExpenseListViewModelTests
{
    private readonly FakeExpenseStore _store = new();
    private readonly FakeDialogService _dialogs = new();
    private readonly FakeNavigationService _navigation = new();
    private readonly IMessenger _messenger = new WeakReferenceMessenger();

    private ExpenseListViewModel CreateViewModel() =>
        new(_store, _dialogs, _messenger, _navigation, NullLogger<ExpenseListViewModel>.Instance);
}
```

## What to test

### Properties and computed values

```csharp
[Fact]
public void Constructor_loads_the_list_and_the_total()
{
    Seed();

    var vm = CreateViewModel();

    Assert.Equal(2, vm.Expenses.Count);
    Assert.Equal(15m, vm.Total);
}
```

Bindings only update when `PropertyChanged` fires, so test that too. xUnit has a helper:

```csharp
[Fact]
public void Changing_the_filter_raises_PropertyChanged_for_Total()
{
    Seed();
    var vm = CreateViewModel();

    Assert.PropertyChanged(vm, nameof(vm.Total), () => vm.SelectedFilter = "Transport");
}
```

### Commands and CanExecute

A command is an object with `Execute` and `CanExecute`, so call them directly, just like a button would:

```csharp
[Fact]
public void Add_saves_the_expense_and_clears_the_form()
{
    var vm = CreateViewModel();
    vm.NewTitle = "Cinema";
    vm.NewAmountText = "9";

    vm.AddCommand.Execute(null);

    Expense saved = Assert.Single(_store.Items);
    Assert.Equal(9m, saved.Amount);
    Assert.Equal("", vm.NewTitle);
}
```

`[Theory]` runs the same test with different data. Each `[InlineData]` row is one case:

```csharp
[Theory]
[InlineData("", "5")]
[InlineData("Coffee", "")]
[InlineData("Coffee", "abc")]
[InlineData("Coffee", "-2")]
public void Add_is_disabled_for_bad_input(string title, string amount)
{
    var vm = CreateViewModel();
    vm.NewTitle = title;
    vm.NewAmountText = amount;

    Assert.False(vm.AddCommand.CanExecute(null));
}
```

### Dialog decisions

This is where the fake dialog service shines:

```csharp
[Fact]
public void Delete_does_nothing_when_the_user_says_no()
{
    Seed();
    var vm = CreateViewModel();
    _dialogs.ConfirmAnswer = false;

    vm.DeleteCommand.Execute(vm.Expenses[0]);

    Assert.Equal(1, _dialogs.ConfirmCalls);   // it did ask
    Assert.Equal(2, _store.Items.Count);      // and nothing was deleted
}
```

### Async commands

An `async` `[RelayCommand]` generates an `IAsyncRelayCommand`. Its `ExecuteAsync` returns a `Task`, so make the test `async Task` and await it (see [async and await](/courses/c-sharp/async-and-await)):

```csharp
[Fact]
public async Task Export_does_nothing_when_the_user_cancels()
{
    var vm = CreateViewModel();
    _dialogs.SaveFileAnswer = null; // like pressing Cancel in the Save dialog

    await vm.ExportCommand.ExecuteAsync(null);

    Assert.Empty(_dialogs.Messages);
}
```

Never use `async void` in a test. xUnit cannot wait for it, so the test passes before the work is even done.

### Messages and navigation

```csharp
[Fact]
public void Add_sends_an_ExpenseAddedMessage()
{
    ExpenseAddedMessage? received = null;
    _messenger.Register<ExpenseAddedMessage>(this, (_, m) => received = m);
    var vm = CreateViewModel();
    vm.NewTitle = "Taxi";
    vm.NewAmountText = "20";

    vm.AddCommand.Execute(null);

    Assert.NotNull(received);
    Assert.Equal("Taxi", received.Expense.Title);
}
```

The messages are the ones from [Messaging Between ViewModels](/courses/wpf/messaging-between-viewmodels). Navigation is tested the same way through `FakeNavigationService.Calls`.

## Running the tests

From the command line, in the solution folder:

```bash
dotnet test
```

```text
Passed!  - Failed:     0, Passed:    17, Skipped:     0, Total:    17, Duration: 74 ms
```

In Visual Studio, open **Test > Test Explorer** and click **Run All**. Failed tests show the assert message and a link to the line. You can also right click a single test and debug it, with breakpoints, like any other code.

## Fakes or a mocking library?

Hand written fakes are easy to read and good for learning. When interfaces grow, a **mocking library** such as NSubstitute or Moq can create fakes for you at run time:

```csharp
var dialogs = Substitute.For<IDialogService>();      // NSubstitute
dialogs.Confirm(Arg.Any<string>(), Arg.Any<string>()).Returns(false);
```

Both approaches test the same thing. Start with fakes; switch when writing them becomes boring.

## Common mistakes

- **Testing views.** Do not create windows in unit tests. Test the view model, and keep views thin enough that there is little to test.
- **Shared state between tests.** `WeakReferenceMessenger.Default` and other static objects survive from one test to the next. Create fresh instances.
- **Hidden dependencies.** A view model that calls `DateTime.Now`, `File` or `MessageBox` directly is hard to test. Pass those in through an interface instead.
- **Culture surprises.** Parsing "12.50" fails on a PC where the decimal separator is a comma. Use whole numbers in tests, or set `CultureInfo.CurrentCulture` in the test.
- **One giant test.** Test one behaviour per test, so a failure points at one thing.
- **Forgetting `GC.KeepAlive`.** The weak reference messenger does not keep a recipient alive. If a test creates a view model only to answer a request message, keep a reference to it until the end of the test.

## Quick recap

- View models are plain classes, so tests can create them without any window.
- Each test arranges, acts and asserts. `[Fact]` is one test, `[Theory]` with `[InlineData]` runs one test with many inputs.
- A test project that references a WPF app must target `net10.0-windows`. Better: move view models into a `net10.0` class library that cannot use WPF at all.
- Replace dialogs, storage and navigation with fakes, use `NullLogger<T>.Instance`, and create a fresh messenger per test.
- Call `Execute`, `CanExecute` and `ExecuteAsync` directly, and use `Assert.PropertyChanged` for bindings.
- Run everything with `dotnet test` or Test Explorer.

<code id="code-content" class="language-csharp">
// CoinJar.Tests/ExpenseListViewModelTests.cs
using CoinJar.Messages;
using CoinJar.Models;
using CoinJar.ViewModels;
using CommunityToolkit.Mvvm.Messaging;
using Microsoft.Extensions.Logging.Abstractions;
namespace CoinJar.Tests;
public class ExpenseListViewModelTests
{
    private readonly FakeExpenseStore _store = new();
    private readonly FakeDialogService _dialogs = new();
    private readonly FakeNavigationService _navigation = new();
    private readonly IMessenger _messenger = new WeakReferenceMessenger(); // a fresh one per test
    private ExpenseListViewModel CreateViewModel() =&gt;
        new(_store, _dialogs, _messenger, _navigation, NullLogger&lt;ExpenseListViewModel&gt;.Instance);
    private void Seed()
    {
        _store.Items.Add(new Expense { Id = 1, Title = "Lunch", Amount = 12, Category = "Food" });
        _store.Items.Add(new Expense { Id = 2, Title = "Bus", Amount = 3, Category = "Transport" });
    }
    [Fact]
    public void Constructor_loads_the_list_and_the_total()
    {
        Seed();
        var vm = CreateViewModel();
        Assert.Equal(2, vm.Expenses.Count);
        Assert.Equal(15m, vm.Total);
    }
    [Fact]
    public void Add_saves_the_expense_and_clears_the_form()
    {
        var vm = CreateViewModel();
        vm.NewTitle = "Cinema";
        vm.NewAmountText = "9";
        vm.NewCategory = "Fun";
        vm.AddCommand.Execute(null);
        Expense saved = Assert.Single(_store.Items);
        Assert.Equal("Cinema", saved.Title);
        Assert.Equal(9m, saved.Amount);
        Assert.Single(vm.Expenses);
        Assert.Equal("", vm.NewTitle);
    }
    [Theory]
    [InlineData("", "5")]
    [InlineData("Coffee", "")]
    [InlineData("Coffee", "abc")]
    [InlineData("Coffee", "-2")]
    public void Add_is_disabled_for_bad_input(string title, string amount)
    {
        var vm = CreateViewModel();
        vm.NewTitle = title;
        vm.NewAmountText = amount;
        Assert.False(vm.AddCommand.CanExecute(null));
    }
    [Fact]
    public void Add_sends_an_ExpenseAddedMessage()
    {
        ExpenseAddedMessage? received = null;
        _messenger.Register&lt;ExpenseAddedMessage&gt;(this, (_, m) =&gt; received = m);
        var vm = CreateViewModel();
        vm.NewTitle = "Taxi";
        vm.NewAmountText = "20";
        vm.AddCommand.Execute(null);
        Assert.NotNull(received);
        Assert.Equal("Taxi", received.Expense.Title);
    }
    [Fact]
    public void Delete_does_nothing_when_the_user_says_no()
    {
        Seed();
        var vm = CreateViewModel();
        _dialogs.ConfirmAnswer = false;
        vm.DeleteCommand.Execute(vm.Expenses[0]);
        Assert.Equal(1, _dialogs.ConfirmCalls);
        Assert.Equal(2, _store.Items.Count);
        Assert.Equal(2, vm.Expenses.Count);
    }
    [Fact]
    public void Delete_removes_the_expense_when_the_user_says_yes()
    {
        Seed();
        var vm = CreateViewModel();
        Expense lunch = vm.Expenses.First(e =&gt; e.Title == "Lunch");
        vm.DeleteCommand.Execute(lunch);
        Assert.DoesNotContain(lunch, _store.Items);
        Assert.Equal(3m, vm.Total);
    }
    [Fact]
    public void Edit_changes_the_expense_only_after_OK()
    {
        Seed();
        var vm = CreateViewModel();
        Expense bus = vm.Expenses.First(e =&gt; e.Title == "Bus");
        vm.EditCommand.Execute(bus); // EditAction is null: the user pressed Cancel
        Assert.Equal(3m, bus.Amount);
        _dialogs.EditAction = e =&gt; e.Amount = 4;
        vm.EditCommand.Execute(bus);
        Assert.Equal(4m, bus.Amount);
        Assert.Equal(16m, vm.Total);
    }
    [Fact]
    public void Changing_the_filter_raises_PropertyChanged_for_Total()
    {
        Seed();
        var vm = CreateViewModel();
        Assert.PropertyChanged(vm, nameof(vm.Total), () =&gt; vm.SelectedFilter = "Transport");
    }
    [Fact]
    public void Filter_shows_only_one_category()
    {
        Seed();
        var vm = CreateViewModel();
        vm.SelectedFilter = "Food";
        Expense only = Assert.Single(vm.Expenses);
        Assert.Equal("Lunch", only.Title);
        Assert.Equal(12m, vm.Total);
    }
    [Fact]
    public void ShowDetails_navigates_with_the_expense()
    {
        Seed();
        var vm = CreateViewModel();
        vm.ShowDetailsCommand.Execute(vm.Expenses[0]);
        var call = Assert.Single(_navigation.Calls);
        Assert.Equal(typeof(ExpenseDetailsViewModel), call.Target);
        Assert.Same(vm.Expenses[0], call.Parameter);
    }
    [Fact]
    public async Task Export_writes_a_csv_file_to_the_chosen_path()
    {
        Seed();
        var vm = CreateViewModel();
        string path = Path.Combine(Path.GetTempPath(), $"coinjar-test-{Guid.NewGuid()}.csv");
        _dialogs.SaveFileAnswer = path;
        await vm.ExportCommand.ExecuteAsync(null); // async commands can be awaited
        string[] lines = await File.ReadAllLinesAsync(path);
        Assert.Equal(3, lines.Length); // header + 2 expenses
        File.Delete(path);
    }
    [Fact]
    public async Task Export_does_nothing_when_the_user_cancels()
    {
        var vm = CreateViewModel();
        _dialogs.SaveFileAnswer = null; // like pressing Cancel in the Save dialog
        await vm.ExportCommand.ExecuteAsync(null);
        Assert.Empty(_dialogs.Messages);
    }
    [Fact]
    public void A_broken_store_shows_a_message_instead_of_crashing()
    {
        _store.FailOnGetAll = true;
        var vm = CreateViewModel();
        Assert.Empty(vm.Expenses);
        Assert.Single(_dialogs.Messages);
    }
    [Fact]
    public void Answers_the_current_total_request()
    {
        Seed();
        var vm = CreateViewModel();
        decimal total = _messenger.Send&lt;CurrentTotalRequestMessage&gt;();
        Assert.Equal(15m, total);
        GC.KeepAlive(vm); // the messenger only holds a weak reference
    }
}
// CoinJar.Tests/Fakes.cs
using CoinJar.Models;
using CoinJar.Services;
using CommunityToolkit.Mvvm.ComponentModel;
namespace CoinJar.Tests;
// Never opens a window. The test decides the answers and reads what was shown.
public class FakeDialogService : IDialogService
{
    public bool ConfirmAnswer { get; set; } = true;
    public int ConfirmCalls { get; private set; }
    public List&lt;string&gt; Messages { get; } = [];
    public string? SaveFileAnswer { get; set; }
    public Action&lt;Expense&gt;? EditAction { get; set; } // what the "user" changes in the dialog
    public void ShowMessage(string message, string title = "CoinJar") =&gt; Messages.Add(message);
    public bool Confirm(string message, string title = "Please confirm")
    {
        ConfirmCalls++;
        return ConfirmAnswer;
    }
    public string? PickSaveFile(string suggestedName, string filter) =&gt; SaveFileAnswer;
    public string? PickOpenFile(string filter) =&gt; null;
    public string? PickFolder() =&gt; null;
    public bool EditExpense(Expense expense)
    {
        if (EditAction is null) return false; // like pressing Cancel
        EditAction(expense);
        return true;
    }
}
// Keeps expenses in a list, and can pretend that the disk failed.
public class FakeExpenseStore : IExpenseStore
{
    private int _nextId = 1;
    public List&lt;Expense&gt; Items { get; } = [];
    public bool FailOnGetAll { get; set; }
    public IReadOnlyList&lt;Expense&gt; GetAll() =&gt;
        FailOnGetAll ? throw new IOException("Disk not found") : Items.ToList();
    public void Add(Expense expense)
    {
        expense.Id = _nextId++;
        Items.Add(expense);
    }
    public void Remove(Expense expense) =&gt; Items.Remove(expense);
}
// Remembers where the view model asked to go.
public class FakeNavigationService : ObservableObject, INavigationService
{
    public ObservableObject? CurrentViewModel =&gt; null;
    public bool CanGoBack =&gt; false;
    public List&lt;(Type Target, object? Parameter)&gt; Calls { get; } = [];
    public void NavigateTo&lt;TViewModel&gt;(object? parameter = null) where TViewModel : ObservableObject =&gt;
        Calls.Add((typeof(TViewModel), parameter));
    public void GoBack() { }
}
</code></pre>

