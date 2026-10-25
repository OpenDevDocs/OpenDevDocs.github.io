---
publishDate: 2026-05-02T09:03
title: What is React 19? Introduction and Setup
slug: what-is-react-introduction-and-setup
metadescription: Find out what React actually does, why it exists, and get your first app running in under five minutes.
updateDate: 2026-09-05T09:03
author: ['bishal-biswas']
level: 1
tags: ['basics', 'setup']
course: react
---

## What React does

React keeps your interface in sync with your data. That is the whole idea.

Without it, you update the data and then manually update every place on the page that shows it:

```javascript
let count = 0;
function increment() {
  count++;
  document.querySelector('#count').textContent = count;
  document.querySelector('#badge').textContent = count;
  document.querySelector('#total').textContent = `Total: ${count}`;
}
```

Three places to keep in step, and that is with one number. Miss one and your page contradicts itself.

With React you describe what the page should look like for a given state, change the state, and React works out what to update:

```javascript
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>Count: {count}</p>
      <span>{count}</span>
      <p>Total: {count}</p>
      <button onClick={() => setCount(count + 1)}>Add</button>
    </div>
  );
}
```

One source of truth. Everything follows.

## Components

A React app is a tree of **components**. A component is a function that returns markup.

```javascript
function Welcome() {
  return <h1>Hello!</h1>;
}
```

Components nest, which is how you build a whole page out of small pieces:

```javascript
function App() {
  return (
    <div>
      <Header />
      <Welcome />
      <Footer />
    </div>
  );
}
```

Two rules that matter immediately:

1. **Component names start with a capital letter.** `<Welcome />` is your component, `<welcome />` would be treated as an HTML tag.
2. **A component returns markup**, and only ever one top level element.

## A short history

- **2013**: React is released by Facebook.
- **2015**: React Native brings the same ideas to mobile.
- **2019**: Hooks arrive in 16.8, and function components replace classes.
- **2022**: React 18 adds concurrent rendering.
- **2024**: React 19 adds Actions, Server Components and the `use` API.
- **2025**: React 19.2 adds `<Activity>` and `useEffectEvent`, and the React Compiler reaches 1.0.

This course teaches React 19. If you find a tutorial full of `class` components and `this.setState`, it predates 2019 and you can safely skip it.

## Library, not framework

React handles the interface. It does not include routing, data fetching or a build system, so you pick those yourself. That flexibility is why React is everywhere, and also why beginners find the ecosystem overwhelming.

The usual choices are React Router for routing and TanStack Query for server data, or a framework like Next.js that decides for you.

## Creating your first app

```bash
npm create vite@latest my-app
cd my-app
npm install
npm run dev
```

Choose **React** and then **JavaScript** or **TypeScript** when prompted. Open the URL it prints, usually `http://localhost:5173`.

Note that **Create React App is retired**. If a tutorial tells you to run `npx create-react-app`, it is out of date. Use Vite, or a framework.

## Your first component

Replace everything in `src/App.jsx`:

```javascript
export default function App() {
  return (
    <div>
      <h1>My first React app</h1>
      <p>This is a component.</p>
    </div>
  );
}
```

Save the file. The browser updates instantly without losing your place, which is called Hot Module Replacement.

## How it reaches the page

`src/main.jsx` is where React attaches to the DOM.

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

Three things happen:

1. `createRoot` takes one real DOM element, the `<div id="root">` in `index.html`.
2. `render` puts your component tree inside it.
3. `StrictMode` turns on extra development checks.

### About StrictMode

In development, StrictMode deliberately runs your components **twice** and runs effects **twice**. This is not a bug. It surfaces code that misbehaves when repeated, which is exactly the code that will break later.

If you see every `console.log` printing twice, that is StrictMode. It does not happen in production.

## Two packages

```javascript
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
```

- **`react`** is the core: components, hooks, state.
- **`react-dom`** connects React to the browser.

The split exists because React itself is not tied to the browser. React Native swaps `react-dom` for a mobile renderer while `react` stays the same.

## Quick recap

- React keeps the interface in sync with the data automatically.
- An app is a tree of components, which are functions returning markup.
- Component names must start with a capital letter.
- React 19 is current, and anything class based predates 2019.
- Use `npm create vite@latest`, because Create React App is retired.
- `createRoot` and `render` attach your tree to one DOM element.
- StrictMode double invokes things in development on purpose.

<code id="code-content" class="language-javascript">
// ---------- src/main.jsx: where React meets the page ----------
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
// createRoot takes the one real DOM node from index.html
createRoot(document.getElementById('root')).render(
  &lt;StrictMode&gt;
    &lt;App /&gt;
  &lt;/StrictMode&gt;
);
// StrictMode double invokes components and effects in development only,
// to surface code that breaks when it runs more than once.
// ---------- src/App.jsx: your first components ----------
import { useState } from 'react';
// A component is a function that returns markup.
// The capital letter is required: &lt;Welcome /&gt; is yours, &lt;welcome /&gt; is HTML.
function Welcome({ name }) {
  return &lt;h1&gt;Hello, {name}!&lt;/h1&gt;;
}
function Counter() {
  const [count, setCount] = useState(0);
  // Change the state once, and every place that shows it updates
  return (
    &lt;div&gt;
      &lt;p&gt;Count: {count}&lt;/p&gt;
      &lt;p&gt;Doubled: {count * 2}&lt;/p&gt;
      &lt;button onClick={() =&gt; setCount(count + 1)}&gt;Add one&lt;/button&gt;
    &lt;/div&gt;
  );
}
// Components nest, which is how a page gets built from small pieces
export default function App() {
  return (
    &lt;div&gt;
      &lt;Welcome name="Asha" /&gt;
      &lt;Counter /&gt;
    &lt;/div&gt;
  );
}
</code></pre>
