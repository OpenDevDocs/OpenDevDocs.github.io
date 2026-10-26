---
publishDate: 2026-10-25T20:15
title: 'Text Controls: TextBlock, Label and TextBox'
slug: text-controls
metadescription: 'Learn the WPF controls for showing and typing text: TextBlock with wrapping and inline formatting, Label with access keys, TextBox for input, and PasswordBox.'
updateDate: 2026-10-25T20:15
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'controls', 'textbox', 'textblock', 'beginners']
course: wpf
---

## Showing text and reading text

Almost every window shows some text and asks the user to type some. WPF has a small family of controls for this:

| Control | Job |
| --- | --- |
| `TextBlock` | Shows read only text. Light and fast. |
| `Label` | Shows a caption for another control, with keyboard shortcut support. |
| `TextBox` | Lets the user type and edit text. |
| `PasswordBox` | Like a `TextBox`, but hides what is typed. |

A **control** is an element the user can see and usually interact with, such as a button or a text box. You have already used a few of these in the layout lessons. Now you will learn them properly. This lesson and the next few still use code-behind and `x:Name` to read and change values. In [Data Binding Basics](/courses/wpf/data-binding-basics) you will learn a cleaner way to connect controls to data.

## TextBlock: showing text

`TextBlock` is the everyday way to put text on the screen:

```xml
<TextBlock Text="Monthly total" FontSize="18" FontWeight="SemiBold" Foreground="SteelBlue" />
```

The most useful properties:

- `Text`: the text to show.
- `FontSize`: size in device independent pixels. The default is 12.
- `FontWeight`: `Normal`, `SemiBold`, `Bold`, and others.
- `FontStyle`: `Normal` or `Italic`.
- `FontFamily`: for example `"Segoe UI"` or `"Consolas"`.
- `Foreground`: the text colour.
- `TextAlignment`: `Left`, `Center`, `Right` or `Justify`, for the lines inside the block.

Font properties are **inherited** down the tree. Set `FontSize="14"` on the `Window` and every text inside it becomes 14, unless a child sets its own. This is a quick way to make a whole window easier to read.

### Wrapping and trimming

By default a `TextBlock` puts everything on one line. If the line is too long, it is simply cut off at the edge. Two properties fix that:

```xml
<!-- Wrap onto new lines -->
<TextBlock TextWrapping="Wrap"
           Text="CoinJar keeps track of where your money goes, one coin at a time." />

<!-- Stay on one line, end with ... if too long -->
<TextBlock TextTrimming="CharacterEllipsis"
           Text="A very long expense title that will not fit in a narrow column" />
```

`TextTrimming` can be `CharacterEllipsis` (cut anywhere) or `WordEllipsis` (cut at the end of a word). Both need the `TextBlock` to have a limited width to have any effect, as you saw in [Building Resizable Layouts](/courses/wpf/building-resizable-layouts).

### Mixed formatting with inlines

A `TextBlock` can hold **inlines**, small pieces of text with their own formatting. `Run` is a piece of plain text, and `Bold`, `Italic`, `Underline` and `LineBreak` do what their names say:

```xml
<TextBlock TextWrapping="Wrap">
    <Run Text="You spent" />
    <Bold><Run x:Name="AmountRun" Text="42.50" /></Bold>
    <Run Text="on" />
    <Run Text="Food" Foreground="SeaGreen" />
    <Run Text="this week." />
    <LineBreak />
    <Italic>That is less than last week.</Italic>
</TextBlock>
```

Notice that the runs have no spaces at their ends. That is because the line break between two inlines in XAML already turns into one space on screen. If you also add spaces inside the `Text`, you get double spaces.

Give a `Run` an `x:Name` and you can change just that part from code: `AmountRun.Text = "42.50";`.

## Label: a caption with a shortcut key

At first a `Label` looks like a `TextBlock`. The difference is that a `Label` is made to **describe another control**, and it supports **access keys**. An access key is the underlined letter you can press with Alt to jump to a control.

