---
publishDate: 2026-10-25T09:13
title: Sending JSON, Files and Redirects
slug: sending-json-files-and-redirects
metadescription: Learn to send JSON with res.json, serve and download files with res.sendFile and res.download, and redirect users safely with res.redirect in Express 5.
updateDate: 2026-10-25T09:13
author: ['bishal-biswas']
level: 1
tags: ['express', 'json', 'files', 'redirects']
course: expressjs
---

## What you will learn

- How `res.json()` turns JavaScript values into JSON, and its small surprises
- How to send a file from disk with `res.sendFile()`, using a safe absolute path
- How to trigger a file download with `res.download()` and `res.attachment()`
- How to send users to another page with `res.redirect()`, and which status code to use
- What changed for redirects and file sending in Express 5

## Sending JSON with `res.json()`

**JSON** (JavaScript Object Notation) is a text format for data. It looks almost exactly like a JavaScript object. It is the language most APIs speak, because every programming language can read it.

You met `res.json()` in the last lesson. Here it is in a small but realistic API:

```js
// app.js
import express from 'express';

const app = express();

const books = [
  { id: 1, title: 'Clean Code', inStock: true },
  { id: 2, title: 'Eloquent JavaScript', inStock: false },
];

app.get('/api/books', (req, res) => {
  res.json(books);
});

app.get('/api/books/:id', (req, res) => {
  const book = books.find((b) => b.id === Number(req.params.id));

  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }
  res.json(book);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

```bash
curl http://localhost:3000/api/books/1
# {"id":1,"title":"Clean Code","inStock":true}

curl http://localhost:3000/api/books/99
# {"error":"Book not found"}
```

> **Tip:** Even error responses should be JSON in an API. A frontend developer can then always call `response.json()` without worrying about what came back.

### What JSON can and cannot hold

`res.json()` uses `JSON.stringify()` under the hood. That means some JavaScript values change on the way out.

| JavaScript value | What the client receives |
| --- | --- |
| `{ a: 1 }`, `[1, 2]` | The same object or array |
| `'text'`, `42`, `true`, `null` | The same value |
| `new Date()` | An ISO string like `"2026-10-25T09:13:00.000Z"` |
| `{ a: undefined }` | `{}` (the key disappears) |
| A function | Removed |
| A `Map` or `Set` | `{}` (empty object) |

So if you store dates as `Date` objects, the client gets strings and must turn them back into dates. And if a field is `undefined`, it vanishes. Use `null` when you want "no value" to show up.

### Pretty-printed JSON while learning

By default, JSON comes out on one line to save bytes. While learning, you can ask Express to add spaces:

```js
app.set('json spaces', 2); // indent JSON with 2 spaces
```

`app.set()` changes an Express **setting**. You will meet more settings in [Environment Variables and Configuration](/courses/expressjs/environment-variables-and-config). Turn this one off in production, since the extra spaces make responses bigger.

### A consistent response shape

As your API grows, it helps to wrap data the same way every time. A common pattern is:

```js
app.get('/api/books', (req, res) => {
  res.json({
    data: books,
    count: books.length,
  });
});
```

The client can then always look in `data` for the result. You will design APIs properly in [Designing RESTful Routes](/courses/expressjs/designing-restful-routes).

## Sending a file with `res.sendFile()`

Sometimes the answer is a file: a PDF, an image or an HTML page. `res.sendFile(path)` reads the file from disk and streams it to the client. It sets the `Content-Type` from the file extension, so `.pdf` becomes `application/pdf` and `.png` becomes `image/png`.

There is one rule you must remember: **the path must be absolute**. An **absolute path** is a full path from the root of the drive, like `/home/me/app/files/menu.pdf` or `C:\app\files\menu.pdf`. A **relative path** like `files/menu.pdf` will throw an error.

Why? Because a relative path depends on the folder you started Node from. Run your app from a different folder and the file "moves". Absolute paths remove that guesswork.

### Building an absolute path

In ES modules, `import.meta.dirname` gives you the absolute path of the folder that contains the current file. Combine it with `path.join()`:

```text
my-app/
  app.js
  files/
    menu.pdf
    welcome.html
```

```js
// app.js
import express from 'express';
import path from 'node:path';

const app = express();

app.get('/menu', (req, res) => {
  const filePath = path.join(import.meta.dirname, 'files', 'menu.pdf');
  res.sendFile(filePath);
});

app.get('/welcome', (req, res) => {
  res.sendFile(path.join(import.meta.dirname, 'files', 'welcome.html'));
});
```

Open `http://localhost:3000/menu` in a browser and the PDF shows up right in the tab.

> **Note:** `import.meta.dirname` needs Node.js 20.11 or newer. On older versions use this instead:
> `const dirname = path.dirname(fileURLToPath(import.meta.url));` with `import { fileURLToPath } from 'node:url';`

