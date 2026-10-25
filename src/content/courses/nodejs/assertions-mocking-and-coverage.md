---
publishDate: 2026-10-25T11:20
title: Assertions, Mocking and Code Coverage
slug: assertions-mocking-and-coverage
metadescription: Write stronger Node.js tests with node:assert/strict, fake functions and timers with the built-in mock API, and measure code coverage.
updateDate: 2026-10-25T11:20
author: ['bishal-biswas']
level: 2
tags: ['testing', 'assert', 'mocking', 'coverage']
course: nodejs
---

## Why you need more than "it ran"

In [the Built-in Test Runner lesson](/courses/nodejs/built-in-test-runner) you wrote tests with `test`, `describe` and `it`, and ran them with `node --test`. A test only passes or fails, though. Something has to decide *what counts as correct*.

Think of a restaurant inspector. Walking through the kitchen is not enough. They need a checklist ("fridge below 5 degrees"), a way to check the supplier without phoning them (a fake delivery note), and a report of which rooms they never visited.

Those three things map to this lesson:

- **Assertions**: the checklist. Each one says "this value must be exactly that".
- **Mocks**: stand-ins for things you do not want to really call in a test, like an email service or a timer.
- **Code coverage**: the report of which lines your tests never ran.

## Assertions with node:assert/strict

An **assertion** is a line that checks a fact and throws an error if the fact is false. The test runner catches that error and marks the test as failed.

Always import the strict version:

```javascript
import assert from 'node:assert/strict';
```

In **strict mode**, `assert.equal` compares with `===`. The older non-strict `node:assert` uses `==`, so `assert.equal(1, '1')` passes there. That hides real bugs, so stick with `node:assert/strict`.

Here is a small module to test:

```javascript
// cart.js
export function addItem(cart, item) {
  if (item.price < 0) {
    throw new RangeError('Price cannot be negative');
  }
  return { ...cart, items: [...cart.items, item] };
}

export function total(cart) {
  return cart.items.reduce((sum, item) => sum + item.price, 0);
}

export async function loadCart(id) {
  if (!id) throw new TypeError('An id is required');
  return { id, items: [] };
}
```

### equal and deepStrictEqual

Use `assert.equal` for simple values like numbers and strings:

```javascript
// cart.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addItem, total, loadCart } from './cart.js';

test('total adds up prices', () => {
  assert.equal(total({ items: [{ price: 5 }, { price: 7 }] }), 12);
});
```

Objects and arrays are different. Two objects with the same contents are still two separate objects, so `===` says they are not equal. Use `assert.deepStrictEqual`, which compares the contents, key by key:

```javascript
test('addItem returns a new cart with the item', () => {
  const cart = { items: [] };
  const result = addItem(cart, { name: 'Book', price: 12 });
  assert.deepStrictEqual(result, { items: [{ name: 'Book', price: 12 }] });
  assert.deepStrictEqual(cart, { items: [] }); // the original is untouched
});
```

When a deep comparison fails, Node prints a helpful diff. Here a number was compared with a string:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   age: 30,
-   age: '30',
    name: 'Asha'
  }
