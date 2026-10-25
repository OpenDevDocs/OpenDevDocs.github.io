---
course: javascript
slug: deep-copy-with-structuredclone
experienceLevel: mid
difficulty: medium
tags:
  - objects
  - immutability
question: "How do you deep copy an object in JavaScript, and what are the limits of `structuredClone`?"
answer: |
  Use the built-in `structuredClone(value)`, available in all modern browsers and Node.js 17+: it recursively copies objects and arrays and, unlike the old `JSON.parse(JSON.stringify(obj))` trick, it keeps `Date`, `Map`, `Set`, `RegExp`, typed arrays, `BigInt`, `undefined` values and even circular references intact.

  Shallow vs deep:

  - Spread (`{ ...obj }`, `[...arr]`) and `Object.assign` copy only the top level. Nested objects are still shared, so mutating `copy.address.city` also changes the original.
  - A deep copy duplicates every nested level, so the copy and the original are fully independent.

  What `structuredClone` cannot do:

  - **Functions** and DOM nodes throw a `DataCloneError`. Note that a class instance with methods is fine, because methods live on the prototype, not on the instance.
  - **Prototypes are lost.** A cloned class instance becomes a plain object, so `instanceof` fails and methods disappear.
  - Property **getters and setters** are not copied; their current values are copied instead. Private `#fields` are skipped, and so are symbol-keyed properties.
  - `Error` objects are supported, but only standard properties are reliably preserved.

  Why not JSON? `JSON.stringify` turns a `Date` into a string, drops `undefined` and functions, turns `NaN` and `Infinity` into `null`, throws on `BigInt` and throws on circular references.

  Practical guidance:

  - Default to `structuredClone` for plain data: state snapshots, test fixtures, data from an API.
  - For class instances, write an explicit `clone()` method or a static `from()` factory.
  - Often you do not need a deep copy at all. Immutable updates that copy only the path you change (`{ ...state, user: { ...state.user, name } }`) are cheaper and keep unchanged parts shared.
  - `structuredClone` also supports `transfer` for moving `ArrayBuffer`s without copying.
codeExample: |
  const original = {
    name: 'Ada',
    joined: new Date('2024-01-15T00:00:00Z'),
    tags: new Set(['admin']),
    address: { city: 'London' },
    missing: undefined,
  };
  original.self = original; // circular reference

  const shallow = { ...original };
  shallow.address.city = 'Paris';
  console.log(original.address.city); // Output: Paris (nested object was shared)

  const deep = structuredClone(original);
  deep.address.city = 'Berlin';
  console.log(original.address.city, deep.address.city); // Output: Paris Berlin
  console.log(deep.joined instanceof Date, deep.tags.has('admin')); // Output: true true
  console.log(deep.self === deep, 'missing' in deep);      // Output: true true

  const json = JSON.parse(JSON.stringify({ joined: original.joined, missing: undefined }));
  console.log(json); // Output: { joined: '2024-01-15T00:00:00.000Z' }

  class User { constructor(n) { this.n = n; } hi() { return this.n; } }
  console.log(structuredClone(new User('x')) instanceof User); // Output: false

  try {
    structuredClone({ fn: () => 1 });
  } catch (err) {
    console.log(err.name); // Output: DataCloneError
  }
popularity: 8.2
isPublished: true
---
