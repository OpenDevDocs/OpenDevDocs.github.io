---
publishDate: 2026-06-23T12:10
title: Hydration and Event Replay
slug: hydration-and-event-replay
metadescription: Reuse server rendered HTML instead of throwing it away, and capture clicks that happen before JavaScript is ready.
updateDate: 2026-09-07T12:10
author: ['bishal-biswas']
level: 3
tags: ['ssr', 'hydration', 'performance']
course: angular
---

## The problem hydration solves

Without hydration, Angular **destroys** the server rendered HTML and rebuilds the whole page from scratch.

```text
1. the server sends rendered HTML
2. the browser paints it, the user sees content
3. JavaScript loads
4. Angular wipes the DOM and rebuilds it
5. the page visibly flickers
```

Step four is wasteful and visible. Hydration replaces it: Angular walks the existing DOM, attaches event listeners and state, and leaves the elements alone.

## Turning it on

```typescript
import { provideClientHydration } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(),
  ],
};
```

New projects created with SSR include it. Older ones may not, and adding it is usually a visible improvement on its own.

## Event replay

Hydration removes the flicker but leaves a gap: between the HTML painting and Angular becoming interactive, clicks do nothing.

A user sees a button, clicks it, and nothing happens. They click again, and the second click works. That is a real and common complaint about server rendered applications.

```typescript
provideClientHydration(withEventReplay())
```

A tiny script in the page records events on elements Angular will control. Once hydration finishes, the recorded events are replayed.

The user's first click works. It just works slightly late.

This is on by default in new SSR projects from Angular 19 onwards. Check for it in older ones.

## What can break hydration

Hydration assumes the DOM matches what Angular expects. Anything that changed it in between causes a mismatch.

**Invalid HTML.** The browser silently repairs invalid markup, so the DOM no longer matches what the server produced.

```html
<!-- the browser moves the div out of the p -->
<p><div>Text</div></p>

<!-- and closes the p before the second one -->
<p>First<p>Second</p>
```

Nesting a block element inside `<p>`, or a `<div>` inside `<span>`, or anything but `<tr>` directly inside `<table>` will do it. These are the most common causes by far.

**Direct DOM manipulation before hydration.**

```typescript
// runs on the server and the client, and breaks hydration
constructor() {
  this.element.nativeElement.innerHTML = '<span>Hello</span>';
}

// safe: after hydration
constructor() {
  afterNextRender(() => {
    this.element.nativeElement.innerHTML = '<span>Hello</span>';
  });
}
```

**Browser extensions** that inject elements. You cannot control these, which is why the warning is a warning rather than an error.

**Different output on server and client.**

```typescript
// renders different text on each, guaranteed mismatch
protected readonly now = new Date().toLocaleTimeString();
protected readonly id = Math.random();
```

Anything time based, random, or reading browser only state produces different HTML in the two environments.

## The warnings

```text
NG0500: During hydration Angular expected <div> but found <span>
NG0502: During hydration Angular expected the node to be present
NG0505: Angular hydration was requested on the client, but there was no
        serialized information present in the server response
```

`NG0505` means hydration is configured on the client but the server did not render with it. Usually a missing `provideServerRendering()` or a build that skipped the server bundle.

The others are mismatches. Read the component named in the message and look for the causes above.

## Skipping hydration for a subtree

Some components genuinely cannot hydrate, usually because a third party library rewrites their DOM.

