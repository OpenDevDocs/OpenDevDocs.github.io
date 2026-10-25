---
publishDate: 2026-06-23T12:15
title: Incremental Hydration
slug: incremental-hydration
metadescription: Delay hydrating parts of a page until they are needed, so a large server rendered page becomes interactive far sooner.
updateDate: 2026-09-07T12:15
author: ['bishal-biswas']
level: 3
tags: ['ssr', 'hydration', 'performance']
course: angular
---

## The remaining problem

Full hydration attaches Angular to the whole page at once. On a large page that is a lot of work in one block, and the page is unresponsive while it happens.

Most of that work is wasted. A user reading the top of an article does not need the comments section, the related products carousel and the footer newsletter form to be interactive yet.

**Incremental hydration** hydrates each part when it is actually needed. It became stable in Angular 20.

## Turning it on

```typescript
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';

providers: [
  provideClientHydration(withIncrementalHydration()),
]
```

Then mark the parts to delay with `@defer` and a `hydrate` trigger.

```html
@defer (hydrate on viewport) {
  <app-comments [postId]="postId()" />
}
```

## How it differs from ordinary defer

This is the point that needs to be clear.

```html
<!-- ordinary defer: nothing is rendered on the server -->
@defer (on viewport) {
  <app-comments />
} @placeholder {
  <p>Loading comments</p>
}

<!-- incremental hydration: fully rendered on the server -->
@defer (hydrate on viewport) {
  <app-comments />
}
```

With a `hydrate` trigger, the content **is server rendered**. It appears in the HTML, it is visible immediately, and search engines see it.

What is delayed is the JavaScript: downloading the component's code and making it interactive. Until the trigger fires, it is static HTML.

That is the best of both. Content is there for the user and for crawlers, and the browser does not do the work of making it interactive until it matters.

## The triggers

```html
@defer (hydrate on viewport) { ... }
@defer (hydrate on interaction) { ... }
@defer (hydrate on hover) { ... }
@defer (hydrate on immediate) { ... }
@defer (hydrate on timer(3s)) { ... }
@defer (hydrate when isReady()) { ... }
@defer (hydrate never) { ... }
```

`hydrate never` is worth knowing. The content is server rendered and **never** becomes interactive, and its JavaScript is never downloaded.

```html
@defer (hydrate never) {
  <app-footer-links />
  <app-legal-notice />
}
```

For genuinely static content this removes its code from the client entirely. A footer full of links does not need Angular.

## Combining with a load trigger

```html
@defer (on viewport; hydrate on interaction) {
  <app-heavy-editor />
}
```

Two separate decisions:

```text
on viewport        when to download the chunk
hydrate on interaction   when to make it interactive
```

So the chunk downloads as the user scrolls near it, and the editor becomes interactive when they click. The download is already done, so the interaction is instant.

## A worked example

```typescript
@Component({
  selector: 'app-article-page',
  template: `
    <!-- above the fold: hydrated immediately -->
    <app-article-header [article]="article()" />
    <app-article-body [content]="article().body" />

    <!-- visible immediately, interactive when scrolled to -->
    @defer (hydrate on viewport) {
      <app-related-articles [tags]="article().tags" />
    }

    <!-- visible immediately, interactive on click -->
    @defer (hydrate on interaction) {
      <app-comments [articleId]="article().id" />
    }

    <!-- rendered, never interactive, no JavaScript shipped -->
    @defer (hydrate never) {
      <app-site-footer />
    }
  `,
})
export class ArticlePage {
  readonly article = input.required<Article>();
}
```

The user sees the complete page instantly. The header and body are interactive straight away. Everything else becomes interactive only if the user goes near it, and the footer never costs anything.

## What to delay

**Good candidates:** comment sections, related content, recommendation carousels, footers, newsletter signups, social sharing widgets, anything below the fold.

**Bad candidates:** navigation, search boxes, the primary call to action, anything above the fold, anything a user might interact with in the first second.

The rule: if a user might touch it before scrolling, hydrate it immediately.

## Nesting

Blocks nest, and an inner block cannot hydrate before its parent.

```html
@defer (hydrate on viewport) {
  <app-section>
    @defer (hydrate on interaction) {
      <app-expensive-widget />
    }
  </app-section>
}
```

