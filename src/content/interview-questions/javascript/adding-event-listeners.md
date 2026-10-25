---
course: javascript
slug: adding-event-listeners
experienceLevel: fresher
difficulty: easy
tags:
  - events
  - dom
question: How do you add and remove event listeners in JavaScript?
answer: |
  You attach a handler with `element.addEventListener(type, handler, options)` and detach it with `element.removeEventListener(type, handler, options)`, passing the **same function reference**.

  The handler receives an **event object** with useful properties such as `event.type`, `event.target` (the element that triggered the event) and `event.currentTarget` (the element the listener is attached to), plus methods like `preventDefault()`.

  Useful options (third argument):

  - `{ once: true }` removes the listener automatically after the first call.
  - `{ capture: true }` runs it during the capture phase instead of the bubble phase.
  - `{ passive: true }` promises not to call `preventDefault`, letting the browser scroll smoothly; useful for `scroll`, `wheel` and `touchmove`.
  - `{ signal }` takes an `AbortController` signal. Calling `controller.abort()` removes every listener registered with that signal, which is a neat way to clean up several at once.

  Why `addEventListener` rather than `onclick`:

  - `element.onclick = fn` allows only **one** handler; assigning again replaces it. `addEventListener` can attach many.
  - Inline HTML attributes like `onclick="..."` mix markup with code and are blocked by strict Content Security Policies.

  Common pitfalls:

  - `removeEventListener` with an anonymous function does nothing, because a new arrow function is a different reference. Store the handler in a variable.
  - Writing `addEventListener("click", handleClick())` calls the function immediately and registers its return value.
  - Forgetting to remove listeners on elements or objects that outlive a component can cause memory leaks and duplicate handlers.
codeExample: |
  // In the browser, with: <button id="save">Save</button>
  const button = document.getElementById("save");

  function handleClick(event) {
    console.log(`Clicked: ${event.currentTarget.textContent}`);
  }

  button.addEventListener("click", handleClick);
  button.click(); // Output: Clicked: Save

  button.removeEventListener("click", handleClick); // same reference
  button.click(); // nothing logged

  button.addEventListener("click", () => console.log("Only once"), { once: true });
  button.click(); // Output: Only once
  button.click(); // nothing logged

  const controller = new AbortController();
  window.addEventListener("resize", () => console.log("resized"), { signal: controller.signal });
  document.addEventListener("keydown", (e) => console.log(e.key), { signal: controller.signal });
  controller.abort(); // removes both listeners
popularity: 8.3
isPublished: true
---
