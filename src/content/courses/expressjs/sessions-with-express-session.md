---
publishDate: 2026-10-25T09:28
title: Sessions with express-session
slug: sessions-with-express-session
metadescription: Learn how sessions keep per-user data on the server with express-session, configure secure session cookies, build a simple login and logout, and move sessions to Redis.
updateDate: 2026-10-25T09:28
author: ['bishal-biswas']
level: 2
tags: ['express', 'sessions', 'express-session', 'authentication']
course: expressjs
---

## What you will learn

- What a **session** is and how it differs from storing data in a cookie
- How to set up **express-session** with safe options
- How to read and write `req.session`, and build a simple login and logout
- Why you must **regenerate** the session on login
- Why the default memory store is not for production, and how to use **Redis** instead

## Cookies alone are not enough

In the last lesson you stored small values in cookies. That works for a theme, but it has limits:

- Cookies are small (about 4 KB).
- Users can **read** every cookie, even signed ones.
- Data you want to trust, such as "this user is logged in as Asha", should not live on the user's computer.

A **session** solves this. The server keeps the data and gives the browser only a random **session ID**: a long, unguessable string. The browser stores the ID in a cookie and sends it back on every request. The server looks up the ID and finds that visitor's data.

**Think of it like a hotel key card.** The card itself holds no information about you, just a code. The front desk's computer knows which room that code opens, how long you are staying and what you ordered. Lose the card, and nobody learns anything about you from it.

```text
Browser                                  Server
-------                                  ------
Cookie: sid=s%3A9fK2...   ----------->   session store
                                         +-----------------------------+
                                         | 9fK2... -> { user: 'Asha',  |
                                         |              cart: [3, 7] } |
                                         +-----------------------------+
                          <-----------   req.session = { user, cart }
```

## Setting up express-session

```bash
npm install express-session
```

Put the secret used to sign the session ID cookie in your `.env` file:

```bash
# .env
SESSION_SECRET=change-me-to-a-long-random-string
```

Now a minimal app that counts page views per visitor:

```js
// app.js (run with: node --env-file=.env app.js, Node 20.6+)
import express from 'express';
import session from 'express-session';

const app = express();

app.use(
  session({
    name: 'sid',                         // cookie name (default is "connect.sid")
    secret: process.env.SESSION_SECRET,  // signs the session ID cookie
    resave: false,                       // don't save unchanged sessions
    saveUninitialized: false,            // don't create empty sessions
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,       // 1 day
    },
  }),
);

app.get('/', (req, res) => {
  req.session.views = (req.session.views ?? 0) + 1;
  res.send(`You have viewed this page ${req.session.views} times`);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Try it with curl, saving and resending the cookie:

```bash
curl -c cookies.txt -b cookies.txt http://localhost:3000/
curl -c cookies.txt -b cookies.txt http://localhost:3000/
curl -c cookies.txt -b cookies.txt http://localhost:3000/
```

```text
You have viewed this page 1 times
You have viewed this page 2 times
You have viewed this page 3 times
```

Run it without `-b cookies.txt` and you always see `1`, because every request looks like a brand-new visitor.

> **Note:** express-session reads and writes its own cookie. You do **not** need `cookie-parser` for sessions.

## The important options

These options trip up almost everyone at first, so let's go through them one by one.

| Option | What it means | Recommended |
| --- | --- | --- |
| `secret` | Used to sign the session ID cookie so it cannot be forged. Can be an array to rotate secrets. | From `process.env`, long and random |
| `resave` | Save the session back to the store on every request, even if nothing changed. | `false` |
| `saveUninitialized` | Save brand-new sessions that have no data yet. | `false` |
| `name` | Name of the session cookie. | Something generic, like `'sid'` |
| `cookie` | Options for the session cookie, same ideas as the last lesson. | `httpOnly`, `secure`, `sameSite`, `maxAge` |
| `rolling` | Reset the cookie's expiry on every response, so active users stay logged in. | Optional |
| `store` | Where session data lives. Default: in memory. | A real store in production |

Why `saveUninitialized: false`? Without it, **every** visitor, including bots and people who never log in, gets a session saved in your store and a cookie in their browser. With `false`, a session is only saved once you put something in it. That saves storage and avoids setting cookies before they are needed.

Why `resave: false`? Saving unchanged sessions wastes work, and with two requests in parallel, one can overwrite the other's changes.

> **Tip:** The default cookie name `connect.sid` tells everyone you use Express sessions. Giving it a neutral name like `sid` is a small, free improvement.

## Working with req.session

`req.session` is an object you can read and write like any other. express-session saves your changes automatically at the end of the request.

```js
// app.js
app.use(express.json());

