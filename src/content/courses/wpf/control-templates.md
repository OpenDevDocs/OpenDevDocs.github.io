---
publishDate: 2026-10-25T20:33
title: 'Control Templates'
slug: control-templates
metadescription: 'Redesign WPF controls with ControlTemplate: TemplateBinding, ContentPresenter, template triggers, named PART_ elements, and rounded CoinJar buttons and category chips.'
updateDate: 2026-10-25T20:33
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'xaml', 'templates', 'styling']
course: wpf
---

## Behaviour and looks are separate in WPF

In most older UI toolkits, a button **is** a grey rectangle. If you want a round button, you build a new control.

WPF splits a control into two parts:

- **behaviour**: what it does. A `Button` can be clicked, raises `Click`, has `IsPressed`, can take keyboard focus.
- **looks**: what it draws. This is its **control template**, a little tree of elements that draws the control.

A **control template** (`ControlTemplate`) is a recipe that says "to draw this control, build these elements". Swap the recipe and the control looks completely different but still behaves exactly the same. A good comparison is a phone case: change the case and it looks new, but it is still the same phone inside.

Styles from [Styles and Setters](/courses/wpf/styles-and-setters) can only change properties the control offers. Templates go further: you decide every element that is drawn.

## Seeing a control's template

Remember the visual tree from [Logical and Visual Trees](/courses/wpf/logical-and-visual-trees). A plain `Button` in XAML is one element, but in the visual tree it expands to roughly this:

```text
Button
  Border           (background, border, rounded corners)
    ContentPresenter   (shows whatever you put in Content)
      TextBlock        ("Save")
```

The `Border` and `ContentPresenter` come from the button's default template. You never wrote them, they come from the Windows theme.

To see the full default template in Visual Studio: select the control in the designer or in the Document Outline, right click, then choose **Edit Template**, then **Edit a Copy**. Visual Studio writes a copy of the whole style and template into your resources. It is long, but a great way to learn, and a safe starting point for changes.

## Your first template: a rounded button

Set the `Template` property to a `ControlTemplate`. The `TargetType` works like it does for styles:

```xml
<Button Content="Save" Padding="14,6">
    <Button.Template>
        <ControlTemplate TargetType="Button">
            <Border Background="#2E7D32" CornerRadius="16" Padding="{TemplateBinding Padding}">
                <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center" />
            </Border>
        </ControlTemplate>
    </Button.Template>
</Button>
```

That is a complete, working button with rounded corners. It still raises `Click`, still responds to the keyboard, and can still take a command later.

Two new pieces appeared:

- `ContentPresenter` is a placeholder that says "put the button's `Content` here". Without it, your button would show no text at all.
- `{TemplateBinding Padding}` reads the `Padding` set on the button and uses it inside the template.

## TemplateBinding: let the control's properties flow in

The template above hard codes the green colour. A better template lets each button choose its own colours through normal properties. **TemplateBinding** connects a property inside the template to a property of the control that uses the template (the **templated parent**):

```xml
<ControlTemplate TargetType="Button">
    <Border Background="{TemplateBinding Background}"
            BorderBrush="{TemplateBinding BorderBrush}"
            BorderThickness="{TemplateBinding BorderThickness}"
            Padding="{TemplateBinding Padding}"
            CornerRadius="16">
        <ContentPresenter HorizontalAlignment="{TemplateBinding HorizontalContentAlignment}"
                          VerticalAlignment="{TemplateBinding VerticalContentAlignment}"
                          RecognizesAccessKey="True" />
    </Border>
</ControlTemplate>
```

Now `Background="Teal"` on the button really changes its colour. If you forget a `TemplateBinding`, the matching property on the control silently stops working, which is confusing for anyone using your template.

`RecognizesAccessKey="True"` keeps access keys working, so `Content="_Save"` still means Alt+S.

### TemplateBinding versus a normal binding

`TemplateBinding` is a light, fast, **one way** binding. It does not support converters or two way updates, and it is not a full binding. When you need those, write the long form, which does the same lookup:

```xml
<Border Background="{Binding Background, RelativeSource={RelativeSource TemplatedParent}}" />
```

## Putting the template in a style

You rarely set `Template` on a single element. Instead, set it with a setter in a style, so every button using the style gets the new look. The style supplies the default colours, and the template uses them:

```xml
<Style x:Key="PillButton" TargetType="Button">
    <Setter Property="Background" Value="#2E7D32" />
    <Setter Property="Foreground" Value="White" />
    <Setter Property="Padding" Value="16,6" />
    <Setter Property="Cursor" Value="Hand" />
    <Setter Property="Template">
        <Setter.Value>
            <ControlTemplate TargetType="Button">
                <Border x:Name="Root"
                        Background="{TemplateBinding Background}"
                        Padding="{TemplateBinding Padding}"
                        CornerRadius="16">
                    <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"
                                      RecognizesAccessKey="True" />
                </Border>
            </ControlTemplate>
        </Setter.Value>
    </Setter>
</Style>
```

Notice that `Foreground` is not used inside the template at all, yet the text is white. Text properties such as `Foreground`, `FontSize` and `FontWeight` are **inherited** down the tree, so the `TextBlock` inside the `ContentPresenter` picks them up from the button automatically.

## Template triggers: hover, pressed and disabled

A new template throws away all the old visual feedback. There is no hover colour, no pressed look, and a disabled button looks just like an enabled one. You add these back with `ControlTemplate.Triggers`. Inside a template, triggers can use `TargetName` to change a named element:

```xml
<ControlTemplate.Triggers>
    <Trigger Property="IsMouseOver" Value="True">
        <Setter TargetName="Root" Property="Background" Value="#388E3C" />
    </Trigger>
    <Trigger Property="IsPressed" Value="True">
        <Setter TargetName="Root" Property="Background" Value="#1B5E20" />
    </Trigger>
    <Trigger Property="IsEnabled" Value="False">
        <Setter TargetName="Root" Property="Opacity" Value="0.5" />
    </Trigger>
</ControlTemplate.Triggers>
```

`IsPressed` is written after `IsMouseOver`, so when both are true (you are pressing while hovering) the pressed colour wins. You learned the trigger kinds in [Triggers](/courses/wpf/triggers). The same rules apply here.

### Keep keyboard users in mind

People who use the keyboard need to see which control has focus. WPF draws a dotted **focus visual** around a focused control by default, and it still works with a custom template. If you turn it off with `FocusVisualStyle="{x:Null}"`, add your own focus look with an `IsKeyboardFocused` trigger. More in [Keyboard Shortcuts and Focus](/courses/wpf/keyboard-shortcuts-and-focus).

## A category chip with ToggleButton

CoinJar filters by category. A row of "chips" that can be switched on and off fits perfectly. A `ToggleButton` already has the behaviour (`IsChecked` flips on each click), so we only give it a new look:

```xml
<Style x:Key="Chip" TargetType="ToggleButton">
    <Setter Property="Margin" Value="0,0,6,0" />
    <Setter Property="Padding" Value="12,4" />
    <Setter Property="Foreground" Value="#374151" />
    <Setter Property="Template">
        <Setter.Value>
            <ControlTemplate TargetType="ToggleButton">
                <Border x:Name="Root" Background="White" BorderBrush="#D1D5DB"
                        BorderThickness="1" CornerRadius="12" Padding="{TemplateBinding Padding}">
                    <ContentPresenter />
                </Border>
                <ControlTemplate.Triggers>
                    <Trigger Property="IsChecked" Value="True">
                        <Setter TargetName="Root" Property="Background" Value="#E8F5E9" />
                        <Setter TargetName="Root" Property="BorderBrush" Value="#2E7D32" />
                        <Setter Property="Foreground" Value="#1B5E20" />
                    </Trigger>
                </ControlTemplate.Triggers>
            </ControlTemplate>
        </Setter.Value>
    </Setter>
</Style>
```

```xml
<ToggleButton Content="Food" Style="{StaticResource Chip}" IsChecked="{Binding ShowFood}" />
```

A setter without `TargetName` inside a template trigger (the `Foreground` one) changes the control itself.

## Named parts: PART_ elements

Some controls need certain elements in their template to work. A `TextBox` needs somewhere to put the editable text. By convention, these required elements have names that start with `PART_`, and the control looks them up by name when the template is applied.

For `TextBox` the part is `PART_ContentHost`, usually a `ScrollViewer`:

```xml
<ControlTemplate TargetType="TextBox">
    <Border Background="White" BorderBrush="#D1D5DB" BorderThickness="1"
            CornerRadius="6" Padding="6,4">
        <ScrollViewer x:Name="PART_ContentHost" />
    </Border>
</ControlTemplate>
```

Leave out `PART_ContentHost` and the text box shows nothing and cannot be typed in. Other examples are `PART_Track` in a `ScrollBar` and `Slider`, and `PART_Popup` in a `ComboBox`. The control's documentation lists its parts, and the Visual Studio "Edit a Copy" output shows them too.

## Templates for lists: ItemsPresenter

An `ItemsControl` such as `ListBox` needs an `ItemsPresenter` in its template. It marks where the items go, just like `ContentPresenter` marks where content goes:

```xml
<ControlTemplate TargetType="ListBox">
    <Border Background="White" CornerRadius="8" Padding="4">
        <ScrollViewer>
            <ItemsPresenter />
        </ScrollViewer>
    </Border>
</ControlTemplate>
```

## Control template or data template?

They sound alike, so here is the difference:

| | `ControlTemplate` | `DataTemplate` |
| --- | --- | --- |
| Describes | how a **control** looks | how a piece of **data** looks |
| Set on | `Template` | `ContentTemplate`, `ItemTemplate`, `CellTemplate` |
| Example | a round button | how one `Expense` appears in a list |
| Placeholder inside | `ContentPresenter`, `ItemsPresenter` | none needed |

A `ListBox` can use both at once: a control template for the box around the list, and a [data template](/courses/wpf/data-templates) for each expense inside.

## Tips and common mistakes

- **Start from a copy.** "Edit a Copy" in Visual Studio gives you a complete, correct template to trim down.
- **No text shows.** You forgot the `ContentPresenter`.
- **Background or Padding on the control does nothing.** The template does not `TemplateBinding` that property.
- **No hover or disabled look.** A new template has none until you add template triggers.
- **A TextBox you cannot type in.** The `PART_ContentHost` element is missing or misspelled.
- **Clicks only work on the text.** A `Border` with no `Background` is not hit testable in its empty areas. Set `Background="Transparent"` at least.
- **Custom templates and themes.** Your template replaces whatever the current theme draws, including the Fluent theme you will meet in [Light, Dark and Fluent Themes](/courses/wpf/light-dark-and-fluent-themes). Use `DynamicResource` brushes in templates if they must follow light and dark modes.

## Quick recap

