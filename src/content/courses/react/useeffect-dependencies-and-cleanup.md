---
publishDate: 2026-05-07T09:19
title: useEffect Dependencies and Cleanup
slug: useeffect-dependencies-and-cleanup
metadescription: Get the dependency array right, avoid stale closures and infinite loops, and write cleanup that actually cleans up.
updateDate: 2026-09-05T09:19
author: ['bishal-biswas']
level: 2
tags: ['hooks', 'effects']
course: react
---

## The rule for dependencies

Every reactive value your effect reads must be listed.

A **reactive value** is anything that could differ between renders: props, state, and any variable calculated from them.

```javascript
function Search({ query, onResult }) {
  const [page, setPage] = useState(1);
  useEffect(() => {
    fetchResults(query, page).then(onResult);
  }, [query, page, onResult]);
}
```

The effect reads `query`, `page` and `onResult`, so all three are listed.

What you do **not** list:

```javascript
useEffect(() => {
  const id = setInterval(tick, 1000);
  document.title = 'Fixed';
  setCount(0);
  return () => clearInterval(id);
}, []);
```

State setters are guaranteed stable by React, and things like `document` are not reactive. Refs are stable too.

## Stale closures

Lying about dependencies causes the most confusing bug in React.

```javascript
function Counter() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      console.log(count);
      setCount(count + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <p>{count}</p>;
}
```

This logs `0` forever and the count never moves past `1`.

The effect ran once, on the first render, when `count` was `0`. The interval callback captured that `0` and it never changes, because the effect never runs again.

Three ways out.

**Use the updater function** so you do not need the value at all:

```javascript
useEffect(() => {
  const id = setInterval(() => {
    setCount((previous) => previous + 1);
  }, 1000);
  return () => clearInterval(id);
}, []);
```

**Add the dependency** and let it re-run:

```javascript
useEffect(() => {
  const id = setTimeout(() => setCount(count + 1), 1000);
  return () => clearTimeout(id);
}, [count]);
```

**Use `useEffectEvent`** for logic that should not be reactive, which has its own topic.

## Infinite loops

### Objects and arrays as dependencies

```javascript
function Broken({ userId }) {
  const [data, setData] = useState(null);
  const options = { userId, include: 'profile' };
  useEffect(() => {
    fetchData(options).then(setData);
  }, [options]);
}
```

`options` is a **new object on every render**. React compares with `Object.is`, sees a different reference, and re-runs the effect. That sets state, which re-renders, which builds a new object, forever.

Depend on primitives instead:

```javascript
useEffect(() => {
  fetchData({ userId, include: 'profile' }).then(setData);
}, [userId]);
```

Move the object **inside** the effect. Now the only dependency is a string, which compares by value.

The same applies to functions:

```javascript
function Parent() {
  const handleUpdate = () => console.log('updated');
  return <Child onUpdate={handleUpdate} />;
}
function Child({ onUpdate }) {
  useEffect(() => {
    onUpdate();
  }, [onUpdate]);
}
```

`handleUpdate` is recreated every render, so the child's effect runs every render. Fixes are to move the function inside the effect, wrap it in `useCallback`, or let the React Compiler handle it.

### Setting state you depend on

```javascript
useEffect(() => {
  setItems([...items, newItem]);
}, [items]);
```

Guaranteed infinite loop. If you find this shape, the value should probably be derived during render rather than stored.

## Cleanup that actually works

### Race conditions in fetching

```javascript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
}
```

Switch quickly from user 1 to user 2. If request 1 is slower, it resolves **last** and overwrites user 2's data. The screen shows the wrong person.

Use a flag:

```javascript
useEffect(() => {
  let ignore = false;
  fetchUser(userId).then((data) => {
    if (!ignore) setUser(data);
  });
  return () => {
    ignore = true;
  };
}, [userId]);
```

When `userId` changes, cleanup sets the old effect's `ignore` to `true`, so its late response is discarded.

Or cancel the request outright:

```javascript
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setUser)
    .catch((error) => {
      if (error.name !== 'AbortError') setError(error);
    });
  return () => controller.abort();
}, [userId]);
```

Note the `AbortError` check. Cancelling rejects the promise, and you do not want to show that as a real error.

**Every data fetching effect needs one of these.** Race conditions are silent, intermittent and very hard to reproduce.

### Cleaning up subscriptions

```javascript
useEffect(() => {
  const subscription = store.subscribe(handleChange);
  return () => subscription.unsubscribe();
}, [store]);
```

