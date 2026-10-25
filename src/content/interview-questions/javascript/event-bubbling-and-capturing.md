---
course: javascript
slug: event-bubbling-and-capturing
experienceLevel: fresher
difficulty: medium
tags:
  - events
  - dom
question: What are event bubbling and event capturing?
answer: |
  Event bubbling and capturing are the two directions in which a DOM event travels through the element tree: capturing goes **down** from the `window` to the target element, and bubbling goes back **up** from the target to the `window`.

  Every event dispatched to an element goes through three phases:

  1. **Capture phase:** the event travels from `window` through `document`, `html`, `body` and each ancestor down towards the target.
  2. **Target phase:** listeners on the target element itself run.
  3. **Bubble phase:** the event travels back up through the same ancestors.

  By default, `addEventListener` registers a listener for the **bubble** phase. Pass `{ capture: true }` (or `true` as the third argument) to run it during the capture phase instead.

  So when you click a button inside a `div`, a click listener on the `div` also fires, after the button's listener. That is bubbling, and it is what makes **event delegation** possible.

  Useful details:

  - `event.target` is the element where the event started; `event.currentTarget` is the element whose listener is currently running.
  - `event.stopPropagation()` stops the event moving to further elements in either direction. `stopImmediatePropagation()` also skips the remaining listeners on the current element.
  - Not every event bubbles. `focus`, `blur`, `mouseenter` and `mouseleave` do not; use `focusin`/`focusout` or `mouseover`/`mouseout` if you need bubbling versions. You can check `event.bubbles`.

  In practice you rarely need capture. It is useful when a parent must see an event before any child can stop it, such as logging all clicks or closing a menu when the user clicks elsewhere.
codeExample: |
  // In the browser, with: <div id="outer"><button id="inner">Click</button></div>
  const outer = document.getElementById("outer");
  const inner = document.getElementById("inner");

  outer.addEventListener("click", () => console.log("outer: capture"), { capture: true });
  outer.addEventListener("click", () => console.log("outer: bubble"));
  inner.addEventListener("click", (e) => {
    console.log("inner: target", e.target === e.currentTarget);
  });

  inner.click();
  // Output: outer: capture
  // Output: inner: target true
  // Output: outer: bubble

  inner.addEventListener("click", (e) => e.stopPropagation());
  inner.click();
  // Output: outer: capture
  // Output: inner: target true
popularity: 8.7
isPublished: true
---
