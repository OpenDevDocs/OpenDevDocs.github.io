---
publishDate: 2026-05-22T10:04
title: React DevTools, Profiler and Performance Tracks
slug: react-devtools-and-profiling
metadescription: Find out what is actually slow using the Components and Profiler tabs, and React 19.2's performance tracks.
updateDate: 2026-09-05T10:04
author: ['bishal-biswas']
level: 3
tags: ['tools', 'performance', 'debugging']
course: react
---

## Install it first

React DevTools is a browser extension for Chrome, Firefox and Edge. It adds two tabs: **Components** and **Profiler**.

If you are debugging React without it, you are working with one hand tied.

## The Components tab

Shows your component tree rather than the DOM.

Select any component and you can see and **edit** its props, state and hooks live. Changing a value in the panel re-renders immediately, which is far faster than editing code to test a state.

Two settings worth turning on straight away.

**Highlight updates when components render.** Every component that re-renders flashes a border. Type in one field and watch what lights up. If half the page flashes for one keystroke, you have found something.

**Record why each component rendered.** DevTools then tells you whether it was props, state, a hook or a parent re-rendering.

The search box takes a component name, which beats scrolling a deep tree.

Also useful: the `$r` shortcut. Select a component, then in the console `$r` refers to its instance, so you can inspect props directly.

## The Profiler tab

Records what happened during an interaction.

1. Open **Profiler**.
2. Click record.
3. Do the slow thing, once.
4. Stop.

You get one bar per commit, and can step through them.

### The flame chart

Each bar is a component. Width is time, and grey means it did not re-render.

Look for **wide bars**, which are slow components, and for **things that should not be there at all**. A component that re-renders when nothing about it changed is usually the real problem.

### The ranked chart

The same data sorted by duration, slowest first. Usually the faster way to find the culprit.

### Reading it honestly

A component taking 0.4ms is not your problem, even if it renders often. A component taking 80ms is.

Also check the **commit count**. Fifty commits for one keystroke means something is setting state in a loop.

## Profile a production build

```bash
npm run build
npm run preview
```

Development builds are much slower than production. React does extra checks, warnings and StrictMode double invocation.

Profiling in development tells you about relative cost, which is useful. It exaggerates absolute numbers considerably, so never quote a development timing as what users experience.

For a production build with profiling still enabled, most bundlers offer a flag such as `--profile`.

## Performance tracks

React 19.2 adds custom tracks to the browser's own Performance panel.

Record a profile in Chrome DevTools and you now see React's work labelled alongside everything else: scripting, layout, paint and network.

Two tracks:

- **Scheduler**, showing what React is working on and at which priority. Transitions and low priority work are visible as such.
- **Components**, showing which components rendered and their effects.

This is a genuine improvement, because it puts React's work in context. A 40ms render matters differently when it sits next to a 900ms image decode.

Use the Profiler tab to answer "which component", and performance tracks to answer "is React even the problem".

## The Profiler component

For measuring in code, including in production.

```javascript
import { Profiler } from 'react';
function onRender(id, phase, actualDuration, baseDuration, startTime, commitTime) {
  if (actualDuration > 16) {
    console.warn(`${id} took ${actualDuration.toFixed(1)}ms during ${phase}`);
  }
}
function App() {
  return (
    <Profiler id="Dashboard" onRender={onRender}>
      <Dashboard />
    </Profiler>
  );
}
```

- **`phase`** is `'mount'`, `'update'` or `'nested-update'`.
- **`actualDuration`** is how long this render took.
- **`baseDuration`** is how long it would take with no memoization, so comparing the two tells you whether memoization is helping.

The 16ms threshold is one frame at 60fps. Anything longer risks a dropped frame.

Sending these numbers to your monitoring gives you real user data rather than your own fast laptop.

## A method that works

1. **Reproduce it.** Find the specific interaction that feels slow.
2. **Check whether React is the problem.** Use the browser Performance panel. Often it is images, network or a third party script.
3. **Record with the Profiler.** Find the widest bar.
4. **Ask why it rendered.** DevTools will tell you.
5. **Fix the cause**, not the symptom. A component re-rendering unnecessarily usually points at an unstable prop, not a missing `memo`.
6. **Measure again.** Confirm it helped.

Step 5 matters most. Adding `memo` to silence a symptom leaves the cause in place, and it will resurface.

## Quick recap

- Install React DevTools, and turn on highlight updates.
- The Components tab lets you edit props and state live.
- The Profiler shows which components rendered and for how long.
- The ranked chart is usually the fastest route to the culprit.
- Profile a production build for realistic numbers.
- React 19.2 performance tracks put React's work next to everything else.
- The `Profiler` component measures in code and in production.
- Find the cause, not the symptom, and measure again afterwards.

<code id="code-content" class="language-javascript">
import { Profiler } from 'react';
// The Profiler component measures in code, including in production,
// which gives you real user numbers instead of your own fast laptop.
function onRender(
  id,              // the id prop you gave the Profiler
  phase,           // 'mount', 'update' or 'nested-update'
  actualDuration,  // how long THIS render took
  baseDuration,    // how long it would take with NO memoization
  startTime,
  commitTime
) {
  // 16ms is one frame at 60fps. Longer than that risks a dropped frame.
  if (actualDuration &gt; 16) {
    console.warn(id + ' took ' + actualDuration.toFixed(1) + 'ms (' + phase + ')');
  }
  // Comparing the two tells you whether memoization is actually helping
  if (baseDuration - actualDuration &lt; 1) {
    console.info(id + ': memoization is saving almost nothing here');
  }
  // In production, send these to your monitoring service
  // reportMetric({ id, phase, actualDuration });
}
export default function App() {
  return (
    &lt;div&gt;
      &lt;Profiler id="Dashboard" onRender={onRender}&gt;
        &lt;Dashboard /&gt;
      &lt;/Profiler&gt;
      &lt;Profiler id="Sidebar" onRender={onRender}&gt;
        &lt;Sidebar /&gt;
      &lt;/Profiler&gt;
    &lt;/div&gt;
  );
}
// IN THE BROWSER:
// 1. Install the React DevTools extension.
// 2. Components tab settings, turn BOTH of these on:
//      "Highlight updates when components render"
//        -&gt; type in one field and watch what flashes. If half the page
//           lights up for one keystroke, you have found the problem.
//      "Record why each component rendered"
//        -&gt; tells you whether it was props, state, a hook or the parent
// 3. Select a component, then type $r in the console to inspect it.
// 4. Profiler tab: record, do the slow thing ONCE, stop.
//      flame chart   width is time, grey means it did not re-render
//      ranked chart  the same data sorted slowest first, usually faster
//      commit count  fifty commits for one keystroke means a state loop
// 5. React 19.2 adds Scheduler and Components tracks to the BROWSER
//    Performance panel, so React's work sits next to layout, paint and
//    network. Use that to ask "is React even the problem", and the
//    Profiler tab to ask "which component".
// PROFILE A PRODUCTION BUILD. Development adds checks, warnings and
// StrictMode double invocation, so the absolute numbers are inflated.
//   npm run build &amp;&amp; npm run preview
// AND FIX THE CAUSE. A component re-rendering for no reason usually
// points at an unstable prop, not at a missing memo.
</code></pre>
