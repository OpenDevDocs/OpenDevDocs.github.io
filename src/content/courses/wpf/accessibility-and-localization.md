---
publishDate: 2026-10-25T20:56
title: 'Accessibility and Localization'
slug: accessibility-and-localization
metadescription: 'Make CoinJar usable with a screen reader and the keyboard using AutomationProperties, then translate it with .resx resource files and the right culture for money and dates.'
updateDate: 2026-10-25T20:56
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'accessibility', 'localization', 'resources']
course: wpf
---

## Two ways to reach more people

This lesson is about two kinds of polish that are easy to forget:

- **Accessibility** (often written **a11y**) means people with disabilities can use your app. Someone who is blind uses a **screen reader**, a program that reads the screen aloud. Someone with a shaky hand uses only the keyboard. Someone with low vision turns on high contrast colours.
- **Localization** (often written **l10n**) means the app speaks the user's language and shows money, numbers and dates the way they expect.

Both start the same way: never assume everyone sees the screen like you do. And both are much cheaper to build in early than to bolt on later.

## How screen readers see a WPF app

A screen reader cannot look at pixels. It asks Windows for a description of the window through **UI Automation**, a Windows API that exposes a tree of elements with a name, a type (button, edit box, list) and a state.

WPF builds that tree for you. Each control has an **automation peer**, a small helper object that describes the control to UI Automation. A `Button` reports "button" plus its text. A `CheckBox` reports "check box, checked". So standard controls with visible text are mostly accessible already.

The gaps are the places where WPF cannot guess a good name:

- a `TextBox` with no text yet,
- an icon only button,
- a list row whose item is a C# object,
- a value that changes somewhere else on the screen.

You fill these gaps with the `AutomationProperties` attached properties.

## Giving elements a name

### Label with Target

The best way to name a `TextBox` is a `Label` with `Target`, which you met in [Keyboard Shortcuts and Focus](/courses/wpf/keyboard-shortcuts-and-focus). It gives sighted users an access key (Alt+T) and also becomes the box's accessible name, so the screen reader says "Title, edit".

```xml
<Label Content="_Title" Target="{Binding ElementName=TitleBox}" />
<TextBox x:Name="TitleBox" Text="{Binding NewTitle, UpdateSourceTrigger=PropertyChanged}" />
```

### AutomationProperties.Name

When there is no visible text, set the name yourself. An icon only button is the classic case. Without a name, the screen reader just says "button", which helps nobody.

```xml
<Button Content="&#xE894;" FontFamily="Segoe MDL2 Assets"
        Command="{Binding ClearCommand}"
        AutomationProperties.Name="Clear the form"
        ToolTip="Clear the form" />
```

The `ToolTip` helps mouse users with the same information.

### Naming list rows

A `ListBox` row is read using its item. If that is an `Expense` object, the screen reader may announce "CoinJar.Models.Expense" for every row. Name the root of the [data template](/courses/wpf/data-templates) instead:

```xml
<DataTemplate>
    <Grid AutomationProperties.Name="{Binding Title}">
        <TextBlock Text="{Binding Title}" />
        <TextBlock Grid.Column="1" Text="{Binding Amount, StringFormat=C}" />
    </Grid>
</DataTemplate>
```

Overriding `ToString()` in the model also helps, because some controls fall back to it.

### More automation properties

| Property | What it adds |
| --- | --- |
| `HelpText` | A longer hint, read after the name ("How much you spent, for example 12.50") |
| `LabeledBy` | Points to another element whose text is the name |
| `IsRequiredForForm` | Says the field must be filled in |
| `HeadingLevel` | Marks a `TextBlock` as a heading, so users can jump between headings |
| `LiveSetting` | Asks the screen reader to announce changes to this element |

```xml
<TextBlock Text="New expense" FontSize="18" AutomationProperties.HeadingLevel="Level1" />
<TextBox x:Name="AmountBox"
         AutomationProperties.HelpText="How much you spent, for example 12.50"
         AutomationProperties.IsRequiredForForm="True" />
```

## Announcing changes

When the user adds an expense, the total at the bottom changes. A sighted user sees it. A screen reader user does not, because their focus is still in the form.

