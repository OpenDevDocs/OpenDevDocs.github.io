---
publishDate: 2026-10-25T09:45
title: Preventing Injection, XSS and CSRF
slug: preventing-injection-xss-csrf
metadescription: Understand SQL and NoSQL injection, cross-site scripting and cross-site request forgery with simple examples, and learn the Express 5 defences that stop each one.
updateDate: 2026-10-25T09:45
author: ['bishal-biswas']
level: 3
tags: ['express', 'security', 'xss', 'csrf']
course: expressjs
---

## What you will learn

- The one idea behind most web attacks: **data being treated as code**
- How **SQL injection** and **NoSQL injection** work, and how parameterised queries and type checks stop them
- Why passing user input to shell commands is dangerous
- How **cross-site scripting (XSS)** works and how output escaping prevents it
- How **cross-site request forgery (CSRF)** works and how SameSite cookies, origin checks and CSRF tokens prevent it

These three attacks have topped security lists for over twenty years. The good news: each has a simple, reliable defence once you understand the cause.

## The root cause: mixing data and code

Imagine a restaurant where waiters write your order on a slip, and the kitchen follows *every* line on the slip. You order "one pizza". A prankster orders "one pizza. Also, give the waiter the cash register." If the kitchen cannot tell the difference between *the order* and *instructions*, it hands over the register.

That is the heart of injection and XSS. Your app builds some **code** (a SQL query, a shell command, an HTML page) and pastes **user data** into it. If the data contains characters that the code treats as special, the user's data becomes part of the instructions.

The cure is always the same idea: **keep data and code in separate channels**, so data can never be read as instructions.

## SQL injection

### The attack

You add a search route to an app that uses PostgreSQL. You build the query with a template string:

```js
// routes/users.js  (VULNERABLE: do not copy)
app.get('/users/search', async (req, res) => {
  const { name } = req.query;
  const sql = `SELECT id, name FROM users WHERE name = '${name}'`;
  const { rows } = await pool.query(sql);
  res.json(rows);
});
```

A normal search for `Ada` produces:

```sql
SELECT id, name FROM users WHERE name = 'Ada'
```

Now someone searches for `' OR '1'='1`. The quote closes your string early, and the rest becomes SQL:

```sql
SELECT id, name FROM users WHERE name = '' OR '1'='1'
```

`'1'='1'` is always true, so the query returns **every user**. With more effort, an attacker can read other tables, change data or delete it. This is **SQL injection**.

### The defence: parameterised queries

A **parameterised query** (also called a **prepared statement**) sends the SQL and the values to the database **separately**. The database compiles the SQL first, then plugs the values in as pure data. A quote inside a value is just a quote character; it can never end the string.

With the `pg` driver, placeholders are `$1`, `$2` and so on:

```js
// routes/users.js  (safe)
app.get('/users/search', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name FROM users WHERE name = $1',
    [req.query.name], // values travel separately from the SQL text
  );
  res.json(rows);
});
```

If you use an ORM like Sequelize (from [CRUD API with SQL and an ORM](/courses/expressjs/crud-api-with-sql)), its normal methods already parameterise for you:

```js
// Sequelize: safe, values are parameterised automatically
const users = await User.findAll({ where: { name: req.query.name } });

// Raw SQL with Sequelize: use replacements, never string building
const [rows] = await sequelize.query('SELECT id, name FROM users WHERE name = :name', {
  replacements: { name: req.query.name },
});
```

### What cannot be parameterised

Placeholders work for **values**, not for **identifiers** like column names or for keywords like `ASC`/`DESC`. Sorting is the classic trap:

```js
// VULNERABLE: column name pasted into SQL
const sql = `SELECT * FROM notes ORDER BY ${req.query.sort}`;
```

The fix is an **allow-list**: a fixed list of values you accept. Anything else is rejected or replaced with a default. You did this in [Pagination, Filtering and Sorting](/courses/expressjs/pagination-filtering-sorting).

```js
// safe: only known column names can reach the SQL
const SORTABLE = new Set(['created_at', 'title']);
const sortColumn = SORTABLE.has(req.query.sort) ? req.query.sort : 'created_at';
const direction = req.query.order === 'asc' ? 'ASC' : 'DESC';
const { rows } = await pool.query(`SELECT * FROM notes ORDER BY ${sortColumn} ${direction} LIMIT $1`, [20]);
```

## NoSQL injection

MongoDB does not use SQL strings, so it is immune to injection, right? Not quite. MongoDB queries are **objects**, and operators such as `$ne` (not equal) and `$gt` (greater than) are just keys. If a user can send an *object* where you expected a *string*, they can sneak operators into your query.

