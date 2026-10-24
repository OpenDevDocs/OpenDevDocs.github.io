---
publishDate: 2026-05-26T10:14
title: Class Components and Lifecycle Methods
slug: class-components-legacy
metadescription: Read and maintain the class components in older codebases, and convert them to hooks when it is worth doing.
updateDate: 2026-09-05T10:14
author: ['bishal-biswas']
level: 3
tags: ['legacy', 'classes', 'migration']
course: react
---

## Why this topic exists

You will not write class components. Hooks arrived in 2019 and function components are the only style used in new code.

But there is a decade of React written this way, and you will have to read it, debug it and occasionally convert it. Error boundaries also still require a class, so the syntax is not entirely gone.

## The shape

```javascript
import { Component } from 'react';
class Counter extends Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
    this.handleClick = this.handleClick.bind(this);
  }
  handleClick() {
    this.setState({ count: this.state.count + 1 });
  }
  render() {
    return <button onClick={this.handleClick}>{this.state.count}</button>;
  }
}
```

```javascript
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

Six lines versus fifteen, and no `this` to think about.

## `setState`

```javascript
this.setState({ count: 5 });
this.setState((previousState) => ({ count: previousState.count + 1 }));
this.setState({ count: 5 }, () => {
  console.log('Updated');
});
```

Three things differ from `useState`:

- **It merges.** `this.setState({ a: 1 })` leaves `b` alone. `useState` replaces, which is why you spread.
- **The updater form** exists for the same reason as in hooks.
- **The callback** runs after the update. There is no direct hook equivalent, and you use an effect instead.

## The `this` problem

```javascript
class Broken extends Component {
  handleClick() {
    this.setState({ clicked: true });
  }
  render() {
    return <button onClick={this.handleClick}>Click</button>;
  }
}
```

That throws "Cannot read properties of undefined". Passing `this.handleClick` detaches it from the instance, so `this` is `undefined`.

Three fixes existed:

```javascript
this.handleClick = this.handleClick.bind(this);
<button onClick={() => this.handleClick()}>
handleClick = () => {
  this.setState({ clicked: true });
};
```

The class field arrow was the usual answer. This entire category of bug simply does not exist with hooks.

## Lifecycle methods

```javascript
class UserProfile extends Component {
  state = { user: null, isLoading: true };
  componentDidMount() {
    this.fetchUser();
  }
  componentDidUpdate(previousProps) {
    if (previousProps.userId !== this.props.userId) {
      this.fetchUser();
    }
  }
  componentWillUnmount() {
    this.controller?.abort();
  }
  async fetchUser() {
    this.controller = new AbortController();
    const response = await fetch(`/api/users/${this.props.userId}`, {
      signal: this.controller.signal
    });
    this.setState({ user: await response.json(), isLoading: false });
  }
  render() {
    if (this.state.isLoading) return <Spinner />;
    return <h2>{this.state.user.name}</h2>;
  }
}
```

Three methods, and the fetch logic is duplicated in intent across mount and update.

```javascript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setUser(data);
        setIsLoading(false);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setIsLoading(false);
      });
    return () => controller.abort();
  }, [userId]);
  if (isLoading) return <Spinner />;
  return <h2>{user.name}</h2>;
}
```

One effect covers mount, update and cleanup, because the dependency array expresses "keep this in sync with `userId`" rather than three separate moments.

That is the deeper point from the effects topic: lifecycle thinking scatters related logic, and synchronisation thinking gathers it.

## The rough mapping

| Class | Hooks |
| --- | --- |
| `constructor` | `useState` |
| `componentDidMount` | `useEffect(fn, [])` |
| `componentDidUpdate` | `useEffect(fn, [deps])` |
| `componentWillUnmount` | the cleanup return |
| `shouldComponentUpdate` | `memo` |
| `getDerivedStateFromError` | still a class |
| `componentDidCatch` | still a class |

Use it to read old code, not as a conversion recipe. Translating method by method usually produces worse hooks than rethinking the component.

## What has been removed

React 19 removed several long deprecated pieces:

- `componentWillMount`, `componentWillReceiveProps` and `componentWillUpdate`. The `UNSAFE_` prefixed versions still exist.
- String refs, so `ref="input"` is gone. Use a ref object.
- `propTypes` and `defaultProps` on function components. Classes keep `defaultProps`.
- Legacy context, meaning `contextTypes` and `getChildContext`.
- `ReactDOM.render` and `ReactDOM.hydrate`, replaced by `createRoot` and `hydrateRoot`.

If you are upgrading an old codebase, these are the changes most likely to break the build.

## Should you convert?

**No** if it works and nobody touches it. A working class component is not a bug. Rewriting it risks introducing one for no user benefit.

**Yes** when:

- You are already substantially changing the component.
- You want to reuse its logic, which needs a custom hook.
- It uses something React 19 removed.
- The lifecycle logic has become tangled.

Convert opportunistically, one component at a time, with tests. A big bang rewrite of a working application is rarely a good use of anyone's week.

## Quick recap

- Class components are legacy but common in older code.
- `setState` merges, `useState` replaces.
- The `this` binding problem does not exist with hooks.
- One effect replaces mount, update and unmount together.
- Error boundaries still require a class.
- React 19 removed the unsafe lifecycles, string refs and `ReactDOM.render`.
- Convert opportunistically, never as a big bang rewrite.

<code id="code-content" class="language-javascript">
import { Component, useState, useEffect } from 'react';
// THE CLASS VERSION: three lifecycle methods, a constructor, and the
// fetch logic effectively duplicated between mount and update.
class UserProfileClass extends Component {
  state = { user: null, isLoading: true };
  componentDidMount() {
    this.fetchUser();
  }
  componentDidUpdate(previousProps) {
    // Easy to forget, and the component silently stops updating
    if (previousProps.userId !== this.props.userId) this.fetchUser();
  }
  componentWillUnmount() {
    this.controller?.abort();
  }
  // A class field arrow, which was the standard fix for the `this`
  // problem. Passing this.fetchUser directly would lose the binding.
  fetchUser = async () =&gt; {
    this.controller = new AbortController();
    const response = await fetch('/api/users/' + this.props.userId, {
      signal: this.controller.signal
    });
    // setState MERGES, unlike useState which replaces
    this.setState({ user: await response.json(), isLoading: false });
  };
  render() {
    if (this.state.isLoading) return &lt;p&gt;Loading...&lt;/p&gt;;
    return &lt;h2&gt;{this.state.user.name}&lt;/h2&gt;;
  }
}
// THE HOOKS VERSION: one effect covers mount, update and cleanup,
// because the dependency array says "keep this in sync with userId"
// rather than naming three separate moments.
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() =&gt; {
    const controller = new AbortController();
    setIsLoading(true);
    fetch('/api/users/' + userId, { signal: controller.signal })
      .then((r) =&gt; r.json())
      .then((data) =&gt; { setUser(data); setIsLoading(false); })
      .catch((error) =&gt; {
        if (error.name !== 'AbortError') setIsLoading(false);
      });
    return () =&gt; controller.abort();
  }, [userId]);
  if (isLoading) return &lt;p&gt;Loading...&lt;/p&gt;;
  return &lt;h2&gt;{user.name}&lt;/h2&gt;;
}
// THE ONE THING STILL REQUIRING A CLASS: error boundaries
class ErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error(error, info.componentStack); }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
// REMOVED IN REACT 19, and the likeliest things to break an upgrade:
//   componentWillMount / WillReceiveProps / WillUpdate  (UNSAFE_ remain)
//   string refs:  ref="input"
//   propTypes and defaultProps on FUNCTION components
//   legacy context: contextTypes, getChildContext
//   ReactDOM.render and ReactDOM.hydrate
// CONVERT OPPORTUNISTICALLY. A working class component is not a bug.
</code></pre>
