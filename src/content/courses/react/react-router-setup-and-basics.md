---
publishDate: 2026-05-14T09:39
title: 'React Router: Setup and Basics'
slug: react-router-setup-and-basics
metadescription: Add client side routing to a React app, define routes, link between pages and handle URL parameters.
updateDate: 2026-09-05T09:39
author: ['bishal-biswas']
level: 2
tags: ['routing', 'react-router']
course: react
---

## Why you need a router

React renders components. It has no concept of pages or URLs.

Without a router, your whole app lives at one address. The back button does not work, users cannot bookmark anything, and refreshing loses where they were.

A router maps URLs to components and keeps the browser's address bar in sync.

## Installing

```bash
npm install react-router-dom
```

React Router is the most widely used option. It can run in three modes: as a library (covered here), in framework mode with data loading built in, or in declarative mode. The library setup below is the right place to start.

## Defining routes

```javascript
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Products from './pages/Products.jsx';
import NotFound from './pages/NotFound.jsx';
const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/about', element: <About /> },
  { path: '/products', element: <Products /> },
  { path: '*', element: <NotFound /> }
]);
function App() {
  return <RouterProvider router={router} />;
}
```

An array of objects, each mapping a path to an element. `*` matches anything not matched above, which gives you a 404 page.

## Linking

**Never use a plain `<a>` for internal links.**

```javascript
<a href="/about">About</a>
<Link to="/about">About</Link>
```

An `<a>` triggers a full page reload: the whole app downloads and restarts, and all your state is lost. `<Link>` changes the URL and swaps the component, which is instant.

```javascript
import { Link } from 'react-router-dom';
function Nav() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/about">About</Link>
      <Link to="/products">Products</Link>
    </nav>
  );
}
```

Use a real `<a>` only for external links.

## Highlighting the active link

```javascript
import { NavLink } from 'react-router-dom';
function Nav() {
  return (
    <nav>
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        Home
      </NavLink>
      <NavLink to="/products" className={({ isActive }) => (isActive ? 'active' : '')}>
        Products
      </NavLink>
    </nav>
  );
}
```

`NavLink` passes `isActive` to `className` or `style`. It also sets `aria-current="page"` automatically, which matters for screen readers.

Note `end` on the home link. Without it, `/` counts as active on every page, because every path starts with `/`.

## URL parameters

```javascript
const router = createBrowserRouter([
  { path: '/products', element: <Products /> },
  { path: '/products/:id', element: <ProductDetail /> }
]);
```

The colon marks a dynamic segment. Read it with `useParams`:

```javascript
import { useParams } from 'react-router-dom';
function ProductDetail() {
  const { id } = useParams();
  return <h1>Product {id}</h1>;
}
```

**Parameters are always strings**, even when they look like numbers. Convert before using them as numbers:

```javascript
const { id } = useParams();
const productId = Number(id);
if (Number.isNaN(productId)) return <NotFound />;
```

Several parameters work as you would expect:

```javascript
{ path: '/users/:userId/posts/:postId', element: <Post /> }
```

```javascript
const { userId, postId } = useParams();
```

## Query strings

Parameters are part of the path. Query strings are for filters, sorting and pagination.

```javascript
import { useSearchParams } from 'react-router-dom';
function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') ?? 'all';
  const page = Number(searchParams.get('page') ?? 1);
  function selectCategory(next) {
    setSearchParams({ category: next, page: '1' });
  }
  return (
    <div>
      <button onClick={() => selectCategory('books')}>Books</button>
      <p>Showing {category}, page {page}</p>
    </div>
  );
}
```

`useSearchParams` works like `useState` but the value lives in the URL. That means filters survive a refresh and can be shared as a link, which is exactly what users expect.

Note that `setSearchParams` **replaces** everything. To keep the other values:

```javascript
setSearchParams((previous) => {
  previous.set('page', '2');
  return previous;
});
```

## Navigating in code

```javascript
import { useNavigate } from 'react-router-dom';
function LoginForm() {
  const navigate = useNavigate();
  async function handleSubmit(event) {
    event.preventDefault();
    await login();
    navigate('/dashboard');
  }
  return <form onSubmit={handleSubmit}>...</form>;
}
```

