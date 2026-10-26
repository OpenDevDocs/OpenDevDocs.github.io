---
publishDate: 2026-10-25T20:00
title: 'What is WPF'
slug: what-is-wpf
metadescription: 'Learn what WPF is, why people still use it to build Windows desktop apps, how it compares with WinForms, WinUI 3, MAUI and Avalonia, and what you will build in this course.'
updateDate: 2026-10-25T20:00
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'desktop', 'dotnet', 'beginners']
course: wpf
---

## What WPF is

**WPF** stands for **Windows Presentation Foundation**. It is a free framework from Microsoft for building desktop apps that run on Windows. A **framework** is a big set of ready made code that you build on top of, so you do not start from zero.

With WPF you can make the kind of programs you double click on your PC: a notes app, a small shop's billing tool, a photo organiser, a settings panel for some hardware. The app opens in its own window, with buttons, text boxes, lists and menus.

WPF is part of **.NET**, the same platform you use when you write C#. If you already know some C#, you already know half of what you need. The other half is learning how WPF describes and draws the screen.

## The two halves of a WPF app

Every WPF window is made of two parts that work together:

1. **XAML** (say it "zammel"). This is a markup language, a bit like HTML. You use it to describe what the window looks like: which controls are on it, where they sit, and what colour they are.
2. **C#**. This is the code that runs when something happens, for example when the user clicks a button.

Here is a tiny window described in XAML:

```xml
<Window x:Class="HelloApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Hello" Height="200" Width="300">
    <StackPanel Margin="20">
        <TextBlock Text="Hello from WPF!" FontSize="20" />
        <Button Content="Click me" Margin="0,10,0,0" />
    </StackPanel>
</Window>
```

Read it from the top. There is a `Window` with a title and a size. Inside it is a `StackPanel`, which stacks things on top of each other. Inside that is a `TextBlock` (a piece of text) and a `Button`. You do not need to understand every word yet. The point is that the layout reads like a tidy outline of the screen.

And here is the C# side that could react to the button:

```csharp
private void OnClick(object sender, RoutedEventArgs e)
{
    MessageBox.Show("You clicked the button.");
}
```

