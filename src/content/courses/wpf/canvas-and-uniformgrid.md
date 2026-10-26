---
publishDate: 2026-10-25T20:12
title: 'Canvas and UniformGrid'
slug: canvas-and-uniformgrid
metadescription: 'Learn when to use Canvas for exact x and y positions, how to move shapes from code, and how UniformGrid makes rows and columns of equal sized cells.'
updateDate: 2026-10-25T20:12
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'layout', 'canvas', 'uniformgrid']
course: wpf
---

## Two panels for special jobs

The panels you have seen so far, the [Grid](/courses/wpf/the-grid-panel) and the [StackPanel, WrapPanel and DockPanel](/courses/wpf/stackpanel-wrappanel-and-dockpanel), all work things out for you. You describe the structure and WPF calculates positions.

This lesson covers two panels that are a bit different:

- **Canvas** does no layout at all. You give every child an exact x and y position, like pinning photos to a corkboard.
- **UniformGrid** is a very simple grid where every cell is exactly the same size. You do not define rows or columns, you only say how many.

Both are less common than `Grid`, but when you need them they make the job much easier.

## Canvas: exact positions

A `Canvas` places each child at a position you set with four attached properties: `Canvas.Left`, `Canvas.Top`, `Canvas.Right` and `Canvas.Bottom`. The numbers are distances in device independent pixels from that edge of the canvas.

```xml
<Canvas Width="300" Height="200" Background="WhiteSmoke">
    <Rectangle Canvas.Left="20" Canvas.Top="20" Width="80" Height="50" Fill="SteelBlue" />
    <Ellipse Canvas.Left="150" Canvas.Top="60" Width="60" Height="60" Fill="Orange" />
    <TextBlock Canvas.Right="10" Canvas.Bottom="10" Text="Bottom right corner" />
</Canvas>
```

The point (0, 0) is the **top left** corner. X grows to the right and y grows **downwards**, which is the opposite of the graphs you drew at school.

`Rectangle` and `Ellipse` are **shapes**: simple elements that draw a filled or outlined figure. `Fill` is the inside colour and `Stroke` is the outline colour.

### What Canvas does not do

A `Canvas` is the most "hands off" panel:

- It does **not** stretch its children. A child with no `Width` and `Height` is only as big as its content. A `Rectangle` with no size is invisible.
- It does **not** stop children from going outside its edges. A child at `Canvas.Left="500"` on a 300 wide canvas is drawn outside it.
- It does **not** move anything when the window is resized.

If you want children cut off at the edges, set `ClipToBounds="True"` on the canvas.

If you set both `Canvas.Left` and `Canvas.Right`, `Left` wins. If you set both `Top` and `Bottom`, `Top` wins.

### Which child is on top

Children are drawn in order, so later children cover earlier ones. To change that without reordering the XAML, use `Panel.ZIndex`. A higher number is drawn on top.

```xml
<Canvas>
    <Rectangle Panel.ZIndex="1" Canvas.Left="20" Canvas.Top="20" Width="80" Height="80" Fill="SteelBlue" />
    <!-- Written later, but drawn underneath because its ZIndex is lower -->
    <Rectangle Panel.ZIndex="0" Canvas.Left="60" Canvas.Top="60" Width="80" Height="80" Fill="Orange" />
</Canvas>
```

`Panel.ZIndex` works in every panel, including `Grid`, not just `Canvas`.

## Moving things on a Canvas from code

`Canvas.Left` and the others are attached properties, so in C# you use the static helpers `Canvas.SetLeft`, `Canvas.GetLeft`, `Canvas.SetTop` and `Canvas.GetTop`:

```csharp
private void MoveRightButton_Click(object sender, RoutedEventArgs e)
{
    double x = Canvas.GetLeft(Ball);   // Ball is an Ellipse with x:Name="Ball"
    Canvas.SetLeft(Ball, x + 20);
}
```

If `Canvas.Left` was never set, `Canvas.GetLeft` returns `double.NaN`, so set a starting position in XAML.

### Reacting to mouse clicks

You can find where the user clicked with `e.GetPosition(...)`. It returns a `Point` with `X` and `Y`, relative to the element you pass in:

```csharp
private void DrawingCanvas_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
{
    Point p = e.GetPosition(DrawingCanvas);

    var dot = new Ellipse { Width = 16, Height = 16, Fill = Brushes.SteelBlue };
    Canvas.SetLeft(dot, p.X - 8);   // minus half the size, so the dot is centred on the click
    Canvas.SetTop(dot, p.Y - 8);
    DrawingCanvas.Children.Add(dot);
}
```

There is a catch here. **A canvas with no `Background` does not receive mouse clicks** on its empty areas. WPF only "sees" clicks on things that are painted. Setting `Background="White"` or even `Background="Transparent"` fixes it. `Transparent` is invisible but still counts as painted.

You saw how event handlers are wired up in [Code-Behind and Event Handlers](/courses/wpf/code-behind-and-event-handlers).

