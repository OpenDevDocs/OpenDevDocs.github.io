---
publishDate: 2026-10-25T20:45
title: 'Attached Properties and Behaviors'
slug: attached-properties-and-behaviors
metadescription: 'Learn how attached properties work, how to write your own, and how to add reusable behaviors to WPF controls with Microsoft.Xaml.Behaviors.Wpf.'
updateDate: 2026-10-25T20:45
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'xaml', 'attached-properties', 'behaviors', 'mvvm']
course: wpf
---

## What attached properties are

You have used attached properties since your first layout. Look at this XAML:

```xml
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition Height="Auto" />
        <RowDefinition Height="*" />
    </Grid.RowDefinitions>

    <TextBlock Grid.Row="0" Text="Expenses" />
    <ListBox Grid.Row="1" />
</Grid>
```

`TextBlock` has no `Row` property. Neither does `ListBox`. The `Row` property belongs to `Grid`, but you set it on the children. That is an **attached property**: a property that one class defines and other objects carry. It is like a sticky note that the `Grid` gives to each child, saying "you go in row 1". The child does not care what the note says. The `Grid` reads it during layout.

Other attached properties you already know:

```xml
<Button DockPanel.Dock="Top" Content="Add" />
<Ellipse Canvas.Left="40" Canvas.Top="20" Width="10" Height="10" />
<TextBox ToolTipService.ShowDuration="5000" ToolTip="Amount in your currency" />
<Button AutomationProperties.Name="Add expense" Content="+" />
```

The pattern is always `OwnerClass.PropertyName="value"`.

Attached properties are built on the same system as the [dependency properties](/courses/wpf/dependency-properties) from the last lesson. The difference is who defines them and who uses them.

## Why write your own

Attached properties are not only for panels. They are one of the best tricks in WPF for adding a small feature to a control **without** subclassing it and **without** code-behind.

Say you want every amount box in CoinJar to select its text when it gets focus, so the user can type a new number straight away. You could handle `GotFocus` in the code-behind of every window. Or you could write this once:

```xml
<TextBox Text="{Binding Amount}"
         behaviors:TextBoxHelper.SelectAllOnFocus="True" />
```

and reuse it everywhere, even from a style. Code that hooks into a control's events through an attached property is often called an **attached behavior**.

## Writing an attached property, step by step

Attached properties usually live in a small static class. Create a `Behaviors` folder and add `TextBoxHelper.cs`.

### Step 1: register it

```csharp
using System.Windows;

namespace CoinJar.Behaviors;

public static class TextBoxHelper
{
    public static readonly DependencyProperty SelectAllOnFocusProperty =
        DependencyProperty.RegisterAttached(
            "SelectAllOnFocus",        // the name you write in XAML
            typeof(bool),              // the type of value
            typeof(TextBoxHelper),     // the owner class (this one)
            new PropertyMetadata(false, OnSelectAllOnFocusChanged));
}
```

It looks almost like `DependencyProperty.Register`, but you call `RegisterAttached`. The field name must be the property name plus `Property`.

### Step 2: add the Get and Set methods

An attached property has no normal C# property wrapper, because the value is stored on someone else's object. Instead you write two static methods:

```csharp
public static bool GetSelectAllOnFocus(DependencyObject element) =>
    (bool)element.GetValue(SelectAllOnFocusProperty);

public static void SetSelectAllOnFocus(DependencyObject element, bool value) =>
    element.SetValue(SelectAllOnFocusProperty, value);
```

The names must be exactly `Get` + name and `Set` + name. The XAML parser looks for them. If you misspell one, XAML says the property does not exist.

### Step 3: react when the value changes

The changed callback is where the behavior lives. When someone sets the value to `True`, you subscribe to the control's [events](/courses/c-sharp/events). When it goes back to `False`, you unsubscribe.

