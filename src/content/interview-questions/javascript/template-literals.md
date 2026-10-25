---
course: javascript
slug: template-literals
experienceLevel: fresher
difficulty: easy
tags:
  - strings
  - es6
question: What are template literals in JavaScript?
answer: |
  Template literals are strings written between backtick characters instead of quotes. They support embedded expressions with `${...}`, real line breaks and tagged templates.

  ```js
  const msg = `Total: ${price * qty}`;
  const html = `<p>
    ${msg}
  </p>`;
  ```

  Compared with single or double quotes, they give you:

  - **Interpolation:** `${expression}` evaluates any JavaScript expression and converts the result to a string. This replaces error-prone concatenation with `+`.
  - **Multi-line strings:** line breaks inside the literal are kept as they are, with no need for `\n`. Indentation inside the literal also becomes part of the string.
  - **Tagged templates:** a function name placed directly before the literal receives the string parts and the values separately. Libraries use this for escaping HTML, CSS-in-JS and SQL query builders. The built-in `String.raw` tag returns the text without processing escape sequences.

  Pitfalls:

  - Interpolating an object gives `"[object Object]"`; use `JSON.stringify` or pick specific properties.
  - `${null}` and `${undefined}` become the text `"null"` and `"undefined"`, which can leak into UI text.
  - Building HTML by interpolating user input into `innerHTML` is an XSS risk. Escape the values or use `textContent`.
  - To include a literal backtick or `${` inside the string, escape it with a backslash.

  In practice, template literals are the default choice whenever a string contains variables or spans multiple lines. Plain quotes are still fine for fixed text.
codeExample: |
  const item = "coffee";
  const price = 3.5;
  const qty = 2;

  console.log(`${qty} x ${item} = £${(price * qty).toFixed(2)}`);
  // Output: 2 x coffee = £7.00

  const message = `Line one
  Line two`;
  console.log(message.split("\n").length); // Output: 2

  console.log(`User: ${{ id: 1 }}`); // Output: User: [object Object]
  console.log(`Value: ${undefined}`); // Output: Value: undefined

  function upper(strings, ...values) {
    return strings.reduce((out, str, i) => out + str + (values[i]?.toUpperCase() ?? ""), "");
  }
  console.log(upper`Hello ${"ada"}, meet ${"grace"}!`); // Output: Hello ADA, meet GRACE!

  console.log(String.raw`C:\new\table`); // Output: C:\new\table
popularity: 8.4
isPublished: true
---
