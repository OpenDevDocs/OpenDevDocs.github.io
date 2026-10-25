---
title: "async/await in JavaScript and C#: Same Keywords, Different Machinery"
slug: async-await-javascript-vs-csharp
metadescription: JavaScript and C# both use async and await, but promises and tasks behave differently. A side-by-side look at threads, scheduling, errors and cancellation.
featuredImage: ""
publishDate: 2026-09-02T09:00:00.000Z
updateDate: 2026-09-02T09:00:00.000Z
author:
  - bishal-biswas
category: Deep Dives
tags:
  - javascript
  - c-sharp
  - async
isDraft: false
---

C# introduced `async` and `await` in 2012, and JavaScript adopted the same keywords in 2017. Code written with them looks almost identical in both languages, which is helpful when you switch between a [JavaScript](/courses/javascript) front end and a [C#](/courses/c-sharp) back end. It is also a trap, because the machinery underneath is quite different. This post compares the two side by side.

## What looks the same

Here is a function that loads a user and their orders in JavaScript:

```js
async function loadDashboard(userId) {
  const user = await getUser(userId);
  const orders = await getOrders(user.id);
  return { user, orders };
}
```

And in C#:

```csharp
async Task<Dashboard> LoadDashboardAsync(int userId)
{
    var user = await GetUserAsync(userId);
    var orders = await GetOrdersAsync(user.Id);
    return new Dashboard(user, orders);
}
```

In both languages:

- An `async` function always returns a wrapper rather than the plain value: a `Promise` in JavaScript, a `Task<T>` in C#.
- `await` pauses the function until the awaited operation finishes, without blocking whatever called it.
- The code reads top to bottom like ordinary synchronous code, and `try`/`catch` works around an `await`.

That is where the similarity ends.

## Threads: one or many

**JavaScript** runs your code on a single thread. There is an event loop that picks up the next piece of work when the current one finishes. When a function hits `await`, it hands control back to the event loop, which runs other code. When the awaited promise settles, the rest of the function is queued and runs later, on the same thread.

That means two pieces of your JavaScript never run at the same instant. You do not need locks to protect shared variables. You do need to avoid long CPU-bound loops, because nothing else can run until they finish. For heavy computation you use Web Workers in the browser or `worker_threads` in Node.js.

**C#** has real threads. When an `async` method hits `await` on an operation that has not finished, it returns to its caller and the current thread is free to do other work. When the operation completes, the rest of the method runs, and in a server app such as ASP.NET Core that is usually on **any available thread pool thread**, not necessarily the one it started on. Two continuations can run at the same instant on different cores, so shared state needs proper synchronisation.

For CPU-bound work, C# can push it onto the thread pool with `Task.Run`, and it really does run in parallel with everything else.

## When the code after await runs

Look at this JavaScript:

```js
async function demo() {
  console.log('A');
  await null;
  console.log('C');
}

demo();
console.log('B');
// Output: A, B, C
```

The body of an async function runs synchronously up to the first `await`. Even though `null` is not a promise and there is nothing to wait for, `await` always defers the rest of the function to a **microtask**, which runs after the current synchronous code finishes. So `B` prints before `C`.

C# behaves differently:

```csharp
async Task DemoAsync()
{
    Console.WriteLine("A");
    await Task.CompletedTask;
    Console.WriteLine("C");
}

var task = DemoAsync();
Console.WriteLine("B");
await task;
// Output: A, C, B
```

When C# awaits a task that has **already completed**, it does not yield at all. It checks the awaiter's `IsCompleted` property, sees `true`, and carries straight on. So `C` prints before `B`. Only when the task is still running does the method return to its caller and schedule the rest for later.

This is one reason `ValueTask` exists in C#. Methods that usually complete synchronously, such as a read from a cache, can avoid allocating a `Task` object on that fast path.

## Under the hood: generators and state machines

In both languages, the compiler or engine turns your async function into something that can stop and resume.

