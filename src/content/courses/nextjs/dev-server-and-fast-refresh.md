---
publishDate: 2026-10-25T13:04
title: The Dev Server, Fast Refresh and Error Overlay
slug: dev-server-and-fast-refresh
metadescription: "Learn how next dev and Turbopack build your pages, how Fast Refresh keeps your state, how to read the error overlay and the Next.js Dev Tools menu."
updateDate: 2026-10-25T13:04
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'dev-server', 'fast-refresh', 'turbopack']
course: nextjs
---

## What you will learn

You have already started the dev server with `npm run dev`. In this lesson you will understand what it is doing for you, so you can work faster and fix mistakes calmly:

- the four npm scripts, and how to pass options to them
- how `next dev` and **Turbopack** build your pages on demand
- how **Fast Refresh** updates the browser while keeping what you typed or clicked
- how to read the **error overlay** when something goes wrong
- what the little **N** button in the corner (the **Next.js Dev Tools**) can tell you

You need the Book Nook project from [Creating Your First Next.js App](/courses/nextjs/create-your-first-app).

## The four npm scripts

Open `package.json` and look at the `scripts` section:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  }
}
```

Each one is a shortcut. When you type `npm run dev`, npm runs `next dev` for you.

| Command | Runs | When you use it |
| --- | --- | --- |
| `npm run dev` | `next dev` | All day, while you write code. Fast to start, updates live, shows helpful errors. |
| `npm run build` | `next build` | When you are ready to publish. Makes an optimised version of the site. |
| `npm start` | `next start` | After `build`, to run that optimised version, like a real server would. |
| `npm run lint` | `eslint` | To check your code for mistakes and bad habits. |

`start` is special: npm lets you skip the word `run` for it, so `npm start` works. The others need `run`.

The **development** version (from `dev`) and the **production** version (from `build` and `start`) behave a little differently. Development is built for comfort: helpful errors and instant updates. Production is built for speed: small files and pages prepared ahead of time. You will learn production builds in [Building for Production](/courses/nextjs/building-for-production). For now, you will live in `npm run dev`.

## Passing options to next dev

Sometimes you want to change how the dev server starts. With npm, put `--` before the options, so npm passes them on to `next`:

```bash
# Use port 4000 instead of 3000
npm run dev -- -p 4000

# Use the older Webpack bundler instead of Turbopack (rarely needed)
npm run dev -- --webpack
```

Without the `--`, npm would try to read `-p` itself and ignore it. You can also see every option:

```bash
npx next dev --help
```

## What next dev does

When you run `npm run dev`, Next.js prints:

```text
▲ Next.js 16.4.3 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://192.168.1.20:3000
✓ Ready in 1.8s
✓ Running next.config.mjs took 466ms
- Cache Components enabled
- Partial Prefetching enabled
```

Notice that it is ready in about two seconds, even though nothing has been built yet. That is on purpose. **Turbopack**, the bundler built into Next.js 16, compiles each page **only when you first open it**. A big site with hundreds of pages still starts quickly, because you only pay for the pages you visit.

Open `http://localhost:3000` and watch the terminal:

```text
○ Compiling / ...
 GET / 200 in 1823ms (next.js: 1655ms, application-code: 168ms)
```

- `○ Compiling / ...` means Turbopack is building the home page for the first time.
- `GET / 200` is a **request log**: the browser asked for `/` and got status `200` (OK).
- The times show how long it took. Here `next.js` (compiling) took most of it, and `application-code` (your components) was quick.

Reload the page and it is much faster, because it is already compiled:

```text
 GET / 200 in 213ms (next.js: 19ms, application-code: 194ms)
```

The compiled files go into the `.next/dev` folder. You never edit them, and you can delete `.next` any time if things act strangely. Next.js rebuilds it.

### Where console.log goes

Your pages run **on the server** by default, so `console.log` in a page prints in the **terminal**, not the browser:

```jsx
// app/page.js
export default function Home() {
  console.log('Rendering the home page');
  return <h1>Welcome to Book Nook</h1>;
}
```

```text
Rendering the home page
 GET / 200 in 98ms (next.js: 12ms, application-code: 86ms)
```

This surprises many React developers. Keep an eye on both the terminal and the browser's developer tools (press **F12**). As a helper, `next dev` also forwards warnings and errors from the browser console to the terminal. You will learn exactly where each component runs in [Server Components Explained](/courses/nextjs/server-components).

## Fast Refresh: instant updates that keep your state

**Fast Refresh** is the feature that updates the browser the moment you save a file. Most edits show up in well under a second, with no reload.

The clever part: it keeps your component's **state** (the values stored with `useState`). Let us see it. Create a small button that counts likes. It needs `'use client'` at the top, because it uses state and clicks. You will learn exactly why in [Client Components and the use client Directive](/courses/nextjs/client-components).