### Cleaning up third party libraries

```javascript
useEffect(() => {
  const chart = new Chart(ref.current, config);
  return () => chart.destroy();
}, []);
```

## What the linter tells you

```javascript
useEffect(() => {
  doSomething(value);
}, []);
```

The ESLint plugin warns: *React Hook useEffect has a missing dependency: 'value'*.

**Listen to it.** Almost every time, one of these is true:

- The dependency genuinely belongs there.
- The value should not be reactive, so use `useEffectEvent`.
- You should not be using an effect at all.

```javascript
useEffect(() => {
  doSomething(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Suppressing it hides a stale closure that will surface later as "sometimes it uses the old value", which is a miserable bug to track down.

## Splitting effects

```javascript
useEffect(() => {
  document.title = title;
  const connection = createConnection(roomId);
  connection.connect();
  return () => connection.disconnect();
}, [title, roomId]);
```

Two unrelated jobs in one effect means changing the title reconnects the chat. Split them:

```javascript
useEffect(() => {
  document.title = title;
}, [title]);
useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();
  return () => connection.disconnect();
}, [roomId]);
```

**One effect, one job.** Each then has exactly the dependencies it needs.

## Quick recap

- List every reactive value the effect reads.
- Setters, refs and non reactive globals do not go in the array.
- An omitted dependency creates a stale closure that quietly uses old values.
- Objects and functions are new every render, so they cause infinite loops.
- Depend on primitives and move objects inside the effect.
- Guard fetches with an `ignore` flag or `AbortController`.
- Never suppress the exhaustive dependencies warning.
- One effect per job.

<code id="code-content" class="language-javascript">
import { useState, useEffect } from 'react';
// STALE CLOSURE: the effect ran once with count = 0 and captured it.
// This logs 0 forever and never gets past 1.
function Broken() {
  const [count, setCount] = useState(0);
  useEffect(() =&gt; {
    const id = setInterval(() =&gt; setCount(count + 1), 1000);
    return () =&gt; clearInterval(id);
  }, []);                              // lying about the dependency
  return &lt;p&gt;{count}&lt;/p&gt;;
}
// FIX: the updater form does not need the value at all
function Working() {
  const [count, setCount] = useState(0);
  useEffect(() =&gt; {
    const id = setInterval(() =&gt; setCount((prev) =&gt; prev + 1), 1000);
    return () =&gt; clearInterval(id);
  }, []);                              // honestly empty now
  return &lt;p&gt;{count}&lt;/p&gt;;
}
// INFINITE LOOP: options is a new object every render, so Object.is
// always sees a change, so the effect runs, sets state, and repeats
function BrokenFetch({ userId }) {
  const [data, setData] = useState(null);
  const options = { userId, include: 'profile' };
  useEffect(() =&gt; { fetchData(options).then(setData); }, [options]);
  return null;
}
// FIX: depend on primitives, build the object inside the effect
function WorkingFetch({ userId }) {
  const [data, setData] = useState(null);
  useEffect(() =&gt; {
    fetchData({ userId, include: 'profile' }).then(setData);
  }, [userId]);                        // a string, compared by value
  return null;
}
// RACE CONDITION: switch from user 1 to user 2, and if request 1 is
// slower it resolves last and overwrites user 2 on screen.
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() =&gt; {
    let ignore = false;
    fetchUser(userId).then((data) =&gt; {
      if (!ignore) setUser(data);      // discard a stale response
    });
    return () =&gt; { ignore = true; };
  }, [userId]);
  return &lt;p&gt;{user?.name}&lt;/p&gt;;
}
// Or cancel it outright, and do not report the cancellation as an error
function UserProfileAbort({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() =&gt; {
    const controller = new AbortController();
    fetch('/api/users/' + userId, { signal: controller.signal })
      .then((r) =&gt; r.json())
      .then(setUser)
      .catch((error) =&gt; { if (error.name !== 'AbortError') console.error(error); });
    return () =&gt; controller.abort();
  }, [userId]);
  return &lt;p&gt;{user?.name}&lt;/p&gt;;
}
// ONE EFFECT, ONE JOB. Combining these would reconnect the chat every
// time the title changed.
function Room({ title, roomId }) {
  useEffect(() =&gt; { document.title = title; }, [title]);
  useEffect(() =&gt; {
    const connection = createConnection(roomId);
    connection.connect();
    return () =&gt; connection.disconnect();
  }, [roomId]);
  return null;
}
</code></pre>
