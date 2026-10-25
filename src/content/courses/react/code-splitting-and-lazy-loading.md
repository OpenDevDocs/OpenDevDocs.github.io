---
publishDate: 2026-05-21T10:00
title: Code Splitting with lazy and Suspense
slug: code-splitting-and-lazy-loading
metadescription: Ship less JavaScript on first load by splitting your bundle by route and by feature, and loading the rest on demand.
updateDate: 2026-09-05T10:00
author: ['bishal-biswas']
level: 3
tags: ['performance', 'bundling', 'suspense']
course: react
---

## The problem

By default every component ends up in one bundle. Visit the home page and you download the checkout flow, the admin panel, the chart library and the rich text editor, none of which you are using.

On a fast laptop this is invisible. On a mid range phone on mobile data it is seconds of blank screen.

## `lazy`

```javascript
import { lazy, Suspense } from 'react';
const Dashboard = lazy(() => import('./Dashboard.jsx'));
function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Dashboard />
    </Suspense>
  );
}
```

`lazy` takes a function returning a dynamic `import()`. The bundler puts that module in a separate chunk, downloaded only when the component first renders.

The `Suspense` boundary is required, since there is a moment where the code has not arrived.

## Default exports

```javascript
export default function Dashboard() {}
const Dashboard = lazy(() => import('./Dashboard.jsx'));
```

`lazy` expects a **default export**. For a named one:

```javascript
export function Dashboard() {}
const Dashboard = lazy(() =>
  import('./Dashboard.jsx').then((module) => ({ default: module.Dashboard }))
);
```

## Split by route first

This is where the biggest win is, because a user only ever sees one route at a time.

```javascript
import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
const Home = lazy(() => import('./pages/Home.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const router = createBrowserRouter([
  {
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <RootLayout />
      </Suspense>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'products', element: <Products /> },
      { path: 'checkout', element: <Checkout /> },
      { path: 'admin', element: <Admin /> }
    ]
  }
]);
```

The admin panel now costs nothing to visitors who never open it.

Note the single Suspense boundary in the layout, so every route shares one fallback.

## Split heavy features

```javascript
const RichTextEditor = lazy(() => import('./RichTextEditor.jsx'));
const Chart = lazy(() => import('./Chart.jsx'));
function ArticlePage() {
  const [isEditing, setIsEditing] = useState(false);
  return (
    <div>
      <article>...</article>
      <button onClick={() => setIsEditing(true)}>Edit</button>
      {isEditing && (
        <Suspense fallback={<p>Loading editor...</p>}>
          <RichTextEditor />
        </Suspense>
      )}
    </div>
  );
}
```

Editors, charting libraries, date pickers, PDF viewers and map components are all large and often used by a minority of visitors.

## Preloading on hover

Lazy loading trades bundle size for a delay when the component is needed. Preloading removes most of that delay.

```javascript
const Checkout = lazy(() => import('./Checkout.jsx'));
function CheckoutLink() {
  function preload() {
    import('./Checkout.jsx');
  }
  return (
    <Link to="/checkout" onMouseEnter={preload} onFocus={preload}>
      Checkout
    </Link>
  );
}
```

Calling `import()` starts the download. By the time the user clicks, the chunk is usually already there. `onFocus` covers keyboard users.

You can also preload after the page settles:

```javascript
useEffect(() => {
  const id = setTimeout(() => {
    import('./Checkout.jsx');
  }, 2000);
  return () => clearTimeout(id);
}, []);
```

The initial load stays small, and the likely next step is ready before it is asked for.

## Handling failures

A chunk request can fail on a flaky network, or after a deploy replaced the file.

```javascript
<ErrorBoundary
  fallback={
    <div>
      <p>Could not load this section.</p>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  }
>
  <Suspense fallback={<Spinner />}>
    <Dashboard />
  </Suspense>
</ErrorBoundary>
```

The stale chunk case is worth knowing. A user with the page open when you deploy may request a filename that no longer exists. Reloading fixes it, so make the fallback offer that.

## Do not over split

```javascript
const Button = lazy(() => import('./Button.jsx'));
const Icon = lazy(() => import('./Icon.jsx'));
```

Every chunk is a separate request with its own overhead. Splitting a 2KB button costs more than it saves, and a page assembling itself from thirty tiny chunks feels worse than one that arrives at once.

