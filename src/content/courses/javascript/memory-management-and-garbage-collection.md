---
publishDate: 2026-03-26T09:44
title: Memory Management and Garbage Collection
slug: memory-management-and-garbage-collection
metadescription: Learn how JavaScript frees memory automatically, what causes leaks, and how to find and fix them.
updateDate: 2026-09-05T09:44
author: ['bishal-biswas']
level: 3
tags: ['performance', 'memory', 'internals']
course: javascript
---

## Memory is managed for you

In C you allocate and free memory by hand. In JavaScript the engine does it, using a **garbage collector**.

That does not mean you can ignore memory. Automatic does not mean leak proof.

## Stack and heap

**The stack** holds primitives and references. It is small, fast, and cleaned up automatically when a function returns.

```javascript
function example() {
  let count = 42;
  let name = 'Asha';
}
```

**The heap** holds objects, arrays and functions. Variables on the stack hold a reference pointing into the heap.

```javascript
function example() {
  const user = { name: 'Asha' };
  const list = [1, 2, 3];
}
```

This is why primitives copy and objects share, which you saw in the very first topics.

## How garbage collection works

The rule is **reachability**. Anything reachable from a root, such as global variables or the current call stack, is kept. Everything else can be freed.

```javascript
let user = { name: 'Asha' };
user = null;
```

After `user = null`, nothing points at that object, so it becomes eligible for collection.

Objects that point at each other are still collected, as long as nothing outside points at them:

```javascript
function pair() {
  const a = {};
  const b = {};
  a.partner = b;
  b.partner = a;
  return 'done';
}
pair();
```

Old reference counting collectors leaked on this. Modern mark and sweep collectors do not.

> You cannot force collection, and you should not try. The engine decides when to run, usually during idle time.

## The common leaks

### Accidental globals

```javascript
function setup() {
  leaked = new Array(1000000);
}
```

Without `let` or `const`, in non strict mode, `leaked` becomes a global and never goes away. Using modules or `'use strict'` turns this into an error instead.

### Forgotten timers

```javascript
function startPolling() {
  const bigData = new Array(1000000).fill('data');
  setInterval(() => {
    console.log(bigData.length);
  }, 1000);
}
startPolling();
```

The interval runs forever, so its callback stays alive, so `bigData` stays alive. Always keep the id and clear it:

```javascript
function startPolling() {
  const bigData = new Array(1000000).fill('data');
  const id = setInterval(() => console.log(bigData.length), 1000);
  return () => clearInterval(id);
}
const stop = startPolling();
stop();
```

### Detached DOM nodes

```javascript
const cache = [];
function addRow() {
  const row = document.createElement('div');
  cache.push(row);
  document.body.append(row);
}
function clearRows() {
  document.body.innerHTML = '';
}
```

The elements are gone from the page but `cache` still holds them, so the browser cannot free them. This is one of the most common leaks in single page applications. Clear your own references too.

### Listeners on long lived objects

```javascript
class Widget {
  constructor() {
    this.data = new Array(100000);
    window.addEventListener('resize', this.onResize.bind(this));
  }
  onResize() {
    console.log(this.data.length);
  }
}
```

`window` outlives the widget, so the widget can never be freed. Keep the reference and remove it:

```javascript
class Widget {
  constructor() {
    this.data = new Array(100000);
    this.handler = () => console.log(this.data.length);
    window.addEventListener('resize', this.handler);
  }
  destroy() {
    window.removeEventListener('resize', this.handler);
  }
}
```

Or use `AbortController`, which cleans up every listener at once:

```javascript
class Widget {
  #controller = new AbortController();
  constructor() {
    window.addEventListener('resize', () => this.onResize(), {
      signal: this.#controller.signal
    });
  }
  onResize() {}
  destroy() {
    this.#controller.abort();
  }
}
```

### Closures holding more than they need

```javascript
function makeHandler() {
  const hugeData = new Array(1000000).fill('x');
  const count = hugeData.length;
  return function () {
    console.log(count);
  };
}
```

The closure only needs `count`, but engines may keep the whole scope alive. Extract just what you need and let the big value go.