```csharp
private static void OnSelectAllOnFocusChanged(
    DependencyObject d, DependencyPropertyChangedEventArgs e)
{
    if (d is not TextBox textBox) return;   // only works on text boxes

    if ((bool)e.NewValue)
    {
        textBox.GotKeyboardFocus += OnGotKeyboardFocus;
    }
    else
    {
        textBox.GotKeyboardFocus -= OnGotKeyboardFocus;
    }
}

private static void OnGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
{
    ((TextBox)sender).SelectAll();
}
```

The full version in the code panel also handles a mouse click, because clicking into a `TextBox` normally places the cursor and clears the selection right after focus arrives.

### Step 4: use it in XAML

Map the namespace and set the property:

```xml
<Window ...
        xmlns:behaviors="clr-namespace:CoinJar.Behaviors">

    <TextBox Text="{Binding Amount}"
             behaviors:TextBoxHelper.SelectAllOnFocus="True" />
</Window>
```

### Attached properties work in styles

This is the big win. Because an attached property is a real dependency property, a style setter can set it. One setter gives the feature to every `TextBox` in the window:

```xml
<Window.Resources>
    <Style TargetType="TextBox">
        <Setter Property="behaviors:TextBoxHelper.SelectAllOnFocus" Value="True" />
    </Style>
</Window.Resources>
```

Put that style in `App.xaml` and the whole app gets it. You learned about this kind of shared style in [Styles and Setters](/courses/wpf/styles-and-setters).

## An attached property that holds a command

Attached properties can hold any type, including `ICommand`. That lets a view model react to something the control does not expose as a command. Here is one that runs a command when the user presses Enter:

```csharp
public static class EnterKeyCommand
{
    public static readonly DependencyProperty CommandProperty =
        DependencyProperty.RegisterAttached(
            "Command", typeof(ICommand), typeof(EnterKeyCommand),
            new PropertyMetadata(null, OnCommandChanged));

    public static ICommand? GetCommand(DependencyObject element) =>
        (ICommand?)element.GetValue(CommandProperty);

    public static void SetCommand(DependencyObject element, ICommand? value) =>
        element.SetValue(CommandProperty, value);

    private static void OnCommandChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not UIElement element) return;
        element.KeyDown -= OnKeyDown;            // never subscribe twice
        if (e.NewValue is not null) element.KeyDown += OnKeyDown;
    }

    private static void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter) return;
        ICommand? command = GetCommand((DependencyObject)sender);
        if (command?.CanExecute(null) == true)
        {
            command.Execute(null);
            e.Handled = true;
        }
    }
}
```

Now the quick add box in CoinJar can add an expense on Enter, and the logic stays in the view model from [MVVM with CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm):

```xml
<TextBox Text="{Binding NewTitle, UpdateSourceTrigger=PropertyChanged}"
         behaviors:EnterKeyCommand.Command="{Binding AddCommand}" />
```

## Behaviors with Microsoft.Xaml.Behaviors.Wpf

Writing static classes for every small feature gets repetitive. Microsoft publishes a library that gives you a cleaner shape for the same idea. It is the open source successor of the old Blend SDK "Interactivity" library.

Install it:

```bash
dotnet add package Microsoft.Xaml.Behaviors.Wpf
```

At the time of writing that installs version 1.1.161. Then map its XAML namespace:

```xml
xmlns:b="http://schemas.microsoft.com/xaml/behaviors"
```

The library gives you two main tools: **behaviors** and **triggers with actions**.

### Writing a behavior class

A **behavior** is a class that attaches to one control and adds something to it. You inherit from `Behavior<T>`, where `T` is the control type. The library gives you:

- `AssociatedObject`: the control you are attached to, already typed as `T`.
- `OnAttached()`: runs when the behavior is attached. Subscribe to events here.
- `OnDetaching()`: runs when it is removed. Unsubscribe here.

