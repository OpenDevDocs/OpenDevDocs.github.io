---
publishDate: 2026-10-25T20:39
title: 'Dependency Injection with the Generic Host'
slug: dependency-injection-with-the-generic-host
metadescription: 'Use Microsoft.Extensions.Hosting in a WPF app: remove StartupUri, build an IHost in App, register views, view models and services, and resolve MainWindow from the container.'
updateDate: 2026-10-25T20:39
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'mvvm', 'dependency-injection', 'generic-host']
course: wpf
---

## Who creates your objects?

Right now CoinJar's window creates its own view model:

```csharp
DataContext = new ExpenseListViewModel();
```

That is fine until the view model needs helpers. Soon it will need a service that saves expenses, a dialog service, a logger and a messenger. If every class creates its own helpers with `new`, you end up with long chains of constructors, and you cannot swap a real service for a fake one in a test.

**Dependency injection** (DI) turns this around. A class simply **asks** for what it needs in its constructor, and something else hands those objects in. That "something else" is a **DI container**: an object that knows how to build every class in your app. You give it a list of registrations at startup, and it does the wiring. If the idea is new, read [dependency injection fundamentals](/courses/c-sharp/dependency-injection-fundamentals) in the C# course first.

ASP.NET Core apps have DI built in. WPF does not, but you can add the same system with the **.NET Generic Host**. A **host** is an object that owns the app's services, configuration and logging, and starts and stops them for you.

## Install the package

```bash
dotnet add package Microsoft.Extensions.Hosting
```

This one package brings in the DI container (`Microsoft.Extensions.DependencyInjection`), configuration (`appsettings.json`, environment variables) and logging. The toolkit from [MVVM with CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm) should be installed too.

## Step 1: a service to inject

Let us give the view model something worth injecting: a store that holds expenses. Start with an [interface](/courses/c-sharp/interfaces), so the view model depends on "something that stores expenses", not on one exact class.

```csharp
namespace CoinJar.Services;

public interface IExpenseStore
{
    IReadOnlyList<Expense> GetAll();
    void Add(Expense expense);
    void Remove(Expense expense);
}
```

The first version keeps everything in memory. Later, in [Saving Data to JSON Files](/courses/wpf/saving-data-to-json-files) and [SQLite with EF Core](/courses/wpf/sqlite-with-ef-core), you will write other classes with the same interface and swap them in with one line.

```csharp
public class InMemoryExpenseStore : IExpenseStore
{
    private readonly List<Expense> _items =
    [
        new Expense { Id = 1, Title = "Coffee", Amount = 3.50m, Category = "Food" },
        new Expense { Id = 2, Title = "Bus ticket", Amount = 2.80m, Category = "Transport" },
    ];

    public IReadOnlyList<Expense> GetAll() => _items;
    public void Add(Expense expense) => _items.Add(expense);
    public void Remove(Expense expense) => _items.Remove(expense);
}
```

## Step 2: ask for it in the constructor

The view model no longer creates anything. It lists what it needs:

```csharp
public partial class ExpenseListViewModel : ObservableObject
{
    private readonly IExpenseStore _store;
    private readonly ILogger<ExpenseListViewModel> _logger;

    public ExpenseListViewModel(IExpenseStore store, ILogger<ExpenseListViewModel> logger)
    {
        _store = store;
        _logger = logger;

        foreach (var expense in _store.GetAll())
            Expenses.Add(expense);
    }
}
```

`ILogger<T>` comes free with the host. You will use it properly in [Error Handling and Logging](/courses/wpf/error-handling-and-logging).

The window does the same. It asks for its view model:

```csharp
public partial class MainWindow : Window
{
    public MainWindow(ExpenseListViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;
    }
}
```

## Step 3: remove StartupUri

A new WPF project starts like this:

```xml
<Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml">
```

`StartupUri` tells WPF to create `MainWindow` itself, using its parameterless constructor. Our `MainWindow` now needs a view model, so WPF cannot create it. **Delete the `StartupUri` attribute.** We will create and show the window ourselves.

```xml
<Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <Application.Resources>
        <!-- Your styles and dictionaries stay here as before -->
    </Application.Resources>
</Application>
```

If you forget this step, the app still starts but you get an exception like "No matching constructor found" when WPF tries to create the window.

## Step 4: build the host in App

Open `App.xaml.cs`. You build the host when the app object is created, start it in `OnStartup`, and stop it in `OnExit`:

```csharp
public partial class App : Application
{
    private readonly IHost _host;

    public App()
    {
        HostApplicationBuilder builder = Host.CreateApplicationBuilder();

        // Services
        builder.Services.AddSingleton<IExpenseStore, InMemoryExpenseStore>();

        // View models
        builder.Services.AddSingleton<ExpenseListViewModel>();

        // Views
        builder.Services.AddSingleton<MainWindow>();

        _host = builder.Build();
    }
}
```

Each `Add...` line is a **registration**: "when someone asks for `IExpenseStore`, give them an `InMemoryExpenseStore`". When you register a class with no interface (like `ExpenseListViewModel`), the class itself is the key.

## Step 5: resolve MainWindow and show it

`OnStartup` runs when WPF starts the app. Start the host, ask the container for `MainWindow`, and show it:

```csharp
protected override void OnStartup(StartupEventArgs e)
{
    base.OnStartup(e);
    _host.Start();

    MainWindow window = _host.Services.GetRequiredService<MainWindow>();
    window.Show();
}
```

This one call is where the magic happens. The container sees that `MainWindow` needs an `ExpenseListViewModel`, which needs an `IExpenseStore` and an `ILogger<ExpenseListViewModel>`. It builds them all in the right order and passes them in. Taking an object out of the container like this is called **resolving** it.

`GetRequiredService` throws a clear error if something is not registered. `GetService` returns `null` instead, which tends to hide mistakes.

## Step 6: stop the host on exit

When the last window closes, WPF calls `OnExit`. Stop the host so background services can finish, then dispose it, which also disposes any services that implement `IDisposable` (see [IDisposable and resource management](/courses/c-sharp/idisposable-and-resource-management)):

```csharp
protected override void OnExit(ExitEventArgs e)
{
    _host.StopAsync(TimeSpan.FromSeconds(5)).GetAwaiter().GetResult();
    _host.Dispose();
    base.OnExit(e);
}
```

We wait for `StopAsync` here on purpose. If `OnExit` were `async void`, the process could end before the `await` finished.

## Lifetimes: how long does an object live?

Every registration picks a **lifetime**:

| Method | Meaning | Good for |
| --- | --- | --- |
| `AddSingleton` | One instance for the whole app | Stores, settings, the main window and its view model |
| `AddTransient` | A new instance every time it is asked for | Dialog windows, screens that should start fresh |
| `AddScoped` | One instance per scope | Mostly a web idea. Rarely needed in WPF |

A desktop app has one user, so most services are singletons. Use transient for a dialog: each time it opens, you want a brand new window with empty fields.

```csharp
builder.Services.AddTransient<EditExpenseViewModel>();
builder.Services.AddTransient<EditExpenseWindow>();
```

One warning: a singleton must not depend on a transient that holds state, because the singleton keeps that one instance forever.

## Configuration comes for free

`Host.CreateApplicationBuilder()` also reads `appsettings.json` from the app's folder, plus environment variables. You can read values from `builder.Configuration`:

```csharp
string currency = builder.Configuration["CoinJar:Currency"] ?? "GBP";
```

```json
{
  "CoinJar": {
    "Currency": "GBP"
  }
}
```

For the file to be found, set it to copy to the output folder in the `.csproj`. The full story is in [App Settings and Configuration](/courses/wpf/app-settings-and-configuration).

## Tips

- **Keep the container in App.** Pass things through constructors. Avoid a global `App.Services` property that any class can reach into. That pattern, called a **service locator**, hides what a class really needs. If you truly need it in one awkward spot, keep it to that spot.
- **Register by interface for anything you might swap.** `IExpenseStore` is easy to fake in [unit tests](/courses/wpf/unit-testing-viewmodels).
- **Read the error message.** "Unable to resolve service for type X while attempting to activate Y" means you forgot to register X.
- **The designer still needs a parameterless constructor** for user controls you place inside other XAML. Windows and view models resolved from the container do not.

## Quick recap

- The Generic Host (`Microsoft.Extensions.Hosting`) gives WPF a DI container, configuration and logging.
- Classes ask for their dependencies in the constructor. The container builds and passes them in.
- Remove `StartupUri` from `App.xaml`, build the `IHost` in `App`, start it in `OnStartup` and stop and dispose it in `OnExit`.
- Register services, view models and views, then resolve `MainWindow` with `GetRequiredService` and call `Show()`.
- Use `AddSingleton` for long lived objects and `AddTransient` for things that should start fresh, like dialogs.

