---
publishDate: 2026-10-25T09:40
title: Session and Cookie Authentication with Passport
slug: passport-authentication
metadescription: Build cookie-based login in Express 5 with Passport 0.7, passport-local and express-session, and learn how sessions compare to JWTs and how to log users out safely.
updateDate: 2026-10-25T09:40
author: ['bishal-biswas']
level: 3
tags: ['express', 'passport', 'sessions', 'authentication']
course: expressjs
---

## What you will learn

- How **session-based authentication** works and how it differs from JWTs
- What **Passport** is and what a **strategy** does
- How to log users in with `passport-local` and `express-session`
- How `serializeUser` and `deserializeUser` connect a session to a user
- How to protect routes, log out correctly and avoid **session fixation**

In the last lesson you built token login for an API. Many apps, especially classic websites with server-rendered pages, use a different approach: a **session** stored on the server and a cookie in the browser. Passport is the most popular way to wire this up in Express.

## How session login works

You met sessions in [Sessions with express-session](/courses/expressjs/sessions-with-express-session). A **session** is a small record the server keeps for each visitor. The browser only holds a random **session ID** in a cookie.

Think of a coat check at a theatre. You hand over your coat, and you get a numbered ticket. The ticket itself is worthless; it only points to your coat behind the counter. If you lose the ticket, staff can cancel it.

Session login works the same way:

```text
1. POST /login (email + password)
      server checks the password
      server stores { userId: 42 } in a new session
      response: Set-Cookie: sid=s%3AaB9x...; HttpOnly; SameSite=Lax

2. GET /dashboard
      browser sends Cookie: sid=s%3AaB9x...
      server looks up the session -> userId 42 -> loads the user

3. POST /logout
      server destroys the session; the old cookie now points to nothing
```

## Sessions vs JWTs

Neither approach is "better". They make different trade-offs.

| | Sessions (this lesson) | JWT access tokens (last lesson) |
| --- | --- | --- |
| What the client holds | A random ID in a cookie | A signed token |
| Where user state lives | Server-side session store | Inside the token |
| Log out / ban instantly | Yes, delete the session | Not until the token expires |
| Extra lookup per request | Yes, in the session store | No |
| Sent automatically by browsers | Yes (cookie) | No, your code adds the header |
| Needs CSRF protection | Yes | Not for header-based tokens |
| Great for | Server-rendered sites, same-domain SPAs | Mobile apps, third-party API clients |

> **Tip:** If your frontend and API live on the same site and you are not sure which to pick, sessions are simpler to get right. You can revoke them instantly, and an `httpOnly` cookie keeps the session ID away from JavaScript.

## What is Passport?

**Passport** is authentication middleware for Express. It does not decide *how* users prove who they are. Instead, it uses plug-in modules called **strategies**:

- `passport-local`: email (or username) and password
- `passport-google-oauth20`, `passport-github2`: "Log in with Google/GitHub"
- `passport-jwt`: bearer tokens

Each strategy answers one question: "Given this request, who is the user?" Passport handles the rest: storing the user in the session and putting it on `req.user` for every later request.

## Project setup

```bash
npm install express express-session passport passport-local bcrypt
```

```bash
# .env
SESSION_SECRET=a-long-random-string-change-me
NODE_ENV=development
```

Generate a real secret the same way you did for JWTs (`crypto.randomBytes(64).toString('hex')`). We reuse the small in-memory user store from the last lesson:

```js
// users.js
import bcrypt from 'bcrypt';

export const users = [
  {
    id: '42',
    email: 'ada@example.com',
    role: 'user',
    passwordHash: await bcrypt.hash('demo-password-change-me', 12),
  },
];

export const findUserByEmail = async (email) =>
  users.find((u) => u.email === email.toLowerCase()) ?? null;

export const findUserById = async (id) => users.find((u) => u.id === id) ?? null;
```

The functions are `async` so they look like real database calls.

## Step 1: configure the strategy

The **verify function** receives the email and password from the request. It must call `done` in one of three ways:

