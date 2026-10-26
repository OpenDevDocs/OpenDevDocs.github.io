---
publishDate: 2026-10-25T20:54
title: 'Keyboard Shortcuts and Focus'
slug: keyboard-shortcuts-and-focus
metadescription: 'Make CoinJar fast to use from the keyboard: focus and tab order, access keys, default buttons, KeyBinding shortcuts for view model commands, and moving focus the MVVM way.'
updateDate: 2026-10-25T20:54
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'keyboard', 'focus', 'commands']
course: wpf
---

## Why the keyboard matters

Watch someone who uses an app every day. They rarely reach for the mouse. They press Tab to jump between fields, Enter to save and Ctrl+N for a new item. A desktop app that works well from the keyboard feels fast, and it is also usable by people who cannot use a mouse at all.

WPF gives you all of this almost for free, as long as you know a few ideas:

- **Focus**: which control receives the keys you type.
- **Tab order**: the route focus takes when you press Tab.
- **Access keys**: the underlined letters you reach with Alt.
- **Shortcuts**: key combinations such as Ctrl+S that run a command.

In this lesson you add all four to the CoinJar expense form from [MVVM with CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm).

## What focus is

**Focus** is the "you are here" marker for the keyboard. Only one element in the whole app has **keyboard focus** at a time. It is the `TextBox` with the blinking cursor, or the `Button` with the dotted outline. When you press a key, WPF sends it to that element first.

Not every element can take focus. A `TextBlock` or a `Border` cannot, because you never type into them. Two properties decide it:

- `Focusable`: can this element get focus at all?
- `IsTabStop`: does Tab stop here? (Only on controls.)

You can ask for focus from code with `Focus()`. It returns `false` when it did not work, for example because the element is hidden or not loaded yet.

```csharp
bool ok = TitleBox.Focus();     // put the cursor in the Title box
IInputElement? now = Keyboard.FocusedElement; // who has focus right now?
```

Styles can react to focus with triggers on `IsKeyboardFocused` (this element) and `IsKeyboardFocusWithin` (this element or anything inside it), as you saw in [Property, Data and Event Triggers](/courses/wpf/triggers):

```xml
<Style TargetType="Border" x:Key="FormCard">
    <Setter Property="BorderBrush" Value="LightGray" />
    <Setter Property="BorderThickness" Value="1" />
    <Style.Triggers>
        <!-- Highlight the whole card while you type in any field inside it -->
        <Trigger Property="IsKeyboardFocusWithin" Value="True">
            <Setter Property="BorderBrush" Value="DodgerBlue" />
        </Trigger>
    </Style.Triggers>
</Style>
```

### Logical focus and focus scopes

WPF also has **logical focus**: the element that *would* get keyboard focus when the focus comes back to that area. Each **focus scope** remembers its own logical focus. A `Window`, a `Menu` and a `ToolBar` are focus scopes.

That is why clicking a toolbar button does not steal the cursor from your `TextBox`: the toolbar is its own scope, and the window still remembers the `TextBox`. You rarely need to think about scopes, but it explains some surprises later.

## Choosing the first focused control

When CoinJar opens, the cursor should already be in the Title box. Set `FocusManager.FocusedElement` on the window:

```xml
<Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar"
        FocusManager.FocusedElement="{Binding ElementName=TitleBox}">
    <StackPanel Margin="16">
        <TextBox x:Name="TitleBox" />
    </StackPanel>
</Window>
```

It is a binding with `ElementName`, so the element needs an `x:Name`. No code-behind needed.

## Tab order

By default, Tab visits controls in the order they appear in the XAML, top to bottom. If your layout matches your XAML (it usually does), you have nothing to do.

When it does not match, use `TabIndex`. Lower numbers come first. Controls without a `TabIndex` come after the numbered ones.

```xml
<TextBox x:Name="TitleBox" TabIndex="0" />
<TextBox x:Name="AmountBox" TabIndex="1" />
<ComboBox x:Name="CategoryBox" TabIndex="2" />
```

Two more tools help:

- `IsTabStop="False"` skips a control, for example a read only `TextBox` that only shows a value.
- `KeyboardNavigation.TabNavigation` on a panel says what Tab does inside it.

```xml
<!-- Tab cycles inside the form and never leaves it by itself -->
<StackPanel KeyboardNavigation.TabNavigation="Cycle">
    ...
</StackPanel>
```

