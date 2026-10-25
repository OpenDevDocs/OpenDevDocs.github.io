---
publishDate: 2026-05-16T09:46
title: Stylesheets, Async Scripts and Resource Preloading
slug: stylesheets-and-resource-preloading
metadescription: React 19 manages stylesheets and scripts as first class resources, and gives you APIs to start loading things early.
updateDate: 2026-09-05T09:46
author: ['bishal-biswas']
level: 2
tags: ['performance', 'react-19', 'resources']
course: react
---

## Stylesheets as components

React 19 lets you declare a stylesheet where it is used, and handles ordering and deduplication.

```javascript
function ProductCard({ product }) {
  return (
    <>
      <link rel="stylesheet" href="/styles/card.css" precedence="default" />
      <div className="card">{product.name}</div>
    </>
  );
}
```

React hoists it into the head, loads it once no matter how many components declare it, and **waits for it to load before showing the content**. No flash of unstyled text.

## Precedence controls order

CSS order decides which rules win, so React needs to know how to sort the stylesheets it hoists.

```javascript
<link rel="stylesheet" href="/reset.css" precedence="reset" />
<link rel="stylesheet" href="/base.css" precedence="default" />
<link rel="stylesheet" href="/overrides.css" precedence="high" />
```

React keeps them in the order the precedence values first appear. Pick a small set of names such as `reset`, `default` and `high`, and use them consistently.

```javascript
<link rel="stylesheet" href="/styles/card.css" />
```

Without `precedence`, React leaves it alone and treats it as a plain element.

## Async scripts

```javascript
function Analytics() {
  return (
    <>
      <script async src="https://example.com/analytics.js" />
      <div>Page content</div>
    </>
  );
}
```

An `async` script gets hoisted and deduplicated too. Render `Analytics` in five places and the script loads once.

Only `async` scripts are handled this way. A blocking script is left where you put it.

## Preloading

Four functions from `react-dom` let you start work before it is needed.

```javascript
import { preload, preinit, prefetchDNS, preconnect } from 'react-dom';
```

### `preload`

Download a resource now, use it later.

```javascript
function ProductPage({ product }) {
  preload(product.heroImage, { as: 'image' });
  preload('/fonts/heading.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  return <div>...</div>;
}
```

Fonts are the classic case. A font referenced only from a CSS file is not discovered until the CSS has been parsed, which delays it badly. Preloading starts it immediately.

### `preinit`

Download **and execute** a script, or download and apply a stylesheet.

```javascript
function Checkout() {
  preinit('https://js.stripe.com/v3/', { as: 'script' });
  return <div>...</div>;
}
```

Use `preinit` when you know you will need it. Use `preload` when you might.

### `prefetchDNS` and `preconnect`

```javascript
prefetchDNS('https://api.example.com');
preconnect('https://cdn.example.com');
```

`prefetchDNS` resolves the domain name early. `preconnect` goes further and opens the TCP and TLS connection.

Connecting to a new origin costs a few hundred milliseconds on a mobile network, so doing it in advance is a real saving. Use `preconnect` for a handful of critical origins only, since each open connection has a cost.

### Preloading on interaction

```javascript
function ProductLink({ product }) {
  function handleHover() {
    preload(product.image, { as: 'image' });
    preload(`/api/products/${product.id}`, { as: 'fetch' });
  }
  return (
    <Link to={`/products/${product.id}`} onMouseEnter={handleHover}>
      {product.name}
    </Link>
  );
}
```

Hovering usually precedes clicking by a few hundred milliseconds. Starting the work on hover makes the navigation feel instant.

## Where to call them

These are not hooks, so there is no dependency array and no rules to follow. Call them during render, in an event handler, or at module scope.

```javascript
preconnect('https://api.example.com');
function App() {
  return <div>...</div>;
}
```

Module scope is good for connections you always need. Calling them repeatedly is safe, because React deduplicates.

## Do not overdo it

Preloading is a hint about **priority**, not free speed. The network has finite bandwidth.

