---
publishDate: 2026-05-13T09:36
title: Suspense for Data Fetching
slug: suspense-for-data-fetching
metadescription: Let React handle loading states declaratively with Suspense boundaries, instead of an isLoading flag in every component.
updateDate: 2026-09-05T09:36
author: ['bishal-biswas']
level: 2
tags: ['suspense', 'data', 'async']
course: react
---

## The idea

Instead of every component tracking its own loading flag, you wrap part of the tree and say "show this while anything inside is not ready".

```javascript
import { Suspense } from 'react';
function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <UserProfile />
    </Suspense>
  );
}
```

If `UserProfile` suspends, the spinner shows. When it is ready, the real content replaces it. `UserProfile` itself contains no loading logic at all.

## What suspends

A component suspends when it reads a resource that is not ready. In practice that means:

- `use(promise)`, covered in the `use` topic.
- `lazy()` for code splitting.
- A framework's data loading, such as Next.js.
- A library with Suspense support, such as TanStack Query with `useSuspenseQuery`.

**A plain `fetch` in `useEffect` does not suspend.** This is the most common misunderstanding. Suspense is not a data fetching mechanism, it is a way to coordinate loading states for resources that support it.

## The comparison

```javascript
function UserProfile({ userId }) {
  const { data, isLoading, error } = useFetch(`/api/users/${userId}`);
  if (isLoading) return <Spinner />;
  if (error) return <p>Error</p>;
  return <h2>{data.name}</h2>;
}
```

```javascript
function UserProfile({ userPromise }) {
  const user = use(userPromise);
  return <h2>{user.name}</h2>;
}
function Page({ userPromise }) {
  return (
    <ErrorBoundary fallback={<p>Error</p>}>
      <Suspense fallback={<Spinner />}>
        <UserProfile userPromise={userPromise} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

The component shrinks to the success case. Loading moves to Suspense, failure moves to the error boundary. Each concern is handled in one place rather than repeated everywhere.

## Placing boundaries

Where you put the boundary decides what the user sees.

### One boundary for everything

```javascript
<Suspense fallback={<PageSkeleton />}>
  <Header />
  <Sidebar />
  <MainContent />
</Suspense>
```

Nothing appears until **everything** is ready. Simple, but the slowest item holds up the whole page.

### A boundary per section

```javascript
<div>
  <Suspense fallback={<HeaderSkeleton />}>
    <Header />
  </Suspense>
  <Suspense fallback={<SidebarSkeleton />}>
    <Sidebar />
  </Suspense>
  <Suspense fallback={<ContentSkeleton />}>
    <MainContent />
  </Suspense>
