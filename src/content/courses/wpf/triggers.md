---
publishDate: 2026-10-25T20:32
title: 'Property, Data and Event Triggers'
slug: triggers
metadescription: 'Make CoinJar react to the mouse, focus and data with WPF triggers: Trigger, MultiTrigger, DataTrigger, MultiDataTrigger and EventTrigger, plus the local value trap.'
updateDate: 2026-10-25T20:32
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'xaml', 'triggers', 'styles']
course: wpf
---

## What a trigger is

A style from [Styles and Setters](/courses/wpf/styles-and-setters) sets values once. But a good interface reacts:

- a card lights up when the mouse is over it
- an expense row turns red when the amount is large
- a text box shows its error message as a tooltip when the input is invalid

A **trigger** is a rule inside a style that says "**when** this condition is true, apply these setters". When the condition stops being true, WPF automatically puts the old values back. You never write code to undo it.

Think of a porch light with a motion sensor. You do not switch it on and off yourself. You set a rule (light on while someone is near) and it takes care of itself.

WPF has five kinds of trigger:

| Trigger | Condition | Example |
| --- | --- | --- |
| `Trigger` | a property of the element itself | `IsMouseOver` is `True` |
| `MultiTrigger` | several element properties, all true | hovered **and** not read only |
| `DataTrigger` | a value from data binding | `Category` is `"Bills"` |
| `MultiDataTrigger` | several bound values, all true | `"Fun"` **and** a large amount |
| `EventTrigger` | an event happens | `MouseEnter` starts an animation |

## Property triggers

A property `Trigger` watches a property of the element the style is applied to. Triggers go in the style's `Triggers` collection, after the normal setters:

```xml
<Style x:Key="Card" TargetType="Border">
    <Setter Property="Background" Value="White" />
    <Setter Property="BorderBrush" Value="#E5E7EB" />
    <Setter Property="BorderThickness" Value="1" />
    <Setter Property="CornerRadius" Value="8" />
    <Setter Property="Padding" Value="16,12" />

    <Style.Triggers>
        <Trigger Property="IsMouseOver" Value="True">
            <Setter Property="BorderBrush" Value="#2E7D32" />
            <Setter Property="Background" Value="#F1F8F1" />
        </Trigger>
    </Style.Triggers>
</Style>
```

When the mouse enters the card, the border turns green. When it leaves, the trigger turns off and the setters above take effect again.

Useful properties to trigger on:

- `IsMouseOver`, `IsKeyboardFocused`, `IsKeyboardFocusWithin` (focus is on this element or a child)
- `IsEnabled`
- `IsSelected` on list items, `IsChecked` on check boxes and toggle buttons, `IsPressed` on buttons
- `Validation.HasError` (more below)

The `Value` is compared for **equality** only. A property trigger cannot say "greater than 100".

## The local value trap

This is the number one reason triggers "do not work". If the element sets the property directly, the local value beats the trigger:

```xml
<!-- The hover trigger never changes the background: it is set locally -->
<Border Style="{StaticResource Card}" Background="White" />
```

Recall the precedence list from the styles lesson: a local value is stronger than both style setters and style triggers. The fix is to set the default value in a style `Setter`, never on the element, when a trigger needs to change it.

A related surprise: a `Button` style trigger on `Background` for `IsMouseOver` seems to do nothing. That is because the button's built in **template** draws its own hover colour on top. Changing that needs a new template, which you will write in [Control Templates](/courses/wpf/control-templates).

## MultiTrigger: all conditions must be true

A `MultiTrigger` has a list of `Condition` elements. It applies its setters only when **every** condition is true, like `&&` in C#:

```xml
<Style TargetType="TextBox">
    <Style.Triggers>
        <MultiTrigger>
            <MultiTrigger.Conditions>
                <Condition Property="IsMouseOver" Value="True" />
                <Condition Property="IsReadOnly" Value="False" />
            </MultiTrigger.Conditions>
            <Setter Property="Background" Value="#F1F8F1" />
        </MultiTrigger>
    </Style.Triggers>
</Style>
```

Only editable boxes get the hover tint. For "or", simply write two separate triggers with the same setters.

## Data triggers: react to your data

A `DataTrigger` watches a **binding** instead of a property of the element. That makes it perfect for colouring things based on your model. Here every "Bills" row in the CoinJar grid gets a soft yellow background:

```xml
<DataGrid ItemsSource="{Binding Expenses}">
    <DataGrid.RowStyle>
        <Style TargetType="DataGridRow">
            <Style.Triggers>
                <DataTrigger Binding="{Binding Category}" Value="Bills">
                    <Setter Property="Background" Value="#FFF8E1" />
                </DataTrigger>
            </Style.Triggers>
        </Style>
    </DataGrid.RowStyle>
</DataGrid>
```

