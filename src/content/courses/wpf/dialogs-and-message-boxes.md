---
publishDate: 2026-10-25T20:41
title: 'Dialogs and Message Boxes'
slug: dialogs-and-message-boxes
metadescription: 'Show message boxes, file pickers, the .NET 8 folder picker and your own dialog windows from MVVM code, using an IDialogService so view models never touch the UI.'
updateDate: 2026-10-25T20:41
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'mvvm', 'dialogs', 'messagebox']
course: wpf
---

## Dialogs and MVVM

A **dialog** is a small window that asks the user something and waits for an answer: "Delete this expense?", "Where should I save the file?", "Edit these details". While a **modal** dialog is open, the user cannot use the window behind it.

WPF makes dialogs easy. MVVM makes them a little tricky, because the code that decides **when** to ask lives in a view model, and the view model is not supposed to know about windows (see [Introduction to MVVM](/courses/wpf/introduction-to-mvvm)). The answer is a **dialog service**: an [interface](/courses/c-sharp/interfaces) the view model calls, with a class behind it that does the real UI work.

This lesson first shows each kind of dialog on its own, then wraps them all in an `IDialogService`.

## MessageBox

`MessageBox.Show` (in `System.Windows`) shows the classic Windows message box. It returns a `MessageBoxResult` telling you which button was clicked.

```csharp
MessageBoxResult result = MessageBox.Show(
    "Delete 'Coffee'? This cannot be undone.",   // text
    "Delete expense",                           // window title
    MessageBoxButton.YesNo,                     // which buttons
    MessageBoxImage.Warning);                   // which icon

if (result == MessageBoxResult.Yes)
{
    // delete it
}
```

The options you will use most:

| Enum | Values |
| --- | --- |
| `MessageBoxButton` | `OK`, `OKCancel`, `YesNo`, `YesNoCancel` |
| `MessageBoxImage` | `None`, `Information`, `Question`, `Warning`, `Error` |
| `MessageBoxResult` | `None`, `OK`, `Cancel`, `Yes`, `No` |

There is also an overload that takes an **owner** window as the first argument. The owner keeps the box on top of the right window and centred over it:

```csharp
MessageBox.Show(Application.Current.MainWindow, "Saved!", "CoinJar");
```

## File pickers: OpenFileDialog and SaveFileDialog

The standard Windows "Open" and "Save As" dialogs live in the `Microsoft.Win32` namespace. Be careful: there are also Windows Forms versions with the same names in `System.Windows.Forms`. For WPF use `Microsoft.Win32`.

```csharp
using Microsoft.Win32;

var dialog = new OpenFileDialog
{
    Title = "Import expenses",
    Filter = "CSV files (*.csv)|*.csv|All files (*.*)|*.*",
    InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments)
};

if (dialog.ShowDialog() == true)
{
    string path = dialog.FileName;
    // read the file
}
```

`ShowDialog()` returns a `bool?`: `true` when the user picked a file, `false` when they cancelled. That is why the check is `== true` rather than just `if (dialog.ShowDialog())`.

The **filter** is a list of pairs separated by `|`: the text the user sees, then the pattern. `"CSV files (*.csv)|*.csv"` is one pair. Use `;` for several patterns in one pair, like `"Images|*.png;*.jpg"`.

Set `Multiselect = true` to let the user pick several files, then read `dialog.FileNames` (an array).

`SaveFileDialog` works the same way:

```csharp
var dialog = new SaveFileDialog
{
    Title = "Export expenses",
    FileName = "coinjar-export.csv",   // suggested name
    DefaultExt = ".csv",
    Filter = "CSV files (*.csv)|*.csv"
};

if (dialog.ShowDialog() == true)
{
    File.WriteAllText(dialog.FileName, "Title,Amount\n");
}
```

`SaveFileDialog` asks "Do you want to replace it?" by itself when the file already exists, so you do not need to check. Writing files is covered in the C# lesson on [file handling](/courses/c-sharp/file-handling).

## Picking a folder: OpenFolderDialog

For years WPF had no folder picker, and apps borrowed one from Windows Forms. Since **.NET 8**, `Microsoft.Win32.OpenFolderDialog` is built in:

```csharp
var dialog = new OpenFolderDialog
{
    Title = "Choose a backup folder"
};

if (dialog.ShowDialog() == true)
{
    string folder = dialog.FolderName;
}
```