```jsx
// components/LikeButton.js
'use client';

import { useState } from 'react';

export default function LikeButton() {
  const [likes, setLikes] = useState(0);

  return (
    <button
      type="button"
      onClick={() => setLikes(likes + 1)}
      className="rounded border px-3 py-1"
    >
      Likes: {likes}
    </button>
  );
}
```

Use it on the home page:

```jsx
// app/page.js
import LikeButton from '@/components/LikeButton';

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Welcome to Book Nook</h1>
      <LikeButton />
    </main>
  );
}
```

Now try this:

1. Click the button five times. It says `Likes: 5`.
2. In `LikeButton.js`, change the text `Likes:` to `Hearts:` and save.
3. The button now says `Hearts: 5`. The text changed, but the count **stayed at 5**.

That is Fast Refresh at work. Without it, the page would reload and you would lose the count every time you tweaked a word. When you are building a form or a multi-step flow, this saves a lot of clicking.

### When Fast Refresh resets or reloads

Fast Refresh keeps state only when it is safe. Here are the rules, from the Next.js docs:

- If a file **only exports React components**, Fast Refresh updates just that file and keeps state.
- If a file also exports **other things** (like a constant or a helper function), Fast Refresh re-runs that file **and every file that imports it**. State in those components may reset.
- If a file is imported by code **outside React** (a plain helper file, for example), Fast Refresh falls back to a **full page reload**.
- An anonymous default export like `export default () => <div />` loses its state on every edit. Give your components names:

```jsx
// Loses state on every edit: no name
export default () => <p>Hi</p>;

// Keeps state: a named function
export default function Greeting() {
  return <p>Hi</p>;
}
```

If you ever **want** a component to start fresh on every save (for example, while tuning an animation that plays once), add this comment anywhere in the file:

```jsx
// @refresh reset
```

## The error overlay

Everybody makes mistakes. In development, Next.js shows them in a big, readable **error overlay** on top of your page. Let us break things on purpose.

### A build error (bad syntax)

In `app/page.js`, close the `<h1>` with the wrong tag:

```jsx
// app/page.js (broken on purpose)
export default function Home() {
  return <h1>Welcome to Book Nook</h2>;
}
```

Save. The browser shows an overlay with a red **Build Error** label and this message:

```text
Expected corresponding JSX closing tag for <h1>
```

Below it is the file name and position (`./app/page.js (2:31)` means line 2, column 31), a few lines of your code with a `^^` marker under the problem, and a final line: `Parsing ecmascript source code failed`. **Parsing** means reading the code. Turbopack could not even read the file, so it could not build it.

The terminal shows the same thing:

```text
⨯ ./app/page.js:2:31
Error: Expected corresponding JSX closing tag for <h1>
  1 | export default function Home() {
> 2 |   return <h1>Welcome to Book Nook</h2>;
    |                                   ^^
  3 | }

Parsing ecmascript source code failed
```

Now fix the tag (`</h1>`) and save. The overlay disappears by itself. You do not need to reload, and Fast Refresh keeps your state.

### A runtime error (bad code that runs)

A **runtime error** happens when the code is valid but fails while running. Try reading a property of something that does not exist:

```jsx
// app/about/page.js (broken on purpose)
export default function AboutPage() {
  const shop = undefined;
  return <h1>About {shop.name}</h1>;
}
```

Visit `/about` (create the folder `app/about` if you do not have it yet). The overlay shows:

- a red **Runtime TypeError** label
- the message `Cannot read properties of undefined (reading 'name')`
- the exact spot, `app/about/page.js (3:26) @ AboutPage`, with the line highlighted
- a **Call Stack**: the list of functions that were running when it broke. The top one, `AboutPage`, is yours. Next.js hides its own internal frames behind a "Show ignore-listed frame(s)" button so you can focus on your code.

At the top of the overlay you can see `1/1` with arrows (to step through several errors), the Next.js version, and buttons to copy the error or open the docs.

The terminal shows it too, with the file and line:

```text
⨯ TypeError: Cannot read properties of undefined (reading 'name')
    at AboutPage (app/about/page.js:3:26)
  1 | export default function AboutPage() {
  2 |   const shop = undefined;
> 3 |   return <h1>About {shop.name}</h1>;
    |                          ^
  4 | }
 GET /about 500 in 55ms (next.js: 2ms, application-code: 53ms)
```

Status `500` means "server error". Fix the code and save, and the overlay goes away.

> **Tip:** Read the **first line** of an error and the **first file of yours** in the stack. Together they almost always tell you what broke and where. You can also click the small link icon next to the file name to open that line in your editor.

The overlay only exists in development. Real visitors never see it. In production they see a friendly error page instead, which you will build in [Handling Errors with error.js](/courses/nextjs/error-handling).

## The Next.js Dev Tools indicator

In the bottom-left corner of every page in development, you will see a small round button with an **N**. This is the **Next.js Dev Tools** indicator.

