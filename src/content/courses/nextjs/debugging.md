---
publishDate: 2026-10-25T13:54
title: Debugging Next.js Apps
slug: debugging
metadescription: Debug Next.js apps with VS Code launch.json, next dev --inspect, browser DevTools and terminal logs, for both server and client code.
updateDate: 2026-10-25T13:54
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'debugging', 'devtools', 'vscode']
course: nextjs
---

## Why debugging feels different in Next.js

In a plain React app, all your code runs in the browser, so the browser's DevTools show you everything. A Next.js app is different: it is **two programs at once**.

- **Server code** runs in Node.js on your computer (or on a server later). Server Components, Server Actions, Route Handlers, `proxy.js` and everything in `lib/` live here.
- **Client code** runs in the browser. Client Components (files with `'use client'`) live here, plus the server parts that React "hydrates" in the browser.

Think of a restaurant. The kitchen (the server) cooks the food, and the dining room (the browser) is where guests eat it. If the soup is cold, you need to know whether the cook made it wrong or the waiter left it on the counter. Debugging Next.js is mostly about knowing **which room to look in**.

In this lesson you will learn four tools, from simplest to most powerful:

1. `console.log` and where its output appears
2. The browser DevTools for client code
3. `next dev --inspect` for server code
4. VS Code's debugger, which can pause both sides

We use the Book Nook app you have been building. If you have not met the error overlay yet, read [The Dev Server, Fast Refresh and Error Overlay](/courses/nextjs/dev-server-and-fast-refresh) first.

## Step 1: know where console.log goes

Add a log to a Server Component and to a Client Component:

```jsx
// app/books/[id]/page.js
import { getBook } from '@/lib/books';
import AddToCartButton from '@/components/AddToCartButton';

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  console.log('Rendering book page for', id);

  return (
    <article>
      <h1>{book.title}</h1>
      <AddToCartButton book={book} />
    </article>
  );
}
```

```jsx
// components/AddToCartButton.js
'use client';

export default function AddToCartButton({ book }) {
  function handleClick() {
    console.log('Clicked add to cart for', book.title);
  }

  return <button onClick={handleClick}>Add to cart</button>;
}
```

Run `npm run dev` and open `http://localhost:3000/books/dune`, then click the button.

- `Rendering book page for dune` appears in your **terminal**, because the page ran on the server.
- `Clicked add to cart for Dune` appears in the **browser console** (press F12, then open **Console**), because the click handler ran in the browser.

```text
 GET /books/dune 200 in 1758ms
Rendering book page for dune
```

This is the first rule of Next.js debugging: **if you cannot find your log, look in the other window**.

> **Tip:** In development, React also replays Server Component logs in the browser console with a small "Server" badge, so you may see them in both places. The terminal is still the real home of server output, and in production it is the only place they appear.

## Step 2: debug client code with browser DevTools

For Client Components, the browser is your best friend. Open DevTools (F12, or Ctrl + Shift + I on Windows and Linux, Cmd + Option + I on macOS):

- **Console** shows logs and errors from the browser.
- **Sources** (Chrome and Edge) or **Debugger** (Firefox) lets you pause the code.
- **Network** shows every request, including Server Action calls and page data.

To pause code, add a `debugger` statement where you want to stop:

```jsx
// components/AddToCartButton.js
'use client';

export default function AddToCartButton({ book }) {
  function handleClick() {
    debugger; // the browser pauses here while DevTools is open
    console.log('Clicked add to cart for', book.title);
  }

  return <button onClick={handleClick}>Add to cart</button>;
}
```

Click the button with DevTools open. The page freezes on that line, and you can hover over `book` to see its value, or step forward one line at a time. A **breakpoint** is exactly this: a "stop here" sign in your code. You can also set one without editing files: press Ctrl + P (Cmd + P on macOS) in the Sources panel, type the file name, and click a line number.

