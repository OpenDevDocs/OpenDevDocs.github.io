---
publishDate: 2026-10-25T20:40
title: 'Navigation Between Views'
slug: navigation-between-views
metadescription: 'Build ViewModel-first navigation in WPF: a ContentControl bound to the current view model, DataTemplates keyed by DataType, a navigation service, parameters and a Back button.'
updateDate: 2026-10-25T20:40
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'mvvm', 'navigation', 'datatemplate']
course: wpf
---

## One window, many screens

CoinJar is growing. Besides the expense list, we want a summary screen with totals per category and a details screen for one expense. You could open a new window for each, but most modern apps keep **one** main window and swap the content in the middle, with a menu or side bar to move between screens.

There are two common ways to do this in WPF:

- **View-first**: you pick the next view (a `Page`) and WPF's `Frame` shows it. The view then creates or finds its view model.
- **ViewModel-first**: you pick the next **view model**, and WPF finds the matching view for you through a `DataTemplate`.

ViewModel-first fits MVVM best, because navigation becomes plain C# in your view models: no view types, easy to test. That is the approach this lesson builds.

## The core trick: a ContentControl and DataTemplates

A `ContentControl` shows whatever object you put in its `Content` property. If that object is not a UI element, WPF looks for a `DataTemplate` whose `DataType` matches the object's type, and uses it to draw the object. You saw this idea in [Data Templates](/courses/wpf/data-templates).

So if the content is an `ExpenseListViewModel`, and there is a template for that type, WPF shows an `ExpenseListView`:

```xml
<Window.Resources>
    <DataTemplate DataType="{x:Type vm:ExpenseListViewModel}">
        <views:ExpenseListView />
    </DataTemplate>
    <DataTemplate DataType="{x:Type vm:SummaryViewModel}">
        <views:SummaryView />
    </DataTemplate>
</Window.Resources>

<ContentControl Content="{Binding Navigation.CurrentViewModel}" />
```

A template with a `DataType` and no `x:Key` is an **implicit template**: the type itself acts as its key. WPF also sets the view's `DataContext` to the view model automatically, so every binding inside `ExpenseListView` just works.

Change `CurrentViewModel` to a `SummaryViewModel`, and the screen switches to `SummaryView`. That is all navigation is.

## Step 1: turn screens into user controls

Each screen becomes a `UserControl` in the `Views` folder. In Visual Studio: right click the `Views` folder, **Add**, **User Control (WPF)**. Move the XAML that used to be in `MainWindow` into `ExpenseListView.xaml`:

```xml
<UserControl x:Class="CoinJar.Views.ExpenseListView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <DockPanel Margin="16">
        <TextBlock DockPanel.Dock="Top" Text="Expenses" FontSize="20" Margin="0,0,0,8" />
        <TextBlock DockPanel.Dock="Bottom" Text="{Binding Total, StringFormat='Total: {0:C}'}" />
        <ListBox ItemsSource="{Binding Expenses}" DisplayMemberPath="Title" />
    </DockPanel>
</UserControl>
```

Notice there is no `DataContext` set here. The `DataTemplate` provides it. You will learn much more about this kind of control in [User Controls](/courses/wpf/user-controls).

## Step 2: a navigation service

Who changes `CurrentViewModel`? A small service. View models ask it to navigate, and it creates the next view model from the DI container you set up in [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host).

```csharp
public interface INavigationService : INotifyPropertyChanged
{
    ObservableObject? CurrentViewModel { get; }
    bool CanGoBack { get; }
    void NavigateTo<TViewModel>(object? parameter = null) where TViewModel : ObservableObject;
    void GoBack();
}
```

The `where TViewModel : ObservableObject` part is a [generic constraint](/courses/c-sharp/generic-constraints): you can only navigate to view models.

The implementation asks the container (`IServiceProvider`) for the view model:

```csharp
public partial class NavigationService(IServiceProvider services) : ObservableObject, INavigationService
{
    [ObservableProperty]
    public partial ObservableObject? CurrentViewModel { get; private set; }

    public void NavigateTo<TViewModel>(object? parameter = null) where TViewModel : ObservableObject
    {
        CurrentViewModel = services.GetRequiredService<TViewModel>();
    }
}
```

