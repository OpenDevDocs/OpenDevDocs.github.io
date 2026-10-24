---
publishDate: 2026-06-04T07:05
title: Component Styles and View Encapsulation
slug: component-styles-and-view-encapsulation
metadescription: Scope styles to a component, understand how emulated encapsulation works, and reach outside it when you genuinely need to.
updateDate: 2026-09-07T07:05
author: ['bishal-biswas']
level: 1
tags: ['styles', 'css', 'encapsulation']
course: angular
---

## Styles belong to a component

```typescript
@Component({
  selector: 'app-card',
  template: `<div class="card"><ng-content /></div>`,
  styles: `
    .card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 1rem;
    }
  `,
})
export class Card {}
```

That `.card` rule applies **only inside this component**. Another component with a `.card` class is unaffected.

That is the default behaviour, and it removes the single biggest source of CSS pain in large applications.

## Where styles can live

```typescript
// inline, a string
@Component({ styles: `.card { color: red; }` })

// inline, an array (older style, still valid)
@Component({ styles: [`.card { color: red; }`] })

// a file
@Component({ styleUrl: './card.css' })

// several files
@Component({ styleUrls: ['./card.css', './card-theme.css'] })
```

Note the singular `styleUrl`, added in Angular 17. `styleUrls` with an array still works.

## How the scoping works

Angular does not use the shadow DOM by default. Instead it rewrites your CSS and adds attributes to the elements.

You write:

```css
.card { color: red; }
```

Angular emits:

```css
.card[_ngcontent-abc-1] { color: red; }
```

And the rendered HTML becomes:

```html
<div class="card" _ngcontent-abc-1>...</div>
```

The generated attribute is unique per component, so the selector cannot match anything else. Inspect an Angular page and those `_ngcontent` attributes are what you are seeing.

This is called **emulated** encapsulation, because it emulates shadow DOM scoping without using it.

## The three modes

```typescript
import { ViewEncapsulation } from '@angular/core';

@Component({
  encapsulation: ViewEncapsulation.Emulated,   // default
  // ViewEncapsulation.None
  // ViewEncapsulation.ShadowDom
})
```

**`Emulated`** is the default. Scoped by attribute rewriting. Global styles still reach in, which is usually what you want for theming.

**`None`** disables scoping entirely. The styles become global, exactly as if you had put them in `styles.css`. Use it deliberately or not at all.

**`ShadowDom`** uses real browser shadow DOM. Truly isolated, so global styles do **not** reach in. That breaks most theming and component libraries, so it is rare outside custom elements.

## Reaching into a child

Encapsulation stops a parent styling a child's internals, which is the point. Sometimes you genuinely need to, for example styling a third party component.

```css
/* does nothing, the child has a different attribute */
.parent .child-internal { color: red; }

/* works: pierces one level of encapsulation */
:host ::ng-deep .child-internal { color: red; }
```

`::ng-deep` is deprecated and has been for years, but nothing has replaced it and it is still the only option. Two rules make it safe:

**Always pair it with `:host`.** Without it, the rule becomes global and leaks into the entire application.

```css
::ng-deep .button { color: red; }        /* leaks everywhere */
:host ::ng-deep .button { color: red; }  /* only inside this component */
```

**Prefer a CSS custom property** when the library supports one:

```css
:host {
  --mat-button-color: crimson;
}
```

Custom properties cross encapsulation boundaries naturally, so they are the intended way for a library to expose theming.

## The host element

`:host` styles the component's own element.

```css
:host {
  display: block;          /* components are inline by default */
  padding: 1rem;
}

:host(.featured) {
  border: 2px solid gold;
}

:host-context(.dark-theme) {
  background: #222;
  color: #eee;
}
```

`display: block` on `:host` is worth knowing. A custom element defaults to `display: inline`, which makes width, height and margins behave unexpectedly. Setting it is a common first line.

`:host-context` matches based on an ancestor, which is the clean way to do theming without passing an input down.

## Setting host classes from the class

