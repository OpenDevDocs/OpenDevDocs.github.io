---
course: javascript
slug: what-is-closure
experienceLevel: fresher
difficulty: easy
tags:
  - closures
  - functions
  - scope
question: What is a closure in JavaScript?
answer: |
  A closure is a function together with the variables from the scope where it was created. The function keeps access to those variables even after the outer function has returned.

  This works because JavaScript uses **lexical scope**: a function can see the variables that were in scope where it was written, not where it is called. When an inner function is returned or passed somewhere else, the variables it uses are kept alive for as long as the inner function exists.

  Common uses:

  - **Private state**, such as a counter that outside code cannot change directly
  - **Function factories**, such as `makeMultiplier(2)` returning a function that doubles
  - **Callbacks and event handlers** that need data from the code that set them up
  - **Partial application and memoization**, which keep earlier arguments or results

  Two things to know:

  - A closure captures the **variable**, not a copy of its value at that moment. If the variable changes later, the closure sees the new value.
  - Because captured variables stay in memory, a closure that is kept around longer than needed, for example in an event listener that is never removed, can keep large objects alive.

  Every function in JavaScript is technically a closure, but the term usually refers to a function that outlives the scope it was created in.
codeExample: |
  function makeCounter() {
    let count = 0; // private: only the returned functions can reach it

    return {
      increment() {
        count += 1;
        return count;
      },
      current() {
        return count;
      },
    };
  }

  const counter = makeCounter();
  counter.increment();
  counter.increment();
  console.log(counter.current()); // Output: 2
  console.log(counter.count); // Output: undefined

  const other = makeCounter(); // a separate closure with its own count
  console.log(other.increment()); // Output: 1
popularity: 9.2
isPublished: true
---
