---
publishDate: 2026-10-25T20:19
title: 'Menus, ToolBars and StatusBars'
slug: menus-toolbars-and-status-bars
metadescription: 'Build a classic desktop window frame with a Menu, right click ContextMenu, ToolBar and StatusBar, add access keys and real keyboard shortcuts, and update the status bar from code.'
updateDate: 2026-10-25T20:19
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'menu', 'toolbar', 'statusbar']
course: wpf
---

## The frame around your app

Open almost any desktop program and you will see the same three bars:

- A **menu bar** at the top with words like File, Edit and Help.
- A **toolbar** under it with small buttons for the most used actions.
- A **status bar** at the bottom that shows short facts, such as "12 expenses" or "Saved".

People already know how these work, so adding them makes your app feel familiar from the first click. In this lesson you will build all three for **CoinJar**, the small expense tracker that this course grows step by step.

The usual layout tool for this is a `DockPanel` (from [StackPanel, WrapPanel and DockPanel](/courses/wpf/stackpanel-wrappanel-and-dockpanel)). The menu and toolbar dock to the top, the status bar docks to the bottom, and the main content fills the rest:

```xml
<DockPanel>
    <Menu DockPanel.Dock="Top"> ... </Menu>
    <ToolBarTray DockPanel.Dock="Top"> ... </ToolBarTray>
    <StatusBar DockPanel.Dock="Bottom"> ... </StatusBar>
    <!-- The last child fills the space that is left -->
    <ListBox />
</DockPanel>
```

Order matters in a `DockPanel`. Put the docked bars first and the main content last.

## The Menu control

A `Menu` holds `MenuItem` elements. Each `MenuItem` has a `Header` (the text you see) and can hold more `MenuItem` elements, which become its drop down list.

```xml
<Menu DockPanel.Dock="Top">
    <MenuItem Header="_File">
        <MenuItem Header="_New expense" Click="NewExpense_Click" />
        <MenuItem Header="_Open..." />
        <Separator />
        <MenuItem Header="E_xit" Click="Exit_Click" />
    </MenuItem>
    <MenuItem Header="_Help">
        <MenuItem Header="_About CoinJar" Click="About_Click" />
    </MenuItem>
</Menu>
```

A few details in there:

- `Separator` draws a thin line to group related items.
- `Click` works just like a button click, which you met in [Code-Behind and Event Handlers](/courses/wpf/code-behind-and-event-handlers).
- The three dots in `Open...` are a Windows habit. They tell the user "this opens a window and asks you something first".

```csharp
private void Exit_Click(object sender, RoutedEventArgs e)
{
    Close(); // closing the main window ends the app
}

private void About_Click(object sender, RoutedEventArgs e)
{
    MessageBox.Show("CoinJar 1.0\nA tiny expense tracker.", "About");
}
```

### Access keys with the underscore

The underscore in `_File` makes **F** the **access key**. Press **Alt**, and the letters get underlined. Then press **F** to open the File menu, and **N** to pick "New expense". Keyboard users love this and it costs you one character.

If you need a real underscore in the text, write two: `Header="Save__as"` shows "Save_as".

### Sub menus, check marks and icons

Menus can nest as deep as you like, but two levels is plenty for most apps.

```xml
<MenuItem Header="_View">
    <MenuItem Header="Show _toolbar" IsCheckable="True" IsChecked="True"
              Click="ShowToolbar_Click" />
    <MenuItem Header="_Sort by">
        <MenuItem Header="_Date" />
        <MenuItem Header="_Amount" />
    </MenuItem>
</MenuItem>
```

`IsCheckable="True"` turns the item into an on and off switch with a tick mark. Read `IsChecked` in your handler to see the new state:

```csharp
private void ShowToolbar_Click(object sender, RoutedEventArgs e)
{
    var item = (MenuItem)sender;
    MainToolBarTray.Visibility = item.IsChecked
        ? Visibility.Visible
        : Visibility.Collapsed;
}
```

The `Icon` property puts a small picture to the left of the text. Any element works, so the icon font trick from [Images, Icons and Media](/courses/wpf/images-and-media) fits nicely:

```xml
<MenuItem Header="_Delete" Click="Delete_Click">
    <MenuItem.Icon>
        <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE74D;" />
    </MenuItem.Icon>
</MenuItem>
```

## Real keyboard shortcuts

You may see `InputGestureText="Ctrl+N"` on a `MenuItem`. Be careful: it only **shows** the text "Ctrl+N" next to the item. It does not make the keys do anything.

To get a working shortcut, use one of WPF's built in **commands**. A **command** is an action with a name, a default shortcut and a default label, which several controls can share. `ApplicationCommands.New` already knows that its shortcut is **Ctrl+N**.

You connect a command to your code with a `CommandBinding` on the window:

```xml
<Window.CommandBindings>
    <CommandBinding Command="ApplicationCommands.New" Executed="New_Executed" />
</Window.CommandBindings>
```

```csharp
private void New_Executed(object sender, ExecutedRoutedEventArgs e)
{
    AddExpense("New expense");
}
```

Now point the menu item at the command instead of a `Click` handler:

```xml
<MenuItem Command="ApplicationCommands.New" Header="_New expense" />
```

Three things happen for free. The menu shows "Ctrl+N" by itself, pressing **Ctrl+N** anywhere in the window runs `New_Executed`, and any toolbar button with the same command runs the same code. Other built in ones include `ApplicationCommands.Open`, `Save`, `Copy`, `Paste`, `Delete` and `Help`.

Commands are a big topic. You will write your own in [Commands and ICommand](/courses/wpf/commands-and-icommand) and add custom shortcuts in [Keyboard Shortcuts and Focus](/courses/wpf/keyboard-shortcuts-and-focus). For now, the built in ones are a quick win.

## Right click menus with ContextMenu

A **context menu** is the small menu that pops up when you right click something. Any element can have one through its `ContextMenu` property:

```xml
<ListBox x:Name="ExpenseList">
    <ListBox.ContextMenu>
        <ContextMenu>
            <MenuItem Header="_Rename" Click="Rename_Click" />
            <MenuItem Header="_Delete" Click="Delete_Click" />
        </ContextMenu>
    </ListBox.ContextMenu>
</ListBox>
```

It holds the same `MenuItem` elements as the main menu, so everything above still applies. Right click the list and the menu appears where the mouse is. The keyboard works too: the **Menu** key or **Shift+F10** opens it.

## ToolBar and ToolBarTray

A `ToolBar` is a strip of small controls. Place one or more toolbars inside a `ToolBarTray`, which lines them up and lets the user drag them around.

```xml
<ToolBarTray x:Name="MainToolBarTray" DockPanel.Dock="Top">
    <ToolBar>
        <Button Command="ApplicationCommands.New" ToolTip="New expense (Ctrl+N)">
            <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE710;" />
        </Button>
        <Button Click="Delete_Click" ToolTip="Delete selected">
            <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE74D;" />
        </Button>
        <Separator />
        <TextBlock Text="Category:" VerticalAlignment="Center" Margin="4,0" />
        <ComboBox x:Name="CategoryBox" Width="110" SelectedIndex="0">
            <ComboBoxItem Content="All" />
            <ComboBoxItem Content="Food" />
            <ComboBoxItem Content="Transport" />
        </ComboBox>
    </ToolBar>
</ToolBarTray>
```

Things to notice:

- Controls inside a `ToolBar` get a flat toolbar look automatically. The same `Button` looks different here than in a normal panel.
- Icon only buttons need a `ToolTip`. Without one, nobody knows what the button does.
- The toolbar button uses the same `ApplicationCommands.New` as the menu, so both run the same code.

### Overflow

When the window is too narrow, extra toolbar items move into a small drop down arrow at the end of the toolbar. You can control this per item with `ToolBar.OverflowMode`:

```xml
<!-- Never hide this one -->
<Button ToolBar.OverflowMode="Never" Content="Add" />
<!-- Always keep this one in the overflow menu -->
<Button ToolBar.OverflowMode="Always" Content="Export" />
```

The default is `AsNeeded`. Lock the most important buttons with `Never`.

