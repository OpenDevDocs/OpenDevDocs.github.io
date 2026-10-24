---
publishDate: 2026-05-26T10:15
title: Higher-Order Components
slug: higher-order-components-hoc
metadescription: Read the HOC pattern in older codebases, understand its drawbacks, and convert it to hooks.
updateDate: 2026-09-05T10:15
author: ['bishal-biswas']
level: 3
tags: ['legacy', 'patterns', 'migration']
course: react
---

## What an HOC is

A function that takes a component and returns a new one with extra behaviour.

```javascript
function withLogging(WrappedComponent) {
  return function WithLogging(props) {
    useEffect(() => {
      console.log(`${WrappedComponent.name} mounted`);
    }, []);
    return <WrappedComponent {...props} />;
  };
}
const LoggedButton = withLogging(Button);
```

The name comes from higher order functions: functions taking or returning functions. Same idea, applied to components.

Before hooks, this was the main way to share stateful logic. You will meet it in Redux's `connect`, React Router's `withRouter`, and a lot of code written before 2019.

## A realistic example

```javascript
function withAuth(WrappedComponent) {
  return function WithAuth(props) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
      fetchCurrentUser()
        .then(setUser)
        .finally(() => setIsLoading(false));
    }, []);
    if (isLoading) return <Spinner />;
    if (!user) return <LoginPrompt />;
    return <WrappedComponent {...props} user={user} />;
  };
}
const Dashboard = withAuth(function Dashboard({ user }) {
  return <h1>Welcome, {user.name}</h1>;
});
```

The auth logic is shared, and `Dashboard` receives a `user` prop it never asked for.

That last part is the first problem.

## Why hooks replaced them

### 1. Where did this prop come from?

```javascript
function Dashboard({ user, router, dispatch, theme, t }) {
}
export default withAuth(withRouter(connect(mapState)(withTheme(withTranslation()(Dashboard)))));
```

Five props from five wrappers. To find where `theme` comes from you read the export line backwards. With hooks the source is on the line that uses it:

```javascript
function Dashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
}
```

### 2. Name collisions

```javascript
const Enhanced = withAuth(withProfile(Component));
```

If both inject a prop called `user`, one silently overwrites the other. Nothing warns you, and the bug appears somewhere unrelated.

Hooks let you name things yourself:

```javascript
const { user: authUser } = useAuth();
const { user: profileUser } = useProfile();
```

### 3. Wrapper hell

The DevTools tree fills with wrappers:

```javascript
<WithAuth>
  <WithRouter>
    <Connect(Dashboard)>
      <WithTheme>
        <Dashboard />
```

Debugging means scrolling past layers that render nothing.

### 4. No static typing help

Typing an HOC properly in TypeScript is genuinely hard. Typing a hook is trivial.

## Converting

```javascript
function withWindowSize(WrappedComponent) {
  return function WithWindowSize(props) {
    const [size, setSize] = useState({
      width: window.innerWidth,
      height: window.innerHeight
    });
    useEffect(() => {
      function handleResize() {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      }
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
    return <WrappedComponent {...props} windowSize={size} />;
  };
}
```

```javascript
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  useEffect(() => {
    function handleResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
}
```

The body is identical. You remove the wrapper and return the value instead of injecting a prop.

```javascript
function Layout() {
  const { width } = useWindowSize();
  return width < 768 ? <MobileNav /> : <DesktopNav />;
}
```

## Where the pattern still fits

A few cases where wrapping is genuinely the right shape.

**Conditional rendering around a component.**

```javascript
function withErrorBoundary(Component, fallback) {
  return function WithErrorBoundary(props) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
```

A hook cannot wrap its own component in a boundary. This is a real use.

**Framework integration**, where a library needs to wrap for reasons of its own. `React.memo` and `React.lazy` are technically HOCs.

**Injecting the same props into many components at once.**

