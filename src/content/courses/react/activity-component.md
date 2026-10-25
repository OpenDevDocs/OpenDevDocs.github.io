---
publishDate: 2026-05-21T10:01
title: Activity for Pre-rendering and State Preservation
slug: activity-component
metadescription: Hide part of the tree while keeping its state, and pre-render what the user is likely to open next.
updateDate: 2026-09-05T10:01
author: ['bishal-biswas']
level: 3
tags: ['react-19', 'performance', 'ux']
course: react
---

## The old choice

Hiding something has always been a trade off between two imperfect options.

```javascript
function Tabs({ active }) {
  return <div>{active === 'search' ? <SearchTab /> : <SettingsTab />}</div>;
}
```

**Unmounting** destroys the state. Switch away from the search tab and back, and the query, scroll position and results are gone.

```javascript
function Tabs({ active }) {
  return (
    <div>
      <div style={{ display: active === 'search' ? 'block' : 'none' }}>
        <SearchTab />
      </div>
    </div>
  );
}
```

**Hiding with CSS** keeps the state, but the component is still fully alive: it re-renders, its effects keep running, its timers keep firing and its subscriptions stay open. You pay for something nobody can see.

## Activity

React 19.2 added a third option.

```javascript
import { Activity } from 'react';
function Tabs({ active }) {
  return (
    <div>
      <Activity mode={active === 'search' ? 'visible' : 'hidden'}>
        <SearchTab />
      </Activity>
      <Activity mode={active === 'settings' ? 'visible' : 'hidden'}>
        <SettingsTab />
      </Activity>
    </div>
  );
}
```

When hidden, React:

- **Keeps the state**, so the search query survives.
- **Hides it visually**, as `display: none` would.
- **Cleans up effects**, so timers stop and subscriptions close.
- **Deprioritises rendering**, so updates happen only when there is spare time.

State without the cost. That is the combination that was previously impossible.

## Effects are unmounted

The important detail.

```javascript
function SearchTab() {
  const [query, setQuery] = useState('');
  useEffect(() => {
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

Hide this and the cleanup runs, so the interval stops. Show it again and the effect runs again, restarting it. Meanwhile `query` was never lost.

This is exactly the behaviour you want, and it is why your cleanup functions need to be correct. An effect that cannot be torn down and set up again will misbehave here, the same way it does under StrictMode.

## Pre-rendering

The other mode is more interesting.

```javascript
function App({ currentPage }) {
  return (
    <div>
      <Activity mode={currentPage === 'home' ? 'visible' : 'hidden'}>
        <HomePage />
      </Activity>
      <Activity mode={currentPage === 'profile' ? 'visible' : 'hidden'}>
        <ProfilePage />
      </Activity>
    </div>
  );
}
```

React renders hidden Activity content at **low priority**, in the background, when the browser is otherwise idle.

So the profile page is already rendered before the user clicks. Switching is instant, with no loading state and no work at the moment of the click.

This is pre-rendering for the interface, in the same spirit as prefetching data.

## Where it helps

**Tabs and accordions** where re-entering should feel like returning, not starting over.

```javascript
function Editor({ activeTab }) {
  return (
    <>
      <Activity mode={activeTab === 'code' ? 'visible' : 'hidden'}>
        <CodeEditor />
      </Activity>
      <Activity mode={activeTab === 'preview' ? 'visible' : 'hidden'}>
        <Preview />
      </Activity>
    </>
  );
}
```

Switch to preview and back, and your cursor position and undo history are still there.

**Multi step forms**, where going back should show what you typed.

**Router caching**, keeping recently visited routes ready so back navigation is instant.

**Modals** that should remember their state between openings.

## What it does not do

**It does not replace lazy loading.** Hidden content still has to be downloaded. Activity manages rendering, not bundles.

**It is not free.** Hidden trees hold memory. Do not wrap fifty routes in it and expect no cost.

**It does not defer data fetching by itself.** An effect that fetches will not run while hidden, which is usually right, but a Suspense driven fetch may still start.

## Choosing between the three

**Unmount** when re-entering should be a clean slate. A "create new" form should not remember the last one.

**Activity hidden** when the state should survive but the work should not continue. Tabs, wizards, cached routes.

**CSS hiding** almost never, now. It was always the compromise, and Activity replaces it.

## Availability

`Activity` is stable from React 19.2. In earlier versions you may see `unstable_Activity`. Check what your version exports before relying on it.

## Quick recap

- Unmounting loses state, CSS hiding keeps the cost.
- `Activity` keeps state while cleaning up effects.
- Hidden content renders at low priority in the background.
- That makes switching to it instant, like prefetching for the interface.
- Effects unmount and remount, so cleanup must be correct.
- It does not replace code splitting, and hidden trees still use memory.
- Unmount for a clean slate, use Activity when returning should feel like returning.

<code id="code-content" class="language-javascript">
import { Activity, useState, useEffect } from 'react';
// THE OLD CHOICE, both imperfect:
//   unmounting      -&gt; state is destroyed, the tab starts over
//   display: none   -&gt; state survives, but effects, timers and
//                      subscriptions all keep running for nothing
// ACTIVITY gives you state WITHOUT the cost.
export default function Editor({ activeTab }) {
  return (
    &lt;div&gt;
      &lt;Activity mode={activeTab === 'search' ? 'visible' : 'hidden'}&gt;
        &lt;SearchTab /&gt;
      &lt;/Activity&gt;
      &lt;Activity mode={activeTab === 'settings' ? 'visible' : 'hidden'}&gt;
        &lt;SettingsTab /&gt;
      &lt;/Activity&gt;
    &lt;/div&gt;
  );
}
function SearchTab() {
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  useEffect(() =&gt; {
    // When this Activity becomes hidden, the CLEANUP runs and the
    // interval stops. When it becomes visible, the effect runs again.
    // Meanwhile `query` and `scrollTop` were never lost.
    const id = setInterval(() =&gt; console.log('refreshing'), 5000);
    return () =&gt; clearInterval(id);
  }, []);
  return &lt;input value={query} onChange={(e) =&gt; setQuery(e.target.value)} /&gt;;
}
// PRE-RENDERING: React renders hidden Activity content at LOW PRIORITY
// in the background, when the browser is idle. So the profile page is
// already built before the user clicks, and switching is instant.
function App({ currentPage }) {
  return (
    &lt;div&gt;
      &lt;Activity mode={currentPage === 'home' ? 'visible' : 'hidden'}&gt;
        &lt;HomePage /&gt;
      &lt;/Activity&gt;
      &lt;Activity mode={currentPage === 'profile' ? 'visible' : 'hidden'}&gt;
        &lt;ProfilePage /&gt;     {/* rendered before it is ever shown */}
      &lt;/Activity&gt;
    &lt;/div&gt;
  );
}
// WHEN TO USE WHICH:
//   unmount           a "create new" form should NOT remember the last one
//   Activity hidden   tabs, wizard steps, recently visited routes
//   display: none     almost never now, Activity replaces it
// WHAT IT DOES NOT DO:
// - it does not replace lazy loading, the code is still downloaded
// - hidden trees still hold memory, so do not wrap fifty routes
// - effects unmount and remount, so your cleanup must be correct,
//   exactly as StrictMode already demanded
</code></pre>
