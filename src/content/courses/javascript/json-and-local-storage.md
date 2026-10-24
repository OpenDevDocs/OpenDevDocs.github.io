---
publishDate: 2026-03-17T09:28
title: JSON and Local Storage
slug: json-and-local-storage
metadescription: Convert data to text with JSON and save it in the browser so it survives a page refresh.
updateDate: 2026-09-05T09:28
author: ['bishal-biswas']
level: 2
tags: ['json', 'storage', 'browser']
course: javascript
---

## What is JSON?

JSON stands for JavaScript Object Notation. It is a text format for data, and it is what almost every API on the internet speaks.

```javascript
// A JavaScript object
const user = { name: 'Asha', age: 28, active: true };
// The same thing as JSON text
// {"name":"Asha","age":28,"active":true}
```

It looks like a JavaScript object, but it is a **string**. That is the key difference.

## JSON rules

JSON is stricter than JavaScript:

- Keys must be in **double quotes**.
- Strings must use **double quotes**, never single.
- No trailing commas.
- No comments.
- No functions, no `undefined`, no dates.

```javascript
// Valid JSON
// { "name": "Asha", "tags": ["a", "b"], "age": 28, "active": true, "note": null }
// Invalid JSON
// { name: 'Asha', }
```

## `JSON.stringify`

Turns a JavaScript value into a JSON string.

```javascript
const user = { name: 'Asha', age: 28, active: true };
const text = JSON.stringify(user);
console.log(text);
console.log(typeof text);
```

### Pretty printing

```javascript
console.log(JSON.stringify(user, null, 2));
```

The third argument is how many spaces to indent by. Useful for logs and files, wasteful for network requests.

### What gets dropped

```javascript
const messy = {
  name: 'Asha',
  greet: function () { return 'hi'; },
  nothing: undefined,
  when: new Date(),
  ok: true
};
console.log(JSON.stringify(messy));
```

Functions and `undefined` vanish silently. Dates become strings, and they do **not** turn back into dates automatically.

### Picking fields

```javascript
const user = { name: 'Asha', age: 28, password: 'secret' };
console.log(JSON.stringify(user, ['name', 'age']));
```

## `JSON.parse`

Turns JSON text back into a JavaScript value.

```javascript
const text = '{"name":"Asha","age":28}';
const user = JSON.parse(text);
console.log(user.name, user.age);
console.log(typeof user);
```

### Always wrap it in try-catch

```javascript
function safeParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('Invalid JSON:', error.message);
    return fallback;
  }
}
console.log(safeParse('{"a":1}'));
console.log(safeParse('not json', {}));
```

Bad JSON throws a `SyntaxError`, and that will break your page if you do not catch it.

## Deep copying with JSON

A quick trick you will see often:

```javascript
const original = { name: 'Asha', address: { city: 'Pune' } };
const copy = JSON.parse(JSON.stringify(original));
copy.address.city = 'Delhi';
console.log(original.address.city);
```

It works, but it loses functions, dates and `undefined`. Modern code should use `structuredClone`:

```javascript
const copy = structuredClone(original);
```

## localStorage

The browser gives every site a small key value store that survives refreshes and even closing the browser.

```javascript
localStorage.setItem('username', 'asha');
console.log(localStorage.getItem('username'));
localStorage.removeItem('username');
localStorage.clear();
```

### It only stores strings

```javascript
localStorage.setItem('age', 28);
const age = localStorage.getItem('age');
console.log(age, typeof age);
```

You get back `'28'` as text. For objects you must convert:

```javascript
const settings = { theme: 'dark', fontSize: 16 };
localStorage.setItem('settings', JSON.stringify(settings));
const saved = JSON.parse(localStorage.getItem('settings'));
console.log(saved.theme);
```

This is why JSON and localStorage are taught together.

### Missing keys give null

```javascript
const value = localStorage.getItem('doesNotExist');
console.log(value);
console.log(JSON.parse(value));
```

`JSON.parse(null)` gives `null` rather than throwing, but a missing key with a partially written value will throw. Always guard:

```javascript
function loadSettings() {
  try {
    const raw = localStorage.getItem('settings');
    return raw ? JSON.parse(raw) : { theme: 'light' };
  } catch {
    return { theme: 'light' };
  }
}
console.log(loadSettings());
```

## A small storage helper

```javascript
const storage = {
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Could not save:', error.message);
      return false;
    }
  },
  load(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};
storage.save('cart', [{ name: 'Pen', qty: 2 }]);
console.log(storage.load('cart', []));
```

## Limits and warnings

- **About 5 to 10 MB** per site. Exceeding it throws a `QuotaExceededError`, which is why the helper above uses try-catch.
- **Synchronous.** Reading a large value blocks the page, so keep stored data small.
- **Never store secrets.** Any script on your page can read localStorage, so no tokens, passwords or personal data.
- **Private browsing** may block it entirely, so always have a fallback.

## Quick recap

- JSON is text, not an object, and its rules are stricter than JavaScript.
- `JSON.stringify` converts to text, `JSON.parse` converts back.
- Functions and `undefined` are dropped, dates become plain strings.
- Always wrap `JSON.parse` in try-catch.
- `localStorage` stores strings only, so stringify objects before saving.
- A missing key returns `null`.
- Keep stored data small and never store anything secret.

<code id="code-content" class="language-javascript">
// JSON.stringify turns data into text
const user = { name: 'Asha', age: 28, active: true };
const text = JSON.stringify(user);
console.log(text, typeof text);           // {"name":"Asha",...} string
console.log(JSON.stringify(user, null, 2)); // pretty printed
// Functions, undefined and dates do not survive the trip
const messy = { name: 'Asha', greet() {}, nothing: undefined, when: new Date() };
console.log(JSON.stringify(messy));       // greet and nothing are gone
// JSON.parse turns text back into data, but it can throw
function safeParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('Invalid JSON:', error.message);
    return fallback;
  }
}
console.log(safeParse('{"a":1}'));
console.log(safeParse('not json', {}));
// localStorage only stores strings
localStorage.setItem('age', 28);
console.log(typeof localStorage.getItem('age'));  // 'string'
// So objects must be converted both ways
const settings = { theme: 'dark', fontSize: 16 };
localStorage.setItem('settings', JSON.stringify(settings));
console.log(JSON.parse(localStorage.getItem('settings')).theme); // dark
// A safe helper that handles missing keys and quota errors
const storage = {
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Could not save:', error.message);
      return false;
    }
  },
  load(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  remove(key) { localStorage.removeItem(key); }
};
storage.save('cart', [{ name: 'Pen', qty: 2 }]);
console.log(storage.load('cart', []));
console.log(storage.load('missing-key', 'default value'));
</code></pre>
