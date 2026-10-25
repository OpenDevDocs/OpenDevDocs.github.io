---
course: javascript
slug: try-catch-finally
experienceLevel: fresher
difficulty: easy
tags:
  - error-handling
question: "How does `try...catch...finally` work in JavaScript?"
answer: |
  `try...catch...finally` lets you run code that might throw an error, handle the error in `catch` instead of crashing, and run clean-up code in `finally` whether or not an error occurred.

  - **`try`** contains the code that might fail.
  - **`catch (err)`** runs only if something in `try` throws. The `err` binding is optional since ES2019: `catch { ... }`.
  - **`finally`** always runs: after `try` succeeds, after `catch` handles an error, and even if `try` or `catch` contains a `return`. It is the place to close resources, hide loading spinners or release locks.

  You raise your own errors with `throw`. Always throw `Error` objects (or subclasses like `TypeError`, or your own `class ValidationError extends Error`), not strings, so you get a `message`, a `name` and a stack trace. ES2022 added the `cause` option: `new Error("Save failed", { cause: err })`.

  Important points:

  - `try...catch` only catches errors thrown **synchronously** inside it, or from an `await`ed promise in an `async` function. An error thrown later inside a `setTimeout` callback, or a promise you did not `await`, is not caught.
  - Do not swallow errors with an empty `catch`. Handle them, log them, or rethrow them.
  - Catch blocks receive anything that was thrown, so check with `err instanceof SomeError` before relying on properties.
  - A `return` inside `finally` overrides the earlier return value or thrown error, which is almost always a bug.

  Use it around operations that can genuinely fail, such as `JSON.parse`, network calls and file access, rather than wrapping every line.
codeExample: |
  class ValidationError extends Error {
    name = "ValidationError";
  }

  function parseAge(input) {
    const age = Number(input);
    if (!Number.isInteger(age) || age < 0) {
      throw new ValidationError(`Invalid age: ${input}`);
    }
    return age;
  }

  for (const input of ["42", "abc"]) {
    try {
      console.log("Age:", parseAge(input));
    } catch (err) {
      if (err instanceof ValidationError) console.log(err.name, "-", err.message);
      else throw err;
    } finally {
      console.log("Checked", input);
    }
  }
  // Output: Age: 42
  // Output: Checked 42
  // Output: ValidationError - Invalid age: abc
  // Output: Checked abc

  const wrapped = new Error("Save failed", { cause: new Error("Disk full") });
  console.log(wrapped.cause.message); // Output: Disk full
popularity: 8.5
isPublished: true
---
