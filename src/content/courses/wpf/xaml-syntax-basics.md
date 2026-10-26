---
publishDate: 2026-10-25T20:05
title: 'XAML Syntax Basics'
slug: xaml-syntax-basics
metadescription: 'Learn the rules of XAML: how elements become objects, attributes become properties, when to use property element syntax, content properties, collections and type converters.'
updateDate: 2026-10-25T20:05
author: ['bishal-biswas']
level: 1
tags: ['wpf', 'xaml', 'syntax', 'beginners']
course: wpf
---

## What XAML really is

**XAML** stands for **eXtensible Application Markup Language**. It looks like HTML, but there is one big idea to hold on to:

> Every XAML element creates a C# object, and every attribute sets a property on that object.

That is it. XAML is just a short, readable way to create objects and set their properties. Anything you write in XAML, you could also write in C#. Look at this button:

```xml
<Button Content="Save" Width="100" />
```

It does the same as this C#:

```csharp
var button = new Button();
button.Content = "Save";
button.Width = 100;
```

Once you see XAML this way, the rules below make a lot of sense.

## XAML is XML

XAML follows the rules of **XML**, a general format for structured text. That means:

- Every element has a start tag and an end tag: `<StackPanel>` ... `</StackPanel>`.
- An element with nothing inside can close itself: `<Button />`.
- Attribute values always go in quotes: `Width="100"`, never `Width=100`.
- Elements must be properly nested. You cannot close an outer element before an inner one.
- There is exactly one **root element** (the outermost one), such as `Window`.

```xml
<!-- Good: properly nested -->
<StackPanel>
    <TextBlock Text="One" />
    <TextBlock Text="Two" />
</StackPanel>

<!-- Bad: the TextBlock is closed after the StackPanel -->
<StackPanel>
    <TextBlock Text="One">
</StackPanel>
    </TextBlock>
```

### Case matters

XAML is **case sensitive**. `Button` works, `button` does not. `Width` works, `width` does not. Names match the C# class and property names exactly.

### Comments

Comments use the XML style. They can span several lines:

```xml
<!-- This is a comment. WPF ignores it. -->
<Button Content="OK" />
```

You cannot put a comment inside a tag, only between elements.

## Elements are objects

Each element name is the name of a class. `TextBlock` creates a `System.Windows.Controls.TextBlock` object, `Border` creates a `Border`, and so on. When elements are nested, the inner ones become children of the outer one:

```xml
<Border BorderBrush="Gray" BorderThickness="1" Padding="10">
    <TextBlock Text="Inside a border" />
</Border>
```

In C# that would be:

```csharp
var border = new Border
{
    BorderBrush = Brushes.Gray,
    BorderThickness = new Thickness(1),
    Padding = new Thickness(10),
    Child = new TextBlock { Text = "Inside a border" }
};
```

Notice how much shorter and easier to read the XAML version is. That is why we describe screens in XAML.

## Attributes are properties

An attribute sets a property. The value is always written as text, and WPF turns that text into the right type. This is called **attribute syntax**:

```xml
<TextBlock Text="Total spent"
           FontSize="18"
           FontWeight="Bold"
           Foreground="DarkSlateBlue"
           Margin="0,0,0,10" />
```

Attributes can also hook up **events**, like `Click="Save_Click"`. You will look at those in [Code-Behind and Event Handlers](/courses/wpf/code-behind-and-event-handlers).

## Type converters: text into objects

How does `"0,0,0,10"` become a margin, or `"DarkSlateBlue"` become a colour? WPF uses **type converters**: small helpers that turn a string into the type a property needs. You never call them yourself, they run automatically.

Here are the conversions you will use most:

```text
Width="120"                 a double: 120
IsEnabled="False"           a bool: false
FontWeight="Bold"           an enum value: FontWeights.Bold
Foreground="Red"            a named colour brush
Background="#FF2E7D32"      a colour in hex: alpha, red, green, blue
Background="#2E7D32"        hex without alpha (fully opaque)
Margin="10"                 10 on all four sides
Margin="10,5"               10 left and right, 5 top and bottom
Margin="10,5,10,0"          left, top, right, bottom
HorizontalAlignment="Right" an enum value
```