### The attack

Imagine a password reset route that stores reset tokens in plain form and looks them up like this:

```js
// routes/reset.js  (VULNERABLE)
app.post('/reset-password', async (req, res) => {
  const user = await User.findOne({ resetToken: req.body.token });
  if (!user) return res.status(400).json({ error: 'Invalid token' });
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  await user.save();
  res.json({ ok: true });
});
```

`express.json()` happily turns this body into a nested object:

```json
{ "token": { "$ne": null }, "password": "attacker-chosen" }
```

The query becomes "find a user whose reset token is **not null**", which matches any user with a pending reset. The attacker just set that user's password without ever seeing their email.

### The defences

1. **Validate types.** The token must be a string. With Zod (from [Request Validation with Zod](/courses/expressjs/request-validation-with-zod)), an object is rejected before it reaches the database:

```js
// routes/reset.js  (safe)
import { z } from 'zod';

const resetSchema = z.object({
  token: z.string().min(1).max(100),
  password: z.string().min(15).max(64),
});

app.post('/reset-password', async (req, res) => {
  const result = resetSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.issues });
  // result.data.token is guaranteed to be a string here
  // ...hash the token and look it up, as in the password lesson
});
```

2. **Turn on Mongoose's filter sanitising** as a safety net. With `sanitizeFilter`, Mongoose wraps any object containing `$` keys in a `$eq`, so `{ $ne: null }` is treated as a literal value instead of an operator:

```js
// db.js
import mongoose from 'mongoose';

mongoose.set('sanitizeFilter', true);
await mongoose.connect(process.env.MONGODB_URI);
```

3. **Know your query parser.** In Express 5, the default `"simple"` query parser does **not** turn `?token[$ne]=x` into an object, which closes this hole for query strings. If you switch to `app.set('query parser', 'extended')`, validate query values with the same care as bodies.

## Command injection

Sometimes an app runs another program, for example an image tool, using Node's `child_process` module. The `exec()` function runs a whole command line through a **shell**, the same program that runs commands in your terminal.

```js
// VULNERABLE: user input inside a shell command
import { exec } from 'node:child_process';
exec(`convert uploads/${req.body.file} -resize 200x200 thumbs/out.png`);
```

If `file` is `photo.png; cat /etc/passwd`, the shell sees a semicolon and runs a *second* command. That is **command injection**.

**Defence:** use `execFile()` (or `spawn()`), which runs a program directly with an **array of arguments** and no shell. Each argument is passed as data, so a semicolon is just a character in a file name. Also validate the input, for example by only accepting file names your app generated.

```js
// safe: no shell, arguments passed separately
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);
const safeName = path.basename(req.body.file); // strips any "../" folders
await run('convert', [`uploads/${safeName}`, '-resize', '200x200', 'thumbs/out.png']);
```

## Cross-site scripting (XSS)

**Cross-site scripting** is injection into **HTML**. If user data ends up in a page without being made safe, the browser treats it as markup, including `<script>` tags. The injected script runs on *your* site, as *your* user.

Once it runs, the script can do anything the user can: read the page, call your API with the user's cookies, change their email address, or show a fake login form.

### Reflected XSS

The page echoes something from the request straight back:

```js
// VULNERABLE: res.send with a string responds as text/html
app.get('/search', (req, res) => {
  res.send(`<h1>Results for ${req.query.q}</h1>`);
});
```

An attacker sends a victim a link like this:

```text
https://yourapp.com/search?q=<script>alert('XSS')</script>
```

The victim's browser receives a page containing that script and runs it. (`alert` is the harmless way security people demonstrate XSS; a real attacker would do something quieter.) This is **reflected XSS**, because the input is reflected back immediately.

### Stored XSS

Worse, an attacker posts a comment containing a script. Your app saves it in the database and shows it to **every** visitor who opens the page. This is **stored XSS**, and it can affect thousands of users from one request.

### Defence 1: escape output

**Escaping** means converting characters that have a special meaning in HTML into harmless text versions:

| Character | Escaped as |
| --- | --- |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `&` | `&amp;` |
| `"` | `&quot;` |
| `'` | `&#39;` |

After escaping, the browser shows the characters `<script>` on screen as plain text and never runs them.

You rarely need to escape by hand, because **template engines escape for you**. In EJS (from [Template Engines](/courses/expressjs/template-engines)):

```html
<!-- views/search.ejs -->
<h1>Results for <%= q %></h1>   <!-- <%= escapes: SAFE -->
<h1>Results for <%- q %></h1>   <!-- <%- outputs raw HTML: DANGEROUS with user data -->
```

