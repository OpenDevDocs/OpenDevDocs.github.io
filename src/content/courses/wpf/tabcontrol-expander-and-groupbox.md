---
publishDate: 2026-10-25T20:20
title: 'TabControl, Expander and GroupBox'
slug: tabcontrol-expander-and-groupbox
metadescription: 'Organise busy windows with TabControl pages, Expander sections that open and close, and GroupBox frames with a title, and learn the SelectionChanged trap that catches many beginners.'
updateDate: 2026-10-25T20:20
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'tabcontrol', 'expander', 'groupbox']
course: wpf
---

## Too much on one screen

As an app grows, its window fills up. A list, a form, some settings, a few totals... Soon it is hard to find anything. You do not need a new window for every part. WPF has three simple containers that bring order to a busy screen:

- `TabControl` splits content into pages. Only one page shows at a time, like folders with tabs in a filing cabinet.
- `Expander` hides a section until the user clicks its header, like a drawer that slides open.
- `GroupBox` draws a frame with a title around related controls, like a labelled box on a paper form.

All three have something in common: a **header** (a title area) and **content** (what sits under or inside the header). In WPF terms they are all **headered content controls**. Once you know that, they feel very alike.

We will use them to organise **CoinJar**: one tab for the expense list, one for adding an expense, and one for settings.

## TabControl basics

A `TabControl` holds `TabItem` elements. Each `TabItem` has a `Header` (the text on the tab) and one piece of content, usually a panel.

```xml
<TabControl>
    <TabItem Header="Expenses">
        <ListBox Margin="8" />
    </TabItem>
    <TabItem Header="Add expense">
        <StackPanel Margin="8">
            <TextBlock Text="Title" />
            <TextBox />
        </StackPanel>
    </TabItem>
    <TabItem Header="Settings">
        <TextBlock Text="Settings go here" Margin="8" />
    </TabItem>
</TabControl>
```

Click a tab and its content appears. The other tabs' content is hidden, but it is not thrown away. Text you typed in a `TextBox` on one tab is still there when you come back.

### Choosing the starting tab

The first tab is selected by default. Change that with `SelectedIndex` (counting from 0) or `IsSelected` on a tab:

```xml
<TabControl SelectedIndex="1"> ... </TabControl>

<!-- or -->
<TabItem Header="Add expense" IsSelected="True"> ... </TabItem>
```

From code, you can switch tabs by setting the same property. This is handy after the user saves a form and you want to show the list again:

```csharp
private void Save_Click(object sender, RoutedEventArgs e)
{
    // ... save the expense ...
    MainTabs.SelectedIndex = 0; // jump back to the Expenses tab
}
```

Here `MainTabs` is the `x:Name` of the `TabControl`. You can also select a tab by name: `ExpensesTab.IsSelected = true;`.

### Tabs on the side

`TabStripPlacement` moves the tabs. `Top` is the default. `Left` works well when you have many tabs, like a settings window:

```xml
<TabControl TabStripPlacement="Left"> ... </TabControl>
```

### A header with an icon

`Header` is not limited to text. Like `Content` on a button, it can hold any element. Here is a tab with an icon font glyph from [Images, Icons and Media](/courses/wpf/images-and-media):

```xml
<TabItem>
    <TabItem.Header>
        <StackPanel Orientation="Horizontal">
            <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets"
                       Text="&#xE713;" Margin="0,0,6,0" VerticalAlignment="Center" />
            <TextBlock Text="Settings" />
        </StackPanel>
    </TabItem.Header>
    <TextBlock Text="Settings go here" Margin="8" />
</TabItem>
```

This is called **property element syntax**: you open `TabItem.Header` as its own tag so you can put a whole panel inside it. You saw it first in [XAML Syntax Basics](/courses/wpf/xaml-syntax-basics).

## The SelectionChanged trap

`TabControl` has a `SelectionChanged` event that fires when the user picks another tab. It looks simple, but there is a trap.

`SelectionChanged` is a **routed event** that **bubbles**. That means when a `ComboBox` or `ListBox` *inside* a tab changes its selection, the event travels up the tree and reaches the `TabControl` too. Your "tab changed" code then runs when the user only picked a category in a drop down.

The fix is to check where the event came from:

```csharp
private void MainTabs_SelectionChanged(object sender, SelectionChangedEventArgs e)
{
    // Ignore events that bubbled up from a ComboBox or ListBox inside a tab
    if (e.OriginalSource != MainTabs)
        return;

    if (MainTabs.SelectedItem == AddTab)
    {
        TitleBox.Focus(); // put the cursor in the first field
    }
}
```

`e.OriginalSource` is the control that first raised the event. If it is not the `TabControl` itself, the event is not about tabs, so you stop. You can read more about how events travel in [Logical and Visual Trees](/courses/wpf/logical-and-visual-trees).

## The Expander

An `Expander` shows a header with a small arrow. Click it and the content slides into view. Click again and it hides.

