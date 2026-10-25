---
publishDate: 2026-03-17T09:29
title: Asynchronous JavaScript - Callbacks
slug: asynchronous-javascript-callbacks
metadescription: Learn why JavaScript does not wait, how callbacks handle work that finishes later, and why deep nesting became a problem.
updateDate: 2026-09-05T09:29
author: ['bishal-biswas']
level: 2
tags: ['async', 'callbacks']
course: javascript
---

## Synchronous means "one at a time"

By default JavaScript runs one line, finishes it, then runs the next.

```javascript
console.log('First');
console.log('Second');
console.log('Third');
```

Predictable. The problem is that some work takes time: fetching data, reading a file, waiting for the user. If JavaScript waited for those, the page would freeze completely. No scrolling, no clicking, nothing.

## Asynchronous means "start now, finish later"

```javascript
console.log('First');
setTimeout(function () {
  console.log('Second');
}, 1000);
console.log('Third');
```

The output is `First`, `Third`, `Second`. JavaScript hands the timer to the browser and carries straight on. A second later the browser hands the callback back to be run.

Even a zero delay behaves this way:

```javascript
console.log('First');
setTimeout(function () {
  console.log('Second');
}, 0);
console.log('Third');
```

Still `First`, `Third`, `Second`. The callback has to wait for the current code to finish, no matter how short the delay. The event loop topic explains exactly why.

## Callbacks

A callback is simply a function you pass in to be run later.

```javascript
function fetchUser(id, callback) {
  console.log('Fetching user', id);
  setTimeout(function () {
    const user = { id: id, name: 'Asha' };
    callback(user);
  }, 1000);
}
fetchUser(1, function (user) {
  console.log('Got user:', user.name);
});
console.log('This runs first');
```

## The error first convention

Async work can fail, so Node.js established a convention that spread everywhere: the first parameter of a callback is the error.

```javascript
function fetchUser(id, callback) {
  setTimeout(function () {
    if (id <= 0) {
      callback(new Error('Invalid id'), null);
      return;
    }
    callback(null, { id: id, name: 'Asha' });
  }, 500);
}
fetchUser(1, function (error, user) {
  if (error) {
    console.log('Failed:', error.message);
    return;
  }
  console.log('Got user:', user.name);
});
fetchUser(-1, function (error, user) {
  if (error) {
    console.log('Failed:', error.message);
    return;
  }
  console.log('Got user:', user.name);
});
```

`null` as the first argument means everything went fine.

## The problem: nesting

One callback is easy. The trouble starts when each step depends on the previous one.

```javascript
fetchUser(1, function (error, user) {
  if (error) return console.log(error);
  fetchPosts(user.id, function (error, posts) {
    if (error) return console.log(error);
    fetchComments(posts[0].id, function (error, comments) {
      if (error) return console.log(error);
      fetchAuthor(comments[0].authorId, function (error, author) {
        if (error) return console.log(error);
        console.log('Finally:', author.name);
      });
    });
  });
});
```

This shape is called **callback hell** or the **pyramid of doom**. Three problems:

1. It drifts further right with every step, so it is hard to read.
2. Error handling is repeated at every level.
3. Reordering or inserting a step means restructuring everything.

## Making it a little better

Naming the functions flattens the shape:

```javascript
function handleAuthor(error, author) {
  if (error) return console.log(error);
  console.log('Finally:', author.name);
}
function handleComments(error, comments) {
  if (error) return console.log(error);
  fetchAuthor(comments[0].authorId, handleAuthor);
}
function handlePosts(error, posts) {
  if (error) return console.log(error);
  fetchComments(posts[0].id, handleComments);
}
fetchUser(1, function (error, user) {
  if (error) return console.log(error);
  fetchPosts(user.id, handlePosts);
});
```

Flatter, but now you read the steps bottom to top, which is its own kind of confusing. This is why promises were invented.

## `setTimeout` and `setInterval`

```javascript
const timeoutId = setTimeout(function () {
  console.log('Once, after 2 seconds');
}, 2000);
clearTimeout(timeoutId);
let count = 0;
const intervalId = setInterval(function () {
  count++;
  console.log('Tick', count);
  if (count >= 3) {
    clearInterval(intervalId);
  }
}, 1000);
```

Always keep the id so you can cancel. An interval that nobody clears keeps running forever and leaks memory.

Note that the delay is a **minimum**, not a promise. If the main thread is busy, your callback waits its turn.

## Callbacks are not going away

Even though promises replaced callbacks for sequences of async steps, callbacks remain everywhere for events and iteration:

```javascript
button.addEventListener('click', function () {
  console.log('clicked');
});
[1, 2, 3].forEach(function (n) {
  console.log(n);
});
```

The pattern is fine. It only becomes a problem when async steps stack up.

## Quick recap

- JavaScript does not wait for slow work, it carries on and comes back later.
- A callback is a function passed in to be run when the work completes.
- `setTimeout(fn, 0)` still runs after the current code finishes.
- The error first convention puts the error in the first parameter.
- Nesting dependent callbacks creates the pyramid of doom.
- Keep timer ids so you can cancel them.
- Promises, coming next, solve the nesting problem.

<code id="code-content" class="language-javascript">
// JavaScript does not wait: the order is First, Third, Second
console.log('First');
setTimeout(() =&gt; console.log('Second'), 0);
console.log('Third');
// A callback runs when the slow work finishes
function fetchUser(id, callback) {
  console.log('Fetching user', id, '...');
  setTimeout(function () {
    if (id &lt;= 0) {
      callback(new Error('Invalid id'), null);   // error first
      return;
    }
    callback(null, { id: id, name: 'Asha' });    // null means success
  }, 500);
}
fetchUser(1, function (error, user) {
  if (error) {
    console.log('Failed:', error.message);
    return;
  }
  console.log('Got user:', user.name);
});
fetchUser(-1, function (error, user) {
  if (error) {
    console.log('Failed:', error.message);
    return;
  }
  console.log('Got user:', user.name);
});
// The pyramid of doom: each step waits for the one before it
// fetchUser(1, function (err, user) {
//   fetchPosts(user.id, function (err, posts) {
//     fetchComments(posts[0].id, function (err, comments) {
//       console.log(comments);      // drifting further right every time
//     });
//   });
// });
// Timers: always keep the id so you can cancel
let count = 0;
const intervalId = setInterval(function () {
  count++;
  console.log('Tick', count);
  if (count &gt;= 3) clearInterval(intervalId);   // otherwise it runs forever
}, 1000);
</code></pre>