```xml
<Label Content="_Title:" Target="{Binding ElementName=TitleBox}" />
<TextBox x:Name="TitleBox" />
```

The underscore before `T` makes T the access key. Press Alt+T and the keyboard focus jumps to `TitleBox`. Windows shows the underline when the user holds Alt.

`Target` uses a small binding, `{Binding ElementName=TitleBox}`, which simply means "the element named TitleBox". You will learn bindings properly later. For now, copy the pattern.

Other things to know:

- A `Label` uses `Content`, not `Text`. Content can be any object, even an image.
- A `Label` has some default `Padding` (5 on each side), so it lines up slightly differently from a `TextBlock`.
- If you need a literal underscore in a label, write two: `Content="File__name"` shows "File_name".

Use `Label` for form captions where a keyboard shortcut helps. Use `TextBlock` for everything else, because it is lighter.

## TextBox: typing text

A `TextBox` is a box the user can type in. Read and write its text with the `Text` property:

```xml
<TextBox x:Name="TitleBox" Width="240" MaxLength="40" />
```

```csharp
string title = TitleBox.Text;   // read what the user typed
TitleBox.Text = "Lunch";       // replace it
TitleBox.Clear();              // empty it
TitleBox.Focus();              // put the cursor in it
TitleBox.SelectAll();          // select everything, handy after Focus()
```

Useful properties:

- `MaxLength`: the most characters the user can type. `0` (the default) means no limit.
- `IsReadOnly`: the user can select and copy, but not change the text.
- `IsEnabled="False"`: greyed out and not usable at all.
- `CharacterCasing`: `Upper` or `Lower` forces the case as the user types.
- `SpellCheck.IsEnabled="True"`: red wavy lines under misspelled words.

### Multi line text

A normal `TextBox` is a single line. For notes or comments, allow new lines and wrapping:

```xml
<TextBox x:Name="NotesBox"
         AcceptsReturn="True"
         TextWrapping="Wrap"
         VerticalScrollBarVisibility="Auto"
         MinHeight="80" />
```

`AcceptsReturn="True"` lets the Enter key add a new line instead of pressing the default button. `AcceptsTab="True"` does the same for the Tab key, which otherwise moves focus to the next control.

### Reacting to typing

The `TextChanged` event fires every time the text changes, after each key press:

```csharp
private void TitleBox_TextChanged(object sender, TextChangedEventArgs e)
{
    CounterText.Text = $"{TitleBox.Text.Length} / {TitleBox.MaxLength}";
}
```

To do something when the user presses Enter, handle `KeyDown`:

```csharp
private void TitleBox_KeyDown(object sender, KeyEventArgs e)
{
    if (e.Key == Key.Enter)
    {
        AmountBox.Focus();   // jump to the next box
        e.Handled = true;    // we dealt with this key, stop it here
    }
}
```

`KeyEventArgs` and `Key` live in the `System.Windows.Input` namespace.

### Turning text into numbers

A `TextBox` always gives you a `string`. To get a number, parse it with `TryParse`, which returns `false` instead of crashing when the text is not a valid number:

```csharp
if (decimal.TryParse(AmountBox.Text, NumberStyles.Number, CultureInfo.CurrentCulture, out decimal amount))
{
    ResultText.Text = $"Amount: {amount:C}";
}
else
{
    ResultText.Text = "Please type a number, for example 12.50";
}
```

`CultureInfo.CurrentCulture` means "use the user's own settings". In Germany the user types `12,50`, in the US `12.50`, and both work. The `:C` format shows the number as money in that same culture. `NumberStyles` and `CultureInfo` are in `System.Globalization`. Using `decimal` for money (not `double`) avoids rounding surprises, as covered in [Variables and Data Types](/courses/c-sharp/variables-and-data-types).

### Placeholder text

WPF's `TextBox` has no built in placeholder (the grey hint text shown while the box is empty). A simple trick uses what you learned in [The Grid Panel](/courses/wpf/the-grid-panel): put a grey `TextBlock` in the same cell, on top of the box, and hide it once the user types.

