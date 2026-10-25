---
publishDate: 2026-10-25T09:42
title: Password Hashing and Account Security
slug: password-hashing-and-account-security
metadescription: Learn why passwords must be hashed, how to use bcrypt and Argon2 in Express 5, and how to build safer sign-up, login and password reset flows.
updateDate: 2026-10-25T09:42
author: ['bishal-biswas']
level: 3
tags: ['express', 'bcrypt', 'passwords', 'security']
course: expressjs
---

## What you will learn

- Why you must **never** store plain or encrypted passwords
- What **hashing**, **salts** and **work factors** are, in plain words
- How to hash and check passwords with `bcrypt` (and when to choose Argon2)
- Modern password rules, including checking for **breached passwords**
- How to build a safer login and a secure **password reset** flow

You have already called `bcrypt.hash()` and `bcrypt.compare()` in the authentication lessons. This lesson explains what those calls really do, and why each detail matters.

## The scenario: your database leaks

Assume the worst. One day, an attacker gets a copy of your `users` table. Maybe a backup was left public, or a bug exposed it. This happens to large and small companies every year.

What the attacker can do next depends entirely on how you stored passwords:

| How you stored passwords | What the attacker gets |
| --- | --- |
| Plain text: `hunter2` | Every password instantly. Many users reuse passwords, so their email and bank accounts are at risk too. |
| Encrypted with a key | The key usually lives on the same server. Steal both, decrypt everything. |
| Fast hash (MD5, SHA-256) | Billions of guesses per second on a gaming graphics card. Weak passwords fall in minutes. |
| Slow, salted hash (bcrypt, Argon2) | Each guess is deliberately expensive. Strong passwords stay safe for a very long time. |

Your goal is the last row. You cannot promise a breach will never happen, but you can make the stolen data nearly useless.

## Hashing in plain words

A **hash function** turns any input into a fixed-size scrambled output, called a **hash**. It is **one-way**: easy to compute forwards, practically impossible to reverse.

Think of a blender. You can turn fruit into a smoothie, but you cannot turn the smoothie back into fruit. To check a password, you do not "un-blend" the stored hash. You blend the password the user just typed and compare the two smoothies.

```text
Sign-up:  "correct horse battery staple" --hash--> $2b$12$Qx...   (stored)
Login:    "correct horse battery staple" --hash--> $2b$12$Qx...   same? -> logged in
Login:    "wrong guess"                  --hash--> $2b$12$Zp...   different -> rejected
```

### Why a plain hash is not enough

Two problems remain with a simple hash such as SHA-256.

1. **Identical passwords give identical hashes.** If 5,000 users chose `password123`, they all share one hash. Attackers also keep huge pre-computed lists of hashes for common passwords, called **rainbow tables**.
2. **It is too fast.** SHA-256 was designed to be quick. That is great for checking file downloads, but terrible for passwords, because the attacker can try guesses just as quickly.

### Salt: making every hash unique

A **salt** is a random value generated for each user and mixed into the password before hashing. Two users with the same password now get completely different hashes, and rainbow tables become useless. The salt is not secret; it is stored right next to the hash.

### Work factor: making every guess slow

A **password hashing function** such as bcrypt or Argon2 is designed to be *slow on purpose*. A setting called the **work factor** (or **cost**) controls how slow. A login that takes a fraction of a second is barely noticeable to a real user, but it turns an attacker's billions of guesses per second into a tiny trickle.

## Hashing with bcrypt

`bcrypt` handles the salt and the work factor for you.

```bash
npm install bcrypt
```

```js
// auth/passwords.js
import bcrypt from 'bcrypt';

const COST = 12; // each +1 doubles the time needed per hash

export const hashPassword = (plain) => bcrypt.hash(plain, COST);

export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);
```

That is the whole API you need. A bcrypt hash looks like this and contains everything needed to check it later:

```text
$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW
 |   |  |                     |
 |   |  salt (22 chars)       hash (31 chars)
 |   cost = 12
 algorithm version
```

Because the salt and cost are stored inside the hash string, `bcrypt.compare()` knows exactly how to repeat the calculation. You store just this one string in a `passwordHash` field.

> **Tip:** Run a quick timing test on your production server: `console.time('h'); await bcrypt.hash('x', 12); console.timeEnd('h');`. Pick the highest cost that keeps login comfortably fast for your traffic. 12 is a common starting point.

> **Warning:** Always use the async `bcrypt.hash()` and `bcrypt.compare()` in request handlers. The `hashSync` and `compareSync` versions block Node's event loop, so every other request waits while one password is hashed.

### bcrypt's 72-byte limit

bcrypt only looks at the **first 72 bytes** of a password. Anything after that is ignored. With emoji or non-Latin letters, one character can take up to 4 bytes, so 72 bytes can be fewer than 72 characters. Reject passwords that are too long in bytes, as you will see in the validation schema below. Argon2 does not have this limit.

### Argon2: the modern alternative

