---
course: c-sharp
slug: memory-leaks-in-managed-code
experienceLevel: senior
difficulty: hard
tags:
  - memory
question: "What causes memory leaks in managed .NET applications, and how do you find them?"
answer: |
  The GC frees only **unreachable** objects, so a managed "leak" is an object that is still reachable from a root. The usual culprits:

  - **Event subscriptions:** a long-lived publisher, such as a static event or singleton, holds references to every subscriber that never unsubscribes.
  - **Static and cache collections** that only grow, such as `static Dictionary` caches with no eviction or size limit.
  - **Timers and callbacks:** an active `System.Threading.Timer` keeps its callback target alive, and so do lambdas that capture large objects.
  - **Captive dependencies:** a singleton holding a scoped or transient service keeps it, and everything it references, alive forever.
  - **Undisposed resources:** native memory and OS handles that the GC doesn't see.
  - **LOH fragmentation**, which looks like a leak even though objects are being freed.

  Finding one:

  1. Confirm the trend with `dotnet-counters`: the GC heap size keeps rising even after full collections.
  2. Take two or more heap snapshots over time, with `dotnet-gcdump` or a full dump from `dotnet-dump`, and compare which types grow.
  3. Find what holds them: run `dumpheap -stat` and then `gcroot <address>` in `dotnet-dump analyze`, or inspect retention paths in Visual Studio, dotMemory, or PerfView.
codeExample: |
  var publisher = new PriceFeed();                // long-lived, e.g. a singleton

  for (int i = 0; i < 1_000; i++)
  {
      var widget = new PriceWidget(publisher);    // short-lived, but...
      widget.Close();                             // ...forgets to unsubscribe
  }
  Console.WriteLine(publisher.SubscriberCount);   // Output: 1000 (all still alive!)

  public class PriceFeed
  {
      public event EventHandler<decimal>? PriceChanged;
      public int SubscriberCount => PriceChanged?.GetInvocationList().Length ?? 0;
  }

  public class PriceWidget : IDisposable
  {
      private readonly PriceFeed _feed;
      private readonly byte[] _buffer = new byte[10_000];   // memory retained per widget
      public PriceWidget(PriceFeed feed) => (_feed = feed).PriceChanged += OnPrice;
      private void OnPrice(object? sender, decimal price) { }
      public void Close() { /* bug: no -= here */ }
      public void Dispose() => _feed.PriceChanged -= OnPrice; // the fix: unsubscribe
  }
popularity: 8.7
isPublished: true
---
