---
publishDate: 2026-10-25T20:57
title: 'Error Handling and Logging'
slug: error-handling-and-logging
metadescription: 'Stop CoinJar from vanishing on errors: catch expected problems where they happen, add the three global exception handlers, and log everything through Microsoft.Extensions.Logging and the host.'
updateDate: 2026-10-25T20:57
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'exceptions', 'logging', 'hosting']
course: wpf
---

## What happens when a WPF app throws

Try it. Add a button whose click handler does `throw new InvalidOperationException()` and click it. The window disappears. No message, no warning. Windows may write a short entry in the Event Viewer, and that is it.

For a user this is the worst possible experience. They lose what they typed and have no idea why. For you it is just as bad: you cannot fix a crash you never hear about.

This lesson fixes both problems in two layers:

1. **Handle errors you expect** where they happen, with `try` and `catch`, and tell the user something useful.
2. **Catch everything else** with global handlers, write it to a **log**, and keep the app alive when you can.

A **log** is a diary the app writes while it runs: "started", "loaded 42 expenses", "could not save, here is the exception". When a user reports a problem, the log tells you what happened.

## Layer 1: expected errors

Some failures are normal life, not bugs: a file was deleted, the disk is full, a web API is down, a JSON file is broken. Catch these close to where they happen, because only there do you know what to tell the user. The C# side is in [exception handling](/courses/c-sharp/exception-handling).

```csharp
[RelayCommand]
private async Task ImportAsync(string path)
{
    try
    {
        await using FileStream stream = File.OpenRead(path);
        List<Expense> items = await JsonSerializer.DeserializeAsync<List<Expense>>(stream) ?? [];
        foreach (Expense item in items) Expenses.Add(item);
        StatusText = $"Imported {items.Count} expenses.";
    }
    catch (FileNotFoundException)
    {
        StatusText = "That file does not exist any more.";
    }
    catch (JsonException)
    {
        StatusText = "That file is not a CoinJar export.";
    }
    // Anything else is a bug: let it go up to the global handler.
}
```

Three rules keep this clean:

- **Catch specific exceptions.** `catch (FileNotFoundException)` says exactly what you expect. A bare `catch (Exception)` also swallows real bugs, such as a `NullReferenceException` in your own code.
- **Tell the user what to do**, not what went wrong inside: "That file is not a CoinJar export" beats "Unexpected character at line 1".
- **Show messages through a service.** View models use `IDialogService.ShowMessage` from [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes), or a status text like above. Never `MessageBox.Show` in a view model.

## Layer 2: the three global handlers

Some exceptions will always slip through. .NET and WPF give you three events that act as safety nets. You subscribe to them once, at startup, in `App`.

| Event | Catches | Can the app keep running? |
| --- | --- | --- |
| `Application.DispatcherUnhandledException` | Exceptions on the UI thread | Yes, set `e.Handled = true` |
| `AppDomain.CurrentDomain.UnhandledException` | Exceptions on any other thread | No, the process ends |
| `TaskScheduler.UnobservedTaskException` | A failed `Task` nobody awaited | Yes, call `e.SetObserved()` |

### DispatcherUnhandledException

Most of your code runs on the UI thread: click handlers, commands, bindings, and the code after an `await` in a command. When an exception escapes from there, the [Dispatcher](/courses/wpf/the-dispatcher-and-threading) raises this event before the app dies.

```csharp
private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
{
    _logger.LogError(e.Exception, "Unhandled exception on the UI thread");
    MessageBox.Show(
        "Something went wrong, sorry. CoinJar saved the details to its log file and will keep running.",
        "CoinJar", MessageBoxButton.OK, MessageBoxImage.Error);
    e.Handled = true; // keep the app alive
}
```

`e.Handled = true` means "I dealt with it", and WPF keeps going. Here `App` may use `MessageBox` directly: it is view code, and the dialog service could be the very thing that broke.

Should you always keep running? For a small app like CoinJar, usually yes: the user can save their work. If the error could have left data half written, it can be safer to log, apologise and call `Shutdown()`.

### AppDomain.CurrentDomain.UnhandledException

An exception on a thread you started yourself (with `new Thread`, or inside a timer callback) does not go through the Dispatcher. It ends up here. By the time this event fires, the process is going to end no matter what you do. All you can do is log.

```csharp
private void OnDomainUnhandledException(object sender, UnhandledExceptionEventArgs e)
{
    _logger.LogCritical(e.ExceptionObject as Exception,
        "Fatal unhandled exception (terminating: {IsTerminating})", e.IsTerminating);
}
```

