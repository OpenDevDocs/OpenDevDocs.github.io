---
publishDate: 2026-10-25T13:42
title: Adding Login with Sessions and Cookies
slug: authentication
metadescription: Add email and password login to a Next.js app with bcryptjs password hashes, a jose-signed JWT session cookie, and login and logout Server Actions.
updateDate: 2026-10-25T13:42
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'authentication', 'sessions', 'cookies']
course: nextjs
---

## What you will build

Book Nook needs accounts: customers who log in, and an admin who manages the shop. In this lesson you will build a small but real login system from scratch:

- a `/login` page with an email and password form,
- passwords stored as **hashes**, never as plain text,
- a **session cookie** that proves "this browser belongs to Riya" on every request,
- **login** and **logout** Server Actions,
- a header that says "Hi, Riya" with a **Log out** button.

Building it yourself once is the best way to understand what auth libraries do for you. For a real shop with sign-ups, password resets, "Sign in with Google" and two-factor codes, use a library (see the end of this lesson).

Three words first, because people mix them up:

1. **Authentication**: proving who you are. "I am Riya, here is my password."
2. **Session management**: remembering that you proved it, across many requests.
3. **Authorization**: deciding what you may do. "Riya may buy books, but not delete them."

This lesson covers the first two. The third is the next lesson, [Protecting Pages, Actions and APIs](/courses/nextjs/authorization).

Here is the plan, as files:

```text
book-nook/
├── .env.local              SESSION_SECRET lives here
├── app/
│   ├── actions.js          gets login() and logout() Server Actions
│   ├── layout.js           passes the user menu to the header
│   └── (auth)/
│       └── login/
│           └── page.js     the /login page
├── components/
│   ├── LoginForm.js        the form (Client Component)
│   └── UserMenu.js         "Hi, Riya / Log out" in the header
└── lib/
    ├── users.js            the users "table" with password hashes
    └── session.js          create, read and delete the session cookie
```

## Step 1: install the tools

```bash
npm install jose bcryptjs server-only
```

- **jose** signs and checks **JWTs** (JSON Web Tokens). The Next.js authentication guide uses it too.
- **bcryptjs** hashes passwords. It is written in pure JavaScript, so it installs everywhere with no compiler or native add-on.
- **server-only** makes the build fail if a file meant for the server is imported into a Client Component. You will learn more about it in [Keeping Secrets and Data Safe](/courses/nextjs/data-security).

## Step 2: hashing passwords

You must never store a password as written. If your database leaks, every password leaks with it, and people reuse passwords on other sites.

Instead you store a **hash**: the result of a one-way scramble. You can turn `read-all-the-books` into a hash easily, but you cannot turn the hash back into the password. To check a login, you hash what the user typed and compare. bcrypt also adds a random **salt** to each hash (so two people with the same password get different hashes) and is slow on purpose, so attackers cannot try billions of guesses quickly.

```javascript
import bcrypt from 'bcryptjs';

const hash = await bcrypt.hash('read-all-the-books', 10);
// '$2b$10$...' (60 characters, different every time)

await bcrypt.compare('read-all-the-books', hash); // true
await bcrypt.compare('wrong-guess', hash);        // false
```

The `10` is the **cost**: how much work each hash takes. 10 to 12 is a sensible range today.

To keep this lesson about sessions, the demo users live in a small file. In the real Book Nook they belong in a `users` table in the database from [Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database), with a `password_hash` column filled at sign-up time; `findUserByEmail` would then be one `db.query` call, and nothing else in this lesson changes.

```javascript
// lib/users.js
import 'server-only';
import bcrypt from 'bcryptjs';

// Demo users only. These passwords are for local testing.
const users = [
  {
    id: 'u1',
    name: 'Riya',
    email: 'reader@booknook.test',
    role: 'customer',
    passwordHash: bcrypt.hashSync('read-all-the-books', 10),
  },
  {
    id: 'u2',
    name: 'Sam',
    email: 'admin@booknook.test',
    role: 'admin',
    passwordHash: bcrypt.hashSync('admin-demo-password', 10),
  },
];

export async function findUserByEmail(email) {
  return users.find((user) => user.email === email.toLowerCase()) ?? null;
}

export async function findUserById(id) {
  return users.find((user) => user.id === id) ?? null;
}
```

## Step 3: the session secret

