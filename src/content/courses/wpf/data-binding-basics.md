---
publishDate: 2026-10-25T20:21
title: 'Data Binding Basics'
slug: data-binding-basics
metadescription: 'Learn what data binding is, how to bind one control to another with ElementName, how DataContext connects a window to a C# object, and how to format and debug bindings in the CoinJar app.'
updateDate: 2026-10-25T20:21
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'data-binding', 'datacontext', 'xaml']
course: wpf
---

## The copy and paste problem

So far, every lesson moved data by hand. To show a value, you wrote `TitleText.Text = expense.Title;`. To read what the user typed, you wrote `expense.Title = TitleBox.Text;`. Every field needs two lines like that, and you must remember to call them at the right moments.

With five fields that is annoying. With fifty, bugs creep in: a label that shows an old value, a field you forgot to save.

**Data binding** fixes this. A **binding** is a live connection between a property on a control and a property on some other object. You describe the connection once in XAML, and WPF keeps both sides in step for you.

Think of it like a phone call that stays open, instead of sending letters back and forth.

From this lesson on, we build **CoinJar** properly: a small personal expense tracker. Today you will bind a form to one `Expense` object.

## The two ends of a binding

Every binding has two ends:

- The **target** is the control property that shows the value, for example `TextBox.Text`.
- The **source** is where the value comes from, for example the `Title` property of an `Expense` object.

```text
 Target (on the control)            Source (your data)
 TextBox.Text       <=========>     expense.Title
```

There is one rule for the target: it must be a **dependency property**. A dependency property is a special kind of WPF property that supports binding, styles and animation. Almost every property you set in XAML (`Text`, `Content`, `Width`, `IsChecked`, `Value`) is one, so in practice you rarely need to think about it. You will make your own in [Dependency Properties](/courses/wpf/dependency-properties).

The source can be an ordinary public C# property. Fields do not work, only properties, so `public string Title { get; set; }` is fine but `public string Title;` is not. If that difference is fuzzy, read [fields and properties](/courses/c-sharp/fields-and-properties).

## Your first binding: control to control

The simplest binding connects two controls. Here a `TextBlock` shows the value of a `Slider`:

```xml
<StackPanel Margin="16">
    <Slider x:Name="BudgetSlider" Minimum="0" Maximum="1000" Value="250" />
    <TextBlock Text="{Binding ElementName=BudgetSlider, Path=Value}" />
</StackPanel>
```

Drag the slider and the number changes at once. There is no C# code at all.

Read the binding like a sentence: "set `Text` to the `Value` of the element named `BudgetSlider`".

- The curly braces `{ }` mean "this is a **markup extension**", a small instruction instead of a plain value. You met these in [XAML Namespaces and Markup Extensions](/courses/wpf/xaml-namespaces-and-markup-extensions).
- `ElementName` picks the source element by its `x:Name`.
- `Path` names the property to read on that source.

`Path` is so common that you can leave out the word. These two lines mean the same thing:

```xml
<TextBlock Text="{Binding Path=Value, ElementName=BudgetSlider}" />
<TextBlock Text="{Binding Value, ElementName=BudgetSlider}" />
```

Control to control bindings are great for small UI tricks: a checkbox that enables a panel, or a slider that sets a font size.

```xml
<CheckBox x:Name="NotesCheck" Content="Add notes" />
<TextBox IsEnabled="{Binding IsChecked, ElementName=NotesCheck}" />
```

## Binding to your own object

Real apps bind to data, not to other controls. Let us make the CoinJar model. Add a `Models` folder and this class:

```csharp
namespace CoinJar.Models;

public class Expense
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public decimal Amount { get; set; }
    public string Category { get; set; } = "Other";
    public DateTime Date { get; set; } = DateTime.Today;
}
```

Now we need a way to tell the window "this `Expense` is your source". That is what `DataContext` does.

## DataContext: the default source

`DataContext` is a property that every element has. It holds the object that bindings use when you do not name a source yourself.

Set it in the window's code-behind:

```csharp
using System.Windows;
using CoinJar.Models;

namespace CoinJar;

public partial class MainWindow : Window
{
    private readonly Expense _expense = new()
    {
        Id = 1,
        Title = "Lunch",
        Amount = 8.50m,
        Category = "Food"
    };

    public MainWindow()
    {
        InitializeComponent();
        DataContext = _expense;
    }
}
```

Then bind with just a path. No `ElementName` this time:

```xml
<StackPanel Margin="16">
    <TextBox Text="{Binding Title}" />
    <TextBox Text="{Binding Amount}" />
    <TextBox Text="{Binding Category}" />
    <DatePicker SelectedDate="{Binding Date}" />
</StackPanel>
```

Run it and the form is filled with "Lunch", "8.50" and "Food" without a single `TitleBox.Text = ...` line.

