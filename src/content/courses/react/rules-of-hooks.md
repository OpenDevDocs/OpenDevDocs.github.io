---
publishDate: 2026-05-06T09:17
title: The Rules of Hooks
slug: rules-of-hooks
metadescription: Learn the two rules every hook must follow, and why React breaks in confusing ways when you bend them.
updateDate: 2026-09-05T09:17
author: ['bishal-biswas']
level: 2
tags: ['hooks', 'rules']
course: react
---

## What a hook is

A hook is a function starting with `use` that lets a component tap into React features.

```javascript
import { useState, useEffect, useRef, useContext } from 'react';
```

You have already used `useState`. There are around fifteen built in hooks, and you can write your own.

## Rule 1: only at the top level

Never call a hook inside a condition, a loop, a nested function, or after an early return.

```javascript
function Broken({ isLoggedIn }) {
  if (isLoggedIn) {
    const [name, setName] = useState('');
  }
  return <p>Hi</p>;
}
function Fixed({ isLoggedIn }) {
  const [name, setName] = useState('');
  if (!isLoggedIn) return <p>Please log in</p>;
  return <p>Hi {name}</p>;
}
```

All the broken variants:

```javascript
if (condition) {
  useState(0);
}
for (const item of items) {
  useState(item);
}
function inner() {
  useState(0);
}
if (!user) return null;
const [count, setCount] = useState(0);
```

That last one is the sneakiest. An early return before a hook breaks the rule just as much as an `if` around it.

## Why the rule exists

React does not know your hooks by name. It tracks them **by call order**.

Internally each component has a list, and React walks it in order:

```javascript
function Profile() {
  const [name, setName] = useState('');
  const [age, setAge] = useState(0);
  const [city, setCity] = useState('');
}
```

React records: slot 0 is `name`, slot 1 is `age`, slot 2 is `city`. On the next render it reads the same slots in the same order.

Now make one conditional:

```javascript
function Broken({ showAge }) {
  const [name, setName] = useState('');
  if (showAge) {
    const [age, setAge] = useState(0);
  }
  const [city, setCity] = useState('');
}
```

When `showAge` is true, `city` is slot 2. When it flips to false, `city` becomes slot 1, which is where `age` used to be. React hands `city` the age value.

The symptom is bizarre: state values swapping between variables. That is why the rule is absolute rather than a style preference.

## Rule 2: only from React functions

Call hooks from a component, or from another hook. Nowhere else.

```javascript
function handleClick() {
  const [count, setCount] = useState(0);
}
function myHelper() {
  useEffect(() => {});
}
```

Both are invalid. React has no idea which component they belong to.

```javascript
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  return width;
}
```

This is valid, because a function starting with `use` is treated as a custom hook, and React knows its hooks belong to whichever component calls it.

## The naming rule is real

Starting a name with `use` is not just convention. It is how the linter and React itself decide something is a hook.

```javascript
function getWindowWidth() {
  const [width] = useState(0);
  return width;
}
function useWindowWidth() {
  const [width] = useState(0);
  return width;
}
```

The first will be flagged, because a plain function is not allowed to call hooks. Rename it and the problem disappears.

Equally, do not start a normal function with `use` if it contains no hooks. That misleads both the linter and the next reader.

## Handling conditional logic properly

You cannot make the hook conditional, so make the **value** conditional.

```javascript
function Broken({ userId }) {
  if (!userId) return null;
  const [user, setUser] = useState(null);
}
function Fixed({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    if (!userId) return;
    fetchUser(userId).then(setUser);
  }, [userId]);
  if (!userId) return null;
  return <p>{user?.name}</p>;
}
```

The hook always runs. The condition lives **inside** it.

Same idea for effects that should only sometimes do work:

```javascript
useEffect(() => {
  if (!isEnabled) return;
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, [isEnabled]);
```

## Rendering a different number of hooks per branch

If two branches genuinely need different hooks, that is a sign you have two components.

```javascript
function Broken({ mode }) {
  if (mode === 'edit') {
    const [draft, setDraft] = useState('');
  }
  return null;
}
function EditMode() {
  const [draft, setDraft] = useState('');
  return <input value={draft} onChange={(e) => setDraft(e.target.value)} />;
}
function ViewMode({ text }) {
  return <p>{text}</p>;
}
function Switcher({ mode, text }) {
  return mode === 'edit' ? <EditMode /> : <ViewMode text={text} />;
}
```

Each component has its own fixed hook list. This is almost always the right refactor.

## Let the linter enforce it

```bash
npm install --save-dev eslint-plugin-react-hooks
```

The `eslint-plugin-react-hooks` plugin catches every violation of both rules, plus missing effect dependencies. Vite's React template includes it.

**Do not disable its warnings.** The dependency warning in particular is almost always pointing at a real bug, and silencing it with a comment is how stale closures get into production.

## Quick recap

- Hooks must be called at the top level, never in conditions, loops or nested functions.
- An early return before a hook breaks the rule too.
- React matches hooks by call order, which is why the order must never change.
- Call hooks only from components or other hooks.
- A name starting with `use` is what marks something as a hook.
- Put the condition inside the hook, not around it.
- If two branches need different hooks, split them into two components.
- Keep the ESLint plugin on and listen to it.

<code id="code-content" class="language-javascript">
import { useState, useEffect } from 'react';
// RULE 1: hooks run at the top level, always, in the same order.
// React tracks them by position, not by name. Make one conditional and
// the slots shift, so a later hook receives the wrong value.
function Broken({ showAge, userId }) {
  const [name, setName] = useState('');
  if (showAge) {
    const [age, setAge] = useState(0);     // INVALID: changes the count
  }
  if (!userId) return null;                // INVALID: an early return
  const [city, setCity] = useState('');    // before a hook breaks it too
  return null;
}
// FIXED: every hook runs every time. The condition goes INSIDE.
function Profile({ userId, isEnabled }) {
  const [name, setName] = useState('');
  const [user, setUser] = useState(null);
  useEffect(() =&gt; {
    if (!userId) return;                   // condition inside the hook
    fetchUser(userId).then(setUser);
  }, [userId]);
  useEffect(() =&gt; {
    if (!isEnabled) return;
    const id = setInterval(() =&gt; console.log('tick'), 1000);
    return () =&gt; clearInterval(id);
  }, [isEnabled]);
  // Early returns are fine AFTER every hook has run
  if (!userId) return &lt;p&gt;No user selected&lt;/p&gt;;
  return &lt;p&gt;{user?.name ?? 'Loading...'}&lt;/p&gt;;
}
// RULE 2: only components and other hooks may call hooks.
// A name starting with `use` is what marks something as a hook.
function getWidth() {
  // const [w] = useState(0);   INVALID: a plain function cannot call hooks
  return window.innerWidth;
}
function useWindowWidth() {                // valid: it is a custom hook
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() =&gt; {
    const onResize = () =&gt; setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () =&gt; window.removeEventListener('resize', onResize);
  }, []);
  return width;
}
// If two branches genuinely need different hooks, they are two components
function EditMode() {
  const [draft, setDraft] = useState('');
  return &lt;input value={draft} onChange={(e) =&gt; setDraft(e.target.value)} /&gt;;
}
function ViewMode({ text }) {
  return &lt;p&gt;{text}&lt;/p&gt;;
}
export default function Switcher({ mode, text }) {
  return mode === 'edit' ? &lt;EditMode /&gt; : &lt;ViewMode text={text} /&gt;;
}
</code></pre>
