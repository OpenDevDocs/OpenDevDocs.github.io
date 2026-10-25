---
publishDate: 2026-10-25T10:00
title: Error Handling and Unhandled Rejections
slug: error-handling-and-unhandled-rejections
metadescription: Catch errors in sync, callback and async code, read error codes, build custom errors with a cause, and understand why unhandled rejections crash Node.
updateDate: 2026-10-25T10:00
author: ['bishal-biswas']
level: 2
tags: ['errors', 'async', 'debugging']
course: nodejs
---

## Things will go wrong

Files go missing. Networks drop. Users type "abc" where you asked for a number. Good programs are not the ones that never fail. They are the ones that fail **clearly** and **safely**.

Think of a restaurant kitchen. If the fish delivery is late, the chef tells the waiter, who tells the customer and offers something else. That is a handled error. If the chef just walks out without telling anyone, the whole restaurant stops. That is a crash.

This lesson shows you where errors come from in Node, how to catch each kind, and what happens when nobody catches one.

## What an error is

An **error** in JavaScript is an object, usually made with `new Error('message')`. It has:

- `name`: the kind of error, like `'Error'`, `'TypeError'` or `'RangeError'`.
- `message`: a human-readable description.
- `stack`: where it happened, as a list of function calls.

You **throw** an error to say "I cannot continue":

```javascript
// throw.mjs
function parseAge(input) {
  const age = Number(input);
  if (!Number.isInteger(age) || age < 0) {
    throw new RangeError(`Invalid age: ${input}`);
  }
  return age;
}

try {
  parseAge('abc');
} catch (err) {
  console.log(err.name + ': ' + err.message); // prints: RangeError: Invalid age: abc
}
```

> **Tip:** Always throw `Error` objects, never plain strings. `throw 'oops'` gives you no `stack`, so you cannot tell where it came from.

## Node system errors and error.code

When the operating system refuses something, Node gives you an error with extra properties. The most useful is `code`, a short, stable string you can check in your code:

```javascript
// codes.mjs
import { readFile } from 'node:fs/promises';

try {
  await readFile('settings.json', 'utf8');
} catch (err) {
  console.log(err.code);    // prints: ENOENT
  console.log(err.syscall); // prints: open
}
```

Common codes you will meet:

| Code | Meaning |
| --- | --- |
| `ENOENT` | No such file or folder |
| `EACCES` | Permission denied |
| `EEXIST` | The file already exists |
| `EADDRINUSE` | The network port is already taken |
| `ECONNREFUSED` | Nothing is listening at that address |

Check `err.code`, not `err.message`. Messages can change between versions; codes do not.

## Three styles, three ways to catch

Where you catch an error depends on how the code is written.

### 1. Synchronous code: try/catch

Plain `try`/`catch` works for code that runs straight through, as in `parseAge` above.

### 2. Callbacks: check the err argument

Callback APIs never throw. They pass the error as the **first argument**, so check `if (err)` and `return` early, as you saw in [the Callbacks, Promises and async/await lesson](/courses/nodejs/callbacks-promises-async-await).

### 3. Promises and async/await: .catch or try/catch with await

With `await`, a rejected promise throws, so `try`/`catch` works:

```javascript
try {
  const text = await readFile('settings.json', 'utf8');
} catch (err) {
  console.error('Could not read settings:', err.code);
}
```

Without `await`, attach `.catch()`:

```javascript
readFile('settings.json', 'utf8')
  .then((text) => console.log(text))
  .catch((err) => console.error('Could not read settings:', err.code));
```

## try/catch cannot catch errors from later

This surprises almost everyone once:

```javascript
// Wrong
try {
  setTimeout(() => {
    throw new Error('Boom inside a timer');
  }, 0);
} catch (err) {
  console.log('Caught?', err.message); // never runs
}
```

The `try` block finishes long before the timer fires. When the callback throws, the `try` is gone, so the error is **uncaught** and the program crashes:

```text
Error: Boom inside a timer
    at Timeout._onTimeout (file:///home/asha/app/timer.mjs:4:11)
    at listOnTimeout (node:internal/timers:605:17)
    at process.processTimers (node:internal/timers:541:7)

Node.js v24.12.0
```

The fix is to put the `try`/`catch` **inside** the callback, or to use promises and `await` so the error flows back to you.

## Wrapping errors with a cause

Often you catch a low-level error and want to throw a clearer one. Pass the original as `cause` so no detail is lost:

```javascript
// cause.mjs
import { readFile } from 'node:fs/promises';

async function loadSettings() {
  try {
    return JSON.parse(await readFile('settings.json', 'utf8'));
  } catch (err) {
    throw new Error('Could not load settings', { cause: err });
  }
}

try {
  await loadSettings();
} catch (err) {
  console.log(err.message);    // prints: Could not load settings
  console.log(err.cause.code); // prints: ENOENT
}
```

When Node prints an error that has a cause, it prints the cause too, which makes debugging much easier.

## Custom error classes

A **custom error class** lets you add your own name and details, and check the type with `instanceof`:

```javascript
// custom-error.mjs
class NotFoundError extends Error {
  constructor(what, options) {
    super(`${what} not found`, options); // options can carry { cause }
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

try {
  throw new NotFoundError('Book 7');
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log(err.statusCode, err.message); // prints: 404 Book 7 not found
  }
}
```

This is very handy in web servers: a `NotFoundError` becomes a 404 response, anything else becomes a 500.

## Two kinds of errors

It helps to sort errors into two groups:

- **Operational errors**: expected problems in the real world. A missing file, a timeout, bad user input. **Handle these**: retry, show a message, use a default.
- **Programmer errors**: bugs. Reading a property of `undefined`, calling a function with the wrong arguments. **Do not hide these.** Fix the code. Letting the program crash with a clear stack trace is often the right thing.

