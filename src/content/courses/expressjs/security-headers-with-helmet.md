---
publishDate: 2026-10-25T09:44
title: Security Headers with Helmet
slug: security-headers-with-helmet
metadescription: Learn what HTTP security headers do, the attacks they block such as clickjacking and MIME sniffing, and how to configure Helmet and a Content Security Policy in Express 5.
updateDate: 2026-10-25T09:44
author: ['bishal-biswas']
level: 3
tags: ['express', 'helmet', 'security', 'headers']
course: expressjs
---

## What you will learn

- What **security headers** are and why browsers listen to them
- Which attacks they block: **clickjacking**, **MIME sniffing**, HTTPS downgrades and more
- How to add a sensible set of headers with one line: `app.use(helmet())`
- How to write and loosen a **Content Security Policy** (CSP) safely, including nonces
- How to tune or turn off individual Helmet headers

## Headers as instructions to the browser

You learned in [Status Codes and Response Headers](/courses/expressjs/status-codes-and-headers) that every response carries **headers**: small labels such as `Content-Type: application/json`.

Some headers are **instructions to the browser** about how to treat your page safely. For example: "never show this page inside another site's frame" or "only ever talk to me over HTTPS". These are called **security headers**.

Think of them as the warning labels on a medicine bottle. The medicine (your page) is the same, but the label tells the person handling it how to use it safely. Browsers read and obey these labels.

Out of the box, Express sends almost none of them. Look:

```bash
curl -I http://localhost:3000/
```

```http
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: text/html; charset=utf-8
Content-Length: 12
```

Not only are the safety labels missing, `X-Powered-By` tells every visitor (and every attacker) which framework you run.

## The attacks these headers stop

Before installing anything, let's look at the problems. Each one is a real, common attack.

### Clickjacking

An attacker builds a page that says "Click here to win a prize!". Underneath, invisible, they load **your** site in a transparent `<iframe>` (a frame that shows one website inside another), positioned so your "Delete my account" button sits exactly under their prize button. Your logged-in user clicks the prize and actually clicks your button.

This is **clickjacking**: tricking a user into clicking something they cannot see.

**Defence:** tell the browser your pages may not be framed by other sites (`X-Frame-Options` and the CSP `frame-ancestors` directive).

### MIME sniffing

Your app lets users upload profile pictures. Someone uploads a file called `cat.png` that actually contains HTML and JavaScript. Some browsers try to be helpful by **sniffing**: looking at the content and deciding "this is really HTML", then running it.

**Defence:** `X-Content-Type-Options: nosniff` tells the browser to trust your `Content-Type` and never guess.

### HTTPS downgrade

A user on café Wi-Fi types `yourapp.com`. The browser tries plain `http://` first. An attacker on the same network intercepts that first unencrypted request and keeps the user on a fake HTTP version of your site, reading everything, including cookies.

**Defence:** `Strict-Transport-Security` (HSTS) tells the browser "for the next year, only ever use HTTPS for this site", so it never makes that first unsafe request again.

### Injected scripts (XSS)

If an attacker manages to inject `<script>` into your page (you will learn how in [Preventing Injection, XSS and CSRF](/courses/expressjs/preventing-injection-xss-csrf)), that script runs with full access to the page.

**Defence:** a **Content Security Policy** lists where scripts may come from. An injected script from an unknown place, or inline where scripts are not allowed, is blocked. CSP is a second line of defence; the first is not letting the script in at all.

### Leaky referrers

When a user clicks a link from `https://yourapp.com/reset-password?token=abc123` to an external site, the browser may send the full URL in the `Referer` header. Now the other site has your user's reset token.

**Defence:** `Referrer-Policy` controls how much of the URL is shared.

## Adding Helmet

**Helmet** is a small middleware that sets a carefully chosen bundle of security headers.

```bash
npm install helmet
```