```javascript
products.forEach((p) => preload(p.image, { as: 'image' }));
```

Preloading fifty images makes the important ones slower, because they compete. Preload the few things that block the first meaningful paint: the hero image, the main font, one critical script. Let everything else load normally.

Also note the browser console will warn about a preloaded resource that goes unused within a few seconds, which is a useful check on whether you actually needed it.

## Lazy loading images

Often the better default is the opposite.

```javascript
<img src={product.image} alt={product.name} loading="lazy" width={400} height={300} />
```

`loading="lazy"` skips images that are off screen entirely. Always set `width` and `height` so the space is reserved and the layout does not shift.

Preload what is above the fold, lazy load everything else.

## Quick recap

- `<link rel="stylesheet" precedence>` is hoisted, deduplicated and awaited.
- Precedence names decide the order in which stylesheets are applied.
- Async scripts are hoisted and deduplicated the same way.
- `preload` downloads early, `preinit` downloads and runs.
- `prefetchDNS` and `preconnect` warm up connections to other origins.
- Preloading on hover makes navigation feel instant.
- These are not hooks, so call them anywhere and as often as you like.
- Preload only what blocks first paint, and lazy load the rest.

<code id="code-content" class="language-javascript">
import { preload, preinit, preconnect, prefetchDNS } from 'react-dom';
// Module scope is right for connections you always need. Doing the DNS
// and TLS handshake early saves a few hundred ms on mobile.
preconnect('https://api.example.com');
prefetchDNS('https://cdn.example.com');
// REACT 19: declare a stylesheet where it is used. React hoists it,
// loads it ONCE however many components declare it, and waits for it
// before showing the content, so there is no flash of unstyled text.
function ProductCard({ product }) {
  return (
    &lt;&gt;
      &lt;link rel="stylesheet" href="/styles/card.css" precedence="default" /&gt;
      &lt;div className="card"&gt;{product.name}&lt;/div&gt;
    &lt;/&gt;
  );
}
// precedence decides the ORDER, which decides which CSS rules win.
// Pick a small set of names and use them consistently.
function Layout({ children }) {
  return (
    &lt;&gt;
      &lt;link rel="stylesheet" href="/reset.css" precedence="reset" /&gt;
      &lt;link rel="stylesheet" href="/base.css" precedence="default" /&gt;
      &lt;link rel="stylesheet" href="/theme.css" precedence="high" /&gt;
      {/* An async script is hoisted and deduplicated too */}
      &lt;script async src="https://example.com/analytics.js" /&gt;
      {children}
    &lt;/&gt;
  );
}
export default function ProductPage({ product }) {
  // preload: download now, use later. Fonts benefit most, because a font
  // referenced only from CSS is not discovered until the CSS is parsed.
  preload(product.heroImage, { as: 'image' });
  preload('/fonts/heading.woff2', {
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous'
  });
  // preinit: download AND run. Use it when you know you will need it.
  preinit('https://js.stripe.com/v3/', { as: 'script' });
  return (
    &lt;div&gt;
      &lt;img src={product.heroImage} alt={product.name} width={1200} height={600} /&gt;
      {/* Everything below the fold: lazy load it, and always set
          width and height so the layout does not shift */}
      {product.gallery.map((image) =&gt; (
        &lt;img key={image.id} src={image.url} alt="" loading="lazy"
             width={400} height={300} /&gt;
      ))}
    &lt;/div&gt;
  );
}
// Preloading on hover makes navigation feel instant, because hovering
// usually precedes clicking by a few hundred milliseconds
function ProductLink({ product }) {
  function handleHover() {
    preload(product.image, { as: 'image' });
    preload('/api/products/' + product.id, { as: 'fetch' });
  }
  return &lt;a href={'/products/' + product.id} onMouseEnter={handleHover}&gt;
    {product.name}
  &lt;/a&gt;;
}
// DO NOT preload everything. Bandwidth is finite, so fifty preloads make
// the important ones slower. Preload only what blocks the first paint.
</code></pre>
