---
publishDate: 2026-10-25T20:31
title: 'Styles and Setters'
slug: styles-and-setters
metadescription: 'Give CoinJar a consistent look with WPF styles: setters, TargetType, keyed and implicit styles, BasedOn inheritance, DataGrid styles and how local values win.'
updateDate: 2026-10-25T20:31
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'xaml', 'styles', 'styling']
course: wpf
---

## What a style is

In [Resources and Resource Dictionaries](/courses/wpf/resources-and-resource-dictionaries) you named single values, such as a brush or a margin. But a button's look is many values together: background, foreground, padding, font weight, cursor.

A **style** is a named bundle of property values that you can apply to many elements at once. If you have used CSS on the web, the idea is similar: describe the look once, apply it everywhere.

Without a style, every CoinJar button repeats the same five attributes:

```xml
<Button Content="Save"   Background="#2E7D32" Foreground="White" Padding="14,6" FontWeight="SemiBold" Cursor="Hand" />
<Button Content="Add"    Background="#2E7D32" Foreground="White" Padding="14,6" FontWeight="SemiBold" Cursor="Hand" />
<Button Content="Export" Background="#2E7D32" Foreground="White" Padding="14,6" FontWeight="SemiBold" Cursor="Hand" />
```

With a style, each button only says what is different about it: its text.

## Your first style

A `Style` lives in a resource dictionary. It has a `TargetType` and a list of `Setter` elements. Each setter names a `Property` and a `Value`:

```xml
<Window.Resources>
    <Style x:Key="PrimaryButton" TargetType="Button">
        <Setter Property="Background" Value="#2E7D32" />
        <Setter Property="Foreground" Value="White" />
        <Setter Property="Padding" Value="14,6" />
        <Setter Property="FontWeight" Value="SemiBold" />
        <Setter Property="Cursor" Value="Hand" />
    </Style>
</Window.Resources>

<StackPanel Orientation="Horizontal">
    <Button Content="Save"   Style="{StaticResource PrimaryButton}" />
    <Button Content="Add"    Style="{StaticResource PrimaryButton}" />
    <Button Content="Export" Style="{StaticResource PrimaryButton}" />
</StackPanel>
```

- `TargetType="Button"` says which kind of element the style is for. It also lets you write `Background` instead of the long form `Button.Background`.
- Each `Setter` sets one property. The `Value` is written exactly like an attribute value in normal XAML.
- `Style="{StaticResource PrimaryButton}"` applies it.

Setters can only target **dependency properties**. A dependency property is a special kind of WPF property that supports styles, bindings, animation and resources. Nearly every property you set in XAML (`Background`, `Margin`, `FontSize`) is one. You will learn how they work in [Dependency Properties](/courses/wpf/dependency-properties).

## Setter values that are not simple text

When a value is more than a short string, use property element syntax inside the setter, as you did for elements in [XAML Syntax Basics](/courses/wpf/xaml-syntax-basics):

```xml
<Style x:Key="HeaderBar" TargetType="Border">
    <Setter Property="Padding" Value="16,10" />
    <Setter Property="Background">
        <Setter.Value>
            <LinearGradientBrush StartPoint="0,0" EndPoint="1,0">
                <GradientStop Color="#2E7D32" Offset="0" />
                <GradientStop Color="#43A047" Offset="1" />
            </LinearGradientBrush>
        </Setter.Value>
    </Setter>
</Style>
```

Setter values can also be resources and bindings:

```xml
<Setter Property="Background" Value="{StaticResource AccentBrush}" />
<Setter Property="ToolTip" Value="{Binding Title}" />
```

## Implicit styles: apply to every element of a type

Leave out the `x:Key` and the style becomes **implicit**. It applies automatically to every element of that `TargetType` in scope, with no `Style="..."` needed:

```xml
<Window.Resources>
    <Style TargetType="TextBox">
        <Setter Property="Padding" Value="6,4" />
        <Setter Property="Margin" Value="0,2,0,12" />
    </Style>
</Window.Resources>

<!-- Both pick up the style automatically -->
<TextBox Text="{Binding Title}" />
<TextBox Text="{Binding Amount}" />
```

Under the hood, an implicit style's key is the type itself. That is why you will sometimes see it written as `{x:Type TextBox}`.

