---
publishDate: 2026-06-29T13:45
title: Custom Elements with Angular Elements
slug: angular-elements
metadescription: Package an Angular component as a custom element that any page can use, whatever framework it is built with.
updateDate: 2026-09-07T13:45
author: ['bishal-biswas']
level: 4
tags: ['web components', 'angular elements', 'integration']
course: angular
---

## An Angular component as a plain HTML tag

`@angular/elements` wraps a component in a **custom element**, part of the web components standard. The result works in a React application, a Vue application, a WordPress page or plain HTML.

```bash
npm install @angular/elements
```

```typescript
import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';

(async () => {
  const app = await createApplication({
    providers: [provideHttpClient()],
  });

  const element = createCustomElement(RatingWidget, { injector: app.injector });

  customElements.define('rating-widget', element);
})();
```

```html
<rating-widget product-id="42" max="5"></rating-widget>
```

No Angular knowledge required by whoever uses it. It is a tag.

## Inputs become attributes

```typescript
@Component({
  selector: 'app-rating-widget',
  template: `
    @for (star of stars(); track star) {
      <button (click)="select(star)" [class.filled]="star <= value()">★</button>
    }
  `,
})
export class RatingWidget {
  readonly productId = input.required<string>();
  readonly max = input(5, { transform: numberAttribute });
  readonly value = model(0);

  protected readonly stars = computed(() =>
    Array.from({ length: this.max() }, (_, i) => i + 1)
  );
}
```

Angular maps camel case inputs to dash separated attributes.

```html
<rating-widget product-id="42" max="5"></rating-widget>
```

**Attributes are always strings.** `max="5"` arrives as `'5'`, so `numberAttribute` and `booleanAttribute` transforms are essential rather than optional.

Setting a property in JavaScript passes the real value:

```javascript
const widget = document.querySelector('rating-widget');
widget.max = 10;              // a number
widget.config = { theme: 'dark' };   // an object, which an attribute cannot carry
```

## Outputs become DOM events

```typescript
export class RatingWidget {
  readonly rated = output<number>();
}
```

```javascript
document.querySelector('rating-widget')
  .addEventListener('rated', event => {
    console.log(event.detail);     // the emitted value
  });
```

The emitted value is in `event.detail`, which is the standard `CustomEvent` shape. Any framework can listen to it.

```html
// React
<rating-widget
  product-id="42"
  ref={el => el?.addEventListener('rated', e => setRating(e.detail))}
/>
```

## Building a bundle

```json
{
  "architect": {
    "build": {
      "options": {
        "outputHashing": "none",
        "browser": "src/elements.ts"
      }
    }
  }
}
```

```bash
ng build
```

`outputHashing: none` gives predictable filenames, which matters when a page includes the script by name.

For a single file that is easy to embed:

```json
{
  "scripts": {
    "build:elements": "ng build && cat dist/my-app/browser/*.js > dist/widget.js"
  }
}
```

Then anyone includes one script:

```html
<script src="https://cdn.example.com/widget.js"></script>
<rating-widget product-id="42"></rating-widget>
```

## Styling

By default, styles use Angular's emulated encapsulation, which means global page styles can still reach in. That is often unwanted for an embedded widget.

```typescript
@Component({
  selector: 'app-rating-widget',
  encapsulation: ViewEncapsulation.ShadowDom,
  styles: `
    :host { display: inline-block; }
    button { border: none; background: none; cursor: pointer; }
  `,
})
export class RatingWidget {}
```

`ShadowDom` gives real isolation. The host page's CSS cannot affect the widget, and the widget's CSS cannot leak out.

The cost is that the host page cannot theme it either. Expose CSS custom properties for the parts that should be configurable, since those do cross the shadow boundary:

```css
:host {
  --star-colour: gold;
}

button.filled {
  color: var(--star-colour);
}
```

```html
<rating-widget style="--star-colour: crimson"></rating-widget>
```

## Several elements in one bundle

```typescript
(async () => {
  const app = await createApplication({ providers: [provideHttpClient()] });

  const elements: [string, Type<unknown>][] = [
    ['rating-widget', RatingWidget],
    ['product-card', ProductCard],
    ['review-list', ReviewList],
  ];

  for (const [name, component] of elements) {
    if (!customElements.get(name)) {
      customElements.define(name, createCustomElement(component, { injector: app.injector }));
    }
  }
})();
```

The `customElements.get` check prevents an error if the script is somehow included twice. Custom element names cannot be redefined.

## Naming

Custom element names **must contain a hyphen**. That is a specification requirement separating them from current and future standard elements.

```text
rating-widget      valid
acme-rating        valid, and a prefix avoids collisions
rating             invalid, throws
ratingWidget       invalid
```

Prefix with something specific to you. A page might load widgets from several sources, and two `rating-widget` definitions is an error.

## The costs

