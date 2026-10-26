---
publishDate: 2026-10-25T20:43
title: 'User Controls'
slug: user-controls
metadescription: 'Build reusable pieces of UI with WPF user controls: create one, use it from XAML, let it inherit its DataContext, add design time data and know when a custom control fits better.'
updateDate: 2026-10-25T20:43
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'usercontrol', 'reuse', 'xaml']
course: wpf
---

## What is a user control?

A **user control** is a reusable piece of UI that you build out of existing controls. It has its own XAML file and its own code-behind, just like a window, but instead of standing alone it is placed inside windows and other controls.

Think of LEGO. A `TextBlock`, a `Border` and a `Button` are single bricks. A user control is a small model you build from bricks once (say, a car) and can then drop into any scene as one piece.

You have already made some. In [Navigation Between Views](/courses/wpf/navigation-between-views), every screen (`ExpenseListView`, `SummaryView`) was a user control. In this lesson you build a smaller, reusable one: an **expense card** that shows one expense with its title, category, date and amount.

User controls are used for two things:

1. **Views**: a whole screen, shown through a `DataTemplate` or inside a window.
2. **Reusable widgets**: a card, a search box, a labelled field. You use them in many places.

## Creating a user control

In Visual Studio: right click the `Controls` folder, choose **Add**, then **User Control (WPF)**, and name it `ExpenseCard`. (The .NET CLI has no item template for this, so with VS Code you create the two files by hand. They are short.)

You get two files. The XAML:

```xml
<UserControl x:Class="CoinJar.Controls.ExpenseCard"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
             mc:Ignorable="d"
             d:DesignHeight="80" d:DesignWidth="320">
    <Grid>
    </Grid>
</UserControl>
```

And the code-behind:

```csharp
using System.Windows.Controls;

namespace CoinJar.Controls;

public partial class ExpenseCard : UserControl
{
    public ExpenseCard()
    {
        InitializeComponent();
    }
}
```

`d:DesignHeight` and `d:DesignWidth` only size the control in the designer. At run time the control takes whatever size its parent gives it, using the layout rules from [Layout Basics](/courses/wpf/layout-basics-size-margin-and-alignment).

## Building the card

Fill the `Grid` with the card's layout. The bindings use the properties of `Expense`:

```xml
<Border Padding="12" Margin="0,0,0,8" CornerRadius="6"
        BorderBrush="#DDD" BorderThickness="1">
    <Grid>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*" />
            <ColumnDefinition Width="Auto" />
        </Grid.ColumnDefinitions>
        <StackPanel>
            <TextBlock Text="{Binding Title}" FontWeight="SemiBold" FontSize="15" />
            <TextBlock Foreground="Gray">
                <Run Text="{Binding Category, Mode=OneWay}" />
                <Run Text="  " />
                <Run Text="{Binding Date, Mode=OneWay, StringFormat=d}" />
            </TextBlock>
        </StackPanel>
        <TextBlock Grid.Column="1" Text="{Binding Amount, StringFormat=C}"
                   FontSize="16" VerticalAlignment="Center" />
    </Grid>
</Border>
```

A `Run` is a piece of text inside a `TextBlock`, handy for mixing several bound values on one line. `Run.Text` binds two way by default, so `Mode=OneWay` avoids errors for read only values.

## Using it

To use the card, map its namespace to an XML prefix, as in [XAML Namespaces and Markup Extensions](/courses/wpf/xaml-namespaces-and-markup-extensions), and then write it like any built in control:

```xml
<UserControl x:Class="CoinJar.Views.ExpenseListView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:controls="clr-namespace:CoinJar.Controls">
    <ItemsControl ItemsSource="{Binding Expenses}">
        <ItemsControl.ItemTemplate>
            <DataTemplate>
                <controls:ExpenseCard />
            </DataTemplate>
        </ItemsControl.ItemTemplate>
    </ItemsControl>
</UserControl>
```

Build the project once after creating a control. Until it is compiled, the XAML editor may underline `controls:ExpenseCard` as unknown.

## Where does the card get its data?

Look closely: we never told the card which expense to show. It works because of **DataContext inheritance**, which you met in [Data Binding Basics](/courses/wpf/data-binding-basics). Inside the item template, each row's `DataContext` is one `Expense`. The card sits inside that row, so it inherits the same `DataContext`, and `{Binding Title}` finds `Expense.Title`.

```text
ItemsControl          DataContext = ExpenseListViewModel
  row 1               DataContext = Expense "Coffee"
    ExpenseCard       DataContext = Expense "Coffee"  (inherited)
      TextBlock       {Binding Title} -> "Coffee"
```

This is the simplest way to build a user control: it expects a certain kind of object as its `DataContext` and binds to it.

### Design time data

The designer does not know what the `DataContext` will be, so bindings show nothing there and IntelliSense cannot help. Give it a hint with `d:DataContext`:

```xml
<UserControl ...
             xmlns:models="clr-namespace:CoinJar.Models"
             d:DataContext="{d:DesignInstance Type=models:Expense, IsDesignTimeCreatable=True}">
```

`IsDesignTimeCreatable=True` tells the designer to create a real `Expense`, so default values appear. Everything with the `d:` prefix is ignored at run time.

## Styling inside a user control

A user control can have its own resources, just like a window. Here a style colours a small tag based on the category, using a `DataTrigger` from [Triggers](/courses/wpf/triggers):

```xml
<UserControl.Resources>
    <Style x:Key="CategoryTag" TargetType="Border">
        <Setter Property="Background" Value="#EEE" />
        <Setter Property="CornerRadius" Value="4" />
        <Setter Property="Padding" Value="6,1" />
        <Style.Triggers>
            <DataTrigger Binding="{Binding Category}" Value="Food">
                <Setter Property="Background" Value="#FFE8C2" />
            </DataTrigger>
            <DataTrigger Binding="{Binding Category}" Value="Bills">
                <Setter Property="Background" Value="#FFD6D6" />
            </DataTrigger>
        </Style.Triggers>
    </Style>
</UserControl.Resources>
```

Styles from `App.xaml` (and your theme from [Light, Dark and Fluent Themes](/courses/wpf/light-dark-and-fluent-themes)) still apply inside the control. Local resources are only for things that belong to this control alone.

## Code-behind in a user control

Code-behind is fine for pure view behaviour. For example, a card that shows a note when you click it:

```csharp
private void Card_MouseLeftButtonUp(object sender, MouseButtonEventArgs e)
{
    NoteText.Visibility = NoteText.Visibility == Visibility.Visible
        ? Visibility.Collapsed
        : Visibility.Visible;
}
```

Anything that changes data still belongs in a view model and a command.

## The limit: you cannot bind to a plain property

Suppose you want a tiny `CategoryBadge` control that you use like this:

```xml
<controls:CategoryBadge Category="{Binding Category}" />
```

You add a normal C# property to its code-behind:

```csharp
public string Category { get; set; } = "";
```

Writing `Category="Food"` works. But `Category="{Binding Category}"` fails with an error like:

```text
A 'Binding' cannot be set on the 'Category' property of type 'CategoryBadge'.
A 'Binding' can only be set on a DependencyProperty of a DependencyObject.
```

The **target** of a binding must be a **dependency property**, a special WPF property that the binding system can track and update. Every bindable property you have used so far (`Text`, `IsChecked`, `ItemsSource`) is one. The next lesson, [Dependency Properties](/courses/wpf/dependency-properties), shows how to add them to your own controls.

## User control or custom control?

WPF has a second kind of reusable control, the **custom control**, covered in [Custom Controls](/courses/wpf/custom-controls).

| | User control | Custom control |
| --- | --- | --- |
| Built from | Existing controls in a XAML file | Code plus a default `ControlTemplate` in a theme file |
| Restyling by users | Hard, the inside is fixed | Easy, anyone can replace the template |
| Effort | Low | Higher |
| Best for | Pieces of your own app | Controls for a library others will style |

For your own app, a user control is almost always the right first choice.

## Sharing controls across projects

To reuse controls in several apps, put them in a separate library:

```bash
dotnet new wpfusercontrollib -n CoinJar.Controls
dotnet add CoinJar/CoinJar.csproj reference CoinJar.Controls/CoinJar.Controls.csproj
```

In XAML, add the assembly name to the namespace mapping: `xmlns:controls="clr-namespace:CoinJar.Controls;assembly=CoinJar.Controls"`.

## Common mistakes

- **Setting `DataContext = this` in the constructor.** It breaks DataContext inheritance: the card can no longer see the `Expense` from the row, and every outside binding on the control now looks at the control itself. Never do this in a reusable user control.
- **Forgetting to build.** New controls are not known to the XAML editor until the project compiles.
- **Giving a reusable control a fixed `Width` and `Height`.** Let the parent decide the size. Use `d:DesignWidth` for the designer.
- **Putting business logic in the control's code-behind.** The control should display data and raise commands, not save expenses.
- **Naming clashes with `x:Name`.** Names inside the control are private to it, so two cards on one screen do not clash. You cannot reach them from the outside, which is a good thing.

## Quick recap

- A user control is a reusable piece of UI made of existing controls, with its own XAML and code-behind.
- Create it with **Add > User Control (WPF)**, map its namespace with `xmlns:controls="clr-namespace:..."` and use it like any control.
- Inside a template, the control inherits the row's `DataContext`, so plain `{Binding}` paths work.
- Use `d:DataContext` and `d:DesignWidth` for a better designer experience.
- Never set `DataContext = this` in a reusable control.
- To bind to the control's own properties, you need dependency properties, which come next.

