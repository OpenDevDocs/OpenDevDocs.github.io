---
publishDate: 2026-10-25T09:27
title: Cookies with cookie-parser
slug: cookies-and-cookie-parser
metadescription: Learn what HTTP cookies are, how to set them with res.cookie, read them with cookie-parser, sign them against tampering and choose safe options like httpOnly and sameSite.
updateDate: 2026-10-25T09:27
author: ['bishal-biswas']
level: 2
tags: ['express', 'cookies', 'cookie-parser', 'security']
course: expressjs
---

## What you will learn

- What a **cookie** is and how it travels between browser and server
- How to set cookies with `res.cookie()` and read them with **cookie-parser**
- What each cookie option does: `maxAge`, `httpOnly`, `secure`, `sameSite`, `path`
- How **signed cookies** detect tampering, and what they do **not** protect
- How to delete a cookie with `res.clearCookie()`

## HTTP forgets everything

HTTP is **stateless**. That means each request stands alone; the server does not automatically remember anything about earlier requests from the same visitor. Without help, your server could not tell whether two requests came from the same person.

**Cookies** fix this. A **cookie** is a small piece of text (a name and a value) that the server asks the browser to store. After that, the browser sends it back with every request to the same site.

**Think of it like a coat check ticket.** You hand over your coat and get a numbered ticket. Each time you come back, you show the ticket, and staff know which coat is yours. The browser holds the ticket and shows it on every visit.

Here is the round trip in raw HTTP:

```http
GET /visit HTTP/1.1
Host: localhost:3000

HTTP/1.1 200 OK
Set-Cookie: theme=dark; Path=/; HttpOnly
```

The server sends a **`Set-Cookie`** response header. On the next request, the browser sends it back in a **`Cookie`** request header:

```http
GET /profile HTTP/1.1
Host: localhost:3000
Cookie: theme=dark
```

Express gives you a helper to **write** cookies (`res.cookie()`). To **read** them conveniently, you add the `cookie-parser` middleware.

## Setting a cookie

`res.cookie(name, value, options)` adds a `Set-Cookie` header to the response. It is built into Express; you do not need any package to set cookies.

```js
// app.js
import express from 'express';

const app = express();

app.get('/theme/:name', (req, res) => {
  res.cookie('theme', req.params.name, {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days, in milliseconds
    httpOnly: true,
    sameSite: 'lax',
  });
  res.send(`Theme set to ${req.params.name}`);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

```bash
curl -i http://localhost:3000/theme/dark
```

```http
HTTP/1.1 200 OK
Set-Cookie: theme=dark; Max-Age=2592000; Path=/; Expires=...; HttpOnly; SameSite=Lax
Content-Type: text/html; charset=utf-8

Theme set to dark
```

Notice that Express converts `maxAge` from milliseconds into seconds for the `Max-Age` attribute, and also adds a matching `Expires` date.

## Reading cookies with cookie-parser

The browser sends cookies as one long string, like `theme=dark; lang=en`. You could split it by hand, but **cookie-parser** does it for you and puts the result in **`req.cookies`**.

```bash
npm install cookie-parser
```

```js
// app.js
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cookieParser()); // fills req.cookies on every request