```js
// app.js
import express from 'express';
import helmet from 'helmet';

export const app = express();

app.use(helmet()); // first, so every response gets the headers

app.get('/', (req, res) => {
  res.send('<h1>Hello</h1>');
});
```

Now look again:

```bash
curl -I http://localhost:3000/
```

```http
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: SAMEORIGIN
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
Content-Type: text/html; charset=utf-8
```

`X-Powered-By` is gone, and a dozen safety labels appeared. The exact list can change slightly between Helmet versions, as the defaults follow current best practice.

## What each header does

| Header | Plain-language meaning |
| --- | --- |
| `Content-Security-Policy` | "Only load scripts, styles, images and so on from these places." |
| `Strict-Transport-Security` | "Use HTTPS only for this site (and its subdomains) for one year." |
| `X-Frame-Options: SAMEORIGIN` | "Only my own site may put me in a frame." (Older browsers.) |
| `X-Content-Type-Options: nosniff` | "Trust my `Content-Type`. Don't guess." |
| `Referrer-Policy: no-referrer` | "Don't tell other sites which page the user came from." |
| `Cross-Origin-Opener-Policy` | "Keep my window isolated from pop-ups opened by other sites." |
| `Cross-Origin-Resource-Policy` | "Only my own site may load my resources (images, scripts...)." |
| `Origin-Agent-Cluster` | Asks the browser to isolate your site's pages in their own process where possible. |
| `X-DNS-Prefetch-Control: off` | Don't look up domains of links in advance, which can leak browsing info. |
| `X-Download-Options`, `X-Permitted-Cross-Domain-Policies` | Legacy protections for old Internet Explorer and Adobe plug-ins. |
| `X-XSS-Protection: 0` | Turns **off** an old, buggy browser XSS filter that caused more problems than it solved. CSP replaces it. |

## Content Security Policy in depth

CSP is the most powerful header and the one most likely to need tuning. A policy is a list of **directives**, each saying where one type of content may come from.

```text
default-src 'self'          fallback for anything not listed: only my own origin
script-src 'self'           JavaScript only from my own origin
img-src 'self' data:        images from my origin or inline data: URLs
object-src 'none'           no Flash/plug-ins at all
frame-ancestors 'self'      only my own site may frame me (modern clickjacking defence)
```

`'self'` means "the same origin as the page": the same scheme, domain and port.

### Allowing a CDN

Say your page loads a charting library from `https://cdn.jsdelivr.net`. With the default policy, the browser blocks it and logs an error in the console. You extend the policy instead of turning it off:

```js
// app.js
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Helmet merges these with its defaults
        'script-src': ["'self'", 'https://cdn.jsdelivr.net'],
        'img-src': ["'self'", 'data:', 'https://images.example.com'],
      },
    },
  }),
);
```

> **Tip:** Allow exact hosts, not whole schemes. `https:` in `script-src` means "any HTTPS site on the internet", which defeats the purpose.

### Inline scripts and nonces

The default policy blocks inline `<script>` blocks, because injected scripts are usually inline. If you genuinely need an inline script in a template, use a **nonce**: a random value generated fresh for every response. Only script tags carrying that exact value may run. An attacker cannot guess it.

```js
// app.js
import crypto from 'node:crypto';

// 1. Create a fresh nonce for every request
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// 2. Tell CSP to allow scripts with that nonce
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'script-src': ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      },
    },
  }),
);
```

```html
<!-- views/index.ejs : res.locals values are available in templates -->
<script nonce="<%= cspNonce %>">
  console.log('This inline script is allowed');
</script>
```

> **Warning:** Avoid adding `'unsafe-inline'` to `script-src`. It allows *every* inline script, including injected ones, which removes most of CSP's protection.

### Trying a policy safely with report-only mode

A strict CSP can break a page in surprising ways. **Report-only mode** makes the browser log violations without blocking anything, so you can test first:

```js
// app.js
app.use(
  helmet({
    contentSecurityPolicy: {
      reportOnly: true, // sends Content-Security-Policy-Report-Only instead
    },
  }),
);
```