Where you put it decides how far it reaches, following the same lookup rules as other resources:

- in a panel's `Resources`: only inside that panel
- in `Window.Resources`: that window
- in `App.xaml` or a merged dictionary: the whole app

### An element can opt out

Set `Style="{x:Null}"` on an element to skip an implicit style. This is rarely needed, but handy for a one off.

### Only the exact type

An implicit style for `Button` does **not** apply to a `ToggleButton` or `RepeatButton`, even though they are related. The match is on the exact type. Give those types their own style, usually `BasedOn` the button one (see below).

## BasedOn: building styles from styles

Styles can inherit from another style with `BasedOn`, just as a C# class can use [inheritance](/courses/c-sharp/inheritance). The new style gets all the setters of the base and can add or override some:

```xml
<Style x:Key="BaseButton" TargetType="Button">
    <Setter Property="Padding" Value="14,6" />
    <Setter Property="FontWeight" Value="SemiBold" />
    <Setter Property="Cursor" Value="Hand" />
</Style>

<Style x:Key="PrimaryButton" TargetType="Button" BasedOn="{StaticResource BaseButton}">
    <Setter Property="Background" Value="{StaticResource AccentBrush}" />
    <Setter Property="Foreground" Value="White" />
</Style>

<Style x:Key="DangerButton" TargetType="Button" BasedOn="{StaticResource BaseButton}">
    <Setter Property="Background" Value="{StaticResource DangerBrush}" />
    <Setter Property="Foreground" Value="White" />
</Style>
```

To extend an **implicit** style, refer to it by its type key:

```xml
<Style x:Key="SmallTextBox" TargetType="TextBox" BasedOn="{StaticResource {x:Type TextBox}}">
    <Setter Property="Width" Value="90" />
</Style>
```

This is a very common pattern. Without `BasedOn`, a keyed style **replaces** the implicit one completely, and you lose all of its setters.

## Who wins: local values beat styles

If an element sets a property directly and its style sets the same property, the **local value wins**:

```xml
<!-- The style says green, but this button is purple -->
<Button Content="Special" Style="{StaticResource PrimaryButton}" Background="Purple" />
```

WPF has a fixed order of who wins when several things set the same property. It is called **dependency property value precedence**. A simplified version, from strongest to weakest:

```text
1. Animations
2. Local value (set in XAML or code on the element)
3. Style triggers
4. Style setters
5. The control's built in theme style
6. Value inherited from a parent (for example FontSize)
7. Default value
```

The practical lesson: if a style seems to "not work", check whether the element also sets that property directly. This matters even more in the next lesson, [Triggers](/courses/wpf/triggers), because a local value also blocks style triggers.

## Styling attached properties and events

Setters work with attached properties too. Write the owner type and the property name. Here we move the error template from [Input Validation](/courses/wpf/input-validation) into the implicit `TextBox` style, so every text box gets it:

```xml
<Style TargetType="TextBox">
    <Setter Property="Validation.ErrorTemplate" Value="{StaticResource FriendlyError}" />
</Style>
```

An `EventSetter` attaches an event handler from a style. The handler goes in the code behind of the file that holds the style:

```xml
<Style TargetType="TextBox">
    <EventSetter Event="GotKeyboardFocus" Handler="TextBox_SelectAll" />
</Style>
```

```csharp
private void TextBox_SelectAll(object sender, RoutedEventArgs e)
    => ((TextBox)sender).SelectAll();
```

## Styling the parts of a DataGrid

Complex controls offer extra style properties for their pieces. For the CoinJar grid from [The DataGrid Control](/courses/wpf/the-datagrid-control):

```xml
<DataGrid>
    <DataGrid.ColumnHeaderStyle>
        <Style TargetType="DataGridColumnHeader">
            <Setter Property="FontWeight" Value="SemiBold" />
            <Setter Property="Padding" Value="8,6" />
        </Style>
    </DataGrid.ColumnHeaderStyle>

    <DataGrid.Columns>
        <DataGridTextColumn Header="Amount" Binding="{Binding Amount, StringFormat=C}">
            <DataGridTextColumn.ElementStyle>
                <Style TargetType="TextBlock">
                    <Setter Property="HorizontalAlignment" Value="Right" />
                </Style>
            </DataGridTextColumn.ElementStyle>
        </DataGridTextColumn>
    </DataGrid.Columns>
</DataGrid>
```