```

Lines with `+` are what your code produced. Lines with `-` are what you expected.

Other handy checks: `assert.ok(value)` (truthy), `assert.notEqual(a, b)` and `assert.match(text, /regex/)`.

### Checking errors with assert.throws

Good tests also check the *unhappy* path. `assert.throws` takes a function, calls it, and passes only if it throws:

```javascript
test('negative price throws', () => {
  assert.throws(() => addItem({ items: [] }, { name: 'Pen', price: -1 }), {
    name: 'RangeError',
    message: 'Price cannot be negative',
  });
});
```

The second argument describes the error you expect. It can be an object of properties (like above), an error class such as `RangeError`, or a regular expression matched against the message.

### Checking async errors with assert.rejects

For async code, use `assert.rejects` and **await it**:

```javascript
test('loadCart rejects without an id', async () => {
  await assert.rejects(loadCart(), TypeError);
  await assert.rejects(() => loadCart(''), /id is required/);
});
```

You can pass a promise or a function that returns one.

## Mocking: fake stand-ins for real things

A **mock** is a fake function that records every call made to it. You use mocks when the real thing is slow, costs money, or has side effects, like sending an email.

Each test receives a context object, usually called `t`. It has a `t.mock` helper, and anything you mock through it is **restored automatically** when the test ends.

### t.mock.fn: a fake function

```javascript
// notify.js
export function notifyAll(users, send) {
  for (const user of users) {
    if (user.email) send(user.email, `Hi ${user.name}, your order shipped`);
  }
}
```

`notifyAll` takes a `send` function as a parameter. In the test, pass a mock instead of a real mailer:

```javascript
test('notifyAll only emails users who have an address', (t) => {
  const send = t.mock.fn(); // a fake that does nothing but record

  notifyAll([{ name: 'Asha', email: 'asha@example.com' }, { name: 'Ravi' }], send);

  assert.equal(send.mock.callCount(), 1);
  assert.deepStrictEqual(send.mock.calls[0].arguments, [
    'asha@example.com',
    'Hi Asha, your order shipped',
  ]);
});
```

Every mock has a `.mock` property:

- `mock.callCount()` returns how many times it was called.
- `mock.calls` is an array, one entry per call, with `arguments`, `result` and `error`.

### t.mock.method: replace a method on an object

Often the code under test calls a method directly, so you cannot pass a fake in. `t.mock.method(object, 'name', fake)` swaps the method for the length of the test:

```javascript
// notify.js (continued)
export const mailer = {
  send(to, text) {
    throw new Error('No network in tests!'); // imagine a real email call
  },
};

export function welcome(user) {
  mailer.send(user.email, `Welcome, ${user.name}`);
  return 'sent';
}
```

```javascript
test('welcome sends one email', (t) => {
  const fakeSend = t.mock.method(mailer, 'send', () => {});

  assert.equal(welcome({ name: 'Maya', email: 'maya@example.com' }), 'sent');
  assert.equal(fakeSend.mock.callCount(), 1);
  assert.deepStrictEqual(fakeSend.mock.calls[0].arguments, ['maya@example.com', 'Welcome, Maya']);
});
```

When the test finishes, `mailer.send` is the real method again.

> **Note:** You can also `import { mock } from 'node:test'` and use `mock.fn()` or `mock.method()` outside a test. Those are not restored for you, so call `mock.restoreAll()` yourself, for example in an `afterEach` hook. Using `t.mock` avoids that chore.

### t.mock.timers: skip the waiting

Code that waits with `setTimeout` is painful to test. Nobody wants a test that sleeps for a minute. **Mock timers** let you move a fake clock forward instantly:

```javascript
// notify.js (continued)
export function remindLater(callback) {
  setTimeout(() => callback('Time to stretch'), 60_000);
}
```

```javascript
test('remindLater fires after one minute', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const callback = t.mock.fn();

  remindLater(callback);

  t.mock.timers.tick(59_999); // 1 ms short
  assert.equal(callback.mock.callCount(), 0);

  t.mock.timers.tick(1); // now exactly one minute
  assert.equal(callback.mock.callCount(), 1);
});
```

`tick(ms)` advances the fake clock and runs any timers that are now due. The test finishes in under a millisecond.

You can fake the date too: `t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-01-01') })` makes `new Date()` return that moment until you `tick` forward.

> **Note:** Mocking whole modules (`mock.module()`) also exists, but in Node 24 it needs the experimental `--experimental-test-module-mocks` flag. Passing dependencies in, or using `t.mock.method`, covers most cases.

## Code coverage: which lines did you miss?

**Code coverage** measures which lines, branches and functions of your code ran while the tests ran. A **branch** is one path through an `if` or `? :`. Turn it on with a flag:

```bash
node --test --experimental-test-coverage
```

Say `cart.js` also has a `discount` function, and you only tested the `'HALF'` code:

```javascript
export function discount(total, code) {
  if (code === 'HALF') return total / 2;
  if (code === 'TENOFF') return total - 10;
  return total;
}
```

After the normal test results, Node prints a table:

```text
ℹ start of coverage report
ℹ ----------------------------------------------------------
ℹ file      | line % | branch % | funcs % | uncovered lines
ℹ ----------------------------------------------------------
ℹ cart.js   |  86.36 |    77.78 |  100.00 | 15 20-21
ℹ ----------------------------------------------------------
ℹ all files |  86.36 |    77.78 |  100.00 |
ℹ ----------------------------------------------------------
ℹ end of coverage report
```

The last column is the useful one. Lines 20 and 21 are the `'TENOFF'` case and the fallback, which no test reached. Line 15 is the success path of `loadCart`, because the tests only checked the error. Test files themselves are left out of the report.

