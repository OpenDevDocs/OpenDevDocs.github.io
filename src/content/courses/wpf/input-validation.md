---
publishDate: 2026-10-25T20:29
title: 'Input Validation'
slug: input-validation
metadescription: 'Validate the CoinJar expense form with ValidationRule, IDataErrorInfo and INotifyDataErrorInfo, and show friendly messages with a custom Validation.ErrorTemplate.'
updateDate: 2026-10-25T20:29
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'validation', 'data-binding', 'forms']
course: wpf
---

## Why validation matters

The CoinJar "add expense" form has three boxes: title, amount and date. Users will type anything:

- an empty title
- "twelve" in the amount box
- a negative amount, or a million
- a date next year

**Validation** means checking input and telling the user, clearly and politely, what is wrong before the data is saved. WPF has validation built into data binding, so you do not have to check every text box by hand in a click handler.

In this lesson you will meet three ways to validate, from simplest to most flexible, and then learn how to make the error messages look good.

| Approach | Where the rules live | Use it for |
| --- | --- | --- |
| `ValidationRule` | a small class attached to one binding | format checks such as "is this a number?" |
| `IDataErrorInfo` | your data class | older code, simple cases |
| `INotifyDataErrorInfo` | your data class | the recommended choice for new apps |

## What you get for free

Even with no validation code at all, WPF protects you from one kind of mistake. Bind a `TextBox` to a `decimal` property and type "abc":

```xml
<TextBox Text="{Binding Amount, UpdateSourceTrigger=PropertyChanged}" />
```

The text cannot be converted to a `decimal`, so the binding refuses to update the property and draws a red border around the box. That red border is the default **error template**. The problem is that the user gets no message, and your class never hears about it.

## Approach 1: ValidationRule

A **validation rule** is a class that inherits from `ValidationRule` and overrides one method, `Validate`. It returns `ValidationResult.ValidResult` when the value is fine, or a new `ValidationResult(false, message)` when it is not.

```csharp
using System.Globalization;
using System.Windows.Controls;

namespace CoinJar.Rules;

public class AmountRule : ValidationRule
{
    public decimal Max { get; set; } = 10_000m;

    public override ValidationResult Validate(object value, CultureInfo cultureInfo)
    {
        string text = value as string ?? "";

        if (!decimal.TryParse(text, NumberStyles.Number, cultureInfo, out decimal amount))
            return new ValidationResult(false, "Please type a number, like 12.50.");

        if (amount <= 0)
            return new ValidationResult(false, "The amount must be more than zero.");

        if (amount > Max)
            return new ValidationResult(false, $"That is a lot! The limit is {Max:N0}.");

        return ValidationResult.ValidResult;
    }
}
```

Attach it to a binding with the long form of the binding syntax:

```xml
<TextBox>
    <TextBox.Text>
        <Binding Path="Amount" UpdateSourceTrigger="PropertyChanged">
            <Binding.ValidationRules>
                <v:AmountRule Max="5000" />
            </Binding.ValidationRules>
        </Binding>
    </TextBox.Text>
</TextBox>
```

Here `v` is an XML namespace prefix for `CoinJar.Rules`, declared on the window as `xmlns:v="clr-namespace:CoinJar.Rules"` (see [XAML Namespaces and Markup Extensions](/courses/wpf/xaml-namespaces-and-markup-extensions)).

### When the rule runs

By default a rule runs on the **raw text**, before WPF converts it to a `decimal`. That is why `value` arrives as a `string`, and why a rule is the best place to catch "abc" with a friendly message. You can change the moment with the `ValidationStep` property (`RawProposedValue`, `ConvertedProposedValue`, `UpdatedValue` or `CommittedValue`).

### Strengths and limits

Rules are reusable and great for format checks. But they live in the XAML, so:

- rules that depend on other fields ("end date after start date") are awkward
- your C# class cannot ask "is the form valid?"
- you cannot unit test the form logic without the window

So for real rules about your data, put the checks in the data class itself.

## Approach 2: IDataErrorInfo (the older way)

`IDataErrorInfo` is an [interface](/courses/c-sharp/interfaces) from the early days of .NET. Your class implements an indexer that returns an error message for a property name, or an empty string if all is well:

```csharp
public class ExpenseForm : IDataErrorInfo
{
    public string Title { get; set; } = "";

    public string Error => "";

    public string this[string columnName] => columnName switch
    {
        nameof(Title) when string.IsNullOrWhiteSpace(Title) => "Title is required.",
        _ => ""
    };
}
```

Then switch it on in the binding:

```xml
<TextBox Text="{Binding Title, ValidatesOnDataErrors=True, UpdateSourceTrigger=PropertyChanged}" />
```

It works, and you will see it in many older tutorials. Its weak points are that a property can have only **one** error at a time, and the binding only asks for errors when that property changes. If changing one field makes another field invalid, WPF does not notice. That is why the newer interface exists.

