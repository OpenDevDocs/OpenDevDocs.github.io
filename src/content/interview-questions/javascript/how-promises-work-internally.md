---
course: javascript
slug: how-promises-work-internally
experienceLevel: senior
difficulty: hard
tags:
  - promises
  - async
question: How do promises work internally, and how would you implement a minimal one?
answer: |
  A promise is a small state machine: **pending**, then exactly once either **fulfilled** with a value or **rejected** with a reason. It keeps a list of reactions registered by `then`. When it settles, each reaction is scheduled as a **microtask**, never run synchronously. That is why `then` callbacks always run after the current synchronous code, even for an already-resolved promise.

  `then(onFulfilled, onRejected)` returns a **new** promise. Whatever the callback returns resolves that new promise, and whatever it throws rejects it. This is what makes chains and error propagation work. A missing handler passes the value or the error through.

  The subtle part is the **resolution procedure**. Resolving with a value is not the same as fulfilling with it:

  - Resolving a promise with itself rejects with a `TypeError`.
  - If the value is an object or function with a callable `then`, it is a **thenable**. The promise **adopts** its state by calling `then` with fresh resolve and reject functions. Only the first call counts, and an exception thrown by `then` rejects unless the promise already settled.
  - Otherwise the promise fulfils with the value.

  Native promises schedule the thenable's `then` call in its own job (`NewPromiseResolveThenableJob`). As a result, returning a promise from `then` or from an `async` function costs extra microtask ticks compared with returning a plain value. This explains some surprising orderings in tests.

  Practical consequences: wrap untrusted thenables with `Promise.resolve`, never rely on exact tick counts between independent chains, and remember that `await` on a native promise is cheaper than adopting a foreign thenable.
codeExample: |
  class MiniPromise {
    #state = 'pending'; #value; #reactions = [];
    constructor(executor) {
      let done = false;
      const once = (fn) => (v) => { if (!done) { done = true; fn(v); } };
      const reject = once((e) => this.#settle('rejected', e));
      try { executor(once((v) => this.#resolve(v)), reject); } catch (e) { reject(e); }
    }
    #resolve(v) {
      if (v === this) return this.#settle('rejected', new TypeError('cycle'));
      let then;
      try { then = Object(v) === v ? v.then : undefined; }
      catch (e) { return this.#settle('rejected', e); }
      if (typeof then !== 'function') return this.#settle('fulfilled', v);
      new MiniPromise((res, rej) => then.call(v, res, rej))     // adopt the thenable
        .then((x) => this.#resolve(x), (e) => this.#settle('rejected', e));
    }
    #settle(state, value) {
      if (this.#state !== 'pending') return;
      this.#state = state; this.#value = value;
      this.#reactions.forEach((react) => react());
    }
    then(onFulfilled, onRejected) {
      return new MiniPromise((res, rej) => {
        const react = () => queueMicrotask(() => {               // always async
          const ok = this.#state === 'fulfilled';
          const cb = ok ? onFulfilled : onRejected;
          if (typeof cb !== 'function') return (ok ? res : rej)(this.#value);
          try { res(cb(this.#value)); } catch (e) { rej(e); }
        });
        this.#state === 'pending' ? this.#reactions.push(react) : react();
      });
    }
  }

  new MiniPromise((r) => r({ then(ok) { ok(42); } }))
    .then((v) => { console.log('adopted', v); throw new Error('boom'); })
    .then(null, (e) => console.log('caught', e.message));
  console.log('sync first');
  // Output: sync first, then adopted 42, then caught boom

popularity: 8.3
isPublished: true
---