<code id="code-content" class="language-csharp">
// App.xaml.cs
using System.Windows;
using CoinJar.Services;
using CoinJar.ViewModels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
namespace CoinJar;
public partial class App : Application
{
    private readonly IHost _host;
    public App()
    {
        HostApplicationBuilder builder = Host.CreateApplicationBuilder();
        // Services: register by interface so they are easy to swap
        builder.Services.AddSingleton&lt;IExpenseStore, InMemoryExpenseStore&gt;();
        // View models
        builder.Services.AddSingleton&lt;ExpenseListViewModel&gt;();
        // Views
        builder.Services.AddSingleton&lt;MainWindow&gt;();
        _host = builder.Build();
    }
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        _host.Start();
        // The container builds MainWindow and everything it needs
        MainWindow window = _host.Services.GetRequiredService&lt;MainWindow&gt;();
        window.Show();
    }
    protected override void OnExit(ExitEventArgs e)
    {
        // Wait here: an async void OnExit could be cut off when the process ends
        _host.StopAsync(TimeSpan.FromSeconds(5)).GetAwaiter().GetResult();
        _host.Dispose();
        base.OnExit(e);
    }
}
&lt;!-- App.xaml --&gt;
&lt;!-- StartupUri is gone: App.OnStartup shows the window --&gt;
&lt;Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"&gt;
    &lt;Application.Resources&gt;
    &lt;/Application.Resources&gt;
&lt;/Application&gt;
// MainWindow.xaml.cs
using System.Windows;
using CoinJar.ViewModels;
namespace CoinJar;
public partial class MainWindow : Window
{
    // The view model is injected by the container
    public MainWindow(ExpenseListViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;
    }
}
// Services/IExpenseStore.cs
using CoinJar.Models;
namespace CoinJar.Services;
public interface IExpenseStore
{
    IReadOnlyList&lt;Expense&gt; GetAll();
    void Add(Expense expense);
    void Remove(Expense expense);
}
// Services/InMemoryExpenseStore.cs
using CoinJar.Models;
namespace CoinJar.Services;
// First version: data lives only while the app runs
public class InMemoryExpenseStore : IExpenseStore
{
    private readonly List&lt;Expense&gt; _items =
    [
        new Expense { Id = 1, Title = "Coffee", Amount = 3.50m, Category = "Food" },
        new Expense { Id = 2, Title = "Bus ticket", Amount = 2.80m, Category = "Transport" },
    ];
    public IReadOnlyList&lt;Expense&gt; GetAll() =&gt; _items;
    public void Add(Expense expense) =&gt; _items.Add(expense);
    public void Remove(Expense expense) =&gt; _items.Remove(expense);
}
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using CoinJar.Models;
using CoinJar.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Extensions.Logging;
namespace CoinJar.ViewModels;
public partial class ExpenseListViewModel : ObservableObject
{
    private readonly IExpenseStore _store;
    private readonly ILogger&lt;ExpenseListViewModel&gt; _logger;
    // Dependencies arrive through the constructor
    public ExpenseListViewModel(IExpenseStore store, ILogger&lt;ExpenseListViewModel&gt; logger)
    {
        _store = store;
        _logger = logger;
        Expenses.CollectionChanged += (_, _) =&gt; OnPropertyChanged(nameof(Total));
        foreach (var expense in _store.GetAll())
            Expenses.Add(expense);
    }
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = [];
    public string[] Categories { get; } = ["Food", "Transport", "Bills", "Fun", "Other"];
    public decimal Total =&gt; Expenses.Sum(e =&gt; e.Amount);
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(AddCommand))]
    public partial string NewTitle { get; set; } = "";
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(AddCommand))]
    public partial decimal NewAmount { get; set; }
    [ObservableProperty]
    public partial string NewCategory { get; set; } = "Food";
    [RelayCommand(CanExecute = nameof(CanAdd))]
    private void Add()
    {
        var expense = new Expense
        {
            Id = Expenses.Count == 0 ? 1 : Expenses.Max(e =&gt; e.Id) + 1,
            Title = NewTitle.Trim(),
            Amount = NewAmount,
            Category = NewCategory
        };
        _store.Add(expense);     // save through the service
        Expenses.Add(expense);   // update the screen
        _logger.LogInformation("Added expense {Title}", expense.Title);
        NewTitle = "";
        NewAmount = 0;
    }
    private bool CanAdd() =&gt; !string.IsNullOrWhiteSpace(NewTitle) &amp;&amp; NewAmount &gt; 0;
    [RelayCommand]
    private void Delete(Expense? expense)
    {
        if (expense is null) return;
        _store.Remove(expense);
        Expenses.Remove(expense);
    }
}
</code></pre>