```typescript
@Component({
  selector: 'app-card',
  host: {
    'class': 'card',
    '[class.featured]': 'isFeatured()',
    '[style.--card-width.px]': 'width()',
  },
  template: `...`,
})
export class Card {
  readonly isFeatured = input(false);
  readonly width = input(300);
}
```

This keeps host styling with the component rather than requiring every caller to add classes.

## Global styles

`src/styles.css` is global. Put resets, fonts, CSS custom properties and third party imports there.

```css
:root {
  --brand: #dd0031;
  --radius: 8px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
```

Registered in `angular.json`:

```json
"styles": ["src/styles.css", "node_modules/some-lib/dist/theme.css"]
```

Custom properties defined globally are readable from any component, encapsulation or not. That makes them the right tool for a design system.

```css
/* in a component */
.card {
  border-radius: var(--radius);
  border-color: var(--brand);
}
```

## Dynamic styles

Do not build CSS strings. Bind classes and custom properties instead.

```typescript
@Component({
  template: `
    <div class="card" [class.selected]="selected()" [style.--accent]="colour()">
      ...
    </div>
  `,
  styles: `
    .card { border-left: 4px solid var(--accent, #ccc); }
    .card.selected { background: #f0f0f0; }
  `,
})
export class Card {
  readonly selected = input(false);
  readonly colour = input('#dd0031');
}
```

Binding a custom property gives you dynamic values while keeping all the actual CSS in the stylesheet.

## SCSS and preprocessors

```bash
ng new my-app --style=scss
```

Then component styles are `.scss` files and support nesting, variables and mixins. Shared SCSS needs importing per file, since each component is compiled separately:

```scss
@use '../../styles/variables' as v;

.card {
  color: v.$brand;
}
```

Native CSS custom properties are often the better choice now, because they are dynamic at runtime while SCSS variables are compiled away.

## Quick recap

- Component styles are scoped by default, so class names cannot collide.
- Angular emulates scoping by rewriting selectors and adding attributes.
- `ViewEncapsulation.None` makes styles global, and `ShadowDom` truly isolates them.
- `::ng-deep` still works but must be paired with `:host` or it leaks globally.
- CSS custom properties cross encapsulation boundaries and are the intended theming tool.
- `:host` styles the component element, and `display: block` is usually needed.
- Bind classes and custom properties rather than building style strings.

<code id="code-content" class="language-typescript">
import { Component, input, ViewEncapsulation } from '@angular/core';
@Component({
  selector: 'app-card',
  // Styles are SCOPED by default. This .card cannot collide with any other.
  styles: `
    /* components are display: inline by default, which surprises everyone */
    :host { display: block; }
    :host(.featured) { border: 2px solid gold; }
    :host-context(.dark-theme) { background: #222; color: #eee; }
    .card {
      border-left: 4px solid var(--accent, #ccc);   /* custom props cross scopes */
      border-radius: var(--radius, 8px);
      padding: 1rem;
    }
    .card.selected { background: #f0f0f0; }
    /* Reaching into a child: ALWAYS pair ::ng-deep with :host or it leaks */
    :host ::ng-deep .third-party-label { font-weight: 600; }
  `,
  host: {
    'class': 'card',
    '[class.featured]': 'featured()',
  },
  template: `
    &lt;div class="card" [class.selected]="selected()" [style.--accent]="colour()"&gt;
      &lt;ng-content /&gt;
    &lt;/div&gt;
  `,
  encapsulation: ViewEncapsulation.Emulated,   // the default
})
export class Card {
  readonly selected = input(false);
  readonly featured = input(false);
  readonly colour = input('#dd0031');
}
// How the scoping works: Angular rewrites your CSS and tags the elements.
//   you write:  .card { color: red; }
//   it emits:   .card[_ngcontent-abc-1] { color: red; }
//   the DOM:    &lt;div class="card" _ngcontent-abc-1&gt;
// ViewEncapsulation.None    -&gt; styles become global, same as styles.css
// ViewEncapsulation.ShadowDom -&gt; real isolation, but global theming cannot reach in
// Bind a custom property for dynamic values, do not build CSS strings:
//   [style.--accent]="colour()"   with   var(--accent) in the stylesheet
</code></pre>
