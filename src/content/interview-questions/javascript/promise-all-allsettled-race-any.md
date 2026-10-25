---
course: javascript
slug: promise-all-allsettled-race-any
experienceLevel: mid
difficulty: medium
tags:
  - promises
  - async
question: "What is the difference between `Promise.all`, `Promise.allSettled`, `Promise.race` and `Promise.any`?"
answer: |
  All four take an iterable of promises and return one promise; they differ in **when** that promise settles and **what** it settles with.

  - `Promise.all` fulfills with an array of values, in input order, when **every** promise fulfills. It rejects as soon as **any** one rejects, with that reason. Use it when every result is required.
  - `Promise.allSettled` never rejects. It waits for all of them and fulfills with objects shaped `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }`. Use it for independent operations where partial success is fine.
  - `Promise.race` settles the same way as the **first** promise to settle, whether it fulfills or rejects. A typical use is racing an operation against a timeout.
  - `Promise.any` fulfills with the first **fulfilled** value and ignores rejections. Only if all of them reject does it reject, with an `AggregateError` whose `errors` array holds every reason. Use it for "first successful mirror" logic.

  Pitfalls:

  - None of them cancels the other operations. After `Promise.all` rejects or `race` settles, the remaining work keeps running. Pass an `AbortSignal` if you need to stop it.
  - The work starts when the promises are created, not when they are passed in. These helpers only wait.
  - Empty input: `all` and `allSettled` fulfill with `[]`, `any` rejects with an `AggregateError`, and `race` stays pending forever.
  - Non-promise values in the input are treated as already-fulfilled values.

  Practical guidance: default to `Promise.all` for "I need everything", switch to `allSettled` when failures should be reported individually instead of failing the whole batch, and for timeouts on APIs like `fetch` prefer `AbortSignal.timeout(ms)` over a hand-written `race`, because it actually cancels the request.
codeExample: |
  const delay = (ms, value, fail = false) =>
    new Promise((resolve, reject) =>
      setTimeout(() => (fail ? reject(new Error(value)) : resolve(value)), ms));

  async function main() {
    console.log(await Promise.all([delay(30, 'a'), delay(10, 'b')]));
    // Output: [ 'a', 'b' ]

    try {
      await Promise.all([delay(30, 'a'), delay(10, 'boom', true)]);
    } catch (err) {
      console.log('all rejected:', err.message); // Output: all rejected: boom
    }

    const settled = await Promise.allSettled([delay(10, 'ok'), delay(20, 'bad', true)]);
    console.log(settled.map((r) => r.status)); // Output: [ 'fulfilled', 'rejected' ]

    console.log(await Promise.race([delay(50, 'slow'), delay(10, 'fast')])); // Output: fast

    console.log(await Promise.any([delay(10, 'x', true), delay(20, 'first success')]));
    // Output: first success

    try {
      await Promise.any([delay(10, 'e1', true), delay(20, 'e2', true)]);
    } catch (err) {
      console.log(err.constructor.name, err.errors.map((e) => e.message));
      // Output: AggregateError [ 'e1', 'e2' ]
    }
  }

  main();
popularity: 9.1
isPublished: true
---