### The `root` option: safer file paths

Often the file name comes from the URL, like `/docs/guide.pdf`. That is dangerous if you are careless. A visitor could ask for `../../.env` and try to read your secret files. This trick is called **path traversal**.

The `root` option protects you. You give a relative file name plus a root folder, and Express refuses any path that tries to climb out of that folder.

```js
// app.js
const docsFolder = path.join(import.meta.dirname, 'files', 'docs');

app.get('/docs/:name', (req, res) => {
  res.sendFile(req.params.name, { root: docsFolder });
});
```

| Request | Result |
| --- | --- |
| `/docs/guide.pdf` | Sends `files/docs/guide.pdf` |
| `/docs/missing.pdf` | `404 Not Found` |
| `/docs/..%2F..%2Fapp.js` | `403 Forbidden` (blocked) |

> **Warning:** Never build a file path by gluing user input onto a folder yourself, like `path.join(folder, req.params.name)`, and passing it without `root`. Always use the `root` option, or check the name against a list of allowed files.

### Handling errors from `sendFile`

If the file does not exist, Express passes the error on and the client gets a `404`. If you want to handle it yourself, give `sendFile` a callback. The callback runs when sending finishes or fails.

```js
app.get('/report', (req, res, next) => {
  const file = path.join(import.meta.dirname, 'files', 'report.pdf');

  res.sendFile(file, (err) => {
    if (err) {
      console.error('Could not send report:', err.message);
      next(err); // hand it to Express's error handling
    }
  });
});
```

`next` is the third argument a handler can receive. Calling `next(err)` hands the error to Express. You will learn about it in the middleware and error-handling lessons, starting with [How the Middleware Stack Works](/courses/expressjs/how-middleware-works).

> **Note:** Express 4 also had `res.sendfile()` with a lowercase "f". It was removed in Express 5. Use `res.sendFile()`.

## Downloading files with `res.download()`

`res.sendFile()` lets the browser **display** the file if it can. Sometimes you want the browser to **save** it instead, with a "Save as" dialog or straight into the Downloads folder.

That is controlled by a response header called `Content-Disposition`. `res.download()` sets it for you.

```js
app.get('/download/invoice', (req, res) => {
  const file = path.join(import.meta.dirname, 'files', 'invoice-2026-10.pdf');

  // second argument: the file name the user sees
  res.download(file, 'my-invoice.pdf');
});
```

The response includes this header:

```http
Content-Disposition: attachment; filename="my-invoice.pdf"
```

`res.download()` also accepts the same `root` option and an error callback, just like `sendFile`.

### Downloading data you create on the fly

What if the file does not exist on disk, because you build it in code? Use `res.attachment()` to set the header, then send the data.

```js
app.get('/export/books.csv', (req, res) => {
  const lines = ['id,title,inStock', ...books.map((b) => `${b.id},${b.title},${b.inStock}`)];

  res.attachment('books.csv'); // sets Content-Disposition and Content-Type
  res.send(lines.join('\n'));
});
```

```bash
curl -i http://localhost:3000/export/books.csv
```

```http
HTTP/1.1 200 OK
Content-Disposition: attachment; filename="books.csv"
Content-Type: text/csv; charset=utf-8

id,title,inStock
1,Clean Code,true
2,Eloquent JavaScript,false
```

| Method | Browser behaviour | File source |
| --- | --- | --- |
| `res.sendFile(path)` | Shows the file if it can (PDF, image, HTML) | Disk |
| `res.download(path, name)` | Saves the file | Disk |
| `res.attachment(name)` + `res.send(data)` | Saves the file | Data in memory |

> **Tip:** For very large files or data, sending everything at once uses a lot of memory. [Streaming Responses and Backpressure](/courses/expressjs/streaming-responses) shows how to send data piece by piece.

## Redirects with `res.redirect()`

A **redirect** tells the client: "What you want is somewhere else, go there." The server sends a special status code and a `Location` header with the new URL. The browser then automatically makes a second request to that URL.

```text
 Browser                                   Server
   |  GET /old-blog                          |
   |---------------------------------------->|
   |                                         |
   |  302 Found                              |
   |  Location: /blog                        |
   |<----------------------------------------|
   |                                         |
   |  GET /blog       (automatic)            |
   |---------------------------------------->|
   |                                         |
   |  200 OK  <html>...blog...</html>        |
   |<----------------------------------------|
```

The simplest redirect:

```js
app.get('/old-blog', (req, res) => {
  res.redirect('/blog');
});

app.get('/blog', (req, res) => {
  res.send('<h1>Blog</h1>');
});
```

By default, `res.redirect()` uses status `302 Found`, which means "temporarily somewhere else".

