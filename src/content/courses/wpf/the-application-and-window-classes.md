---
publishDate: 2026-10-25T20:04
title: 'The Application and Window Classes'
slug: the-application-and-window-classes
metadescription: 'Learn what the Application and Window classes do, how to run code at start up and shut down, open more windows with Show and ShowDialog, and control window size and position.'
updateDate: 2026-10-25T20:04
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'application', 'window', 'beginners']
course: wpf
---

## Two classes that run the show

Every WPF app is built around two classes:

- **`Application`** is the app itself. There is exactly one per program. It starts up, keeps track of all open windows and decides when the program ends.
- **`Window`** is one window on the screen, with a title bar and borders. An app can have many.

Think of a shop. `Application` is the shop building: it opens in the morning, closes at night and knows which rooms are in use. Each `Window` is one room where customers actually do things.

In [Understanding the Project Structure](/courses/wpf/understanding-the-project-structure) you saw that `App.xaml` and `App.xaml.cs` make up your `App` class, which inherits from `Application`, and that `MainWindow` inherits from `Window`. This lesson shows what you can do with each.

## The Application class

### Application.Current

From anywhere in your app you can reach the one `Application` object through a static property:

```csharp
Application app = Application.Current;

// The first window the app opened
Window main = Application.Current.MainWindow;

// Every window that is open right now
foreach (Window w in Application.Current.Windows)
{
    System.Diagnostics.Debug.WriteLine(w.Title); // shows in the Output window
}
```

This is handy when, for example, a dialog needs to know which window is the main one.

### Running code at start up

`StartupUri` in `App.xaml` is the simplest way to open the first window. But sometimes you want to run code first: read settings, check a file, or choose which window to show. For that, override `OnStartup` in `App.xaml.cs`.

To **override** a method means to replace the version the base class gives you with your own. You usually call the base version too, with `base.OnStartup(e)`.

```csharp
public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Your start up code goes here
        var window = new MainWindow();
        window.Show();
    }
}
```

If you open the window in code like this, remove `StartupUri` from `App.xaml`. Otherwise you get two main windows.

```xml
<Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <!-- No StartupUri: OnStartup opens the window instead -->
</Application>
```

This pattern becomes important later. In [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host) you will create the main window in `OnStartup` so that it can receive services.

### Command line arguments

`e.Args` in `OnStartup` holds any text typed after the program name. If someone runs `CoinJar.exe --demo`, then `e.Args[0]` is `"--demo"`:

```csharp
protected override void OnStartup(StartupEventArgs e)
{
    base.OnStartup(e);
    bool demoMode = e.Args.Contains("--demo");
    new MainWindow().Show();
}
```

### Running code at shut down

Override `OnExit` to run code when the app closes, for example to save settings:

```csharp
protected override void OnExit(ExitEventArgs e)
{
    // Save things here
    base.OnExit(e);
}
```

### When does the app end?

By default the app ends when the **last** window closes. You can change this with the `ShutdownMode` property:

```text
OnLastWindowClose   (default) The app ends when every window is closed.
OnMainWindowClose   The app ends when the main window closes, even if others are open.
OnExplicitShutdown  The app only ends when your code calls Shutdown().
```

Set it in XAML:

```xml
<Application ... ShutdownMode="OnMainWindowClose">
```

You can also end the app from code at any time:

```csharp
Application.Current.Shutdown();
```

## The Window class

### The everyday properties

A window has many properties you can set right in XAML. These are the ones you will use most:

```xml
<Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar"
        Width="800" Height="500"
        MinWidth="500" MinHeight="300"
        WindowStartupLocation="CenterScreen"
        ResizeMode="CanResize">
```

What they mean:

- `Title`: the text in the title bar and on the taskbar.
- `Width` and `Height`: the starting size, in device independent units (about the same as pixels at normal scaling).
- `MinWidth` and `MinHeight`: the window cannot be made smaller than this. `MaxWidth` and `MaxHeight` also exist.
- `WindowStartupLocation`: where the window first appears. `CenterScreen` puts it in the middle of the screen. `CenterOwner` centres it over its owner window (useful for dialogs).
- `ResizeMode`: `CanResize` (normal), `CanMinimize` (no resizing, but minimise works), `NoResize` (fixed size).

