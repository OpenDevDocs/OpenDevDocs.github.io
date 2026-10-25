---
publishDate: 2026-10-25T09:09
title: Query Strings and the Query Parser
slug: query-strings-and-query-parser
metadescription: Learn how to read query strings with req.query in Express 5, handle missing, repeated and encoded values safely, and choose between the simple and extended query parsers.
updateDate: 2026-10-25T09:09
author: ['bishal-biswas']
level: 1
tags: ['express', 'query-string', 'routing', 'req-query']
course: expressjs
---

## What you will learn

- What a **query string** is and when to use it instead of a route parameter
- How to read values with `req.query`, and why every value is a string (or an array)
- How to handle missing, empty, repeated and encoded values safely
- Why `req.query` is **read-only** in Express 5
- The difference between the **simple** and **extended** query parsers, and how to switch

## What is a query string?

Look at a search URL from almost any shop:

```text
https://shop.example.com/search?q=running+shoes&size=42&sort=price
                               \_________________________________/
                                         query string
```

The **query string** is everything after the `?`. It is a list of **key/value pairs** written as `key=value` and separated by `&`. Here there are three pairs: `q` is `running shoes`, `size` is `42`, and `sort` is `price`.

Query strings carry **extra options** for a request: what to search for, which page to show, how to sort or filter. They are **not** part of the path, so they don't affect which route matches. `/search` and `/search?q=shoes` both match `app.get('/search', ...)`.

### Route parameter or query string?

Both put data in the URL, so which should you use? A good rule of thumb:

| Use a **route parameter** when... | Use a **query string** when... |
| --- | --- |
| The value **identifies** a thing | The value **adjusts** how you see things |
| It is required | It is usually optional |
| `/products/42` (product 42) | `/products?color=red&page=2` (filter and page the list) |

**Think of a library.** The shelf number tells you *which* book (route parameter). Asking for "large print, newest edition first" tells the librarian *how* you want it (query string).

## Reading values with req.query

Express parses the query string for you and puts the result in **`req.query`**, a plain object:

```js
// server.js
import express from 'express';

const app = express();

app.get('/search', (req, res) => {
  res.json(req.query);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

```bash
curl "http://localhost:3000/search?q=shoes&size=42&sort=price"
```

```text
{"q":"shoes","size":"42","sort":"price"}
```

> **Warning:** Always put URLs with a query string in **quotes** in the terminal. The `&` character has a special meaning to shells: in Bash it runs the command in the background, and in PowerShell it is an error. Without quotes, everything after the first `&` gets lost. (On Windows PowerShell, also remember to type `curl.exe`.)

Notice that `size` came back as `"42"` with quotes: **every value in `req.query` is a string**, just like route parameters.

## The values you can get

Query strings come from users, browsers and other programs. They can be messy, so it pays to know every shape a value can take:

| URL | `req.query` |
| --- | --- |
| `/search?q=shoes` | `{ q: 'shoes' }` |
| `/search` | `{}`, so `req.query.q` is `undefined` |
| `/search?q=` | `{ q: '' }` (an empty string) |
| `/search?q` | `{ q: '' }` (also an empty string) |
| `/search?q=a&q=b` | `{ q: ['a', 'b'] }` (an **array**!) |
| `/search?q=running+shoes` | `{ q: 'running shoes' }` (`+` means space) |
| `/search?q=c%2B%2B` | `{ q: 'c++' }` (`%2B` is an encoded `+`) |

The repeated key is the surprise. If a key appears twice, you get an **array** instead of a string. That can crash code that expects a string:

```js
app.get('/greet', (req, res) => {
  // If someone visits /greet?name=a&name=b, name is an array
  // and .toUpperCase() throws a TypeError -> 500 error
  res.send(`HELLO ${req.query.name.toUpperCase()}`);
});
```

### URL encoding in one minute

Some characters can't appear in a URL as they are, because they already mean something (`&`, `=`, `?`, `#`) or aren't allowed (spaces). **URL encoding** (also called percent-encoding) replaces them with `%` followed by a code. Express decodes them for you, so `req.query` always holds the real text.