Splitting the look (XAML) from the behaviour (C#) is one of the big ideas in WPF. Designers can work on the XAML while developers work on the code, and both stay easy to read.

## Why WPF is still worth learning

WPF first shipped in 2006, so you may wonder why anyone would learn it today. There are some good reasons:

- **It is mature.** Twenty years of bug fixes, books, blog posts and answers online. Almost any problem you hit has been solved before.
- **It is still maintained.** WPF runs on modern .NET (this course uses .NET 10) and Microsoft keeps adding things, such as the newer Fluent theme that makes apps look like Windows 11.
- **It is powerful.** Data binding, styles, templates and animations are built in. You can change how any control looks without writing a new control.
- **Lots of companies use it.** Banks, hospitals, factories and many in house business tools are written in WPF. Knowing it can get you a job maintaining or extending those apps.
- **It teaches good habits.** The patterns you learn here, like **MVVM** (a way to keep screen code and logic apart), are used in many other UI frameworks too.

## How WPF draws the screen

Older Windows frameworks asked Windows itself to draw each button. WPF does its own drawing using **DirectX**, the graphics system games use. Two nice things come from that:

- **It scales cleanly.** WPF measures things in **device independent units** (1/96 of an inch) instead of raw pixels, so your window looks sharp on a normal screen and on a high resolution laptop.
- **Everything can be styled.** Because WPF draws every control itself, you can round the corners of a button, give a list a gradient background or animate a panel sliding in.

You do not need to know DirectX at all. WPF handles that part for you.

## WPF compared with other options

Microsoft and the wider .NET world offer several ways to build desktop apps. Here is a plain comparison so you know where WPF fits.

| Framework | Runs on | Describes UI with | In one sentence |
| --- | --- | --- | --- |
| WinForms | Windows | C# code and a drag and drop designer | The oldest and simplest. Great for quick tools, harder to make pretty. |
| WPF | Windows | XAML + C# | Mature, flexible and very well documented. The focus of this course. |
| WinUI 3 | Windows 10 and 11 | XAML + C# | Microsoft's newest Windows UI with the modern look, but younger and smaller in community size. |
| .NET MAUI | Windows, macOS, Android, iOS | XAML + C# | One code base for phones and desktops, aimed mostly at mobile. |
| Avalonia | Windows, macOS, Linux, web and more | XAML + C# | A community project that feels a lot like WPF but runs on many systems. |

A few notes in plain words:

- **WinForms** is like building with ready made bricks. It is fast to start, but changing how a brick looks is hard. WPF lets you reshape the bricks.
- **WinUI 3** and WPF look alike on the surface because both use XAML. WinUI 3 is newer, while WPF has more learning material and third party controls.
- **MAUI** is the pick when you need the same app on a phone. For a Windows only desktop tool it is usually more than you need.
- **Avalonia** is the pick when you need Linux or macOS. Its XAML is so close to WPF that much of what you learn here carries over.

The good news: XAML, data binding and MVVM appear in WPF, WinUI 3, MAUI and Avalonia. Learning WPF well makes all of them easier later.

## What WPF is not good at

To be fair, WPF has limits:

- It only runs on **Windows**. A WPF app will not open on a Mac or on Linux.
- It is not for websites. For that you would use something like [ASP.NET Core MVC](/courses/dotnet-mvc/what-is-aspnet-core-mvc) or a JavaScript framework.
- The learning curve is a little steeper than WinForms, because XAML and binding are new ideas. This course goes slowly to make that easier.

## Words you will meet

Here are a few words that come up again and again. Do not worry about memorising them now.

```text
Window      A top level window, the frame with the title bar.
Control     Anything the user can see or use: Button, TextBox, ListBox ...
Panel       A control whose job is to arrange other controls (Grid, StackPanel).
XAML        The markup language that describes the UI.
Code-behind The C# file that sits next to a XAML file.
Binding     A live link between a control and a piece of data.
MVVM        Model, View, ViewModel. A pattern for organising a WPF app.
```

## What you will build: CoinJar

Learning is easier with a goal, so this course builds one app step by step. It is called **CoinJar**, a small personal expense tracker. Think of a jar where you drop a coin every time you spend money, except this jar remembers what each coin was for.

By the end, CoinJar will:

- Show a list of your expenses, each with a title, an amount, a category and a date.
- Show the total you have spent.
- Let you add, edit and delete expenses with a simple form.
- Filter the list by category: Food, Transport, Bills, Fun and Other.
- Save your data so it is still there next time you open the app.
- Support light and dark themes.

In C#, one expense will look something like this:

```csharp
public class Expense
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public decimal Amount { get; set; }
    public string Category { get; set; } = "Other";
    public DateTime Date { get; set; }
}
```

If properties like `{ get; set; }` look unfamiliar, have a quick look at [fields and properties](/courses/c-sharp/fields-and-properties) and [classes and objects](/courses/c-sharp/classes-and-objects) in the C# course first.

The early lessons use tiny practice apps, such as a greeting window or a click counter, so that each new idea stays small. From [Data Binding Basics](/courses/wpf/data-binding-basics) onward, the pieces start fitting together into CoinJar. The last lesson, [Building a Complete Expense Tracker](/courses/wpf/building-a-complete-expense-tracker), puts everything into one finished app.

## How this course is organised

The lessons go in this order:

1. **Getting started.** Install the tools and run your first window.
2. **XAML basics.** Learn the markup and how it links to C#.
3. **Layout and controls.** Place buttons, text boxes and lists on the screen.
4. **Data binding.** Connect the screen to your data so it updates by itself.
5. **Styles and themes.** Make the app look good.
6. **MVVM.** Organise the code the way real WPF apps do.
7. **Real app features.** Saving data, threading, testing and publishing.

Each lesson has a code panel at the end with a full, copyable example. Type it out or paste it into your own project and run it. Changing the example and seeing what happens is the fastest way to learn.

## Tips before you start

- **Know basic C#.** Variables, `if` statements, methods and classes are enough to begin. The [C# course](/courses/c-sharp/introduction-to-csharp-and-dotnet) covers them if you need a refresher.
- **Use Windows.** You need a Windows PC to run WPF apps. A Windows virtual machine works too.
- **Go slowly.** It is normal for XAML to feel strange for the first few lessons. It clicks after you have written a few windows.
- **Experiment.** Change a colour, add a button, break something on purpose and read the error. That is how the ideas stick.

## Quick recap

- WPF (Windows Presentation Foundation) is Microsoft's framework for building Windows desktop apps with .NET.
- A WPF window has two halves: XAML for the look and C# for the behaviour.
- WPF draws everything itself, so it scales well and every control can be restyled.
- WinForms is simpler, WinUI 3 is newer, MAUI targets phones, and Avalonia runs on other systems. WPF is the mature, well documented Windows choice.
- XAML, binding and MVVM skills from WPF carry over to the other XAML frameworks.
- Throughout the course you will build CoinJar, a personal expense tracker.
- Next, you will install the tools in [Setting Up Visual Studio and the .NET SDK](/courses/wpf/setting-up-visual-studio-and-the-dotnet-sdk).

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;!-- A first look at a WPF window. You will create this project yourself in lesson 3. --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Height="300" Width="420"&gt;
    &lt;!-- StackPanel puts its children one under the other --&gt;
    &lt;StackPanel Margin="24"&gt;
        &lt;!-- A heading --&gt;
        &lt;TextBlock Text="Welcome to CoinJar" FontSize="24" FontWeight="SemiBold" /&gt;
        &lt;!-- A short description --&gt;
        &lt;TextBlock Text="Your personal expense tracker, built with WPF."
                   Margin="0,8,0,16" TextWrapping="Wrap" /&gt;
        &lt;!-- The user will type an expense title here in later lessons --&gt;
        &lt;TextBox Width="250" HorizontalAlignment="Left" /&gt;
        &lt;!-- A button. Later it will add the expense to a list --&gt;
        &lt;Button Content="Add expense" Width="120" Margin="0,12,0,0"
                HorizontalAlignment="Left" /&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
</code></pre>
