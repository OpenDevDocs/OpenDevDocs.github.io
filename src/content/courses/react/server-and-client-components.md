---
publishDate: 2026-05-17T09:48
title: Server and Client Components with use client
slug: server-and-client-components
metadescription: Place the use client boundary correctly, keep your bundle small, and avoid the mistakes that drag whole pages into the browser.
updateDate: 2026-09-05T09:48
author: ['bishal-biswas']
level: 3
tags: ['rsc', 'architecture', 'performance']
course: react
---

## The directive

```javascript
'use client';
import { useState } from 'react';
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

It must be the **first line** of the file, before any imports.

It marks a boundary, not a single component. Everything this file imports, and everything they import, becomes part of the client bundle.

## Why placement matters so much

```javascript
'use client';
import { useState } from 'react';
import { marked } from 'marked';
import { formatDistance } from 'date-fns';
export default function ArticlePage({ article }) {
  const [showComments, setShowComments] = useState(false);
  return (
    <div>
      <h1>{article.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: marked(article.body) }} />
      <p>{formatDistance(article.date, new Date())}</p>
      <button onClick={() => setShowComments(!showComments)}>Comments</button>
      {showComments && <Comments comments={article.comments} />}
    </div>
  );
}
```

One `useState` for a toggle has just shipped the markdown parser and the date library to every visitor.

Split it:

```javascript
import { marked } from 'marked';
import { formatDistance } from 'date-fns';
import { CommentsToggle } from './CommentsToggle.jsx';
export default function ArticlePage({ article }) {
  return (
    <div>
      <h1>{article.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: marked(article.body) }} />
      <p>{formatDistance(article.date, new Date())}</p>
      <CommentsToggle>
        <Comments comments={article.comments} />
      </CommentsToggle>
    </div>
  );
}
```

```javascript
'use client';
import { useState } from 'react';
export function CommentsToggle({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Comments</button>
      {isOpen && children}
    </div>
  );
}
```

The client bundle is now one button. The markdown parsing, the date formatting and the comments all happen on the server.

**Push the boundary down to the leaves.**

## The children escape hatch

The pattern above is worth understanding properly.

A Client Component cannot **import** a Server Component. But it can **receive** one as a prop, because by then it is already rendered output rather than code.

```javascript
'use client';
import ServerThing from './ServerThing.jsx';
export function Wrapper() {
  return <ServerThing />;
}
```

```javascript
'use client';
export function Wrapper({ children }) {
  return <div className="wrapper">{children}</div>;
}
```

```javascript
export default function Page() {
  return (
    <Wrapper>
      <ServerThing />
    </Wrapper>
  );
}
```

The element is created in a Server Component, so `ServerThing` runs on the server. `Wrapper` just places it.

This works for any prop, not only `children`:

```javascript
<Layout sidebar={<ServerSidebar />} content={<ServerContent />} />
```

## Providers are the common case

Context providers need state, so they are Client Components. Wrapping your whole app in one does **not** make everything a Client Component, as long as you use children.

```javascript
'use client';
import { createContext, useState } from 'react';
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}
```

```javascript
import { ThemeProvider } from './ThemeProvider.jsx';
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

`children` is still server rendered. Only the provider itself is client code.

Note the flip side: a Server Component **cannot read that context**. Context only exists on the client. Pass values as props instead.

## What forces a Client Component

- `useState`, `useReducer`, `useEffect`, and most hooks.
- Event handlers: `onClick`, `onChange`, `onSubmit`.
- Browser APIs: `window`, `document`, `localStorage`.
- Refs on DOM elements.
- Context, both providing and consuming.
- Class components.
- Most third party UI libraries.

If none of those apply, leave it as a Server Component.

## Third party components

Many libraries have not added the directive yet.

```javascript
import { Carousel } from 'some-ui-library';
export default function Page() {
  return <Carousel />;
}
```

If it uses hooks internally and has no `'use client'`, this fails. Wrap it:

```javascript
'use client';
export { Carousel } from 'some-ui-library';
```

