---
course: javascript
slug: async-iterators-and-for-await
experienceLevel: senior
difficulty: medium
tags:
  - async
  - iterators
  - generators
question: "How do async iterators and `for await...of` work, and when would you use them?"
answer: |
  An **async iterable** is an object with a `[Symbol.asyncIterator]()` method that returns an iterator whose `next()` returns a **promise** of `{ value, done }`. `for await...of` calls `next()`, awaits the result, runs the loop body, and only then asks for the next item. The consumer drives the pace, so async iteration is naturally **pull-based** and gives you backpressure for free.

  The easiest way to produce one is an **async generator** (`async function*`). It can `await` between `yield`s, which makes it ideal for:

  - Paginated APIs, where you fetch the next page only when the consumer needs it.
  - Reading streams line by line. Node readable streams and web `ReadableStream` (in Node and recent browsers) are async iterable.
  - Event sources, via `events.on(emitter, 'name')` in Node.

  Details that matter in production:

  - **Early exit cleans up**. `break`, `return` or a thrown error inside the loop calls the iterator's `return()` method, which runs the generator's `finally` block. Put resource cleanup there, such as closing a cursor or releasing a lock.
  - Iteration is **sequential**. Each item waits for the previous body to finish. For concurrency, collect promises in batches or use a bounded worker pool instead of awaiting one by one.
  - `for await` also accepts sync iterables of promises, but it awaits them one at a time. A rejection is only observed when the loop reaches it, so earlier rejections can be reported as unhandled. Use `Promise.all` for an array of already-started promises.
  - `Array.fromAsync()` (available in Node 22+ and current browsers) collects an async iterable into an array.
codeExample: |
  async function* fetchPages(totalPages) {
    try {
      for (let page = 1; page <= totalPages; page++) {
        await new Promise((r) => setTimeout(r, 10)); // simulated HTTP call
        console.log(`fetched page ${page}`);
        yield [`item-${page}a`, `item-${page}b`];
      }
    } finally {
      console.log('cursor closed');                 // runs on break too
    }
  }

  async function main() {
    for await (const items of fetchPages(10)) {
      console.log(items.join(', '));
      if (items[0] === 'item-2a') break;            // only fetch what we need
    }
  }

  main();
  // Output:
  // fetched page 1
  // item-1a, item-1b
  // fetched page 2
  // item-2a, item-2b
  // cursor closed
popularity: 7.8
isPublished: true
---
