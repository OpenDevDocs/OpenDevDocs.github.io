---
publishDate: 2026-10-25T13:44
title: Keeping Secrets and Data Safe
slug: data-security
metadescription: Keep secrets and private data on the server in Next.js with server-only, a Data Access Layer, DTOs, safe props, environment variables and secure Server Actions.
updateDate: 2026-10-25T13:44
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'security', 'server-only', 'environment-variables']
course: nextjs
---

## What you will learn

Server Components make it easy to talk to a database right inside a component. That is wonderful, and also a little dangerous: the line between "server" and "browser" is now just an import or a prop away. One careless prop can send a password hash to every visitor.

This lesson is about where that line is and how to guard it. You will learn:

- what actually reaches the browser,
- how `server-only` stops private code from being bundled for the browser,
- how a **Data Access Layer** and **Data Transfer Objects** keep private fields on the server,
- how to keep secret keys secret,
- the security rules for Server Actions,
- an optional extra safety net: React's **taint** APIs.

It builds on the Data Access Layer from [Protecting Pages, Actions and APIs](/courses/nextjs/authorization). The Next.js docs call this topic **data security**, and this lesson follows their recommendations.

## What reaches the browser?

Picture a restaurant. The kitchen (the server) has the recipes, the supplier invoices and the safe. The dining room (the browser) only gets what the waiter carries out on a plate. The danger is not the kitchen; it is what you put on the plate.

In Next.js:

- **Server Component code** stays on the server. Its database calls, its imports and its variables are never sent to the browser. Only its **rendered output** is sent.
- **Client Component code** is sent to the browser in full. Anyone can read it in the developer tools.
- **Props passed from a Server Component to a Client Component** are sent to the browser, as data inside the page. Every field, whether the component shows it or not.
- **Values returned from a Server Action** are sent to the browser.
- **Environment variables** stay on the server, unless their name starts with `NEXT_PUBLIC_`.

The third point is the one that catches people. Look at this innocent-looking page:

```jsx
// app/welcome/page.js  (do not copy this)
import Hello from '@/components/Hello'; // a Client Component
import { findUserById } from '@/lib/users';

export default async function WelcomePage() {
  const user = await findUserById('u1');
  return <Hello user={user} />; // sends the WHOLE user object
}
```

```jsx
// components/Hello.js
'use client';

export default function Hello({ user }) {
  return <p>Hello {user.name}</p>; // only shows the name...
}
```

The page only shows "Hello Riya". But we built and ran exactly this, opened the page source, and searched for "passwordHash". There it was, inside the page's data:

```text
passwordHash\":\"$$2b$10$T8Qhof3m2wdYDE3X8jYpgu...
```

React has to send all the props so the Client Component can run in the browser. It cannot know which fields you "meant". So the rule is: **only pass what the client needs**.

## Step 1: mark private modules with server-only

Some files must never end up in the browser bundle: anything that reads secrets, talks to the database, or checks passwords. Mark them by importing `server-only` at the top:

```bash
npm install server-only
```

```javascript
// lib/users.js
import 'server-only';
import bcrypt from 'bcryptjs';
// ...
```

Now if any Client Component imports this file, even through several other files, the build fails straight away. In Next.js 16.4 the message reads:

```text
./lib/users.js:2:1
Error: You're importing a module that depends on "server-only". This API is only available in Server Components in the App Router, but you are using it in the Pages Router.
```

Do not be confused by the last words. Below the message, Next.js prints an **import trace** that shows which Client Component pulled the file in, and that is what you need to fix.

Put `import 'server-only'` in `lib/session.js`, `lib/users.js`, `lib/dal.js` and any file that touches the database or secrets. The opposite package, `client-only`, marks code that must only run in the browser (for example code that uses `window`).

Installing the package is optional, since Next.js handles the import itself, but installing it keeps ESLint and other tools happy.

## Step 2: one Data Access Layer

The Next.js docs suggest three ways to organise data access:

- **External HTTP APIs**: your Next.js app calls an existing backend (common in big companies).
- **A Data Access Layer**: a set of `server-only` functions that do every read and write. Recommended for new projects like Book Nook.
- **Component-level access**: database queries directly inside components. Fine for prototypes, but easy to get wrong.

Pick one and stick to it. Book Nook uses a Data Access Layer. Its jobs:

1. run only on the server (`import 'server-only'`),
2. check who is asking (`verifySession()` or `getSession()`) and whether they may see the data,
3. return **small, safe objects**, not raw database rows.

A good habit: only the DAL reads `process.env` and talks to the database. Pages and components call DAL functions and never import the database client directly. Then a security review only has to look in one folder.

## Step 3: return Data Transfer Objects

A **Data Transfer Object** (DTO) is a plain object made for one purpose, containing only the fields that purpose needs. Instead of handing out the whole user record, the DAL builds a DTO:

```javascript
// lib/dal.js
import 'server-only';
import { cache } from 'react';
import { findUserById } from '@/lib/users';

// The full record has: id, name, email, role, passwordHash
function toPublicUser(user) {
  return { id: user.id, name: user.name };
}

export const getCurrentUser = cache(async () => {
  const session = await getSession(); // from the previous lesson
  if (!session) return null;
  const user = await findUserById(session.userId);
  return { ...toPublicUser(user), role: user.role };
});
```

Now any component can do `<Hello user={await getCurrentUser()} />`, and the worst it can leak is a name and a role.

DTOs can also hide fields depending on who is asking. For example, if your books had a `stock` field (how many copies are left), the admin could see it while customers do not:

```javascript
// lib/dal.js
export async function getBookForViewer(id) {
  const book = await getBook(id);
  if (!book) return null;

  const session = await getSession();
  const isAdmin = session?.role === 'admin';

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    price: book.price,
    stock: isAdmin ? book.stock : undefined, // only admins see stock
  };
}
```

With a database, the same idea starts in the query: `SELECT id, title, author, price FROM books` instead of `SELECT *` when a page only needs those columns.

Write DTOs with an **allow list** (pick the safe fields), not a block list (delete the bad ones). When someone adds a `supplierCost` column next year, an allow list keeps it private automatically.

The same goes for Route Handlers: `Response.json(user)` sends every field to whoever calls the API. Return a DTO there too.

## Step 4: keep secrets secret

Secrets like `SESSION_SECRET`, database passwords and API keys belong in environment variables ([Environment Variables](/courses/nextjs/environment-variables)):

```bash
# .env.local  (never committed, already in .gitignore)
SESSION_SECRET=replace-with-a-long-random-string
DATABASE_URL=postgres://user:replace-with-your-password@localhost:5432/booknook
NEXT_PUBLIC_SHOP_NAME=Book Nook
```

The rules:

- Variables **without** `NEXT_PUBLIC_` are only available on the server. In browser code they are simply missing, so a secret read in a Client Component never gets its value.
- Variables **with** `NEXT_PUBLIC_` are copied into the JavaScript sent to every visitor at build time. Only use the prefix for things that are fine to publish, like the shop's name. **Never** put a secret behind `NEXT_PUBLIC_`.
- Read secrets in `server-only` files, ideally only in the DAL and session code.
- Do not log secrets or whole request objects. Logs are often shared with more people than you think.
- Use different secrets for development and production, and set production ones in your host's dashboard, not in a file.
- If a secret ever lands in Git, consider it leaked: create a new one and replace it everywhere.

## Step 5: treat every Server Action as a public API

A `'use server'` function feels like a normal function you call from your component. It is not. Next.js turns it into an endpoint that accepts `POST` requests, and anyone can send one.

### What Next.js does for you

- **Hard-to-guess action ids.** The browser calls actions by an encrypted id that changes between builds.
- **Dead code elimination.** Actions that no component uses are removed from the build and get no endpoint.
- **POST only, same origin.** Actions only accept `POST`, and Next.js compares the `Origin` header with the `Host` header. A form on another website cannot trigger your actions, which blocks most **CSRF** (cross-site request forgery) attacks. If you run behind a reverse proxy with a different domain, list it in `serverActions.allowedOrigins` in `next.config.mjs`.
- **Encrypted closures.** When an action defined inside a component uses a variable from that component, the value travels through the browser **encrypted**.