```xml
<Grid>
    <TextBox x:Name="SearchBox" TextChanged="SearchBox_TextChanged" Padding="4" />
    <TextBlock x:Name="SearchHint" Text="Search expenses..." Foreground="Gray"
               Margin="8,0,0,0" VerticalAlignment="Center" IsHitTestVisible="False" />
</Grid>
```

```csharp
private void SearchBox_TextChanged(object sender, TextChangedEventArgs e)
{
    SearchHint.Visibility = SearchBox.Text.Length == 0 ? Visibility.Visible : Visibility.Collapsed;
}
```

`IsHitTestVisible="False"` lets mouse clicks pass through the hint to the box underneath. In [Styles and Setters](/courses/wpf/styles-and-setters) and [Control Templates](/courses/wpf/control-templates) you will see reusable ways to do this.

## PasswordBox: hidden input

A `PasswordBox` hides each typed character behind a dot:

```xml
<PasswordBox x:Name="PinBox" MaxLength="6" PasswordChar="*" PasswordChanged="PinBox_PasswordChanged" />
```

```csharp
private void PinBox_PasswordChanged(object sender, RoutedEventArgs e)
{
    UnlockButton.IsEnabled = PinBox.Password.Length >= 4;
}
```

Read the typed value with the `Password` property. Note that it has no `Text` property and fires `PasswordChanged`, not `TextChanged`. On purpose, `Password` cannot be data bound in the normal way, so that the secret is not copied around in memory more than needed. Never save a password as plain text in a file.

## Common mistakes

- **Using `TextBox` to show read only text.** Use a `TextBlock`. If the user should be able to copy it, use a `TextBox` with `IsReadOnly="True"`.
- **Long text that runs off the edge.** Add `TextWrapping="Wrap"` or `TextTrimming`.
- **`int.Parse` on user input.** It throws an exception on bad input. Use `TryParse`. You can read more about exceptions in [Exception Handling](/courses/c-sharp/exception-handling).
- **A crash in `TextChanged` at start up.** If you set `Text` in XAML, `TextChanged` fires while `InitializeComponent` is still running, before controls further down the file exist. Check for `null` first: `if (CounterText is null) return;`.
- **Expecting Enter to add a new line.** It only does with `AcceptsReturn="True"`.

## Quick recap

