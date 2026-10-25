---
publishDate: 2026-10-25T09:46
title: Input Sanitisation and Payload Limits
slug: input-sanitisation-and-payload-limits
metadescription: Learn to clean and normalise user input, sanitise rich HTML, block path traversal and prototype pollution, and cap body, file and query sizes in Express 5.
updateDate: 2026-10-25T09:46
author: ['bishal-biswas']
level: 3
tags: ['express', 'security', 'validation', 'sanitisation']
course: expressjs
---

## What you will learn

- The difference between **validation**, **sanitisation** and **escaping**
- How to trim, normalise and strip unknown fields with Zod
- How to safely accept rich HTML with `sanitize-html`
- How to block **path traversal** and **prototype pollution**
- How to cap body sizes, uploads, arrays and regex work so one request cannot exhaust your server

Every byte that arrives at your API is chosen by someone else. Most of the time it is a friendly app. This lesson is about the rest of the time.

## Validation, sanitisation and escaping

These three words are often mixed up. Each one has its own job and its own moment:

| Step | Question it answers | When | Example |
| --- | --- | --- | --- |
| **Validation** | "Is this input acceptable?" If not, reject it. | On the way in | Email must look like an email; age must be 0-150 |
| **Sanitisation** | "Can I clean this input into a safe, standard shape?" | On the way in | Trim spaces, lower-case an email, strip `<script>` from rich text |
| **Escaping** | "How do I put this data safely into HTML, SQL, a URL...?" | On the way out | `<` becomes `&lt;` in HTML |

Think of airport security. **Validation** checks that you have a valid ticket and turns you away if not. **Sanitisation** makes you put liquids in a clear bag so they fit the rules. **Escaping** is the crew stowing your bag safely in the overhead locker for that specific aircraft.

> **Note:** Prefer validation over sanitisation. Rejecting bad input with a clear `400` is safer and more predictable than silently "fixing" it. Sanitise only when there is a clear, standard cleaned form.

## Cleaning input with Zod

You met Zod in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod). Besides checking, Zod can also **normalise** values, so the rest of your code always sees one standard form.

```js
// validation/profile.js
import { z } from 'zod';

export const profileSchema = z.object({
  // "  Ada@Example.COM " -> "ada@example.com", then check the format
  email: z.string().trim().toLowerCase().pipe(z.email()),
  displayName: z.string().trim().min(1).max(50),
  bio: z.string().trim().max(500).optional(),
  age: z.coerce.number().int().min(13).max(150).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
```

Each line is doing quiet security work:

- **Trimming and lower-casing** the email stops duplicate accounts like `ada@example.com` and `Ada@example.com `.
- **`max()` on every string and array** stops someone from sending a 5 MB "display name" or 100,000 tags.
- **`z.coerce.number()`** turns `"42"` from a form or query into the number `42`, and rejects `"abc"`.

### Unknown fields: strip or reject

By default `z.object()` **strips** keys it does not know. That is what protected you against mass assignment in [Role-Based Authorization](/courses/expressjs/role-based-authorization): an extra `"role": "admin"` simply vanishes.

If you would rather tell clients they sent something unexpected, use `z.strictObject()`, which rejects unknown keys with a validation error:

```js
// validation/profile.js
export const strictProfileSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(50),
});
// { displayName: 'Ada', role: 'admin' } -> fails with an "unrecognized key" issue
```

### A reusable validation middleware

```js
// middleware/validate.js
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }
  req.body = result.data; // continue with the cleaned, typed data only
  next();
};
```

```js
// routes/profile.js
profileRouter.patch('/', validateBody(profileSchema), async (req, res) => {
  // req.body is trimmed, normalised and has no unknown keys
  const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true, runValidators: true });
  res.json(user);
});
```

### Watch out for repeated query parameters

Query strings can surprise you. In Express 5, `?tag=a&tag=b` gives you an **array**, `['a', 'b']`, not a string. Code like `req.query.tag.toLowerCase()` then crashes. Validate queries too:

```js
// routes/notes.js
const listQuery = z.object({
  tag: z.string().max(30).optional(), // an array here fails validation with a clear 400
  page: z.coerce.number().int().min(1).default(1),
});

notesRouter.get('/', async (req, res) => {
  const result = listQuery.safeParse(req.query);
  if (!result.success) return res.status(400).json({ errors: result.error.issues });
  // ...use result.data.tag and result.data.page
});
```

> **Note:** In Express 5, `req.query` is read-only, so you cannot replace it with the cleaned version as we did with `req.body`. Use the result of `safeParse` directly, or store it on something like `res.locals.query`.

## Sanitising rich HTML

Sometimes users really need to send HTML: a blog editor with bold text, lists and links. You cannot escape it (it would show raw tags) and you cannot trust it (it could contain scripts, as you saw in [Preventing Injection, XSS and CSRF](/courses/expressjs/preventing-injection-xss-csrf)).

