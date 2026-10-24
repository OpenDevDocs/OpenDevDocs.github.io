---
publishDate: 2026-03-11T09:18
title: Error Handling (try-catch)
slug: error-handling-try-catch
metadescription: Stop one failure from breaking your whole page. Learn try, catch, finally, throwing your own errors and custom error types.
updateDate: 2026-09-05T09:18
author: ['bishal-biswas']
level: 1
tags: ['basics', 'errors']
course: javascript
---

## Why handle errors?

When JavaScript hits an error it stops running the current script. Everything after that line is skipped.

```javascript
const data = JSON.parse('not valid json');
console.log('This line never runs');
```

Error handling lets you catch the problem, deal with it, and carry on.

## `try` and `catch`

```javascript
try {
  const data = JSON.parse('not valid json');
  console.log(data);
} catch (error) {
  console.log('Could not read the data');
}
console.log('This line does run');
```

The `try` block holds code that might fail. If anything inside it throws, execution jumps straight to `catch` and the rest of the `try` block is skipped.

## The error object

```javascript
try {
  null.someMethod();
} catch (error) {
  console.log(error.name);
  console.log(error.message);
  console.log(error.stack);
}
```

- `name` is the type, such as `TypeError`.
- `message` is the human readable description.
- `stack` shows where it happened.

If you do not need the details, you can leave out the parameter entirely:

```javascript
try {
  riskyThing();
} catch {
  console.log('Something went wrong');
}
```

## `finally`

Runs whether or not there was an error. Perfect for cleanup.

```javascript
function loadData() {
  showSpinner();
  try {
    return fetchSomething();
  } catch (error) {
    console.log('Failed:', error.message);
    return null;
  } finally {
    hideSpinner();
  }
}
```

The spinner is hidden on success, on failure, and even if you `return` from inside the `try`.

## Throwing your own errors

You are not limited to errors JavaScript raises. Throw your own when something is wrong in your rules.

```javascript
function setAge(age) {
  if (typeof age !== 'number') {
    throw new Error('Age must be a number');
  }
  if (age < 0) {
    throw new Error('Age cannot be negative');
  }
  return age;
}
try {
  setAge(-5);
} catch (error) {
  console.log(error.message);
}
```

> **Always throw an `Error` object, not a plain string.** `throw 'oops'` works but gives you no `stack` and no `name`, which makes debugging much harder.

## Built in error types

```javascript
console.log(new TypeError('Wrong type').name);
console.log(new RangeError('Out of range').name);
console.log(new SyntaxError('Bad syntax').name);
console.log(new ReferenceError('Not defined').name);
```

Use the specific one when it fits, since it tells the reader more:

```javascript
function divide(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  if (b === 0) {
    throw new RangeError('Cannot divide by zero');
  }
  return a / b;
}
```

## Custom error classes

For bigger applications, define your own types so callers can tell failures apart.

```javascript
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
try {
  throw new ValidationError('Email is required', 'email');
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Problem with field:', error.field);
  } else {
    throw error;
  }
}
```

Notice the `else { throw error; }`. If you cannot handle an error, pass it on rather than swallowing it.

## Do not swallow errors

```javascript
try {
  doSomething();
} catch (error) {
}
```

An empty `catch` hides the problem completely. When something misbehaves later, you will have no idea why. At the very least, log it.

## Catch what you can actually handle

```javascript
try {
  const value = calculate();
  saveToDatabase(value);
  sendEmail(value);
} catch (error) {
  console.log('Something failed somewhere');
}
```

That block is too wide. You cannot tell which step failed or respond usefully. Wrap the specific risky operation instead, and let the rest fail loudly.

## What `try-catch` cannot catch

It only catches errors thrown **during** the `try` block. Errors from asynchronous callbacks escape it:

```javascript
try {
  setTimeout(function () {
    throw new Error('Too late');
  }, 100);
} catch (error) {
  console.log('This never runs');
}
```

By the time the callback fires, the `try` block has long finished. For promises and `async` functions there is a different approach, which you will meet in the asynchronous topics later in this course.

## A practical validator

```javascript
function validateUser(user) {
  if (!user) {
    throw new Error('No user provided');
  }
  if (!user.email || !user.email.includes('@')) {
    throw new ValidationError('A valid email is required', 'email');
  }
  if (!user.age || user.age < 18) {
    throw new ValidationError('Must be 18 or older', 'age');
  }
  return true;
}
try {
  validateUser({ email: 'bad', age: 25 });
} catch (error) {
  console.log(error.name + ':', error.message);
}
```

## Quick recap

- `try` runs risky code, `catch` handles the failure, `finally` always cleans up.
- The error object gives you `name`, `message` and `stack`.
- Throw `new Error(...)` rather than a plain string.
- Pick a specific built in type, or define your own class for bigger apps.
- Never leave a `catch` block empty.
- Wrap the specific risky line, not your whole function.
- `try-catch` does not catch errors from asynchronous callbacks.

<code id="code-content" class="language-javascript">
// try / catch / finally
function readConfig(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.log('Could not read config:', error.message);
    return {};                       // a safe fallback
  } finally {
    console.log('Finished reading config');
  }
}
console.log(readConfig('{"theme":"dark"}'));
console.log(readConfig('not json'));
// Throwing your own errors, with the most specific type available
function divide(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  if (b === 0) {
    throw new RangeError('Cannot divide by zero');
  }
  return a / b;
}
try {
  divide(10, 0);
} catch (error) {
  console.log(error.name + ':', error.message);
}
// A custom error type carries extra information
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
function validateUser(user) {
  if (!user) throw new Error('No user provided');
  if (!user.email || !user.email.includes('@')) {
    throw new ValidationError('A valid email is required', 'email');
  }
  if (user.age &lt; 18) {
    throw new ValidationError('Must be 18 or older', 'age');
  }
  return true;
}
try {
  validateUser({ email: 'bad-email', age: 25 });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Field "' + error.field + '":', error.message);
  } else {
    throw error;                     // pass on what you cannot handle
  }
}
</code></pre>
