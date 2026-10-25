---
course: javascript
slug: pure-functions-and-immutability
experienceLevel: mid
difficulty: easy
tags:
  - functional-programming
  - immutability
question: What are pure functions and why does immutability matter in JavaScript?
answer: |
  A pure function always returns the same output for the same input and has no side effects; immutability means you never change existing data in place but create new values instead, which is what makes pure functions possible when working with objects and arrays.

  A function is impure if it:

  - Mutates its arguments or any outside state (`arr.push`, `user.name = ...`).
  - Depends on something other than its inputs: `Date.now()`, `Math.random()`, global variables, the DOM.
  - Performs I/O: network calls, logging, writing to storage.

  Why it matters:

  - **Predictability and testing**: pure functions can be tested with plain input/output assertions and no mocks.
  - **Cheap change detection**: if data is never mutated, a changed object always has a new reference, so `prev !== next` is enough. React, Redux and many state libraries rely on this; mutating state in place leads to components that do not re-render.
  - **Safe sharing**: values passed around cannot be changed under you by other code.
  - **Memoization** and caching only work correctly with pure functions.

  Mutating vs non-mutating array methods:

  - Mutating: `push`, `pop`, `splice`, `sort`, `reverse`, `fill`.
  - Non-mutating: `map`, `filter`, `slice`, `concat`, spread, and the ES2023 copies `toSorted`, `toReversed`, `toSpliced` and `with(index, value)`.

  Pitfalls:

  - `const` does not make a value immutable; it only prevents reassigning the variable.
  - Spread is shallow. When updating nested data, copy every level along the path you change.
  - Real programs need side effects. The goal is to keep the core logic pure and push effects (I/O, DOM updates) to the edges.

  `Object.freeze` can help catch accidental mutation in development, and libraries such as Immer let you write "mutating" code that produces immutable updates.
codeExample: |
  // Impure: mutates its input and depends on outside state
  let taxRate = 0.2;
  function addTaxImpure(cart) {
    cart.total = cart.total * (1 + taxRate);
    return cart;
  }

  // Pure: same input, same output, input untouched
  const addTax = (cart, rate) => ({ ...cart, total: cart.total * (1 + rate) });

  const cart = { id: 1, total: 100 };
  const taxed = addTax(cart, 0.2);
  console.log(cart.total, taxed.total, cart === taxed); // Output: 100 120 false

  // Immutable nested update: copy each level on the changed path
  const state = { user: { name: 'Ada', prefs: { theme: 'light' } }, items: [3, 1, 2] };
  const next = {
    ...state,
    user: { ...state.user, prefs: { ...state.user.prefs, theme: 'dark' } },
  };
  console.log(state.user.prefs.theme, next.user.prefs.theme); // Output: light dark
  console.log(state.items === next.items); // Output: true (unchanged parts are shared)

  // Non-mutating array methods (ES2023)
  const sorted = state.items.toSorted();
  const replaced = state.items.with(0, 99);
  console.log(state.items, sorted, replaced); // Output: [ 3, 1, 2 ] [ 1, 2, 3 ] [ 99, 1, 2 ]
popularity: 7.8
isPublished: true
---
