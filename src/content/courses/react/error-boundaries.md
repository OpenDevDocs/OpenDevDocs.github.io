---
publishDate: 2026-05-13T09:38
title: Error Boundaries and Error Handling Options
slug: error-boundaries
metadescription: Stop one broken component from blanking the whole page, and learn what error boundaries can and cannot catch.
updateDate: 2026-09-05T09:38
author: ['bishal-biswas']
level: 2
tags: ['errors', 'patterns']
course: react
---

## What happens without one

If a component throws during render, React unmounts the **entire tree**. The user gets a blank white page.

```javascript
function UserCard({ user }) {
  return <h2>{user.name.toUpperCase()}</h2>;
}
```

One `null` user, and the whole application disappears. That behaviour is deliberate: React would rather show nothing than a corrupted interface. But it is not what you want in production.

An error boundary catches the error and shows a fallback instead, leaving the rest of the page working.

## Writing one

Error boundaries are the one thing that **still requires a class component**. There is no hook equivalent.

```javascript
import { Component } from 'react';
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Caught by boundary:', error, info.componentStack);
    reportToMonitoring(error, info);
  }
  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, () =>
          this.setState({ hasError: false, error: null })
        );
      }
      return this.props.fallback ?? <p>Something went wrong.</p>;
    }
    return this.props.children;
  }
}
```

Two methods:

- **`getDerivedStateFromError`** updates state so the fallback renders.
- **`componentDidCatch`** is where you log and report. It receives the component stack, which tells you exactly which component threw.

Most people install `react-error-boundary` instead of writing this, and that is a reasonable choice.

## Using it

```javascript
function App() {
  return (
    <ErrorBoundary fallback={<p>The dashboard is unavailable.</p>}>
      <Dashboard />
    </ErrorBoundary>
  );
}
```

## What it does not catch

This list matters, because people assume boundaries catch everything.

**Event handlers.**

```javascript
function Button() {
  function handleClick() {
    throw new Error('Not caught by a boundary');
  }
  return <button onClick={handleClick}>Click</button>;
}
```

Use try/catch instead:

```javascript
function handleClick() {
  try {
    doSomethingRisky();
  } catch (error) {
    setError(error);
  }
}
```

**Async code.**

```javascript
useEffect(() => {
  fetchData().then(setData);
}, []);
```

A rejected promise is not caught. Handle it, or store it in state and throw during render:

```javascript
function Component() {
  const [error, setError] = useState(null);
  if (error) throw error;
  useEffect(() => {
    fetchData().then(setData).catch(setError);
  }, []);
}
```

That trick converts an async failure into a render error the boundary can see.

**Server rendering.** Boundaries only work on the client.

**Errors in the boundary itself.** They propagate to the next boundary up.

## Where to place them

### One at the root, as a safety net

```javascript
function App() {
  return (
    <ErrorBoundary fallback={<FullPageError />}>
      <Router />
    </ErrorBoundary>
  );
}
```

Better than a white screen, but the whole app still disappears.

### Around independent sections

```javascript
function Dashboard() {
  return (
    <div>
      <ErrorBoundary fallback={<WidgetError name="Revenue" />}>
        <RevenueChart />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError name="Activity" />}>
        <ActivityFeed />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError name="Tasks" />}>
        <TaskList />
      </ErrorBoundary>
    </div>
  );
}
```

Now one broken widget shows an error card and the other two keep working. This is where boundaries earn their place.

Put them around things that can fail independently: widgets, routes, third party embeds, anything rendering user supplied content.

### Around each route

```javascript
<Route
  path="/products"
  element={
    <ErrorBoundary fallback={<RouteError />}>
      <ProductsPage />
    </ErrorBoundary>
  }
/>
```

A broken page keeps the navigation working, so the user can go somewhere else.

## Recovering

A fallback the user cannot escape is only half a solution.

```javascript
<ErrorBoundary
  fallback={(error, reset) => (
    <div role="alert">
      <p>This section failed to load.</p>
      <button onClick={reset}>Try again</button>
    </div>
  )}
>
  <Widget />
</ErrorBoundary>
```

`reset` clears the boundary's state and re-renders the children. If the cause was transient, such as a failed request, it recovers.

Reset automatically when the route changes:

```javascript
<ErrorBoundary key={location.pathname} fallback={<RouteError />}>
  <Outlet />
</ErrorBoundary>
```

