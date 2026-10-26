---
publishDate: 2026-10-25T20:46
title: 'Custom Controls'
slug: custom-controls
metadescription: 'Build a lookless WPF custom control with a default style in Themes/Generic.xaml, DefaultStyleKeyProperty, dependency properties and TemplatePart, and learn when to pick it over a user control.'
updateDate: 2026-10-25T20:46
author: ['bishal-biswas']
level: 4
tags: ['wpf', 'custom-controls', 'control-templates', 'xaml']
course: wpf
---

## What a custom control is

In [User Controls](/courses/wpf/user-controls) you built pieces of UI by combining existing controls in a XAML file with code-behind. A user control is like a ready-made sandwich: the filling is fixed, and you can only use it as it is.

A **custom control** is different. It is a class that inherits from `Control` (or from another control) and has **no XAML file of its own**. Its look comes from a default style that lives somewhere else, in a file called `Themes/Generic.xaml`. Because the look is separate from the code, anyone using the control can swap the look completely with a new [control template](/courses/wpf/control-templates), just like you can restyle a `Button`.

People call this a **lookless control**: the class defines what the control *does*, and the template defines what it *looks like*. Every built in WPF control, from `Button` to `Slider`, is built this way.

## User control or custom control?

```text
User control                          Custom control
-----------------------------------   ------------------------------------
XAML file + code-behind               C# class + style in Generic.xaml
Fixed look                            Look can be replaced by a template
Quick to build                        More work, more flexible
Good for app screens and forms        Good for reusable, themeable widgets
Uses x:Name to reach its parts        Uses TemplatePart and GetTemplateChild
```

A good rule: if the control belongs to one app and nobody will ever restyle it, a user control is fine. CoinJar's `ExpenseCard` and `MoneyTile` are exactly that, and they can stay user controls. If it is a small widget you want to reuse, theme with Light and Dark modes, or share as a library, build a custom control.

In this lesson you build `AmountStepper` for CoinJar: a box that shows an amount with a minus and a plus button, which step the value up or down.

## Where custom controls live

### Option 1: inside the app

Every WPF app project already has what a custom control needs. Open `AssemblyInfo.cs` from the template:

```csharp
using System.Windows;

[assembly: ThemeInfo(
    ResourceDictionaryLocation.None,           // theme specific dictionaries
    ResourceDictionaryLocation.SourceAssembly  // Generic.xaml is in this assembly
)]
```

The second argument tells WPF: "look for `Themes/Generic.xaml` inside this assembly when a control needs its default style". So you can add a `Themes` folder with a `Generic.xaml` file to CoinJar itself, and it works.

### Option 2: a control library

To share controls between apps, create a separate library with the custom control template:

```bash
dotnet new wpfcustomcontrollib -n CoinJar.Controls
dotnet add CoinJar reference CoinJar.Controls
```

The template gives you `CustomControl1.cs`, `Themes/Generic.xaml` and the same `ThemeInfo` attribute. Rename `CustomControl1` to your control's name. In XAML you then map the namespace with the assembly name:

```xml
xmlns:controls="clr-namespace:CoinJar.Controls;assembly=CoinJar.Controls"
```

The code is the same either way. The rest of this lesson uses the `Controls` folder inside CoinJar.

## Step 1: the class and its default style key

Create `Controls/AmountStepper.cs`:

```csharp
using System.Windows;
using System.Windows.Controls;

namespace CoinJar.Controls;

public class AmountStepper : Control
{
    static AmountStepper()
    {
        DefaultStyleKeyProperty.OverrideMetadata(
            typeof(AmountStepper),
            new FrameworkPropertyMetadata(typeof(AmountStepper)));
    }
}
```

That **static constructor** runs once, before the first `AmountStepper` is created. The line inside is the heart of every custom control. It says: "my default style is the style whose key is my own type". Without it, WPF would use the style of the base class `Control`, which has no template, and your control would be invisible.

## Step 2: the default style in Generic.xaml

Create `Themes/Generic.xaml`. The file name and folder must be exactly this, because WPF looks for that path.

