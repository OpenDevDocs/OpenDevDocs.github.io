---
publishDate: 2026-05-01T09:00
title: JavaScript You Need Before React
slug: javascript-before-react
metadescription: The handful of JavaScript features React leans on constantly, so you can tell framework problems apart from language problems.
updateDate: 2026-09-05T09:00
author: ['bishal-biswas']
level: 1
tags: ['prerequisites', 'javascript']
course: react
---

## Why start here?

Most React confusion is actually JavaScript confusion. "Why is my list not rendering?" is usually a `map` problem. "Why does my state not update?" is usually a mutation problem.

You do not need to master JavaScript first. You do need to recognise these seven things.

## 1. Arrow functions

React code is full of them.

```javascript
const double = (n) => n * 2;
const greet = (name) => {
  return `Hello ${name}`;
};
```

A single expression returns automatically, with no braces and no `return`. That is why you see this everywhere:

```javascript
const names = users.map((user) => user.name);
```

To return an object you need extra brackets, or JavaScript reads `{` as a function body:

```javascript
const makeUser = (name) => ({ name, active: true });
```

## 2. Destructuring

Pulling values out of objects and arrays in one line.

```javascript
const user = { name: 'Asha', age: 28 };
const { name, age } = user;
console.log(name, age);
```

React props arrive as an object, so almost every component starts with destructuring:

```javascript
function Welcome(props) {
  return `Hello ${props.name}`;
}
function WelcomeBetter({ name, age = 18 }) {
  return `Hello ${name}, age ${age}`;
}
```

Array destructuring is how every hook is used:

```javascript
const [count, setCount] = useState(0);
```

That is just array destructuring. `useState` returns a two item array, and you name both items yourself.

## 3. Spread and rest

The same `...` doing two jobs.

**Spread** unpacks:

```javascript
const defaults = { theme: 'light', size: 'md' };
const props = { ...defaults, theme: 'dark' };
console.log(props);
```

Later values win, which is how you override defaults. This is also how you update state without mutating it:

```javascript
const user = { name: 'Asha', age: 28 };
const older = { ...user, age: 29 };
```

**Rest** gathers:

```javascript
function Button({ label, ...rest }) {
  return { label, rest };
}
console.log(Button({ label: 'Save', type: 'submit', disabled: true }));
```

That pattern lets a component accept its own props and pass everything else through to a real element.

## 4. Array methods

Three methods do most of the work in React.

```javascript
const numbers = [1, 2, 3, 4];
console.log(numbers.map((n) => n * 2));
console.log(numbers.filter((n) => n % 2 === 0));
console.log(numbers.reduce((sum, n) => sum + n, 0));
```

`map` is the one you will use constantly, because turning an array of data into an array of elements is the core of rendering a list.

## 5. Do not mutate

This one causes more React bugs than anything else.

```javascript
const items = ['a', 'b'];
items.push('c');
const better = [...items, 'c'];
console.log(items, better);
```

React decides whether to re-render by comparing the old value to the new one. If you change an array in place, the reference is identical, so React sees no change and skips the update.

Learn the copying versions:

```javascript
const list = [3, 1, 2];
console.log([...list, 4]);
console.log(list.filter((n) => n !== 1));
console.log(list.map((n) => (n === 1 ? 99 : n)));
console.log(list.toSorted());
console.log([...list].reverse());
```

## 6. Template literals

Backticks with `${}` inside.

```javascript
const name = 'Asha';
const count = 3;
console.log(`${name} has ${count} items`);
```

You will use these for class names all the time:

```javascript
const isActive = true;
const className = `btn ${isActive ? 'btn-active' : ''}`;
console.log(className);
```

## 7. Truthy, falsy and short circuits

React renders based on these constantly.

```javascript
const items = [];
console.log(items.length > 0 && 'has items');
console.log(items.length && 'has items');
```

The second one prints `0`, and React would render a stray `0` on the page. Always compare explicitly:

```javascript
console.log(items.length > 0 && 'has items');
```

`??` gives a default only for `null` and `undefined`, which is usually what you want:

```javascript
const count = 0;
console.log(count || 10);
console.log(count ?? 10);
```

## Modules

React code is split across files.

```javascript
export default function Button() {}
export function Icon() {}
```

```javascript
import Button from './Button.js';
import { Icon } from './Icon.js';
```

A default export is imported without braces and you can name it anything. Named exports need braces and the exact name.

## Optional chaining

```javascript
const user = { profile: null };
console.log(user.profile?.name);
console.log(user.profile?.name ?? 'Unknown');
```

Data often arrives late in React, so `?.` saves you from crashing on the first render when something is still `undefined`.

## Quick recap

- Arrow functions return automatically when the body is one expression.
- Destructuring is how props and hooks are read.
- Spread copies and overrides, rest gathers the leftovers.
- `map` turns data into elements, `filter` selects, `reduce` summarises.
- Never mutate. Always produce a new array or object.
- Use `length > 0 &&` rather than `length &&`, or React renders a `0`.
- `?.` and `??` protect you while data is still loading.

<code id="code-content" class="language-javascript">
// Destructuring: how props and hooks are read
const user = { name: 'Asha', age: 28, city: 'Pune' };
const { name, age, country = 'India' } = user;
console.log(name, age, country);
// Array destructuring is all useState really is
const pair = [0, function setter() {}];
const [count, setCount] = pair;
console.log(count);
// Spread to copy and override, never mutate
const defaults = { theme: 'light', size: 'md' };
const props = { ...defaults, theme: 'dark' };
console.log(props);
const older = { ...user, age: 29 };
console.log(user.age, older.age);   // 28 29, the original is untouched
// Rest gathers whatever is left over
function Button({ label, ...rest }) {
  return { label: label, passedThrough: rest };
}
console.log(Button({ label: 'Save', type: 'submit', disabled: true }));
// map turns data into something else. This is how lists render
const users = [{ id: 1, name: 'Asha' }, { id: 2, name: 'Ben' }];
console.log(users.map((u) =&gt; u.name));
// Copying array updates, the ones React needs
const list = [3, 1, 2];
console.log([...list, 4]);                        // add
console.log(list.filter((n) =&gt; n !== 1));         // remove
console.log(list.map((n) =&gt; (n === 1 ? 99 : n))); // update one
// The stray zero trap: use an explicit comparison
const items = [];
console.log(items.length &amp;&amp; 'has items');      // 0, React would render it
console.log(items.length &gt; 0 &amp;&amp; 'has items');  // false, renders nothing
// ?? only steps in for null and undefined, so a real 0 survives
console.log(0 || 10);   // 10, usually wrong
console.log(0 ?? 10);   // 0, usually right
// Optional chaining keeps the first render alive while data loads
const pending = { profile: null };
console.log(pending.profile?.name ?? 'Loading...');
</code></pre>
