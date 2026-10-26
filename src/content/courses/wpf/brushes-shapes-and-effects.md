---
publishDate: 2026-10-25T20:34
title: 'Brushes, Shapes and Effects'
slug: brushes-shapes-and-effects
metadescription: 'Paint CoinJar with solid, gradient and image brushes, draw icons and bar charts with WPF shapes and Path data, and add shadows, blur and transforms.'
updateDate: 2026-10-25T20:34
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'graphics', 'brushes', 'shapes']
course: wpf
---

## Drawing in WPF

WPF draws everything itself with the graphics card, rather than asking Windows to draw standard grey controls. That is why it is easy to add gradients, rounded corners, shadows and simple charts. Everything is **vector** based, which means shapes are described with maths instead of pixels, so they stay sharp at any size or screen scale.

This lesson covers three tools:

- **brushes**: what you paint with
- **shapes**: what you draw
- **effects and transforms**: shadows, blur, rotating and scaling

We will use them to give CoinJar a coin logo, a summary card with a soft shadow, and a small bar chart of spending per category.

## Brushes: what you paint with

A **brush** is an object that knows how to fill an area. Any property that paints something takes a brush: `Background`, `Foreground`, `BorderBrush`, and on shapes `Fill` and `Stroke`.

### SolidColorBrush

One flat colour. When you write a colour in an attribute, WPF quietly creates a `SolidColorBrush` for you:

```xml
<Border Background="SeaGreen" />          <!-- a named colour -->
<Border Background="#2E7D32" />           <!-- red, green, blue in hex -->
<Border Background="#802E7D32" />         <!-- the first pair is alpha: 80 is about half see through -->
```

The long form lets you set extra properties such as `Opacity`:

```xml
<Border>
    <Border.Background>
        <SolidColorBrush Color="#2E7D32" Opacity="0.15" />
    </Border.Background>
</Border>
```

`Opacity` on a brush only fades that paint. `Opacity` on an element fades the element and everything inside it, text included.

### LinearGradientBrush

A **gradient** blends smoothly between colours. A `LinearGradientBrush` blends along a line from `StartPoint` to `EndPoint`. The points are **relative**: `0,0` is the top left of the area and `1,1` is the bottom right. Each `GradientStop` places a colour at an `Offset` from 0 (start) to 1 (end):

```xml
<Border Height="80">
    <Border.Background>
        <LinearGradientBrush StartPoint="0,0" EndPoint="1,0">
            <GradientStop Color="#1B5E20" Offset="0" />
            <GradientStop Color="#43A047" Offset="1" />
        </LinearGradientBrush>
    </Border.Background>
</Border>
```

`StartPoint="0,0" EndPoint="1,0"` runs left to right. `0,0` to `0,1` runs top to bottom, and `0,0` to `1,1` runs diagonally.

### RadialGradientBrush

A `RadialGradientBrush` blends outward from a centre point, like light on a ball. Moving `GradientOrigin` away from the centre makes a "shine" that gives a 3D feel. That is perfect for a coin:

```xml
<Ellipse Width="48" Height="48" Stroke="#B8860B" StrokeThickness="2">
    <Ellipse.Fill>
        <RadialGradientBrush GradientOrigin="0.35,0.3" Center="0.5,0.5" RadiusX="0.6" RadiusY="0.6">
            <GradientStop Color="#FFF3B0" Offset="0" />
            <GradientStop Color="#F4C430" Offset="0.5" />
            <GradientStop Color="#C9971C" Offset="1" />
        </RadialGradientBrush>
    </Ellipse.Fill>
</Ellipse>
```

### ImageBrush and VisualBrush

An `ImageBrush` paints with a picture (see [Images and Media](/courses/wpf/images-and-media) for image paths):

```xml
<Border CornerRadius="24" Width="48" Height="48">
    <Border.Background>
        <ImageBrush ImageSource="Assets/avatar.png" Stretch="UniformToFill" />
    </Border.Background>
</Border>
```

This is a neat trick for round profile pictures: the image takes the border's rounded shape.

