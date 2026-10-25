---
publishDate: 2026-03-10T09:17
title: Console and Debugging
slug: console-and-debugging
metadescription: Find and fix bugs faster using the console methods, breakpoints, the debugger statement and a calm reading of error messages.
updateDate: 2026-09-05T09:17
author: ['bishal-biswas']
level: 1
tags: ['basics', 'debugging', 'tools']
course: javascript
---

## Debugging is normal

Every programmer writes bugs. The difference between a beginner and an experienced developer is not fewer bugs, it is finding them faster.

## Beyond `console.log`

```javascript
console.log('A normal message');
console.info('Extra information');
console.warn('Something looks wrong');
console.error('Something broke');
```

Warnings and errors show with an icon and a stack trace, which makes them stand out in a busy console.

### Label your logs

```javascript
const user = { name: 'Asha', age: 30 };
console.log(user);
console.log('user:', user);
console.log({ user });
```

The last form prints `{ user: {...} }`, so the variable name is included automatically. It is a small habit that saves a lot of squinting.

### `console.table`

For arrays of objects, this is far better than a plain log.

```javascript
const students = [
  { name: 'Asha', score: 92 },
  { name: 'Ben', score: 78 },
  { name: 'Chitra', score: 85 }
];
console.table(students);
```

You get a real table with sortable columns.

### Grouping

```javascript
console.group('User details');
console.log('Name: Asha');
console.log('Age: 30');
console.groupEnd();
```

### Timing

```javascript
console.time('loop');
let total = 0;
for (let i = 0; i < 1000000; i++) {
  total += i;
}
console.timeEnd('loop');
```

The label in `time` and `timeEnd` must match.

### Counting

```javascript
function handleClick() {
  console.count('clicks');
}
handleClick();
handleClick();
```

Useful for checking whether a function runs more often than you expected.

### Assertions

```javascript
const age = -5;
console.assert(age > 0, 'Age should be positive, got', age);
```

Prints only when the condition is false, so it stays quiet when things are fine.

## Reading an error message

Errors look intimidating until you learn the shape.

```javascript
// TypeError: Cannot read properties of null (reading 'textContent')
//     at showTitle (script.js:14:23)
//     at script.js:20:1
```

Read it in three parts:

1. **The type**: `TypeError` tells you what kind of problem it is.
2. **The message**: you tried to read `textContent` from something that was `null`.
3. **The location**: file `script.js`, line 14, column 23.

Go to line 14. Something you expected to be an element was `null`, which almost always means `querySelector` did not match.

### The errors you will meet most

**`Cannot read properties of null`**

```javascript
const el = document.querySelector('#missing');
console.log(el.textContent);
```

The selector matched nothing. Check your spelling, and check the script runs after the element exists.

**`x is not a function`**

```javascript
const name = 'Ravi';
name.toUppercase();
```

Usually a typo in the method name. It is `toUpperCase` with a capital C.

**`x is not defined`**

A misspelled variable, or one used outside its scope.

**`Unexpected token`**

A syntax problem, normally a missing bracket or brace a line or two above where it points.

## Breakpoints

`console.log` shows you one value. A breakpoint pauses the whole program so you can inspect everything.

1. Open DevTools with `F12`.
2. Go to the **Sources** tab.
3. Open your file and click a line number.
4. Reload or trigger the code.

While paused you can hover any variable to see its value, look at the Scope panel for everything currently in scope, and use the step buttons to move forward one line at a time.

### The `debugger` statement

```javascript
function calculateTotal(items) {
  let total = 0;
  debugger;
  for (const item of items) {
    total += item.price;
  }
  return total;
}
```

When DevTools is open, execution pauses right there. Remember to delete these lines before shipping.

## A method that works

When something is broken:

1. **Read the error properly.** The line number is usually right.
2. **Check your assumptions.** Log the value just before the failing line. Nine times out of ten it is not what you expected.
3. **Narrow it down.** Comment out half the code. Is the bug still there? Repeat.
4. **Explain it out loud.** Describing the problem to someone, or even to a rubber duck, makes you spot it surprisingly often.
5. **Change one thing at a time.** Changing three things at once means you will not know which fixed it.

## Before you ship

Leftover logs leak information and clutter the console for everyone.

```javascript
const DEBUG = true;
function log(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}
log('Only shown while debugging');
```

Flip one flag and they all go quiet.

## Quick recap

- `console.warn`, `error`, `table`, `group`, `time` and `count` each beat a plain log in the right situation.
- `console.log({ value })` labels the output with the variable name.
- Errors tell you the type, the reason, and the exact line.
- `Cannot read properties of null` nearly always means a selector matched nothing.
- Breakpoints and `debugger` let you inspect every variable at a moment in time.
- Change one thing at a time, and remove debug logs before shipping.

<code id="code-content" class="language-javascript">
// Log levels stand out differently in the console
console.log('A normal message');
console.warn('Something looks wrong');
console.error('Something broke');
// Wrapping in braces labels the output with the variable name
const user = { name: 'Asha', age: 30 };
console.log({ user });
// Tables are far easier to read than raw arrays of objects
const students = [
  { name: 'Asha', score: 92 },
  { name: 'Ben', score: 78 },
  { name: 'Chitra', score: 85 }
];
console.table(students);
// Grouping keeps related logs together
console.group('User details');
console.log('Name:', user.name);
console.log('Age :', user.age);
console.groupEnd();
// Timing a slow block
console.time('loop');
let total = 0;
for (let i = 0; i &lt; 1000000; i++) total += i;
console.timeEnd('loop');
// Counting how often something runs
function handleClick() { console.count('clicks'); }
handleClick();
handleClick();
// Assertions stay quiet unless something is wrong
const age = -5;
console.assert(age &gt; 0, 'Age should be positive, got', age);
// A debug flag you can switch off before shipping
const DEBUG = true;
function log(...args) {
  if (DEBUG) console.log('[debug]', ...args);
}
log('Only visible while debugging');
</code></pre>