| Call | Meaning |
| --- | --- |
| `done(null, user)` | Login succeeded |
| `done(null, false, { message })` | Wrong credentials |
| `done(err)` | Something broke (database down, etc.) |

```js
// auth/passport.js
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { findUserByEmail, findUserById } from '../users.js';

passport.use(
  new LocalStrategy(
    { usernameField: 'email' }, // read req.body.email instead of req.body.username
    async (email, password, done) => {
      try {
        const user = await findUserByEmail(email);
        const ok = user && (await bcrypt.compare(password, user.passwordHash));
        if (!ok) return done(null, false, { message: 'Invalid email or password' });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    },
  ),
);
```

## Step 2: serialize and deserialize

After login, Passport has to decide **what to store in the session**. Storing the whole user object would be wasteful and would go stale if the user changes their name. So you store only the ID.

- **`serializeUser`** runs once, at login: user object to session data.
- **`deserializeUser`** runs on every later request: session data back to a user object, which becomes `req.user`.

```js
// auth/passport.js (continued)
passport.serializeUser((user, done) => {
  done(null, user.id); // only the ID goes into the session
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await findUserById(id);
    if (!user) return done(null, false); // user was deleted: treat as logged out
    const { passwordHash, ...safeUser } = user; // never expose the hash
    done(null, safeUser);
  } catch (err) {
    done(err);
  }
});

export default passport;
```

> **Note:** Because `deserializeUser` loads the user fresh on each request, a role change or account ban takes effect immediately. That is one advantage of sessions over JWTs.

## Step 3: wire up the app

Order matters. The session middleware must run before Passport, and both must run before your routes.

```js
// app.js
import express from 'express';
import session from 'express-session';
import passport from './auth/passport.js';
import { authRouter } from './routes/auth.js';

export const app = express();

app.set('trust proxy', 1); // only if you run behind one reverse proxy (needed for secure cookies)

app.use(express.json());
app.use(express.urlencoded()); // for HTML login forms

app.use(
  session({
    name: 'sid',                         // don't use the default name "connect.sid"
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,            // no session until someone logs in
    cookie: {
      httpOnly: true,                    // JavaScript cannot read it
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax',                   // not sent on most cross-site requests
      maxAge: 1000 * 60 * 60 * 8,        // 8 hours
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session()); // reads the session and runs deserializeUser

app.use('/auth', authRouter);
```

> **Warning:** The default `MemoryStore` used by `express-session` loses all sessions on restart and leaks memory over time. It is fine for learning. In production use a real store such as `connect-redis` or `connect-mongo`, as shown in the sessions lesson.

## Step 4: the login, logout and "me" routes

For a JSON API, use Passport's **custom callback** form so you control the response.

```js
// routes/auth.js
import { Router } from 'express';
import passport from '../auth/passport.js';
import { requireLogin } from '../middleware/requireLogin.js';

export const authRouter = Router();

authRouter.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ error: info?.message ?? 'Invalid email or password' });
    }
    // req.login stores the user in the session (and creates a fresh session ID)
    req.login(user, (err) => {
      if (err) return next(err);
      res.json({ id: user.id, email: user.email });
    });
  })(req, res, next);
});

authRouter.get('/me', requireLogin, (req, res) => {
  res.json(req.user);
});

authRouter.post('/logout', requireLogin, (req, res, next) => {
  req.logout((err) => {          // Passport 0.6+ requires this callback
    if (err) return next(err);
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('sid', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      res.status(204).end();
    });
  });
});
```

And the guard middleware, which plays the same role as `requireAuth` from the JWT lesson:

```js
// middleware/requireLogin.js
export const requireLogin = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Please log in' });
};
```

`req.isAuthenticated()` is added by Passport. It returns `true` when `req.user` was loaded from the session.

### Try it