Split things that are **large**, **optional**, or **route specific**. Leave small shared components in the main bundle.

## Measuring

```bash
npm run build
```

The build output lists every chunk and its size. Look for anything unexpectedly large.

For detail, use a visualiser:

```bash
npm install --save-dev rollup-plugin-visualizer
```

That draws a treemap of what is in each chunk. It is often surprising: a date library imported for one function, or an icon set where you use four icons.

## Server Components go further

With Server Components, the code stays on the server entirely.

```javascript
import { marked } from 'marked';
export default async function Article({ slug }) {
  const post = await getPost(slug);
  return <div dangerouslySetInnerHTML={{ __html: marked(post.body) }} />;
}
```

`marked` never reaches the browser at all. That beats lazy loading it, because the best chunk is the one you never send.

## Quick recap

- One bundle means users download code for pages they never visit.
- `lazy` plus a dynamic import creates a separate chunk.
- It needs a `Suspense` boundary and a default export.
- Split by route first, then by heavy optional features.
- Preload on hover or focus so the delay disappears.
- Wrap lazy sections in an error boundary offering a reload.
- Do not split small components, since each chunk has overhead.
- Server Components remove code from the bundle entirely.

<code id="code-content" class="language-javascript">
import { lazy, Suspense, useState, useEffect } from 'react';
// lazy takes a function returning a dynamic import. The bundler puts
// that module in its own chunk, fetched only when first rendered.
const Dashboard = lazy(() =&gt; import('./pages/Dashboard.jsx'));
const Admin = lazy(() =&gt; import('./pages/Admin.jsx'));
const RichTextEditor = lazy(() =&gt; import('./RichTextEditor.jsx'));
// For a NAMED export, map it to default yourself:
const Chart = lazy(() =&gt;
  import('./Chart.jsx').then((module) =&gt; ({ default: module.Chart }))
);
export default function ArticlePage() {
  const [isEditing, setIsEditing] = useState(false);
  // Preload after the page settles, so the likely next step is ready
  // before the user asks for it
  useEffect(() =&gt; {
    const id = setTimeout(() =&gt; import('./RichTextEditor.jsx'), 2000);
    return () =&gt; clearTimeout(id);
  }, []);
  // Preload on hover AND focus, so keyboard users benefit too
  function preloadEditor() {
    import('./RichTextEditor.jsx');
  }
  return (
    &lt;div&gt;
      &lt;article&gt;The article content&lt;/article&gt;
      &lt;button onMouseEnter={preloadEditor} onFocus={preloadEditor}
              onClick={() =&gt; setIsEditing(true)}&gt;
        Edit
      &lt;/button&gt;
      {/* An error boundary matters here: a chunk can fail on a flaky
          network, or after a deploy replaced the file. Offer a reload. */}
      &lt;ErrorBoundary
        fallback={
          &lt;div&gt;
            &lt;p&gt;Could not load the editor.&lt;/p&gt;
            &lt;button onClick={() =&gt; window.location.reload()}&gt;Reload&lt;/button&gt;
          &lt;/div&gt;
        }
      &gt;
        {isEditing &amp;&amp; (
          &lt;Suspense fallback={&lt;p&gt;Loading editor...&lt;/p&gt;}&gt;
            &lt;RichTextEditor /&gt;
          &lt;/Suspense&gt;
        )}
      &lt;/ErrorBoundary&gt;
    &lt;/div&gt;
  );
}
// SPLIT BY ROUTE FIRST. A visitor only ever sees one route, so the admin
// panel should cost nothing to everyone who never opens it.
// const router = createBrowserRouter([
//   {
//     element: (
//       &lt;Suspense fallback={&lt;PageSkeleton /&gt;}&gt;
//         &lt;RootLayout /&gt;        one shared fallback for every route
//       &lt;/Suspense&gt;
//     ),
//     children: [
//       { index: true, element: &lt;Home /&gt; },
//       { path: 'admin', element: &lt;Admin /&gt; }
//     ]
//   }
// ]);
// DO NOT OVER SPLIT. Every chunk is a request with its own overhead, so
// splitting a 2KB button costs more than it saves. Split things that are
// large, optional, or route specific.
// AND REMEMBER: with a Server Component the code never ships at all,
// which beats lazy loading it.
</code></pre>
