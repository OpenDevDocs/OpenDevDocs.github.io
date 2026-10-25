---
course: javascript
slug: intersection-mutation-resize-observers
experienceLevel: mid
difficulty: medium
tags:
  - browser
  - dom
  - performance
question: "What are `IntersectionObserver`, `MutationObserver` and `ResizeObserver` used for?"
answer: |
  They are browser APIs that notify you asynchronously about changes you would otherwise have to poll for: `IntersectionObserver` reports when elements enter or leave the viewport (or another container), `MutationObserver` reports changes to the DOM tree and attributes, and `ResizeObserver` reports when an element's size changes.

  **IntersectionObserver**

  - Typical uses: lazy-loading images, infinite scroll (observe a sentinel element at the end of a list), analytics for "ad or section was seen", starting animations when content scrolls into view.
  - Options: `root` (default is the viewport), `rootMargin` (start loading 200px before visible) and `threshold` (0 to 1, or an array).
  - Much cheaper than scroll listeners calling `getBoundingClientRect()`, because the browser computes intersections off the main thread's hot path.

  **MutationObserver**

  - Typical uses: reacting to DOM changes made by third-party scripts, building editors, waiting for an element to appear.
  - Configure with `childList`, `attributes`, `characterData`, `subtree` and `attributeFilter`.
  - Callbacks are **microtasks** and receive a batch of `MutationRecord`s, so many changes are delivered together.

  **ResizeObserver**

  - Typical uses: responsive components that adapt to their **own** size rather than the window (charts, virtualised lists, text truncation).
  - Each entry provides `contentRect` and the more detailed `borderBoxSize` and `contentBoxSize`.
  - It normally fires once soon after you start observing, reporting the initial size.

  Common rules and pitfalls:

  1. Always call `unobserve(el)` or `disconnect()` when the element or component goes away, or you leak memory and callbacks.
  2. One observer can watch many elements. Create a shared observer instead of one per element.
  3. Changing an observed element's size inside a `ResizeObserver` callback can cause a loop; browsers stop it and report "ResizeObserver loop completed with undelivered notifications".
  4. A `MutationObserver` that modifies the DOM it watches can trigger itself endlessly. Guard against it or disconnect while you make changes.
  5. For CSS-only responsiveness, container queries may replace `ResizeObserver`; for images, the native `loading="lazy"` attribute may replace `IntersectionObserver`.
codeExample: |
  // In the browser:
  // 1. Lazy-load images 200px before they become visible
  const lazyObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.src = entry.target.dataset.src;
      observer.unobserve(entry.target);             // load once, then stop watching
    }
  }, { rootMargin: '200px' });
  document.querySelectorAll('img[data-src]').forEach((img) => lazyObserver.observe(img));

  // 2. React to items added to a list by any script
  const list = document.querySelector('#notifications');
  const mutationObserver = new MutationObserver((records) => {
    const added = records.reduce((n, r) => n + r.addedNodes.length, 0);
    console.log(`${added} node(s) added`);           // logs "1 node(s) added" below
  });
  mutationObserver.observe(list, { childList: true });
  list.append(document.createElement('li'));

  // 3. Adapt a component to its own width
  const card = document.querySelector('.card');
  const resizeObserver = new ResizeObserver(([entry]) => {
    const width = entry.contentBoxSize[0].inlineSize;
    card.classList.toggle('card--compact', width < 400);
  });
  resizeObserver.observe(card);

  // Clean up when the component is removed
  function destroy() {
    lazyObserver.disconnect();
    mutationObserver.disconnect();
    resizeObserver.disconnect();
  }
popularity: 7.0
isPublished: true
---
