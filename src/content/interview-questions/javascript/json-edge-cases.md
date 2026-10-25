---
course: javascript
slug: json-edge-cases
experienceLevel: mid
difficulty: hard
tags:
  - json
  - serialization
question: "What are the edge cases of `JSON.stringify` and `JSON.parse`, and how do replacers and revivers help?"
answer: |
  `JSON.stringify` only represents strings, finite numbers, booleans, `null`, plain objects and arrays, so many JavaScript values are silently changed or dropped: `Date`s become strings, `undefined` and functions disappear, `NaN` becomes `null`, and `BigInt` and circular references throw. A **replacer** and a **reviver** let you customise the conversion in each direction.

  What happens to special values:

  - **`Date`**: has a `toJSON()` method, so it becomes an ISO string. `JSON.parse` gives back a **string**, not a `Date`.
  - **`undefined`, functions and symbols**: omitted from objects, turned into `null` inside arrays, and `JSON.stringify(undefined)` returns `undefined` (not a string).
  - **`NaN`, `Infinity`, `-Infinity`**: become `null`.
  - **`BigInt`**: throws a `TypeError` unless you convert it yourself.
  - **`Map`, `Set`, class instances**: only own enumerable properties are kept, so a `Map` becomes `{}` and prototypes are lost.
  - **Circular references**: throw a `TypeError` ("Converting circular structure to JSON").
  - **Large integers**: `JSON.parse` turns numbers above `Number.MAX_SAFE_INTEGER` into imprecise doubles. APIs often send big IDs as strings for this reason.

  Customisation tools:

  1. **`toJSON()`**: any object can define it to control its own serialization.
  2. **Replacer function** `(key, value) => newValue`: called for every key, with `this` being the containing object. Return `undefined` to drop a property. A replacer **array** works as an allowlist of keys.
  3. **Reviver function** in `JSON.parse(text, reviver)`: called bottom-up for every value, ideal for turning ISO strings back into `Date`s or numeric strings into `BigInt`s.
  4. The **space** argument (`2` or `'\t'`) pretty-prints.

  Practical guidance:

  - Wrap `JSON.parse` in `try`/`catch`; invalid input throws a `SyntaxError`.
  - Validate parsed data (for example with Zod) instead of trusting its shape.
  - Use `structuredClone`, not a JSON round trip, for deep copies.
  - For circular data, use a replacer with a `WeakSet` to skip seen objects, or a library designed for it.
codeExample: |
  const data = {
    when: new Date('2025-01-01T00:00:00Z'),
    missing: undefined,
    greet() {},
    ratio: NaN,
    list: [undefined, () => 1, Infinity],
    tags: new Set(['a']),
  };
  console.log(JSON.stringify(data));
  // Output: {"when":"2025-01-01T00:00:00.000Z","ratio":null,"list":[null,null,null],"tags":{}}

  const isoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const revived = JSON.parse(JSON.stringify(data), (key, value) =>
    typeof value === 'string' && isoDate.test(value) ? new Date(value) : value);
  console.log(revived.when instanceof Date, revived.when.getUTCFullYear()); // Output: true 2025

  try { JSON.stringify({ id: 10n }); } catch (e) { console.log(e.message); }
  // Output: Do not know how to serialize a BigInt
  const bigintReplacer = (key, value) => (typeof value === 'bigint' ? value.toString() : value);
  console.log(JSON.stringify({ id: 10n }, bigintReplacer)); // Output: {"id":"10"}

  const node = { name: 'root' };
  node.self = node;
  try { JSON.stringify(node); } catch (e) { console.log(e.constructor.name); } // Output: TypeError

  console.log(JSON.stringify({ id: 1, password: 'secret', name: 'Ada' }, ['id', 'name']));
  // Output: {"id":1,"name":"Ada"}
  console.log(JSON.stringify(undefined), JSON.stringify(new Map([['a', 1]])));  // Output: undefined {}
  console.log(JSON.parse('{"id": 9007199254740993}').id);                     // Output: 9007199254740992

  try { JSON.parse("{'single': 'quotes'}"); } catch (e) { console.log(e.name); } // Output: SyntaxError
popularity: 7.8
isPublished: true
---
