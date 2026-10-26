---
publishDate: 2026-10-25T20:10
title: 'The Grid Panel'
slug: the-grid-panel
metadescription: 'Learn the Grid, the most used WPF panel: rows and columns, Auto, star and fixed sizes, spanning cells, overlapping elements and the short row and column syntax.'
updateDate: 2026-10-25T20:10
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'layout', 'grid', 'xaml']
course: wpf
---

## What a Grid is and why it matters

A **panel** is an element whose job is to hold other elements and lay them out. WPF has several panels, and the `Grid` is the one you will use most. When you create a new project, `MainWindow.xaml` already contains an empty `Grid`.

A `Grid` divides its space into **rows** and **columns**, like a table or a spreadsheet. You then put each child into a cell by saying which row and column it belongs to.

Grids are great for:

- Forms, where labels sit in one column and input boxes in another.
- Whole window layouts: a header row, a content row and a footer row.
- Anything that should grow and shrink nicely when the window is resized.

This lesson builds on the size, margin and alignment ideas from [Layout Basics](/courses/wpf/layout-basics-size-margin-and-alignment).

## A Grid with no rows or columns

A `Grid` without any definitions has exactly one cell that fills the whole grid. Every child goes into that cell, on top of each other:

```xml
<Grid>
    <Rectangle Fill="LightBlue" />
    <TextBlock Text="I sit on top of the rectangle"
               HorizontalAlignment="Center" VerticalAlignment="Center" />
</Grid>
```

Later children are drawn on top of earlier ones. This "stacking in one cell" is useful for overlays, badges and backgrounds.

## Defining rows and columns

To get more cells, add `RowDefinitions` and `ColumnDefinitions`. These use **property element syntax**, which you saw in [XAML Syntax Basics](/courses/wpf/xaml-syntax-basics).

```xml
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition />
        <RowDefinition />
    </Grid.RowDefinitions>
    <Grid.ColumnDefinitions>
        <ColumnDefinition />
        <ColumnDefinition />
        <ColumnDefinition />
    </Grid.ColumnDefinitions>

    <Button Grid.Row="0" Grid.Column="0" Content="Row 0, Col 0" />
    <Button Grid.Row="0" Grid.Column="2" Content="Row 0, Col 2" />
    <Button Grid.Row="1" Grid.Column="1" Content="Row 1, Col 1" />
</Grid>
```

That is 2 rows and 3 columns, so 6 cells. Rows and columns are counted from **0**, just like arrays in C#.

### Attached properties: Grid.Row and Grid.Column

`Grid.Row` and `Grid.Column` look strange at first: they are set on the `Button`, but they belong to `Grid`. These are **attached properties**. An attached property is a property that one class defines but other elements can carry. The button carries a little note that says "put me in row 1", and the `Grid` reads that note during layout.

If you leave them out, the value is `0`. So an element with no `Grid.Row` goes in the first row.

### Seeing the cells

While you learn, add `ShowGridLines="True"` to draw dotted lines between the cells:

```xml
<Grid ShowGridLines="True">
```

It is only a debugging aid. Remove it before you ship, and use `Border` elements if you want real lines.

## Sizing rows and columns

Each `RowDefinition` has a `Height` and each `ColumnDefinition` has a `Width`. There are three kinds of value:

| Value | Name | Meaning |
| --- | --- | --- |
| `Auto` | Auto | As big as the content needs, no more. |
| `100` | Fixed | Exactly 100 device independent pixels. |
| `*` | Star | A share of whatever space is left over. |

### Auto

`Auto` makes the row or column fit its biggest child. Use it for labels, buttons and headers.

```xml
<Grid.RowDefinitions>
    <RowDefinition Height="Auto" />  <!-- header: just tall enough for its text -->
    <RowDefinition Height="*" />     <!-- content: everything else -->
    <RowDefinition Height="Auto" />  <!-- footer: just tall enough for its buttons -->
</Grid.RowDefinitions>
```

This three row pattern is the skeleton of most main windows.

### Star sizing

**Star sizing** shares the leftover space between the star rows or columns. The default for a definition is `*`, which is why the first example split the space evenly.

You can put a number before the star to give a bigger share:

```xml
<Grid.ColumnDefinitions>
    <ColumnDefinition Width="*" />   <!-- 1 share -->
    <ColumnDefinition Width="2*" />  <!-- 2 shares -->
</Grid.ColumnDefinitions>
```

The second column is always twice as wide as the first. If the window is 300 wide, the columns get 100 and 200. If it is 600 wide, they get 200 and 400. Think of it as slicing a pizza: `*` gets one slice, `2*` gets two slices, and the pizza size is whatever space is left.