Even then, composition with `children` is usually clearer, as covered in the composition topic.

## Writing one properly

If you must, get these right.

```javascript
import hoistNonReactStatics from 'hoist-non-react-statics';
function withThing(WrappedComponent) {
  function WithThing(props) {
    const thing = useThing();
    return <WrappedComponent {...props} thing={thing} />;
  }
  WithThing.displayName = `withThing(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;
  hoistNonReactStatics(WithThing, WrappedComponent);
  return WithThing;
}
```

- **Pass all props through** with `{...props}`, or you silently drop things.
- **Set `displayName`**, or DevTools shows `Unknown`.
- **Copy static properties**, since wrapping loses them.

**Never create an HOC inside render:**

```javascript
function Parent() {
  const Enhanced = withThing(Child);
  return <Enhanced />;
}
```

That is a new component type on every render, so React unmounts and rebuilds the whole subtree, losing all its state. Same problem as defining a component inside another.

## Quick recap

- An HOC takes a component and returns an enhanced one.
- It was the main way to share stateful logic before hooks.
- Injected props obscure where values come from, and can collide.
- Wrappers clutter the component tree and are hard to type.
- Converting is usually mechanical: return the value instead of injecting it.
- Wrapping still fits for error boundaries and framework integration.
- Always forward props, set `displayName` and hoist statics.
- Never create an HOC during render.

<code id="code-content" class="language-javascript">
import { useState, useEffect } from 'react';
// THE HOC: takes a component, returns an enhanced one, injects a prop
function withWindowSize(WrappedComponent) {
  function WithWindowSize(props) {
    const [size, setSize] = useState({
      width: window.innerWidth,
      height: window.innerHeight
    });
    useEffect(() =&gt; {
      const onResize = () =&gt;
        setSize({ width: window.innerWidth, height: window.innerHeight });
      window.addEventListener('resize', onResize);
      return () =&gt; window.removeEventListener('resize', onResize);
    }, []);
    // Forward ALL props, or you silently drop the ones you forgot
    return &lt;WrappedComponent {...props} windowSize={size} /&gt;;
  }
  // Without this, DevTools shows "Unknown" in the tree
  WithWindowSize.displayName =
    'withWindowSize(' + (WrappedComponent.name || 'Component') + ')';
  return WithWindowSize;
}
// THE HOOK: the body is IDENTICAL. You just return the value instead
// of injecting it as a prop.
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  useEffect(() =&gt; {
    const onResize = () =&gt;
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () =&gt; window.removeEventListener('resize', onResize);
  }, []);
  return size;
}
// WHY HOOKS WON: with HOCs you read the export line backwards to find
// out where each prop came from, and two wrappers injecting `user`
// silently overwrite each other.
//   export default withAuth(withRouter(connect(mapState)(Dashboard)));
//   function Dashboard({ user, router, dispatch }) { ... }
// With hooks, the source is on the line that uses it, and you name
// things yourself so nothing collides:
function Dashboard() {
  const { width } = useWindowSize();
  const { user: authUser } = useAuth();
  const { user: profileUser } = useProfile();
  return width &lt; 768 ? &lt;MobileNav /&gt; : &lt;DesktopNav /&gt;;
}
// WHERE WRAPPING STILL FITS: a hook cannot wrap its own component in
// an error boundary, so this is a genuine use of the pattern
function withErrorBoundary(Component, fallback) {
  return function WithErrorBoundary(props) {
    return (
      &lt;ErrorBoundary fallback={fallback}&gt;
        &lt;Component {...props} /&gt;
      &lt;/ErrorBoundary&gt;
    );
  };
}
// NEVER create an HOC during render. Enhanced would be a new component
// type every time, so React unmounts and rebuilds the whole subtree
// and loses all its state.
function BrokenParent() {
  const Enhanced = withWindowSize(Child);     // new type every render
  return &lt;Enhanced /&gt;;
}
</code></pre>