## Approach 3: INotifyDataErrorInfo (recommended)

`INotifyDataErrorInfo` (namespace `System.ComponentModel`) has three members:

```csharp
public interface INotifyDataErrorInfo
{
    bool HasErrors { get; }
    IEnumerable GetErrors(string? propertyName);
    event EventHandler<DataErrorsChangedEventArgs>? ErrorsChanged;
}
```

- `HasErrors` says whether anything is wrong at all. Perfect for disabling a Save button.
- `GetErrors` returns **a list** of errors for one property, so a property can have several.
- `ErrorsChanged` is an [event](/courses/c-sharp/events) you raise whenever a property's errors change. WPF listens and updates the screen. Because you raise it, you can mark any property as invalid at any moment, even one the user did not touch.

You do not need anything special in the XAML. Bindings listen for this interface automatically, since `ValidatesOnNotifyDataErrors` is `True` by default:

```xml
<TextBox Text="{Binding Title, UpdateSourceTrigger=PropertyChanged}" />
```

### A small error store

The usual way to implement it is a dictionary from property name to a list of messages (see [Dictionary](/courses/c-sharp/dictionary-tkey-tvalue)):

```csharp
private readonly Dictionary<string, List<string>> _errors = new();

public bool HasErrors => _errors.Count > 0;

public IEnumerable GetErrors(string? propertyName)
    => propertyName != null && _errors.TryGetValue(propertyName, out var list)
        ? list
        : Array.Empty<string>();

public event EventHandler<DataErrorsChangedEventArgs>? ErrorsChanged;

private void SetErrors(string propertyName, List<string> errors)
{
    if (errors.Count == 0) _errors.Remove(propertyName);
    else _errors[propertyName] = errors;

    ErrorsChanged?.Invoke(this, new DataErrorsChangedEventArgs(propertyName));
    OnPropertyChanged(nameof(HasErrors));
}
```

### Validating in the property setters

Each setter stores the value, raises `PropertyChanged` as in [INotifyPropertyChanged](/courses/wpf/inotifypropertychanged), then checks the value:

```csharp
public string Title
{
    get => _title;
    set
    {
        _title = value;
        OnPropertyChanged();
        ValidateTitle();
    }
}

private void ValidateTitle()
{
    var errors = new List<string>();
    if (string.IsNullOrWhiteSpace(Title)) errors.Add("Title is required.");
    if (Title.Length > 40) errors.Add("Keep the title under 40 characters.");
    SetErrors(nameof(Title), errors);
}
```

Before saving, run every check once with a `ValidateAll()` method. That catches fields the user never touched, such as an empty title on a brand new form.

### Combining with a ValidationRule

The class only sees values that converted successfully. If the user types "abc" into the amount box, the `decimal` setter is never called. A neat combination is:

- an `AmountRule` (or the built in conversion error) on the binding for the **format**
- `INotifyDataErrorInfo` in the class for the **business rules** (more than zero, not in the future)

Both kinds of error show up in the same place on screen.

## Showing errors nicely: Validation.ErrorTemplate

Every error, whatever its source, ends up in the attached property `Validation.Errors` on the control, and `Validation.HasError` becomes `True`. The red border is drawn by the control's `Validation.ErrorTemplate`. You can replace it with your own `ControlTemplate`:

```xml
<Validation.ErrorTemplate>
    <ControlTemplate>
        <StackPanel>
            <!-- The placeholder stands for the TextBox itself -->
            <Border BorderBrush="#D93025" BorderThickness="1" CornerRadius="2">
                <AdornedElementPlaceholder />
            </Border>
            <!-- DataContext here is the list of errors -->
            <ItemsControl ItemsSource="{Binding}">
                <ItemsControl.ItemTemplate>
                    <DataTemplate>
                        <TextBlock Text="{Binding ErrorContent}" Foreground="#D93025" FontSize="11" />
                    </DataTemplate>
                </ItemsControl.ItemTemplate>
            </ItemsControl>
        </StackPanel>
    </ControlTemplate>
</Validation.ErrorTemplate>
```

A few words on how this works:

- The template is drawn in the **adorner layer**, a see through layer that floats above the window. An **adorner** is a decoration drawn on top of an element.
- `AdornedElementPlaceholder` marks where the real `TextBox` sits, so you can draw around it.
- Inside the template, the `DataContext` is the collection of `ValidationError` objects, and each one has an `ErrorContent` (your message).

Because the adorner layer floats, the messages do **not** push other controls down. Leave a bottom margin under each text box, or the message will overlap the next field.

Writing this template on every `TextBox` is repetitive. In [Styles and Setters](/courses/wpf/styles-and-setters) you will put it in one style, and in [Triggers](/courses/wpf/triggers) you will learn to show the error as a tooltip when `Validation.HasError` is true. Control templates get a full lesson of their own in [Control Templates](/courses/wpf/control-templates).

