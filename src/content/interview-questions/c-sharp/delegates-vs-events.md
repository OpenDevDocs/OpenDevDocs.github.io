---
course: c-sharp
slug: delegates-vs-events
experienceLevel: mid
difficulty: medium
tags:
  - delegates
question: "What is the difference between a delegate and an event in C#?"
answer: |
  A **delegate** is a type that references methods. An **event** is a class member, declared with the `event` keyword, that wraps a delegate and **restricts what outside code can do with it**.

  With a public delegate field, any code holding the object could:

  - Replace every subscriber with `=`, silently unsubscribing everyone else.
  - Invoke the delegate itself, raising a "notification" that never really happened.
  - Set it to `null`.

  With an event, outside code can only **subscribe with `+=`** and **unsubscribe with `-=`**. Only the declaring class can raise or reset it. That encapsulation is the whole point: the publisher controls when notifications happen.

  The standard .NET pattern uses `EventHandler` or `EventHandler<TEventArgs>`, where handlers receive the sender and an arguments object. Raise the event with `PriceChanged?.Invoke(this, args)`, which is null-safe and thread-safe, because the delegate field is read only once.

  One practical rule: if the publisher lives longer than a subscriber, the subscriber must unsubscribe when it's done. Otherwise the publisher's delegate keeps it alive, and it leaks.
codeExample: |
  var stock = new Stock("MSFT");
  stock.PriceChanged += (sender, e) => Console.WriteLine($"{e.Symbol}: {e.Price}");
  stock.Update(420.50m);                    // Output: MSFT: 420.50

  // stock.PriceChanged = null;             // compile error: only += and -= allowed
  // stock.PriceChanged?.Invoke(stock, x);  // compile error: only Stock can raise it

  public class PriceChangedEventArgs(string symbol, decimal price) : EventArgs
  {
      public string Symbol { get; } = symbol;
      public decimal Price { get; } = price;
  }

  public class Stock(string symbol)
  {
      public event EventHandler<PriceChangedEventArgs>? PriceChanged;

      public void Update(decimal price)
      {
          // Raise the event: the null-conditional call reads the delegate once
          PriceChanged?.Invoke(this, new PriceChangedEventArgs(symbol, price));
      }
  }
popularity: 8.9
isPublished: true
---
