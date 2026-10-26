---
publishDate: 2026-10-25T20:22
title: 'Binding Modes and Update Triggers'
slug: binding-modes-and-update-triggers
metadescription: 'Control which way data flows with OneWay, TwoWay, OneTime and OneWayToSource, choose when typed text is saved with UpdateSourceTrigger, and build an edit form with Save and Cancel.'
updateDate: 2026-10-25T20:22
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'data-binding', 'binding-mode', 'updatesourcetrigger']
course: wpf
---

## Which way, and when?

In [Data Binding Basics](/courses/wpf/data-binding-basics) you saw that a `TextBox` bound to `Title` both shows the title and writes typed text back. A `TextBlock` bound to the same property only shows it. Why the difference?

Every binding answers two questions:

1. **Which way does data flow?** From the source to the control, from the control to the source, or both? This is the binding **mode**.
2. **When does typed text go back to the source?** On every key press, when the user leaves the box, or only when you say so? This is the **update source trigger**.

Getting these right makes forms feel natural. Getting them wrong gives you values that "do not save" or labels that never change.

## The four binding modes

You set the mode with `Mode=` inside the binding:

```xml
<TextBox Text="{Binding Title, Mode=TwoWay}" />
```

Here is what each mode does. "Source" is your C# object and "target" is the control property.

| Mode | Direction | Typical use |
| --- | --- | --- |
| `OneWay` | Source to target | Labels, totals, anything read only |
| `TwoWay` | Both ways | Text boxes, check boxes, sliders, date pickers |
| `OneTime` | Source to target, once at the start | Values that never change, such as an app version |
| `OneWayToSource` | Target to source | Rare. Pushes a control value into your object without reading it back |

```text
OneWay           source  ------>  target
TwoWay           source  <----->  target
OneTime          source  --1x-->  target
OneWayToSource   source  <------  target
```

### Default: each property picks its own

If you leave `Mode` out, you get `Default`, which means "whatever this control property prefers". The designers of WPF chose sensible defaults:

- **TwoWay by default:** `TextBox.Text`, `CheckBox.IsChecked`, `Slider.Value`, `DatePicker.SelectedDate`, `ComboBox.SelectedItem` and other properties the user edits.
- **OneWay by default:** almost everything else, such as `TextBlock.Text`, `Content`, `Visibility`, `Foreground`.

So most of the time you can skip `Mode` completely. Write it when you want something different, or when you want to make your intent clear to the next reader.

### OneWay on an input control

Sometimes you want a `TextBox` that shows a value but never changes it, for example a read only "Id" box that the user can still select and copy:

```xml
<TextBox Text="{Binding Id, Mode=OneWay}" IsReadOnly="True" />
```

`IsReadOnly` stops typing, and `Mode=OneWay` makes it clear that nothing should flow back.

### OneTime for values that never change

`OneTime` reads the value once when the binding starts and then stops listening. It is slightly cheaper than `OneWay`, which matters in long lists:

```xml
<TextBlock Text="{Binding Id, Mode=OneTime, StringFormat='Expense #{0}'}" />
```

Only use it when you are sure the value will not change while the screen is open.

## Seeing modes in action

Bindings between two controls are perfect for experiments, because WPF controls always tell the binding when their properties change. Paste this into a window and play:

```xml
<StackPanel Margin="16">
    <TextBox x:Name="Original" Text="Coffee" />

    <!-- Copies follow the original. Type into them to see what flows back. -->
    <TextBox Text="{Binding Text, ElementName=Original, Mode=OneWay}" Margin="0,8,0,0" />
    <TextBox Text="{Binding Text, ElementName=Original, Mode=TwoWay}" Margin="0,8,0,0" />
    <TextBox Text="{Binding Text, ElementName=Original, Mode=OneTime}" Margin="0,8,0,0" />
</StackPanel>
```

Try it:

- Type in the top box. The `OneWay` and `TwoWay` copies follow along. The `OneTime` copy stays as "Coffee".
- Type in the `TwoWay` copy and press **Tab**. The original changes too.
- Type in the `OneWay` copy. The original does not change. Then type in the original again: the `OneWay` copy jumps back in line, throwing away what you typed.

Notice that in the second step the original only changed when you pressed **Tab**, not while you were typing. That is the update source trigger at work.

## UpdateSourceTrigger: when values go back

When the binding sends a value from the control back to the source, `UpdateSourceTrigger` decides the moment:

| Value | When the source is updated |
| --- | --- |
| `PropertyChanged` | Every time the control's value changes, for example each key press |
| `LostFocus` | When the user leaves the control |
| `Explicit` | Only when your code asks |
| `Default` | Whatever the property prefers |

For most properties the default is `PropertyChanged`. The big exception is `TextBox.Text`, which defaults to `LostFocus`. Writing back on every key press could be slow or annoying, for example validating a half typed email address.

### Saving as you type

For a search box or a live preview you want every key press. Say so:

```xml
<TextBox Text="{Binding SearchText, UpdateSourceTrigger=PropertyChanged}" />
```

This one setting is probably the binding option you will type most often in WPF.

### Waiting a moment with Delay

If each change triggers real work, like filtering a long list, add `Delay`. The binding then waits until the user stops typing for that many milliseconds:

```xml
<TextBox Text="{Binding SearchText, UpdateSourceTrigger=PropertyChanged, Delay=400}" />
```

Type "pizza" quickly and the source gets "pizza" once, not "p", "pi", "piz" and so on.

### Explicit: only when the user clicks Save

`Explicit` means "do not write anything back until I say so". This is ideal for a classic edit form with **Save** and **Cancel** buttons. The user can type freely, and the real object only changes on Save.

```xml
<TextBox x:Name="TitleBox"
         Text="{Binding Title, UpdateSourceTrigger=Explicit}" />
<TextBox x:Name="AmountBox"
         Text="{Binding Amount, UpdateSourceTrigger=Explicit}" />
```

In code, each binding is represented by a **binding expression**, the live object WPF creates for that binding on that control. You ask it to push or pull the value:

```csharp
using System.Windows.Controls;

private void Save_Click(object sender, RoutedEventArgs e)
{
    // Copy what the user typed into the Expense object
    TitleBox.GetBindingExpression(TextBox.TextProperty)?.UpdateSource();
    AmountBox.GetBindingExpression(TextBox.TextProperty)?.UpdateSource();
}

private void Cancel_Click(object sender, RoutedEventArgs e)
{
    // Throw away the typing and show the object's values again
    TitleBox.GetBindingExpression(TextBox.TextProperty)?.UpdateTarget();
    AmountBox.GetBindingExpression(TextBox.TextProperty)?.UpdateTarget();
}
```

`UpdateSource()` sends the control value to the object. `UpdateTarget()` does the opposite and reloads the control from the object. The `?.` is there because `GetBindingExpression` returns `null` if the property has no binding.

## Handy extras: FallbackValue and TargetNullValue

Two more binding settings save you from blank or ugly screens:

```xml
<!-- Shown when the value itself is null -->
<TextBlock Text="{Binding Notes, TargetNullValue='(no notes)'}" />

<!-- Shown when the binding cannot get a value at all, for example no DataContext yet -->
<TextBlock Text="{Binding Title, FallbackValue='Loading...'}" />
```

- `TargetNullValue` is for "the data is there but empty".
- `FallbackValue` is for "the binding is broken or has nothing to read yet".

## Common mistakes

- **"My text does not save."** Usually it does, just later than you expect. `TextBox.Text` saves on `LostFocus`. If the user clicks a toolbar button, the box may not lose focus first. Use `UpdateSourceTrigger=PropertyChanged` when that matters.
- **TwoWay binding to a read only property.** If `Total` has only a `get`, then `{Binding Total}` on a `TextBox` throws an error at runtime, because a `TextBox` wants to write back. Add `Mode=OneWay`.
- **Using `OneTime` for something that changes.** It will look fine on first load and then never update.
- **Writing `Mode=TwoWay` everywhere "just in case".** It adds noise, and on a `TextBlock` it does nothing useful. Trust the defaults.
- **Expecting `OneWay` to refresh from a plain object.** A `OneWay` binding only refreshes when the source *announces* a change. Controls always announce. Your own classes must implement `INotifyPropertyChanged`, which is the next lesson.

## Tips

- Use `PropertyChanged` for search boxes, live previews and anything with instant feedback.
- Keep the `LostFocus` default for normal form fields.
- Use `Explicit` (or a copy of the object) when you need a real **Cancel** button.
- Later, in the MVVM lessons, you will usually bind straight to a view model and use commands for Save. The ideas from this lesson stay exactly the same. See [Introduction to MVVM](/courses/wpf/introduction-to-mvvm).

## Quick recap