app.post('/cart', (req, res) => {
  const productId = req.body?.productId;
  if (!productId) {
    return res.status(400).json({ error: 'productId is required' });
  }
  req.session.cart ??= []; // create the cart the first time
  req.session.cart.push(productId);
  res.json({ cart: req.session.cart });
});

app.get('/cart', (req, res) => {
  res.json({ cart: req.session.cart ?? [] });
});
```

Each visitor has their own cart, and the browser only ever sees the session ID.

Session data is stored as JSON, so keep to plain values: strings, numbers, booleans, arrays and simple objects. Do not store functions, class instances or database connections.

## A simple login and logout

Sessions are the classic way to remember who is logged in. Here is a small but correct version. To keep the focus on sessions, it accepts any username without a password. You will add real password checks in [Password Hashing and Account Security](/courses/expressjs/password-hashing-and-account-security) and full login flows in [Session and Cookie Authentication with Passport](/courses/expressjs/passport-authentication).

```js
// app.js
app.use(express.json());

app.post('/login', (req, res, next) => {
  const username = req.body?.username;
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  // start a fresh session to prevent session fixation
  req.session.regenerate((err) => {
    if (err) return next(err);

    req.session.user = { username };

    // make sure the session is saved before we answer
    req.session.save((err) => {
      if (err) return next(err);
      res.json({ message: `Logged in as ${username}` });
    });
  });
});

const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Please log in' });
  }
  next();
};

app.get('/me', requireLogin, (req, res) => {
  res.json({ user: req.session.user });
});

app.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid'); // same name as the "name" option
    res.json({ message: 'Logged out' });
  });
});
```

Try the full flow:

```bash
curl -c cookies.txt -b cookies.txt http://localhost:3000/me
curl -c cookies.txt -b cookies.txt -X POST http://localhost:3000/login -H "Content-Type: application/json" -d '{"username":"asha"}'
curl -c cookies.txt -b cookies.txt http://localhost:3000/me
curl -c cookies.txt -b cookies.txt -X POST http://localhost:3000/logout
curl -c cookies.txt -b cookies.txt http://localhost:3000/me
```

```text
{"error":"Please log in"}
{"message":"Logged in as asha"}
{"user":{"username":"asha"}}
{"message":"Logged out"}
{"error":"Please log in"}
```

### Why regenerate on login?

**Session fixation** is an attack where someone tricks a victim into using a session ID the attacker already knows. If your app keeps that same ID after the victim logs in, the attacker's copy of the ID is now logged in too.

**`req.session.regenerate()`** throws away the old session and creates a new one with a fresh, unknown ID. Always do this right after a successful login, and whenever a user's permissions change.

### Callbacks and Express 5 error forwarding

Notice the `if (err) return next(err)` lines. `regenerate`, `save` and `destroy` use **callbacks**, not promises. As you learned in [Async Routes and Automatic Error Forwarding](/courses/expressjs/async-routes-and-error-forwarding), Express 5 only catches errors from **returned promises**. An error inside a callback is your job to forward with `next(err)`.

If you prefer `await`, you can wrap them with Node's `promisify`:

```js
// app.js
import { promisify } from 'node:util';

app.post('/login', async (req, res) => {
  const username = req.body?.username;
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }
  await promisify(req.session.regenerate.bind(req.session))();
  req.session.user = { username };
  await promisify(req.session.save.bind(req.session))();
  res.json({ message: `Logged in as ${username}` });
});
```

Now any store error rejects the promise, and Express 5 forwards it to your error handler automatically. The `.bind(req.session)` part makes sure the method still knows which session it belongs to.

## Useful session methods and properties

| Name | What it does |
| --- | --- |
| `req.sessionID` | The current session's ID |
| `req.session.regenerate(cb)` | Replace the session with a new empty one and a new ID |
| `req.session.destroy(cb)` | Delete the session from the store |
| `req.session.save(cb)` | Save now, instead of waiting for the end of the request |
| `req.session.reload(cb)` | Reload the data from the store |
| `req.session.cookie.maxAge` | Time left before the cookie expires, in milliseconds |

## Where are sessions stored?

By default, express-session keeps sessions in a **MemoryStore**: a plain object inside your Node process. That is fine for learning, but the package itself warns that it is not meant for production:

- **Restarting the server logs everyone out.** All sessions vanish with the process.
- **It leaks memory over time** and is not designed to clean up at scale.
- **It does not work with more than one server process.** If you run two copies of your app behind a load balancer, each has its own memory, so a user logged in on one is a stranger to the other.

In production you use a **session store**: a database that all your server processes share. **Redis**, a very fast in-memory database, is the most popular choice.

### Using Redis with connect-redis

```bash
npm install redis connect-redis
```

```bash
# .env
SESSION_SECRET=change-me-to-a-long-random-string
REDIS_URL=redis://localhost:6379
```

```js
// app.js (sessions stored in Redis)
import express from 'express';
import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error', err));
await redisClient.connect(); // top-level await works in ES modules

