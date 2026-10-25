---
publishDate: 2026-10-25T13:39
title: Building APIs with Route Handlers
slug: route-handlers
metadescription: Build a JSON API for Book Nook with route.js Route Handlers. Use GET and POST, Request, Response and NextResponse, dynamic segments and Cache Components.
updateDate: 2026-10-25T13:39
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'api', 'route-handlers', 'http']
course: nextjs
---

## What you will build

Pages return HTML for people. Sometimes you need to return **data** for programs instead: a mobile app that lists your books, a partner shop, a webhook from a payment service, or a small script of your own.

In this lesson you will give Book Nook a small JSON API:

| Request | What it does |
| --- | --- |
| `GET /api/books` | Returns all books as JSON |
| `GET /api/books?q=dune` | Returns books that match a search |
| `GET /api/books/dune` | Returns one book, or a 404 |
| `POST /api/books` | Adds a new book from a JSON body |

You build it with **Route Handlers**: files called `route.js` that answer HTTP requests with code you write.

```text
book-nook/
└── app/
    └── api/
        └── books/
            ├── route.js          GET and POST /api/books
            └── [id]/
                └── route.js      GET /api/books/:id
```

## Pages, Server Actions and Route Handlers

You now have three ways to run code on the server. Here is when to pick each one:

- **A page** (`page.js`) when a person should see HTML.
- **A Server Action** when your own forms and buttons change data. You do not have to invent URLs, and React handles pending states. See [Server Functions and Server Actions](/courses/nextjs/server-actions).
- **A Route Handler** when something **outside** your React UI needs a URL: other apps, webhooks, files like RSS feeds, or `fetch` calls from a Client Component.

Do not build a Route Handler just so your own Server Components can `fetch` it. A Server Component can call `getBooks()` directly. Going through your own API adds an extra HTTP trip for nothing.

## Step 1: your first Route Handler

Create `app/api/books/route.js`:

```javascript
// app/api/books/route.js
import { getBooks } from '@/lib/books';

export async function GET() {
  const books = await getBooks();
  return Response.json(books);
}
```

That is the whole API. The rules:

- The file must be called `route.js` and live inside `app/`. Its folder path is its URL, just like pages: `app/api/books/route.js` answers at `/api/books`.
- You export a function named after an **HTTP method**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS`.
- The function returns a standard web **`Response`**. `Response.json(data)` turns `data` into JSON and sets the `Content-Type: application/json` header for you.

The `api/` folder is only a habit, not a rule. It keeps your data URLs separate from your page URLs. One rule is strict, though: a folder cannot have both a `page.js` and a `route.js`, because both would want to answer the same URL.

Start the dev server and open `http://localhost:3000/api/books` in the browser. You will see the raw JSON:

```json
[
  {
    "id": "the-hobbit",
    "title": "The Hobbit",
    "author": "J.R.R. Tolkien",
    "price": 12.99,
    "genre": "fantasy",
    "cover": "/covers/the-hobbit.jpg",
    "description": "Bilbo Baggins leaves his cosy home for an adventure with dwarves and a dragon."
  }
]
```

(The real answer has all four books.)

You can also use **curl**, a command-line tool for HTTP requests. It comes with macOS, Linux and Windows 10 and newer. In Windows PowerShell, type `curl.exe` instead of `curl`, because there `curl` is a nickname for a different command.

```bash
curl http://localhost:3000/api/books
```

## Step 2: read the request (search params)

Every handler receives the incoming **request** as its first argument. In Next.js it is a `NextRequest`, which is a normal web `Request` with a few extras. The handiest extra is `request.nextUrl`, a parsed URL with easy access to search params:

```javascript
// app/api/books/route.js
import { getBooks, searchBooks } from '@/lib/books';

export async function GET(request) {
  const q = request.nextUrl.searchParams.get('q');
  const books = q ? await searchBooks(q) : await getBooks();
  return Response.json(books);
}
```

```bash
curl "http://localhost:3000/api/books?q=dune"
```

```text
[{"id":"dune","title":"Dune","author":"Frank Herbert","price":14.5,...}]
```

The quotes around the URL stop your terminal from treating `?` and `&` as special characters.

## Step 3: one book with a dynamic segment

Dynamic folders work the same as for pages ([Dynamic Routes and params](/courses/nextjs/dynamic-routes)). The handler gets a second argument, the **context**, with a `params` Promise:

```javascript
// app/api/books/[id]/route.js
import { NextResponse } from 'next/server';
import { getBook } from '@/lib/books';

export async function GET(request, { params }) {
  const { id } = await params;
  const book = await getBook(id);

  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  return NextResponse.json(book);
}
```

- `await params` gives `{ id: 'dune' }` for `/api/books/dune`. Like on pages, `params` is a Promise in Next.js 16.
- The second argument to `json()` sets the **status code**. `404` means "not found", and programs reading your API rely on it more than on the message.
- This time we used `NextResponse` from `next/server`. It is the web `Response` with extras, like helpers for cookies, `redirect()` and `rewrite()`. For plain JSON, `Response.json` and `NextResponse.json` do the same job; use whichever you like, but be consistent.