The C# compiler rewrites every `async` method into a **state machine**: a generated type with a field for each local variable that lives across an `await`, and a `MoveNext` method containing your code split at each `await`. You can see it with a decompiler such as ILSpy or on sharplab.io. Knowing this explains several C# rules, for example why `ref` locals and `Span<T>` cannot be held across an `await`: they would have to be stored in a field of that state machine.

JavaScript engines implement async functions natively, but the model is very close to generators that yield promises. In fact, before `async`/`await` existed, libraries implemented the same pattern with generator functions and `yield`.

## Errors

In JavaScript, a thrown error inside an async function **rejects** its promise. If nobody awaits the promise or attaches a `.catch`, it becomes an unhandled rejection. Browsers log it to the console; Node.js, since version 15, terminates the process by default. Always await or handle the promises you create.

In C#, an exception inside an async method is captured and stored in the returned `Task`. It is rethrown when you `await` the task. If you never await it, the exception is silently lost, unless you handle the `TaskScheduler.UnobservedTaskException` event.

The one big exception is `async void`. An `async void` method has no task to store the exception in, so an exception escaping it is raised directly on the synchronization context or thread pool and usually crashes the process. Use `async void` only for event handlers.

## Running things at the same time

Both languages let you start several operations and wait for all of them:

```js
const [user, settings] = await Promise.all([getUser(id), getSettings(id)]);
```

```csharp
var userTask = GetUserAsync(id);
var settingsTask = GetSettingsAsync(id);
await Task.WhenAll(userTask, settingsTask);
var user = userTask.Result;       // safe: the task has already completed
var settings = settingsTask.Result;
```

They differ when something fails. `Promise.all` rejects as soon as **any** promise rejects, with that first error; the other operations keep running, but their results are ignored. Use `Promise.allSettled` when you want every outcome.

`Task.WhenAll` waits for **all** the tasks to finish, even when one fails. Awaiting it rethrows the first exception, and the returned task's `Exception` property holds an `AggregateException` with all of them.

## Blocking on async code

In JavaScript, there is no way to block and wait synchronously for a promise. The only options are `await` or `.then`. That restriction is a feature: you cannot accidentally freeze the event loop waiting on itself.

In C#, you can call `.Result` or `.Wait()` on a task to block the current thread until it completes. This is called **sync over async**, and it causes real trouble. In apps with a synchronization context, such as older ASP.NET or desktop UI apps, it can deadlock: the blocked thread is the one the continuation needs to run on. In ASP.NET Core it wastes a thread pool thread for the whole wait, which can starve the pool under load. The rule is simple: async all the way up.

## Cancellation

C# has cancellation built into the async model. Methods accept a `CancellationToken`, and the caller cancels through a `CancellationTokenSource`:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
var response = await httpClient.GetAsync(url, cts.Token);
```

JavaScript promises have no cancellation of their own. The standard approach is an `AbortController`, whose `signal` you pass to APIs that support it, such as `fetch`:

```js
const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

In both cases cancellation is cooperative. The operation has to check the token or signal; nothing is forcibly stopped.

## Summary

| | JavaScript | C# |
| --- | --- | --- |
| Return type | `Promise` | `Task`, `Task<T>`, `ValueTask<T>` |
| Threads | One thread and an event loop | Thread pool, continuations on any thread |
| Already-finished await | Always defers to a microtask | Continues synchronously |
| Unawaited error | Unhandled rejection; Node.js exits | Lost silently, except in `async void` |
| Wait for all | `Promise.all` rejects on the first error | `Task.WhenAll` waits for every task |
| Blocking wait | Not possible | `.Result` / `.Wait()`, best avoided |
| Cancellation | `AbortController` and `AbortSignal` | `CancellationToken` |

If you write both languages, keep the shared intuition: `await` means "pause here without blocking". Then remember the differences that bite: threads in C#, microtask ordering in JavaScript, and the way each language treats errors that nobody awaits.
