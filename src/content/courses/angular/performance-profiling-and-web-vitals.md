---
publishDate: 2026-06-30T13:55
title: Performance Profiling and Core Web Vitals
slug: performance-profiling-and-web-vitals
metadescription: Measure what users actually experience, find the real cause of slowness, and fix the things that matter.
updateDate: 2026-09-07T13:55
author: ['bishal-biswas']
level: 4
tags: ['performance', 'profiling', 'web vitals']
course: angular
---

## Measure before changing anything

The most common performance mistake is optimising the wrong thing. Someone adds `OnPush` everywhere and the application is still slow, because the actual problem was a 4 MB image.

Start with numbers.

## Core Web Vitals

Three metrics, all measurable from real users.

```text
Largest Contentful Paint (LCP)     when the main content appears     good: under 2.5s
Interaction to Next Paint (INP)    responsiveness to input           good: under 200ms
Cumulative Layout Shift (CLS)      how much the page jumps           good: under 0.1
```

These are what search ranking uses and, more usefully, they correspond to what users complain about: it took ages, it feels laggy, it moved while I was reading.

Measuring them in the application:

```typescript
import { onLCP, onINP, onCLS } from 'web-vitals';

@Injectable({ providedIn: 'root' })
export class VitalsService {
  private readonly analytics = inject(AnalyticsService);

  constructor() {
    afterNextRender(() => {
      onLCP(metric => this.report(metric));
      onINP(metric => this.report(metric));
      onCLS(metric => this.report(metric));
    });
  }

  private report(metric: { name: string; value: number; rating: string }): void {
    this.analytics.track('web-vital', {
      name: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating,
    });
  }
}
```

**Field data beats lab data.** Lighthouse on your machine with fast broadband says little about a user on a three year old phone. Collect from real users and look at the 75th percentile, not the average.

## Diagnosing each one

**A slow LCP** is almost always one of:

```text
a large unoptimised image
a render blocking stylesheet or font
a large initial JavaScript bundle
a slow API call the page waits for
no server rendering on a content page
```

Fixes, in rough order of value: `NgOptimizedImage` with `priority`, lazy load routes, server render or prerender the page, and inline critical CSS.

**A poor INP** means the main thread is busy when the user interacts:

```text
expensive work in an event handler
change detection checking too much
a long task blocking the thread
hydration of a large page
```

Fixes: signals and zoneless so less is checked, `@defer` and incremental hydration, moving heavy computation to a web worker, and virtual scrolling for long lists.

**A poor CLS** is layout moving after it paints:

```text
images without width and height
web fonts swapping and changing metrics
content injected above existing content
ads or embeds with no reserved space
```

Fixes: always set image dimensions, use `font-display: optional` or size adjusted fallbacks, and reserve space for anything loading late.

## Chrome DevTools

The Performance panel is the tool that actually finds causes.

Record an interaction, then look for:

**Long tasks**, marked with a red triangle. Anything over 50 milliseconds blocks input.

**The flame chart**, which shows what the time went on. Wide blocks are your targets.

**Layout and paint events**, especially many in a row, which means layout thrashing.

Throttle first, or you will measure your machine rather than a user's:

```text
CPU: 4x slowdown
Network: Fast 3G
```

Most performance problems are invisible on a developer machine and obvious on a throttled one.

## Angular DevTools

The profiler in the Angular extension shows change detection specifically.

Record an interaction and read:

**How many components were checked.** A click on one button checking two hundred components means `OnPush` is missing, or you are on Zone.js with the default strategy.

**Which component took longest.** Usually an expensive template expression.

**How many cycles ran.** Several change detection passes for one interaction usually means an effect or subscription writing state that triggers another pass.

The component tree view also shows hydration status per component, which is the quickest way to find something that failed to hydrate.

## The usual causes in Angular

**Method calls in templates.**

```html
<p>{{ calculateTotal() }}</p>              <!-- runs on every check -->
<p>{{ items.filter(i => i.active).length }}</p>
```

```typescript
protected readonly total = computed(() =>
  this.items().reduce((sum, i) => sum + i.price, 0)
);
```

A `computed` is cached. A method is not. This is the most common avoidable cost.

**A missing or unstable `track`.**

```html
@for (user of users(); track user.id) { ... }     <!-- good -->
@for (user of users(); track user) { ... }        <!-- rebuilds everything -->
```

A bad `track` destroys and recreates the DOM on every update, losing focus and input state.

**Long lists rendered in full.** Use virtual scrolling above roughly a hundred rows.

**Large images.** Frequently the single biggest win, and the easiest.

**A search inside a loop.**

