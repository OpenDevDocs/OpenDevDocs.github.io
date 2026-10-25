---
course: javascript
slug: temporal-dead-zone
experienceLevel: mid
difficulty: hard
tags:
  - hoisting
  - scope
  - var-let-const
question: What is the temporal dead zone (TDZ)?
answer: |
  The temporal dead zone is the period between the start of a scope and the line where a `let`, `const` or `class` declaration is evaluated; during that time the binding exists but is uninitialised, and any access throws a `ReferenceError`.

  How it relates to hoisting:

  - All declarations are hoisted, meaning the engine registers the name when it enters the scope.
  - `var` is also initialised to `undefined` immediately, so reading it early silently gives `undefined`.
  - `let`, `const` and `class` stay uninitialised until their declaration runs. That gap is the TDZ, and it turns a silent bug into an explicit error.
  - Function declarations are hoisted **with** their body, so they can be called before the line they are written on.

  "Temporal" means it is about **time of execution**, not position in the code. A function defined above a `let` can safely read it, as long as the function is **called** after the declaration has run.

  Cases that surprise people:

  1. **Shadowing**: an inner `let x` puts the whole inner block in the TDZ for `x`, even if an outer `x` exists. `let x = x + 1` inside a block throws instead of reading the outer value.
  2. **`typeof`** is normally safe for undeclared names (`typeof notDeclared` is `'undefined'`), but `typeof x` inside x's TDZ throws.
  3. **Default parameters** have their own TDZ: `function f(a = b, b = 1)` throws when `a` uses the default, because `b` is not initialised yet.
  4. **Classes** are not usable before their declaration, unlike function declarations. A subclass `extends Base` above `class Base` throws.
  5. **Circular ES module imports** can hit the TDZ when one module reads another's `let`/`const`/`class` export before that module has finished evaluating.

  Practical guidance: declare variables at the top of their block, before use, and prefer `const`. The TDZ is a safety feature: it catches use-before-initialisation bugs that `var` hides.
codeExample: |
  console.log(typeof hoistedVar, hoistedVar); // Output: undefined undefined
  var hoistedVar = 1;

  try {
    console.log(tdzLet);
  } catch (err) {
    console.log(err.name + ':', err.message);
    // Output: ReferenceError: Cannot access 'tdzLet' before initialization
  }
  let tdzLet = 2;

  // Temporal, not positional: the function only reads `later` when called
  const readLater = () => later;
  const later = 'ready';
  console.log(readLater()); // Output: ready

  // Shadowing puts the whole block in the TDZ
  const x = 10;
  {
    try { console.log(typeof x); } catch (err) { console.log('typeof throws:', err.name); }
    // Output: typeof throws: ReferenceError
    const x = 20;
  }

  // Default parameters are evaluated left to right
  function f(a = b, b = 1) { return [a, b]; }
  try { f(); } catch (err) { console.log('defaults:', err.name); } // Output: defaults: ReferenceError
  console.log(f(5)); // Output: [ 5, 1 ]
popularity: 8.1
isPublished: true
---
