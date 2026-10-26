---
publishDate: 2026-10-25T20:25
title: 'Value Converters'
slug: value-converters
metadescription: 'Turn data into colours, visibility and text with IValueConverter. Write converters for CoinJar, pass a ConverterParameter, convert back for two way bindings and combine values with MultiBinding.'
updateDate: 2026-10-25T20:25
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'data-binding', 'converters', 'ivalueconverter']
course: wpf
---

## When the types do not match

Bindings are happiest when the source and target have the same type: a `string` into `Text`, a `bool` into `IsChecked`. But the screen often needs something different from what the data holds:

- An expense has a `Category` string like "Food", but you want a coloured dot: a `Brush`.
- The view model has `SelectedExpense`, which may be `null`, but you want to hide a panel: a `Visibility`.
- An `Amount` is a `decimal`, but you want it red when it is above 50.

`StringFormat` from [Data Binding Basics](/courses/wpf/data-binding-basics) only helps when the target is text. For everything else you write a **value converter**: a small class that sits in the middle of a binding and turns one value into another.

```text
 Source             Converter                 Target
 "Food"   ---->  CategoryToBrush   ---->   Border.Background = green
```

Think of it as a plug adapter. The data and the control both work fine, they just need a little piece in between.

## The IValueConverter interface

A converter is any class that implements `IValueConverter` from `System.Windows.Data`. It has two methods:

```csharp
public interface IValueConverter
{
    // Source to target: called when the data is shown
    object Convert(object value, Type targetType, object parameter, CultureInfo culture);

    // Target to source: called when a two way binding writes back
    object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture);
}
```

The parameters:

- `value`: the value from the source, for example `"Food"`.
- `targetType`: the type the target wants, for example `Brush`.
- `parameter`: an optional extra value you can pass from XAML. More on this soon.
- `culture`: the culture of the binding, for formatting numbers and dates.

Most converters only work one way, from data to screen. For those, `ConvertBack` can simply say "not supported".

## Your first converter: category to colour

Create a `Converters` folder in the project and add `CategoryToBrushConverter.cs`:

```csharp
using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;

namespace CoinJar.Converters;

public class CategoryToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        return value switch
        {
            "Food"      => Brushes.SeaGreen,
            "Transport" => Brushes.SteelBlue,
            "Bills"     => Brushes.IndianRed,
            "Fun"       => Brushes.Orange,
            _           => Brushes.Gray      // Other, or anything unexpected
        };
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
```

The `switch` expression with string patterns keeps it short. If that syntax is new, see [switch statements and expressions](/courses/c-sharp/switch-statements-and-expressions). `Brushes` is a WPF class with ready made colour brushes.

Always handle unexpected input with a default (the `_` case). A converter that throws inside `Convert` can crash the window.

## Using a converter in XAML

Two steps. First, tell XAML where your converters live with an **XML namespace** and create one instance as a **resource** (a named object the window can reuse):

```xml
<Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:conv="clr-namespace:CoinJar.Converters">
    <Window.Resources>
        <conv:CategoryToBrushConverter x:Key="CategoryBrush" />
    </Window.Resources>
```

`xmlns:conv` maps the prefix `conv` to the C# namespace `CoinJar.Converters`, just like a `using` line. `x:Key` gives the instance a name. You learned prefixes in [XAML Namespaces and Markup Extensions](/courses/wpf/xaml-namespaces-and-markup-extensions), and you will learn all about resources in [Resources and Resource Dictionaries](/courses/wpf/resources-and-resource-dictionaries).

Second, use it in a binding with `Converter={StaticResource ...}`:

```xml
<Border Width="14" Height="14" CornerRadius="7"
        Background="{Binding Category, Converter={StaticResource CategoryBrush}}" />
```

Now each expense shows a coloured dot, and when the user changes the category, the dot changes colour straight away.

If you want converters available in every window, put them in `App.xaml` under `Application.Resources` instead.

## Passing a ConverterParameter

Sometimes a converter needs a setting. CoinJar wants amounts in red above some limit, and the limit may differ from screen to screen. `ConverterParameter` passes a fixed value from XAML into the `parameter` argument:

```xml
<TextBlock Text="{Binding Amount, StringFormat=C}"
           Foreground="{Binding Amount,
                        Converter={StaticResource AmountBrush},
                        ConverterParameter=50}" />
```

The parameter always arrives as a **string** when written like this, so the converter must parse it:

```csharp
public class AmountToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        // Parse the limit with the invariant culture, so "50.5" works everywhere
        decimal limit = decimal.TryParse(parameter as string, NumberStyles.Number,
            CultureInfo.InvariantCulture, out var parsed) ? parsed : 50m;

        return value is decimal amount && amount > limit
            ? Brushes.Firebrick
            : SystemColors.ControlTextBrush;   // the normal text colour
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
```

A few things to notice:

- `CultureInfo.InvariantCulture` is a fixed culture for computers. The parameter is written by you in XAML, so it should always use a dot for decimals, whatever the user's language.
- `value is decimal amount` checks the type and gives you a typed variable in one step. That is [pattern matching](/courses/c-sharp/advanced-pattern-matching).
- `SystemColors.ControlTextBrush` is the standard text colour, which is better than hard coding black.

You cannot bind `ConverterParameter` to data. It must be a fixed value. If you need two changing values, use a `MultiBinding`, shown below.

## Built in: BooleanToVisibilityConverter

Showing and hiding things based on a `bool` is so common that WPF ships a converter for it. Declare it like your own:

```xml
<Window.Resources>
    <BooleanToVisibilityConverter x:Key="BoolToVisibility" />
</Window.Resources>

<TextBlock Text="Editing the selected expense"
           Visibility="{Binding HasSelection, Converter={StaticResource BoolToVisibility}}" />
```

`true` becomes `Visible` and `false` becomes `Collapsed` (hidden and taking no space). No prefix is needed because it is part of WPF.

## A null to visibility converter

CoinJar's detail form should hide when nothing is selected. Instead of a separate `HasSelection` property, you can convert `SelectedExpense` itself:

```csharp
public class NullToVisibilityConverter : IValueConverter
{
    // Set Invert="True" in XAML to show the element when the value IS null
    public bool Invert { get; set; }

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        bool hasValue = value is not null;
        if (Invert) hasValue = !hasValue;
        return hasValue ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
```

The `Invert` property is a nice trick: a converter is a normal class, so it can have settings that you fill in when you declare it:

```xml
<conv:NullToVisibilityConverter x:Key="NullToVisible" />
<conv:NullToVisibilityConverter x:Key="NullToCollapsed" Invert="True" />
```

Use the first to show the form when something is selected, and the second to show a "Pick an expense" hint when nothing is.

## Converting back

For two way bindings, `ConvertBack` runs when the user changes the control. A classic example is an "inverse" checkbox. Say `Expense` had a `bool IsPaid` property and you want a box labelled "Still to pay":

```csharp
public class InverseBooleanConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        => value is bool b ? !b : Binding.DoNothing;

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => value is bool b ? !b : Binding.DoNothing;
}
```

```xml
<CheckBox Content="Still to pay"
          IsChecked="{Binding IsPaid, Converter={StaticResource Inverse}}" />
```

`Binding.DoNothing` is a special value that tells the binding "skip this update and keep the current value". It is the polite answer to input you cannot handle.

## MultiBinding: more than one source

Sometimes the output depends on two values. A `MultiBinding` collects several bindings and passes them all to an `IMultiValueConverter`. Its `Convert` method gets an array of values:

```csharp
public class PercentOfConverter : IMultiValueConverter
{
    // values[0] = the amount, values[1] = the total
    public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
    {
        if (values[0] is decimal part && values[1] is decimal whole && whole != 0)
            return (part / whole).ToString("P0", culture);   // for example "12%"
        return "";
    }

    public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
```

```xml
<TextBlock>
    <TextBlock.Text>
        <MultiBinding Converter="{StaticResource PercentOf}">
            <Binding Path="SelectedExpense.Amount" />
            <Binding Path="Total" />
        </MultiBinding>
    </TextBlock.Text>
</TextBlock>
```