Mark the total as a **live region** with `LiveSetting`. `Polite` means "announce when you are done talking", `Assertive` means "interrupt now". Then raise the `LiveRegionChanged` event when the value changes:

```xml
<TextBlock x:Name="TotalText"
           Text="{Binding Total, StringFormat=Total: {0:C}}"
           AutomationProperties.LiveSetting="Polite" />
```

```csharp
viewModel.PropertyChanged += (_, e) =>
{
    if (e.PropertyName != nameof(ExpenseListViewModel.Total)) return;
    AutomationPeer? peer = UIElementAutomationPeer.FromElement(TotalText)
                           ?? UIElementAutomationPeer.CreatePeerForElement(TotalText);
    peer?.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);
};
```

This is view code, so it belongs in code-behind. The view model just raises `PropertyChanged` as always.

## Keyboard, colour and contrast

Accessibility is not only about screen readers. Check these too:

- **Everything works without a mouse.** Tab reaches every control in a sensible order, Enter and Esc do the obvious thing, and focus is always visible. The previous lesson covered all of this.
- **Do not use colour alone.** CoinJar shows over budget totals in red. Add a word or an icon as well, because many people cannot tell red from green.
- **High contrast.** Windows has contrast themes with very few, strong colours. WPF's built in themes follow them. Your own hard coded colours do not. For custom colours, use the system brushes with `DynamicResource`, so they change when the user switches themes:

```xml
<Border BorderBrush="{DynamicResource {x:Static SystemColors.WindowTextBrushKey}}"
        Background="{DynamicResource {x:Static SystemColors.WindowBrushKey}}" />
```

In code, `SystemParameters.HighContrast` tells you whether a contrast theme is on. The [Light, Dark and Fluent Themes](/courses/wpf/light-dark-and-fluent-themes) lesson shows more about theme resources.

## Testing accessibility

You do not need special hardware to test:

- **Narrator** is built into Windows. Press Ctrl+Win+Enter to turn it on or off, then Tab through your window and listen.
- **Accessibility Insights for Windows** is a free Microsoft tool. It shows the UI Automation tree of any window, and its automated checks find missing names and other common problems.
- **Unplug the mouse** for ten minutes. You will find the gaps quickly.

## Localization: resources instead of strings

Now the second topic. To translate an app, you first move every piece of text people read out of the XAML and C# into **resource files**.

A **.resx file** is an XML file of name and value pairs. You make one per language:

- `Resources/Strings.resx`: the default language (English here).
- `Resources/Strings.de.resx`: German.
- `Resources/Strings.fr.resx`: French, and so on.

The part before `.resx` is a **culture name**: a language (`de`) or a language plus a region (`de-AT` for Austria).

In Visual Studio, add a file with **Add > New Item > Resources File**, name it `Strings.resx`, and open it. The resource editor is a grid of names and values. Set **Access Modifier** at the top to **Public**. Visual Studio then generates `Strings.Designer.cs`, a class with one static property per string, so you can write `Strings.AddButton` in C#. Public means other projects can use the strings too, for example a separate class library for your view models (see [Unit Testing ViewModels](/courses/wpf/unit-testing-viewmodels)).

Under the hood a .resx entry looks like this:

```xml
<data name="AddButton" xml:space="preserve">
  <value>A_dd expense</value>
</data>
<data name="TotalFormat" xml:space="preserve">
  <value>Total: {0:C}</value>
</data>
```

Then add `Strings.de.resx` with the same names and German values. Only the main file needs the Public setting and gets a designer class.

### Using the strings in XAML

Map the namespace and use `{x:Static}`, the markup extension for static properties from [XAML Namespaces and Markup Extensions](/courses/wpf/xaml-namespaces-and-markup-extensions):

```xml
<Window xmlns:res="clr-namespace:CoinJar.Resources"
        Title="{x:Static res:Strings.WindowTitle}">
    <StackPanel>
        <Label Content="{x:Static res:Strings.TitleLabel}" Target="{Binding ElementName=TitleBox}" />
        <TextBox x:Name="TitleBox" />
        <Button Content="{x:Static res:Strings.AddButton}" Command="{Binding AddCommand}" />
        <!-- A format string can come from the resources too -->
        <TextBlock Text="{Binding Total, StringFormat={x:Static res:Strings.TotalFormat}}" />
    </StackPanel>
</Window>
```