```csharp
using System.Windows.Controls;
using System.Windows.Input;
using Microsoft.Xaml.Behaviors;

namespace CoinJar.Behaviors;

public class SelectAllOnFocusBehavior : Behavior<TextBox>
{
    protected override void OnAttached()
    {
        base.OnAttached();
        AssociatedObject.GotKeyboardFocus += OnGotKeyboardFocus;
    }

    protected override void OnDetaching()
    {
        AssociatedObject.GotKeyboardFocus -= OnGotKeyboardFocus;
        base.OnDetaching();
    }

    private void OnGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        AssociatedObject.SelectAll();
    }
}
```

Compare it with `TextBoxHelper`. There is no registration code, no `Get` and `Set` methods and no type check, because `T` already says it is a `TextBox`. The behavior is also an instance, so it can keep its own fields.

You attach it with `Interaction.Behaviors`:

```xml
<TextBox Text="{Binding Amount}">
    <b:Interaction.Behaviors>
        <behaviors:SelectAllOnFocusBehavior />
    </b:Interaction.Behaviors>
</TextBox>
```

### Turning any event into a command

The most common use of the library has nothing to do with writing behaviors. It is `EventTrigger` with `InvokeCommandAction`, which turns **any** event into a command call. Many controls do not have a `Command` property: a `ListBox` double click, a window `Loaded` event, a `SelectionChanged`. Without this you would need code-behind.

In CoinJar, double clicking an expense should open it for editing:

```xml
<ListBox ItemsSource="{Binding Expenses}"
         SelectedItem="{Binding SelectedExpense}"
         DisplayMemberPath="Title">
    <b:Interaction.Triggers>
        <b:EventTrigger EventName="MouseDoubleClick">
            <b:InvokeCommandAction Command="{Binding EditCommand}"
                                   CommandParameter="{Binding SelectedExpense}" />
        </b:EventTrigger>
    </b:Interaction.Triggers>
</ListBox>
```

`EventName` is the event as a string. `InvokeCommandAction` runs the command when the event fires. The view model just has the ordinary `Edit` relay command from [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes):

```csharp
[RelayCommand]
private void Edit(Expense? expense)
{
    if (expense is null) return;
    _dialogs.EditExpense(expense);   // opens the edit window
}
```

If you want the event arguments, set `PassEventArgsToCommand="True"`. The command then receives the `EventArgs` object as its parameter. Use this sparingly: event args are UI types, and a view model that depends on them is harder to test.

Loading data when a view appears is another classic:

```xml
<b:Interaction.Triggers>
    <b:EventTrigger EventName="Loaded">
        <b:InvokeCommandAction Command="{Binding LoadCommand}" />
    </b:EventTrigger>
</b:Interaction.Triggers>
```

## Attached property or behavior: which one?

Both do the same job, so pick by these rules:

```text
Need it in a Style setter?            -> attached property
Need one value, like True or a number? -> attached property
Need state, several settings, or
cleaner code for something bigger?     -> Behavior<T>
Need "when this event fires, run
a command"?                             -> EventTrigger + InvokeCommandAction
```

The first rule matters most. `Interaction.Behaviors` is a collection, and you cannot fill it from a normal style setter. If you want a feature on every `TextBox` through a style, write it as an attached property. A common middle way is an attached property whose changed callback creates and attaches a behavior.

## Common mistakes

- **Wrong method names.** `GetSelectAllOnFocus` and `SetSelectAllOnFocus` must match the registered name exactly. A typo gives an XAML error that the property was not found.
- **Wrong owner type.** The third argument of `RegisterAttached` is the class that declares the property (`TextBoxHelper`), not the control you attach it to.
- **Using `Register` instead of `RegisterAttached`.** It compiles, but XAML may refuse to set it on other element types.
- **Forgetting to unsubscribe.** If you add an event handler when the value becomes `True`, remove it when it becomes `False`, and remove it in `OnDetaching` for behaviors. Otherwise handlers pile up.
- **Subscribing twice.** If the callback can run more than once with a "turned on" value, remove the handler before adding it, as `EnterKeyCommand` does.
- **Putting business logic in a behavior.** Behaviors are for view mechanics: focus, selection, keys, scrolling. Saving an expense still belongs in the view model, reached through a command.
- **Old namespaces.** Old tutorials use `System.Windows.Interactivity` and `xmlns:i="http://schemas.microsoft.com/expression/2010/interactivity"`. With the NuGet package the C# namespace is `Microsoft.Xaml.Behaviors` and the XAML namespace is `http://schemas.microsoft.com/xaml/behaviors`.

