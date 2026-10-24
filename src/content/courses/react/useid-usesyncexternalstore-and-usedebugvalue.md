---
publishDate: 2026-05-09T09:26
title: useId, useSyncExternalStore and useDebugValue
slug: useid-usesyncexternalstore-and-usedebugvalue
metadescription: Three smaller hooks worth knowing, covering stable ids for accessibility, subscribing to outside stores, and labelling custom hooks in DevTools.
updateDate: 2026-09-05T09:26
author: ['bishal-biswas']
level: 2
tags: ['hooks', 'accessibility']
course: react
---

## useId

Generates a unique id that is stable across server and client rendering.

```javascript
import { useId } from 'react';
function EmailField() {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>Email</label>
      <input id={id} type="email" />
    </div>
  );
}
```

### Why not just write an id?

```javascript
function EmailField() {
  return (
    <div>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" />
    </div>
  );
}
```

Render that component twice and you have two elements with `id="email"`. Ids must be unique in a document, so clicking the second label focuses the first input.

`useId` gives each instance its own value, something like `«r1»` and `«r2»`.

### Why not `Math.random()`?

Because the server and the browser would generate different values, and hydration would fail with a mismatch warning. `useId` is designed to produce the same value on both sides.

### One id, several elements

```javascript
function PasswordField() {
  const id = useId();
  return (
    <div>
      <label htmlFor={`${id}-input`}>Password</label>
      <input
        id={`${id}-input`}
        type="password"
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`}>At least 8 characters</p>
    </div>
  );
}
```

Call `useId` once and add suffixes. Do not call it several times for related elements.

> **Not for list keys.** `useId` is for accessibility attributes. List keys must come from your data, as covered in the lists topic.

## useSyncExternalStore

Subscribes a component to a store that lives outside React.

Most of the time you will not call this directly. State libraries use it internally. But it is the correct way to read any external changing value, and it is worth knowing why.

```javascript
import { useSyncExternalStore } from 'react';
function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}
function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}
function StatusBar() {
  const isOnline = useOnlineStatus();
  return <p>{isOnline ? 'Online' : 'Offline'}</p>;
}
```

Three arguments:

1. **subscribe**: takes a callback, calls it when the store changes, returns cleanup.
2. **getSnapshot**: reads the current value.
3. **getServerSnapshot**: the value to use during server rendering.

### Why not useState plus useEffect?

```javascript
function useOnlineStatusNaive() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return isOnline;
}
```

This works most of the time, and has two flaws:

- Between the first render and the effect running, the value can already be wrong.
- With concurrent rendering, different components can read different values in the same render, which is called **tearing**.

`useSyncExternalStore` reads the value during render and guarantees consistency.

### A localStorage example

```javascript
function useLocalStorage(key) {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener('storage', callback);
      return () => window.removeEventListener('storage', callback);
    },
    () => localStorage.getItem(key),
    () => null
  );
}
```

Now another tab changing that key updates this one.

> **getSnapshot must return a cached value.** Returning a new object each call causes an infinite loop, because React compares with `Object.is` and always sees a change.

```javascript
() => ({ online: navigator.onLine })
() => navigator.onLine
```

## useDebugValue

Adds a label to a custom hook in React DevTools.

```javascript
import { useDebugValue } from 'react';
function useOnlineStatus() {
  const isOnline = useSyncExternalStore(subscribe, () => navigator.onLine);
  useDebugValue(isOnline ? 'Online' : 'Offline');
  return isOnline;
}
```

In DevTools the hook shows as `OnlineStatus: "Online"` instead of an unlabelled boolean. It does nothing in production.

For an expensive label, pass a formatter as a second argument so it only runs when someone actually inspects the component:

```javascript
useDebugValue(date, (d) => d.toISOString());
```

This is purely a developer convenience. Use it in shared hooks that others will debug, and skip it elsewhere.

## Quick recap

- `useId` produces unique ids that match between server and client.
- Call it once per component and add suffixes for related elements.
- Never use `useId` for list keys.
- `useSyncExternalStore` subscribes safely to values outside React.
- It avoids tearing, which `useState` plus `useEffect` does not.
- `getSnapshot` must return a stable value, never a fresh object.
- `useDebugValue` labels custom hooks in DevTools and is stripped in production.

<code id="code-content" class="language-javascript">
import { useId, useSyncExternalStore, useDebugValue } from 'react';
// useId gives each INSTANCE a unique, hydration safe id. Hard coding
// id="email" would break as soon as the component renders twice.
function PasswordField() {
  const id = useId();          // call once, then add suffixes
  return (
    &lt;div&gt;
      &lt;label htmlFor={id + '-input'}&gt;Password&lt;/label&gt;
      &lt;input
        id={id + '-input'}
        type="password"
        aria-describedby={id + '-hint'}
      /&gt;
      &lt;p id={id + '-hint'}&gt;At least 8 characters&lt;/p&gt;
    &lt;/div&gt;
  );
}
// useSyncExternalStore subscribes to something outside React, without
// the tearing that useState plus useEffect can suffer from.
function subscribeToNetwork(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () =&gt; {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}
function useOnlineStatus() {
  const isOnline = useSyncExternalStore(
    subscribeToNetwork,        // 1. subscribe, returns cleanup
    () =&gt; navigator.onLine,    // 2. read the current value
    () =&gt; true                 // 3. what to use on the server
  );
  // useDebugValue labels this hook in React DevTools, and is stripped
  // out of production builds entirely
  useDebugValue(isOnline ? 'Online' : 'Offline');
  return isOnline;
}
// Another tab changing localStorage will now update this one
function useStoredValue(key) {
  return useSyncExternalStore(
    (callback) =&gt; {
      window.addEventListener('storage', callback);
      return () =&gt; window.removeEventListener('storage', callback);
    },
    () =&gt; localStorage.getItem(key),   // a primitive, so it compares by value
    () =&gt; null
  );
}
export default function StatusBar() {
  const isOnline = useOnlineStatus();
  const theme = useStoredValue('theme');
  return (
    &lt;div&gt;
      &lt;p&gt;{isOnline ? 'Online' : 'Offline'}&lt;/p&gt;
      &lt;p&gt;Saved theme: {theme ?? 'none'}&lt;/p&gt;
      &lt;PasswordField /&gt;
    &lt;/div&gt;
  );
}
// TRAP: getSnapshot must return a cached value. Returning a new object
// each time means Object.is always sees a change, which loops forever.
//   () =&gt; ({ online: navigator.onLine })   infinite loop
//   () =&gt; navigator.onLine                 correct
</code></pre>
