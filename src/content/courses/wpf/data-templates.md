---
publishDate: 2026-10-25T20:26
title: 'Data Templates'
slug: data-templates
metadescription: 'Design how each item looks with DataTemplate. Build rich CoinJar list rows, reuse templates as resources, apply them by type, change the item panel and pick templates with a DataTemplateSelector.'
updateDate: 2026-10-25T20:26
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'data-binding', 'datatemplate', 'itemscontrol']
course: wpf
---

## One line of text is not enough

In [Binding to Collections](/courses/wpf/binding-to-collections) the CoinJar list showed each expense with `DisplayMemberPath="Summary"`. That gives one line of plain text per row. A good expense row wants more: a coloured dot for the category, the title in bold, the date in grey underneath, and the amount lined up on the right.

A **data template** is the answer. It is a small piece of XAML that describes how to draw **one data object**. You give it to a list, and the list stamps out a copy of the template for every item, each one bound to its own item.

Think of a cookie cutter: you design the shape once, and every cookie comes out the same shape with different sprinkles.

## Your first ItemTemplate

Every list control has an `ItemTemplate` property. Put a `DataTemplate` inside it:

```xml
<ListBox ItemsSource="{Binding Expenses}"
         SelectedItem="{Binding SelectedExpense}">
    <ListBox.ItemTemplate>
        <DataTemplate>
            <StackPanel Orientation="Horizontal">
                <TextBlock Text="{Binding Title}" FontWeight="SemiBold" />
                <TextBlock Text="{Binding Amount, StringFormat=C}" Margin="8,0,0,0" />
            </StackPanel>
        </DataTemplate>
    </ListBox.ItemTemplate>
</ListBox>
```

The key idea: **inside a template, the `DataContext` is the item.** `{Binding Title}` means "the `Title` of the expense this row is showing", not the view model. WPF sets this up for every row automatically.

Remove `DisplayMemberPath` when you add an `ItemTemplate`. Setting both throws an error, because they both try to decide how an item looks.

## A proper expense row

Now let us build a real row with a `Grid` from [The Grid Panel](/courses/wpf/the-grid-panel) and the converter from [Value Converters](/courses/wpf/value-converters):

```xml
<DataTemplate>
    <Grid Margin="0,4">
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="Auto" />  <!-- dot -->
            <ColumnDefinition Width="*" />     <!-- title and details -->
            <ColumnDefinition Width="Auto" />  <!-- amount -->
        </Grid.ColumnDefinitions>

        <Border Width="12" Height="12" CornerRadius="6" Margin="0,0,10,0"
                VerticalAlignment="Center"
                Background="{Binding Category, Converter={StaticResource CategoryBrush}}" />

        <StackPanel Grid.Column="1">
            <TextBlock Text="{Binding Title}" FontWeight="SemiBold" />
            <TextBlock Foreground="Gray" FontSize="11">
                <Run Text="{Binding Category}" />
                <Run Text=" · " />
                <Run Text="{Binding Date, StringFormat='d MMM yyyy'}" />
            </TextBlock>
        </StackPanel>

        <TextBlock Grid.Column="2" Text="{Binding Amount, StringFormat=C}"
                   VerticalAlignment="Center" FontSize="14" />
    </Grid>
</DataTemplate>
```

A `Run` is a piece of text inside a `TextBlock`. Using several runs lets you bind different parts of one line to different properties.

### Make the row fill the width

Run this and the amounts are not lined up on the right. They sit right after the title. Each row is only as wide as its content, so the `*` column has no spare space to fill.

The fix is one property on the list:

```xml
<ListBox ItemsSource="{Binding Expenses}"
         HorizontalContentAlignment="Stretch">
```

`HorizontalContentAlignment="Stretch"` tells each row to take the full width of the list. Now the `*` column grows and the amount column is pushed to the right edge. Nearly everyone hits this the first time.

## Templates as reusable resources

A template written inside one `ListBox` can only be used there. Move it into the window's resources with an `x:Key` and you can use it anywhere:

```xml
<Window.Resources>
    <conv:CategoryToBrushConverter x:Key="CategoryBrush" />

    <DataTemplate x:Key="ExpenseRowTemplate">
        <!-- the Grid from above -->
    </DataTemplate>
</Window.Resources>

<ListBox ItemsSource="{Binding Expenses}"
         ItemTemplate="{StaticResource ExpenseRowTemplate}" />
```

Order matters: `StaticResource` looks for resources defined *earlier*. Declare the converter before the template that uses it, and both before the controls. You will see more about this in [Resources and Resource Dictionaries](/courses/wpf/resources-and-resource-dictionaries).

## Templates chosen by type

You can also tell WPF: "whenever you need to show an `Expense`, anywhere, use this template". Set `DataType` and leave out `x:Key`:

```xml
<Window xmlns:models="clr-namespace:CoinJar.Models" ...>
    <Window.Resources>
        <DataTemplate DataType="{x:Type models:Expense}">
            <Border Padding="12" Background="WhiteSmoke" CornerRadius="6">
                <StackPanel>
                    <TextBlock Text="{Binding Title}" FontSize="18" FontWeight="SemiBold" />
                    <TextBlock Text="{Binding Amount, StringFormat=C}" FontSize="24" />
                </StackPanel>
            </Border>
        </DataTemplate>
    </Window.Resources>
```

This is an **implicit data template**. It applies by itself wherever an `Expense` is shown as content and no other template was chosen. For example:

```xml
<ContentControl Content="{Binding SelectedExpense}" />
```

A `ContentControl` is a simple control that shows one piece of content. Give it an `Expense` and it finds the implicit template and draws the card. Select another row and the card updates. When `SelectedExpense` is `null`, the control shows nothing.

If you add `x:Key` to a template that has `DataType`, it stops being implicit and is only used where you ask for it by key.

Implicit templates become very powerful in [Navigation Between Views](/courses/wpf/navigation-between-views), where WPF uses them to show the right screen for each view model.

## ContentTemplate for single items

`ItemTemplate` is for lists. For one piece of content, controls like `ContentControl`, `Button` and `Label` have `ContentTemplate`:

```xml
<ContentControl Content="{Binding SelectedExpense}"
                ContentTemplate="{StaticResource ExpenseRowTemplate}" />
```

This reuses the row template for a single item. Same template, two places.

## Changing the panel with ItemsPanel

A list stacks its items from top to bottom because it uses a `StackPanel` (actually a faster cousin called `VirtualizingStackPanel`) inside. You can swap that panel with `ItemsPanel`. Here is a row of category "chips" that wraps onto new lines:

```xml
<ItemsControl ItemsSource="{Binding Categories}">
    <ItemsControl.ItemsPanel>
        <ItemsPanelTemplate>
            <WrapPanel />
        </ItemsPanelTemplate>
    </ItemsControl.ItemsPanel>

    <ItemsControl.ItemTemplate>
        <DataTemplate>
            <Border Background="{Binding Converter={StaticResource CategoryBrush}}"
                    CornerRadius="10" Padding="10,2" Margin="0,0,6,6">
                <TextBlock Text="{Binding}" Foreground="White" />
            </Border>
        </DataTemplate>
    </ItemsControl.ItemTemplate>
</ItemsControl>
```

Two new things here:

- `ItemsControl` is the plainest list control. It shows items but has no selection and no scroll bar. It is perfect for display only lists.
- `{Binding}` with no path means "the item itself". Each item is a plain `string` like "Food", so there is no property to name.

`ItemTemplate` decides how **each item** looks. `ItemsPanel` decides how the items are **arranged**. Later, [Control Templates](/courses/wpf/control-templates) decide how the **control itself** looks. These three are easy to mix up, so it helps to keep the list in mind.

## Picking a template in code: DataTemplateSelector

Sometimes different items need different templates. CoinJar could show big expenses with a warning style. A `DataTemplateSelector` is a class that looks at each item and returns the template to use:

```csharp
using System.Windows;
using System.Windows.Controls;
using CoinJar.Models;

namespace CoinJar.Views;

public class ExpenseTemplateSelector : DataTemplateSelector
{
    public DataTemplate? NormalTemplate { get; set; }
    public DataTemplate? LargeTemplate { get; set; }

    public override DataTemplate? SelectTemplate(object item, DependencyObject container)
    {
        if (item is Expense expense && expense.Amount >= 50m)
            return LargeTemplate;
        return NormalTemplate;
    }
}
```

Declare it in resources, fill in its two templates, and hand it to the list with `ItemTemplateSelector`:

```xml
<views:ExpenseTemplateSelector x:Key="ExpenseSelector"
    NormalTemplate="{StaticResource ExpenseRowTemplate}"
    LargeTemplate="{StaticResource LargeExpenseRowTemplate}" />

<ListBox ItemsSource="{Binding Expenses}"
         ItemTemplateSelector="{StaticResource ExpenseSelector}" />
```

One limit to know: the selector runs when a row is created. If the user later edits an amount from 20 to 80, the row keeps its old template. For looks that follow live changes, a **data trigger** inside one template is better. You will learn those in [Property, Data and Event Triggers](/courses/wpf/triggers).

## Reaching outside the template

Inside a template the `DataContext` is the item. Sometimes a row needs something from the view model instead, for example a list of categories for a `ComboBox` inside the row. Climb up with `RelativeSource`, just like in the previous lessons:

```xml
<ComboBox ItemsSource="{Binding DataContext.Categories,
                        RelativeSource={RelativeSource AncestorType=ListBox}}"
          SelectedItem="{Binding Category}" />
```

The `ListBox` itself still has the view model as its `DataContext`, so `DataContext.Categories` finds the list.

## A word about TreeView

For data with levels, such as categories that contain expenses, WPF has `HierarchicalDataTemplate`. It is a data template with an extra `ItemsSource` that says where the children are, and a `TreeView` uses it to draw each level. The ideas are the same as in this lesson, just one level deeper.

## Common mistakes

- **Setting both `DisplayMemberPath` and `ItemTemplate`.** WPF throws an error. Use one.
- **Rows that do not fill the width.** Add `HorizontalContentAlignment="Stretch"` to the list.
- **Bindings in a template that point at the view model.** Inside a template, `{Binding X}` reads from the item. Use `RelativeSource` to reach outside.
- **An implicit template that is never used.** Check the `DataType` and the `xmlns` prefix, and make sure there is no `x:Key`.
- **Using a resource before it is declared.** `StaticResource` only sees resources above it. Move the converter and templates to the top.
- **Very heavy templates in long lists.** Every row creates all the elements in the template. Keep rows simple, and read [Performance and UI Virtualization](/courses/wpf/performance-and-virtualization) before showing thousands of items.

## Quick recap