After a successful login, the server gives the browser a **session token** in a cookie. The token says "user u1, role customer". But users can edit cookies ([Reading Cookies and Headers](/courses/nextjs/cookies-and-headers)), so what stops Riya from changing `customer` to `admin`?

A **signature**. The server signs the token with a secret key only it knows. If anyone changes one character, the signature no longer matches, and the server rejects the token. A signed JSON token like this is called a **JWT**.

Generate a long random secret in your terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

(`openssl rand -base64 32` does the same if you have OpenSSL.) Put it in `.env.local` in the project root:

```bash
# .env.local
SESSION_SECRET=replace-with-a-long-random-string
```

Paste your own random value instead of the placeholder. `.env.local` is already in `.gitignore`, so it never reaches GitHub. Each environment (your laptop, your live server) gets its own secret. See [Environment Variables](/courses/nextjs/environment-variables) for how these files load. Restart the dev server after changing it.

## Step 4: create and read the session

All the session code lives in one server-only file:

```javascript
// lib/session.js
import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET);
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

// Make a signed token from a small payload
export async function encrypt(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

// Check a token. Returns the payload, or null if it is missing, changed or expired.
export async function decrypt(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] });
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(user) {
  const expiresAt = new Date(Date.now() + SEVEN_DAYS);
  const token = await encrypt({ userId: user.id, role: user.role });

  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
```

What each piece does:

- `encrypt` builds a JWT with the payload, signs it with `HS256` (a signing method that uses one shared secret), and makes it expire in 7 days. The name follows the Next.js guide; strictly speaking a JWT like this is **signed**, not encrypted. Anyone can decode and read the payload, they just cannot change it. So keep the payload small and boring: an id and a role, never an email, phone number or password.
- `decrypt` checks the signature and the expiry date. Any problem means `null`, so callers only need one check.
- `createSession` stores the token in an `httpOnly` cookie, so browser JavaScript cannot steal it. `secure` sends it only over HTTPS in production (on `localhost` you use plain HTTP, so it is off in development). `sameSite: 'lax'` keeps it off most requests started by other sites.
- `deleteSession` removes the cookie. That is all "log out" means for this kind of session.

This style is called a **stateless session**: everything the server needs is inside the signed cookie, so no session table is needed. The other style, a **database session**, stores a random session id in the cookie and the details in a database. It is more work, but lets you do things like "log out of all devices". The Next.js docs describe both.

## Step 5: the login and logout Server Actions

Setting a cookie is only allowed in a Server Action or a Route Handler, so login is a Server Action. Add `login` and `logout` to `app/actions.js`, next to `createReview` and the cart actions (the file already starts with `'use server'`; put the new imports at the top with the others). It uses the validation pattern from [Validating Forms and Showing Errors](/courses/nextjs/form-validation):

```javascript
// app/actions.js (new imports and actions)
import * as z from 'zod';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { findUserByEmail } from '@/lib/users';
import { createSession, deleteSession } from '@/lib/session';

const loginSchema = z.object({
  email: z.email({ error: 'Please enter a valid email.' }).trim(),
  password: z.string().min(1, { error: 'Please enter your password.' }),
});

export async function login(prevState, formData) {
  // 1. Validate the form
  const result = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!result.success) {
    return { errors: z.flattenError(result.error).fieldErrors, email: formData.get('email') };
  }

  // 2. Find the user and check the password
  const { email, password } = result.data;
  const user = await findUserByEmail(email);
  const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!passwordOk) {
    // Same message for "no such user" and "wrong password"
    return { message: 'Wrong email or password.', email };
  }

  // 3. Start the session and send the user on
  await createSession(user);
  redirect(user.role === 'admin' ? '/admin' : '/books');
}

export async function logout() {
  await deleteSession();
  redirect('/');
}
```

Notice the error message. If you said "no account with that email", an attacker could test which emails have accounts on your shop. One vague message for both cases gives nothing away.

The action returns `email` so the form can keep it, but **never** returns the password.

## Step 6: the login form and page

```jsx
// components/LoginForm.js
'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions';

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, {});

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-3">
      {state.message && <p role="alert" className="text-red-600">{state.message}</p>}

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required
        defaultValue={state.email} className="rounded border px-2 py-1" />
      {state.errors?.email && <p className="text-sm text-red-600">{state.errors.email[0]}</p>}

      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password"
        required className="rounded border px-2 py-1" />
      {state.errors?.password && <p className="text-sm text-red-600">{state.errors.password[0]}</p>}

      <button type="submit" disabled={isPending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {isPending ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  );
}
```