```bash
curl -i http://localhost:3000/api/books/not-a-book
```

```text
HTTP/1.1 404 Not Found
content-type: application/json
...
{"error":"Book not found"}
```

`-i` tells curl to print the status line and headers too.

## Step 4: accept data with POST

A `POST` request carries data in its **body**. Read it with the standard `request.json()` (or `request.formData()` or `request.text()`), then validate it. You already wrote a Zod schema for books in [Validating Forms and Showing Errors](/courses/nextjs/form-validation), so reuse it:

```javascript
// app/api/books/route.js
import * as z from 'zod';
import { revalidateTag } from 'next/cache';
import { getBooks, searchBooks, addBook } from '@/lib/books';
import { bookSchema } from '@/lib/book-schema';

export async function GET(request) {
  const q = request.nextUrl.searchParams.get('q');
  const books = q ? await searchBooks(q) : await getBooks();
  return Response.json(books);
}

export async function POST(request) {
  // 1. Read the JSON body (it may not be JSON at all)
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'The body must be JSON.' }, { status: 400 });
  }

  // 2. Validate it with the same schema as the form
  const result = bookSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { errors: z.flattenError(result.error).fieldErrors },
      { status: 400 }
    );
  }

  // 3. Save it and answer "201 Created"
  const book = await addBook(result.data);
  if (!book) {
    return Response.json({ error: 'That book already exists.' }, { status: 409 });
  }
  revalidateTag('books', 'max'); // cached book lists refresh on their next visit
  return Response.json(book, { status: 201 });
}
```

`updateTag`, which you used in Server Actions, only works inside Server Actions. In a Route Handler you use `revalidateTag(tag, profile)` instead. With the recommended `'max'` profile, the next visitor to `/books` may still get the old list once while a fresh one is built in the background ([Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation)). If the change must show up immediately, pass `{ expire: 0 }` as the second argument.

The status codes tell the caller what happened without reading the message:

| Code | Meaning | Used when |
| --- | --- | --- |
| `200` | OK | The default |
| `201` | Created | A new book was saved |
| `400` | Bad Request | The body is not JSON or fails validation |
| `404` | Not Found | No book with that id |
| `409` | Conflict | The book already exists |

Send a book with curl (on Windows, `curl.exe` in PowerShell, or use Git Bash):

```bash
curl -i -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Matilda","author":"Roald Dahl","price":7.99,"genre":"classic","description":"A girl who loves books."}'
```

```text
HTTP/1.1 201 Created
content-type: application/json
...
{"id":"matilda","title":"Matilda","author":"Roald Dahl","price":7.99,"genre":"classic",...}
```

Send a bad one, and you get the Zod errors back:

```bash
curl -X POST http://localhost:3000/api/books -H "Content-Type: application/json" -d '{"title":""}'
```

```text
{"errors":{"title":["Please enter a title."],"author":["Invalid input: expected string, received undefined"],...}}
```

> **Warning:** right now **anyone** can add books with this POST. A Route Handler is a public door on the internet, exactly like a Server Action. You will lock it in [Protecting Pages, Actions and APIs](/courses/nextjs/authorization), so it answers `401` or `403` to strangers.

## Methods you did not write

Next.js answers some requests for you:

- A method you did not export, like `DELETE`, gets `405 Method Not Allowed`.
- `OPTIONS` is answered automatically with an `Allow` header listing your methods. Browsers use `OPTIONS` before some cross-site requests.

```bash
curl -i -X OPTIONS http://localhost:3000/api/books
```

```text
HTTP/1.1 204 No Content
allow: GET, HEAD, OPTIONS, POST
```

## Headers, status and other formats

`Response` and `NextResponse` take a second argument with `status` and `headers`. You can return any format, not only JSON:

```javascript
// app/api/books/export/route.js
import { getBooks } from '@/lib/books';

export async function GET() {
  const books = await getBooks();
  const lines = ['id,title,price', ...books.map((b) => `${b.id},"${b.title}",${b.price}`)];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="books.csv"',
    },
  });
}
```

Opening `/api/books/export` downloads a spreadsheet file. For reading request headers and cookies, see the next lesson, [Reading Cookies and Headers](/courses/nextjs/cookies-and-headers).

## Caching: do GET handlers run on every request?

Your project has **Cache Components** turned on. With it, a `GET` Route Handler follows the same rules as a page ([Caching with Cache Components and use cache](/courses/nextjs/use-cache)):

- If the handler only does **predictable** work, Next.js runs it once at build time and saves the answer. It is **prerendered**, a static file.
- If it reads the **request** (`request.url`, `request.nextUrl`, headers, cookies, the body), or calls something unpredictable like `Math.random()`, or does uncached network or database work, it runs at **request time**, every time.
- To prerender data from a slow source, put the slow part in a helper function marked `'use cache'`. You cannot put `'use cache'` directly inside the handler body.
- `POST`, `PUT`, `PATCH` and `DELETE` are never cached.

Run `npm run build` and look at the route list. With the first version of `GET` (no `request`), in its own file, you would see:

```text
├ ○ /api/books
```

`○` means static. With the search version that reads `request.nextUrl`, it becomes:

```text
├ ƒ /api/books
```

`ƒ` means it runs on every request. In our tests with Next.js 16.4, adding a `POST` export to the same file also turned the whole file into `ƒ`, so the `GET` ran on every request too. That is fine for Book Nook. If you want a `GET` to be prerendered, keep it simple, keep it in a file without other methods, or cache its data:

```javascript
// app/api/bestsellers/route.js
import { cacheLife } from 'next/cache';
import { getBooks } from '@/lib/books';

async function getBestsellers() {
  'use cache';
  cacheLife('hours');
  const books = await getBooks();
  return books.slice(0, 3);
}

export async function GET() {
  return Response.json(await getBestsellers());
}
```

The build lists it as static, with its cache times:

```text
├ ○ /api/bestsellers           1h      1d
```

If you come from older Next.js tutorials, you may know `export const dynamic = 'force-static'`. With Cache Components that option is gone, and the build stops with:

```text
Error: Route segment config "dynamic" is not compatible with `nextConfig.cacheComponents`. Please remove it.
```

Use `'use cache'` instead, as above. Projects without Cache Components still use the old options; see [Caching in Projects Without Cache Components](/courses/nextjs/caching-without-cache-components).

## Calling your API from a Client Component

A Client Component can call the API with `fetch`, using a path that starts with `/`:

```jsx
// components/BookCount.js
'use client';

import { useEffect, useState } from 'react';

export default function BookCount() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    fetch('/api/books')
      .then((res) => res.json())
      .then((books) => setCount(books.length));
  }, []);

  return <p>{count === null ? 'Counting books...' : `${count} books in the shop`}</p>;
}
```

For real apps, a library like SWR makes this nicer. [Fetching Data on the Client](/courses/nextjs/client-side-data-fetching) covers it.

## Common mistakes

### A page and a route in the same folder

```text
Error: An issue occurred while preparing your Next.js app
Conflicting route and page at /books: route at /books/route and page at /books/page
```

`app/books/page.js` and `app/books/route.js` both want `/books`. Move the API under `app/api/`.

### Forgetting to return a Response

If your handler does not return anything, the request fails with an error like:

```text
No response is returned from route handler '.../app/api/books/route.js'. Expected a Response object but received 'undefined' (method: GET, url: /api/books). Ensure you return a `Response` or a `NextResponse` in all branches of your handler.
```

Every code path, including errors, must `return` a `Response`.

### Using a default export

`export default function handler()` (the old Pages Router style) does nothing in `app/`. Export named functions: `export async function GET()`.

### Trusting the body

`await request.json()` gives you whatever the caller sent, and it throws if the body is not JSON. Wrap it in `try`/`catch` and validate the result with your schema before you save anything.

## Quick recap

- A `route.js` file inside `app/` answers HTTP requests at its folder's URL. It cannot share a folder with `page.js`.
- Export one async function per method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.
- Return a web `Response`; `Response.json(data, { status })` is the quickest way. `NextResponse` adds extras.
- Read search params with `request.nextUrl.searchParams` and the body with `await request.json()`.
- Dynamic folders give you `params` as a Promise in the second argument.
- Use clear status codes (`201`, `400`, `404`, `409`) and validate every body.
- With Cache Components, a `GET` that reads nothing request-specific can be prerendered; otherwise it runs per request. Use a `'use cache'` helper to cache data, not `export const dynamic`.
- Route Handlers are public. Protect them like Server Actions.

<code id="code-content" class="language-javascript">
// app/api/books/route.js: GET (list or search) and POST (add) for Book Nook
import * as z from 'zod';
import { revalidateTag } from 'next/cache';
import { getBooks, searchBooks, addBook } from '@/lib/books';
import { bookSchema } from '@/lib/book-schema'; // the same schema the form uses
// GET /api/books or /api/books?q=dune
export async function GET(request) {
  // Reading the request makes this handler run on every request
  const q = request.nextUrl.searchParams.get('q');
  const books = q ? await searchBooks(q) : await getBooks();
  return Response.json(books);
}
// POST /api/books with a JSON body
export async function POST(request) {
  let body;
  try {
    body = await request.json(); // throws if the body is not valid JSON
  } catch {
    return Response.json({ error: 'The body must be JSON.' }, { status: 400 });
  }
  const result = bookSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ errors: z.flattenError(result.error).fieldErrors }, { status: 400 });
  }
  const book = await addBook(result.data);
  if (!book) {
    return Response.json({ error: 'That book already exists.' }, { status: 409 });
  }
  revalidateTag('books', 'max'); // updateTag only works in Server Actions
  return Response.json(book, { status: 201 }); // 201 = Created
}
// --- next file: app/api/books/[id]/route.js
// import { NextResponse } from 'next/server';
// import { getBook } from '@/lib/books';
// export async function GET(request, { params }) {
//   const { id } = await params; // params is a Promise
//   const book = await getBook(id);
//   if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });
//   return NextResponse.json(book);
// }
</code></pre>
