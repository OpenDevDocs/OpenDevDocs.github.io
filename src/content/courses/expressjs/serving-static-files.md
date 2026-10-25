---
publishDate: 2026-10-25T09:15
title: Serving Static Files with express.static
slug: serving-static-files
metadescription: Learn how express.static serves HTML, CSS, images and JavaScript from a folder, how URLs map to files, and how to set caching and safety options in Express 5.
updateDate: 2026-10-25T09:15
author: ['bishal-biswas']
level: 1
tags: ['express', 'static-files', 'frontend', 'caching']
course: expressjs
---

## What you will learn

- What **static files** are and why you should not write a route for each one
- How to serve a whole folder with `express.static()` in one line
- How request URLs map to files on disk, and how to add a URL prefix
- Useful options: caching, file extensions, index pages and dotfiles
- Where to place `express.static()` relative to your routes

## What are static files?

A **static file** is a file you send to the browser exactly as it is on disk, with no changes. Your CSS stylesheet, a logo image, a favicon, browser JavaScript, fonts and plain HTML pages are all static files.

The opposite is **dynamic** content, which your code builds for each request, like a JSON list of the current user's orders.

In the last lessons you used `res.sendFile()` to send one file from a route. That works for one or two files. But a website might have hundreds of images and scripts. Writing a route for each one would be silly.

**Think of a library's open shelf.** You do not ask the librarian for every book. You walk to the shelf and take what you need. `express.static()` turns a folder into an open shelf: any file inside it can be fetched by its name.

## Your first static folder

Create this project structure:

```text
my-site/
  app.js
  package.json
  public/
    index.html
    about.html
    css/
      style.css
    images/
      logo.png
```

```html
<!-- public/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>My Site</title>
    <link rel="stylesheet" href="/css/style.css" />
  </head>
  <body>
    <img src="/images/logo.png" alt="Logo" width="80" />
    <h1>Welcome</h1>
    <a href="/about.html">About us</a>
  </body>
</html>
```

Now the server. One line does all the work:

```js
// app.js
import express from 'express';
import path from 'node:path';

const app = express();

// Serve every file inside the "public" folder
app.use(express.static(path.join(import.meta.dirname, 'public')));

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

Open `http://localhost:3000` in your browser. You see the page, styled, with the logo. The browser made four requests (the page, the CSS, the image, and probably a favicon), and `express.static()` answered all of them.

> **Note:** `import.meta.dirname` (Node.js 20.11+) is the folder of the current file. Using it makes the path absolute, so the app works no matter which folder you start it from. `express.static('public')` also works, but only when you run `node` from inside `my-site/`.

## How URLs map to files

`express.static()` takes the URL path and looks for a file with the same path inside your folder. The folder name itself is **not** part of the URL.

| Request URL | File on disk |
| --- | --- |
| `/` | `public/index.html` |
| `/about.html` | `public/about.html` |
| `/css/style.css` | `public/css/style.css` |
| `/images/logo.png` | `public/images/logo.png` |
| `/public/about.html` | Not found. `public` is not in the URL. |
| `/contact.html` | Not found (no such file). Moves on to your routes. |

Two things happen automatically:

1. **Index files.** When the URL points to a folder, Express looks for `index.html` inside it. That is why `/` shows `public/index.html`.
2. **Content types.** Express sets `Content-Type` from the file extension: `.css` becomes `text/css`, `.png` becomes `image/png`, and so on.

> **Common mistake:** Writing `<link href="/public/css/style.css">` in your HTML. The folder name is not part of the URL. Use `/css/style.css`.

## What happens when no file matches

If there is no matching file, `express.static()` does not send a 404 itself. It simply calls `next()`, which means "not mine, pass it on". The request continues to the next handler in your app.

```text
 GET /api/products
      |
      v
 +----------------------+
 | express.static()     |  Is there public/api/products? No -> pass it on
 +----------------------+
      |
      v
 +----------------------+
 | app.get('/api/...')  |  Yes, I handle this -> sends JSON
 +----------------------+
```

That is why static files and API routes live happily in the same app:

```js
// app.js
app.use(express.static(path.join(import.meta.dirname, 'public')));

app.get('/api/products', (req, res) => {
  res.json([{ id: 1, name: 'Lamp' }]);
});
```

