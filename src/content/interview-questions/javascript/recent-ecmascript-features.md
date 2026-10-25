---
course: javascript
slug: recent-ecmascript-features
experienceLevel: senior
difficulty: medium
tags:
  - ecmascript
  - language-features
question: Which recent ECMAScript features (ES2023 to ES2025) are most useful in day-to-day code?
answer: |
  TC39 publishes a new edition every June, containing proposals that reached Stage 4 that year. The most practical recent additions are:

  **ES2023**

  - `findLast` and `findLastIndex` on arrays.
  - **Change array by copy**: `toSorted`, `toReversed`, `toSpliced` and `with(index, value)`, the non-mutating versions of `sort`, `reverse`, `splice` and index assignment. They are ideal for immutable state updates.
  - Symbols allowed as `WeakMap` keys, and hashbang (`#!`) support in scripts.

  **ES2024**

  - `Object.groupBy` and `Map.groupBy`, which replace hand-written `reduce` grouping. `Object.groupBy` returns a null-prototype object.
  - `Promise.withResolvers()`, which returns `{ promise, resolve, reject }` for bridging callback or event APIs.
  - The regex `v` flag (set operations and string properties in character classes), `String.prototype.isWellFormed` and `toWellFormed`, resizable `ArrayBuffer` with `transfer`, and `Atomics.waitAsync`.

  **ES2025**

  - **Iterator helpers**: `map`, `filter`, `take`, `drop`, `flatMap`, `reduce`, `toArray` and others on iterators, evaluated **lazily**, plus `Iterator.from`.
  - **Set methods**: `union`, `intersection`, `difference`, `symmetricDifference`, `isSubsetOf`, `isSupersetOf`, `isDisjointFrom`.
  - `Promise.try`, import attributes with JSON modules (`import data from './x.json' with { type: 'json' }`), `RegExp.escape`, regex modifiers, duplicate named capture groups, and `Float16Array`.

  Adoption advice for a real codebase: check your **lowest supported runtime**, not just the latest Chrome. Node 22+ and evergreen browsers cover most of the list, but users on older Safari versions may lack the newest items. TypeScript needs a matching `lib` setting (for example `ES2024` or `ESNext`) to type them. Some, like iterator helpers, can't be fully transpiled and need a polyfill (core-js). Prefer these built-ins over utility libraries where they fit; they're well tested and reduce bundle size.
codeExample: |
  // ES2023: change array by copy
  const scores = [42, 7, 19];
  console.log(scores.toSorted((a, b) => a - b), scores);  // Output: [ 7, 19, 42 ] [ 42, 7, 19 ]
  console.log(scores.with(1, 8), scores.findLast((n) => n > 10)); // Output: [ 42, 8, 19 ] 19

  // ES2024: grouping and promise resolvers
  const orders = [{ id: 1, status: 'paid' }, { id: 2, status: 'open' }, { id: 3, status: 'paid' }];
  const byStatus = Object.groupBy(orders, (o) => o.status);
  console.log(Object.keys(byStatus), byStatus.paid.map((o) => o.id)); // Output: [ 'paid', 'open' ] [ 1, 3 ]

  const { promise, resolve } = Promise.withResolvers();
  setTimeout(() => resolve('event fired'), 10);

  // ES2025: Set methods and lazy iterator helpers
  const admins = new Set(['ana', 'bo']);
  const active = new Set(['bo', 'cy']);
  console.log(admins.intersection(active), admins.union(active).size); // Output: Set(1) { 'bo' } 3

  function* naturals() { let n = 1; while (true) yield n++; }
  console.log(naturals().filter((n) => n % 2).map((n) => n * n).take(3).toArray());
  // Output: [ 1, 9, 25 ]   (works on an infinite generator because it's lazy)

  const literal = new RegExp(RegExp.escape('1+1=2?'));       // escapes + and ? safely
  console.log(literal.test('is 1+1=2?'), literal.test('11=2')); // Output: true false

  Promise.try(() => JSON.parse('{"ok":true}')).then((v) => console.log(v.ok));
  promise.then(console.log);
  // Output: true
  // Output: event fired
popularity: 8.5
isPublished: true
---