```typescript
@Component({
  selector: 'app-legacy-widget',
  host: { ngSkipHydration: 'true' },
  template: `<div #container></div>`,
})
export class LegacyWidget {}
```

```html
<app-third-party-map ngSkipHydration />
```

Angular destroys and recreates that subtree instead of hydrating it, which is the old behaviour for that part of the page only.

Use it as a targeted escape hatch. Putting it on a large subtree gives up most of the benefit.

## Verifying it works

In development, Angular logs hydration statistics to the console: how many components hydrated and how many were skipped.

Angular DevTools shows hydration status per component in the component tree, which is the quickest way to find a component that is not hydrating.

Practically: load the page with JavaScript throttled and watch for a flicker. No flicker means hydration is working.

## What it does not fix

Hydration reuses the DOM. It does not make the JavaScript smaller or arrive sooner.

```text
Hydration fixes    the flicker, and the double rendering work
It does not fix    bundle size, time to interactive, or a slow API
```

If the page is interactive slowly, the answer is a smaller bundle, lazy routes and `@defer`, not hydration settings.

## Combined setup

```typescript
provideClientHydration(
  withEventReplay(),
  withIncrementalHydration(),
  withHttpTransferCacheOptions({
    includePostRequests: false,
    filter: request => !request.url.includes('/api/private'),
  }),
)
```

Three features that work together.

**Event replay** captures early interactions.

**Incremental hydration** delays hydrating parts of the page, and has its own topic.

**Transfer cache** stops the browser refetching data the server already fetched.

## Quick recap

- Without hydration, Angular destroys and rebuilds server rendered HTML, causing a flicker.
- `provideClientHydration()` reuses the existing DOM instead.
- `withEventReplay()` captures clicks that happen before hydration completes.
- Invalid HTML is the most common cause of hydration mismatches.
- Do not touch the DOM directly before `afterNextRender`.
- Time based or random values render differently on server and client.
- `ngSkipHydration` is a targeted escape hatch for components that cannot hydrate.

<code id="code-content" class="language-typescript">
import { Component, inject, ElementRef, afterNextRender } from '@angular/core';
import { provideClientHydration, withEventReplay,
         withIncrementalHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
// WITHOUT hydration: the server sends HTML, the browser paints it, then
// Angular WIPES the DOM and rebuilds it. The page visibly flickers.
// WITH hydration: Angular walks the existing DOM and attaches to it.
export const appConfig = {
  providers: [
    provideClientHydration(
      // Between the HTML painting and Angular becoming interactive, clicks
      // do nothing. Event replay records them and replays them once
      // hydration finishes, so the user's FIRST click works.
      withEventReplay(),
      withIncrementalHydration(),
      // Stop the browser refetching what the server already fetched.
      // Filter user specific data: it is embedded in cacheable HTML.
      withHttpTransferCacheOptions({
        includePostRequests: false,
        filter: request =&gt; !request.url.includes('/api/private'),
      }),
    ),
  ],
};
// WHAT BREAKS HYDRATION
// 1. INVALID HTML. The browser silently repairs it, so the DOM no longer
//    matches what the server produced. The most common cause by far.
//      &lt;p&gt;&lt;div&gt;Text&lt;/div&gt;&lt;/p&gt;        the browser moves the div out
//      &lt;p&gt;First&lt;p&gt;Second&lt;/p&gt;          it closes the first p early
//      anything but &lt;tr&gt; directly inside &lt;table&gt;
// 2. DIRECT DOM MANIPULATION before hydration
@Component({ selector: 'app-widget', template: `&lt;div #box&gt;&lt;/div&gt;` })
export class Widget {
  private readonly element = inject(ElementRef&lt;HTMLElement&gt;);
  constructor() {
    // WRONG: runs on server and client, and breaks hydration
    // this.element.nativeElement.innerHTML = '&lt;span&gt;Hello&lt;/span&gt;';
    // RIGHT: after hydration, and never on the server
    afterNextRender(() =&gt; {
      this.element.nativeElement.innerHTML = '&lt;span&gt;Hello&lt;/span&gt;';
    });
  }
}
// 3. DIFFERENT OUTPUT on server and client. Guaranteed mismatch:
//      new Date().toLocaleTimeString()
//      Math.random()
//      anything reading window or localStorage during render
// Components that genuinely cannot hydrate, usually because a third party
// library rewrites their DOM. A TARGETED escape hatch, not a blanket fix.
@Component({
  selector: 'app-legacy-map',
  host: { ngSkipHydration: 'true' },
  template: `&lt;div #container&gt;&lt;/div&gt;`,
})
export class LegacyMap {}
// &lt;app-third-party-map ngSkipHydration /&gt;
// The warnings:
//   NG0500 / NG0502  a DOM mismatch, look for the causes above
//   NG0505  hydration requested on the client but the server did not
//           render with it. Usually a missing provideServerRendering().
// Hydration fixes the FLICKER and the double rendering work.
// It does NOT fix bundle size or time to interactive. For those,
// use lazy routes and @defer.
</code></pre>
