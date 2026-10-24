---
publishDate: 2026-05-10T09:28
title: Custom Hooks
slug: custom-hooks
metadescription: Extract stateful logic into reusable functions, and learn what makes a good custom hook rather than a pointless wrapper.
updateDate: 2026-09-05T09:28
author: ['bishal-biswas']
level: 2
tags: ['hooks', 'patterns']
course: react
---

## What a custom hook is

A function whose name starts with `use` and which calls other hooks. That is the entire definition.

```javascript
import { useState } from 'react';
function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const increment = () => setCount((c) => c + 1);
  const decrement = () => setCount((c) => c - 1);
  const reset = () => setCount(initial);
  return { count, increment, decrement, reset };
}
function Counter() {
  const { count, increment, reset } = useCounter(10);
  return (
    <div>
      <p>{count}</p>
      <button onClick={increment}>+</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

You are not learning a new API. You are just moving hook calls into a function.

## Why the `use` prefix matters

It is not decoration. The linter uses it to decide whether the rules of hooks apply, and React uses it to know the hooks inside belong to the calling component.

```javascript
function getCounter() {
  const [count, setCount] = useState(0);
  return count;
}
```

That is flagged as an error. Rename it to `useCounter` and it is fine.

## Every call gets its own state

This is the point people miss.

```javascript
function Dashboard() {
  const first = useCounter(0);
  const second = useCounter(100);
  return (
    <div>
      <p>{first.count}</p>
      <p>{second.count}</p>
    </div>
  );
}
```

Two completely independent counters. A custom hook shares **logic**, never **state**. If you want shared state, that is Context.

## Genuinely useful hooks

### Local storage

```javascript
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be full or blocked in private browsing
    }
  }, [key, value]);
  return [value, setValue];
}
function Settings() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  return <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme}</button>;
}
```

Note the lazy initialiser, so reading storage happens once rather than on every render, and the try/catch, because storage throws in private browsing.

### A toggle

```javascript
function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue((v) => !v), []);
  return [value, toggle, setValue];
}
function Modal() {
  const [isOpen, toggle] = useToggle();
  return (
    <div>
      <button onClick={toggle}>{isOpen ? 'Close' : 'Open'}</button>
      {isOpen && <div className="modal">Content</div>}
    </div>
  );
}
```

Tiny, but it removes a line of boilerplate from every component with a modal, dropdown or accordion.

### Debounced value

```javascript
function useDebounced(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
function Search() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 300);
  useEffect(() => {
    if (debouncedQuery) search(debouncedQuery);
  }, [debouncedQuery]);
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

The input stays instant while the search waits for a pause. The cleanup cancelling the previous timeout is what makes it work.

### A media query

```javascript
function useMediaQuery(query) {
  return useSyncExternalStore(
    (callback) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', callback);
      return () => list.removeEventListener('change', callback);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
function Layout() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  return isMobile ? <MobileNav /> : <DesktopNav />;
}
```

## What to return

**One value** when there is only one:

```javascript
const width = useWindowWidth();
```

**A tuple** when the caller will want to rename things, mirroring `useState`:

```javascript
const [isOpen, toggle] = useToggle();
const [value, setValue] = useLocalStorage('key', '');
```

**An object** once there are more than two, so the caller can destructure only what they need:

```javascript
const { data, isLoading, error, refetch } = useFetch(url);
```

An object also lets you add a return value later without breaking every existing call.

## What makes a hook worth extracting

**Good reasons:**

- The same stateful logic appears in three places.
- A component is doing two unrelated jobs and one can be lifted out.
- The logic is fiddly and deserves its own tests.
- You are wrapping an external system and want one clean interface.

**Bad reasons:**

```javascript
function useName() {
  const [name, setName] = useState('');
  return [name, setName];
}
```

That is `useState` with extra steps. A hook that only renames something adds a file and a layer for nothing.

Do not extract on the first occurrence. Wait until you have seen the pattern two or three times, so you know which parts genuinely vary.

## Hooks composing hooks

```javascript
function useAuth() {
  const [token, setToken] = useLocalStorage('token', null);
  const [user, setUser] = useState(null);
  const isLoggedIn = Boolean(token);
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    let ignore = false;
    fetchProfile(token).then((profile) => {
      if (!ignore) setUser(profile);
    });
    return () => {
      ignore = true;
    };
  }, [token]);
  return { user, isLoggedIn, login: setToken, logout: () => setToken(null) };
}
```

`useAuth` builds on `useLocalStorage`. Hooks compose exactly like functions, and this is where they really pay off.

## Quick recap

- A custom hook is a `use` prefixed function that calls other hooks.
- The prefix is what makes the rules of hooks apply.
- Each call gets its own state, so hooks share logic, not state.
- Return a value, a tuple, or an object depending on how many things there are.
- Extract after you have seen the pattern repeat, not before.
- A hook that only renames `useState` is not worth having.
- Hooks compose, which is where the real leverage is.

<code id="code-content" class="language-javascript">
import { useState, useEffect, useCallback } from 'react';
// A custom hook is just a function starting with `use` that calls hooks.
// The prefix is what makes the rules of hooks apply to it.
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() =&gt; {
    // Lazy initialiser: reads storage once, not on every render
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;      // private browsing can throw
    }
  });
  useEffect(() =&gt; {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or blocked, fail quietly
    }
  }, [key, value]);
  return [value, setValue];     // a tuple, so the caller can rename
}
function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() =&gt; setValue((v) =&gt; !v), []);
  return [value, toggle, setValue];
}
// The cleanup cancelling the previous timeout is what makes this work
function useDebounced(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() =&gt; {
    const id = setTimeout(() =&gt; setDebounced(value), delay);
    return () =&gt; clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
// Hooks compose. useAuth builds on useLocalStorage.
function useAuth() {
  const [token, setToken] = useLocalStorage('token', null);
  const [user, setUser] = useState(null);
  useEffect(() =&gt; {
    if (!token) { setUser(null); return; }
    let ignore = false;
    fetchProfile(token).then((p) =&gt; { if (!ignore) setUser(p); });
    return () =&gt; { ignore = true; };
  }, [token]);
  // An object once there are more than two values, so callers destructure
  // only what they need and you can add more later without breaking them
  return {
    user,
    isLoggedIn: Boolean(token),
    login: setToken,
    logout: () =&gt; setToken(null)
  };
}
export default function SearchPage() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 300);
  const [isOpen, toggleFilters] = useToggle();
  const { user, isLoggedIn, logout } = useAuth();
  // Every CALL gets its own state. These two are independent.
  const [drafts, setDrafts] = useLocalStorage('drafts', []);
  const [recent, setRecent] = useLocalStorage('recent', []);
  useEffect(() =&gt; {
    if (debouncedQuery) console.log('searching for', debouncedQuery);
  }, [debouncedQuery]);
  return (
    &lt;div&gt;
      &lt;input value={query} onChange={(e) =&gt; setQuery(e.target.value)} /&gt;
      &lt;button onClick={toggleFilters}&gt;{isOpen ? 'Hide' : 'Show'} filters&lt;/button&gt;
      {isLoggedIn &amp;&amp; &lt;button onClick={logout}&gt;Log out {user?.name}&lt;/button&gt;}
    &lt;/div&gt;
  );
}
</code></pre>
