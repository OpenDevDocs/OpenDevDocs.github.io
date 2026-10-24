---
publishDate: 2026-06-12T09:00
title: NgClass, NgStyle and Dynamic Styling
slug: ngclass-and-ngstyle
metadescription: Apply classes and styles conditionally, and learn why the plain class and style bindings usually beat NgClass and NgStyle.
updateDate: 2026-09-07T09:00
author: ['bishal-biswas']
level: 2
tags: ['directives', 'styling', 'ngclass']
course: angular
---

## Two ways to do the same job

Angular has directives for dynamic classes and styles, and it has plain bindings. The plain bindings are almost always better.

```html
<!-- the directives, need importing -->
<div [ngClass]="{ active: isActive, disabled: isDisabled }">...</div>
<div [ngStyle]="{ color: textColour, 'font-size.px': size }">...</div>

<!-- the plain bindings, built in -->
<div [class.active]="isActive" [class.disabled]="isDisabled">...</div>
<div [style.color]="textColour" [style.font-size.px]="size">...</div>
```

Both produce the same result. The plain bindings need no import, are checked more strictly, and are faster because Angular handles them directly rather than through a directive.

## NgClass

```typescript
import { NgClass } from '@angular/common';

@Component({ imports: [NgClass], ... })
```

It accepts three shapes:

```html
<!-- an object: keys are class names, values decide on or off -->
<div [ngClass]="{ active: isActive, 'text-large': isBig }">...</div>

<!-- an array of class names to add -->
<div [ngClass]="['card', 'shadow']">...</div>

<!-- a string of space separated names -->
<div [ngClass]="'card shadow'">...</div>
```

The object form is what people use. It reads reasonably when there are several conditions.

```typescript
protected readonly classes = computed(() => ({
  'status-badge': true,
  'status-active': this.status() === 'active',
  'status-error': this.status() === 'error',
}));
```

```html
<span [ngClass]="classes()">{{ status() }}</span>
```

## The plain class binding

```html
<div [class.active]="isActive()">...</div>

<!-- an object, no directive needed -->
<div [class]="{ active: isActive(), disabled: isDisabled() }">...</div>

<!-- a string -->
<div [class]="classString()">...</div>

<!-- static and dynamic together, merged not replaced -->
<div class="card" [class.selected]="isSelected()">...</div>
```

`[class]` gained the object and array forms in Angular 9, which is what made `NgClass` unnecessary.

The important behaviour: static `class` and bound `[class.x]` **merge**. Angular tracks which classes it added, so a static class is never wiped out.

## NgStyle

```typescript
import { NgStyle } from '@angular/common';
```

```html
<div [ngStyle]="{ color: 'red', 'font-size.px': size, width: width + 'px' }">...</div>
```

The `.px` suffix works inside the object, which is a small convenience.

## The plain style binding

```html
<div [style.color]="colour()">...</div>
<div [style.width.px]="width()">...</div>
<div [style.width.%]="percent()">...</div>
<div [style.font-size.rem]="1.5">...</div>
<div [style]="{ color: 'red', width: '100px' }">...</div>
```

Same unit suffixes, no directive.

Binding to `null` removes the style, which is how you turn one off conditionally:

```html
<div [style.background-color]="highlighted() ? 'yellow' : null">...</div>
```

## Prefer classes to inline styles

This is the more important point than which syntax you use.

```html
<!-- avoid: styling logic in the template -->
<div [style.border]="selected() ? '2px solid blue' : '1px solid #ddd'"
     [style.background]="selected() ? '#eef' : 'white'">
```

```html
<!-- better: one class, styling in the stylesheet -->
<div class="card" [class.selected]="selected()">
```

```css
.card { border: 1px solid #ddd; background: white; }
.card.selected { border: 2px solid blue; background: #eef; }
```

The second version keeps CSS in CSS. It respects the cascade, supports media queries and hover states, and is far easier to change.

## When inline styles are right

For genuinely computed values that cannot be expressed as a class.

```html
<div class="bar" [style.width.%]="percentage()"></div>
<div class="swatch" [style.background-color]="userColour()"></div>
<div class="item" [style.transform]="'translateX(' + offset() + 'px)'"></div>
```

A progress bar's width, a user chosen colour, a drag offset. These are values, not states.

Even here, a CSS custom property is often cleaner:

```html
<div class="bar" [style.--fill]="percentage() + '%'"></div>
```

```css
.bar::after { width: var(--fill); }
```

Now the template supplies one number and the stylesheet decides what to do with it.

## Host classes

For a component's own element, use the `host` metadata rather than requiring every caller to add classes.

```typescript
@Component({
  selector: 'app-badge',
  host: {
    'class': 'badge',
    '[class.badge-error]': 'type() === "error"',
    '[class.badge-warning]': 'type() === "warning"',
    '[style.--badge-size.px]': 'size()',
  },
  template: `<ng-content />`,
})
export class Badge {
  readonly type = input<'info' | 'warning' | 'error'>('info');
  readonly size = input(14);
}
```

