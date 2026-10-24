---
publishDate: 2026-05-14T09:40
title: 'React Router: Nested Routes and Layouts'
slug: react-router-nested-routes-and-layouts
metadescription: Share layouts across pages with nested routes and Outlet, and protect routes behind authentication.
updateDate: 2026-09-05T09:40
author: ['bishal-biswas']
level: 2
tags: ['routing', 'react-router', 'layouts']
course: react
---

## The repetition problem

```javascript
function Home() {
  return (
    <div>
      <Header />
      <Nav />
      <main>Home content</main>
      <Footer />
    </div>
  );
}
function About() {
  return (
    <div>
      <Header />
      <Nav />
      <main>About content</main>
      <Footer />
    </div>
  );
}
```

Every page repeats the shell. Worse, the header and nav **remount** on every navigation, so any state in them is lost and animations restart.

## Nested routes

Define a parent route that renders the shell, with children rendering inside it.

```javascript
import { createBrowserRouter, Outlet } from 'react-router-dom';
function RootLayout() {
  return (
    <div>
      <Header />
      <Nav />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      { path: 'products', element: <Products /> }
    ]
  }
]);
```

`<Outlet />` is the hole where the matched child renders. The header, nav and footer stay mounted across navigations, keeping their state.

Note `index: true`, which means "this is the child for the parent's own path". It is how `/` gets a component.

Note also that child paths have **no leading slash**. `path: 'about'` becomes `/about` because it is relative to the parent.

## Layouts within layouts

```javascript
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      {
        path: 'dashboard',
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'settings', element: <Settings /> },
          { path: 'billing', element: <Billing /> }
        ]
      }
    ]
  }
]);
```

```javascript
function DashboardLayout() {
  return (
    <div className="dashboard">
      <DashboardSidebar />
      <div className="dashboard-content">
        <Outlet />
      </div>
    </div>
  );
}
```

`/dashboard/settings` renders `RootLayout`, then `DashboardLayout` inside its outlet, then `Settings` inside that one. Each level adds its own chrome.

## Layout routes without a path

Sometimes you want a shared layout without adding a URL segment.

```javascript
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <Login /> },
          { path: 'register', element: <Register /> }
        ]
      }
    ]
  }
]);
```

`AuthLayout` has no `path`, so it wraps `/login` and `/register` without becoming `/auth/login`. This is called a pathless layout route.

## Protecting routes

```javascript
import { Navigate, useLocation } from 'react-router-dom';
function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Spinner />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
```

```javascript
{
  element: <RequireAuth />,
  children: [
    { path: 'dashboard', element: <Dashboard /> },
    { path: 'settings', element: <Settings /> }
  ]
}
```

One guard protects every child. Three things make it work properly:

- **The loading check first.** Without it you redirect to login while auth is still being determined, and logged in users get bounced on every refresh.
- **`state={{ from: location }}`** remembers where they were going.
- **`replace`** so the back button does not return to the protected page.

Then send them back after login:

```javascript
function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/dashboard';
  async function handleSubmit(event) {
    event.preventDefault();
    await login();
    navigate(from, { replace: true });
  }
}
```

> **This is not security.** Anyone can bypass a client side guard. The server must check permissions on every request. The guard is for user experience.

## Role based access

```javascript
function RequireRole({ role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.roles.includes(role)) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
```

```javascript
{
  element: <RequireRole role="admin" />,
  children: [{ path: 'admin', element: <AdminPanel /> }]
}
```

## Error elements

```javascript
{
  path: '/',
  element: <RootLayout />,
  errorElement: <RootError />,
  children: [
    { path: 'products/:id', element: <ProductDetail />, errorElement: <ProductError /> }
  ]
}
```

`errorElement` catches errors from that route and its children. The nearest one wins, so a broken product page shows a product error inside the layout, rather than replacing the whole page.

Read the error with `useRouteError`:

```javascript
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
function RootError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return <p>{error.status} {error.statusText}</p>;
  }
  return <p>Something went wrong.</p>;
}
```

## Relative links

Inside a nested route, links are relative to the current route.

```javascript
function DashboardNav() {
  return (
    <nav>
      <Link to="settings">Settings</Link>
      <Link to="/dashboard/settings">Settings</Link>
      <Link to="..">Up one level</Link>
    </nav>
  );
}
```

Relative links keep working if you later move the whole section to a different path.

## Quick recap

- A parent route renders the layout, `<Outlet />` marks where children go.
- Layout components stay mounted across navigations, so their state survives.
- `index: true` is the child for the parent's own path.
- Child paths are relative, with no leading slash.
- A pathless layout route shares chrome without adding a URL segment.
- A guard route with `<Outlet />` protects every child at once.
- Check loading before redirecting, and remember where the user was going.
- Client side guards are user experience, never security.

<code id="code-content" class="language-javascript">
import {
  createBrowserRouter, Outlet, Navigate, Link,
  useLocation, useNavigate, useRouteError
} from 'react-router-dom';
// A layout renders the shell once. Outlet is the hole the matched child
// renders into. The header and nav stay MOUNTED across navigations, so
// their state and animations survive.
function RootLayout() {
  return (
    &lt;div&gt;
      &lt;Header /&gt;
      &lt;main&gt;&lt;Outlet /&gt;&lt;/main&gt;
      &lt;Footer /&gt;
    &lt;/div&gt;
  );
}
function DashboardLayout() {
  return (
    &lt;div className="dashboard"&gt;
      &lt;aside&gt;&lt;Link to="settings"&gt;Settings&lt;/Link&gt;&lt;/aside&gt;
      &lt;Outlet /&gt;
    &lt;/div&gt;
  );
}
// One guard protects every child route beneath it
function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  // Check loading FIRST, or logged in users get bounced on every refresh
  if (isLoading) return &lt;p&gt;Checking your session...&lt;/p&gt;;
  if (!user) {
    // Remember where they were going, and replace so Back does not
    // return them to the protected page
    return &lt;Navigate to="/login" state={{ from: location }} replace /&gt;;
  }
  return &lt;Outlet /&gt;;
}
function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/dashboard';
  async function handleSubmit(event) {
    event.preventDefault();
    await login();
    navigate(from, { replace: true });     // back where they wanted to go
  }
  return &lt;form onSubmit={handleSubmit}&gt;&lt;button&gt;Log in&lt;/button&gt;&lt;/form&gt;;
}
function RootError() {
  const error = useRouteError();
  return &lt;p role="alert"&gt;Something went wrong: {error?.statusText ?? 'unknown'}&lt;/p&gt;;
}
export const router = createBrowserRouter([
  {
    path: '/',
    element: &lt;RootLayout /&gt;,
    errorElement: &lt;RootError /&gt;,
    children: [
      { index: true, element: &lt;Home /&gt; },        // the child for '/'
      { path: 'about', element: &lt;About /&gt; },     // relative, no leading /
      {
        // A pathless layout route: shared chrome, no extra URL segment,
        // so these stay at /login and /register
        element: &lt;AuthLayout /&gt;,
        children: [
          { path: 'login', element: &lt;Login /&gt; },
          { path: 'register', element: &lt;Register /&gt; }
        ]
      },
      {
        element: &lt;RequireAuth /&gt;,                // guards everything below
        children: [
          {
            path: 'dashboard',
            element: &lt;DashboardLayout /&gt;,
            children: [
              { index: true, element: &lt;Overview /&gt; },
              { path: 'settings', element: &lt;Settings /&gt; }
            ]
          }
        ]
      },
      { path: '*', element: &lt;NotFound /&gt; }
    ]
  }
]);
// REMEMBER: a client side guard is user experience, not security.
// The server must check permissions on every single request.
</code></pre>