Like the file dialogs, it also has `InitialDirectory`, `Multiselect` and `FolderNames`.

## Your own dialog window

For anything richer than yes or no, make a normal `Window` and show it with `ShowDialog()` instead of `Show()`. A few window properties make it feel like a proper dialog:

```xml
<Window x:Class="CoinJar.Views.EditExpenseWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Edit expense"
        SizeToContent="WidthAndHeight"
        ResizeMode="NoResize"
        ShowInTaskbar="False"
        WindowStartupLocation="CenterOwner">
    <StackPanel Margin="16" Width="280">
        <TextBox Text="{Binding Title, UpdateSourceTrigger=PropertyChanged}" />
        <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
            <Button Content="OK" IsDefault="True" Click="Ok_Click" />
            <Button Content="Cancel" IsCancel="True" />
        </StackPanel>
    </StackPanel>
</Window>
```

- `SizeToContent` makes the window exactly as big as its content.
- `WindowStartupLocation="CenterOwner"` centres it over its owner.
- `IsDefault="True"` means Enter clicks OK. `IsCancel="True"` means Esc clicks Cancel, and it closes the dialog for you.

Closing with a result is the one place where a line of code-behind is the simplest choice. Setting `DialogResult` closes the window and becomes the return value of `ShowDialog()`:

```csharp
private void Ok_Click(object sender, RoutedEventArgs e)
{
    DialogResult = true;
}
```

This is pure view logic (closing a window), so it is fine in code-behind.

## The IDialogService

Now hide all of that behind one interface. View models only ever see this:

```csharp
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

Every method returns plain C# values: `bool`, `string?`. Nothing about `MessageBoxResult` or windows leaks out. A `null` path means "the user cancelled".

The real implementation lives with the views, because it is allowed to touch WPF:

```csharp
public class DialogService : IDialogService
{
    private static Window? Owner => Application.Current.MainWindow;

    public bool Confirm(string message, string title = "Please confirm")
    {
        return MessageBox.Show(Owner!, message, title,
            MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes;
    }

    public string? PickFolder()
    {
        var dialog = new OpenFolderDialog { Title = "Choose a folder" };
        return dialog.ShowDialog(Owner!) == true ? dialog.FolderName : null;
    }

    // ... the other methods follow the same pattern (see the code panel)
}
```

Register it once with the host from [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host):

```csharp
builder.Services.AddSingleton<IDialogService, DialogService>();
```

## Using it from the view model

The view model asks for `IDialogService` in its constructor and uses it inside commands:

```csharp
[RelayCommand]
private void Delete(Expense? expense)
{
    if (expense is null) return;
    if (!_dialogs.Confirm($"Delete '{expense.Title}'?", "Delete expense")) return;

    _store.Remove(expense);
    Expenses.Remove(expense);
}

[RelayCommand]
private async Task ExportAsync()
{
    string? path = _dialogs.PickSaveFile("coinjar-export.csv", "CSV files (*.csv)|*.csv");
    if (path is null) return; // cancelled

    var lines = Expenses.Select(e => $"{e.Date:yyyy-MM-dd},{e.Category},{e.Amount.ToString(CultureInfo.InvariantCulture)}");
    await File.WriteAllLinesAsync(path, ["Date,Category,Amount", .. lines]);
    _dialogs.ShowMessage($"Exported {Expenses.Count} expenses.");
}
```

`CultureInfo.InvariantCulture` writes `3.50` with a dot whatever the user's language, which keeps the file readable by other programs. The `..` inside the brackets is a spread in a collection expression: it adds every item of `lines` after the header.

## Custom dialogs through the service

For the edit dialog, the service creates the window, gives it a small view model, and copies the values back only if the user clicked OK:

```csharp
public bool EditExpense(Expense expense)
{
    var vm = new EditExpenseViewModel(expense);
    var window = new EditExpenseWindow { DataContext = vm, Owner = Owner };

    if (window.ShowDialog() != true) return false; // cancelled: nothing changes

    vm.ApplyTo(expense);
    return true;
}
```

Editing a **copy** of the values is important. If the dialog bound straight to the real `Expense`, every key press would change the list behind it, and Cancel could not undo it.

## Testing becomes easy

Because the view model only knows the interface, a test can pass in a fake that answers instantly with no window at all:

```csharp
public class FakeDialogService : IDialogService
{
    public bool ConfirmAnswer { get; set; } = true;
    public List<string> Messages { get; } = [];