## The StatusBar

A `StatusBar` is a strip at the bottom that holds `StatusBarItem` elements. It is for short, passive information: the user reads it, but does not usually click it.

```xml
<StatusBar DockPanel.Dock="Bottom">
    <StatusBarItem>
        <TextBlock x:Name="CountText" Text="0 expenses" />
    </StatusBarItem>
    <Separator />
    <StatusBarItem>
        <TextBlock x:Name="MessageText" Text="Ready" />
    </StatusBarItem>
    <!-- HorizontalAlignment="Right" pushes this item to the far right -->
    <StatusBarItem HorizontalAlignment="Right">
        <TextBlock x:Name="ClockText" />
    </StatusBarItem>
</StatusBar>
```

Give the `TextBlock` elements names and update them from code whenever something changes:

```csharp
private void UpdateStatus(string message)
{
    CountText.Text = $"{ExpenseList.Items.Count} expenses";
    MessageText.Text = message;
}
```

Setting the text by hand works, but it is easy to forget a spot. In [Data Binding Basics](/courses/wpf/data-binding-basics) you will let the status bar update itself.

## Tips

- **Keep menus short.** If a menu has more than about ten items, split it or move rare items into a sub menu.
- **Use the common names.** File, Edit, View, Help. People look for "Exit" under File and "About" under Help.
- **The toolbar is a shortcut, not a replacement.** Every toolbar action should also be in a menu, so keyboard users can reach it.
- **Do not put errors only in the status bar.** People rarely look down there. Use it for "Saved" or a count, and show real problems in a message box.
- **Disable rather than hide.** If "Delete" does nothing because nothing is selected, set `IsEnabled="False"` so people can still see the action exists. Commands can do this for you automatically, as you will see later.

## Quick recap

