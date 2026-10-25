---
publishDate: 2026-10-25T13:43
title: Protecting Pages, Actions and APIs
slug: authorization
metadescription: Protect Next.js pages, Server Actions and Route Handlers with a Data Access Layer and verifySession, plus forbidden() and unauthorized() behind authInterrupts.
updateDate: 2026-10-25T13:43
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'authorization', 'security', 'data-access-layer']
course: nextjs
---

## What you will learn

Book Nook has logins now ([Adding Login with Sessions and Cookies](/courses/nextjs/authentication)). But a login on its own protects nothing. Right now:

- Riya, a customer, can open `/admin` if she has a session cookie.
- Anyone can call the `createBook` Server Action, logged in or not.
- Anyone can `POST` to `/api/books` with curl.

In this lesson you will close every one of those doors. You will:

- build a **Data Access Layer** with `verifySession()`, the one place that knows who the user is,
- check permissions in **pages**, **Server Actions** and **Route Handlers**, not just in Proxy,
- show proper "401" and "403" pages with `unauthorized()` and `forbidden()`.

## Why Proxy is not enough

In [Running Code Before Requests with Proxy](/courses/nextjs/proxy) you added a redirect for `/admin`. It is useful, but it is a hotel doorman, not a lock on every door:

- **Server Actions are not separate URLs.** They are `POST` requests to whatever page uses them. If the page is not in your matcher, Proxy never sees the action. A small matcher change can quietly remove protection.
- **Proxy only checks the cookie**, not the database. A deleted user or a changed role still has a valid-looking cookie until it expires.
- **Anyone can call your server directly.** Server Actions and Route Handlers are public endpoints. Hiding a button in the UI does not hide the endpoint.

So the rule from the Next.js security docs is: **check as close to the data as possible**, in every entry point. Proxy can stay as a fast first filter.

## Two different questions

Authorization asks two questions, and the HTTP status codes have a name for each:

| Question | If the answer is no | Status |
| --- | --- | --- |
| Are you logged in at all? | **Unauthorized**: please log in | `401` |
| Are you allowed to do this? | **Forbidden**: logged in, but not allowed | `403` |

Riya opening `/admin` is a `403`: she is logged in, but she is not an admin. A stranger calling the API is a `401`.

## Step 1: the Data Access Layer

A **Data Access Layer** (DAL) is a small set of server-only functions that every page, action and API goes through to find out who the user is and to load data. Because there is only one place, there is only one place to get right.

Grow `lib/dal.js` from the last lesson:

```javascript
// lib/dal.js
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decrypt } from '@/lib/session';
import { findUserById } from '@/lib/users';

// Who is this? Returns { userId, role } or null. Never throws, never redirects.
export const getSession = cache(async () => {
  const token = (await cookies()).get('session')?.value;
  const payload = await decrypt(token);
  if (!payload?.userId) return null;

  // Secure check: the user must still exist, and the role comes from our data,
  // not from the cookie
  const user = await findUserById(payload.userId);
  if (!user) return null;

  return { userId: user.id, role: user.role };
});

// For pages and actions: a logged-in user, or off to the login page
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
});

// For the UI: only the fields it needs
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const user = await findUserById(session.userId);
  return { id: user.id, name: user.name, role: user.role };
});
```

Three helpers, three jobs:

- `getSession()` answers "who is this?" and returns `null` for strangers. Route Handlers use it, because an API should answer `401`, not redirect to an HTML page.
- `verifySession()` is for pages and actions. A stranger is sent to `/login`. `redirect()` works by throwing, so code after it only runs for logged-in users.
- `getCurrentUser()` gives the UI a small, safe object. More about that in [Keeping Secrets and Data Safe](/courses/nextjs/data-security).

Notice that the role comes from `findUserById`, not from the cookie. The cookie's role is fine for quick, optimistic checks in Proxy, but if you remove someone's admin rights, the database must win immediately.

About `cache`: React's `cache` remembers a result **during one render**, so ten components calling `verifySession()` cost one check. Server Actions and Route Handlers are not part of a render, so there it does nothing and each call runs again. That is fine, just good to know.