```xml
<ResourceDictionary
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="clr-namespace:CoinJar.Controls">

    <Style TargetType="{x:Type local:AmountStepper}">
        <Setter Property="Template">
            <Setter.Value>
                <ControlTemplate TargetType="{x:Type local:AmountStepper}">
                    <Border Background="{TemplateBinding Background}"
                            BorderBrush="{TemplateBinding BorderBrush}"
                            BorderThickness="{TemplateBinding BorderThickness}">
                        <!-- parts go here -->
                    </Border>
                </ControlTemplate>
            </Setter.Value>
        </Setter>
    </Style>
</ResourceDictionary>
```

Notice the style has **no `x:Key`**. Its key is its `TargetType`, which matches the default style key you set in the static constructor. You do not merge `Generic.xaml` into `App.xaml`. WPF finds it on its own.

`TemplateBinding` connects a property inside the template to a property of the control. If the user writes `Background="LightYellow"` on the stepper, the border picks it up.

## Step 3: dependency properties

The control needs a `Value`, a `Step` and a `Minimum`. You already know how to write these from [Dependency Properties](/courses/wpf/dependency-properties):

```csharp
public static readonly DependencyProperty ValueProperty =
    DependencyProperty.Register(
        nameof(Value), typeof(decimal), typeof(AmountStepper),
        new FrameworkPropertyMetadata(
            0m,
            FrameworkPropertyMetadataOptions.BindsTwoWayByDefault,
            propertyChangedCallback: null,
            coerceValueCallback: CoerceValue));

public decimal Value
{
    get => (decimal)GetValue(ValueProperty);
    set => SetValue(ValueProperty, value);
}

private static object CoerceValue(DependencyObject d, object baseValue)
{
    var stepper = (AmountStepper)d;
    decimal value = (decimal)baseValue;
    return value < stepper.Minimum ? stepper.Minimum : value;
}
```

Two details are worth noticing:

- `BindsTwoWayByDefault` means `Value="{Binding Amount}"` is two way without writing `Mode=TwoWay`, like `TextBox.Text`. A stepper is an input control, so that is what users expect.
- A **coerce callback** is a guard that WPF runs before storing a value. Here it stops the amount from going below `Minimum`.

`Step` and `Minimum` are simpler. See the full class in the code panel.

## Step 4: named parts with TemplatePart

The buttons are inside the template, not in your class. How does the class find them? By agreement on names. A **template part** is an element in the template with a special name, by convention starting with `PART_`. The control looks it up when the template is applied.

First, document the parts with the `TemplatePart` [attribute](/courses/c-sharp/attributes). It does not change behavior, but it tells designers and tools which names the template should contain:

```csharp
[TemplatePart(Name = PartDecrease, Type = typeof(ButtonBase))]
[TemplatePart(Name = PartIncrease, Type = typeof(ButtonBase))]
public class AmountStepper : Control
{
    private const string PartDecrease = "PART_Decrease";
    private const string PartIncrease = "PART_Increase";
    // ...
}
```

Then add the parts to the template in `Generic.xaml`:

```xml
<Grid>
    <Grid.ColumnDefinitions>
        <ColumnDefinition Width="Auto" />
        <ColumnDefinition Width="*" />
        <ColumnDefinition Width="Auto" />
    </Grid.ColumnDefinitions>

    <RepeatButton x:Name="PART_Decrease" Content="-" Width="28" />
    <TextBlock Grid.Column="1" VerticalAlignment="Center" TextAlignment="Center"
               Text="{Binding Value, RelativeSource={RelativeSource TemplatedParent}, StringFormat=C}" />
    <RepeatButton x:Name="PART_Increase" Grid.Column="2" Content="+" Width="28" />
</Grid>
```

A `RepeatButton` keeps firing `Click` while you hold it down, which is nice for a stepper. The text uses a full `Binding` with `RelativeSource TemplatedParent` instead of `TemplateBinding`, because `TemplateBinding` has no `StringFormat`. `StringFormat=C` shows currency in the culture of the UI, which you will control in [App Settings and Configuration](/courses/wpf/app-settings-and-configuration).

## Step 5: OnApplyTemplate

