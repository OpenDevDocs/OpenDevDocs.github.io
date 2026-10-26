---
publishDate: 2026-10-25T20:48
title: 'Async, Await and a Responsive UI'
slug: async-await-and-a-responsive-ui
metadescription: 'Keep a WPF window responsive with async and await, async relay commands, Task.Run for heavy work, progress reporting and cancellation, and avoid the classic .Result deadlock.'
updateDate: 2026-10-25T20:48
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'async', 'mvvm', 'performance']
course: wpf
---

## Why windows freeze

Every WPF app has one special thread called the **UI thread**. It is the only thread that draws the window, reacts to clicks and key presses, and runs your event handlers and commands.

Picture a café with exactly one waiter. The waiter takes orders, brings food and answers questions. If a customer asks the waiter to go and bake a cake, every other table waits until the cake is done. Nobody gets served. That is what happens when you do slow work on the UI thread:

```csharp
private void OnLoadClick(object sender, RoutedEventArgs e)
{
    Thread.Sleep(3000);   // pretend this is a slow file or network call
    StatusText.Text = "Loaded";
}
```

For three seconds the window cannot repaint, buttons do not respond, and after a while Windows adds "(Not Responding)" to the title bar. Users think the app has crashed.

Slow work comes in two kinds:

- **Waiting work** (I/O): reading files, calling a web API, querying a database. The computer is mostly waiting for something else.
- **Busy work** (CPU): sorting a huge list, building a report, resizing images. The processor is actually working hard.

Both block the waiter if you do them on the UI thread. C# gives you [async and await](/courses/c-sharp/async-and-await) to fix that. This lesson shows how to use them well in WPF.

## The first fix: an async event handler

Most slow APIs have an async version that returns a `Task`. When you `await` it, the UI thread is free to do other things while the work is waiting. When the work finishes, your method carries on from where it stopped.

```csharp
private async void OnLoadClick(object sender, RoutedEventArgs e)
{
    StatusText.Text = "Loading...";

    string json = await File.ReadAllTextAsync("expenses.json");

    StatusText.Text = $"Loaded {json.Length} characters";
}
```

Two things to notice:

1. The handler is `async void`. Normally you should never write `async void`, because nobody can await it or catch its exceptions. **Event handlers are the one exception**, because their signature must return `void`.
2. After the `await`, you set `StatusText.Text` again without any special code. WPF remembers which thread started the method and **comes back to the UI thread** after the await. So code after `await` in a handler or a view model can touch the UI and bound properties safely.

## Async commands with CommunityToolkit.Mvvm

In CoinJar the work happens in view models, not in click handlers. Let's add a new feature that is slow by nature: importing expenses from the user's bank. A service, `IBankImportService`, downloads the transactions. It takes a few seconds, like any network call.

The toolkit from [MVVM with CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm) handles async methods for you. Mark an `async Task` method with `[RelayCommand]`:

```csharp
public partial class ImportViewModel : ObservableObject
{
    private readonly IBankImportService _bank;
    private readonly IExpenseStore _store;
    private readonly IMessenger _messenger;

    public ImportViewModel(IBankImportService bank, IExpenseStore store, IMessenger messenger)
    {
        _bank = bank;
        _store = store;
        _messenger = messenger;
    }

    [ObservableProperty]
    public partial string Status { get; set; } = "";

    [RelayCommand]
    private async Task ImportAsync()
    {
        Status = "Downloading...";
        IReadOnlyList<Expense> items = await _bank.DownloadAsync();

        foreach (Expense item in items)
        {
            _store.Add(item);
            _messenger.Send(new ExpenseAddedMessage(item));   // the list adds it
        }
        Status = $"Imported {items.Count} expenses";
    }
}
```

The `ExpenseAddedMessage` is the one from [Messaging Between ViewModels](/courses/wpf/messaging-between-viewmodels), so `ExpenseListViewModel` shows each new expense straight away.

The generator creates an `ImportCommand` property (it drops the `Async` ending from the name) of type `IAsyncRelayCommand`. Compared with a normal command it gives you extra things for free:

- **It disables itself while running.** A button bound to `ImportCommand` greys out until the import finishes, so a double click cannot start two imports at once.
- **It has an `IsRunning` property** you can bind to, perfect for a busy indicator.

