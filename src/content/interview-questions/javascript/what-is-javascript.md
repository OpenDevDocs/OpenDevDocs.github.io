---
course: javascript
slug: what-is-javascript
experienceLevel: fresher
difficulty: easy
tags:
  - basics
question: What is JavaScript and where does it run?
answer: |
  JavaScript is a high-level, dynamically typed programming language that runs in every web browser and, through runtimes such as Node.js, Deno and Bun, on servers and desktops too.

  It was created to make web pages interactive, and the language itself is standardised as **ECMAScript**, with a new edition published every year. A JavaScript engine (V8 in Chrome and Node.js, SpiderMonkey in Firefox, JavaScriptCore in Safari) parses the code and compiles it just in time to machine code.

  Key characteristics:

  - **Dynamically typed:** variables have no fixed type; values do. `let x = 5; x = "five";` is valid.
  - **Single-threaded:** your code runs on one main thread. Long-running work such as network requests is handled asynchronously through the **event loop**, callbacks and promises, so the thread is not blocked.
  - **Multi-paradigm:** it supports procedural, object-oriented (prototype-based, with `class` syntax) and functional styles. Functions are first-class values.
  - **Garbage collected:** memory is managed automatically.

  What differs between environments is the set of host APIs, not the language. Browsers add the DOM, `fetch`, `localStorage` and events; Node.js adds the file system, `process`, HTTP servers and so on.

  A common confusion: JavaScript has nothing to do with Java beyond the name and some C-style syntax.
codeExample: |
  // The same language features work in any environment
  let value = 42;
  console.log(typeof value); // Output: number

  value = "now a string"; // dynamic typing: the variable can hold any type
  console.log(typeof value); // Output: string

  const greet = (name) => `Hello, ${name}!`; // functions are values
  console.log(greet("Ada")); // Output: Hello, Ada!

  // Host-specific APIs differ: this check works in both browser and Node.js
  const where = typeof window !== "undefined" ? "browser" : "Node.js";
  console.log(`Running in ${where}`); // Output: Running in Node.js
popularity: 8.6
isPublished: true
---