`OnApplyTemplate` runs every time a template is applied to the control. This is where you find the parts with `GetTemplateChild` and hook up events:

```csharp
private ButtonBase? _decreaseButton;
private ButtonBase? _increaseButton;

public override void OnApplyTemplate()
{
    // Unhook the old parts first, the template can be replaced at runtime.
    if (_decreaseButton is not null) _decreaseButton.Click -= OnDecreaseClick;
    if (_increaseButton is not null) _increaseButton.Click -= OnIncreaseClick;

    base.OnApplyTemplate();

    _decreaseButton = GetTemplateChild(PartDecrease) as ButtonBase;
    _increaseButton = GetTemplateChild(PartIncrease) as ButtonBase;

    if (_decreaseButton is not null) _decreaseButton.Click += OnDecreaseClick;
    if (_increaseButton is not null) _increaseButton.Click += OnIncreaseClick;
}

private void OnDecreaseClick(object sender, RoutedEventArgs e) => Value -= Step;
private void OnIncreaseClick(object sender, RoutedEventArgs e) => Value += Step;
```

Use `as` and check for `null`. A good custom control **keeps working when a part is missing**. Someone may write a template with only a plus button, and that should not crash the app.

## Step 6: use it

```xml
<Window ...
        xmlns:controls="clr-namespace:CoinJar.Controls">

    <controls:AmountStepper Value="{Binding Amount}"
                            Step="0.50"
                            Minimum="0"
                            Width="180"
                            BorderBrush="Gray"
                            BorderThickness="1" />
</Window>
```

It binds like any built in control. The view model's `Amount` updates when the user clicks the buttons, because `Value` binds two way by default.

## Replacing the look

Because the control is lookless, a user of the control can give it a completely different template, as long as the part names stay the same:

```xml
<controls:AmountStepper Value="{Binding Amount}">
    <controls:AmountStepper.Template>
        <ControlTemplate TargetType="controls:AmountStepper">
            <StackPanel Orientation="Horizontal">
                <TextBlock Text="{Binding Value, RelativeSource={RelativeSource TemplatedParent}, StringFormat=C}"
                           FontSize="20" Margin="0,0,8,0" />
                <Button x:Name="PART_Increase" Content="Add 0.50" />
            </StackPanel>
        </ControlTemplate>
    </controls:AmountStepper.Template>
</controls:AmountStepper>
```

This template has no decrease button. `GetTemplateChild` returns `null` for it, our code skips it, and the control still works. That is the payoff of the `PART_` agreement and the null checks.

## Raising your own routed event

Custom controls often raise an event when something important happens. A **routed event** travels up the element tree, like `Button.Click` does. Here is a `ValueChanged` event:

```csharp
public static readonly RoutedEvent ValueChangedEvent =
    EventManager.RegisterRoutedEvent(
        nameof(ValueChanged), RoutingStrategy.Bubble,
        typeof(RoutedEventHandler), typeof(AmountStepper));

public event RoutedEventHandler ValueChanged
{
    add => AddHandler(ValueChangedEvent, value);
    remove => RemoveHandler(ValueChangedEvent, value);
}
```

Raise it from the property changed callback of `Value` with `RaiseEvent(new RoutedEventArgs(ValueChangedEvent, this))`. In MVVM apps you usually bind to `Value` instead, but an event is handy for code-behind and for [animations](/courses/wpf/animations-and-storyboards) triggered by `EventTrigger`.

## Common mistakes

- **Forgetting `DefaultStyleKeyProperty.OverrideMetadata`.** The control shows nothing at all. This is the number one custom control bug.
- **Wrong path or name for Generic.xaml.** It must be `Themes/Generic.xaml` in the assembly that holds the control, and `AssemblyInfo.cs` must have `ResourceDictionaryLocation.SourceAssembly` as the second `ThemeInfo` argument.
- **Giving the default style an `x:Key`.** Then it is no longer the default style and WPF will not find it.
- **Using `TemplateBinding` with `StringFormat` or two way.** `TemplateBinding` is a light, one way binding with no `StringFormat`. Use `{Binding ..., RelativeSource={RelativeSource TemplatedParent}}` for those cases.
- **Crashing when a part is missing.** Always cast with `as` and check for `null` in `OnApplyTemplate`.
- **Not unhooking old parts.** `OnApplyTemplate` can run more than once. Remove handlers from the old parts before you look up the new ones.

