---
publishDate: 2026-05-12T09:34
title: Reading Resources with the use API
slug: the-use-api
metadescription: The use API reads promises and contexts during render, and unlike hooks it can be called conditionally.
updateDate: 2026-09-05T09:34
author: ['bishal-biswas']
level: 2
tags: ['react-19', 'suspense', 'async']
course: react
---

## What `use` is

`use` reads a **resource** during render. A resource is currently a promise or a context.

```javascript
import { use } from 'react';
const value = use(somePromise);
const theme = use(ThemeContext);
```

It is new in React 19, and it behaves differently from every hook you have met.

## Not a hook

Despite the name, `use` is not bound by the rules of hooks.

```javascript
function Message({ showTheme, messagePromise }) {
  if (showTheme) {
    const theme = use(ThemeContext);
    return <p className={theme}>Themed</p>;
  }
  const message = use(messagePromise);
  return <p>{message}</p>;
}
```

Conditions and early returns are fine. Loops are fine. That is the main practical difference from `useContext`.

It still has one restriction: it must be called from a component or a hook, not from an event handler or a plain function.

## Reading a promise

```javascript
function UserName({ userPromise }) {
  const user = use(userPromise);
  return <h2>{user.name}</h2>;
}
function Profile({ userId }) {
  const userPromise = fetchUser(userId);
  return (
    <Suspense fallback={<Spinner />}>
      <UserName userPromise={userPromise} />
    </Suspense>
  );
}
```

`use` suspends the component until the promise resolves. The nearest `<Suspense>` boundary shows its fallback in the meantime.

No `useState`, no `useEffect`, no loading flag. The component reads the value as though it were already there.

## The critical rule

**Do not create the promise inside the component that reads it.**

```javascript
function Broken({ userId }) {
  const userPromise = fetchUser(userId);
  const user = use(userPromise);
  return <h2>{user.name}</h2>;
}
```

Every render creates a new promise. The component suspends, re-renders, creates another promise, suspends again. Infinite loop.

The promise must come from somewhere stable: a parent, a framework's data loader, or a cache.

```javascript
function Parent({ userId }) {
  const userPromise = useMemo(() => fetchUser(userId), [userId]);
  return (
    <Suspense fallback={<Spinner />}>
      <UserName userPromise={userPromise} />
    </Suspense>
  );
}
```

Even that is fragile, because `useMemo` is a performance hint rather than a guarantee. In practice you use a framework or a caching library, which is why `use` is mostly encountered through Server Components and Next.js rather than written by hand.

## Errors

A rejected promise throws where you call `use`, so an error boundary catches it.

```javascript
function Profile({ userPromise }) {
  return (
    <ErrorBoundary fallback={<p>Could not load the profile.</p>}>
      <Suspense fallback={<Spinner />}>
        <UserName userPromise={userPromise} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

Suspense handles loading, the error boundary handles failure. Between them your component only ever deals with the success case, which is why the component itself is three lines.

Alternatively, handle it on the promise:

```javascript
const safePromise = fetchUser(id).catch(() => null);
function UserName({ userPromise }) {
  const user = use(userPromise);
  if (!user) return <p>Could not load.</p>;
  return <h2>{user.name}</h2>;
}
```

## With Server Components

This is where `use` really belongs. A server component starts the fetch and passes the unresolved promise down.

```javascript
async function Page({ userId }) {
  const userPromise = fetchUser(userId);
  const postsPromise = fetchPosts(userId);
  return (
    <div>
      <Suspense fallback={<Spinner />}>
        <UserName userPromise={userPromise} />
      </Suspense>
      <Suspense fallback={<Spinner />}>
        <PostList postsPromise={postsPromise} />
      </Suspense>
    </div>
  );
}
```

Both requests start at once, and each part of the page appears as its data arrives. No waterfall, and no coordinating loading flags.

## Reading context

```javascript
import { use, useContext } from 'react';
function Button() {
  const theme = use(ThemeContext);
  const theme2 = useContext(ThemeContext);
}
```

Identical for a simple read. Use `use` when you need it conditionally:

```javascript
function Widget({ needsAuth }) {
  if (needsAuth) {
    const { user } = use(AuthContext);
    if (!user) return <LoginPrompt />;
  }
  return <Content />;
}
```

With `useContext` that would break the rules of hooks. With `use` it is fine.

## Do not use it for everything

`use` with promises is powerful but still awkward outside a framework, because of the promise stability problem. For client side data fetching in a plain Vite app, a library is still the practical answer:

```javascript
const { data, isLoading, error } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId)
});
```

Caching, deduplication, refetching and stale data are all handled. `use` handles none of that on its own.

## Quick recap

- `use` reads a promise or a context during render.
- It is not a hook, so it can be called conditionally or in a loop.
- Reading a promise suspends until it resolves, handled by `<Suspense>`.
- Never create the promise in the component that reads it.
- Rejections are caught by an error boundary.
- It pairs naturally with Server Components passing promises down.
- For client side fetching, a data library is still more practical.

<code id="code-content" class="language-javascript">
import { use, Suspense } from 'react';
// use() reads a promise during render and suspends until it resolves.
// The component itself only handles the success case.
function UserName({ userPromise }) {
  const user = use(userPromise);       // no useState, no useEffect
  return &lt;h2&gt;{user.name}&lt;/h2&gt;;
}
function PostList({ postsPromise }) {
  const posts = use(postsPromise);
  return &lt;ul&gt;{posts.map((p) =&gt; &lt;li key={p.id}&gt;{p.title}&lt;/li&gt;)}&lt;/ul&gt;;
}
// THE CRITICAL RULE: never create the promise in the component that
// reads it. A new promise every render means suspend, re-render, new
// promise, suspend, forever.
function Broken({ userId }) {
  const user = use(fetchUser(userId));  // infinite loop
  return &lt;h2&gt;{user.name}&lt;/h2&gt;;
}
// The promise must come from somewhere stable. In practice that means a
// server component or a framework loader, not hand written code.
export default async function ProfilePage({ userId }) {
  // Both requests start at once, so there is no waterfall
  const userPromise = fetchUser(userId);
  const postsPromise = fetchPosts(userId);
  return (
    &lt;div&gt;
      {/* Suspense handles loading, the error boundary handles failure */}
      &lt;ErrorBoundary fallback={&lt;p&gt;Could not load the profile.&lt;/p&gt;}&gt;
        &lt;Suspense fallback={&lt;p&gt;Loading user...&lt;/p&gt;}&gt;
          &lt;UserName userPromise={userPromise} /&gt;
        &lt;/Suspense&gt;
      &lt;/ErrorBoundary&gt;
      &lt;Suspense fallback={&lt;p&gt;Loading posts...&lt;/p&gt;}&gt;
        &lt;PostList postsPromise={postsPromise} /&gt;
      &lt;/Suspense&gt;
    &lt;/div&gt;
  );
}
// use() is NOT a hook, so unlike useContext it can be called
// conditionally, inside a loop, or after an early return
function Widget({ needsAuth }) {
  if (needsAuth) {
    const { user } = use(AuthContext);   // legal, useContext would not be
    if (!user) return &lt;p&gt;Please log in.&lt;/p&gt;;
  }
  return &lt;p&gt;Content&lt;/p&gt;;
}
// For plain client side fetching, a library is still the practical
// answer, because use() gives you no caching or refetching:
// const { data, isLoading, error } = useQuery({
//   queryKey: ['user', userId],
//   queryFn: () =&gt; fetchUser(userId)
// });
</code></pre>