- `TextBlock` shows text. Use `TextWrapping` and `TextTrimming` for long text, and inlines (`Run`, `Bold`, `LineBreak`) for mixed formatting.
- Font properties such as `FontSize` are inherited from parent elements.
- `Label` is a caption with an access key: `_Title` plus `Target` jumps to a control with Alt+T.
- `TextBox` reads input through `Text`. Useful extras: `MaxLength`, `IsReadOnly`, `AcceptsReturn`, `SpellCheck.IsEnabled`.
- `TextChanged` and `KeyDown` let code-behind react to typing.
- Parse numbers with `decimal.TryParse` and the current culture.
- `PasswordBox` hides input. Read it with `Password`.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar: new expense" Width="480" Height="460" MinWidth="380" MinHeight="400"
        FontSize="13"&gt;
    &lt;!-- FontSize on the Window is inherited by every text inside --&gt;
    &lt;Grid Margin="16" RowDefinitions="Auto,Auto,Auto,Auto,*,Auto" ColumnDefinitions="Auto,*"&gt;
        &lt;!-- Row 0: Title. The underscore makes Alt+T jump to TitleBox. --&gt;
        &lt;Label Grid.Row="0" Content="_Title:" Target="{Binding ElementName=TitleBox}" VerticalAlignment="Center" /&gt;
        &lt;Grid Grid.Row="0" Grid.Column="1" Margin="0,0,0,8"&gt;
            &lt;TextBox x:Name="TitleBox" MaxLength="40" Padding="4"
                     TextChanged="TitleBox_TextChanged" KeyDown="TitleBox_KeyDown" /&gt;
            &lt;!-- Placeholder trick: a grey TextBlock on top of the box, clicks pass through --&gt;
            &lt;TextBlock x:Name="TitleHint" Text="What did you buy?" Foreground="Gray"
                       Margin="8,0,0,0" VerticalAlignment="Center" IsHitTestVisible="False" /&gt;
        &lt;/Grid&gt;
        &lt;TextBlock x:Name="CounterText" Grid.Row="1" Grid.Column="1" Text="0 / 40"
                   HorizontalAlignment="Right" Foreground="DimGray" Margin="0,-6,0,8" /&gt;
        &lt;!-- Row 2: Amount --&gt;
        &lt;Label Grid.Row="2" Content="_Amount:" Target="{Binding ElementName=AmountBox}" VerticalAlignment="Center" /&gt;
        &lt;TextBox x:Name="AmountBox" Grid.Row="2" Grid.Column="1" Padding="4" Margin="0,0,0,8" /&gt;
        &lt;!-- Row 3: Notes caption --&gt;
        &lt;Label Grid.Row="3" Content="_Notes:" Target="{Binding ElementName=NotesBox}" /&gt;
        &lt;!-- Row 4: a multi line TextBox that fills the leftover height --&gt;
        &lt;TextBox x:Name="NotesBox" Grid.Row="4" Grid.Column="0" Grid.ColumnSpan="2" Padding="4"
                 AcceptsReturn="True" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto"
                 SpellCheck.IsEnabled="True" Margin="0,0,0,8" /&gt;
        &lt;!-- Row 5: button and a preview built from inlines --&gt;
        &lt;DockPanel Grid.Row="5" Grid.ColumnSpan="2"&gt;
            &lt;Button DockPanel.Dock="Right" Content="Preview" Padding="16,4" IsDefault="True" Click="PreviewButton_Click" /&gt;
            &lt;TextBlock TextWrapping="Wrap" VerticalAlignment="Center" Margin="0,0,12,0"&gt;
                &lt;Run x:Name="PreviewTitleRun" Text="Nothing yet" FontWeight="SemiBold" /&gt;
                &lt;Run x:Name="PreviewAmountRun" Foreground="SeaGreen" /&gt;
            &lt;/TextBlock&gt;
        &lt;/DockPanel&gt;
    &lt;/Grid&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        TitleBox.Focus();
    }
    private void TitleBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        // Can fire during InitializeComponent, before later controls exist
        if (CounterText is null || TitleHint is null) return;
        CounterText.Text = $"{TitleBox.Text.Length} / {TitleBox.MaxLength}";
        TitleHint.Visibility = TitleBox.Text.Length == 0 ? Visibility.Visible : Visibility.Collapsed;
    }
    private void TitleBox_KeyDown(object sender, KeyEventArgs e)
    {
        // Enter in the title box moves on to the amount box
        if (e.Key == Key.Enter)
        {
            AmountBox.Focus();
            AmountBox.SelectAll();
            e.Handled = true;
        }
    }
    private void PreviewButton_Click(object sender, RoutedEventArgs e)
    {
        string title = TitleBox.Text.Trim();
        if (title.Length == 0)
        {
            PreviewTitleRun.Text = "Please type a title.";
            PreviewAmountRun.Text = "";
            TitleBox.Focus();
            return;
        }
        // TryParse never throws. CurrentCulture accepts 12.50 or 12,50 depending on the user's settings.
        if (!decimal.TryParse(AmountBox.Text, NumberStyles.Number, CultureInfo.CurrentCulture, out decimal amount)
            || amount &lt;= 0)
        {
            PreviewTitleRun.Text = "The amount must be a positive number.";
            PreviewAmountRun.Text = "";
            AmountBox.Focus();
            AmountBox.SelectAll();
            return;
        }
        // Change just the parts of the TextBlock we named
        PreviewTitleRun.Text = title;
        PreviewAmountRun.Text = amount.ToString("C", CultureInfo.CurrentCulture);
        if (NotesBox.Text.Length &gt; 0)
        {
            PreviewAmountRun.Text += $" ({NotesBox.LineCount} line(s) of notes)";
        }
    }
}
</code></pre>