```bash
curl -c jar.txt -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"demo-password-change-me"}'
# {"id":"42","email":"ada@example.com"}

curl -b jar.txt http://localhost:3000/auth/me
# {"id":"42","email":"ada@example.com","role":"user"}

curl -b jar.txt -X POST http://localhost:3000/auth/logout -i
# HTTP/1.1 204 No Content

curl -b jar.txt http://localhost:3000/auth/me
# {"error":"Please log in"}
```

### The HTML form version

For a server-rendered site, Passport can redirect for you:

```js
// routes/auth.js (form-based login, added to the same router)
authRouter.post(
  '/login-form',
  passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login?error=1',
  }),
);
```

```html
<!-- views/login.ejs -->
<form method="post" action="/auth/login-form">
  <input type="email" name="email" required>
  <input type="password" name="password" required>
  <button>Log in</button>
</form>
```

## Session fixation: why a new session ID matters

Here is an attack that sessions are vulnerable to if you are careless.

Imagine an attacker visits your site and gets a session ID, say `abc123`. They then trick a victim into using that same session ID (for example, on a shared computer where they planted the cookie). The victim logs in. If the server simply adds `userId: 42` to the existing session `abc123`, the attacker, who still knows `abc123`, is now logged in as the victim. This is called **session fixation**.

The defence is simple: **give the user a brand-new session ID at the moment they log in.** Since version 0.6, Passport does this for you inside `req.login()` by calling `req.session.regenerate()`. That is also why `req.logout()` now needs a callback: it does asynchronous session work too.

> **Common mistake:** Writing your own login that sets `req.session.userId = user.id` without calling `req.session.regenerate()` first. If you ever skip Passport, regenerate the session yourself on login.

## Sessions and CSRF

Cookies are sent automatically by the browser, even when another website triggers the request. That opens the door to **CSRF** (Cross-Site Request Forgery): an evil page can make your logged-in user's browser send a `POST` to your app.

`sameSite: 'lax'` blocks most of these, because the cookie is not sent on cross-site `POST` requests. For full protection you add CSRF tokens or origin checks, which you will build in [Preventing Injection, XSS and CSRF](/courses/expressjs/preventing-injection-xss-csrf).

## Common mistakes

- **Wrong middleware order.** `passport.session()` before `session()` means there is no session to read, and `req.user` is always empty.
- **Storing the whole user in the session.** Serialize only the ID. Load fresh data in `deserializeUser`.
- **Leaking the password hash.** Strip `passwordHash` in `deserializeUser`, or select only safe fields from the database.
- **`req.logout()` without a callback.** In Passport 0.6 and newer this throws an error. Always pass a callback.
- **A weak or committed `SESSION_SECRET`.** Anyone with the secret can forge signed session cookies. Keep it long, random and in `.env`.
- **`secure: true` on plain HTTP in development.** The browser will not store the cookie, and login "silently" fails. Tie it to `NODE_ENV` as shown.
- **Different error messages for "unknown email" and "wrong password".** Use one generic message so attackers cannot discover which emails exist.

## Key takeaways

- **Sessions** keep user state on the server; the browser only holds a random session ID in an `httpOnly` cookie.
- **Passport** handles login through **strategies**; `passport-local` checks an email and password.
- `serializeUser` stores the user ID in the session; `deserializeUser` turns it back into `req.user` on each request.
- Use `req.isAuthenticated()` to protect routes, and `req.logout(callback)` plus `req.session.destroy()` to log out.
- Passport regenerates the session ID on login, which stops **session fixation**. Cookie-based auth also needs **CSRF** protection.

## Practice

1. Add a `/dashboard` route that returns `"Welcome, <email>"` only to logged-in users and `401` to everyone else.
2. Log in with `curl`, then restart the server and call `/auth/me` again. Explain the result, then switch to a persistent store such as `connect-mongo`.
3. Print `req.sessionID` before and after a successful login. Confirm the ID changes.
4. Write down one app you use that probably uses sessions and one that probably uses tokens. What clues tell you?

## What's next

Now your app knows *who* each user is. Next you will decide *what* each user is allowed to do in [Role-Based Authorization](/courses/expressjs/role-based-authorization).