Access keys travel with the text. The German "_Titel" keeps its underscore, and translators can move it to a better letter.

### Using the strings in C#

Messages that a view model builds should come from the same place:

```csharp
StatusText = string.Format(Strings.AddedFormat, expense.Title); // "Added {0}" or "{0} hinzugefügt"
```

Use placeholders like `{0}` instead of gluing words together. Word order changes between languages, and a translator can only move a placeholder if it is there.

### How the right language is picked

When you build, each translated file becomes a **satellite assembly**: a small DLL in a folder named after the culture, such as `bin/Debug/net10.0-windows/de/CoinJar.resources.dll`. At run time, .NET looks at `CultureInfo.CurrentUICulture` and loads the matching satellite. If there is none (say, Japanese), it falls back to the default strings in the main assembly.

## Culture: money, numbers and dates

Language is only half of it. The same amount looks different around the world: `$1,234.50` in the US, `1.234,50 €` in Germany, `₹1,234.50` in India. Two settings control this:

- `CultureInfo.CurrentUICulture`: which **language** of resources to load.
- `CultureInfo.CurrentCulture`: how to **format** numbers, dates and money.

Windows sets both from the user's settings, so normally you do nothing. To test a translation, set them yourself at startup:

```csharp
var culture = new CultureInfo("de-DE");
CultureInfo.DefaultThreadCurrentCulture = culture;   // all threads: formatting
CultureInfo.DefaultThreadCurrentUICulture = culture; // all threads: resources
CultureInfo.CurrentCulture = culture;
CultureInfo.CurrentUICulture = culture;
```

### The WPF culture trap

Here is a surprise. WPF bindings do **not** use `CurrentCulture`. They use the `Language` property of the element, which is `en-US` unless you change it. So `StringFormat=C` shows dollars, even on a German PC.

The fix is one call, early in the `App` constructor, before any window exists:

```csharp
FrameworkElement.LanguageProperty.OverrideMetadata(
    typeof(FrameworkElement),
    new FrameworkPropertyMetadata(XmlLanguage.GetLanguage(CultureInfo.CurrentCulture.IetfLanguageTag)));
```

It changes the default `Language` of every element to the user's culture. Every CoinJar lesson that formats money with `StringFormat=C` relies on this being in place, and the final app in [Building a Complete Expense Tracker](/courses/wpf/building-a-complete-expense-tracker) has it.

Parsing goes through the same rules. When the user types an amount, parse it with `CultureInfo.CurrentCulture`, so a German user can type `12,50`. When you write a file, use `CultureInfo.InvariantCulture`, so the file reads the same on every PC (the CSV import in [Drag and Drop](/courses/wpf/drag-and-drop) does this).

### Right to left languages

Arabic and Hebrew read from right to left. Set `FlowDirection="RightToLeft"` on the window and WPF mirrors the whole layout: columns swap sides, text aligns right. You can bind it to a resource string so the translation decides.

## Common mistakes

- **Text in XAML attributes.** Every `Content="Save"` is a string a translator will never see. Search your XAML for quotes before you ship.
- **No designer file.** The `Strings` class is generated by the resource editor in Visual Studio (Rider does the same). If `Strings` is unknown, open the .resx file and check its access modifier and custom tool settings.
- **Money shows in dollars.** You forgot the `LanguageProperty.OverrideMetadata` call, or it runs after the first window was created.
- **Changing the language while running.** `{x:Static}` reads a string once. To switch languages, save the choice in user settings (see [App Settings and Configuration](/courses/wpf/app-settings-and-configuration)) and apply it at the next start.
- **Concatenated sentences.** `"Added " + title` cannot be translated well. Use a format string with a placeholder.
- **Images with text inside.** A picture of the word "Save" cannot be translated or read aloud.

## Quick recap