## When to use Canvas (and when not to)

Good uses:

- Drawing: charts, diagrams, a simple paint app.
- Games and animations where things move around freely.
- Overlays, such as a selection rectangle drawn on top of other content.

Bad uses:

- Normal forms and windows. A form built on a `Canvas` with hard coded positions looks fine at one size and falls apart when the window is resized, the text is longer, or the user has larger fonts. This is the most common beginner mistake in WPF. Use a `Grid` for forms.

A good mental test: "If the window doubles in width, should this thing move?" If yes, it does not belong on a `Canvas`.

## UniformGrid: equal cells, no definitions

A `UniformGrid` is a grid where **all cells are the same size**. You only set `Rows` and `Columns`, then add children. They fill the cells left to right, top to bottom.

```xml
<UniformGrid Rows="2" Columns="3">
    <Button Content="1" />
    <Button Content="2" />
    <Button Content="3" />
    <Button Content="4" />
    <Button Content="5" />
    <Button Content="6" />
</UniformGrid>
```

No `Grid.Row`, no `Grid.Column`, no definitions. The cells share the space evenly, and they keep sharing it evenly when the window is resized.

### Rows or Columns only

You can set just one of them and let WPF work out the other:

```xml
<!-- 3 columns. 7 children means WPF makes 3 rows. -->
<UniformGrid Columns="3">
    <Button Content="Food" />
    <Button Content="Transport" />
    <Button Content="Bills" />
    <Button Content="Fun" />
    <Button Content="Other" />
    <Button Content="Gifts" />
    <Button Content="Health" />
</UniformGrid>
```

If you set neither, WPF makes a square grid big enough for all children (for example 9 children give 3 by 3).

### FirstColumn

`FirstColumn` leaves some empty cells at the start of the first row. The classic example is a month calendar, where the 1st of the month might fall on a Wednesday:

```xml
<!-- 7 columns for the days, start the first row in column 3 -->
<UniformGrid Columns="7" FirstColumn="3">
    <TextBlock Text="1" />
    <TextBlock Text="2" />
    <TextBlock Text="3" />
    <!-- ... -->
</UniformGrid>
```

### When to use UniformGrid

- Keypads and calculators.
- Board games such as tic tac toe or a chess board.
- A row of equal width buttons (`Rows="1"`).
- Colour pickers and icon grids.

If any cell needs a different size, switch to a normal `Grid`.

## Building a UniformGrid from code

Because the cells fill in order, a `UniformGrid` is easy to fill in a loop:

```csharp
public MainWindow()
{
    InitializeComponent();

    string[] colours = ["Red", "Orange", "Gold", "Green", "SteelBlue", "Purple"];
    foreach (string name in colours)
    {
        var swatch = new Button
        {
            Background = (Brush)new BrushConverter().ConvertFromString(name)!,
            Tag = name,     // Tag can hold any extra object, here the colour name
            Margin = new Thickness(2)
        };
        swatch.Click += Swatch_Click;
        ColourGrid.Children.Add(swatch);
    }
}
```

`BrushConverter` turns a colour name such as `"Gold"` into a `Brush`, the same conversion XAML does for you when you write `Fill="Gold"`. The `Tag` property exists on every element and is a handy place to keep a small piece of extra data. The `[...]` array syntax is a C# collection expression.

## Common mistakes

- **Building forms on a Canvas.** It does not resize. Use a `Grid`.
- **Invisible shapes.** A `Rectangle` or `Ellipse` on a `Canvas` needs a `Width`, a `Height` and a `Fill` (or `Stroke`).
- **Clicks on a Canvas do nothing.** Give it a `Background`, even `Transparent`.
- **`Canvas.GetLeft` returns NaN.** You never set `Canvas.Left` in XAML.
- **Using UniformGrid when cells differ.** If one column should be wider, you need a normal `Grid` with star sizes.

## Quick recap