A `VisualBrush` paints with a live copy of another element. It is mostly used for effects such as reflections, and it updates as the original changes.

### Brushes as resources

Brushes are ideal [resources](/courses/wpf/resources-and-resource-dictionaries). Define the gradient once and reuse it:

```xml
<LinearGradientBrush x:Key="HeaderBrush" StartPoint="0,0" EndPoint="1,0">
    <GradientStop Color="#1B5E20" Offset="0" />
    <GradientStop Color="#43A047" Offset="1" />
</LinearGradientBrush>
```

If you create a brush in C# that will never change, call `Freeze()` on it. A **frozen** brush cannot be modified, so WPF can skip watching it for changes, which saves work:

```csharp
var accent = new SolidColorBrush(Color.FromRgb(0x2E, 0x7D, 0x32));
accent.Freeze();
```

## Shapes: what you draw

Shapes are elements, so they sit in panels and take part in layout like any control. Every shape has `Fill` (the inside), `Stroke` (the outline brush) and `StrokeThickness`.

### Rectangle and Ellipse

```xml
<StackPanel Orientation="Horizontal">
    <Rectangle Width="80" Height="40" Fill="#E8F5E9" Stroke="#2E7D32" RadiusX="6" RadiusY="6" />
    <Ellipse Width="40" Height="40" Fill="#F4C430" Margin="8,0" />
</StackPanel>
```

`RadiusX` and `RadiusY` round the rectangle's corners. An ellipse with equal width and height is a circle.

### Line, Polyline and Polygon

```xml
<!-- A dashed divider -->
<Line X1="0" Y1="0" X2="300" Y2="0" Stroke="#D1D5DB" StrokeThickness="1" StrokeDashArray="4 2" />

<!-- A tiny spending trend line, points are x,y pairs -->
<Polyline Points="0,30 20,22 40,26 60,10 80,14 100,4"
          Stroke="#2E7D32" StrokeThickness="2"
          StrokeLineJoin="Round" StrokeStartLineCap="Round" StrokeEndLineCap="Round" />

<!-- A closed shape: a small triangle "down" marker -->
<Polygon Points="0,0 10,0 5,6" Fill="#C62828" />
```

- `StrokeDashArray="4 2"` means 4 units of line, then 2 units of gap, measured in multiples of the stroke thickness.
- `Polyline` is an open chain of lines. `Polygon` closes the shape and can be filled.
- In shapes, y grows **downwards**. `0,0` is the top left, so a "high" point has a small y value.

### Path: draw anything

`Path` is the most powerful shape. Its `Data` property takes a short drawing language called **path markup syntax**. Each letter is a command:

| Command | Meaning |
| --- | --- |
| `M x,y` | move the pen to x,y without drawing |
| `L x,y` | draw a line to x,y |
| `H x` and `V y` | horizontal or vertical line |
| `A ...` | an arc (part of an ellipse) |
| `C ...` | a smooth curve |
| `Z` | close the shape back to the start |

A check mark icon:

```xml
<Path Data="M 2,9 L 7,14 L 16,4"
      Stroke="#2E7D32" StrokeThickness="2.5"
      StrokeStartLineCap="Round" StrokeEndLineCap="Round" StrokeLineJoin="Round" />
```

Many icon sets publish their icons as path data, so you can paste them straight in. Store them as `Geometry` resources and use `Stretch` to resize them to any box:

```xml
<Geometry x:Key="CheckIcon">M 2,9 L 7,14 L 16,4</Geometry>

<Path Data="{StaticResource CheckIcon}" Width="16" Height="16" Stretch="Uniform"
      Stroke="White" StrokeThickness="2" />
```

`Stretch` can be `None`, `Fill`, `Uniform` (keep proportions, fit inside) or `UniformToFill` (keep proportions, fill and crop).

### A bar chart from rectangles

Shapes can be bound to data like anything else, using what you learned in [Data Templates](/courses/wpf/data-templates). A simple bar per category:

```xml
<ItemsControl ItemsSource="{Binding CategoryBars}">
    <ItemsControl.ItemTemplate>
        <DataTemplate>
            <Grid Margin="0,3">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="80" />
                    <ColumnDefinition Width="*" />
                </Grid.ColumnDefinitions>
                <TextBlock Text="{Binding Category}" />
                <Rectangle Grid.Column="1" Height="14" RadiusX="3" RadiusY="3"
                           HorizontalAlignment="Left" Fill="#43A047"
                           Width="{Binding BarWidth}" />
            </Grid>
        </DataTemplate>
    </ItemsControl.ItemTemplate>
</ItemsControl>
```

`BarWidth` is a plain number calculated in C#, for example the category total scaled so the largest bar is 240 wide. For real charts you would use a charting library, but for a small summary this is light and simple.

## Effects: shadows and blur

An **effect** changes how an element is drawn after it is drawn. WPF has two built in:

```xml
<Border Background="White" CornerRadius="8" Padding="16">
    <Border.Effect>
        <DropShadowEffect BlurRadius="12" ShadowDepth="2" Direction="270"
                          Opacity="0.18" Color="Black" />
    </Border.Effect>
    <TextBlock Text="Spent this month: $412.35" />
</Border>
```

- `BlurRadius` is how soft the shadow is.
- `ShadowDepth` is how far it is offset.
- `Direction` is the angle in degrees. `270` puts the shadow straight below.
- Keep `Opacity` low for a modern, subtle look.

`BlurEffect` blurs the element, which is handy for dimming the window behind a dialog:

```xml
<Grid>
    <Grid.Effect>
        <BlurEffect Radius="6" />
    </Grid.Effect>
</Grid>
```

Effects are applied to the element **and all its children**. A shadow on a `Border` with text inside also gives the text a shadow if the border has no background. Give the border a solid background, or put the shadow on a separate element behind the content.

Effects cost drawing time. A few shadows are fine. Hundreds of them, for example on every row of a long list, can make scrolling sluggish.

## Transforms: rotate, scale, move

A **transform** moves, rotates, scales or skews an element. There are two places to put one:

- `RenderTransform` changes only how the element is drawn, **after** layout. Neighbours do not move. It is fast and the usual choice, especially for animation.
- `LayoutTransform` is applied **before** layout, so the panel makes room for the transformed size. Use it when, for example, rotated text must not overlap its neighbours.

```xml
<!-- A "NEW" badge tilted on a card, drawn around its own centre -->
<Border Background="#C62828" CornerRadius="4" Padding="6,2"
        RenderTransformOrigin="0.5,0.5">
    <Border.RenderTransform>
        <RotateTransform Angle="-8" />
    </Border.RenderTransform>
    <TextBlock Text="NEW" Foreground="White" FontWeight="Bold" />
</Border>
```

`RenderTransformOrigin="0.5,0.5"` means "rotate around the middle". Without it, the element rotates around its top left corner.

Other transforms are `ScaleTransform` (`ScaleX`, `ScaleY`), `TranslateTransform` (`X`, `Y`) and `SkewTransform`. Combine several with a `TransformGroup`. Transforms really come alive with animations, covered in [Animations and Storyboards](/courses/wpf/animations-and-storyboards).

## Tips

- **Name colours as resources first, then build brushes from them.** It makes themes easy in [Light, Dark and Fluent Themes](/courses/wpf/light-dark-and-fluent-themes).
- **Use `Path` icons instead of small images.** They stay sharp at every size and can change colour with a style.
- **Prefer `RenderTransform` for animation.** `LayoutTransform` re runs layout on every frame.
- **Watch the hit area.** A shape or border with no `Fill` or `Background` cannot be clicked in its empty parts. Use `Transparent` when you need clicks.
- **Keep effects few and subtle.** They are pretty, but each one is extra work for every frame.

## Quick recap