- Screen readers use UI Automation. Standard controls describe themselves, and `AutomationProperties` fill the gaps.
- Name text boxes with `Label` and `Target`. Name icon buttons and list rows with `AutomationProperties.Name`.
- `HelpText`, `HeadingLevel`, `IsRequiredForForm` and `LiveSetting` add more meaning.
- Test with Narrator, Accessibility Insights and the keyboard alone. Do not use colour as the only signal.
- Put all user facing text in `Strings.resx`, set it to Public, and add `Strings.de.resx` and friends for each language.
- Use `{x:Static res:Strings.Name}` in XAML and `Strings.Name` in C#, with `{0}` placeholders.
- `CurrentUICulture` picks the language, `CurrentCulture` the formats, and WPF needs the `Language` override to follow it.

<code id="code-content" class="language-xml">
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:res="clr-namespace:CoinJar.Resources"
        Title="{x:Static res:Strings.WindowTitle}" Width="640" Height="420"
        FocusManager.FocusedElement="{Binding ElementName=TitleBox}"&gt;
    &lt;Grid Margin="16"&gt;
        &lt;Grid.ColumnDefinitions&gt;
            &lt;ColumnDefinition Width="260" /&gt;
            &lt;ColumnDefinition Width="16" /&gt;
            &lt;ColumnDefinition Width="*" /&gt;
        &lt;/Grid.ColumnDefinitions&gt;
        &lt;StackPanel&gt;
            &lt;!-- A heading: screen reader users can jump between headings --&gt;
            &lt;TextBlock Text="{x:Static res:Strings.Heading}" FontSize="18" FontWeight="SemiBold"
                       AutomationProperties.HeadingLevel="Level1" /&gt;
            &lt;!-- Label + Target: Alt+T works, and the label becomes the box's accessible name --&gt;
            &lt;Label Content="{x:Static res:Strings.TitleLabel}" Target="{Binding ElementName=TitleBox}" Padding="0,8,0,4" /&gt;
            &lt;TextBox x:Name="TitleBox" Text="{Binding NewTitle, UpdateSourceTrigger=PropertyChanged}"
                     AutomationProperties.IsRequiredForForm="True" /&gt;
            &lt;Label Content="{x:Static res:Strings.AmountLabel}" Target="{Binding ElementName=AmountBox}" Padding="0,8,0,4" /&gt;
            &lt;TextBox x:Name="AmountBox" Text="{Binding NewAmountText, UpdateSourceTrigger=PropertyChanged}"
                     AutomationProperties.HelpText="{x:Static res:Strings.AmountHelp}"
                     AutomationProperties.IsRequiredForForm="True" /&gt;
            &lt;Label Content="{x:Static res:Strings.CategoryLabel}" Target="{Binding ElementName=CategoryBox}" Padding="0,8,0,4" /&gt;
            &lt;ComboBox x:Name="CategoryBox" ItemsSource="{Binding Categories}" SelectedItem="{Binding NewCategory}" /&gt;
            &lt;Button Content="{x:Static res:Strings.AddButton}" Command="{Binding AddCommand}" IsDefault="True"
                    HorizontalAlignment="Left" Margin="0,16,0,0" Padding="12,4" /&gt;
            &lt;!-- An icon only button needs a name, or a screen reader just says "button" --&gt;
            &lt;Button Content="&amp;#xE894;" FontFamily="Segoe MDL2 Assets" Command="{Binding ClearCommand}"
                    HorizontalAlignment="Left" Margin="0,8,0,0" Padding="8,4"
                    AutomationProperties.Name="{x:Static res:Strings.ClearForm}"
                    ToolTip="{x:Static res:Strings.ClearForm}" /&gt;
            &lt;!-- The total is announced when it changes, without moving focus --&gt;
            &lt;TextBlock x:Name="TotalText" Margin="0,16,0,0" FontSize="18"
                       Text="{Binding Total, StringFormat={x:Static res:Strings.TotalFormat}}"
                       AutomationProperties.LiveSetting="Polite" /&gt;
            &lt;TextBlock Text="{Binding StatusText}" Opacity="0.8" /&gt;
        &lt;/StackPanel&gt;
        &lt;ListBox Grid.Column="2" ItemsSource="{Binding Expenses}" HorizontalContentAlignment="Stretch"
                 AutomationProperties.Name="{x:Static res:Strings.ExpensesName}"&gt;
            &lt;ListBox.ItemTemplate&gt;
                &lt;DataTemplate&gt;
                    &lt;!-- Give each row a useful name, not "CoinJar.Models.Expense" --&gt;
                    &lt;Grid AutomationProperties.Name="{Binding Title}"&gt;
                        &lt;Grid.ColumnDefinitions&gt;
                            &lt;ColumnDefinition Width="*" /&gt;
                            &lt;ColumnDefinition Width="Auto" /&gt;
                        &lt;/Grid.ColumnDefinitions&gt;
                        &lt;TextBlock Text="{Binding Title}" /&gt;
                        &lt;TextBlock Grid.Column="1" Text="{Binding Amount, StringFormat=C}" /&gt;
                    &lt;/Grid&gt;
                &lt;/DataTemplate&gt;
            &lt;/ListBox.ItemTemplate&gt;
        &lt;/ListBox&gt;
    &lt;/Grid&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.ComponentModel;
