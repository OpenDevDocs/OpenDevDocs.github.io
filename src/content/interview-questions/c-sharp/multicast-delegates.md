---
course: c-sharp
slug: multicast-delegates
experienceLevel: mid
difficulty: medium
tags:
  - delegates
question: "What are multicast delegates, and what happens to return values and exceptions?"
answer: |
  Every delegate in C# can be **multicast**: it holds an **invocation list** of one or more methods. `+=` (or `Delegate.Combine`) adds a method, `-=` removes one, and invoking the delegate calls every method in the list **in order**, on the calling thread. Events rely on this to notify several subscribers.

  Two behaviors surprise people:

  - **Return values:** only the **last** method's return value comes back. The others are computed and discarded, so multicasting a `Func<T>` is rarely what you want.
  - **Exceptions:** if one handler throws, the exception propagates immediately, and the **remaining handlers never run**.

  When you need every result, or don't want one failing handler to stop the others, loop over `GetInvocationList()` and call each delegate yourself inside a `try`/`catch`.

  Delegates are **immutable**. Combining creates a new delegate object rather than modifying the existing one, which is why copying a delegate to a local variable gives you a stable, thread-safe snapshot to invoke.
codeExample: |
  Func<int> numbers = () => 1;
  numbers += () => 2;
  numbers += () => 3;
  Console.WriteLine(numbers());                // Output: 3 (only the last result)

  foreach (Func<int> f in numbers.GetInvocationList().Cast<Func<int>>())
      Console.Write($"{f()} ");                // Output: 1 2 3
  Console.WriteLine();

  Action notify = () => Console.WriteLine("Email sent");
  notify += () => throw new InvalidOperationException("SMS gateway down");
  notify += () => Console.WriteLine("Push sent");   // never runs with notify()

  foreach (Action handler in notify.GetInvocationList().Cast<Action>())
  {
      try { handler(); }                       // isolate each subscriber
      catch (Exception ex) { Console.WriteLine($"Handler failed: {ex.Message}"); }
  }
  // Output: Email sent
  //         Handler failed: SMS gateway down
  //         Push sent
popularity: 7.2
isPublished: true
---