```javascript
import { Carousel } from './client-carousel.js';
```

Your one line file provides the boundary the library is missing.

## Keeping server code out of the browser

```bash
npm install server-only
```

```javascript
import 'server-only';
export async function getSecretData() {
  return db.query('SELECT * FROM secrets');
}
```

If a Client Component ever imports this file, the **build fails** with a clear message. That is far better than shipping your database credentials and finding out later.

There is a matching `client-only` package for the opposite case.

## A useful mental picture

Picture the tree with a line drawn through it. Above the line is the server: data fetching, content, layout. Below are islands of interactivity: buttons, forms, menus, anything stateful.

Your goal is to draw that line **as low as possible**, and to make the islands **as small as possible**.

A well structured RSC app is mostly server rendered content with a handful of small interactive components sprinkled through it.

## Quick recap

- `'use client'` is the first line of a file and marks a boundary.
- Everything imported below the boundary joins the client bundle.
- Put the directive on interactive leaves, never on whole pages.
- A Client Component can receive Server Components as children or props.
- Providers wrap children without turning them into client code.
- Server Components cannot read context, so pass props.
- Wrap a hook using library in your own `'use client'` file.
- Use `server-only` so server code can never be imported by mistake.

<code id="code-content" class="language-javascript">
// ---------- BAD: one useState drags two libraries into the browser ----
// 'use client';
// import { marked } from 'marked';           100KB, now in the bundle
// import { formatDistance } from 'date-fns'; also in the bundle
// export default function ArticlePage({ article }) {
//   const [showComments, setShowComments] = useState(false);
//   ...
// }
// ---------- GOOD: the page stays on the server ----------
import { marked } from 'marked';              // stays on the server
import { formatDistance } from 'date-fns';    // stays on the server
import { CommentsToggle } from './CommentsToggle.jsx';
import { ThemeProvider } from './ThemeProvider.jsx';
export default async function ArticlePage({ article }) {
  return (
    &lt;div&gt;
      &lt;h1&gt;{article.title}&lt;/h1&gt;
      &lt;div dangerouslySetInnerHTML={{ __html: marked(article.body) }} /&gt;
      &lt;p&gt;{formatDistance(article.date, new Date())}&lt;/p&gt;
      {/* The ONLY client code is the toggle button. The comments inside
          are still rendered on the server and passed in as children. */}
      &lt;CommentsToggle&gt;
        &lt;Comments comments={article.comments} /&gt;
      &lt;/CommentsToggle&gt;
    &lt;/div&gt;
  );
}
// ---------- CommentsToggle.jsx ----------
// 'use client';                     must be the FIRST line of the file
// import { useState } from 'react';
// export function CommentsToggle({ children }) {
//   const [isOpen, setIsOpen] = useState(false);
//   return (
//     &lt;div&gt;
//       &lt;button onClick={() =&gt; setIsOpen(!isOpen)}&gt;Comments&lt;/button&gt;
//       {isOpen &amp;&amp; children}        already rendered, just placed here
//     &lt;/div&gt;
//   );
// }
// ---------- A provider wraps children without claiming them ----------
// 'use client';
// export function ThemeProvider({ children }) {
//   const [theme, setTheme] = useState('light');
//   return &lt;ThemeContext value={{ theme, setTheme }}&gt;{children}&lt;/ThemeContext&gt;;
// }
// Used from a server layout, `children` stays server rendered:
//   &lt;ThemeProvider&gt;{children}&lt;/ThemeProvider&gt;
// ---------- Wrapping a library that forgot the directive ----------
// client-carousel.js:
//   'use client';
//   export { Carousel } from 'some-ui-library';
// ---------- Guard server only code ----------
// import 'server-only';             the BUILD fails if a client file
// export async function getSecrets() {   ever imports this
//   return db.query('SELECT * FROM secrets');
// }
// THE PICTURE: draw the line as LOW as you can, and keep the islands of
// interactivity as SMALL as you can.
</code></pre>
