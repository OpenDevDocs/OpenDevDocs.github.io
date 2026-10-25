---
course: javascript
slug: iteration-protocols
experienceLevel: mid
difficulty: hard
tags:
  - iterators
  - symbols
  - generators
question: What are the iterable and iterator protocols, and how do you make an object iterable?
answer: |
  An **iterable** is any object with a `[Symbol.iterator]()` method that returns an **iterator**, and an iterator is an object with a `next()` method that returns `{ value, done }` results; implementing these two small contracts lets your objects work with `for...of`, spread, destructuring, `Array.from`, `Promise.all`, `new Map(...)` and `yield*`.

  The contracts:

  - **Iterable**: `obj[Symbol.iterator]()` returns a fresh iterator.
  - **Iterator**: `next()` returns `{ value, done: false }` for each item and finally `{ value: undefined, done: true }`.
  - **Optional `return()`**: called when the consumer stops early (`break`, `throw`, destructuring fewer items). Use it to release resources.
  - **Async variants**: `[Symbol.asyncIterator]()` and a `next()` that returns a promise, consumed with `for await...of`.

  Built-in iterables include arrays, strings (iterated by code point, so emoji are not split), `Map`, `Set`, `arguments`, typed arrays and DOM collections like `NodeList`. Plain objects are **not** iterable; use `Object.entries(obj)` to iterate them.

  Ways to implement it:

  1. **By hand**, returning an object with `next()`. Verbose but shows the protocol clearly.
  2. **With a generator**: `*[Symbol.iterator]() { ... yield item; }`. Generators implement both protocols, including `return()`, so this is the usual choice.

  Pitfalls:

  - An iterable should return a **new** iterator each time, so it can be looped more than once. Iterators themselves (like generator objects) are usually single-use: their `[Symbol.iterator]()` returns `this`.
  - Infinite iterables work with `for...of` plus `break`, but spreading them hangs forever.
  - Array-like (`{ length: 2, 0: 'a', 1: 'b' }`) is not the same as iterable. `Array.from` accepts both; spread only accepts iterables.

  ES2025 iterator helpers (`map`, `filter`, `take`, `drop`, `toArray`, plus `Iterator.from`) let you transform iterators lazily without converting them to arrays first.
codeExample: |
  // Manual implementation of both protocols
  const countdown = {
    from: 3,
    [Symbol.iterator]() {
      let current = this.from;
      return {
        next: () => (current > 0 ? { value: current--, done: false } : { value: undefined, done: true }),
        return: () => { console.log('closed early'); return { done: true }; },
      };
    },
  };

  console.log([...countdown]);           // Output: [ 3, 2, 1 ]
  const [first] = countdown;             // Output: closed early
  console.log(first);                    // Output: 3

  // Generator-based implementation on a class
  class Playlist {
    #songs = [];
    add(...songs) { this.#songs.push(...songs); return this; }
    *[Symbol.iterator]() {
      for (const song of this.#songs) yield song.toUpperCase();
    }
  }

  const list = new Playlist().add('intro', 'outro');
  for (const song of list) console.log(song); // Output: INTRO then OUTRO
  console.log(Array.from(list).length, [...list].length); // Output: 2 2 (reusable)

  console.log([...'héllo👋'].length);   // Output: 6 (code points, emoji kept whole)
  console.log(typeof {}[Symbol.iterator]); // Output: undefined (plain objects are not iterable)
popularity: 7.2
isPublished: true
---