| Character | Encoded |
| --- | --- |
| space | `%20` or `+` |
| `&` | `%26` |
| `=` | `%3D` |
| `+` | `%2B` |
| `#` | `%23` |

When you build URLs in JavaScript, let `URLSearchParams` do the encoding:

```js
const params = new URLSearchParams({ q: 'rock & roll', page: 2 });
console.log(`/search?${params}`); // /search?q=rock+%26+roll&page=2
```

## Reading query values safely

Because values can be missing, empty, the wrong type or arrays, real code should **clean them up** before using them. Here is a small, realistic example: a product list with paging and sorting.

```js
// server.js
import express from 'express';

const app = express();

const products = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  price: (i * 7) % 50 + 5,
}));

// Take the first value if a key was repeated
const first = (value) => (Array.isArray(value) ? value[0] : value);

app.get('/products', (req, res) => {
  // 1. Read, with defaults for missing values
  const page = Number(first(req.query.page) ?? 1);
  const limit = Number(first(req.query.limit) ?? 10);
  const sort = first(req.query.sort) ?? 'id';

  // 2. Check the values make sense
  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ error: 'page must be a whole number of 1 or more' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return res.status(400).json({ error: 'limit must be between 1 and 50' });
  }
  if (!['id', 'price'].includes(sort)) {
    return res.status(400).json({ error: 'sort must be "id" or "price"' });
  }

  // 3. Use them
  const sorted = [...products].sort((a, b) => a[sort] - b[sort]);
  const start = (page - 1) * limit;

  res.json({
    page,
    limit,
    sort,
    total: products.length,
    items: sorted.slice(start, start + limit),
  });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

Try a few requests:

```bash
curl "http://localhost:3000/products"
curl "http://localhost:3000/products?page=3&limit=10"
curl "http://localhost:3000/products?sort=price&limit=3"
curl "http://localhost:3000/products?page=zero"
```

The last one returns `400` with `{"error":"page must be a whole number of 1 or more"}`, because `Number('zero')` is `NaN` (Not a Number), which is not an integer.

The three steps are worth remembering: **read with defaults, check, then use**. Writing these checks by hand gets long; in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod) you will describe the rules in one place instead. Real-world paging and filtering patterns are covered in [Pagination, Filtering and Sorting](/courses/expressjs/pagination-filtering-sorting).

> **Tip:** `??` only replaces `undefined` and `null`. For `?page=` (an empty string), `first(req.query.page) ?? 1` gives `''`, and `Number('')` is `0`, which the check then rejects. That's the behaviour you want: an empty value is a mistake, so the client gets a clear `400`.

## req.query is read-only in Express 5

In Express 4, some code changed `req.query` directly, for example to replace it with cleaned-up values. In Express 5, **`req.query` is a getter**: a property that is calculated each time you read it, and that you cannot assign to.

```js
app.get('/products', (req, res) => {
  req.query = { page: 1 }; // TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
});
```

Because ES modules always run in strict mode, that assignment throws an error. Changing a single key (`req.query.page = 1`) won't throw, but it won't reliably stick either. The safe habit is simple: **treat `req.query` as read-only, and copy the values you need into your own variables**, as the products example does with `page`, `limit` and `sort`.

```js
// Good: build your own object
const filters = {
  page: Number(first(req.query.page) ?? 1),
  search: first(req.query.q) ?? '',
};
```

## The query parser: simple vs extended

Turning the text `q=shoes&size=42` into an object is the job of the **query parser**. Express 5 offers two built-in parsers, and the default changed from Express 4.

| Setting | Parser | Default in |
| --- | --- | --- |
| `'simple'` | Node's built-in `querystring` module: flat keys only | **Express 5** |
| `'extended'` | The `qs` package: understands brackets for nested objects | Express 4 |

The difference shows up with **square brackets** in keys:

```text
/products?filter[color]=red&filter[size]=m&tags[]=new&tags[]=sale
```

With the default **simple** parser, the brackets are just part of the key names:

```json
{
  "filter[color]": "red",
  "filter[size]": "m",
  "tags[]": ["new", "sale"]
}
```

With the **extended** parser, brackets create nested objects and arrays:

```json
{
  "filter": { "color": "red", "size": "m" },
  "tags": ["new", "sale"]
}
```

### Switching parsers

Use `app.set('query parser', ...)` near the top of your app, before your routes:

```js
// server.js
import express from 'express';

