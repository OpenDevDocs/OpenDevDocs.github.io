---
publishDate: 2026-10-25T13:27
title: Environment Variables
slug: environment-variables
metadescription: Learn how Next.js loads .env files, which file wins, how NEXT_PUBLIC_ variables reach the browser, and why some values are fixed at build time.
updateDate: 2026-10-25T13:27
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'env', 'configuration', 'secrets']
course: nextjs
---

## What you will learn

In [Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database) you connected Book Nook to a database. To do that, your code needed a connection string, and maybe a password. Those values should not be written inside your code. They belong in **environment variables**.

An **environment variable** is a named setting that lives outside your code, like `DATABASE_URL=...`. Your code reads it by name, and each computer (your laptop, a test server, the live site) can give it a different value.

Think of a bookshop. The shop's recipe for running the till is the same everywhere, but every branch has its own safe code, written on a card in the back office. Environment variables are those cards. The code is the same; the card on the wall changes.

By the end of this lesson you will know:

- how to put variables in `.env` files and read them with `process.env`
- which file wins when the same name appears twice
- why most variables are **server only**, and how `NEXT_PUBLIC_` sends one to the browser
- which values are fixed when you run `next build`, and how to read a value fresh on every request

## Step 1: create a .env.local file

Create a file called `.env.local` in the **root** of your project, next to `package.json`. Not inside `app/`.

```text
book-nook/
├── app/
├── lib/
├── public/
├── .env.local      new file
├── next.config.mjs
└── package.json
```

Put one setting per line, in the form `NAME=value`:

```bash
# .env.local
DATABASE_URL=postgres://bookshop:replace-with-your-password@localhost:5432/booknook
ADMIN_PASSWORD=replace-with-a-long-random-string
NEXT_PUBLIC_SHOP_NAME=Book Nook
```

- Lines that start with `#` are comments.
- No spaces around the `=` sign.
- Use quotes if the value has spaces or special characters: `GREETING="Welcome, reader!"`.

Now start the dev server:

```bash
npm run dev
```

Next.js lists the env files it found near the top of its output:

```text
▲ Next.js 16.4.3 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://192.168.1.20:3000
- Environments: .env.local
✓ Ready in 2.1s
```

If you edit `.env.local` while the dev server is running, Next.js notices and prints a line like this, so you usually do not need to restart:

```text
  Reload env: .env.local
```

## Step 2: keep the file out of Git

Your `.env.local` holds real passwords, so it must never be pushed to GitHub. The good news: `create-next-app` already took care of it. Open `.gitignore` and you will find these lines:

```text
# env files (can opt-in for committing if needed)
.env*
```

The pattern `.env*` means "ignore every file whose name starts with `.env`". Leave it there.

> **Tip:** Other people who clone your project still need to know which variables to create. A common habit is to commit a file called `.env.example` with the **names** and fake values only. Because `.env*` ignores it too, add a line `!.env.example` to `.gitignore` to allow just that one file.

## Step 3: read a variable on the server

Every variable becomes a property on `process.env`. Here is the database helper from the data layer lesson, now reading its connection string from the environment:

```javascript
// lib/db.js
import 'server-only';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing. Add it to .env.local');
}

export function getConnectionString() {
  return connectionString;
}
```

Three things to notice:

- `process.env.DATABASE_URL` is a plain string (or `undefined` if you forgot to set it).
- The `throw` gives you a clear error early, instead of a confusing database error later.
- `import 'server-only'` makes the build fail if a Client Component ever imports this file by mistake. You do not need to install anything; Next.js understands this import by itself. [Keeping Secrets and Data Safe](/courses/nextjs/data-security) covers it in depth.

You can read server variables anywhere code runs on the server: Server Components, Server Actions, Route Handlers and files in `lib/`.

## Step 4: which file wins?

You can have several env files. Next.js looks for each variable in this order and **stops at the first place it finds it**:

1. `process.env` (variables already set by your system or hosting platform)
2. `.env.$(NODE_ENV).local`, for example `.env.development.local`
3. `.env.local` (skipped when `NODE_ENV` is `test`)
4. `.env.$(NODE_ENV)`, for example `.env.production`
5. `.env`

`NODE_ENV` is set for you: `next dev` uses `development`, and `next build` and `next start` use `production`.

So if `.env` says `SHOP_NAME=Book Nook` and `.env.local` says `SHOP_NAME=Book Nook (local)`, you get `Book Nook (local)` on your laptop. On a hosting platform, the value you type into its settings page (that is `process.env`) beats every file.

Here is what each file is usually for:

| File | Loaded by | Typical use |
| --- | --- | --- |
| `.env` | every command | safe defaults for everyone |
| `.env.development` | `next dev` | defaults for development only |
| `.env.production` | `next build`, `next start` | defaults for production only |
| `.env.local` | dev, build and start | your own secrets, never committed |
| `.env.test` | test runners (`NODE_ENV=test`) | settings for automated tests |

You can also build one variable from another with `$`:

```bash
# .env
SHOP_URL=https://booknook.example.com
COVERS_URL=$SHOP_URL/covers
```

`process.env.COVERS_URL` becomes `https://booknook.example.com/covers`. If a value really contains a `$` (common in passwords), write it as `\$`.

## Step 5: send a value to the browser with NEXT_PUBLIC_

By default, environment variables are **server only**. Code that runs in the browser cannot see them. This is a safety feature: your database password stays on the server.

Sometimes you do want the browser to know a value, like the shop name or a public analytics ID. Start the name with `NEXT_PUBLIC_`:

```jsx
// components/Footer.js
'use client';

export default function Footer() {
  return (
    <footer className="p-4 text-sm text-zinc-500">
      Thanks for shopping at {process.env.NEXT_PUBLIC_SHOP_NAME}
    </footer>
  );
}
```

When you run `next build`, Next.js finds every `process.env.NEXT_PUBLIC_SHOP_NAME` in browser code and **replaces it with the actual text**, `"Book Nook"`. This is called **inlining**: the value is pasted into the JavaScript file that goes to the browser.

What about a variable without the prefix in a Client Component?

```jsx
// components/Oops.js
'use client';

export default function Oops() {
  // Do not do this
  return <p>Password is: {process.env.ADMIN_PASSWORD}</p>;
}
```

Next.js does not paste `ADMIN_PASSWORD` into the browser JavaScript. In the browser bundle it is empty. But remember from [Client Components and the use client Directive](/courses/nextjs/client-components) that Client Components **also run on the server** to make the first HTML. On the server, `process.env` has every variable. We built a page like this, and the saved HTML file really contained the secret value:

```text
Secret is: [Book Nook Build] Public is: [Public Nook]
```

So the password would be sent to every visitor inside the HTML, and then React would complain because the browser renders an empty value where the server rendered text. The rule is simple: **only read `NEXT_PUBLIC_` variables in Client Components.** Read everything else in Server Components, Server Actions, Route Handlers and `lib/` files that import `server-only`.

> **Warning:** Anything with `NEXT_PUBLIC_` can be read by every visitor, because it is inside your JavaScript files. Never put a password, API secret or database URL behind that prefix.

Inlining only works when you write the full name. A name stored in a variable is not replaced:

```javascript
// These are NOT inlined, so they are empty in the browser
const name = 'NEXT_PUBLIC_SHOP_NAME';
console.log(process.env[name]);

const env = process.env;
console.log(env.NEXT_PUBLIC_SHOP_NAME);
```

Always write `process.env.NEXT_PUBLIC_SOMETHING` in full.

## Step 6: build time or run time?

This is the part that surprises people. Some values are read **when you build**, and some **when a visitor asks for a page**.

**`NEXT_PUBLIC_` values are frozen at build time.** They are pasted into the JavaScript files during `next build`. If you change `NEXT_PUBLIC_SHOP_NAME` on your server afterwards, nothing happens until you build again. The same goes for a Docker image: build it once, and every copy carries the same public values.

**Server values used in a prerendered part are also frozen.** With Cache Components on (as in Book Nook), Next.js tries to render each page ahead of time during the build. If a component reads `process.env` and nothing in it waits for a request, that component is rendered during the build, and the value it saw ends up in the saved HTML:

```jsx
// app/about/page.js
export default function AboutPage() {
  // Read during "next build", then saved in the static HTML
  return <h1>About {process.env.SHOP_NAME}</h1>;
}
```

We tested this: we built a page showing `process.env.SHOP_NAME` with the value `Book Nook Build`, then started the server with `SHOP_NAME="Runtime Name"`. The page still said `Book Nook Build`, because the HTML was made during the build.

That is fine for values that never change between environments. When a server value must be read fresh for every request (for example, the same build runs on a test server and the live server with different settings), tell Next.js to wait for a real request with `connection()`, and wrap that part in `<Suspense>`:

```jsx
// app/about/page.js
import { Suspense } from 'react';
import { connection } from 'next/server';

async function SupportEmail() {
  await connection(); // everything below runs at request time
  return <p>Questions? Write to {process.env.SUPPORT_EMAIL}</p>;
}

export default function AboutPage() {
  return (
    <main>
      <h1>About Book Nook</h1>
      <Suspense fallback={<p>Loading contact details...</p>}>
        <SupportEmail />
      </Suspense>
    </main>
  );
}
```

You will learn exactly what "prerendered" and "request time" mean in the next lesson, [Static and Dynamic Rendering](/courses/nextjs/static-and-dynamic-rendering). For now remember the rule: **public values are fixed at build; server values are fixed at build too, unless the code that reads them runs at request time.**

## Step 7: set variables on your hosting platform

Your `.env.local` file stays on your computer. On a real server you set the same names in the platform's settings, and they arrive as `process.env` (number 1 in the load order). You will do this in [Deploying to Vercel](/courses/nextjs/deploying-to-vercel) and [Self-Hosting with Node.js and Docker](/courses/nextjs/self-hosting).

Remember: if you change a `NEXT_PUBLIC_` value on the platform, you must **redeploy** (build again) for the browser to see it.

## Common mistakes

### The .env file is in the wrong folder

If `process.env.DATABASE_URL` is `undefined` and the dev server output has no `- Environments:` line, Next.js did not find your file. It must sit in the project root, next to `package.json`. Not in `app/`, not in `lib/`, and not in `src/` even if you use a `src` folder.

### Forgetting the NEXT_PUBLIC_ prefix

A Client Component shows an empty value after it loads, or React warns about a hydration mismatch (the server HTML and the browser render disagree), even though the same line works in a Server Component. If the value is safe for everyone to see, rename the variable to start with `NEXT_PUBLIC_`, update your code to the new name, and reload. If it is a secret, move the code that uses it to the server instead.

### Expecting a new public value without rebuilding

You changed `NEXT_PUBLIC_SHOP_NAME` on the server, restarted with `next start`, and the old name is still there. Public values were pasted into the files during `next build`. Run the build again.

### Putting a secret behind NEXT_PUBLIC_

`NEXT_PUBLIC_STRIPE_SECRET_KEY` works, and that is the problem: every visitor can now read it in the browser's developer tools. If this happens, change (rotate) the secret with the provider straight away, then move it to a name without the prefix and use it only on the server.

### Committing a .env file

If you removed the `.env*` line from `.gitignore` and pushed a real password, deleting the file later is not enough: it stays in the Git history. Change the password, then put the ignore rule back.

## Quick recap

- Put variables in `.env.local` in the project root, one `NAME=value` per line, and read them with `process.env.NAME`.
- `.gitignore` already ignores `.env*`; keep secrets out of Git.
- Load order: `process.env`, then `.env.$(NODE_ENV).local`, `.env.local`, `.env.$(NODE_ENV)`, and finally `.env`. The first match wins.
- Variables are server only by default. `NEXT_PUBLIC_` copies a value into browser JavaScript at build time, so never use it for secrets.
- Write `process.env.NEXT_PUBLIC_NAME` in full; dynamic lookups are not inlined.
- Values read in prerendered parts are fixed at build. Use `await connection()` inside `<Suspense>` to read a server value on every request.
- `import 'server-only'` stops secret-reading files from ever reaching the browser.

<code id="code-content" class="language-javascript">
// lib/config.js: one safe place that reads Book Nook's settings on the server
// --- .env.local (project root, never committed)
// DATABASE_URL=postgres://bookshop:replace-with-your-password@localhost:5432/booknook
// ADMIN_PASSWORD=replace-with-a-long-random-string
// NEXT_PUBLIC_SHOP_NAME=Book Nook
// --- lib/config.js
import 'server-only'; // the build fails if a Client Component imports this file
// Fail early with a clear message when a required setting is missing
function required(name, value) {
  if (!value) {
    throw new Error(`${name} is missing. Add it to .env.local`);
  }
  return value;
}
// Write each name in full so it is easy to search for
export const config = {
  databaseUrl: required('DATABASE_URL', process.env.DATABASE_URL),
  adminPassword: required('ADMIN_PASSWORD', process.env.ADMIN_PASSWORD),
  // Public: also usable in Client Components, fixed at build time
  shopName: process.env.NEXT_PUBLIC_SHOP_NAME ?? 'Book Nook',
};
// --- Usage in a Server Component or Server Action
// import { config } from '@/lib/config';
// const db = connect(config.databaseUrl);
// --- Usage in a Client Component (public values only)
// &lt;p&gt;Welcome to {process.env.NEXT_PUBLIC_SHOP_NAME}&lt;/p&gt;
</code></pre>