If you only need to join values into text, you do not even need a converter. `MultiBinding` has its own `StringFormat`:

```xml
<TextBlock>
    <TextBlock.Text>
        <MultiBinding StringFormat="{}{0} on {1:d MMM}">
            <Binding Path="Title" />
            <Binding Path="Date" />
        </MultiBinding>
    </TextBlock.Text>
</TextBlock>
```

## Tips and common mistakes

- **Return the type the target expects.** A converter for `Background` should return a `Brush`. WPF will try to turn a returned string like `"Red"` into a brush, but that is extra work, and anything it cannot convert fails quietly with a blank result. Returning the right type avoids both problems.
- **Missing `xmlns:conv`.** Without it, XAML cannot find `conv:CategoryToBrushConverter` and the build fails.
- **A typo in the key.** `{StaticResource CategoryBrsh}` builds fine but throws an error when the window opens. Check the key spelling first.
- **Throwing in `Convert`.** Return a sensible default instead. A null `value` is common while the window is loading.
- **Putting business rules in converters.** A converter should only change how data *looks*. Rules like "what counts as large" belong in the model or view model, which you can test. See [Unit Testing ViewModels](/courses/wpf/unit-testing-viewmodels).
- **Writing a converter when a property would do.** If the view model can simply expose `bool HasSelection` or `string StatusText`, that is often clearer than a converter. Use converters for reusable "looks" logic, like colours and visibility.
- **Formatting money in a converter.** The `culture` argument follows the binding's language, which defaults to `en-US` unless you fixed it at startup as shown in Data Binding Basics.

## Quick recap

- A value converter implements `IValueConverter` and turns a source value into what the target needs, and optionally back.
- Declare converters as resources with an `xmlns` prefix and an `x:Key`, then use `Converter={StaticResource Key}`.
- `ConverterParameter` passes a fixed string. Parse it with `CultureInfo.InvariantCulture`.
- WPF includes `BooleanToVisibilityConverter`. Converters can have their own properties, like `Invert`.
- `ConvertBack` serves two way bindings. `Binding.DoNothing` skips an update.
- `MultiBinding` with an `IMultiValueConverter` or a `StringFormat` combines several values.
- Next, make each row of the expense list look great with [Data Templates](/courses/wpf/data-templates).