The common values are `Continue` (the default: carry on to the next area), `Cycle` (wrap around inside this panel), `Once` (stop at this group once, then move on) and `None` (Tab skips the whole panel). `Once` is nice for a row of toolbar buttons: one Tab lands on the row, arrow keys move inside it.

## Access keys

An **access key** is the underlined letter in a label or button. Press Alt plus that letter and the control acts as if it were clicked. In XAML, put an underscore before the letter:

```xml
<Button Content="_Save" />      <!-- Alt+S -->
<Button Content="C_lear" />     <!-- Alt+L -->
<MenuItem Header="_File" />     <!-- Alt+F opens the menu -->
```

Windows hides the underlines until you press Alt. That is normal.

A `TextBox` has no text of its own to underline, so pair it with a `Label` and set `Target`. Alt plus the letter then jumps into the box:

```xml
<Label Content="_Amount" Target="{Binding ElementName=AmountBox}" />
<TextBox x:Name="AmountBox" />
```

This is one reason to use `Label` instead of `TextBlock` above input fields, as mentioned in [Text Controls](/courses/wpf/text-controls). If you need a real underscore in the text, write two: `Content="Save__as"` shows "Save_as".

Give each control in a window its own letter. When two share a letter, Alt plus that letter only moves between them and clicks neither.

## Default and cancel buttons

Two button properties cover the most common keys in a form:

- `IsDefault="True"`: Enter clicks this button (unless a control that accepts Enter, such as a multi line `TextBox`, has focus).
- `IsCancel="True"`: Esc clicks this button. In a dialog it also closes the window.

```xml
<Button Content="A_dd" Command="{Binding AddCommand}" IsDefault="True" />
<Button Content="C_lear" Command="{Binding ClearFormCommand}" IsCancel="True" />
```

You already met these in [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes), where OK is the default button and Cancel is the cancel button.

## Shortcuts with KeyBinding

A **key binding** connects a key combination to a command. You put it in the `InputBindings` of an element. When that element (or anything inside it) has focus and the keys are pressed, the command runs.

Because view model commands are normal `ICommand` objects (see [Commands and ICommand](/courses/wpf/commands-and-icommand)), they plug straight in:

```xml
<Window.InputBindings>
    <KeyBinding Gesture="Ctrl+S" Command="{Binding AddCommand}" />
    <KeyBinding Gesture="Ctrl+N" Command="{Binding ClearFormCommand}" />
    <KeyBinding Key="F2" Command="{Binding ClearFormCommand}" />
</Window.InputBindings>
```

`Gesture` is a string such as `Ctrl+Shift+E` or `Alt+Left`. You can also use `Key` and `Modifiers` separately: `Key="E" Modifiers="Ctrl+Shift"`.

The command's `CanExecute` still counts. When the form is empty, `AddCommand` cannot run, so Ctrl+S does nothing. You do not have to check anything yourself.

### Where to put a key binding

The place decides when the shortcut works:

- On the `Window`: anywhere inside the window.
- On a `ListBox`: only while the list (or a row in it) has focus.

That matters for keys like Delete. A Delete shortcut on the window would also fire while you are deleting a character in a `TextBox`. Putting it on the list keeps it where it belongs:

```xml
<ListBox ItemsSource="{Binding Expenses}" SelectedItem="{Binding SelectedExpense}">
    <ListBox.InputBindings>
        <KeyBinding Key="Delete" Command="{Binding DeleteCommand}" />
    </ListBox.InputBindings>
</ListBox>
```

### Mouse bindings

`MouseBinding` is the same idea for the mouse, for example a double click:

```xml
<ListBox.InputBindings>
    <MouseBinding Gesture="LeftDoubleClick" Command="{Binding EditCommand}"
                  CommandParameter="{Binding SelectedExpense}" />
</ListBox.InputBindings>
```

## Showing shortcuts in menus

People discover shortcuts by reading menus. `MenuItem` has an `InputGestureText` property for the text on the right. It is only text: it does not create the shortcut. You still need the `KeyBinding`.

```xml
<MenuItem Header="_Save expense" Command="{Binding AddCommand}" InputGestureText="Ctrl+S" />
```

