---
publishDate: 2026-10-25T10:40
title: URL, Query Strings and URLSearchParams
slug: url-and-query-strings
metadescription: Parse, build and validate URLs in Node with the built-in URL and URLSearchParams classes, and read query strings safely in your servers.
updateDate: 2026-10-25T10:40
author: ['bishal-biswas']
level: 2
tags: ['url', 'query-string', 'http']
course: nodejs
---

## What is a URL, really?

A URL is a postal address for something on the web. Like a postal address, it has parts: country, city, street, house number. You *could* cut it up yourself with `split('/')` and `indexOf('?')`, but that breaks on the first odd address.

Node gives you the `URL` class, the same one browsers have. It understands every part of an address, handles the strange cases and does the encoding for you. It is a global, so you do not even need an import.

## The parts of a URL

```javascript
const url = new URL('https://asha:secret@shop.example.com:8080/books/search?q=node&page=2#results');

console.log(url.protocol); // 'https:'
console.log(url.username); // 'asha'
console.log(url.password); // 'secret'
console.log(url.hostname); // 'shop.example.com'
console.log(url.port);     // '8080'
console.log(url.host);     // 'shop.example.com:8080'
console.log(url.origin);   // 'https://shop.example.com:8080'
console.log(url.pathname); // '/books/search'
console.log(url.search);   // '?q=node&page=2'
console.log(url.hash);     // '#results'
```

The ones you will use most:

- **hostname**: the server's name. **host** is the hostname plus the port.
- **pathname**: which page or resource, like `/books/search`.
- **search**: the **query string**, the part after `?`. It carries extra options as `key=value` pairs joined with `&`.
- **hash**: the part after `#`. Browsers never send it to the server, so your Node server will never see it.
- **origin**: protocol, host and port together. Browsers use it for security rules such as CORS.

> **Note:** `url.port` is an empty string when the URL uses the default port, so `new URL('https://example.com:443/').port` is `''`.

`URL` also tidies the address for you. It lowercases the protocol and hostname, and encodes spaces and accented letters in the path:

```javascript
console.log(new URL('HTTPS://Example.COM/Books').href);
// prints: https://example.com/Books

console.log(new URL('https://example.com/my books/café').pathname);
// prints: /my%20books/caf%C3%A9
```

## Relative URLs and a base

Give `URL` a second argument, the **base**, and it resolves relative links exactly like a browser does for links on a page:

```javascript
console.log(new URL('/about', 'https://example.com/blog/post').href);
// https://example.com/about

console.log(new URL('next', 'https://example.com/blog/post').href);
// https://example.com/blog/next

console.log(new URL('../img/logo.png', 'https://example.com/blog/2026/post').href);
// https://example.com/blog/img/logo.png
```

A leading `/` starts from the root. No slash means "next to the current page".

This is why servers write `new URL(req.url, 'http://localhost')`. In Node's http server `req.url` is only the path, like `/books?page=2`, so you supply any base to get a full, parseable URL.

## Invalid URLs throw

```javascript
try {
  new URL('not a url');
} catch (err) {
  console.log(err.name, err.code, err.message);
}
```

```text
TypeError ERR_INVALID_URL Invalid URL
```

When you are checking user input, two static helpers save you the `try`/`catch`:

```javascript
console.log(URL.canParse('https://example.com')); // true
console.log(URL.canParse('example.com'));         // false, no protocol
console.log(URL.parse('nope'));                   // null
console.log(URL.parse('https://example.com/a').pathname); // '/a'
```

`URL.canParse()` answers yes or no. `URL.parse()` returns a `URL` object, or `null` when the input is not a valid URL.

## Reading query strings with `searchParams`

Every `URL` has a `searchParams` property, a `URLSearchParams` object for the query string:

```javascript
const url = new URL('https://shop.example.com/search?q=node+js&tag=books&tag=new&page=2');
const params = url.searchParams;

console.log(params.get('q'));      // 'node js'
console.log(params.get('page'));   // '2' (a string!)
console.log(params.get('sort'));   // null
console.log(params.getAll('tag')); // [ 'books', 'new' ]
console.log(params.has('tag'));    // true
console.log(params.size);          // 4
```

Things to notice:

- `get()` returns a **string**, or `null` if the key is missing. Never a number.
- A `+` in a query string means a space, so `node+js` becomes `node js`.
- A key can appear more than once. `get()` returns the first value; `getAll()` returns all of them.

You can loop over the pairs, or turn them into a plain object:

```javascript
for (const [key, value] of params) {
  console.log(key, '=', value);
}

console.log(Object.fromEntries(params));
```

```text
q = node js
tag = books
tag = new
page = 2
{ q: 'node js', tag: 'new', page: '2' }
```

Careful: `Object.fromEntries()` keeps only the *last* value of a repeated key, so `tag` lost `'books'`.

## Changing and building query strings

`searchParams` is live. Change it and the URL updates:

```javascript
params.set('page', '3');    // replace (or add) a value
params.append('tag', 'sale'); // add another value, keep the old ones
params.delete('q');         // remove a key
params.sort();              // order keys alphabetically

console.log(url.href);
// https://shop.example.com/search?page=3&tag=books&tag=new&tag=sale
```

This is the safe way to build URLs for API calls, because it **encodes** special characters for you:

```javascript
const api = new URL('https://api.example.com/books');
api.searchParams.set('author', 'Jane Austen');
api.searchParams.set('q', 'pride & prejudice');

console.log(api.href);
// https://api.example.com/books?author=Jane+Austen&q=pride+%26+prejudice
```

You can also create a `URLSearchParams` on its own, for example to send a form body:

```javascript
const form = new URLSearchParams({ q: 'fish & chips', city: 'São Paulo', page: 1 });
console.log(form.toString());
// q=fish+%26+chips&city=S%C3%A3o+Paulo&page=1
```

## Using query strings in a server

Here is a search endpoint with paging. It reads `q`, `page` and `limit`, applies defaults and rejects nonsense:

```javascript
// search.js
import http from 'node:http';

const books = ['Dune', 'Emma', 'Beloved', 'Dracula', 'Persuasion', 'Middlemarch'];

// Turn a query value into a whole number within limits, or use a default
function toInt(value, { fallback, min, max }) {
  if (value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return null; // invalid
  return n;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname !== '/books') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  const q = (url.searchParams.get('q') ?? '').toLowerCase();
  const page = toInt(url.searchParams.get('page'), { fallback: 1, min: 1, max: 1000 });
  const limit = toInt(url.searchParams.get('limit'), { fallback: 2, min: 1, max: 50 });

  if (page === null || limit === null) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'page and limit must be positive whole numbers' }));
  }

  const found = books.filter((title) => title.toLowerCase().includes(q));
  const start = (page - 1) * limit;
  const results = found.slice(start, start + limit);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ q, page, limit, total: found.length, results }));
});

server.listen(3000);
```

```bash
curl "http://localhost:3000/books?q=e&page=2&limit=3"
curl "http://localhost:3000/books?page=abc"
```

```text
{"q":"e","page":2,"limit":3,"total":5,"results":["Persuasion","Middlemarch"]}
{"error":"page and limit must be positive whole numbers"}
```

> **Tip:** Put quotes around URLs with `&` in your terminal. Without them the shell treats `&` as "run in the background" and cuts your URL short.

## File URLs and `import.meta`

ES modules describe their own location as a `file:` URL, available as `import.meta.url`. The `node:url` module converts between file URLs and normal paths:

```javascript
import { fileURLToPath, pathToFileURL } from 'node:url';

console.log(import.meta.url);                 // file:///home/asha/app/index.js
console.log(fileURLToPath(import.meta.url));  // /home/asha/app/index.js
console.log(pathToFileURL('/home/asha/my notes.txt').href);
// file:///home/asha/my%20notes.txt (on Linux or macOS)

// Find a file next to this module
const dataUrl = new URL('./data.json', import.meta.url);
```