- Brushes paint areas: `SolidColorBrush`, `LinearGradientBrush`, `RadialGradientBrush`, `ImageBrush` and `VisualBrush`. Freeze brushes made in code that never change.
- Shapes draw vector graphics: `Rectangle`, `Ellipse`, `Line`, `Polyline`, `Polygon` and `Path`.
- `Path` uses path markup syntax (`M`, `L`, `A`, `C`, `Z`) and is ideal for icons stored as `Geometry` resources.
- `DropShadowEffect` and `BlurEffect` add depth and focus, but cost drawing time.
- `RenderTransform` changes only drawing, `LayoutTransform` changes layout. Set `RenderTransformOrigin` to rotate around the centre.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Height="460" Width="460" Background="#F3F5F7"&gt;
    &lt;Window.Resources&gt;
        &lt;LinearGradientBrush x:Key="HeaderBrush" StartPoint="0,0" EndPoint="1,0"&gt;
            &lt;GradientStop Color="#1B5E20" Offset="0" /&gt;
            &lt;GradientStop Color="#43A047" Offset="1" /&gt;
        &lt;/LinearGradientBrush&gt;
        &lt;!-- An icon stored as geometry, resized with Stretch --&gt;
        &lt;Geometry x:Key="CheckIcon"&gt;M 2,9 L 7,14 L 16,4&lt;/Geometry&gt;
        &lt;DropShadowEffect x:Key="SoftShadow" BlurRadius="12" ShadowDepth="2"
                          Direction="270" Opacity="0.18" Color="Black" /&gt;
    &lt;/Window.Resources&gt;
    &lt;DockPanel&gt;
        &lt;!-- Header: gradient background and a shiny coin --&gt;
        &lt;Border DockPanel.Dock="Top" Background="{StaticResource HeaderBrush}" Padding="16,12"&gt;
            &lt;StackPanel Orientation="Horizontal"&gt;
                &lt;Grid Width="40" Height="40"&gt;
                    &lt;Ellipse Stroke="#B8860B" StrokeThickness="2"&gt;
                        &lt;Ellipse.Fill&gt;
                            &lt;RadialGradientBrush GradientOrigin="0.35,0.3" RadiusX="0.6" RadiusY="0.6"&gt;
                                &lt;GradientStop Color="#FFF3B0" Offset="0" /&gt;
                                &lt;GradientStop Color="#F4C430" Offset="0.5" /&gt;
                                &lt;GradientStop Color="#C9971C" Offset="1" /&gt;
                            &lt;/RadialGradientBrush&gt;
                        &lt;/Ellipse.Fill&gt;
                    &lt;/Ellipse&gt;
                    &lt;TextBlock Text="C" FontWeight="Bold" FontSize="18" Foreground="#8A6512"
                               HorizontalAlignment="Center" VerticalAlignment="Center" /&gt;
                &lt;/Grid&gt;
                &lt;TextBlock Text="CoinJar" Foreground="White" FontSize="22" FontWeight="Bold"
                           VerticalAlignment="Center" Margin="10,0,0,0" /&gt;
            &lt;/StackPanel&gt;
        &lt;/Border&gt;
        &lt;StackPanel Margin="16"&gt;
            &lt;!-- Card with a shadow, plus a tilted badge --&gt;
            &lt;Grid Margin="0,0,0,16"&gt;
                &lt;Border Background="White" CornerRadius="8" Padding="16,12"
                        Effect="{StaticResource SoftShadow}"&gt;
                    &lt;StackPanel&gt;
                        &lt;TextBlock Text="Spent this month" Foreground="#6B7280" /&gt;
                        &lt;TextBlock Text="{Binding Total, StringFormat=C}" FontSize="26" FontWeight="Bold" /&gt;
                        &lt;!-- A small trend line. y grows downwards. --&gt;
                        &lt;Polyline Points="0,30 20,22 40,26 60,10 80,14 100,4" Margin="0,8,0,0"
                                  Stroke="#2E7D32" StrokeThickness="2"
                                  StrokeLineJoin="Round" StrokeStartLineCap="Round" StrokeEndLineCap="Round" /&gt;
                    &lt;/StackPanel&gt;
                &lt;/Border&gt;
                &lt;Border Background="#2E7D32" CornerRadius="4" Padding="6,3"
                        HorizontalAlignment="Right" VerticalAlignment="Top" Margin="0,10,10,0"
                        RenderTransformOrigin="0.5,0.5"&gt;
                    &lt;Border.RenderTransform&gt;
                        &lt;RotateTransform Angle="-8" /&gt;
                    &lt;/Border.RenderTransform&gt;
                    &lt;StackPanel Orientation="Horizontal"&gt;
                        &lt;Path Data="{StaticResource CheckIcon}" Width="12" Height="12" Stretch="Uniform"
                              Stroke="White" StrokeThickness="2" /&gt;
                        &lt;TextBlock Text="On budget" Foreground="White" FontSize="11" Margin="4,0,0,0" /&gt;
                    &lt;/StackPanel&gt;
                &lt;/Border&gt;
            &lt;/Grid&gt;
            &lt;TextBlock Text="By category" FontWeight="SemiBold" Margin="0,0,0,4" /&gt;
            &lt;Line X2="400" Stroke="#D1D5DB" StrokeDashArray="4 2" Margin="0,0,0,6" /&gt;
            &lt;!-- A bar chart made of rectangles bound to data --&gt;
            &lt;ItemsControl ItemsSource="{Binding CategoryBars}"&gt;
                &lt;ItemsControl.ItemTemplate&gt;
                    &lt;DataTemplate&gt;
                        &lt;Grid Margin="0,3"&gt;
                            &lt;Grid.ColumnDefinitions&gt;
                                &lt;ColumnDefinition Width="80" /&gt;
                                &lt;ColumnDefinition Width="*" /&gt;
                                &lt;ColumnDefinition Width="70" /&gt;
                            &lt;/Grid.ColumnDefinitions&gt;
                            &lt;TextBlock Text="{Binding Category}" VerticalAlignment="Center" /&gt;
                            &lt;Rectangle Grid.Column="1" Height="14" RadiusX="3" RadiusY="3"
                                       HorizontalAlignment="Left" Width="{Binding BarWidth}"&gt;
                                &lt;Rectangle.Fill&gt;
                                    &lt;LinearGradientBrush StartPoint="0,0" EndPoint="1,0"&gt;
                                        &lt;GradientStop Color="#66BB6A" Offset="0" /&gt;
                                        &lt;GradientStop Color="#2E7D32" Offset="1" /&gt;
                                    &lt;/LinearGradientBrush&gt;
                                &lt;/Rectangle.Fill&gt;
                            &lt;/Rectangle&gt;
                            &lt;TextBlock Grid.Column="2" Text="{Binding Amount, StringFormat=C}"
                                       HorizontalAlignment="Right" /&gt;
                        &lt;/Grid&gt;
                    &lt;/DataTemplate&gt;
                &lt;/ItemsControl.ItemTemplate&gt;
            &lt;/ItemsControl&gt;
        &lt;/StackPanel&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
namespace CoinJar;
// One bar in the chart. A record keeps it short.
public record CategoryBar(string Category, decimal Amount, double BarWidth);
public partial class MainWindow : Window
{
    public List&lt;CategoryBar&gt; CategoryBars { get; }
    public decimal Total { get; }
    public MainWindow()
    {
        InitializeComponent();
        // Sample totals per category (later these come from real expenses)
        var totals = new Dictionary&lt;string, decimal&gt;
        {
            ["Food"] = 152.70m, ["Transport"] = 60.00m, ["Bills"] = 129.15m,
            ["Fun"] = 51.50m, ["Other"] = 19.00m
        };
        Total = totals.Values.Sum();
        // Scale so the biggest bar is 240 wide
        decimal max = totals.Values.Max();
        CategoryBars = totals
            .Select(t =&gt; new CategoryBar(t.Key, t.Value, (double)(t.Value / max) * 240))
            .ToList();
        DataContext = this;
    }
}
</code></pre>
