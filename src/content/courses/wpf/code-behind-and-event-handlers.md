---
publishDate: 2026-10-25T20:06
title: 'Code-Behind and Event Handlers'
slug: code-behind-and-event-handlers
metadescription: 'Learn how the code-behind file works, how to hook up event handlers in XAML and in C#, what sender and RoutedEventArgs are, and how routed events bubble up the tree.'
updateDate: 2026-10-25T20:06
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'events', 'code-behind', 'beginners']
course: wpf
---

## What code-behind is

Every window in WPF has two files. The XAML file describes the look, and the **code-behind** file (the `.xaml.cs` file next to it) holds the C# that runs when something happens. You met both in [Your First WPF App](/courses/wpf/your-first-wpf-app).

Things that happen in an app are called **events**: a click, a key press, the text in a box changing, the mouse moving over a button. A method that runs in response to an event is called an **event handler**.

This lesson builds a small **click counter** app and uses it to show how events work in WPF.

```text
+-------------------------------+
|  Clicks: 3                    |
|  [ +1 ]  [ -1 ]  [ Reset ]    |
|  Step: [ 1    ]               |
|  Last action: +1              |
+-------------------------------+
```

## Hooking up an event in XAML

The easiest way to handle an event is to name the handler method right in XAML:

```xml
<Button Content="+1" Click="Increase_Click" />
```

Then write a method with that exact name in the code-behind:

```csharp
private int _count;

private void Increase_Click(object sender, RoutedEventArgs e)
{
    _count++;
    CountText.Text = $"Clicks: {_count}";
}
```

When you type `Click="` in Visual Studio, it offers to create the handler for you. Press **Tab** and the empty method appears in the code-behind.

The field `_count` keeps its value between clicks because it lives on the window object, which stays alive as long as the window is open. If fields are new to you, see [fields and properties](/courses/c-sharp/fields-and-properties).

## The handler signature

Almost every WPF event handler looks like this:

```csharp
private void SomeName(object sender, SomeEventArgs e)
```

- **`sender`** is the object whose handler is running. For a button click it is the button.
- **`e`** holds extra details about the event. Its type depends on the event: `RoutedEventArgs` for `Click`, `KeyEventArgs` for `KeyDown`, `TextChangedEventArgs` for `TextChanged`, and so on.
- The return type is `void`. The method is usually `private`, because only this window needs it.

The handler name is up to you. The common style is `ControlName_EventName`, like `SaveButton_Click`. Whatever you pick, the XAML and C# must match exactly.

### Using sender

`sender` lets one handler serve several controls. Here three buttons share one method and the handler reads the button's `Tag`, a spare property you can use for any small value:

```xml
<Button Content="+1"  Tag="1"  Click="Change_Click" />
<Button Content="+5"  Tag="5"  Click="Change_Click" />
<Button Content="-1"  Tag="-1" Click="Change_Click" />
```

```csharp
private void Change_Click(object sender, RoutedEventArgs e)
{
    var button = (Button)sender;
    int amount = int.Parse((string)button.Tag);
    _count += amount;
    CountText.Text = $"Clicks: {_count}";
}
```

`sender` has the type `object`, so you **cast** it (convert it) to `Button` to use button properties.

## Hooking up an event in C#

You can also attach a handler in code with `+=`. This is the normal C# way to subscribe to an event, as covered in the [events](/courses/c-sharp/events) lesson:

```csharp
public MainWindow()
{
    InitializeComponent();
    ResetButton.Click += ResetButton_Click;
}

private void ResetButton_Click(object sender, RoutedEventArgs e)
{
    _count = 0;
    CountText.Text = "Clicks: 0";
}
```

For tiny handlers, a [lambda expression](/courses/c-sharp/lambda-expressions) is shorter:

```csharp
ResetButton.Click += (s, e) => CountText.Text = "Clicks: 0";
```

Attach handlers **after** `InitializeComponent()`. Before that line, `ResetButton` is still `null`.

To stop listening, use `-=` with the same method:

```csharp
ResetButton.Click -= ResetButton_Click;
```

Which way is better? Use XAML for most cases, because the link is visible right where the control is. Use C# when you decide at run time whether to listen, or when the control is created in code.

## Events you will use a lot