Callers write `<app-badge type="error">Failed</app-badge>` and the classes appear automatically.

## Performance

`NgClass` and `NgStyle` do more work than the plain bindings. They diff the object you pass on every change detection run, which means creating a new object literal in the template causes work every time.

```html
<!-- a new object every check -->
<div [ngClass]="{ active: isActive() }">
```

With signals and zoneless this matters far less than it used to, since the binding is only evaluated when a dependency changes. But the plain bindings avoid the question entirely.

## Migrating

There is no schematic, and no urgency. `NgClass` and `NgStyle` are not deprecated.

Convert when you are already editing a template. The mapping is direct:

```text
[ngClass]="{ a: x, b: y }"        ->  [class.a]="x" [class.b]="y"
[ngClass]="'a b'"                  ->  class="a b" or [class]="'a b'"
[ngClass]="['a', 'b']"             ->  [class]="['a', 'b']"
[ngStyle]="{ color: c }"           ->  [style.color]="c"
[ngStyle]="{ 'width.px': w }"      ->  [style.width.px]="w"
```

Removing them lets you drop `NgClass` and `NgStyle` from `imports`, and often drop `CommonModule` entirely.

## Common mistakes

**Expecting `[class]` to replace static classes.** It merges. That is deliberate.

**Using `ngStyle` for something that should be a class.** The most common styling mistake in Angular templates.

**Forgetting the import.** Like any directive, `NgClass` silently does nothing if it is not imported.

**Camel case style names.** Use the CSS name, `background-color`, not `backgroundColor`, in the binding form. Inside an `ngStyle` object either works.

## Quick recap

- `[class.name]` and `[style.prop]` are built in and need no import.
- `[class]` and `[style]` accept objects, strings and arrays, which made `NgClass` and `NgStyle` unnecessary.
- Static and bound classes merge rather than overwrite.
- Binding a style to `null` removes it.
- `[style.width.px]` appends the unit, keeping the expression a number.
- Prefer a class plus a stylesheet rule over inline styles for anything that is a state.
- Use `host` metadata to put classes on a component's own element.

<code id="code-content" class="language-typescript">
import { Component, input, signal, computed } from '@angular/core';
@Component({
  selector: 'app-badge',
  // host metadata puts classes on the component's OWN element,
  // so callers do not have to add them
  host: {
    'class': 'badge',
    '[class.badge-error]': 'type() === "error"',
    '[style.--badge-size.px]': 'size()',
  },
  template: `
    &lt;!-- BUILT IN, no import needed. Static and bound classes MERGE. --&gt;
    &lt;div class="card" [class.selected]="selected()" [class.busy]="busy()"&gt;&lt;/div&gt;
    &lt;!-- [class] also takes an object, a string or an array --&gt;
    &lt;div [class]="{ active: selected(), muted: busy() }"&gt;&lt;/div&gt;
    &lt;!-- unit suffixes keep the expression a number --&gt;
    &lt;div [style.width.px]="width()" [style.font-size.rem]="1.5"&gt;&lt;/div&gt;
    &lt;!-- binding a style to null REMOVES it --&gt;
    &lt;div [style.background-color]="selected() ? 'yellow' : null"&gt;&lt;/div&gt;
    &lt;!-- Inline styles are right for computed VALUES, not for states --&gt;
    &lt;div class="bar" [style.width.%]="percentage()"&gt;&lt;/div&gt;
    &lt;div class="swatch" [style.background-color]="userColour()"&gt;&lt;/div&gt;
    &lt;!-- Better still, hand the stylesheet one number --&gt;
    &lt;div class="bar" [style.--fill]="percentage() + '%'"&gt;&lt;/div&gt;
  `,
  styles: `
    .card { border: 1px solid #ddd; }
    .card.selected { border: 2px solid blue; }   /* states belong HERE */
    .bar::after { width: var(--fill); }
  `,
})
export class Badge {
  readonly type = input&lt;'info' | 'warning' | 'error'&gt;('info');
  readonly size = input(14);
  protected readonly selected = signal(false);
  protected readonly busy = signal(false);
  protected readonly width = signal(200);
  protected readonly percentage = signal(60);
  protected readonly userColour = signal('#dd0031');
}
// NgClass and NgStyle do the same job, need importing from @angular/common,
// and diff their object on every check. They are not deprecated, but the
// plain bindings are simpler and faster. The mapping is direct:
//   [ngClass]="{ a: x }"           -&gt;  [class.a]="x"
//   [ngClass]="['a','b']"          -&gt;  [class]="['a','b']"
//   [ngStyle]="{ color: c }"       -&gt;  [style.color]="c"
//   [ngStyle]="{ 'width.px': w }"  -&gt;  [style.width.px]="w"
// Removing them often lets you drop CommonModule from imports entirely.
</code></pre>
