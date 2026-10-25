---
course: javascript
slug: preventdefault-vs-stoppropagation
experienceLevel: fresher
difficulty: easy
tags:
  - events
  - dom
question: "What is the difference between `preventDefault()` and `stopPropagation()`?"
answer: |
  `preventDefault()` stops the browser's built-in action for an event, such as following a link or submitting a form, while `stopPropagation()` stops the event from travelling to other elements in the DOM tree. They are independent: one does not imply the other.

  **`event.preventDefault()`** cancels the default behaviour:

  - A form `submit` that would reload the page, so you can validate or send it with `fetch` instead.
  - A link click that would navigate.
  - A checkbox toggle, a key press inserting a character, a right-click context menu.

  It only works if the event is cancelable (`event.cancelable` is `true`), and not in listeners registered with `{ passive: true }`. Other listeners on the same and parent elements still run.

  **`event.stopPropagation()`** stops further capturing or bubbling, so listeners on parent (or, during capture, child) elements do not run. The default action still happens. `stopImmediatePropagation()` additionally prevents the other listeners on the **same** element from running.

  Common pitfalls:

  - Returning `false` from an `addEventListener` handler does nothing. (Only inline `onclick` handlers, and jQuery, treat `return false` specially.)
  - Overusing `stopPropagation` breaks event delegation and analytics or "click outside to close" logic that relies on events reaching the document. Prefer checking `event.target` in the parent instead.
  - Calling `preventDefault` on a form's submit button `click` misses submissions made with the Enter key; listen for the form's `submit` event.

  You can check whether some handler already cancelled an event with `event.defaultPrevented`.
codeExample: |
  // In the browser, with:
  // <div id="card"><form id="signup"><button>Join</button></form><a id="link" href="/terms">Terms</a></div>
  const card = document.getElementById("card");
  card.addEventListener("click", () => console.log("card saw the click"));

  document.getElementById("signup").addEventListener("submit", (event) => {
    event.preventDefault(); // no page reload
    console.log("submitting with fetch instead");
  });

  document.getElementById("link").addEventListener("click", (event) => {
    event.stopPropagation(); // card listener will not run
    console.log("default prevented?", event.defaultPrevented);
  });

  document.querySelector("#signup button").click();
  // Output: card saw the click
  // Output: submitting with fetch instead

  document.getElementById("link").click();
  // Output: default prevented? false
  // (the browser then navigates to /terms)
popularity: 8.4
isPublished: true
---