```js
// routes/search.js  (safe)
app.get('/search', (req, res) => {
  res.render('search', { q: req.query.q ?? '' });
});
```

If you build HTML strings in JavaScript, write a small helper and use it every time:

```js
// utils/escapeHtml.js
const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => map[ch]);
```

> **Common mistake:** Escaping is about *where* data goes. HTML escaping protects text inside HTML. It does not make a value safe inside a `<script>` block, a CSS rule, or an `href`. For links, also check the URL starts with `https://` or `/`, because `href="javascript:..."` runs code when clicked.

### Defence 2: send JSON as JSON

For an API, return data with `res.json()`. It sets `Content-Type: application/json`, and with Helmet's `nosniff` header the browser will not treat it as a web page. XSS then becomes the frontend's job to avoid, which brings us to the next point.

### Defence 3: safe frontend code

On the frontend, put user data on the page with `element.textContent = value`, never `element.innerHTML = value`. Frameworks like React escape by default; the danger appears only when you use escape hatches such as `dangerouslySetInnerHTML`.

If you *must* accept HTML (a rich-text editor, for example), clean it with an HTML **sanitiser** that keeps safe tags and removes everything else. You will do that in [Input Sanitisation and Payload Limits](/courses/expressjs/input-sanitisation-and-payload-limits).

### Defence 4: limit the damage

- A **Content Security Policy** (from [Security Headers with Helmet](/courses/expressjs/security-headers-with-helmet)) blocks inline and unknown scripts, so many injections fail even if they slip through.
- **`httpOnly` cookies** cannot be read by injected scripts, so session IDs and refresh tokens are not directly stolen.

## Cross-site request forgery (CSRF)

### The attack

Ada is logged in to her bank, `bank.example`, using a session cookie. In another tab, she opens a harmless-looking page on `evil.example`. That page contains a hidden form:

```html
<!-- on evil.example (illustration of the attack) -->
<form action="https://bank.example/transfer" method="post">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="1000">
</form>
<script>document.forms[0].submit();</script>
```

The form submits itself to the bank. Browsers attach cookies to requests based on the *destination*, so Ada's session cookie goes along. The bank sees a valid, logged-in request and makes the transfer. Ada clicked nothing.

This is **cross-site request forgery**: another site forges a request that the browser sends with the user's credentials.

```text
evil.example page ──(auto-submitted form)──> bank.example/transfer
                                             + Cookie: sid=... (added by the browser!)
bank: "valid session, OK"  -> money moves
```

### Who is affected?

CSRF only works when the browser adds credentials **automatically**. That means:

| Authentication method | CSRF risk |
| --- | --- |
| Session cookie ([Passport lesson](/courses/expressjs/passport-authentication)) | **Yes** |
| Refresh token in a cookie ([JWT lesson](/courses/expressjs/jwt-authentication)) | **Yes**, on the refresh route |
| Access token in the `Authorization` header | No: other sites cannot make the browser add your header |

### Defence 1: SameSite cookies

The `SameSite` cookie attribute tells the browser when to send a cookie on requests started by *another* site:

| Value | Sent on cross-site requests? |
| --- | --- |
| `Strict` | Never. Even clicking a link from another site arrives "logged out". |
| `Lax` | Only on top-level navigations with safe methods (clicking a normal link, `GET`). Not on cross-site `POST` requests, iframes, images or `fetch`. |
| `None` | Always (requires `Secure`). Needed only for genuine cross-site use. |

Set it explicitly on every auth cookie, as you did earlier: `sameSite: 'lax'` or `'strict'`. `Lax` alone blocks the hidden-form attack above.

> **Note:** SameSite is a strong first layer, but treat it as one layer. "Same site" means the same registrable domain, so a compromised or user-controlled subdomain counts as "same site". Combine it with the checks below.

### Defence 2: never change data on GET

`Lax` cookies are still sent when a user follows a link (`GET`). So a route like `GET /notes/17/delete` can be triggered by any link or `<img>` tag. Keep `GET` read-only and use `POST`, `PATCH` and `DELETE` for changes, as you learned in [Designing RESTful Routes](/courses/expressjs/designing-restful-routes).

### Defence 3: check where the request came from

Modern browsers add headers that reveal the requesting site: `Origin` (for example `https://evil.example`) and `Sec-Fetch-Site` (`same-origin`, `same-site`, `cross-site` or `none`). A forged request cannot fake these, because the browser sets them, not the page.