The `autoComplete` values help password managers fill in the right fields.

The login page lives in the `(auth)` route group from [Route Groups and Private Folders](/courses/nextjs/route-groups-and-private-folders), so its URL is simply `/login`:

```jsx
// app/(auth)/login/page.js
import LoginForm from '@/components/LoginForm';

export const metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Log in to Book Nook</h1>
      <LoginForm />
    </main>
  );
}
```

## Step 7: show who is logged in

The header should greet the user and offer a **Log out** button. First a small helper that reads the session and returns only what the UI needs:

```javascript
// lib/dal.js
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/session';
import { findUserById } from '@/lib/users';

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get('session')?.value;
  const session = await decrypt(token);
  if (!session?.userId) return null;

  const user = await findUserById(session.userId);
  if (!user) return null;

  // Only the fields the UI needs. Never the password hash.
  return { id: user.id, name: user.name, role: user.role };
});
```

`cache` from React means: if several components call `getCurrentUser()` while rendering the same request, the work runs only once. The file name `dal.js` stands for **Data Access Layer**, and the next lesson grows it into the heart of your security.

Now the menu. A logout button is just a form whose action is `logout`:

```jsx
// components/UserMenu.js
import Link from 'next/link';
import { getCurrentUser } from '@/lib/dal';
import { logout } from '@/app/actions';

export default async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return <Link href="/login">Log in</Link>;
  }

  return (
    <form action={logout} className="flex items-center gap-2">
      <span>Hi, {user.name}</span>
      <button type="submit" className="underline">Log out</button>
    </form>
  );
}
```

Logging out is a **POST** (a form submit), not a link. A plain link could be triggered by any page on the internet with an `<img src="/logout">` trick, and Next.js forbids side effects like deleting cookies during rendering anyway.

Where does `UserMenu` go? Your `Header` is a Client Component (it uses `usePathname` to underline the current link, from [Linking and Navigating Between Pages](/courses/nextjs/linking-and-navigating)). A Client Component cannot import an async Server Component like `UserMenu`. But it **can** receive one as a prop and place it, like a slot. Give `Header` a `userMenu` prop:

```jsx
// components/Header.js
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/books', label: 'Books' },
  { href: '/about', label: 'About' },
  { href: '/cart', label: 'Cart' },
];

export default function Header({ userMenu }) {
  const pathname = usePathname();

  return (
    <header className="border-b px-6 py-4">
      <nav className="flex items-center gap-6">
        <Link href="/" className="font-bold">Book Nook</Link>
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={isActive ? 'font-semibold underline' : 'text-zinc-600'}
            >
              {link.label}
            </Link>
          );
        })}
        <div className="ml-auto">{userMenu}</div>
      </nav>
    </header>
  );
}
```

Then the root layout, a Server Component, renders `UserMenu` and hands it over:

```jsx
// app/layout.js (only the changed parts)
import { Suspense } from "react";
import Header from "@/components/Header";
import UserMenu from "@/components/UserMenu";

// ...inside <body>:
<Suspense fallback={<header className="border-b px-6 py-4 font-bold">Book Nook</header>}>
  <Header
    userMenu={
      <Suspense fallback={null}>
        <UserMenu />
      </Suspense>
    }
  />
</Suspense>
```

`UserMenu` reads cookies, which is runtime data. With Cache Components on, it must sit inside `<Suspense>`, otherwise the build fails. The outer boundary was already there for `usePathname`; the inner one lets the header's links show before the user's name is known.

## Step 8: try it

Start the dev server and open `http://localhost:3000/login`.

1. Log in as `reader@booknook.test` with a wrong password. You see "Wrong email or password." and the email stays filled in.
2. Log in with `read-all-the-books`. You land on `/books` and the header says:

```text
Book Nook    Books   Cart   Hi, Riya  Log out
```

3. Open the developer tools, **Application** (or **Storage**), **Cookies**. You will find a `session` cookie marked **HttpOnly**, whose value starts with `eyJ`. Paste it into a JWT decoder and you can read `{"userId":"u1","role":"customer",...}`. Readable, yes. Changeable, no: edit one letter and reload, and you are logged out, because the signature check fails.
4. Press **Log out**. The cookie is gone and the header shows **Log in** again.

