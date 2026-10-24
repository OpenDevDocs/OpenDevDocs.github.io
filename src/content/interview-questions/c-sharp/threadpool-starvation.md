---
course: c-sharp
slug: threadpool-starvation
experienceLevel: senior
difficulty: hard
tags:
  - threading
  - performance
question: "What is thread pool starvation in .NET, and how do you diagnose and fix it?"
answer: |
  **Thread pool starvation** happens when all thread pool threads are **blocked** while work items keep piling up in the queue. The pool responds by injecting new threads, but only **gradually**, so under load the queue grows faster than threads are added. Latency climbs and requests start timing out.

  The usual cause is **sync-over-async**: `.Result`, `.Wait()`, or `GetAwaiter().GetResult()` on tasks, often deep inside a library. Each blocked call holds a pool thread hostage while it waits for a continuation that itself needs a pool thread. `Thread.Sleep`, synchronous I/O, and long-held locks contribute too.

  Symptoms: rising response times with **low CPU usage**, a slowly climbing thread count, and a growing thread pool queue.

  Diagnosis:

  - `dotnet-counters monitor` shows the thread pool queue length, thread count, and completed work items per second.
  - `dotnet-stack report`, or a memory dump analyzed with `dotnet-dump` (`clrstack -all`), shows many threads parked in `Task.Wait`, `Monitor.Wait`, or similar calls.

  The fix is to **remove the blocking** and go async all the way down. Raising `ThreadPool.SetMinThreads` can buy time during an incident, but it treats the symptom and costs memory.
codeExample: |
  // BAD: blocks a pool thread per request while waiting for I/O
  app.MapGet("/blocking", () =>
  {
      var data = FetchAsync().Result;        // sync-over-async: starves the pool
      return data;
  });

  // GOOD: the thread returns to the pool during the await
  app.MapGet("/async", async () => await FetchAsync());

  static async Task<string> FetchAsync()
  {
      await Task.Delay(500);                 // stands in for a database or HTTP call
      return "ok";
  }

  // Diagnose under load (terminal):
  //   dotnet-counters monitor -n MyApp --counters System.Runtime
  //     -> the thread pool queue length and thread count keep climbing
  //   dotnet-dump collect -n MyApp, then dotnet-dump analyze <dump-file>
  //     -> clrstack -all shows threads stuck in Task.Wait / GetResult

  // Emergency stopgap only, not a fix:
  // ThreadPool.SetMinThreads(workerThreads: 200, completionPortThreads: 200);
popularity: 7.7
isPublished: true
---