### DataContext flows down the tree

You set `DataContext` once on the window, but the `TextBox` elements deep inside the `StackPanel` can use it. That is because `DataContext` is **inherited**: if an element has no `DataContext` of its own, it uses its parent's, and so on up the tree. You can picture the window handing the same object down to every child.

You can also give one part of the window a different source:

```xml
<StackPanel>
    <!-- Uses the window's DataContext -->
    <TextBlock Text="{Binding Title}" />

    <!-- This border and everything inside it use the Date object instead -->
    <Border DataContext="{Binding Date}">
        <TextBlock Text="{Binding Year}" />
    </Border>
</StackPanel>
```

Inside the `Border`, `{Binding Year}` reads `Date.Year`. You can also write the same thing directly with a dotted path: `{Binding Date.Year}`.

### Typing in the form changes the object

`TextBox.Text` bindings work both ways by default. When the user types "Dinner" into the title box and moves to the next field, WPF writes "Dinner" back into `_expense.Title`. You can prove it with a button:

```csharp
private void Show_Click(object sender, RoutedEventArgs e)
{
    MessageBox.Show($"{_expense.Title} costs {_expense.Amount}");
}
```

WPF even converts the text "12.75" into the `decimal` 12.75 for you. If the user types "abc" into the amount box, the conversion fails, WPF draws a red border around the box and leaves the old value in the object. You will make this friendlier in [Input Validation](/courses/wpf/input-validation).

## Formatting with StringFormat

Bindings can format the value before showing it. `StringFormat` uses the same codes as `string.Format` in C#:

```xml
<!-- Money: 8.5 shows as $8.50 -->
<TextBlock Text="{Binding Amount, StringFormat=C}" />

<!-- Dates: shows 25 Oct 2026 -->
<TextBlock Text="{Binding Date, StringFormat='d MMM yyyy'}" />

<!-- Your own text around the value -->
<TextBlock Text="{Binding Amount, StringFormat='Total: {0:C}'}" />
```

The last one uses `{0:C}` as a placeholder for the value. Wrap a format that contains spaces or extra text in single quotes, as shown. When the format starts with `{0}`, add an empty `{}` at the front so XAML does not mistake it for a markup extension: `StringFormat={}{0:C} spent`.

### A culture surprise

Here is something that catches nearly everyone. A **culture** is the set of rules for showing numbers, money and dates in a country, such as `en-GB` or `de-DE`. You might expect `StringFormat=C` to follow the user's Windows settings. It does not: by default, WPF bindings use `en-US`, so everyone sees dollars.

The usual fix is a few lines at startup in `App.xaml.cs`:

```csharp
using System.Globalization;
using System.Windows;
using System.Windows.Markup;

namespace CoinJar;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        // Make bindings use the user's Windows culture for numbers and dates
        FrameworkElement.LanguageProperty.OverrideMetadata(
            typeof(FrameworkElement),
            new FrameworkPropertyMetadata(
                XmlLanguage.GetLanguage(CultureInfo.CurrentCulture.IetfLanguageTag)));

        base.OnStartup(e);
    }
}
```

Now a user in the UK sees £8.50 and a user in Germany sees 8,50 €. You will go deeper in [Accessibility and Localization](/courses/wpf/accessibility-and-localization).

## Creating a binding in C#

Almost all bindings live in XAML, but you can build one in code. It helps to see that a binding is just an object:

```csharp
using System.Windows.Controls;
using System.Windows.Data;

var binding = new Binding("Title");          // the Path
TitleBox.SetBinding(TextBox.TextProperty, binding);
```

`TextBox.TextProperty` is the dependency property behind `Text`. Use code bindings only when the path is not known until the app runs.

## When a binding goes wrong

A broken binding does not crash the app. It just shows nothing. That is kind to users but confusing for you.

When you run the app from Visual Studio, look at the **Output** window. A typo such as `{Binding Titel}` produces a line like this:

```text
System.Windows.Data Error: 40 : BindingExpression path error:
'Titel' property not found on 'object' ''Expense' (HashCode=...)'.
```

Newer Visual Studio versions also have a **XAML Binding Failures** window that lists these errors in a table. Check it whenever a value is mysteriously blank.

## The one thing that does not work yet

Add a button that changes the object from code:

```csharp
private void Discount_Click(object sender, RoutedEventArgs e)
{
    _expense.Amount = _expense.Amount * 0.9m; // 10 percent off
}
```

Click it. The amount on screen does not change. Click "Show" and the message box says the new amount. The object changed, but nobody told the screen.

WPF has no way to notice that a plain property changed. The object must announce it. That announcement is called `INotifyPropertyChanged`, and it is the subject of [INotifyPropertyChanged](/courses/wpf/inotifypropertychanged). First, in [Binding Modes and Update Triggers](/courses/wpf/binding-modes-and-update-triggers), you will learn exactly which way data flows and when.

