---
publishDate: 2026-05-30T10:28
title: 'Concurrent Rendering Internals: Fiber and Lanes'
slug: concurrent-rendering-internals
metadescription: Understand how React can pause, resume and discard work, and why that makes transitions and Suspense possible.
updateDate: 2026-09-05T10:28
author: ['bishal-biswas']
level: 4
tags: ['internals', 'concurrency', 'architecture']
course: react
---

## Why this matters

You do not need this to use React. But it explains behaviour that otherwise looks arbitrary: why effects run twice, why a transition can be interrupted, why state updates batch, and why a component can render without committing.

## The old reconciler

Before React 16, rendering was recursive and synchronous. Once it started, it ran to completion.

A large tree meant a long task on the main thread, and the browser could not respond to anything until it finished. There was no way to pause.

## Fiber

React 16 rewrote this. A **fiber** is a plain object representing a unit of work, one per component.

```javascript
const fiber = {
  type: MyComponent,
  key: null,
  stateNode: null,
  child: null,
  sibling: null,
  return: null,
  pendingProps: {},
  memoizedProps: {},
  memoizedState: null,
  flags: 0,
  lanes: 0,
  alternate: null
};
```

The important change is `child`, `sibling` and `return`. The tree is a **linked list**, not a recursive structure.

That means React can walk it with a loop rather than the call stack, and a loop can be **stopped and resumed**. That single change is what makes everything else possible.

## Two phases

### Render phase, interruptible

React walks the fiber tree, calls your components, and works out what changed. It builds a second tree, the work in progress, alongside the current one.

This phase can be paused, resumed, restarted or thrown away entirely.

**That is why your components must be pure.** React may call a component several times, or discard the result. A side effect during render happens an unpredictable number of times, which is exactly what StrictMode's double invocation is designed to expose.

### Commit phase, synchronous

Once the whole tree is ready, React applies the changes to the DOM in one uninterruptible pass, then runs layout effects, then paints, then runs passive effects.

The commit is never interrupted, because a half applied DOM update would be visibly broken.

## Double buffering

React keeps two trees: `current`, what is on screen, and the work in progress. Each fiber points at its counterpart through `alternate`.

When the work in progress is complete, React swaps the pointer. If it is abandoned, the current tree is untouched and nobody sees anything.

This is why an interrupted transition costs nothing visually. The discarded work never reached the screen.

## Lanes

React needs to know which updates are urgent. Lanes are the priority system, represented as bits.

```javascript
// SyncLane            a click, typing
// InputContinuousLane a drag, hover
// DefaultLane         a normal update
// TransitionLanes     startTransition
// RetryLanes          Suspense retries
// IdleLane            offscreen work
```

Using a bitmask means React can represent several pending priorities in one number and check them with fast bitwise operations.

When you call `startTransition`, the update is tagged with a transition lane. React works on the highest priority lane first, so an urgent keystroke interrupts an in progress transition.

```javascript
function handleChange(event) {
  setQuery(event.target.value);
  startTransition(() => setResults(filter(event.target.value)));
}
```

`setQuery` gets a sync lane and renders immediately. `setResults` gets a transition lane. If another keystroke arrives mid render, React abandons the transition work and starts again with the newer value.

## Time slicing

During a transition, React works in small chunks and checks whether it should yield.

Roughly:

```javascript
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}
```

`shouldYield` returns true when the frame budget is spent, so React hands control back to the browser, which can handle input and paint. React resumes on the next scheduled callback.

Urgent updates use a different loop with no yielding, because interrupting them would make the interface feel laggy.

## How Suspense fits

When a component suspends, it throws a promise. React catches it, marks that subtree, and renders the nearest boundary's fallback instead.

Because the render phase is interruptible, React can simply **not commit** the incomplete subtree, keeping the previous content on screen. That is why suspending inside a transition shows the old content rather than the fallback.

When the promise resolves, React retries on a retry lane.

## Batching

React 18 made batching automatic everywhere.

