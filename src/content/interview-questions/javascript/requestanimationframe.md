---
course: javascript
slug: requestanimationframe
experienceLevel: mid
difficulty: medium
tags:
  - browser
  - animation
  - performance
question: "What is `requestAnimationFrame` and why is it better than `setInterval` for animations?"
answer: |
  `requestAnimationFrame(callback)` asks the browser to run `callback` right **before the next repaint**, so your visual updates are synchronised with the display's refresh rate; `setInterval` fires on its own timer, unrelated to when frames are actually drawn.

  Why it is better for animation:

  - **Synced to the screen.** Callbacks run once per frame, at 60, 120 or 144 Hz depending on the display. A `setInterval(fn, 16)` drifts against the refresh cycle, so some frames get two updates and others none, which shows up as jank.
  - **Paused in background tabs.** Browsers stop calling rAF callbacks in hidden tabs, saving CPU and battery. Timers keep running, though browsers throttle them.
  - **Batched with rendering.** All rAF callbacks for a frame run together before style, layout and paint, so DOM writes made inside them are rendered in one go.
  - **High-resolution timestamp.** The callback receives a `DOMHighResTimeStamp` (the frame start time), which you use to compute progress.

  How to use it correctly:

  1. It is **one-shot**. Call `requestAnimationFrame` again inside the callback to keep the loop going.
  2. Base movement on **elapsed time**, not on frame count; otherwise the animation runs twice as fast on a 120 Hz screen.
  3. Keep the returned ID and call `cancelAnimationFrame(id)` to stop, for example when a component unmounts.
  4. Keep work per frame small. A frame budget at 60 Hz is about 16.7 ms, including the browser's own work.

  It is also handy for throttling scroll or resize handlers so expensive visual updates run at most once per frame.

  When not to use it: simple transitions are often better as CSS transitions or animations, or the Web Animations API (`element.animate()`), which can run on the compositor thread without blocking on JavaScript. rAF is also not a general scheduler: it does not run in hidden tabs, so do not use it for logic that must keep running.
codeExample: |
  // In the browser:
  const box = document.querySelector('#box');
  const distance = 300;   // pixels
  const duration = 1000;  // ms
  let start = null;
  let frameId;

  function step(timestamp) {
    start ??= timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);  // time-based, not frame-based
    const eased = 1 - (1 - progress) ** 3;                          // ease-out cubic
    box.style.transform = `translateX(${eased * distance}px)`;

    if (progress < 1) {
      frameId = requestAnimationFrame(step);   // schedule the next frame
    } else {
      console.log('done');                     // logs once after about 1 second
    }
  }

  frameId = requestAnimationFrame(step);

  // Stop early, e.g. when the user clicks "cancel"
  document.querySelector('#cancel').addEventListener('click', () => cancelAnimationFrame(frameId));

  // Throttle scroll work to one update per frame
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      document.body.style.setProperty('--scroll', String(window.scrollY));
      ticking = false;
    });
  }, { passive: true });
popularity: 7.2
isPublished: true
---
