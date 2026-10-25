---
course: javascript
slug: reflow-and-repaint
experienceLevel: mid
difficulty: hard
tags:
  - browser
  - performance
  - dom
question: What are reflow and repaint, and how do you avoid layout thrashing?
answer: |
  **Reflow** (layout) is when the browser recalculates the size and position of elements, and **repaint** is when it redraws pixels for elements whose appearance changed; reflow is the more expensive one, and layout thrashing happens when JavaScript forces many synchronous reflows by alternating DOM writes and layout reads.

  The rendering pipeline is roughly: style -> layout -> paint -> composite.

  - Changing **geometry** (`width`, `height`, `top`, `margin`, `font-size`, adding or removing elements, changing text) triggers layout, then paint and composite.
  - Changing only **appearance** (`color`, `background`, `visibility`, `box-shadow`) skips layout but needs paint.
  - Changing `transform` or `opacity` on an element with its own layer can skip both and only re-composite, often on the GPU. That is why smooth animations use these properties.

  Forced synchronous layout:

  Browsers normally batch style changes and lay out once before the next frame. But reading a layout property such as `offsetHeight`, `offsetTop`, `clientWidth`, `scrollTop`, `getBoundingClientRect()` or `getComputedStyle()` after a write forces the browser to lay out **immediately** so it can return an accurate value. Doing this in a loop (write, read, write, read) causes a layout per iteration: layout thrashing.

  How to avoid it:

  1. **Batch reads, then writes.** Read all the measurements first, then apply all the style changes.
  2. Use `requestAnimationFrame` for DOM writes, and libraries such as fastdom if many components touch layout.
  3. Animate `transform` and `opacity` instead of `left`, `top`, `width` or `height`.
  4. Change a class instead of setting many inline styles one by one, and build large DOM fragments off-document (`DocumentFragment`, `replaceChildren`) before inserting them.
  5. Limit the scope of layout with CSS `contain: layout` or `content-visibility: auto` for off-screen sections.
  6. Use `ResizeObserver` or `IntersectionObserver` rather than polling sizes and positions.

  Diagnose with the Performance panel in Chrome DevTools: purple "Layout" blocks with a "Forced reflow" warning point to the exact line that caused it.
codeExample: |
  // In the browser:
  const items = [...document.querySelectorAll('.item')];

  // BAD: read and write interleaved -> one forced layout per item
  function thrash() {
    for (const el of items) {
      const width = el.parentElement.offsetWidth;   // read forces layout
      el.style.width = `${width / 2}px`;            // write invalidates layout
    }
  }

  // GOOD: all reads first, then all writes -> a single layout
  function batched() {
    const widths = items.map((el) => el.parentElement.offsetWidth); // reads
    items.forEach((el, i) => { el.style.width = `${widths[i] / 2}px`; }); // writes
  }

  // GOOD: animate compositor-friendly properties
  function slideIn(el) {
    el.animate(
      [{ transform: 'translateX(-100%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: 300, easing: 'ease-out' },
    );
  }

  // GOOD: build off-document, insert once
  function renderList(names) {
    const fragment = document.createDocumentFragment();
    for (const name of names) {
      const li = document.createElement('li');
      li.textContent = name;
      fragment.append(li);
    }
    document.querySelector('#list').replaceChildren(fragment);
  }
popularity: 7.5
isPublished: true
---
