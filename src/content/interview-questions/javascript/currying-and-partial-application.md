---
course: javascript
slug: currying-and-partial-application
experienceLevel: mid
difficulty: medium
tags:
  - functional-programming
  - functions
  - closures
question: What is currying, and how is it different from partial application?
answer: |
  Currying transforms a function of several arguments into a chain of functions that each take **one** argument, so `f(a, b, c)` becomes `f(a)(b)(c)`; partial application fixes **some** arguments of a function now and returns a function that takes the rest later.

  The difference in short:

  - Currying is a transformation of the function's shape. A curried `add` always takes arguments one at a time (or, in practical "auto-curry" helpers, in any grouping until enough arguments have arrived).
  - Partial application is about pre-filling. `fn.bind(null, a)` or `(b, c) => fn(a, b, c)` both partially apply `a`. The result can still take several arguments at once.
  - A curried function makes partial application trivial: calling it with the first argument already gives you a specialised function.

  How it works: both rely on closures. Each returned function remembers the arguments collected so far. A generic `curry` helper compares the number of collected arguments with `fn.length` and either calls `fn` or returns another collecting function.

  Where it is useful:

  - Building specialised functions from general ones: `const logError = log('error')`, `const withTax = multiply(1.2)`.
  - Point-free pipelines with `map`/`filter`, for example `users.filter(hasRole('admin'))`.
  - Configuring something once and reusing it, such as a fetch wrapper with a fixed base URL.

  Pitfalls:

  - `fn.length` ignores rest parameters and parameters with default values, so auto-curry helpers break on them.
  - Deeply curried code can be harder to read and debug for teammates who are not used to the style, and stack traces get longer.
  - Argument order matters: put the arguments that change least often first, the data last.

  In everyday JavaScript, a simple arrow function or `bind` for partial application is usually enough; reach for generic currying mainly in functional-style codebases.
codeExample: |
  // Manual currying with closures
  const multiply = (a) => (b) => a * b;
  const double = multiply(2);
  console.log(double(21), multiply(3)(5)); // Output: 42 15

  // Generic curry helper based on fn.length
  function curry(fn) {
    return function curried(...args) {
      return args.length >= fn.length
        ? fn.apply(this, args)
        : (...more) => curried.apply(this, [...args, ...more]);
    };
  }

  const volume = curry((l, w, h) => l * w * h);
  console.log(volume(2)(3)(4), volume(2, 3)(4), volume(2)(3, 4)); // Output: 24 24 24

  // Partial application: fix some arguments, take the rest later
  function log(level, module, message) {
    return `[${level}] ${module}: ${message}`;
  }
  const authError = log.bind(null, 'ERROR', 'auth');
  console.log(authError('token expired')); // Output: [ERROR] auth: token expired

  // Useful in pipelines
  const hasRole = (role) => (user) => user.roles.includes(role);
  const users = [{ name: 'Ada', roles: ['admin'] }, { name: 'Bob', roles: [] }];
  console.log(users.filter(hasRole('admin')).map((u) => u.name)); // Output: [ 'Ada' ]

  console.log(((a, b = 1) => a).length); // Output: 1 (defaults are not counted)
popularity: 7.9
isPublished: true
---
