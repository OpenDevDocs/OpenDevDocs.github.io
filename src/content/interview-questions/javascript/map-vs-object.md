---
course: javascript
slug: map-vs-object
experienceLevel: mid
difficulty: easy
tags:
  - collections
  - objects
question: "When should you use a `Map` instead of a plain object?"
answer: |
  Use a `Map` when you need a true key-value collection, especially with dynamic keys, non-string keys or frequent additions and removals; use a plain object for fixed, known-shape records such as a user or a config, and for data that must go through JSON.

  Differences that matter:

  - **Key types**: object keys are strings or symbols, so `obj[1]` and `obj['1']` are the same key and an object used as a key becomes `'[object Object]'`. A `Map` accepts any value as a key, including objects, functions and `NaN`, compared by identity (SameValueZero).
  - **Size**: `map.size` is direct; for objects you need `Object.keys(obj).length`.
  - **Order**: `Map` iterates in insertion order. Objects mostly do too, but integer-like keys come first in ascending numeric order.
  - **Iteration**: a `Map` is iterable (`for (const [k, v] of map)`); a plain object needs `Object.entries`.
  - **No inherited keys**: a plain object inherits from `Object.prototype`, so `'toString' in obj` is true and keys like `__proto__` from user input can cause prototype pollution. A `Map` has no such issue (nor does `Object.create(null)`).
  - **Performance**: engines optimise `Map` for frequent insertions and deletions. Objects are optimised for stable shapes; adding and deleting many keys can push them into slower dictionary mode.
  - **JSON**: `JSON.stringify(map)` gives `{}`. Convert first with `Object.fromEntries(map)` (string keys only) or `[...map]`.

  Pitfalls:

  - Do not set entries with bracket syntax: `map['key'] = 1` creates a normal property on the Map object, invisible to `get`, `size` and iteration. Always use `set` and `get`.
  - Object keys in a `Map` are compared by reference, so `map.get({ id: 1 })` with a new object literal returns `undefined`.
  - A `Map` holds its keys strongly; use a `WeakMap` when keys are objects whose lifetime you do not control.

  ES2024 added `Map.groupBy(items, fn)`, which returns a `Map` of groups, useful when the group keys are not strings.
codeExample: |
  const obj = {};
  obj[1] = 'number key';
  obj['1'] = 'string key';                     // same key as 1
  obj[{ id: 1 }] = 'object key';               // key becomes '[object Object]'
  console.log(Object.keys(obj));               // Output: [ '1', '[object Object]' ]

  const map = new Map();
  const userKey = { id: 1 };
  map.set(1, 'number key').set('1', 'string key').set(userKey, 'object key');
  console.log(map.size, map.get(1), map.get(userKey)); // Output: 3 number key object key
  console.log(map.get({ id: 1 }));             // Output: undefined (different reference)

  const order = { b: 1, 2: 'x', a: 2, 1: 'y' };
  console.log(Object.keys(order));             // Output: [ '1', '2', 'b', 'a' ]
  console.log([...new Map(Object.entries({ b: 1, a: 2 })).keys()]); // Output: [ 'b', 'a' ]

  console.log('toString' in {}, new Map().has('toString')); // Output: true false

  map.oops = 'not an entry';                   // property, not a Map entry
  console.log(map.size, map.get('oops'));      // Output: 3 undefined

  const scores = new Map([['ada', 90], ['bob', 75]]);
  console.log(JSON.stringify(scores), JSON.stringify(Object.fromEntries(scores)));
  // Output: {} {"ada":90,"bob":75}

  const byPass = Map.groupBy([90, 40, 75], (s) => s >= 50);
  console.log(byPass.get(true), byPass.get(false)); // Output: [ 90, 75 ] [ 40 ]
popularity: 8.4
isPublished: true
---
