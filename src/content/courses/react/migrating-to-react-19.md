---
publishDate: 2026-05-27T10:17
title: Migrating from React 18 to React 19
slug: migrating-to-react-19
metadescription: Upgrade safely with the codemods, know exactly what was removed, and adopt the new features gradually.
updateDate: 2026-09-05T10:17
author: ['bishal-biswas']
level: 3
tags: ['migration', 'react-19', 'upgrade']
course: react
---

## Start on 18.3

```bash
npm install react@18.3 react-dom@18.3
```

React 18.3 is identical to 18.2 except that it **warns about everything React 19 removes**. Run your app, work through the console warnings, and the actual upgrade becomes uneventful.

Skipping this step is the main reason upgrades go badly.

## Run the codemods

```bash
npx codemod@latest react/19/migration-recipe
```

This applies the mechanical changes automatically: `ReactDOM.render`, `Context.Provider`, `forwardRef`, string refs and several more.

Review the diff. Codemods are good but not infallible, and you should understand what changed.

## Then upgrade

```bash
npm install react@19 react-dom@19
npm install --save-dev @types/react@19 @types/react-dom@19
```

## What was removed

### `ReactDOM.render`

```javascript
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));
```

```javascript
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<App />);
```

Note the import path change to `react-dom/client`. Same for `hydrate`, which becomes `hydrateRoot`.

### `propTypes` and `defaultProps` on function components

```javascript
function Button({ label }) {}
Button.propTypes = { label: PropTypes.string };
Button.defaultProps = { label: 'Click' };
```

```javascript
function Button({ label = 'Click' }) {}
```

Runtime prop checking is gone. Use TypeScript, or parameter defaults plus care.

Classes keep `defaultProps`.

### String refs

```javascript
<input ref="myInput" />
this.refs.myInput.focus();
```

```javascript
const inputRef = useRef(null);
<input ref={inputRef} />
```

### Legacy context

`contextTypes` and `getChildContext` are gone. Use `createContext`.

### The unsafe lifecycles

`componentWillMount`, `componentWillReceiveProps` and `componentWillUpdate` are removed. The `UNSAFE_` versions still work.

### Test utilities

```javascript
import { act } from 'react-dom/test-utils';
import { act } from 'react';
```

`ReactDOM.unstable_renderSubtreeIntoContainer` and `react-test-renderer` shallow rendering are gone too.

## What changed behaviour

### Errors are not re-thrown

React 18 re-threw caught errors, so they also appeared in `window.onerror`. React 19 does not, and gives you root options instead:

```javascript
createRoot(container, {
  onCaughtError(error, info) {},
  onUncaughtError(error, info) {},
  onRecoverableError(error, info) {}
});
```

If your monitoring relied on `window.onerror` picking up React errors, wire it up here.

### `useRef` requires an argument

```javascript
const ref = useRef();
const ref = useRef(null);
```

### Hydration error messages

Much better in React 19, showing a diff of what differed. Nothing to change, but expect different console output.

### Refs are props

```javascript
const Input = forwardRef(function Input(props, ref) {
  return <input ref={ref} />;
});
```

```javascript
function Input({ ref, ...rest }) {
  return <input ref={ref} {...rest} />;
}
```

`forwardRef` still works but is deprecated.

### `<Context>` as a provider

```javascript
<ThemeContext.Provider value={theme}>
<ThemeContext value={theme}>
```

`Context.Consumer` is removed entirely.

## Third party libraries

The most common source of trouble, especially anything touching internals.

```bash
npm outdated
npm ls react
```

`npm ls react` shows duplicate React versions, which cause the "invalid hook call" error. Everything must resolve to one copy.

Check that your UI library, state library, router and testing tools all support React 19 before you start. A library still on `forwardRef` internally is fine, since it is deprecated rather than removed.

## Do it in order

1. Upgrade to React 18.3 and clear every warning.
2. Run the codemods and review the diff.
3. Check third party library compatibility.
4. Upgrade React and the types.
5. Run your test suite.
6. Click through the app, watching the console.
7. Deploy behind a flag or to staging first.

Do not adopt new features in the same change. Get the upgrade green first, then start using Actions and the rest.

## Adopting the new features

Once you are on 19, take these in whatever order helps most.

**Actions and `useActionState`** replace the most form boilerplate, so start there.

**`ref` as a prop** removes `forwardRef` wrappers as you touch components.

**Document metadata** lets you drop `react-helmet`.

**`<Context>` as provider** tidies deeply nested providers.

**The React Compiler** is a separate install, and it is worth doing once the upgrade is settled.

Migrate opportunistically. There is no prize for rewriting everything in one week.

## Quick recap

- Go to 18.3 first and clear every deprecation warning.
- Run the official codemod recipe and review the diff.
- `ReactDOM.render`, string refs, legacy context and `propTypes` are gone.
- Errors no longer reach `window.onerror`, so use the root options.
- `useRef` needs an explicit argument.
- Check `npm ls react` for duplicate copies.
- Upgrade first, adopt new features afterwards.

<code id="code-content" class="language-javascript">
// STEP 1: go to 18.3 first. It is identical to 18.2 except it WARNS
// about everything React 19 removes. Clear the console, then upgrade.
//   npm install react@18.3 react-dom@18.3
// STEP 2: run the codemods, then review the diff
//   npx codemod@latest react/19/migration-recipe
// STEP 3: upgrade
//   npm install react@19 react-dom@19
//   npm install --save-dev @types/react@19 @types/react-dom@19
// ---------- REMOVED, and what replaces it ----------
// ReactDOM.render(&lt;App /&gt;, container);            note the new import path
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root'), {
  // React 19 no longer re-throws caught errors, so they no longer reach
  // window.onerror. Wire your monitoring up here instead.
  onCaughtError(error, info) { report(error, info, { caught: true }); },
  onUncaughtError(error, info) { report(error, info, { caught: false }); },
  onRecoverableError(error) { console.warn('Recovered', error); }
}).render(&lt;App /&gt;);
// propTypes and defaultProps on FUNCTION components are gone
//   Button.propTypes = { label: PropTypes.string };
//   Button.defaultProps = { label: 'Click' };
function Button({ label = 'Click' }) {      // parameter defaults instead
  return &lt;button&gt;{label}&lt;/button&gt;;
}
// String refs are gone
//   &lt;input ref="myInput" /&gt;  -&gt;  const ref = useRef(null); &lt;input ref={ref} /&gt;
// useRef now REQUIRES an argument
//   const ref = useRef();        -&gt; const ref = useRef(null);
// forwardRef is deprecated, because ref is now an ordinary prop
//   const Input = forwardRef(function Input(props, ref) { ... });
function Input({ ref, ...rest }) {
  return &lt;input ref={ref} {...rest} /&gt;;
}
// Context renders as its own provider, and Consumer is removed entirely
//   &lt;ThemeContext.Provider value={theme}&gt;  -&gt;  &lt;ThemeContext value={theme}&gt;
// act moved out of test-utils
//   import { act } from 'react-dom/test-utils';  -&gt;  import { act } from 'react';
// ---------- CHECK FOR DUPLICATE REACT COPIES ----------
// Two copies cause the "invalid hook call" error. Everything must
// resolve to one.
//   npm ls react
//   npm outdated
// ---------- DO THE UPGRADE FIRST, FEATURES AFTERWARDS ----------
// Then adopt, in whatever order helps most:
//   Actions and useActionState   removes the most form boilerplate
//   ref as a prop                drops forwardRef wrappers as you go
//   document metadata            lets you remove react-helmet
//   the React Compiler           a separate install, once things settle
</code></pre>
