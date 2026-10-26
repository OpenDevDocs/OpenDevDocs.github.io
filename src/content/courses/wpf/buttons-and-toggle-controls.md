---
publishDate: 2026-10-25T20:16
title: 'Buttons, CheckBoxes and RadioButtons'
slug: buttons-and-toggle-controls
metadescription: 'Learn the WPF button family: Button with rich content, default and cancel buttons, RepeatButton, ToggleButton, CheckBox with three states, and grouped RadioButtons.'
updateDate: 2026-10-25T20:16
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'controls', 'button', 'checkbox', 'beginners']
course: wpf
---

## The button family

Buttons are how users tell your app to do something, and toggles are how they switch options on and off. WPF has a whole family of them, and they are more closely related than they look:

| Control | What it does |
| --- | --- |
| `Button` | Runs an action when clicked. |
| `RepeatButton` | Keeps firing while it is held down. |
| `ToggleButton` | Stays pressed in or out, like a light switch. |
| `CheckBox` | A toggle with a tick box, for yes or no options. |
| `RadioButton` | A toggle where only one in a group can be on. |

`CheckBox` and `RadioButton` are both built on `ToggleButton`, so they share its properties and events. Learn one and you know most of the others.

You already wired up `Click` handlers in [Code-Behind and Event Handlers](/courses/wpf/code-behind-and-event-handlers). In this lesson you will build a CoinJar settings window using every member of the family.

## Button

The basic button needs only `Content` and a `Click` handler:

```xml
<Button x:Name="SaveButton" Content="Save" Padding="16,4" Click="SaveButton_Click" />
```

```csharp
private void SaveButton_Click(object sender, RoutedEventArgs e)
{
    StatusText.Text = "Saved!";
}
```

### Content can be anything

`Content` is not limited to text. A `Button` is a **content control**: a control that holds one object of any kind and shows it. Put a panel inside and you can mix an icon and text:

```xml
<Button Padding="12,4">
    <StackPanel Orientation="Horizontal">
        <TextBlock Text="&#xE74E;" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Margin="0,0,6,0"
                   VerticalAlignment="Center" />
        <TextBlock Text="Save" VerticalAlignment="Center" />
    </StackPanel>
</Button>
```

`&#xE74E;` is the character code of the Save icon in the Windows icon font. Segoe Fluent Icons comes with Windows 11, and Segoe MDL2 Assets is the fallback on Windows 10. You will see more ways to show icons in [Images, Icons and Media](/courses/wpf/images-and-media).

### Default and cancel buttons

Two properties connect buttons to the keyboard:

- `IsDefault="True"`: pressing **Enter** anywhere in the window clicks this button.
- `IsCancel="True"`: pressing **Esc** clicks this button.

```xml
<StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
    <Button Content="Save" IsDefault="True" Padding="16,4" Margin="0,0,8,0" Click="SaveButton_Click" />
    <Button Content="Cancel" IsCancel="True" Padding="16,4" Click="CancelButton_Click" />
</StackPanel>
```

When a window is opened as a dialog with `ShowDialog()`, a button with `IsCancel="True"` closes it automatically, even without a handler. In a normal window you call `Close()` yourself in the handler.

Exception: inside a `TextBox` with `AcceptsReturn="True"`, Enter adds a new line instead of pressing the default button.

### Access keys and tooltips

As with a `Label` (see [Text Controls](/courses/wpf/text-controls)), an underscore in the content creates an access key. `Content="_Save"` lets the user press Alt+S.

`ToolTip` shows a small hint when the mouse rests on a control. It works on every element, not just buttons:

```xml
<Button Content="_Export" ToolTip="Save all expenses to a CSV file" />
```

### Enabling and disabling

Set `IsEnabled="False"` to grey a button out. It then ignores clicks and the keyboard. From code, `SaveButton.IsEnabled = TitleBox.Text.Length > 0;` is a typical way to allow saving only when the form is filled in. Later, in [Commands and ICommand](/courses/wpf/commands-and-icommand), WPF will manage this for you.

## RepeatButton

A `RepeatButton` fires `Click` once when pressed, waits a moment, then keeps firing while the user holds it down. It is perfect for plus and minus buttons:

```xml
<RepeatButton Content="+" Width="32" Delay="400" Interval="80" Click="PlusButton_Click" />
```

- `Delay`: milliseconds to wait before repeating starts.
- `Interval`: milliseconds between repeats.

## ToggleButton

A `ToggleButton` looks like a normal button, but it **stays** pressed in after a click, and pops out after the next click. Its state is in `IsChecked`:

```xml
<ToggleButton x:Name="CompactToggle" Content="Compact mode" Padding="12,4"
              Checked="CompactToggle_Checked" Unchecked="CompactToggle_Unchecked" />
```

```csharp
private void CompactToggle_Checked(object sender, RoutedEventArgs e)   => FontSize = 11;
private void CompactToggle_Unchecked(object sender, RoutedEventArgs e) => FontSize = 13;
```

Three events tell you about changes:

- `Checked`: it was turned on.
- `Unchecked`: it was turned off.
- `Indeterminate`: it went into the "neither" state (see three state check boxes below).

`Click` still fires as well, on every click, whatever the new state is.

### IsChecked is a nullable bool

`IsChecked` has the type `bool?`, a **nullable bool**, which can be `true`, `false` or `null`. That third value is why this does not compile:

```csharp
// Error: cannot convert bool? to bool
if (CompactToggle.IsChecked) { }

// Correct: compare with true
if (CompactToggle.IsChecked == true) { }
```

Comparing with `== true` treats `null` as "not checked", which is almost always what you want.

## CheckBox

A `CheckBox` is a toggle with a small box and a tick. Use it for independent yes or no options. Each check box is separate from the others.

```xml
<StackPanel>
    <CheckBox x:Name="WarnCheck" Content="Warn me when I go over budget" IsChecked="True" Margin="0,0,0,4" />
    <CheckBox x:Name="RoundCheck" Content="Round amounts to whole numbers" />
</StackPanel>
```

```csharp
bool warn = WarnCheck.IsChecked == true;
```

Clicking the text also toggles the box, which gives the user a bigger target.

### Three state check boxes

With `IsThreeState="True"`, the user can click through three states: checked, unchecked and **indeterminate** (`IsChecked` is `null`, shown as a filled square). The most common use is a "select all" box above a list of options:

- All options ticked: the "select all" box is checked.
- None ticked: it is unchecked.
- Some ticked: it is indeterminate.

For a "select all" box you usually set the indeterminate state from code, and you do not want the user to click into it. Good news: code can set `IsChecked = null` even when `IsThreeState` is `False`. `IsThreeState` only decides whether the user's own clicks can reach the third state. So leave it off, and a click on an indeterminate box simply unticks it. The code panel at the end of this lesson shows a complete "select all categories" box.

## RadioButton

A `RadioButton` is for picking **one option out of several**. When the user selects one, the others in the same group turn off automatically, like the preset buttons on an old car radio.

```xml
<StackPanel>
    <TextBlock Text="Show amounts as" FontWeight="SemiBold" />
    <RadioButton x:Name="CurrencyRadio" Content="Currency (12.50 with symbol)" IsChecked="True" />
    <RadioButton x:Name="PlainRadio" Content="Plain number (12.50)" />
</StackPanel>
```

### Groups

By default, radio buttons that share the **same parent panel** form one group. If you need two separate groups in the same panel, or one group spread over several panels, give them a `GroupName`:

```xml
<StackPanel>
    <RadioButton GroupName="Period" Content="This week" IsChecked="True" />
    <RadioButton GroupName="Period" Content="This month" />
    <RadioButton GroupName="Sort" Content="Newest first" IsChecked="True" />
    <RadioButton GroupName="Sort" Content="Largest first" />
</StackPanel>
```

### One handler for the whole group

Instead of one handler per button, use one shared `Checked` handler and look at `sender`:

```csharp
private void PeriodRadio_Checked(object sender, RoutedEventArgs e)
{
    var radio = (RadioButton)sender;
    StatusText.Text = $"Showing {radio.Content}";
}
```

You can also store a value in the `Tag` property of each radio button (for example `Tag="Week"`) and read `radio.Tag` instead of the display text. Then you can change the wording without breaking your code.

## CheckBox or RadioButton?