- A control template defines how a control is drawn. Its behaviour stays the same.
- `ContentPresenter` shows a control's content. `ItemsPresenter` shows a list's items.
- `TemplateBinding` passes the control's own properties (Background, Padding) into the template. Use `RelativeSource TemplatedParent` for two way bindings or converters.
- Set templates through a style setter so many controls share them.
- Add hover, pressed, disabled and focus feedback with `ControlTemplate.Triggers` and `TargetName`.
- Some controls need named `PART_` elements, such as `PART_ContentHost` in a `TextBox`.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="CoinJar" Height="300" Width="520" Background="#F3F5F7"&gt;
    &lt;Window.Resources&gt;
        &lt;!-- A pill shaped button. The style gives defaults, the template draws. --&gt;
        &lt;Style x:Key="PillButton" TargetType="Button"&gt;
            &lt;Setter Property="Background" Value="#2E7D32" /&gt;
            &lt;Setter Property="Foreground" Value="White" /&gt;
            &lt;Setter Property="FontWeight" Value="SemiBold" /&gt;
            &lt;Setter Property="Padding" Value="16,6" /&gt;
            &lt;Setter Property="Margin" Value="0,0,8,0" /&gt;
            &lt;Setter Property="Cursor" Value="Hand" /&gt;
            &lt;Setter Property="Template"&gt;
                &lt;Setter.Value&gt;
                    &lt;ControlTemplate TargetType="Button"&gt;
                        &lt;Border x:Name="Root"
                                Background="{TemplateBinding Background}"
                                BorderBrush="{TemplateBinding BorderBrush}"
                                BorderThickness="{TemplateBinding BorderThickness}"
                                Padding="{TemplateBinding Padding}"
                                CornerRadius="16"&gt;
                            &lt;ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"
                                              RecognizesAccessKey="True" /&gt;
                        &lt;/Border&gt;
                        &lt;!-- A new template has no feedback until we add it --&gt;
                        &lt;ControlTemplate.Triggers&gt;
                            &lt;Trigger Property="IsMouseOver" Value="True"&gt;
                                &lt;Setter TargetName="Root" Property="Opacity" Value="0.88" /&gt;
                            &lt;/Trigger&gt;
                            &lt;Trigger Property="IsPressed" Value="True"&gt;
                                &lt;Setter TargetName="Root" Property="Opacity" Value="0.7" /&gt;
                            &lt;/Trigger&gt;
                            &lt;Trigger Property="IsEnabled" Value="False"&gt;
                                &lt;Setter TargetName="Root" Property="Opacity" Value="0.4" /&gt;
                            &lt;/Trigger&gt;
                        &lt;/ControlTemplate.Triggers&gt;
                    &lt;/ControlTemplate&gt;
                &lt;/Setter.Value&gt;
            &lt;/Setter&gt;
        &lt;/Style&gt;
        &lt;!-- A category chip: ToggleButton behaviour, new look --&gt;
        &lt;Style x:Key="Chip" TargetType="ToggleButton"&gt;
            &lt;Setter Property="Margin" Value="0,0,6,0" /&gt;
            &lt;Setter Property="Padding" Value="12,4" /&gt;
            &lt;Setter Property="Foreground" Value="#374151" /&gt;
            &lt;Setter Property="Cursor" Value="Hand" /&gt;
            &lt;Setter Property="Template"&gt;
                &lt;Setter.Value&gt;
                    &lt;ControlTemplate TargetType="ToggleButton"&gt;
                        &lt;Border x:Name="Root" Background="White" BorderBrush="#D1D5DB"
                                BorderThickness="1" CornerRadius="12"
                                Padding="{TemplateBinding Padding}"&gt;
                            &lt;ContentPresenter /&gt;
                        &lt;/Border&gt;
                        &lt;ControlTemplate.Triggers&gt;
                            &lt;Trigger Property="IsMouseOver" Value="True"&gt;
                                &lt;Setter TargetName="Root" Property="BorderBrush" Value="#9CA3AF" /&gt;
                            &lt;/Trigger&gt;
                            &lt;Trigger Property="IsChecked" Value="True"&gt;
                                &lt;Setter TargetName="Root" Property="Background" Value="#E8F5E9" /&gt;
                                &lt;Setter TargetName="Root" Property="BorderBrush" Value="#2E7D32" /&gt;
                                &lt;Setter Property="Foreground" Value="#1B5E20" /&gt;
                            &lt;/Trigger&gt;
                        &lt;/ControlTemplate.Triggers&gt;
                    &lt;/ControlTemplate&gt;
                &lt;/Setter.Value&gt;
            &lt;/Setter&gt;
        &lt;/Style&gt;
        &lt;!-- A rounded TextBox. PART_ContentHost is required. --&gt;
        &lt;Style x:Key="RoundedTextBox" TargetType="TextBox"&gt;
            &lt;Setter Property="Padding" Value="8,5" /&gt;
            &lt;Setter Property="Template"&gt;
                &lt;Setter.Value&gt;
                    &lt;ControlTemplate TargetType="TextBox"&gt;
                        &lt;Border x:Name="Root" Background="White" BorderBrush="#D1D5DB"
                                BorderThickness="1" CornerRadius="6"
                                Padding="{TemplateBinding Padding}"&gt;
                            &lt;ScrollViewer x:Name="PART_ContentHost" /&gt;
                        &lt;/Border&gt;
                        &lt;ControlTemplate.Triggers&gt;
                            &lt;Trigger Property="IsKeyboardFocused" Value="True"&gt;
                                &lt;Setter TargetName="Root" Property="BorderBrush" Value="#2E7D32" /&gt;
                            &lt;/Trigger&gt;
                        &lt;/ControlTemplate.Triggers&gt;
                    &lt;/ControlTemplate&gt;
                &lt;/Setter.Value&gt;
            &lt;/Setter&gt;
        &lt;/Style&gt;
    &lt;/Window.Resources&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;TextBlock Text="Filter by category" Foreground="#6B7280" Margin="0,0,0,6" /&gt;
        &lt;StackPanel Orientation="Horizontal" Margin="0,0,0,16"&gt;
            &lt;ToggleButton Content="Food" Style="{StaticResource Chip}" IsChecked="True" /&gt;
            &lt;ToggleButton Content="Transport" Style="{StaticResource Chip}" /&gt;
            &lt;ToggleButton Content="Bills" Style="{StaticResource Chip}" /&gt;
            &lt;ToggleButton Content="Fun" Style="{StaticResource Chip}" /&gt;
            &lt;ToggleButton Content="Other" Style="{StaticResource Chip}" /&gt;
        &lt;/StackPanel&gt;
        &lt;TextBlock Text="Title" Foreground="#6B7280" /&gt;
        &lt;TextBox Style="{StaticResource RoundedTextBox}" Text="Groceries" Margin="0,2,0,16" /&gt;
        &lt;StackPanel Orientation="Horizontal"&gt;
            &lt;!-- The access key _S still works thanks to RecognizesAccessKey --&gt;
            &lt;Button Content="_Save" Style="{StaticResource PillButton}" /&gt;
            &lt;!-- Same template, different colours through TemplateBinding --&gt;
            &lt;Button Content="Delete" Style="{StaticResource PillButton}" Background="#C62828" /&gt;
            &lt;Button Content="Disabled" Style="{StaticResource PillButton}" IsEnabled="False" /&gt;
        &lt;/StackPanel&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
</code></pre>
