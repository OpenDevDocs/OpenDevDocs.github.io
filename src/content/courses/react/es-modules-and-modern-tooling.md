---
publishDate: 2026-05-01T09:02
title: ES Modules and the Modern Build Toolchain
slug: es-modules-and-modern-tooling
metadescription: Understand import and export, and what a bundler actually does between your source files and the browser.
updateDate: 2026-09-05T09:02
author: ['bishal-biswas']
level: 1
tags: ['prerequisites', 'modules', 'tooling']
course: react
---

## Every component is a module

A React app is dozens of small files that import each other. Understanding that wiring makes the whole project structure make sense.

## Exporting

### Default export

One per file, for the thing the file is really about. This is the normal choice for a component.

```javascript
export default function Button({ label }) {
  return label;
}
```

### Named exports

As many as you like, for helpers and constants.

```javascript
export const MAX_ITEMS = 10;
export function formatPrice(value) {
  return `Rs ${value}`;
}
```

## Importing

```javascript
import Button from './Button.jsx';
import { MAX_ITEMS, formatPrice } from './utils.js';
import Anything, { MAX_ITEMS } from './Button.jsx';
```

The difference is the braces:

- **No braces** means the default export. You can name it whatever you like.
- **Braces** mean named exports. The names must match exactly.

This trips up beginners constantly. If you see `Button is not defined` or a component rendering as blank, check whether the export was default and the import used braces, or the other way round.

## Import paths

```javascript
import Button from './Button.jsx';
import Header from '../layout/Header.jsx';
import { useState } from 'react';
```

A path starting with `.` or `..` is **your** file. Anything else is a package from `node_modules`.

`./` means the same folder, `../` means one folder up.

## Path aliases

Deep relative paths get ugly fast.

```javascript
import Button from '../../../components/ui/Button.jsx';
import Button from '@/components/ui/Button.jsx';
```

Configure the alias once in `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') }
  }
});
```

## Re-exporting

A single entry point for a folder keeps imports tidy.

```javascript
export { default as Button } from './Button.jsx';
export { default as Card } from './Card.jsx';
export { default as Modal } from './Modal.jsx';
```

```javascript
import { Button, Card, Modal } from './components';
```

## Modules run once

A module is evaluated the first time something imports it, and every later import gets the same instance.

```javascript
console.log('config.js is running');
export const config = { apiUrl: '/api' };
```

Import that from ten files and the log prints once. All ten share one `config` object. Useful for shared setup, and a trap if you expected a fresh copy.

## What a bundler does

Browsers can load ES modules natively, but a React project still needs a build step for four reasons.

**JSX is not JavaScript.** No browser understands it, so it must be compiled first.

```javascript
const element = <h1>Hello</h1>;
const compiled = _jsx('h1', { children: 'Hello' });
```

**Packages use bare imports.** `import { useState } from 'react'` means nothing to a browser, which needs a real URL. The bundler resolves it.

**Many small files are slow to load.** The bundler combines them.

**Production code should be small.** Minification and tree shaking strip comments, whitespace and unused exports.

## Vite in development versus production

**In development**, Vite serves your files as native ES modules with almost no processing. That is why the dev server starts instantly regardless of project size, and why changing a file updates the page immediately.

**For production**, `npm run build` bundles everything with Rollup, minifies it, and writes hashed filenames into `dist/`.

```bash
npm run dev
npm run build
npm run preview
```

`npm run preview` serves the production build locally, which is worth doing before you deploy.

## Tree shaking

```javascript
export function used() { return 'yes'; }
export function unused() { return 'never called'; }
```

If nothing imports `unused`, the bundler drops it. This works only because `import` is static and analysable, which is one of the strongest reasons ES modules replaced the older `require`.

It also means this matters:

```javascript
import _ from 'lodash';
import { debounce } from 'lodash-es';
```

The first pulls in the whole library. The second lets the bundler keep only what you use.

## Quick recap

- Default exports import without braces, named exports import with them.
- Paths starting with `.` are your files, everything else is a package.
- Aliases like `@/` replace long relative paths.
- A module runs once and is shared by every importer.
- Bundlers exist because JSX needs compiling and bare imports need resolving.
- Vite serves modules directly in development and bundles for production.
- Import named exports so tree shaking can drop what you do not use.

<code id="code-content" class="language-javascript">
// ---------- src/components/Button.jsx ----------
// A default export: one per file, imported without braces
export default function Button({ label, onClick }) {
  return { type: 'button', label, onClick };
}
// Named exports alongside it, imported with braces
export const BUTTON_SIZES = ['sm', 'md', 'lg'];
export function isValidSize(size) {
  return BUTTON_SIZES.includes(size);
}
// ---------- src/utils/format.js ----------
export function formatPrice(value) {
  return 'Rs ' + value.toFixed(2);
}
// ---------- src/components/index.js: one tidy entry point ----------
export { default as Button } from './Button.jsx';
export { default as Card } from './Card.jsx';
// ---------- src/App.jsx ----------
import Button, { BUTTON_SIZES } from './components/Button.jsx';  // default + named
import { formatPrice } from './utils/format.js';                 // named only
import { Button as UiButton, Card } from './components';          // from the barrel
import { useState } from 'react';                                 // a package
console.log(BUTTON_SIZES);
console.log(formatPrice(1499.5));
// Import only what you need, so the bundler can drop the rest
// import _ from 'lodash';                  pulls in everything
// import { debounce } from 'lodash-es';    keeps only debounce
// ---------- vite.config.js: set up the @ alias once ----------
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// import path from 'node:path';
// export default defineConfig({
//   plugins: [react()],
//   resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } }
// });
// Then this replaces ../../../components/ui/Button.jsx
// import Button from '@/components/ui/Button.jsx';
</code></pre>
