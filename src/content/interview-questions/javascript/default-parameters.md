---
course: javascript
slug: default-parameters
experienceLevel: fresher
difficulty: easy
tags:
  - functions
  - es6
question: How do default parameters work in JavaScript functions?
answer: |
  Default parameters let you give a function parameter a fallback value that is used when the argument is missing or explicitly `undefined`.

  ```js
  function greet(name = "guest") { ... }
  ```

  Important rules:

  - The default applies **only for `undefined`**. Passing `null`, `0`, `""` or `false` keeps that value. This is different from the old pattern `name = name || "guest"`, which also replaced valid falsy values.
  - Defaults are evaluated **at call time**, every time. So `function add(item, list = [])` gets a fresh array on each call, unlike Python's shared mutable default.
  - A default can use earlier parameters: `function area(width, height = width)`. It cannot use later ones, because they are still in the temporal dead zone.
  - A default can be any expression, including a function call. A neat trick is a "required" check: `function f(id = required("id"))`, where `required` throws.
  - Parameters with defaults (and everything after them) are not counted in the function's `length` property.

  Defaults combine well with destructuring for options objects:

  ```js
  function connect({ host = "localhost", port = 80 } = {}) { ... }
  ```

  The trailing `= {}` matters: without it, calling `connect()` tries to destructure `undefined` and throws a `TypeError`.

  To skip a middle parameter, pass `undefined` explicitly. If you find yourself doing that often, an options object is usually a clearer design.
codeExample: |
  function greet(name = "guest", greeting = `Hello, ${name}`) {
    return greeting;
  }
  console.log(greet()); // Output: Hello, guest
  console.log(greet("Ada")); // Output: Hello, Ada
  console.log(greet(undefined)); // Output: Hello, guest
  console.log(greet(null)); // Output: Hello, null

  function addItem(item, list = []) {
    list.push(item);
    return list;
  }
  console.log(addItem("a")); // Output: [ 'a' ]
  console.log(addItem("b")); // Output: [ 'b' ]

  const required = (name) => {
    throw new Error(`${name} is required`);
  };
  function findUser(id = required("id")) {
    return id;
  }
  try {
    findUser();
  } catch (err) {
    console.log(err.message); // Output: id is required
  }
  console.log(greet.length); // Output: 0
popularity: 8.0
isPublished: true
---