A few more that come in handy:

```text
WindowState="Maximized"      Start maximised (also Normal, Minimized)
SizeToContent="WidthAndHeight"  Size the window to fit what is inside it
Topmost="True"               Stay above other windows
ShowInTaskbar="False"        Hide from the taskbar (good for small dialogs)
Icon="coin.ico"              The window icon
```

`SizeToContent` is great for small dialogs: you do not have to guess a size, the window grows to fit its controls.

### Window events

A window raises **events** at important moments. An event is a way for an object to say "something happened" so your code can react. Three useful ones:

- `Loaded`: the window and its controls are ready and on the screen. A good place to load data.
- `Closing`: the user is trying to close the window. You can still stop it.
- `Closed`: the window is gone.

Hook them up in XAML:

```xml
<Window ... Loaded="Window_Loaded" Closing="Window_Closing">
```

And handle them in the code-behind:

```csharp
private void Window_Loaded(object sender, RoutedEventArgs e)
{
    StatusText.Text = "Ready.";
}

private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
{
    var answer = MessageBox.Show("Really quit CoinJar?", "CoinJar",
        MessageBoxButton.YesNo, MessageBoxImage.Question);

    if (answer == MessageBoxResult.No)
    {
        e.Cancel = true; // keep the window open
    }
}
```

Setting `e.Cancel = true` in `Closing` stops the window from closing. This is how apps ask "Do you want to save your changes?".

## Opening more windows

Add a second window to your project. In Visual Studio, right click the project, choose **Add > Window (WPF)** and name it `AboutWindow`. From the command line, copy `MainWindow.xaml` and `MainWindow.xaml.cs`, rename them, and change the class name and `x:Class` inside. (A full example is in the code panel.)

There are two ways to show it.

### Show: a normal window

```csharp
var about = new AboutWindow();
about.Show();
```

`Show()` opens the window and returns at once. The user can switch between both windows freely. This is called a **modeless** window.

### ShowDialog: a dialog

```csharp
var about = new AboutWindow();
about.Owner = this;               // this = the current window
bool? result = about.ShowDialog();
```

`ShowDialog()` opens the window as a **modal dialog**. The user cannot use the owner window until the dialog closes, and your code waits on that line until then. Use it for things like "Add expense" forms, where you need an answer before you carry on.

Setting `Owner` keeps the dialog on top of its owner and lets `CenterOwner` work.

### Returning a result from a dialog

`ShowDialog()` returns a `bool?`, which is `true`, `false` or `null`. Inside the dialog, set `DialogResult` and the dialog closes by itself:

```csharp
private void Ok_Click(object sender, RoutedEventArgs e)
{
    DialogResult = true;   // closes the dialog, ShowDialog returns true
}
```

You can also mark buttons with `IsDefault="True"` (Enter key) and `IsCancel="True"` (Esc key). A cancel button closes the dialog with `false` without any code at all. You will build full dialogs in [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes).

## Common mistakes

- **Leaving `StartupUri` in place while also opening a window in `OnStartup`.** You get two windows.
- **Forgetting `base.OnStartup(e)`.** The base class raises the `Startup` event there, so any handlers for it would never run.
- **Setting `DialogResult` on a window opened with `Show()`.** That throws an exception. `DialogResult` only works with `ShowDialog()`.
- **Closing the main window and wondering why the app keeps running.** Another hidden or open window is still alive. Check `ShutdownMode`.
- **Doing slow work in the constructor.** The window will not appear until it finishes. Use `Loaded`, and later [async and await](/courses/c-sharp/async-and-await), instead.

## Quick recap