## Stopping the save

The simplest guard is to bind the Save button's `IsEnabled` to a property that is the opposite of `HasErrors`:

```csharp
public bool CanSave => !HasErrors;
```

Raise `PropertyChanged` for `CanSave` inside `SetErrors`. Also run `ValidateAll()` in the click handler, so an untouched empty form cannot be saved. Later, in [Commands and ICommand](/courses/wpf/commands-and-icommand), you will move this check into a command's `CanExecute`.

## Coming later: ObservableValidator

Writing the error dictionary by hand is good for understanding, but it is a lot of typing. In the MVVM section, [MVVM with CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm) introduces `ObservableValidator`, a base class that implements `INotifyDataErrorInfo` for you and lets you write rules as [attributes](/courses/c-sharp/attributes) such as `[Required]` and `[Range]`. What you learn here is exactly what it does under the hood.

## Common mistakes

- **No message, only a red border.** The default template shows no text. Add your own `ErrorTemplate`.
- **Errors only appear after leaving the box.** `TextBox.Text` updates on lost focus. Add `UpdateSourceTrigger=PropertyChanged`.
- **A brand new form saves with empty fields.** Setters never ran, so nothing was validated. Call `ValidateAll()` before saving.
- **Forgetting to raise ErrorsChanged.** The dictionary has the error but the screen never updates.
- **Messages overlap the next field.** The adorner layer does not take space in the layout. Add a bottom margin.
- **Using `(Validation.Errors)[0]` in a binding.** When the list is empty this logs binding errors. Bind to the list, or use `(Validation.Errors)/ErrorContent`, which means "the current item" and fails quietly.

## Quick recap

- WPF validation is part of data binding. Errors land in `Validation.Errors`, and `Validation.HasError` becomes true.
- A `ValidationRule` checks one binding, usually the raw text. Great for "is this a number?".
- `IDataErrorInfo` is the older interface: one error per property, checked only when that property changes.
- `INotifyDataErrorInfo` is the recommended interface: many errors per property, `HasErrors` for the whole object, and an `ErrorsChanged` event you raise.
- Customise the look with `Validation.ErrorTemplate` and `AdornedElementPlaceholder`.
- `ObservableValidator` from CommunityToolkit.Mvvm will remove the boilerplate later in the course.

<code id="code-content" class="language-csharp">
// ViewModels/ExpenseFormViewModel.cs
using System.Collections;
using System.ComponentModel;
using System.Runtime.CompilerServices;
namespace CoinJar.ViewModels;
// Holds the add expense form and checks it with INotifyDataErrorInfo
public class ExpenseFormViewModel : INotifyPropertyChanged, INotifyDataErrorInfo
{
    private string _title = "";
    public string Title
    {
        get =&gt; _title;
        set { _title = value; OnPropertyChanged(); ValidateTitle(); }
    }
    private decimal _amount;
    public decimal Amount
    {
        get =&gt; _amount;
        set { _amount = value; OnPropertyChanged(); ValidateAmount(); }
    }
    private DateTime _date = DateTime.Today;
    public DateTime Date
    {
        get =&gt; _date;
        set { _date = value; OnPropertyChanged(); ValidateDate(); }
    }
    public string[] Categories { get; } = { "Food", "Transport", "Bills", "Fun", "Other" };
    public string Category { get; set; } = "Food";
    // The rules for each property
    private void ValidateTitle()
    {
        var errors = new List&lt;string&gt;();
        if (string.IsNullOrWhiteSpace(Title)) errors.Add("Title is required.");
        if (Title.Length &gt; 40) errors.Add("Keep the title under 40 characters.");
        SetErrors(nameof(Title), errors);
    }
    private void ValidateAmount()
    {
        var errors = new List&lt;string&gt;();
        if (Amount &lt;= 0) errors.Add("The amount must be more than zero.");
        SetErrors(nameof(Amount), errors);
    }
    private void ValidateDate()
    {
        var errors = new List&lt;string&gt;();
        if (Date.Date &gt; DateTime.Today) errors.Add("The date cannot be in the future.");
        SetErrors(nameof(Date), errors);
    }
    // Run every rule, for example before saving a form nobody touched
    public void ValidateAll()
    {
        ValidateTitle();
        ValidateAmount();
        ValidateDate();
    }
    public bool CanSave =&gt; !HasErrors;
    // INotifyDataErrorInfo
    private readonly Dictionary&lt;string, List&lt;string&gt;&gt; _errors = new();
    public bool HasErrors =&gt; _errors.Count &gt; 0;
    public IEnumerable GetErrors(string? propertyName)
        =&gt; propertyName != null &amp;&amp; _errors.TryGetValue(propertyName, out var list)
            ? list
            : Array.Empty&lt;string&gt;();
    public event EventHandler&lt;DataErrorsChangedEventArgs&gt;? ErrorsChanged;
    private void SetErrors(string propertyName, List&lt;string&gt; errors)
    {
        if (errors.Count == 0) _errors.Remove(propertyName);
        else _errors[propertyName] = errors;
        ErrorsChanged?.Invoke(this, new DataErrorsChangedEventArgs(propertyName));
        OnPropertyChanged(nameof(HasErrors));
        OnPropertyChanged(nameof(CanSave));
    }
    // INotifyPropertyChanged
    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null)
        =&gt; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
