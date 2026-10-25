---
publishDate: 2026-03-26T09:43
title: Proxy and Reflect
slug: proxy-and-reflect
metadescription: Intercept reads, writes and deletes on any object to add validation, logging, defaults and reactivity.
updateDate: 2026-09-05T09:43
author: ['bishal-biswas']
level: 3
tags: ['proxy', 'metaprogramming', 'es6']
course: javascript
---

## What is a Proxy?

A Proxy wraps an object and lets you intercept the basic operations on it: reading a property, writing one, deleting one, and more.

```javascript
const target = { name: 'Asha', age: 28 };
const handler = {
  get(obj, property) {
    console.log('Reading', property);
    return obj[property];
  }
};
const proxy = new Proxy(target, handler);
console.log(proxy.name);
console.log(proxy.age);
```

Every read goes through your `get` function first. The original object is untouched.

## The common traps

A "trap" is a handler method that intercepts one operation.

```javascript
const handler = {
  get(target, property, receiver) {},
  set(target, property, value, receiver) {},
  has(target, property) {},
  deleteProperty(target, property) {},
  ownKeys(target) {},
  apply(target, thisArg, args) {},
  construct(target, args) {}
};
```

`get`, `set` and `has` cover most real uses.

## Validation

```javascript
function createValidatedUser() {
  return new Proxy({}, {
    set(target, property, value) {
      if (property === 'age') {
        if (typeof value !== 'number') {
          throw new TypeError('Age must be a number');
        }
        if (value < 0 || value > 150) {
          throw new RangeError('Age must be between 0 and 150');
        }
      }
      if (property === 'email' && !String(value).includes('@')) {
        throw new Error('Invalid email');
      }
      target[property] = value;
      return true;
    }
  });
}
const user = createValidatedUser();
user.age = 28;
console.log(user.age);
try {
  user.age = -5;
} catch (error) {
  console.log(error.message);
}
```

The `set` trap **must return `true`** on success. Returning a falsy value throws a `TypeError` in strict mode.

## Default values

```javascript
const withDefault = (obj, fallback) => new Proxy(obj, {
  get(target, property) {
    return property in target ? target[property] : fallback;
  }
});
const scores = withDefault({ maths: 90 }, 0);
console.log(scores.maths);
console.log(scores.physics);
```

## Catching typos

```javascript
const strict = (obj) => new Proxy(obj, {
  get(target, property) {
    if (typeof property === 'string' && !(property in target)) {
      throw new ReferenceError(`Property "${property}" does not exist`);
    }
    return target[property];
  }
});
const config = strict({ apiUrl: 'https://api.example.com', timeout: 5000 });
console.log(config.apiUrl);
try {
  console.log(config.apiURL);
} catch (error) {
  console.log(error.message);
}
```

Instead of silently getting `undefined` and debugging for an hour, you get told immediately.

## Hiding private fields

```javascript
const hidePrivate = (obj) => new Proxy(obj, {
  get(target, property) {
    if (String(property).startsWith('_')) {
      throw new Error('Private property');
    }
    return target[property];
  },
  has(target, property) {
    return String(property).startsWith('_') ? false : property in target;
  },
  ownKeys(target) {
    return Reflect.ownKeys(target).filter(k => !String(k).startsWith('_'));
  }
});
const account = hidePrivate({ name: 'Asha', _token: 'secret' });
console.log(account.name);
console.log('_token' in account);
console.log(Object.keys(account));
```

## Reflect

`Reflect` is a plain object of functions matching every proxy trap. It gives you the **default** behaviour of each operation.

```javascript
const obj = { a: 1 };
console.log(Reflect.get(obj, 'a'));
Reflect.set(obj, 'b', 2);
console.log(Reflect.has(obj, 'b'));
Reflect.deleteProperty(obj, 'a');
console.log(Reflect.ownKeys(obj));
```

Using it inside a proxy is the correct habit:

```javascript
const proxy = new Proxy({ a: 1 }, {
  get(target, property, receiver) {
    console.log('Reading', property);
    return Reflect.get(target, property, receiver);
  },
  set(target, property, value, receiver) {
    console.log('Writing', property);
    return Reflect.set(target, property, value, receiver);
  }
});
proxy.a;
proxy.b = 2;
```

Two reasons to prefer `Reflect.get(target, property, receiver)` over `target[property]`:

1. It passes `receiver`, so getters and inheritance behave correctly.
2. `Reflect.set` already returns the boolean the trap needs.