`app.use()` registers **middleware**, a function that runs for many requests before your routes. You will learn exactly how this "pass it on" chain works in [How the Middleware Stack Works](/courses/expressjs/how-middleware-works).

## Adding a URL prefix

Sometimes you want static files under their own URL, such as `/static/...` or `/assets/...`. Pass a **mount path** as the first argument to `app.use()`:

```js
app.use('/static', express.static(path.join(import.meta.dirname, 'public')));
```

Now the URL needs the prefix:

| Request URL | File on disk |
| --- | --- |
| `/static/css/style.css` | `public/css/style.css` |
| `/static/images/logo.png` | `public/images/logo.png` |
| `/css/style.css` | Not found |

A prefix makes it obvious which URLs are files and which are routes. It also means `express.static()` only checks the disk for `/static/...` requests, not for every API call.

## Serving more than one folder

You can call `express.static()` several times. Express checks the folders **in the order you add them**, and the first match wins.

```js
app.use(express.static(path.join(import.meta.dirname, 'public')));
app.use(express.static(path.join(import.meta.dirname, 'uploads')));
```

```text
 GET /photo.jpg
   1. public/photo.jpg   ? not found, try next
   2. uploads/photo.jpg  ? found -> send it
```

A common real-world setup puts third-party files under their own prefix:

```js
// serve files from an npm package, e.g. a CSS library, under /vendor
app.use('/vendor', express.static(path.join(import.meta.dirname, 'node_modules', 'some-css-lib', 'dist')));
```

## Useful options

`express.static()` takes a second argument with options. Here are the ones you will reach for most.

| Option | Default | What it does |
| --- | --- | --- |
| `maxAge` | `0` | How long browsers may cache files. Number in ms, or a string like `'1d'`. |
| `immutable` | `false` | Tells browsers the file will never change while cached. Use with `maxAge`. |
| `index` | `'index.html'` | The file to send for a folder URL. `false` turns it off. |
| `extensions` | `false` | Extensions to try when a URL has none, e.g. `['html']`. |
| `dotfiles` | `'ignore'` | What to do with files whose names start with a dot. |
| `etag` | `true` | Send an `ETag` header for caching. |
| `fallthrough` | `true` | On "not found", call `next()` instead of sending an error. |
| `setHeaders` | none | A function to add your own headers to each file. |

### Clean URLs with `extensions`

Want `/about` to work instead of `/about.html`? Tell Express which extensions to try:

```js
app.use(express.static(path.join(import.meta.dirname, 'public'), {
  extensions: ['html'], // /about -> public/about.html
}));
```

### Caching with `maxAge`

Every time a visitor loads a page, their browser may ask for the CSS and images again. **Caching** means the browser keeps a copy and reuses it, which makes your site faster and your server less busy.

`maxAge` sets the `Cache-Control` header for you:

```js
app.use('/static', express.static(path.join(import.meta.dirname, 'public'), {
  maxAge: '7d', // browsers may reuse files for 7 days without asking
}));
```

```bash
curl -I http://localhost:3000/static/css/style.css
```

```http
HTTP/1.1 200 OK
Cache-Control: public, max-age=604800
Content-Type: text/css; charset=UTF-8
ETag: W/"5a-..."
Last-Modified: Sun, 25 Oct 2026 08:00:00 GMT
```

`curl -I` sends a `HEAD` request: it asks for headers only, not the body.

> **Warning:** A long `maxAge` means users may keep an old `style.css` for days after you change it. Build tools solve this by adding a fingerprint to file names, like `style.3f9a1c.css`. A new version gets a new name, so it is never stale. Only use long cache times for fingerprinted files, or keep `maxAge` short.

Even with `maxAge: 0`, the `ETag` and `Last-Modified` headers let browsers ask "has this changed?" and get a quick `304 Not Modified` if not.

### Dotfiles are hidden by default

A **dotfile** is a file or folder whose name starts with a dot, like `.env` or `.git`. They often hold secrets or settings.

In Express 5, the `dotfiles` option defaults to `'ignore'`. Express acts as if these files do not exist, so a request for `/.env` gets a `404`. This applies to any part of the path that starts with a dot, including folders.

