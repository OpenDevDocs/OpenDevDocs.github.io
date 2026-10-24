---
publishDate: 2026-03-23T09:38
title: Design Patterns in JavaScript
slug: design-patterns-in-javascript
metadescription: Learn the reusable solutions that show up again and again, including module, factory, singleton, observer and strategy.
updateDate: 2026-09-05T09:38
author: ['bishal-biswas']
level: 3
tags: ['patterns', 'architecture']
course: javascript
---

## What is a design pattern?

A design pattern is a proven shape for solving a problem that keeps coming up. It is not a library you install, it is a way of arranging code.

Patterns give you two things: solutions that have already been tested by thousands of people, and shared vocabulary. Saying "let us use an observer here" is faster than describing the whole idea.

> **A warning first:** patterns are tools, not goals. Applying a pattern where a plain function would do makes code harder to read, not easier.

## Module pattern

Private state with a public interface. In modern code, ES modules give you this for free.

```javascript
const Counter = (function () {
  let count = 0;
  function validate(n) {
    return typeof n === 'number' && n > 0;
  }
  return {
    increment(by = 1) {
      if (!validate(by)) throw new RangeError('Must be a positive number');
      count += by;
      return count;
    },
    getCount() {
      return count;
    }
  };
})();
Counter.increment(5);
console.log(Counter.getCount());
console.log(Counter.count);
```

## Factory pattern

A function that decides which object to build.

```javascript
function createNotification(type, message) {
  const base = {
    message,
    show() {
      console.log(`[${this.icon}] ${this.message}`);
    }
  };
  const types = {
    success: { icon: 'OK', colour: 'green' },
    error: { icon: 'X', colour: 'red' },
    warning: { icon: '!', colour: 'orange' }
  };
  return { ...base, ...(types[type] || types.success) };
}
createNotification('error', 'Could not save').show();
createNotification('success', 'Saved').show();
```

The caller says what it wants, not how to build it. Adding a new type means one entry, not a new `if`.

## Singleton pattern

One shared instance for the whole application.

```javascript
class Config {
  static #instance;
  #settings = {};
  constructor() {
    if (Config.#instance) {
      return Config.#instance;
    }
    Config.#instance = this;
  }
  set(key, value) {
    this.#settings[key] = value;
    return this;
  }
  get(key) {
    return this.#settings[key];
  }
}
const a = new Config();
const b = new Config();
a.set('apiUrl', 'https://api.example.com');
console.log(b.get('apiUrl'));
console.log(a === b);
```

In practice, an exported object from a module is simpler and does the same job, because modules are already singletons.

> Singletons are global state in disguise. They make testing harder, so use them sparingly.

## Observer pattern

One object announces, many listen. This is exactly how DOM events work.

```javascript
class EventBus {
  #listeners = {};
  on(event, callback) {
    this.#listeners[event] = this.#listeners[event] || [];
    this.#listeners[event].push(callback);
    return () => this.off(event, callback);
  }
  off(event, callback) {
    this.#listeners[event] = (this.#listeners[event] || [])
      .filter(fn => fn !== callback);
  }
  emit(event, data) {
    (this.#listeners[event] || []).forEach(fn => fn(data));
  }
}
const bus = new EventBus();
const unsubscribe = bus.on('user:login', user => console.log('Welcome', user.name));
bus.on('user:login', user => console.log('Logging visit for', user.name));
bus.emit('user:login', { name: 'Asha' });
unsubscribe();
bus.emit('user:login', { name: 'Ben' });
```

`on` returns a function that unsubscribes, which is a small touch that prevents a lot of memory leaks.

## Strategy pattern

Swap an algorithm at runtime instead of writing a long `if` chain.

```javascript
const shipping = {
  standard: (weight) => weight * 5,
  express: (weight) => weight * 12,
  free: () => 0
};
function calculateShipping(method, weight) {
  const strategy = shipping[method];
  if (!strategy) throw new Error('Unknown shipping method: ' + method);
  return strategy(weight);
}
console.log(calculateShipping('standard', 3));
console.log(calculateShipping('express', 3));
```

Adding a new method means adding one entry. Nothing else changes.

## Decorator pattern

Wrap a function to add behaviour without touching the original.

```javascript
function withLogging(fn, name) {
  return function (...args) {
    console.log(`Calling ${name} with`, args);
    const result = fn(...args);
    console.log(`${name} returned`, result);
    return result;
  };
}
function withTiming(fn, name) {
  return function (...args) {
    const start = performance.now();
    const result = fn(...args);
    console.log(`${name} took ${(performance.now() - start).toFixed(2)}ms`);
    return result;
  };
}
const add = (a, b) => a + b;
const decorated = withTiming(withLogging(add, 'add'), 'add');
decorated(2, 3);
```

