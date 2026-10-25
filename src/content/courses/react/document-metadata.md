---
publishDate: 2026-05-16T09:45
title: 'Document Metadata: title, meta and link'
slug: document-metadata
metadescription: React 19 hoists title, meta and link tags to the head automatically, so you no longer need a helmet library.
updateDate: 2026-09-05T09:45
author: ['bishal-biswas']
level: 2
tags: ['seo', 'react-19', 'metadata']
course: react
---

## The old problem

Every page needs its own title and description. React used to have no answer, so you either wrote an effect:

```javascript
function ProductPage({ product }) {
  useEffect(() => {
    document.title = `${product.name} - My Shop`;
    return () => {
      document.title = 'My Shop';
    };
  }, [product.name]);
}
```

or installed `react-helmet`:

```javascript
import { Helmet } from 'react-helmet-async';
function ProductPage({ product }) {
  return (
    <>
      <Helmet>
        <title>{product.name}</title>
        <meta name="description" content={product.summary} />
      </Helmet>
      <h1>{product.name}</h1>
    </>
  );
}
```

Both work. The effect version does not run on the server, so crawlers see the wrong title. The helmet version is an extra dependency to keep in step with React.

## React 19 does it natively

Render `<title>`, `<meta>` and `<link>` anywhere, and React moves them into `<head>`.

```javascript
function ProductPage({ product }) {
  return (
    <div>
      <title>{product.name} - My Shop</title>
      <meta name="description" content={product.summary} />
      <link rel="canonical" href={`https://myshop.com/products/${product.slug}`} />
      <h1>{product.name}</h1>
      <p>{product.summary}</p>
    </div>
  );
}
```

They appear in the document head even though you wrote them in the middle of the body. No library, no effect, and it works during server rendering.

## Social sharing tags

```javascript
function ArticlePage({ article }) {
  const url = `https://myblog.com/${article.slug}`;
  return (
    <article>
      <title>{article.title}</title>
      <meta name="description" content={article.excerpt} />
      <meta property="og:title" content={article.title} />
      <meta property="og:description" content={article.excerpt} />
      <meta property="og:image" content={article.coverImage} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="article" />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="canonical" href={url} />
      <h1>{article.title}</h1>
    </article>
  );
}
```

These control what appears when someone shares your link. Getting `og:image` right is the difference between a rich preview card and a bare URL.

## Duplicates

There is one rule to understand.

- **`<title>` is deduplicated.** The one nearest the top of the tree wins, so a page can override a layout default.
- **`<meta>` is not.** Render two description tags and both end up in the head.

So do not put a default description in a layout and another in the page. Compute one value and render it once:

```javascript
function Page({ article }) {
  const description = article?.excerpt ?? 'Default site description';
  return (
    <>
      <title>{article?.title ?? 'My Site'}</title>
      <meta name="description" content={description} />
    </>
  );
}
```

For fixed tags such as `charset`, `viewport` and the favicon, leave them in `index.html`. They never change, so React does not need to manage them.

## A metadata component

```javascript
function Meta({ title, description, image, url, type = 'website' }) {
  const fullTitle = title ? `${title} - My Site` : 'My Site';
  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      {image && <meta property="og:image" content={image} />}
      {url && <link rel="canonical" href={url} />}
    </>
  );
}
```

```javascript
function ProductPage({ product }) {
  return (
    <div>
      <Meta
        title={product.name}
        description={product.summary}
        image={product.image}
        url={`https://myshop.com/products/${product.slug}`}
      />
      <h1>{product.name}</h1>
    </div>
  );
}
```

One place defines the format, every page supplies the values.

## Structured data

```javascript
function ProductSchema({ product }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.summary,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'INR'
    }
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

This is what produces rich results in search listings, such as prices and ratings.

Note `dangerouslySetInnerHTML`. That is safe here because you built the object yourself, but never put user supplied text into it without escaping.

## Client rendering is still a limitation

React 19 removes the need for a library, but it does not make a client rendered app crawlable.

With plain Vite, the initial HTML has an empty `<div id="root">`. React sets the title after JavaScript runs. Modern Google usually executes JavaScript and will see it, but other crawlers and social preview scrapers often do not, so your shared links get the fallback title.

**If SEO or link previews matter, you need server rendering.** That means a framework. This feature makes metadata pleasant to write in both cases, but it does not replace SSR.

## Quick recap

- React 19 hoists `<title>`, `<meta>` and `<link>` into the head automatically.
- No helmet library and no effect, and it works during server rendering.
- `<title>` is deduplicated, `<meta>` is not, so render each meta tag once.
- Keep fixed tags like charset and viewport in `index.html`.
- Wrap the format in one `Meta` component and pass values per page.
- Structured data goes in a JSON-LD script tag.
- Native metadata still does not make a client rendered app crawlable.

<code id="code-content" class="language-javascript">
// REACT 19: render these anywhere and React moves them into &lt;head&gt;.
// No react-helmet, no useEffect, and it works on the server too.
function Meta({ title, description, image, url, type = 'website' }) {
  const fullTitle = title ? title + ' - My Site' : 'My Site';
  return (
    &lt;&gt;
      {/* &lt;title&gt; IS deduplicated: the one nearest the top wins, so a
          page can override a layout default */}
      &lt;title&gt;{fullTitle}&lt;/title&gt;
      {/* &lt;meta&gt; is NOT deduplicated. Render each one exactly once, or
          you get two description tags in the head. */}
      &lt;meta name="description" content={description} /&gt;
      &lt;meta property="og:title" content={fullTitle} /&gt;
      &lt;meta property="og:description" content={description} /&gt;
      &lt;meta property="og:type" content={type} /&gt;
      {image &amp;&amp; &lt;meta property="og:image" content={image} /&gt;}
      &lt;meta name="twitter:card" content="summary_large_image" /&gt;
      {url &amp;&amp; &lt;link rel="canonical" href={url} /&gt;}
    &lt;/&gt;
  );
}
// Structured data produces rich search results, such as prices
function ProductSchema({ product }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.summary,
    offers: { '@type': 'Offer', price: product.price, priceCurrency: 'INR' }
  };
  return (
    &lt;script
      type="application/ld+json"
      // Safe here because we built the object ourselves. Never put
      // unescaped user text into dangerouslySetInnerHTML.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    /&gt;
  );
}
export default function ProductPage({ product }) {
  const url = 'https://myshop.com/products/' + product.slug;
  return (
    &lt;div&gt;
      {/* Written in the middle of the body, hoisted to the head */}
      &lt;Meta
        title={product.name}
        description={product.summary}
        image={product.image}
        url={url}
        type="product"
      /&gt;
      &lt;ProductSchema product={product} /&gt;
      &lt;h1&gt;{product.name}&lt;/h1&gt;
      &lt;p&gt;{product.summary}&lt;/p&gt;
    &lt;/div&gt;
  );
}
// Leave the tags that never change in index.html:
//   &lt;meta charset="UTF-8"&gt;
//   &lt;meta name="viewport" content="width=device-width, initial-scale=1"&gt;
//   &lt;link rel="icon" href="/favicon.svg"&gt;
// AND REMEMBER: this makes metadata pleasant to write, but a client
// rendered app still ships an empty page first. If SEO or link previews
// matter, you need server rendering, which means a framework.
</code></pre>