```typescript
// O(n * m)
for (const order of orders) {
  const customer = customers.find(c => c.id === order.customerId);
}

// O(n + m)
const byId = new Map(customers.map(c => [c.id, c]));
for (const order of orders) {
  const customer = byId.get(order.customerId);
}
```

## Heavy computation

```typescript
const worker = new Worker(new URL('./analysis.worker', import.meta.url));

worker.postMessage({ rows });

worker.onmessage = ({ data }) => this.result.set(data);
```

```bash
ng generate web-worker analysis
```

A web worker moves work off the main thread entirely, so the UI stays responsive. Worth it for anything taking more than about 50 milliseconds.

## Continuous measurement

```bash
npm install --save-dev @lhci/cli
```

```json
{
  "ci": {
    "collect": { "staticDistDir": "./dist/my-app/browser", "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

```yaml
- run: npx ng build
- run: npx lhci autorun
```

A pull request that makes the page slower fails the build. Combined with bundle budgets, that is what stops gradual decay, which is how applications actually become slow: never in one commit.

## An order of work

1. Measure with real users, at the 75th percentile.
2. Find which metric is worst.
3. Profile that specific interaction with throttling on.
4. Fix the largest single cause.
5. Measure again.
6. Stop when it is good enough.

Step six matters. Performance work has diminishing returns, and an LCP of 1.2 seconds does not need to become 1.1.

## Quick recap

- Measure before optimising, and use field data rather than your own machine.
- LCP, INP and CLS correspond to the complaints users actually make.
- Throttle the CPU and network, or you measure your laptop.
- Angular DevTools shows how many components were checked per interaction.
- Method calls in templates and a bad `track` are the most common Angular causes.
- Large images are often the biggest and easiest win.
- Add Lighthouse assertions to continuous integration so regressions fail the build.

<code id="code-content" class="language-typescript">
import { Injectable, inject, signal, computed, afterNextRender } from '@angular/core';
import { onLCP, onINP, onCLS } from 'web-vitals';
// MEASURE FIRST. The most common mistake is adding OnPush everywhere while
// the actual problem is a 4 MB image.
@Injectable({ providedIn: 'root' })
export class VitalsService {
  private readonly analytics = inject(AnalyticsService);
  constructor() {
    // afterNextRender: never runs on the server
    afterNextRender(() =&gt; {
      onLCP(m =&gt; this.report(m));    // main content appears   good &lt; 2.5s
      onINP(m =&gt; this.report(m));    // responsiveness         good &lt; 200ms
      onCLS(m =&gt; this.report(m));    // layout jumping         good &lt; 0.1
    });
  }
  private report(metric: { name: string; value: number; rating: string }) {
    this.analytics.track('web-vital', { ...metric, value: Math.round(metric.value) });
  }
}
// FIELD data beats LAB data. Lighthouse on your machine says little about
// a user on a three year old phone. Look at the 75th percentile.
// When profiling in DevTools, THROTTLE or you measure your own laptop:
//   CPU 4x slowdown, Network Fast 3G
// THE USUAL ANGULAR CAUSES
// 1. Method calls in templates. A computed is CACHED, a method is not.
class Bad {
  items = signal([{ price: 1, active: true }]);
  // template: {{ calculateTotal() }}    runs on EVERY check
  calculateTotal() { return this.items().reduce((s, i) =&gt; s + i.price, 0); }
}
class Good {
  items = signal([{ price: 1, active: true }]);
  // template: {{ total() }}             cached until items changes
  readonly total = computed(() =&gt; this.items().reduce((s, i) =&gt; s + i.price, 0));
}
// 2. A bad track destroys and rebuilds the DOM on every update, losing
//    focus and typed text:
//      @for (u of users(); track u.id)  good
//      @for (u of users(); track u)     rebuilds everything
// 3. A search inside a loop. O(n*m) becomes O(n+m) with a Map:
//      const byId = new Map(customers.map(c =&gt; [c.id, c]));
// 4. Long lists rendered in full. Virtual scroll above ~100 rows.
// 5. Large images. Often the single biggest and easiest win.
// Heavy computation belongs off the main thread entirely:
//   ng generate web-worker analysis
//   const worker = new Worker(new URL('./analysis.worker', import.meta.url));
//   worker.onmessage = ({ data }) =&gt; this.result.set(data);
// STOP REGRESSIONS IN CI. Applications become slow gradually, never in
// one commit, so a check that fails the build is what actually works:
//   "assert": { "assertions": {
//     "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
//     "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
//   }}
//   npx lhci autorun
// ORDER OF WORK: measure, find the worst metric, profile THAT interaction
// with throttling, fix the largest single cause, measure again, and stop
// when it is good enough.
</code></pre>