<code id="code-content" class="language-xml">
&lt;!-- Controls/ExpenseCard.xaml --&gt;
&lt;UserControl x:Class="CoinJar.Controls.ExpenseCard"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
             xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
             xmlns:models="clr-namespace:CoinJar.Models"
             mc:Ignorable="d"
             d:DataContext="{d:DesignInstance Type=models:Expense, IsDesignTimeCreatable=True}"
             d:DesignHeight="80" d:DesignWidth="320"&gt;
    &lt;UserControl.Resources&gt;
        &lt;!-- Colour the category tag; DataContext is the Expense --&gt;
        &lt;Style x:Key="CategoryTag" TargetType="Border"&gt;
            &lt;Setter Property="Background" Value="#EEE" /&gt;
            &lt;Setter Property="CornerRadius" Value="4" /&gt;
            &lt;Setter Property="Padding" Value="6,1" /&gt;
            &lt;Setter Property="HorizontalAlignment" Value="Left" /&gt;
            &lt;Style.Triggers&gt;
                &lt;DataTrigger Binding="{Binding Category}" Value="Food"&gt;
                    &lt;Setter Property="Background" Value="#FFE8C2" /&gt;
                &lt;/DataTrigger&gt;
                &lt;DataTrigger Binding="{Binding Category}" Value="Transport"&gt;
                    &lt;Setter Property="Background" Value="#D6E8FF" /&gt;
                &lt;/DataTrigger&gt;
                &lt;DataTrigger Binding="{Binding Category}" Value="Bills"&gt;
                    &lt;Setter Property="Background" Value="#FFD6D6" /&gt;
                &lt;/DataTrigger&gt;
                &lt;DataTrigger Binding="{Binding Category}" Value="Fun"&gt;
                    &lt;Setter Property="Background" Value="#E3F7D9" /&gt;
                &lt;/DataTrigger&gt;
            &lt;/Style.Triggers&gt;
        &lt;/Style&gt;
    &lt;/UserControl.Resources&gt;
    &lt;Border Padding="12" Margin="0,0,0,8" CornerRadius="6"
            BorderBrush="#DDD" BorderThickness="1" Background="Transparent"
            MouseLeftButtonUp="Card_MouseLeftButtonUp"&gt;
        &lt;Grid&gt;
            &lt;Grid.ColumnDefinitions&gt;
                &lt;ColumnDefinition Width="*" /&gt;
                &lt;ColumnDefinition Width="Auto" /&gt;
            &lt;/Grid.ColumnDefinitions&gt;
            &lt;StackPanel&gt;
                &lt;TextBlock Text="{Binding Title}" FontWeight="SemiBold" FontSize="15" /&gt;
                &lt;StackPanel Orientation="Horizontal" Margin="0,4,0,0"&gt;
                    &lt;Border Style="{StaticResource CategoryTag}"&gt;
                        &lt;TextBlock Text="{Binding Category}" FontSize="11" /&gt;
                    &lt;/Border&gt;
                    &lt;TextBlock Text="{Binding Date, StringFormat=d}" Foreground="Gray" Margin="8,0,0,0" /&gt;
                &lt;/StackPanel&gt;
                &lt;!-- Toggled by code-behind: pure view behaviour --&gt;
                &lt;TextBlock x:Name="NoteText" Text="{Binding Id, StringFormat='Expense #{0}'}"
                           Foreground="Gray" Visibility="Collapsed" Margin="0,4,0,0" /&gt;
            &lt;/StackPanel&gt;
            &lt;TextBlock Grid.Column="1" Text="{Binding Amount, StringFormat=C}"
                       FontSize="16" VerticalAlignment="Center" /&gt;
        &lt;/Grid&gt;
    &lt;/Border&gt;
&lt;/UserControl&gt;
// Controls/ExpenseCard.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
namespace CoinJar.Controls;
public partial class ExpenseCard : UserControl
{
    public ExpenseCard()
    {
        InitializeComponent();
        // Do NOT set DataContext = this; the card inherits the Expense from its row
    }
    private void Card_MouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        NoteText.Visibility = NoteText.Visibility == Visibility.Visible
            ? Visibility.Collapsed
            : Visibility.Visible;
    }
}
&lt;!-- Views/ExpenseListView.xaml --&gt;
&lt;UserControl x:Class="CoinJar.Views.ExpenseListView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:controls="clr-namespace:CoinJar.Controls"&gt;
    &lt;ScrollViewer Padding="16"&gt;
        &lt;ItemsControl ItemsSource="{Binding Expenses}"&gt;
            &lt;ItemsControl.ItemTemplate&gt;
                &lt;DataTemplate&gt;
                    &lt;!-- Inherits one Expense as its DataContext --&gt;
                    &lt;controls:ExpenseCard /&gt;
                &lt;/DataTemplate&gt;
            &lt;/ItemsControl.ItemTemplate&gt;
        &lt;/ItemsControl&gt;
    &lt;/ScrollViewer&gt;
&lt;/UserControl&gt;
</code></pre>