Each wrapper does one thing, and you can stack them.

## Builder pattern

For objects with many optional parts.

```javascript
class QueryBuilder {
  #parts = { table: '', where: [], order: '', limit: null };
  from(table) { this.#parts.table = table; return this; }
  where(condition) { this.#parts.where.push(condition); return this; }
  orderBy(column) { this.#parts.order = column; return this; }
  limit(n) { this.#parts.limit = n; return this; }
  build() {
    let sql = `SELECT * FROM ${this.#parts.table}`;
    if (this.#parts.where.length) sql += ` WHERE ${this.#parts.where.join(' AND ')}`;
    if (this.#parts.order) sql += ` ORDER BY ${this.#parts.order}`;
    if (this.#parts.limit) sql += ` LIMIT ${this.#parts.limit}`;
    return sql;
  }
}
const query = new QueryBuilder()
  .from('users')
  .where('age > 18')
  .where("city = 'Pune'")
  .orderBy('name')
  .limit(10)
  .build();
console.log(query);
```

Returning `this` from each method is what makes chaining work.

## When not to use a pattern

```javascript
class StringReverserFactory {
  createReverser() {
    return { reverse: (s) => s.split('').reverse().join('') };
  }
}
const reverse = (s) => s.split('').reverse().join('');
```

Both do the same thing. The second is better. Reach for a pattern when the problem has actually appeared, not in anticipation of it.

## Quick recap

- Patterns are shared solutions and shared vocabulary, not rules.
- Module gives private state, and ES modules already do this.
- Factory decides what to build, strategy decides how to behave.
- Observer lets many parts react to one event without being coupled.
- Decorator adds behaviour by wrapping rather than editing.
- Builder handles objects with many optional parts, using `return this`.
- Do not apply a pattern until the problem is real.

<code id="code-content" class="language-javascript">
// Factory: the caller says what it wants, not how to build it
function createNotification(type, message) {
  const types = {
    success: { icon: 'OK', colour: 'green' },
    error:   { icon: 'X',  colour: 'red' },
    warning: { icon: '!',  colour: 'orange' }
  };
  return {
    message: message,
    ...(types[type] || types.success),
    show() { console.log('[' + this.icon + '] ' + this.message); }
  };
}
createNotification('error', 'Could not save').show();
// Observer: one emitter, many listeners, loosely coupled
class EventBus {
  #listeners = {};
  on(event, callback) {
    this.#listeners[event] = this.#listeners[event] || [];
    this.#listeners[event].push(callback);
    return () =&gt; this.off(event, callback);      // return an unsubscribe
  }
  off(event, callback) {
    this.#listeners[event] = (this.#listeners[event] || [])
      .filter(fn =&gt; fn !== callback);
  }
  emit(event, data) {
    (this.#listeners[event] || []).forEach(fn =&gt; fn(data));
  }
}
const bus = new EventBus();
const stop = bus.on('login', u =&gt; console.log('Welcome', u.name));
bus.emit('login', { name: 'Asha' });
stop();
bus.emit('login', { name: 'Ben' });               // nothing listens now
// Strategy: swap the algorithm instead of a long if chain
const shipping = {
  standard: weight =&gt; weight * 5,
  express:  weight =&gt; weight * 12,
  free:     () =&gt; 0
};
function calculateShipping(method, weight) {
  const strategy = shipping[method];
  if (!strategy) throw new Error('Unknown method: ' + method);
  return strategy(weight);
}
console.log(calculateShipping('express', 3));     // 36
// Decorator: wrap a function to add behaviour
function withTiming(fn, name) {
  return function (...args) {
    const start = performance.now();
    const result = fn(...args);
    console.log(name + ' took ' + (performance.now() - start).toFixed(2) + 'ms');
    return result;
  };
}
const slowAdd = withTiming((a, b) =&gt; a + b, 'add');
console.log(slowAdd(2, 3));
// Builder: return `this` from each method so calls can chain
class QueryBuilder {
  #parts = { table: '', where: [], limit: null };
  from(t) { this.#parts.table = t; return this; }
  where(c) { this.#parts.where.push(c); return this; }
  limit(n) { this.#parts.limit = n; return this; }
  build() {
    let sql = 'SELECT * FROM ' + this.#parts.table;
    if (this.#parts.where.length) sql += ' WHERE ' + this.#parts.where.join(' AND ');
    if (this.#parts.limit) sql += ' LIMIT ' + this.#parts.limit;
    return sql;
  }
}
console.log(new QueryBuilder().from('users').where('age &gt; 18').limit(10).build());
</code></pre>
