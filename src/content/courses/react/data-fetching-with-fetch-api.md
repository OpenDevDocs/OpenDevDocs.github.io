---
publishDate: 2026-05-12T09:35
title: Fetching with fetch and AbortController
slug: data-fetching-with-fetch-api
metadescription: Load data from an API inside a component, and handle the race conditions and cleanup that hand rolled fetching always needs.
updateDate: 2026-09-05T09:35
author: ['bishal-biswas']
level: 2
tags: ['data', 'async', 'effects']
course: react
---

## The naive version

```javascript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then((response) => response.json())
      .then(setUser);
  }, [userId]);
  return <h2>{user?.name}</h2>;
}
```

This works in a demo and is wrong in four ways. Let us fix them one at a time.

## Problem 1: no loading or error state

```javascript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch(`/api/users/${userId}`)
      .then((response) => response.json())
      .then(setUser)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [userId]);
  if (isLoading) return <Spinner />;
  if (error) return <p>Something went wrong.</p>;
  return <h2>{user.name}</h2>;
}
```

Note `setIsLoading(true)` at the **start** of the effect. Without it, switching users shows the previous user's data while the new one loads.

## Problem 2: fetch does not reject on 404

This surprises everyone the first time.

```javascript
fetch('/api/does-not-exist')
  .then((r) => r.json())
  .catch(handleError);
```

A 404 or 500 is a **successful HTTP exchange**, so the promise resolves. `fetch` only rejects when the request could not be made at all, such as no network.

Check `response.ok` yourself:

```javascript
async function getUser(id) {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}
```

`response.ok` is true for any status from 200 to 299.

## Problem 3: race conditions

Switch quickly from user 1 to user 2. If request 1 is slower, it resolves **last** and overwrites user 2 on screen. The URL says user 2, the page shows user 1.

This is intermittent, environment dependent, and miserable to debug.

```javascript
useEffect(() => {
  let ignore = false;
  setIsLoading(true);
  getUser(userId)
    .then((data) => {
      if (!ignore) setUser(data);
    })
    .catch((err) => {
      if (!ignore) setError(err);
    })
    .finally(() => {
      if (!ignore) setIsLoading(false);
    });
  return () => {
    ignore = true;
  };
}, [userId]);
```

When `userId` changes, cleanup flips the old effect's `ignore` to `true`, so its late response is discarded.

**Every fetch in an effect needs this**, or the AbortController version below.

## Problem 4: no cancellation

The `ignore` flag stops the state update but the request still completes, wasting bandwidth. Cancel it properly:

```javascript
useEffect(() => {
  const controller = new AbortController();
  setIsLoading(true);
  setError(null);
  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return response.json();
    })
    .then((data) => {
      setUser(data);
      setIsLoading(false);
    })
    .catch((err) => {
      if (err.name === 'AbortError') return;
      setError(err);
      setIsLoading(false);
    });
  return () => controller.abort();
}, [userId]);
```

Two things to notice: `controller.abort()` in cleanup, and the `AbortError` check so a deliberate cancellation is not reported as a failure.

## Pulling it into a hook

Writing all that in every component is not sustainable.