Inside `RowStyle`, the `DataContext` of each row is one `Expense`, so `{Binding Category}` reads that expense's category. Any binding works, including one with `ElementName` or `RelativeSource`.

### Comparing with "greater than": add a converter

Like property triggers, a data trigger only checks equality. To highlight expenses over 50, let a [value converter](/courses/wpf/value-converters) turn the comparison into `true` or `false`, and trigger on that:

```csharp
public class GreaterThanConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        decimal limit = decimal.Parse((string)parameter, CultureInfo.InvariantCulture);
        return value is decimal amount && amount > limit;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
```

```xml
<DataTrigger Binding="{Binding Amount, Converter={StaticResource GreaterThan}, ConverterParameter=50}"
             Value="True">
    <Setter Property="FontWeight" Value="SemiBold" />
    <Setter Property="Foreground" Value="#C62828" />
</DataTrigger>
```

`ConverterParameter` always arrives as a string, so the converter parses it. Using `InvariantCulture` means "50.5" is read the same way on every PC.

Another option is a calculated property on the model, such as `public bool IsLarge => Amount > 50;`. Then the trigger is simply `Binding="{Binding IsLarge}" Value="True"`. Remember to raise `PropertyChanged` for `IsLarge` when `Amount` changes.

### MultiDataTrigger

Combine bound values with a `MultiDataTrigger`:

```xml
<MultiDataTrigger>
    <MultiDataTrigger.Conditions>
        <Condition Binding="{Binding Category}" Value="Fun" />
        <Condition Binding="{Binding Amount, Converter={StaticResource GreaterThan}, ConverterParameter=50}" Value="True" />
    </MultiDataTrigger.Conditions>
    <Setter Property="Background" Value="#FDECEA" />
</MultiDataTrigger>
```

A big spend on fun gets a gentle pink warning. Notice the conditions use `Binding` here, not `Property`.

### Data triggers in data templates

[Data templates](/courses/wpf/data-templates) have their own `Triggers` collection. There you can change any named element inside the template with `TargetName`:

```xml
<DataTemplate x:Key="ExpenseCard">
    <StackPanel Orientation="Horizontal">
        <TextBlock x:Name="Icon" Text="•" Margin="0,0,6,0" />
        <TextBlock Text="{Binding Title}" />
    </StackPanel>
    <DataTemplate.Triggers>
        <DataTrigger Binding="{Binding Category}" Value="Food">
            <Setter TargetName="Icon" Property="Foreground" Value="#2E7D32" />
        </DataTrigger>
    </DataTemplate.Triggers>
</DataTemplate>
```

`TargetName` only works in templates. In a style, setters always target the styled element.

## Showing validation errors with a trigger

In [Input Validation](/courses/wpf/input-validation) the errors were drawn below the box. A tooltip is another nice option, and it takes one trigger:

```xml
<Style TargetType="TextBox">
    <Style.Triggers>
        <Trigger Property="Validation.HasError" Value="True">
            <Setter Property="ToolTip"
                    Value="{Binding RelativeSource={RelativeSource Self},
                                    Path=(Validation.Errors)/ErrorContent}" />
        </Trigger>
    </Style.Triggers>
</Style>
```

- `RelativeSource Self` means "bind to the text box itself".
- The brackets in `(Validation.Errors)` mark an attached property in a binding path.
- `/ErrorContent` means "the `ErrorContent` of the current item in the list", which is safe even when the list is empty.

## Event triggers: start an animation

An `EventTrigger` fires when a routed event happens. It cannot hold setters. Its only job is to run **actions**, which in practice means starting a **storyboard** (a timeline of animations):

```xml
<Style x:Key="FadeOnHover" TargetType="Border">
    <Setter Property="Opacity" Value="0.85" />
    <Style.Triggers>
        <EventTrigger RoutedEvent="MouseEnter">
            <BeginStoryboard>
                <Storyboard>
                    <DoubleAnimation Storyboard.TargetProperty="Opacity" To="1" Duration="0:0:0.15" />
                </Storyboard>
            </BeginStoryboard>
        </EventTrigger>
        <EventTrigger RoutedEvent="MouseLeave">
            <BeginStoryboard>
                <Storyboard>
                    <DoubleAnimation Storyboard.TargetProperty="Opacity" To="0.85" Duration="0:0:0.3" />
                </Storyboard>
            </BeginStoryboard>
        </EventTrigger>
    </Style.Triggers>
</Style>
```