```text
Button.Click              The button was clicked (or Enter / Space pressed on it)
TextBox.TextChanged       The text changed, on every key stroke
ComboBox.SelectionChanged A different item was picked
CheckBox.Checked          The box was ticked (Unchecked for the opposite)
UIElement.KeyDown         A key was pressed while the control had focus
UIElement.MouseEnter      The mouse moved over the control (MouseLeave when it leaves)
Window.Loaded             The window is on screen and ready
```

Here is `TextChanged` in action. It checks the step box as the user types:

```xml
<TextBox x:Name="StepBox" Text="1" Width="60" TextChanged="StepBox_TextChanged" />
```

```csharp
private void StepBox_TextChanged(object sender, TextChangedEventArgs e)
{
    bool ok = int.TryParse(StepBox.Text, out _);
    StepBox.Background = ok ? Brushes.White : Brushes.MistyRose;
}
```

And `KeyDown` lets the user press **Up** and **Down** arrow keys instead of clicking:

```csharp
private void Window_KeyDown(object sender, KeyEventArgs e)
{
    if (e.Key == Key.Up)   { _count++; }
    if (e.Key == Key.Down) { _count--; }
    CountText.Text = $"Clicks: {_count}";
}
```

## Routed events: events that travel

Here is something that makes WPF different from many other frameworks. Most WPF events are **routed events**. A routed event does not just fire on one control. It travels through the tree of elements.

Picture a `Button` inside a `StackPanel` inside a `Window`. When you click the button, the `Click` event is raised on the button first, then on the `StackPanel`, then on the `Window`. It **bubbles** up, like a bubble rising through water.

```text
Window          3. then here
  StackPanel    2. then here
    Button      1. the click starts here
```

That means a parent can handle an event for all its children at once. This XAML puts one handler on the `StackPanel` and none on the buttons:

```xml
<StackPanel ButtonBase.Click="AnyButton_Click" Orientation="Horizontal">
    <Button Content="+1" Tag="1" />
    <Button Content="-1" Tag="-1" />
    <Button Content="Reset" Tag="0" />
</StackPanel>
```

`ButtonBase.Click` says "listen for the `Click` event that comes from any button inside me". `ButtonBase` is the base class all buttons share.

### sender versus e.Source

In a bubbling handler, `sender` and `e.Source` are different:

- `sender` is the element whose handler is running (here, the `StackPanel`).
- `e.Source` is the element where the event started (here, the button that was clicked).

```csharp
private void AnyButton_Click(object sender, RoutedEventArgs e)
{
    if (e.Source is Button button)
    {
        LastActionText.Text = $"Last action: {button.Content}";
    }
}
```

### Stopping the bubble with e.Handled

Set `e.Handled = true` to say "I dealt with this, stop here". Handlers further up the tree will not run (for normal handlers):

```csharp
private void Increase_Click(object sender, RoutedEventArgs e)
{
    _count++;
    e.Handled = true; // the StackPanel and Window will not see this click
}
```

### Preview events

Many events have a twin that starts with `Preview`, like `PreviewKeyDown` and `PreviewMouseDown`. These travel the other way, from the window **down** to the control. This is called **tunnelling**. A preview handler runs first, so it can block input before the control sees it. For example, a `PreviewTextInput` handler can reject letters in a number box. You will rarely need these as a beginner, but it is good to know the name.

You will learn more about the element tree in [Logical and Visual Trees](/courses/wpf/logical-and-visual-trees).

## How much code should live in code-behind?

Code-behind is perfect for learning and for code that is truly about the screen, like moving focus or starting an animation. But if you put all your app's logic there, the file grows huge and is hard to test.

Later in the course you will move most logic into **view models** using the MVVM pattern, and buttons will use **commands** instead of `Click` handlers. See [Introduction to MVVM](/courses/wpf/introduction-to-mvvm) and [Commands and ICommand](/courses/wpf/commands-and-icommand). For now, code-behind is exactly the right tool.

## Common mistakes

- **Name mismatch.** `Click="Increase_click"` with a method called `Increase_Click` fails to build. Capital letters matter.
- **Wrong parameter types.** A `TextChanged` handler needs `TextChangedEventArgs`, not `RoutedEventArgs`. The build error tells you the expected type.
- **Touching controls before `InitializeComponent()`.** They are still `null`, so you get a `NullReferenceException`.
- **Forgetting that `TextChanged` fires on every key.** Do not do slow work in it, like saving a file.
- **Deleting a handler from C# but not from XAML.** The build fails because XAML still points at the old method.
- **TextChanged firing during start up.** If you set `Text="1"` in XAML, `TextChanged` can run while the window is still loading, before other named controls exist. Check for `null` or use `IsLoaded` when that matters.