Margins go **left, top, right, bottom**, clockwise starting from the left. You will use them a lot in [Layout Basics: Size, Margin and Alignment](/courses/wpf/layout-basics-size-margin-and-alignment).

## Property element syntax

Sometimes a property value is too complex to fit in a string. For example, a background that fades from one colour to another. For that, XAML has **property element syntax**: you write the property as its own element, named `TypeName.PropertyName`:

```xml
<Button Content="Gradient button" Height="40">
    <Button.Background>
        <LinearGradientBrush StartPoint="0,0" EndPoint="1,0">
            <GradientStop Color="LightSkyBlue" Offset="0" />
            <GradientStop Color="SteelBlue" Offset="1" />
        </LinearGradientBrush>
    </Button.Background>
</Button>
```

`Button.Background` is not a new control. It means "set the `Background` property of this `Button` to the object inside". Both forms below do exactly the same thing:

```xml
<!-- Attribute syntax -->
<Button Background="LightGreen" Content="OK" />

<!-- Property element syntax -->
<Button Content="OK">
    <Button.Background>
        <SolidColorBrush Color="LightGreen" />
    </Button.Background>
</Button>
```

Use the short attribute form when a string is enough, and the property element form when it is not. You already saw property element syntax in `App.xaml`: `Application.Resources` is one.

## The content property

Many controls have one special property, the **content property**, that you can set by simply putting something between the start and end tags. For a `Button` it is `Content`. For a `TextBlock`, text between the tags becomes the text it shows. For a `Border` it is `Child`.

```xml
<!-- These three buttons are the same -->
<Button Content="Save" />
<Button>Save</Button>
<Button>
    <Button.Content>Save</Button.Content>
</Button>
```

The content of a `Button` does not have to be text. It can be any object, even a whole layout:

```xml
<Button Padding="10,5">
    <StackPanel Orientation="Horizontal">
        <TextBlock Text="&#x1F4B0;" Margin="0,0,6,0" />
        <TextBlock Text="Add coin" />
    </StackPanel>
</Button>
```

This is one of WPF's superpowers: almost anything can go inside almost anything. `&#x1F4B0;` is the code for a money bag emoji. Writing characters as `&#x...;` codes works anywhere in XAML.

### One child or many

Some elements take **one** child and some take **many**:

- `Window`, `Button`, `Border` take one child. To put several things in a window, you wrap them in a panel.
- Panels like `StackPanel` and `Grid` take many children. Their content property is `Children`, a collection.

```xml
<!-- Error: a Window can only have one child -->
<Window ...>
    <TextBlock Text="One" />
    <TextBlock Text="Two" />
</Window>

<!-- Fix: wrap them in a panel -->
<Window ...>
    <StackPanel>
        <TextBlock Text="One" />
        <TextBlock Text="Two" />
    </StackPanel>
</Window>
```

## Collections

When a property is a list, you add items by just listing them inside. A `ComboBox` is a good example:

```xml
<ComboBox Width="150" SelectedIndex="0">
    <ComboBoxItem Content="Food" />
    <ComboBoxItem Content="Transport" />
    <ComboBoxItem Content="Bills" />
    <ComboBoxItem Content="Fun" />
    <ComboBoxItem Content="Other" />
</ComboBox>
```

WPF adds each `ComboBoxItem` to the `Items` collection. These are the CoinJar categories, and later you will fill this list from data instead of typing items by hand, in [Binding to Collections with ObservableCollection](/courses/wpf/binding-to-collections).

## Special characters

Because XAML is XML, a few characters have special meaning and must be written as **entities** (codes) inside attribute values and text:

```text
<    write  &lt;
>    write  &gt;
&    write  &amp;
"    write  &quot;   (or use single quotes around the value)
```

For example:

```xml
<TextBlock Text="Food &amp; Drink" />
<TextBlock Text="Amount &lt; 100" />
<TextBlock Text='Say "hi"' />
```

## Naming elements with x:Name

Give an element a name with `x:Name` so C# code can use it:

```xml
<TextBox x:Name="TitleBox" />
```

In the code-behind, `TitleBox` is now a field you can read and change. Names must be unique in a window and follow C# naming rules (no spaces, cannot start with a number). The `x:` prefix comes from a namespace you will understand in [XAML Namespaces and Markup Extensions](/courses/wpf/xaml-namespaces-and-markup-extensions).

