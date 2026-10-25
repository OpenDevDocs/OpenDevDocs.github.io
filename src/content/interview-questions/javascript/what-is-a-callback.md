---
course: javascript
slug: what-is-a-callback
experienceLevel: fresher
difficulty: easy
tags:
  - callbacks
  - functions
  - async
question: What is a callback function?
answer: |
  A callback is a function passed as an argument to another function, which then calls it at the right time, either immediately or later.

  This works because functions in JavaScript are first-class values: they can be stored in variables, passed around and returned like any other value.

  There are two kinds:

  - **Synchronous callbacks** run before the outer function returns. Examples: `array.map(fn)`, `array.filter(fn)`, `array.sort(compareFn)`.
  - **Asynchronous callbacks** run later, after some event or operation completes. Examples: `setTimeout(fn, 1000)`, `button.addEventListener("click", fn)`, and Node.js APIs such as `fs.readFile(path, fn)`.

  Node.js popularised the **error-first** convention, where the callback's first argument is an error (or `null`) and the second is the result: `(err, data) => { ... }`.

  Problems with heavy callback use:

  - **Callback hell:** nesting several dependent async steps creates deeply indented, hard-to-read code.
  - **Error handling:** each level must check and pass on errors manually, and `try...catch` around the outer call does not catch errors thrown later inside an async callback.
  - **Inversion of control:** you trust the other function to call your callback exactly once, at the right time.

  These problems led to **promises** and **`async`/`await`**, which are now the standard for asynchronous code. Callbacks are still everywhere for synchronous helpers like `map` and for events, where a function needs to run each time something happens.

  A common mistake is passing the result of a call instead of the function: `setTimeout(doWork(), 1000)` runs `doWork` immediately. Pass `doWork` or `() => doWork()` instead.
codeExample: |
  // Synchronous callback
  const doubled = [1, 2, 3].map((n) => n * 2);
  console.log(doubled); // Output: [ 2, 4, 6 ]

  // Your own function that accepts a callback
  function fetchUser(id, callback) {
    setTimeout(() => {
      if (id <= 0) return callback(new Error("Invalid id"));
      callback(null, { id, name: "Ada" });
    }, 10);
  }

  fetchUser(1, (err, user) => {
    if (err) return console.log("Error:", err.message);
    console.log("Loaded", user.name);
  });

  fetchUser(0, (err) => {
    if (err) console.log("Error:", err.message);
  });

  console.log("Requests started");
  // Output: Requests started
  // Output: Loaded Ada
  // Output: Error: Invalid id
popularity: 8.9
isPublished: true
---
