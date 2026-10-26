---
publishDate: 2026-10-25T20:23
title: 'INotifyPropertyChanged'
slug: inotifypropertychanged
metadescription: 'Make your own C# classes tell WPF when a property changes. Implement INotifyPropertyChanged by hand, write a reusable SetProperty helper with CallerMemberName, and handle computed properties in CoinJar.'
updateDate: 2026-10-25T20:23
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'data-binding', 'inotifypropertychanged', 'csharp']
course: wpf
---

## The screen that would not update

At the end of [Data Binding Basics](/courses/wpf/data-binding-basics) we hit a wall. A button changed `_expense.Amount` in code, but the amount on screen stayed the same.

Here is why. A binding to a WPF control property always knows when the value changes, because WPF controls announce every change. Your `Expense` class is a plain C# class. When its `Amount` setter runs, nothing happens except a field changing. WPF is not watching fields, and it cannot guess.

The fix is to make the class **announce** its changes. .NET has a standard way to do that: the `INotifyPropertyChanged` interface. When a class implements it, WPF listens, and every announced change shows up on screen at once.

Think of a newsletter. WPF subscribes, and your class sends out a short note, "Amount just changed", whenever it does.

## The interface

`INotifyPropertyChanged` lives in the `System.ComponentModel` namespace. It is tiny. Here is the whole thing:

```csharp
namespace System.ComponentModel;

public interface INotifyPropertyChanged
{
    event PropertyChangedEventHandler? PropertyChanged;
}
```

It has one member: an **event** called `PropertyChanged`. If C# events are new to you, read [events](/courses/c-sharp/events) and [interfaces](/courses/c-sharp/interfaces) first. The short version: an event is a list of methods that want to be called when something happens.

When you set a `DataContext` to an object that implements this interface, each binding adds itself to that event. Your job is to **raise** the event, with the name of the property, whenever a property changes.

## Doing it by hand for one property

Let us make `Amount` notify. A normal auto property like `public decimal Amount { get; set; }` hides its storage, so we write a full property with a **backing field** (a private field that holds the actual value):

```csharp
using System.ComponentModel;

namespace CoinJar.Models;

public class Expense : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    private decimal _amount;

    public decimal Amount
    {
        get => _amount;
        set
        {
            if (_amount == value)
                return;                    // nothing changed, stay quiet

            _amount = value;               // 1. store the new value
            PropertyChanged?.Invoke(this,  // 2. tell everyone
                new PropertyChangedEventArgs(nameof(Amount)));
        }
    }
}
```

Step by step:

1. If the new value equals the old one, we return early. This avoids pointless screen updates and, in some cases, endless loops.
2. We store the value **first**, then raise the event. Listeners will read the property straight away, so it must already hold the new value.
3. `PropertyChanged?.Invoke(...)` calls every listener. The `?.` skips the call when nobody is listening yet.
4. `nameof(Amount)` produces the text `"Amount"`. Using `nameof` instead of typing the string means a rename in Visual Studio updates it too.

Run the discount button again. This time the amount on screen changes the moment you click.

## A reusable helper

Writing that setter for every property is tiring. Two small helper methods remove almost all the repetition.

### OnPropertyChanged with CallerMemberName

```csharp
using System.Runtime.CompilerServices;

protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
{
    PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
```

`[CallerMemberName]` is an **attribute** that tells the compiler: "if the caller does not pass this argument, fill in the name of the method or property that called me". Called from inside the `Amount` setter, `propertyName` becomes `"Amount"` automatically. You can learn more about attributes in [attributes](/courses/c-sharp/attributes).

### SetProperty does the whole setter

```csharp
protected bool SetProperty<T>(ref T field, T value,
    [CallerMemberName] string? propertyName = null)
{
    if (EqualityComparer<T>.Default.Equals(field, value))
        return false;          // same value: no change, no event

    field = value;
    OnPropertyChanged(propertyName);
    return true;               // tell the caller something changed
}
```

This is a **generic** method (the `<T>` part), so one method works for `string`, `decimal`, `DateTime` and anything else. See [generics](/courses/c-sharp/generics) if that is new. `ref T field` means the method receives the field itself, not a copy, so it can change it. `EqualityComparer<T>.Default` compares two values of any type correctly.

Now each property shrinks to one line in the setter:

```csharp
private string _title = "";
public string Title
{
    get => _title;
    set => SetProperty(ref _title, value);
}
```

## A base class for every model

You will want these helpers in many classes, so put them in a base class. Add `Models/BindableBase.cs`:

```csharp
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace CoinJar.Models;

public abstract class BindableBase : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));

    protected bool SetProperty<T>(ref T field, T value,
        [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
            return false;
        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }
}
```

It is `abstract` because nobody should create a plain `BindableBase`, only classes that inherit from it. Any class that needs notifications now just writes `: BindableBase`.