Since Node 20.11 you can also read `import.meta.filename` and `import.meta.dirname` directly, which you met in [the path module lesson](/courses/nodejs/the-path-module).

## Common mistakes

### Building URLs by gluing strings

```javascript
const q = 'pride & prejudice';
const url = new URL(`https://api.example.com/books?q=${q}`);
console.log(Object.fromEntries(url.searchParams));
// { q: 'pride ', ' prejudice': '' }
```

The `&` inside the value split it into two keys. Use `url.searchParams.set('q', q)`, or at least `encodeURIComponent(q)`.

### Treating query values as numbers

```javascript
const page = url.searchParams.get('page'); // '2'
page + 1; // '21', not 3
```

Convert with `Number()` and check the result. Remember `Number('')` and `Number(null)` are both `0`, and `Number('abc')` is `NaN`. A helper like `toInt` above handles all of these.

### Using the old `url.parse()`

```javascript
import url from 'node:url';
url.parse('http://x.com/a?b=1'); // prints a DeprecationWarning (DEP0169)
```

`url.parse()` and the `node:querystring` module are the legacy APIs from before `URL` existed. You will still see them in old code, but new code should use `URL` and `URLSearchParams`.

## Quick recap

- `new URL(text, base?)` parses a URL into parts like `hostname`, `pathname`, `search` and `hash`.
- In servers, use `new URL(req.url, 'http://localhost')` because `req.url` is only a path.
- Invalid URLs throw `ERR_INVALID_URL`; `URL.canParse()` and `URL.parse()` check without throwing.
- `url.searchParams.get()` returns a string or `null`; `getAll()` handles repeated keys.
- `set`, `append` and `delete` change the query and encode values safely.
- Always validate and convert query values before you trust them.
- `fileURLToPath(import.meta.url)` turns a module's URL into a normal path.

<code id="code-content" class="language-javascript">
// urls.mjs: parse, read, build and validate URLs with the built-in URL API
import { fileURLToPath } from 'node:url';
// 1. Parse a full URL into its parts
const url = new URL('https://shop.example.com:8080/books/search?q=node+js&amp;tag=new&amp;tag=sale#top');
console.log(url.hostname, url.port, url.pathname, url.hash);
// 2. Read the query string (every value is a string, or null if missing)
const params = url.searchParams;
console.log(params.get('q'));      // node js
console.log(params.getAll('tag')); // [ 'new', 'sale' ]
console.log(params.get('page'));   // null
// 3. Resolve a relative link against a base
console.log(new URL('../about', 'https://example.com/blog/post').href);
// ---
// 4. Build a URL safely: searchParams does the encoding for you
const api = new URL('https://api.example.com/books');
api.searchParams.set('author', 'Jane Austen');
api.searchParams.set('q', 'pride &amp; prejudice');
api.searchParams.set('page', 2); // numbers become strings
console.log(api.href);
// 5. Check user input without try/catch
for (const input of ['https://example.com', 'example.com', 'not a url']) {
  console.log(input, '=&gt;', URL.canParse(input) ? 'valid' : 'invalid');
}
console.log(URL.parse('nope')); // null instead of an exception
// ---
// 6. Turn query values into safe numbers, with defaults and limits
function toInt(value, { fallback, min, max }) {
  if (value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) &amp;&amp; n &gt;= min &amp;&amp; n &lt;= max ? n : null;
}
const request = new URL('/books?page=3&amp;limit=abc', 'http://localhost');
const page = toInt(request.searchParams.get('page'), { fallback: 1, min: 1, max: 1000 });
const limit = toInt(request.searchParams.get('limit'), { fallback: 10, min: 1, max: 50 });
console.log({ page, limit }); // limit is null, so you would reply 400
// 7. Convert this file's own URL into a normal path
console.log(fileURLToPath(import.meta.url) === import.meta.filename); // true
</code></pre>