    public void ShowMessage(string message, string title = "CoinJar") => Messages.Add(message);
    public bool Confirm(string message, string title = "Please confirm") => ConfirmAnswer;
    public string? PickSaveFile(string suggestedName, string filter) => null;
    public string? PickOpenFile(string filter) => null;
    public string? PickFolder() => null;
    public bool EditExpense(Expense expense) => false;
}
```

Set `ConfirmAnswer = false` and check that `DeleteCommand` did **not** remove the item. You will write tests like this in [Unit Testing ViewModels](/courses/wpf/unit-testing-viewmodels).

## Common mistakes

- **Calling `MessageBox.Show` in a view model.** It works, but your tests will pop up real windows and hang. Go through `IDialogService`.
- **Using the Windows Forms dialogs.** If you see `System.Windows.Forms` in a `using`, switch to `Microsoft.Win32`.
- **Checking `ShowDialog()` as a bool.** It returns `bool?`. Compare with `== true`.
- **Forgetting the owner.** Without an owner, a dialog can open behind the main window or on another screen, and the app looks frozen.
- **Calling `Show()` instead of `ShowDialog()`.** `Show()` returns at once and never gives you a result. Setting `DialogResult` on a window opened with `Show()` throws an exception.
- **Binding a dialog to the live object.** Edit a copy and apply it on OK, so Cancel really cancels.

## Quick recap

- `MessageBox.Show` asks simple questions and returns a `MessageBoxResult`.
- `OpenFileDialog` and `SaveFileDialog` from `Microsoft.Win32` pick files. `OpenFolderDialog` (new in .NET 8) picks folders. All return `bool?` from `ShowDialog()`.
- Custom dialogs are windows shown with `ShowDialog()`. Use `IsDefault`, `IsCancel`, `DialogResult` and an owner.
- An `IDialogService` keeps all of this out of view models, which only see `bool` and `string?` results.
- A fake dialog service makes view models easy to test.

<code id="code-content" class="language-csharp">
// Services/IDialogService.cs
using CoinJar.Models;
namespace CoinJar.Services;
// View models only see this interface: plain bools and strings
public interface IDialogService
{
    void ShowMessage(string message, string title = "CoinJar");
    bool Confirm(string message, string title = "Please confirm");
    string? PickSaveFile(string suggestedName, string filter);
    string? PickOpenFile(string filter);
    string? PickFolder();
    bool EditExpense(Expense expense);
}
// Services/DialogService.cs
using System.Windows;
using CoinJar.Models;
using CoinJar.ViewModels;
using CoinJar.Views;
using Microsoft.Win32;
namespace CoinJar.Services;
// The real implementation; the only class here that touches dialogs
public class DialogService : IDialogService
{
    private static Window? Owner =&gt; Application.Current.MainWindow;
    public void ShowMessage(string message, string title = "CoinJar")
        =&gt; MessageBox.Show(Owner!, message, title, MessageBoxButton.OK, MessageBoxImage.Information);
    public bool Confirm(string message, string title = "Please confirm")
        =&gt; MessageBox.Show(Owner!, message, title, MessageBoxButton.YesNo, MessageBoxImage.Question)
           == MessageBoxResult.Yes;
    public string? PickSaveFile(string suggestedName, string filter)
    {
        var dialog = new SaveFileDialog { FileName = suggestedName, Filter = filter };
        return dialog.ShowDialog(Owner!) == true ? dialog.FileName : null;
    }
    public string? PickOpenFile(string filter)
    {
        var dialog = new OpenFileDialog { Filter = filter };
        return dialog.ShowDialog(Owner!) == true ? dialog.FileName : null;
    }
    public string? PickFolder()
    {
        // Built into WPF since .NET 8
        var dialog = new OpenFolderDialog { Title = "Choose a folder" };
        return dialog.ShowDialog(Owner!) == true ? dialog.FolderName : null;
    }
    public bool EditExpense(Expense expense)
    {
        var vm = new EditExpenseViewModel(expense);   // works on a copy
        var window = new EditExpenseWindow { DataContext = vm, Owner = Owner };
        if (window.ShowDialog() != true) return false; // Cancel: nothing changes
        vm.ApplyTo(expense);
        return true;
    }
}
// ViewModels/EditExpenseViewModel.cs
using CoinJar.Models;
using CommunityToolkit.Mvvm.ComponentModel;
namespace CoinJar.ViewModels;
public partial class EditExpenseViewModel : ObservableObject
{
    public EditExpenseViewModel(Expense source)
    {
        Title = source.Title;
        Amount = source.Amount;
        Category = source.Category;
    }
    public string[] Categories { get; } = ["Food", "Transport", "Bills", "Fun", "Other"];
    [ObservableProperty]
    public partial string Title { get; set; }
    [ObservableProperty]
    public partial decimal Amount { get; set; }
    [ObservableProperty]
    public partial string Category { get; set; }
    // Copy the edited values back, only after OK
    public void ApplyTo(Expense target)
    {
        target.Title = Title;
        target.Amount = Amount;
        target.Category = Category;
    }
}
&lt;!-- Views/EditExpenseWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.Views.EditExpenseWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Edit expense"
        SizeToContent="WidthAndHeight"
        ResizeMode="NoResize"
        ShowInTaskbar="False"
        WindowStartupLocation="CenterOwner"&gt;
    &lt;StackPanel Margin="16" Width="280"&gt;
        &lt;TextBlock Text="Title" /&gt;
        &lt;TextBox Text="{Binding Title, UpdateSourceTrigger=PropertyChanged}" Margin="0,2,0,8" /&gt;
        &lt;TextBlock Text="Amount" /&gt;
        &lt;TextBox Text="{Binding Amount}" Margin="0,2,0,8" /&gt;
        &lt;TextBlock Text="Category" /&gt;
        &lt;ComboBox ItemsSource="{Binding Categories}" SelectedItem="{Binding Category}" Margin="0,2,0,16" /&gt;
        &lt;StackPanel Orientation="Horizontal" HorizontalAlignment="Right"&gt;
            &lt;!-- Enter = OK, Esc = Cancel --&gt;
            &lt;Button Content="OK" IsDefault="True" Click="Ok_Click" Width="80" Margin="0,0,8,0" /&gt;
            &lt;Button Content="Cancel" IsCancel="True" Width="80" /&gt;
        &lt;/StackPanel&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// Views/EditExpenseWindow.xaml.cs
using System.Windows;
namespace CoinJar.Views;
public partial class EditExpenseWindow : Window
{
    public EditExpenseWindow()
    {
        InitializeComponent();
    }
    // Closing a window is view work, so code-behind is fine
    private void Ok_Click(object sender, RoutedEventArgs e) =&gt; DialogResult = true;
}
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using System.Globalization;
using System.IO;
using CoinJar.Models;
using CoinJar.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
namespace CoinJar.ViewModels;
public partial class ExpenseListViewModel : ObservableObject
{
    private readonly IExpenseStore _store;
    private readonly IDialogService _dialogs;
    public ExpenseListViewModel(IExpenseStore store, IDialogService dialogs)
    {
        _store = store;
        _dialogs = dialogs;
        foreach (var expense in store.GetAll()) Expenses.Add(expense);
    }
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = [];
    [ObservableProperty]
    public partial string BackupFolder { get; set; } = "";
    [RelayCommand]
    private void Delete(Expense? expense)
    {
        if (expense is null) return;
        if (!_dialogs.Confirm($"Delete '{expense.Title}'?", "Delete expense")) return;
        _store.Remove(expense);
        Expenses.Remove(expense);
    }
    [RelayCommand]
    private void Edit(Expense? expense)
    {
        if (expense is not null) _dialogs.EditExpense(expense);
    }
    [RelayCommand]
    private async Task ExportAsync()
    {
        string? path = _dialogs.PickSaveFile("coinjar-export.csv", "CSV files (*.csv)|*.csv");
        if (path is null) return; // the user cancelled
        var lines = Expenses.Select(e =&gt;
            $"{e.Date:yyyy-MM-dd},{e.Category},{e.Amount.ToString(CultureInfo.InvariantCulture)}");
        await File.WriteAllLinesAsync(path, ["Date,Category,Amount", .. lines]);
        _dialogs.ShowMessage($"Exported {Expenses.Count} expenses.");
    }
    [RelayCommand]
    private void ChooseBackupFolder()
    {
        BackupFolder = _dialogs.PickFolder() ?? BackupFolder;
    }
}
</code></pre>
