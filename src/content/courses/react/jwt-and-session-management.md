---
publishDate: 2026-05-27T10:19
title: Sessions, JWTs and Secure Cookies
slug: jwt-and-session-management
metadescription: Compare stateful sessions with JWTs, handle refresh correctly, and store credentials so an XSS cannot steal them.
updateDate: 2026-09-05T10:19
author: ['bishal-biswas']
level: 4
tags: ['auth', 'security', 'jwt']
course: react
---

## Two approaches

**Server sessions.** The server stores session data and gives the browser an opaque id in a cookie. Every request looks the session up.

**JWTs.** The server signs a token containing the claims. The browser sends it back, and the server verifies the signature without storing anything.

## Sessions

**Advantages:** revocation is instant, since deleting the row ends the session. The cookie reveals nothing. Data can be as large as you like.

**Disadvantages:** the server holds state, so it needs shared storage such as Redis when you scale beyond one machine.

## JWTs

A JWT is three base64 parts: header, payload, signature.

```javascript
// eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMiLCJleHAiOjE3MDB9.signature
```

**Advantages:** stateless, so any server can verify it. Good for microservices and cross service auth.

**Disadvantages, and they are underrated:**

- **You cannot revoke one.** It is valid until it expires. Ban a user and their token still works.
- **The payload is readable by anyone.** Base64 is encoding, not encryption.
- **It is bigger** than a session id, on every request.

The revocation problem is why short lived access tokens plus refresh tokens exist, and that machinery is more complex than a session table.

> **The honest default:** for a normal web application with your own backend, **use server sessions**. JWTs solve a distributed systems problem most applications do not have. Reach for them when you genuinely need stateless verification across services.

## Never put secrets in a JWT

```javascript
const payload = {
  sub: user.id,
  email: user.email,
  creditCard: user.card,
  internalNotes: 'flagged for review'
};
```

Anyone holding that token can read all of it. Decoding takes one line:

```javascript
const [, payload] = token.split('.');
console.log(JSON.parse(atob(payload)));
```

Put an id, an expiry and the minimum claims you need. Nothing else.

## Storage

Covered in the auth topic, and worth repeating because it is the decision that matters most.

| | localStorage | HttpOnly cookie |
| --- | --- | --- |
| Readable by JavaScript | Yes | No |
| Survives XSS | No | Yes |
| Sent automatically | No | Yes |
| Needs CSRF protection | No | Yes |

An XSS with the token in localStorage means the attacker can act as that user from their own machine, for as long as the token lives. With an HttpOnly cookie they can make requests **from the victim's browser**, which is bad, but they cannot take the credential away with them.

```javascript
// Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800
```

- **`HttpOnly`** hides it from JavaScript.
- **`Secure`** sends it only over HTTPS.
- **`SameSite=Lax`** blocks it on cross site POSTs, which stops most CSRF.
- **`Max-Age`** sets the lifetime.

## Access and refresh tokens

The standard JWT pattern.

- A short lived **access token**, say 15 minutes.
- A long lived **refresh token**, say 30 days, stored in an HttpOnly cookie.

When the access token expires, the client exchanges the refresh token for a new one.