app.get('/theme/:name', (req, res) => {
  res.cookie('theme', req.params.name, { maxAge: 1000 * 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax' });
  res.send(`Theme set to ${req.params.name}`);
});

app.get('/', (req, res) => {
  const theme = req.cookies.theme ?? 'light'; // default when no cookie yet
  res.send(`Your theme is ${theme}`);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

curl does not remember cookies by default. Use `-c` to save them to a file and `-b` to send them back:

```bash
curl -c cookies.txt http://localhost:3000/theme/dark
curl -b cookies.txt http://localhost:3000/
```

```text
Theme set to dark
Your theme is dark
```

In a browser, it just works: visit `/theme/dark`, then `/`.

> **Note:** Without `cookie-parser`, `req.cookies` is `undefined`. If you see "Cannot read properties of undefined (reading 'theme')", check that `app.use(cookieParser())` runs before your routes.

## Cookie options explained

Options decide how long a cookie lives, who can read it and when the browser sends it. Getting them right is a big part of web security.

| Option | What it does | Typical value |
| --- | --- | --- |
| `maxAge` | Lifetime in **milliseconds**. Without it (or `expires`), the cookie is deleted when the browser closes. | `1000 * 60 * 60 * 24 * 7` |
| `expires` | An exact `Date` when the cookie dies. Use `maxAge` or `expires`, not both. | `new Date('2027-01-01')` |
| `httpOnly` | Hides the cookie from JavaScript in the page (`document.cookie`). | `true` |
| `secure` | Only send the cookie over HTTPS. | `true` in production |
| `sameSite` | Controls whether the cookie is sent on requests coming from other sites. | `'lax'` or `'strict'` |
| `path` | Only send the cookie for URLs under this path. Default `/`. | `'/'` |
| `domain` | Which domain (and subdomains) receives it. Default: the current host only. | Leave it out |
| `signed` | Sign the value so changes can be detected (see below). | `true` |

A cookie that lives only until the browser closes is called a **session cookie**. One with `maxAge` or `expires` is a **persistent cookie**.

### httpOnly: keep scripts away

If an attacker manages to run JavaScript on your page (an XSS attack), they can read every cookie that is **not** `httpOnly` and send it to themselves. With `httpOnly: true`, the browser still sends the cookie to your server, but page scripts cannot see it. Turn it on for anything related to logins.

### secure: HTTPS only

With `secure: true`, the browser only sends the cookie over encrypted HTTPS connections, so nobody on the same coffee-shop Wi-Fi can read it. During local development you usually use plain `http://localhost`, so a common pattern is:

```js
// app.js
const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction, // HTTPS in production, plain HTTP on localhost
  sameSite: 'lax',
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
};
```

### sameSite: who may send it

**`sameSite`** controls whether the browser sends the cookie when a request is started by **another website** (for example, a form on `evil.example` that posts to your site). This blocks most **cross-site request forgery (CSRF)** attacks.

| Value | Behaviour |
| --- | --- |
| `'strict'` | Never sent on requests from other sites, not even when clicking a link to you. |
| `'lax'` | Sent when a user follows a normal link to your site, but not on cross-site form posts or background requests. A good default. |
| `'none'` | Always sent. Requires `secure: true`. Only for cookies that must work across sites. |

## Signed cookies: detect tampering

Cookies live on the user's computer, so users can edit them. If you store `role=user`, nothing stops someone from changing it to `role=admin` in their browser's developer tools.

A **signed cookie** adds a **signature**: a short code computed from the value and a **secret** that only your server knows. When the cookie comes back, cookie-parser recomputes the signature. If the value was changed, the signatures do not match and the cookie is rejected.

To use signed cookies, give cookie-parser a secret:

```bash
# .env
COOKIE_SECRET=change-me-to-a-long-random-string
```

```js
// app.js (run with: node --env-file=.env app.js, Node 20.6+)
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cookieParser(process.env.COOKIE_SECRET));

app.get('/set', (req, res) => {
  res.cookie('plan', 'free', { signed: true, httpOnly: true, sameSite: 'lax' });
  res.send('Signed cookie set');
});

app.get('/read', (req, res) => {
  res.json({
    signed: req.signedCookies.plan, // verified value, or false if tampered
    unsigned: req.cookies.plan,     // signed cookies do NOT appear here
  });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

```bash
curl -c cookies.txt http://localhost:3000/set
curl -b cookies.txt http://localhost:3000/read
```

```text
Signed cookie set
{"signed":"free"}
```

(`unsigned` is missing from the output because its value is `undefined`.) If you open `cookies.txt` and change `free` to `pro`, the next `/read` returns `{"signed":false}`. The tampering was detected.

Signed cookies go into **`req.signedCookies`**, not `req.cookies`. A value of `false` means "this cookie existed but its signature was wrong".

> **Warning:** Signing is **not** encryption. Anyone can still **read** a signed cookie's value; they just cannot change it without being caught. Never store passwords, personal data or secrets in cookies, signed or not.

> **Tip:** Generate a strong secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, keep it in `.env`, and never commit it.

## Deleting a cookie

To remove a cookie, call **`res.clearCookie(name, options)`**. It sends a `Set-Cookie` header with an expiry date in the past, and the browser deletes it.

```js
// app.js
app.post('/theme/reset', (req, res) => {
  res.clearCookie('theme'); // must match the path/domain used when setting it
  res.send('Theme reset');
});
```

If you set the cookie with a custom `path` or `domain`, pass the **same** `path` and `domain` to `clearCookie`. Otherwise the browser treats it as a different cookie and keeps the original.

> **Note:** In Express 5, `res.clearCookie()` ignores the `maxAge` and `expires` options, because a cleared cookie must always expire immediately. You can reuse your cookie options object without worrying about it.

## Storing small objects

`res.cookie()` also accepts an object. Express turns it into JSON (with a `j:` prefix), and cookie-parser turns it back into an object for you:

```js
// app.js
app.get('/prefs', (req, res) => {
  res.cookie('prefs', { theme: 'dark', lang: 'en' }, { httpOnly: true, sameSite: 'lax' });
  res.send('Saved');
});

app.get('/prefs/show', (req, res) => {
  res.json(req.cookies.prefs); // { theme: 'dark', lang: 'en' }
});
```

Keep cookies **small**. Browsers limit each cookie to about 4 KB, and every cookie is sent with **every** request, even requests for images. Large cookies slow down your whole site.

## What cookies are good (and bad) for

| Good uses | Bad uses |
| --- | --- |
| Theme, language, "dismissed this banner" | Passwords or API keys |
| A session ID (next lesson) | Shopping carts with many items (too large) |
| A short-lived login token, `httpOnly` | Anything you trust without verifying |

Most real apps store only an **ID** in a cookie and keep the actual data on the server. That idea is called a **session**, and it is the next lesson.

## Common mistakes

> **Common mistake:** Giving `maxAge` in seconds. Express expects **milliseconds**, so `maxAge: 3600` lasts 3.6 seconds, not an hour.

> **Common mistake:** Looking for a signed cookie in `req.cookies`. Signed cookies only appear in `req.signedCookies`.

> **Common mistake:** Setting `secure: true` and testing over plain `http://`. Depending on the browser and setup, the cookie may never be stored or sent. Use `secure: process.env.NODE_ENV === 'production'`.

## Key takeaways

- A **cookie** is a small name/value pair the browser stores and sends back on every request.
- Set cookies with **`res.cookie()`** (built in). Read them with **`cookie-parser`** via `req.cookies`.
- Use **`httpOnly`**, **`secure`** (in production) and **`sameSite: 'lax'`** for safer cookies.
- **Signed cookies** (`cookieParser(secret)` + `signed: true`) detect tampering but are still readable.
- Delete with **`res.clearCookie()`**, matching the original `path` and `domain`.

## Practice

1. Build a visit counter: read a `visits` cookie, add one, set it again and display "You have visited N times".
2. Add a "Reset" route that clears the counter, and verify with curl that the cookie disappears.
3. Store a signed `plan` cookie. Edit it in `cookies.txt` (or your browser's developer tools) and confirm `req.signedCookies.plan` becomes `false`.
4. Open your browser's developer tools, find the Application or Storage tab, and inspect which flags (`HttpOnly`, `SameSite`) your cookies have.

## What's next

Cookies should stay small and should not hold sensitive data. Sessions keep the data on the server and put only an ID in the cookie. Continue with [Sessions with express-session](/courses/expressjs/sessions-with-express-session).
