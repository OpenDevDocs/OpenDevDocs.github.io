---
course: javascript
slug: optional-chaining
experienceLevel: fresher
difficulty: easy
tags:
  - operators
  - objects
question: "What is optional chaining (`?.`) in JavaScript?"
answer: |
  Optional chaining (`?.`) safely accesses a property, element or method on a value that might be `null` or `undefined`: if the value before `?.` is nullish, the whole expression stops and returns `undefined` instead of throwing a `TypeError`.

  It has three forms:

  - Property access: `user?.address`
  - Bracket access: `user?.[key]`, `list?.[0]`
  - Function or method call: `callback?.()`, `user.getName?.()`. The call happens only if the function exists.

  It **short-circuits**: in `user?.address.city`, if `user` is nullish, nothing to the right is evaluated, including any function calls in arguments.

  Before it existed, the same check needed `user && user.address && user.address.city`, which also wrongly stops on other falsy values like `0` or `""`. `?.` only checks for `null` and `undefined`.

  It pairs naturally with the nullish coalescing operator to supply a default: `user?.address?.city ?? "Unknown"`.

  Pitfalls:

  - You cannot assign through it: `user?.name = "Ada"` is a `SyntaxError`.
  - It only protects the part immediately before `?.`. In `user?.address.city`, if `user` exists but `address` is `undefined`, `.city` still throws. Add `?.` at each level that can be missing.
  - `obj.method?.()` still throws if `method` exists but is not a function.
  - Do not overuse it. If a value should always be present, a crash with a clear error is better than silently passing `undefined` further into your program.

  It is especially handy for API responses, optional configuration and optional callbacks.
codeExample: |
  const user = {
    name: "Ada",
    address: null,
    getName() {
      return this.name;
    },
  };

  console.log(user.address?.city); // Output: undefined
  console.log(user.address?.city ?? "Unknown city"); // Output: Unknown city
  console.log(user.getName?.()); // Output: Ada
  console.log(user.getAge?.()); // Output: undefined

  const users = null;
  console.log(users?.[0]); // Output: undefined

  try {
    console.log(user.contact.email); // no ?. on a missing object
  } catch (err) {
    console.log(err.name); // Output: TypeError
  }

  const settings = { volume: 0 };
  console.log(settings && settings.volume); // Output: 0
  console.log(settings?.volume); // Output: 0
popularity: 8.5
isPublished: true
---