`private set` means only the service can change the current screen. Everyone else just reads it. The full version with a Back button is in the code panel.

## Step 3: the shell view model

The main window now hosts screens instead of being one. Its view model, often called the **shell**, holds the navigation service and the menu commands:

```csharp
public partial class MainViewModel : ObservableObject
{
    public MainViewModel(INavigationService navigation)
    {
        Navigation = navigation;
        Navigation.NavigateTo<ExpenseListViewModel>(); // first screen
    }

    public INavigationService Navigation { get; }

    [RelayCommand]
    private void ShowExpenses() => Navigation.NavigateTo<ExpenseListViewModel>();

    [RelayCommand]
    private void ShowSummary() => Navigation.NavigateTo<SummaryViewModel>();
}
```

And the window binds to it:

```xml
<DockPanel>
    <StackPanel DockPanel.Dock="Left" Width="160" Margin="8">
        <Button Content="Expenses" Command="{Binding ShowExpensesCommand}" Margin="0,0,0,4" />
        <Button Content="Summary" Command="{Binding ShowSummaryCommand}" />
    </StackPanel>
    <ContentControl Content="{Binding Navigation.CurrentViewModel}" />
</DockPanel>
```

## Step 4: register everything

Every view model you navigate to must be registered, plus the service and the shell:

```csharp
builder.Services.AddSingleton<INavigationService, NavigationService>();
builder.Services.AddSingleton<MainViewModel>();
builder.Services.AddSingleton<ExpenseListViewModel>();   // keeps its state between visits
builder.Services.AddTransient<SummaryViewModel>();       // fresh numbers on every visit
builder.Services.AddTransient<ExpenseDetailsViewModel>();
builder.Services.AddSingleton<MainWindow>();
```

The lifetime now has a visible effect:

- A **singleton** screen keeps what the user typed. Leave the list and come back, and the half filled form is still there.
- A **transient** screen starts fresh each time. The summary recalculates on every visit, because a new `SummaryViewModel` is built.

You do **not** register the views (`ExpenseListView` and friends). The `DataTemplate` creates them.

## Passing a parameter

The details screen needs to know which expense to show. Add a small interface for view models that want a parameter:

```csharp
public interface INavigationAware
{
    void OnNavigatedTo(object? parameter);
}
```

The navigation service hands the parameter over before showing the screen:

```csharp
var next = services.GetRequiredService<TViewModel>();
if (next is INavigationAware aware)
    aware.OnNavigatedTo(parameter);
CurrentViewModel = next;
```

The details view model reads it with a pattern match:

```csharp
public partial class ExpenseDetailsViewModel : ObservableObject, INavigationAware
{
    [ObservableProperty]
    public partial Expense? Expense { get; set; }

    public void OnNavigatedTo(object? parameter) => Expense = parameter as Expense;
}
```

And the list view model navigates with the selected expense:

```csharp
[RelayCommand]
private void ShowDetails(Expense? expense)
{
    if (expense is not null)
        _navigation.NavigateTo<ExpenseDetailsViewModel>(expense);
}
```

## Adding a Back button