<code id="code-content" class="language-csharp">
// Converters/CategoryToBrushConverter.cs
using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;
namespace CoinJar.Converters;
// "Food" -&gt; green brush, "Bills" -&gt; red brush, and so on
public class CategoryToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        return value switch
        {
            "Food" =&gt; Brushes.SeaGreen,
            "Transport" =&gt; Brushes.SteelBlue,
            "Bills" =&gt; Brushes.IndianRed,
            "Fun" =&gt; Brushes.Orange,
            _ =&gt; Brushes.Gray
        };
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        =&gt; throw new NotSupportedException();
}
// Converters/AmountToBrushConverter.cs
using System.Globalization;
using System.Windows;
using System.Windows.Data;
using System.Windows.Media;
namespace CoinJar.Converters;
// Red text when the amount is above the limit given in ConverterParameter
public class AmountToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        decimal limit = decimal.TryParse(parameter as string, NumberStyles.Number,
            CultureInfo.InvariantCulture, out var parsed) ? parsed : 50m;
        return value is decimal amount &amp;&amp; amount &gt; limit
            ? Brushes.Firebrick
            : SystemColors.ControlTextBrush;
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        =&gt; throw new NotSupportedException();
}
// Converters/NullToVisibilityConverter.cs
using System.Globalization;
using System.Windows;
using System.Windows.Data;
namespace CoinJar.Converters;
// Not null -&gt; Visible, null -&gt; Collapsed. Invert="True" swaps them.
public class NullToVisibilityConverter : IValueConverter
{
    public bool Invert { get; set; }
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        bool hasValue = value is not null;
        if (Invert) hasValue = !hasValue;
        return hasValue ? Visibility.Visible : Visibility.Collapsed;
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        =&gt; throw new NotSupportedException();
}
&lt;!-- MainWindow.xaml --&gt;
&lt;!-- ExpenseListViewModel, Expense and MainWindow.xaml.cs stay the same as in Binding to Collections --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:conv="clr-namespace:CoinJar.Converters"
        Title="CoinJar" Width="640" Height="420"&gt;
    &lt;Window.Resources&gt;
        &lt;conv:CategoryToBrushConverter x:Key="CategoryBrush" /&gt;
        &lt;conv:AmountToBrushConverter x:Key="AmountBrush" /&gt;
        &lt;conv:NullToVisibilityConverter x:Key="NullToVisible" /&gt;
        &lt;conv:NullToVisibilityConverter x:Key="NullToCollapsed" Invert="True" /&gt;
    &lt;/Window.Resources&gt;
    &lt;DockPanel Margin="12"&gt;
        &lt;StackPanel DockPanel.Dock="Bottom" Orientation="Horizontal" Margin="0,8,0,0"&gt;
            &lt;Button Content="Add" Click="Add_Click" Padding="12,4" /&gt;
            &lt;Button Content="Delete" Click="Delete_Click" Padding="12,4" Margin="8,0,0,0" /&gt;
            &lt;TextBlock Text="{Binding Total, StringFormat='Total: {0:C}'}" FontWeight="SemiBold"
                       VerticalAlignment="Center" Margin="16,0,0,0" /&gt;
        &lt;/StackPanel&gt;
        &lt;Grid&gt;
            &lt;Grid.ColumnDefinitions&gt;
                &lt;ColumnDefinition Width="*" /&gt;
                &lt;ColumnDefinition Width="*" /&gt;
            &lt;/Grid.ColumnDefinitions&gt;
            &lt;ListBox ItemsSource="{Binding Expenses}" DisplayMemberPath="Summary"
                     SelectedItem="{Binding SelectedExpense}" /&gt;
            &lt;!-- Shown only when nothing is selected --&gt;
            &lt;TextBlock Grid.Column="1" Text="Pick an expense to edit it" Foreground="Gray"
                       HorizontalAlignment="Center" VerticalAlignment="Center"
                       Visibility="{Binding SelectedExpense, Converter={StaticResource NullToCollapsed}}" /&gt;
            &lt;!-- Shown only when something is selected. The Border still sees the view model. --&gt;
            &lt;Border Grid.Column="1" Margin="12,0,0,0"
                    Visibility="{Binding SelectedExpense, Converter={StaticResource NullToVisible}}"&gt;
            &lt;StackPanel DataContext="{Binding SelectedExpense}"&gt;
                &lt;StackPanel Orientation="Horizontal"&gt;
                    &lt;!-- Coloured dot from the category --&gt;
                    &lt;Border Width="14" Height="14" CornerRadius="7" Margin="0,0,8,0"
                            Background="{Binding Category, Converter={StaticResource CategoryBrush}}" /&gt;
                    &lt;TextBlock Text="{Binding Title}" FontSize="16" FontWeight="SemiBold" /&gt;
                &lt;/StackPanel&gt;
                &lt;!-- Red when above 50 --&gt;
                &lt;TextBlock Text="{Binding Amount, StringFormat=C}" FontSize="20" Margin="0,4,0,8"
                           Foreground="{Binding Amount, Converter={StaticResource AmountBrush}, ConverterParameter=50}" /&gt;
                &lt;TextBlock Text="Title" /&gt;
                &lt;TextBox Text="{Binding Title, UpdateSourceTrigger=PropertyChanged}" /&gt;
                &lt;TextBlock Text="Amount" Margin="0,8,0,0" /&gt;
                &lt;TextBox Text="{Binding Amount}" /&gt;
                &lt;TextBlock Text="Category" Margin="0,8,0,0" /&gt;
                &lt;ComboBox ItemsSource="{Binding DataContext.Categories, RelativeSource={RelativeSource AncestorType=Window}}"
                          SelectedItem="{Binding Category}" /&gt;
            &lt;/StackPanel&gt;
            &lt;/Border&gt;
        &lt;/Grid&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
</code></pre>