```javascript
navigate('/products');
navigate('/products', { replace: true });
navigate(-1);
navigate('/checkout', { state: { from: '/cart' } });
```

`replace: true` swaps the current entry instead of adding one, so the back button does not return to a login page the user has already passed.

> Use `<Link>` for anything a user clicks. Use `navigate` only after an action, such as a successful submit.

## Deployment gotcha

Client side routes do not exist as files. Visiting `/about` directly asks the server for a file that is not there, and you get a 404.

The fix is a host rule serving `index.html` for every path.

```bash
/*  /index.html  200
```

That is Netlify's `_redirects`. Vercel does it automatically, and other hosts have an equivalent. If your links work but refreshing 404s, this is why.

## Quick recap

- A router maps URLs to components and keeps history working.
- Use `<Link>` for internal navigation, never a plain `<a>`.
- `NavLink` gives you an active state and sets `aria-current`.
- Add `end` to the home `NavLink` or it is always active.
- `:id` defines a parameter, read with `useParams`, always a string.
- `useSearchParams` puts filters in the URL so they can be shared.
- `useNavigate` is for navigating after an action, with `replace` where appropriate.
- Configure your host to serve `index.html` for all paths.

<code id="code-content" class="language-javascript">
import {
  createBrowserRouter, RouterProvider, Link, NavLink,
  useParams, useSearchParams, useNavigate
} from 'react-router-dom';
// Routes map a URL to a component. '*' catches everything unmatched.
const router = createBrowserRouter([
  { path: '/', element: &lt;Home /&gt; },
  { path: '/products', element: &lt;Products /&gt; },
  { path: '/products/:id', element: &lt;ProductDetail /&gt; },
  { path: '*', element: &lt;NotFound /&gt; }
]);
export default function App() {
  return &lt;RouterProvider router={router} /&gt;;
}
function Nav() {
  return (
    &lt;nav&gt;
      {/* `end` is required here, or / is active on every page */}
      &lt;NavLink to="/" end className={({ isActive }) =&gt; (isActive ? 'active' : '')}&gt;
        Home
      &lt;/NavLink&gt;
      {/* Link, never a plain &lt;a&gt;. An &lt;a&gt; reloads the whole app. */}
      &lt;Link to="/products"&gt;Products&lt;/Link&gt;
      &lt;a href="https://example.com"&gt;External site&lt;/a&gt;
    &lt;/nav&gt;
  );
}
// URL parameters are ALWAYS strings, even when they look like numbers
function ProductDetail() {
  const { id } = useParams();
  const productId = Number(id);
  if (Number.isNaN(productId)) return &lt;NotFound /&gt;;
  return &lt;h1&gt;Product {productId}&lt;/h1&gt;;
}
// Query strings belong in the URL, so filters survive a refresh and can
// be shared as a link
function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') ?? 'all';
  const page = Number(searchParams.get('page') ?? 1);
  function nextPage() {
    // The updater form keeps the other parameters. Passing an object
    // would replace every one of them.
    setSearchParams((previous) =&gt; {
      previous.set('page', String(page + 1));
      return previous;
    });
  }
  return (
    &lt;div&gt;
      &lt;p&gt;Category {category}, page {page}&lt;/p&gt;
      &lt;button onClick={nextPage}&gt;Next page&lt;/button&gt;
    &lt;/div&gt;
  );
}
// navigate() is for AFTER an action, not for things users click
function LoginForm() {
  const navigate = useNavigate();
  async function handleSubmit(event) {
    event.preventDefault();
    await login();
    // replace: true so the back button does not return to the login page
    navigate('/dashboard', { replace: true });
  }
  return &lt;form onSubmit={handleSubmit}&gt;&lt;button&gt;Log in&lt;/button&gt;&lt;/form&gt;;
}
// DEPLOYMENT: client routes are not real files, so the host must serve
// index.html for every path. Netlify _redirects:   /*  /index.html  200
</code></pre>