</div>
```

Each part appears as its data arrives. Better perceived performance, though too many boundaries makes the page feel like it is assembling itself piece by piece.

A good rule: put boundaries around things that are genuinely independent, and use a skeleton shaped like the real content so the layout does not jump.

## Avoiding waterfalls

This is the trap.

```javascript
function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <User />
    </Suspense>
  );
}
function User() {
  const user = use(fetchUser());
  return (
    <Suspense fallback={<Spinner />}>
      <Posts userId={user.id} />
    </Suspense>
  );
}
```

`Posts` cannot start until `User` finishes, because it needs `user.id`. Two requests in sequence.

When the requests are independent, start them together:

```javascript
function Page() {
  const userPromise = fetchUser();
  const postsPromise = fetchPosts();
  return (
    <div>
      <Suspense fallback={<Spinner />}>
        <User userPromise={userPromise} />
      </Suspense>
      <Suspense fallback={<Spinner />}>
        <Posts postsPromise={postsPromise} />
      </Suspense>
    </div>
  );
}
```

Both start immediately. Each section renders when its own data lands.

The principle is **start fetching as early as possible, and read as late as possible**.

## Suspense and transitions

By default, a state update that causes suspension replaces the content with the fallback. That is jarring when the user already had something on screen.

```javascript
function TabPanel() {
  const [tab, setTab] = useState('home');
  const [isPending, startTransition] = useTransition();
  function selectTab(next) {
    startTransition(() => setTab(next));
  }
  return (
    <div>
      <button onClick={() => selectTab('posts')}>Posts</button>
      <Suspense fallback={<Spinner />}>
        <TabContent tab={tab} style={{ opacity: isPending ? 0.6 : 1 }} />
      </Suspense>
    </div>
  );
}
```

Inside a transition, React **keeps the old content visible** and does not show the fallback again. You get `isPending` instead, so you can dim the stale content.

This is the difference between a page that flickers to a spinner on every tab change and one that feels smooth.

## Server rendering and streaming

With a framework, Suspense boundaries become streaming boundaries. The server sends the shell immediately, then streams each section's HTML as its data resolves.

```javascript
export default function Page() {
  return (
    <div>
      <Header />
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments />
      </Suspense>
    </div>
  );
}
```

The header is readable straight away while comments are still being fetched on the server. There is more on this in the streaming SSR topic.

## Common mistakes

**Expecting `useEffect` fetching to suspend.** It does not. Use a library or a framework.

**Creating the promise inside the suspending component.** That causes an infinite loop, as covered in the `use` topic.

**A fallback that changes the layout.** If the skeleton is a different size from the content, the page jumps. Match the shape.

**Forgetting the error boundary.** Suspense handles loading only. A rejected promise needs an error boundary, which is the next topic.

## Quick recap

- Suspense shows a fallback while a component's resource is not ready.
- Only resources that support it suspend, and plain effect fetching does not.
- Components become just the success case.
- More boundaries means faster perceived loading and a busier page.
- Start independent requests together to avoid waterfalls.
- Inside a transition React keeps old content instead of showing the fallback.
- Match the skeleton shape to prevent layout jumps.
- Always pair Suspense with an error boundary.

<code id="code-content" class="language-javascript">
import { Suspense, use, useState, useTransition } from 'react';
// The component becomes ONLY the success case. Loading is handled by
// Suspense above it, failure by an error boundary above that.
function UserCard({ userPromise }) {
  const user = use(userPromise);
  return &lt;h2&gt;{user.name}&lt;/h2&gt;;
}
function PostList({ postsPromise }) {
  const posts = use(postsPromise);
  return &lt;ul&gt;{posts.map((p) =&gt; &lt;li key={p.id}&gt;{p.title}&lt;/li&gt;)}&lt;/ul&gt;;
}
// AVOID WATERFALLS: start independent requests together, at the top,
// and read them as late as possible.
export default function ProfilePage({ userId }) {
  const userPromise = fetchUser(userId);      // both start now
  const postsPromise = fetchPosts(userId);
  return (
    &lt;ErrorBoundary fallback={&lt;p&gt;Something went wrong.&lt;/p&gt;}&gt;
      &lt;div&gt;
        {/* One boundary per independent section, so each part appears
            as its own data arrives */}
        &lt;Suspense fallback={&lt;CardSkeleton /&gt;}&gt;
          &lt;UserCard userPromise={userPromise} /&gt;
        &lt;/Suspense&gt;
        &lt;Suspense fallback={&lt;ListSkeleton /&gt;}&gt;
          &lt;PostList postsPromise={postsPromise} /&gt;
        &lt;/Suspense&gt;
      &lt;/div&gt;
    &lt;/ErrorBoundary&gt;
  );
}
// A skeleton should MATCH THE SHAPE of the real content, or the layout
// jumps when it swaps in
function CardSkeleton() {
  return &lt;div style={{ height: 64, background: '#eee', borderRadius: 8 }} /&gt;;
}
function ListSkeleton() {
  return &lt;div style={{ height: 200, background: '#eee', borderRadius: 8 }} /&gt;;
}
// Inside a transition, React keeps the OLD content on screen instead of
// flashing back to the fallback. You get isPending to dim it instead.
function TabPanel() {
  const [tab, setTab] = useState('home');
  const [isPending, startTransition] = useTransition();
  return (
    &lt;div&gt;
      &lt;button onClick={() =&gt; startTransition(() =&gt; setTab('posts'))}&gt;
        Posts
      &lt;/button&gt;
      &lt;div style={{ opacity: isPending ? 0.6 : 1 }}&gt;
        &lt;Suspense fallback={&lt;ListSkeleton /&gt;}&gt;
          &lt;TabContent tab={tab} /&gt;
        &lt;/Suspense&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
}
// THE BIG MISUNDERSTANDING: a plain fetch inside useEffect does NOT
// suspend. Suspense coordinates loading for resources that support it,
// it is not a data fetching mechanism of its own.
</code></pre>
