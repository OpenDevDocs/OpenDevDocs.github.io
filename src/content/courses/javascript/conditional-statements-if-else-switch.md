---
publishDate: 2026-03-03T09:04
title: Conditional Statements (if-else, switch)
slug: conditional-statements-if-else-switch
metadescription: Teach your programs to make decisions with if, else if, else, the ternary operator, and switch statements.
updateDate: 2026-09-05T09:04
author: ['bishal-biswas']
level: 1
tags: ['basics', 'control-flow']
course: javascript
---

## Making decisions

So far your code has run straight from top to bottom. Conditionals let it choose a path.

## The `if` statement

```javascript
const temperature = 35;
if (temperature > 30) {
  console.log('It is hot today');
}
```

The code inside the curly braces runs only when the condition inside the round brackets is truthy.

## `else`

```javascript
const age = 15;
if (age >= 18) {
  console.log('You can vote');
} else {
  console.log('You are too young to vote');
}
```

Exactly one of the two blocks always runs.

## `else if`

When you have more than two paths, chain them.

```javascript
const score = 78;
if (score >= 90) {
  console.log('Grade A');
} else if (score >= 75) {
  console.log('Grade B');
} else if (score >= 60) {
  console.log('Grade C');
} else {
  console.log('Needs improvement');
}
```

JavaScript checks each condition top to bottom and stops at the first one that is true. Order matters: if you put `score >= 60` first, everyone above 60 would get a C.

## Nesting conditions

You can put an `if` inside another `if`.

```javascript
const isLoggedIn = true;
const isAdmin = false;
if (isLoggedIn) {
  if (isAdmin) {
    console.log('Welcome, admin');
  } else {
    console.log('Welcome, user');
  }
} else {
  console.log('Please log in');
}
```

Deep nesting gets hard to read quickly. Often you can flatten it with `&&`:

```javascript
if (isLoggedIn && isAdmin) {
  console.log('Welcome, admin');
}
```

## Guard clauses keep code flat

Instead of wrapping everything in a big `if`, handle the exceptions first and leave early.

```javascript
function processOrder(order) {
  if (!order) {
    console.log('No order provided');
    return;
  }
  if (order.items.length === 0) {
    console.log('Order is empty');
    return;
  }
  console.log('Processing', order.items.length, 'items');
}
```

The happy path stays at the left edge of the screen, which is much easier to follow.

## The ternary operator

For a simple two way choice that produces a value, the ternary is shorter.

```javascript
const age = 20;
const message = age >= 18 ? 'Allowed' : 'Not allowed';
console.log(message);
```

Use it for short expressions. If you find yourself nesting ternaries, switch back to `if` and `else`.

## The `switch` statement

When you are comparing one value against many fixed options, `switch` reads better than a long `else if` chain.

```javascript
const day = 3;
switch (day) {
  case 1:
    console.log('Monday');
    break;
  case 2:
    console.log('Tuesday');
    break;
  case 3:
    console.log('Wednesday');
    break;
  default:
    console.log('Some other day');
}
```

### Do not forget `break`

Without `break`, execution falls through into the next case:

```javascript
const fruit = 'apple';
switch (fruit) {
  case 'apple':
    console.log('Apple');
  case 'banana':
    console.log('Banana');
}
```

That prints both lines. Missing `break` is one of the most common `switch` bugs.

### Deliberate fall through

Sometimes falling through is exactly what you want, when several cases share the same result.

```javascript
const day = 'Saturday';
switch (day) {
  case 'Saturday':
  case 'Sunday':
    console.log('Weekend');
    break;
  default:
    console.log('Weekday');
}
```

### `switch` uses strict comparison

```javascript
const value = '5';
switch (value) {
  case 5:
    console.log('Number five');
    break;
  default:
    console.log('No match');
}
```

This prints `No match`, because `'5'` is not strictly equal to `5`.

## `if` or `switch`?

- Use `if` for ranges and complex conditions, such as `score >= 75`.
- Use `switch` when checking one value against a list of exact matches.

## Quick recap

- `if`, `else if` and `else` pick one path out of many.
- Conditions are checked top to bottom, so order your ranges carefully.
- Guard clauses with early `return` keep code flat and readable.
- The ternary is a compact `if` that produces a value.
- `switch` compares one value against fixed options, always with `break`.
- `switch` uses strict `===` comparison, so types must match.

<code id="code-content" class="language-javascript">
// A simple grading function using if / else if / else
function getGrade(score) {
  if (score &gt;= 90) return 'A';
  if (score &gt;= 75) return 'B';
  if (score &gt;= 60) return 'C';
  return 'Needs improvement';
}
console.log(getGrade(95)); // A
console.log(getGrade(78)); // B
console.log(getGrade(40)); // Needs improvement
// Guard clauses handle the bad cases first
function processOrder(order) {
  if (!order) return 'No order provided';
  if (order.items.length === 0) return 'Order is empty';
  return 'Processing ' + order.items.length + ' items';
}
console.log(processOrder(null));
console.log(processOrder({ items: ['pen', 'book'] }));
// Ternary for a quick two way choice
const age = 20;
console.log(age &gt;= 18 ? 'Allowed' : 'Not allowed');
// switch with deliberate fall through for shared cases
function getDayType(day) {
  switch (day) {
    case 'Saturday':
    case 'Sunday':
      return 'Weekend';
    case 'Monday':
      return 'Start of the week';
    default:
      return 'Weekday';
  }
}
console.log(getDayType('Sunday'));  // Weekend
console.log(getDayType('Monday'));  // Start of the week
console.log(getDayType('Thursday')); // Weekday
</code></pre>