`ExceptionObject` is typed as `object` (very old .NET allowed throwing non exceptions), so cast it with `as`.

### TaskScheduler.UnobservedTaskException

A `Task` that fails stores its exception inside itself. If nobody ever awaits it or reads its `Exception`, the exception is **unobserved**. Modern .NET does not crash for this, but you also never hear about it.

```csharp
_ = Task.Run(() => throw new IOException("Backup failed")); // fire and forget: nobody awaits
```

This event tells you. It does not fire at once: it fires when the garbage collector cleans up the failed task, which can be much later.

```csharp
private void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
{
    _logger.LogError(e.Exception, "Unobserved task exception");
    e.SetObserved();
}
```

The best fix is not to have unobserved tasks: `await` your tasks, as in [Async, Await and a Responsive UI](/courses/wpf/async-await-and-a-responsive-ui).

### What about async commands?

An `async` `[RelayCommand]` creates an `AsyncRelayCommand`. When its method throws, the toolkit by default rethrows the exception on the UI thread, so it lands in `DispatcherUnhandledException`, the same as a normal command. If you would rather send it to `UnobservedTaskException`, there is an option for that:

```csharp
[RelayCommand(FlowExceptionsToTaskScheduler = true)]
private async Task RefreshAsync() { ... }
```

Either way the exception reaches a handler, which is what you want.

### Where to subscribe

As early as possible, so even startup errors are caught. The `App` constructor works well, right after building the host:

```csharp
public App()
{
    // ... build the host ...
    _host = builder.Build();
    _logger = _host.Services.GetRequiredService<ILogger<App>>();

    DispatcherUnhandledException += OnDispatcherUnhandledException;
    AppDomain.CurrentDomain.UnhandledException += OnDomainUnhandledException;
    TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;
}
```

## Logging with Microsoft.Extensions.Logging

So far `_logger` appeared out of nowhere. It comes from **Microsoft.Extensions.Logging**, the standard logging library in .NET. It is already part of the Generic Host you set up in [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host), so there is nothing to install.

### ILogger of T

Any class the host creates can ask for an `ILogger<T>` in its constructor. `T` is the class itself, and its full name becomes the **category** of each message, so you can see where a line came from.

```csharp
public partial class ExpenseListViewModel(ILogger<ExpenseListViewModel> logger) : ObservableObject
{
    private void Add(Expense expense)
    {
        logger.LogInformation("Added expense {Title} for {Amount}", expense.Title, expense.Amount);
    }
}
```

That parameter list is a C# 12 primary constructor; the normal constructor from earlier lessons works the same way.

### Log levels

Each message has a **level** that says how important it is:

| Level | Use it for |
| --- | --- |
| `Trace`, `Debug` | Detail for you while developing |
| `Information` | Normal events: started, loaded, saved |
| `Warning` | Something odd that the app handled: a missing file, a retry |
| `Error` | An operation failed |
| `Critical` | The app cannot continue |

Configuration decides which levels are written. The host reads the `Logging` section of `appsettings.json` (see [App Settings and Configuration](/courses/wpf/app-settings-and-configuration)):

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning"
    }
  }
}
```

This writes Information and above from your code, but only warnings from Microsoft's libraries (EF Core, for example, is chatty at Information). For the host to find the file, copy it to the output folder (`CopyToOutputDirectory`) and set `ContentRootPath = AppContext.BaseDirectory` when you create the builder, as in the code panel.

### Message templates, not string interpolation

Look closely at the logging call:

```csharp
logger.LogInformation("Added expense {Title} for {Amount}", expense.Title, expense.Amount); // good
logger.LogInformation($"Added expense {expense.Title} for {expense.Amount}");               // avoid
```

The first form is a **message template**. The names in braces are filled from the arguments in order. The logging system keeps `Title` and `Amount` as separate values, so tools can later search for "all messages where Amount > 100". The `$` version bakes everything into one string and also does the formatting work even when the level is switched off.

To log an exception, pass it first. The logger stores its full stack trace:

```csharp
catch (JsonException ex)
{
    logger.LogWarning(ex, "Import file {Path} is not valid JSON", path);
}
```

### Faster logging with LoggerMessage

For messages you write often, a [source generator](/courses/c-sharp/source-generators) can create the logging code for you. You declare a `partial` method with the `[LoggerMessage]` [attribute](/courses/c-sharp/attributes):

```csharp
internal static partial class Log
{
    [LoggerMessage(Level = LogLevel.Information, Message = "Imported {Count} expenses from {Path}")]
    public static partial void Imported(ILogger logger, int count, string path);
}

