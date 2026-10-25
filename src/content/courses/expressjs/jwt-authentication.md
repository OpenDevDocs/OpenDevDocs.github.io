---
publishDate: 2026-10-25T09:39
title: JWT Authentication
slug: jwt-authentication
metadescription: Learn how JSON Web Tokens work and how to add secure login to an Express 5 API with short-lived access tokens, refresh tokens in httpOnly cookies and an auth middleware.
updateDate: 2026-10-25T09:39
author: ['bishal-biswas']
level: 3
tags: ['express', 'jwt', 'authentication', 'security']
course: expressjs
---

## What you will learn

- The difference between **authentication** and **authorization**
- What a **JSON Web Token (JWT)** is, what is inside it, and why it cannot be faked
- How to build a login route that issues a short-lived **access token**
- How to protect routes with an auth middleware that reads the `Authorization` header
- How to use a **refresh token** in an `httpOnly` cookie so users stay logged in safely

Your Notes API from the last project works, but anyone can read or delete anyone's notes. In this lesson you add the first real security layer: proving who is making each request.

## Authentication vs authorization

These two words sound alike, and beginners mix them up all the time.

- **Authentication** answers "**Who are you?**" You prove your identity, usually with an email and password.
- **Authorization** answers "**What are you allowed to do?**" Once the server knows who you are, it decides whether you may delete this note or open the admin page.

Think of a hotel. Showing your passport at the front desk is authentication. The key card that only opens *your* room is authorization. This lesson is about the front desk. You will build the key-card rules in [Role-Based Authorization](/courses/expressjs/role-based-authorization).

## The problem: HTTP forgets you

HTTP is **stateless**: every request arrives on its own, with no memory of earlier requests. If you log in with one request, the next request does not "know" you logged in.

So after a successful login, the server must hand the client something to show on every later request. There are two popular choices:

| Approach | What the client keeps | Where the server checks it |
| --- | --- | --- |
| **Sessions** | A random session ID in a cookie | Looks up the ID in a session store |
| **Tokens (JWT)** | A signed token | Checks the token's signature, no lookup needed |

You will build session login with Passport in the next lesson. Here you build token login, which is very common for APIs used by mobile apps and single-page apps.

## What is a JWT?

A **JSON Web Token** is a short string made of three parts separated by dots:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzYxMzg0MDAwLCJleHAiOjE3NjEzODQ5MDB9.k3Z...signature
        header                                         payload                                                          signature
```

1. **Header**: which algorithm signed the token, for example `HS256`.
2. **Payload**: the **claims**, small facts about the user. Standard claim names include `sub` (subject, the user ID), `iat` (issued at) and `exp` (expires at).
3. **Signature**: a cryptographic stamp made from the header, the payload and a **secret** that only your server knows.

The header and payload are just JSON encoded with **Base64URL**, a way of turning bytes into URL-safe text. Decoded, the payload above is:

```json
{
  "sub": "42",
  "role": "user",
  "iat": 1761384000,
  "exp": 1761384900
}
```

> **Warning:** Base64URL is *encoding*, not encryption. Anyone who gets the token can read the payload. Never put passwords, card numbers or other private data inside a JWT.

### Why a JWT cannot be faked

Imagine a user decodes their token, changes `"role": "user"` to `"role": "admin"`, and re-encodes it. When that token reaches your server, you recompute the signature using your secret. The new payload produces a different signature, so the check fails and the token is rejected.

Without your secret, nobody can produce a valid signature. That is why the secret must be long, random and kept out of your code.

```text
Login ──> server signs { sub: 42 } with SECRET ──> token
Later request with token ──> server re-signs header+payload with SECRET
                              signatures match?  yes -> trusted
                                                 no  -> 401 Unauthorized
```

## Project setup

Install the libraries. `jsonwebtoken` creates and checks tokens. `bcrypt` checks hashed passwords (you will study hashing properly in [Password Hashing and Account Security](/courses/expressjs/password-hashing-and-account-security)). `cookie-parser` reads cookies.

```bash
npm install express jsonwebtoken bcrypt cookie-parser
```

Generate a strong secret once and put it in `.env`:

```bash
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
```

```bash
# .env  (never commit this file)
JWT_ACCESS_SECRET=paste-the-long-random-string-here
NODE_ENV=development
```

We will run the app with `node --env-file=.env server.js`, which needs Node.js 20 or newer.

## A tiny user store

To keep the focus on authentication, we use an in-memory user list instead of MongoDB or SQL. In your Notes API you would look users up in the database instead.

```js
// users.js
import bcrypt from 'bcrypt';

// Demo only: one user with a hashed password, created at startup
export const users = [
  {
    id: '42',
    email: 'ada@example.com',
    role: 'user',
    passwordHash: await bcrypt.hash('demo-password-change-me', 12),
  },
];

export const findUserByEmail = (email) =>
  users.find((u) => u.email === email.toLowerCase());