```javascript
function useFetch(url) {
  const [state, setState] = useState({ data: null, isLoading: true, error: null });
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, isLoading: true, error: null });
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Status ${response.status}`);
        return response.json();
      })
      .then((data) => setState({ data, isLoading: false, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ data: null, isLoading: false, error });
      });
    return () => controller.abort();
  }, [url]);
  return state;
}
function UserProfile({ userId }) {
  const { data: user, isLoading, error } = useFetch(`/api/users/${userId}`);
  if (isLoading) return <Spinner />;
  if (error) return <p>{error.message}</p>;
  return <h2>{user.name}</h2>;
}
```

One object rather than three pieces of state, so the values can never disagree.

## Posting data

Mutations belong in event handlers, not effects.

```javascript
function CreateUser() {
  const [isSaving, setIsSaving] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Asha' })
      });
      if (!response.ok) throw new Error('Could not create user');
    } finally {
      setIsSaving(false);
    }
  }
  return <form onSubmit={handleSubmit}>...</form>;
}
```

Three things must be right for a JSON POST: the `method`, the `Content-Type` header, and `JSON.stringify` on the body. Forgetting the header makes many servers ignore the body entirely.

Better still, use an Action, which handles the pending state for you.

## What this still does not do

Even the polished hook above has no:

- **Cache**, so two components fetching the same URL make two requests.
- **Deduplication** of simultaneous identical requests.
- **Refetching** when the window regains focus or the network returns.
- **Retries** on failure.
- **Stale while revalidate**, showing cached data while fetching fresh.
- **Pagination or infinite scroll** helpers.

Building all of that is a project in itself, which is exactly why libraries exist:

```javascript
import { useQuery } from '@tanstack/react-query';
function UserProfile({ userId }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId)
  });
  if (isLoading) return <Spinner />;
  if (error) return <p>{error.message}</p>;
  return <h2>{user.name}</h2>;
}
```

Same shape, and all six missing features included.

## The honest recommendation

**Learn the manual version**, because you need to understand race conditions and cleanup to debug anything.

**Then use a library or a framework** for real work. Hand rolled fetching in every component is how applications accumulate subtle, intermittent bugs.

## Quick recap

- Set loading true at the start of the effect, or stale data shows.
- `fetch` does not reject on 404, so check `response.ok`.
- Guard every fetch with an `ignore` flag or an `AbortController`.
- Ignore `AbortError`, since a cancellation is not a failure.
- Keep related state in one object so it cannot disagree.
- Mutations go in event handlers or Actions, never effects.
- Hand rolled fetching has no cache, dedup, retry or refetch.

<code id="code-content" class="language-javascript">
import { useState, useEffect } from 'react';
// A reusable hook with everything hand rolled fetching actually needs
function useFetch(url) {
  // One object, so isLoading, data and error can never disagree
  const [state, setState] = useState({ data: null, isLoading: true, error: null });
  useEffect(() =&gt; {
    const controller = new AbortController();
    // Reset at the START, or switching ids shows the previous result
    setState({ data: null, isLoading: true, error: null });
    fetch(url, { signal: controller.signal })
      .then((response) =&gt; {
        // fetch does NOT reject on 404 or 500. Check this yourself.
        if (!response.ok) throw new Error('Request failed: ' + response.status);
        return response.json();
      })
      .then((data) =&gt; setState({ data, isLoading: false, error: null }))
      .catch((error) =&gt; {
        // A cancellation is not a failure, so do not show it as one
        if (error.name === 'AbortError') return;
        setState({ data: null, isLoading: false, error });
      });
    // Cleanup cancels the in flight request, which also fixes the race
    // condition where a slow first response overwrites a fast second one
    return () =&gt; controller.abort();
  }, [url]);
  return state;
}
export default function UserProfile({ userId }) {
  const { data: user, isLoading, error } = useFetch('/api/users/' + userId);
  if (isLoading) return &lt;p&gt;Loading...&lt;/p&gt;;
  if (error) return &lt;p&gt;Could not load: {error.message}&lt;/p&gt;;
  if (!user) return &lt;p&gt;No user found.&lt;/p&gt;;
  return &lt;h2&gt;{user.name}&lt;/h2&gt;;
}
// The ignore flag version, if you are not cancelling
function useUser(userId) {
  const [user, setUser] = useState(null);
  useEffect(() =&gt; {
    let ignore = false;
    fetchUser(userId).then((data) =&gt; {
      if (!ignore) setUser(data);     // discard a late response
    });
    return () =&gt; { ignore = true; };
  }, [userId]);
  return user;
}
// MUTATIONS go in handlers, never effects. Three things must be right
// for a JSON POST: method, Content-Type, and JSON.stringify.
async function createUser(name) {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!response.ok) throw new Error('Could not create user');
  return response.json();
}
// What this STILL lacks: caching, request deduplication, refetch on
// focus, retries, and stale while revalidate. That is why real projects
// use a library:
// const { data, isLoading, error } = useQuery({
//   queryKey: ['user', userId],
//   queryFn: () =&gt; fetchUser(userId)
// });
</code></pre>
