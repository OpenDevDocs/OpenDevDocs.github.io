---
publishDate: 2026-10-25T20:47
title: 'Animations and Storyboards'
slug: animations-and-storyboards
metadescription: 'Animate WPF properties with DoubleAnimation and ColorAnimation, group them in storyboards, start them from triggers or code, and use easing, transforms and key frames well.'
updateDate: 2026-10-25T20:47
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'animation', 'storyboard', 'xaml']
course: wpf
---

## What an animation is in WPF

In many UI toolkits you animate by changing a value in a timer, again and again. WPF has animation built in. You describe the change ("go from opacity 0 to 1 in 0.3 seconds") and WPF does the frame by frame work for you.

An **animation** in WPF changes one [dependency property](/courses/wpf/dependency-properties) over a stretch of time. Only dependency properties can be animated, which is one more reason they exist. Almost every visual property you use is one: `Opacity`, `Width`, `Background`, `Margin`, the values inside transforms.

Animations are useful for small touches that help the user: a new expense fades in so you notice it, a button grows slightly when you hover, a field shakes when the input is wrong. Keep them short and calm. Animation should explain a change, not decorate it.

## Your first animation

The simplest way to try one is from code, with `BeginAnimation`:

```csharp
using System.Windows.Media.Animation;

var fade = new DoubleAnimation
{
    From = 0,                                    // start value
    To = 1,                                      // end value
    Duration = TimeSpan.FromMilliseconds(300)    // how long
};

TotalText.BeginAnimation(OpacityProperty, fade);
```

`DoubleAnimation` animates a `double` property. `Opacity` is a `double`, so it fits. There is a matching animation class for each common type:

```text
DoubleAnimation      Opacity, Width, Height, FontSize, transform values
ColorAnimation       the Color of a SolidColorBrush
ThicknessAnimation   Margin, Padding, BorderThickness
PointAnimation       points in geometry
```

If you leave out `From`, the animation starts from the current value. That is usually what you want, because it avoids a jump when an animation starts in the middle of another one.

## Storyboards in XAML

Most WPF animations are written in XAML inside a **storyboard**. A storyboard is a container that holds one or more animations, says which element and property each one targets, and starts them together. Think of it as the script for a short scene.

```xml
<Storyboard>
    <DoubleAnimation Storyboard.TargetName="TotalText"
                     Storyboard.TargetProperty="Opacity"
                     From="0" To="1" Duration="0:0:0.3" />
</Storyboard>
```

- `Storyboard.TargetName` is the `x:Name` of the element.
- `Storyboard.TargetProperty` is the property to animate.
- `Duration` uses the format `hours:minutes:seconds`, so `0:0:0.3` is 0.3 seconds.

A storyboard does nothing on its own. Something has to start it.

## Starting a storyboard with a trigger

An **event trigger** starts a storyboard when a routed event fires. `BeginStoryboard` is the action that starts it. Here the total fades in when the window loads:

```xml
<TextBlock x:Name="TotalText" Text="Total: $42.50" FontSize="24">
    <TextBlock.Triggers>
        <EventTrigger RoutedEvent="Loaded">
            <BeginStoryboard>
                <Storyboard>
                    <DoubleAnimation Storyboard.TargetProperty="Opacity"
                                     From="0" To="1" Duration="0:0:0.6" />
                </Storyboard>
            </BeginStoryboard>
        </EventTrigger>
    </TextBlock.Triggers>
</TextBlock>
```

When the storyboard lives inside the element's own triggers, you can leave out `Storyboard.TargetName`. It targets the element itself.

### Animations in styles

Inside a style, a property [trigger](/courses/wpf/triggers) such as `IsMouseOver` cannot use `BeginStoryboard` directly in its setters. Instead it has `EnterActions` (run when the condition becomes true) and `ExitActions` (run when it becomes false again):