## Common mistakes

- **Binding to a field.** `public string Title;` never shows. Make it a property.
- **Forgetting `DataContext`.** Every `{Binding Title}` is blank and the Output window says the source is null. Set `DataContext` after `InitializeComponent()`.
- **Spelling the path wrong.** Paths are not checked when you build. Look in the Output window.
- **Expecting code changes to appear.** Plain classes do not notify the UI. That needs `INotifyPropertyChanged`.
- **Forgetting the `{}` escape.** `StringFormat={0:C}` alone confuses the XAML parser. Write `StringFormat={}{0:C}` or simply `StringFormat=C`.

## Quick recap

- A binding links a **target** (a control's dependency property) to a **source** property, and WPF keeps them in step.
- `{Binding Value, ElementName=BudgetSlider}` binds one control to another.
- `DataContext` sets the default source. It is inherited by every child element.
- Source properties must be public properties, not fields.
- `TextBox.Text` bindings write typed text back to the object and convert it to the property's type.
- `StringFormat` formats values. Fix the `en-US` default culture at startup if your users are elsewhere.
- Broken bindings fail quietly. Check the Output window or the XAML Binding Failures window.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar: edit expense" Width="420" Height="440"&gt;
    &lt;!-- DataContext is set to an Expense in MainWindow.xaml.cs --&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;TextBlock Text="Title" /&gt;
        &lt;TextBox Text="{Binding Title}" /&gt;
        &lt;TextBlock Text="Amount" Margin="0,8,0,0" /&gt;
        &lt;TextBox Text="{Binding Amount}" /&gt;
        &lt;TextBlock Text="Category" Margin="0,8,0,0" /&gt;
        &lt;TextBox Text="{Binding Category}" /&gt;
        &lt;TextBlock Text="Date" Margin="0,8,0,0" /&gt;
        &lt;DatePicker SelectedDate="{Binding Date}" /&gt;
        &lt;!-- Read only summary with formatting --&gt;
        &lt;Border Background="WhiteSmoke" Padding="8" Margin="0,12,0,0"&gt;
            &lt;StackPanel&gt;
                &lt;TextBlock Text="{Binding Amount, StringFormat='Amount: {0:C}'}" /&gt;
                &lt;TextBlock Text="{Binding Date, StringFormat='Date: {0:d MMM yyyy}'}" /&gt;
                &lt;TextBlock Text="{Binding Date.DayOfWeek}" Foreground="Gray" /&gt;
            &lt;/StackPanel&gt;
        &lt;/Border&gt;
        &lt;!-- Control to control binding: no C# needed --&gt;
        &lt;CheckBox x:Name="BudgetCheck" Content="Set a monthly budget" Margin="0,12,0,0" /&gt;
        &lt;Slider x:Name="BudgetSlider" Minimum="0" Maximum="1000" Value="250"
                IsEnabled="{Binding IsChecked, ElementName=BudgetCheck}" /&gt;
        &lt;TextBlock Text="{Binding Value, ElementName=BudgetSlider, StringFormat='Budget: {0:C0}'}" /&gt;
        &lt;StackPanel Orientation="Horizontal" Margin="0,12,0,0"&gt;
            &lt;Button Content="Show object" Click="Show_Click" Padding="10,4" /&gt;
            &lt;Button Content="10% discount" Click="Discount_Click" Padding="10,4" Margin="8,0,0,0" /&gt;
        &lt;/StackPanel&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using CoinJar.Models;
namespace CoinJar;
public partial class MainWindow : Window
{
    private readonly Expense _expense = new()
    {
        Id = 1,
        Title = "Lunch",
        Amount = 8.50m,
        Category = "Food",
        Date = DateTime.Today
    };
    public MainWindow()
    {
        InitializeComponent();
        // Every {Binding ...} without a source now reads from _expense
        DataContext = _expense;
    }
    private void Show_Click(object sender, RoutedEventArgs e)
    {
        // Proves that typing in the form updated the object
        MessageBox.Show($"{_expense.Title} costs {_expense.Amount} ({_expense.Category})");
    }
    private void Discount_Click(object sender, RoutedEventArgs e)
    {
        // The object changes, but the screen does not update yet.
        // INotifyPropertyChanged (two lessons ahead) fixes this.
        _expense.Amount = Math.Round(_expense.Amount * 0.9m, 2);
    }
}
// Models/Expense.cs
namespace CoinJar.Models;
public class Expense
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public decimal Amount { get; set; }
    public string Category { get; set; } = "Other";
    public DateTime Date { get; set; } = DateTime.Today;
}
</code></pre>
