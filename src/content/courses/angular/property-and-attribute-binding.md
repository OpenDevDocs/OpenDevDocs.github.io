---
publishDate: 2026-06-03T06:40
title: Property, Attribute and Class Bindings
slug: property-and-attribute-binding
metadescription: Bind data into the DOM with square brackets, and learn when you need attr, class and style bindings instead.
updateDate: 2026-09-07T06:40
author: ['bishal-biswas']
level: 1
tags: ['bindings', 'templates', 'dom']
course: angular
---

## Square brackets set properties

Interpolation puts text between tags. **Property binding** sets a property on an element or component.

```html
<img [src]="imageUrl" [alt]="description">
<button [disabled]="isSaving">Save</button>
<input [value]="name">
<app-user-card [user]="currentUser()" />
```

Everything inside the quotes is a template expression, evaluated against the component.

## Properties are not attributes

This trips up nearly everyone once.

An **attribute** is what you write in HTML. A **property** is what lives on the DOM object at runtime. They start out matching and then drift apart.

```html
<input value="Asha">
```

Type in that box. The attribute still says `Asha`. The `value` property now holds what you typed.

Angular binds to **properties**, because that is what actually controls the live page.

```html
<button [disabled]="false">Click me</button>
```

That button is enabled. Written as an attribute it would not be, because the mere presence of `disabled` disables a button regardless of its value.

```html
<button disabled="false">Click me</button>   <!-- still disabled -->
```

## When to use interpolation instead

For string properties these are identical, so pick whichever reads better.

```html
<img src="{{ imageUrl }}">
<img [src]="imageUrl">
```

For anything not a string, you need brackets.

```html
<app-counter [count]="5" />        <!-- the number 5 -->
<app-counter count="5" />          <!-- the string '5' -->
<app-toggle [enabled]="true" />    <!-- boolean true -->
<app-toggle enabled="true" />      <!-- the string 'true', which is truthy... -->
```

The rule: **brackets pass a value, no brackets passes a string.**

## Attribute binding with attr

Some things exist only as attributes, with no matching DOM property. ARIA attributes, `colspan`, and SVG attributes are the common ones.

```html
<td [attr.colspan]="span">Total</td>
<button [attr.aria-label]="label">X</button>
<div [attr.data-user-id]="user.id"></div>
```

Without `attr.`, Angular looks for a property called `colspan` on the element, does not find one, and with `strictTemplates` on you get a build error.

Binding `null` removes the attribute entirely, which is the clean way to make one conditional:

```html
<button [attr.aria-disabled]="isDisabled ? 'true' : null">Save</button>
```

## Class binding

```html
<!-- one class, on or off -->
<div [class.active]="isActive">...</div>

<!-- several at once -->
<div [class]="{ active: isActive, disabled: isDisabled }">...</div>

<!-- a string of class names -->
<div [class]="cssClasses">...</div>

<!-- static and bound together -->
<div class="card" [class.selected]="isSelected">...</div>
```

Static `class` and bound `[class.x]` coexist. Angular merges them rather than one overwriting the other.

`[class.active]` is the one to reach for. It is direct and needs no import, unlike the older `ngClass` directive.

## Style binding

```html
<div [style.width.px]="width">...</div>
<div [style.color]="textColour">...</div>
<div [style.background-color]="bgColour">...</div>
<div [style]="{ width: '100px', color: 'red' }">...</div>
```

The `.px` suffix is a nice touch. It appends the unit, so the expression stays a number:

```html
<div [style.width.px]="200">      <!-- width: 200px -->
<div [style.width.%]="50">        <!-- width: 50% -->
<div [style.font-size.rem]="1.5"> <!-- font-size: 1.5rem -->
```

Prefer classes over inline styles for anything that is not genuinely dynamic. A bound class keeps the styling in your stylesheet where it belongs.

## Binding to components

Binding to a component input looks the same as binding to a DOM property.

```typescript
@Component({
  selector: 'app-user-card',
  template: `<p>{{ user().name }}</p>`,
})
export class UserCard {
  readonly user = input.required<User>();
  readonly compact = input(false);
}
```

```html
<app-user-card [user]="currentUser()" [compact]="true" />
```

With `strictTemplates`, passing the wrong type is a build error. Misspelling the input name is too.

## Two-way binding

The banana in a box, `[()]`, is shorthand for a property binding plus an event binding.