```js
// middleware/rejectCrossSite.js
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const allowedOrigins = new Set([process.env.APP_ORIGIN]); // e.g. https://notes.example.com

export const rejectCrossSite = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('Origin');
  const fetchSite = req.get('Sec-Fetch-Site');

  const allowed = origin ? allowedOrigins.has(origin) : fetchSite !== 'cross-site';
  if (allowed) return next();

  res.status(403).json({ error: 'Cross-site request blocked' });
};
```

Requests without either header (such as `curl` or server-to-server calls) are allowed, because CSRF needs a victim's browser.

### Defence 4: CSRF tokens

The classic, strongest defence is a **CSRF token**: a secret random value stored in the user's session and included in every form or state-changing request. The evil site cannot read your pages, so it cannot know the token, and its forged request fails.

This is called the **synchronizer token pattern**. Here is a small, complete version for `express-session`:

```js
// middleware/csrf.js
import crypto from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Make a token available to every template
export const provideCsrfToken = (req, res, next) => {
  req.session.csrfToken ??= crypto.randomBytes(32).toString('base64url');
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

const safeEqual = (a, b) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

export const verifyCsrfToken = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const expected = req.session.csrfToken;
  const sent = req.get('X-CSRF-Token') ?? req.body?._csrf; // header for fetch, field for forms

  if (!expected || typeof sent !== 'string' || !safeEqual(sent, expected)) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  next();
};
```

```js
// app.js (order matters: session, body parsers, then CSRF)
app.use(session({ /* ...as in the Passport lesson... */ }));
app.use(express.urlencoded());
app.use(express.json());
app.use(provideCsrfToken);
app.use(verifyCsrfToken);
```

Forms include the token in a hidden field:

```html
<!-- views/note-form.ejs -->
<form method="post" action="/notes">
  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
  <input name="title">
  <button>Save</button>
</form>
```

A single-page app can fetch the token once (for example from a `GET /csrf-token` route that returns `res.locals.csrfToken`) and send it in the `X-CSRF-Token` header with every `POST`, `PATCH` and `DELETE`.

> **Tip:** `crypto.timingSafeEqual` compares secrets in constant time, so an attacker cannot learn the token one character at a time by measuring how fast comparisons fail.

> **Note:** The once-popular `csurf` package is deprecated. If you prefer a library, maintained options include `csrf-sync` (synchronizer tokens) and `csrf-csrf` (double-submit cookies). The ideas are the ones you just built.

### CORS is not CSRF protection

A common misunderstanding: "My CORS settings only allow my frontend, so I am safe from CSRF." CORS controls whether another site's JavaScript can **read** your response. A plain form submission does not need to read anything; the damage is done when the request **arrives**. Use the defences above.

## Common mistakes

- **Building SQL with template strings or `+`**, even "just for this one internal query".
- **Assuming MongoDB cannot be injected.** Validate that fields are strings before using them in filters.
- **Using `<%- %>` (raw output) with user data** in EJS, or `innerHTML` in the browser.
- **State-changing `GET` routes** such as `/logout` or `/delete`.
- **Relying on one CSRF layer.** Combine SameSite cookies with origin checks or CSRF tokens.
- **Comparing secret tokens with `===`.** Use `crypto.timingSafeEqual`.

## Key takeaways

- Injection and XSS happen when **user data is treated as code**. Keep data and code in separate channels.
- Stop **SQL injection** with **parameterised queries** and allow-lists for column names.
- Stop **NoSQL injection** by validating types and enabling Mongoose's `sanitizeFilter`.
- Stop **XSS** by escaping output (template engines do it with `<%= %>`), using `textContent` on the frontend, and adding a CSP as a backup.
- Stop **CSRF** on cookie-based auth with `SameSite` cookies, read-only `GET` routes, origin checks and CSRF tokens.

## Practice

1. Find every database query in your Notes API. Confirm none of them builds a query string by hand. Add an allow-list to any `sort` parameter.
2. Send `{"title": {"$ne": null}}` to a route that filters by title. Then add a Zod schema and `sanitizeFilter`, and send it again.
3. Build the vulnerable `/search` route, open `?q=<b>bold</b>` in your browser and see the HTML render. Fix it with an EJS template and confirm the tags now appear as text.
4. Add `provideCsrfToken` and `verifyCsrfToken` to a session-based app. Submit a form without the hidden field and confirm you get `403`.

## What's next

You now block the big three attacks. Next you will clean messy input and cap request sizes in [Input Sanitisation and Payload Limits](/courses/expressjs/input-sanitisation-and-payload-limits).
