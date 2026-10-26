---
publishDate: 2026-10-25T20:13
title: 'ScrollViewer and Viewbox'
slug: scrollviewer-and-viewbox
metadescription: 'Learn how to make content scroll with ScrollViewer, control its scroll bars, scroll from code, and scale content to fit any size with Viewbox.'
updateDate: 2026-10-25T20:13
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'layout', 'scrollviewer', 'viewbox']
course: wpf
---

## Too much content, or too little space

Sooner or later your content will not fit in the window. A settings page with twenty options, a long list of expenses, a big image. WPF gives you two very different answers:

- **ScrollViewer** keeps the content at its normal size and lets the user **scroll** to see the rest, like reading a long web page.
- **Viewbox** **scales** the content up or down so that all of it fits, like zooming a photo to fit the screen.

Neither of them is a panel. A panel holds many children. `ScrollViewer` and `Viewbox` each hold exactly **one** child. If you want several things inside, put a panel (such as a `StackPanel` or `Grid`) inside them first.

## ScrollViewer basics

Wrap the content in a `ScrollViewer` and it gains scroll bars when it is bigger than the space available:

```xml
<ScrollViewer>
    <StackPanel Margin="16">
        <TextBlock Text="Setting 1" />
        <TextBlock Text="Setting 2" />
        <!-- ... many more ... -->
        <TextBlock Text="Setting 40" />
    </StackPanel>
</ScrollViewer>
```

The user can scroll with the mouse wheel, by dragging the scroll bar, with the keyboard (arrow keys, Page Up, Page Down, Home, End) or by swiping on a touch screen.

### How it works

A `ScrollViewer` tells its child: "You can be as tall as you like." The child measures itself at its full natural height. The `ScrollViewer` then shows only a window onto that content, called the **viewport**, and the scroll bar moves the viewport up and down.

That also explains the problem from the [StackPanel lesson](/courses/wpf/stackpanel-wrappanel-and-dockpanel): a `ScrollViewer` only scrolls if **it** has a limited size. If you put it inside a vertical `StackPanel`, the stack panel offers it infinite height, the `ScrollViewer` grows to fit everything, and there is nothing to scroll.

```xml
<!-- Works: the ScrollViewer sits in a * row, so its height is limited -->
<Grid RowDefinitions="Auto,*">
    <TextBlock Grid.Row="0" Text="Settings" FontSize="18" />
    <ScrollViewer Grid.Row="1">
        <StackPanel x:Name="SettingsList" />
    </ScrollViewer>
</Grid>
```

## Controlling the scroll bars

Two properties decide when each scroll bar appears: `VerticalScrollBarVisibility` and `HorizontalScrollBarVisibility`. Each takes one of four values:

| Value | Scroll bar | Can the content scroll? |
| --- | --- | --- |
| `Auto` | Shown only when needed | Yes |
| `Visible` | Always shown | Yes |
| `Hidden` | Never shown | Yes (wheel and keyboard still scroll) |
| `Disabled` | Never shown | No, content is squeezed to fit |

For a plain `ScrollViewer` the defaults are `Visible` for vertical and `Disabled` for horizontal, so out of the box it only scrolls up and down. Most apps prefer `Auto` for vertical, so the bar only appears when there is actually more content:

```xml
<ScrollViewer VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
    <TextBlock TextWrapping="Wrap" Text="A long paragraph of text ..." />
</ScrollViewer>
```

### Disabled versus Hidden, and wrapping text

The difference between `Hidden` and `Disabled` matters a lot for text.

With `Hidden` or `Auto` horizontally, the content is allowed to be as **wide** as it likes, so a `TextBlock` with `TextWrapping="Wrap"` never wraps. It just becomes one very long line that runs off the right edge (or makes a horizontal scroll bar appear).

With `Disabled`, the content must fit the width of the viewport, so the text wraps nicely. A plain `ScrollViewer` already uses `Disabled` horizontally, but lists such as `ListBox` use `Auto`, and it is easy to change it by accident. **For a vertically scrolling page of text, set `HorizontalScrollBarVisibility="Disabled"` explicitly**, so the intent is clear to the next reader.

## Scroll bars on lists

Controls such as `ListBox`, `TextBox` and `DataGrid` already contain a `ScrollViewer` inside their template. You do not wrap them in another one. Instead, you set the scroll bar options with **attached properties** on the control itself:

```xml
<ListBox ScrollViewer.VerticalScrollBarVisibility="Auto"
         ScrollViewer.HorizontalScrollBarVisibility="Disabled" />

<TextBox AcceptsReturn="True" TextWrapping="Wrap"
         VerticalScrollBarVisibility="Auto" />
```

`TextBox` is special: it has its own `VerticalScrollBarVisibility` property, so you can write it without the `ScrollViewer.` prefix. You will meet `TextBox` properly in [Text Controls](/courses/wpf/text-controls).