**Bundle size.** Every bundle carries Angular. That is fine for a widget on a page that is already an Angular application, and heavy for a small widget on an otherwise light page. A rating widget shipping 100 KB of framework is a poor trade.

Several elements in one bundle share that cost, which is why grouping them matters.

**No shared state between separate bundles.** Two independently built element bundles on one page each have their own Angular. They cannot share services.

**Change detection.** Each element is its own application instance with its own change detection. Many elements on one page means many instances.

**Server rendering.** Custom elements are client side. They will not appear in server rendered HTML for crawlers.

## When to use them

**Good fits:**

- A widget embedded in a content management system or a marketing site.
- Sharing a component with teams using a different framework.
- Gradually migrating a legacy application, one component at a time.
- A design system consumed by more than one framework.

**Poor fits:**

- Anything inside an Angular application. Use a normal component.
- A small widget on a light page, where the framework weight dominates.
- Anything needing server rendering for SEO.

## The migration case

The strongest use. A legacy application can adopt Angular one component at a time.

```html
<!-- legacy page -->
<div id="old-header">...</div>

<user-profile user-id="42"></user-profile>

<div id="old-footer">...</div>
```

The new component is real Angular with routing, services and tests, dropped into a page that knows nothing about Angular. Over time more of the page becomes elements, and eventually the shell can be replaced.

That path avoids a rewrite, which is usually the only realistic option for a large legacy application.

## Quick recap

- `createCustomElement` turns an Angular component into a standard custom element.
- Camel case inputs become dash separated attributes, and attributes are always strings.
- Use `numberAttribute` and `booleanAttribute` transforms, and set objects as properties.
- Outputs become `CustomEvent`s with the value in `event.detail`.
- Use `ViewEncapsulation.ShadowDom` for real isolation, and expose custom properties for theming.
- Names must contain a hyphen, and a prefix avoids collisions.
- Every bundle carries Angular, so group elements and weigh the cost.

<code id="code-content" class="language-typescript">
import { Component, Type, input, output, model, computed,
         numberAttribute, ViewEncapsulation } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { provideHttpClient } from '@angular/common/http';
@Component({
  selector: 'app-rating-widget',
  // ShadowDom gives REAL isolation: the host page's CSS cannot reach in,
  // and this CSS cannot leak out. The cost is the page cannot theme it,
  // so expose custom properties, which DO cross the shadow boundary.
  encapsulation: ViewEncapsulation.ShadowDom,
  styles: `
    :host { display: inline-block; --star-colour: gold; }
    button.filled { color: var(--star-colour); }
  `,
  template: `
    @for (star of stars(); track star) {
      &lt;button (click)="rated.emit(star)" [class.filled]="star &lt;= value()"&gt;star&lt;/button&gt;
    }
  `,
})
export class RatingWidget {
  readonly productId = input.required&lt;string&gt;();
  // ATTRIBUTES ARE ALWAYS STRINGS. max="5" arrives as '5', so these
  // transforms are essential rather than optional.
  readonly max = input(5, { transform: numberAttribute });
  readonly value = model(0);
  readonly rated = output&lt;number&gt;();
  protected readonly stars = computed(() =&gt;
    Array.from({ length: this.max() }, (_, i) =&gt; i + 1));
}
// Register the elements. The customElements.get check prevents an error
// if the script is included twice: names cannot be redefined.
(async () =&gt; {
  const app = await createApplication({ providers: [provideHttpClient()] });
  const elements: [string, Type&lt;unknown&gt;][] = [
    ['acme-rating', RatingWidget],       // names MUST contain a hyphen, and
    ['acme-product-card', ProductCard],  // a prefix avoids collisions
  ];
  for (const [name, component] of elements) {
    if (!customElements.get(name)) {
      customElements.define(name,
        createCustomElement(component, { injector: app.injector }));
    }
  }
})();
// Used as a plain tag, by anyone, in any framework:
//   &lt;script src="https://cdn.example.com/widget.js"&gt;&lt;/script&gt;
//   &lt;acme-rating product-id="42" max="5" style="--star-colour: crimson"&gt;&lt;/acme-rating&gt;
// Outputs become CustomEvents, with the value in event.detail:
//   el.addEventListener('rated', e =&gt; console.log(e.detail));
// Objects cannot travel as attributes. Set them as PROPERTIES:
//   el.config = { theme: 'dark' };
//   el.max = 10;                  a real number, not a string
// Build with predictable filenames so a page can include it by name:
//   "outputHashing": "none"
// THE COSTS: every bundle carries Angular, so group elements together.
// Two separately built bundles on one page each get their own Angular and
// cannot share services. Custom elements are client side, so they do not
// appear in server rendered HTML for crawlers.
// THE STRONGEST USE: migrating a legacy application one component at a
// time, dropping real Angular components into a page that knows nothing
// about Angular. That avoids a rewrite, which is often the only realistic
// option for a large legacy codebase.
</code></pre>
