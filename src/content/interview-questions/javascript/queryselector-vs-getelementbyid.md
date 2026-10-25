---
course: javascript
slug: queryselector-vs-getelementbyid
experienceLevel: fresher
difficulty: easy
tags:
  - dom
question: "What is the difference between `querySelector` and `getElementById`?"
answer: |
  `getElementById` finds a single element by its `id` attribute, while `querySelector` finds the first element matching any CSS selector, which makes it more flexible but slightly slower.

  **`document.getElementById("menu")`**

  - Takes a plain id, **without** the `#`.
  - Only available on `document` (and document fragments), not on individual elements.
  - Very fast, since browsers keep a lookup of ids.
  - Returns the element or `null`.

  **`querySelector(".menu > li.active")`**

  - Takes any CSS selector: id (`#menu`), class, attribute, combinators, pseudo-classes.
  - Can be called on any element to search only inside it: `card.querySelector("button")`.
  - Returns the **first** match or `null`. `querySelectorAll` returns all matches.
  - Throws a `SyntaxError` for an invalid selector. Ids that start with a digit or contain special characters must be escaped, for example with `CSS.escape(id)`.

  The "many" versions differ in an important way:

  - `querySelectorAll` returns a **static** `NodeList`. It does not change if the DOM changes later, and it supports `forEach`.
  - `getElementsByClassName` and `getElementsByTagName` return a **live** `HTMLCollection` that updates automatically, and has no `forEach`. Use `Array.from` or a `for...of` loop to iterate.

  In practice, `querySelector` and `querySelectorAll` are the go-to choice in modern code because one consistent API covers every case. `getElementById` is still perfectly fine, and marginally faster, when you have an id. The speed difference rarely matters outside very hot loops. Whichever you use, always handle the `null` case before accessing properties.
codeExample: |
  // In the browser, with: <ul id="menu"><li class="item active">Home</li><li class="item">About</li></ul>
  const byId = document.getElementById("menu");
  const bySelector = document.querySelector("#menu");
  console.log(byId === bySelector); // Output: true

  const active = byId.querySelector("li.active"); // search inside an element
  console.log(active.textContent); // Output: Home

  const staticList = document.querySelectorAll(".item"); // static NodeList
  const liveList = document.getElementsByClassName("item"); // live HTMLCollection

  const extra = document.createElement("li");
  extra.className = "item";
  byId.append(extra);

  console.log(staticList.length, liveList.length); // Output: 2 3

  const missing = document.querySelector("#does-not-exist");
  console.log(missing?.textContent ?? "not found"); // Output: not found
popularity: 7.8
isPublished: true
---