```xml
<Button Content="Import from bank" Command="{Binding ImportCommand}" />

<ProgressBar IsIndeterminate="True" Height="4"
             Visibility="{Binding ImportCommand.IsRunning,
                          Converter={StaticResource BoolToVisibility}}" />
```

`BoolToVisibility` is a `BooleanToVisibilityConverter` in resources, as in [Value Converters](/courses/wpf/value-converters). If you really want to allow several runs at once, use `[RelayCommand(AllowConcurrentExecutions = true)]`.

## Busy work: Task.Run

`await` alone does not move work to another thread. It only frees the UI thread while something *else* is doing the waiting. If your method is busy calculating, it still runs on the UI thread and still freezes the window.

For busy CPU work, push it to a background thread with `Task.Run`, and await the result:

```csharp
[RelayCommand]
private async Task BuildSummaryAsync()
{
    List<Expense> snapshot = _store.GetAll().ToList();   // copy on the UI thread

    string text = await Task.Run(() => BuildSummaryText(snapshot));

    Summary = text;                                      // back on the UI thread
}
```

`Task.Run` takes a [lambda](/courses/c-sharp/lambda-expressions) and runs it on a **thread pool** thread, a pool of worker threads that .NET keeps ready. Inside that lambda you must not touch controls or an `ObservableCollection` that the UI is bound to. That is why the code copies the list first and gives the background code only its own copy. The next lesson, [The Dispatcher and Threading](/courses/wpf/the-dispatcher-and-threading), explains this rule in detail.

A simple guide:

```text
File, network, database call with an Async method  ->  just await it
Heavy calculation or a slow method with no Async   ->  await Task.Run(...)
```

Do not wrap an already async I/O call in `Task.Run`. It works, but it wastes a thread for nothing.

## Showing progress

For long work, a progress bar is better than a spinner. .NET has a ready made helper: `Progress<T>`. You create it on the UI thread with a callback. The background code calls `Report`, and the callback runs **on the UI thread**, so it can update bound properties safely.

```csharp
[ObservableProperty]
public partial int ProgressPercent { get; set; }

[RelayCommand]
private async Task ImportAsync()
{
    var progress = new Progress<int>(percent => ProgressPercent = percent);

    IReadOnlyList<Expense> items = await _bank.DownloadAsync(progress);

    // ... add them to the store as before ...
}
```

And inside the service, which knows nothing about WPF:

```csharp
public async Task<IReadOnlyList<Expense>> DownloadAsync(IProgress<int>? progress = null)
{
    var result = new List<Expense>();
    for (int page = 1; page <= 10; page++)
    {
        result.AddRange(await DownloadPageAsync(page));
        progress?.Report(page * 10);   // 10, 20, ... 100 percent
    }
    return result;
}
```

The service depends only on the `IProgress<T>` [interface](/courses/c-sharp/interfaces), so it is easy to test. `Progress<T>` works the same way when the reporting code runs inside `Task.Run`.

```xml
<ProgressBar Minimum="0" Maximum="100" Height="8"
             Value="{Binding ProgressPercent}" />
```

## Cancelling

Users should be able to stop a long task. .NET uses a **cancellation token**: a small object you pass down, which says "please stop" when someone cancels. The toolkit can create a matching Cancel command for you:

```csharp
[RelayCommand(IncludeCancelCommand = true)]
private async Task ImportAsync(CancellationToken token)
{
    try
    {
        Status = "Downloading...";
        var items = await _bank.DownloadAsync(progress: null, token);
        // ... add them to the store ...
        Status = $"Imported {items.Count} expenses";
    }
    catch (OperationCanceledException)
    {
        Status = "Import cancelled";
    }
}
```

The method takes a `CancellationToken` parameter, and the generator now creates both `ImportCommand` and `ImportCancelCommand`. Bind a button to the second one:

```xml
<Button Content="Cancel" Command="{Binding ImportCancelCommand}" />
```

The Cancel button is only enabled while the import is running. Pass the token to every async API that accepts one (`ReadAllTextAsync`, `HttpClient` calls, EF Core queries), and they stop by throwing `OperationCanceledException`.

## The deadlock you must avoid

Sooner or later you will be tempted to get the result of a task without `await`:

```csharp
// DO NOT do this on the UI thread
var items = _bank.DownloadAsync().Result;
```