## Unhandled rejections

An **unhandled rejection** is a promise that rejected and nobody attached a `.catch()` or `await`ed it inside a `try`. Since Node 15, this **crashes the process** by default:

```javascript
// unhandled.mjs
async function loadOrder(id) {
  throw new Error(`Order ${id} not found`);
}

loadOrder(42); // no await, no .catch
setTimeout(() => console.log('Still running'), 100);
```

```text
file:///home/asha/app/unhandled.mjs:3
  throw new Error(`Order ${id} not found`);
        ^

Error: Order 42 not found
    at loadOrder (file:///home/asha/app/unhandled.mjs:3:9)
    at file:///home/asha/app/unhandled.mjs:6:1

Node.js v24.12.0
```

The exit code is `1` and `Still running` never prints. That is on purpose: a rejection nobody handles is almost always a bug, and silently carrying on could leave your data in a broken state.

The fix is simply to handle it:

```javascript
// Right
try {
  await loadOrder(42);
} catch (err) {
  console.error(err.message);
}
```

### The --unhandled-rejections flag

You can change the behaviour with a command-line flag. The modes are:

| Mode | What happens |
| --- | --- |
| `throw` | The default. Treated as an uncaught exception, so the process crashes unless you listen for `unhandledRejection`. |
| `strict` | Always raised as an uncaught exception, even if you have an `unhandledRejection` listener. |
| `warn` | Prints a warning and keeps running. |
| `warn-with-error-code` | Prints a warning and sets the exit code to 1. |
| `none` | Silences all warnings and keeps running. |

```bash
node --unhandled-rejections=warn unhandled.mjs
```

> **Note:** Keep the default in real apps. Turning crashes into warnings hides bugs.

## The last line of defence: process events

Node emits two events on the `process` object for errors nobody caught:

- `'unhandledRejection'`: a promise rejected with no handler.
- `'uncaughtException'`: an error was thrown and nothing caught it.

```javascript
// safety-net.mjs
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason.message);
  process.exitCode = 1; // exit with code 1 once the loop is empty
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
  process.exit(1); // the app may be in a broken state, so stop now
});

Promise.reject(new Error('Payment service down'));
setTimeout(() => { throw new Error('Bug in a timer'); }, 50);
```

```text
Unhandled rejection: Payment service down
Uncaught exception: Bug in a timer
```

Use these to **log** the problem (to a file or a monitoring service) and then **exit**. Do not use them to keep a broken app running. After an uncaught exception, Node's docs say it is not safe to resume normal work. Let a process manager or container restart it. You will build a proper shutdown in [the Graceful Shutdown lesson](/courses/nodejs/graceful-shutdown).

> **Note:** `process.exitCode = 1` sets the exit code but lets pending work finish. `process.exit(1)` stops immediately.

## Common mistakes

### Swallowing errors

```javascript
// Wrong: the error vanishes and you will never know why things broke
try {
  await saveOrder(order);
} catch {}
```

At least log it, or rethrow anything you did not expect:

```javascript
// Right
try {
  await saveOrder(order);
} catch (err) {
  if (err.code === 'EEXIST') {
    console.log('Order already saved');
  } else {
    throw err;
  }
}
```

## Quick recap

- Errors are objects with `name`, `message` and `stack`. Always throw `Error` objects.
- Node system errors have a `code` such as `ENOENT`. Check the code, not the message.
- Sync code: `try`/`catch`. Callbacks: check `err` first. Promises: `.catch()` or `try`/`catch` with `await`.
- `try`/`catch` cannot catch errors thrown later in a callback.
- Wrap errors with `new Error(message, { cause })` and build custom classes for your app.
- An **unhandled rejection** crashes Node by default. Handle every promise.
- `process.on('unhandledRejection')` and `'uncaughtException'` are for logging and exiting, not for carrying on.

<code id="code-content" class="language-javascript">
// errors.mjs: catch what you expect, crash loudly on what you do not
import { readFile } from 'node:fs/promises';
// A custom error class carries extra details
class NotFoundError extends Error {
  constructor(what, options) {
    super(`${what} not found`, options);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}
// Wrap a low-level error, keeping the original as the cause
async function loadOrders(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new NotFoundError(`Orders file "${file}"`, { cause: err });
    }
    throw err; // anything else: let it bubble up
  }
}
// 1. try/catch with await catches async errors
try {
  await loadOrders('missing-orders.json');
} catch (err) {
  console.log(`1. ${err.name} (${err.statusCode}): ${err.message}`);
  console.log(`   caused by: ${err.cause.code}`);
}
// 2. .catch() on a promise chain
loadOrders('also-missing.json')
  .then((orders) =&gt; console.log(orders))
  .catch((err) =&gt; console.log('2. .catch got:', err.name));
// 3. allSettled: one failure does not hide the other results
const results = await Promise.allSettled([
  Promise.resolve('order 1 ok'),
  loadOrders('nope.json'),
]);
results.forEach((r, i) =&gt; console.log(`3. job ${i + 1}:`, r.status));
// 4. Error-first callbacks: check err before using the result
setTimeout(() =&gt; {
  const callback = (err, data) =&gt; {
    if (err) return console.log('4. callback error:', err.message);
    console.log(data);
  };
  callback(new Error('Disk full'));
}, 50);
// ---
// 5. Last line of defence: log, then exit with a failure code
process.on('unhandledRejection', (reason) =&gt; {
  console.error('5. Unhandled rejection:', reason.message);
  process.exitCode = 1; // exit with code 1 when the loop is empty
});
setTimeout(() =&gt; {
  Promise.reject(new Error('Nobody caught me')); // a bug: no .catch
}, 100);
process.on('exit', (code) =&gt; console.log('6. Exiting with code', code));
</code></pre>