### What you must do yourself

These protections do not know your rules. In every action:

1. **Authenticate and authorize** at the top (`verifySession()`, role, ownership), even if the page already checked. The page and the action are separate doors.
2. **Validate every argument**, including ids passed with `bind` and values from hidden inputs. They come from the browser, so they can be changed. Use a schema ([Validating Forms and Showing Errors](/courses/nextjs/form-validation)).
3. **Return only what the UI needs.** Return values are sent to the browser, so return a message or a DTO, never a raw database row.
4. **Keep the action thin.** Put the database work in the DAL, so the same checks apply everywhere.

```javascript
// app/actions.js (postReview, with every check)
import * as z from 'zod';
import { updateTag } from 'next/cache';
import { verifySession, getCurrentUser } from '@/lib/dal';
import { getBook } from '@/lib/books';
import { addReview } from '@/lib/reviews';

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(1).max(1000),
});

export async function postReview(bookId, formData) {
  // 1. Who is calling?
  await verifySession();
  const user = await getCurrentUser();

  // 2. Validate everything that came from the browser, including bookId
  const book = await getBook(String(bookId));
  if (!book) return { error: 'That book does not exist.' };
  const result = reviewSchema.safeParse({
    rating: formData.get('rating'),
    text: formData.get('text'),
  });
  if (!result.success) return { error: 'Please pick a rating and write up to 1000 characters.' };

  // 3. Use the session for "who", never a userId or name sent by the browser
  await addReview({ bookId: book.id, userId: user.id, name: user.name, ...result.data });
  updateTag(`reviews-${book.id}`);

  // 4. Return only what the UI needs
  return { ok: true };
}
```

This is the `postReview` action from [Pending States and Optimistic Updates](/courses/nextjs/pending-and-optimistic-ui), grown up. Notice step 3: the author of the review comes from the **session**, not from a `name` or hidden `userId` field in the form. If you trusted a field from the form, anyone could post reviews as anyone else.

For actions that cost money or send emails (like "email me my order"), also add **rate limiting**, so one person cannot call them thousands of times.

### No side effects while rendering

Never change data while a page or component renders: no "log out" or "mark as read" in a Server Component, and no `GET` Route Handler that deletes things. Pages can be prefetched and rendered when nobody clicked anything. Next.js already blocks setting cookies and revalidating caches during rendering for this reason. Put changes in Server Actions, which only run on `POST`.

## Step 6: watch your cache keys

With Cache Components, the arguments of a `'use cache'` function become part of its **cache key**, and tags from `cacheTag` are stored as written. They are not hashed. So:

- cache by a stable id (`getOrders(userId)`), never by an email, token or password,
- do not put secrets or personal data in tags.

Also, a cached function cannot call `cookies()`, so make sure a cached function that takes a `userId` is not exported for anyone to call with someone else's id. Keep it private inside the DAL, and let the exported function read the session first.

## Step 7: an extra safety net with taint (optional)

React has experimental **taint** APIs that make React itself refuse to send a value or object to the client. They are a second layer, in case a DTO is forgotten. Enable them in `next.config.mjs`:

```javascript
// next.config.mjs
const nextConfig = {
  // ...the rest of your config
  experimental: {
    authInterrupts: true,
    taint: true,
  },
};
```

Then mark the raw user record as "never send this":

```javascript
// lib/users.js
import 'server-only';
import { experimental_taintObjectReference } from 'react';

export async function findUserById(id) {
  const user = users.find((u) => u.id === id) ?? null;
  if (user) {
    experimental_taintObjectReference(
      'Do not pass the whole user record to the client. Use a DTO.',
      user
    );
  }
  return user;
}
```

We tried it with the bad `WelcomePage` from the start of this lesson, and the build stopped with our own message:

```text
Error: Do not pass the whole user record to the client. Use a DTO.
```

There is also `experimental_taintUniqueValue` for single values like a token. Taint only blocks that exact object or value; a copy like `{ ...user }` is not tainted. So it is a seatbelt, not a replacement for DTOs.

## A quick security review

Before you ship, walk through your project with the questions the Next.js docs suggest:

- **Data Access Layer:** do database clients and `process.env` secrets appear only in `server-only` files?
- **`"use client"` files:** do any props carry more than the component shows? Look for whole `user`, `order` or `book` objects.
- **`"use server"` files:** does every action check the session, the role and the ownership? Does it validate its arguments? Does it return only what the UI needs?
- **`[param]` folders:** dynamic segments are user input. Are they validated?
- **`proxy.js` and `route.js` files:** they have a lot of power. Read them twice.

## Common mistakes

### Passing whole records to Client Components

`<ProfileCard user={user} />` sends every field of `user` to the browser, even ones the card never shows. Pass a DTO or just the fields: `<ProfileCard name={user.name} />`.

### A secret behind NEXT_PUBLIC_

`NEXT_PUBLIC_STRIPE_SECRET_KEY` is published to every visitor in your JavaScript. Remove the prefix, read it only on the server, and create a new key, because the old one is already public.

### Trusting ids from the browser

`deleteReview(reviewId)` that just deletes `reviewId` lets anyone delete anything. Look the record up, and check that it belongs to the session's user (or that the user is an admin).

### Forgetting server-only

Without `import 'server-only'`, a Client Component can import your database helper by accident. Secrets would be missing in the browser (they have no `NEXT_PUBLIC_` prefix), but your private code and queries would still ship in the bundle for anyone to read.

### Returning raw rows from actions and APIs

`return await db.user.update(...)` sends the updated row, password hash and all, to the browser. Return `{ ok: true }` or a DTO.

## Quick recap

- Server Component code stays on the server, but props to Client Components, action return values and `NEXT_PUBLIC_` variables reach the browser.
- `import 'server-only'` turns accidental client imports of private files into build errors.
- A `server-only` Data Access Layer checks the session and returns small DTOs built from an allow list.
- Secrets live in environment variables without `NEXT_PUBLIC_`, read only in server-only files.
- Treat each Server Action as a public `POST` endpoint: authenticate, authorize, validate, return little.
- Take the user's identity from the session, never from form fields or bound ids.
- Do not put secrets or personal data in `'use cache'` arguments or cache tags.
- React's taint APIs (`experimental.taint`) are an optional seatbelt on top of DTOs.

<code id="code-content" class="language-javascript">
// lib/dal.js: a server-only Data Access Layer that returns safe DTOs
import 'server-only'; // build error if a Client Component imports this file
import { cache } from 'react';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/session';
import { findUserById } from '@/lib/users';
import { getBook } from '@/lib/books';
// Who is asking? { userId, role } or null
export const getSession = cache(async () =&gt; {
  const token = (await cookies()).get('session')?.value;
  const payload = await decrypt(token);
  if (!payload?.userId) return null;
  const user = await findUserById(payload.userId);
  return user ? { userId: user.id, role: user.role } : null;
});
// DTO built from an ALLOW list: new private fields stay private automatically
function toPublicUser(user) {
  return { id: user.id, name: user.name };
}
// Safe to pass to any Client Component: no email, no password hash
export const getCurrentUser = cache(async () =&gt; {
  const session = await getSession();
  if (!session) return null;
  const user = await findUserById(session.userId);
  return { ...toPublicUser(user), role: user.role };
});
// Different fields for different viewers
export async function getBookForViewer(id) {
  const book = await getBook(id);
  if (!book) return null;
  const session = await getSession();
  const isAdmin = session?.role === 'admin';
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    price: book.price,
    stock: isAdmin ? book.stock : undefined, // admins only
  };
}
// Secrets: read process.env only in server-only files like this one,
// and never give a secret a NEXT_PUBLIC_ name
</code></pre>
