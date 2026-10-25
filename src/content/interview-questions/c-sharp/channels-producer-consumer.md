---
course: c-sharp
slug: channels-producer-consumer
experienceLevel: senior
difficulty: hard
tags:
  - async
  - threading
question: "How do you build a producer/consumer pipeline with `System.Threading.Channels`?"
answer: |
  `System.Threading.Channels` provides fast, async-native queues for passing data between producers and consumers. A `Channel<T>` has a `Writer` side and a `Reader` side.

  Creating one:

  - `Channel.CreateUnbounded<T>()` never blocks writers, but a slow consumer lets it grow without limit.
  - `Channel.CreateBounded<T>(capacity)` gives **backpressure**. When it's full, `BoundedChannelFullMode` decides what happens: `Wait`, the default, makes `WriteAsync` wait for space, while `DropOldest`, `DropNewest`, and `DropWrite` discard items instead.
  - The `SingleReader` and `SingleWriter` options let the implementation use cheaper synchronization.

  Using it:

  - Producers call `await writer.WriteAsync(item, ct)`, and then `writer.Complete()` when there's no more data.
  - Consumers use `await foreach (var item in reader.ReadAllAsync(ct))`, which ends cleanly once the channel is completed and drained. For finer control, combine `WaitToReadAsync` with `TryRead`.
  - To scale out, start several consumer tasks on the same reader. Each item goes to exactly one consumer.

  Unlike `BlockingCollection<T>`, channels never block threads: all waiting is asynchronous. They're the standard building block for background processing with `BackgroundService` in ASP.NET Core.
codeExample: |
  using System.Threading.Channels;
  var channel = Channel.CreateBounded<int>(new BoundedChannelOptions(capacity: 10)
  {
      FullMode = BoundedChannelFullMode.Wait,     // backpressure: the producer waits
      SingleWriter = true
  });

  var producer = Task.Run(async () =>
  {
      for (int i = 1; i <= 100; i++)
          await channel.Writer.WriteAsync(i);     // waits while the channel is full
      channel.Writer.Complete();                  // no more data
  });

  // Three consumers share the reader; each item is processed exactly once
  var consumers = Enumerable.Range(1, 3).Select(id => Task.Run(async () =>
  {
      int sum = 0;
      await foreach (int item in channel.Reader.ReadAllAsync())
          sum += item;                            // simulate work per item
      return sum;
  })).ToArray();
  await producer;
  int[] sums = await Task.WhenAll(consumers);
  Console.WriteLine(sums.Sum());                  // Output: 5050
popularity: 7.2
isPublished: true
---
