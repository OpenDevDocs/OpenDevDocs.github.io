---
publishDate: 2026-03-21T09:35
title: Modules (import/export)
slug: modules-import-export
metadescription: Split your code across files with ES modules. Named and default exports, imports, dynamic loading and how they differ from CommonJS.
updateDate: 2026-09-05T09:35
author: ['bishal-biswas']
level: 2
tags: ['modules', 'es6', 'tooling']
course: javascript
---

## Why modules?

One giant file becomes unmanageable. Modules let you split code into files that each do one job, and say exactly what they share.

Before modules, every script shared one global scope, so a variable in one file could silently clash with another. Modules fix that: everything is private to its file unless you export it.

## Named exports

```javascript
// maths.js
export const PI = 3.14159;
export function add(a, b) {
  return a + b;
}
export function multiply(a, b) {
  return a * b;
}
```

Or list them at the bottom, which some people find clearer:

```javascript
// maths.js
const PI = 3.14159;
function add(a, b) { return a + b; }
function multiply(a, b) { return a * b; }
export { PI, add, multiply };
```

Importing them:

```javascript
// app.js
import { add, PI } from './maths.js';
console.log(add(2, 3), PI);
```

Names must match exactly. Import only what you need.

### Renaming

```javascript
import { add as addNumbers } from './maths.js';
console.log(addNumbers(2, 3));
```

Handy when two modules export the same name.

### Import everything

```javascript
import * as maths from './maths.js';
console.log(maths.add(2, 3), maths.PI);
```

Convenient, though it makes it harder for bundlers to strip unused code.

## Default exports

One per file, for when a module is really about a single thing.

```javascript
// User.js
export default class User {
  constructor(name) {
    this.name = name;
  }
}
```

```javascript
import User from './User.js';
import AnythingIWant from './User.js';
```

There are no braces, and you can call it whatever you like, because a default export has no name of its own.

### Mixing both

```javascript
// api.js
export default function request(url) {
  return fetch(url);
}
export const BASE_URL = 'https://api.example.com';
export function buildUrl(path) {
  return BASE_URL + path;
}
```

```javascript
import request, { BASE_URL, buildUrl } from './api.js';
```

> **Which to use?** Named exports are easier to refactor and autocomplete, because the name is fixed. Many teams use named exports only. Default exports suit a file that exports one obvious thing, such as a single component.

## Re-exporting

A single entry point for a folder makes imports tidier.

```javascript
// utils/index.js
export { formatDate } from './date.js';
export { formatCurrency } from './currency.js';
export * from './string.js';
```

```javascript
import { formatDate, formatCurrency } from './utils/index.js';
```

## Using modules in the browser

```html
<script type="module" src="app.js"></script>
```

`type="module"` matters. Without it, `import` is a syntax error.

Modules also behave differently:

- They are always in strict mode.
- They are deferred by default, so no `defer` attribute is needed.
- Each has its own scope, so no globals leak.
- They are fetched with CORS rules, so `file://` will not work. Use a local server.

The extension is required in the browser:

```javascript
import { add } from './maths.js';
import { add } from './maths';
```

Bundlers let you skip it, plain browsers do not.

## Imports are hoisted

```javascript
console.log(add(2, 3));
import { add } from './maths.js';
```

This works. All imports are resolved before any code runs, which is why import statements must sit at the top level, not inside an `if`.

## Dynamic imports

When you need a module conditionally or on demand, `import()` returns a promise.

```javascript
button.addEventListener('click', async () => {
  const { createChart } = await import('./chart.js');
  createChart();
});
```

The chart code is only downloaded when someone clicks. This is how code splitting works, and it is the main way to keep an initial page load small.

```javascript
async function loadLocale(language) {
  const messages = await import(`./locales/${language}.js`);
  return messages.default;
}
```

## Modules are singletons

A module runs **once**, no matter how many files import it.

```javascript
// counter.js
console.log('counter.js is running');
export let count = 0;
export function increment() {
  count++;
}
```

```javascript
// a.js
import { increment } from './counter.js';
increment();
// b.js
import { count } from './counter.js';
console.log(count);
```

`b.js` sees `1`. Both files share the same instance, and the log prints only once. This is useful for shared state, and a trap if you did not expect it.

Note that imported bindings are **live** but read only. You can see `count` change, but you cannot assign to it from outside.

## ES modules versus CommonJS

Node.js originally used CommonJS:

```javascript
// CommonJS
const { add } = require('./maths');
module.exports = { add };
// ES modules
import { add } from './maths.js';
export { add };
```

Differences that matter:

- `require` is synchronous and can appear anywhere. `import` is static and hoisted.
- `import` supports tree shaking, so bundlers can drop unused exports.
- ES modules are the standard and work in browsers.

In Node, set `"type": "module"` in `package.json` or name files `.mjs` to use ES modules.

## Quick recap

- Modules give each file its own scope and an explicit public surface.
- Named exports keep the name, default exports let the importer choose it.
- Use `type="module"` in the browser and include the `.js` extension.
- Imports are hoisted and must sit at the top level.
- `import()` loads a module on demand and returns a promise.
- A module runs once and is shared by everyone who imports it.
- ES modules are the standard, CommonJS is the older Node system.

<code id="code-content" class="language-javascript">
// ---------- maths.js ----------
// Named exports: the importer must use these exact names
export const PI = 3.14159;
export function add(a, b) { return a + b; }
export function multiply(a, b) { return a * b; }
// ---------- User.js ----------
// A default export: one per file, the importer names it
export default class User {
  constructor(name) { this.name = name; }
  greet() { return 'Hi, ' + this.name; }
}
// ---------- api.js ----------
// A file can have one default plus any number of named exports
export const BASE_URL = 'https://api.example.com';
export default function request(path) { return fetch(BASE_URL + path); }
// ---------- app.js ----------
import { add, PI } from './maths.js';           // named
import { multiply as times } from './maths.js'; // renamed
import * as maths from './maths.js';            // everything
import User from './User.js';                   // default, name is yours
import request, { BASE_URL } from './api.js';   // both at once
console.log(add(2, 3), PI);
console.log(times(4, 5));
console.log(maths.add(1, 1));
console.log(new User('Asha').greet());
console.log(BASE_URL);
// Dynamic import loads a module only when it is needed
document.querySelector('#chartBtn')?.addEventListener('click', async () =&gt; {
  const { createChart } = await import('./chart.js');
  createChart();
});
// Modules are singletons: everyone shares one instance
// counter.js -&gt; export let count = 0; export function increment() { count++; }
// a.js imports and calls increment()
// b.js imports count and sees 1, because it is the same module
// In the browser you must use type="module" and include the extension:
// &lt;script type="module" src="app.js"&gt;&lt;/script&gt;
</code></pre>
