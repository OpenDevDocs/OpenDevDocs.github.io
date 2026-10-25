---
publishDate: 2026-03-22T09:37
title: Browser Storage (Cookies, Session Storage)
slug: browser-storage-cookies-session-storage
metadescription: Compare cookies, sessionStorage, localStorage and IndexedDB, and learn which one to reach for in each situation.
updateDate: 2026-09-05T09:37
author: ['bishal-biswas']
level: 2
tags: ['storage', 'browser', 'cookies']
course: javascript
---

## Four places to keep data

| Option | Size | Survives | Sent to server |
| --- | --- | --- | --- |
| Cookies | About 4 KB | Until expiry | Yes, every request |
| localStorage | 5 to 10 MB | Forever | No |
| sessionStorage | 5 to 10 MB | Until the tab closes | No |
| IndexedDB | Hundreds of MB | Forever | No |

Picking the right one is mostly about how long the data should live and whether the server needs it.

## sessionStorage

The same API as localStorage, with one difference: it is wiped when the tab closes.

```javascript
sessionStorage.setItem('step', '2');
console.log(sessionStorage.getItem('step'));
sessionStorage.removeItem('step');
sessionStorage.clear();
```

Each tab has its own separate storage, even for the same site. Open your page in two tabs and they will not see each other's data.

That makes it perfect for:

- Progress through a multi step form.
- A scroll position or open accordion.
- Anything that should not linger after the visit.

```javascript
const form = document.querySelector('#signup');
form?.addEventListener('input', () => {
  const data = Object.fromEntries(new FormData(form));
  sessionStorage.setItem('draft', JSON.stringify(data));
});
const draft = sessionStorage.getItem('draft');
if (draft) {
  console.log('Restoring draft:', JSON.parse(draft));
}
```

## localStorage

Covered in the JSON topic, so a short reminder:

```javascript
localStorage.setItem('theme', 'dark');
console.log(localStorage.getItem('theme'));
```

It survives closing the browser and is shared across every tab for that site.

### Reacting to other tabs

```javascript
window.addEventListener('storage', (event) => {
  console.log('Key changed:', event.key);
  console.log('Old value:', event.oldValue);
  console.log('New value:', event.newValue);
});
```

The `storage` event fires in **other** tabs, not the one that made the change. This is a simple way to sync a dark mode toggle or a logout across tabs.

## Cookies

Cookies are the oldest option and the only one the browser sends to the server automatically.

```javascript
document.cookie = 'username=asha';
document.cookie = 'theme=dark';
console.log(document.cookie);
```

The API is awkward. `document.cookie` looks like a string but assigning to it **adds** one cookie rather than replacing everything.

### Attributes

```javascript
document.cookie = 'username=asha; max-age=604800; path=/; SameSite=Lax; Secure';
```

- `max-age` is seconds until expiry. Without it the cookie dies with the session.
- `expires` is an alternative that takes a date.
- `path=/` makes it available site wide.
- `SameSite=Lax` or `Strict` protects against CSRF.
- `Secure` sends it only over HTTPS.

### Reading one

```javascript
function getCookie(name) {
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}
console.log(getCookie('username'));
```

### Deleting one

```javascript
document.cookie = 'username=; max-age=0; path=/';
```

Set it to expire in the past. The `path` must match the one used when it was created.

### Escaping values

```javascript
function setCookie(name, value, days = 7) {
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; max-age=${days * 86400}; path=/; SameSite=Lax`;
}
setCookie('message', 'hello; world=1');
console.log(getCookie('message'));
```

Cookie values cannot contain semicolons or commas, so always encode.

### HttpOnly cookies

The most important cookies are the ones you **cannot** touch.

```javascript
// Set by the server:
// Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict
```

`HttpOnly` hides the cookie from JavaScript entirely. That is the point: if an attacker injects a script, it still cannot steal the session. This is why login tokens belong in HttpOnly cookies rather than localStorage.

## IndexedDB

A real database in the browser, for large or structured data. The raw API is verbose and callback based, so most people use a small wrapper library.

```javascript
const request = indexedDB.open('myDatabase', 1);
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  db.createObjectStore('users', { keyPath: 'id' });
};
request.onsuccess = (event) => {
  const db = event.target.result;
  const tx = db.transaction('users', 'readwrite');
  tx.objectStore('users').add({ id: 1, name: 'Asha' });
};
```

Reach for it when you need offline data, big files, or proper querying. For a handful of settings it is overkill.

## Choosing

- **Login token or anything the server needs**: an HttpOnly cookie, set by the server.
- **A small preference that should persist**: localStorage.
- **Something only for this visit**: sessionStorage.
- **Large or offline data**: IndexedDB.

## Security rules

- **Never store passwords, tokens or personal data** in localStorage, sessionStorage, or a readable cookie. Any injected script can read all three.
- **Never trust stored data.** A user can edit it freely with DevTools, so validate on the server.
- **Do not put a role in storage.** Storing `isAdmin: true` client side is not security, it is a suggestion.
- **Handle failure.** Private browsing and full quotas make storage throw, so wrap writes in try-catch.

```javascript
function canUseStorage() {
  try {
    const key = '__test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
console.log('Storage available:', canUseStorage());
```

## Quick recap

- Cookies are small, go to the server on every request, and are the right home for sessions.
- localStorage persists forever, sessionStorage dies with the tab.
- The `storage` event lets tabs react to each other.
- Cookie values need encoding, and deleting means expiring in the past.
- `HttpOnly` cookies are invisible to JavaScript, which is exactly why tokens belong there.
- IndexedDB handles large structured data.
- Never store secrets client side, and never trust what comes back out.

<code id="code-content" class="language-javascript">
// sessionStorage: cleared when the tab closes, private to that tab
sessionStorage.setItem('step', '2');
console.log('Current step:', sessionStorage.getItem('step'));
// Saving a form draft for this visit only
const form = document.querySelector('#signup');
form?.addEventListener('input', function () {
  const data = Object.fromEntries(new FormData(form));
  sessionStorage.setItem('draft', JSON.stringify(data));
});
// localStorage: survives closing the browser, shared across tabs
localStorage.setItem('theme', 'dark');
console.log('Theme:', localStorage.getItem('theme'));
// Other tabs are told when localStorage changes
window.addEventListener('storage', function (event) {
  console.log('Another tab changed', event.key, 'to', event.newValue);
});
// Cookies: assigning adds one, it does not replace them all
function setCookie(name, value, days = 7) {
  const encoded = encodeURIComponent(value);
  document.cookie = name + '=' + encoded +
    '; max-age=' + (days * 86400) + '; path=/; SameSite=Lax';
}
function getCookie(name) {
  const match = document.cookie
    .split('; ')
    .find(row =&gt; row.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}
function deleteCookie(name) {
  document.cookie = name + '=; max-age=0; path=/';   // expire in the past
}
setCookie('username', 'asha');
console.log('Cookie:', getCookie('username'));
deleteCookie('username');
// Session tokens belong in an HttpOnly cookie set by the server,
// which JavaScript cannot read at all:
// Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict
// Storage can throw in private browsing or when the quota is full
function canUseStorage() {
  try {
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
    return true;
  } catch {
    return false;
  }
}
console.log('Storage available:', canUseStorage());
</code></pre>