- `Application` is the whole app. `Application.Current` reaches it from anywhere.
- Override `OnStartup` to run code before the first window opens, and remove `StartupUri` when you do.
- Override `OnExit` for shut down work, and use `ShutdownMode` to decide when the app ends.
- `Window` properties like `Title`, `Width`, `MinWidth`, `WindowStartupLocation`, `ResizeMode` and `SizeToContent` control size and position.
- `Loaded`, `Closing` and `Closed` let you react to a window's life. `e.Cancel = true` stops a close.
- `Show()` opens a normal window. `ShowDialog()` opens a modal dialog that returns a `bool?` through `DialogResult`.
- Next, learn the rules of the markup language in [XAML Syntax Basics](/courses/wpf/xaml-syntax-basics).

<code id="code-content" class="language-xml">
&lt;!-- App.xaml --&gt;
&lt;!-- No StartupUri here: OnStartup in App.xaml.cs opens the window --&gt;
&lt;Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             ShutdownMode="OnMainWindowClose"&gt;
    &lt;Application.Resources&gt;
    &lt;/Application.Resources&gt;
&lt;/Application&gt;
// App.xaml.cs
using System.Windows;
namespace CoinJar;
public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        // Run CoinJar.exe --demo to see a different title
        var window = new MainWindow();
        if (e.Args.Contains("--demo"))
        {
            window.Title = "CoinJar (demo)";
        }
        window.Show(); // the first window created becomes Application.MainWindow
    }
    protected override void OnExit(ExitEventArgs e)
    {
        // A good place to save settings later in the course
        base.OnExit(e);
    }
}
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Width="600" Height="350"
        MinWidth="400" MinHeight="250"
        WindowStartupLocation="CenterScreen"
        Loaded="Window_Loaded" Closing="Window_Closing"&gt;
    &lt;StackPanel Margin="20"&gt;
        &lt;TextBlock Text="CoinJar" FontSize="24" FontWeight="SemiBold" /&gt;
        &lt;TextBlock x:Name="StatusText" Margin="0,8,0,16" /&gt;
        &lt;Button Content="About CoinJar..." HorizontalAlignment="Left"
                Padding="12,4" Click="About_Click" /&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.ComponentModel;
using System.Windows;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
    // Runs once the window is on screen
    private void Window_Loaded(object sender, RoutedEventArgs e)
    {
        StatusText.Text = $"Ready. {Application.Current.Windows.Count} window(s) open.";
    }
    // Runs when the user tries to close the window
    private void Window_Closing(object sender, CancelEventArgs e)
    {
        var answer = MessageBox.Show("Really quit CoinJar?", "CoinJar",
            MessageBoxButton.YesNo, MessageBoxImage.Question);
        if (answer == MessageBoxResult.No)
        {
            e.Cancel = true; // keep the window open
        }
    }
    private void About_Click(object sender, RoutedEventArgs e)
    {
        var about = new AboutWindow { Owner = this };
        bool? result = about.ShowDialog(); // waits here until the dialog closes
        StatusText.Text = result == true ? "Thanks for reading!" : "About closed.";
    }
}
&lt;!-- AboutWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.AboutWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="About CoinJar"
        SizeToContent="WidthAndHeight"
        ResizeMode="NoResize"
        ShowInTaskbar="False"
        WindowStartupLocation="CenterOwner"&gt;
    &lt;StackPanel Margin="20"&gt;
        &lt;TextBlock Text="CoinJar 1.0" FontSize="18" FontWeight="SemiBold" /&gt;
        &lt;TextBlock Text="A small expense tracker built with WPF." Margin="0,6,0,16" /&gt;
        &lt;StackPanel Orientation="Horizontal" HorizontalAlignment="Right"&gt;
            &lt;!-- IsDefault: Enter. IsCancel: Esc closes with false, no code needed --&gt;
            &lt;Button Content="Nice!" IsDefault="True" Padding="12,4" Click="Ok_Click" /&gt;
            &lt;Button Content="Close" IsCancel="True" Padding="12,4" Margin="8,0,0,0" /&gt;
        &lt;/StackPanel&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// AboutWindow.xaml.cs
using System.Windows;
namespace CoinJar;
public partial class AboutWindow : Window
{
    public AboutWindow()
    {
        InitializeComponent();
    }
    private void Ok_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = true; // closes the dialog, ShowDialog returns true
    }
}
</code></pre>