## Step 9: let Proxy check the signature

In [Running Code Before Requests with Proxy](/courses/nextjs/proxy) the `/admin` check only looked for a cookie called `session`. Now it can check that the cookie is genuine. Verifying a JWT is fast and needs no database, so it is fine in Proxy:

```javascript
// proxy.js
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/session';

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    const session = await decrypt(request.cookies.get('session')?.value);
    if (!session?.userId) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|covers).*)'],
};
```

This is still only an **optimistic** check. It does not stop a customer from opening `/admin`, and it does not protect Server Actions or APIs. That is the next lesson.

## Should you use an auth library?

For learning, building it yourself is great. For a real product, the Next.js docs recommend an **authentication library**. They handle the hard, boring parts you have not built here: sign-up, email verification, password reset, rate limiting login attempts, social logins (Google, GitHub), two-factor codes and session refresh.

Some options that work with the App Router:

- **Auth.js** (formerly NextAuth.js): open source, many login providers.
- **Better Auth**: open source, runs in your own app with your own database.
- Hosted services such as **Clerk**, **Auth0**, **WorkOS**, **Supabase Auth**, **Kinde** and others, which also give you ready-made login screens.

Whatever you pick, the ideas from this lesson stay the same: a signed or random session token in an `httpOnly` cookie, checked on the server for every request that matters.

## Common mistakes

### A missing or short secret

If `SESSION_SECRET` is missing, `process.env.SESSION_SECRET` is `undefined`, the key is empty, and logging in fails with:

```text
DataError: Zero-length key is not supported
```

Add the variable to `.env.local` and restart the dev server. Never commit a real secret to Git, and never prefix it with `NEXT_PUBLIC_`, which would send it to every browser.

### Setting the cookie in a page

```text
Error: Cookies can only be modified in a Server Action or Route Handler.
```

`createSession` and `deleteSession` must be called from a Server Action (like `login`) or a Route Handler, not from a page or component.

### Reading the session outside Suspense

With Cache Components, `cookies()` is runtime data. A component like `UserMenu` that reads the session must be inside a `<Suspense>` boundary, or the build stops with "Next.js encountered uncached or runtime data during prerendering".

### Putting personal data in the token

The JWT payload is readable by anyone who has the cookie. Store an id and a role; look up the name and email on the server.

### Different messages for unknown email and wrong password

"No account found" tells attackers which emails are registered. Use one message for both.

## Quick recap

- Authentication proves who someone is; session management remembers it; authorization decides what they may do.
- Store password **hashes** made with `bcrypt.hash`, and check logins with `bcrypt.compare`.
- After login, put a **signed** JWT (made with jose and a secret from `.env.local`) in an `httpOnly`, `sameSite: 'lax'` cookie, `secure` in production.
- Login and logout are Server Actions, because only actions and Route Handlers may set cookies.
- `getCurrentUser()` reads and verifies the cookie, returns a small safe object, and is wrapped in React's `cache`.
- Components that read the session sit inside `<Suspense>` when Cache Components is on.
- Proxy can verify the JWT for a fast redirect, but real protection comes next.
- For production, consider an auth library such as Auth.js or Better Auth.

<code id="code-content" class="language-javascript">
// lib/session.js: a signed session cookie with jose (server only)
import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
// SESSION_SECRET comes from .env.local (SESSION_SECRET=replace-with-a-long-random-string)
const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET);
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
// Sign a small payload (an id and a role, never personal data)
export async function encrypt(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}
// Returns the payload, or null if the token is missing, changed or expired
export async function decrypt(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] });
    return payload;
  } catch {
    return null;
  }
}
// Call only from a Server Action or Route Handler (they may set cookies)
export async function createSession(user) {
  const expiresAt = new Date(Date.now() + SEVEN_DAYS);
  const token = await encrypt({ userId: user.id, role: user.role });
  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true, // browser JavaScript cannot read it
    secure: process.env.NODE_ENV === 'production', // HTTPS only when live
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
// --- app/actions.js (the login action, in short):
// const user = await findUserByEmail(email);
// const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
// if (!ok) return { message: 'Wrong email or password.', email };
// await createSession(user); redirect('/books');
</code></pre>