```xml
<Style x:Key="SoftButton" TargetType="Button">
    <Setter Property="Opacity" Value="0.8" />
    <Style.Triggers>
        <Trigger Property="IsMouseOver" Value="True">
            <Trigger.EnterActions>
                <BeginStoryboard>
                    <Storyboard>
                        <DoubleAnimation Storyboard.TargetProperty="Opacity"
                                         To="1" Duration="0:0:0.15" />
                    </Storyboard>
                </BeginStoryboard>
            </Trigger.EnterActions>
            <Trigger.ExitActions>
                <BeginStoryboard>
                    <Storyboard>
                        <DoubleAnimation Storyboard.TargetProperty="Opacity"
                                         To="0.8" Duration="0:0:0.3" />
                    </Storyboard>
                </BeginStoryboard>
            </Trigger.ExitActions>
        </Trigger>
    </Style.Triggers>
</Style>
```

Notice there is no `From`. Each animation starts wherever the opacity is right now, so moving the mouse in and out quickly never causes a jump.

## Animating transforms for smooth motion

To move, grow or rotate something, animate a **transform**, not `Width`, `Height` or `Margin`. A transform changes how the element is drawn without changing its layout, so WPF does not have to measure and arrange the whole window on every frame. It is much smoother.

Give the element a transform first, then target the property inside it:

```xml
<Button Content="Add expense" RenderTransformOrigin="0.5,0.5">
    <Button.RenderTransform>
        <ScaleTransform ScaleX="1" ScaleY="1" />
    </Button.RenderTransform>
    <Button.Triggers>
        <EventTrigger RoutedEvent="MouseEnter">
            <BeginStoryboard>
                <Storyboard>
                    <DoubleAnimation Storyboard.TargetProperty="RenderTransform.ScaleX"
                                     To="1.05" Duration="0:0:0.15" />
                    <DoubleAnimation Storyboard.TargetProperty="RenderTransform.ScaleY"
                                     To="1.05" Duration="0:0:0.15" />
                </Storyboard>
            </BeginStoryboard>
        </EventTrigger>
    </Button.Triggers>
</Button>
```

`RenderTransformOrigin="0.5,0.5"` makes the button grow from its center instead of its top left corner. `RenderTransform.ScaleX` is a **property path**: it walks from the button to its transform, then to `ScaleX`. You will also see the long form `(UIElement.RenderTransform).(ScaleTransform.ScaleX)` in older code. Both work.

## Easing, repeating and reversing

A plain animation moves at a constant speed, which looks mechanical. An **easing function** changes the speed along the way, like a car that slows down before it stops.

```xml
<DoubleAnimation Storyboard.TargetProperty="Opacity" To="1" Duration="0:0:0.4">
    <DoubleAnimation.EasingFunction>
        <CubicEase EasingMode="EaseOut" />
    </DoubleAnimation.EasingFunction>
</DoubleAnimation>
```

`EaseOut` starts fast and slows down at the end, which feels natural for things appearing. Other easing classes include `QuadraticEase`, `SineEase`, `BackEase` (overshoots a little) and `BounceEase`.

A few more timing properties work on any animation or storyboard:

```xml
<DoubleAnimation To="0.3" Duration="0:0:0.5"
                 AutoReverse="True"            
                 RepeatBehavior="3x"
                 BeginTime="0:0:1" />
```

- `AutoReverse="True"` plays forward, then backward.
- `RepeatBehavior` can be a count (`3x`), a total time (`0:0:5`) or `Forever`.
- `BeginTime` waits before starting. In a storyboard with several animations, different `BeginTime` values let you play them one after another.

## Colors and the frozen brush trap

A `ColorAnimation` changes the `Color` of a `SolidColorBrush`. To flash a card red when the user goes over budget:

```xml
<Border x:Name="BudgetCard" Padding="12">
    <Border.Background>
        <SolidColorBrush Color="White" />
    </Border.Background>
</Border>
```

```xml
<ColorAnimation Storyboard.TargetName="BudgetCard"
                Storyboard.TargetProperty="Background.Color"
                To="IndianRed" Duration="0:0:0.2"
                AutoReverse="True" />
```