## Quick recap

- Code-behind is the `.xaml.cs` file, and event handlers are methods that run when something happens.
- Hook up handlers in XAML (`Click="Name"`) or in C# (`button.Click += Name;`).
- Handlers take `object sender` and an event args object `e` whose type depends on the event.
- One handler can serve many controls by checking `sender` or `Tag`.
- Most WPF events are routed: they bubble up the tree, so a parent can handle its children's events.
- `e.Source` is where the event started, and `e.Handled = true` stops it from bubbling further.
- `Preview` events tunnel down first and are useful for blocking input.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="ClickCounter.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Click Counter" Width="360" SizeToContent="Height"
        WindowStartupLocation="CenterScreen"
        KeyDown="Window_KeyDown"&gt;
    &lt;StackPanel Margin="20"&gt;
        &lt;TextBlock x:Name="CountText" Text="Clicks: 0" FontSize="28" FontWeight="Bold" /&gt;
        &lt;!-- One handler on the panel catches Click from every button inside (bubbling) --&gt;
        &lt;StackPanel Orientation="Horizontal" Margin="0,12,0,0"
                    ButtonBase.Click="AnyButton_Click"&gt;
            &lt;Button Content="+1" Tag="1" Width="60" Click="Change_Click" /&gt;
            &lt;Button Content="-1" Tag="-1" Width="60" Margin="8,0,0,0" Click="Change_Click" /&gt;
            &lt;!-- Reset is wired up in C# instead of XAML --&gt;
            &lt;Button x:Name="ResetButton" Content="Reset" Width="70" Margin="8,0,0,0" /&gt;
        &lt;/StackPanel&gt;
        &lt;StackPanel Orientation="Horizontal" Margin="0,12,0,0"&gt;
            &lt;TextBlock Text="Step:" VerticalAlignment="Center" Margin="0,0,8,0" /&gt;
            &lt;TextBox x:Name="StepBox" Text="1" Width="60" TextChanged="StepBox_TextChanged" /&gt;
        &lt;/StackPanel&gt;
        &lt;TextBlock x:Name="LastActionText" Text="Last action: none" Margin="0,12,0,0"
                   Foreground="Gray" /&gt;
        &lt;TextBlock Text="Tip: the Up and Down arrow keys work too." Margin="0,4,0,0"
                   Foreground="Gray" /&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
namespace ClickCounter;
public partial class MainWindow : Window
{
    private int _count;
    public MainWindow()
    {
        InitializeComponent();
        // Attach a handler in C#, after InitializeComponent
        ResetButton.Click += (s, e) =&gt;
        {
            _count = 0;
            ShowCount();
        };
    }
    // Shared by +1 and -1: Tag holds the direction, StepBox holds the size
    private void Change_Click(object sender, RoutedEventArgs e)
    {
        var button = (Button)sender;
        int direction = int.Parse((string)button.Tag);
        _count += direction * GetStep();
        ShowCount();
    }
    // Bubbling handler on the StackPanel. e.Source is the button that was clicked.
    private void AnyButton_Click(object sender, RoutedEventArgs e)
    {
        if (e.Source is Button button)
        {
            LastActionText.Text = $"Last action: {button.Content}";
        }
    }
    // Colour the box pink when the step is not a whole number
    private void StepBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        bool ok = int.TryParse(StepBox.Text, out _);
        StepBox.Background = ok ? Brushes.White : Brushes.MistyRose;
    }
    // Arrow keys change the count. Skip when typing in the step box.
    private void Window_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.OriginalSource is TextBox) return;
        if (e.Key == Key.Up) { _count += GetStep(); ShowCount(); }
        if (e.Key == Key.Down) { _count -= GetStep(); ShowCount(); }
    }
    private int GetStep() =&gt; int.TryParse(StepBox.Text, out int step) ? step : 1;
    private void ShowCount() =&gt; CountText.Text = $"Clicks: {_count}";
}
</code></pre>
