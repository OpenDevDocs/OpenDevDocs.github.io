---
publishDate: 2026-05-09T09:24
title: useContext and the Context API
slug: usecontext-hook-and-context-api
metadescription: Share values across a component tree without passing props through every level, and avoid the performance trap.
updateDate: 2026-09-05T09:24
author: ['bishal-biswas']
level: 2
tags: ['hooks', 'context', 'state']
course: react
---

## The problem: prop drilling

```javascript
function App() {
  const [theme, setTheme] = useState('dark');
  return <Layout theme={theme} />;
}
function Layout({ theme }) {
  return <Sidebar theme={theme} />;
}
function Sidebar({ theme }) {
  return <UserMenu theme={theme} />;
}
function UserMenu({ theme }) {
  return <button className={theme}>Menu</button>;
}
```

`Layout` and `Sidebar` do not use `theme`. They only pass it along. That is **prop drilling**, and it makes every intermediate component depend on data it does not care about.

## Context

Context lets a component provide a value to everything below it, no matter how deep.

```javascript
import { createContext, useContext, useState } from 'react';
const ThemeContext = createContext('light');
function App() {
  const [theme, setTheme] = useState('dark');
  return (
    <ThemeContext value={theme}>
      <Layout />
    </ThemeContext>
  );
}
function UserMenu() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Menu</button>;
}
```

Three steps: create the context, wrap a subtree in it, read it with `useContext`.

`Layout` and `Sidebar` no longer mention `theme` at all.

Note the React 19 syntax: `<ThemeContext value={...}>` rather than `<ThemeContext.Provider value={...}>`. The old form still works, and there is more on that in the next topic.

## The default value

```javascript
const ThemeContext = createContext('light');
```

That default is used **only** when a component reads the context with no provider above it. It is not a fallback for `undefined` values you pass in.

Many people set the default to `null` and throw a helpful error instead, which catches the "forgot the provider" mistake early.

## A custom hook wrapper

This is the pattern worth adopting straight away.

```javascript
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  function toggle() {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }
  return (
    <ThemeContext value={{ theme, toggle }}>
      {children}
    </ThemeContext>
  );
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return context;
}
```

```javascript
function Header() {
  const { theme, toggle } = useTheme();
  return <button onClick={toggle}>Current: {theme}</button>;
}
```

Three benefits: the context object stays private, consumers get a clear error when the provider is missing, and you can change the implementation without touching every consumer.

## The performance trap

**Every component reading a context re-renders whenever that context's value changes.** That is the whole point, and it is also the danger.

```javascript
function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [cart, setCart] = useState([]);
  return (
    <AppContext value={{ user, setUser, theme, setTheme, cart, setCart }}>
      {children}
    </AppContext>
  );
}
```

Add one item to the cart and **every** consumer re-renders, including components that only care about the theme.

### Fix 1: split the contexts

```javascript
function AppProviders({ children }) {
  return (
    <UserProvider>
      <ThemeProvider>
        <CartProvider>{children}</CartProvider>
      </ThemeProvider>
    </UserProvider>
  );
}
```

Now a cart change only re-renders cart consumers. This is usually the right answer.

### Fix 2: separate state from dispatch

```javascript
const StateContext = createContext(null);
const DispatchContext = createContext(null);
function TodoProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <DispatchContext value={dispatch}>
      <StateContext value={state}>{children}</StateContext>
    </DispatchContext>
  );
}
```

`dispatch` never changes, so components that only dispatch never re-render when the state does. This pairs beautifully with `useReducer`.

### Fix 3: watch the object identity

```javascript
<ThemeContext value={{ theme, toggle }}>
```

That object literal is **new on every render** of the provider, so every consumer re-renders even when `theme` is unchanged.

```javascript
const value = useMemo(() => ({ theme, toggle }), [theme]);
return <ThemeContext value={value}>{children}</ThemeContext>;
```

With the React Compiler enabled this is handled automatically, but without it the `useMemo` matters.

## What context is not

**Context is not a state manager.** It is a delivery mechanism. The state still lives in `useState` or `useReducer`, and context simply carries it down the tree.

**Context is not for everything.** If a value is used by two components that are close together, lifting state up is simpler. Reach for context when the distance is genuinely large or the value is genuinely global.

**Context is not for server data.** Fetched data has caching, refetching and staleness concerns that context does nothing to help with. Use a data library instead.

## Good uses

- The current theme.
- The signed in user and auth actions.
- The chosen language for translations.
- A toast or modal controller.
- Configuration that never changes.

Notice these are all app wide, rarely changing, and read from many places.

## Quick recap

- Context avoids passing props through components that do not use them.
- Create it, wrap a subtree, read it with `useContext`.
- React 19 lets you render the context itself as the provider.
- Wrap it in a custom hook that throws when the provider is missing.
- Every consumer re-renders when the value changes.
- Split contexts by concern, and separate state from dispatch.
- Memoise the value object, unless the compiler does it for you.
- Context delivers state, it does not manage it.

<code id="code-content" class="language-javascript">
import { createContext, useContext, useState, useMemo } from 'react';
// Keep the context object private, and export a hook instead
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  function toggle() {
    setTheme((current) =&gt; (current === 'light' ? 'dark' : 'light'));
  }
  // WITHOUT this useMemo, the object literal is new on every render of
  // the provider, so every consumer re-renders even when theme is the
  // same. The React Compiler handles this for you when it is enabled.
  const value = useMemo(() =&gt; ({ theme, toggle }), [theme]);
  // React 19: render the context itself, no .Provider needed
  return &lt;ThemeContext value={value}&gt;{children}&lt;/ThemeContext&gt;;
}
// A hook wrapper gives consumers a clear error when the provider is
// missing, instead of a confusing "cannot read property of null"
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return context;
}
// Consumers no longer receive theme as a prop, and the components in
// between never mention it at all
function UserMenu() {
  const { theme, toggle } = useTheme();
  return &lt;button onClick={toggle}&gt;Theme: {theme}&lt;/button&gt;;
}
function Sidebar() { return &lt;UserMenu /&gt;; }
function Layout() { return &lt;Sidebar /&gt;; }
// SPLIT CONTEXTS BY CONCERN. One giant context means a cart change
// re-renders every component that only cares about the theme.
export default function App() {
  return (
    &lt;ThemeProvider&gt;
      &lt;Layout /&gt;
    &lt;/ThemeProvider&gt;
  );
}
// With useReducer, put state and dispatch in SEPARATE contexts.
// dispatch never changes, so components that only dispatch never
// re-render when the state does.
// const StateContext = createContext(null);
// const DispatchContext = createContext(null);
// function TodoProvider({ children }) {
//   const [state, dispatch] = useReducer(reducer, initialState);
//   return (
//     &lt;DispatchContext value={dispatch}&gt;
//       &lt;StateContext value={state}&gt;{children}&lt;/StateContext&gt;
//     &lt;/DispatchContext&gt;
//   );
// }
</code></pre>
