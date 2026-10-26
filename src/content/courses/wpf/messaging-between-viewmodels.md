---
publishDate: 2026-10-25T20:42
title: 'Messaging Between ViewModels'
slug: messaging-between-viewmodels
metadescription: 'Let view models talk without knowing each other using the WeakReferenceMessenger from CommunityToolkit.Mvvm: messages, recipients, ObservableRecipient and request messages.'
updateDate: 2026-10-25T20:42
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'mvvm', 'messenger', 'communitytoolkit']
course: wpf
---

## When view models need to talk

CoinJar now has several screens (from [Navigation Between Views](/courses/wpf/navigation-between-views)): an "add expense" form, the expense list and a summary. When the user saves a new expense on the form, the list should show it and the summary should update its total.

The obvious fix is to give `AddExpenseViewModel` a reference to the other two and call them:

```csharp
// Works, but every view model now knows about every other one
_list.Expenses.Add(expense);
_summary.Refresh();
```

That creates a tangle. Add a fourth screen that cares about new expenses, and you have to edit the form's view model again. Tests get harder too, because you cannot create one view model without all the others.

A **messenger** solves this. Think of it as a noticeboard in an office. Anyone can pin a note ("a new expense was added"), and anyone who is interested reads it. The person who pins the note does not need to know who will read it. In programming this is called the **publish and subscribe** pattern.

CommunityToolkit.Mvvm, which you installed in [MVVM with CommunityToolkit.Mvvm](/courses/wpf/mvvm-with-communitytoolkit-mvvm), includes a ready made messenger.

## Step 1: define a message

A **message** is just a small class that carries data. A [record](/courses/c-sharp/records) is perfect, because messages should not change after they are sent:

```csharp
namespace CoinJar.Messages;

public sealed record ExpenseAddedMessage(Expense Expense);
```

The toolkit also has a helper base class for "here is a new value" messages, if you prefer:

```csharp
using CommunityToolkit.Mvvm.Messaging.Messages;

public sealed class ExpenseAddedMessage(Expense value) : ValueChangedMessage<Expense>(value);
// Receivers read message.Value
```

Either style is fine. This lesson uses the record.

## Step 2: send it

Sending is one line. `WeakReferenceMessenger.Default` is a shared messenger for the whole app:

```csharp
using CommunityToolkit.Mvvm.Messaging;

[RelayCommand]
private void Save()
{
    var expense = new Expense { Title = Title, Amount = Amount, Category = Category };
    _store.Add(expense);

    WeakReferenceMessenger.Default.Send(new ExpenseAddedMessage(expense));
}
```

The sender does not know or care who is listening. If nobody is, the message simply goes nowhere.

## Step 3: receive it

A view model that wants the message **registers** for it. The handler gets two arguments: the recipient (the object that registered) and the message.

```csharp
public ExpenseListViewModel(IMessenger messenger)
{
    messenger.Register<ExpenseListViewModel, ExpenseAddedMessage>(this,
        static (recipient, message) => recipient.Expenses.Add(message.Expense));
}
```

Why the odd `(recipient, message)` shape, and why `static`? The handler uses the `recipient` argument instead of `this`. Marking the [lambda](/courses/c-sharp/lambda-expressions) `static` makes the compiler stop you from capturing `this` by accident. That matters because of how the messenger stores recipients, explained next.

## Weak references: why "WeakReference" messenger?

Normally, if object A holds a reference to object B, B cannot be cleaned up by the garbage collector while A is alive (see [memory management and garbage collection](/courses/c-sharp/memory-management-and-garbage-collection)). With a messenger that lives forever, that would mean every registered view model also lives forever. That is a **memory leak**: memory that is never given back.

`WeakReferenceMessenger` holds recipients through **weak references**. A weak reference lets the messenger find the object while it is alive, but does not keep it alive. When nothing else uses a view model, it can be collected, and the messenger forgets it automatically.

The toolkit also has `StrongReferenceMessenger`. It is a bit faster, but you **must** unregister every recipient yourself, or it leaks. Start with the weak one.

| Messenger | Keeps recipients alive? | Must you unregister? |
| --- | --- | --- |
| `WeakReferenceMessenger` | No | Optional, but good practice |
| `StrongReferenceMessenger` | Yes | Yes, always |

To stop listening:

```csharp
messenger.Unregister<ExpenseAddedMessage>(this); // one message type
messenger.UnregisterAll(this);                   // everything for this recipient
```

## IRecipient and ObservableRecipient

If a view model handles several messages, registering lambdas one by one gets noisy. Instead, implement `IRecipient<TMessage>` for each message type and inherit from `ObservableRecipient`:

```csharp
public partial class SummaryViewModel : ObservableRecipient, IRecipient<ExpenseAddedMessage>
{
    public SummaryViewModel(IMessenger messenger) : base(messenger)
    {
        IsActive = true; // registers every IRecipient<T> this class implements
    }

    [ObservableProperty]
    public partial decimal Total { get; set; }

    public void Receive(ExpenseAddedMessage message)
    {
        Total += message.Expense.Amount;
    }
}
```

`ObservableRecipient` is an `ObservableObject` with messenger support built in:

- It has a `Messenger` property (the one you pass to the constructor, or `WeakReferenceMessenger.Default` if you pass none).
- Setting `IsActive = true` calls `OnActivated`, which by default registers all your `IRecipient<T>` interfaces.
- Setting `IsActive = false` calls `OnDeactivated`, which unregisters everything.

That makes it easy to listen only while a screen is visible: activate it when you navigate to it and deactivate it when you leave.

## Asking a question: request messages

Sometimes you want an answer back, not just to announce something. A **request message** carries a reply. Inherit from `RequestMessage<T>`, where `T` is the type of the answer:

```csharp
public sealed class CurrentTotalRequestMessage : RequestMessage<decimal>;
```

The view model that knows the answer replies:

```csharp
messenger.Register<ExpenseListViewModel, CurrentTotalRequestMessage>(this,
    static (recipient, message) => message.Reply(recipient.Total));
```

Any other view model can now ask:

```csharp
decimal total = messenger.Send<CurrentTotalRequestMessage>();
```

The `Send` call returns the message, and a request message converts to its answer automatically. If nobody replied, reading the answer throws an `InvalidOperationException`. Check `HasReceivedResponse` on the message first if a reply is not guaranteed.

## Broadcasting property changes

`ObservableRecipient` has one more trick. Add `[NotifyPropertyChangedRecipients]` to a property and every change is sent as a `PropertyChangedMessage<T>`:

```csharp
public partial class SettingsViewModel(IMessenger messenger) : ObservableRecipient(messenger)
{
    [ObservableProperty]
    [NotifyPropertyChangedRecipients]
    public partial string CurrencyCode { get; set; } = "GBP";
}
```

Other view models register for `PropertyChangedMessage<string>` and check `message.PropertyName == "CurrencyCode"`. This is handy for app wide settings.

## Using the messenger with DI

`WeakReferenceMessenger.Default` works anywhere, but a hidden global is hard to replace in tests. Register the messenger in the container from [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host) and ask for `IMessenger` in constructors:

```csharp
builder.Services.AddSingleton<IMessenger>(WeakReferenceMessenger.Default);
```

In a test you can pass `new WeakReferenceMessenger()` instead, so each test gets its own clean noticeboard.

## Tips and common mistakes

- **Use messages for "something happened" between screens.** For a parent talking to its own child view model, a normal method call or property is simpler. Do not turn every call into a message.
- **Make one message type per event.** `ExpenseAddedMessage`, `ExpenseDeletedMessage`. A generic "SomethingChanged" message with a string inside quickly becomes confusing.
- **Handlers run right away, on the sender's thread.** `Send` calls every handler before it returns. If you send from a background thread, the handlers also run there, and updating UI bound collections from there fails. See [The Dispatcher and Threading](/courses/wpf/the-dispatcher-and-threading).
- **Capturing `this` in the handler.** Use the `recipient` argument and a `static` lambda, as shown above.
- **Forgetting `IsActive = true`.** An `ObservableRecipient` does not receive anything until it is active.
- **Registering twice.** Registering the same recipient for the same message type twice throws an exception. Register in the constructor (or `OnActivated`), not every time a screen is shown.
- **Channels.** If two separate parts of the app send the same message type, you can pass a **token** to `Register` and `Send` so each part only hears its own messages.

## Quick recap

- A messenger lets view models talk without references to each other: senders `Send` a message, recipients `Register` for it.
- Messages are small classes, often records. `ValueChangedMessage<T>` and `RequestMessage<T>` are ready made bases.
- `WeakReferenceMessenger` does not keep recipients alive, so forgotten registrations do not leak memory.
- `ObservableRecipient` plus `IRecipient<T>` registers handlers automatically when `IsActive` is `true`.
- Request messages return an answer with `Reply`, and `[NotifyPropertyChangedRecipients]` broadcasts property changes.
- Register `IMessenger` in DI so tests can use their own messenger.