WPF first gives fixed and `Auto` sizes their space, then shares the rest between the stars.

### Fixed sizes and limits

A fixed number is useful for things like a sidebar:

```xml
<Grid.ColumnDefinitions>
    <ColumnDefinition Width="200" />                  <!-- sidebar -->
    <ColumnDefinition Width="*" MinWidth="250" />    <!-- main area, never narrower than 250 -->
</Grid.ColumnDefinitions>
```

`MinWidth` and `MaxWidth` work on columns, and `MinHeight` and `MaxHeight` on rows, just like on controls.

## The short syntax

Writing out `RowDefinition` elements gets long. Newer versions of WPF (from .NET 9) also accept a short form as a simple comma separated attribute:

```xml
<Grid RowDefinitions="Auto,*,Auto" ColumnDefinitions="200,*">
    <!-- children here -->
</Grid>
```

This means exactly the same as the long form. Many older tutorials and samples only show the long form, so you should be able to read both. Use the long form when you need extra settings such as `MinWidth` on a column.

## Spanning several cells

An element can cover more than one cell with `Grid.RowSpan` and `Grid.ColumnSpan`:

```xml
<Grid ColumnDefinitions="*,*,*" RowDefinitions="Auto,*">
    <!-- The title covers all three columns -->
    <TextBlock Grid.Row="0" Grid.Column="0" Grid.ColumnSpan="3"
               Text="CoinJar" FontSize="22" HorizontalAlignment="Center" />

    <Button Grid.Row="1" Grid.Column="0" Content="Food" Margin="4" />
    <Button Grid.Row="1" Grid.Column="1" Content="Transport" Margin="4" />
    <Button Grid.Row="1" Grid.Column="2" Content="Bills" Margin="4" />
</Grid>
```

The span counts from the starting cell. `Grid.Column="0" Grid.ColumnSpan="3"` covers columns 0, 1 and 2.

## Building a form with a Grid

Forms are where the `Grid` shines. A classic layout is an `Auto` column for labels and a star column for the inputs:

```xml
<Grid Margin="16" RowDefinitions="Auto,Auto,Auto,Auto" ColumnDefinitions="Auto,*">
    <TextBlock Grid.Row="0" Text="Title"    VerticalAlignment="Center" Margin="0,0,8,8" />
    <TextBox   Grid.Row="0" Grid.Column="1" Margin="0,0,0,8" />

    <TextBlock Grid.Row="1" Text="Amount"   VerticalAlignment="Center" Margin="0,0,8,8" />
    <TextBox   Grid.Row="1" Grid.Column="1" Margin="0,0,0,8" />

    <TextBlock Grid.Row="2" Text="Category" VerticalAlignment="Center" Margin="0,0,8,8" />
    <TextBox   Grid.Row="2" Grid.Column="1" Margin="0,0,0,8" />

    <Button Grid.Row="3" Grid.Column="1" Content="Add expense"
            HorizontalAlignment="Right" Padding="16,4" />
</Grid>
```

The label column is exactly as wide as the longest label ("Category"), and every text box lines up neatly. If you rename a label, the layout adjusts on its own. In [Selection Controls](/courses/wpf/selection-controls) the category box becomes a proper drop down list.

## Changing Grid positions from code

Because `Grid.Row` is an attached property, you set it from C# with static helper methods on `Grid`:

```csharp
private void MoveButton_Click(object sender, RoutedEventArgs e)
{
    // Read which column the button is in now, then move it one to the right.
    int column = Grid.GetColumn(MoveButton);
    Grid.SetColumn(MoveButton, (column + 1) % 3);
}
```

`Grid.SetRow`, `Grid.SetColumn`, `Grid.SetRowSpan` and `Grid.SetColumnSpan` all follow the same pattern. You can also add rows from code with `MyGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto })`. A star size in code is `new GridLength(1, GridUnitType.Star)`.

## Common mistakes

- **Forgetting that rows and columns start at 0.** `Grid.Row="1"` is the second row.
- **Everything piled in the top left cell.** You defined rows but forgot `Grid.Row` on the children, so they all went to row 0.
- **Using `*` for a row that should fit its content.** A star row takes a share of the leftover space, even if its content is tiny. Use `Auto` for headers, footers and form rows.
- **A row index that does not exist.** `Grid.Row="5"` in a grid with 3 rows does not crash. WPF quietly puts the element in the last row, which can be confusing.
- **Nesting many grids when one would do.** A grid inside a grid inside a grid is hard to read. Often one grid with a `ColumnSpan` is enough.

## Tips