Later, in [MVVM with CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm), you will swap this class for a ready made one called `ObservableObject`, which does the same job and more. Writing it yourself once means you will know exactly what that library does for you.

## Shorter properties with the C# 14 field keyword

.NET 10 comes with C# 14, which adds the `field` keyword. Inside a property accessor, `field` means "the hidden backing field the compiler made for this property". You no longer need to declare `_title` yourself:

```csharp
public string Title
{
    get;
    set => SetProperty(ref field, value);
} = "";
```

This compiles to the same thing as the version with `_title`. Both styles are fine. You will see the older style with explicit fields in almost every tutorial, so it is worth knowing both.

## Computed properties

Some properties have no setter because they are worked out from others. CoinJar wants a short `Summary` text and an `IsLarge` flag for expensive items:

```csharp
public string Summary => $"{Title} ({Category})";
public bool IsLarge => Amount >= 50m;
```

The trap: nothing ever sets `Summary`, so nothing raises its event. When `Title` changes, the screen still shows the old summary.

The fix is to announce the computed property from the setter of every property it depends on:

```csharp
public string Title
{
    get => _title;
    set
    {
        if (SetProperty(ref _title, value))
            OnPropertyChanged(nameof(Summary));
    }
}
```

This is why `SetProperty` returns a `bool`: you only send the extra notification when the value really changed. You must pass the name explicitly here, because `[CallerMemberName]` would fill in `"Title"`.

### Refreshing everything at once

If you raise `PropertyChanged` with an empty or `null` name, WPF treats it as "every property may have changed" and refreshes all bindings to that object:

```csharp
OnPropertyChanged(string.Empty);
```

This is handy after loading a whole new set of values at once, but do not use it for single changes. It makes WPF re-read every bound property.

## Seeing the event with your own eyes

WPF is not the only thing that can listen. You can subscribe too, which is a great way to understand what is going on:

```csharp
var lunch = new Expense { Title = "Lunch", Amount = 8.50m };

lunch.PropertyChanged += (sender, e) =>
    Console.WriteLine($"{e.PropertyName} changed");

lunch.Amount = 9.00m;    // prints "Amount changed"
lunch.Amount = 9.00m;    // prints nothing: same value
lunch.Title = "Brunch";  // prints "Title changed" then "Summary changed"
```

The `(sender, e) => ...` part is a [lambda expression](/courses/c-sharp/lambda-expressions) used as the event handler.

## Common mistakes

- **Raising the event before storing the value.** The screen reads the old value and looks one step behind.
- **A typo in a hand typed name.** `OnPropertyChanged("Amout")` fails silently. Use `nameof(...)` or `[CallerMemberName]`.
- **Forgetting computed properties.** If `Summary` depends on `Title`, the `Title` setter must also announce `Summary`.
- **Implementing the interface but never raising the event.** Writing `: INotifyPropertyChanged` alone does nothing. Every setter must call the helper.
- **Using auto properties by accident.** `public string Category { get; set; }` in a `BindableBase` class still does not notify. Each property needs a setter that calls `SetProperty`.
- **Replacing a list instead of changing it.** This interface covers properties, not the items inside a list. For lists you need `ObservableCollection<T>`, coming next.

## Tips

- Changing a property from a background thread usually works for simple properties, because WPF moves the update onto the UI thread for you. Lists are stricter. You will learn the full rules in [The Dispatcher and Threading](/courses/wpf/the-dispatcher-and-threading).
- Keep notifying classes simple. They hold data and announce changes. Saving to disk and talking to the network belong elsewhere, as you will see in the MVVM section.
- The full example in the code panel fills its `ComboBox` with strings written right in XAML. The line `xmlns:sys="clr-namespace:System;assembly=mscorlib"` makes .NET types such as `String` usable as `sys:String`, and `x:Array` builds an array of them. Because the items are strings, `SelectedItem` can bind straight to the `string` property `Category`.
- Not every class needs notifications. A class that is created once and never changes while on screen is fine as a plain class or a C# [record](/courses/c-sharp/records).

## Quick recap

- WPF can only show changes that an object announces. Plain classes announce nothing.
- `INotifyPropertyChanged` has one event, `PropertyChanged`. Raise it with the property name after storing the new value.
- `[CallerMemberName]` fills in the property name for you, and `SetProperty` turns each setter into one line.
- A `BindableBase` class holds the helpers so every model can inherit them.
- C# 14's `field` keyword removes the need for hand written backing fields.
- Computed properties need extra notifications from the properties they depend on.
- Lists need `ObservableCollection<T>`, which is the topic of [Binding to Collections](/courses/wpf/binding-to-collections).

