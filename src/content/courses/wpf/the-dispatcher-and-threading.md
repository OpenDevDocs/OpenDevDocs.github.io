---
publishDate: 2026-10-25T20:49
title: 'The Dispatcher and Threading'
slug: the-dispatcher-and-threading
metadescription: 'Understand WPF thread affinity, use the Dispatcher to get back to the UI thread, update bound collections safely from background threads, and pick the right timer.'
updateDate: 2026-10-25T20:49
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'threading', 'dispatcher', 'async']
course: wpf
---

## The rule: UI objects belong to one thread

In [Async, Await and a Responsive UI](/courses/wpf/async-await-and-a-responsive-ui) you met the UI thread and learned that `await` brings you back to it. This lesson explains what is going on underneath, and what to do when `await` is not enough.

Every control, brush and window in WPF is created on a thread, and it **belongs** to that thread. Only that thread may read or change it. This is called **thread affinity**. It is like a safe with one key: the UI thread holds the key, and nobody else can open it.

Try to break the rule and WPF stops you:

```csharp
private void OnStartClick(object sender, RoutedEventArgs e)
{
    Task.Run(() =>
    {
        // Runs on a thread pool thread, not the UI thread
        StatusText.Text = "Done";   // throws InvalidOperationException
    });
}
```

The error message is famous:

```text
The calling thread cannot access this object because a different thread owns it.
```

Behind the scenes, almost every WPF object inherits from a class called `DispatcherObject`. Before it does anything, it checks whether the current thread is its owner. If not, it throws.

## What the Dispatcher is

So how does a background thread get something shown on screen? It asks the UI thread to do it.

Each UI thread has a **Dispatcher**: a queue of work items plus a loop that runs them one at a time. Clicks, key presses, layout, drawing and your event handlers all go through this queue. Back in the café, the dispatcher is the order spike next to the kitchen. Anyone can pin an order on it, but only the waiter takes orders off and serves them.

You get the dispatcher from any WPF object or from the application:

```csharp
Dispatcher fromControl = StatusText.Dispatcher;
Dispatcher fromApp = Application.Current.Dispatcher;
```

In an app with one UI thread (almost every app) these are the same object.

## Running code on the UI thread

### InvokeAsync

`InvokeAsync` pins the work on the queue and returns at once. The UI thread runs it as soon as it can.

```csharp
Task.Run(() =>
{
    string result = DoHeavyWork();

    Application.Current.Dispatcher.InvokeAsync(() =>
    {
        StatusText.Text = result;   // runs on the UI thread, allowed
    });
});
```

`InvokeAsync` returns a `DispatcherOperation` that you can `await` if you need to know when it has finished.

### Invoke

`Invoke` does the same but **waits** until the UI thread has run the work:

```csharp
Application.Current.Dispatcher.Invoke(() => StatusText.Text = result);
```

The background thread stands still until the UI thread is done. Prefer `InvokeAsync`: it cannot block the background thread, and it cannot cause a deadlock if the UI thread happens to be waiting for that background thread. Older code uses `BeginInvoke`, which is the pre-`async` version of `InvokeAsync`.

### CheckAccess

Sometimes the same method is called from both the UI thread and background threads. `CheckAccess` tells you which one you are on:

```csharp
private void ShowStatus(string text)
{
    if (Dispatcher.CheckAccess())
    {
        StatusText.Text = text;          // already on the UI thread
    }
    else
    {
        Dispatcher.InvokeAsync(() => StatusText.Text = text);
    }
}
```

## Do you even need the Dispatcher?

Often you do not. With `async` and `await`, the code after `await` already runs on the UI thread:

```csharp
private async void OnStartClick(object sender, RoutedEventArgs e)
{
    string result = await Task.Run(DoHeavyWork);   // background
    StatusText.Text = result;                      // UI thread again
}
```

That is cleaner than calling the dispatcher yourself. Reach for the dispatcher when code you do not control calls you back on a background thread, for example:

- events from `FileSystemWatcher`, `System.Timers.Timer` or `SerialPort`
- callbacks from a network or messaging library
- a long running background loop that reports now and then

