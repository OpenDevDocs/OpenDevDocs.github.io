---
course: javascript
slug: error-handling-with-async-await
experienceLevel: mid
difficulty: medium
tags:
  - async-await
  - error-handling
  - promises
question: How do you handle errors with async/await, and what happens to unhandled rejections?
answer: |
  With `async`/`await` you handle errors with ordinary `try`/`catch`: `await` unwraps a fulfilled promise into a value and turns a rejected promise into an exception thrown at that line.

  Key points:

  - An `async` function always returns a promise. Throwing inside it rejects that promise; it never throws synchronously to the caller.
  - `try`/`catch` only catches rejections you **await** inside the `try`. A bare `return promise` inside `try` bypasses the local `catch` and `finally` handling of the rejection; write `return await promise` when you want them to apply.
  - A promise you start but never await (a "floating" promise) escapes every `try` block. Await it, pass it to `Promise.all`, or attach a `.catch()`.
  - `finally` is the right place for cleanup such as closing a connection or hiding a spinner.

  Unhandled rejections:

  - If a rejected promise has no handler once the current microtasks have run, the host reports it. Browsers fire an `unhandledrejection` event on `window` and log an error.
  - Node.js 15+ defaults to `--unhandled-rejections=throw`: it emits `process.on('unhandledRejection')`, and if nothing is listening the process crashes with a non-zero exit code.
  - Use these global hooks for logging and monitoring, not as the main error-handling strategy.

  Practical guidance:

  1. Catch where you can do something useful (retry, fallback value, user message); otherwise let the error propagate to a higher level.
  2. Throw `Error` objects, not strings, so stack traces survive, and use `new Error(msg, { cause })` when wrapping a lower-level error.
  3. Treat the caught value as unknown: check `err instanceof Error` before reading `err.message`.
  4. In larger codebases, enable a lint rule such as `@typescript-eslint/no-floating-promises`.
codeExample: |
  async function loadConfig(fail) {
    await new Promise((r) => setTimeout(r, 10));
    if (fail) throw new Error('config not found');
    return { debug: true };
  }

  async function withoutAwait() {
    try { return loadConfig(true); }    // rejection escapes this try
    catch { return 'never used'; }
  }

  async function withAwait() {
    try {
      return await loadConfig(true);    // rejection is caught here
    } catch (err) {
      return `fallback (${err.message})`;
    } finally {
      console.log('finally runs');
    }
  }

  process.on('unhandledRejection', (reason) => console.log('unhandledRejection:', reason.message));

  async function main() {
    console.log(await withAwait());
    await withoutAwait().catch((err) => console.log('caller caught:', err.message));
    loadConfig(true);                   // floating promise: nobody handles it
  }
  main();

  // Output:
  // finally runs
  // fallback (config not found)
  // caller caught: config not found
  // unhandledRejection: config not found
popularity: 8.8
isPublished: true
---