This can freeze the app **forever**. Here is why. `.Result` blocks the UI thread until the task finishes. But the task, when its inner `await` completes, wants to continue on the UI thread, which is blocked waiting for it. Each one waits for the other. That is a **deadlock**. The same goes for `.Wait()` and `.GetAwaiter().GetResult()`.

The rule is simple: **async all the way**. If you call an async method, make your method async too and `await` it, up to the command or event handler at the top.

### ConfigureAwait(false) in services

In service classes that never touch the UI, you can write `await SomethingAsync().ConfigureAwait(false)`. It means "I do not need to come back to the UI thread". It saves a little work and protects the library from deadlocks if someone misuses it.

```csharp
public async Task<IReadOnlyList<Expense>> ReadBackupAsync(string path, CancellationToken token = default)
{
    await using FileStream stream = File.OpenRead(path);
    var items = await JsonSerializer.DeserializeAsync<List<Expense>>(stream, cancellationToken: token)
                                    .ConfigureAwait(false);
    return items ?? [];
}
```

Never use it in a view model or code-behind, because the code after the await must run on the UI thread there.

## Handling errors

When an awaited task fails, the exception is thrown at the `await`, so a normal `try`/`catch` works, as in [exception handling](/courses/c-sharp/exception-handling). In an async command, catch errors inside the method and show a friendly message. An exception that escapes an async command or an `async void` handler goes to the app's unhandled exception handler and can crash the app.

```csharp
catch (IOException ex)
{
    Status = "Could not read the file: " + ex.Message;
}
```

You will set up a global safety net in [Error Handling and Logging](/courses/wpf/error-handling-and-logging).

## Common mistakes

- **`async void` outside event handlers.** Use `async Task` everywhere else. The toolkit's `[RelayCommand]` wants `Task` too.
- **Blocking with `.Result` or `.Wait()`.** Causes freezes or deadlocks. Await instead.
- **Thinking `await` means "background thread".** It does not. Busy CPU work still needs `Task.Run`.
- **Touching the UI inside `Task.Run`.** Controls and bound collections belong to the UI thread. Return a result and update the UI after the await.
- **Forgetting to pass the cancellation token** down to the APIs you call, so Cancel does nothing.
- **`Thread.Sleep` to wait.** Use `await Task.Delay(...)`, which waits without blocking.

## Quick recap

- The UI thread draws the window and runs your code. Long work on it freezes the app.
- `await` frees the UI thread while waiting, then continues on the UI thread, so you can update the UI after it.
- `async void` is only for event handlers. Use `async Task` with `[RelayCommand]` to get an `IAsyncRelayCommand` that disables itself and exposes `IsRunning`.
- Use `Task.Run` for heavy CPU work. Do not touch controls inside it.
- Report progress with `Progress<T>` and cancel with a `CancellationToken` and `IncludeCancelCommand = true`.
- Never block on tasks with `.Result` or `.Wait()`. Go async all the way, and use `ConfigureAwait(false)` only in non UI services.