// Rules/AmountRule.cs
using System.Globalization;
using System.Windows.Controls;
namespace CoinJar.Rules;
// Checks the raw text before WPF converts it to a decimal
public class AmountRule : ValidationRule
{
    public decimal Max { get; set; } = 10_000m;
    public override ValidationResult Validate(object value, CultureInfo cultureInfo)
    {
        string text = value as string ?? "";
        if (!decimal.TryParse(text, NumberStyles.Number, cultureInfo, out decimal amount))
            return new ValidationResult(false, "Please type a number, like 12.50.");
        if (amount &gt; Max)
            return new ValidationResult(false, $"That is a lot! The limit is {Max:N0}.");
        return ValidationResult.ValidResult;
    }
}
// MainWindow.xaml
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:v="clr-namespace:CoinJar.Rules"
        Title="Add expense" Height="380" Width="420"&gt;
    &lt;Window.Resources&gt;
        &lt;!-- One error template, reused by every input below --&gt;
        &lt;ControlTemplate x:Key="FriendlyError"&gt;
            &lt;StackPanel&gt;
                &lt;Border BorderBrush="#D93025" BorderThickness="1" CornerRadius="2"&gt;
                    &lt;AdornedElementPlaceholder /&gt;
                &lt;/Border&gt;
                &lt;!-- DataContext is the list of ValidationError objects --&gt;
                &lt;ItemsControl ItemsSource="{Binding}"&gt;
                    &lt;ItemsControl.ItemTemplate&gt;
                        &lt;DataTemplate&gt;
                            &lt;TextBlock Text="{Binding ErrorContent}" Foreground="#D93025" FontSize="11" /&gt;
                        &lt;/DataTemplate&gt;
                    &lt;/ItemsControl.ItemTemplate&gt;
                &lt;/ItemsControl&gt;
            &lt;/StackPanel&gt;
        &lt;/ControlTemplate&gt;
    &lt;/Window.Resources&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;TextBlock Text="Title" /&gt;
        &lt;!-- Errors come from INotifyDataErrorInfo automatically --&gt;
        &lt;TextBox Text="{Binding Title, UpdateSourceTrigger=PropertyChanged}"
                 Validation.ErrorTemplate="{StaticResource FriendlyError}"
                 Margin="0,2,0,22" /&gt;
        &lt;TextBlock Text="Amount" /&gt;
        &lt;!-- Format check from the rule, business check from the class --&gt;
        &lt;TextBox Validation.ErrorTemplate="{StaticResource FriendlyError}" Margin="0,2,0,22"&gt;
            &lt;TextBox.Text&gt;
                &lt;Binding Path="Amount" UpdateSourceTrigger="PropertyChanged"&gt;
                    &lt;Binding.ValidationRules&gt;
                        &lt;v:AmountRule Max="5000" /&gt;
                    &lt;/Binding.ValidationRules&gt;
                &lt;/Binding&gt;
            &lt;/TextBox.Text&gt;
        &lt;/TextBox&gt;
        &lt;TextBlock Text="Category" /&gt;
        &lt;ComboBox ItemsSource="{Binding Categories}" SelectedItem="{Binding Category}" Margin="0,2,0,12" /&gt;
        &lt;TextBlock Text="Date" /&gt;
        &lt;DatePicker SelectedDate="{Binding Date}"
                    Validation.ErrorTemplate="{StaticResource FriendlyError}"
                    Margin="0,2,0,22" /&gt;
        &lt;Button Content="Save" Width="100" HorizontalAlignment="Right"
                IsEnabled="{Binding CanSave}" Click="Save_Click" /&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
// MainWindow.xaml.cs
using System.Windows;
using CoinJar.ViewModels;
namespace CoinJar;
public partial class MainWindow : Window
{
    private readonly ExpenseFormViewModel _form = new();
    public MainWindow()
    {
        InitializeComponent();
        DataContext = _form;
    }
    private void Save_Click(object sender, RoutedEventArgs e)
    {
        // Catch fields the user never touched
        _form.ValidateAll();
        if (_form.HasErrors) return;
        MessageBox.Show($"Saved {_form.Title} ({_form.Amount:C})", "CoinJar");
    }
}
</code></pre>