- Plan on paper first. Sketch the window as boxes, then count the rows and columns.
- Put the sizing rules (`Auto`, `*`) on the definitions and the spacing (`Margin`) on the children.
- Keep `ShowGridLines="True"` on while building, it makes mistakes obvious.
- `GridSplitter` lets the user drag to resize a column. You will use it in [Building Resizable Layouts](/courses/wpf/building-resizable-layouts).

## Quick recap

- A `Grid` divides its space into rows and columns. Indexes start at 0.
- Children choose a cell with the attached properties `Grid.Row` and `Grid.Column`.
- Sizes can be `Auto` (fit the content), a fixed number, or star (`*`, `2*`) for a share of the leftover space.
- `Grid.RowSpan` and `Grid.ColumnSpan` let an element cover several cells.
- Elements in the same cell overlap, later ones on top.
- Newer WPF accepts the short form `RowDefinitions="Auto,*,Auto"`.
- From code, use `Grid.SetRow` and `Grid.SetColumn`.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Width="520" Height="380" MinWidth="420" MinHeight="320"&gt;
    &lt;!-- Three rows: header (Auto), content (*), footer (Auto) --&gt;
    &lt;Grid&gt;
        &lt;Grid.RowDefinitions&gt;
            &lt;RowDefinition Height="Auto" /&gt;
            &lt;RowDefinition Height="*" /&gt;
            &lt;RowDefinition Height="Auto" /&gt;
        &lt;/Grid.RowDefinitions&gt;
        &lt;!-- Header: a Border with a background, in row 0 --&gt;
        &lt;Border Grid.Row="0" Background="SteelBlue" Padding="16,10"&gt;
            &lt;TextBlock Text="CoinJar: add an expense" Foreground="White" FontSize="18" /&gt;
        &lt;/Border&gt;
        &lt;!-- Content: a form grid nested in row 1 (short syntax) --&gt;
        &lt;Grid Grid.Row="1" Margin="16" RowDefinitions="Auto,Auto,Auto,*" ColumnDefinitions="Auto,*"&gt;
            &lt;!-- Column 0 is Auto, so it is as wide as the longest label --&gt;
            &lt;TextBlock Grid.Row="0" Grid.Column="0" Text="Title" VerticalAlignment="Center" Margin="0,0,12,8" /&gt;
            &lt;TextBox x:Name="TitleBox" Grid.Row="0" Grid.Column="1" Margin="0,0,0,8" Padding="4" /&gt;
            &lt;TextBlock Grid.Row="1" Grid.Column="0" Text="Amount" VerticalAlignment="Center" Margin="0,0,12,8" /&gt;
            &lt;TextBox x:Name="AmountBox" Grid.Row="1" Grid.Column="1" Margin="0,0,0,8" Padding="4" /&gt;
            &lt;TextBlock Grid.Row="2" Grid.Column="0" Text="Category" VerticalAlignment="Center" Margin="0,0,12,8" /&gt;
            &lt;TextBox x:Name="CategoryBox" Grid.Row="2" Grid.Column="1" Margin="0,0,0,8" Padding="4" /&gt;
            &lt;!-- The last row is *, it takes the leftover space. The message spans both columns. --&gt;
            &lt;TextBlock x:Name="MessageText" Grid.Row="3" Grid.Column="0" Grid.ColumnSpan="2"
                       TextWrapping="Wrap" Foreground="DimGray" Text="Fill in the form and click Add." /&gt;
        &lt;/Grid&gt;
        &lt;!-- Footer: buttons on the right, in row 2 --&gt;
        &lt;Border Grid.Row="2" Background="WhiteSmoke" Padding="16,8"&gt;
            &lt;Grid ColumnDefinitions="*,Auto,Auto"&gt;
                &lt;TextBlock Grid.Column="0" Text="Step 1 of the CoinJar app" VerticalAlignment="Center" /&gt;
                &lt;Button Grid.Column="1" Content="Clear" Padding="16,4" Margin="0,0,8,0" Click="ClearButton_Click" /&gt;
                &lt;Button Grid.Column="2" Content="Add" Padding="16,4" IsDefault="True" Click="AddButton_Click" /&gt;
            &lt;/Grid&gt;
        &lt;/Border&gt;
    &lt;/Grid&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
    private void AddButton_Click(object sender, RoutedEventArgs e)
    {
        // No data binding yet, so read the boxes by their x:Name.
        MessageText.Text = $"Added \"{TitleBox.Text}\" ({AmountBox.Text}) to {CategoryBox.Text}.";
    }
    private void ClearButton_Click(object sender, RoutedEventArgs e)
    {
        TitleBox.Clear();
        AmountBox.Clear();
        CategoryBox.Clear();
        MessageText.Text = "Fill in the form and click Add.";
        TitleBox.Focus();
    }
}
</code></pre>