## Bindings, view models and threads

Here is a detail that surprises many people. If a view model property changes on a background thread and raises `PropertyChanged`, WPF bindings **move that update to the UI thread for you**. So this works:

```csharp
await Task.Run(() =>
{
    Status = "Working...";   // a normal [ObservableProperty]: OK from any thread
});
```

Collections are different. Adding to an `ObservableCollection<T>` that a `ListBox` or `DataGrid` is bound to, from a background thread, throws:

```text
This type of CollectionView does not support changes to its SourceCollection
from a thread different from the Dispatcher thread.
```

You have two fixes.

### Fix 1: marshal the change

Do the slow part in the background and add the items on the UI thread:

```csharp
Application.Current.Dispatcher.InvokeAsync(() => Log.Add(message));
```

### Fix 2: enable collection synchronization

`BindingOperations.EnableCollectionSynchronization` tells WPF that you will protect the collection with a lock. WPF then takes the same lock when it reads the collection.

```csharp
private readonly object _logLock = new();

public ObservableCollection<string> Log { get; } = new();

public ActivityViewModel()
{
    // Call this on the UI thread, before any background thread touches Log
    BindingOperations.EnableCollectionSynchronization(Log, _logLock);
}

private void AddFromAnyThread(string message)
{
    lock (_logLock)
    {
        Log.Add(message);
    }
}
```

Every change, from every thread, must then happen inside `lock`. You learned about locks in [synchronization and thread safety](/courses/c-sharp/synchronization-and-thread-safety). Fix 1 is simpler and is the better default. Fix 2 helps when many background threads add items often.

## Dispatcher priorities

Work in the dispatcher queue has a **priority**. Input and drawing usually come before normal work. You can choose a priority yourself:

```csharp
Dispatcher.InvokeAsync(() => AmountBox.Focus(), DispatcherPriority.Input);

Dispatcher.InvokeAsync(RebuildSearchIndex, DispatcherPriority.Background);
```

`DispatcherPriority.Background` and `ApplicationIdle` run only when the UI has nothing more urgent to do, which is good for small cleanup jobs. You rarely need anything but the default (`Normal`). A classic use is to run something "right after the current layout is done", such as moving focus to a control that just became visible.

## Timers

There are several timer classes in .NET, and in WPF the choice matters.

### DispatcherTimer

A `DispatcherTimer` puts its `Tick` event on the dispatcher queue, so the handler always runs on the UI thread. It is the right choice for updating the UI regularly, like a clock in the status bar:

```csharp
var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
timer.Tick += (s, e) => Now = DateTime.Now.ToString("t");
timer.Start();
```

Keep the `Tick` handler short. It runs on the UI thread, so slow work in it freezes the window just like slow work in a click handler.

### Other timers

`System.Timers.Timer` and `System.Threading.Timer` fire on thread pool threads. Use them for background work, and use the dispatcher if they must touch UI objects.

`PeriodicTimer` works with `await`. Started from the UI thread, the loop continues on the UI thread after each tick:

```csharp
using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
while (await timer.WaitForNextTickAsync(token))
{
    await SaveAsync();   // autosave every five minutes
}
```

## Freezables: sharing graphics between threads

Brushes, geometries and images are **freezable** objects. Once you call `Freeze()` on one, it becomes read only, and read only objects can be used from any thread. That is how you load an image in the background and show it on the UI thread:

```csharp
BitmapImage image = await Task.Run(() =>
{
    var bitmap = new BitmapImage();
    bitmap.BeginInit();
    bitmap.UriSource = new Uri(path);
    bitmap.CacheOption = BitmapCacheOption.OnLoad;  // read the file now
    bitmap.EndInit();
    bitmap.Freeze();          // without this, the UI thread may not use it
    return bitmap;
});

ReceiptImage.Source = image;
```

## Common mistakes