- Dock a `Menu` and a `ToolBarTray` to the top and a `StatusBar` to the bottom of a `DockPanel`.
- `MenuItem` has a `Header`, a `Click` event, child items, `IsCheckable`, and an `Icon`.
- An underscore in a header makes an access key. `InputGestureText` only shows text.
- Built in commands such as `ApplicationCommands.New` plus a `CommandBinding` give real shortcuts shared by menus and toolbar buttons.
- `ContextMenu` gives any element a right click menu.
- `ToolBar` items get a flat look and can overflow. Give icon buttons a `ToolTip`.
- The `StatusBar` shows short facts. Update it from code for now, and with binding soon.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Width="640" Height="420"&gt;
    &lt;!-- Connect built in commands to our code. Ctrl+N and Delete now work. --&gt;
    &lt;Window.CommandBindings&gt;
        &lt;CommandBinding Command="ApplicationCommands.New" Executed="New_Executed" /&gt;
        &lt;CommandBinding Command="ApplicationCommands.Delete" Executed="Delete_Executed" /&gt;
    &lt;/Window.CommandBindings&gt;
    &lt;DockPanel&gt;
        &lt;!-- 1. Menu bar --&gt;
        &lt;Menu DockPanel.Dock="Top"&gt;
            &lt;MenuItem Header="_File"&gt;
                &lt;MenuItem Command="ApplicationCommands.New" Header="_New expense" /&gt;
                &lt;Separator /&gt;
                &lt;MenuItem Header="E_xit" Click="Exit_Click" /&gt;
            &lt;/MenuItem&gt;
            &lt;MenuItem Header="_Edit"&gt;
                &lt;MenuItem Command="ApplicationCommands.Delete" Header="_Delete expense"&gt;
                    &lt;MenuItem.Icon&gt;
                        &lt;TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&amp;#xE74D;" /&gt;
                    &lt;/MenuItem.Icon&gt;
                &lt;/MenuItem&gt;
            &lt;/MenuItem&gt;
            &lt;MenuItem Header="_View"&gt;
                &lt;MenuItem Header="Show _toolbar" IsCheckable="True" IsChecked="True"
                          Click="ShowToolbar_Click" /&gt;
            &lt;/MenuItem&gt;
            &lt;MenuItem Header="_Help"&gt;
                &lt;MenuItem Header="_About CoinJar" Click="About_Click" /&gt;
            &lt;/MenuItem&gt;
        &lt;/Menu&gt;
        &lt;!-- 2. Toolbar --&gt;
        &lt;ToolBarTray x:Name="MainToolBarTray" DockPanel.Dock="Top"&gt;
            &lt;ToolBar&gt;
                &lt;Button Command="ApplicationCommands.New" ToolTip="New expense (Ctrl+N)"
                        ToolBar.OverflowMode="Never"&gt;
                    &lt;TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&amp;#xE710;" /&gt;
                &lt;/Button&gt;
                &lt;Button Command="ApplicationCommands.Delete" ToolTip="Delete selected (Del)"&gt;
                    &lt;TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&amp;#xE74D;" /&gt;
                &lt;/Button&gt;
                &lt;Separator /&gt;
                &lt;TextBlock Text="Category:" VerticalAlignment="Center" Margin="4,0" /&gt;
                &lt;ComboBox x:Name="CategoryBox" Width="110" SelectedIndex="0"&gt;
                    &lt;ComboBoxItem Content="Food" /&gt;
                    &lt;ComboBoxItem Content="Transport" /&gt;
                    &lt;ComboBoxItem Content="Bills" /&gt;
                    &lt;ComboBoxItem Content="Fun" /&gt;
                    &lt;ComboBoxItem Content="Other" /&gt;
                &lt;/ComboBox&gt;
            &lt;/ToolBar&gt;
        &lt;/ToolBarTray&gt;
        &lt;!-- 3. Status bar --&gt;
        &lt;StatusBar DockPanel.Dock="Bottom"&gt;
            &lt;StatusBarItem&gt;
                &lt;TextBlock x:Name="CountText" Text="0 expenses" /&gt;
            &lt;/StatusBarItem&gt;
            &lt;Separator /&gt;
            &lt;StatusBarItem&gt;
                &lt;TextBlock x:Name="MessageText" Text="Ready" /&gt;
            &lt;/StatusBarItem&gt;
        &lt;/StatusBar&gt;
        &lt;!-- 4. Main content fills the rest, with a right click menu --&gt;
        &lt;ListBox x:Name="ExpenseList" Margin="8"&gt;
            &lt;ListBox.ContextMenu&gt;
                &lt;ContextMenu&gt;
                    &lt;MenuItem Command="ApplicationCommands.New" Header="_New expense" /&gt;
                    &lt;MenuItem Command="ApplicationCommands.Delete" Header="_Delete" /&gt;
                &lt;/ContextMenu&gt;
            &lt;/ListBox.ContextMenu&gt;
        &lt;/ListBox&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
namespace CoinJar;
public partial class MainWindow : Window
{
    private int _counter;
    public MainWindow()
    {
        InitializeComponent();
    }
    // Runs for the menu item, the toolbar button, the context menu and Ctrl+N
    private void New_Executed(object sender, ExecutedRoutedEventArgs e)
    {
        _counter++;
        var category = ((ComboBoxItem)CategoryBox.SelectedItem).Content;
        ExpenseList.Items.Add($"Expense {_counter} ({category})");
        UpdateStatus("Added an expense");
    }
    private void Delete_Executed(object sender, ExecutedRoutedEventArgs e)
    {
        if (ExpenseList.SelectedItem is null)
        {
            UpdateStatus("Select an expense first");
            return;
        }
        ExpenseList.Items.Remove(ExpenseList.SelectedItem);
        UpdateStatus("Deleted an expense");
    }
    private void ShowToolbar_Click(object sender, RoutedEventArgs e)
    {
        var item = (MenuItem)sender;
        MainToolBarTray.Visibility = item.IsChecked ? Visibility.Visible : Visibility.Collapsed;
    }
    private void About_Click(object sender, RoutedEventArgs e)
    {
        MessageBox.Show("CoinJar 1.0\nA tiny expense tracker.", "About CoinJar");
    }
    private void Exit_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }
    private void UpdateStatus(string message)
    {
        CountText.Text = $"{ExpenseList.Items.Count} expenses";
        MessageText.Text = message;
    }
}
</code></pre>