export const findUserById = (id) => users.find((u) => u.id === id);
```

> **Note:** Top-level `await` works here because we use ES modules (`"type": "module"` in `package.json`).

## Signing and verifying tokens

Keep all token code in one small module. Then every route uses the same settings.

```js
// auth/tokens.js
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
if (!ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is not set');

export const signAccessToken = (user) =>
  jwt.sign(
    { role: user.role },          // payload: small, non-secret facts
    ACCESS_SECRET,
    {
      subject: user.id,           // becomes the "sub" claim
      expiresIn: '15m',           // short life: a stolen token expires soon
      algorithm: 'HS256',
    },
  );

// Throws if the token is expired, tampered with or malformed
export const verifyAccessToken = (token) =>
  jwt.verify(token, ACCESS_SECRET, { algorithms: ['HS256'] });
```

Two details matter here:

- **`expiresIn: '15m'`**: an **access token** is the token sent with every API call. Keep it short-lived. If someone steals it, it stops working in minutes.
- **`algorithms: ['HS256']`**: always tell `verify` exactly which algorithm you accept. This blocks tricks where an attacker sends a token claiming a different (weaker) algorithm.

## The login route

The login route checks the email and password, then returns an access token.

```js
// routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { findUserByEmail } from '../users.js';
import { signAccessToken } from '../auth/tokens.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = findUserByEmail(email);
  const passwordOk = user && (await bcrypt.compare(password, user.passwordHash));

  if (!passwordOk) {
    // Same message for "no such user" and "wrong password"
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json({ accessToken: signAccessToken(user) });
});
```

> **Tip:** Never tell the client *which* part was wrong. "No account with that email" lets an attacker discover which emails are registered. One generic message is safer.

## Protecting routes with middleware

Clients send the token in the `Authorization` header using the **Bearer** scheme, which simply means "whoever bears (carries) this token":

```http
GET /me HTTP/1.1
Host: localhost:3000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

An auth middleware reads that header, verifies the token, and stores the user on `req` for later handlers.

```js
// middleware/requireAuth.js
import { verifyAccessToken } from '../auth/tokens.js';

export const requireAuth = (req, res, next) => {
  const [scheme, token] = (req.get('Authorization') ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.set('WWW-Authenticate', 'Bearer');
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token';
    res.status(401).json({ error: message });
  }
};
```

`jwt.verify` throws a `TokenExpiredError` for an old token and a `JsonWebTokenError` for a broken or forged one. Both become a `401 Unauthorized`.

Now wire it up:

```js
// app.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { requireAuth } from './middleware/requireAuth.js';
import { findUserById } from './users.js';

export const app = express();
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRouter);

// Protected route: only reachable with a valid token
app.get('/me', requireAuth, (req, res) => {
  const user = findUserById(req.user.id);
  res.json({ id: user.id, email: user.email, role: user.role });
});
```

```js
// server.js
import { app } from './app.js';

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('API on http://localhost:3000');
});
```

Try it:

```bash
node --env-file=.env server.js

curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"demo-password-change-me"}'
# {"accessToken":"eyJhbGciOi..."}

curl http://localhost:3000/me -H "Authorization: Bearer PASTE_TOKEN_HERE"
# {"id":"42","email":"ada@example.com","role":"user"}

curl -i http://localhost:3000/me
# HTTP/1.1 401 Unauthorized
```

## Staying logged in: refresh tokens

A 15-minute token is safe, but users would hate logging in every 15 minutes. The common fix is a second, longer-lived credential called a **refresh token**. Its only job is to get a new access token.

```text
1. POST /auth/login     -> access token (15 min) in JSON
                           refresh token (7 days) in an httpOnly cookie
2. GET  /notes          -> Authorization: Bearer <access token>
   ... 15 minutes pass, access token expires, API returns 401 ...
3. POST /auth/refresh   -> browser sends the cookie automatically
                           server returns a new access token + new refresh cookie
4. POST /auth/logout    -> server deletes the refresh token, clears the cookie
```

### Why put the refresh token in a cookie?

Picture this: your frontend stores tokens in `localStorage`. One day, a third-party script on your site is compromised, or an attacker manages to inject a script (an **XSS** attack, covered in [Preventing Injection, XSS and CSRF](/courses/expressjs/preventing-injection-xss-csrf)). That script can read `localStorage` and send your user's tokens to the attacker.

A cookie marked **`httpOnly`** cannot be read by JavaScript at all. The browser sends it with matching requests, but scripts never see it. That makes it a good home for the long-lived refresh token. The cookie flags you learned in [Cookies with cookie-parser](/courses/expressjs/cookies-and-cookie-parser) all matter here:

| Flag | What it does |
| --- | --- |
| `httpOnly: true` | JavaScript cannot read the cookie |
| `secure: true` | Only sent over HTTPS |
| `sameSite: 'strict'` | Not sent on requests started by other websites |
| `path: '/auth'` | Only sent to `/auth/...` routes, not to every API call |

The short-lived access token is usually kept **in memory** (a JavaScript variable) on the frontend, so it disappears when the tab closes.

### Making refresh tokens revocable

A refresh token should be something the server can **revoke** (cancel). So instead of another JWT, we use a random string and store a hash of it on the server. Logging out deletes it, and the token is dead immediately.