**Argon2** won the Password Hashing Competition and its **Argon2id** variant is the first choice in OWASP's Password Storage Cheat Sheet. (OWASP is a respected non-profit that publishes web security guidance.) bcrypt is still considered acceptable, especially for existing apps.

```bash
npm install argon2
```

```js
// auth/passwords.js (Argon2 version)
import argon2 from 'argon2';

export const hashPassword = (plain) => argon2.hash(plain); // uses argon2id by default
export const verifyPassword = (plain, hash) => argon2.verify(hash, plain); // note: hash first
```

| | bcrypt | Argon2id |
| --- | --- | --- |
| Status | Mature, widely used, acceptable | Current recommended choice |
| Input limit | 72 bytes | No practical limit |
| Resists GPU attacks by | Being slow | Being slow **and** using lots of memory |
| npm package | `bcrypt` | `argon2` |

Either is fine for this course. What matters most is that you use one of them, never a plain hash.

## Upgrading old hashes automatically

Hardware gets faster, so you may want to raise the cost from 12 to 13 one day. You cannot re-hash old passwords because you do not know them. But you *do* know a password at the moment a user logs in successfully. That is the time to upgrade:

```js
// inside your login handler, after the password was verified
if (bcrypt.getRounds(user.passwordHash) < COST) {
  user.passwordHash = await bcrypt.hash(password, COST);
  await user.save();
}
```

## Password rules that actually help

Old advice ("one uppercase, one number, one symbol, change it every 90 days") made passwords harder to remember, not harder to guess. People ended up with `Password1!`, then `Password2!`.

Current guidance from **NIST** (the US standards body whose digital identity guidelines are widely followed) focuses on length and on blocking known-bad passwords:

- **Length beats complexity.** NIST's latest guidelines ask for at least 15 characters when a password is the only login factor, and at least 8 when it is combined with multi-factor authentication.
- **Allow long passwords and all characters**, including spaces, so people can use passphrases.
- **No forced composition rules** and no forced periodic changes. Require a change only when there is evidence of compromise.
- **Block common and breached passwords.**

Here is a Zod schema that follows these rules and respects bcrypt's byte limit:

```js
// validation/password.js
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(15, 'Use at least 15 characters. A short phrase is easiest to remember.')
  .refine((pw) => Buffer.byteLength(pw, 'utf8') <= 72, 'Password is too long');
```

### Checking for breached passwords

The **Have I Been Pwned** "Pwned Passwords" service lists hundreds of millions of passwords from real data breaches. You can check a password against it **without sending the password**. You send only the first 5 characters of its SHA-1 hash, and the service returns every breached hash that starts with those characters. Your server checks the rest locally. This technique is called **k-anonymity**.

```js
// auth/pwned.js
import crypto from 'node:crypto';

export const isBreachedPassword = async (password) => {
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' }, // hides how many real matches there are
  });
  if (!response.ok) return false; // service down: don't block sign-ups

  const body = await response.text();
  return body.split('\n').some((line) => {
    const [hashSuffix, count] = line.trim().split(':');
    return hashSuffix === suffix && Number(count) > 0;
  });
};
```

> **Note:** SHA-1 is used here only because that is the format of the breach list. It is never used to *store* passwords.

## A safer sign-up and login

Putting it together:

```js
// routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User } from '../models/User.js';
import { passwordSchema } from '../validation/password.js';
import { isBreachedPassword } from '../auth/pwned.js';

export const authRouter = Router();
const COST = 12;

// A real hash of a random value, used when the email is unknown (see below)
const DUMMY_HASH = await bcrypt.hash('not-a-real-password', COST);

const signupSchema = z.object({ email: z.email(), password: passwordSchema });
const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(200) });

authRouter.post('/signup', async (req, res) => {
  const result = signupSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.issues });
  const { email, password } = result.data;

  if (await isBreachedPassword(password)) {
    return res.status(400).json({
      error: 'This password has appeared in a data breach. Please choose a different one.',
    });
  }

  const user = await User.create({ email, passwordHash: await bcrypt.hash(password, COST) });
  res.status(201).json({ id: user.id, email: user.email });
});

authRouter.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Email and password are required' });
  const { email, password } = result.data;

  const user = await User.findOne({ email: email.toLowerCase() });
  // Always run bcrypt, even for unknown emails, so both cases take similar time
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  // ...issue a token or create a session, as in the earlier lessons
  res.json({ message: 'Logged in' });
});
```

### Why the dummy hash?

Imagine an attacker who wants to know whether `ceo@example.com` has an account. If the email does not exist, a naive login returns instantly. If it does exist, the server spends time running bcrypt. By **timing** the responses, the attacker learns which emails are registered. This is called **user enumeration**.

Comparing against `DUMMY_HASH` when there is no user makes both paths do the same slow work. Combined with one generic error message, the response gives nothing away.

## Brute force and lockouts

Even with slow hashing, an attacker can sit on your login form and try thousands of common passwords. Two defences work together:

- **Rate limiting** caps how many login attempts an IP or account can make. You will build this in the next lesson.
- **Account lockout** temporarily blocks an account after many failures. Be careful: a strict lockout lets anyone lock *other* people out on purpose by failing on their email. Prefer short, growing delays over permanent locks.

The strongest defence is **multi-factor authentication (MFA)**, such as a code from an authenticator app or a passkey. Even a correct stolen password is then not enough to log in.

## A secure password reset flow

"Forgot password" is a common weak spot. A reset link is effectively a temporary password, so treat it like one.

```text
1. User submits their email to POST /auth/forgot-password
2. Server creates a long random token, stores only its HASH with a 30-minute expiry
3. Server emails a link containing the plain token
4. User opens the link and submits a new password + the token to POST /auth/reset-password
5. Server hashes the token, finds a matching unexpired record, sets the new password,
   deletes the token, and logs the user out everywhere
```

Add two fields to the user model:

```js
// models/User.js (extra fields)
resetTokenHash: { type: String },
resetTokenExpires: { type: Date },
```

```js
// routes/passwordReset.js
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User } from '../models/User.js';
import { passwordSchema } from '../validation/password.js';
import { sendResetEmail } from '../email.js'; // your email helper

export const resetRouter = Router();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

resetRouter.post('/forgot-password', async (req, res) => {
  const parsed = z.object({ email: z.email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'A valid email is required' });

  const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (user) {
    const token = crypto.randomBytes(32).toString('base64url'); // 256 bits of randomness
    user.resetTokenHash = sha256(token);
    user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    // Not awaited, so the response time does not reveal whether the email exists
    sendResetEmail(user.email, token).catch((err) => console.error('Reset email failed', err));
  }

  // Same answer either way: no user enumeration
  res.json({ message: 'If that email is registered, a reset link is on its way.' });
});

resetRouter.post('/reset-password', async (req, res) => {
  const parsed = z
    .object({ token: z.string().min(1).max(100), password: passwordSchema })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  const user = await User.findOne({
    resetTokenHash: sha256(parsed.data.token),
    resetTokenExpires: { $gt: new Date() },
  });
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired' });

  user.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  user.resetTokenHash = undefined; // single use
  user.resetTokenExpires = undefined;
  await user.save();

  // Also revoke this user's sessions or refresh tokens here (see the auth lessons)
  res.json({ message: 'Password updated. Please log in.' });
});
```

Key points in this flow:

- The token comes from `crypto.randomBytes`, a **cryptographically secure** random generator. Never use `Math.random()` for security tokens; its output can be predicted.
- Only the token's **hash** is stored, so a database leak does not hand out working reset links.
- Tokens **expire** quickly and work **once**.
- After a reset, **log the user out everywhere**. If an attacker was in the account, they lose access.
- The reset page should not load third-party scripts, and should send a strict `Referrer-Policy` so the token in the URL is not leaked to other sites. Helmet does this by default, as you will see in [Security Headers with Helmet](/courses/expressjs/security-headers-with-helmet).

The same "log out everywhere" rule applies when a logged-in user changes their password. Also ask for their **current password** before allowing the change, so someone at an unlocked laptop cannot quietly take over the account.

## Common mistakes

> **Common mistake:** Logging request bodies "for debugging". Your logs then contain plain-text passwords. If you log bodies with Pino, configure `redact: ['req.body.password']`, as covered in [Logging with Morgan and Pino](/courses/expressjs/logging-with-morgan-and-pino).

- **Using MD5, SHA-1 or SHA-256 to store passwords.** They are fast hashes. Use bcrypt or Argon2id.
- **Writing your own salting scheme.** bcrypt and Argon2 already salt every hash. Do not reinvent this.
- **Returning the password hash in API responses.** Exclude it from queries with `.select('-passwordHash')` or strip it before sending.
- **Emailing passwords to users.** If you *can* email a password, you are storing it wrong. Send reset links instead.
- **Reset tokens that never expire** or can be used many times.
- **Different messages or timings for "unknown email" and "wrong password".**

## Key takeaways

- Never store plain or encrypted passwords. Store a **slow, salted hash** made by **bcrypt** or **Argon2id**.
- A **salt** makes every hash unique; a **work factor** makes every guess expensive.
- Favour **long passwords** over complexity rules, and block passwords found in **breaches**.
- Prevent **user enumeration** with generic messages and equal-time checks.
- Password reset tokens must be random, hashed, short-lived and single-use, and a reset should log the user out everywhere.

## Practice

1. Time `bcrypt.hash()` on your machine with costs 10, 12 and 14. Write down how much each step increases the time.
2. Hash the same password twice with bcrypt and print both results. Why are they different, and why does `bcrypt.compare()` still accept both?
3. Add the breached-password check to your Notes API sign-up and try the password `password123`.
4. Implement the forgot/reset password routes. For the email step, just `console.log` the link while developing.

## What's next

Slow hashes protect stolen data, but you still need to stop attackers from hammering your login form, so continue with [Rate Limiting and Throttling](/courses/expressjs/rate-limiting).