- Options that are **independent** (you can have any combination): `CheckBox`.
- Options that **exclude each other** (exactly one must be chosen): `RadioButton`.
- A single on or off setting: a `CheckBox`, or a `ToggleButton` if it should look like a button.
- More than about five exclusive options: a `ComboBox` saves space. See [Selection Controls](/courses/wpf/selection-controls).

## Common mistakes

- **`if (myCheckBox.IsChecked)` does not compile.** Write `== true`.
- **`Checked` fires during start up.** `IsChecked="True"` in XAML raises `Checked` while `InitializeComponent` runs, before controls lower in the file exist. Guard with a `null` check or `if (!IsLoaded) return;`.
- **Radio buttons that do not exclude each other.** They are in different panels. Give them the same `GroupName`.
- **Two default buttons.** Only one button per window should have `IsDefault="True"`.
- **Using a CheckBox for a choice of two exclusive options** such as "Light" and "Dark". Two radio buttons (or a combo box) make the choice clearer.

## Quick recap

- `Button` runs an action on `Click`. Its `Content` can be any element, including icon plus text.
- `IsDefault` responds to Enter, `IsCancel` to Esc. A cancel button closes a dialog automatically.
- `RepeatButton` keeps firing while held, controlled by `Delay` and `Interval`.
- `ToggleButton`, `CheckBox` and `RadioButton` share `IsChecked` (a `bool?`) and the `Checked` and `Unchecked` events.
- `IsThreeState` adds the indeterminate (`null`) state, useful for "select all".
- Radio buttons group by parent panel, or by `GroupName`.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar settings" Width="460" Height="520" MinWidth="380" MinHeight="460"
        FontSize="13"&gt;
    &lt;DockPanel Margin="16"&gt;
        &lt;!-- Bottom: Save (Enter) and Cancel (Esc) --&gt;
        &lt;StackPanel DockPanel.Dock="Bottom" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,12,0,0"&gt;
            &lt;Button Content="_Save" IsDefault="True" Padding="16,4" Margin="0,0,8,0" Click="SaveButton_Click" /&gt;
            &lt;Button Content="Cancel" IsCancel="True" Padding="16,4" Click="CancelButton_Click" /&gt;
        &lt;/StackPanel&gt;
        &lt;TextBlock x:Name="StatusText" DockPanel.Dock="Bottom" Foreground="DimGray" TextWrapping="Wrap" /&gt;
        &lt;StackPanel&gt;
            &lt;!-- RepeatButtons: hold them down to change the budget quickly --&gt;
            &lt;TextBlock Text="Monthly budget" FontWeight="SemiBold" /&gt;
            &lt;StackPanel Orientation="Horizontal" Margin="0,4,0,12"&gt;
                &lt;RepeatButton Content="-" Width="32" Delay="400" Interval="60" Click="MinusButton_Click" /&gt;
                &lt;TextBlock x:Name="BudgetText" Text="500" Width="70" TextAlignment="Center" VerticalAlignment="Center" /&gt;
                &lt;RepeatButton Content="+" Width="32" Delay="400" Interval="60" Click="PlusButton_Click" /&gt;
            &lt;/StackPanel&gt;
            &lt;!-- Independent options: CheckBoxes --&gt;
            &lt;TextBlock Text="Options" FontWeight="SemiBold" /&gt;
            &lt;CheckBox x:Name="WarnCheck" Content="Warn me when I go over budget" IsChecked="True" Margin="0,4,0,4" /&gt;
            &lt;CheckBox x:Name="RoundCheck" Content="Round amounts to whole numbers" Margin="0,0,0,12" /&gt;
            &lt;!-- "Select all" box. Code sets it to indeterminate (null) when only some are ticked. --&gt;
            &lt;TextBlock Text="Categories in the total" FontWeight="SemiBold" /&gt;
            &lt;CheckBox x:Name="AllCategoriesCheck" Content="All categories" IsChecked="True"
                      Margin="0,4,0,4" Click="AllCategoriesCheck_Click" /&gt;
            &lt;StackPanel x:Name="CategoryPanel" Margin="20,0,0,12"&gt;
                &lt;CheckBox Content="Food" IsChecked="True" Click="CategoryCheck_Click" /&gt;
                &lt;CheckBox Content="Transport" IsChecked="True" Click="CategoryCheck_Click" /&gt;
                &lt;CheckBox Content="Bills" IsChecked="True" Click="CategoryCheck_Click" /&gt;
                &lt;CheckBox Content="Fun" IsChecked="True" Click="CategoryCheck_Click" /&gt;
                &lt;CheckBox Content="Other" IsChecked="True" Click="CategoryCheck_Click" /&gt;
            &lt;/StackPanel&gt;
            &lt;!-- Exclusive choice: RadioButtons in one group. Tag holds a value for the code. --&gt;
            &lt;TextBlock Text="Show amounts as" FontWeight="SemiBold" /&gt;
            &lt;RadioButton GroupName="Format" Content="Currency" Tag="C" IsChecked="True" Margin="0,4,0,0" Checked="FormatRadio_Checked" /&gt;
            &lt;RadioButton GroupName="Format" Content="Plain number" Tag="N2" Margin="0,0,0,12" Checked="FormatRadio_Checked" /&gt;
            &lt;!-- ToggleButton: stays pressed in --&gt;
            &lt;ToggleButton x:Name="CompactToggle" Content="Compact mode" HorizontalAlignment="Left" Padding="12,4"
                          Checked="CompactToggle_Checked" Unchecked="CompactToggle_Unchecked" /&gt;
        &lt;/StackPanel&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