- When there are problems, it turns red and shows a count, like **1 Issue**. Click it to open the error overlay again, even if you closed it.
- When all is well, click it to open a small menu.

The menu in the Book Nook project shows:

```text
Bundler                Turbopack
Cache Components       Enabled
Navigation Inspector   >
Route Info             >
Preferences
```

- **Bundler** and **Cache Components** confirm how your project is set up.
- **Route Info** tells you about the page you are on, including whether it is **static** (prepared ahead of time) or **dynamic** (made fresh for each request). This becomes very useful in [Static and Dynamic Rendering](/courses/nextjs/static-and-dynamic-rendering).
- **Navigation Inspector** helps you study how pages load when you click links, which you will meet in [Linking and Navigating Between Pages](/courses/nextjs/linking-and-navigating).
- **Preferences** lets you move the button or hide it.

You can also move or hide the indicator in `next.config.mjs` with the `devIndicators` option:

```javascript
// next.config.mjs (only the new part shown)
const nextConfig = {
  // ...your existing options stay here
  devIndicators: {
    position: 'bottom-right', // 'bottom-left' (default), 'bottom-right', 'top-left' or 'top-right'
  },
};
```

Setting `devIndicators: false` hides the button. Errors are still shown. Remember to restart the dev server after changing `next.config.mjs`.

## Checking your code with lint

Run ESLint any time:

```bash
npm run lint
```

If everything is fine, it prints nothing. If you, for example, use a plain `<img>` tag, it warns you:

```text
app\page.js
  2:10  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. ...  @next/next/no-img-element

✖ 1 problem (0 errors, 1 warning)
```

ESLint warnings are advice, not errors. Your app still runs. With the ESLint extension in VS Code, you see the same warnings as squiggly underlines while you type. (Older Next.js versions had a `next lint` command. In Next.js 16 it is gone, and the `lint` script runs `eslint` directly.)

## Common mistakes

### Looking for console.log in the wrong place

You add `console.log` to a page and nothing shows in the browser console. Pages are Server Components by default, so look in the **terminal** where `npm run dev` is running.

### Editing next.config.mjs and expecting Fast Refresh

Fast Refresh updates your components, not the config. After changing `next.config.mjs` or installing a package, stop the server with **Ctrl + C** and run `npm run dev` again.

### Forgetting `--` when passing options

```bash
npm run dev -p 4000
```

npm swallows `-p 4000` and Next.js still starts on port 3000. Write `npm run dev -- -p 4000`.

### Running two dev servers by accident

If you start `npm run dev` in a second terminal, you may see:

```text
⚠ Port 3000 is in use by process 12345, using available port 3001 instead.
```

Now you have two servers and may be editing one while looking at the other. Close the extra terminal (or press **Ctrl + C** in it) and use just one.

### Something feels stuck or strange

If pages stop updating or you see odd errors after big changes, stop the server, delete the `.next` folder, and start again:

```bash
# macOS and Linux
rm -rf .next
npm run dev
```

```bash
# Windows (PowerShell)
Remove-Item -Recurse -Force .next
npm run dev
```

## Quick recap

- `npm run dev` starts `next dev` for development. `build` and `start` are for production, and `lint` runs ESLint.
- Pass options with `--`, like `npm run dev -- -p 4000`.
- Turbopack compiles each page the first time you open it, so the server starts fast. The terminal shows `Compiling` and `GET` lines.
- `console.log` in pages prints in the terminal, because pages run on the server.
- Fast Refresh updates the browser on save and keeps component state, as long as the file only exports named components.
- The error overlay shows **Build Errors** (bad syntax) and **Runtime errors** with the exact file and line. Fix and save, and it disappears.
- The **N** button opens the Next.js Dev Tools: issues, bundler, Cache Components status, Route Info and preferences.

<code id="code-content" class="language-jsx">
// components/LikeButton.js: try Fast Refresh with this button
'use client'; // needed because this component uses state and clicks
import { useState } from 'react';
// A named component keeps its state when you edit and save the file
export default function LikeButton() {
  const [likes, setLikes] = useState(0);
  return (
    &lt;button
      type="button"
      onClick={() =&gt; setLikes(likes + 1)}
      className="rounded border px-3 py-1"
    &gt;
      {/* Click a few times, then change "Likes" to "Hearts" and save: the count stays */}
      Likes: {likes}
    &lt;/button&gt;
  );
}
// --- next file: app/page.js
// import LikeButton from '@/components/LikeButton';
// export default function Home() {
//   console.log('Rendering the home page'); // prints in the terminal, not the browser
//   return (
//     &lt;main className="mx-auto max-w-2xl p-8"&gt;
//       &lt;h1 className="text-3xl font-bold"&gt;Welcome to Book Nook&lt;/h1&gt;
//       &lt;LikeButton /&gt;
//     &lt;/main&gt;
//   );
// }
// --- terminal: npm run dev, npm run dev -- -p 4000, npm run lint
</code></pre>