Putting a `ListBox` inside a `ScrollViewer` is a mistake: the outer scroll viewer gives the list infinite height, the list's own scroll bar never appears, and you lose features such as fast scrolling of long lists.

## Scrolling from code

Give the `ScrollViewer` an `x:Name` and you can scroll it from code-behind:

```csharp
LogScroller.ScrollToEnd();            // jump to the bottom
LogScroller.ScrollToTop();            // jump to the top
LogScroller.ScrollToVerticalOffset(200); // 200 DIPs from the top
LogScroller.PageDown();               // one screen down, like the Page Down key
```

A typical use is a log or chat window, where new lines are added at the bottom and the view should follow them.

### Reading the scroll position

A few read only properties tell you where the user is:

- `VerticalOffset`: how far down the viewport is, in DIPs.
- `ViewportHeight`: how tall the visible part is.
- `ExtentHeight`: how tall the whole content is.
- `ScrollableHeight`: how far it can scroll at most (`ExtentHeight - ViewportHeight`).

The `ScrollChanged` event fires whenever any of these change. Here it shows a "back to top" message once the user has scrolled down:

```csharp
private void LogScroller_ScrollChanged(object sender, ScrollChangedEventArgs e)
{
    bool atBottom = LogScroller.VerticalOffset >= LogScroller.ScrollableHeight;
    PositionText.Text = atBottom ? "At the bottom" : $"Scrolled {LogScroller.VerticalOffset:F0} of {LogScroller.ScrollableHeight:F0}";
}
```

The same properties exist for the horizontal direction (`HorizontalOffset`, `ScrollToLeftEnd`, and so on).

## Viewbox: scale to fit

A `Viewbox` takes its one child, measures it at its natural size, and then **scales** it (makes everything bigger or smaller) to fill the space the `Viewbox` gets. Text, borders and shapes all grow or shrink together.

```xml
<Grid RowDefinitions="*,*">
    <!-- The TextBlock grows to fill the top half of the window -->
    <Viewbox Grid.Row="0">
        <TextBlock Text="$1,234.56" />
    </Viewbox>
</Grid>
```

Resize the window and the text gets bigger or smaller. That is very different from a `ScrollViewer`, which never changes the size of its content.

### Stretch modes

`Stretch` controls how the content is scaled. It is the same idea as fitting a photo into a frame:

| Value | Effect |
| --- | --- |
| `Uniform` (default) | Keeps the shape, fits entirely inside. Empty bars can appear at the sides. |
| `UniformToFill` | Keeps the shape, fills the whole area. Parts can be cut off. |
| `Fill` | Fills the area exactly, stretching the content out of shape. |
| `None` | No scaling at all. |

```xml
<Viewbox Stretch="Fill" Height="60">
    <TextBlock Text="Squashed and stretched" />
</Viewbox>
```

### StretchDirection

`StretchDirection` limits the direction of scaling:

- `Both` (default): can grow and shrink.
- `UpOnly`: can only grow. Content is never made smaller than normal.
- `DownOnly`: can only shrink. Content never gets bigger than normal, but it shrinks to fit a small window.

`DownOnly` is useful for a big dashboard number that should look normal on a large screen but still fit on a small one.

### When to use Viewbox

Good uses:

- A large number or title that should fill its area, such as a total on a dashboard.
- Icons and vector drawings that need to scale to any size.
- Kiosk or presentation screens where the whole layout should simply zoom.

Bad uses:

- Normal forms and windows. Scaling a whole form makes the text tiny on small windows and huge on large ones, which is hard to read. Real resizable layouts use a `Grid` with star sizes, which you will build in [Building Resizable Layouts](/courses/wpf/building-resizable-layouts).

## Common mistakes

- **ScrollViewer inside a StackPanel.** It has unlimited height and never scrolls. Put it in a `Grid` row with `*`.
- **Wrapping a ListBox or DataGrid in a ScrollViewer.** They scroll on their own. Use the `ScrollViewer.` attached properties instead.
- **Wrapped text that does not wrap.** Set `HorizontalScrollBarVisibility="Disabled"`.
- **Trying to put two children in a ScrollViewer or Viewbox.** They take one child. Wrap your elements in a panel.
- **Using Viewbox to make a form "responsive".** It only zooms. Use proper layout instead.

## Quick recap

