---
course: javascript
slug: destructuring-assignment
experienceLevel: fresher
difficulty: easy
tags:
  - es6
  - objects
  - arrays
question: What is destructuring assignment in JavaScript?
answer: |
  Destructuring is a syntax for unpacking values from arrays, or properties from objects, into separate variables in a single statement.

  **Array destructuring** works by position:

  - `const [first, second] = list;` takes the first two elements.
  - Skip items with empty slots: `const [, second] = list;`.
  - Collect the rest: `const [head, ...tail] = list;`.
  - Swap variables without a temporary: `[a, b] = [b, a];`.

  **Object destructuring** works by property name:

  - `const { name, age } = user;` creates `name` and `age` variables.
  - Rename: `const { name: userName } = user;`.
  - Nested: `const { address: { city } } = user;`.
  - Rest: `const { password, ...safeUser } = user;` copies the remaining properties.

  Both forms support **default values**, as in `const { role = "guest" } = user;`. A default is used only when the value is `undefined`, not when it is `null`.

  Destructuring is especially common in function parameters, for example `function createUser({ name, isAdmin = false }) {...}`, which gives you named, optional arguments. It is also how you read multiple return values, such as React's `const [count, setCount] = useState(0)`.

  Pitfalls: destructuring `null` or `undefined` throws a `TypeError`, so give parameters a fallback like `({ name } = {})`. Nested destructuring throws if an intermediate object is missing. When assigning to existing variables with object destructuring, wrap the statement in parentheses: `({ a, b } = obj);`, otherwise the `{` is parsed as a block.
codeExample: |
  const user = { name: "Ada", address: { city: "London" }, role: null };

  const { name, address: { city }, age = 36, role = "guest" } = user;
  console.log(name, city, age, role); // Output: Ada London 36 null

  const [first, , third, ...rest] = [10, 20, 30, 40, 50];
  console.log(first, third, rest); // Output: 10 30 [ 40, 50 ]

  let a = 1;
  let b = 2;
  [a, b] = [b, a];
  console.log(a, b); // Output: 2 1

  function connect({ host = "localhost", port = 80 } = {}) {
    return `${host}:${port}`;
  }
  console.log(connect({ port: 3000 })); // Output: localhost:3000
  console.log(connect()); // Output: localhost:80

  const { name: userName, ...others } = user;
  console.log(userName, Object.keys(others)); // Output: Ada [ 'address', 'role' ]
popularity: 8.9
isPublished: true
---
