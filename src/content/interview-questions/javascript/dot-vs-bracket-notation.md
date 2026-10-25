---
course: javascript
slug: dot-vs-bracket-notation
experienceLevel: fresher
difficulty: easy
tags:
  - objects
question: What is the difference between dot notation and bracket notation for accessing object properties?
answer: |
  Both read and write object properties, but dot notation (`obj.name`) needs a fixed, valid identifier written in the code, while bracket notation (`obj["name"]` or `obj[key]`) takes any expression and uses its value as the key.

  Use **dot notation** by default. It is shorter, easier to read, and editors can autocomplete it.

  You **need bracket notation** when:

  - The key is stored in a variable or computed at runtime: `obj[fieldName]`, `obj["user_" + id]`.
  - The key is not a valid identifier, such as `"first-name"`, `"my key"` or a key starting with a digit like `"2fa"`.
  - The key is a `Symbol`: `obj[Symbol.iterator]`.
  - You are accessing array elements: `arr[0]` (array indexes are just property keys).

  Things to know:

  - Property keys are always strings or symbols. `obj[1]` and `obj["1"]` are the same property, and an object used as a key becomes `"[object Object]"`, which is a common bug. Use a `Map` when you need non-string keys.
  - A reserved word is fine with dot notation in modern JavaScript: `obj.class` and `obj.default` work.
  - Bracket notation is also used in object literals as **computed property names**: `{ [key]: value }`.
  - Writing `obj.key` when you meant `obj[key]` is a classic mistake; it looks up a property literally called `"key"`.
  - With optional chaining, the bracket form is `obj?.[key]`.

  Be careful with user-controlled keys in bracket notation, since a key like `"__proto__"` can lead to prototype pollution in code that merges objects.
codeExample: |
  const user = { name: "Ada", "favourite-language": "JavaScript", 2: "two" };

  console.log(user.name); // Output: Ada
  console.log(user["favourite-language"]); // Output: JavaScript
  console.log(user[2], user["2"]); // Output: two two

  const field = "name";
  console.log(user[field]); // Output: Ada
  console.log(user.field); // Output: undefined

  const key = "score";
  const stats = { [key]: 99 }; // computed property name
  console.log(stats); // Output: { score: 99 }

  const lookup = {};
  lookup[{ id: 1 }] = "first";
  lookup[{ id: 2 }] = "second"; // both keys become "[object Object]"
  console.log(Object.keys(lookup)); // Output: [ '[object Object]' ]
popularity: 7.9
isPublished: true
---