Install the **React Developer Tools** browser extension too ([react.dev](https://react.dev/learn/react-developer-tools) links to it). Its **Components** tab shows your component tree with props and state, which is perfect for checking what your `CartProvider` holds right now.

## Step 3: debug server code with --inspect

The browser cannot pause your Server Components, because they never run there. For that you start Next.js with the Node.js **inspector**, a built-in tool that lets a debugger connect to a running Node.js program.

```bash
npm run dev -- --inspect
```

The extra `--` tells npm "pass the next flags to the script", so this runs `next dev --inspect`. You will see a new line at the top:

```text
> book-nook@0.1.0 dev
> next dev --inspect

Debugger listening on ws://127.0.0.1:9229/dbe2e504-2fc3-4f2b-a4cc-e3544c4d07c8
For help, see: https://nodejs.org/en/docs/inspector
▲ Next.js 16.4.3 (Turbopack)
- Local:         http://localhost:3000
- Debugger port: 9229
✓ Ready in 471ms
```

Now connect a debugger:

- **Chrome or Edge:** open a new tab at `chrome://inspect` (or `edge://inspect`), find your app under **Remote Target**, and click **inspect**. A separate DevTools window opens. Go to **Sources**.
- **Firefox:** open `about:debugging`, click **This Firefox**, and find your app under **Remote Targets**.

Put a `debugger` statement in a Server Component, refresh the page, and the server pauses on that line:

```jsx
// app/books/[id]/page.js
export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  debugger; // the server pauses here when an inspector is attached
  // ...
}
```

While paused, the browser tab keeps spinning, because the server has not finished the page yet. That is normal. Press the resume button (or F8) to let it continue.

> **Good to know:** When the error overlay shows a server error, look for a small Node.js icon under the Next.js version badge. Clicking it copies the DevTools address for the server process, which you can paste into a new tab.

If you need the server to pause on the very first line (for example, to debug `next.config.mjs`), pass the flag through `NODE_OPTIONS` instead:

```bash
# macOS and Linux
NODE_OPTIONS=--inspect-brk npx next dev
```

On Windows, set the variable first in PowerShell with `$env:NODE_OPTIONS="--inspect-brk"`, then run `npx next dev`.

## Step 4: debug both sides in VS Code

Switching between terminal, browser and DevTools windows gets tiring. VS Code can do it all in one place with a **launch configuration**: a small JSON file that tells VS Code how to start and attach its debugger.

Create `.vscode/launch.json` in the project root (the `.vscode` folder sits next to `package.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev -- --inspect"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/next/dist/bin/next",
      "runtimeArgs": ["--inspect"],
      "skipFiles": ["<node_internals>/**"],
      "serverReadyAction": {
        "action": "debugWithEdge",
        "killOnServerStop": true,
        "pattern": "- Local:.+(https?://.+)",
        "uriFormat": "%s",
        "webRoot": "${workspaceFolder}"
      }
    }
  ]
}
```

What each one does:

- **debug server-side** starts `next dev --inspect` in VS Code's terminal and attaches automatically. Breakpoints in Server Components, Server Actions, Route Handlers and `lib/` files work.
- **debug client-side** opens Chrome at your app (start `npm run dev` yourself first). Breakpoints in Client Components work.
- **debug full stack** starts the server, waits until it prints its `- Local:` address, then opens Edge and debugs both sides. If you use Chrome, change `debugWithEdge` to `debugWithChrome`.

To use them, open the **Run and Debug** panel (Ctrl + Shift + D, or Cmd + Shift + D on macOS), pick a configuration from the dropdown, and press **F5**. Now you can click in the gutter to the left of any line number to set a red breakpoint dot, without writing `debugger` at all.

```text
Run and Debug panel
  ▶ Next.js: debug full stack   ▼
  VARIABLES
    Local
      id: "dune"
      book: {id: 'dune', title: 'Dune', author: 'Frank Herbert', ...}
```

If you changed the port (for example with `next dev -p 4000`), change `3000` in the URLs too.

## Step 5: read server errors in the terminal

Many bugs do not need a debugger at all. Next.js prints helpful errors in the terminal, often with a code frame that points to the exact line. Here is a real one from Book Nook, shown while the dev server was running:

```text
Error: Route "/books/[id]": Next.js encountered URL data during prerendering or a navigation.

`params` or `searchParams` accessed outside of `<Suspense>` may prevent the navigation from being instant, leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [block] Set `export const instant = false` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/instant-shell-url-data
    at BookPage (app\books\[id]\page.js:26:18)
> 26 |   const { id } = await params;
     |                  ^
```

Read it from top to bottom: **what** went wrong (the route reads `params` outside a Suspense boundary), **how** to fix it (the bullet list), and **where** (the file, line 26). Here the fix is to add `app/books/[id]/loading.js`, as you learned in [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming).

If a production build fails while prerendering and the stack trace only points at `body` or `html`, rerun the build with extra detail:

```bash
npx next build --debug-prerender
```

This turns off server minification and adds source maps, so the trace shows your own file and line. Never deploy a build made with this flag. You will read build output properly in [Building for Production](/courses/nextjs/building-for-production).

## A simple debugging routine

When something is wrong, walk through these questions in order:

1. **Server or client?** Is the broken code in a file with `'use client'`, or in a Server Component, Server Action, or `lib/` helper?
2. **Is there an error already?** Check the error overlay, the terminal and the browser console before adding anything.
3. **What are the values?** Add a `console.log` (or a breakpoint) just before the line that misbehaves.
4. **What did the network do?** In the Network tab, check the status code and response of the request that should have changed things.
5. **Is it cached?** With Cache Components, a "stale" value might simply be cached. Check whether a `'use cache'` function needs `updateTag` after a change (see [Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation)).

## Common mistakes

### Looking for server logs in the browser

You add `console.log` to a Server Component, open the browser console, and it is not there (or it only shows in development). Server code logs to the terminal where `npm run dev` or `npm start` runs. On a host like Vercel, look in the deployment's logs page.

### Forgetting the extra `--`

```bash
npm run dev --inspect
```

Without the `--`, npm keeps `--inspect` for itself and Next.js never sees it, so no `Debugger listening on` line appears. Use `npm run dev -- --inspect`.

### Expecting a client breakpoint to stop server code

A breakpoint set in the browser's Sources panel only stops code that runs in the browser. To stop a Server Component, Server Action or Route Handler, use `--inspect` with `chrome://inspect`, or the VS Code server-side configuration.

### Leaving `debugger` statements behind

A forgotten `debugger` pauses the page for anyone who has DevTools open. Search for `debugger` before you commit. ESLint's `no-debugger` rule can warn you about them.

## Quick recap

- A Next.js app is two programs: server code (terminal logs) and client code (browser console).
- Use browser DevTools and the `debugger` statement for Client Components, and React Developer Tools to inspect props and state.
- Start the dev server with `npm run dev -- --inspect` and open `chrome://inspect` to pause server code.
- A `.vscode/launch.json` file lets VS Code debug the server, the client, or both with F5.
- Read terminal errors top to bottom: what, how to fix, and where.
- Use `next build --debug-prerender` for clearer build stack traces, but never deploy that build.

<code id="code-content" class="language-json">
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev -- --inspect"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/next/dist/bin/next",
      "runtimeArgs": ["--inspect"],
      "skipFiles": ["&lt;node_internals&gt;/**"],
      "serverReadyAction": {
        "action": "debugWithEdge",
        "killOnServerStop": true,
        "pattern": "- Local:.+(https?://.+)",
        "uriFormat": "%s",
        "webRoot": "${workspaceFolder}"
      }
    }
  ]
}
</code></pre>