namespace CoinJar;
public partial class MainWindow : Window
{
    private int _budget = 500;
    private string _format = "C";
    public MainWindow()
    {
        InitializeComponent();
    }
    private void MinusButton_Click(object sender, RoutedEventArgs e)
    {
        _budget = Math.Max(0, _budget - 10);
        BudgetText.Text = _budget.ToString();
    }
    private void PlusButton_Click(object sender, RoutedEventArgs e)
    {
        _budget += 10;
        BudgetText.Text = _budget.ToString();
    }
    private void AllCategoriesCheck_Click(object sender, RoutedEventArgs e)
    {
        // The user clicked "All". IsThreeState is off, so a click never leaves it indeterminate:
        // checked becomes unchecked, unchecked becomes checked, indeterminate becomes unchecked.
        bool tickAll = AllCategoriesCheck.IsChecked == true;
        foreach (CheckBox box in CategoryPanel.Children)
        {
            box.IsChecked = tickAll;
        }
    }
    private void CategoryCheck_Click(object sender, RoutedEventArgs e)
    {
        // Count the ticked categories and set "All" to checked, unchecked or indeterminate (null)
        int ticked = 0;
        foreach (CheckBox box in CategoryPanel.Children)
        {
            if (box.IsChecked == true) ticked++;
        }
        AllCategoriesCheck.IsChecked = ticked == CategoryPanel.Children.Count ? true
                                     : ticked == 0 ? false
                                     : null;
    }
    private void FormatRadio_Checked(object sender, RoutedEventArgs e)
    {
        // One handler for the whole group. Tag holds the format string.
        _format = (string)((RadioButton)sender).Tag;
        // Checked fires during InitializeComponent for IsChecked="True".
        // Guard in case StatusText is declared later in the XAML and is still null.
        if (StatusText is null) return;
        StatusText.Text = $"Example: {123.5m.ToString(_format)}";
    }
    private void CompactToggle_Checked(object sender, RoutedEventArgs e) =&gt; FontSize = 11;
    private void CompactToggle_Unchecked(object sender, RoutedEventArgs e) =&gt; FontSize = 13;
    private void SaveButton_Click(object sender, RoutedEventArgs e)
    {
        var categories = new List&lt;string&gt;();
        foreach (CheckBox box in CategoryPanel.Children)
        {
            if (box.IsChecked == true) categories.Add((string)box.Content);
        }
        StatusText.Text =
            $"Saved: budget {_budget.ToString(_format)}, " +
            $"warn = {WarnCheck.IsChecked == true}, round = {RoundCheck.IsChecked == true}, " +
            $"categories = {string.Join(", ", categories)}, compact = {CompactToggle.IsChecked == true}.";
    }
    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        // This is the main window, not a dialog, so close it ourselves
        Close();
    }
}
</code></pre>
