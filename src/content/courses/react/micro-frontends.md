---
publishDate: 2026-05-30T10:27
title: Micro-frontends and Module Federation
slug: micro-frontends
metadescription: Split a large front end across independently deployed applications, and understand the real costs before you do.
updateDate: 2026-09-05T10:27
author: ['bishal-biswas']
level: 4
tags: ['architecture', 'scaling', 'module-federation']
course: react
---

## The problem they solve

A front end with forty engineers on it has organisational problems, not technical ones:

- One deploy pipeline, so everyone waits for everyone.
- A broken test in an unrelated area blocks your release.
- Nobody can upgrade a shared dependency without coordinating five teams.
- The build takes twenty minutes.

Micro-frontends let each team build, test and deploy their part independently.

## Be honest about the cost

Micro-frontends trade **organisational independence** for **technical complexity**. You will now deal with:

- Multiple React copies, unless you carefully share one.
- Duplicated dependencies inflating the total bundle.
- Version mismatches between teams.
- Cross application state and routing.
- Much harder debugging across boundaries.
- Inconsistent design unless a shared system is enforced.
- Complicated end to end testing.

**If you have fewer than three teams, you almost certainly do not need this.** A monorepo with clear module boundaries solves most of what people reach for micro-frontends to fix, without the runtime cost.

The honest summary: this is a solution to a people problem, and it should be adopted when the people problem is real.

## Approaches

### Route based

The simplest, and often enough.

```javascript
// example.com/shop    -> the shop application
// example.com/account -> the account application
// example.com/admin   -> the admin application
```

Each route is a separate deployment behind a reverse proxy or edge routing. Navigation between them is a full page load.

No shared runtime, no version conflicts, and no special tooling. The cost is a page reload when crossing a boundary, which is usually acceptable if boundaries are chosen well.

**Try this first.** Many teams adopt Module Federation when this would have been enough.

### Module Federation

Applications load each other's code at **runtime**.

```javascript
// webpack.config.js in the host
// new ModuleFederationPlugin({
//   name: 'host',
//   remotes: {
//     shop: 'shop@https://shop.example.com/remoteEntry.js'
//   },
//   shared: {
//     react: { singleton: true, requiredVersion: '^19.0.0' },
//     'react-dom': { singleton: true, requiredVersion: '^19.0.0' }
//   }
// })
```

```javascript
// webpack.config.js in the remote
// new ModuleFederationPlugin({
//   name: 'shop',
//   filename: 'remoteEntry.js',
//   exposes: { './ProductList': './src/ProductList.jsx' },
//   shared: {
//     react: { singleton: true },
//     'react-dom': { singleton: true }
//   }
// })
```

```javascript
import { lazy, Suspense } from 'react';
const ProductList = lazy(() => import('shop/ProductList'));
function App() {
  return (
    <ErrorBoundary fallback={<p>The shop is unavailable.</p>}>
      <Suspense fallback={<Spinner />}>
        <ProductList />
      </Suspense>
    </ErrorBoundary>
  );
}
```

**`singleton: true` on React is not optional.** Two copies of React produce the "invalid hook call" error, and hooks break in ways that are extremely confusing to debug.

The error boundary is also essential. A remote is a **network dependency at runtime**. If it is down, mid deploy, or returns a 404, your page must survive.

### Web Components

Wrap each application as a custom element, so the shell is framework agnostic.

```javascript
class ShopWidget extends HTMLElement {
  connectedCallback() {
    const root = createRoot(this);
    root.render(<Shop />);
  }
}
customElements.define('shop-widget', ShopWidget);
```

Good when teams use different frameworks. Awkward for passing complex data and for styling across the boundary.

## Sharing state

Keep it minimal. Shared mutable state across independently deployed applications recreates every problem you were trying to escape.

```javascript
const bus = new EventTarget();
export function publish(type, detail) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}
export function subscribe(type, handler) {
  bus.addEventListener(type, handler);
  return () => bus.removeEventListener(type, handler);
}
publish('user:signed-out', {});
```

Events, not shared objects. Each application owns its own state and announces what happened.

For genuinely global data such as the current user, the shell owns it and passes it down as props on the remote's entry component.

## Routing