### Choosing the redirect status code

To use a different code, pass it **first**:

```js
app.get('/old-pricing', (req, res) => {
  res.redirect(301, '/pricing'); // moved permanently
});
```

> **Warning:** Express 4 also accepted `res.redirect('/pricing', 301)`, with the URL first. That order is gone in Express 5. The status code always comes first.

| Code | Name | Use it when |
| --- | --- | --- |
| `301` | Moved Permanently | A page moved forever. Browsers and search engines remember it. |
| `302` | Found | A temporary redirect. The default. |
| `303` | See Other | After a form `POST`, send the user to a page with `GET`. |
| `307` | Temporary Redirect | Like 302, but the browser must keep the same method and body. |
| `308` | Permanent Redirect | Like 301, but the browser must keep the same method and body. |

> **Common mistake:** Using `301` while testing. Browsers cache permanent redirects, sometimes for a long time. If you later change your mind, your own browser keeps following the old redirect. Use `302` until you are sure.

### The Post/Redirect/Get pattern

When a user submits an HTML form, you should redirect after saving. Otherwise, refreshing the page re-submits the form and creates duplicates. Redirecting with `303` after a `POST` is called the **Post/Redirect/Get** pattern.

```js
app.use(express.urlencoded()); // read HTML form data into req.body

app.post('/contact', (req, res) => {
  console.log('Message from', req.body.email);
  res.redirect(303, '/thanks');
});

app.get('/thanks', (req, res) => {
  res.send('<p>Thanks, we got your message.</p>');
});
```

Reading form data with `express.urlencoded()` is covered in [Built-in Body Parsers](/courses/expressjs/built-in-body-parsers).

### Redirecting "back"

Express 4 had a shortcut, `res.redirect('back')`, to send users to the page they came from. It was removed in Express 5. Read the `Referer` header yourself, with a safe fallback:

```js
app.post('/cart/add', (req, res) => {
  // ...add the item...
  res.redirect(req.get('Referrer') || '/');
});
```

`req.get('Referrer')` and `req.get('Referer')` both work. The header is famously misspelled in the HTTP standard, so Express accepts both spellings.

### Never redirect to an unchecked URL

A common login pattern is `/login?next=/dashboard`, which sends the user back after logging in. If you redirect to `req.query.next` without checking it, an attacker can send people a link like `/login?next=https://evil.example.com`. Your trusted site then forwards them to a fake one. This is called an **open redirect**.

```js
app.get('/after-login', (req, res) => {
  const next = req.query.next;

  // only allow paths on our own site, like "/dashboard"
  const isSafe =
    typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\');

  res.redirect(isSafe ? next : '/');
});
```

The extra checks matter because browsers treat `//evil.example.com` (and even `/\evil.example.com`) as a link to another site.

## Common mistakes

**Passing a relative path to `res.sendFile()`.** You get `TypeError: path must be absolute or specify root to res.sendFile`. Build the path with `path.join(import.meta.dirname, ...)` or use the `root` option.

**Responding after a redirect.** `res.redirect()` sends a complete response. Do not call `res.send()` after it. Use `return res.redirect(...)` inside `if` blocks.

**Getting the argument order wrong.** It is `res.redirect(301, url)`, not `res.redirect(url, 301)`.

**Sending huge JSON arrays.** Returning 100,000 records in one response is slow for everyone. You will learn to split results into pages in [Pagination, Filtering and Sorting](/courses/expressjs/pagination-filtering-sorting).

## Key takeaways

- `res.json()` sends JSON. Dates become strings, and `undefined` fields disappear.
- `res.sendFile()` needs an absolute path. Use `import.meta.dirname` with `path.join()`, or the `root` option for user-supplied file names.
- `res.download()` and `res.attachment()` make the browser save a file instead of showing it.
- `res.redirect(url)` sends a `302` by default. Put a custom status code first: `res.redirect(301, url)`.
- `res.redirect('back')` is gone in Express 5. Use `req.get('Referrer') || '/'`.
- Only redirect to URLs you have checked, to avoid open redirects.

## Practice

1. Add a `files/` folder with a small PDF or image. Create `GET /view` that shows it in the browser and `GET /save` that downloads it with a custom file name.
2. Create `GET /api/books.csv` that downloads the `books` array as a CSV file built in code.
3. Create `GET /docs/:name` with the `root` option. Try a normal file, a missing file and `..%2Fapp.js`, and note the status code for each with `curl -i`.
4. Make `/home` permanently redirect to `/`, and `/sale` temporarily redirect to `/products?tag=sale`. Check the `Location` header with `curl -i`.

## What's next

You have used several status codes and headers already. Next, get to know them properly in [Status Codes and Response Headers](/courses/expressjs/status-codes-and-headers).