## Step 2: protect a page

The admin page checks the session and the role. With Cache Components on, the part that reads cookies sits inside `<Suspense>`:

```jsx
// app/admin/page.js
import { Suspense } from 'react';
import { forbidden } from 'next/navigation';
import { verifySession, getCurrentUser } from '@/lib/dal';
import { getBooks } from '@/lib/books';

async function AdminPanel() {
  const session = await verifySession(); // strangers go to /login
  if (session.role !== 'admin') {
    forbidden(); // logged in, but not allowed
  }

  const user = await getCurrentUser();
  const books = await getBooks();
  return <p>Welcome back, {user.name}. The shop has {books.length} books.</p>;
}

export default function AdminPage() {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Admin</h1>
      <Suspense fallback={<p>Checking your access...</p>}>
        <AdminPanel />
      </Suspense>
    </main>
  );
}
```

Only the heading is in the static shell. Everything private is inside the boundary, after the check.

### Turning on forbidden() and unauthorized()

`forbidden()` stops rendering and shows a "403" page. Its partner `unauthorized()` shows a "401" page. Both come from `next/navigation`, like `notFound()`.

Here is the honest part: in **Next.js 16.4 these two functions are still experimental**. You must switch them on in `next.config.mjs`, under `experimental.authInterrupts`. Add this block inside the `nextConfig` object, next to `cacheComponents`, and keep everything else (your `turbopack` rules, `redirects` and so on) as it is:

```javascript
// next.config.mjs (inside the nextConfig object)
  experimental: {
    authInterrupts: true,
  },
```

Restart the dev server. The build output now lists it:

```text
- Experiments (use with caution):
  ✓ authInterrupts
```

"Experimental" means the API could still change in a future version. If you would rather avoid experimental flags, use `redirect('/login')` for strangers and `notFound()` or a plain "not allowed" message for wrong roles. Everything else in this lesson works without the flag.

### The forbidden.js and unauthorized.js files

Like `not-found.js`, these special files decide what the user sees. Put them in `app/` to cover the whole site, or deeper to cover one section:

```jsx
// app/forbidden.js
import Link from 'next/link';

export default function Forbidden() {
  return (
    <main className="p-8">
      <h2 className="text-xl font-bold">No entry</h2>
      <p>Your account is not allowed to see this page.</p>
      <Link href="/" className="underline">Back to the shop</Link>
    </main>
  );
}
```

```jsx
// app/unauthorized.js
import Link from 'next/link';

export default function Unauthorized() {
  return (
    <main className="p-8">
      <h2 className="text-xl font-bold">Please log in</h2>
      <p>You need an account to see this page.</p>
      <Link href="/login" className="underline">Log in</Link>
    </main>
  );
}
```

Log in as Riya and open `/admin`. You see:

```text
No entry
Your account is not allowed to see this page.
Back to the shop
```

Next.js also adds `<meta name="robots" content="noindex">` so search engines do not index the page.

**About the status code:** if `forbidden()` runs before streaming starts, the response is a real `403`. In our page, the shell (with the heading) has already started streaming when the check runs inside `<Suspense>`, so the status stays `200` while the forbidden UI replaces the content. People see the right page, and the private data never leaves the server. If you need a true `403` status (for example for monitoring tools), add a quick check in Proxy, which runs before any streaming.

To use `unauthorized()` for strangers instead of a redirect, swap one line in `verifySession`:

```javascript
// lib/dal.js
import { unauthorized } from 'next/navigation';

export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session) unauthorized(); // shows app/unauthorized.js
  return session;
});
```

Both styles are fine. A redirect is smoother for a shop; a 401 page is clearer for an app where most pages need a login.

Two rules for both functions: they cannot be called in the **root layout**, and because they work by throwing, do not wrap them in `try`/`catch`.

## Step 3: protect every Server Action

A Server Action is a public endpoint. Checking the page that shows the form is **not** enough: the action can be called without ever loading that page. So every action checks for itself, at the very top:

```javascript
// app/actions.js (the createBook action, now protected)
import * as z from 'zod';
import { updateTag } from 'next/cache';
import { redirect, forbidden } from 'next/navigation';
import { bookSchema } from '@/lib/book-schema';
import { addBook } from '@/lib/books';
import { verifySession } from '@/lib/dal';

export async function createBook(prevState, formData) {
  // 1. Who is calling, and may they do this?
  const session = await verifySession();
  if (session.role !== 'admin') {
    forbidden();
  }

  // 2. Only then validate and save (as in the validation lesson)
  const values = {
    title: formData.get('title'),
    author: formData.get('author'),
    price: formData.get('price'),
    genre: formData.get('genre'),
    description: formData.get('description'),
  };
  const result = bookSchema.safeParse(values);
  if (!result.success) {
    return { errors: z.flattenError(result.error).fieldErrors, values };
  }
  const book = await addBook(result.data);
  if (!book) {
    return { message: 'A book with this title is already in the shop.', values };
  }
  updateTag('books');
  redirect(`/books/${book.id}`);
}
```

When Riya (a customer) somehow submits this form, she gets the "No entry" page, and no book is added.

### Check the resource, not just the role

Some actions need a finer question: "is this **your** thing?" Imagine the reviews from [Pending States and Optimistic Updates](/courses/nextjs/pending-and-optimistic-ui) now store who wrote them (the `postReview` action saves `session.userId` on each review, as shown in [Keeping Secrets and Data Safe](/courses/nextjs/data-security)), and `lib/reviews.js` has a small `findReview(id)` helper. Any logged-in user may delete **their own** review; an admin may delete any:

```javascript
// app/actions.js (deleteReview, now protected)
import { findReview, removeReview } from '@/lib/reviews';

export async function deleteReview(bookId, reviewId) {
  const session = await verifySession();
  const review = await findReview(reviewId);
  if (!review) return;

  const isOwner = review.userId === session.userId;
  if (!isOwner && session.role !== 'admin') {
    forbidden();
  }

  await removeReview(reviewId);
  updateTag(`reviews-${bookId}`);
}
```

Without the owner check, any user could delete any review just by sending a different `reviewId`. This kind of bug has a name: **IDOR** (Insecure Direct Object Reference). Never trust ids sent from the browser to mean "mine".

## Step 4: protect Route Handlers

APIs talk to programs, so they should answer with status codes and JSON, not HTML pages or redirects. Use `getSession()` and return `401` or `403` yourself:

```javascript
// app/api/books/route.js
import * as z from 'zod';
import { addBook } from '@/lib/books';
import { bookSchema } from '@/lib/book-schema';
import { getSession } from '@/lib/dal';

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Please log in.' }, { status: 401 });
  }
  if (session.role !== 'admin') {
    return Response.json({ error: 'Admins only.' }, { status: 403 });
  }

  // ...read, validate and save exactly as before
}
```

Test it with curl, which sends no cookie:

```bash
curl -i -X POST http://localhost:3000/api/books -H "Content-Type: application/json" -d '{}'
```

```text
HTTP/1.1 401 Unauthorized
...
{"error":"Please log in."}
```

## Step 5: hide what users cannot use

Now that the server is safe, make the UI friendly: only show the **Add a book** link to admins.

```jsx
// components/AdminLink.js
import Link from 'next/link';
import { getCurrentUser } from '@/lib/dal';

export default async function AdminLink() {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') return null;
  return <Link href="/books/new">Add a book</Link>;
}
```

Place it like `UserMenu` in [Adding Login with Sessions and Cookies](/courses/nextjs/authentication): render it in `app/layout.js`, inside the `<Suspense>` you pass to the header's `userMenu` prop, for example `<><AdminLink /><UserMenu /></>`. Remember the order of importance: hiding a link is **comfort**, the checks in Steps 2 to 4 are **security**. Never rely on hidden buttons.

## Do not protect with a layout

It is tempting to put one check in `app/admin/layout.js` and call it done. The Next.js docs warn against it:

- Layouts do not re-render when you navigate between pages that share them, so the check does not run again on each page change.
- A layout does not stop its pages from rendering, and it does nothing for Server Actions or Route Handlers.

Put the check in each page (or, better, inside the DAL functions that load private data), and in each action and API.

## A checklist for every entry point

| Entry point | How to check | When the check fails |
| --- | --- | --- |
| Proxy | `decrypt` the cookie (optimistic only) | Redirect to `/login` |
| Page or component | `await verifySession()`, then check role | `redirect`, `unauthorized()` or `forbidden()` |
| Server Action | `await verifySession()` at the top, then role and ownership | `forbidden()`, or return an error |
| Route Handler | `await getSession()`, then role | `401` or `403` JSON response |

## Common mistakes

### Protecting only the page

The page checks the role, but the Server Action it uses does not. Anyone can still call the action directly with a `POST`. Every action checks on its own.

### Forgetting the experimental flag

Calling `forbidden()` without the flag throws:

```text
Error: `forbidden()` is experimental and only allowed to be enabled when `experimental.authInterrupts` is enabled.
```

`unauthorized()` throws the same kind of error. Add `experimental.authInterrupts: true` to `next.config.mjs` and restart the dev server.

### Catching the interrupt

```javascript
try {
  if (session.role !== 'admin') forbidden();
} catch (error) {
  // the forbidden page never shows
}
```

`forbidden()`, `unauthorized()`, `redirect()` and `notFound()` all work by throwing a special error. A `try`/`catch` around them swallows it. Keep them outside `try` blocks.

### Trusting the role in the cookie

The cookie's role is a snapshot from login time. For anything that matters, read the role from your data, as `getSession()` does.

### Redirecting from an API

An API that redirects to `/login` gives a program an HTML login page instead of an error. Return `401` or `403` JSON from Route Handlers.

## Quick recap

- Logging in is not protection. Check permissions in every page, Server Action and Route Handler.
- Proxy is a fast, optimistic first filter, not your security.
- A Data Access Layer (`lib/dal.js`, `server-only`) holds `getSession()`, `verifySession()` and `getCurrentUser()`, all wrapped in React's `cache`.
- Read the role from your data, not from the cookie, for real decisions.
- `unauthorized()` (401) and `forbidden()` (403) render `unauthorized.js` and `forbidden.js`. In Next.js 16.4 they need `experimental.authInterrupts: true`.
- Check ownership as well as roles, to avoid IDOR bugs.
- Route Handlers answer `401` and `403` JSON. Hiding buttons is for comfort only.

<code id="code-content" class="language-javascript">
// lib/dal.js: the Data Access Layer, the one place that decides who the user is
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decrypt } from '@/lib/session';
import { findUserById } from '@/lib/users';
// Who is this? { userId, role } or null. Use in Route Handlers (then return 401/403).
export const getSession = cache(async () =&gt; {
  const token = (await cookies()).get('session')?.value;
  const payload = await decrypt(token); // null if missing, changed or expired
  if (!payload?.userId) return null;
  // The role comes from our data, not from the cookie
  const user = await findUserById(payload.userId);
  if (!user) return null;
  return { userId: user.id, role: user.role };
});
// Pages and Server Actions: a logged-in user, or off to /login
export const verifySession = cache(async () =&gt; {
  const session = await getSession();
  if (!session) redirect('/login'); // or unauthorized() with authInterrupts
  return session;
});
// The UI gets a small object, never the whole user record
export const getCurrentUser = cache(async () =&gt; {
  const session = await getSession();
  if (!session) return null;
  const user = await findUserById(session.userId);
  return { id: user.id, name: user.name, role: user.role };
});
// --- Using it in a Server Action (createBook in app/actions.js):
// const session = await verifySession();
// if (session.role !== 'admin') forbidden(); // needs experimental.authInterrupts
// --- And in a Route Handler (app/api/books/route.js):
// const session = await getSession();
// if (!session) return Response.json({ error: 'Please log in.' }, { status: 401 });
// if (session.role !== 'admin') return Response.json({ error: 'Admins only.' }, { status: 403 });
</code></pre>
