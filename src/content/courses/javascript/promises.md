---
publishDate: 2026-03-18T09:30
title: Promises
slug: promises
metadescription: Handle work that finishes later without nesting callbacks. States, then, catch, finally, chaining and the Promise combinators.
updateDate: 2026-09-05T09:30
author: ['bishal-biswas']
level: 2
tags: ['async', 'promises', 'es6']
course: javascript
---

## What is a promise?

A promise is an object that stands for a value you do not have **yet**.

Think of ordering food at a counter. You do not stand there holding the meal. You get a token. The token is not the food, but it guarantees you will get either the food or an apology.

That token is a promise.

## Three states

A promise is always in exactly one of these:

- **Pending**: still working.
- **Fulfilled**: finished successfully, with a value.
- **Rejected**: failed, with a reason.

Once it leaves pending it is **settled**, and it can never change again.

## Creating one

```javascript
const promise = new Promise(function (resolve, reject) {
  const success = true;
  setTimeout(function () {
    if (success) {
      resolve({ id: 1, name: 'Asha' });
    } else {
      reject(new Error('Could not fetch the user'));
    }
  }, 1000);
});
```

You get two functions. Call `resolve` when the work succeeds, `reject` when it fails.

In real code you rarely write `new Promise` yourself. Most APIs, including `fetch`, already return one. You mainly write it when wrapping an older callback based function.

## Consuming a promise

```javascript
promise
  .then(function (user) {
    console.log('Success:', user.name);
  })
  .catch(function (error) {
    console.log('Failed:', error.message);
  })
  .finally(function () {
    console.log('Done either way');
  });
```

- `.then` receives the resolved value.
- `.catch` receives the rejection reason.
- `.finally` runs regardless, ideal for hiding a loading spinner.

## Chaining

This is what makes promises so much better than callbacks. Whatever you return from a `.then` becomes the input to the next one.

```javascript
fetchUser(1)
  .then(user => fetchPosts(user.id))
  .then(posts => fetchComments(posts[0].id))
  .then(comments => console.log('Comments:', comments.length))
  .catch(error => console.log('Something failed:', error.message));
```

Compare that with the pyramid from the callbacks topic. It is flat, it reads top to bottom, and **one** `.catch` at the end handles a failure at any step.

### Returning a value versus a promise

```javascript
Promise.resolve(5)
  .then(n => n * 2)
  .then(n => {
    console.log(n);
    return new Promise(resolve => setTimeout(() => resolve(n + 1), 500));
  })
  .then(n => console.log(n));
```

If you return a plain value it is passed along. If you return a promise, the chain waits for it.

## The commonest mistake: forgetting `return`

```javascript
fetchUser(1)
  .then(user => {
    fetchPosts(user.id);
  })
  .then(posts => {
    console.log(posts);
  });
```

That prints `undefined`. The second `.then` did not wait, because the first one returned nothing. Add the `return`:

```javascript
fetchUser(1)
  .then(user => {
    return fetchPosts(user.id);
  })
  .then(posts => console.log(posts));
```

With a concise arrow body the return is automatic, which is why `user => fetchPosts(user.id)` works.

## Error handling

An error anywhere in the chain skips straight to the nearest `.catch`.

```javascript
Promise.resolve(1)
  .then(n => {
    throw new Error('Something broke');
  })
  .then(n => console.log('This is skipped'))
  .catch(error => console.log('Caught:', error.message))
  .then(() => console.log('The chain continues after catch'));
```

Notice the chain carries on after the `.catch`, which lets you recover.

> **Always end a chain with `.catch`.** An unhandled rejection is silent in some environments and a hard crash in others.

## Wrapping a callback API

```javascript
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
delay(1000).then(() => console.log('One second passed'));
function fetchUserPromise(id) {
  return new Promise((resolve, reject) => {
    fetchUserCallback(id, (error, user) => {
      if (error) {
        reject(error);
      } else {
        resolve(user);
      }
    });
  });
}
```

## Running promises together

### `Promise.all`

Waits for all of them. Fails as soon as any one fails.

```javascript
Promise.all([fetchUser(1), fetchUser(2), fetchUser(3)])
  .then(users => console.log('All arrived:', users.length))
  .catch(error => console.log('At least one failed:', error.message));
```

