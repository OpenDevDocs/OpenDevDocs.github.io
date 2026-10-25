---
publishDate: 2026-10-25T13:41
title: Running Code Before Requests with Proxy
slug: proxy
metadescription: Use proxy.js, the Next.js 16 replacement for middleware.js, to redirect, rewrite and add headers before a route renders, with a matcher to pick paths.
updateDate: 2026-10-25T13:41
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'proxy', 'middleware', 'redirects']
course: nextjs
---

## What you will learn

Sometimes you want to look at a request **before** any page or Route Handler runs. Send people from an old URL to a new one. Show a "back soon" page while you fix something. Add a header to every response. Bounce visitors without a login cookie away from `/admin`.

Next.js gives you one file for this: `proxy.js`. In this lesson you will:

- create `proxy.js` and see when it runs,
- choose which paths it runs on with a `matcher`,
- **redirect**, **rewrite** and **continue** with `NextResponse`,
- learn what Proxy is good at, and what it should never do.

Think of Proxy as the doorman of a hotel. He stands at the entrance and sees every guest first. He can point someone to a different entrance (redirect), quietly walk them to another room without changing the room number on their key (rewrite), or wave them through (next). He does **not** check passports in depth or carry luggage upstairs. That work happens inside.

## middleware.js is now proxy.js

If you read older tutorials, you will see a file called `middleware.js` with a function called `middleware`. In **Next.js 16** this feature was renamed to **Proxy**:

| Next.js 15 and earlier | Next.js 16 |
| --- | --- |
| `middleware.js` | `proxy.js` |
| `export function middleware(request)` | `export function proxy(request)` |
| Edge runtime by default | Node.js runtime, always |
| `skipMiddlewareUrlNormalize` | `skipProxyUrlNormalize` |

The behaviour is the same; the name is clearer. "Middleware" made people think of Express middleware, which runs inside your app for every route handler. Proxy is more like a network layer **in front of** your app.

The old `middleware.js` file still works in Next.js 16, but it is **deprecated** (it will be removed later). To move an old project over, Next.js has a codemod that renames the file and the function for you:

```bash
npx @next/codemod@canary middleware-to-proxy .
```

One real difference: Proxy always runs on the **Node.js runtime**, and you cannot change that. Setting `export const runtime` in `proxy.js` throws an error. If a project really needs the older **Edge runtime** (a small, limited runtime that some hosts run close to the visitor), it has to keep using `middleware.js` for now. [Upgrading Next.js Safely](/courses/nextjs/upgrading-nextjs) covers this in more detail.

## Step 1: create proxy.js

`proxy.js` goes in the **project root**, next to the `app` folder (or inside `src/` if you use one). Only one per project.

```text
book-nook/
├── app/
├── components/
├── lib/
├── proxy.js        here, not inside app/
└── package.json
```

The smallest useful proxy adds a header to every response:

```javascript
// proxy.js
import { NextResponse } from 'next/server';

export function proxy(request) {
  const response = NextResponse.next();
  response.headers.set('x-book-nook', 'hello-from-proxy');
  return response;
}
```

- The function must be called `proxy` (a default export also works, but the name is recommended).
- `request` is a `NextRequest`, the same object you met in [Building APIs with Route Handlers](/courses/nextjs/route-handlers). `request.nextUrl.pathname` is the path, `request.cookies` the cookies.
- `NextResponse.next()` means "carry on to the page as normal". You can still change the response on the way out, like adding a header.

Restart the dev server after creating the file, then check the header with curl:

```bash
curl -I http://localhost:3000/books
```

```text
HTTP/1.1 200 OK
x-book-nook: hello-from-proxy
...
```

When you run `npm run build`, the route list ends with a line that confirms Next.js found your file:

```text
ƒ Proxy (Middleware)
```

## Step 2: pick the paths with a matcher

Without any filter, Proxy runs on **every request**: every page, every API call, and also every JavaScript chunk in `_next/static`, every optimized image in `_next/image`, and every file in `public/`. That is a lot of wasted work, and a careless redirect can even block your CSS from loading.

Export a `config` object with a `matcher` to choose the paths:

```javascript
// proxy.js
export const config = {
  matcher: ['/admin/:path*', '/catalog'],
};
```

Matcher patterns:

- must start with `/`,
- `:path` matches one segment: `/admin/:path` matches `/admin/books` but not `/admin/books/new`,
- `:path*` matches zero or more segments: `/admin/:path*` matches `/admin`, `/admin/books` and `/admin/books/new`,
- `:path+` means one or more, `:path?` zero or one,
- are fixed values. Next.js reads them at build time, so you cannot build them from variables.

To run on "everything except files and assets", use the common **negative** pattern. It is a regular expression that says "any path that does not start with these":

```javascript
// proxy.js
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|covers).*)'],
};
```

Here we skip `/api`, Next.js's own files, the favicon, and the `public/covers` images.

You can also check the path inside the function with plain `if` statements. Many proxies do both: a broad matcher, then simple `if`s.

## Step 3: redirect, rewrite or continue

`NextResponse` has three main moves.

### Redirect: send the browser somewhere else

A **redirect** tells the browser "this is not here, go to that URL instead". The address bar changes.

```javascript
// proxy.js
if (request.nextUrl.pathname === '/catalog') {
  return NextResponse.redirect(new URL('/books', request.url));
}
```

`new URL('/books', request.url)` builds a full URL on your own site (Proxy needs full URLs, not just paths). By default the redirect uses status `307 Temporary Redirect`:

```text
HTTP/1.1 307 Temporary Redirect
location: /books
```

For a fixed, simple move like this one, the `redirects` option in `next.config.mjs` is even simpler, and it runs before Proxy. Reach for Proxy when the decision needs request data, like a cookie or a header. [Not Found Pages and Redirects](/courses/nextjs/not-found-and-redirects) shows the other options.

### Rewrite: show a different page at the same URL

A **rewrite** serves a different route's content, but the address bar keeps the original URL. Book Nook can use it for a maintenance switch:

```javascript
// proxy.js
if (process.env.MAINTENANCE_MODE === 'on' && request.nextUrl.pathname !== '/maintenance') {
  return NextResponse.rewrite(new URL('/maintenance', request.url));
}
```

With `MAINTENANCE_MODE=on` in your environment, visitors to `/books` stay on `/books` in the address bar but see the content of `app/maintenance/page.js`. Turn it off, and everything is back. No page had to change.

### Next: carry on, maybe with changes

`NextResponse.next()` lets the request continue. You can set **response** headers on it (sent to the browser), or **request** headers (passed on to your pages, where `headers()` can read them):

```javascript
// proxy.js
const requestHeaders = new Headers(request.headers);
requestHeaders.set('x-pathname', request.nextUrl.pathname);

const response = NextResponse.next({
  request: { headers: requestHeaders }, // your app sees these
});
response.headers.set('x-book-nook', 'hello-from-proxy'); // the browser sees this
return response;
```

Be careful with the shape: `NextResponse.next({ request: { headers } })` passes headers **into your app**. `NextResponse.next({ headers })` would send them to the browser instead.

### Respond directly

You can also return a `Response` yourself, for example a JSON error:

```javascript
return Response.json({ error: 'Too many requests' }, { status: 429 });
```

## Step 4: a quick check for /admin

The admin area of Book Nook should only be visited by logged-in people. The full login system arrives in [Adding Login with Sessions and Cookies](/courses/nextjs/authentication), which stores a `session` cookie. Proxy can already do a fast, **optimistic** check: "is there a session cookie at all?"

Here is the complete Book Nook proxy so far:

```javascript
// proxy.js
import { NextResponse } from 'next/server';

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // 1. Old links: /catalog moved to /books
  if (pathname === '/catalog') {
    return NextResponse.redirect(new URL('/books', request.url));
  }

  // 2. Maintenance switch
  if (process.env.MAINTENANCE_MODE === 'on' && pathname !== '/maintenance') {
    return NextResponse.rewrite(new URL('/maintenance', request.url));
  }

  // 3. Optimistic check: no session cookie means no admin pages
  if (pathname.startsWith('/admin') && !request.cookies.has('session')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Everyone else: carry on, with a friendly header
  const response = NextResponse.next();
  response.headers.set('x-book-nook', 'hello-from-proxy');
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|covers).*)'],
};
```

Visit `/admin` without logging in:

```text
HTTP/1.1 307 Temporary Redirect
location: /login?from=%2Fadmin
```

The `from` search param lets the login page send people back where they came from.

