---
publishDate: 2026-03-19T09:32
title: Fetch API and AJAX
slug: fetch-api-and-ajax
metadescription: Talk to servers from the browser. GET and POST requests, headers, error handling, cancelling requests and what CORS means.
updateDate: 2026-09-05T09:32
author: ['bishal-biswas']
level: 2
tags: ['async', 'fetch', 'api', 'browser']
course: javascript
---

## What is AJAX?

AJAX means fetching data from a server **without reloading the page**. It is what lets a feed load more posts as you scroll, or a search box show results as you type.

The name is old, standing for Asynchronous JavaScript and XML, and nobody uses XML any more. Today it means JSON over `fetch`.

## Your first request

```javascript
fetch('https://jsonplaceholder.typicode.com/users/1')
  .then(response => response.json())
  .then(user => console.log(user.name))
  .catch(error => console.log('Request failed:', error.message));
```

Two `.then` calls are needed because:

1. The first promise resolves as soon as the **headers** arrive.
2. `response.json()` returns another promise for the body.

With `async/await` it reads better:

```javascript
async function getUser(id) {
  const response = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
  const user = await response.json();
  return user;
}
getUser(1).then(user => console.log(user.name));
```

## The trap: `fetch` does not reject on 404

This surprises everyone.

```javascript
const response = await fetch('/does-not-exist');
console.log(response.ok);
console.log(response.status);
```

A 404 or 500 is still a **successful** HTTP exchange, so the promise resolves. `fetch` only rejects when the request could not be made at all, such as no network.

You must check yourself:

```javascript
async function getUser(id) {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}
```

`response.ok` is `true` for any status from 200 to 299.

## Reading the response

```javascript
const response = await fetch('/api/data');
const asJson = await response.json();
const asText = await response.text();
const asBlob = await response.blob();
```

You can only read the body **once**. Calling `.json()` after `.text()` throws.

Useful properties:

```javascript
console.log(response.status);
console.log(response.ok);
console.log(response.headers.get('content-type'));
console.log(response.url);
```

## Sending data with POST

```javascript
async function createUser(data) {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.status}`);
  }
  return response.json();
}
createUser({ name: 'Asha', email: 'asha@example.com' })
  .then(created => console.log('Created:', created))
  .catch(error => console.log(error.message));
```

Three things to get right:

- `method` is `'POST'`.
- The `Content-Type` header tells the server what you are sending.
- `body` must be a **string**, so use `JSON.stringify`.

Forgetting `JSON.stringify` sends `[object Object]`, and forgetting the header makes many servers ignore the body entirely.

## Other methods

```javascript
await fetch('/api/users/1', { method: 'DELETE' });
await fetch('/api/users/1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Updated name' })
});
```

## Sending a form

```javascript
const form = document.querySelector('#myForm');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const response = await fetch('/api/submit', {
    method: 'POST',
    body: formData
  });
  console.log(await response.json());
});
```

With `FormData` you do **not** set `Content-Type`. The browser adds it, including the boundary marker that file uploads need.

To send form fields as JSON instead:

```javascript
const formData = new FormData(form);
const data = Object.fromEntries(formData);
await fetch('/api/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

## Sending a token

```javascript
const response = await fetch('/api/profile', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
});
```

## Cancelling a request

For live search, you want to drop the previous request when a new one starts.

```javascript
let controller;
async function search(term) {
  if (controller) {
    controller.abort();
  }
  controller = new AbortController();
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
      signal: controller.signal
    });
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Previous search cancelled');
      return null;
    }
    throw error;
  }
}
```

Note `encodeURIComponent`. Always escape anything you put into a URL, or a search for `a&b` will break the query string.

## Adding a timeout

```javascript
const response = await fetch('/api/slow', {
  signal: AbortSignal.timeout(5000)
});
```

`AbortSignal.timeout` is the modern one liner for this.

## CORS

Try fetching from another site and you may see:

```javascript
// Access to fetch at 'https://other-site.com/api' from origin
// 'https://mysite.com' has been blocked by CORS policy
```

Browsers block cross origin requests unless the **server** sends headers allowing them. This is a security feature, and you cannot switch it off from JavaScript.

Your options: the server owner adds the headers, you proxy the request through your own backend, or you use an API that supports CORS.

## A small wrapper

Once you write more than a few requests, wrap the repetition.

```javascript
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${response.status}: ${message}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}
const users = await api('/api/users');
const created = await api('/api/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'Asha' })
});
```

## Quick recap

- `fetch` returns a promise, and `response.json()` returns another one.
- A 404 does **not** reject, so always check `response.ok`.
- The body can only be read once.
- For JSON POSTs set the `Content-Type` header and stringify the body.
- With `FormData`, let the browser set the header.
- `AbortController` cancels requests, and `AbortSignal.timeout` adds a deadline.
- CORS is enforced by the browser and fixed on the server.

<code id="code-content" class="language-javascript">
const BASE = 'https://jsonplaceholder.typicode.com';
// A GET request. Note the ok check: fetch does NOT reject on 404
async function getUser(id) {
  const response = await fetch(BASE + '/users/' + id);
  if (!response.ok) {
    throw new Error('Request failed with status ' + response.status);
  }
  return response.json();
}
getUser(1)
  .then(user =&gt; console.log('Name:', user.name))
  .catch(error =&gt; console.log('Error:', error.message));
// A POST request: method, Content-Type header, stringified body
async function createPost(data) {
  const response = await fetch(BASE + '/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed: ' + response.status);
  return response.json();
}
createPost({ title: 'Hello', body: 'My first post', userId: 1 })
  .then(created =&gt; console.log('Created id:', created.id))
  .catch(error =&gt; console.log(error.message));
// Cancelling the previous request, the way live search should work
let controller;
async function search(term) {
  if (controller) controller.abort();
  controller = new AbortController();
  try {
    const response = await fetch(
      BASE + '/posts?q=' + encodeURIComponent(term),
      { signal: controller.signal }
    );
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Previous search cancelled');
      return null;
    }
    throw error;
  }
}
// A reusable wrapper so you stop repeating yourself
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!response.ok) {
    throw new Error(response.status + ': ' + await response.text());
  }
  return response.status === 204 ? null : response.json();
}
api(BASE + '/users/2').then(user =&gt; console.log('Wrapper got:', user.name));
</code></pre>