| Value | Behaviour |
| --- | --- |
| `'ignore'` | Pretend the file does not exist (404). The Express 5 default. |
| `'deny'` | Answer `403 Forbidden`. |
| `'allow'` | Serve it like any other file. |

If you need to serve one special dot-folder, such as `/.well-known/` for domain verification, mount just that folder on its own with `'allow'`. Do not switch the whole `public/` folder to `'allow'`.

```js
// public/.well-known/security.txt -> /.well-known/security.txt
app.use('/.well-known', express.static(path.join(import.meta.dirname, 'public', '.well-known'), {
  dotfiles: 'allow',
}));
```

### Adding custom headers with `setHeaders`

```js
app.use(express.static(path.join(import.meta.dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Disposition', 'attachment'); // download PDFs instead of showing them
    }
  },
}));
```

## Where to put `express.static()`

Order matters in Express. Things registered first get the first chance to answer.

| Place it... | Effect |
| --- | --- |
| **Before** your routes | Files win. If `public/api/users` existed, it would hide your `/api/users` route. Every request checks the disk first. |
| **After** your routes | Routes win. Only requests no route answered reach the disk. |
| **Under a prefix** like `/static` | No overlap at all. Only `/static/...` requests touch the disk. |

For most beginner projects, placing it first with no prefix is fine and easy. As your app grows, a prefix is the cleanest choice.

## Single-page apps: a fallback to `index.html`

If you build your frontend with React, Vue or similar, the browser handles URLs like `/dashboard/settings` itself. But if the user refreshes on that URL, the request hits your server, and there is no `dashboard/settings` file. You need to send `index.html` for those URLs and let the frontend take over.

```js
// app.js
const publicDir = path.join(import.meta.dirname, 'public');

app.use(express.static(publicDir));

app.get('/api/products', (req, res) => {
  res.json([{ id: 1, name: 'Lamp' }]);
});

// Any other GET request: send the app shell
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
```

`'/*splat'` is the Express 5 named wildcard you learned in [Route Parameters and path-to-regexp v8 Syntax](/courses/expressjs/route-parameters-and-path-to-regexp). It must come **after** your API routes, or it would swallow them. The root `/` is already handled by `express.static()` serving `index.html`.

> **Tip:** With this fallback, a wrong API URL like `/api/prodcts` would get HTML instead of a JSON 404. You will learn to give API routes their own "not found" handler in [Not Found and Fallback Handling](/courses/expressjs/not-found-handling).

## Common mistakes

**Serving your project root.** `express.static(import.meta.dirname)` would expose `app.js`, `package.json` and everything else. Always serve a dedicated folder like `public/`.

**Including the folder name in URLs.** The URL is `/css/style.css`, not `/public/css/style.css`.

**Using a relative folder path.** `express.static('public')` breaks when you start Node from another folder. Use `path.join(import.meta.dirname, 'public')`.

**Putting secrets in `public/`.** Anything in that folder is downloadable by anyone. Keep `.env` files and config outside it.

**Long cache times on files that change.** Visitors keep seeing the old version. Use short `maxAge` values unless file names include a fingerprint.

## Key takeaways

- `express.static(folder)` serves every file in a folder with one line of code.
- The folder name is not part of the URL. Add a prefix with `app.use('/static', express.static(...))`.
- When no file matches, it calls `next()` and your routes get a turn.
- `maxAge`, `extensions` and `setHeaders` control caching, clean URLs and extra headers.
- In Express 5, `dotfiles` defaults to `'ignore'`, so `.env`-style files return 404.
- Use an absolute path, and never serve your whole project folder.

## Practice

1. Build the `my-site` example with an `index.html`, a CSS file and an image. Check the Network tab in your browser to see each file load.
2. Move the static folder under `/assets`. Update your HTML links so the page still works.
3. Add `extensions: ['html']` and confirm that `/about` shows `about.html`.
4. Create a file `public/.secret.txt` and request it. What status code do you get? Change `dotfiles` to `'deny'` and try again.

## What's next

Your app is growing, and soon it will need settings like port numbers and secret keys. Learn to manage them in [Environment Variables and Configuration](/courses/expressjs/environment-variables-and-config).