Here is the trap. If you write the short form `Background="White"`, or the brush comes from a style setter or a shared resource, the brush is often **frozen**. A frozen object is locked so it can be shared safely and drawn faster, and a locked object cannot change. The storyboard then fails with an error saying it cannot animate the color on an immutable object. The fix is to give the element its own brush with the long form, as above, so the animation has something it is allowed to change.

## Key frames

A normal animation goes from one value to another. A **key frame animation** passes through several values at chosen times, like points on a timeline. A shake is a good example: left, right, left, back to the middle.

```xml
<DoubleAnimationUsingKeyFrames Storyboard.TargetName="AmountBox"
                               Storyboard.TargetProperty="RenderTransform.X">
    <LinearDoubleKeyFrame KeyTime="0:0:0.05" Value="-6" />
    <LinearDoubleKeyFrame KeyTime="0:0:0.10" Value="6" />
    <LinearDoubleKeyFrame KeyTime="0:0:0.15" Value="-4" />
    <LinearDoubleKeyFrame KeyTime="0:0:0.20" Value="0" />
</DoubleAnimationUsingKeyFrames>
```

The `AmountBox` needs a `TranslateTransform` as its `RenderTransform` for `RenderTransform.X` to exist. Use this shake when [input validation](/courses/wpf/input-validation) fails and the user clicks Save.

## Starting a storyboard from code

Sometimes the reason to animate comes from code, for example after a new expense is added. Put the storyboard in resources with a key, then find it and start it:

```xml
<Window.Resources>
    <Storyboard x:Key="FlashTotal">
        <DoubleAnimation Storyboard.TargetName="TotalText"
                         Storyboard.TargetProperty="Opacity"
                         From="0.2" To="1" Duration="0:0:0.4" />
    </Storyboard>
</Window.Resources>
```

```csharp
var storyboard = (Storyboard)FindResource("FlashTotal");
storyboard.Begin(this);   // 'this' is where TargetName is looked up
```

`Storyboard` also has a `Completed` [event](/courses/c-sharp/events), so you can run code when an animation ends, for example removing an item after it has faded out.

In MVVM apps, keep animations in the view. The view model should not know about storyboards. A view can react to a view model property with a `DataTrigger` and `EnterActions`, exactly like the `IsMouseOver` trigger above.

## Animated values stick around

When an animation ends, it keeps holding its final value by default. That is `FillBehavior="HoldEnd"`. The animated value has a higher priority than a value you set in code, so this surprises people:

```csharp
TotalText.BeginAnimation(OpacityProperty, fadeOut); // ends at 0
TotalText.Opacity = 1;                              // no visible effect!
```

You have two ways out:

```csharp
// 1. Remove the animation, then set the value
TotalText.BeginAnimation(OpacityProperty, null);
TotalText.Opacity = 1;
```

```xml
<!-- 2. Let the property snap back to its normal value when the animation ends -->
<DoubleAnimation To="0" Duration="0:0:0.3" FillBehavior="Stop" />
```

## Tips for good animations

- **Keep them short.** 150 to 400 milliseconds for most UI feedback. Long animations make an app feel slow.
- **Animate `Opacity` and transforms.** Animating `Width`, `Height` or `Margin` forces layout on every frame.
- **Leave out `From` for hover effects** so interrupted animations do not jump.
- **Respect the user's settings.** Windows lets people turn off animations. `SystemParameters.ClientAreaAnimation` is `false` when they have. Skip decorative animations in that case.
- **Do not animate to show that work is happening** for a long task. Use a progress bar, which you will meet in [Async, Await and a Responsive UI](/courses/wpf/async-await-and-a-responsive-ui).

## Quick recap