- `ColumnHeaderStyle` styles the header cells.
- `RowStyle` styles each `DataGridRow`, and `CellStyle` each `DataGridCell`.
- A text column's `ElementStyle` styles the `TextBlock` shown in normal mode, and `EditingElementStyle` the `TextBox` used when editing.

Lists have a similar property called `ItemContainerStyle`, which styles each `ListBoxItem` wrapper around your [data template](/courses/wpf/data-templates).

## Putting styles in their own file

Styles grow quickly. Move them to `Themes/Styles.xaml` and merge it in `App.xaml` after your colours, because the styles use the colour resources:

```xml
<ResourceDictionary.MergedDictionaries>
    <ResourceDictionary Source="Themes/Colors.xaml" />
    <ResourceDictionary Source="Themes/Styles.xaml" />
</ResourceDictionary.MergedDictionaries>
```

## What styles cannot do

A style can only set properties that the control already has. It cannot change the control's basic shape. For example, the standard `Button` draws its own border and hover colour, and a `Background` setter may seem to be ignored when the mouse is over it. To change the shape and the hover look you replace the control's template, which you will do in [Control Templates](/courses/wpf/control-templates).

## Common mistakes

- **A keyed style hides the implicit one.** Add `BasedOn="{StaticResource {x:Type Button}}"`.
- **The style is ignored on one element.** That element sets the same property locally. Remove the local value.
- **"Cannot find resource".** The style uses a brush that is merged later, or not at all. Merge colours before styles.
- **Wrong TargetType.** A `Style TargetType="Button"` applied to a `TextBlock` throws an error when the window loads.
- **A style for TextBlock in App.xaml changes too much.** An implicit `TextBlock` style in `App.xaml` also reaches text drawn inside other controls, such as buttons and combo boxes. Prefer a keyed style for `TextBlock`, or keep the implicit one in a window or panel.

## Quick recap

- A style is a reusable bundle of `Setter` elements for one `TargetType`.
- Keyed styles are applied with `Style="{StaticResource Key}"`. Implicit styles (no key) apply to every element of that exact type in scope.
- `BasedOn` lets one style extend another. Use `{StaticResource {x:Type Button}}` to extend an implicit style.
- Local values beat style setters, following dependency property value precedence.
- Setters work with attached properties, and `EventSetter` hooks up events.
- `DataGrid` has `ColumnHeaderStyle`, `RowStyle`, `CellStyle` and `ElementStyle`. Lists have `ItemContainerStyle`.

<code id="code-content" class="language-xml">
&lt;!-- Themes/Styles.xaml --&gt;
&lt;ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"&gt;
    &lt;!-- Shared button basics --&gt;
    &lt;Style x:Key="BaseButton" TargetType="Button"&gt;
        &lt;Setter Property="Padding" Value="14,6" /&gt;
        &lt;Setter Property="Margin" Value="0,0,8,0" /&gt;
        &lt;Setter Property="FontWeight" Value="SemiBold" /&gt;
        &lt;Setter Property="Cursor" Value="Hand" /&gt;
    &lt;/Style&gt;
    &lt;!-- Implicit: every Button gets the basics --&gt;
    &lt;Style TargetType="Button" BasedOn="{StaticResource BaseButton}" /&gt;
    &lt;Style x:Key="PrimaryButton" TargetType="Button" BasedOn="{StaticResource BaseButton}"&gt;
        &lt;Setter Property="Background" Value="{StaticResource AccentBrush}" /&gt;
        &lt;Setter Property="Foreground" Value="White" /&gt;
    &lt;/Style&gt;
    &lt;Style x:Key="DangerButton" TargetType="Button" BasedOn="{StaticResource BaseButton}"&gt;
        &lt;Setter Property="Background" Value="{StaticResource DangerBrush}" /&gt;
        &lt;Setter Property="Foreground" Value="White" /&gt;
    &lt;/Style&gt;
    &lt;!-- Implicit TextBox style for every form field --&gt;
    &lt;Style TargetType="TextBox"&gt;
        &lt;Setter Property="Padding" Value="6,4" /&gt;
        &lt;Setter Property="Margin" Value="0,2,0,12" /&gt;
    &lt;/Style&gt;
    &lt;!-- Keyed TextBlock styles, so text inside other controls is not affected --&gt;
    &lt;Style x:Key="PageTitle" TargetType="TextBlock"&gt;
        &lt;Setter Property="FontSize" Value="22" /&gt;
        &lt;Setter Property="FontWeight" Value="Bold" /&gt;
        &lt;Setter Property="Foreground" Value="{StaticResource AccentBrush}" /&gt;
        &lt;Setter Property="Margin" Value="0,0,0,12" /&gt;
    &lt;/Style&gt;
    &lt;Style x:Key="FieldLabel" TargetType="TextBlock"&gt;
        &lt;Setter Property="Foreground" Value="{StaticResource MutedTextBrush}" /&gt;
    &lt;/Style&gt;
    &lt;!-- A card is just a styled Border --&gt;
    &lt;Style x:Key="Card" TargetType="Border"&gt;
        &lt;Setter Property="Background" Value="{StaticResource CardBrush}" /&gt;
        &lt;Setter Property="Padding" Value="16,12" /&gt;
        &lt;Setter Property="CornerRadius" Value="8" /&gt;
        &lt;Setter Property="Margin" Value="0,0,0,12" /&gt;
    &lt;/Style&gt;