Use this when you need everything, such as loading a dashboard.

### `Promise.allSettled`

Waits for all of them and never rejects. You get a report on each.

```javascript
Promise.allSettled([fetchUser(1), fetchUser(-1)])
  .then(results => {
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        console.log('OK:', result.value);
      } else {
        console.log('Failed:', result.reason.message);
      }
    });
  });
```

Use this when partial results are still useful.

### `Promise.race`

Settles with whichever finishes first, success or failure.

```javascript
const timeout = new Promise((resolve, reject) =>
  setTimeout(() => reject(new Error('Timed out')), 3000)
);
Promise.race([fetchUser(1), timeout])
  .then(user => console.log(user))
  .catch(error => console.log(error.message));
```

This is the standard way to add a timeout.

### `Promise.any`

Settles with the first **success**, ignoring failures until they all fail.

```javascript
Promise.any([fetchFromMirror1(), fetchFromMirror2()])
  .then(data => console.log('Got data from whichever answered first'))
  .catch(error => console.log('All sources failed'));
```

## Sequential or parallel?

```javascript
fetchUser(1)
  .then(() => fetchUser(2))
  .then(() => fetchUser(3));
Promise.all([fetchUser(1), fetchUser(2), fetchUser(3)]);
```

The first takes three seconds, the second takes one. Chain only when a step genuinely needs the previous result. Otherwise run them together.

## Quick recap

- A promise represents a value that arrives later.
- It goes from pending to either fulfilled or rejected, once and for all.
- `.then` handles success, `.catch` handles failure, `.finally` always runs.
- Return from inside `.then` or the next step will not wait.
- One `.catch` at the end covers the whole chain.
- `all` needs everything, `allSettled` reports on everything, `race` takes the first to settle, `any` takes the first success.
- Use `Promise.all` for independent work so it runs in parallel.

<code id="code-content" class="language-javascript">
// A promise wraps work that finishes later
function fetchUser(id) {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      if (id &lt;= 0) reject(new Error('Invalid id: ' + id));
      else resolve({ id: id, name: 'User ' + id });
    }, 500);
  });
}
// then / catch / finally
fetchUser(1)
  .then(user =&gt; console.log('Success:', user.name))
  .catch(error =&gt; console.log('Failed:', error.message))
  .finally(() =&gt; console.log('Done either way'));
// Chaining is flat, and one catch covers every step
fetchUser(1)
  .then(user =&gt; fetchUser(user.id + 1))    // return, so the chain waits
  .then(user =&gt; fetchUser(user.id + 1))
  .then(user =&gt; console.log('Ended at:', user.name))
  .catch(error =&gt; console.log('Something failed:', error.message));
// A thrown error skips to the nearest catch, then the chain continues
Promise.resolve(1)
  .then(() =&gt; { throw new Error('Something broke'); })
  .then(() =&gt; console.log('skipped'))
  .catch(error =&gt; console.log('Caught:', error.message))
  .then(() =&gt; console.log('Recovered and carried on'));
// Wrapping setTimeout into a reusable promise
const delay = ms =&gt; new Promise(resolve =&gt; setTimeout(resolve, ms));
delay(300).then(() =&gt; console.log('300ms passed'));
// Run independent work in parallel, not one after another
Promise.all([fetchUser(1), fetchUser(2), fetchUser(3)])
  .then(users =&gt; console.log('All arrived:', users.map(u =&gt; u.name)))
  .catch(error =&gt; console.log('One failed:', error.message));
// allSettled never rejects, so partial results survive
Promise.allSettled([fetchUser(1), fetchUser(-1)])
  .then(results =&gt; results.forEach(r =&gt; {
    console.log(r.status === 'fulfilled' ? 'OK' : 'Failed',
                r.status === 'fulfilled' ? r.value.name : r.reason.message);
  }));
// race adds a timeout
const timeout = new Promise((_, reject) =&gt;
  setTimeout(() =&gt; reject(new Error('Timed out')), 200));
Promise.race([fetchUser(1), timeout])
  .then(user =&gt; console.log('Won the race:', user.name))
  .catch(error =&gt; console.log(error.message));
</code></pre>