```xml
<Expander Header="More options" Margin="0,8,0,0">
    <StackPanel Margin="16,4,0,0">
        <TextBlock Text="Notes" />
        <TextBox Height="60" TextWrapping="Wrap" AcceptsReturn="True" />
        <CheckBox Content="Repeat every month" Margin="0,6,0,0" />
    </StackPanel>
</Expander>
```

This is perfect for things most people skip. The form stays short, and the extra fields are one click away.

Useful properties and events:

| Member | What it does |
| --- | --- |
| `IsExpanded` | `True` to start open. Read it to see the current state. |
| `ExpandDirection` | `Down` (default), `Up`, `Left` or `Right`. |
| `Expanded` | Event that fires when it opens. |
| `Collapsed` | Event that fires when it closes. |

```xml
<Expander x:Name="OptionsExpander" Header="More options"
          Expanded="Options_Expanded" Collapsed="Options_Collapsed">
```

```csharp
private void Options_Expanded(object sender, RoutedEventArgs e)
{
    OptionsExpander.Header = "Fewer options";
}

private void Options_Collapsed(object sender, RoutedEventArgs e)
{
    OptionsExpander.Header = "More options";
}
```

### An accordion of expanders

Stack a few expanders in a `StackPanel` inside a `ScrollViewer` and you get an "accordion", a list of sections that open one at a time or all together. Great for an FAQ page or a list of categories.

```xml
<ScrollViewer VerticalScrollBarVisibility="Auto">
    <StackPanel>
        <Expander Header="Food" IsExpanded="True"> ... </Expander>
        <Expander Header="Transport"> ... </Expander>
        <Expander Header="Bills"> ... </Expander>
    </StackPanel>
</ScrollViewer>
```

## The GroupBox

A `GroupBox` draws a thin border with a title cut into the top line. It does nothing clever. It just tells the user "these controls belong together".

```xml
<GroupBox Header="Paid with" Padding="8" Margin="0,8,0,0">
    <StackPanel Orientation="Horizontal">
        <RadioButton Content="Cash" IsChecked="True" Margin="0,0,12,0" />
        <RadioButton Content="Card" Margin="0,0,12,0" />
        <RadioButton Content="Bank transfer" />
    </StackPanel>
</GroupBox>
```

A `GroupBox` has one child, so put a panel inside it when you need several controls. The `Padding` keeps the content away from the border.

A nice side effect: the radio buttons above sit in one container, so they form one group without needing a `GroupName`. You learned about radio button groups in [Buttons, CheckBoxes and RadioButtons](/courses/wpf/buttons-and-toggle-controls).

## Which one should I use?

| Situation | Use |
| --- | --- |
| Several big areas the user switches between | `TabControl` |
| Optional or advanced fields | `Expander` |
| A few related fields on the same screen | `GroupBox` |
| Many settings pages | `TabControl` with `TabStripPlacement="Left"` |

You can mix them freely. A tab can hold group boxes, and a group box can hold an expander.

## Tips and common mistakes

- **Do not hide important things.** People may never open an `Expander` or click a third tab. Keep the main action on the first screen.
- **Keep tab names short.** One or two words. Long headers make the tab strip wrap onto two rows.
- **Check `e.OriginalSource` in `SelectionChanged`.** This is the most common `TabControl` bug.
- **`Loaded` fires again.** The content of a tab is loaded each time its tab is shown. If you run setup code in a `Loaded` handler inside a tab, it can run many times. Guard it with a flag if it should run once.
- **Do not make a tab for one control.** If a tab holds only a single checkbox, it probably belongs in a `GroupBox` on another tab.
- **Later, generate tabs from data.** `TabControl` is an items control, like `ListBox`, so it can create tabs from a list. You will see how with `ItemsSource` in [Binding to Collections](/courses/wpf/binding-to-collections).

## Quick recap

