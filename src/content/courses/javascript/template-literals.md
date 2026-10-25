---
publishDate: 2026-03-08T09:12
title: Template Literals
slug: template-literals
metadescription: Build strings the modern way with backticks. Insert values, write multi line text, and use tagged templates.
updateDate: 2026-09-05T09:12
author: ['bishal-biswas']
level: 1
tags: ['basics', 'strings', 'es6']
course: javascript
---

## The problem with `+`

Building strings by joining pieces gets ugly fast.

```javascript
const name = 'Ravi';
const age = 28;
const city = 'Mumbai';
const message = 'Hello ' + name + ', you are ' + age + ' and live in ' + city + '.';
console.log(message);
```

Count the quotes and plus signs. Miss one space and the output looks wrong.

## Template literals

Use backticks instead of quotes, and drop values in with `${}`.

```javascript
const name = 'Ravi';
const age = 28;
const city = 'Mumbai';
const message = `Hello ${name}, you are ${age} and live in ${city}.`;
console.log(message);
```

Same result, far easier to read and to change.

The backtick key sits above `Tab` on most keyboards, to the left of the `1`.

## Any expression fits inside `${}`

Not just variables. Anything that produces a value.

```javascript
const price = 250;
const quantity = 3;
console.log(`Total: ${price * quantity}`);
console.log(`Name in caps: ${'ravi'.toUpperCase()}`);
console.log(`Status: ${age >= 18 ? 'adult' : 'minor'}`);
```

Calls to functions work too:

```javascript
function getDiscount(total) {
  return total > 500 ? 50 : 0;
}
const total = 750;
console.log(`You saved Rs ${getDiscount(total)}`);
```

> **Keep it simple.** If the expression inside `${}` needs more than a moment to read, calculate it on the line above and just insert the variable.

## Multi line strings

With normal quotes you need `\n` escapes:

```javascript
const oldWay = 'Line one\nLine two\nLine three';
console.log(oldWay);
```

With backticks, you just press Enter:

```javascript
const newWay = `Line one
Line two
Line three`;
console.log(newWay);
```

Whatever you type, including the line breaks and indentation, is preserved exactly.

This is very useful for building HTML:

```javascript
const product = { name: 'Notebook', price: 120 };
const html = `
  <div class="card">
    <h3>${product.name}</h3>
    <p>Rs ${product.price}</p>
  </div>
`;
console.log(html);
```

## Quotes need no escaping

```javascript
console.log(`She said "hello" and it's fine`);
```

Both quote characters sit happily inside backticks.

## Nesting

A template literal can contain another one.

```javascript
const items = ['pen', 'book'];
const list = `
  <ul>
    ${items.map(item => `<li>${item}</li>`).join('')}
  </ul>
`;
console.log(list);
```

This pattern, mapping an array into HTML and joining it, is everywhere in front end code.

## Tagged templates

A more advanced feature. You can put a function name in front of a template, and that function receives the pieces.

```javascript
function highlight(strings, ...values) {
  return strings.reduce(function (result, text, i) {
    const value = values[i] !== undefined ? `**${values[i]}**` : '';
    return result + text + value;
  }, '');
}
const name = 'Ravi';
const score = 92;
console.log(highlight`Student ${name} scored ${score} marks`);
```

`strings` holds the fixed text pieces and `values` holds what was inside each `${}`. Libraries use this for styled components, safe HTML escaping, and translations. You do not need it early on, but it is good to recognise the syntax.

## When to use which quote

- **Backticks** whenever you insert a value or need more than one line.
- **Single quotes** for plain fixed text.
- **Double quotes** if your team prefers them, but pick one and stay consistent.

## Quick recap

- Backticks let you insert values with `${}` instead of joining with `+`.
- Any expression works inside `${}`, including calculations and function calls.
- Line breaks and indentation inside backticks are kept exactly as typed.
- Both `'` and `"` can sit inside a template without escaping.
- Mapping an array and joining it is the standard way to build list markup.
- Tagged templates hand the pieces to a function for advanced processing.

<code id="code-content" class="language-javascript">
const name = 'Ravi';
const age = 28;
const price = 250;
const quantity = 3;
// Inserting values
console.log(`Hello ${name}, you are ${age} years old.`);
// Any expression works inside ${}
console.log(`Total: Rs ${price * quantity}`);
console.log(`Name in caps: ${name.toUpperCase()}`);
console.log(`Status: ${age &gt;= 18 ? 'adult' : 'minor'}`);
// Multi line text keeps your line breaks
const summary = `Order summary
  Item price : Rs ${price}
  Quantity   : ${quantity}
  Grand total: Rs ${price * quantity}`;
console.log(summary);
// Both quote types sit safely inside backticks
console.log(`She said "hello" and it's fine`);
// Building markup from an array
const items = ['pen', 'book', 'bag'];
const html = `
  &lt;ul&gt;
    ${items.map(function (item) { return `&lt;li&gt;${item}&lt;/li&gt;`; }).join('')}
  &lt;/ul&gt;`;
console.log(html);
// Tagged template: the function receives the pieces
function highlight(strings, ...values) {
  return strings.reduce(function (out, text, i) {
    return out + text + (values[i] !== undefined ? '**' + values[i] + '**' : '');
  }, '');
}
console.log(highlight`Student ${name} scored ${92} marks`);
</code></pre>