```javascript
function handleClick() {
  setCount(c => c + 1);
  setFlag(f => !f);
  setName('Asha');
}
```

One re-render, not three. Before React 18 this only applied inside React event handlers, and updates in a `setTimeout` or a promise callback each triggered their own render.

To opt out:

```javascript
import { flushSync } from 'react-dom';
flushSync(() => {
  setCount(count + 1);
});
console.log(ref.current.textContent);
```

`flushSync` forces a synchronous re-render. It defeats the scheduler, so use it only when you must read the DOM immediately after an update.

## What this explains

- **Components must be pure**, because render can run several times or be discarded.
- **StrictMode double invokes**, to surface impurity now rather than later.
- **Effects run after commit**, because the render phase may never commit.
- **Transitions can be interrupted**, because the loop can yield.
- **Suspense keeps old content**, because incomplete work is not committed.
- **Updates batch**, because the scheduler groups them by lane.

None of this requires action from you. It requires that you follow the rules of React, and now you know why they exist.

## Quick recap

- A fiber is a unit of work, linked so React can loop rather than recurse.
- The render phase is interruptible, the commit phase is not.
- Two trees are kept, so abandoned work never reaches the screen.
- Lanes are a bitmask priority system deciding what React works on first.
- Time slicing yields to the browser between chunks.
- Suspense works by not committing incomplete subtrees.
- Batching groups updates into one render.
- Purity is required because render may run repeatedly or be thrown away.

<code id="code-content" class="language-javascript">
// A FIBER is a plain object, one per component. The key part is that
// child / sibling / return make the tree a LINKED LIST, so React can
// walk it with a loop instead of the call stack. A loop can be paused
// and resumed. That one change makes everything else possible.
const fiberShape = {
  type: null,          // the component function or DOM tag
  child: null,         // first child
  sibling: null,       // next sibling
  return: null,        // parent
  memoizedState: null, // the hooks list lives here
  lanes: 0,            // pending priorities, as a bitmask
  alternate: null      // the counterpart in the other tree
};
// TWO PHASES:
//   render   interruptible. React calls your components and works out
//            what changed, building a second tree alongside the current
//            one. This can be paused, restarted or THROWN AWAY.
//   commit   synchronous. The DOM is updated in one uninterruptible
//            pass, because a half applied update would look broken.
// THIS IS WHY COMPONENTS MUST BE PURE. React may call yours several
// times or discard the result entirely, so a side effect during render
// happens an unpredictable number of times. StrictMode's double
// invocation exists to surface exactly that.
let counter = 0;
function Impure() {
  counter++;                // runs an unknown number of times
  return counter;
}
// LANES decide what React works on first
function SearchBox({ allItems }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(allItems);
  const [isPending, startTransition] = useTransition();
  function handleChange(event) {
    const next = event.target.value;
    setQuery(next);                        // sync lane, renders now
    startTransition(() =&gt; {                // transition lane, yields
      setResults(allItems.filter((i) =&gt; i.name.includes(next)));
    });
    // If another keystroke arrives mid render, React ABANDONS the
    // transition work and restarts with the newer value. Nothing was
    // committed, so nothing flickered.
  }
  return &lt;input value={query} onChange={handleChange} /&gt;;
}
// TIME SLICING, roughly:
//   while (workInProgress !== null &amp;&amp; !shouldYield()) {
//     performUnitOfWork(workInProgress);
//   }
// shouldYield() returns true when the frame budget is spent, so the
// browser gets to handle input and paint before React resumes.
// BATCHING is automatic everywhere since React 18. This is ONE render.
function handleClick() {
  setCount((c) =&gt; c + 1);
  setFlag((f) =&gt; !f);
  setName('Asha');
}
// flushSync opts out, forcing a synchronous render. It defeats the
// scheduler, so use it only to read the DOM straight after an update.
// import { flushSync } from 'react-dom';
// flushSync(() =&gt; setCount(count + 1));
// console.log(ref.current.textContent);   the new value
</code></pre>