using System.Windows;
using System.Windows.Automation.Peers;
using CoinJar.ViewModels;
namespace CoinJar;
public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var viewModel = new ExpenseListViewModel();
        DataContext = viewModel;
        // Tell screen readers that the live total changed.
        viewModel.PropertyChanged += (_, e) =&gt;
        {
            if (e.PropertyName != nameof(ExpenseListViewModel.Total)) return;
            AutomationPeer? peer = UIElementAutomationPeer.FromElement(TotalText)
                                   ?? UIElementAutomationPeer.CreatePeerForElement(TotalText);
            peer?.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);
        };
    }
}
// App.xaml.cs
using System.Globalization;
using System.Windows;
using System.Windows.Markup;
namespace CoinJar;
public partial class App : Application
{
    public App()
    {
        // To test a translation, uncomment these lines. Normally Windows decides.
        // var culture = new CultureInfo("de-DE");
        // CultureInfo.DefaultThreadCurrentCulture = culture;   // numbers, dates, money
        // CultureInfo.DefaultThreadCurrentUICulture = culture; // which .resx strings
        // CultureInfo.CurrentCulture = culture;
        // CultureInfo.CurrentUICulture = culture;
        // WPF bindings format with en-US unless you say otherwise. This makes
        // StringFormat=C and dates follow the user's culture everywhere.
        FrameworkElement.LanguageProperty.OverrideMetadata(
            typeof(FrameworkElement),
            new FrameworkPropertyMetadata(XmlLanguage.GetLanguage(CultureInfo.CurrentCulture.IetfLanguageTag)));
    }
}
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using System.Globalization;
using CoinJar.Models;
using CoinJar.Resources;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
namespace CoinJar.ViewModels;
public partial class ExpenseListViewModel : ObservableObject
{
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = [];
    public string[] Categories { get; } = ["Food", "Transport", "Bills", "Fun", "Other"];
    public decimal Total =&gt; Expenses.Sum(e =&gt; e.Amount);
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(AddCommand))]
    public partial string NewTitle { get; set; } = "";
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(AddCommand))]
    public partial string NewAmountText { get; set; } = "";
    [ObservableProperty]
    public partial string NewCategory { get; set; } = "Food";
    [ObservableProperty]
    public partial string StatusText { get; set; } = "";
    // CurrentCulture: "12.50" in the US, "12,50" in Germany.
    private bool TryGetAmount(out decimal amount) =&gt;
        decimal.TryParse(NewAmountText, NumberStyles.Number, CultureInfo.CurrentCulture, out amount)
        &amp;&amp; amount &gt; 0;
    private bool CanAdd() =&gt; !string.IsNullOrWhiteSpace(NewTitle) &amp;&amp; TryGetAmount(out _);
    [RelayCommand(CanExecute = nameof(CanAdd))]
    private void Add()
    {
        if (!TryGetAmount(out decimal amount)) return;
        Expenses.Add(new Expense { Title = NewTitle.Trim(), Amount = amount, Category = NewCategory });
        OnPropertyChanged(nameof(Total));
        // Text for people comes from the resources, never from a hard coded string.
        StatusText = string.Format(Strings.AddedFormat, NewTitle.Trim());
        Clear();
    }
    [RelayCommand]
    private void Clear()
    {
        NewTitle = "";
        NewAmountText = "";
    }
}
</code></pre>

