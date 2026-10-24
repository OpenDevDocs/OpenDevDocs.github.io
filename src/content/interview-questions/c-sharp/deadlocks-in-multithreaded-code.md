---
course: c-sharp
slug: deadlocks-in-multithreaded-code
experienceLevel: senior
difficulty: hard
tags:
  - threading
question: "What causes deadlocks in multithreaded C# code, and how do you prevent them?"
answer: |
  A deadlock happens when threads wait on each other in a cycle, so none of them can proceed. It requires four conditions at once, known as the Coffman conditions: **mutual exclusion**, **hold and wait** (holding one lock while requesting another), **no preemption** (locks can't be taken away), and **circular wait**. Break any one of them and the deadlock can't occur.

  The classic case: thread 1 locks `A` and then waits for `B`, while thread 2 locks `B` and then waits for `A`. It often hides in code like `Transfer(from, to)` that locks two accounts in parameter order, which deadlocks when two transfers run in opposite directions.

  Prevention techniques:

  - **Global lock ordering:** always acquire multiple locks in one consistent order, such as by account ID.
  - **Small lock scopes:** never call unknown code (callbacks, events) or do I/O while holding a lock.
  - **Timeouts:** `Monitor.TryEnter(obj, timeout)` or `SemaphoreSlim.WaitAsync(timeout)` let you back off instead of waiting forever.
  - **Avoiding shared locks** altogether with immutable data, concurrent collections, channels, or single-owner designs.

  To diagnose a live deadlock, capture a dump and open it with `dotnet-dump analyze`: `clrstack -all` shows where each thread waits, and `syncblk` shows which thread owns which monitor.
codeExample: |
  var a = new Account(1, 100);
  var b = new Account(2, 100);
  // Opposite directions at the same time: naive locking would deadlock
  await Task.WhenAll(
      Task.Run(() => Transfer(a, b, 10)),
      Task.Run(() => Transfer(b, a, 20)));
  Console.WriteLine($"{a.Balance} {b.Balance}");   // Output: 110 90

  static void Transfer(Account from, Account to, decimal amount)
  {
      // Naive: lock (from.Sync) { lock (to.Sync) { ... } } -> A waits for B, B for A
      var (first, second) = from.Id < to.Id ? (from, to) : (to, from); // global order
      lock (first.Sync)
      lock (second.Sync)
      {
          from.Balance -= amount;
          to.Balance += amount;
      }
  }
  public class Account(int id, decimal balance)
  {
      public int Id => id;
      public decimal Balance { get; set; } = balance;
      public readonly object Sync = new();
  }
popularity: 8.3
isPublished: true
---