## Quick recap

- A custom control is a class deriving from `Control` with its look in a default style in `Themes/Generic.xaml`.
- The static constructor calls `DefaultStyleKeyProperty.OverrideMetadata(typeof(X), new FrameworkPropertyMetadata(typeof(X)))` so WPF finds that style.
- `ThemeInfo` in `AssemblyInfo.cs` tells WPF that `Generic.xaml` is in the assembly. `dotnet new wpfcustomcontrollib` sets this up for a shared library.
- Expose settings as dependency properties. `BindsTwoWayByDefault` and coerce callbacks make input controls feel natural.
- Name template elements `PART_Something`, document them with `[TemplatePart]`, and find them in `OnApplyTemplate` with `GetTemplateChild`.
- Users can replace the template, so handle missing parts gracefully.

<code id="code-content" class="language-csharp">
// Controls/AmountStepper.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
namespace CoinJar.Controls;
// A lookless control: the code here, the look in Themes/Generic.xaml.
// [TemplatePart] documents the named parts a template should contain.
[TemplatePart(Name = PartDecrease, Type = typeof(ButtonBase))]
[TemplatePart(Name = PartIncrease, Type = typeof(ButtonBase))]
public class AmountStepper : Control
{
    private const string PartDecrease = "PART_Decrease";
    private const string PartIncrease = "PART_Increase";
    private ButtonBase? _decreaseButton;
    private ButtonBase? _increaseButton;
    static AmountStepper()
    {
        // "My default style is the one keyed by my own type."
        DefaultStyleKeyProperty.OverrideMetadata(
            typeof(AmountStepper),
            new FrameworkPropertyMetadata(typeof(AmountStepper)));
    }
    // ----- Value: the amount, two way by default, never below Minimum -----
    public static readonly DependencyProperty ValueProperty =
        DependencyProperty.Register(
            nameof(Value), typeof(decimal), typeof(AmountStepper),
            new FrameworkPropertyMetadata(
                0m,
                FrameworkPropertyMetadataOptions.BindsTwoWayByDefault,
                OnValueChanged,
                CoerceValue));
    public decimal Value
    {
        get =&gt; (decimal)GetValue(ValueProperty);
        set =&gt; SetValue(ValueProperty, value);
    }
    private static object CoerceValue(DependencyObject d, object baseValue)
    {
        var stepper = (AmountStepper)d;
        decimal value = (decimal)baseValue;
        return value &lt; stepper.Minimum ? stepper.Minimum : value;
    }
    private static void OnValueChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        var stepper = (AmountStepper)d;
        stepper.RaiseEvent(new RoutedEventArgs(ValueChangedEvent, stepper));
    }
    // ----- Step: how much one click adds or removes -----
    public static readonly DependencyProperty StepProperty =
        DependencyProperty.Register(
            nameof(Step), typeof(decimal), typeof(AmountStepper),
            new PropertyMetadata(1m));
    public decimal Step
    {
        get =&gt; (decimal)GetValue(StepProperty);
        set =&gt; SetValue(StepProperty, value);
    }
    // ----- Minimum: the lowest allowed value -----
    public static readonly DependencyProperty MinimumProperty =
        DependencyProperty.Register(
            nameof(Minimum), typeof(decimal), typeof(AmountStepper),
            new PropertyMetadata(0m, OnMinimumChanged));
    public decimal Minimum
    {
        get =&gt; (decimal)GetValue(MinimumProperty);
        set =&gt; SetValue(MinimumProperty, value);
    }
    // When Minimum changes, run the coerce callback of Value again.
    private static void OnMinimumChanged(DependencyObject d, DependencyPropertyChangedEventArgs e) =&gt;
        d.CoerceValue(ValueProperty);
    // ----- A routed event that bubbles up when Value changes -----
    public static readonly RoutedEvent ValueChangedEvent =
        EventManager.RegisterRoutedEvent(
            nameof(ValueChanged), RoutingStrategy.Bubble,
            typeof(RoutedEventHandler), typeof(AmountStepper));
    public event RoutedEventHandler ValueChanged
    {
        add =&gt; AddHandler(ValueChangedEvent, value);
        remove =&gt; RemoveHandler(ValueChangedEvent, value);
    }
    // ----- Find the parts each time a template is applied -----
    public override void OnApplyTemplate()
    {
        if (_decreaseButton is not null) _decreaseButton.Click -= OnDecreaseClick;
        if (_increaseButton is not null) _increaseButton.Click -= OnIncreaseClick;
        base.OnApplyTemplate();
        // 'as' returns null when a template leaves a part out. That is allowed.
        _decreaseButton = GetTemplateChild(PartDecrease) as ButtonBase;
        _increaseButton = GetTemplateChild(PartIncrease) as ButtonBase;
        if (_decreaseButton is not null) _decreaseButton.Click += OnDecreaseClick;
        if (_increaseButton is not null) _increaseButton.Click += OnIncreaseClick;
    }
    private void OnDecreaseClick(object sender, RoutedEventArgs e) =&gt; Value -= Step;
    private void OnIncreaseClick(object sender, RoutedEventArgs e) =&gt; Value += Step;
}
&lt;!-- Themes/Generic.xaml --&gt;
&lt;ResourceDictionary
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="clr-namespace:CoinJar.Controls"&gt;
    &lt;!-- No x:Key: the TargetType is the key, matching DefaultStyleKey. --&gt;
    &lt;Style TargetType="{x:Type local:AmountStepper}"&gt;
        &lt;Setter Property="BorderBrush" Value="Gray" /&gt;
        &lt;Setter Property="BorderThickness" Value="1" /&gt;
        &lt;Setter Property="Padding" Value="4" /&gt;
        &lt;Setter Property="MinHeight" Value="32" /&gt;
        &lt;Setter Property="Template"&gt;
            &lt;Setter.Value&gt;
                &lt;ControlTemplate TargetType="{x:Type local:AmountStepper}"&gt;
                    &lt;Border Background="{TemplateBinding Background}"
                            BorderBrush="{TemplateBinding BorderBrush}"
                            BorderThickness="{TemplateBinding BorderThickness}"
                            CornerRadius="4"&gt;
                        &lt;Grid&gt;
                            &lt;Grid.ColumnDefinitions&gt;
                                &lt;ColumnDefinition Width="Auto" /&gt;
                                &lt;ColumnDefinition Width="*" /&gt;
                                &lt;ColumnDefinition Width="Auto" /&gt;
                            &lt;/Grid.ColumnDefinitions&gt;
                            &lt;RepeatButton x:Name="PART_Decrease" Content="-" Width="28" /&gt;
                            &lt;!-- TemplateBinding has no StringFormat, so use a full Binding. --&gt;
                            &lt;TextBlock Grid.Column="1"
                                       Margin="{TemplateBinding Padding}"
                                       VerticalAlignment="Center"
                                       TextAlignment="Center"
                                       Text="{Binding Value, RelativeSource={RelativeSource TemplatedParent}, StringFormat=C}" /&gt;
                            &lt;RepeatButton x:Name="PART_Increase" Grid.Column="2" Content="+" Width="28" /&gt;
                        &lt;/Grid&gt;
                    &lt;/Border&gt;
                &lt;/ControlTemplate&gt;
            &lt;/Setter.Value&gt;
        &lt;/Setter&gt;
    &lt;/Style&gt;
&lt;/ResourceDictionary&gt;
&lt;!-- Views/ExpenseFormView.xaml (using the control) --&gt;
&lt;UserControl x:Class="CoinJar.Views.ExpenseFormView"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             xmlns:controls="clr-namespace:CoinJar.Controls"&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;TextBlock Text="Amount" /&gt;
        &lt;controls:AmountStepper Value="{Binding Amount}" Step="0.50" Minimum="0" Width="180"
                                HorizontalAlignment="Left" /&gt;
    &lt;/StackPanel&gt;
&lt;/UserControl&gt;
</code></pre>
