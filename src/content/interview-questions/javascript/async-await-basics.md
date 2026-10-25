---
course: javascript
slug: async-await-basics
experienceLevel: fresher
difficulty: medium
tags:
  - async
  - promises
question: "How do `async` and `await` work?"
answer: |
  `async` and `await` are syntax built on top of promises that let you write asynchronous code that reads like synchronous code: `await` pauses an `async` function until a promise settles, then resumes with its value or throws its error.

  The rules:

  - An `async` function **always returns a promise**. Returning `5` gives a promise fulfilled with `5`; throwing an error gives a rejected promise.
  - `await` can be used inside `async` functions, and at the top level of ES modules.
  - `await promise` gives the fulfilled value. If the promise rejects, `await` **throws**, so you handle errors with ordinary `try...catch...finally`.
  - Awaiting does not block the thread. The function is suspended and the rest of the program, including the UI, keeps running. Code after the call to the `async` function runs before the awaited part finishes.

  Common pitfalls:

  - **Forgetting `await`:** you get a pending promise instead of the data, and errors become unhandled rejections.
  - **Accidental sequencing:** `await a(); await b();` runs one after the other. If the operations are independent, start them together with `await Promise.all([a(), b()])`.
  - **`forEach` with `async` callbacks** does not wait. Use `for...of` for sequential work or `Promise.all` with `map` for parallel work.
  - Every `async` call path needs error handling somewhere, either `try...catch` inside or `.catch()` at the call site.

  In practice, `async`/`await` is the standard style for API calls, database queries and file access in both browsers and Node.js.
codeExample: |
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function getUser(id) {
    await delay(10);
    if (id < 0) throw new Error("User not found");
    return { id, name: "Ada" };
  }

  async function main() {
    try {
      const user = await getUser(1);
      console.log(user.name); // Output: Ada

      const [a, b] = await Promise.all([getUser(2), getUser(3)]); // in parallel
      console.log(a.id + b.id); // Output: 5

      await getUser(-1);
    } catch (err) {
      console.log("Caught:", err.message); // Output: Caught: User not found
    } finally {
      console.log("Finished"); // Output: Finished
    }
  }

  main().then(() => console.log("main() returned a promise")); // Output: main() returned a promise
popularity: 9.4
isPublished: true
---