- `Mode` controls direction: `OneWay`, `TwoWay`, `OneTime` and `OneWayToSource`. Leave it out to get each property's sensible default.
- Input properties such as `TextBox.Text` and `CheckBox.IsChecked` are `TwoWay` by default. Display properties are `OneWay`.
- `UpdateSourceTrigger` controls when values go back: `PropertyChanged`, `LostFocus` or `Explicit`.
- `TextBox.Text` defaults to `LostFocus`. Add `UpdateSourceTrigger=PropertyChanged` for live updates, plus `Delay` for slow work.
- `GetBindingExpression(...).UpdateSource()` and `UpdateTarget()` give you Save and Cancel.
- `TargetNullValue` and `FallbackValue` fill gaps when the value is null or missing.
- Next, make your own classes announce changes in [INotifyPropertyChanged](/courses/wpf/inotifypropertychanged).

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar: edit with Save and Cancel" Width="420" Height="420"&gt;
    &lt;!-- DataContext is an Expense, set in MainWindow.xaml.cs --&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;!-- OneTime: the Id never changes while this form is open --&gt;
        &lt;TextBlock Text="{Binding Id, Mode=OneTime, StringFormat='Editing expense #{0}'}"
                   FontWeight="SemiBold" /&gt;
        &lt;!-- Explicit: nothing is written until Save is clicked --&gt;
        &lt;TextBlock Text="Title" Margin="0,12,0,0" /&gt;
        &lt;TextBox x:Name="TitleBox" Text="{Binding Title, UpdateSourceTrigger=Explicit}" /&gt;
        &lt;TextBlock Text="Amount" Margin="0,8,0,0" /&gt;
        &lt;TextBox x:Name="AmountBox" Text="{Binding Amount, UpdateSourceTrigger=Explicit}" /&gt;
        &lt;TextBlock Text="Category" Margin="0,8,0,0" /&gt;
        &lt;!-- The items (plain strings) are set in code-behind, so SelectedItem is a string like Category --&gt;
        &lt;ComboBox x:Name="CategoryBox" SelectedItem="{Binding Category, UpdateSourceTrigger=Explicit}" /&gt;
        &lt;!-- Bound to the TextBox itself, so it follows every key press even before Save --&gt;
        &lt;TextBlock Text="Live preview of the title box" Margin="0,12,0,0" Foreground="Gray" /&gt;
        &lt;TextBlock Text="{Binding Text, ElementName=TitleBox, Mode=OneWay}" FontSize="16" /&gt;
        &lt;StackPanel Orientation="Horizontal" Margin="0,16,0,0"&gt;
            &lt;Button Content="Save" Click="Save_Click" Padding="16,4" IsDefault="True" /&gt;
            &lt;Button Content="Cancel" Click="Cancel_Click" Padding="16,4" Margin="8,0,0,0" IsCancel="True" /&gt;
        &lt;/StackPanel&gt;
        &lt;TextBlock x:Name="SavedText" Margin="0,12,0,0" Foreground="Gray" TextWrapping="Wrap" /&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using CoinJar.Models;
namespace CoinJar;
public partial class MainWindow : Window
{
    private readonly Expense _expense = new()
    {
        Id = 7,
        Title = "Bus ticket",
        Amount = 2.40m,
        Category = "Transport"
    };
    public MainWindow()
    {
        InitializeComponent();
        // Fill the ComboBox with the five CoinJar categories
        CategoryBox.ItemsSource = new[] { "Food", "Transport", "Bills", "Fun", "Other" };
        DataContext = _expense;
        ShowSaved();
    }
    private void Save_Click(object sender, RoutedEventArgs e)
    {
        // Push each control value into the Expense object
        TitleBox.GetBindingExpression(TextBox.TextProperty)?.UpdateSource();
        AmountBox.GetBindingExpression(TextBox.TextProperty)?.UpdateSource();
        CategoryBox.GetBindingExpression(ComboBox.SelectedItemProperty)?.UpdateSource();
        ShowSaved();
    }
    private void Cancel_Click(object sender, RoutedEventArgs e)
    {
        // Reload each control from the Expense object, dropping the edits
        TitleBox.GetBindingExpression(TextBox.TextProperty)?.UpdateTarget();
        AmountBox.GetBindingExpression(TextBox.TextProperty)?.UpdateTarget();
        CategoryBox.GetBindingExpression(ComboBox.SelectedItemProperty)?.UpdateTarget();
    }
    private void ShowSaved()
    {
        SavedText.Text = $"Saved object: {_expense.Title}, {_expense.Amount:C}, {_expense.Category}";
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