<code id="code-content" class="language-csharp">
// Models/BindableBase.cs
using System.ComponentModel;
using System.Runtime.CompilerServices;
namespace CoinJar.Models;
// A small base class that any bindable class can inherit from.
// CommunityToolkit.Mvvm's ObservableObject does the same job later in the course.
public abstract class BindableBase : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        =&gt; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    // Stores the value and raises PropertyChanged only if it really changed
    protected bool SetProperty&lt;T&gt;(ref T field, T value,
        [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer&lt;T&gt;.Default.Equals(field, value))
            return false;
        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }
}
// Models/Expense.cs
namespace CoinJar.Models;
public class Expense : BindableBase
{
    private int _id;
    private string _title = "";
    private decimal _amount;
    private string _category = "Other";
    private DateTime _date = DateTime.Today;
    public int Id
    {
        get =&gt; _id;
        set =&gt; SetProperty(ref _id, value);
    }
    public string Title
    {
        get =&gt; _title;
        set
        {
            if (SetProperty(ref _title, value))
                OnPropertyChanged(nameof(Summary)); // Summary depends on Title
        }
    }
    public decimal Amount
    {
        get =&gt; _amount;
        set
        {
            if (SetProperty(ref _amount, value))
                OnPropertyChanged(nameof(IsLarge)); // IsLarge depends on Amount
        }
    }
    public string Category
    {
        get =&gt; _category;
        set
        {
            if (SetProperty(ref _category, value))
                OnPropertyChanged(nameof(Summary));
        }
    }
    public DateTime Date
    {
        get =&gt; _date;
        set =&gt; SetProperty(ref _date, value);
    }
    // Computed properties: no setter, announced by the setters above
    public string Summary =&gt; $"{Title} ({Category})";
    public bool IsLarge =&gt; Amount &gt;= 50m;
}
// MainWindow.xaml.cs
using System.Windows;
using CoinJar.Models;
namespace CoinJar;
public partial class MainWindow : Window
{
    private readonly Expense _expense = new()
    {
        Id = 1,
        Title = "Groceries",
        Amount = 42.00m,
        Category = "Food"
    };
    public MainWindow()
    {
        InitializeComponent();
        DataContext = _expense;
    }
    private void Discount_Click(object sender, RoutedEventArgs e)
    {
        // Now the screen updates, because Expense raises PropertyChanged
        _expense.Amount = Math.Round(_expense.Amount * 0.9m, 2);
    }
    private void AddTen_Click(object sender, RoutedEventArgs e)
    {
        _expense.Amount += 10m; // watch "Large expense" appear at 50 or more
    }
}
&lt;!-- MainWindow.xaml --&gt;
&lt;Window x:Class="CoinJar.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:sys="clr-namespace:System;assembly=mscorlib"
        Title="CoinJar: live updates" Width="420" Height="400"&gt;
    &lt;StackPanel Margin="16"&gt;
        &lt;TextBlock Text="Title" /&gt;
        &lt;TextBox Text="{Binding Title, UpdateSourceTrigger=PropertyChanged}" /&gt;
        &lt;TextBlock Text="Amount" Margin="0,8,0,0" /&gt;
        &lt;TextBox Text="{Binding Amount}" /&gt;
        &lt;TextBlock Text="Category" Margin="0,8,0,0" /&gt;
        &lt;ComboBox SelectedItem="{Binding Category}"&gt;
            &lt;ComboBox.ItemsSource&gt;
                &lt;x:Array Type="{x:Type sys:String}"&gt;
                    &lt;sys:String&gt;Food&lt;/sys:String&gt;
                    &lt;sys:String&gt;Transport&lt;/sys:String&gt;
                    &lt;sys:String&gt;Bills&lt;/sys:String&gt;
                    &lt;sys:String&gt;Fun&lt;/sys:String&gt;
                    &lt;sys:String&gt;Other&lt;/sys:String&gt;
                &lt;/x:Array&gt;
            &lt;/ComboBox.ItemsSource&gt;
        &lt;/ComboBox&gt;
        &lt;!-- These update by themselves when the object changes --&gt;
        &lt;Border Background="WhiteSmoke" Padding="8" Margin="0,12,0,0"&gt;
            &lt;StackPanel&gt;
                &lt;TextBlock Text="{Binding Summary}" FontWeight="SemiBold" /&gt;
                &lt;TextBlock Text="{Binding Amount, StringFormat=C}" FontSize="20" /&gt;
                &lt;CheckBox Content="Large expense" IsChecked="{Binding IsLarge, Mode=OneWay}"
                          IsEnabled="False" /&gt;
            &lt;/StackPanel&gt;
        &lt;/Border&gt;
        &lt;StackPanel Orientation="Horizontal" Margin="0,12,0,0"&gt;
            &lt;Button Content="10% discount" Click="Discount_Click" Padding="10,4" /&gt;
            &lt;Button Content="Add 10" Click="AddTen_Click" Padding="10,4" Margin="8,0,0,0" /&gt;
        &lt;/StackPanel&gt;
    &lt;/StackPanel&gt;
&lt;/Window&gt;
</code></pre>
