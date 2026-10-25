---
course: javascript
slug: core-web-vitals
experienceLevel: senior
difficulty: hard
tags:
  - performance
  - web-vitals
  - browser
question: What are the Core Web Vitals (LCP, INP, CLS), and how does JavaScript affect each one?
answer: |
  Core Web Vitals are Google's user-centric metrics, assessed at the **75th percentile** of real page loads (field data such as CrUX or your own RUM). The current set is:

  - **LCP (Largest Contentful Paint)**: when the largest image or text block in the viewport renders. Good is at most **2.5 s**.
  - **INP (Interaction to Next Paint)**: roughly the worst latency from a click, tap or key press until the next frame is painted, across the whole visit. Good is at most **200 ms**. INP replaced FID as a Core Web Vital in March 2024. Unlike FID, it includes processing time and rendering, not just input delay.
  - **CLS (Cumulative Layout Shift)**: unexpected layout movement, scored as the largest burst (session window) of shift scores. Good is at most **0.1**.

  How JavaScript hurts each one:

  - **LCP**: client-side rendering means the LCP element doesn't exist until the bundle downloads and runs. Render-blocking scripts and lazy-loading the hero image (`loading="lazy"` on it) delay it too. Fix with server rendering, preloading or `fetchpriority="high"` on the hero image, and less JavaScript before first render.
  - **INP**: long tasks on the main thread. Heavy event handlers, large re-renders, hydration and third-party scripts all block the next paint. Fix by doing less work per interaction, yielding to the main thread, deferring non-urgent work, and moving computation to workers.
  - **CLS**: content injected above existing content (banners, ads, late-loading components), images without dimensions, and web fonts swapping. Fix by reserving space, using `aspect-ratio` or width and height attributes, and avoiding inserting content above the viewport except in response to user input.

  Lab tools (Lighthouse) can't measure INP directly because there is no real user; they use Total Blocking Time as a proxy. Collect field data with the `web-vitals` library, which implements the exact definitions and provides attribution for debugging. The underlying performance entry types started in Chromium, so check current support in other engines.
codeExample: |
  // In the browser: rough field measurement with PerformanceObserver
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lcp = entries[entries.length - 1];            // latest LCP candidate
    console.log('LCP', Math.round(lcp.startTime), 'ms', lcp.element);
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  let shiftTotal = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) shiftTotal += entry.value; // ignore user-caused shifts
    }
    console.log('layout shift total', shiftTotal.toFixed(3)); // real CLS uses session windows
  }).observe({ type: 'layout-shift', buffered: true });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.interactionId && entry.duration > 200) {
        console.log('slow interaction', entry.name, entry.duration, 'ms', entry.target);
      }
    }
  }).observe({ type: 'event', durationThreshold: 40, buffered: true });

  // Production: use the web-vitals library for exact definitions and attribution
  // import { onLCP, onINP, onCLS } from 'web-vitals/attribution';
  // onINP((metric) => navigator.sendBeacon('/rum', JSON.stringify(metric)));
popularity: 8.4
isPublished: true
---
