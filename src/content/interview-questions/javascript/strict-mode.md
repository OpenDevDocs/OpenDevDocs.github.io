---
course: javascript
slug: strict-mode
experienceLevel: fresher
difficulty: easy
tags:
  - basics
  - strict-mode
question: What is strict mode in JavaScript?
answer: |
  Strict mode is an opt-in, restricted variant of JavaScript that turns silent mistakes into thrown errors, removes some confusing features and makes code easier for engines to optimise.

  You enable it by putting `"use strict";` at the very top of a script or a function. It is **on automatically** inside ES modules and class bodies, so most modern code already runs in strict mode without the directive.

  The main changes:

  - **Assigning to an undeclared variable throws** a `ReferenceError` instead of silently creating a global. This catches typos like `totl = 5`.
  - **`this` is `undefined`** in plain function calls instead of defaulting to the global object, so a detached method fails fast rather than modifying `window`.
  - **Writing to read-only properties throws** a `TypeError`, for example on a frozen object, a getter-only property, or a string index. In sloppy mode these writes fail silently.
  - Deleting non-deletable properties, such as `delete Object.prototype`, throws.
  - **Duplicate parameter names** are a `SyntaxError`.
  - **`with` statements** and legacy octal literals like `010` are not allowed.
  - `eval` cannot create variables in the surrounding scope.
  - Some future keywords, such as `implements`, `interface`, `private` and `public`, are reserved.

  Things to remember: the directive must be the first statement, otherwise it is just an ignored string. You cannot turn strict mode off inside a module or class. Concatenating a strict file with a non-strict one can unexpectedly change the mode of the whole bundle, which is one reason modules are preferred.

  In interviews, the key message is that strict mode makes bugs louder and earlier, and that ESM makes it the default.
codeExample: |
  "use strict";

  try {
    totl = 5; // typo for an undeclared variable
  } catch (err) {
    console.log(err.name); // Output: ReferenceError
  }

  function whoAmI() {
    return this;
  }
  console.log(whoAmI()); // Output: undefined

  const config = Object.freeze({ debug: false });
  try {
    config.debug = true;
  } catch (err) {
    console.log(err.message); // Output: Cannot assign to read only property 'debug' of object '#<Object>'
  }

  function sloppyCheck() {
    // Without "use strict" this would return the global object
    return typeof this;
  }
  console.log(sloppyCheck()); // Output: undefined
popularity: 7.6
isPublished: true
---