Open your pages, check the browser console for CSP warnings, fix them, then switch `reportOnly` off.

## Tuning other headers

Every Helmet header can be configured or turned off by name.

### HSTS

```js
// app.js
app.use(
  helmet({
    strictTransportSecurity: {
      maxAge: 63072000,      // two years, in seconds
      includeSubDomains: true,
      preload: true,         // only if you will submit to the browser preload list
    },
  }),
);
```

> **Warning:** Only enable `includeSubDomains` or `preload` when **every** subdomain supports HTTPS. Browsers remember HSTS for the whole `maxAge`, so a mistake cannot be quickly undone. Browsers also ignore HSTS sent over plain HTTP, so it only takes effect once your site is served over HTTPS.

### Allowing a partner to frame your page

If a specific partner site must embed your page, change the CSP `frame-ancestors` directive. Modern browsers use `frame-ancestors` and ignore `X-Frame-Options` when both are present:

```js
// app.js
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { 'frame-ancestors': ["'self'", 'https://partner.example.com'] },
    },
  }),
);
```

### Serving public assets to other sites

`Cross-Origin-Resource-Policy: same-origin` stops other websites from loading your images or files. If you run a public image host or an API whose files other sites should embed, relax it:

```js
// app.js
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
```

### Turning a header off

Pass `false` for any header you deliberately do not want:

```js
// app.js
app.use(helmet({ contentSecurityPolicy: false })); // e.g. while a CSP is set by your CDN instead
```

Only turn things off when you understand why. A header that "breaks something" is often doing its job.

## Helmet for JSON APIs

Many headers are about HTML pages, so you might think an API-only app does not need Helmet. Use it anyway:

- It removes `X-Powered-By`.
- `nosniff` stops browsers from treating a JSON response as HTML.
- HSTS still protects every request to your domain.
- It costs almost nothing.

Helmet works alongside [CORS](/courses/expressjs/cors-configuration). They solve different problems: CORS decides which *other sites' JavaScript* may read your responses; Helmet tells browsers how to handle your responses safely.

## Common mistakes

> **Common mistake:** Disabling CSP entirely the first time a script is blocked. Read the console error, see which directive blocked what, and add that specific source.

- **Registering Helmet after your routes.** Middleware runs in order. Put `app.use(helmet())` near the top so every response, including errors, gets the headers.
- **Allowing `'unsafe-inline'` or `https:` in `script-src`.** Both throw away most of the protection.
- **Enabling HSTS `preload` without being ready.** Getting off the preload list takes a long time.
- **Thinking Helmet makes your app secure.** It hardens the *browser* side. You still need validation, safe queries, escaping and authentication.

## Key takeaways

- **Security headers** are instructions that tell browsers how to treat your responses safely.
- `app.use(helmet())` adds a strong default set and removes `X-Powered-By`.
- **Clickjacking** is blocked by `frame-ancestors` / `X-Frame-Options`, **MIME sniffing** by `nosniff`, and **HTTPS downgrades** by HSTS.
- **CSP** limits where scripts and other content can load from. Extend it host by host, use **nonces** for inline scripts, and test with `reportOnly`.
- Tune or disable individual headers by name, but only when you understand the reason.

## Practice

1. Run `curl -I` against your Notes API before and after adding Helmet. List three headers that appeared and one that disappeared.
2. Create a page that loads a script from a CDN. Watch CSP block it in the browser console, then allow just that host.
3. Add an inline `<script>` to an EJS page and make it work using a nonce, without `'unsafe-inline'`.
4. Create a second local page that tries to show your app in an `<iframe>`. Confirm the browser refuses to display it.

## What's next

Headers are your safety net. Next you will fix the root causes of the most famous web attacks in [Preventing Injection, XSS and CSRF](/courses/expressjs/preventing-injection-xss-csrf).
