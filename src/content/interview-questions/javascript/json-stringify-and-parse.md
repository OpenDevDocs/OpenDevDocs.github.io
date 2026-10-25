---
course: javascript
slug: json-stringify-and-parse
experienceLevel: fresher
difficulty: easy
tags:
  - json
question: "What do `JSON.stringify` and `JSON.parse` do?"
answer: |
  `JSON.stringify` converts a JavaScript value into a JSON string, and `JSON.parse` converts a JSON string back into a JavaScript value.

  They are used whenever data leaves or enters your program as text: sending a request body with `fetch`, reading an API response, saving to `localStorage`, or writing a config file.

  **`JSON.stringify(value, replacer, space)`**

  - The optional `space` argument pretty-prints, as in `JSON.stringify(obj, null, 2)`.
  - The optional `replacer` can be an array of keys to keep, or a function to transform values.
  - If an object has a `toJSON` method, its result is used. That is why a `Date` becomes an ISO string.
  - Properties whose values are `undefined`, functions or symbols are **skipped**. In arrays they become `null`.
  - `NaN` and `Infinity` become `null`.
  - A `BigInt` throws a `TypeError`, and so does a circular reference.
  - `Map` and `Set` become `{}`, so convert them first, for example with `Object.fromEntries(map)` or `[...set]`.

  **`JSON.parse(text, reviver)`**

  - Throws a `SyntaxError` on invalid JSON, so wrap untrusted input in `try...catch`.
  - JSON is stricter than JavaScript: keys and strings need **double** quotes, and trailing commas and comments are not allowed.
  - Dates come back as plain strings. The optional `reviver` function lets you convert them back.

  A round trip with `JSON.parse(JSON.stringify(obj))` is sometimes used as a deep copy, but because of the losses above, `structuredClone` is the better choice today.
codeExample: |
  const order = {
    id: 7,
    placed: new Date(Date.UTC(2025, 0, 15)),
    note: undefined,
    total: NaN,
    tags: ["new", undefined],
  };

  const json = JSON.stringify(order);
  console.log(json);
  // Output: {"id":7,"placed":"2025-01-15T00:00:00.000Z","total":null,"tags":["new",null]}

  console.log(JSON.stringify({ a: 1, b: [1, 2] }, null, 2).split("\n").length); // Output: 7

  const parsed = JSON.parse(json, (key, value) => (key === "placed" ? new Date(value) : value));
  console.log(parsed.placed.getUTCFullYear()); // Output: 2025

  try {
    JSON.parse("{ name: 'Ada' }");
  } catch (err) {
    console.log(err.name); // Output: SyntaxError
  }
popularity: 8.5
isPublished: true
---
