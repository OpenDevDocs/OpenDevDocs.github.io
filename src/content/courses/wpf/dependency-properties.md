---
publishDate: 2026-10-25T20:44
title: 'Dependency Properties'
slug: dependency-properties
metadescription: 'Learn what dependency properties are and add your own to a WPF user control: registering, metadata, default values, change callbacks, coercion, two way binding and read only properties.'
updateDate: 2026-10-25T20:44
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'dependency-properties', 'usercontrol', 'data-binding']
course: wpf
---

## Why normal properties are not enough

At the end of [User Controls](/courses/wpf/user-controls) you hit a wall. A plain C# property on a user control can take a fixed value (`Category="Food"`) but not a binding (`Category="{Binding Category}"`). WPF said a binding "can only be set on a DependencyProperty".

A **dependency property** is a property whose value is stored and managed by WPF's **property system** instead of a normal field. Because WPF manages it, it can do things a normal property cannot:

- be the **target of a binding**,
- be set by a **style**, a **trigger** or a **template**,
- be **animated**,
- **inherit** its value from a parent element (like `FontSize` does),
- tell WPF when it changes, so layout and rendering update.

Every property you have bound to so far, such as `TextBox.Text`, `Button.IsEnabled` or `ItemsControl.ItemsSource`, is a dependency property. In this lesson you add your own.

## Where the value comes from

A normal property has one value: whatever was last assigned. A dependency property can get its value from several places at once, and WPF picks the winner by a fixed order called **value precedence**. Highest first (simplified):

```text
1. Animations that are running
2. Local value      (set in XAML like Width="100", in code, or by a binding)
3. Template triggers and template values
4. Style triggers
5. Style setters
6. Inherited value  (from a parent, for properties that inherit)
7. Default value    (from the property's metadata)
```

This is why a `Setter` in a style does nothing when the element already has a local value: local beats style. If you ever wonder where a value came from, `DependencyPropertyHelper.GetValueSource(element, property)` tells you.

## The parts of a dependency property

We will build a `MoneyTile` user control for CoinJar's summary screen. It shows a label and an amount, and turns red when the amount goes over a limit. Used like this:

```xml
<controls:MoneyTile Label="Spent this month" Amount="{Binding Total}" Limit="500" />
```

Here is the `Amount` property. It has two parts:

```csharp
public partial class MoneyTile : UserControl
{
    // 1. The registration: a public static readonly field
    public static readonly DependencyProperty AmountProperty =
        DependencyProperty.Register(
            nameof(Amount),            // property name
            typeof(decimal),           // property type
            typeof(MoneyTile),         // owner type
            new PropertyMetadata(0m)); // default value

    // 2. The wrapper: a normal looking C# property
    public decimal Amount
    {
        get => (decimal)GetValue(AmountProperty);
        set => SetValue(AmountProperty, value);
    }
}
```

1. **The registration.** `DependencyProperty.Register` tells WPF "the `MoneyTile` class has a property called `Amount` of type `decimal`". The result is stored in a `static` field whose name is the property name plus `Property`. This naming rule is required: XAML looks for `AmountProperty` when it sees `Amount`.
2. **The wrapper.** A normal property that just calls `GetValue` and `SetValue`. Those methods come from `DependencyObject`, which every WPF element inherits from. The wrapper is there so C# code can write `tile.Amount = 10` instead of `tile.SetValue(MoneyTile.AmountProperty, 10m)`.

In Visual Studio, type `propdp` and press Tab twice. A snippet writes this skeleton for you.

## The golden rule: nothing else in the wrapper

When XAML or a binding sets a dependency property, WPF calls `SetValue` **directly**. It skips your wrapper. So code like this never runs from XAML:

```csharp
public decimal Amount
{
    get => (decimal)GetValue(AmountProperty);
    set
    {
        SetValue(AmountProperty, value);
        UpdateColour(); // NOT called when a binding changes Amount!
    }
}
```

