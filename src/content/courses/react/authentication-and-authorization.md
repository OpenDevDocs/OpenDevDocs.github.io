---
publishDate: 2026-05-27T10:18
title: Authentication and Authorization Patterns
slug: authentication-and-authorization
metadescription: Structure sign in, protected routes and permission checks in React, and understand why the client side is never the security boundary.
updateDate: 2026-09-05T10:18
author: ['bishal-biswas']
level: 4
tags: ['auth', 'security', 'architecture']
course: react
---

## The one rule

**The client is never the security boundary.**

Every check you write in React is for user experience. Anyone can open DevTools, edit your state, call your API directly, or write a script that never loads your JavaScript at all.

```javascript
{user.isAdmin && <DeleteAllButton />}
```

That hides a button. It does not protect anything. The delete endpoint must check permission itself, every single time.

Hold that thought through everything below.

## Authentication versus authorization

**Authentication** is who you are. Signing in.

**Authorization** is what you may do. Permissions and roles.

They are separate concerns and often go wrong together, because people check the first and forget the second.

## Auth state

```javascript
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setUser(data);
        setStatus('ready');
      })
      .catch(() => setStatus('ready'));
  }, []);
  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: Boolean(user),
      login: async (credentials) => {
        const response = await fetch('/api/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });
        if (!response.ok) throw new Error('Invalid credentials');
        setUser(await response.json());
      },
      logout: async () => {
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
        setUser(null);
      }
    }),
    [user, status]
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
```

The `status` field matters more than it looks. Without it you cannot tell "not signed in" from "still checking", and every refresh bounces signed in users to the login page.

## Protected routes

```javascript
function RequireAuth() {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
```

Three details, all covered in the routing topic: check loading first, remember where they were going, and `replace` so Back does not return to a protected page.

## Permissions

Roles alone get rigid quickly. Permissions scale better.

```javascript
export function usePermissions() {
  const { user } = useAuth();
  return useMemo(() => {
    const permissions = new Set(user?.permissions ?? []);
    return {
      can: (permission) => permissions.has(permission),
      canAny: (list) => list.some((p) => permissions.has(p)),
      canAll: (list) => list.every((p) => permissions.has(p))
    };
  }, [user]);
}
function ArticleActions({ article }) {
  const { can } = usePermissions();
  const { user } = useAuth();
  const isOwner = article.authorId === user?.id;
  return (
    <div>
      {(can('article:edit') || isOwner) && <EditButton />}
      {can('article:delete') && <DeleteButton />}
    </div>
  );
}
```

`can('article:edit')` says what it means. `user.role === 'editor' || user.role === 'admin'` has to be updated in fifty places the first time you add a role.

A declarative wrapper reads nicely:

```javascript
function Can({ permission, fallback = null, children }) {
  const { can } = usePermissions();
  return can(permission) ? children : fallback;
}
<Can permission="article:delete">
  <DeleteButton />
</Can>
```

## Where tokens live

This question comes up constantly, and the answer is clear.

**In localStorage:** readable by any script on the page. One XSS and the attacker has the token, and can use it from anywhere until it expires.

**In an HttpOnly cookie:** invisible to JavaScript entirely. XSS cannot read it.

So tokens belong in **HttpOnly, Secure, SameSite cookies set by the server**.

```javascript
localStorage.setItem('token', jwt);
```

```javascript
// Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax; Path=/
```

Your React code then sends nothing manually:

```javascript
fetch('/api/me', { credentials: 'include' });
```

The trade off is that cookies need CSRF protection, since browsers attach them automatically. `SameSite=Lax` handles most of it, and a CSRF token covers the rest.

If you truly cannot use cookies, for example with a third party API on another domain, keep the access token **in memory only**, never in storage, and use a refresh token in an HttpOnly cookie.

## Handling expiry

```javascript
async function apiFetch(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'include' });
  if (response.status === 401) {
    const refreshed = await fetch('/api/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    if (refreshed.ok) {
      return fetch(url, { ...options, credentials: 'include' });
    }
    window.location.href = '/login';
    return response;
  }
  return response;
}
```

One place handles expiry, so no component needs to think about it. In production you also want to deduplicate concurrent refreshes, or ten parallel requests trigger ten refreshes.

## Signing out everywhere

```javascript
useEffect(() => {
  function handleStorage(event) {
    if (event.key === 'logout') {
      setUser(null);
    }
  }
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}, []);
async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  setUser(null);
  localStorage.setItem('logout', Date.now().toString());
}
```

The `storage` event fires in **other** tabs, so signing out in one signs out everywhere.

## Use a provider

Rolling your own auth means handling password hashing, reset flows, email verification, rate limiting, session rotation, MFA and breach response. That is a product, not a feature.

Auth0, Clerk, Supabase Auth, WorkOS and NextAuth all exist. Unless auth is your product, use one.

## Quick recap

- Client side checks are user experience, never security.
- Distinguish "loading" from "signed out", or refreshes bounce users.
- Guard routes with a wrapper, remembering where they were going.
- Prefer permissions over hard coded roles.
- Tokens belong in HttpOnly cookies, never localStorage.
- Cookies need CSRF protection, and `SameSite` covers most of it.
- Handle 401 and refresh in one wrapper.
- Use an auth provider unless auth is your product.

<code id="code-content" class="language-javascript">
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
// THE ONE RULE: the client is never the security boundary. Every check
// below is for user experience. The SERVER must check again, every time.
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'loading' vs 'ready' matters enormously. Without it you cannot tell
  // "not signed in" from "still checking", and every refresh bounces
  // signed in users to the login page.
  const [status, setStatus] = useState('loading');
  useEffect(() =&gt; {
    // credentials: 'include' sends the HttpOnly cookie. Your code never
    // touches the token itself.
    fetch('/api/me', { credentials: 'include' })
      .then((r) =&gt; (r.ok ? r.json() : null))
      .then((data) =&gt; { setUser(data); setStatus('ready'); })
      .catch(() =&gt; setStatus('ready'));
  }, []);
  // Sign out in one tab signs out in all of them
  useEffect(() =&gt; {
    function onStorage(event) {
      if (event.key === 'logout') setUser(null);
    }
    window.addEventListener('storage', onStorage);
    return () =&gt; window.removeEventListener('storage', onStorage);
  }, []);
  const value = useMemo(() =&gt; ({
    user,
    status,
    isAuthenticated: Boolean(user),
    async logout() {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      localStorage.setItem('logout', String(Date.now()));
    }
  }), [user, status]);
  return &lt;AuthContext value={value}&gt;{children}&lt;/AuthContext&gt;;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
// PERMISSIONS scale better than hard coded roles. can('article:edit')
// says what it means, and adding a role does not touch fifty files.
export function usePermissions() {
  const { user } = useAuth();
  return useMemo(() =&gt; {
    const granted = new Set(user?.permissions ?? []);
    return { can: (p) =&gt; granted.has(p) };
  }, [user]);
}
export function Can({ permission, fallback = null, children }) {
  const { can } = usePermissions();
  return can(permission) ? children : fallback;
}
// One wrapper handles expiry, so no component thinks about it
export async function apiFetch(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'include' });
  if (response.status === 401) {
    const refreshed = await fetch('/api/refresh', {
      method: 'POST', credentials: 'include'
    });
    if (refreshed.ok) return fetch(url, { ...options, credentials: 'include' });
    window.location.href = '/login';
  }
  return response;
}
// TOKENS: an HttpOnly cookie is invisible to JavaScript, so XSS cannot
// steal it. localStorage is readable by any script on the page.
//   localStorage.setItem('token', jwt);                     wrong
//   Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax  right
</code></pre>