WPF also ships ready made **routed commands** such as `ApplicationCommands.Copy`, `Paste`, `Undo` and `Close`. These know their own name and shortcut, so a menu item needs nothing else:

```xml
<MenuItem Command="ApplicationCommands.Copy" />   <!-- shows "Copy  Ctrl+C" -->
```

A `TextBox` already handles Cut, Copy, Paste and Undo, so these menu items work on whatever text box has focus. For a routed command your app handles itself, add a `CommandBinding` and a handler in code-behind:

```xml
<Window.CommandBindings>
    <CommandBinding Command="ApplicationCommands.Close" Executed="CloseCommand_Executed" />
</Window.CommandBindings>
```

```csharp
private void CloseCommand_Executed(object sender, ExecutedRoutedEventArgs e) => Close();
```

For your own app logic, prefer view model commands with `KeyBinding`. Routed commands are best for the built in editing commands. Menus themselves were covered in [Menus, ToolBars and StatusBars](/courses/wpf/menus-toolbars-and-status-bars).

## Handling raw keys

Sometimes you need the key itself, not a command. Use the `KeyDown` event, or `PreviewKeyDown`, which runs first and travels down from the window (a **tunneling** event, see [Code-Behind and Event Handlers](/courses/wpf/code-behind-and-event-handlers)).

```csharp
// Ctrl+L jumps to the list
protected override void OnPreviewKeyDown(KeyEventArgs e)
{
    if (e.Key == Key.L && Keyboard.Modifiers == ModifierKeys.Control)
    {
        ExpenseList.Focus();
        e.Handled = true;   // stop here, nobody else sees this key
    }
    base.OnPreviewKeyDown(e);
}
```

`Keyboard.Modifiers` tells you which of Ctrl, Shift and Alt are held. Setting `e.Handled = true` stops the key from reaching the control. One oddity: when Alt is held, `e.Key` is `Key.System` and the real key is in `e.SystemKey`.

To move focus like Tab does, ask the focused element to move:

```csharp
// The Down arrow moves to the next field in the form
private void Form_PreviewKeyDown(object sender, KeyEventArgs e)
{
    if (e.Key == Key.Down && e.OriginalSource is TextBox box)
    {
        box.MoveFocus(new TraversalRequest(FocusNavigationDirection.Next));
        e.Handled = true;
    }
}
```

## Moving focus the MVVM way

After adding an expense, the cursor should jump back to the Title box. But a view model must not know about `TextBox` objects. It cannot call `TitleBox.Focus()`.

A simple, clean answer: the view model raises an [event](/courses/c-sharp/events) that means "the form was cleared", and the view decides what that means for focus.

```csharp
// ViewModels/ExpenseListViewModel.cs
public event EventHandler? FormCleared;

[RelayCommand]
private void ClearForm()
{
    NewTitle = "";
    NewAmountText = "";
    FormCleared?.Invoke(this, EventArgs.Empty);
}
```

```csharp
// MainWindow.xaml.cs
viewModel.FormCleared += (_, _) => TitleBox.Focus();
```

The view model stays testable, and focus stays a view job. In bigger apps you can do the same thing with an attached property (see [Attached Properties and Behaviors](/courses/wpf/attached-properties-and-behaviors)) or with a message (see [Messaging Between ViewModels](/courses/wpf/messaging-between-viewmodels)).

## Common mistakes

- **Ctrl+S saves old text.** By default a `TextBox` copies its text to the view model when it loses focus. A shortcut does not move focus, so the view model still has the old value. Use `UpdateSourceTrigger=PropertyChanged` on fields that shortcuts read, as explained in [Binding Modes and Update Triggers](/courses/wpf/binding-modes-and-update-triggers).
- **Typing a decimal point fails.** With `UpdateSourceTrigger=PropertyChanged`, a `TextBox` bound straight to a `decimal` can throw away a half typed "12." and show "12". Bind numbers that update on every key to a `string` property (here `NewAmountText`) and parse it in the view model.
- **Plain letter shortcuts.** A `KeyBinding` on `N` without Ctrl fires while the user types a title. Use a modifier, or a function key such as F2.
- **Focus() returns false.** The element is not loaded or not visible yet. Call it from the `Loaded` event, or use `FocusManager.FocusedElement`.
- **The same access key twice.** Alt then only cycles between the two controls. Give each one its own letter.
- **InputGestureText without a KeyBinding.** The menu shows "Ctrl+S" but nothing happens. The text is only a label.