Keep the wrapper to exactly one `GetValue` and one `SetValue`. To react to changes, use a **property changed callback**, shown below.

## Using the property inside the control

Inside `MoneyTile.xaml`, bind to the control's own properties. Give the root element a name and use `ElementName`:

```xml
<UserControl x:Class="CoinJar.Controls.MoneyTile"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             x:Name="Root">
    <StackPanel>
        <TextBlock Text="{Binding Label, ElementName=Root}" />
        <TextBlock Text="{Binding Amount, ElementName=Root, StringFormat=C}" FontSize="24" />
    </StackPanel>
</UserControl>
```

Why not `DataContext = this` in the constructor? Because then `Amount="{Binding Total}"` on the outside would look for `Total` on the `MoneyTile` itself instead of on the view model. Binding by `ElementName` (or with `RelativeSource={RelativeSource AncestorType=UserControl}`) leaves the `DataContext` alone, so outside bindings keep working.

## Metadata and default values

The fourth argument to `Register` is the **metadata**: the default value and options. `PropertyMetadata` is the basic kind. `FrameworkPropertyMetadata` adds options for layout and binding:

```csharp
new FrameworkPropertyMetadata(
    0m,
    FrameworkPropertyMetadataOptions.AffectsRender)
```

Useful options:

| Option | Meaning |
| --- | --- |
| `BindsTwoWayByDefault` | Bindings to this property are two way unless the user says otherwise (like `TextBox.Text`) |
| `AffectsMeasure`, `AffectsArrange` | Changing the value redoes layout |
| `AffectsRender` | Changing the value redraws the element |
| `Inherits` | Child elements inherit the value (like `FontSize`) |

The default value must be **exactly** the property's type. `new PropertyMetadata(0)` for a `decimal` property passes an `int`, and WPF throws an exception when the class loads. Write `0m` for decimal, `0.0` for double, `""` or `null` for string.

## Reacting to changes: property changed callbacks

To run code whenever the value changes, from any source, pass a **callback** in the metadata. It is a `static` method, so it receives the object whose property changed:

```csharp
public static readonly DependencyProperty LimitProperty =
    DependencyProperty.Register(nameof(Limit), typeof(decimal), typeof(MoneyTile),
        new PropertyMetadata(0m, OnAmountOrLimitChanged));

private static void OnAmountOrLimitChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
{
    var tile = (MoneyTile)d;
    tile.IsOverLimit = tile.Limit > 0 && tile.Amount > tile.Limit;
}
```

`e.OldValue` and `e.NewValue` hold the old and new values if you need them. The same callback can serve several properties, as here for both `Amount` and `Limit`.

## Read only dependency properties

`IsOverLimit` is calculated by the control. Outsiders may read it (and bind to it) but should not set it. Register it with `RegisterReadOnly`, which returns a **key**. Only code that holds the private key can set the value:

```csharp
private static readonly DependencyPropertyKey IsOverLimitPropertyKey =
    DependencyProperty.RegisterReadOnly(nameof(IsOverLimit), typeof(bool), typeof(MoneyTile),
        new PropertyMetadata(false));

public static readonly DependencyProperty IsOverLimitProperty = IsOverLimitPropertyKey.DependencyProperty;

public bool IsOverLimit
{
    get => (bool)GetValue(IsOverLimitProperty);
    private set => SetValue(IsOverLimitPropertyKey, value);
}
```

The control's XAML can now turn the amount red with a `DataTrigger` on `IsOverLimit`, as in the code panel.

## Coercion and validation

Two more callbacks guard the value:

- A **coerce** callback can **adjust** a value before it is stored. "If someone sets a rating of 7, store 5."
- A **validate** callback can **reject** a value outright. WPF throws an `ArgumentException` when it returns `false`.

Here is a small star rating control with both. It also uses `BindsTwoWayByDefault`, because a rating is an input, like a text box:

```csharp
public static readonly DependencyProperty ValueProperty =
    DependencyProperty.Register(nameof(Value), typeof(int), typeof(RatingControl),
        new FrameworkPropertyMetadata(
            0,
            FrameworkPropertyMetadataOptions.BindsTwoWayByDefault,
            propertyChangedCallback: null,
            coerceValueCallback: CoerceValue),
        validateValueCallback: v => (int)v >= 0); // negative is a bug: reject

private static object CoerceValue(DependencyObject d, object baseValue)
{
    return Math.Min((int)baseValue, 5); // too high: quietly store 5
}

public int Value
{
    get => (int)GetValue(ValueProperty);
    set => SetValue(ValueProperty, value);
}
```

Setting `Value = 7` stores 5. Setting `Value = -1` throws, because a negative rating means there is a bug somewhere. WPF runs validation first, then coercion.

Now `<controls:RatingControl Value="{Binding Stars}" />` updates `Stars` in the view model when the user clicks a star, with no `Mode=TwoWay` needed. The validate callback is static and gets only the value, so it cannot look at other properties. Use coercion for rules that depend on other values.

## Dependency property or INotifyPropertyChanged?

Both give change notification, so which should you use?

- **View models and models:** use `INotifyPropertyChanged` (or `ObservableObject` from [MVVM with CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm)). They are plain C# classes and should not depend on WPF.
- **Controls:** use dependency properties. They are what bindings, styles and animations need on the **target** side.

A handy way to remember it: a binding goes **from** an `INotifyPropertyChanged` source **to** a dependency property target.

## Common mistakes

- **Wrong field name.** The field must be named `AmountProperty` for a property called `Amount`. Use `nameof(Amount)` in `Register` so renames stay in sync.
- **Logic in the wrapper.** XAML and bindings skip it. Use a changed callback.
- **Default value of the wrong type.** `0` is not a `decimal`. Use `0m`.
- **Mutable default for a collection.** `new PropertyMetadata(new List<string>())` shares **one** list between every instance of the control. Set the collection in the constructor instead.
- **Setting `DataContext = this`.** It breaks bindings set from outside. Bind with `ElementName` or `RelativeSource`.
- **Forgetting it must live on a `DependencyObject`.** Only classes that inherit from `DependencyObject` (all controls do) can have dependency properties.

## Quick recap

- A dependency property is managed by WPF's property system, which allows bindings, styles, triggers, animation and inheritance.
- Register it with `DependencyProperty.Register` in a `public static readonly` field named `XxxProperty`, plus a wrapper that only calls `GetValue` and `SetValue`.
- Metadata sets the default value and options such as `BindsTwoWayByDefault` and `AffectsRender`.
- Use a changed callback to react to changes, a coerce callback to adjust values and a validate callback to reject them.
- `RegisterReadOnly` and a private key make a property others can read but not set.
- Inside a user control, bind to your own properties with `ElementName` instead of setting `DataContext = this`.
- Next, [Attached Properties and Behaviors](/courses/wpf/attached-properties-and-behaviors) shows dependency properties you can put on **other** elements.

