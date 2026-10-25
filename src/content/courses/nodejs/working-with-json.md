---
publishDate: 2026-10-25T10:50
title: Working with JSON and Structured Data
slug: working-with-json
metadescription: Convert data to and from JSON in Node, avoid the common traps, read and write JSON files safely, import JSON modules and handle JSON Lines.
updateDate: 2026-10-25T10:50
author: ['bishal-biswas']
level: 2
tags: ['json', 'data', 'files']
course: nodejs
---

## What is JSON and why does it matter?

Imagine posting a toy to a friend. You cannot post it fully built, so you take it apart, pack the pieces flat in a box with instructions, and your friend rebuilds it.

**JSON** (JavaScript Object Notation) is that flat box for data. Objects in your program live in memory and cannot travel. JSON turns them into plain text that can be saved to a file, sent over HTTP or read by a program in any language. Then it is rebuilt on the other side.

Turning data into text is called **serialising**. Turning text back into data is **parsing**. Node, like browsers, has a global `JSON` object for both.

## The rules of JSON

JSON looks like JavaScript, but it is stricter:

```json
{
  "title": "Dune",
  "year": 1965,
  "tags": ["sci-fi", "classic"],
  "inStock": true,
  "rating": null
}
```

- Keys must be in **double quotes**. Strings too. Single quotes are not allowed.
- Values can only be: strings, numbers, `true`, `false`, `null`, arrays and objects.
- No trailing commas, no comments, no `undefined`, no functions.

## `JSON.stringify()`: data to text

```javascript
const book = { title: 'Dune', year: 1965, tags: ['sci-fi', 'classic'], inStock: true, rating: null };

const text = JSON.stringify(book);
console.log(text);
console.log(typeof text); // prints: string
```

```text
{"title":"Dune","year":1965,"tags":["sci-fi","classic"],"inStock":true,"rating":null}
```

Pass a third argument to make it readable for humans. It is the number of spaces to indent:

```javascript
console.log(JSON.stringify({ title: 'Dune', year: 1965 }, null, 2));
```

```text
{
  "title": "Dune",
  "year": 1965
}
```

Use the compact form for sending over the network and the indented form for files people will open.

## `JSON.parse()`: text to data

```javascript
const back = JSON.parse('{"title":"Dune","tags":["sci-fi","classic"]}');
console.log(back.tags[0]); // prints: sci-fi
```

If the text is not valid JSON, `JSON.parse()` throws a `SyntaxError`:

```javascript
JSON.parse("{'title': 'Dune'}");
```

```text
SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
```

Anything that comes from outside your program (a file, a request, an API) might be broken, so always wrap the parse in `try`/`catch`. The playground at the end has a small `safeParse()` helper that does this.

## What JSON loses on the way

Not everything fits in the box. Watch what happens to this object:

```javascript
const user = {
  name: 'Ravi',
  age: undefined,
  greet() { return 'hi'; },
  joined: new Date('2026-10-25T09:30:00Z'),
  skills: new Map([['js', 5]]),
  roles: new Set(['admin']),
  score: NaN,
};

console.log(JSON.stringify(user));
```

```text
{"name":"Ravi","joined":"2026-10-25T09:30:00.000Z","skills":{},"roles":{},"score":null}
```

- `undefined`, functions and symbols are **dropped** from objects (inside arrays they become `null`).
- A `Date` becomes an ISO date **string**. It does not come back as a `Date`.
- `Map` and `Set` become empty `{}`. Your data silently disappears.
- `NaN` and `Infinity` become `null`.

Two values make `stringify` throw instead:

```javascript
JSON.stringify({ count: 10n });
// TypeError: Do not know how to serialize a BigInt

const a = {};
a.self = a;
JSON.stringify(a);
// TypeError: Converting circular structure to JSON
```

> **Note:** Big integers lose precision too. `JSON.parse('9007199254740993')` gives `9007199254740992`, because JavaScript numbers cannot hold it exactly. APIs often send large ids as strings for this reason.

## Customising the output

### Pick or hide fields with a replacer

The second argument to `stringify` is a **replacer**. An array lists the keys to keep:

```javascript
const user = { id: 7, name: 'Maya', email: 'maya@example.com', password: 'hunter2' };

console.log(JSON.stringify(user, ['id', 'name']));
// {"id":7,"name":"Maya"}
```

A function sees every key and value. Return `undefined` to drop one, or return a new value to change it:

```javascript
console.log(JSON.stringify(user, (key, value) => (key === 'password' ? undefined : value)));
// {"id":7,"name":"Maya","email":"maya@example.com"}

// Save a Map as a normal object, and a BigInt as a string
const replacer = (key, value) => {
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value === 'bigint') return value.toString();
  return value;
};
console.log(JSON.stringify({ skills: new Map([['js', 5]]), views: 10n }, replacer));
// {"skills":{"js":5},"views":"10"}
```

### Let an object decide with `toJSON()`

If an object has a `toJSON()` method, `stringify` uses whatever it returns. That is exactly how `Date` turns into a string.

```javascript
class Money {
  constructor(pence) { this.pence = pence; }
  toJSON() { return `£${(this.pence / 100).toFixed(2)}`; }
}

console.log(JSON.stringify({ price: new Money(1299) }));
// {"price":"£12.99"}
```

### Rebuild values with a reviver

`JSON.parse` accepts a **reviver** function, the mirror image of a replacer. Use it to turn date strings back into `Date` objects:

```javascript
const text = '{"id":1,"placedAt":"2026-10-25T09:30:00.000Z"}';

const order = JSON.parse(text, (key, value) =>
  key === 'placedAt' ? new Date(value) : value
);

console.log(order.placedAt instanceof Date); // prints: true
```

## Reading and writing JSON files

Combine `fs/promises` with `JSON` (you met `readFile` and `writeFile` in [the File System Basics lesson](/courses/nodejs/file-system-basics)):

```javascript
// settings.mjs
import { readFile, writeFile, rename } from 'node:fs/promises';

async function readJsonFile(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback; // file does not exist yet
    throw err; // broken JSON or another problem: fail loudly
  }
}

async function writeJsonFile(path, data) {
  const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2) + '\n');
  await rename(temp, path); // swap in the new file in one step
}

const settings = await readJsonFile('settings.json', { theme: 'light', fontSize: 14 });
settings.theme = 'dark';
await writeJsonFile('settings.json', settings);
```

The first run creates `settings.json`:

```json
{
  "theme": "dark",
  "fontSize": 14
}
```

Why the temporary file? If your program crashes halfway through `writeFile`, you would be left with half a JSON file that can never be parsed. Writing to a temp file and then renaming means the real file is always either the old version or the new one.

## Importing JSON as a module

For JSON that ships with your code, like config or `package.json`, you can import it directly. ES modules require an **import attribute** that says "this is JSON":

```javascript
import pkg from './package.json' with { type: 'json' };
console.log(pkg.name, pkg.version); // prints: notes-app 1.0.0
```

Leave out `with { type: 'json' }` and Node refuses with `ERR_IMPORT_ATTRIBUTE_MISSING`. This is a safety rule: a file name alone should never decide how code is loaded.

Imported JSON is read once, when the program starts. For data that changes while the program runs, use `readFile` instead.

In CommonJS, or with `createRequire` in an ES module, `require('./package.json')` also works.

## Copying data: `structuredClone()`

A popular old trick for a deep copy was `JSON.parse(JSON.stringify(obj))`. It suffers from every loss you saw above. Use the built-in `structuredClone()` instead:

```javascript
const original = { name: 'Asha', joined: new Date('2026-01-15'), tags: new Set(['admin']), address: { city: 'Pune' } };

const copy = structuredClone(original);
copy.address.city = 'Delhi';

console.log(copy.joined instanceof Date, copy.tags, original.address.city);
// true Set(1) { 'admin' } Pune
```

It keeps `Date`, `Map`, `Set` and nested objects, and the copy is fully separate. It still cannot copy functions; those throw a `DataCloneError`.

## Lots of records: JSON Lines

A JSON file must be read whole before you can parse it. For logs or large exports, that is a problem. **JSON Lines** (also called **NDJSON**) puts one complete JSON value on each line:

```text
{"id":1,"customer":"Asha","total":25.5}
{"id":2,"customer":"Ravi","total":12}
{"id":3,"customer":"Maya","total":40.25}
```