## Quick recap

- Keyboard focus is the one element that receives keys. `Focusable`, `IsTabStop` and `Focus()` control it.
- `FocusManager.FocusedElement` picks the first focused control. `TabIndex` and `KeyboardNavigation.TabNavigation` shape the Tab route.
- An underscore creates an access key. A `Label` with `Target` gives a `TextBox` one.
- `IsDefault` handles Enter, `IsCancel` handles Esc.
- `KeyBinding` and `MouseBinding` in `InputBindings` connect keys and clicks to view model commands. Where you put them decides when they work.
- `InputGestureText` only labels a menu item. Built in routed commands bring their own text.
- Let the view move focus when the view model raises an event.
- Next, you will let users move things with the mouse in [Drag and Drop](/courses/wpf/drag-and-drop).

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Width="640" Height="420"
        FocusManager.FocusedElement="{Binding ElementName=TitleBox}"&gt;
    &lt;!-- Window wide shortcuts: they work wherever the focus is inside the window --&gt;
    &lt;Window.InputBindings&gt;
        &lt;KeyBinding Gesture="Ctrl+S" Command="{Binding AddCommand}" /&gt;
        &lt;KeyBinding Gesture="Ctrl+N" Command="{Binding ClearFormCommand}" /&gt;
        &lt;KeyBinding Key="F2" Command="{Binding ClearFormCommand}" /&gt;
    &lt;/Window.InputBindings&gt;
    &lt;!-- A built in routed command, handled in code-behind --&gt;
    &lt;Window.CommandBindings&gt;
        &lt;CommandBinding Command="ApplicationCommands.Close" Executed="CloseCommand_Executed" /&gt;
    &lt;/Window.CommandBindings&gt;
    &lt;DockPanel&gt;
        &lt;Menu DockPanel.Dock="Top"&gt;
            &lt;!-- The underscore makes Alt+F open this menu --&gt;
            &lt;MenuItem Header="_File"&gt;
                &lt;MenuItem Header="_New expense" Command="{Binding ClearFormCommand}" InputGestureText="Ctrl+N" /&gt;
                &lt;MenuItem Header="_Save expense" Command="{Binding AddCommand}" InputGestureText="Ctrl+S" /&gt;
                &lt;Separator /&gt;
                &lt;MenuItem Header="E_xit" Command="ApplicationCommands.Close" InputGestureText="Alt+F4" /&gt;
            &lt;/MenuItem&gt;
            &lt;!-- Routed UI commands bring their own text and shortcut --&gt;
            &lt;MenuItem Header="_Edit"&gt;
                &lt;MenuItem Command="ApplicationCommands.Cut" /&gt;
                &lt;MenuItem Command="ApplicationCommands.Copy" /&gt;
                &lt;MenuItem Command="ApplicationCommands.Paste" /&gt;
            &lt;/MenuItem&gt;
        &lt;/Menu&gt;
        &lt;Grid Margin="16"&gt;
            &lt;Grid.ColumnDefinitions&gt;
                &lt;ColumnDefinition Width="240" /&gt;
                &lt;ColumnDefinition Width="16" /&gt;
                &lt;ColumnDefinition Width="*" /&gt;
            &lt;/Grid.ColumnDefinitions&gt;
            &lt;!-- The form: Tab goes top to bottom, and wraps around inside the form --&gt;
            &lt;StackPanel KeyboardNavigation.TabNavigation="Cycle" PreviewKeyDown="Form_PreviewKeyDown"&gt;
                &lt;Label Content="_Title" Target="{Binding ElementName=TitleBox}" Padding="0,0,0,4" /&gt;
                &lt;TextBox x:Name="TitleBox" TabIndex="0"
                         Text="{Binding NewTitle, UpdateSourceTrigger=PropertyChanged}" /&gt;
                &lt;Label Content="_Amount" Target="{Binding ElementName=AmountBox}" Padding="0,8,0,4" /&gt;
                &lt;TextBox x:Name="AmountBox" TabIndex="1"
                         Text="{Binding NewAmountText, UpdateSourceTrigger=PropertyChanged}" /&gt;
                &lt;Label Content="_Category" Target="{Binding ElementName=CategoryBox}" Padding="0,8,0,4" /&gt;
                &lt;ComboBox x:Name="CategoryBox" TabIndex="2"
                          ItemsSource="{Binding Categories}" SelectedItem="{Binding NewCategory}" /&gt;
                &lt;StackPanel Orientation="Horizontal" Margin="0,16,0,0"&gt;
                    &lt;!-- IsDefault: Enter clicks it. IsCancel: Esc clicks it. --&gt;
                    &lt;Button Content="A_dd" Command="{Binding AddCommand}" IsDefault="True"
                            TabIndex="3" Width="80" Margin="0,0,8,0" /&gt;
                    &lt;Button Content="C_lear" Command="{Binding ClearFormCommand}" IsCancel="True"
                            TabIndex="4" Width="80" /&gt;
                &lt;/StackPanel&gt;
            &lt;/StackPanel&gt;
            &lt;!-- The list. Delete only works while the list has focus. --&gt;
            &lt;ListBox x:Name="ExpenseList" Grid.Column="2"
                     ItemsSource="{Binding Expenses}" SelectedItem="{Binding SelectedExpense}"
                     DisplayMemberPath="Title"&gt;
                &lt;ListBox.InputBindings&gt;
                    &lt;KeyBinding Key="Delete" Command="{Binding DeleteCommand}" /&gt;
                &lt;/ListBox.InputBindings&gt;
            &lt;/ListBox&gt;
        &lt;/Grid&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using CoinJar.ViewModels;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var viewModel = new ExpenseListViewModel();
        DataContext = viewModel;
        // Focus is view work, so the view moves it when the view model says so.
        viewModel.FormCleared += (_, _) =&gt; TitleBox.Focus();
    }
    private void CloseCommand_Executed(object sender, ExecutedRoutedEventArgs e) =&gt; Close();
    // Ctrl+L jumps to the list: a shortcut that needs view code.
    protected override void OnPreviewKeyDown(KeyEventArgs e)
    {
        if (e.Key == Key.L &amp;&amp; Keyboard.Modifiers == ModifierKeys.Control)
        {
            ExpenseList.Focus();
            e.Handled = true;
        }
        base.OnPreviewKeyDown(e);
    }
    // In the form's text boxes, the Down arrow moves to the next field, like Tab.
    private void Form_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Down &amp;&amp; e.OriginalSource is TextBox box)
        {
            box.MoveFocus(new TraversalRequest(FocusNavigationDirection.Next));
            e.Handled = true;
        }
    }
}
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using System.Globalization;
using CoinJar.Models;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
namespace CoinJar.ViewModels;
public partial class ExpenseListViewModel : ObservableObject
{
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = [];
    public string[] Categories { get; } = ["Food", "Transport", "Bills", "Fun", "Other"];
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(AddCommand))]
    public partial string NewTitle { get; set; } = "";
    // Text, so the user can type "12." without the binding fighting back.
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(AddCommand))]
    public partial string NewAmountText { get; set; } = "";
    [ObservableProperty]
    public partial string NewCategory { get; set; } = "Food";
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(DeleteCommand))]
    public partial Expense? SelectedExpense { get; set; }
    // The view listens to this and puts the cursor back in the Title box.
    public event EventHandler? FormCleared;
    private bool CanAdd() =&gt;
        !string.IsNullOrWhiteSpace(NewTitle)
        &amp;&amp; decimal.TryParse(NewAmountText, NumberStyles.Number, CultureInfo.CurrentCulture, out decimal a)
        &amp;&amp; a &gt; 0;
    [RelayCommand(CanExecute = nameof(CanAdd))]
    private void Add()
    {
        decimal amount = decimal.Parse(NewAmountText, NumberStyles.Number, CultureInfo.CurrentCulture);
        Expenses.Add(new Expense { Title = NewTitle.Trim(), Amount = amount, Category = NewCategory });
        ClearForm();
    }
    [RelayCommand]
    private void ClearForm()
    {
        NewTitle = "";
        NewAmountText = "";
        NewCategory = "Food";
        FormCleared?.Invoke(this, EventArgs.Empty);
    }
    private bool CanDelete() =&gt; SelectedExpense is not null;
    [RelayCommand(CanExecute = nameof(CanDelete))]
    private void Delete()
    {
        if (SelectedExpense is not null) Expenses.Remove(SelectedExpense);
    }
}
</code></pre>
