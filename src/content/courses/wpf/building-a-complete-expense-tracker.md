---
publishDate: 2026-10-25T21:02
title: 'Building a Complete Expense Tracker'
slug: building-a-complete-expense-tracker
metadescription: 'Put the whole course together: build the complete CoinJar expense tracker with MVVM, the Generic Host, navigation, dialogs, messaging, SQLite, logging, tests and a published exe.'
updateDate: 2026-10-25T21:02
author: ['bishal-biswas']
level: 4
tags: ['wpf', 'project', 'mvvm', 'sqlite', 'capstone']
course: wpf
---

## What you are building

This is the final project. Over the course you built CoinJar one piece at a time: a list here, a dialog there, a database in another lesson. Now you put all the pieces into one finished app, the way a real WPF project is organised.

The finished CoinJar can:

- show all expenses as cards, newest first, with a running total;
- filter the list by category;
- add an expense from a form, with keyboard shortcuts;
- edit an expense in a dialog and delete it after a confirmation;
- show one expense on a details screen and a summary screen with totals per category and a budget warning;
- export the list to a CSV file;
- keep everything in a SQLite database that survives restarts and updates;
- log what happens, survive unexpected errors, and pass a suite of unit tests;
- be published as a single exe.

Each section below says which earlier lesson the piece comes from, so you can go back for the details. Nothing here is new; the new part is seeing it all fit together.

## The solution layout

CoinJar uses three projects, as introduced in [Unit Testing ViewModels](/courses/wpf/unit-testing-viewmodels):

```text
CoinJar.slnx
│
├── CoinJar.Core/                 class library, net10.0 (no WPF allowed)
│   ├── Models/Expense.cs
│   ├── Messages/ExpenseMessages.cs
│   ├── Services/IExpenseStore.cs, IDialogService.cs, INavigationService.cs,
│   │            NavigationService.cs, CoinJarOptions.cs
│   └── ViewModels/MainViewModel.cs, ExpenseListViewModel.cs, SummaryViewModel.cs,
│                  ExpenseDetailsViewModel.cs, EditExpenseViewModel.cs
│
├── CoinJar/                      WPF app, net10.0-windows
│   ├── App.xaml, App.xaml.cs, MainWindow.xaml, appsettings.json
│   ├── Controls/ExpenseCard.xaml, MoneyTile.xaml
│   ├── Data/CoinJarDbContext.cs, DesignTimeDbContextFactory.cs, Migrations/
│   ├── Services/SqliteExpenseStore.cs, DialogService.cs, FileLoggerProvider.cs
│   ├── Styles/AppStyles.xaml
│   └── Views/ExpenseListView.xaml, SummaryView.xaml, ExpenseDetailsView.xaml,
│              EditExpenseWindow.xaml
│
└── CoinJar.Tests/                xUnit, net10.0
    ├── Fakes.cs
    └── ExpenseListViewModelTests.cs
```

The rule that decides where a file goes: if it needs WPF (windows, controls, XAML, `MessageBox`), it lives in `CoinJar`. Everything else lives in `CoinJar.Core`, where the tests can reach it and where the compiler stops WPF from creeping in.

## Step 1: create the projects

From an empty folder:

```bash
dotnet new sln -n CoinJar
dotnet new wpf -n CoinJar -o CoinJar
dotnet new classlib -n CoinJar.Core -o CoinJar.Core
dotnet new xunit -n CoinJar.Tests -o CoinJar.Tests
dotnet sln add CoinJar/CoinJar.csproj CoinJar.Core/CoinJar.Core.csproj CoinJar.Tests/CoinJar.Tests.csproj

dotnet add CoinJar/CoinJar.csproj reference CoinJar.Core/CoinJar.Core.csproj
dotnet add CoinJar.Tests/CoinJar.Tests.csproj reference CoinJar.Core/CoinJar.Core.csproj

dotnet add CoinJar.Core/CoinJar.Core.csproj package CommunityToolkit.Mvvm
dotnet add CoinJar.Core/CoinJar.Core.csproj package Microsoft.Extensions.Logging.Abstractions
dotnet add CoinJar.Core/CoinJar.Core.csproj package Microsoft.Extensions.DependencyInjection.Abstractions
dotnet add CoinJar.Core/CoinJar.Core.csproj package Microsoft.Extensions.Options

dotnet add CoinJar/CoinJar.csproj package Microsoft.Extensions.Hosting
dotnet add CoinJar/CoinJar.csproj package Microsoft.EntityFrameworkCore.Sqlite
dotnet add CoinJar/CoinJar.csproj package Microsoft.EntityFrameworkCore.Design
```

Delete `Class1.cs`, `UnitTest1.cs`, and the template's `MainWindow` files (you will write your own). In `CoinJar.Core.csproj`, add `<RootNamespace>CoinJar</RootNamespace>` so namespaces stay `CoinJar.Models` and `CoinJar.ViewModels`. The project templates and files were explained in [Your First WPF App](/courses/wpf/your-first-wpf-app) and [Understanding the Project Structure](/courses/wpf/understanding-the-project-structure).

The app's project file, with the version details from [Publishing and Packaging WPF Apps](/courses/wpf/publishing-and-packaging-wpf-apps):

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net10.0-windows</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <UseWPF>true</UseWPF>
  </PropertyGroup>

  <!-- What Windows shows in the file's Properties > Details tab -->
  <PropertyGroup>
    <Product>CoinJar</Product>
    <Company>OpenDevDocs</Company>
    <Copyright>Copyright 2026 OpenDevDocs</Copyright>
    <Version>1.0.0</Version>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.14">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="10.0.14" />
    <PackageReference Include="Microsoft.Extensions.Hosting" Version="10.0.14" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\CoinJar.Core\CoinJar.Core.csproj" />
  </ItemGroup>

  <ItemGroup>
    <!-- Settings file next to the exe, also after publishing -->
    <None Update="appsettings.json" CopyToOutputDirectory="PreserveNewest" />
  </ItemGroup>

