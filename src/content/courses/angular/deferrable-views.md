---
publishDate: 2026-06-21T11:40
title: 'Deferrable Views with @defer'
slug: deferrable-views
metadescription: Load parts of a template lazily with at-defer, choosing triggers like viewport, interaction and idle time.
updateDate: 2026-09-07T11:40
author: ['bishal-biswas']
level: 3
tags: ['performance', 'defer', 'lazy loading']
course: angular
---

## Lazy loading inside a template

Route level lazy loading splits by page. `@defer` splits **inside** a page.

```html
@defer {
  <app-heavy-chart [data]="data()" />
} @placeholder {
  <div class="chart-skeleton"></div>
} @loading {
  <app-spinner />
} @error {
  <p>The chart could not be loaded</p>
}
```

Everything inside `@defer` and its imports moves into a separate chunk, downloaded only when the trigger fires.

No configuration, no dynamic import written by hand. The compiler does the splitting.

## The four blocks

```text
@defer        the deferred content
@placeholder  shown before loading starts
@loading      shown while the chunk downloads
@error        shown if the download fails
```

Only `@defer` is required.

```html
@placeholder (minimum 500ms) { <div class="skeleton"></div> }
@loading (after 100ms; minimum 500ms) { <app-spinner /> }
```

**`minimum`** keeps a block visible for at least that long, which stops a flicker when loading is fast.

**`after`** delays showing the loading block, so a fast load never shows a spinner at all.

Those two options are what make deferred loading feel smooth rather than flickery.

## Triggers

```html
@defer (on viewport) { ... }              <!-- scrolled into view -->
@defer (on idle) { ... }                  <!-- the browser is idle, the default -->
@defer (on interaction) { ... }           <!-- clicked or focused -->
@defer (on hover) { ... }                 <!-- pointer over it -->
@defer (on timer(3s)) { ... }             <!-- after a delay -->
@defer (on immediate) { ... }             <!-- as soon as rendering finishes -->
@defer (when isReady()) { ... }           <!-- a condition becomes true -->
```

`on idle` is the default when no trigger is given.

Triggers combine, and any one of them fires the load:

```html
@defer (on viewport; on timer(5s)) { ... }
@defer (on interaction; when userExpanded()) { ... }
```

## Targeting another element

By default `viewport`, `interaction` and `hover` watch the `@placeholder`. Point them elsewhere with a template reference.

```html
<button #expandButton>Show details</button>

@defer (on interaction(expandButton)) {
  <app-details />
} @placeholder {
  <p>Details are hidden</p>
}
```

Without a `@placeholder`, an element based trigger **must** name a target, because there is nothing to attach to.

## Prefetching

Download early, render later.

```html
@defer (on interaction; prefetch on hover) {
  <app-editor />
} @placeholder {
  <button>Edit</button>
}
```

The chunk downloads when the pointer moves over the button, so the editor appears instantly on click. This is the highest value use of `@defer`, because the delay disappears entirely while the initial bundle stays small.

```html
@defer (on viewport; prefetch on idle) { ... }
@defer (when expanded(); prefetch when nearlyVisible()) { ... }
```

## Below the fold content

```html
<app-hero />
<app-features />

@defer (on viewport) {
  <app-testimonials />
} @placeholder (minimum 300ms) {
  <div class="testimonials-skeleton"></div>
}

@defer (on viewport) {
  <app-footer-map />
} @placeholder {
  <div style="height: 400px"></div>
}
```

Give the placeholder roughly the height of the real content. Otherwise the page jumps when it loads, which hurts Cumulative Layout Shift.

## Heavy third party components

The clearest win. A chart library, a rich text editor or a map can be larger than the rest of the application.

```html
@defer (on viewport; prefetch on idle) {
  <app-analytics-dashboard />
} @placeholder {
  <div class="dashboard-skeleton"></div>
} @loading (after 200ms) {
  <app-spinner />
}
```

```typescript
@Component({
  selector: 'app-analytics-dashboard',
  imports: [ChartsModule],       // this whole library goes in the deferred chunk
  template: `...`,
})
export class AnalyticsDashboard {}
```

## What is required for the split

The compiler can only move something into a deferred chunk if it is used **exclusively** inside `@defer` blocks.

```typescript
@Component({
  imports: [HeavyChart, Header],
  template: `
    <app-header />

    @defer (on viewport) {
      <app-heavy-chart />
    }
  `,
})
```

`HeavyChart` is only inside `@defer`, so it is deferred. `Header` is used eagerly, so it is not.

```html
<!-- this defeats the split -->
@if (showPreview()) {
  <app-heavy-chart />
}

@defer (on viewport) {
  <app-heavy-chart />
}
```

Using the component eagerly anywhere pulls it into the main bundle, and the `@defer` block then defers nothing. Check the build output to confirm the chunk actually appeared.

