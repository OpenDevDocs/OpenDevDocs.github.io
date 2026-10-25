---
publishDate: 2026-10-25T11:15
title: The Built-in Test Runner
slug: built-in-test-runner
metadescription: Write and run automated tests with node:test and node --test. Learn test, describe, it, hooks, async tests, skip, todo, filtering and reporters.
updateDate: 2026-10-25T11:15
author: ['bishal-biswas']
level: 2
tags: ['testing', 'node-test', 'tooling']
course: nodejs
---

## Why write tests?

Imagine a bakery that tastes one biscuit from every batch before it goes out. It takes a moment, but it catches the batch where someone used salt instead of sugar.

An **automated test** is a tiny program that tastes your code. It calls a function with known input and checks the result is what you expect. Run your tests after every change and you know in seconds whether you broke something, instead of hearing it from a user.

For years you needed a package like Jest or Mocha for this. Now Node has a test runner built in: the `node:test` module and the `node --test` command. It is stable and needs no install.

## Your first test

Here is some code to test:

```javascript
// cart.js
export function addItem(cart, item) {
  if (item.qty <= 0) throw new RangeError('qty must be positive');
  return [...cart, item];
}

export function total(cart) {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}
```

And a test file next to it:

```javascript
// cart.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addItem, total } from './cart.js';

test('an empty cart costs nothing', () => {
  assert.equal(total([]), 0);
});

test('total adds price times quantity', () => {
  const cart = [
    { name: 'Notebook', price: 3, qty: 2 },
    { name: 'Pen', price: 1.5, qty: 4 },
  ];
  assert.equal(total(cart), 12);
});

test('addItem returns a new array', () => {
  const cart = [];
  const updated = addItem(cart, { name: 'Pen', price: 1.5, qty: 1 });
  assert.deepEqual(updated, [{ name: 'Pen', price: 1.5, qty: 1 }]);
  assert.equal(cart.length, 0); // the original is untouched
});

test('addItem rejects a zero quantity', () => {
  assert.throws(() => addItem([], { name: 'Pen', price: 1.5, qty: 0 }), RangeError);
});
```

Two imports do all the work:

- `test(name, fn)` from `node:test` registers a test. The name should read like a sentence describing the behaviour.
- `assert` from `node:assert/strict` checks things. If a check fails, it throws an error and the test fails.

The **assertions** you will use most:

- `assert.equal(actual, expected)`: the same value, compared with `===`.
- `assert.deepEqual(actual, expected)`: objects or arrays with the same contents.
- `assert.throws(fn, ErrorType)`: calling `fn` throws.
- `assert.ok(value)`: the value is truthy.

You will meet many more, plus mocking and code coverage, in [the Assertions, Mocking and Coverage lesson](/courses/nodejs/assertions-mocking-and-coverage).

## Running tests

Run every test file in the project:

```bash
node --test
```

```text
✔ an empty cart costs nothing (0.5411ms)
✔ total adds price times quantity (0.1277ms)
✔ addItem returns a new array (0.5021ms)
✔ addItem rejects a zero quantity (0.2953ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 66.7528
```

With no file names, `node --test` searches your folders for test files. It picks up names like these:

- `*.test.js`, `*-test.js`, `*_test.js` (for example `cart.test.js`)
- `test-*.js` and `test.js`
- any `.js` file inside a `test/` folder

The same patterns work with `.mjs` and `.cjs`, and on Node 24 also with `.ts`, `.mts` and `.cts` files thanks to type stripping (see [the TypeScript lesson](/courses/nodejs/running-typescript-natively)). `node_modules` is skipped. Each test file runs in its own process, so one file cannot mess up another.

You can also name files or folders yourself: `node --test cart.test.js`.

### Add it to `package.json`

The convention is an npm script called `test`:

```json
{
  "name": "shop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

Now `npm test` runs your tests, and so will any CI service that follows the convention.

## What a failure looks like

Suppose someone "simplifies" `total` and forgets the quantity:

```javascript
export function total(cart) {
  return cart.reduce((sum, item) => sum + item.price, 0); // bug: forgot qty
}
```

```bash
npm test
```

```text
> shop@1.0.0 test
> node --test

✔ an empty cart costs nothing (0.4828ms)
✖ total adds price times quantity (0.5742ms)
✔ addItem returns a new array (0.471ms)
✔ addItem rejects a zero quantity (0.7587ms)
ℹ tests 4
...
ℹ fail 1
...

✖ failing tests:

test at cart.test.js:10:1
✖ total adds price times quantity (0.5742ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  4.5 !== 12

      at TestContext.<anonymous> (file:///.../cart.test.js:15:10)
      ...
```

The report tells you which test failed, where (`cart.test.js:15`), what it got (`4.5`) and what it expected (`12`). The command also exits with code 1, which is how CI knows to mark the build as failed.

## Grouping with `describe` and `it`

As tests grow, group related ones with `describe()`. Inside a group, `it()` is just another name for `test()`, and reads nicely: "findDiscount: it finds a code".

Tests can be `async`. The runner waits for the promise before moving on.

```javascript
// test/discount.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

// Pretend this looks up a discount code in a database
async function findDiscount(codes, code) {
  await sleep(10);
  const discount = codes.get(code.toUpperCase());
  if (!discount) throw new Error(`Unknown code: ${code}`);
  return discount;
}

describe('findDiscount', () => {
  let codes;

  beforeEach(() => {
    // a fresh copy for every test, so tests cannot affect each other
    codes = new Map([['WELCOME10', 10], ['SUMMER25', 25]]);
  });

  it('finds a code', async () => {
    assert.equal(await findDiscount(codes, 'WELCOME10'), 10);
  });

  it('ignores case', async () => {
    assert.equal(await findDiscount(codes, 'summer25'), 25);
  });

  it('rejects an unknown code', async () => {
    await assert.rejects(findDiscount(codes, 'NOPE'), { message: 'Unknown code: NOPE' });
  });

  it.todo('expires old codes');

  it.skip('works with emoji codes', () => {});
});
```

`assert.rejects()` is the async twin of `assert.throws()`: it passes when the promise rejects. Do not forget the `await` in front of it.

Running both files now gives a nested report (the four cart tests are cut here):

```text
...
▶ findDiscount
  ✔ finds a code (20.7903ms)
  ✔ ignores case (14.9399ms)
  ✔ rejects an unknown code (15.7314ms)
  ✔ expires old codes (0.4419ms) # TODO
  ﹣ works with emoji codes (0.1709ms) # SKIP
✔ findDiscount (53.3083ms)
ℹ tests 9
ℹ suites 1
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 1
ℹ todo 1
...
```

### Hooks: setup and clean-up

**Hooks** are functions the runner calls around your tests:

- `beforeEach(fn)` / `afterEach(fn)`: before or after **every** test in the group.
- `before(fn)` / `after(fn)`: once, before or after **all** the tests in the group.

Use `beforeEach` to give every test fresh data, as above. Use `before` and `after` for expensive things like starting a server, which you will see next.

### skip, todo and only

- `it.skip()` (or `test.skip()`) does not run the test. Handy when something is temporarily broken.
- `it.todo()` marks a test you plan to write. It is listed, but a failure does not fail the run.
- `it.only()` marks the tests you want to focus on. It only takes effect when you run with `node --test --test-only`; otherwise Node prints a reminder and runs everything.

## Running just some tests

Run only tests whose name matches a pattern:

```bash
node --test --test-name-pattern="ignores"
```

```text
✔ cart.test.js (57.8154ms)
▶ findDiscount
  ✔ ignores case (17.1633ms)
✔ findDiscount (17.9875ms)
...
```

No test in `cart.test.js` matched, so that file shows as a single line. `--test-skip-pattern` does the opposite and leaves matching tests out.

Re-run tests automatically every time you save a file with watch mode:

```bash
node --test --watch
```

## Testing an HTTP server

Tests really pay off for servers, where clicking through every endpoint by hand gets tiring. If you built [the Notes REST API project](/courses/nodejs/project-notes-rest-api), you designed `createApp(notes)` to accept a store, so a test can give it a fresh in-memory database:

```javascript
// test/api.test.js (inside the notes-api project)
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openNotesDb } from '../db.js';
import { createApp } from '../app.js';

describe('Notes API', () => {
  let server;
  let base;

  before(async () => {
    const notes = openNotesDb(':memory:'); // a fresh, empty database
    server = createApp(notes);
    await new Promise((resolve) => server.listen(0, resolve)); // any free port
    base = `http://localhost:${server.address().port}`;
  });

  after(() => {
    server.close();
  });

  function post(path, body) {
    return fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('creates a note', async () => {
    const res = await post('/notes', { title: 'Shopping', body: 'Milk' });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('location'), '/notes/1');
    const note = await res.json();
    assert.equal(note.title, 'Shopping');
    assert.equal(note.pinned, false);
  });

  it('rejects a note without a title', async () => {
    const res = await post('/notes', { body: 'No title' });
    assert.equal(res.status, 422);
    const { error } = await res.json();
    assert.match(error.details[0], /title is required/);
  });

  it('returns 404 for a missing note', async () => {
    const res = await fetch(`${base}/notes/999`);
    assert.equal(res.status, 404);
  });
});
```

Add `"test": "node --disable-warning=ExperimentalWarning --test"` to that project's scripts, then run `npm test`:

```text
POST /notes -> 201
▶ Notes API
  ✔ creates a note (27.6163ms)
POST /notes -> 422
  ✔ rejects a note without a title (3.5697ms)
GET /notes/999 -> 404
  ✔ returns 404 for a missing note (1.6997ms)
✔ Notes API (36.8411ms)
ℹ tests 3
ℹ suites 1
ℹ pass 3
ℹ fail 0
...
```

The `POST /notes -> 201` lines are the API's own access log, printed while the tests run. Port `0` lets the operating system pick a free port, so tests never clash with a server you already have running.

## Reporters

A **reporter** decides how results are printed. The default, `spec`, is the friendly format you have seen. Since Node 23 it is the default even when output goes to a file or a CI log. Others:

```bash
node --test --test-reporter=dot   # one dot per test, quiet
node --test --test-reporter=tap   # TAP, a classic text format other tools read
node --test --test-reporter=junit --test-reporter-destination=junit.xml   # XML for CI dashboards
```

You can also combine reporters, giving each its own `--test-reporter-destination`, for example `spec` on the screen and `junit` into a file.

## Common mistakes

### Forgetting `await` in async tests

```javascript
it('rejects an unknown code', () => {
  assert.rejects(findDiscount(codes, 'NOPE')); // no await: the test ends before checking
});
```

Make the test `async` and `await` the assertion.

### Using loose `assert`

```javascript
import assert from 'node:assert';
assert.equal(1, '1'); // passes! loose mode uses ==
```

Import from `node:assert/strict`, where `equal` means `===`.

### Tests that share state

```javascript
const codes = new Map(); // one Map for the whole file
it('adds a code', () => { codes.set('A', 5); });
it('starts empty', () => { assert.equal(codes.size, 0); }); // fails
```

Create fresh data in `beforeEach`, so every test starts clean and the order never matters.

### Leaving a server running

If you start a server in `before` and forget `server.close()` in `after`, the open server keeps the test file alive and `node --test` just sits there. Always pair them.

## Quick recap

- `node:test` and `node --test` are Node's built-in, stable test runner. No install needed.
- Write tests with `test()` or `describe()` + `it()`, and check results with `node:assert/strict`.
- `node --test` finds files like `*.test.js` and anything in a `test/` folder; add it as `npm test`.
- Tests can be `async`; use `await assert.rejects()` for promises that should fail.
- Hooks: `beforeEach`/`afterEach` around every test, `before`/`after` once per group.
- `skip`, `todo`, `only` (with `--test-only`), `--test-name-pattern` and `--watch` control what runs.
- Test servers by listening on port `0` in `before`, calling them with `fetch`, and closing in `after`.

<code id="code-content" class="language-javascript">
// shop.test.mjs: run with  node shop.test.mjs  (or  node --test)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
// --- the code under test (normally imported from its own file)
function total(cart) {
  return cart.reduce((sum, item) =&gt; sum + item.price * item.qty, 0);
}
function addItem(cart, item) {
  if (item.qty &lt;= 0) throw new RangeError('qty must be positive');
  return [...cart, item];
}
// --- plain tests
describe('cart', () =&gt; {
  let cart;
  beforeEach(() =&gt; {
    cart = [{ name: 'Notebook', price: 3, qty: 2 }]; // fresh data for every test
  });
  it('adds price times quantity', () =&gt; {
    assert.equal(total(cart), 6);
  });
  it('returns a new array when adding', () =&gt; {
    const updated = addItem(cart, { name: 'Pen', price: 1.5, qty: 4 });
    assert.equal(total(updated), 12);
    assert.equal(cart.length, 1); // original untouched
  });
  it('rejects a zero quantity', () =&gt; {
    assert.throws(() =&gt; addItem(cart, { name: 'Pen', price: 1.5, qty: 0 }), RangeError);
  });
  it.todo('applies discount codes');
});
// --- testing a real HTTP server on a random port
describe('price API', () =&gt; {
  let server;
  let base;
  before(async () =&gt; {
    server = http.createServer((req, res) =&gt; {
      if (req.url !== '/price') { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ total: total([{ price: 2.5, qty: 4 }]) }));
    });
    await new Promise((resolve) =&gt; server.listen(0, resolve));
    base = `http://localhost:${server.address().port}`;
  });
  after(() =&gt; server.close());
  it('returns the total as JSON', async () =&gt; {
    const res = await fetch(`${base}/price`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { total: 10 });
  });
  it('returns 404 for unknown paths', async () =&gt; {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
  });
});
</code></pre>
