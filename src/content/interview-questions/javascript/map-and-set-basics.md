---
course: javascript
slug: map-and-set-basics
experienceLevel: fresher
difficulty: easy
tags:
  - collections
  - es6
question: "What are `Map` and `Set`, and when would you use them instead of objects and arrays?"
answer: |
  A `Map` is a collection of key-value pairs where keys can be of any type, and a `Set` is a collection of unique values; use them instead of plain objects and arrays when you need non-string keys, guaranteed uniqueness or frequent additions and lookups.

  **`Map`**

  - Methods: `set(key, value)` (chainable), `get`, `has`, `delete`, `clear`, and the `size` property.
  - Keys can be objects, functions, numbers or any other value, and are compared by identity (`SameValueZero`), so `1` and `"1"` are different keys.
  - Remembers **insertion order** and is directly iterable with `for...of`, `forEach`, `keys()`, `values()` and `entries()`.
  - No inherited keys, so no clashes with names like `"constructor"` or `"__proto__"`.

  **`Set`**

  - Methods: `add` (chainable), `has`, `delete`, `clear`, and `size`.
  - Duplicates are ignored. `new Set(array)` is the idiomatic way to remove duplicates: `[...new Set(array)]`.
  - `has` is typically much faster than `array.includes` for large collections.
  - Since 2024, sets also have `union`, `intersection`, `difference` and `isSubsetOf` and related methods in current browsers and Node.js 22+.

  Pitfalls:

  - Objects are compared by reference: `set.add({ id: 1 })` twice stores two entries, and `map.get({ id: 1 })` will not find an object key created elsewhere.
  - Neither serialises with `JSON.stringify` (you get `{}`). Convert first with `Object.fromEntries(map)` or `[...set]`.
  - Writing `map[key] = value` sets a plain property on the `Map` object instead of an entry. Always use `set` and `get`.

  Plain objects remain a good fit for fixed, known shapes like a user record or JSON data.
codeExample: |
  const visits = new Map();
  const homePage = { path: "/" }; // an object as a key
  visits.set(homePage, 3).set("about", 1);

  console.log(visits.get(homePage), visits.size); // Output: 3 2
  console.log(visits.has("about"), visits.has("/")); // Output: true false

  for (const [key, count] of visits) {
    console.log(typeof key, count);
  }
  // Output: object 3
  // Output: string 1

  const tags = ["js", "css", "js", "html", "css"];
  const unique = new Set(tags);
  console.log(unique.size, [...unique]); // Output: 3 [ 'js', 'css', 'html' ]

  unique.add("js"); // ignored: already present
  console.log(unique.has("js"), unique.size); // Output: true 3

  const frontEnd = new Set(["html", "css", "js"]);
  const backEnd = new Set(["js", "sql"]);
  console.log([...frontEnd.intersection(backEnd)]); // Output: [ 'js' ]
  console.log(JSON.stringify(Object.fromEntries(new Map([["a", 1]])))); // Output: {"a":1}
popularity: 8.3
isPublished: true
---