```javascript
let accessToken = null;
let refreshPromise = null;
async function getAccessToken() {
  if (accessToken && !isExpired(accessToken)) return accessToken;
  if (!refreshPromise) {
    refreshPromise = fetch('/api/refresh', {
      method: 'POST',
      credentials: 'include'
    })
      .then((r) => {
        if (!r.ok) throw new Error('Session expired');
        return r.json();
      })
      .then((data) => {
        accessToken = data.accessToken;
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}
export async function apiFetch(url, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` }
  });
  if (response.status === 401) {
    accessToken = null;
    window.location.href = '/login';
  }
  return response;
}
```

Two things matter here.

**The access token is in a module variable, not storage.** It disappears on refresh, which is fine because the refresh cookie gets a new one. It is never readable through storage APIs.

**`refreshPromise` deduplicates.** Without it, ten parallel requests hitting a 401 trigger ten refreshes, and with rotation nine of them fail.

## Refresh token rotation

Each refresh issues a **new** refresh token and invalidates the old one. If an old token is used again, that means it was stolen, so the server revokes the whole family and forces a re login.

This is the standard defence, and it does require server state, which somewhat undermines the "stateless" argument for JWTs.

## Do not trust the client's expiry check

```javascript
function isExpired(token) {
  const [, payload] = token.split('.');
  const { exp } = JSON.parse(atob(payload));
  return Date.now() >= exp * 1000;
}
```

This is fine as an optimisation, to avoid a pointless request. It is **not** a security check. The user's clock may be wrong, and they can edit the payload anyway, though the signature will then fail server side.

The server validates the signature and the expiry. Always.

## Idle timeout

```javascript
function useIdleTimeout(onIdle, timeout = 15 * 60 * 1000) {
  useEffect(() => {
    let timer;
    function reset() {
      clearTimeout(timer);
      timer = setTimeout(onIdle, timeout);
    }
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [onIdle, timeout]);
}
```

Client side idle timeout is a convenience for shared computers. The **server** must also expire the session, or a crafted request keeps it alive forever.

## A checklist

- HTTPS everywhere, with `Secure` on every cookie.
- `HttpOnly` and `SameSite` on session cookies.
- Short access tokens, rotated refresh tokens.
- CSRF tokens for state changing requests.
- Rate limit the login endpoint.
- Hash passwords with bcrypt or argon2, never a plain hash.
- Log out everywhere on a password change.
- Never log tokens.

## Quick recap

- Sessions are revocable and simple, JWTs are stateless and are not.
- For a normal app with your own backend, prefer sessions.
- A JWT payload is readable by anyone, so it holds no secrets.
- Tokens belong in HttpOnly, Secure, SameSite cookies.
- Keep an access token in memory, never in storage.
- Deduplicate concurrent refreshes, or rotation breaks.
- Client side expiry checks are an optimisation, not security.
- Expire sessions on the server too.

<code id="code-content" class="language-javascript">
// A JWT payload is BASE64, not encrypted. Anyone holding the token can
// read every claim in it with one line:
function decodePayload(token) {
  const [, payload] = token.split('.');
  return JSON.parse(atob(payload));
}
// So it holds an id, an expiry, and nothing else. Never an email
// address you would not publish, never internal flags, never a card.
// THE ACCESS TOKEN LIVES IN MEMORY, never in localStorage. It vanishes
// on refresh, which is fine, because the HttpOnly refresh cookie gets
// a new one. Storage APIs cannot reach it, so XSS cannot steal it.
let accessToken = null;
let refreshPromise = null;
async function getAccessToken() {
  if (accessToken &amp;&amp; !isExpired(accessToken)) return accessToken;
  // DEDUPLICATE. Without this, ten parallel 401s trigger ten refreshes,
  // and with rotation nine of them fail and log the user out.
  if (!refreshPromise) {
    refreshPromise = fetch('/api/refresh', {
      method: 'POST',
      credentials: 'include'          // sends the HttpOnly refresh cookie
    })
      .then((r) =&gt; {
        if (!r.ok) throw new Error('Session expired');
        return r.json();
      })
      .then((data) =&gt; {
        accessToken = data.accessToken;
        return accessToken;
      })
      .finally(() =&gt; { refreshPromise = null; });
  }
  return refreshPromise;
}
export async function apiFetch(url, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: 'Bearer ' + token }
  });
  if (response.status === 401) {
    accessToken = null;
    window.location.href = '/login';
  }
  return response;
}
// This is an OPTIMISATION to skip a pointless request, not a security
// check. The user's clock can be wrong and the payload can be edited.
// The SERVER validates the signature and the expiry, always.
function isExpired(token) {
  try {
    const { exp } = decodePayload(token);
    return Date.now() &gt;= exp * 1000;
  } catch {
    return true;
  }
}
// Idle timeout for shared computers. The server must expire the session
// too, or a crafted request keeps it alive forever.
function useIdleTimeout(onIdle, timeout = 15 * 60 * 1000) {
  useEffect(() =&gt; {
    let timer;
    const reset = () =&gt; {
      clearTimeout(timer);
      timer = setTimeout(onIdle, timeout);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) =&gt; window.addEventListener(e, reset));
    reset();
    return () =&gt; {
      clearTimeout(timer);
      events.forEach((e) =&gt; window.removeEventListener(e, reset));
    };
  }, [onIdle, timeout]);
}
// THE HONEST DEFAULT: for a normal web app with your own backend, use
// server SESSIONS. They revoke instantly and reveal nothing. JWTs solve
// a distributed systems problem most applications do not have.
</code></pre>