<code id="code-content" class="language-csharp">
// Messages/ExpenseMessages.cs
using CoinJar.Models;
using CommunityToolkit.Mvvm.Messaging.Messages;
namespace CoinJar.Messages;
// "Something happened" messages: small, immutable records
public sealed record ExpenseAddedMessage(Expense Expense);
public sealed record ExpenseDeletedMessage(Expense Expense);
// A question with an answer of type decimal
public sealed class CurrentTotalRequestMessage : RequestMessage&lt;decimal&gt;;
// ViewModels/AddExpenseViewModel.cs
using CoinJar.Messages;
using CoinJar.Models;
using CoinJar.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
namespace CoinJar.ViewModels;
// The sender: it does not know who is listening
public partial class AddExpenseViewModel(IExpenseStore store, IMessenger messenger) : ObservableObject
{
    public string[] Categories { get; } = ["Food", "Transport", "Bills", "Fun", "Other"];
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SaveCommand))]
    public partial string Title { get; set; } = "";
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SaveCommand))]
    public partial decimal Amount { get; set; }
    [ObservableProperty]
    public partial string Category { get; set; } = "Food";
    [RelayCommand(CanExecute = nameof(CanSave))]
    private void Save()
    {
        var expense = new Expense { Title = Title.Trim(), Amount = Amount, Category = Category };
        store.Add(expense);
        messenger.Send(new ExpenseAddedMessage(expense)); // pin the note
        Title = "";
        Amount = 0;
    }
    private bool CanSave() =&gt; !string.IsNullOrWhiteSpace(Title) &amp;&amp; Amount &gt; 0;
}
// ViewModels/ExpenseListViewModel.cs
using System.Collections.ObjectModel;
using CoinJar.Messages;
using CoinJar.Models;
using CoinJar.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
namespace CoinJar.ViewModels;
public partial class ExpenseListViewModel : ObservableObject
{
    private readonly IExpenseStore _store;
    private readonly IMessenger _messenger;
    public ExpenseListViewModel(IExpenseStore store, IMessenger messenger)
    {
        _store = store;
        _messenger = messenger;
        Expenses.CollectionChanged += (_, _) =&gt; OnPropertyChanged(nameof(Total));
        foreach (var expense in store.GetAll()) Expenses.Add(expense);
        // static lambda + recipient argument: no hidden capture of this
        messenger.Register&lt;ExpenseListViewModel, ExpenseAddedMessage&gt;(this,
            static (r, m) =&gt; r.Expenses.Add(m.Expense));
        // Answer "what is the total?" for anyone who asks
        messenger.Register&lt;ExpenseListViewModel, CurrentTotalRequestMessage&gt;(this,
            static (r, m) =&gt; m.Reply(r.Total));
    }
    public ObservableCollection&lt;Expense&gt; Expenses { get; } = [];
    public decimal Total =&gt; Expenses.Sum(e =&gt; e.Amount);
    [RelayCommand]
    private void Delete(Expense? expense)
    {
        if (expense is null) return;
        _store.Remove(expense);
        Expenses.Remove(expense);
        _messenger.Send(new ExpenseDeletedMessage(expense));
    }
}
// ViewModels/SummaryViewModel.cs
using CoinJar.Messages;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Messaging;
namespace CoinJar.ViewModels;
// ObservableRecipient registers every IRecipient interface when IsActive is true
public partial class SummaryViewModel : ObservableRecipient,
    IRecipient&lt;ExpenseAddedMessage&gt;, IRecipient&lt;ExpenseDeletedMessage&gt;
{
    public SummaryViewModel(IMessenger messenger) : base(messenger)
    {
        // Ask the list for the starting total
        var request = messenger.Send&lt;CurrentTotalRequestMessage&gt;();
        Total = request.HasReceivedResponse ? request.Response : 0m;
        IsActive = true;
    }
    [ObservableProperty]
    public partial decimal Total { get; set; }
    [ObservableProperty]
    public partial string LastChange { get; set; } = "No changes yet";
    public void Receive(ExpenseAddedMessage message)
    {
        Total += message.Expense.Amount;
        LastChange = $"Added {message.Expense.Title}";
    }
    public void Receive(ExpenseDeletedMessage message)
    {
        Total -= message.Expense.Amount;
        LastChange = $"Deleted {message.Expense.Title}";
    }
}
// App.xaml.cs (registrations only)
// builder.Services.AddSingleton&lt;IMessenger&gt;(WeakReferenceMessenger.Default);
// builder.Services.AddSingleton&lt;IExpenseStore, InMemoryExpenseStore&gt;();
// builder.Services.AddSingleton&lt;ExpenseListViewModel&gt;();
// builder.Services.AddSingleton&lt;SummaryViewModel&gt;();
// builder.Services.AddTransient&lt;AddExpenseViewModel&gt;();
</code></pre>