Scrolling to the section hydrates it, then clicking the widget hydrates that.

If an inner block's trigger fires first, Angular hydrates the parents on the way. You cannot end up with an interactive child inside a non interactive parent.

## Measuring the effect

The metric this improves is **Total Blocking Time**, and by extension Interaction to Next Paint. Both measure how long the main thread is busy and unable to respond.

Record a Lighthouse or Chrome Performance trace before and after. A long hydration block in the flame chart should break into several smaller ones.

Largest Contentful Paint usually does not move, because the content was already server rendered. If someone expects LCP to improve, that is a misunderstanding worth correcting.

## Requirements

**SSR must be enabled.** There is nothing to hydrate incrementally without server rendered HTML.

**`withIncrementalHydration()` must be provided**, or `hydrate` triggers are ignored and behave like ordinary defer.

**The content must be hydratable.** A component with `ngSkipHydration` cannot participate.

## Common mistakes

**Expecting `hydrate` to defer rendering.** It defers interactivity. The HTML is there from the start, which is the entire point.

**Delaying above the fold content.** A hero button that does nothing when clicked is worse than a slightly slower page.

**Using it without SSR.** Nothing happens, because there is no server rendered HTML.

**Delaying everything.** Each block has overhead. A handful of well chosen blocks beats twenty.

## Quick recap

- Incremental hydration delays making parts of a page interactive, not rendering them.
- Content inside a `hydrate` block is server rendered and visible immediately.
- Add `withIncrementalHydration()` or the triggers are ignored.
- `hydrate never` ships no JavaScript at all for genuinely static content.
- Combine a load trigger with a hydrate trigger to download early and activate late.
- Never delay navigation, search or the primary action.
- It improves Total Blocking Time, not Largest Contentful Paint.

<code id="code-content" class="language-typescript">
import { Component, input } from '@angular/core';
import { provideClientHydration, withIncrementalHydration, withEventReplay }
  from '@angular/platform-browser';
export const appConfig = {
  providers: [
    // Without withIncrementalHydration the hydrate triggers are IGNORED
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
  ],
};
@Component({
  selector: 'app-article-page',
  template: `
    &lt;!-- above the fold: hydrated immediately, no @defer --&gt;
    &lt;app-article-header [article]="article()" /&gt;
    &lt;app-article-body [content]="article().body" /&gt;
    &lt;!-- THE KEY DIFFERENCE from ordinary @defer:
         with a `hydrate` trigger the content IS server rendered. It is in
         the HTML, visible immediately, and crawlers see it. What is delayed
         is downloading its JavaScript and making it INTERACTIVE. --&gt;
    @defer (hydrate on viewport) {
      &lt;app-related-articles [tags]="article().tags" /&gt;
    }
    @defer (hydrate on interaction) {
      &lt;app-comments [articleId]="article().id" /&gt;
    }
    &lt;!-- Two SEPARATE decisions: when to download, and when to activate.
         The chunk arrives as the user scrolls near it, so the click is
         instant. --&gt;
    @defer (on viewport; hydrate on interaction) {
      &lt;app-heavy-editor /&gt;
    }
    &lt;!-- Rendered, NEVER interactive, and its JavaScript is never shipped.
         A footer full of links does not need Angular. --&gt;
    @defer (hydrate never) {
      &lt;app-site-footer /&gt;
      &lt;app-legal-notice /&gt;
    }
  `,
})
export class ArticlePage {
  readonly article = input.required&lt;Article&gt;();
}
// Triggers: hydrate on viewport | interaction | hover | immediate
//           hydrate on timer(3s) | hydrate when condition() | hydrate never
// Nesting works, and an inner block cannot hydrate before its parent.
// If the inner trigger fires first, Angular hydrates the parents on the way.
// GOOD candidates: comments, related content, carousels, footers,
//   newsletter forms, social widgets, anything below the fold.
// BAD candidates: navigation, search, the primary call to action,
//   anything a user might touch in the first second.
// MEASURING: this improves TOTAL BLOCKING TIME and Interaction to Next
// Paint. It does NOT improve Largest Contentful Paint, because the content
// was already server rendered. Expecting otherwise is a misunderstanding.
// Requires SSR. Without server rendered HTML there is nothing to hydrate.
interface Article { id: number; body: string; tags: string[]; }
</code></pre>