- **Updating controls from `Task.Run`.** Return the result and set it after `await`, or use `InvokeAsync`.
- **Using `Dispatcher.Invoke` everywhere "just in case".** It hides design problems and can deadlock. Use `async`/`await` first.
- **Adding to a bound `ObservableCollection` from a background thread.** Marshal the add, or enable collection synchronization and always lock.
- **Slow work in a `DispatcherTimer` tick.** It runs on the UI thread. Await async work inside, or move it to `Task.Run`.
- **Forgetting to `Freeze()`** brushes or images created on a background thread.
- **Using `Application.Current` in unit tested view models.** It is `null` in a test run. Keep dispatcher calls rare, and you will see ways to test view models in [Unit Testing ViewModels](/courses/wpf/unit-testing-viewmodels).

## Quick recap

- WPF objects have thread affinity: only the thread that created them may use them, otherwise you get "a different thread owns it".
- The Dispatcher is the UI thread's work queue. `InvokeAsync` adds work without waiting, `Invoke` waits, `CheckAccess` says whether you are already on the UI thread.
- After `await`, you are back on the UI thread, so you need the dispatcher mainly for callbacks from background threads.
- Bindings marshal simple `PropertyChanged` updates for you, but bound collections must change on the UI thread or use `EnableCollectionSynchronization` with a lock.
- `DispatcherTimer` ticks on the UI thread. Other timers tick in the background.
- Freeze brushes and images to share them across threads.

<code id="code-content" class="language-csharp">
// ViewModels/StatusBarViewModel.cs
using System.Collections.ObjectModel;
using System.IO;
using System.Windows;
using System.Windows.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
namespace CoinJar.ViewModels;
// Shows a clock and a log of changes to the CoinJar data folder.
public partial class StatusBarViewModel : ObservableObject, IDisposable
{
    private readonly Dispatcher _dispatcher;
    private readonly DispatcherTimer _clockTimer;
    private readonly FileSystemWatcher _watcher;
    [ObservableProperty]
    public partial string Clock { get; set; } = "";
    // Bound to a ListBox, so it must only change on the UI thread.
    public ObservableCollection&lt;string&gt; Activity { get; } = new();
    public StatusBarViewModel()
    {
        // The UI thread's dispatcher. Grab it once and keep it.
        _dispatcher = Application.Current.Dispatcher;
        // DispatcherTimer: Tick runs on the UI thread, so it may update
        // bound properties and collections directly.
        _clockTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
        _clockTimer.Tick += (_, _) =&gt; Clock = DateTime.Now.ToString("T");
        _clockTimer.Start();
        Clock = DateTime.Now.ToString("T");
        string folder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "CoinJar");
        Directory.CreateDirectory(folder);
        // FileSystemWatcher raises its events on a thread pool thread.
        _watcher = new FileSystemWatcher(folder) { EnableRaisingEvents = true };
        _watcher.Changed += OnFileChanged;
        _watcher.Created += OnFileChanged;
        _watcher.Deleted += OnFileChanged;
    }
    // Called on a BACKGROUND thread.
    private void OnFileChanged(object sender, FileSystemEventArgs e)
    {
        string message = $"{DateTime.Now:T}  {e.ChangeType}: {e.Name}";
        // Activity.Add(message) here would throw, so queue it on the UI thread.
        _dispatcher.InvokeAsync(() =&gt; AddActivity(message));
    }
    // Always runs on the UI thread.
    private void AddActivity(string message)
    {
        Activity.Insert(0, message);
        if (Activity.Count &gt; 50)
        {
            Activity.RemoveAt(Activity.Count - 1);   // keep the list short
        }
    }
    public void Dispose()
    {
        _clockTimer.Stop();
        _watcher.Dispose();
    }
}
&lt;!-- Views/StatusBarView.xaml --&gt;
&lt;UserControl x:Class="CoinJar.Views.StatusBarView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"&gt;
    &lt;DockPanel&gt;
        &lt;StatusBar DockPanel.Dock="Bottom"&gt;
            &lt;StatusBarItem Content="{Binding Clock}" /&gt;
        &lt;/StatusBar&gt;
        &lt;ListBox ItemsSource="{Binding Activity}" MaxHeight="120" /&gt;
    &lt;/DockPanel&gt;
&lt;/UserControl&gt;
</code></pre>