## Server-side rendering

Deferred blocks render their `@placeholder` on the server by default, then hydrate and load on the client.

```html
@defer (on viewport; hydrate on interaction) {
  <app-comments />
} @placeholder {
  <p>Comments</p>
}
```

`hydrate` triggers belong to incremental hydration, which has its own topic. In short, the real content is server rendered and stays non interactive until the trigger fires.

## Testing

```typescript
it('renders the deferred block', async () => {
  const fixture = TestBed.createComponent(Page);

  fixture.componentRef.setInput('data', mockData);
  await fixture.whenStable();

  const deferBlocks = await fixture.getDeferBlocks();
  await deferBlocks[0].render(DeferBlockState.Complete);

  expect(fixture.nativeElement.querySelector('app-heavy-chart')).toBeTruthy();
});
```

`getDeferBlocks()` and `render()` let a test drive each state: `Placeholder`, `Loading`, `Complete` and `Error`.

Also test the placeholder, since users on slow connections see it for real.

## When not to use it

**Above the fold content.** Deferring what the user sees immediately makes the page slower, not faster.

**Small components.** A separate request for 2 KB costs more than it saves. Aim at things over roughly 30 KB.

**Content needed for SEO.** Search engines may not trigger a viewport load. Server render anything that must be indexed.

**Everything, indiscriminately.** Many small chunks means many requests. A handful of well chosen defer blocks beats twenty.

## Measuring the effect

```bash
ng build --stats-json
```

The output separates initial and lazy chunks. A deferred component should appear as its own lazy chunk. If it does not, something is importing it eagerly.

Then check the real numbers in Lighthouse: initial bundle size, Largest Contentful Paint and Total Blocking Time. If none of them moved, the deferral was not worth the complexity.

## Quick recap

- `@defer` splits a chunk out of the template with no manual dynamic import.
- `@placeholder`, `@loading` and `@error` cover the other states.
- `minimum` prevents flicker and `after` avoids showing a spinner for a fast load.
- Triggers include viewport, interaction, hover, idle, timer and a condition.
- `prefetch on hover` downloads early so the content appears instantly.
- A component used eagerly anywhere is not deferred at all.
- Give placeholders a realistic height, or the page jumps when content loads.

<code id="code-content" class="language-typescript">
import { Component, signal } from '@angular/core';
@Component({
  selector: 'app-page',
  // HeavyChart is used ONLY inside @defer, so it moves to its own chunk.
  // Using it eagerly anywhere else pulls it back into the main bundle.
  imports: [HeavyChart, Header],
  template: `
    &lt;app-header /&gt;      &lt;!-- eager: above the fold --&gt;
    &lt;!-- The highest value pattern: download on hover, render on click,
         so the content appears instantly and the bundle stays small. --&gt;
    &lt;button #editButton&gt;Edit&lt;/button&gt;
    @defer (on interaction(editButton); prefetch on hover) {
      &lt;app-editor /&gt;
    } @placeholder {
      &lt;p&gt;Click edit to open the editor&lt;/p&gt;
    }
    &lt;!-- Below the fold. Give the placeholder a REALISTIC height or the
         page jumps when it loads, hurting Cumulative Layout Shift. --&gt;
    @defer (on viewport; prefetch on idle) {
      &lt;app-heavy-chart [data]="data()" /&gt;
    } @placeholder (minimum 300ms) {
      &lt;div class="chart-skeleton" style="height: 400px"&gt;&lt;/div&gt;
    } @loading (after 200ms; minimum 500ms) {
      &lt;app-spinner /&gt;
    } @error {
      &lt;p&gt;The chart could not be loaded&lt;/p&gt;
    }
    &lt;!-- Triggers combine: ANY of them fires the load --&gt;
    @defer (on viewport; on timer(5s)) { &lt;app-testimonials /&gt; }
    @defer (when expanded()) { &lt;app-details /&gt; }
  `,
})
export class Page {
  protected readonly data = signal([1, 2, 3]);
  protected readonly expanded = signal(false);
}
// Triggers: on viewport | on idle (default) | on interaction | on hover
//           on timer(3s) | on immediate | when condition()
// viewport, interaction and hover watch the @placeholder by default.
// With no placeholder they MUST name a target element.
// after  = do not show the loading block until this long has passed
// minimum = keep the block visible at least this long
// Together they stop a fast load flickering a spinner on screen.
// DO NOT defer: above the fold content, anything under ~30 kB,
// or anything that must be indexed by search engines.
// Verify the chunk actually appeared:
//   ng build --stats-json
// If the component still shows in the INITIAL bundle, something imports
// it eagerly and the @defer block is deferring nothing.
// Testing drives each state directly:
//   const blocks = await fixture.getDeferBlocks();
//   await blocks[0].render(DeferBlockState.Complete);
</code></pre>
