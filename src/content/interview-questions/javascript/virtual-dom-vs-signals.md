---
course: javascript
slug: virtual-dom-vs-signals
experienceLevel: senior
difficulty: hard
tags:
  - frameworks
  - reactivity
  - performance
question: How does a virtual DOM compare with signals-based fine-grained reactivity?
answer: |
  Both answer the same question: when state changes, which parts of the UI must update?

  A **virtual DOM** (React, and Vue's renderer) re-runs component functions to produce a new tree of plain objects, **diffs** it against the previous tree, and applies the minimal DOM operations. The model is simple: UI is a function of state, and you never track dependencies by hand. The cost is that work scales with the **size of the re-rendered subtree**, not with the size of the change. Performance therefore depends on memoisation (`memo`, `useMemo`, stable keys) or on a compiler (React Compiler) to skip unchanged subtrees.

  **Signals** (Solid, Preact Signals, Angular signals, Vue's `ref`, Svelte 5 runes) are reactive values that record **who reads them**. A computed value or an effect tracks its dependencies automatically during execution. When a signal is written, only the dependent computations re-run, and in Solid-style frameworks those computations update specific DOM nodes directly. Work scales with **what actually changed**.

  Trade-offs:

  - Signals give excellent update performance without manual memoisation, but they bring reactive-graph semantics: dependencies are tracked at runtime, reads outside a tracking scope are not reactive, and destructuring a value can break reactivity.
  - A virtual DOM gives a very predictable mental model and easy composition with plain JavaScript. Its wasted renders usually only matter in large, frequently updating trees.
  - Most frameworks now blend both. Vue uses reactive state with a virtual DOM; React is adding compiler-driven memoisation.

  There is also a TC39 proposal for standard signals (Stage 1 at the time of writing), aimed at framework interoperability rather than direct application use.

  How to decide: measure with the profiler on your real update patterns. Frequent small updates in large views (dashboards, editors, tables) favour fine-grained reactivity.
codeExample: |
  let currentEffect = null;

  function signal(value) {
    const subscribers = new Set();
    return {
      get() { if (currentEffect) subscribers.add(currentEffect); return value; },
      set(next) {
        if (Object.is(next, value)) return;     // no change, no work
        value = next;
        [...subscribers].forEach((fn) => fn());
      },
    };
  }

  function effect(fn) {
    const run = () => { currentEffect = run; try { fn(); } finally { currentEffect = null; } };
    run();
  }

  const firstName = signal('Ada');
  const clicks = signal(0);

  effect(() => console.log('header:', firstName.get()));  // reads firstName only
  effect(() => console.log('counter:', clicks.get()));    // reads clicks only

  clicks.set(1);        // re-runs only the counter effect
  clicks.set(1);        // same value: nothing runs
  firstName.set('Grace');
  // Output:
  // header: Ada
  // counter: 0
  // counter: 1
  // header: Grace
popularity: 7.3
isPublished: true
---
