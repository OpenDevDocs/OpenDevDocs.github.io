---
publishDate: 2026-05-17T09:47
title: 'React Server Components: The Mental Model'
slug: react-server-components
metadescription: Understand what Server Components are, what they change, and why they are not just server rendering with a new name.
updateDate: 2026-09-05T09:47
author: ['bishal-biswas']
level: 3
tags: ['rsc', 'server', 'architecture']
course: react
---

## The idea

A Server Component runs **only on the server**. Its code is never sent to the browser.

```javascript
async function ProductList() {
  const products = await db.products.findMany();
  return (
    <ul>
      {products.map((p) => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

Three things worth noticing:

- It is `async`, and awaits directly in the component body.
- It queries the database with no API layer in between.
- Neither the database client nor this component's code reaches the browser.

## Not the same as server rendering

This confuses everyone at first, because both involve a server.

**Traditional SSR** renders your components to HTML on the server, sends that HTML, then sends the same components as JavaScript so the browser can hydrate them. Every component ships twice: once as HTML, once as code.

**Server Components** never ship as code at all. The server sends a description of the rendered output, and the browser has nothing to hydrate for those parts.

The practical consequence is bundle size. A component using a 100KB markdown parser costs your users nothing if it runs on the server.

## What you gain

**A smaller bundle.** Dependencies used only on the server stay there.

**Direct data access.** No `/api/products` endpoint, no fetch, no serialising, no loading state. Just query and render.

**No waterfalls.** Data loads while the component renders on the server, which is close to the database.

**Secrets stay secret.** API keys and database URLs are never in the browser.

## What you give up

Server Components cannot do anything interactive.

```javascript
async function Broken() {
  const [count, setCount] = useState(0);
  useEffect(() => {}, []);
  return <button onClick={() => setCount(count + 1)}>Click</button>;
}
```

No state, no effects, no event handlers, no browser APIs, no refs. They render once and produce output.

## Client Components

For interactivity, mark a file with `'use client'`.

```javascript
'use client';
import { useState } from 'react';
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

This is what you have been writing all along. The directive marks the **boundary** where the client bundle begins.

Everything imported by a Client Component also becomes client code. That is why the boundary should be as low in the tree as possible.

## Composing them

Server Components can render Client Components. The reverse needs care.

```javascript
async function ProductPage({ id }) {
  const product = await db.products.findUnique({ where: { id } });
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <AddToCartButton productId={product.id} />
    </div>
  );
}
```

```javascript
'use client';
export function AddToCartButton({ productId }) {
  const [isAdding, setIsAdding] = useState(false);
  return <button onClick={() => setIsAdding(true)}>Add to cart</button>;
}
```

The heavy content renders on the server. Only the small interactive button ships as JavaScript.

**Push the boundary down.** A common mistake is putting `'use client'` at the top of a page, which drags the entire subtree into the bundle. Mark only the interactive leaves.

### Passing children through

A Client Component cannot **import** a Server Component, but it can receive one as a child.

```javascript
'use client';
export function Accordion({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      {isOpen && children}
    </div>
  );
}
```

```javascript
async function Page() {
  return (
    <Accordion>
      <ServerRenderedContent />
    </Accordion>
  );
}
```

`ServerRenderedContent` still runs on the server. The accordion just receives the finished output and decides whether to show it. This pattern keeps interactive wrappers from pulling their contents into the bundle.

## Props must be serialisable

Everything crossing the boundary is serialised.

```javascript
<ClientComponent
  title="Hello"
  count={42}
  items={[1, 2, 3]}
  onSave={() => {}}
  date={new Date()}
/>
```

Strings, numbers, booleans, arrays, plain objects, dates, promises and Server Functions all cross fine. **Plain functions and class instances do not.**

If you need a callback, define it inside the Client Component or use a Server Function.

## What runs where

| | Server Component | Client Component |
| --- | --- | --- |
| `useState`, `useEffect` | No | Yes |
| Event handlers | No | Yes |
| `async`/`await` in the body | Yes | No |
| Database access | Yes | No |
| Browser APIs | No | Yes |
| Ships to the browser | No | Yes |
| Default in a framework | Yes | Opt in |