## Quick recap

- An attached property is defined by one class and set on other objects, like `Grid.Row` on a child.
- Create one with `DependencyProperty.RegisterAttached` plus static `GetX` and `SetX` methods with exact names.
- A property changed callback can subscribe to the target's events. This "attached behavior" adds features without subclassing or code-behind.
- Attached properties can be set from styles, so one setter can add a feature to every control of a type.
- `Microsoft.Xaml.Behaviors.Wpf` gives you `Behavior<T>` with `AssociatedObject`, `OnAttached` and `OnDetaching`.
- `EventTrigger` with `InvokeCommandAction` turns any event, such as `MouseDoubleClick` or `Loaded`, into a command call.
- Always unsubscribe from events you subscribe to, and keep business logic in view models.

<code id="code-content" class="language-csharp">
// Behaviors/TextBoxHelper.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
namespace CoinJar.Behaviors;
// A static class that only holds attached properties.
public static class TextBoxHelper
{
    // 1. Register the attached property. The owner is this class.
    public static readonly DependencyProperty SelectAllOnFocusProperty =
        DependencyProperty.RegisterAttached(
            "SelectAllOnFocus",                 // name used in XAML
            typeof(bool),                       // value type
            typeof(TextBoxHelper),              // owner type
            new PropertyMetadata(false, OnSelectAllOnFocusChanged));
    // 2. The Get and Set methods. XAML calls these for you.
    public static bool GetSelectAllOnFocus(DependencyObject element) =&gt;
        (bool)element.GetValue(SelectAllOnFocusProperty);
    public static void SetSelectAllOnFocus(DependencyObject element, bool value) =&gt;
        element.SetValue(SelectAllOnFocusProperty, value);
    // 3. Runs when the value changes on an element.
    private static void OnSelectAllOnFocusChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not TextBox textBox) return;
        if ((bool)e.NewValue)
        {
            textBox.GotKeyboardFocus += OnGotKeyboardFocus;
            textBox.PreviewMouseLeftButtonDown += OnPreviewMouseLeftButtonDown;
        }
        else
        {
            textBox.GotKeyboardFocus -= OnGotKeyboardFocus;
            textBox.PreviewMouseLeftButtonDown -= OnPreviewMouseLeftButtonDown;
        }
    }
    private static void OnGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        ((TextBox)sender).SelectAll();
    }
    // Without this, the click that gives focus would place the cursor
    // and undo the selection straight away.
    private static void OnPreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        var textBox = (TextBox)sender;
        if (!textBox.IsKeyboardFocusWithin)
        {
            textBox.Focus();
            e.Handled = true;
        }
    }
}
// Behaviors/EnterKeyCommand.cs
using System.Windows;
using System.Windows.Input;
namespace CoinJar.Behaviors;
// Runs a command when the user presses Enter inside an element.
public static class EnterKeyCommand
{
    public static readonly DependencyProperty CommandProperty =
        DependencyProperty.RegisterAttached(
            "Command",
            typeof(ICommand),
            typeof(EnterKeyCommand),
            new PropertyMetadata(null, OnCommandChanged));
    public static ICommand? GetCommand(DependencyObject element) =&gt;
        (ICommand?)element.GetValue(CommandProperty);
    public static void SetCommand(DependencyObject element, ICommand? value) =&gt;
        element.SetValue(CommandProperty, value);
    private static void OnCommandChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not UIElement element) return;
        // Remove first so we never subscribe twice.
        element.KeyDown -= OnKeyDown;
        if (e.NewValue is not null)
        {
            element.KeyDown += OnKeyDown;
        }
    }
    private static void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter) return;
        ICommand? command = GetCommand((DependencyObject)sender);
        if (command?.CanExecute(null) == true)
        {
            command.Execute(null);
            e.Handled = true;
        }
    }
}
// Behaviors/SelectAllOnFocusBehavior.cs
// Needs: dotnet add package Microsoft.Xaml.Behaviors.Wpf
using System.Windows.Controls;
using System.Windows.Input;
using Microsoft.Xaml.Behaviors;
namespace CoinJar.Behaviors;
// The same feature as TextBoxHelper, written as a Behavior class.
public class SelectAllOnFocusBehavior : Behavior&lt;TextBox&gt;
{
    // Runs when the behavior is attached to a TextBox.
    protected override void OnAttached()
    {
        base.OnAttached();
        AssociatedObject.GotKeyboardFocus += OnGotKeyboardFocus;
        AssociatedObject.PreviewMouseLeftButtonDown += OnPreviewMouseLeftButtonDown;
    }
    // Runs when it is removed. Always undo what OnAttached did.
    protected override void OnDetaching()
    {
        AssociatedObject.GotKeyboardFocus -= OnGotKeyboardFocus;
        AssociatedObject.PreviewMouseLeftButtonDown -= OnPreviewMouseLeftButtonDown;
        base.OnDetaching();
    }
    private void OnGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        AssociatedObject.SelectAll();
    }
    private void OnPreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (!AssociatedObject.IsKeyboardFocusWithin)
        {
            AssociatedObject.Focus();
            e.Handled = true;
        }
    }
}
&lt;!-- Views/ExpenseListView.xaml (how the three are used) --&gt;
&lt;UserControl x:Class="CoinJar.Views.ExpenseListView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:b="http://schemas.microsoft.com/xaml/behaviors"
             xmlns:behaviors="clr-namespace:CoinJar.Behaviors"&gt;
    &lt;UserControl.Resources&gt;
        &lt;!-- An attached property can be set from a style. --&gt;
        &lt;Style TargetType="TextBox"&gt;
            &lt;Setter Property="behaviors:TextBoxHelper.SelectAllOnFocus" Value="True" /&gt;
            &lt;Setter Property="Margin" Value="0,0,0,8" /&gt;
        &lt;/Style&gt;
    &lt;/UserControl.Resources&gt;
    &lt;DockPanel Margin="16"&gt;
        &lt;StackPanel DockPanel.Dock="Top"&gt;
            &lt;!-- Enter runs AddCommand on the view model. --&gt;
            &lt;TextBox Text="{Binding NewTitle, UpdateSourceTrigger=PropertyChanged}"
                     behaviors:EnterKeyCommand.Command="{Binding AddCommand}" /&gt;
            &lt;!-- A Behavior class is added through Interaction.Behaviors. --&gt;
            &lt;TextBox Text="{Binding NewAmount}"&gt;
                &lt;b:Interaction.Behaviors&gt;
                    &lt;behaviors:SelectAllOnFocusBehavior /&gt;
                &lt;/b:Interaction.Behaviors&gt;
            &lt;/TextBox&gt;
        &lt;/StackPanel&gt;
        &lt;ListBox ItemsSource="{Binding Expenses}"
                 SelectedItem="{Binding SelectedExpense}"
                 DisplayMemberPath="Title"&gt;
            &lt;!-- Any event can call a command. --&gt;
            &lt;b:Interaction.Triggers&gt;
                &lt;b:EventTrigger EventName="MouseDoubleClick"&gt;
                    &lt;b:InvokeCommandAction Command="{Binding EditCommand}"
                                           CommandParameter="{Binding SelectedExpense}" /&gt;
                &lt;/b:EventTrigger&gt;
            &lt;/b:Interaction.Triggers&gt;
        &lt;/ListBox&gt;
    &lt;/DockPanel&gt;
&lt;/UserControl&gt;
</code></pre>
