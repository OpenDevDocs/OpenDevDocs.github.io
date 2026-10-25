---
course: javascript
slug: what-is-the-dom
experienceLevel: fresher
difficulty: easy
tags:
  - dom
  - browser
question: What is the DOM?
answer: |
  The DOM (Document Object Model) is the browser's in-memory, tree-shaped representation of an HTML page, exposed as objects that JavaScript can read and change.

  When the browser parses HTML, it builds a tree of **nodes**. The `document` object is the root; each tag becomes an **element node**, text becomes **text nodes**, and comments become comment nodes. Elements have parents, children and siblings, which you can navigate with properties like `parentElement`, `children` and `nextElementSibling`.

  With the DOM API you can:

  - **Find** elements: `document.querySelector`, `getElementById`.
  - **Read and change content:** `textContent`, `innerHTML`, `value`.
  - **Change attributes and styles:** `setAttribute`, `classList.add`, `element.style`.
  - **Create, insert and remove** elements: `document.createElement`, `append`, `remove`.
  - **React to user actions** with `addEventListener`.

  When the DOM changes, the browser updates what is shown on screen.

  Key points interviewers look for:

  - The DOM is **not** JavaScript itself; it is a Web API provided by the browser. Node.js has no DOM unless you add a library such as jsdom.
  - The DOM is not the same as the HTML source. If the browser fixes invalid markup or a script adds elements, the DOM differs from "View Source".
  - Scripts can only access elements that have already been parsed, so use `defer` on script tags or wait for `DOMContentLoaded`.
  - Frequent DOM changes, especially reading layout values like `offsetHeight` in between writes, can be slow because they trigger layout recalculation. Batch updates where possible.
  - Inserting untrusted text with `innerHTML` risks XSS; prefer `textContent`.

  Frameworks such as React and Vue still manipulate the DOM; they just decide which updates to make for you.
codeExample: |
  // In the browser:
  const list = document.createElement("ul");
  list.id = "todo-list";
  document.body.append(list);

  for (const task of ["Buy milk", "Write code"]) {
    const item = document.createElement("li");
    item.textContent = task; // safe: text is not parsed as HTML
    item.classList.add("todo");
    list.append(item);
  }

  console.log(list.children.length); // Output: 2
  console.log(list.firstElementChild.textContent); // Output: Buy milk
  console.log(list.parentElement === document.body); // Output: true

  list.lastElementChild.remove();
  console.log(document.querySelectorAll(".todo").length); // Output: 1
popularity: 8.8
isPublished: true
---