Event triggers do not undo themselves, which is why you need the matching `MouseLeave` trigger. `Duration="0:0:0.15"` is hours, minutes and seconds, so 0.15 seconds.

Property triggers can run animations too, through `EnterActions` (when the condition becomes true) and `ExitActions` (when it becomes false):

```xml
<Trigger Property="IsMouseOver" Value="True">
    <Trigger.EnterActions>
        <BeginStoryboard>
            <Storyboard>
                <DoubleAnimation Storyboard.TargetProperty="Opacity" To="1" Duration="0:0:0.15" />
            </Storyboard>
        </BeginStoryboard>
    </Trigger.EnterActions>
    <Trigger.ExitActions>
        <BeginStoryboard>
            <Storyboard>
                <DoubleAnimation Storyboard.TargetProperty="Opacity" To="0.85" Duration="0:0:0.3" />
            </Storyboard>
        </BeginStoryboard>
    </Trigger.ExitActions>
</Trigger>
```

Animations get a full lesson in [Animations and Storyboards](/courses/wpf/animations-and-storyboards).

## Where triggers can live

| Place | Allowed triggers |
| --- | --- |
| `Style.Triggers` | all five kinds |
| `DataTemplate.Triggers` | all five, plus `TargetName` |
| `ControlTemplate.Triggers` | all five, plus `TargetName` |
| an element's own `Triggers` (for example `Grid.Triggers`) | only `EventTrigger` |

That last row catches many people. Writing a property `Trigger` directly in `Border.Triggers` gives an error when the window loads. Put it in a style instead.

## Triggers or code?

Triggers are perfect for **visual** reactions: colours, visibility, fonts, small animations. Keep logic that changes **data** (saving, calculating totals, deciding what is allowed) in C#. A clean split makes both easier to read and test, which becomes important in [Introduction to MVVM](/courses/wpf/introduction-to-mvvm).

## Common mistakes

- **The trigger never fires.** The element sets the same property locally. Move that value into a style setter.
- **Hover colour on a Button is ignored.** The default button template draws its own hover look. Use a control template.
- **Trying "greater than" in `Value`.** Triggers compare equality only. Use a converter or a `bool` property.
- **A `Trigger` in `Grid.Triggers`.** Only event triggers are allowed there.
- **Order between triggers.** If two active triggers set the same property, the one written **later** wins.
- **Using `Property` in a `MultiDataTrigger` condition.** Data triggers use `Binding`. Property triggers use `Property`.

## Quick recap

