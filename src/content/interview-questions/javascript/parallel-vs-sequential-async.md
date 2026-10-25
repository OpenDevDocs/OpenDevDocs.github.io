---
course: javascript
slug: parallel-vs-sequential-async
experienceLevel: mid
difficulty: medium
tags:
  - async-await
  - promises
  - performance
question: How do you run async operations in parallel versus sequentially?
answer: |
  Awaiting operations one after another runs them **sequentially**, so the total time is the sum of all of them; starting them all first and then awaiting `Promise.all` runs them **concurrently**, so the total time is roughly that of the slowest one.

  The key fact is that a promise's work starts when the promise is created, not when it is awaited:

  - `const a = await getA(); const b = await getB();` starts `getB` only after `getA` has finished.
  - `const [a, b] = await Promise.all([getA(), getB()]);` starts both immediately.

  When to use which:

  - **Sequential** when a step depends on the previous result (load the user, then that user's orders) or when order matters.
  - **Parallel** for independent operations, such as loading profile, settings and notifications for one page.
  - **Limited concurrency** for large lists. Firing 500 requests at once can overload a server or hit rate limits; process them in batches or with a small worker pool (libraries such as `p-limit` do this).

  Pitfalls:

  - `items.forEach(async (x) => { await save(x); })` does **not** wait for anything; `forEach` ignores the returned promises. Use `for...of` with `await` for sequential work, or `await Promise.all(items.map(save))` for parallel work.
  - `items.map(async ...)` gives you an array of promises, not results, until you await `Promise.all` on it.
  - Starting promises early and awaiting them one by one later is concurrent too, but if a later one rejects before you reach its `await`, you can get an unhandled rejection. `Promise.all` attaches handlers to all of them at once.
  - Concurrency here means waiting on I/O at the same time. CPU-heavy work still runs on the single main thread.

  Use `Promise.allSettled` instead of `Promise.all` when you want every result even if some operations fail.
codeExample: |
  const task = (name, ms) =>
    new Promise((resolve) => setTimeout(() => resolve(name), ms));
  const elapsed = (start) => `~${Math.round((Date.now() - start) / 100) * 100}ms`;

  async function main() {
    let start = Date.now();
    const a = await task('a', 100);
    const b = await task('b', 100);
    console.log('sequential', [a, b], elapsed(start)); // Output: sequential [ 'a', 'b' ] ~200ms

    start = Date.now();
    const both = await Promise.all([task('a', 100), task('b', 100)]);
    console.log('parallel', both, elapsed(start));      // Output: parallel [ 'a', 'b' ] ~100ms

    const done = [];
    [30, 10].forEach(async (ms) => done.push(await task(ms, ms)));
    console.log('after forEach:', done);                 // Output: after forEach: []

    for (const ms of [30, 10]) {
      done.push(await task(`loop ${ms}`, ms));
    }
    console.log(done); // Output: [ 10, 30, 'loop 30', 'loop 10' ]
  }

  main();
popularity: 8.7
isPublished: true
---