Changing the key remounts the boundary, which clears the error. The key trick again.

## React 19 root options

React 19 added handlers on the root for errors that boundaries do not surface.

```javascript
import { createRoot } from 'react-dom/client';
createRoot(container, {
  onCaughtError(error, info) {
    reportToMonitoring(error, info, { caught: true });
  },
  onUncaughtError(error, info) {
    reportToMonitoring(error, info, { caught: false });
  },
  onRecoverableError(error, info) {
    console.warn('Recovered from', error);
  }
}).render(<App />);
```

- **`onCaughtError`** fires when a boundary caught it.
- **`onUncaughtError`** fires when nothing caught it.
- **`onRecoverableError`** fires for problems React handled itself, most often a hydration mismatch.

This gives you one central place to report every error, rather than adding logging to every boundary.

## Development versus production

In development you see the error overlay even with a boundary in place, which is deliberate so you cannot miss the problem. Dismiss it to see your fallback.

In production only the fallback shows. Always test what your fallback actually looks like, because a fallback that itself throws is a bad day.

## Quick recap

- Without a boundary, one render error blanks the entire app.
- Boundaries must be class components, or use `react-error-boundary`.
- They do not catch event handlers, async code, or server rendering.
- Convert an async failure into a render error by throwing from state.
- Put boundaries around independently failing sections, not just the root.
- Give the fallback a reset action, or key it to the route.
- React 19 root options centralise error reporting.
- Always test the fallback in a production build.

<code id="code-content" class="language-javascript">
import { Component, useState, useEffect } from 'react';
// Error boundaries are the ONE thing that still needs a class component.
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };      // show the fallback
  }
  componentDidCatch(error, info) {
    // info.componentStack names the component that threw
    console.error('Caught:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      const reset = () =&gt; this.setState({ hasError: false, error: null });
      return typeof this.props.fallback === 'function'
        ? this.props.fallback(this.state.error, reset)
        : this.props.fallback ?? &lt;p&gt;Something went wrong.&lt;/p&gt;;
    }
    return this.props.children;
  }
}
// Place them around INDEPENDENT sections, so one broken widget does not
// take the other two down with it
export default function Dashboard({ pathname }) {
  return (
    &lt;div&gt;
      &lt;ErrorBoundary
        fallback={(error, reset) =&gt; (
          &lt;div role="alert"&gt;
            &lt;p&gt;The revenue chart failed to load.&lt;/p&gt;
            &lt;button onClick={reset}&gt;Try again&lt;/button&gt;
          &lt;/div&gt;
        )}
      &gt;
        &lt;RevenueChart /&gt;
      &lt;/ErrorBoundary&gt;
      &lt;ErrorBoundary fallback={&lt;p&gt;Activity is unavailable.&lt;/p&gt;}&gt;
        &lt;ActivityFeed /&gt;
      &lt;/ErrorBoundary&gt;
      {/* Keying to the route clears the error on navigation */}
      &lt;ErrorBoundary key={pathname} fallback={&lt;p&gt;This page failed.&lt;/p&gt;}&gt;
        &lt;Outlet /&gt;
      &lt;/ErrorBoundary&gt;
    &lt;/div&gt;
  );
}
// WHAT BOUNDARIES DO NOT CATCH:
// 1. Event handlers. Use try/catch.
function SaveButton({ onSave }) {
  const [error, setError] = useState(null);
  async function handleClick() {
    try {
      await onSave();
    } catch (err) {
      setError(err);           // boundaries never see this
    }
  }
  return &lt;button onClick={handleClick}&gt;{error ? 'Failed' : 'Save'}&lt;/button&gt;;
}
// 2. Async code. Convert it into a render error so the boundary can see it.
function DataPanel() {
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  if (error) throw error;      // now a boundary above WILL catch it
  useEffect(() =&gt; {
    fetchData().then(setData).catch(setError);
  }, []);
  return &lt;p&gt;{data?.title}&lt;/p&gt;;
}
// 3. Server rendering, and errors thrown inside the boundary itself.
// REACT 19: report every error from one place, caught or not
// createRoot(container, {
//   onCaughtError(error, info) { report(error, info, { caught: true }); },
//   onUncaughtError(error, info) { report(error, info, { caught: false }); },
//   onRecoverableError(error) { console.warn('Recovered', error); }
// }).render(&lt;App /&gt;);
</code></pre>