const app = express();

app.use(
  session({
    store: new RedisStore({ client: redisClient, prefix: 'myapp:sess:' }),
    name: 'sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);
```

Everything else stays the same. Your routes still read and write `req.session`; only the storage location changed. Redis also deletes expired sessions automatically, using the cookie's `maxAge` as the time to live.

> **Note:** Older versions of `connect-redis` used a default import (`import RedisStore from 'connect-redis'`). Recent versions use the named import shown above. Check the version you install if you see "does not provide an export named" errors.

Prefer MongoDB? The **`connect-mongo`** package works the same way: `store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI })`. You will learn more about Redis itself in [Caching with Redis and HTTP Cache Headers](/courses/expressjs/caching-with-redis).

## Sessions behind a proxy

In production, your app often runs behind a **reverse proxy** such as Nginx or a hosting platform's load balancer. The proxy handles HTTPS and talks to your app over plain HTTP. Express then thinks the connection is insecure and **refuses to set** a cookie marked `secure: true`.

The fix is to tell Express to trust the proxy's information:

```js
// app.js
app.set('trust proxy', 1); // trust the first proxy in front of the app
```

If your session cookie mysteriously never appears in production, this is the first thing to check. The details are covered in [Reverse Proxies and Trusting Proxy Headers](/courses/expressjs/reverse-proxies-and-trust-proxy).

## Sessions vs tokens

You may have heard of **JWTs** (JSON Web Tokens), another way to remember logged-in users. Here is the short version:

| | Sessions | JWT tokens |
| --- | --- | --- |
| Where data lives | On the server (store) | Inside the token, on the client |
| Logging someone out | Delete the session: instant | Hard until the token expires |
| Needs a shared store | Yes, for multiple servers | No |
| Typical use | Websites with server-rendered pages | APIs for mobile and single-page apps |

Both are valid. You will build JWT authentication in [JWT Authentication](/courses/expressjs/jwt-authentication).

## Common mistakes

> **Common mistake:** Hard-coding the secret, like `secret: 'keyboard cat'` from old tutorials. Anyone who reads your code can forge session cookies. Load it from `process.env`.

> **Common mistake:** Using the default MemoryStore in production. Users get logged out on every deploy, and multiple server instances do not share logins.

> **Common mistake:** Forgetting `regenerate()` on login, which leaves your app open to session fixation.

> **Common mistake:** Clearing the wrong cookie on logout. If you set `name: 'sid'`, you must call `res.clearCookie('sid')`, not `'connect.sid'`.

## Key takeaways

- A **session** stores data on the server; the browser only holds a signed, random **session ID** cookie.
- Configure express-session with a secret from `process.env`, **`resave: false`**, **`saveUninitialized: false`** and a secure cookie.
- Read and write data with **`req.session`**. Call **`regenerate()`** on login and **`destroy()`** on logout.
- Session methods use callbacks, so forward their errors with `next(err)` or wrap them with `promisify`.
- Use a real store like **Redis** in production, and `app.set('trust proxy', 1)` behind a proxy.

## Practice

1. Build the page-view counter and confirm that two different browsers (or a private window) get separate counts.
2. Add the login, `/me` and logout routes. Check in your browser's developer tools that the session ID changes after logging in.
3. Store a `lastVisit` timestamp in the session and show "Welcome back, your last visit was ..." on each page.
4. If you have Docker, start Redis with `docker run -p 6379:6379 redis`, switch to `connect-redis`, restart your app and confirm you stay logged in.

## What's next

Sessions remember who a user is. Next, let users send you more than text: images, documents and other files. Continue with [File Uploads with Multer](/courses/expressjs/file-uploads-with-multer).