The shell owns the URL, and each remote handles its own subtree.

```javascript
<Route path="/shop/*" element={<ShopRemote />} />
```

The remote must use a router configured with a basename, or it will fight the shell over the URL. Getting this wrong produces navigation that half works, which is a miserable class of bug.

## Versioning and contracts

Once applications load each other at runtime, the interface between them is a contract.

```javascript
// exposes: { './ProductList': './src/ProductList.jsx' }
```

Changing that component's props breaks the host **in production**, without a build failing anywhere. There is no compile step to catch it.

So you need:

- **A documented, versioned interface** for everything exposed.
- **Type definitions** shared between host and remote.
- **Integration tests** running against real remotes.
- **A rollback plan** for a bad remote deploy.

This is distributed systems work. Treat it that way.

## Ask first

Before adopting this, work through the questions:

1. Do you have at least three teams genuinely blocked by each other?
2. Have you tried a monorepo with clear boundaries?
3. Can you enforce a shared design system across teams?
4. Do you have the operational maturity for runtime dependencies?
5. Is the deploy coupling actually the bottleneck, or is it your test suite?

If the honest answer to any of the first two is no, fix that first.

## Quick recap

- Micro-frontends solve organisational coupling, not technical problems.
- The cost is real: duplicate dependencies, version drift, harder debugging.
- Route based splitting is the simplest approach, and often enough.
- Module Federation loads code at runtime, and needs `singleton: true` for React.
- Always wrap a remote in an error boundary, since it is a network dependency.
- Share events, not mutable state.
- The shell owns routing, and remotes need a basename.
- Exposed modules are a versioned contract with no compile time safety.

<code id="code-content" class="language-javascript">
import { lazy, Suspense } from 'react';
// ---------- The host loads a remote at RUNTIME ----------
// webpack.config.js:
// new ModuleFederationPlugin({
//   name: 'host',
//   remotes: { shop: 'shop@https://shop.example.com/remoteEntry.js' },
//   shared: {
//     // singleton: true is NOT optional. Two copies of React produce
//     // the "invalid hook call" error and break hooks in ways that are
//     // extremely hard to debug.
//     react: { singleton: true, requiredVersion: '^19.0.0' },
//     'react-dom': { singleton: true, requiredVersion: '^19.0.0' }
//   }
// })
const ProductList = lazy(() =&gt; import('shop/ProductList'));
export default function App({ user }) {
  return (
    // The error boundary is ESSENTIAL. A remote is a network dependency
    // at runtime: it can be down, mid deploy, or return a 404.
    &lt;ErrorBoundary fallback={&lt;p&gt;The shop is unavailable right now.&lt;/p&gt;}&gt;
      &lt;Suspense fallback={&lt;p&gt;Loading shop...&lt;/p&gt;}&gt;
        {/* Genuinely global data is owned by the shell and passed down */}
        &lt;ProductList user={user} /&gt;
      &lt;/Suspense&gt;
    &lt;/ErrorBoundary&gt;
  );
}
// SHARE EVENTS, NOT MUTABLE STATE. Shared objects across independently
// deployed apps recreate every problem you were escaping.
const bus = new EventTarget();
export function publish(type, detail) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}
export function subscribe(type, handler) {
  bus.addEventListener(type, handler);
  return () =&gt; bus.removeEventListener(type, handler);
}
// publish('user:signed-out', {});
// ROUTING: the shell owns the URL, the remote handles its subtree and
// MUST be configured with a basename, or the two fight over the URL.
//   &lt;Route path="/shop/*" element={&lt;ShopRemote /&gt;} /&gt;
//   createBrowserRouter(routes, { basename: '/shop' })
// TRY ROUTE BASED SPLITTING FIRST. Separate deployments behind a proxy:
//   example.com/shop     -&gt; the shop app
//   example.com/account  -&gt; the account app
// No shared runtime, no version conflicts, no special tooling. The cost
// is a page reload when crossing a boundary. Many teams adopt Module
// Federation when this would have been enough.
// AND ASK FIRST: do you have three teams genuinely blocked by each
// other, and have you tried a monorepo with clear boundaries? If not,
// this is complexity without a matching problem.
</code></pre>