<code id="code-content" class="language-csharp">
// ViewModels/ImportViewModel.cs
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
using CoinJar.Messages;
using CoinJar.Models;
using CoinJar.Services;
namespace CoinJar.ViewModels;
public partial class ImportViewModel : ObservableObject
{
    private readonly IBankImportService _bank;
    private readonly IExpenseStore _store;
    private readonly IMessenger _messenger;
    public ImportViewModel(IBankImportService bank, IExpenseStore store, IMessenger messenger)
    {
        _bank = bank;
        _store = store;
        _messenger = messenger;
    }
    [ObservableProperty]
    public partial string Status { get; set; } = "Press Import to start";
    [ObservableProperty]
    public partial int ProgressPercent { get; set; }
    [ObservableProperty]
    public partial string Summary { get; set; } = "";
    // Generates ImportCommand (IAsyncRelayCommand) and ImportCancelCommand.
    // ImportCommand disables itself while running and exposes IsRunning.
    [RelayCommand(IncludeCancelCommand = true)]
    private async Task ImportAsync(CancellationToken token)
    {
        Status = "Downloading...";
        ProgressPercent = 0;
        try
        {
            // Progress callbacks run on the UI thread, so setting a
            // bound property here is safe.
            var progress = new Progress&lt;int&gt;(percent =&gt; ProgressPercent = percent);
            IReadOnlyList&lt;Expense&gt; items = await _bank.DownloadAsync(progress, token);
            // After await we are back on the UI thread.
            foreach (Expense item in items)
            {
                _store.Add(item);
                // ExpenseListViewModel listens for this and adds it to its list.
                _messenger.Send(new ExpenseAddedMessage(item));
            }
            Status = $"Imported {items.Count} expenses";
        }
        catch (OperationCanceledException)
        {
            Status = "Import cancelled";
        }
        catch (Exception ex)
        {
            // Never let an exception escape an async command.
            Status = "Could not import: " + ex.Message;
        }
    }
    // Heavy CPU work goes to a thread pool thread with Task.Run.
    [RelayCommand]
    private async Task BuildSummaryAsync()
    {
        List&lt;Expense&gt; snapshot = _store.GetAll().ToList();   // copy on the UI thread
        string text = await Task.Run(() =&gt; BuildSummaryText(snapshot));
        Summary = text;                                      // back on the UI thread
    }
    // Runs in the background. It only uses its own data, no UI objects.
    private static string BuildSummaryText(List&lt;Expense&gt; expenses)
    {
        var lines = expenses
            .GroupBy(e =&gt; e.Category)
            .OrderByDescending(g =&gt; g.Sum(e =&gt; e.Amount))
            .Select(g =&gt; $"{g.Key}: {g.Sum(e =&gt; e.Amount):C}");
        return string.Join(Environment.NewLine, lines);
    }
}
// Services/IBankImportService.cs
using CoinJar.Models;
namespace CoinJar.Services;
public interface IBankImportService
{
    Task&lt;IReadOnlyList&lt;Expense&gt;&gt; DownloadAsync(IProgress&lt;int&gt;? progress = null, CancellationToken token = default);
}
// Services/FakeBankImportService.cs
using CoinJar.Models;
namespace CoinJar.Services;
// Pretends to be a slow bank connection so you can see the UI stay responsive.
// Register it: builder.Services.AddSingleton&lt;IBankImportService, FakeBankImportService&gt;();
public class FakeBankImportService : IBankImportService
{
    public async Task&lt;IReadOnlyList&lt;Expense&gt;&gt; DownloadAsync(IProgress&lt;int&gt;? progress = null, CancellationToken token = default)
    {
        string[] categories = ["Food", "Transport", "Bills", "Fun", "Other"];
        var result = new List&lt;Expense&gt;();
        for (int i = 1; i &lt;= 20; i++)
        {
            // Task.Delay waits without blocking. It throws when cancelled.
            await Task.Delay(150, token).ConfigureAwait(false);
            result.Add(new Expense
            {
                Id = 1000 + i,
                Title = $"Card payment {i}",
                Amount = i * 2.5m,
                Category = categories[i % categories.Length],
                Date = DateTime.Today.AddDays(-i)
            });
            progress?.Report(i * 100 / 20);
        }
        return result;
    }
}
&lt;!-- Views/ImportView.xaml --&gt;
&lt;UserControl x:Class="CoinJar.Views.ImportView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"&gt;
    &lt;UserControl.Resources&gt;
        &lt;BooleanToVisibilityConverter x:Key="BoolToVisibility" /&gt;
    &lt;/UserControl.Resources&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;StackPanel Orientation="Horizontal"&gt;
            &lt;Button Content="Import from bank" Command="{Binding ImportCommand}" Padding="12,4" Margin="0,0,8,0" /&gt;
            &lt;Button Content="Cancel" Command="{Binding ImportCancelCommand}" Padding="12,4" Margin="0,0,8,0" /&gt;
            &lt;Button Content="Summary" Command="{Binding BuildSummaryCommand}" Padding="12,4" /&gt;
        &lt;/StackPanel&gt;
        &lt;!-- Only visible while the import runs. --&gt;
        &lt;ProgressBar Height="8" Margin="0,8" Maximum="100"
                     Value="{Binding ProgressPercent}"
                     Visibility="{Binding ImportCommand.IsRunning, Converter={StaticResource BoolToVisibility}}" /&gt;
        &lt;TextBlock Text="{Binding Status}" Margin="0,0,0,8" /&gt;
        &lt;TextBlock Text="{Binding Summary}" /&gt;
    &lt;/StackPanel&gt;
&lt;/UserControl&gt;
</code></pre>
