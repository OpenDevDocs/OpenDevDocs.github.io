---
publishDate: 2026-03-19T09:31
title: Async/Await
slug: async-await
metadescription: Write asynchronous code that reads like ordinary code, with async functions, await, try-catch error handling and parallel work.
updateDate: 2026-09-05T09:31
author: ['bishal-biswas']
level: 2
tags: ['async', 'promises', 'es6']
course: javascript
---

## Promises, but easier to read

`async` and `await` are a nicer way to write promises. Nothing new happens underneath, the syntax is just far closer to how you think.

```javascript
function getUser() {
  return fetchUser(1)
    .then(user => fetchPosts(user.id))
    .then(posts => posts.length)
    .catch(error => console.log(error.message));
}
async function getUserAsync() {
  try {
    const user = await fetchUser(1);
    const posts = await fetchPosts(user.id);
    return posts.length;
  } catch (error) {
    console.log(error.message);
  }
}
```

The second version reads top to bottom, like normal code.

## `async`

Put `async` in front of a function and two things happen:

1. It always returns a promise.
2. You may use `await` inside it.

```javascript
async function greet() {
  return 'Hello';
}
console.log(greet());
greet().then(value => console.log(value));
```

Returning `'Hello'` gives you a promise that resolves to `'Hello'`. Throwing gives you a rejected promise:

```javascript
async function fail() {
  throw new Error('Something broke');
}
fail().catch(error => console.log('Caught:', error.message));
```

## `await`

`await` pauses the function until the promise settles, then hands you the value.

```javascript
async function loadUser() {
  console.log('Starting');
  const user = await fetchUser(1);
  console.log('Got:', user.name);
  return user;
}
loadUser();
console.log('This runs before the user arrives');
```

Important: `await` pauses **only that function**. The rest of your program keeps running, so the page never freezes.

## Error handling with try-catch

This is a big win. Async errors become ordinary errors.

```javascript
async function loadUser(id) {
  try {
    const user = await fetchUser(id);
    console.log('Got:', user.name);
    return user;
  } catch (error) {
    console.log('Failed:', error.message);
    return null;
  } finally {
    console.log('Finished attempting');
  }
}
loadUser(1);
loadUser(-1);
```

You can also mix styles, which is handy for a single call:

```javascript
async function load() {
  const user = await fetchUser(1).catch(() => null);
  if (!user) {
    console.log('Could not load');
    return;
  }
  console.log(user.name);
}
```

## The performance trap

This is the most common mistake with `await`.

```javascript
async function loadAllSlow() {
  const a = await fetchUser(1);
  const b = await fetchUser(2);
  const c = await fetchUser(3);
  return [a, b, c];
}
```

Three requests, one after another. If each takes a second, this takes three.

None of them depend on each other, so run them together:

```javascript
async function loadAllFast() {
  const [a, b, c] = await Promise.all([
    fetchUser(1),
    fetchUser(2),
    fetchUser(3)
  ]);
  return [a, b, c];
}
```

One second instead of three.

> **The rule:** only `await` in sequence when a step genuinely needs the result of the one before it.

## Awaiting in a loop

The same trap appears in loops:

```javascript
async function loadEach(ids) {
  const users = [];
  for (const id of ids) {
    users.push(await fetchUser(id));
  }
  return users;
}
async function loadTogether(ids) {
  return Promise.all(ids.map(id => fetchUser(id)));
}
```

Sequential loops are sometimes what you want, for example when you must not overload a server. Just make it a deliberate choice.

Watch out for this one:

```javascript
async function broken(ids) {
  ids.forEach(async (id) => {
    const user = await fetchUser(id);
    console.log(user.name);
  });
  console.log('Done');
}
```

`Done` prints immediately. `forEach` does not wait for async callbacks. Use `for...of` or `Promise.all` with `map`.

## Top level await

Inside an ES module you can use `await` at the top level.

```javascript
const response = await fetch('/api/config');
const config = await response.json();
console.log(config);
```

In a classic script you cannot, so wrap it in an async IIFE:

```javascript
(async () => {
  const response = await fetch('/api/config');
  console.log(await response.json());
})();
```

## Awaiting a non promise

```javascript
async function test() {
  const value = await 42;
  console.log(value);
}
test();
```

This works. A non promise is wrapped automatically. Handy when a function might return either.

## A complete example

```javascript
async function loadDashboard(userId) {
  try {
    const user = await fetchUser(userId);
    const [posts, notifications] = await Promise.all([
      fetchPosts(user.id),
      fetchNotifications(user.id)
    ]);
    return {
      name: user.name,
      postCount: posts.length,
      unread: notifications.filter(n => !n.read).length
    };
  } catch (error) {
    console.log('Dashboard failed:', error.message);
    return null;
  }
}
```

The user is needed first, so that one is sequential. Posts and notifications are independent, so they run together. That is the pattern you want.

## Quick recap

- `async` makes a function return a promise and allows `await` inside.
- `await` pauses that function only, not the whole program.
- Handle errors with ordinary `try-catch`.
- Sequential `await` calls run one after another, which is often needlessly slow.
- Use `Promise.all` for independent work.
- `forEach` ignores async callbacks, so use `for...of` or `map` with `Promise.all`.
- Top level `await` works in modules, not in classic scripts.

<code id="code-content" class="language-javascript">
function fetchUser(id) {
  return new Promise((resolve, reject) =&gt; {
    setTimeout(() =&gt; {
      if (id &lt;= 0) reject(new Error('Invalid id: ' + id));
      else resolve({ id: id, name: 'User ' + id });
    }, 500);
  });
}
// async always returns a promise, await unwraps one
async function loadUser(id) {
  try {
    const user = await fetchUser(id);
    console.log('Got:', user.name);
    return user;
  } catch (error) {
    console.log('Failed:', error.message);   // ordinary try/catch works
    return null;
  } finally {
    console.log('Finished attempting id', id);
  }
}
loadUser(1);
loadUser(-1);
// SLOW: three requests one after another, about 1.5 seconds
async function loadAllSlow() {
  const a = await fetchUser(1);
  const b = await fetchUser(2);
  const c = await fetchUser(3);
  return [a, b, c];
}
// FAST: the same three requests together, about 0.5 seconds
async function loadAllFast() {
  return Promise.all([fetchUser(1), fetchUser(2), fetchUser(3)]);
}
loadAllFast().then(users =&gt; console.log(users.map(u =&gt; u.name)));
// forEach does NOT wait for async callbacks
async function broken(ids) {
  ids.forEach(async id =&gt; { await fetchUser(id); });
  console.log('broken: this prints immediately');
}
// for...of does wait, one at a time
async function sequential(ids) {
  for (const id of ids) {
    const user = await fetchUser(id);
    console.log('sequential:', user.name);
  }
}
sequential([1, 2]);
// The real world pattern: sequential where needed, parallel where possible
async function loadDashboard(userId) {
  const user = await fetchUser(userId);            // needed first
  const [a, b] = await Promise.all([               // independent, so together
    fetchUser(user.id + 1),
    fetchUser(user.id + 2)
  ]);
  return { name: user.name, related: [a.name, b.name] };
}
loadDashboard(1).then(result =&gt; console.log(result));
</code></pre>