</Project>
```

## Step 2: the model

One class: `Expense`, a partial `ObservableObject` with partial properties, exactly as in [MVVM with CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm). The only addition is the shared list of categories, so the form, the filter and the edit dialog all use the same five names.

```csharp
// CoinJar.Core/Models/Expense.cs
using CommunityToolkit.Mvvm.ComponentModel;

namespace CoinJar.Models;

// One spending entry. ObservableObject lets the screen update when a value changes.
public partial class Expense : ObservableObject
{
    // The five categories CoinJar knows about.
    public static readonly string[] Categories = ["Food", "Transport", "Bills", "Fun", "Other"];

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

Because it raises `PropertyChanged`, an edit to an expense updates its card on screen ([INotifyPropertyChanged](/courses/wpf/inotifypropertychanged)) and lets the SQLite store save it. Static members such as `Categories` are ignored by EF Core and JSON.

## Step 3: service interfaces

View models talk to the outside world only through [interfaces](/courses/c-sharp/interfaces). That is what makes them testable.

The store from [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host), implemented in memory, in JSON ([Saving Data to JSON Files](/courses/wpf/saving-data-to-json-files)) and in SQLite:

```csharp
// CoinJar.Core/Services/IExpenseStore.cs
using CoinJar.Models;

namespace CoinJar.Services;

// Where expenses live: in memory, JSON, SQLite or a fake in the tests.
public interface IExpenseStore
{
    IReadOnlyList<Expense> GetAll();
    void Add(Expense expense);
    void Remove(Expense expense);
}
```

The dialog service from [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes):

```csharp
// CoinJar.Core/Services/IDialogService.cs
using CoinJar.Models;

namespace CoinJar.Services;

// View models only see this interface: plain bools and strings.
public interface IDialogService
{
    void ShowMessage(string message, string title = "CoinJar");
    bool Confirm(string message, string title = "Please confirm");
    string? PickSaveFile(string suggestedName, string filter);
    string? PickOpenFile(string filter);
    string? PickFolder();
    bool EditExpense(Expense expense);
}
```

`INavigationService`, `INavigationAware` and `NavigationService` come unchanged from [Navigation Between Views](/courses/wpf/navigation-between-views). `NavigationService` only uses `IServiceProvider`, so it can live in the library too. The settings class from [App Settings and Configuration](/courses/wpf/app-settings-and-configuration):

```csharp
// CoinJar.Core/Services/CoinJarOptions.cs
namespace CoinJar.Services;

// Filled from the "CoinJar" section of appsettings.json.
public class CoinJarOptions
{
    public const string SectionName = "CoinJar";
    public decimal MonthlyBudget { get; set; } = 500m;
    public string[] Categories { get; set; } = [];
}
```

## Step 4: messages

When the list changes, the shell's status bar should say so, without the list knowing the shell exists. That is the job of the messenger from [Messaging Between ViewModels](/courses/wpf/messaging-between-viewmodels):

```csharp
// CoinJar.Core/Messages/ExpenseMessages.cs
using CoinJar.Models;
using CommunityToolkit.Mvvm.Messaging.Messages;

namespace CoinJar.Messages;

// "Something happened" messages: small, immutable records.
public sealed record ExpenseAddedMessage(Expense Expense);
public sealed record ExpenseDeletedMessage(Expense Expense);

// A question with an answer of type decimal.
public sealed class CurrentTotalRequestMessage : RequestMessage<decimal>;
```

## Step 5: the view models

### MainViewModel, the shell

The shell owns the navigation and the status bar. It shows the list on startup and listens for messages:

```csharp
// CoinJar.Core/ViewModels/MainViewModel.cs
using CoinJar.Messages;
using CoinJar.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;

namespace CoinJar.ViewModels;

// The "shell": owns the menu and the status bar, hosts the current screen.
public partial class MainViewModel : ObservableObject
{
    public MainViewModel(INavigationService navigation, IMessenger messenger)
    {
        Navigation = navigation;

        // Show a short note in the status bar whenever the list changes.
        messenger.Register<MainViewModel, ExpenseAddedMessage>(this,
            static (r, m) => r.StatusText = $"Added {m.Expense.Title}");
        messenger.Register<MainViewModel, ExpenseDeletedMessage>(this,
            static (r, m) => r.StatusText = $"Deleted {m.Expense.Title}");

        Navigation.NavigateTo<ExpenseListViewModel>();
    }

    public INavigationService Navigation { get; }

    [ObservableProperty]
    public partial string StatusText { get; set; } = "Ready";

    [RelayCommand]
    private void ShowExpenses() => Navigation.NavigateTo<ExpenseListViewModel>();

    [RelayCommand]
    private void ShowSummary() => Navigation.NavigateTo<SummaryViewModel>();

    [RelayCommand]
    private void GoBack() => Navigation.GoBack();
}
```

The `static` lambdas with the recipient argument `r` avoid capturing `this`, as explained in the messaging lesson.

### ExpenseListViewModel, the main screen

This is the biggest class, and it gathers most of the course. Its full code is in the code panel. Here is what each part does and where it comes from:

- **Constructor injection** of the store, dialogs, messenger, navigation and logger ([Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host)).
- **Two lists**: `_all` holds every expense, `Expenses` is the `ObservableCollection` the screen shows ([Binding to Collections](/courses/wpf/binding-to-collections)). `ApplyFilter` rebuilds the visible one. The idea is the same as the filter in [Sorting, Filtering and Grouping](/courses/wpf/sorting-filtering-and-grouping), done in the view model, because `CollectionView` is a WPF type and the library cannot use it.
- **Partial properties** with `[NotifyCanExecuteChangedFor]`, so the Add button enables itself when the form is valid.
- **`NewAmountText` is a string**, parsed with the user's culture. A half typed "12." stays on screen, and "12,50" works in Germany ([Keyboard Shortcuts and Focus](/courses/wpf/keyboard-shortcuts-and-focus), [Accessibility and Localization](/courses/wpf/accessibility-and-localization)).
- **Commands** from `[RelayCommand]`: `Add`, `Edit`, `Delete`, `ShowDetails`, `Load` and the async `Export` ([Commands and ICommand](/courses/wpf/commands-and-icommand)). `Edit`, `Delete` and `ShowDetails` take the expense as a command parameter and are only enabled when there is one.
- **Dialogs**: `Confirm` before deleting, `EditExpense` for editing, `PickSaveFile` for the export, `ShowMessage` when something fails.
- **Messages**: it sends `ExpenseAddedMessage` and `ExpenseDeletedMessage`, and answers `CurrentTotalRequestMessage`.
- **Error handling**: every call to the store is wrapped, logged and turned into a friendly message ([Error Handling and Logging](/courses/wpf/error-handling-and-logging)).

Here is the add command, as an example of how the pieces meet:

```csharp
[RelayCommand(CanExecute = nameof(CanAdd))]
private void Add()
{
    if (!TryParseAmount(out decimal amount)) return;
    var expense = new Expense
    {
        Title = NewTitle.Trim(),
        Amount = amount,
        Category = NewCategory,
        Date = NewDate
    };
    try
    {
        _store.Add(expense); // the database fills in expense.Id
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Could not add {Title}", expense.Title);
        _dialogs.ShowMessage("CoinJar could not save this expense.", "Saving failed");
        return;
    }
    _all.Insert(0, expense);
    ApplyFilter();
    _messenger.Send(new ExpenseAddedMessage(expense));
    NewTitle = "";
    NewAmountText = "";
}
```

### SummaryViewModel and ExpenseDetailsViewModel

The summary is transient, so it computes fresh numbers on every visit. It now also reads the monthly budget from `appsettings.json` through `IOptions<CoinJarOptions>`:

```csharp
// CoinJar.Core/ViewModels/SummaryViewModel.cs
using CoinJar.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using Microsoft.Extensions.Options;

namespace CoinJar.ViewModels;

public record CategoryTotal(string Category, decimal Amount);

// Registered as transient, so the numbers are fresh on every visit.
public partial class SummaryViewModel : ObservableObject
{
    public SummaryViewModel(IExpenseStore store, IOptions<CoinJarOptions> options)
    {
        var all = store.GetAll();
        Total = all.Sum(e => e.Amount);
        Biggest = all.Count == 0 ? 0m : all.Max(e => e.Amount);
        MonthlyBudget = options.Value.MonthlyBudget;
        ByCategory = all.GroupBy(e => e.Category)
                        .Select(g => new CategoryTotal(g.Key, g.Sum(e => e.Amount)))
                        .OrderByDescending(c => c.Amount)
                        .ToList();
    }

    public decimal Total { get; }
    public decimal Biggest { get; }
    public decimal MonthlyBudget { get; }
    public IReadOnlyList<CategoryTotal> ByCategory { get; }
}
```

`ExpenseDetailsViewModel` (it receives the expense through `INavigationAware`) and `EditExpenseViewModel` (it edits a copy, so Cancel changes nothing) are the versions from [Navigation Between Views](/courses/wpf/navigation-between-views) and [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes). The edit view model gained a `Date` property, so the dialog can change the date too.

## Step 6: data and app services

These live in the WPF project, because they use EF Core or WPF.

- `Data/CoinJarDbContext.cs` and `Data/DesignTimeDbContextFactory.cs` are unchanged from [SQLite with Entity Framework Core](/courses/wpf/sqlite-with-ef-core). The database lives in `%LocalAppData%\CoinJar\coinjar.db`.
- `Services/SqliteExpenseStore.cs` is also from that lesson. It hands out expenses, watches their `PropertyChanged` event and saves a row whenever one changes. That is why the edit dialog needs no "save" call: changing the expense is enough.
- `Services/DialogService.cs` is the `MessageBox` and file dialog implementation from [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes).
- `Services/FileLoggerProvider.cs` is the small file logger from [Error Handling and Logging](/courses/wpf/error-handling-and-logging).

With the context in place, create the first migration. Install the EF Core tool once, then run it in the app folder:

```bash
dotnet tool install --global dotnet-ef
cd CoinJar
dotnet ef migrations add InitialCreate
```

This adds a `Migrations` folder. At startup, `Database.Migrate()` creates the database or upgrades it, so users who install version 2 later keep their data.

## Step 7: application resources and styles

`App.xaml` turns on the Fluent theme that follows Windows light or dark mode ([Light, Dark and Fluent Themes](/courses/wpf/light-dark-and-fluent-themes)), merges the app's styles ([Resources and Resource Dictionaries](/courses/wpf/resources-and-resource-dictionaries)) and has no `StartupUri`, because the host creates the window:

```xml
<!-- CoinJar/App.xaml -->
<Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             ThemeMode="System">
    <!-- No StartupUri: App.OnStartup asks the host for MainWindow -->
    <Application.Resources>
        <ResourceDictionary>
            <ResourceDictionary.MergedDictionaries>
                <ResourceDictionary Source="Styles/AppStyles.xaml" />
            </ResourceDictionary.MergedDictionaries>
            <BooleanToVisibilityConverter x:Key="BoolToVisibility" />
        </ResourceDictionary>
    </Application.Resources>
</Application>
```

The styles are a handful of keyed text styles, so every screen looks the same ([Styles and Setters](/courses/wpf/styles-and-setters)):

```xml
<!-- CoinJar/Styles/AppStyles.xaml -->
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">

    <!-- Big heading at the top of each screen -->
    <Style x:Key="PageTitle" TargetType="TextBlock">
        <Setter Property="FontSize" Value="24" />
        <Setter Property="FontWeight" Value="SemiBold" />
        <Setter Property="Margin" Value="0,0,0,12" />
    </Style>

    <!-- Small grey text under a value -->
    <Style x:Key="HintText" TargetType="TextBlock">
        <Setter Property="Opacity" Value="0.7" />
        <Setter Property="FontSize" Value="12" />
    </Style>

    <!-- Labels above form fields -->
    <Style x:Key="FormLabel" TargetType="Label">
        <Setter Property="Padding" Value="0" />
        <Setter Property="Margin" Value="0,8,0,4" />
    </Style>

</ResourceDictionary>
```

## Step 8: views and controls

### MainWindow

The window is the shell's view. Implicit [data templates](/courses/wpf/data-templates) turn each view model into its view, and the `ContentControl` shows whatever `Navigation.CurrentViewModel` is:

```xml
<!-- CoinJar/MainWindow.xaml -->
<Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="clr-namespace:CoinJar.ViewModels;assembly=CoinJar.Core"
        xmlns:views="clr-namespace:CoinJar.Views"
        Title="CoinJar" Width="960" Height="600" MinWidth="720" MinHeight="440"
        WindowStartupLocation="CenterScreen">
    <Window.Resources>
        <!-- Implicit templates: each view model type gets its view -->
        <DataTemplate DataType="{x:Type vm:ExpenseListViewModel}">
            <views:ExpenseListView />
        </DataTemplate>
        <DataTemplate DataType="{x:Type vm:SummaryViewModel}">
            <views:SummaryView />
        </DataTemplate>
        <DataTemplate DataType="{x:Type vm:ExpenseDetailsViewModel}">
            <views:ExpenseDetailsView />
        </DataTemplate>
    </Window.Resources>

    <!-- Shortcuts that work on every screen -->
    <Window.InputBindings>
        <KeyBinding Gesture="Ctrl+1" Command="{Binding ShowExpensesCommand}" />
        <KeyBinding Gesture="Ctrl+2" Command="{Binding ShowSummaryCommand}" />
        <KeyBinding Gesture="Alt+Left" Command="{Binding GoBackCommand}" />
    </Window.InputBindings>

    <DockPanel>
        <StatusBar DockPanel.Dock="Bottom">
            <StatusBarItem Content="{Binding StatusText}" />
        </StatusBar>

        <StackPanel DockPanel.Dock="Left" Width="170" Margin="12">
            <Button Content="Back" Command="{Binding GoBackCommand}" HorizontalAlignment="Stretch"
                    IsEnabled="{Binding Navigation.CanGoBack}" Margin="0,0,0,16"
                    ToolTip="Back (Alt+Left)" />
            <Button Content="Expenses" Command="{Binding ShowExpensesCommand}"
                    HorizontalAlignment="Stretch" Margin="0,0,0,4" ToolTip="Ctrl+1" />
            <Button Content="Summary" Command="{Binding ShowSummaryCommand}"
                    HorizontalAlignment="Stretch" Margin="0,0,0,4" ToolTip="Ctrl+2" />
        </StackPanel>

        <!-- Shows the current screen, drawn by its DataTemplate -->
        <ContentControl Content="{Binding Navigation.CurrentViewModel}" Margin="4,12,12,12"
                        Focusable="False" />
    </DockPanel>
</Window>
```

The view model types live in another assembly now, so the `vm` namespace includes `;assembly=CoinJar.Core`. The code-behind only receives the view model from the container and sets the `DataContext`.

### ExpenseListView

The main screen: filter and title on top, a list of `ExpenseCard`s, buttons and the total below, and the add form on the right.

```xml
<!-- CoinJar/Views/ExpenseListView.xaml -->
<UserControl x:Class="CoinJar.Views.ExpenseListView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:controls="clr-namespace:CoinJar.Controls">
    <!-- Ctrl+Enter adds, F5 reloads: they work anywhere on this screen -->
    <UserControl.InputBindings>
        <KeyBinding Gesture="Ctrl+Enter" Command="{Binding AddCommand}" />
        <KeyBinding Key="F5" Command="{Binding LoadCommand}" />
    </UserControl.InputBindings>

    <Grid>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*" />
            <ColumnDefinition Width="16" />
            <ColumnDefinition Width="260" />
        </Grid.ColumnDefinitions>

        <!-- Left: header, list, buttons -->
        <DockPanel>
            <Grid DockPanel.Dock="Top">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*" />
                    <ColumnDefinition Width="Auto" />
                </Grid.ColumnDefinitions>
                <TextBlock Text="Expenses" Style="{StaticResource PageTitle}" />
                <StackPanel Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Top">
                    <Label Content="_Show:" Target="{Binding ElementName=FilterBox}" VerticalAlignment="Center" />
                    <ComboBox x:Name="FilterBox" Width="130" ItemsSource="{Binding Filters}"
                              SelectedItem="{Binding SelectedFilter}" />
                </StackPanel>
            </Grid>

            <StackPanel DockPanel.Dock="Bottom" Orientation="Horizontal" Margin="0,8,0,0">
                <Button Content="_Edit..." Command="{Binding EditCommand}"
                        CommandParameter="{Binding SelectedExpense}" MinWidth="80" Margin="0,0,8,0" />
                <Button Content="De_lete" Command="{Binding DeleteCommand}"
                        CommandParameter="{Binding SelectedExpense}" MinWidth="80" Margin="0,0,8,0" />
                <Button Content="Deta_ils" Command="{Binding ShowDetailsCommand}"
                        CommandParameter="{Binding SelectedExpense}" MinWidth="80" Margin="0,0,8,0" />
                <Button Content="Ex_port..." Command="{Binding ExportCommand}" MinWidth="80" />
                <TextBlock Text="{Binding Total, StringFormat=Total: {0:C}}" FontSize="18"
                           FontWeight="Bold" VerticalAlignment="Center" Margin="16,0,0,0" />
            </StackPanel>

            <!-- A ListBox virtualizes its rows, so thousands of expenses stay fast -->
            <ListBox x:Name="ExpenseList" ItemsSource="{Binding Expenses}"
                     SelectedItem="{Binding SelectedExpense}"
                     HorizontalContentAlignment="Stretch"
                     VirtualizingPanel.VirtualizationMode="Recycling"
                     AutomationProperties.Name="Expenses">
                <ListBox.InputBindings>
                    <KeyBinding Key="Delete" Command="{Binding DeleteCommand}"
                                CommandParameter="{Binding SelectedExpense}" />
                    <MouseBinding Gesture="LeftDoubleClick" Command="{Binding ShowDetailsCommand}"
                                  CommandParameter="{Binding SelectedExpense}" />
                </ListBox.InputBindings>
                <ListBox.ItemTemplate>
                    <DataTemplate>
                        <!-- The card inherits one Expense as its DataContext -->
                        <controls:ExpenseCard AutomationProperties.Name="{Binding Title}" />
                    </DataTemplate>
                </ListBox.ItemTemplate>
            </ListBox>
        </DockPanel>

        <!-- Right: the "add" form -->
        <StackPanel Grid.Column="2">
            <TextBlock Text="New expense" FontSize="18" FontWeight="SemiBold" />

            <Label Content="_Title" Target="{Binding ElementName=TitleBox}" Style="{StaticResource FormLabel}" />
            <TextBox x:Name="TitleBox" Text="{Binding NewTitle, UpdateSourceTrigger=PropertyChanged}" />

            <Label Content="_Amount" Target="{Binding ElementName=AmountBox}" Style="{StaticResource FormLabel}" />
            <TextBox x:Name="AmountBox" Text="{Binding NewAmountText, UpdateSourceTrigger=PropertyChanged}"
                     AutomationProperties.HelpText="How much you spent, for example 12.50" />

            <Label Content="_Category" Target="{Binding ElementName=CategoryBox}" Style="{StaticResource FormLabel}" />
            <ComboBox x:Name="CategoryBox" ItemsSource="{Binding Categories}" SelectedItem="{Binding NewCategory}" />

            <Label Content="_Date" Target="{Binding ElementName=DateBox}" Style="{StaticResource FormLabel}" />
            <DatePicker x:Name="DateBox" SelectedDate="{Binding NewDate}" />

            <Button Content="Add e_xpense" Command="{Binding AddCommand}" IsDefault="True"
                    HorizontalAlignment="Left" Margin="0,16,0,0" ToolTip="Add (Enter or Ctrl+Enter)" />
        </StackPanel>
    </Grid>
</UserControl>
```

A few things to notice:

- The list is a `ListBox`, not an `ItemsControl` in a `ScrollViewer` as in [User Controls](/courses/wpf/user-controls). It adds selection and keyboard support, and it virtualizes, so ten thousand expenses still scroll smoothly ([Performance and UI Virtualization](/courses/wpf/performance-and-virtualization)).
- Commands get the selected expense through `CommandParameter`. Delete works from the keyboard, a double click opens the details screen ([Keyboard Shortcuts and Focus](/courses/wpf/keyboard-shortcuts-and-focus)).
- Every input has a `Label` with an access key and a `Target`, and the list and its rows have automation names ([Accessibility and Localization](/courses/wpf/accessibility-and-localization)).
- The layout is a `Grid` with a fixed form column and a star sized list column, so it resizes well ([Building Resizable Layouts](/courses/wpf/building-resizable-layouts)).

Its code-behind has one line of view logic: put the cursor in the Title box when the screen loads.

### SummaryView and the controls

The summary uses two `MoneyTile` controls from [Dependency Properties](/courses/wpf/dependency-properties). The first one turns red when the total goes over the budget from the settings:

```xml
<!-- CoinJar/Views/SummaryView.xaml -->
<UserControl x:Class="CoinJar.Views.SummaryView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:controls="clr-namespace:CoinJar.Controls">
    <StackPanel>
        <TextBlock Text="Summary" Style="{StaticResource PageTitle}" />
        <UniformGrid Columns="2" Margin="0,0,0,16">
            <controls:MoneyTile Label="Spent in total" Amount="{Binding Total}"
                                Limit="{Binding MonthlyBudget}" Margin="0,0,8,0" />
            <controls:MoneyTile Label="Biggest expense" Amount="{Binding Biggest}" />
        </UniformGrid>
        <TextBlock Text="By category" FontSize="18" FontWeight="SemiBold" Margin="0,0,0,8" />
        <ItemsControl ItemsSource="{Binding ByCategory}">
            <ItemsControl.ItemTemplate>
                <DataTemplate>
                    <Grid Margin="0,2">
                        <Grid.ColumnDefinitions>
                            <ColumnDefinition Width="140" />
                            <ColumnDefinition Width="Auto" />
                        </Grid.ColumnDefinitions>
                        <TextBlock Text="{Binding Category}" />
                        <TextBlock Grid.Column="1" Text="{Binding Amount, StringFormat=C}" FontWeight="SemiBold" />
                    </Grid>
                </DataTemplate>
            </ItemsControl.ItemTemplate>
        </ItemsControl>
    </StackPanel>
</UserControl>
```

`Controls/ExpenseCard.xaml` and `Controls/MoneyTile.xaml` are copied from [User Controls](/courses/wpf/user-controls) and [Dependency Properties](/courses/wpf/dependency-properties). One change in `ExpenseCard`: its `models` namespace also needs `;assembly=CoinJar.Core` for the design time data.

`ExpenseDetailsView` is a small read only page, and `EditExpenseWindow` is the dialog from [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes), with a `DatePicker` added ([ComboBox, ListBox, Slider and DatePicker](/courses/wpf/selection-controls)):

```xml
<!-- CoinJar/Views/ExpenseDetailsView.xaml -->
<UserControl x:Class="CoinJar.Views.ExpenseDetailsView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <!-- DataContext is ExpenseDetailsViewModel; Expense is the one we navigated with -->
    <StackPanel DataContext="{Binding Expense}">
        <TextBlock Text="{Binding Title}" Style="{StaticResource PageTitle}" />
        <TextBlock Text="{Binding Amount, StringFormat=C}" FontSize="32" FontWeight="Bold" />
        <TextBlock Text="{Binding Category}" Style="{StaticResource HintText}" Margin="0,8,0,0" />
        <TextBlock Text="{Binding Date, StringFormat=D}" Style="{StaticResource HintText}" />
        <TextBlock Text="{Binding Id, StringFormat=Expense #{0}}" Style="{StaticResource HintText}" />
    </StackPanel>
</UserControl>
```

## Step 9: the host in App.xaml.cs

Everything comes together in `App.xaml.cs`, the composition root of the app. It is the code panel's first file. In order, it:

1. Sets the `Language` of all elements to the user's culture, so `StringFormat=C` shows their currency ([Accessibility and Localization](/courses/wpf/accessibility-and-localization)).
2. Creates the host with `ContentRootPath = AppContext.BaseDirectory`, so `appsettings.json` is found next to the exe ([App Settings and Configuration](/courses/wpf/app-settings-and-configuration)).
3. Adds the file logger next to the default logging providers.
4. Binds the `CoinJar` settings section to `CoinJarOptions`.
5. Registers the DbContext factory, the services, the view models (the list as a singleton, the summary and details as transient) and the window.
6. Hooks up the three global exception handlers ([Error Handling and Logging](/courses/wpf/error-handling-and-logging)).
7. In `OnStartup`: starts the host, migrates the database, resolves `MainWindow` and shows it.
8. In `OnExit`: stops and disposes the host, which also closes the log file.

The settings file it reads:

```json
{
  "CoinJar": {
    "MonthlyBudget": 500
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning"
    }
  }
}
```

## Step 10: run it

```bash
dotnet run --project CoinJar
```

Try the whole app: add a few expenses, filter by category, edit one, delete one and answer No, open the summary, go back with Alt+Left, export to CSV. Close and start it again: the expenses are still there.

Then look behind the scenes:

- The database: `%LocalAppData%\CoinJar\coinjar.db`.
- The log: `%LocalAppData%\CoinJar\logs\coinjar.log`, with lines like "Loaded 4 expenses".
- In Visual Studio, the same log lines appear in the Output window.

## Step 11: run the tests

The test project from [Unit Testing ViewModels](/courses/wpf/unit-testing-viewmodels) checks the list view model with fakes: loading, adding, input validation, delete with Yes and No, editing with OK and Cancel, filtering, navigation, export, messages and a broken store.

```bash
dotnet test
```

```text
Passed!  - Failed:     0, Passed:    17, Skipped:     0, Total:    17
```

Run them after every change you make from here on. They take less than a second.

## Step 12: publish

Add the publish profile from [Publishing and Packaging WPF Apps](/courses/wpf/publishing-and-packaging-wpf-apps) as `CoinJar/Properties/PublishProfiles/win-x64.pubxml` and run:

```bash
dotnet publish CoinJar -p:PublishProfile=win-x64
```

You get one self-contained `CoinJar.exe` and its `appsettings.json` in `bin\publish\win-x64`. Copy both to any Windows 10 or 11 PC and it runs, no .NET install needed.

## Where to go from here

CoinJar is complete, but there is plenty of room to grow. Each idea below uses a lesson you have already done:

- **Import by drag and drop**: let users drop the exported CSV back onto the window ([Drag and Drop](/courses/wpf/drag-and-drop)).
- **Currencies**: convert amounts with live exchange rates ([Calling Web APIs with HttpClient](/courses/wpf/calling-web-apis-with-httpclient)).
- **User settings**: remember the chosen theme and filter between runs ([App Settings and Configuration](/courses/wpf/app-settings-and-configuration)).
- **Validation**: show errors next to the fields instead of only disabling Add ([Input Validation](/courses/wpf/input-validation)).
- **A spreadsheet view**: a `DataGrid` with sorting and grouping by month ([The DataGrid Control](/courses/wpf/the-datagrid-control)).
- **Animations**: fade new cards in and flash the total when it changes ([Animations and Storyboards](/courses/wpf/animations-and-storyboards)).
- **Translations**: move the remaining text to `Strings.resx` and add a second language ([Accessibility and Localization](/courses/wpf/accessibility-and-localization)).
- **An async store**: if you move the data to a server, make the store methods async and await them ([Async, Await and a Responsive UI](/courses/wpf/async-await-and-a-responsive-ui)).

## Common mistakes when assembling the app

- **A view model in the WPF project.** It compiles, but the tests cannot reach it. Keep view models in `CoinJar.Core`.
- **Forgetting `;assembly=CoinJar.Core`** in a XAML namespace. The XAML compiler then reports that the type does not exist.
- **Leaving `StartupUri` in App.xaml.** WPF then tries to create `MainWindow` itself, without the view model its constructor needs, and the app fails to start.
- **Creating view models with `new` in a view.** They then miss their services. Let the container create view models, and let the navigation service and data templates connect them to views.
- **No migration.** `Database.Migrate()` with no migrations creates an empty database without the `Expenses` table. Run `dotnet ef migrations add InitialCreate` first.
- **appsettings.json not copied.** Set it to copy to the output folder, or the budget is always the default.

## Quick recap

- CoinJar is three projects: a WPF app, a `net10.0` core library and an xUnit test project.
- Models, messages, service interfaces and view models live in the core library and are fully testable.
- The WPF project holds the views, controls, styles, SQLite store, dialog service and logging.
- `App.xaml.cs` is the composition root: it builds the host, registers everything, installs the error handlers, migrates the database and shows the window.
- The shell view model navigates between screens, data templates pick the views, and messages keep the screens in sync.
- Tests run with `dotnet test`, and `dotnet publish` with a profile produces a single exe.
- Congratulations: you have built a complete, modern WPF application.

<code id="code-content" class="language-csharp">
// CoinJar/App.xaml.cs
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Markup;
using System.Windows.Threading;
using CoinJar.Data;
using CoinJar.Services;
using CoinJar.ViewModels;
using CommunityToolkit.Mvvm.Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
namespace CoinJar;
public partial class App : Application
{
    private readonly IHost _host;
    private readonly ILogger&lt;App&gt; _logger;
    public App()
    {
        // Bindings such as StringFormat=C should use the user's culture, not en-US.
        FrameworkElement.LanguageProperty.OverrideMetadata(
            typeof(FrameworkElement),
            new FrameworkPropertyMetadata(XmlLanguage.GetLanguage(CultureInfo.CurrentCulture.IetfLanguageTag)));
        // ContentRootPath: find appsettings.json next to the exe, whatever the working folder is.
        HostApplicationBuilder builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            ContentRootPath = AppContext.BaseDirectory
        });
        // Logging: the default providers (Debug, Console, ...) plus a log file.
        string logFile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CoinJar", "logs", "coinjar.log");
        builder.Logging.AddProvider(new FileLoggerProvider(logFile));
        // Settings: the "CoinJar" section of appsettings.json becomes IOptions&lt;CoinJarOptions&gt;.
        builder.Services.Configure&lt;CoinJarOptions&gt;(
            builder.Configuration.GetSection(CoinJarOptions.SectionName));
        // Data: a DbContext factory, so every operation gets a short lived context.
        builder.Services.AddDbContextFactory&lt;CoinJarDbContext&gt;(options =&gt;
            options.UseSqlite($"Data Source={CoinJarDbContext.DefaultDatabasePath}"));
        // Services
        builder.Services.AddSingleton&lt;IExpenseStore, SqliteExpenseStore&gt;();
        builder.Services.AddSingleton&lt;IDialogService, DialogService&gt;();
        builder.Services.AddSingleton&lt;INavigationService, NavigationService&gt;();
        builder.Services.AddSingleton&lt;IMessenger&gt;(WeakReferenceMessenger.Default);
        // View models: the list keeps its state, the others are fresh on every visit
        builder.Services.AddSingleton&lt;MainViewModel&gt;();
        builder.Services.AddSingleton&lt;ExpenseListViewModel&gt;();
        builder.Services.AddTransient&lt;SummaryViewModel&gt;();
        builder.Services.AddTransient&lt;ExpenseDetailsViewModel&gt;();
        // The window (views are created by DataTemplates, so they are not registered)
        builder.Services.AddSingleton&lt;MainWindow&gt;();
        _host = builder.Build();
        _logger = _host.Services.GetRequiredService&lt;ILogger&lt;App&gt;&gt;();
        // Safety nets for exceptions that nobody caught
        DispatcherUnhandledException += OnDispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += OnDomainUnhandledException;
        TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;
    }
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        _host.Start();
        // Create the database, or upgrade it to the latest migration.
        var factory = _host.Services.GetRequiredService&lt;IDbContextFactory&lt;CoinJarDbContext&gt;&gt;();
        using (CoinJarDbContext db = factory.CreateDbContext())
        {
            db.Database.Migrate();
        }
        MainWindow = _host.Services.GetRequiredService&lt;MainWindow&gt;();
        MainWindow.Show();
        _logger.LogInformation("CoinJar {Version} started", typeof(App).Assembly.GetName().Version);
    }
    protected override void OnExit(ExitEventArgs e)
    {
        _logger.LogInformation("CoinJar closing with exit code {Code}", e.ApplicationExitCode);
        // Wait here: an async void OnExit could be cut off when the process ends.
        _host.StopAsync(TimeSpan.FromSeconds(5)).GetAwaiter().GetResult();
        _host.Dispose(); // also closes the log file
        base.OnExit(e);
    }
    // UI thread: log it, tell the user, keep running.
    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        _logger.LogError(e.Exception, "Unhandled exception on the UI thread");
        MessageBox.Show("Something went wrong. The details were saved to the log file.",
            "CoinJar", MessageBoxButton.OK, MessageBoxImage.Error);
        e.Handled = true;
    }
    // Any other thread: the process is going down, so log what we can.
    private void OnDomainUnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        _logger.LogCritical(e.ExceptionObject as Exception, "Fatal unhandled exception");
    }
    // A failed Task that nobody awaited.
    private void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        _logger.LogError(e.Exception, "Unobserved task exception");
        e.SetObserved();
    }
}
// CoinJar.Core/ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using System.Globalization;
using CoinJar.Messages;
using CoinJar.Models;
using CoinJar.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
using Microsoft.Extensions.Logging;
namespace CoinJar.ViewModels;
// The main screen: the list, the category filter, the total and the "add" form.
public partial class ExpenseListViewModel : ObservableObject
{
    public const string AllCategories = "All";
    private readonly IExpenseStore _store;
    private readonly IDialogService _dialogs;
    private readonly IMessenger _messenger;
    private readonly INavigationService _navigation;
    private readonly ILogger&lt;ExpenseListViewModel&gt; _logger;
    // Every expense. Expenses (below) only holds the ones the filter lets through.
    private readonly List&lt;Expense&gt; _all = [];
    public ExpenseListViewModel(IExpenseStore store, IDialogService dialogs, IMessenger messenger,
        INavigationService navigation, ILogger&lt;ExpenseListViewModel&gt; logger)
    {
        _store = store;
        _dialogs = dialogs;
        _messenger = messenger;
        _navigation = navigation;
        _logger = logger;
        // Answer "what is the total?" for anyone who asks.
        messenger.Register&lt;ExpenseListViewModel, CurrentTotalRequestMessage&gt;(this,
            static (r, m) =&gt; m.Reply(r.Total));
        Load();
    }
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = [];
    public string[] Categories =&gt; Expense.Categories;
    public IReadOnlyList&lt;string&gt; Filters { get; } = [AllCategories, .. Expense.Categories];
    // The sum of the visible expenses.
    public decimal Total =&gt; Expenses.Sum(e =&gt; e.Amount);
    [ObservableProperty]
    public partial string SelectedFilter { get; set; } = AllCategories;
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(EditCommand), nameof(DeleteCommand), nameof(ShowDetailsCommand))]
    public partial Expense? SelectedExpense { get; set; }
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(AddCommand))]
    public partial string NewTitle { get; set; } = "";
    // Text, not decimal, so half typed input such as "12." is fine. Parsed in Add.
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(AddCommand))]
    public partial string NewAmountText { get; set; } = "";
    [ObservableProperty]
    public partial string NewCategory { get; set; } = "Food";
    [ObservableProperty]
    public partial DateTime NewDate { get; set; } = DateTime.Today;
    partial void OnSelectedFilterChanged(string value) =&gt; ApplyFilter();
    [RelayCommand]
    private void Load()
    {
        try
        {
            _all.Clear();
            _all.AddRange(_store.GetAll().OrderByDescending(e =&gt; e.Date));
            ApplyFilter();
            _logger.LogInformation("Loaded {Count} expenses", _all.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not load expenses");
            _dialogs.ShowMessage("CoinJar could not read your expenses.", "Loading failed");
        }
    }
    private bool CanAdd() =&gt; !string.IsNullOrWhiteSpace(NewTitle) &amp;&amp; TryParseAmount(out _);
    private bool TryParseAmount(out decimal amount) =&gt;
        decimal.TryParse(NewAmountText, NumberStyles.Number, CultureInfo.CurrentCulture, out amount)
        &amp;&amp; amount &gt; 0;
    [RelayCommand(CanExecute = nameof(CanAdd))]
    private void Add()
    {
        if (!TryParseAmount(out decimal amount)) return;
        var expense = new Expense
        {
            Title = NewTitle.Trim(),
            Amount = amount,
            Category = NewCategory,
            Date = NewDate
        };
        try
        {
            _store.Add(expense); // the database fills in expense.Id
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not add {Title}", expense.Title);
            _dialogs.ShowMessage("CoinJar could not save this expense.", "Saving failed");
            return;
        }
        _all.Insert(0, expense);
        ApplyFilter();
        _messenger.Send(new ExpenseAddedMessage(expense));
        NewTitle = "";
        NewAmountText = "";
    }
    private static bool HasExpense(Expense? expense) =&gt; expense is not null;
    [RelayCommand(CanExecute = nameof(HasExpense))]
    private void Edit(Expense? expense)
    {
        if (expense is null) return;
        try
        {
            // OK copies the changes into the expense; the store saves them as they happen.
            if (!_dialogs.EditExpense(expense)) return; // Cancel: nothing changed
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not save changes to expense {Id}", expense.Id);
            _dialogs.ShowMessage("CoinJar could not save your changes.", "Saving failed");
        }
        ApplyFilter();
    }
    [RelayCommand(CanExecute = nameof(HasExpense))]
    private void Delete(Expense? expense)
    {
        if (expense is null) return;
        if (!_dialogs.Confirm($"Delete '{expense.Title}'?", "Delete expense")) return;
        try
        {
            _store.Remove(expense);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not delete expense {Id}", expense.Id);
            _dialogs.ShowMessage("CoinJar could not delete this expense.", "Delete failed");
            return;
        }
        _all.Remove(expense);
        ApplyFilter();
        _messenger.Send(new ExpenseDeletedMessage(expense));
    }
    [RelayCommand(CanExecute = nameof(HasExpense))]
    private void ShowDetails(Expense? expense) =&gt;
        _navigation.NavigateTo&lt;ExpenseDetailsViewModel&gt;(expense);
    [RelayCommand]
    private async Task ExportAsync()
    {
        string? path = _dialogs.PickSaveFile("coinjar-export.csv", "CSV files (*.csv)|*.csv");
        if (path is null) return; // the user cancelled
        var lines = Expenses.Select(e =&gt;
            $"{e.Date:yyyy-MM-dd},{e.Category},{e.Amount.ToString(CultureInfo.InvariantCulture)},\"{e.Title.Replace("\"", "\"\"")}\"");
        try
        {
            await File.WriteAllLinesAsync(path, ["Date,Category,Amount,Title", .. lines]);
            _dialogs.ShowMessage($"Exported {Expenses.Count} expenses.");
        }
        catch (IOException ex)
        {
            _logger.LogWarning(ex, "Export to {Path} failed", path);
            _dialogs.ShowMessage("The file could not be written. Is it open in another program?", "Export failed");
        }
    }
    // Rebuilds the visible list from _all and refreshes the total.
    private void ApplyFilter()
    {
        Expenses.Clear();
        foreach (Expense e in _all)
        {
            if (SelectedFilter == AllCategories || e.Category == SelectedFilter)
                Expenses.Add(e);
        }
        OnPropertyChanged(nameof(Total));
    }
}
</code></pre>