## You need a framework

Server Components are not something you switch on in a Vite app. They require a bundler and server integration that understands the boundary and can stream the result.

In practice that means Next.js App Router, or another framework with RSC support. React provides the primitives, the framework provides the plumbing.

## Should you use them?

**Yes** for content heavy sites: blogs, documentation, shops, marketing pages. Most of the page is static content that has no business shipping as JavaScript.

**Probably not** for a highly interactive app behind a login, such as a dashboard or an editor. Nearly everything is a Client Component anyway, so you add complexity for little gain.

**Not yet** if you are still learning React. Understand state, effects and composition first. The boundary rules make much more sense once you know what you are dividing.

## Quick recap

- Server Components run only on the server and never ship as JavaScript.
- They differ from SSR, which sends components as both HTML and code.
- No state, effects, handlers or browser APIs.
- `'use client'` marks where the browser bundle starts.
- Push the boundary as low as possible.
- A Client Component can receive Server Components as children.
- Props crossing the boundary must be serialisable.
- They need a framework, and suit content heavy sites most.

<code id="code-content" class="language-javascript">
// ---------- app/products/page.jsx : a SERVER component ----------
// No 'use client', so this runs only on the server. Its code, and the
// database client it imports, never reach the browser.
import { db } from '@/lib/db';
import { AddToCartButton } from './AddToCartButton.jsx';
import { Accordion } from './Accordion.jsx';
export default async function ProductPage({ params }) {
  // Query the database directly. No API route, no fetch, no loading
  // state, and the connection string stays on the server.
  const product = await db.products.findUnique({ where: { id: params.id } });
  const reviews = await db.reviews.findMany({ where: { productId: params.id } });
  return (
    &lt;div&gt;
      &lt;h1&gt;{product.name}&lt;/h1&gt;
      &lt;p&gt;{product.description}&lt;/p&gt;
      {/* Only this small interactive leaf ships as JavaScript */}
      &lt;AddToCartButton productId={product.id} price={product.price} /&gt;
      {/* A client wrapper can RECEIVE server rendered children without
          pulling them into the bundle */}
      &lt;Accordion&gt;
        &lt;ReviewList reviews={reviews} /&gt;
      &lt;/Accordion&gt;
    &lt;/div&gt;
  );
}
// Still a server component: renders on the server, ships no code
function ReviewList({ reviews }) {
  return &lt;ul&gt;{reviews.map((r) =&gt; &lt;li key={r.id}&gt;{r.text}&lt;/li&gt;)}&lt;/ul&gt;;
}
// ---------- AddToCartButton.jsx : a CLIENT component ----------
// 'use client' marks where the browser bundle BEGINS. Everything this
// file imports becomes client code too, so keep the boundary low.
// 'use client';
// import { useState } from 'react';
// export function AddToCartButton({ productId, price }) {
//   const [isAdding, setIsAdding] = useState(false);
//   return (
//     &lt;button onClick={() =&gt; setIsAdding(true)} disabled={isAdding}&gt;
//       {isAdding ? 'Adding...' : 'Add to cart - Rs ' + price}
//     &lt;/button&gt;
//   );
// }
// ---------- Accordion.jsx : a CLIENT component with children ----------
// 'use client';
// export function Accordion({ children }) {
//   const [isOpen, setIsOpen] = useState(false);
//   return (
//     &lt;div&gt;
//       &lt;button onClick={() =&gt; setIsOpen(!isOpen)}&gt;Reviews&lt;/button&gt;
//       {isOpen &amp;&amp; children}     children were rendered ON THE SERVER
//     &lt;/div&gt;
//   );
// }
// PROPS CROSSING THE BOUNDARY MUST SERIALISE.
// Fine:  strings, numbers, booleans, arrays, plain objects, dates,
//        promises, and Server Functions.
// Not:   plain functions and class instances.
//   &lt;ClientThing onSave={() =&gt; save()} /&gt;    fails
</code></pre>