- A `DataTemplate` describes how to draw one data object. Inside it, the `DataContext` is the item.
- `ItemTemplate` styles every item of a list. `ContentTemplate` styles a single piece of content.
- Add `HorizontalContentAlignment="Stretch"` so rows fill the list's width.
- Keyed templates in `Resources` can be reused. Templates with `DataType` and no key apply automatically by type.
- `ItemsPanel` changes how items are arranged, for example a `WrapPanel`.
- `DataTemplateSelector` picks a template per item in code, once per row.
- Next, show many columns of data with sorting and editing in [The DataGrid Control](/courses/wpf/the-datagrid-control).

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;!-- ExpenseListViewModel, Expense, MainWindow.xaml.cs and the converters stay the same as in the previous two lessons --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:conv="clr-namespace:CoinJar.Converters"
        xmlns:models="clr-namespace:CoinJar.Models"
        xmlns:views="clr-namespace:CoinJar.Views"
        Title="CoinJar" Width="720" Height="480"&gt;
    &lt;Window.Resources&gt;
        &lt;!-- 1. Converters first, so the templates below can use them --&gt;
        &lt;conv:CategoryToBrushConverter x:Key="CategoryBrush" /&gt;
        &lt;!-- 2. Normal row: dot, title, category and date, amount on the right --&gt;
        &lt;DataTemplate x:Key="ExpenseRowTemplate"&gt;
            &lt;Grid Margin="0,4"&gt;
                &lt;Grid.ColumnDefinitions&gt;
                    &lt;ColumnDefinition Width="Auto" /&gt;
                    &lt;ColumnDefinition Width="*" /&gt;
                    &lt;ColumnDefinition Width="Auto" /&gt;
                &lt;/Grid.ColumnDefinitions&gt;
                &lt;Border Width="12" Height="12" CornerRadius="6" Margin="0,0,10,0" VerticalAlignment="Center"
                        Background="{Binding Category, Converter={StaticResource CategoryBrush}}" /&gt;
                &lt;StackPanel Grid.Column="1"&gt;
                    &lt;TextBlock Text="{Binding Title}" FontWeight="SemiBold" /&gt;
                    &lt;TextBlock Foreground="Gray" FontSize="11"&gt;
                        &lt;Run Text="{Binding Category}" /&gt;
                        &lt;Run Text=" · " /&gt;
                        &lt;Run Text="{Binding Date, StringFormat='d MMM yyyy'}" /&gt;
                    &lt;/TextBlock&gt;
                &lt;/StackPanel&gt;
                &lt;TextBlock Grid.Column="2" Text="{Binding Amount, StringFormat=C}"
                           VerticalAlignment="Center" FontSize="14" /&gt;
            &lt;/Grid&gt;
        &lt;/DataTemplate&gt;
        &lt;!-- 3. Large row: same idea, with a warning colour --&gt;
        &lt;DataTemplate x:Key="LargeExpenseRowTemplate"&gt;
            &lt;Border Background="#FFF4E5" CornerRadius="4" Padding="4"&gt;
                &lt;Grid&gt;
                    &lt;Grid.ColumnDefinitions&gt;
                        &lt;ColumnDefinition Width="*" /&gt;
                        &lt;ColumnDefinition Width="Auto" /&gt;
                    &lt;/Grid.ColumnDefinitions&gt;
                    &lt;StackPanel&gt;
                        &lt;TextBlock Text="{Binding Title}" FontWeight="Bold" /&gt;
                        &lt;TextBlock Text="Large expense" Foreground="DarkOrange" FontSize="11" /&gt;
                    &lt;/StackPanel&gt;
                    &lt;TextBlock Grid.Column="1" Text="{Binding Amount, StringFormat=C}"
                               Foreground="Firebrick" FontWeight="Bold" FontSize="14" VerticalAlignment="Center" /&gt;
                &lt;/Grid&gt;
            &lt;/Border&gt;
        &lt;/DataTemplate&gt;
        &lt;!-- 4. The selector picks one of the two templates per row --&gt;
        &lt;views:ExpenseTemplateSelector x:Key="ExpenseSelector"
                                       NormalTemplate="{StaticResource ExpenseRowTemplate}"
                                       LargeTemplate="{StaticResource LargeExpenseRowTemplate}" /&gt;
        &lt;!-- 5. Implicit template: used wherever an Expense is shown as content --&gt;
        &lt;DataTemplate DataType="{x:Type models:Expense}"&gt;
            &lt;Border Padding="12" Background="WhiteSmoke" CornerRadius="6"&gt;
                &lt;StackPanel&gt;
                    &lt;TextBlock Text="{Binding Title}" FontSize="18" FontWeight="SemiBold" /&gt;
                    &lt;TextBlock Text="{Binding Amount, StringFormat=C}" FontSize="24" /&gt;
                    &lt;TextBlock Text="{Binding Date, StringFormat='dddd d MMMM'}" Foreground="Gray" /&gt;
                &lt;/StackPanel&gt;
            &lt;/Border&gt;
        &lt;/DataTemplate&gt;
    &lt;/Window.Resources&gt;
    &lt;DockPanel Margin="12"&gt;
        &lt;!-- Category chips in a WrapPanel --&gt;
        &lt;ItemsControl DockPanel.Dock="Top" ItemsSource="{Binding Categories}" Margin="0,0,0,8"&gt;
            &lt;ItemsControl.ItemsPanel&gt;
                &lt;ItemsPanelTemplate&gt;
                    &lt;WrapPanel /&gt;
                &lt;/ItemsPanelTemplate&gt;
            &lt;/ItemsControl.ItemsPanel&gt;
            &lt;ItemsControl.ItemTemplate&gt;
                &lt;DataTemplate&gt;
                    &lt;Border Background="{Binding Converter={StaticResource CategoryBrush}}"
                            CornerRadius="10" Padding="10,2" Margin="0,0,6,6"&gt;
                        &lt;TextBlock Text="{Binding}" Foreground="White" /&gt;
                    &lt;/Border&gt;
                &lt;/DataTemplate&gt;
            &lt;/ItemsControl.ItemTemplate&gt;
        &lt;/ItemsControl&gt;
        &lt;StackPanel DockPanel.Dock="Bottom" Orientation="Horizontal" Margin="0,8,0,0"&gt;
            &lt;Button Content="Add" Click="Add_Click" Padding="12,4" /&gt;
            &lt;Button Content="Delete" Click="Delete_Click" Padding="12,4" Margin="8,0,0,0" /&gt;
            &lt;TextBlock Text="{Binding Total, StringFormat='Total: {0:C}'}" FontWeight="SemiBold"
                       VerticalAlignment="Center" Margin="16,0,0,0" /&gt;
        &lt;/StackPanel&gt;
        &lt;Grid&gt;
            &lt;Grid.ColumnDefinitions&gt;
                &lt;ColumnDefinition Width="3*" /&gt;
                &lt;ColumnDefinition Width="2*" /&gt;
            &lt;/Grid.ColumnDefinitions&gt;
            &lt;!-- The list: rows stretch to full width, templates picked per row --&gt;
            &lt;ListBox ItemsSource="{Binding Expenses}"
                     SelectedItem="{Binding SelectedExpense}"
                     HorizontalContentAlignment="Stretch"
                     ItemTemplateSelector="{StaticResource ExpenseSelector}" /&gt;
            &lt;!-- The detail side: a card from the implicit template, then the edit form --&gt;
            &lt;StackPanel Grid.Column="1" Margin="12,0,0,0"&gt;
                &lt;ContentControl Content="{Binding SelectedExpense}" /&gt;
                &lt;StackPanel DataContext="{Binding SelectedExpense}" Margin="0,12,0,0"&gt;
                    &lt;TextBlock Text="Title" /&gt;
                    &lt;TextBox Text="{Binding Title, UpdateSourceTrigger=PropertyChanged}" /&gt;
                    &lt;TextBlock Text="Amount" Margin="0,8,0,0" /&gt;
                    &lt;TextBox Text="{Binding Amount}" /&gt;
                    &lt;TextBlock Text="Category" Margin="0,8,0,0" /&gt;
                    &lt;ComboBox ItemsSource="{Binding DataContext.Categories, RelativeSource={RelativeSource AncestorType=Window}}"
                              SelectedItem="{Binding Category}" /&gt;
                &lt;/StackPanel&gt;
            &lt;/StackPanel&gt;
        &lt;/Grid&gt;
    &lt;/DockPanel&gt;
&lt;/Window&gt;
// Views/ExpenseTemplateSelector.cs
using System.Windows;
using System.Windows.Controls;
using CoinJar.Models;
namespace CoinJar.Views;
// Chooses a row template for each expense when the row is created
public class ExpenseTemplateSelector : DataTemplateSelector
{
    public DataTemplate? NormalTemplate { get; set; }
    public DataTemplate? LargeTemplate { get; set; }
    public override DataTemplate? SelectTemplate(object item, DependencyObject container)
    {
        if (item is Expense expense &amp;&amp; expense.Amount &gt;= 50m)
            return LargeTemplate;
        return NormalTemplate;
    }
}
</code></pre>