## Simple reactivity

This is roughly how frameworks like Vue track changes.

```javascript
function reactive(obj, onChange) {
  return new Proxy(obj, {
    set(target, property, value, receiver) {
      const old = target[property];
      const result = Reflect.set(target, property, value, receiver);
      if (old !== value) {
        onChange(property, old, value);
      }
      return result;
    },
    deleteProperty(target, property) {
      const result = Reflect.deleteProperty(target, property);
      onChange(property, 'existed', undefined);
      return result;
    }
  });
}
const state = reactive({ count: 0 }, (key, oldValue, newValue) => {
  console.log(`${key}: ${oldValue} -> ${newValue}`);
});
state.count = 1;
state.count = 2;
state.name = 'Asha';
```

## Wrapping functions

```javascript
function withLogging(fn) {
  return new Proxy(fn, {
    apply(target, thisArg, args) {
      console.log(`Calling ${target.name} with`, args);
      const result = Reflect.apply(target, thisArg, args);
      console.log('Returned', result);
      return result;
    }
  });
}
const add = withLogging(function add(a, b) {
  return a + b;
});
add(2, 3);
```

## Costs and limits

- **Slower.** Every intercepted operation runs your JavaScript. Do not proxy something in a hot loop.
- **Not perfectly transparent.** Proxies cannot intercept private `#` fields, and internal slots on built ins like `Map` or `Date` need extra care.
- **Harder to debug.** A stack trace through a proxy is less obvious.

Use a proxy when the alternative is worse: framework reactivity, developer facing validation, mocking in tests, or API clients that build URLs from property names.

## Quick recap

- A Proxy intercepts operations on a target object using traps.
- `get`, `set`, `has` and `deleteProperty` cover most needs.
- The `set` trap must return `true` on success.
- `Reflect` provides the default behaviour for every trap.
- Prefer `Reflect.get(target, prop, receiver)` so getters and inheritance work.
- Great for validation, defaults, typo detection and reactivity.
- They cost performance, so keep them out of hot paths.

<code id="code-content" class="language-javascript">
// A Proxy intercepts operations on a target object
const user = new Proxy({}, {
  set(target, property, value) {
    if (property === 'age') {
      if (typeof value !== 'number') throw new TypeError('Age must be a number');
      if (value &lt; 0 || value &gt; 150) throw new RangeError('Age out of range');
    }
    target[property] = value;
    return true;                       // set must return true on success
  }
});
user.age = 28;
console.log(user.age);
try { user.age = -5; } catch (e) { console.log(e.message); }
// Default values for anything missing
const withDefault = (obj, fallback) =&gt; new Proxy(obj, {
  get(target, property) {
    return property in target ? target[property] : fallback;
  }
});
const scores = withDefault({ maths: 90 }, 0);
console.log(scores.maths, scores.physics);   // 90 0
// Catch typos instead of silently getting undefined
const strict = obj =&gt; new Proxy(obj, {
  get(target, property) {
    if (typeof property === 'string' &amp;&amp; !(property in target)) {
      throw new ReferenceError('No such property: ' + property);
    }
    return target[property];
  }
});
const config = strict({ apiUrl: 'https://api.example.com' });
console.log(config.apiUrl);
try { config.apiURL; } catch (e) { console.log(e.message); }
// Reflect gives the default behaviour, and passes receiver correctly
const logged = new Proxy({ a: 1 }, {
  get(target, property, receiver) {
    console.log('Reading', property);
    return Reflect.get(target, property, receiver);
  },
  set(target, property, value, receiver) {
    console.log('Writing', property);
    return Reflect.set(target, property, value, receiver);
  }
});
logged.a;
logged.b = 2;
// Simple reactivity, roughly how frameworks track state changes
function reactive(obj, onChange) {
  return new Proxy(obj, {
    set(target, property, value, receiver) {
      const old = target[property];
      const result = Reflect.set(target, property, value, receiver);
      if (old !== value) onChange(property, old, value);
      return result;
    }
  });
}
const state = reactive({ count: 0 }, (key, from, to) =&gt;
  console.log(key + ': ' + from + ' -&gt; ' + to));
state.count = 1;
state.count = 2;
// The apply trap wraps function calls
const add = new Proxy((a, b) =&gt; a + b, {
  apply(target, thisArg, args) {
    console.log('Called with', args);
    return Reflect.apply(target, thisArg, args);
  }
});
console.log(add(2, 3));
</code></pre>