```html
<input [(ngModel)]="name">

<!-- exactly the same thing written out -->
<input [ngModel]="name" (ngModelChange)="name = $event">
```

For your own components it works with `model()`:

```typescript
export class Toggle {
  readonly checked = model(false);
}
```

```html
<app-toggle [(checked)]="isEnabled" />
```

The convention Angular follows is that `[(x)]` needs an input `x` and an output `xChange`. `model()` creates both for you.

## Dynamic property names

```html
<div [attr.data-test]="testId"></div>
<input [attr]="dynamicAttrs">     <!-- not supported -->
```

There is no way to bind a property whose **name** is computed. If you need that, set it in code with `ElementRef`, or reconsider the design, since it usually signals a structure problem.

## Common mistakes

**Brackets around a literal string.**

```html
<app-card [title]="Hello" />     <!-- looks for a property called Hello -->
<app-card title="Hello" />       <!-- correct -->
<app-card [title]="'Hello'" />   <!-- also correct, quoted inside -->
```

**Interpolation inside brackets.**

```html
<img [src]="{{ url }}">    <!-- wrong, double evaluation -->
<img [src]="url">          <!-- correct -->
<img src="{{ url }}">      <!-- also correct -->
```

**Forgetting `attr.` for ARIA.**

```html
<div [aria-label]="label">       <!-- error, no such property -->
<div [attr.aria-label]="label">  <!-- correct -->
```

## Quick recap

- `[property]` binds a value, plain text binds a string.
- Angular binds DOM properties, not HTML attributes, because properties reflect live state.
- Use `[attr.x]` for ARIA, `colspan`, `data-` and SVG, which have no matching property.
- Binding an attribute to `null` removes it.
- `[class.name]` and `[style.prop]` are direct and need no directive.
- `[style.width.px]` appends the unit so the expression stays a number.
- `[(x)]` is `[x]` plus `(xChange)`, and `model()` creates both.

<code id="code-content" class="language-typescript">
import { Component, signal, model } from '@angular/core';
@Component({
  selector: 'app-bindings',
  template: `
    &lt;!-- Brackets bind a VALUE. No brackets binds a STRING. --&gt;
    &lt;app-counter [count]="5" /&gt;        &lt;!-- the number 5 --&gt;
    &lt;app-counter count="5" /&gt;          &lt;!-- the string '5' --&gt;
    &lt;!-- Angular binds DOM PROPERTIES, not HTML attributes --&gt;
    &lt;button [disabled]="false"&gt;Enabled&lt;/button&gt;
    &lt;!-- as a plain attribute this would stay disabled: disabled="false" --&gt;
    &lt;!-- attr. is required where there is no matching DOM property --&gt;
    &lt;td [attr.colspan]="span"&gt;Total&lt;/td&gt;
    &lt;button [attr.aria-label]="label"&gt;X&lt;/button&gt;
    &lt;!-- binding null REMOVES the attribute --&gt;
    &lt;button [attr.aria-disabled]="busy() ? 'true' : null"&gt;Save&lt;/button&gt;
    &lt;!-- class binding: static and bound coexist and are merged --&gt;
    &lt;div class="card" [class.selected]="selected()"&gt;&lt;/div&gt;
    &lt;div [class]="{ active: selected(), muted: busy() }"&gt;&lt;/div&gt;
    &lt;!-- style binding, with a unit suffix so the value stays a number --&gt;
    &lt;div [style.width.px]="width()" [style.color]="colour()"&gt;&lt;/div&gt;
    &lt;!-- two-way binding is [x] plus (xChange), which model() creates --&gt;
    &lt;app-toggle [(checked)]="enabled" /&gt;
  `,
})
export class Bindings {
  protected readonly span = 3;
  protected readonly label = 'Close';
  protected readonly busy = signal(false);
  protected readonly selected = signal(true);
  protected readonly width = signal(200);
  protected readonly colour = signal('crimson');
  protected readonly enabled = signal(false);
}
@Component({ selector: 'app-toggle', template: `...` })
export class Toggle {
  readonly checked = model(false);      // gives you [checked] and (checkedChange)
}
// Common mistakes:
//   [title]="Hello"     wrong, looks for a property named Hello
//   [src]="{{ url }}"   wrong, double evaluation. Use [src]="url" or src="{{url}}"
//   [aria-label]="x"    wrong, needs [attr.aria-label]="x"
</code></pre>