- `ScrollViewer` and `Viewbox` each hold one child. Put a panel inside for several elements.
- `ScrollViewer` keeps content at full size and scrolls. It needs a limited size to work.
- Scroll bar visibility can be `Auto`, `Visible`, `Hidden` or `Disabled`. Use `Disabled` horizontally for wrapping text.
- `ListBox`, `TextBox` and `DataGrid` scroll by themselves. Use attached properties such as `ScrollViewer.VerticalScrollBarVisibility`.
- From code: `ScrollToEnd`, `ScrollToTop`, `ScrollToVerticalOffset`, plus `VerticalOffset` and the `ScrollChanged` event.
- `Viewbox` scales its content to fit. `Stretch` and `StretchDirection` control how.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar Activity" Width="520" Height="440" MinWidth="360" MinHeight="300"&gt;
    &lt;Grid Margin="12"&gt;
        &lt;Grid.RowDefinitions&gt;
            &lt;RowDefinition Height="80" /&gt;   &lt;!-- the big total, scaled by a Viewbox --&gt;
            &lt;RowDefinition Height="Auto" /&gt; &lt;!-- buttons --&gt;
            &lt;RowDefinition Height="*" /&gt;    &lt;!-- the scrolling log: * gives it a limited height --&gt;
            &lt;RowDefinition Height="Auto" /&gt; &lt;!-- scroll position --&gt;
        &lt;/Grid.RowDefinitions&gt;
        &lt;!-- Viewbox: the total grows and shrinks with the row, but never above its normal size --&gt;
        &lt;Border Grid.Row="0" Background="SteelBlue" CornerRadius="6" Padding="12,4"&gt;
            &lt;Viewbox StretchDirection="DownOnly" HorizontalAlignment="Left"&gt;
                &lt;TextBlock x:Name="TotalText" Text="Total: 0.00" Foreground="White" FontSize="48" /&gt;
            &lt;/Viewbox&gt;
        &lt;/Border&gt;
        &lt;StackPanel Grid.Row="1" Orientation="Horizontal" Margin="0,8"&gt;
            &lt;Button Content="Add 10 entries" Padding="12,4" Margin="0,0,8,0" Click="AddButton_Click" /&gt;
            &lt;Button Content="Top" Padding="12,4" Margin="0,0,8,0" Click="TopButton_Click" /&gt;
            &lt;Button Content="Bottom" Padding="12,4" Click="BottomButton_Click" /&gt;
        &lt;/StackPanel&gt;
        &lt;!-- ScrollViewer: vertical bar only when needed, horizontal Disabled so text wraps --&gt;
        &lt;Border Grid.Row="2" BorderBrush="LightGray" BorderThickness="1"&gt;
            &lt;ScrollViewer x:Name="LogScroller"
                          VerticalScrollBarVisibility="Auto"
                          HorizontalScrollBarVisibility="Disabled"
                          ScrollChanged="LogScroller_ScrollChanged"&gt;
                &lt;!-- One child: a StackPanel that holds all the log lines --&gt;
                &lt;StackPanel x:Name="LogPanel" Margin="8" /&gt;
            &lt;/ScrollViewer&gt;
        &lt;/Border&gt;
        &lt;TextBlock x:Name="PositionText" Grid.Row="3" Margin="0,6,0,0" Foreground="DimGray" Text="Nothing to scroll yet" /&gt;
    &lt;/Grid&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
namespace CoinJar;
public partial class MainWindow : Window
{
    private readonly Random _random = new();
    private readonly string[] _categories = ["Food", "Transport", "Bills", "Fun", "Other"];
    private decimal _total;
    private int _entryNumber;
    public MainWindow()
    {
        InitializeComponent();
    }
    private void AddButton_Click(object sender, RoutedEventArgs e)
    {
        for (int i = 0; i &lt; 10; i++)
        {
            _entryNumber++;
            decimal amount = _random.Next(100, 5000) / 100m;
            string category = _categories[_random.Next(_categories.Length)];
            _total += amount;
            // Long lines wrap because the ScrollViewer's horizontal scrolling is Disabled
            LogPanel.Children.Add(new TextBlock
            {
                Text = $"#{_entryNumber}: spent {amount:C} on {category}. This line is long on purpose so you can see it wrap.",
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 0, 0, 4)
            });
        }
        TotalText.Text = $"Total: {_total:C}";
        // Follow the newest entries, like a chat window
        LogScroller.ScrollToEnd();
    }
    private void TopButton_Click(object sender, RoutedEventArgs e) =&gt; LogScroller.ScrollToTop();
    private void BottomButton_Click(object sender, RoutedEventArgs e) =&gt; LogScroller.ScrollToEnd();
    private void LogScroller_ScrollChanged(object sender, ScrollChangedEventArgs e)
    {
        // ScrollChanged can fire while the window is still loading, so check the TextBlock exists
        if (PositionText is null) return;
        if (LogScroller.ScrollableHeight == 0)
        {
            PositionText.Text = "Nothing to scroll yet";
        }
        else
        {
            bool atBottom = LogScroller.VerticalOffset &gt;= LogScroller.ScrollableHeight;
            PositionText.Text = atBottom
                ? "At the bottom"
                : $"Scrolled {LogScroller.VerticalOffset:F0} of {LogScroller.ScrollableHeight:F0} DIPs";
        }
    }
}
</code></pre>