To go back, remember where you came from. A `Stack<T>` is perfect: push the old screen when you navigate, pop it to go back (see [Stack](/courses/c-sharp/stack-t) in the C# course).

```csharp
private readonly Stack<ObservableObject> _history = new();

public bool CanGoBack => _history.Count > 0;

public void GoBack()
{
    if (_history.Count > 0)
        CurrentViewModel = _history.Pop();
}
```

Add `[NotifyPropertyChangedFor(nameof(CanGoBack))]` on `CurrentViewModel`, then bind the button's `IsEnabled` to `Navigation.CanGoBack`. Going back shows the **same** view model object as before, so any scroll position or typed text in it is still there.

## The view-first alternative: Frame and Page

WPF has a built in navigation system too. A `Frame` shows `Page` objects and keeps a Back and Forward history, like a browser:

```xml
<Frame x:Name="MainFrame" NavigationUIVisibility="Hidden" />
```

```csharp
MainFrame.Navigate(new SummaryPage());
```

It works, and it is handy for wizard style apps. But navigation happens in code-behind with view types, which makes it harder to test and to combine with DI. Most MVVM apps use the ViewModel-first approach from this lesson.

## Common mistakes

- **Forgetting the DataTemplate.** If there is no template for a view model, the `ContentControl` shows the class name as text, like `CoinJar.ViewModels.SummaryViewModel`. That is your hint.
- **Setting `DataContext` inside the view.** The template already sets it. Writing `DataContext = new SummaryViewModel()` in the view's constructor creates a second, disconnected view model.
- **`RelativeSource AncestorType=Window` inside a view.** The window's `DataContext` is now `MainViewModel`, not the screen's view model. Use `AncestorType=UserControl` to reach the view's own view model.
- **Forgetting to register a view model.** `GetRequiredService` throws "No service for type ... has been registered".
- **Wrong lifetime.** A screen that should reset (a "new expense" form) must be transient. A screen that should remember things should be a singleton.

## Quick recap

- ViewModel-first navigation: a `ContentControl` shows the current view model, and implicit `DataTemplate`s keyed by `DataType` pick the view.
- A navigation service owns `CurrentViewModel` and creates view models from the DI container.
- The shell `MainViewModel` exposes the service and the menu commands.
- `INavigationAware` passes a parameter, and a `Stack` of old view models gives you a Back button.
- Singleton screens keep their state, transient screens start fresh.
- `Frame` and `Page` exist for view-first navigation, but fit MVVM less well.

<code id="code-content" class="language-csharp">
// Services/INavigationService.cs
using System.ComponentModel;
using CommunityToolkit.Mvvm.ComponentModel;
namespace CoinJar.Services;
public interface INavigationService : INotifyPropertyChanged
{
    ObservableObject? CurrentViewModel { get; }
    bool CanGoBack { get; }
    void NavigateTo&lt;TViewModel&gt;(object? parameter = null) where TViewModel : ObservableObject;
    void GoBack();
}
// View models that want a navigation parameter implement this
public interface INavigationAware
{
    void OnNavigatedTo(object? parameter);
}
// Services/NavigationService.cs
using CommunityToolkit.Mvvm.ComponentModel;
using Microsoft.Extensions.DependencyInjection;
namespace CoinJar.Services;
public partial class NavigationService(IServiceProvider services) : ObservableObject, INavigationService
{
    private readonly Stack&lt;ObservableObject&gt; _history = new();
    // The ContentControl in MainWindow binds to this
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CanGoBack))]
    public partial ObservableObject? CurrentViewModel { get; private set; }
    public bool CanGoBack =&gt; _history.Count &gt; 0;
    public void NavigateTo&lt;TViewModel&gt;(object? parameter = null) where TViewModel : ObservableObject
    {
        // The container decides: same instance (singleton) or a new one (transient)
        TViewModel next = services.GetRequiredService&lt;TViewModel&gt;();
        if (next is INavigationAware aware)
            aware.OnNavigatedTo(parameter);
        if (CurrentViewModel is not null &amp;&amp; !ReferenceEquals(CurrentViewModel, next))
            _history.Push(CurrentViewModel);
        CurrentViewModel = next;
    }
    public void GoBack()
    {
        if (_history.Count &gt; 0)
            CurrentViewModel = _history.Pop();
    }
}
// ViewModels/MainViewModel.cs
using CoinJar.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
namespace CoinJar.ViewModels;
// The "shell": owns the menu, hosts the current screen
public partial class MainViewModel : ObservableObject
{
    public MainViewModel(INavigationService navigation)
    {
        Navigation = navigation;
        Navigation.NavigateTo&lt;ExpenseListViewModel&gt;();
    }
    public INavigationService Navigation { get; }
    [RelayCommand]
    private void ShowExpenses() =&gt; Navigation.NavigateTo&lt;ExpenseListViewModel&gt;();
    [RelayCommand]
    private void ShowSummary() =&gt; Navigation.NavigateTo&lt;SummaryViewModel&gt;();
    [RelayCommand]
    private void GoBack() =&gt; Navigation.GoBack();
}
// ViewModels/ExpenseDetailsViewModel.cs
using CoinJar.Models;
using CoinJar.Services;
using CommunityToolkit.Mvvm.ComponentModel;
namespace CoinJar.ViewModels;
public partial class ExpenseDetailsViewModel : ObservableObject, INavigationAware
{
    [ObservableProperty]
    public partial Expense? Expense { get; set; }
    // Receives the expense passed to NavigateTo
    public void OnNavigatedTo(object? parameter) =&gt; Expense = parameter as Expense;
}
// ViewModels/SummaryViewModel.cs
using CoinJar.Services;
using CommunityToolkit.Mvvm.ComponentModel;
namespace CoinJar.ViewModels;
public record CategoryTotal(string Category, decimal Amount);
// Registered as transient, so the numbers are fresh on every visit
public partial class SummaryViewModel : ObservableObject
{
    public SummaryViewModel(IExpenseStore store)
    {
        var all = store.GetAll();
        Total = all.Sum(e =&gt; e.Amount);
        ByCategory = all.GroupBy(e =&gt; e.Category)
                        .Select(g =&gt; new CategoryTotal(g.Key, g.Sum(e =&gt; e.Amount)))
                        .OrderByDescending(c =&gt; c.Amount)
                        .ToList();
    }
    public decimal Total { get; }
    public IReadOnlyList&lt;CategoryTotal&gt; ByCategory { get; }
}
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
        builder.Services.AddSingleton&lt;IExpenseStore, InMemoryExpenseStore&gt;();
        builder.Services.AddSingleton&lt;INavigationService, NavigationService&gt;();
        builder.Services.AddSingleton&lt;MainViewModel&gt;();
        builder.Services.AddSingleton&lt;ExpenseListViewModel&gt;();
        builder.Services.AddTransient&lt;SummaryViewModel&gt;();
        builder.Services.AddTransient&lt;ExpenseDetailsViewModel&gt;();
        builder.Services.AddSingleton&lt;MainWindow&gt;();
        // Views are NOT registered: the DataTemplates create them
        _host = builder.Build();
    }
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        _host.Start();
        _host.Services.GetRequiredService&lt;MainWindow&gt;().Show();
    }
    protected override void OnExit(ExitEventArgs e)
    {
        _host.StopAsync(TimeSpan.FromSeconds(5)).GetAwaiter().GetResult();
        _host.Dispose();
        base.OnExit(e);
    }
}
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="clr-namespace:CoinJar.ViewModels"
        xmlns:views="clr-namespace:CoinJar.Views"
        Title="CoinJar" Height="480" Width="720"&gt;
    &lt;Window.Resources&gt;
        &lt;!-- Implicit templates: the DataType is the key --&gt;
        &lt;DataTemplate DataType="{x:Type vm:ExpenseListViewModel}"&gt;
            &lt;views:ExpenseListView /&gt;
        &lt;/DataTemplate&gt;
        &lt;DataTemplate DataType="{x:Type vm:SummaryViewModel}"&gt;
            &lt;views:SummaryView /&gt;
        &lt;/DataTemplate&gt;
        &lt;DataTemplate DataType="{x:Type vm:ExpenseDetailsViewModel}"&gt;
            &lt;views:ExpenseDetailsView /&gt;
        &lt;/DataTemplate&gt;
    &lt;/Window.Resources&gt;
    &lt;DockPanel&gt;
        &lt;StackPanel DockPanel.Dock="Left" Width="160" Margin="8"&gt;
            &lt;Button Content="Back" Command="{Binding GoBackCommand}"
                    IsEnabled="{Binding Navigation.CanGoBack}" Margin="0,0,0,12" /&gt;
            &lt;Button Content="Expenses" Command="{Binding ShowExpensesCommand}" Margin="0,0,0,4" /&gt;
            &lt;Button Content="Summary" Command="{Binding ShowSummaryCommand}" /&gt;
        &lt;/StackPanel&gt;
        &lt;!-- Shows the current view model, drawn by its DataTemplate --&gt;
        &lt;ContentControl Content="{Binding Navigation.CurrentViewModel}" /&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using CoinJar.ViewModels;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow(MainViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;
    }
}
</code></pre>