## WeakMap and WeakSet

These hold references that do **not** prevent collection.

```javascript
const strong = new Map();
let user = { name: 'Asha' };
strong.set(user, 'metadata');
user = null;
const weak = new WeakMap();
let user2 = { name: 'Ben' };
weak.set(user2, 'metadata');
user2 = null;
```

The `Map` keeps its key alive forever. The `WeakMap` lets it go once nothing else refers to it.

This makes `WeakMap` ideal for attaching data to objects you do not own:

```javascript
const metadata = new WeakMap();
function track(element, info) {
  metadata.set(element, info);
}
function getInfo(element) {
  return metadata.get(element);
}
```

When the element is removed from the page and forgotten, its entry disappears too. Note that weak collections are not iterable, precisely because their contents can vanish at any moment.

## Finding a leak

1. Open DevTools and go to **Memory**.
2. Take a heap snapshot.
3. Use the app for a while, doing the suspicious action repeatedly.
4. Take another snapshot.
5. Compare them and look at what grew.

The **Performance** panel with the Memory checkbox shows a timeline. A healthy app looks like a saw tooth, rising then dropping when collection runs. A steadily climbing line with no drops means a leak.

Search for `Detached` in a snapshot to find DOM nodes held by JavaScript.

## Practical habits

- Clear timers and intervals when you are done.
- Remove listeners, or use `AbortController`.
- Null out large caches you no longer need.
- Give caches a size limit.
- Use `WeakMap` for metadata about objects you do not control.
- Avoid keeping DOM references longer than the elements live.

## Quick recap

- Primitives live on the stack, objects on the heap.
- Anything unreachable from a root is collected automatically.
- Circular references are fine for modern collectors.
- Leaks come from globals, timers, listeners, detached nodes and oversized caches.
- `WeakMap` and `WeakSet` hold references without blocking collection.
- Compare heap snapshots to find what is growing.
- You cannot and should not force collection.

<code id="code-content" class="language-javascript">
// Unreachable means collectable
let user = { name: 'Asha' };
user = null;                 // the object can now be freed
// Circular references are fine for modern collectors
function pair() {
  const a = {}, b = {};
  a.partner = b;
  b.partner = a;
  return 'both are freed when pair() returns';
}
console.log(pair());
// LEAK: a timer keeps its callback, and the callback keeps the data
function leakyPolling() {
  const bigData = new Array(100000).fill('data');
  setInterval(() =&gt; console.log(bigData.length), 1000);  // never cleared
}
// FIX: return a cleanup function
function polling() {
  const bigData = new Array(100000).fill('data');
  const id = setInterval(() =&gt; console.log(bigData.length), 1000);
  return () =&gt; clearInterval(id);
}
const stop = polling();
stop();
// LEAK: a listener on window outlives the object that added it
class LeakyWidget {
  constructor() {
    this.data = new Array(100000);
    window.addEventListener('resize', this.onResize.bind(this));  // no way back
  }
  onResize() { console.log(this.data.length); }
}
// FIX: AbortController removes every listener at once
class Widget {
  #controller = new AbortController();
  constructor() {
    this.data = new Array(100000);
    window.addEventListener('resize', () =&gt; this.onResize(), {
      signal: this.#controller.signal
    });
  }
  onResize() { console.log(this.data.length); }
  destroy() { this.#controller.abort(); }
}
const widget = new Widget();
widget.destroy();
// LEAK: keeping references to elements that were removed from the page
const cache = [];
function addRow() {
  const row = document.createElement('div');
  cache.push(row);              // cache holds it even after the DOM drops it
  document.body.append(row);
}
// FIX: clear your own references too
function clearRows() {
  cache.length = 0;
  document.body.querySelectorAll('div').forEach(el =&gt; el.remove());
}
// WeakMap holds a key without keeping it alive
const metadata = new WeakMap();
let element = { id: 'temp' };
metadata.set(element, { visits: 3 });
console.log(metadata.get(element));
element = null;               // the WeakMap entry can now disappear too
</code></pre>
