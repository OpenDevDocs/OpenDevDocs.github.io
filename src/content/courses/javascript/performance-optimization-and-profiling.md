---
publishDate: 2026-03-27T09:46
title: Performance Optimization and Profiling
slug: performance-optimization-and-profiling
metadescription: Measure before you optimise. Learn profiling tools, Core Web Vitals, and the techniques that actually make pages faster.
updateDate: 2026-09-05T09:46
author: ['bishal-biswas']
level: 3
tags: ['performance', 'tools']
course: javascript
---

## Measure first

The most important rule in performance work: **do not guess**. Developers are famously bad at predicting what is slow. Measure, change one thing, measure again.

```javascript
console.time('operation');
const result = [...Array(100000)].map((_, i) => i * 2);
console.timeEnd('operation');
```

For anything more serious, use `performance.now()`, which is more precise:

```javascript
const start = performance.now();
doSomething();
console.log(`Took ${(performance.now() - start).toFixed(2)}ms`);
```

### The Performance panel

DevTools gives you the real picture. Record while you use the page, then look for:

- **Long tasks**, meaning anything over 50ms, which block interaction.
- **Layout thrashing**, shown as repeated purple layout blocks.
- **The flame chart**, where wide bars are your expensive functions.

## Core Web Vitals

Google measures three things that map to what users actually feel.

- **LCP** (Largest Contentful Paint): how long until the main content appears. Aim under 2.5s.
- **INP** (Interaction to Next Paint): how quickly the page responds to a click or tap. Aim under 200ms.
- **CLS** (Cumulative Layout Shift): how much things jump around. Aim under 0.1.