### Failing the build on low coverage

You can set minimum percentages. If coverage drops below them, the run exits with code 1, which fails a CI job:

```bash
node --test --experimental-test-coverage --test-coverage-lines=90
```

```text
ℹ Error: 86.36% line coverage does not meet threshold of 90%.
```

There are matching `--test-coverage-branches` and `--test-coverage-functions` flags.

> **Tip:** Coverage tells you what you *did not* test. It does not prove the tested lines are correct. A test with no assertions still counts as coverage. Aim for meaningful checks, not 100%.

## Common mistakes

### Using equal on objects

```javascript
assert.equal({ a: 1 }, { a: 1 }); // fails: "not reference-equal"
```

Two object literals are two different objects. Compare contents instead:

```javascript
assert.deepStrictEqual({ a: 1 }, { a: 1 }); // passes
```

### Calling the function instead of passing it to throws

```javascript
assert.throws(addItem({ items: [] }, { price: -1 })); // the error escapes first
```

The function runs *before* `assert.throws` gets a chance to catch anything. Wrap it in an arrow function:

```javascript
assert.throws(() => addItem({ items: [] }, { price: -1 }));
```

### Forgetting to await rejects

```javascript
test('rejects', () => {
  assert.rejects(loadCart()); // not awaited, so the test ends early
});
```

Without `await`, the test shows a green tick and the failure turns up later as a confusing "generated asynchronous activity after the test ended" error. Make the test `async` and `await` the assertion:

```javascript
test('rejects', async () => {
  await assert.rejects(loadCart());
});
```

## Quick recap

- Import `node:assert/strict` so `equal` uses `===`.
- Use `deepStrictEqual` for objects and arrays, `throws` for sync errors, and `await assert.rejects` for async errors.
- `t.mock.fn()` creates a fake function that records `callCount()` and `calls`.
- `t.mock.method(obj, 'name', fake)` swaps a method for one test and restores it afterwards.
- `t.mock.timers.enable()` plus `tick(ms)` tests timers and dates without waiting.
- `node --test --experimental-test-coverage` shows uncovered lines, and `--test-coverage-lines=90` enforces a minimum.

<code id="code-content" class="language-javascript">
// shop.test.mjs: run with  node --test --experimental-test-coverage
import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
// --- code under test (normally in its own file) ---
function addItem(cart, item) {
  if (item.price &lt; 0) throw new RangeError('Price cannot be negative');
  return { ...cart, items: [...cart.items, item] };
}
async function loadCart(id) {
  if (!id) throw new TypeError('An id is required');
  return { id, items: [] };
}
const mailer = { send() { throw new Error('No network in tests!'); } };
function confirmOrder(user) {
  mailer.send(user.email, `Thanks, ${user.name}`);
  setTimeout(() =&gt; mailer.send(user.email, 'How was your order?'), 86_400_000);
}
// --- tests ---
describe('cart', () =&gt; {
  it('adds an item without changing the original', () =&gt; {
    const cart = { items: [] };
    assert.deepStrictEqual(addItem(cart, { name: 'Book', price: 12 }), {
      items: [{ name: 'Book', price: 12 }],
    });
    assert.deepStrictEqual(cart, { items: [] });
  });
  it('throws on a negative price', () =&gt; {
    assert.throws(() =&gt; addItem({ items: [] }, { price: -1 }), RangeError);
  });
  it('rejects when the id is missing', async () =&gt; {
    await assert.rejects(loadCart(), { name: 'TypeError', message: /id is required/ });
  });
});
test('a mock function records its calls', (t) =&gt; {
  const greet = t.mock.fn((name) =&gt; `Hi ${name}`);
  greet('Asha');
  assert.equal(greet.mock.callCount(), 1);
  assert.equal(greet.mock.calls[0].result, 'Hi Asha');
});
test('confirmOrder emails now and again tomorrow', (t) =&gt; {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const send = t.mock.method(mailer, 'send', () =&gt; {});
  confirmOrder({ name: 'Maya', email: 'maya@example.com' });
  assert.equal(send.mock.callCount(), 1);
  t.mock.timers.tick(86_400_000); // jump forward one day instantly
  assert.equal(send.mock.callCount(), 2);
  assert.deepStrictEqual(send.mock.calls[1].arguments, ['maya@example.com', 'How was your order?']);
});
</code></pre>
