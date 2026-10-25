---
publishDate: 2026-05-18T09:50
title: Streaming SSR and Selective Hydration
slug: streaming-ssr-and-hydration
metadescription: Send HTML in pieces as it becomes ready, and make the page interactive progressively instead of all at once.
updateDate: 2026-09-05T09:50
author: ['bishal-biswas']
level: 3
tags: ['ssr', 'performance', 'hydration']
course: react
---

## Server rendering, briefly

Client rendering sends an empty page and builds it in the browser:

```html
<div id="root"></div>
<script src="/app.js"></script>
```

Nothing is visible until the JavaScript downloads, parses and runs. On a slow connection that is seconds of blank screen, and crawlers may see nothing at all.

Server rendering sends finished HTML instead. The user sees content immediately, then React attaches behaviour to it. That second step is **hydration**.

## The problem with classic SSR

Traditional server rendering is all or nothing, and it blocks four times:

1. **Fetch everything** before rendering can start.
2. **Render everything** to a string.
3. **Load all JavaScript** before hydration can start.
4. **Hydrate everything** before anything is interactive.

One slow database query holds up the entire page. The user waits, then gets everything at once.

## Streaming

React can send HTML in pieces as it becomes ready.

```javascript
import { Suspense } from 'react';
export default function Page() {
  return (
    <div>
      <Header />
      <Navigation />
      <Suspense fallback={<FeedSkeleton />}>
        <Feed />
      </Suspense>
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments />
      </Suspense>
    </div>
  );
}
```

The header and navigation are sent **immediately**, along with the two skeletons. As `Feed` finishes on the server, its HTML is streamed and swapped in. Then `Comments`.

Suspense boundaries are streaming boundaries. Each one is a point where React can say "send what you have and continue".

The user reads the header while the feed is still being queried, instead of staring at nothing.

## Selective hydration

The second half of the improvement.

Classic hydration processes the whole tree in one pass. Streaming lets React hydrate components **as their HTML and code arrive**, in pieces.

Better still, React prioritises by interaction. If a user clicks a component that has not hydrated yet, React hydrates **that one first**, then continues with the rest.

The click is not lost. React records it and replays it once the component is ready. So a page can be usable long before it is fully hydrated.

## Placing boundaries

Where the boundaries go decides what streams separately.

```javascript
<Suspense fallback={<PageSkeleton />}>
  <EntirePage />
</Suspense>
```

One boundary means one chunk, which is barely better than no streaming.

```javascript
<div>
  <Header />
  <Suspense fallback={<SidebarSkeleton />}>
    <Sidebar />
  </Suspense>
  <Suspense fallback={<ContentSkeleton />}>
    <MainContent />
  </Suspense>
  <Suspense fallback={<RecommendationsSkeleton />}>
    <Recommendations />
  </Suspense>
</div>
```

Now the shell arrives instantly and each section fills in independently.

Put boundaries around slow, independent sections. Do not put them around fast ones, since a fallback that appears and disappears in 50ms is a flicker.

## Hydration mismatches

The classic SSR error: the server HTML and the first client render disagree.

```javascript
function Greeting() {
  return <p>Rendered at {new Date().toLocaleTimeString()}</p>;
}
function Broken() {
  return <p>{Math.random()}</p>;
}
function AlsoBroken() {
  const width = window.innerWidth;
  return <p>{width}</p>;
}
```

The first two produce different values on each render. The third crashes on the server, where `window` does not exist.

The fix is to render the same thing on both sides, then update after mounting:

```javascript
function Time() {
  const [time, setTime] = useState(null);
  useEffect(() => {
    setTime(new Date().toLocaleTimeString());
  }, []);
  return <p>{time ?? 'Loading...'}</p>;
}
```

The server renders `Loading...`, the client renders `Loading...` first, they match, and then the effect fills in the real value.

React 19 improved the error message considerably, showing a diff of what differed rather than a generic warning.

For content that genuinely cannot match, there is an escape hatch:

```javascript
<time suppressHydrationWarning>{new Date().toISOString()}</time>
```

Use it sparingly, and only on leaf nodes.

## Reading browser APIs safely

```javascript
function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  return isClient;
}
function WindowWidth() {
  const isClient = useIsClient();
  if (!isClient) return <p>Measuring...</p>;
  return <p>{window.innerWidth}px</p>;
}
```

Or better, use `useSyncExternalStore` with a server snapshot, which is what it was designed for.

## What streaming does not fix

**Total load time.** The data still takes as long to fetch. Streaming improves **perceived** performance by showing something sooner.

**A slow database.** Fix the query.

**A huge bundle.** Streaming HTML does not shrink JavaScript. That is code splitting and Server Components.

## Quick recap

- Server rendering sends HTML so content is visible before JavaScript runs.
- Classic SSR blocks on fetching, rendering, loading and hydrating.
- Suspense boundaries let React stream HTML in pieces as it is ready.
- Selective hydration makes parts interactive independently.
- A click on an unhydrated component is prioritised and replayed.
- Place boundaries around slow independent sections only.
- Hydration mismatches come from time, randomness and browser APIs.
- Streaming improves perceived speed, not total load time.

<code id="code-content" class="language-javascript">
import { Suspense, useState, useEffect } from 'react';
// Each Suspense boundary is a STREAMING boundary. The shell and the
// skeletons are sent immediately, then each section's HTML is streamed
// in as its data resolves on the server.
export default function Page() {
  return (
    &lt;div&gt;
      {/* Sent instantly, readable before anything else finishes */}
      &lt;Header /&gt;
      &lt;Navigation /&gt;
      {/* Slow and independent, so each gets its own boundary */}
      &lt;Suspense fallback={&lt;FeedSkeleton /&gt;}&gt;
        &lt;Feed /&gt;
      &lt;/Suspense&gt;
      &lt;Suspense fallback={&lt;CommentsSkeleton /&gt;}&gt;
        &lt;Comments /&gt;
      &lt;/Suspense&gt;
    &lt;/div&gt;
  );
}
// Selective hydration then makes each part interactive as its code
// arrives. If a user clicks a component that is not hydrated yet, React
// prioritises that one and REPLAYS the click. Nothing is lost.
// HYDRATION MISMATCHES: the server HTML and the first client render must
// produce the same thing. These three all break that rule.
function Broken() {
  return (
    &lt;div&gt;
      &lt;p&gt;{new Date().toLocaleTimeString()}&lt;/p&gt;   {/* differs every render */}
      &lt;p&gt;{Math.random()}&lt;/p&gt;                     {/* differs every render */}
      &lt;p&gt;{window.innerWidth}&lt;/p&gt;                 {/* crashes on the server */}
    &lt;/div&gt;
  );
}
// FIX: render the SAME thing on both sides, then fill in after mounting
function Time() {
  const [time, setTime] = useState(null);
  useEffect(() =&gt; {
    setTime(new Date().toLocaleTimeString());    // client only
  }, []);
  // Server renders 'Loading...', client's first render matches, then
  // the effect swaps in the real value
  return &lt;p&gt;{time ?? 'Loading...'}&lt;/p&gt;;
}
// A reusable guard for anything that needs the browser
function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() =&gt; setIsClient(true), []);
  return isClient;
}
function WindowWidth() {
  const isClient = useIsClient();
  if (!isClient) return &lt;p&gt;Measuring...&lt;/p&gt;;
  return &lt;p&gt;{window.innerWidth}px&lt;/p&gt;;
}
// The escape hatch, for leaf nodes that genuinely cannot match:
//   &lt;time suppressHydrationWarning&gt;{new Date().toISOString()}&lt;/time&gt;
// WHAT STREAMING DOES NOT FIX: the data still takes as long to fetch, a
// slow query is still slow, and a huge bundle is still huge. Streaming
// improves PERCEIVED performance by showing something sooner.
</code></pre>
