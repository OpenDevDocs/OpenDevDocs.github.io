---
course: javascript
slug: event-delegation
experienceLevel: fresher
difficulty: medium
tags:
  - events
  - dom
question: What is event delegation, and why is it useful?
answer: |
  Event delegation is a technique where you attach a single event listener to a common parent element instead of one listener per child, and use `event.target` to work out which child was actually interacted with.

  It works because most events **bubble**: a click on a list item also reaches the `ul` that contains it. Inside the parent's handler, you check where the event came from, typically with `event.target.closest(selector)`.

  Benefits:

  - **Handles dynamic content:** items added later, for example after fetching data, work automatically without attaching new listeners.
  - **Fewer listeners:** one handler for a table of 1,000 rows instead of 1,000 handlers, which uses less memory and is faster to set up.
  - **Simpler clean-up:** there is only one listener to remove.

  Pitfalls to mention:

  - `event.target` may be a nested element, such as an `<svg>` or `<span>` inside a button. Use `closest("button")` rather than checking `event.target.tagName` directly.
  - Make sure the element found by `closest` is still inside your container, so a match in an outer part of the page is ignored: `if (!button || !list.contains(button)) return;`.
  - Events that do not bubble, like `focus`, `blur` and `mouseenter`, cannot be delegated directly; use `focusin`, `focusout` or `mouseover` instead.
  - If a child calls `stopPropagation()`, the delegated handler never sees the event.

  Store per-item information in `data-*` attributes (read via `element.dataset`) so the shared handler knows what to do. Delegation is common for lists, tables, menus and toolbars, and frameworks such as React use a similar idea internally by listening at the root.
codeExample: |
  // In the browser, with: <ul id="todos"></ul>
  const list = document.getElementById("todos");

  list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || !list.contains(button)) return;

    const item = button.closest("li");
    if (button.dataset.action === "delete") item.remove();
    if (button.dataset.action === "done") item.classList.toggle("done");
  });

  // Items added later work with no extra listeners
  for (const text of ["Write tests", "Fix bug"]) {
    const li = document.createElement("li");
    li.textContent = text + " ";
    li.innerHTML += '<button data-action="done">Done</button>';
    li.innerHTML += '<button data-action="delete"><span>Delete</span></button>';
    list.append(li);
  }

  list.querySelector('[data-action="delete"] span').click(); // nested target
  console.log(list.children.length); // Output: 1
popularity: 8.8
isPublished: true
---