<code id="code-content" class="language-csharp">
// Controls/MoneyTile.xaml.cs
using System.Windows;
using System.Windows.Controls;
namespace CoinJar.Controls;
// Shows a label and an amount; turns red when Amount goes over Limit
public partial class MoneyTile : UserControl
{
    public MoneyTile()
    {
        InitializeComponent();
        // No DataContext = this: outside bindings must keep working
    }
    // Label: plain string, default empty
    public static readonly DependencyProperty LabelProperty =
        DependencyProperty.Register(nameof(Label), typeof(string), typeof(MoneyTile),
            new PropertyMetadata(""));
    public string Label
    {
        get =&gt; (string)GetValue(LabelProperty);
        set =&gt; SetValue(LabelProperty, value);
    }
    // Amount: the default must be a decimal (0m), not an int
    public static readonly DependencyProperty AmountProperty =
        DependencyProperty.Register(nameof(Amount), typeof(decimal), typeof(MoneyTile),
            new PropertyMetadata(0m, OnAmountOrLimitChanged));
    public decimal Amount
    {
        get =&gt; (decimal)GetValue(AmountProperty);
        set =&gt; SetValue(AmountProperty, value); // nothing else in here!
    }
    // Limit: 0 means "no limit"; negative values are rejected
    public static readonly DependencyProperty LimitProperty =
        DependencyProperty.Register(nameof(Limit), typeof(decimal), typeof(MoneyTile),
            new PropertyMetadata(0m, OnAmountOrLimitChanged),
            value =&gt; (decimal)value &gt;= 0m);
    public decimal Limit
    {
        get =&gt; (decimal)GetValue(LimitProperty);
        set =&gt; SetValue(LimitProperty, value);
    }
    // IsOverLimit: read only, only this class holds the key
    private static readonly DependencyPropertyKey IsOverLimitPropertyKey =
        DependencyProperty.RegisterReadOnly(nameof(IsOverLimit), typeof(bool), typeof(MoneyTile),
            new PropertyMetadata(false));
    public static readonly DependencyProperty IsOverLimitProperty = IsOverLimitPropertyKey.DependencyProperty;
    public bool IsOverLimit
    {
        get =&gt; (bool)GetValue(IsOverLimitProperty);
        private set =&gt; SetValue(IsOverLimitPropertyKey, value);
    }
    // Runs for every change, whether from XAML, a binding, a style or code
    private static void OnAmountOrLimitChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        var tile = (MoneyTile)d;
        tile.IsOverLimit = tile.Limit &gt; 0 &amp;&amp; tile.Amount &gt; tile.Limit;
    }
}
&lt;!-- Controls/MoneyTile.xaml --&gt;
&lt;UserControl x:Class="CoinJar.Controls.MoneyTile"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             x:Name="Root"&gt;
    &lt;Border Padding="16" CornerRadius="8" BorderBrush="#DDD" BorderThickness="1"&gt;
        &lt;StackPanel&gt;
            &lt;!-- ElementName=Root reads this control's own properties --&gt;
            &lt;TextBlock Text="{Binding Label, ElementName=Root}" Foreground="Gray" /&gt;
            &lt;TextBlock Text="{Binding Amount, ElementName=Root, StringFormat=C}" FontSize="24"&gt;
                &lt;TextBlock.Style&gt;
                    &lt;Style TargetType="TextBlock"&gt;
                        &lt;Style.Triggers&gt;
                            &lt;DataTrigger Binding="{Binding IsOverLimit, ElementName=Root}" Value="True"&gt;
                                &lt;Setter Property="Foreground" Value="Firebrick" /&gt;
                            &lt;/DataTrigger&gt;
                        &lt;/Style.Triggers&gt;
                    &lt;/Style&gt;
                &lt;/TextBlock.Style&gt;
            &lt;/TextBlock&gt;
            &lt;TextBlock Text="{Binding Limit, ElementName=Root, StringFormat='Limit: {0:C}'}"
                       Foreground="Gray" FontSize="11" /&gt;
        &lt;/StackPanel&gt;
    &lt;/Border&gt;
&lt;/UserControl&gt;
&lt;!-- Views/SummaryView.xaml --&gt;
&lt;UserControl x:Class="CoinJar.Views.SummaryView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:controls="clr-namespace:CoinJar.Controls"&gt;
    &lt;UniformGrid Columns="2" Margin="16"&gt;
        &lt;!-- Amount binds to the view model; Label and Limit are fixed values --&gt;
        &lt;controls:MoneyTile Label="Spent this month" Amount="{Binding Total}" Limit="500" Margin="0,0,8,0" /&gt;
        &lt;controls:MoneyTile Label="Biggest expense" Amount="{Binding Biggest}" /&gt;
    &lt;/UniformGrid&gt;
&lt;/UserControl&gt;
</code></pre>
