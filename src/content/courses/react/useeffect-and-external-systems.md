---
publishDate: 2026-05-07T09:18
title: 'useEffect: Synchronising with External Systems'
slug: useeffect-and-external-systems
metadescription: Learn what useEffect is actually for, how it differs from lifecycle methods, and the mental model that keeps it simple.
updateDate: 2026-09-05T09:18
author: ['bishal-biswas']
level: 2
tags: ['hooks', 'effects']
course: react
---

## What an effect is for

`useEffect` connects your component to something **outside** React.

That is the whole purpose. Not "run code after render", not "the new componentDidMount". It synchronises React state with an external system.

External systems include:

- The browser: `document.title`, `localStorage`, event listeners.
- The network: fetching data, opening a WebSocket.
- Timers: `setInterval`, `setTimeout`.
- Non React libraries: a map, a chart, a video player.

If none of those are involved, you very likely do not need an effect. That gets its own topic shortly, because it is the most common misuse.

## The basic shape

```javascript
import { useEffect, useState } from 'react';
function PageTitle({ count }) {
  useEffect(() => {
    document.title = `You have ${count} messages`;
  }, [count]);
  return <p>{count} messages</p>;
}
```

Two arguments:

1. A **function** with the work to do.
2. A **dependency array** saying when to re-run it.

React runs the effect **after** the render has been committed to the screen, so it never blocks the user seeing the update.

## The dependency array

```javascript
useEffect(() => {
  console.log('after every render');
});
useEffect(() => {
  console.log('once, after the first render');
}, []);
useEffect(() => {
  console.log('when count changes');
}, [count]);
```

- **No array**: runs after every single render. Almost never what you want.
- **Empty array**: runs once when the component mounts.
- **With values**: runs when any of them changes.

React compares each dependency to its previous value with `Object.is`.

## Cleanup

Return a function and React calls it before the next run, and when the component unmounts.

```javascript
function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <p>{time.toLocaleTimeString()}</p>;
}
```

Without `clearInterval`, the timer keeps firing after the component is gone, trying to set state on something that no longer exists. That is a memory leak.

**Anything you start, you must stop.** Subscriptions, listeners, timers, connections.

```javascript
useEffect(() => {
  function handleResize() {
    console.log(window.innerWidth);
  }
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

## Forget lifecycle methods

If you learned class components, you may be translating:

```javascript
useEffect(() => {}, []);
useEffect(() => {});
useEffect(() => () => {}, []);
```

This mapping works but leads you astray. Effects are not about moments in a component's life. They are about **keeping something in sync**.

Ask "what external thing needs to match this state?" rather than "when should this run?". The dependency array then falls out naturally: it is simply everything the synchronisation depends on.

```javascript
function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]);
  return <p>Welcome to {roomId}</p>;
}
```

Read that as: the connection should always match `roomId`. When `roomId` changes, disconnect from the old room and connect to the new one. React does exactly that, in that order.

## Effects run twice in development

```javascript
useEffect(() => {
  console.log('Connected');
  return () => console.log('Disconnected');
}, []);
```

In development with StrictMode you see `Connected`, `Disconnected`, `Connected`.

This is deliberate. React mounts, unmounts and remounts your component to check that your cleanup actually works. An effect that cannot survive being run twice has a bug, and this surfaces it immediately rather than in production.

**Do not remove StrictMode to silence it.** Fix the cleanup instead.

## Effects and state updates

```javascript
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

That is an infinite loop: the effect sets state, which changes `count`, which re-runs the effect.

If an effect sets state that is in its own dependency array, stop and reconsider. The value probably should not be state at all.

## Order of operations

```javascript
function Example({ value }) {
  console.log('1. render');
  useEffect(() => {
    console.log('3. effect');
    return () => console.log('2. cleanup from last time');
  }, [value]);
  return <p>{value}</p>;
}
```

On an update the order is: render, then cleanup of the previous effect, then the new effect. Cleanup always happens before the next run, never after.

## When you need it before paint

```javascript
import { useLayoutEffect } from 'react';
useLayoutEffect(() => {
  const height = ref.current.getBoundingClientRect().height;
  setHeight(height);
}, []);
```

`useLayoutEffect` runs synchronously **before** the browser paints. Use it only when you measure the DOM and immediately change it, to avoid a visible flicker. It blocks painting, so `useEffect` should stay your default.

## Quick recap

- `useEffect` synchronises React with systems outside React.
- It runs after the render is on screen.
- The dependency array decides when it re-runs.
- Return a cleanup function for anything you started.
- Think "keep this in sync", not "run at this moment".
- Effects run twice in development to prove your cleanup works.
- An effect that sets its own dependency is an infinite loop.
- `useLayoutEffect` runs before paint, for measurement only.

<code id="code-content" class="language-javascript">
import { useState, useEffect } from 'react';
// Effects connect a component to something OUTSIDE React.
// Read this one as: the connection should always match roomId.
function ChatRoom({ roomId }) {
  const [messages, setMessages] = useState([]);
  useEffect(() =&gt; {
    const connection = createConnection(roomId);
    connection.on('message', (m) =&gt; setMessages((prev) =&gt; [...prev, m]));
    connection.connect();
    // Cleanup runs before the next effect AND on unmount.
    // Anything you start, you must stop.
    return () =&gt; connection.disconnect();
  }, [roomId]);          // roomId changes -&gt; disconnect old, connect new
  return &lt;p&gt;{messages.length} messages in {roomId}&lt;/p&gt;;
}
// A timer, with the cleanup that stops it leaking
function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() =&gt; {
    const id = setInterval(() =&gt; setTime(new Date()), 1000);
    return () =&gt; clearInterval(id);      // without this it runs forever
  }, []);                                // [] means: set up once on mount
  return &lt;p&gt;{time.toLocaleTimeString()}&lt;/p&gt;;
}
// A browser API, kept in sync with state
function PageTitle({ unread }) {
  useEffect(() =&gt; {
    document.title = unread &gt; 0 ? '(' + unread + ') Inbox' : 'Inbox';
  }, [unread]);
  return &lt;p&gt;{unread} unread&lt;/p&gt;;
}
// An event listener, added and removed as a pair
function WindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() =&gt; {
    function handleResize() { setWidth(window.innerWidth); }
    window.addEventListener('resize', handleResize);
    return () =&gt; window.removeEventListener('resize', handleResize);
  }, []);
  return &lt;p&gt;Width: {width}px&lt;/p&gt;;
}
// The dependency array in one line each:
//   useEffect(fn)            after EVERY render, almost never right
//   useEffect(fn, [])        once, on mount
//   useEffect(fn, [a, b])    whenever a or b changes
// INFINITE LOOP: the effect sets the state it depends on
// useEffect(() =&gt; { setCount(count + 1); }, [count]);
// In development, StrictMode runs effects twice on purpose, to prove
// your cleanup works. Fix the cleanup, never remove StrictMode.
export default ChatRoom;
</code></pre>