const app = express();
app.set('query parser', 'extended'); // nested objects from brackets

app.get('/products', (req, res) => {
  res.json(req.query);
});
```

To test bracket URLs with curl, add the `-g` flag. Without it, curl treats `[` and `]` as its own special pattern characters and fails with a "bad range" error:

```bash
curl -g "http://localhost:3000/products?filter[color]=red&filter[size]=m"
```

```text
{"filter":{"color":"red","size":"m"}}
```

### Which should you choose?

Stick with the default **`'simple'`** parser unless you have a specific need for nested query objects. Flat keys like `?color=red&size=m` are easier to read, easier to validate, and avoid surprises.

The extended parser is useful when a front-end library or an existing API already sends bracket-style queries. If you turn it on, be extra careful: a client can send **any** shape, so `req.query.filter` might be a string, an array or an object. Always validate before use.

> **Warning:** Never pass `req.query` (or any part of it) straight into a database query. With nested objects, a client could send something like `?price[$gt]=0` and change what your query means. You'll learn how to defend against this in [Preventing Injection, XSS and CSRF](/courses/expressjs/preventing-injection-xss-csrf).

### Other options

The setting also accepts `false` and a function:

```js
// Turn query parsing off: req.query is always {}
app.set('query parser', false);

// Bring your own: here, keep only the last value of each key
app.set('query parser', (queryString) => Object.fromEntries(new URLSearchParams(queryString)));
```

With the custom function above, `/search?q=a&q=b` gives `{ q: 'b' }` because `Object.fromEntries` keeps the last value. You rarely need either option, but now you know they exist.

## Common mistakes

> **Common mistake:** Forgetting quotes around URLs in the terminal. `curl http://localhost:3000/search?q=a&page=2` loses `page=2` (or errors in PowerShell). Write `curl "http://localhost:3000/search?q=a&page=2"`.

> **Common mistake:** Doing maths on query values without converting them. `req.query.page + 1` with `?page=2` gives `'21'` (string joining), not `3`. Use `Number(...)` first.

> **Common mistake:** Expecting `?filter[color]=red` to give `req.query.filter.color`. In Express 5 the default simple parser gives the key `'filter[color]'`. Use `app.set('query parser', 'extended')` if you need nesting.

## Key takeaways

- The **query string** is the part after `?`: `key=value` pairs joined by `&`. It doesn't affect which route matches.
- Use route parameters to **identify** a resource and query strings to **filter, sort or page** it.
- `req.query` values are **strings**, an **empty string**, `undefined` when missing, or an **array** when a key repeats. Read with defaults, check, then use.
- In Express 5, `req.query` is a **read-only getter**. Copy values into your own variables instead of changing it.
- The default parser is **`'simple'`** (flat keys). `app.set('query parser', 'extended')` turns brackets into nested objects.

## Practice

1. Write `GET /greet` that reads `?name=` and responds `Hello, <name>!`, or `Hello, stranger!` when no name is given. Make sure `?name=a&name=b` doesn't crash it.
2. Add a `?minPrice=` filter to the products example that only returns products at or above that price. Reject values that aren't numbers with a `400`.
3. Visit `/products?filter[color]=red` with the simple parser and then with the extended parser. Compare the two `req.query` objects.
4. Use `URLSearchParams` in the Node.js REPL to build a query string for `{ q: 'c++ & rust', page: 1 }`, then paste the URL into curl and check what `req.query` shows.

## What's next

You now know how Express reads paths and query strings. Next, find out how Express picks a route when several could match. Continue with [Route Order and Path Matching](/courses/expressjs/route-order-and-path-matching).
