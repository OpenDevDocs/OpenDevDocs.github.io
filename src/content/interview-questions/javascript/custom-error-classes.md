---
course: javascript
slug: custom-error-classes
experienceLevel: mid
difficulty: medium
tags:
  - error-handling
  - classes
question: "How do you create custom error classes, and what is `error.cause` for?"
answer: |
  Create a custom error by extending `Error` (or a built-in subclass such as `TypeError`), calling `super(message, options)` and setting `this.name`; use the `cause` option to wrap a lower-level error so the original failure is kept alongside your higher-level message.

  Why custom errors help:

  - Callers can branch on the **type** with `instanceof` (`if (err instanceof NotFoundError) return 404`) instead of parsing message strings.
  - You can attach structured data, such as an HTTP `status`, a field name or an error `code`.
  - Logs and stack traces show a meaningful `name` instead of a generic `Error`.

  Implementation details:

  1. Always call `super(message, options)` first; it sets `message`, the stack trace and `cause`.
  2. Set `this.name`. Using `this.name = this.constructor.name` or a class field `name = 'ValidationError'` works; note that minifiers can rename classes, so a hard-coded string is safer for logging.
  3. Modern engines handle the prototype chain correctly with `class extends Error`. The old `Object.setPrototypeOf(this, new.target.prototype)` workaround was only needed when compiling down to ES5.
  4. A shared base class (`AppError`) lets you separate expected, handled errors from programming bugs.

  `error.cause` (ES2022):

  - `new Error('Failed to load user', { cause: err })` keeps the original error on `err.cause` instead of discarding it or concatenating messages.
  - Node.js and browser devtools print the cause chain, which makes debugging layered code (repository, service, controller) much easier.
  - `cause` can be any value, but passing the original `Error` is the convention.

  Pitfalls:

  - Do not throw strings or plain objects; you lose the stack trace and `instanceof` checks.
  - `instanceof` can fail across realms (iframes, separate `vm` contexts) or when two copies of a library are bundled. Checking a `code` property is more robust in such cases.
  - `JSON.stringify(error)` gives `{}` for standard properties because `message` and `stack` are non-enumerable. Serialize the fields you need explicitly.
  - `Error.captureStackTrace` is V8-specific; you do not need it for normal subclasses.
codeExample: |
  class AppError extends Error {
    constructor(message, options) {
      super(message, options);           // sets message, stack and cause
      this.name = this.constructor.name;
    }
  }

  class NotFoundError extends AppError {
    status = 404;
    constructor(resource, id, options) {
      super(`${resource} ${id} not found`, options);
      this.resource = resource;
    }
  }

  const queryDatabase = () => { throw new Error('ECONNRESET: connection lost'); };

  function getUser(id) {
    try {
      queryDatabase(id);
    } catch (err) {
      throw new NotFoundError('User', id, { cause: err }); // keep the low-level error
    }
  }

  try {
    getUser(42);
  } catch (err) {
    console.log(err instanceof NotFoundError, err instanceof AppError, err instanceof Error);
    // Output: true true true
    console.log(err.name, err.status, err.message); // Output: NotFoundError 404 User 42 not found
    console.log(err.cause.message);                  // Output: ECONNRESET: connection lost
    console.log(JSON.stringify(err));                // Output: {"name":"NotFoundError","status":404,"resource":"User"}
  }
popularity: 7.7
isPublished: true
---
