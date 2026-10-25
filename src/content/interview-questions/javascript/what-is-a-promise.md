---
course: javascript
slug: what-is-a-promise
experienceLevel: fresher
difficulty: medium
tags:
  - promises
  - async
question: What is a Promise in JavaScript?
answer: |
  A Promise is an object that represents the eventual result of an asynchronous operation: a value that will be available later, or an error explaining why it failed.

  A promise is always in one of three states:

  - **pending:** the operation has not finished yet.
  - **fulfilled:** it succeeded and has a value.
  - **rejected:** it failed and has a reason, usually an `Error`.

  Once fulfilled or rejected, it is **settled** and can never change state again.

  You consume a promise with:

  - `.then(onFulfilled)` to use the value. It returns a **new** promise, so calls can be chained, and whatever you return from the handler becomes the next value.
  - `.catch(onRejected)` to handle errors from any earlier step in the chain.
  - `.finally(fn)` to run clean-up code either way.

  You create one with `new Promise((resolve, reject) => { ... })`, although most of the time you use promises returned by APIs such as `fetch`. `Promise.resolve(value)` and `Promise.reject(error)` create already-settled promises.

  Promise callbacks always run **asynchronously**, as microtasks, even if the promise is already settled, so code after `.then` runs first.

  Common pitfalls:

  - Forgetting to `return` a promise inside `.then`, which breaks the chain and lets errors escape.
  - Not handling rejections. An unhandled rejection logs a warning in browsers and, by default, crashes a Node.js process.
  - Nesting `.then` calls instead of chaining them.

  For running several promises together, use combinators such as `Promise.all`. In modern code, `async`/`await` is usually the most readable way to work with promises.
codeExample: |
  function wait(ms, value, fail = false) {
    return new Promise((resolve, reject) => {
      setTimeout(() => (fail ? reject(new Error(value)) : resolve(value)), ms);
    });
  }

  wait(20, 5)
    .then((n) => n * 2) // returned values flow down the chain
    .then((n) => console.log("Result:", n))
    .catch((err) => console.log("Failed:", err.message))
    .finally(() => console.log("Done"));

  wait(10, "Network down", true)
    .then(() => console.log("never runs"))
    .catch((err) => console.log("Failed:", err.message));

  Promise.resolve("already settled").then(console.log);
  console.log("Synchronous code first");
  // Output: Synchronous code first
  // Output: already settled
  // Output: Failed: Network down
  // Output: Result: 10
  // Output: Done
popularity: 9.4
isPublished: true
---
