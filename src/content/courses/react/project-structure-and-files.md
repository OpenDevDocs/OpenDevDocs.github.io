---
publishDate: 2026-05-02T09:05
title: Project Structure and Files
slug: project-structure-and-files
metadescription: Walk through every file a new React project creates, and learn how to organise components as the project grows.
updateDate: 2026-09-05T09:05
author: ['bishal-biswas']
level: 1
tags: ['setup', 'structure']
course: react
---

## What Vite generates

```bash
my-app/
  node_modules/
  public/
    vite.svg
  src/
    assets/
      react.svg
    App.css
    App.jsx
    index.css
    main.jsx
  .gitignore
  index.html
  package.json
  vite.config.js
```

Fewer files than you might expect. Let us go through the ones that matter.

## `index.html`

The only real HTML page, and it sits at the project root rather than inside `public/`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

Two lines carry the whole app:

- `<div id="root">` is the empty box React fills in.
- The `<script type="module">` loads your code.

Edit the `<title>` here, and add fonts or meta tags here too.

## `src/main.jsx`

The entry point.

```javascript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

This file connects React to `#root` and renders your top component. You will rarely change it, except to wrap the app in providers for routing or state.

## `src/App.jsx`

Your top level component, and where you actually start working.

## `src/index.css` and `src/App.css`

Plain CSS, imported from JavaScript. Anything you import here is global.

```javascript
import './index.css';
```

## `public/`

Files here are copied to the output untouched, and referenced from the root.

```javascript
<img src="/logo.png" alt="Logo" />
```

Use it for `favicon.ico`, `robots.txt`, and anything that must keep its exact filename.

**Do not put images here if you can import them instead.** Imported assets get hashed filenames and can be cached forever:

```javascript
import logo from './assets/logo.png';
<img src={logo} alt="Logo" />
```

## `.jsx` or `.js`?

Both work in Vite, but `.jsx` signals that a file contains JSX. Most teams use `.jsx` for components and `.js` for plain helpers. With TypeScript it is `.tsx` and `.ts`.

## Organising as you grow

### Small projects: group by type

```bash
src/
  components/
    Button.jsx
    Card.jsx
    Header.jsx
  pages/
    Home.jsx
    About.jsx
  hooks/
    useLocalStorage.js
  utils/
    formatDate.js
  App.jsx
  main.jsx
```

Simple and obvious. It works well up to twenty or thirty components.

### Larger projects: group by feature

```bash
src/
  features/
    auth/
      LoginForm.jsx
      useAuth.js
      authApi.js
    cart/
      CartItem.jsx
      CartSummary.jsx
      useCart.js
  components/
    Button.jsx
    Modal.jsx
  App.jsx
```

Everything for one feature lives together. Deleting a feature means deleting one folder, and working on it means opening one folder instead of hopping between four.

`components/` keeps only the genuinely shared pieces.

> **Do not start here.** Begin with the simple layout and reorganise when the pain is real. Premature structure is as unhelpful as no structure.

## Naming

```bash
components/Button.jsx
components/UserProfileCard.jsx
hooks/useLocalStorage.js
utils/formatDate.js
```

The conventions that almost everyone follows:

- **Components** are PascalCase, matching the component name inside.
- **Hooks** start with `use`, which is a real rule, not just style.
- **Utilities** are camelCase.
- **One component per file**, named after the file.

## Component folders

Once a component has its own styles and tests:

```bash
components/
  Button/
    Button.jsx
    Button.module.css
    Button.test.jsx
    index.js
```

The `index.js` re-exports so imports stay short:

```javascript
export { default } from './Button.jsx';
```

```javascript
import Button from './components/Button';
```

## Absolute imports

```javascript
import Button from '../../../components/Button.jsx';
import Button from '@/components/Button.jsx';
```

Set the alias once in `vite.config.js` and never count `../` again.

## What not to commit

```bash
node_modules/
dist/
.env.local
```

`node_modules` is huge and rebuildable. `dist` is generated. `.env.local` holds secrets.

## Environment variables

```bash
VITE_API_URL=https://api.example.com
```

```javascript
console.log(import.meta.env.VITE_API_URL);
```

Only variables starting with `VITE_` are exposed, which is a safety feature.

> **Everything here ends up in the browser.** Anyone can read it in DevTools. Never put an API secret or private key in a `VITE_` variable. Those belong on a server.

## Quick recap

- `index.html` holds `#root` and loads `main.jsx`.
- `main.jsx` connects React to the page, `App.jsx` is where you work.
- `public/` files keep their names, imported assets get hashed for caching.
- Start by grouping by type, move to grouping by feature when it hurts.
- Components are PascalCase, hooks must start with `use`.
- Set up an `@` alias instead of long relative paths.
- `VITE_` variables are public, so never put secrets in them.

<code id="code-content" class="language-javascript">
// ---------- index.html: the only real HTML page ----------
// &lt;div id="root"&gt;&lt;/div&gt;
// &lt;script type="module" src="/src/main.jsx"&gt;&lt;/script&gt;
// ---------- src/main.jsx: connects React to the page ----------
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';                        // global styles
createRoot(document.getElementById('root')).render(
  &lt;StrictMode&gt;
    &lt;App /&gt;
  &lt;/StrictMode&gt;
);
// ---------- Assets: import them so they get hashed and cached ----------
import logo from './assets/logo.png';         // becomes logo.a3f9c2.png
// &lt;img src={logo} alt="Logo" /&gt;
// Files in public/ keep their exact name and are referenced from the root:
// &lt;img src="/favicon.ico" alt="" /&gt;
// ---------- A component folder, once it has styles and tests ----------
// components/Button/Button.jsx
// components/Button/Button.module.css
// components/Button/index.js   -&gt;  export { default } from './Button.jsx';
// which keeps the import short:
// import Button from '@/components/Button';
// ---------- Environment variables ----------
// .env file:  VITE_API_URL=https://api.example.com
const apiUrl = import.meta.env.VITE_API_URL;
console.log('API base:', apiUrl);
console.log('Running in dev?', import.meta.env.DEV);
// WARNING: every VITE_ variable is bundled into the browser code and is
// readable by anyone in DevTools. Secrets belong on a server, never here.
// ---------- Grow the structure only when it hurts ----------
// Start:   src/components, src/pages, src/hooks, src/utils
// Later:   src/features/auth, src/features/cart, plus shared src/components
</code></pre>