- `TabControl`, `Expander` and `GroupBox` all have a `Header` and one piece of content.
- `TabControl` holds `TabItem` pages. Use `SelectedIndex` or `IsSelected` to pick one, and `TabStripPlacement` to move the tabs.
- `SelectionChanged` bubbles up from inner list controls. Compare `e.OriginalSource` with the `TabControl`.
- `Expander` hides optional content. Use `IsExpanded`, `ExpandDirection`, and the `Expanded` and `Collapsed` events.
- `GroupBox` frames related controls with a title. Give it a panel as its child.
- Next, you will stop copying values in and out of controls by hand and learn [Data Binding Basics](/courses/wpf/data-binding-basics).

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Width="560" Height="460"&gt;
    &lt;TabControl x:Name="MainTabs" Margin="8" SelectionChanged="MainTabs_SelectionChanged"&gt;
        &lt;!-- Tab 1: the list --&gt;
        &lt;TabItem x:Name="ExpensesTab" Header="Expenses"&gt;
            &lt;DockPanel Margin="8"&gt;
                &lt;TextBlock x:Name="CountText" DockPanel.Dock="Bottom" Text="0 expenses"
                           Margin="0,8,0,0" Foreground="Gray" /&gt;
                &lt;ListBox x:Name="ExpenseList" /&gt;
            &lt;/DockPanel&gt;
        &lt;/TabItem&gt;
        &lt;!-- Tab 2: the form, with a GroupBox and an Expander --&gt;
        &lt;TabItem x:Name="AddTab" Header="Add expense"&gt;
            &lt;ScrollViewer VerticalScrollBarVisibility="Auto"&gt;
                &lt;StackPanel Margin="8"&gt;
                    &lt;TextBlock Text="Title" /&gt;
                    &lt;TextBox x:Name="TitleBox" /&gt;
                    &lt;TextBlock Text="Amount" Margin="0,8,0,0" /&gt;
                    &lt;TextBox x:Name="AmountBox" /&gt;
                    &lt;TextBlock Text="Category" Margin="0,8,0,0" /&gt;
                    &lt;ComboBox x:Name="CategoryBox" SelectedIndex="0"&gt;
                        &lt;ComboBoxItem Content="Food" /&gt;
                        &lt;ComboBoxItem Content="Transport" /&gt;
                        &lt;ComboBoxItem Content="Bills" /&gt;
                        &lt;ComboBoxItem Content="Fun" /&gt;
                        &lt;ComboBoxItem Content="Other" /&gt;
                    &lt;/ComboBox&gt;
                    &lt;GroupBox Header="Paid with" Padding="8" Margin="0,8,0,0"&gt;
                        &lt;StackPanel Orientation="Horizontal"&gt;
                            &lt;RadioButton x:Name="CashRadio" Content="Cash" IsChecked="True" Margin="0,0,12,0" /&gt;
                            &lt;RadioButton Content="Card" Margin="0,0,12,0" /&gt;
                            &lt;RadioButton Content="Bank transfer" /&gt;
                        &lt;/StackPanel&gt;
                    &lt;/GroupBox&gt;
                    &lt;Expander x:Name="OptionsExpander" Header="More options" Margin="0,8,0,0"
                              Expanded="Options_Expanded" Collapsed="Options_Collapsed"&gt;
                        &lt;StackPanel Margin="16,4,0,0"&gt;
                            &lt;TextBlock Text="Notes" /&gt;
                            &lt;TextBox x:Name="NotesBox" Height="60" TextWrapping="Wrap" AcceptsReturn="True" /&gt;
                        &lt;/StackPanel&gt;
                    &lt;/Expander&gt;
                    &lt;Button Content="Save" Click="Save_Click" HorizontalAlignment="Left"
                            Padding="16,4" Margin="0,12,0,0" /&gt;
                &lt;/StackPanel&gt;
            &lt;/ScrollViewer&gt;
        &lt;/TabItem&gt;
        &lt;!-- Tab 3: settings, with an icon in the header --&gt;
        &lt;TabItem&gt;
            &lt;TabItem.Header&gt;
                &lt;StackPanel Orientation="Horizontal"&gt;
                    &lt;TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&amp;#xE713;"
                               Margin="0,0,6,0" VerticalAlignment="Center" /&gt;
                    &lt;TextBlock Text="Settings" /&gt;
                &lt;/StackPanel&gt;
            &lt;/TabItem.Header&gt;
            &lt;StackPanel Margin="8"&gt;
                &lt;GroupBox Header="Display" Padding="8"&gt;
                    &lt;StackPanel&gt;
                        &lt;CheckBox Content="Show cents" IsChecked="True" /&gt;
                        &lt;CheckBox Content="Start on the Add tab" Margin="0,6,0,0" /&gt;
                    &lt;/StackPanel&gt;
                &lt;/GroupBox&gt;
            &lt;/StackPanel&gt;
        &lt;/TabItem&gt;
    &lt;/TabControl&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
    private void MainTabs_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        // The ComboBox and ListBox inside the tabs raise SelectionChanged too.
        // Only react when the TabControl itself changed.
        if (e.OriginalSource != MainTabs)
            return;
        if (MainTabs.SelectedItem == AddTab)
        {
            // Wait until the tab content is on screen, then focus the first box
            Dispatcher.BeginInvoke(() =&gt; TitleBox.Focus());
        }
    }
    private void Save_Click(object sender, RoutedEventArgs e)
    {
        var category = ((ComboBoxItem)CategoryBox.SelectedItem).Content;
        var paidWith = CashRadio.IsChecked == true ? "cash" : "other";
        ExpenseList.Items.Add($"{TitleBox.Text}: {AmountBox.Text} ({category}, {paidWith})");
        CountText.Text = $"{ExpenseList.Items.Count} expenses";
        // Clear the form and go back to the list
        TitleBox.Clear();
        AmountBox.Clear();
        NotesBox.Clear();
        OptionsExpander.IsExpanded = false;
        MainTabs.SelectedIndex = 0;
    }
    private void Options_Expanded(object sender, RoutedEventArgs e)
    {
        OptionsExpander.Header = "Fewer options";
    }
    private void Options_Collapsed(object sender, RoutedEventArgs e)
    {
        OptionsExpander.Header = "More options";
    }
}
</code></pre>
