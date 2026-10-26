---
publishDate: 2026-10-25T20:02
title: 'Your First WPF App'
slug: your-first-wpf-app
metadescription: 'Create, run and change your first WPF app: a small greeting window with a text box and a button, built step by step with XAML and a few lines of C#.'
updateDate: 2026-10-25T20:02
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'xaml', 'beginners', 'first-app']
course: wpf
---

## What you will build

In this lesson you create a real WPF app from scratch. It is small on purpose: a window that asks for your name and says hello when you click a button.

```text
+----------------------------------+
| Greeter                     _ [] X|
|----------------------------------|
|  What is your name?              |
|  [ Bishal              ]         |
|  [ Say hello ]                   |
|                                  |
|  Hello, Bishal! Welcome to WPF.  |
+----------------------------------+
```

Along the way you will see the full loop every WPF developer goes through: create a project, describe the window in XAML, react to a click in C#, and run the app. Make sure you have finished [Setting Up Visual Studio and the .NET SDK](/courses/wpf/setting-up-visual-studio-and-the-dotnet-sdk) first.

## Step 1: Create the project

### With the command line

Open a terminal in your code folder and run:

```powershell
dotnet new wpf -n Greeter
cd Greeter
```

This creates a folder called `Greeter` with a ready to run WPF app inside.

### With Visual Studio

1. Choose **Create a new project**.
2. Search for **WPF Application** and pick the C# one. (Avoid "WPF App (.NET Framework)", which is the old Windows only .NET.)
3. Name it `Greeter` and click **Next**.
4. Pick **.NET 10.0 (Long Term Support)** and click **Create**.

Both ways give you the same files. You will look at each one in [Understanding the Project Structure](/courses/wpf/understanding-the-project-structure). For now, you only care about two of them: `MainWindow.xaml` and `MainWindow.xaml.cs`.

## Step 2: Run the empty app

Before changing anything, run it once:

```powershell
dotnet run
```

In Visual Studio, press **F5**. An empty window titled **MainWindow** opens. It already has a title bar, can be moved, resized, minimised and closed. WPF gives you all of that for free.

Close the window to stop the app.

## Step 3: Look at the starting XAML

Open `MainWindow.xaml`. It looks like this:

```xml
<Window x:Class="Greeter.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        xmlns:local="clr-namespace:Greeter"
        mc:Ignorable="d"
        Title="MainWindow" Height="450" Width="800">
    <Grid>

    </Grid>
</Window>
```

The `xmlns` lines at the top are **namespaces**. They tell WPF where to find words like `Window` and `Grid`. Leave them alone for now. They are explained in [XAML Namespaces and Markup Extensions](/courses/wpf/xaml-namespaces-and-markup-extensions).

The parts that matter today:

- `Title="MainWindow"` is the text in the title bar.
- `Height="450" Width="800"` is the starting size.
- `Grid` is an empty layout panel. Whatever you put inside it appears in the window.

## Step 4: Change the title and size

Change the last line of the `Window` tag so it reads:

```xml
Title="Greeter" Height="260" Width="400">
```

Run the app again. The window is smaller and the title bar says **Greeter**. You just changed your app by editing XAML.

## Step 5: Add controls

Now replace the empty `Grid` with this:

```xml
<StackPanel Margin="20">
    <TextBlock Text="What is your name?" FontSize="16" />
    <TextBox x:Name="NameBox" Margin="0,8,0,0" />
    <Button Content="Say hello" Margin="0,12,0,0"
            HorizontalAlignment="Left" Padding="12,4" />
    <TextBlock x:Name="GreetingText" Margin="0,16,0,0" FontSize="16" />
</StackPanel>
```

Here is what each piece does:

- `StackPanel` arranges its children in a column, one below the other. `Margin="20"` adds 20 units of space around it, so nothing touches the window edge.
- `TextBlock` shows read only text.
- `TextBox` is a box the user can type in.
- `Button` is a clickable button. `Content` is the text on it.
- `Margin="0,8,0,0"` means left 0, top 8, right 0, bottom 0. It pushes the control down a little.
- `x:Name="NameBox"` gives the control a name, so your C# code can talk to it.

Run the app. You can type in the box and click the button, but nothing happens yet. That is the next step.

## Step 6: Handle the click

A **click handler** is a C# method that runs when the user clicks a button. First, tell the button which method to call by adding a `Click` attribute:

```xml
<Button Content="Say hello" Margin="0,12,0,0"
        HorizontalAlignment="Left" Padding="12,4"
        Click="SayHello_Click" />
```

Now open `MainWindow.xaml.cs`. This is the **code-behind** file: the C# class that belongs to the window. Add a method below the constructor:

```csharp
private void SayHello_Click(object sender, RoutedEventArgs e)
{
    string name = NameBox.Text.Trim();

    if (name.Length == 0)
    {
        GreetingText.Text = "Please type your name first.";
        return;
    }

    GreetingText.Text = $"Hello, {name}! Welcome to WPF.";
}
```

Let us read it slowly:

- The method name `SayHello_Click` matches the `Click="SayHello_Click"` in XAML exactly. That is how WPF links the two.
- `sender` is the control that raised the event (the button). `e` holds extra details. You do not need either yet.
- `NameBox.Text` reads what the user typed. You can use `NameBox` here because you gave it `x:Name="NameBox"` in XAML.
- `GreetingText.Text = ...` changes the text of the second `TextBlock`.

Run the app, type your name and click **Say hello**. Your first working WPF app is done.

You will learn much more about events in [Code-Behind and Event Handlers](/courses/wpf/code-behind-and-event-handlers). If C# events are new to you, the [events](/courses/c-sharp/events) lesson in the C# course explains the idea behind them.

## Step 7: Small improvements

Two little changes make the app feel nicer.

### Press Enter to click

Set `IsDefault="True"` on the button. Now pressing **Enter** anywhere in the window clicks it:

```xml
<Button Content="Say hello" IsDefault="True" ... />
```

### Start with the cursor in the text box

Use `FocusManager.FocusedElement` on the window so the text box has keyboard focus when the app opens:

```xml
<Window ...
        FocusManager.FocusedElement="{Binding ElementName=NameBox}">
```

The curly braces are a **markup extension**, a special XAML shortcut. You will meet them properly in a later lesson. For now, just know it points at the control named `NameBox`.

## Hot Reload: change things while the app runs

Visual Studio has **XAML Hot Reload**. Start the app with **F5**, then change a `Text` or `FontSize` in `MainWindow.xaml` and save. The running window updates right away, without a restart. This makes trying out layouts much faster.

From the command line you can get a similar effect for C# changes with:

```powershell
dotnet watch
```

## Common mistakes

- **The name in `Click` and the method name do not match.** The build fails with an error saying the window does not contain a definition for the method. Check the spelling and capital letters.
- **Forgetting `x:Name`.** Without it, `NameBox` does not exist in C#, and you get "the name NameBox does not exist in the current context".
- **Putting two children directly inside `Window`.** A `Window` can hold only one child. That is why we use a `StackPanel` to hold the others.
- **Editing while the app is running from the command line.** The build may fail because the `.exe` file is in use. Close the window first.

## Try it yourself

- Change the greeting to also show the time with `DateTime.Now.ToShortTimeString()`.
- Add a second button called **Clear** that empties both the text box and the greeting.
- Change the `FontSize` and `Foreground` of the greeting, for example `Foreground="DarkGreen"`.

## Quick recap

- `dotnet new wpf -n Greeter` (or **WPF Application** in Visual Studio) creates a working app.
- `MainWindow.xaml` describes the window, and `MainWindow.xaml.cs` holds its C# code.
- `StackPanel`, `TextBlock`, `TextBox` and `Button` are enough for a simple form.
- `x:Name` lets C# reach a control, and `Click="MethodName"` connects a button to a method.
- `dotnet run` or **F5** starts the app, and XAML Hot Reload updates it while it runs.
- Next, look at every generated file in [Understanding the Project Structure](/courses/wpf/understanding-the-project-structure).

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="Greeter.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Greeter" Height="260" Width="400"
        FocusManager.FocusedElement="{Binding ElementName=NameBox}"&gt;
    &lt;!-- A Window holds one child, so a StackPanel holds the rest --&gt;
    &lt;StackPanel Margin="20"&gt;
        &lt;TextBlock Text="What is your name?" FontSize="16" /&gt;
        &lt;!-- x:Name makes this TextBox reachable from C# as NameBox --&gt;
        &lt;TextBox x:Name="NameBox" Margin="0,8,0,0" /&gt;
        &lt;!-- Click names the C# method to run. IsDefault: Enter clicks it --&gt;
        &lt;Button Content="Say hello" Margin="0,12,0,0"
                HorizontalAlignment="Left" Padding="12,4"
                IsDefault="True" Click="SayHello_Click" /&gt;
        &lt;Button Content="Clear" Margin="0,8,0,0"
                HorizontalAlignment="Left" Padding="12,4"
                Click="Clear_Click" /&gt;
        &lt;!-- The greeting appears here --&gt;
        &lt;TextBlock x:Name="GreetingText" Margin="0,16,0,0" FontSize="16"
                   Foreground="DarkGreen" TextWrapping="Wrap" /&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
namespace Greeter;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        // Builds the controls described in MainWindow.xaml
        InitializeComponent();
    }
    // Runs when "Say hello" is clicked (or Enter is pressed)
    private void SayHello_Click(object sender, RoutedEventArgs e)
    {
        string name = NameBox.Text.Trim();
        if (name.Length == 0)
        {
            GreetingText.Text = "Please type your name first.";
            return;
        }
        GreetingText.Text = $"Hello, {name}! Welcome to WPF. It is {DateTime.Now.ToShortTimeString()}.";
    }
    // Runs when "Clear" is clicked
    private void Clear_Click(object sender, RoutedEventArgs e)
    {
        NameBox.Text = "";
        GreetingText.Text = "";
        NameBox.Focus(); // put the cursor back in the box
    }
}
</code></pre>