- `Canvas` positions children exactly with `Canvas.Left`, `Canvas.Top`, `Canvas.Right` and `Canvas.Bottom`.
- (0, 0) is the top left. Y grows downwards.
- `Canvas` does not stretch, clip (unless `ClipToBounds="True"`) or move children on resize.
- `Panel.ZIndex` decides which overlapping child is drawn on top.
- In code use `Canvas.SetLeft` and `Canvas.SetTop`, and `e.GetPosition(element)` for the mouse position.
- A panel needs a `Background` to receive mouse clicks on empty space.
- `UniformGrid` makes equal cells. Set `Rows`, `Columns` or both. `FirstColumn` skips cells at the start.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Dot Painter" Width="560" Height="420" MinWidth="420" MinHeight="320"&gt;
    &lt;Grid Margin="12" RowDefinitions="Auto,*,Auto" ColumnDefinitions="*,Auto"&gt;
        &lt;TextBlock Grid.Row="0" Grid.ColumnSpan="2" Margin="0,0,0,8"
                   Text="Pick a colour, then click on the canvas to paint dots." /&gt;
        &lt;!-- The Canvas: Background is set so empty areas receive mouse clicks.
             ClipToBounds stops dots near the edge from drawing outside it. --&gt;
        &lt;Border Grid.Row="1" Grid.Column="0" BorderBrush="Gray" BorderThickness="1"&gt;
            &lt;Canvas x:Name="DrawingCanvas" Background="White" ClipToBounds="True"
                    MouseLeftButtonDown="DrawingCanvas_MouseLeftButtonDown"&gt;
                &lt;!-- A fixed shape placed with Canvas.Left and Canvas.Top --&gt;
                &lt;Ellipse x:Name="Ball" Canvas.Left="20" Canvas.Top="20" Width="40" Height="40"
                         Fill="Orange" Stroke="DarkOrange" StrokeThickness="2" Panel.ZIndex="10" /&gt;
            &lt;/Canvas&gt;
        &lt;/Border&gt;
        &lt;!-- The colour picker: a UniformGrid with 2 columns, filled from code --&gt;
        &lt;StackPanel Grid.Row="1" Grid.Column="1" Width="110" Margin="12,0,0,0"&gt;
            &lt;TextBlock Text="Colour" FontWeight="SemiBold" Margin="0,0,0,4" /&gt;
            &lt;UniformGrid x:Name="ColourGrid" Columns="2" Height="120" /&gt;
            &lt;TextBlock x:Name="ColourText" Text="SteelBlue" Margin="0,4,0,12" /&gt;
            &lt;!-- A one row UniformGrid gives equal width buttons --&gt;
            &lt;UniformGrid Rows="1"&gt;
                &lt;Button Content="Left" Margin="0,0,2,0" Click="MoveLeftButton_Click" /&gt;
                &lt;Button Content="Right" Margin="2,0,0,0" Click="MoveRightButton_Click" /&gt;
            &lt;/UniformGrid&gt;
            &lt;TextBlock Text="Move the ball" HorizontalAlignment="Center" Margin="0,4,0,0" /&gt;
        &lt;/StackPanel&gt;
        &lt;StackPanel Grid.Row="2" Grid.ColumnSpan="2" Orientation="Horizontal" Margin="0,8,0,0"&gt;
            &lt;Button Content="Clear dots" Padding="12,4" Click="ClearButton_Click" /&gt;
            &lt;TextBlock x:Name="CountText" Text="0 dots" VerticalAlignment="Center" Margin="12,0,0,0" /&gt;
        &lt;/StackPanel&gt;
    &lt;/Grid&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;
namespace CoinJar;
public partial class MainWindow : Window
{
    private Brush _currentBrush = Brushes.SteelBlue;
    private int _dotCount;
    public MainWindow()
    {
        InitializeComponent();
        // Fill the UniformGrid with one button per colour. Cells fill left to right, top to bottom.
        string[] colours = ["SteelBlue", "Orange", "Crimson", "SeaGreen", "Gold", "Purple"];
        foreach (string name in colours)
        {
            var swatch = new Button
            {
                Background = (Brush)new BrushConverter().ConvertFromString(name)!,
                Tag = name,
                Margin = new Thickness(2),
                ToolTip = name
            };
            swatch.Click += Swatch_Click;
            ColourGrid.Children.Add(swatch);
        }
    }
    private void Swatch_Click(object sender, RoutedEventArgs e)
    {
        var swatch = (Button)sender;
        _currentBrush = swatch.Background;
        ColourText.Text = (string)swatch.Tag;
    }
    private void DrawingCanvas_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        // Where did the user click, measured from the canvas's top left corner?
        Point p = e.GetPosition(DrawingCanvas);
        var dot = new Ellipse { Width = 16, Height = 16, Fill = _currentBrush };
        Canvas.SetLeft(dot, p.X - 8); // centre the dot on the click
        Canvas.SetTop(dot, p.Y - 8);
        DrawingCanvas.Children.Add(dot);
        _dotCount++;
        CountText.Text = $"{_dotCount} dots";
    }
    private void MoveLeftButton_Click(object sender, RoutedEventArgs e)
    {
        Canvas.SetLeft(Ball, Math.Max(0, Canvas.GetLeft(Ball) - 20));
    }
    private void MoveRightButton_Click(object sender, RoutedEventArgs e)
    {
        double maxX = DrawingCanvas.ActualWidth - Ball.Width;
        Canvas.SetLeft(Ball, Math.Min(maxX, Canvas.GetLeft(Ball) + 20));
    }
    private void ClearButton_Click(object sender, RoutedEventArgs e)
    {
        // Remove every child except the ball
        for (int i = DrawingCanvas.Children.Count - 1; i &gt;= 0; i--)
        {
            if (DrawingCanvas.Children[i] != Ball)
            {
                DrawingCanvas.Children.RemoveAt(i);
            }
        }
        _dotCount = 0;
        CountText.Text = "0 dots";
    }
}
</code></pre>