&lt;/ResourceDictionary&gt;
&lt;!-- Themes/Colors.xaml --&gt;
&lt;ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"&gt;
    &lt;SolidColorBrush x:Key="AccentBrush" Color="#2E7D32" /&gt;
    &lt;SolidColorBrush x:Key="DangerBrush" Color="#C62828" /&gt;
    &lt;SolidColorBrush x:Key="PageBrush" Color="#F3F5F7" /&gt;
    &lt;SolidColorBrush x:Key="CardBrush" Color="#FFFFFF" /&gt;
    &lt;SolidColorBrush x:Key="MutedTextBrush" Color="#6B7280" /&gt;
&lt;/ResourceDictionary&gt;
&lt;!-- App.xaml --&gt;
&lt;Application x:Class="CoinJar.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml"&gt;
    &lt;Application.Resources&gt;
        &lt;ResourceDictionary&gt;
            &lt;ResourceDictionary.MergedDictionaries&gt;
                &lt;!-- Colours first, because the styles use them --&gt;
                &lt;ResourceDictionary Source="Themes/Colors.xaml" /&gt;
                &lt;ResourceDictionary Source="Themes/Styles.xaml" /&gt;
            &lt;/ResourceDictionary.MergedDictionaries&gt;
        &lt;/ResourceDictionary&gt;
    &lt;/Application.Resources&gt;
&lt;/Application&gt;
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Height="420" Width="460"
        Background="{StaticResource PageBrush}"&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;TextBlock Text="Add expense" Style="{StaticResource PageTitle}" /&gt;
        &lt;Border Style="{StaticResource Card}"&gt;
            &lt;StackPanel&gt;
                &lt;!-- The TextBoxes pick up the implicit style --&gt;
                &lt;TextBlock Text="Title" Style="{StaticResource FieldLabel}" /&gt;
                &lt;TextBox Text="Groceries" /&gt;
                &lt;TextBlock Text="Amount" Style="{StaticResource FieldLabel}" /&gt;
                &lt;TextBox Text="42.80" /&gt;
                &lt;!-- A local value beats the style's Margin --&gt;
                &lt;TextBlock Text="Notes" Style="{StaticResource FieldLabel}" /&gt;
                &lt;TextBox Text="Weekly shop" Margin="0,2,0,0" /&gt;
            &lt;/StackPanel&gt;
        &lt;/Border&gt;
        &lt;StackPanel Orientation="Horizontal"&gt;
            &lt;Button Content="Save" Style="{StaticResource PrimaryButton}" /&gt;
            &lt;Button Content="Delete" Style="{StaticResource DangerButton}" /&gt;
            &lt;!-- Implicit style: basics only --&gt;
            &lt;Button Content="Cancel" /&gt;
        &lt;/StackPanel&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
</code></pre>
