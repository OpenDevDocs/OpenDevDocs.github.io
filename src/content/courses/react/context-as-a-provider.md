---
publishDate: 2026-05-09T09:25
title: Context as a Provider
slug: context-as-a-provider
metadescription: React 19 lets you render a context directly instead of Context.Provider, plus the Context.use pattern and how to migrate.
updateDate: 2026-09-05T09:25
author: ['bishal-biswas']
level: 2
tags: ['context', 'react-19']
course: react
---

## The small change

Before React 19:

```javascript
const ThemeContext = createContext(null);
function App() {
  return (
    <ThemeContext.Provider value={theme}>
      <Page />
    </ThemeContext.Provider>
  );
}
```

From React 19:

```javascript
function App() {
  return (
    <ThemeContext value={theme}>
      <Page />
    </ThemeContext>
  );
}
```

Render the context itself. `.Provider` is gone.

## Why it changed

`Context.Provider` was always slightly odd. A context has exactly one provider component, so requiring you to reach into a property added noise without adding meaning.

The old syntax still works and is not removed yet, but it is deprecated. New code should use the short form.

## Nesting is much tidier

The improvement shows up most where providers stack.

```javascript
function App() {
  return (
    <AuthContext.Provider value={auth}>
      <ThemeContext.Provider value={theme}>
        <LocaleContext.Provider value={locale}>
          <CartContext.Provider value={cart}>
            <Router />
          </CartContext.Provider>
        </LocaleContext.Provider>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}
```

```javascript
function App() {
  return (
    <AuthContext value={auth}>
      <ThemeContext value={theme}>
        <LocaleContext value={locale}>
          <CartContext value={cart}>
            <Router />
          </CartContext>
        </LocaleContext>
      </ThemeContext>
    </AuthContext>
  );
}
```

Same structure, considerably less noise.

## Consumer is gone too

The old render prop API for reading context in class components:

```javascript
<ThemeContext.Consumer>
  {(theme) => <button className={theme}>Click</button>}
</ThemeContext.Consumer>
```

This is removed in React 19. Use `useContext`, which has been the recommended way since hooks arrived.

## Reading with `use`

React 19 also lets you read a context with the new `use` API.

```javascript
import { use } from 'react';
function Button() {
  const theme = use(ThemeContext);
  return <button className={theme}>Click</button>;
}
```

At first glance this is just another name for `useContext`. The difference is that `use` is **not bound by the rules of hooks**, so it can be called conditionally.

```javascript
function Message({ showTheme }) {
  if (showTheme) {
    const theme = useContext(ThemeContext);
  }
  return null;
}
function MessageWithUse({ showTheme }) {
  if (showTheme) {
    const theme = use(ThemeContext);
    return <p className={theme}>Themed</p>;
  }
  return <p>Plain</p>;
}
```

That is genuinely useful when a component only sometimes needs a context, or needs it inside a loop.

`use` does more than contexts. It also reads promises, and that gets its own topic later.

## Combining providers

Stacking providers still gets deep. A small helper flattens it.

```javascript
function Providers({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LocaleProvider>
          <CartProvider>{children}</CartProvider>
        </LocaleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
function App() {
  return (
    <Providers>
      <Router />
    </Providers>
  );
}
```

Or compose them programmatically:

```javascript
function composeProviders(...providers) {
  return function Composed({ children }) {
    return providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children
    );
  };
}
const Providers = composeProviders(
  AuthProvider,
  ThemeProvider,
  LocaleProvider,
  CartProvider
);
```

Neat, though the explicit version is usually easier to read and debug. Use judgement.

## Migrating

The change is mechanical:

1. Replace `<X.Provider value={v}>` with `<X value={v}>`.
2. Replace every `<X.Consumer>` with `useContext(X)` or `use(X)`.
3. Closing tags become `</X>`.

A codemod exists for the first two:

```bash
npx codemod@latest react/19/replace-context-provider
```

There is no rush. The old syntax keeps working, so migrate as you touch files.

## The rest is unchanged

Everything from the previous topic still applies:

- Every consumer re-renders when the value changes.
- Split contexts by concern.
- Memoise the value object, unless the compiler handles it.
- Wrap access in a custom hook that throws when the provider is missing.

The syntax got shorter. The performance characteristics did not change at all.

## Quick recap

- React 19 renders the context itself as the provider.
- `<X.Provider>` still works but is deprecated.
- `Context.Consumer` is removed, so use `useContext` or `use`.
- `use(Context)` can be called conditionally, unlike `useContext`.
- Group providers in one component to keep `App` readable.
- A codemod handles the mechanical parts of migrating.
- None of the performance advice changes.

<code id="code-content" class="language-javascript">
import { createContext, useContext, use, useState, useMemo } from 'react';
const ThemeContext = createContext(null);
const AuthContext = createContext(null);
// REACT 19: render the context itself. No .Provider.
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const value = useMemo(
    () =&gt; ({ theme, toggle: () =&gt; setTheme((t) =&gt; (t === 'light' ? 'dark' : 'light')) }),
    [theme]
  );
  return &lt;ThemeContext value={value}&gt;{children}&lt;/ThemeContext&gt;;
}
// The old form, deprecated but still working:
// &lt;ThemeContext.Provider value={value}&gt;{children}&lt;/ThemeContext.Provider&gt;
// Reading with useContext, which follows the rules of hooks
function Header() {
  const { theme, toggle } = useContext(ThemeContext);
  return &lt;button onClick={toggle}&gt;Theme: {theme}&lt;/button&gt;;
}
// Reading with use(), which does NOT, so it can go inside a condition
function Message({ showTheme }) {
  if (showTheme) {
    const { theme } = use(ThemeContext);   // legal, unlike useContext
    return &lt;p className={theme}&gt;Themed message&lt;/p&gt;;
  }
  return &lt;p&gt;Plain message&lt;/p&gt;;
}
// Context.Consumer is REMOVED in React 19. This no longer works:
// &lt;ThemeContext.Consumer&gt;{(theme) =&gt; &lt;b&gt;{theme}&lt;/b&gt;}&lt;/ThemeContext.Consumer&gt;
// Nesting is much tidier without .Provider everywhere
function Providers({ children }) {
  return (
    &lt;AuthProvider&gt;
      &lt;ThemeProvider&gt;{children}&lt;/ThemeProvider&gt;
    &lt;/AuthProvider&gt;
  );
}
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const value = useMemo(() =&gt; ({ user, setUser }), [user]);
  return &lt;AuthContext value={value}&gt;{children}&lt;/AuthContext&gt;;
}
export default function App() {
  return (
    &lt;Providers&gt;
      &lt;Header /&gt;
      &lt;Message showTheme /&gt;
    &lt;/Providers&gt;
  );
}
// Migrating is mechanical, and there is a codemod for it:
//   npx codemod@latest react/19/replace-context-provider
// Everything about performance is unchanged: split contexts by concern,
// memoise the value, and every consumer still re-renders on a change.
</code></pre>