## Common mistakes

- **Wrong case.** `<textblock>` or `fontsize="12"` fail. Match the C# names exactly.
- **Missing quotes.** `Width=100` is not valid XML.
- **Two children in a one child element.** You get "The property Content is set more than once". Wrap them in a panel.
- **Setting the same property twice.** For example `Content="OK"` and also text between the tags. Pick one.
- **A raw `&` in text.** Write `&amp;` instead.

## Tips

- Indent nested elements by four spaces. It makes the tree shape easy to see.
- Put each attribute on its own line when a tag gets long.
- When you are not sure how to write something in XAML, think "what would the C# look like?" and translate.

## Quick recap

- Each XAML element creates an object, and each attribute sets a property.
- XAML follows XML rules: quoted values, properly nested tags, one root, case sensitive.
- Type converters turn text like `"10,5"` or `"#2E7D32"` into the right types.
- Property element syntax (`Button.Background`) sets a property to a complex object.
- The content property lets you put a value between the tags, and a `Button` can hold any content.
- One child elements need a panel to hold several controls, and collections are filled by listing items.
- Write `&lt;`, `&gt;` and `&amp;` for special characters.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;!-- A XAML playground. Try changing values and running the app. --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="XAML Playground" Width="420" SizeToContent="Height"
        WindowStartupLocation="CenterScreen"&gt;
    &lt;!-- Window has one child, so a StackPanel holds everything --&gt;
    &lt;StackPanel Margin="20"&gt;
        &lt;!-- Attribute syntax: plain text values, turned into the right types --&gt;
        &lt;TextBlock Text="New expense" FontSize="20" FontWeight="Bold"
                   Foreground="#2E7D32" Margin="0,0,0,10" /&gt;
        &lt;!-- Special characters: &amp;amp; becomes &amp; on screen --&gt;
        &lt;TextBlock Text="Title (for example: Food &amp;amp; Drink)" /&gt;
        &lt;TextBox x:Name="TitleBox" Margin="0,4,0,10" /&gt;
        &lt;TextBlock Text="Category" /&gt;
        &lt;!-- Collection syntax: items are listed inside --&gt;
        &lt;ComboBox x:Name="CategoryBox" SelectedIndex="0" Margin="0,4,0,10"&gt;
            &lt;ComboBoxItem Content="Food" /&gt;
            &lt;ComboBoxItem Content="Transport" /&gt;
            &lt;ComboBoxItem Content="Bills" /&gt;
            &lt;ComboBoxItem Content="Fun" /&gt;
            &lt;ComboBoxItem Content="Other" /&gt;
        &lt;/ComboBox&gt;
        &lt;!-- Content property: a whole layout inside a Button --&gt;
        &lt;Button HorizontalAlignment="Left" Padding="12,6"&gt;
            &lt;!-- Property element syntax: a gradient is too complex for one string --&gt;
            &lt;Button.Background&gt;
                &lt;LinearGradientBrush StartPoint="0,0" EndPoint="1,0"&gt;
                    &lt;GradientStop Color="#C8E6C9" Offset="0" /&gt;
                    &lt;GradientStop Color="#81C784" Offset="1" /&gt;
                &lt;/LinearGradientBrush&gt;
            &lt;/Button.Background&gt;
            &lt;StackPanel Orientation="Horizontal"&gt;
                &lt;!-- &amp;#x1F4B0; is a money bag emoji --&gt;
                &lt;TextBlock Text="&amp;#x1F4B0;" Margin="0,0,6,0" /&gt;
                &lt;TextBlock Text="Add coin" FontWeight="SemiBold" /&gt;
            &lt;/StackPanel&gt;
        &lt;/Button&gt;
        &lt;!-- Border takes one child --&gt;
        &lt;Border BorderBrush="Gray" BorderThickness="1" CornerRadius="4"
                Padding="10" Margin="0,16,0,0"&gt;
            &lt;TextBlock TextWrapping="Wrap"&gt;
                Text between the tags works too: a TextBlock shows it as its text.
            &lt;/TextBlock&gt;
        &lt;/Border&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
</code></pre>