Notice the word **optimistic**. Anyone can create a cookie called `session` in their browser's developer tools and walk past this check. That is fine, because Proxy is not your real lock. It is a fast first filter that saves honest visitors a page load. The real checks happen next to the data, in [Protecting Pages, Actions and APIs](/courses/nextjs/authorization).

## What Proxy should and should not do

The Next.js docs are clear that Proxy is a **last resort** for things you cannot do elsewhere. Good uses:

- redirects and rewrites that depend on the request (cookies, headers, country, A/B test groups),
- adding or changing headers for many routes at once,
- quick, optimistic auth redirects based only on a cookie.

Avoid:

- **Slow work.** Proxy runs before every matched request, including prefetches. A database query here slows down your whole site. Read cookies, not databases.
- **Being your only security.** Server Actions are `POST` requests to the page that uses them, so a matcher that skips a path also skips the actions on it. A small matcher change can silently remove protection. Always check permissions inside each page, action and Route Handler too.
- **Caching data.** `fetch` options like `cache` and `next.revalidate` have no effect in Proxy.
- **Sharing state.** Do not rely on global variables in `proxy.js`. Pass information on with headers, cookies, rewrites or the URL.

## When Proxy runs

For each request, Next.js works in this order:

1. `headers` from `next.config.mjs`
2. `redirects` from `next.config.mjs`
3. **Proxy** (rewrites, redirects, headers)
4. `beforeFiles` rewrites from `next.config.mjs`
5. Your files: `public/`, `_next/static/`, `app/`
6. `afterFiles` rewrites, then dynamic routes like `/books/[id]`, then `fallback` rewrites

So a redirect in `next.config.mjs` wins before Proxy even starts.

## Common mistakes

### The file is in the wrong place

`app/proxy.js` does nothing. The file must sit next to `app`, in the project root (or in `src/` when you use a `src` folder). After creating it, restart `npm run dev`.

### Still exporting middleware

```javascript
export function middleware(request) {} // old name
```

In `proxy.js`, name the function `proxy`. Or run the `middleware-to-proxy` codemod on the whole project.

### Redirect loops

If Proxy redirects `/login` to `/login` (for example, "no cookie, go to login" without excluding the login page itself), the browser gives up with an error like `ERR_TOO_MANY_REDIRECTS`. Check the path first, and only redirect from the paths that need it.

### Styles and images disappear

Your matcher catches `_next/static` or `public` files, and your redirect sends them to `/login` too. Use the negative matcher pattern to skip Next.js's own files and your assets.

### Passing a path instead of a URL

```text
Error: URL is malformed "/books". Please use only absolute URLs - https://nextjs.org/docs/messages/middleware-relative-urls
```

`NextResponse.redirect('/books')` and `NextResponse.rewrite('/books')` expect a full URL. Use `new URL('/books', request.url)`.

## Quick recap

- In Next.js 16, `middleware.js` became `proxy.js` with an exported `proxy` function. The old name is deprecated.
- Proxy runs before routes render, always on the Node.js runtime. The `runtime` option is not allowed.
- Put `proxy.js` in the project root and limit it with `export const config = { matcher: [...] }`.
- `NextResponse.redirect()` changes the URL, `NextResponse.rewrite()` shows other content at the same URL, `NextResponse.next()` carries on.
- Pass headers into your app with `NextResponse.next({ request: { headers } })`.
- Keep Proxy fast: read cookies and headers, never query a database.
- Use it for optimistic checks only. Real authorization lives next to your data.

<code id="code-content" class="language-javascript">
// proxy.js: runs before matching routes render (project root, next to app/)
import { NextResponse } from 'next/server';
export function proxy(request) {
  const { pathname } = request.nextUrl;
  // Redirect: the browser goes to a new URL (307 by default)
  if (pathname === '/catalog') {
    return NextResponse.redirect(new URL('/books', request.url));
  }
  // Rewrite: same URL in the address bar, different content
  if (process.env.MAINTENANCE_MODE === 'on' &amp;&amp; pathname !== '/maintenance') {
    return NextResponse.rewrite(new URL('/maintenance', request.url));
  }
  // Optimistic check: only looks for the cookie, never queries a database
  if (pathname.startsWith('/admin') &amp;&amp; !request.cookies.has('session')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }
  // Next: carry on, passing a header into the app and one to the browser
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-book-nook', 'hello-from-proxy');
  return response;
}
// Skip API routes, Next.js files and public images
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|covers).*)'],
};
</code></pre>