```javascript
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('LCP:', entry.startTime.toFixed(0), 'ms');
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

## Do less work on the main thread

### Debounce and throttle

```javascript
function debounce(fn, delay) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}
function throttle(fn, limit) {
  let waiting = false;
  return (...args) => {
    if (waiting) return;
    fn(...args);
    waiting = true;
    setTimeout(() => { waiting = false; }, limit);
  };
}
const onSearch = debounce((term) => console.log('Searching', term), 300);
const onScroll = throttle(() => console.log('Scrolled'), 100);
```

**Debounce** waits for a pause, which suits search input. **Throttle** limits the rate, which suits scroll and resize.

### Break up long tasks

```javascript
async function processLargeList(items) {
  for (let i = 0; i < items.length; i++) {
    doWork(items[i]);
    if (i % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}
```

Yielding every hundred items lets the browser handle clicks and repaints.

## Do not fight the layout engine

Reading a layout property after writing one forces the browser to recalculate immediately.

```javascript
const boxes = document.querySelectorAll('.box');
boxes.forEach(box => {
  const width = box.offsetWidth;
  box.style.width = width + 10 + 'px';
});
```

That is **layout thrashing**: read, write, read, write, each read forcing a recalculation.

Separate the phases:

```javascript
const boxes = document.querySelectorAll('.box');
const widths = [...boxes].map(box => box.offsetWidth);
boxes.forEach((box, i) => {
  box.style.width = widths[i] + 10 + 'px';
});
```

Read everything, then write everything. Much faster.

### Batch DOM insertions

```javascript
const list = document.querySelector('#list');
for (let i = 0; i < 1000; i++) {
  const li = document.createElement('li');
  li.textContent = `Item ${i}`;
  list.append(li);
}
const fragment = document.createDocumentFragment();
for (let i = 0; i < 1000; i++) {
  const li = document.createElement('li');
  li.textContent = `Item ${i}`;
  fragment.append(li);
}
list.append(fragment);
```

A document fragment lives outside the page, so building it costs nothing. One insertion instead of a thousand.

### Animate the cheap properties

```javascript
element.style.left = x + 'px';
element.style.transform = `translateX(${x}px)`;
```

`transform` and `opacity` can be handled by the GPU without recalculating layout. Changing `left`, `width` or `top` forces layout on every frame.

## Load less JavaScript

The fastest code is code you never send.

```javascript
button.addEventListener('click', async () => {
  const { Chart } = await import('./chart.js');
  new Chart();
});
```

Other wins:

- **Tree shaking**, which requires ES modules and named imports.
- **Import only what you need**, so `import { debounce } from 'lodash-es'` rather than the whole library.
- **`defer` or `type="module"`**, so scripts never block parsing.
- **Modern build targets**, so you stop shipping polyfills for browsers nobody uses.

## Cache expensive results

```javascript
function memoise(fn) {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
const slowSquare = memoise((n) => {
  console.log('Calculating');
  return n * n;
});
console.log(slowSquare(5), slowSquare(5));
```

Give real caches a size limit, or you have just built a memory leak.

## Algorithms beat micro optimisation

This matters far more than any trick above.

```javascript
function findUsersSlow(users, ids) {
  return ids.map(id => users.find(u => u.id === id));
}
function findUsersFast(users, ids) {
  const map = new Map(users.map(u => [u.id, u]));
  return ids.map(id => map.get(id));
}
```

The first is O(n squared). With 10,000 users and 10,000 ids it does 100 million comparisons. The second builds a lookup once and is effectively instant. No amount of loop tuning closes that gap.

## Images and fonts are usually the real problem

JavaScript often is not the bottleneck.

```javascript
// <img src="photo.jpg" loading="lazy" width="800" height="600" alt="">
// <link rel="preload" as="font" href="font.woff2" type="font/woff2" crossorigin>
```

- `loading="lazy"` skips offscreen images.
- Always set `width` and `height` to prevent layout shift.
- Use modern formats like WebP or AVIF.
- Preload fonts and use `font-display: swap`.

## A sensible order

1. Measure with the Performance panel and Lighthouse.
2. Fix the biggest thing first, which is usually images or bundle size.
3. Look at algorithms in any hot path.
4. Then reduce main thread work.
5. Measure again to confirm it helped.

## Quick recap

- Always measure before and after, never guess.
- LCP, INP and CLS are the metrics that reflect real experience.
- Debounce for pauses, throttle for rate limits.
- Batch DOM reads and writes separately to avoid layout thrashing.
- Animate `transform` and `opacity`, not `left` and `width`.
- Split code and import only what you use.
- A better algorithm beats every micro optimisation.

<code id="code-content" class="language-javascript">
// Measure first. Never optimise on a hunch
const start = performance.now();
const doubled = [...Array(100000)].map((_, i) =&gt; i * 2);
console.log('Took', (performance.now() - start).toFixed(2), 'ms');
// Debounce waits for a pause, throttle limits the rate
function debounce(fn, delay) {
  let id;
  return (...args) =&gt; {
    clearTimeout(id);
    id = setTimeout(() =&gt; fn(...args), delay);
  };
}
function throttle(fn, limit) {
  let waiting = false;
  return (...args) =&gt; {
    if (waiting) return;
    fn(...args);
    waiting = true;
    setTimeout(() =&gt; { waiting = false; }, limit);
  };
}
const onSearch = debounce(term =&gt; console.log('Searching', term), 300);
const onScroll = throttle(() =&gt; console.log('Scrolled'), 100);
// SLOW: layout thrashing, every read forces a recalculation
function thrash(boxes) {
  boxes.forEach(box =&gt; {
    box.style.width = box.offsetWidth + 10 + 'px';   // read, write, read...
  });
}
// FAST: read everything, then write everything
function batched(boxes) {
  const widths = [...boxes].map(box =&gt; box.offsetWidth);   // all reads
  boxes.forEach((box, i) =&gt; { box.style.width = widths[i] + 10 + 'px'; });
}
// SLOW: 1000 separate insertions into the live page
// FAST: build off screen, insert once
const list = document.querySelector('#list');
if (list) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i &lt; 1000; i++) {
    const li = document.createElement('li');
    li.textContent = 'Item ' + i;
    fragment.append(li);
  }
  list.append(fragment);
}
// The biggest win is almost always the algorithm, not the loop
function findUsersSlow(users, ids) {          // O(n squared)
  return ids.map(id =&gt; users.find(u =&gt; u.id === id));
}
function findUsersFast(users, ids) {          // build a lookup once
  const map = new Map(users.map(u =&gt; [u.id, u]));
  return ids.map(id =&gt; map.get(id));
}
// Cache expensive results, but give the cache a limit in real code
function memoise(fn) {
  const cache = new Map();
  return (...args) =&gt; {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn(...args));
    return cache.get(key);
  };
}
const square = memoise(n =&gt; { console.log('Calculating'); return n * n; });
console.log(square(5), square(5));      // calculates once
// Load code only when it is needed
document.querySelector('#chartBtn')?.addEventListener('click', async () =&gt; {
  const { Chart } = await import('./chart.js');
  new Chart();
});
</code></pre>
