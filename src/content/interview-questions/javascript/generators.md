---
course: javascript
slug: generators
experienceLevel: mid
difficulty: medium
tags:
  - generators
  - iterators
question: What are generator functions and when would you use them?
answer: |
  A generator function (`function*`) is a function that can pause and resume: calling it returns a generator object without running the body, and each call to `next()` runs the body until the next `yield`, returning `{ value, done }`.

  How it works:

  - `yield value` pauses execution and hands `value` to the caller. Local variables and the position in the code are preserved until the next `next()` call.
  - When the function returns, `next()` gives `{ value: returnValue, done: true }`. Note that `for...of` and spread **ignore** that final return value.
  - Generators are iterators **and** iterables, so they work with `for...of`, spread, destructuring and `Array.from`.
  - `next(x)` sends a value back in: it becomes the result of the paused `yield` expression. The first `next()` argument is ignored because no `yield` is waiting yet.
  - `return(value)` finishes the generator early, running any `finally` blocks. `throw(err)` throws an error at the paused `yield`.
  - `yield* other` delegates to another iterable or generator.

  Practical uses:

  - **Lazy sequences**: produce values on demand, including infinite ones such as IDs or pagination cursors, without building a whole array.
  - **Custom iteration**: implement `[Symbol.iterator]` on a class (a tree, a linked list) with a few lines of `yield`.
  - **Pipelines**: chain `map`/`filter`/`take` steps that process one item at a time.
  - **Async generators** (`async function*` with `for await...of`) are the natural way to consume paginated APIs and streams.
  - Historically, libraries like co and redux-saga used generators to model async flows; `async`/`await` covers most of that today.

  Pitfalls:

  - A generator object can be iterated only **once**. After it is done, iterating again yields nothing.
  - Breaking out of a `for...of` calls `return()`, which closes the generator, so you cannot continue it later with another loop.
  - Generators cannot be arrow functions.

  ES2025 also adds iterator helpers such as `.map()`, `.filter()`, `.take()` and `.toArray()` directly on generator objects.
codeExample: |
  function* idGenerator(prefix) {
    let id = 1;
    while (true) {
      const reset = yield `${prefix}-${id}`;
      id = reset ? 1 : id + 1;
    }
  }

  const ids = idGenerator('user');
  console.log(ids.next().value, ids.next().value); // Output: user-1 user-2
  console.log(ids.next(true).value);               // Output: user-1 (value sent back in)

  function* range(start, end, step = 1) {
    for (let i = start; i < end; i += step) yield i;
    return 'done';
  }
  console.log([...range(0, 10, 3)]); // Output: [ 0, 3, 6, 9 ] (return value ignored)

  const r = range(0, 2);
  console.log(r.next(), r.next(), r.next());
  // Output: { value: 0, done: false } { value: 1, done: false } { value: 'done', done: true }

  function* withCleanup() {
    try { yield 1; yield 2; } finally { console.log('cleanup'); }
  }
  for (const v of withCleanup()) { console.log(v); break; } // Output: 1 then cleanup

  // ES2025 iterator helpers on an infinite generator
  const evens = idGenerator('n').map((s) => Number(s.slice(2)) * 2).take(3).toArray();
  console.log(evens); // Output: [ 2, 4, 6 ]
popularity: 7.7
isPublished: true
---