You can append a record without rewriting the file, and read it one line at a time with `node:readline`, so memory use stays tiny however big the file is:

```javascript
import { createReadStream } from 'node:fs';
import readline from 'node:readline';

const rl = readline.createInterface({ input: createReadStream('orders.ndjson'), crlfDelay: Infinity });

let sum = 0;
for await (const line of rl) {
  if (line.trim() === '') continue; // skip empty lines
  sum += JSON.parse(line).total;
}
console.log('Total of all orders:', sum); // prints: Total of all orders: 77.75
```

## Checking the shape of data

`JSON.parse` tells you the text is valid JSON. It does not tell you the data makes sense. A client could send `[1, 2]` or `{"title": 42}`. Check before you trust it:

```javascript
function validateBook(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return ['body must be a JSON object'];
  }
  const errors = [];
  if (typeof data.title !== 'string' || data.title.trim() === '') errors.push('title must be a non-empty string');
  if (data.year !== undefined && !Number.isInteger(data.year)) errors.push('year must be a whole number');
  return errors;
}

console.log(validateBook({ title: 'Dune', year: 1965 })); // []
console.log(validateBook({ title: '', year: '1965' }));
// [ 'title must be a non-empty string', 'year must be a whole number' ]
```

For bigger projects, validation libraries such as Zod or a JSON Schema validator save you writing these checks by hand. You will use a function like this in [the Notes REST API project](/courses/nodejs/project-notes-rest-api).

## Quick recap

- `JSON.stringify(value, replacer, indent)` turns data into text; `JSON.parse(text, reviver)` turns it back.
- JSON keys and strings need double quotes; no comments, trailing commas or `undefined`.
- Dates become strings, `Map`/`Set` become `{}`, and `BigInt` or circular objects throw.
- Wrap `JSON.parse` in `try`/`catch` for any outside input, then validate the shape.
- Write JSON files to a temp file and `rename` it, so a crash cannot corrupt them.
- `import data from './x.json' with { type: 'json' }` loads JSON as a module.
- Use `structuredClone()` for deep copies and JSON Lines for big streams of records.

<code id="code-content" class="language-javascript">
// json-demo.mjs: serialise, parse, revive, validate and save JSON
import { readFile, writeFile, rename, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const order = { id: 1, customer: 'Asha', placedAt: new Date('2026-10-25T09:30:00Z'), items: new Map([['Dune', 2]]) };
// Replacer: turn the Map into a plain object so it is not lost
const replacer = (key, value) =&gt; (value instanceof Map ? Object.fromEntries(value) : value);
const text = JSON.stringify(order, replacer, 2);
console.log(text);
// Reviver: turn the date string back into a Date
const back = JSON.parse(text, (key, value) =&gt; (key === 'placedAt' ? new Date(value) : value));
console.log(back.placedAt instanceof Date, back.items); // true { Dune: 2 }
// ---
// Safe parsing for outside input
function safeParse(input) {
  try { return { ok: true, value: JSON.parse(input) }; }
  catch (err) { return { ok: false, error: err.message }; }
}
console.log(safeParse('{"title":"Dune"}'));
console.log(safeParse("{'title':'Dune'}"));
// Valid JSON is not the same as valid data
function validateBook(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return ['body must be a JSON object'];
  const errors = [];
  if (typeof data.title !== 'string' || !data.title.trim()) errors.push('title must be a non-empty string');
  return errors;
}
console.log(validateBook({ title: 'Emma' }), validateBook([1, 2]), validateBook({ title: 42 }));
// ---
// Save to a file safely (temp file + rename), then read it back
const dir = await mkdtemp(path.join(tmpdir(), 'json-demo-'));
const file = path.join(dir, 'order.json');
await writeFile(`${file}.tmp`, text + '\n');
await rename(`${file}.tmp`, file);
const loaded = JSON.parse(await readFile(file, 'utf8'));
console.log('Loaded from disk:', loaded.customer, loaded.items);
// structuredClone keeps Dates and Maps, unlike a JSON round trip
const copy = structuredClone(order);
console.log(copy.placedAt instanceof Date, copy.items.get('Dune')); // true 2
</code></pre>