- A WPF animation changes a dependency property over time. Pick the class by type: `DoubleAnimation`, `ColorAnimation`, `ThicknessAnimation`.
- A storyboard groups animations and sets `Storyboard.TargetName` and `Storyboard.TargetProperty`.
- Start storyboards with `EventTrigger` and `BeginStoryboard`, with `EnterActions` and `ExitActions` on property triggers, or from code with `Begin`.
- Animate transforms (`ScaleTransform`, `TranslateTransform`) and `Opacity` for smooth motion.
- Easing functions, `AutoReverse`, `RepeatBehavior` and `BeginTime` shape the timing. Key frame animations pass through several values.
- Brushes from shared resources can be frozen, so give an element its own brush before animating its color.
- Animations hold their final value. Use `FillBehavior="Stop"` or `BeginAnimation(property, null)` when you need to set the value again.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Width="420" Height="480"&gt;
    &lt;Window.Resources&gt;
        &lt;!-- Started from code each time an expense is added. --&gt;
        &lt;Storyboard x:Key="FlashTotal"&gt;
            &lt;DoubleAnimation Storyboard.TargetName="TotalText"
                             Storyboard.TargetProperty="Opacity"
                             From="0.2" To="1" Duration="0:0:0.4" /&gt;
        &lt;/Storyboard&gt;
        &lt;!-- Shakes the amount box when the input is not a valid number. --&gt;
        &lt;Storyboard x:Key="ShakeAmount"&gt;
            &lt;DoubleAnimationUsingKeyFrames Storyboard.TargetName="AmountBox"
                                           Storyboard.TargetProperty="RenderTransform.X"&gt;
                &lt;LinearDoubleKeyFrame KeyTime="0:0:0.05" Value="-6" /&gt;
                &lt;LinearDoubleKeyFrame KeyTime="0:0:0.10" Value="6" /&gt;
                &lt;LinearDoubleKeyFrame KeyTime="0:0:0.15" Value="-4" /&gt;
                &lt;LinearDoubleKeyFrame KeyTime="0:0:0.20" Value="0" /&gt;
            &lt;/DoubleAnimationUsingKeyFrames&gt;
        &lt;/Storyboard&gt;
        &lt;!-- A button that grows a little on hover. No From, so no jumps. --&gt;
        &lt;Style x:Key="GrowButton" TargetType="Button"&gt;
            &lt;Setter Property="RenderTransformOrigin" Value="0.5,0.5" /&gt;
            &lt;Setter Property="RenderTransform"&gt;
                &lt;Setter.Value&gt;
                    &lt;ScaleTransform ScaleX="1" ScaleY="1" /&gt;
                &lt;/Setter.Value&gt;
            &lt;/Setter&gt;
            &lt;Style.Triggers&gt;
                &lt;Trigger Property="IsMouseOver" Value="True"&gt;
                    &lt;Trigger.EnterActions&gt;
                        &lt;BeginStoryboard&gt;
                            &lt;Storyboard&gt;
                                &lt;DoubleAnimation Storyboard.TargetProperty="RenderTransform.ScaleX" To="1.05" Duration="0:0:0.15" /&gt;
                                &lt;DoubleAnimation Storyboard.TargetProperty="RenderTransform.ScaleY" To="1.05" Duration="0:0:0.15" /&gt;
                            &lt;/Storyboard&gt;
                        &lt;/BeginStoryboard&gt;
                    &lt;/Trigger.EnterActions&gt;
                    &lt;Trigger.ExitActions&gt;
                        &lt;BeginStoryboard&gt;
                            &lt;Storyboard&gt;
                                &lt;DoubleAnimation Storyboard.TargetProperty="RenderTransform.ScaleX" To="1" Duration="0:0:0.2" /&gt;
                                &lt;DoubleAnimation Storyboard.TargetProperty="RenderTransform.ScaleY" To="1" Duration="0:0:0.2" /&gt;
                            &lt;/Storyboard&gt;
                        &lt;/BeginStoryboard&gt;
                    &lt;/Trigger.ExitActions&gt;
                &lt;/Trigger&gt;
            &lt;/Style.Triggers&gt;
        &lt;/Style&gt;
    &lt;/Window.Resources&gt;
    &lt;DockPanel Margin="16"&gt;
        &lt;TextBlock x:Name="TotalText" DockPanel.Dock="Top" FontSize="24" Margin="0,0,0,12"
                   Text="{Binding Total, StringFormat='Total: {0:C}'}" /&gt;
        &lt;StackPanel DockPanel.Dock="Top" Orientation="Horizontal" Margin="0,0,0,12"&gt;
            &lt;TextBox x:Name="TitleBox" Width="150" Margin="0,0,8,0" Text="Coffee" /&gt;
            &lt;!-- The shake needs a TranslateTransform to move. --&gt;
            &lt;TextBox x:Name="AmountBox" Width="80" Margin="0,0,8,0" Text="3.50"&gt;
                &lt;TextBox.RenderTransform&gt;
                    &lt;TranslateTransform /&gt;
                &lt;/TextBox.RenderTransform&gt;
            &lt;/TextBox&gt;
            &lt;Button Content="Add" Padding="12,4" Style="{StaticResource GrowButton}" Click="OnAddClick" /&gt;
        &lt;/StackPanel&gt;
        &lt;ListBox ItemsSource="{Binding Expenses}" HorizontalContentAlignment="Stretch"&gt;
            &lt;ListBox.ItemTemplate&gt;
                &lt;DataTemplate&gt;
                    &lt;!-- Each new row fades in and slides up a little. --&gt;
                    &lt;Grid Opacity="0"&gt;
                        &lt;Grid.RenderTransform&gt;
                            &lt;TranslateTransform Y="12" /&gt;
                        &lt;/Grid.RenderTransform&gt;
                        &lt;Grid.Triggers&gt;
                            &lt;EventTrigger RoutedEvent="Loaded"&gt;
                                &lt;BeginStoryboard&gt;
                                    &lt;Storyboard&gt;
                                        &lt;DoubleAnimation Storyboard.TargetProperty="Opacity" To="1" Duration="0:0:0.3" /&gt;
                                        &lt;DoubleAnimation Storyboard.TargetProperty="RenderTransform.Y" To="0" Duration="0:0:0.3"&gt;
                                            &lt;DoubleAnimation.EasingFunction&gt;
                                                &lt;CubicEase EasingMode="EaseOut" /&gt;
                                            &lt;/DoubleAnimation.EasingFunction&gt;
                                        &lt;/DoubleAnimation&gt;
                                    &lt;/Storyboard&gt;
                                &lt;/BeginStoryboard&gt;
                            &lt;/EventTrigger&gt;
                        &lt;/Grid.Triggers&gt;
                        &lt;TextBlock Text="{Binding Title}" /&gt;
                        &lt;TextBlock Text="{Binding Amount, StringFormat=C}" HorizontalAlignment="Right" /&gt;
                    &lt;/Grid&gt;
                &lt;/DataTemplate&gt;
            &lt;/ListBox.ItemTemplate&gt;
        &lt;/ListBox&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows;
using System.Windows.Media.Animation;
namespace CoinJar;
// A small row type for this demo. The real app uses Models/Expense.
public record ExpenseRow(string Title, decimal Amount);
public partial class MainWindow : Window, INotifyPropertyChanged
{
    public ObservableCollection&lt;ExpenseRow&gt; Expenses { get; } = new();
    public decimal Total =&gt; Expenses.Sum(e =&gt; e.Amount);
    public event PropertyChangedEventHandler? PropertyChanged;
    public MainWindow()
    {
        InitializeComponent();
        DataContext = this; // fine for a demo, a view model in the real app
    }
    private void OnAddClick(object sender, RoutedEventArgs e)
    {
        if (!decimal.TryParse(AmountBox.Text, out decimal amount))
        {
            // Wrong input: shake the box (skip it if the user turned animations off).
            if (SystemParameters.ClientAreaAnimation)
            {
                ((Storyboard)FindResource("ShakeAmount")).Begin(this);
            }
            return;
        }
        Expenses.Add(new ExpenseRow(TitleBox.Text, amount));
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Total)));
        // Start the storyboard from code. 'this' is where TargetName is looked up.
        ((Storyboard)FindResource("FlashTotal")).Begin(this);
    }
}
</code></pre>
