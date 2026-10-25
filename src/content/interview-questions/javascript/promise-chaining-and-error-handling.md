---
course: javascript
slug: promise-chaining-and-error-handling
experienceLevel: mid
difficulty: medium
tags:
  - promises
  - error-handling
question: How does promise chaining work, and how do errors propagate through a chain?
answer: |
  Every `.then()` returns a **new** promise, so you chain steps by returning a value or a promise from each handler; an error thrown anywhere skips the following `then` handlers until it reaches the nearest `.catch()`.

  How values flow:

  - Returning a plain value fulfills the next promise with that value.
  - Returning a promise (or thenable) makes the chain wait for it and adopt its result.
  - Throwing, or returning a rejected promise, rejects the next promise.
  - `.catch(fn)` is shorthand for `.then(undefined, fn)`. If the handler returns normally, the chain is **recovered** and continues as fulfilled.
  - `.finally(fn)` runs on either outcome, receives no argument and passes the original result or error through, unless it throws itself.

  Common mistakes:

  1. **Forgetting to return.** In `then(() => { saveUser(); })` the next step runs immediately with `undefined`, and any error from `saveUser` becomes an unhandled rejection.
  2. **Nesting** `then` calls inside each other instead of returning the inner promise and keeping the chain flat.
  3. Using `then(onSuccess, onError)` and expecting `onError` to catch errors thrown by `onSuccess`. It does not; a trailing `.catch()` does.
  4. Catching only to log, which turns a failure into success with `undefined`. Rethrow if callers need to know.
  5. Leaving the chain without any `.catch()`. In Node.js 15+ an unhandled rejection crashes the process by default.

  Practical guidance: put one `.catch()` at the end of the chain for errors you cannot handle locally, and add intermediate `.catch()` handlers only where you can genuinely recover, for example by falling back to cached data. In new code `async`/`await` with `try`/`catch` usually reads better, but it follows exactly these rules underneath.
codeExample: |
  const getUser = (id) =>
    id > 0 ? Promise.resolve({ id, name: 'Ada' }) : Promise.reject(new Error('bad id'));

  getUser(1)
    .then((user) => user.name)                      // return a value
    .then((name) => getUser(-1).then(() => name))   // return a promise: chain waits
    .then((name) => console.log('never runs', name))
    .catch((err) => {
      console.log('caught:', err.message);
      return 'fallback';                            // recover the chain
    })
    .then((value) => console.log('continued with', value))
    .finally(() => console.log('cleanup'));

  // then(onSuccess, onError) does NOT catch errors thrown in onSuccess
  Promise.resolve(1)
    .then(
      () => { throw new Error('thrown in success handler'); },
      () => console.log('not called'),
    )
    .catch((err) => console.log('outer catch:', err.message));

  // Output:
  // outer catch: thrown in success handler
  // caught: bad id
  // continued with fallback
  // cleanup
popularity: 8.6
isPublished: true
---