```js
// auth/refreshTokens.js
import crypto from 'node:crypto';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

// Demo store. In production, use a database table or Redis.
const store = new Map(); // tokenHash -> { userId, expiresAt }

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const createRefreshToken = (userId) => {
  const token = crypto.randomBytes(32).toString('base64url');
  store.set(hash(token), { userId, expiresAt: Date.now() + SEVEN_DAYS });
  return token;
};

// Returns the userId and deletes the token (each token works only once)
export const consumeRefreshToken = (token) => {
  const key = hash(token);
  const entry = store.get(key);
  store.delete(key);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.userId;
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/auth',
  maxAge: SEVEN_DAYS,
};
```

Each refresh token can be used only once. This is called **refresh token rotation**: every refresh hands out a brand-new refresh token. If a thief uses a stolen one, the real user's next refresh fails, which is a signal that something is wrong.

> **Note:** We hash refresh tokens for the same reason we hash passwords: if your database leaks, the attacker gets useless hashes instead of working tokens.

### Updating the auth routes

```js
// routes/auth.js  (full version)
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { findUserByEmail, findUserById } from '../users.js';
import { signAccessToken } from '../auth/tokens.js';
import {
  createRefreshToken,
  consumeRefreshToken,
  refreshCookieOptions,
} from '../auth/refreshTokens.js';

export const authRouter = Router();

const sendTokens = (res, user) => {
  res.cookie('refreshToken', createRefreshToken(user.id), refreshCookieOptions);
  res.json({ accessToken: signAccessToken(user) });
};

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = findUserByEmail(email);
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  sendTokens(res, user);
});

authRouter.post('/refresh', (req, res) => {
  const token = req.cookies.refreshToken;
  const userId = token && consumeRefreshToken(token);
  const user = userId && findUserById(userId);
  if (!user) return res.status(401).json({ error: 'Please log in again' });

  sendTokens(res, user);
});

authRouter.post('/logout', (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) consumeRefreshToken(token);
  // Path and flags must match the ones used when setting the cookie.
  // Express 5's clearCookie ignores maxAge, so passing the same object is fine.
  res.clearCookie('refreshToken', refreshCookieOptions);
  res.status(204).end();
});
```

Try the full flow with `curl`, saving cookies to a file:

```bash
curl -c jar.txt -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"demo-password-change-me"}'

curl -b jar.txt -c jar.txt -X POST http://localhost:3000/auth/refresh
# {"accessToken":"eyJ...new token..."}

curl -b jar.txt -X POST http://localhost:3000/auth/logout -i
# HTTP/1.1 204 No Content
```

> **Warning:** Because the refresh route trusts a cookie, it is exposed to **CSRF** (a malicious site triggering the request in the user's browser). `sameSite: 'strict'` plus a narrow `path` defends it well here. You will learn CSRF defences in depth in [Preventing Injection, XSS and CSRF](/courses/expressjs/preventing-injection-xss-csrf).

## Common mistakes

> **Common mistake:** Long-lived access tokens such as `expiresIn: '30d'`. A JWT cannot be cancelled before it expires, so a stolen 30-day token is a 30-day problem. Keep access tokens to minutes.

- **A weak or hard-coded secret.** `jwt.sign(payload, 'secret')` can be cracked by guessing. Use 64 random bytes from `.env`.
- **Putting private data in the payload.** The payload is readable by anyone. Store an ID, not an address.
- **Using `jwt.decode()` to check a token.** `decode` only reads the payload. It does **not** check the signature. Always use `jwt.verify()`.
- **Not pinning the algorithm.** Always pass `{ algorithms: ['HS256'] }` (or whichever you use) to `verify`.
- **Trusting the token forever.** If a user is deleted or banned, their access token still works until it expires. Short lifetimes keep this window small.
- **Sending tokens over plain HTTP.** In production, every request must use HTTPS or tokens can be read in transit.

## Key takeaways

- **Authentication** proves who the user is. **Authorization** decides what they can do.
- A **JWT** is a signed, readable token. The signature stops tampering, but the payload is not secret.
- Use short-lived **access tokens** (around 15 minutes) sent in the `Authorization: Bearer` header.
- Keep a revocable, rotating **refresh token** in an `httpOnly`, `secure`, `sameSite` cookie.
- Always use `jwt.verify` with a strong secret from the environment and an explicit `algorithms` list.

## Practice

1. Add `requireAuth` to your Notes API so that every `/notes` route needs a valid token. Store `req.user.id` as the `owner` of each new note.
2. Change `expiresIn` to `'10s'`, log in, wait, and call `/me`. Confirm you get `Access token expired`, then use `/auth/refresh` to get a new token.
3. Paste one of your tokens into a Base64URL decoder (or split it on `.` and use `Buffer.from(part, 'base64url').toString()` in Node). Confirm you can read the payload without the secret.
4. Change one character of a token's payload and send it to `/me`. What error do you get, and why?

## What's next

Tokens are not the only way to log in. Next you will build classic cookie-based login with sessions in [Session and Cookie Authentication with Passport](/courses/expressjs/passport-authentication).