// Usage
Log.Imported(logger, items.Count, path);
```

The generator checks the template at build time and produces code that does no work when the level is off. It is optional, but nice in hot paths.

## Where do log messages go?

A **logging provider** is a destination. `Host.CreateApplicationBuilder` adds a few by default. The useful one for you is **Debug**: while debugging in Visual Studio, log lines appear in the **Output** window. A WPF app has no console, so the Console provider shows nothing.

Users do not run your app in Visual Studio, so you also want a **log file**. Microsoft.Extensions.Logging does not ship a file provider, so you have two choices:

- Use a library. Serilog (with the `Serilog.Extensions.Hosting` and `Serilog.Sinks.File` packages) and NLog are popular and add rolling files, JSON output and more.
- Write a tiny provider yourself. It is a good exercise and enough for CoinJar.

A provider implements two [interfaces](/courses/c-sharp/interfaces): `ILoggerProvider` creates loggers, `ILogger` writes messages. The full file logger is in the code panel. Its core is one method:

```csharp
public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
    Exception? exception, Func<TState, Exception?, string> formatter)
{
    if (!IsEnabled(logLevel)) return;
    string line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} [{logLevel}] {category}: {formatter(state, exception)}";
    if (exception is not null) line += Environment.NewLine + exception;
    provider.Write(line);
}
```

Register it on the builder:

```csharp
string logFile = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "CoinJar", "logs", "coinjar.log");
builder.Logging.AddProvider(new FileLoggerProvider(logFile));
```

The file goes under `LocalApplicationData`, next to CoinJar's other data, because the program folder is often read only. When the host is disposed in `OnExit`, it disposes the provider, which closes the file (see [IDisposable](/courses/c-sharp/idisposable-and-resource-management)).

Logs are private data. Do not write passwords, tokens or anything a user would not want in a text file.

## Common mistakes

- **catch (Exception) everywhere.** Bugs get hidden and the app carries on in a broken state. Catch what you expect, and let the rest reach the global handler.
- **Empty catch blocks.** If you really must ignore an error, at least log it.
- **Handling the event too late.** If you subscribe after the first window opens, a crash during startup is lost.
- **Expecting UnhandledException to save the app.** It cannot. Only `DispatcherUnhandledException` lets you continue.
- **async void methods.** An exception in an `async void` method (other than an event handler) cannot be caught by the caller. Use `async Task` and await it.
- **String interpolation in log calls.** Use templates with `{Name}` placeholders.
- **No way to find the log.** Show the log folder in an About box, or add a "Open log folder" menu item, so users can send it to you.

## Quick recap

- Catch expected, specific exceptions where they happen and show a helpful message through a service.
- Subscribe to `DispatcherUnhandledException` (UI thread, can continue), `AppDomain.CurrentDomain.UnhandledException` (other threads, log only) and `TaskScheduler.UnobservedTaskException` (forgotten tasks) in the `App` constructor.
- Get an `ILogger<T>` from the host by constructor injection.
- Pick the right level, use message templates, and pass exceptions as the first argument.
- Configure levels in the `Logging` section of `appsettings.json`.
- The Debug provider writes to Visual Studio's Output window. Add a file provider, your own or Serilog, for real users.

<code id="code-content" class="language-csharp">
// App.xaml.cs
using System.IO;
using System.Windows;
using System.Windows.Threading;
using CoinJar.Services;
using CoinJar.ViewModels;
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
        // ContentRootPath: find appsettings.json next to the exe, whatever the working folder is.
        HostApplicationBuilder builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            ContentRootPath = AppContext.BaseDirectory
        });
        // The host already logs to the Debug window (and a few other places).
        // Add a log file under %LocalAppData%\CoinJar\logs.
        string logFile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CoinJar", "logs", "coinjar.log");
        builder.Logging.AddProvider(new FileLoggerProvider(logFile));
        builder.Services.AddSingleton&lt;ExpenseListViewModel&gt;();
        builder.Services.AddSingleton&lt;MainWindow&gt;();
        _host = builder.Build();
        _logger = _host.Services.GetRequiredService&lt;ILogger&lt;App&gt;&gt;();
        // The three safety nets. Hook them up as early as possible.
        DispatcherUnhandledException += OnDispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += OnDomainUnhandledException;
        TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;
    }
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        _host.Start();
        _host.Services.GetRequiredService&lt;MainWindow&gt;().Show();
        _logger.LogInformation("CoinJar started, version {Version}", typeof(App).Assembly.GetName().Version);
    }
    protected override void OnExit(ExitEventArgs e)
    {
        _logger.LogInformation("CoinJar closing");
        _host.StopAsync(TimeSpan.FromSeconds(5)).GetAwaiter().GetResult();
        _host.Dispose(); // disposes the logger providers, which closes the log file
        base.OnExit(e);
    }
    // 1. An exception on the UI thread that nobody caught.
    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        _logger.LogError(e.Exception, "Unhandled exception on the UI thread");
        MessageBox.Show(
            "Something went wrong, sorry. CoinJar saved the details to its log file and will keep running.",
            "CoinJar", MessageBoxButton.OK, MessageBoxImage.Error);
        e.Handled = true; // keep the app alive
    }
    // 2. An exception on any other thread. The process is going down; log what we can.
    private void OnDomainUnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        _logger.LogCritical(e.ExceptionObject as Exception,
            "Fatal unhandled exception (terminating: {IsTerminating})", e.IsTerminating);
    }
    // 3. A Task failed and nobody awaited it. Fires later, when the Task is garbage collected.
    private void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        _logger.LogError(e.Exception, "Unobserved task exception");
        e.SetObserved(); // mark it as seen
    }
}
// Services/FileLoggerProvider.cs
using System.IO;
using Microsoft.Extensions.Logging;
namespace CoinJar.Services;
// A tiny logger provider that appends one line per message to a text file.
public sealed class FileLoggerProvider : ILoggerProvider
{
    private readonly StreamWriter _writer;
    private readonly Lock _lock = new();
    private bool _disposed;
    public FileLoggerProvider(string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        _writer = new StreamWriter(path, append: true) { AutoFlush = true };
    }
    public ILogger CreateLogger(string categoryName) =&gt; new FileLogger(this, categoryName);
    private void Write(string line)
    {
        lock (_lock) // several threads may log at the same time
        {
            if (!_disposed) _writer.WriteLine(line);
        }
    }
    public void Dispose()
    {
        lock (_lock)
        {
            _disposed = true;
            _writer.Dispose();
        }
    }
    private sealed class FileLogger(FileLoggerProvider provider, string category) : ILogger
    {
        public IDisposable? BeginScope&lt;TState&gt;(TState state) where TState : notnull =&gt; null;
        public bool IsEnabled(LogLevel logLevel) =&gt; logLevel != LogLevel.None;
        public void Log&lt;TState&gt;(LogLevel logLevel, EventId eventId, TState state,
            Exception? exception, Func&lt;TState, Exception?, string&gt; formatter)
        {
            if (!IsEnabled(logLevel)) return;
            string line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} [{logLevel}] {category}: {formatter(state, exception)}";
            if (exception is not null) line += Environment.NewLine + exception;
            provider.Write(line);
        }
    }
}
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using System.IO;
using System.Text.Json;
using CoinJar.Models;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Extensions.Logging;
namespace CoinJar.ViewModels;
public partial class ExpenseListViewModel(ILogger&lt;ExpenseListViewModel&gt; logger) : ObservableObject
{
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = [];
    [ObservableProperty]
    public partial string StatusText { get; set; } = "";
    // Expected problems are caught right here, where we know what to tell the user.
    [RelayCommand]
    private async Task ImportAsync(string path)
    {
        try
        {
            await using FileStream stream = File.OpenRead(path);
            List&lt;Expense&gt; items = await JsonSerializer.DeserializeAsync&lt;List&lt;Expense&gt;&gt;(stream) ?? [];
            foreach (Expense item in items) Expenses.Add(item);
            Log.Imported(logger, items.Count, path);
            StatusText = $"Imported {items.Count} expenses.";
        }
        catch (FileNotFoundException ex)
        {
            logger.LogWarning(ex, "Import file {Path} not found", path);
            StatusText = "That file does not exist any more.";
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Import file {Path} is not valid JSON", path);
            StatusText = "That file is not a CoinJar export.";
        }
        // Anything else is a bug: let it reach DispatcherUnhandledException.
    }
    // A button for testing the safety net. Remove it before you ship.
    [RelayCommand]
    private void Crash() =&gt; throw new InvalidOperationException("Test crash from the Crash button");
}
// Log messages written once, checked by a source generator, fast at run time.
internal static partial class Log
{
    [LoggerMessage(Level = LogLevel.Information, Message = "Imported {Count} expenses from {Path}")]
    public static partial void Imported(ILogger logger, int count, string path);
}
// appsettings.json (set Copy to Output Directory: Copy if newer)
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
</code></pre>

