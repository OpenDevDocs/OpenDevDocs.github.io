---
course: c-sharp
slug: lock-statement-and-thread-safety
experienceLevel: mid
difficulty: medium
tags:
  - threading
question: "What does the `lock` statement do in C#, and what are common mistakes when using it?"
answer: |
  `lock (obj) { ... }` provides **mutual exclusion**: only one thread at a time can run code locked on the same object, and the others wait. The compiler expands it to `Monitor.Enter` and `Monitor.Exit` inside a `try`/`finally`, so the lock is released even if an exception is thrown. It's **reentrant**, meaning the thread that holds it can acquire it again.

  Common mistakes:

  - **Locking on `this`, a `Type` (`typeof(MyClass)`), or a string.** Outside code can lock the same object and cause deadlocks, and strings may be interned and shared. Lock on a `private readonly` object instead.
  - **Awaiting inside a lock.** It's a compile error (CS1996), because the thread that resumes after `await` may not be the one that owns the lock. Use `SemaphoreSlim.WaitAsync` in async code.
  - **Holding locks too long**, especially during I/O or while calling unknown code.
  - **Protecting only the writes.** Reads of shared mutable state need the same lock.

  Since .NET 9 (C# 13), prefer the dedicated `System.Threading.Lock` type: the `lock` statement recognizes it and uses its faster `EnterScope` API.
codeExample: |
  var account = new Account();
  Parallel.For(0, 1_000, _ => account.Deposit(1));
  Console.WriteLine(account.Balance);        // Output: 1000 (no lost updates)

  public class Account
  {
      private readonly Lock _sync = new();   // .NET 9+; a private object before that
      private decimal _balance;

      public decimal Balance
      {
          get { lock (_sync) return _balance; }   // reads take the lock too
      }

      public void Deposit(decimal amount)
      {
          lock (_sync)                        // one thread at a time in here
          {
              _balance += amount;
          }
      }

      // lock (this) { }                      // bad: outside code can lock it too
      // lock (_sync) { await SaveAsync(); }  // compile error CS1996
  }
popularity: 8.6
isPublished: true
---