The answer is an **HTML sanitiser**: a library that parses the HTML and keeps only an **allow-list** of safe tags and attributes. Everything else is removed.

```bash
npm install sanitize-html
```

```js
// utils/cleanHtml.js
import sanitizeHtml from 'sanitize-html';

const options = {
  allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'a', 'blockquote', 'code'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'], // blocks javascript: links
};

export const cleanHtml = (dirty) => sanitizeHtml(dirty, options);
```

```js
// validation/post.js
import { z } from 'zod';
import { cleanHtml } from '../utils/cleanHtml.js';

export const postSchema = z.object({
  title: z.string().trim().min(1).max(200),
  // limit the size first, then sanitise
  bodyHtml: z.string().max(20_000).transform(cleanHtml),
});
```

Feeding in this input:

```html
<p>Hello <b>world</b></p><script>steal()</script><a href="javascript:steal()">click</a>
```

gives back:

```html
<p>Hello <b>world</b></p><a>click</a>
```

The script is gone and the dangerous link lost its `href`.

> **Tip:** Never write your own HTML sanitiser with regular expressions. HTML has too many edge cases. Use a maintained library with an allow-list, and keep the list as short as your feature allows.

## Path traversal

### The attack

You serve user files with a route like this:

```js
// VULNERABLE
import path from 'node:path';

app.get('/files/:name', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'uploads', req.params.name));
});
```

Express decodes route parameters, so a request for `/files/..%2Fconfig%2Fdb.json` gives `req.params.name` the value `../config/db.json`. The `..` segment climbs out of `uploads`, and your server sends back your database settings file. This is **path traversal**: using `../` to walk out of the folder you meant to expose.

### The defences

1. **Use the `root` option of `res.sendFile`.** Express then refuses any path that tries to escape the root folder, and by default it also ignores dotfiles like `.env`:

```js
// safe
app.get('/files/:name', (req, res) => {
  res.sendFile(req.params.name, { root: path.join(process.cwd(), 'uploads') });
});
```

2. **Do not use user-supplied file names at all** if you can avoid it. Store uploads under random names (Multer does this by default, as you saw in [File Uploads with Multer](/courses/expressjs/file-uploads-with-multer)), keep the original name in your database, and look files up by ID.

3. **If you must take a name, reduce it** with `path.basename()`, which drops any folder parts, and check it against a simple pattern such as `/^[\w-]+\.(png|jpg|pdf)$/`.

## Prototype pollution

This one is specific to JavaScript, so it deserves a careful explanation.

Every plain object in JavaScript inherits from a shared parent called `Object.prototype`. If you add a property to that parent, **every object in your whole app** suddenly has it.

### The attack

Imagine a settings route that deep-merges the request body into a defaults object using a naive hand-written merge:

```js
// VULNERABLE: naive recursive merge
const merge = (target, source) => {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] ??= {};
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
};

app.patch('/settings', (req, res) => {
  merge(userSettings, req.body);
  res.json(userSettings);
});
```

An attacker sends:

```json
{ "__proto__": { "isAdmin": true } }
```

`target['__proto__']` is the shared `Object.prototype`, so the merge writes `isAdmin = true` onto it. Now `({}).isAdmin` is `true` for **every** object, including `req.user` objects that never had that property. Any check like `if (user.isAdmin)` passes for everyone.

### The defences

- **Validate with a schema.** A Zod object schema only copies the keys it knows, so `__proto__` never reaches your code.
- **Do not deep-merge untrusted objects.** Pick known fields explicitly, or use a well-maintained library that guards against these keys.
- **Use a `Map`** for dictionaries keyed by user input, as you did for the permissions table.
- **Check with `Object.hasOwn(obj, key)`** instead of `obj[key]` when the key came from a user.

## Payload limits

So far we have looked at *what* clients send. Now let's look at *how much*.

### The attack

Node.js runs your JavaScript on a single main thread. Parsing a JSON body happens on that thread. Imagine someone sends a 500 MB JSON body, or a thousand of them at once. Your server spends its memory and CPU on garbage while real users wait. This is a simple **denial of service (DoS)**: making a service unavailable by overloading it.

The defence is to set **limits** on every input channel and reject anything larger, early.

### Body size limits

`express.json()` already has a default limit of `100kb`. Make the limit explicit, keep it small, and raise it only where needed:

```js
// app.js
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ limit: '50kb', parameterLimit: 100 }));

// A specific route that genuinely needs more
app.post('/imports', express.json({ limit: '2mb' }), importHandler);
```

`parameterLimit` caps how many fields a form may contain (the default is 1000).

When a body is too large, the parser creates an error with status `413` and `type: 'entity.too.large'`. When JSON is broken, it creates one with status `400` and `type: 'entity.parse.failed'`. Handle both in your error handler from [Error-Handling Middleware](/courses/expressjs/error-handling-middleware):

```js
// middleware/errorHandler.js
import multer from 'multer';

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
};
```

Try it:

```bash
node -e "console.log(JSON.stringify({ text: 'x'.repeat(200000) }))" > big.json
curl -i -X POST http://localhost:3000/notes -H "Content-Type: application/json" --data-binary @big.json
# HTTP/1.1 413 Payload Too Large
```

### Requiring the right content type

`express.json()` only parses requests whose `Content-Type` is JSON. For anything else, `req.body` stays `undefined`. For a JSON-only API, reject other types clearly with `415 Unsupported Media Type`:

```js
// middleware/requireJson.js
export const requireJson = (req, res, next) => {
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(req.method);
  if (hasBody && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
};
```

### Upload limits

Multer has no file size limit unless you set one. Always set `limits`:

```js
// routes/avatar.js
import multer from 'multer';

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB per file
    files: 1,                  // one file per request
    fields: 10,                // non-file fields
  },
  fileFilter: (req, file, cb) => {
    cb(null, ['image/png', 'image/jpeg'].includes(file.mimetype));
  },
});

avatarRouter.post('/', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A PNG or JPEG image is required' });
  res.status(201).json({ id: req.file.filename });
});
```

> **Warning:** `file.mimetype` comes from the client and can be faked. It is a useful first filter, not proof. Serve uploads with `nosniff` (Helmet) and, for high-risk apps, check the file's real content with an image library.

### Slow regular expressions (ReDoS)

Some regular expressions take **exponentially** longer on certain inputs. A pattern with nested repetition such as `/^(a+)+$/`, tested against a long string of `a`s followed by one `!`, can keep the CPU busy for seconds or more. Because Node has one main thread, *every other request waits*. This is called **ReDoS** (regular expression denial of service).

Defences:

- **Check length first.** `z.string().max(100)` before any regex keeps the input small.
- **Avoid nested quantifiers** like `(a+)+` or `(.*)*` in your own patterns.
- **Prefer built-in validators** (`z.email()`, `z.url()`, `URL` parsing) over home-made patterns.

### Slow clients and timeouts

A client can also attack by being **slow**: opening a connection and sending one byte every few seconds, holding a slot open for as long as possible. Node's HTTP server has timeouts for this. You can tighten them on the server object that `app.listen()` returns:

```js
// server.js
import { app } from './app.js';

const server = app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});

server.headersTimeout = 20_000; // the client must send all headers within 20 s
server.requestTimeout = 30_000; // the whole request must arrive within 30 s
```

In production, your reverse proxy usually enforces similar limits too.

## A checklist of limits

| Input channel | Limit with |
| --- | --- |
| JSON body | `express.json({ limit })` |
| Form body | `express.urlencoded({ limit, parameterLimit })` |
| Uploads | `multer({ limits: { fileSize, files, fields } })` |
| Individual strings and arrays | Zod `.max()` |
| Regex work | Length limits first, simple patterns |
| Request rate | `express-rate-limit` ([Rate Limiting and Throttling](/courses/expressjs/rate-limiting)) |
| Slow connections | `server.headersTimeout`, `server.requestTimeout`, proxy timeouts |

## Common mistakes

> **Common mistake:** Raising `express.json({ limit: '50mb' })` globally because one route needed it. Raise limits only on the routes that need them.

- **Sanitising instead of validating.** Silently "fixing" bad input hides bugs and attacks. Reject when in doubt.
- **No `max()` on strings and arrays.** Small limits everywhere add up to a big safety margin.
- **Trusting `file.mimetype` or the original file name.** Both come from the client.
- **Joining user input into file paths** without `root` or `basename`.
- **Deep-merging request bodies** into existing objects.
- **Assuming a query parameter is a string.** Repeated parameters arrive as arrays.

## Key takeaways

- **Validate** on the way in, **sanitise** only when there is a clear safe form, and **escape** on the way out.
- Use Zod to trim, normalise, cap sizes and strip unknown keys, and validate `req.query` as well as `req.body`.
- Accept rich HTML only through an allow-list sanitiser such as `sanitize-html`.
- Block **path traversal** with `res.sendFile(name, { root })` and random file names, and **prototype pollution** with schemas instead of deep merges.
- Put a **limit on every input channel**: body size, uploads, field counts, string lengths, regex input and connection time.

## Practice

1. Add `validateBody(profileSchema)` to a profile route and send an email with spaces and capital letters. Confirm it is stored trimmed and lower-cased.
2. Send a 200 KB JSON body to your Notes API and make sure you get a clean `413` JSON error, not an HTML stack trace.
3. Create the vulnerable `/files/:name` route, request `/files/..%2Fpackage.json` and see what happens. Then switch to the `root` option and try again.
4. Run `sanitize-html` on a string containing `<img src=x onerror=alert(1)>` with the options above. What comes out, and why?

## What's next

Limits stop huge requests from hurting you. Next, you will learn to send huge *responses* efficiently in [Streaming Responses and Backpressure](/courses/expressjs/streaming-responses).