- A trigger applies setters while a condition is true and undoes them automatically.
- `Trigger` and `MultiTrigger` watch the element's own properties. `DataTrigger` and `MultiDataTrigger` watch bindings.
- Conditions test equality. Use a converter or a calculated `bool` property for comparisons.
- `EventTrigger` runs actions such as `BeginStoryboard` when an event fires. Property triggers can run animations with `EnterActions` and `ExitActions`.
- Local values block style triggers. Set defaults in style setters.
- Templates allow `TargetName`. An element's own `Triggers` collection accepts only event triggers.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:conv="clr-namespace:CoinJar.Converters"
        Title="CoinJar" Height="420" Width="640" Background="#F3F5F7"&gt;
    &lt;Window.Resources&gt;
        &lt;conv:GreaterThanConverter x:Key="GreaterThan" /&gt;
        &lt;!-- Property trigger plus event triggers on a summary card --&gt;
        &lt;Style x:Key="Card" TargetType="Border"&gt;
            &lt;Setter Property="Background" Value="White" /&gt;
            &lt;Setter Property="BorderBrush" Value="#E5E7EB" /&gt;
            &lt;Setter Property="BorderThickness" Value="1" /&gt;
            &lt;Setter Property="CornerRadius" Value="8" /&gt;
            &lt;Setter Property="Padding" Value="16,12" /&gt;
            &lt;Setter Property="Margin" Value="0,0,0,12" /&gt;
            &lt;Setter Property="Opacity" Value="0.9" /&gt;
            &lt;Style.Triggers&gt;
                &lt;Trigger Property="IsMouseOver" Value="True"&gt;
                    &lt;Setter Property="BorderBrush" Value="#2E7D32" /&gt;
                &lt;/Trigger&gt;
                &lt;EventTrigger RoutedEvent="MouseEnter"&gt;
                    &lt;BeginStoryboard&gt;
                        &lt;Storyboard&gt;
                            &lt;DoubleAnimation Storyboard.TargetProperty="Opacity" To="1" Duration="0:0:0.15" /&gt;
                        &lt;/Storyboard&gt;
                    &lt;/BeginStoryboard&gt;
                &lt;/EventTrigger&gt;
                &lt;EventTrigger RoutedEvent="MouseLeave"&gt;
                    &lt;BeginStoryboard&gt;
                        &lt;Storyboard&gt;
                            &lt;DoubleAnimation Storyboard.TargetProperty="Opacity" To="0.9" Duration="0:0:0.3" /&gt;
                        &lt;/Storyboard&gt;
                    &lt;/BeginStoryboard&gt;
                &lt;/EventTrigger&gt;
            &lt;/Style.Triggers&gt;
        &lt;/Style&gt;
        &lt;!-- Data triggers colour each row from its Expense --&gt;
        &lt;Style x:Key="ExpenseRow" TargetType="DataGridRow"&gt;
            &lt;Style.Triggers&gt;
                &lt;DataTrigger Binding="{Binding Category}" Value="Bills"&gt;
                    &lt;Setter Property="Background" Value="#FFF8E1" /&gt;
                &lt;/DataTrigger&gt;
                &lt;DataTrigger Binding="{Binding Amount, Converter={StaticResource GreaterThan}, ConverterParameter=50}" Value="True"&gt;
                    &lt;Setter Property="FontWeight" Value="SemiBold" /&gt;
                    &lt;Setter Property="Foreground" Value="#C62828" /&gt;
                &lt;/DataTrigger&gt;
                &lt;!-- Written last, so it wins over the triggers above --&gt;
                &lt;MultiDataTrigger&gt;
                    &lt;MultiDataTrigger.Conditions&gt;
                        &lt;Condition Binding="{Binding Category}" Value="Fun" /&gt;
                        &lt;Condition Binding="{Binding Amount, Converter={StaticResource GreaterThan}, ConverterParameter=50}" Value="True" /&gt;
                    &lt;/MultiDataTrigger.Conditions&gt;
                    &lt;Setter Property="Background" Value="#FDECEA" /&gt;
                &lt;/MultiDataTrigger&gt;
            &lt;/Style.Triggers&gt;
        &lt;/Style&gt;
    &lt;/Window.Resources&gt;
    &lt;DockPanel Margin="16"&gt;
        &lt;Border DockPanel.Dock="Top" Style="{StaticResource Card}"&gt;
            &lt;StackPanel&gt;
                &lt;TextBlock Text="This month" Foreground="#6B7280" /&gt;
                &lt;TextBlock Text="{Binding Total, StringFormat=C}" FontSize="26" FontWeight="Bold" /&gt;
            &lt;/StackPanel&gt;
        &lt;/Border&gt;
        &lt;DataGrid ItemsSource="{Binding Expenses}" AutoGenerateColumns="False" IsReadOnly="True"
                  HeadersVisibility="Column" GridLinesVisibility="None"
                  RowStyle="{StaticResource ExpenseRow}"&gt;
            &lt;DataGrid.Columns&gt;
                &lt;DataGridTextColumn Header="Title" Binding="{Binding Title}" Width="*" /&gt;
                &lt;DataGridTextColumn Header="Category" Binding="{Binding Category}" Width="110" /&gt;
                &lt;DataGridTextColumn Header="Amount" Binding="{Binding Amount, StringFormat=C}" Width="100" /&gt;
            &lt;/DataGrid.Columns&gt;
        &lt;/DataGrid&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Collections.ObjectModel;
using System.Windows;
using CoinJar.Models;
namespace CoinJar;
public partial class MainWindow : Window
{
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = new()
    {
        new Expense { Title = "Groceries", Amount = 42.80m, Category = "Food" },
        new Expense { Title = "Electricity", Amount = 64.15m, Category = "Bills" },
        new Expense { Title = "Concert tickets", Amount = 85.00m, Category = "Fun" },
        new Expense { Title = "Cinema", Amount = 18.50m, Category = "Fun" },
        new Expense { Title = "Bus pass", Amount = 30.00m, Category = "Transport" }
    };
    public decimal Total =&gt; Expenses.Sum(e =&gt; e.Amount);
    public MainWindow()
    {
        InitializeComponent();
        DataContext = this;   // small demo: the window holds its own data
    }
}
// Converters/GreaterThanConverter.cs
using System.Globalization;
using System.Windows.Data;
namespace CoinJar.Converters;
// True when the bound decimal is greater than ConverterParameter
public class GreaterThanConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        decimal limit = decimal.Parse((string)parameter, CultureInfo.InvariantCulture);
        return value is decimal amount &amp;&amp; amount &gt; limit;
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        =&gt; throw new NotSupportedException();
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
