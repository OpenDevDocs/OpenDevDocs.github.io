---
publishDate: 2026-04-16T11:28
title: Events
slug: events
metadescription: Publish and subscribe to events in C#, understand why the event keyword exists, use EventHandler and EventArgs, raise events safely and avoid the memory leaks that come from forgotten subscriptions.
updateDate: 2026-09-05T11:28
author: ['bishal-biswas']
level: 3
tags: ['events', 'delegates']
course: c-sharp
---

## The problem with a public delegate

A delegate property lets outsiders customise behaviour, but it gives too much away:

```csharp
class Downloader
{
    public Action<string>? Completed { get; set; }
}

var d = new Downloader();
d.Completed += name => Console.WriteLine("A finished");
d.Completed = null;              // some other code wipes every subscriber
d.Completed?.Invoke("x");        // some other code fires it from outside
```

Anyone can overwrite the whole list or trigger it. An **event** is a delegate with two restrictions: outside code can only **subscribe** and **unsubscribe**. Only the owning class can raise it or reset it.

## Declaring an event

Add the `event` keyword in front of a delegate typed field:

```csharp
class Downloader
{
    public event Action<string>? Completed;

    public void Download(string file)
    {
        Console.WriteLine($"Downloading {file}...");
        Completed?.Invoke(file);     // raise the event
    }
}
```

Subscribers use `+=` and `-=`, and nothing else:

```csharp
var d = new Downloader();
d.Completed += file => Console.WriteLine($"Done: {file}");
d.Completed += file => File.AppendAllText("log.txt", file + "\n");

d.Download("report.pdf");

// d.Completed = null;        // error: outside the class
// d.Completed?.Invoke("x");  // error: outside the class
```

This is the **publisher and subscriber** pattern. The `Downloader` publishes. It does not know or care who listens.

## The standard EventHandler pattern

.NET has a convention for events, and following it makes your classes feel like the built in ones. Use the `EventHandler` delegate, which takes the sender and an arguments object:

```csharp
class Counter
{
    public event EventHandler? ThresholdReached;

    private int count;

    public void Increment()
    {
        count++;
        if (count == 5)
        {
            OnThresholdReached(EventArgs.Empty);
        }
    }

    protected virtual void OnThresholdReached(EventArgs e)
    {
        ThresholdReached?.Invoke(this, e);
    }
}
```

Three parts of the convention:

- The event is named with a verb in the past tense: `ThresholdReached`, `Completed`, `Changed`.
- A `protected virtual` method named `On` plus the event name raises it, so subclasses can hook in.
- Handlers receive `sender` and `EventArgs`.

Subscribing:

```csharp
var counter = new Counter();
counter.ThresholdReached += (sender, e) => Console.WriteLine("Threshold hit!");

for (int i = 0; i < 5; i++) counter.Increment();
```

## Passing data with custom EventArgs

When subscribers need information, create a class that inherits from `EventArgs` and use `EventHandler<T>`:

```csharp
class OrderPlacedEventArgs : EventArgs
{
    public string OrderId { get; }
    public decimal Total { get; }

    public OrderPlacedEventArgs(string orderId, decimal total)
    {
        OrderId = orderId;
        Total = total;
    }
}

class Shop
{
    public event EventHandler<OrderPlacedEventArgs>? OrderPlaced;

    public void PlaceOrder(string id, decimal total)
    {
        Console.WriteLine($"Order {id} placed");
        OrderPlaced?.Invoke(this, new OrderPlacedEventArgs(id, total));
    }
}
```

```csharp
var shop = new Shop();
shop.OrderPlaced += (sender, e) => Console.WriteLine($"Email receipt for {e.OrderId}");
shop.OrderPlaced += (sender, e) => { if (e.Total > 1000) Console.WriteLine("Flag for review"); };

shop.PlaceOrder("A100", 1500);
```

The shop gained two behaviours without a single change to `PlaceOrder`.

## Handlers as named methods

Lambdas are convenient, but a named method can be unsubscribed later:

```csharp
void HandleOrder(object? sender, OrderPlacedEventArgs e)
{
    Console.WriteLine($"Handling {e.OrderId}");
}

shop.OrderPlaced += HandleOrder;
shop.PlaceOrder("B200", 50);
shop.OrderPlaced -= HandleOrder;   // works because it is the same method
```

You cannot unsubscribe a lambda unless you kept it in a variable.

## Memory leaks from events

A publisher holds a reference to every subscriber. If a long lived object subscribes to a short lived one, no problem. But if a **short lived** object subscribes to a **long lived** publisher and never unsubscribes, the publisher keeps it alive forever:

```csharp
class Window
{
    public Window(Clock clock)
    {
        clock.Tick += OnTick;   // clock now references this window
    }

    private void OnTick(object? s, EventArgs e) { }
}
```

If `clock` lives for the whole program, every `Window` ever created lives too, even after the user closes it. Unsubscribe in a `Dispose` or close method. This is one of the most common memory leaks in C# desktop apps.

## Raising events safely

Always copy the event to a local before invoking, or use `?.Invoke`, which does this for you. Otherwise another thread could unsubscribe the last handler between your null check and your call:

```csharp
// Safe
Completed?.Invoke(this, EventArgs.Empty);

// Also safe, older style
var handler = Completed;
if (handler != null) handler(this, EventArgs.Empty);
```

## Quick recap

- An event is a delegate that outsiders can only subscribe to with `+=` and `-=`.
- Only the owning class can raise it, and it does so with `?.Invoke`.
- Follow the .NET convention: `EventHandler`, past tense names, and a protected `OnXxx` method.
- Pass data with a class that inherits `EventArgs` and `EventHandler<T>`.
- Unsubscribe when a subscriber's life ends, or the publisher will keep it alive.

<code id="code-content" class="language-csharp">
// Events in C#
class OrderPlacedEventArgs : EventArgs
{
    public string OrderId { get; }
    public decimal Total { get; }
    public OrderPlacedEventArgs(string id, decimal total) =&gt; (OrderId, Total) = (id, total);
}
class Shop
{
    // Publisher: outsiders can only += and -=
    public event EventHandler&lt;OrderPlacedEventArgs&gt;? OrderPlaced;
    public void PlaceOrder(string id, decimal total)
    {
        Console.WriteLine($"Order {id} placed for {total}");
        OnOrderPlaced(new OrderPlacedEventArgs(id, total));
    }
    // Convention: protected virtual OnXxx raises the event
    protected virtual void OnOrderPlaced(OrderPlacedEventArgs e)
        =&gt; OrderPlaced?.Invoke(this, e);     // safe when nobody subscribed
}
class FraudChecker
{
    public void Handle(object? sender, OrderPlacedEventArgs e)
    {
        if (e.Total &gt; 1000) Console.WriteLine($"  Review {e.OrderId}");
    }
}
var shop = new Shop();
var checker = new FraudChecker();
// Subscribe a lambda and a named method
shop.OrderPlaced += (s, e) =&gt; Console.WriteLine($"  Receipt emailed for {e.OrderId}");
shop.OrderPlaced += checker.Handle;
shop.PlaceOrder("A100", 1500);
shop.PlaceOrder("B200", 50);
// Unsubscribe the named method, so it no longer runs
shop.OrderPlaced -= checker.Handle;
shop.PlaceOrder("C300", 5000);
// shop.OrderPlaced = null;                 // error: only the owner may do this
// shop.OrderPlaced?.Invoke(shop, ...);     // error: only the owner may raise it
</code></pre>
