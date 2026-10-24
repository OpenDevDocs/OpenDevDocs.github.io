---
publishDate: 2026-06-11T08:50
title: Attribute Directives
slug: attribute-directives
metadescription: Write directives that add behaviour to existing elements, with inputs, host bindings and host listeners.
updateDate: 2026-09-07T08:50
author: ['bishal-biswas']
level: 2
tags: ['directives', 'behaviour', 'host']
course: angular
---

## Behaviour without a template

A component brings its own template. An **attribute directive** attaches behaviour to an element that already exists.

```typescript
import { Directive, ElementRef, inject } from '@angular/core';

@Directive({
  selector: '[appHighlight]',
})
export class Highlight {
  private readonly element = inject(ElementRef<HTMLElement>);

  constructor() {
    this.element.nativeElement.style.backgroundColor = 'yellow';
  }
}
```

```html
<p appHighlight>This is highlighted.</p>
```

The square brackets in the selector mean "match an element with this attribute". Camel case in the selector, camel case in the template.

## Prefer host bindings to direct DOM access

Setting styles directly works but fights with Angular. The `host` metadata is declarative and works with server-side rendering.

```typescript
@Directive({
  selector: '[appHighlight]',
  host: {
    '[style.background-color]': 'colour()',
    '[class.highlighted]': 'true',
  },
})
export class Highlight {
  readonly colour = input('yellow', { alias: 'appHighlight' });
}
```

```html
<p appHighlight>Default yellow</p>
<p [appHighlight]="'lightblue'">Blue</p>
<p [appHighlight]="userColour()">Dynamic</p>
```

Aliasing the input to the selector name is the standard trick. It lets the directive be applied and configured with one attribute.

## Reacting to events

```typescript
@Directive({
  selector: '[appHoverHighlight]',
  host: {
    '(mouseenter)': 'hovering.set(true)',
    '(mouseleave)': 'hovering.set(false)',
    '[style.background-color]': 'hovering() ? colour() : null',
    '[style.cursor]': '"pointer"',
  },
})
export class HoverHighlight {
  readonly colour = input('yellow', { alias: 'appHoverHighlight' });
  protected readonly hovering = signal(false);
}
```

Binding a style to `null` removes it, which is how you cleanly turn a style off.

Angular removes host listeners when the directive is destroyed, so there is nothing to clean up.

## A practical example: autofocus

```typescript
@Directive({
  selector: '[appAutofocus]',
})
export class Autofocus {
  private readonly element = inject(ElementRef<HTMLElement>);
  readonly enabled = input(true, { alias: 'appAutofocus', transform: booleanAttribute });

  constructor() {
    afterNextRender(() => {
      if (this.enabled()) this.element.nativeElement.focus();
    });
  }
}
```

```html
<input appAutofocus>
<input [appAutofocus]="isFirstField()">
```

`afterNextRender` is the right hook: the element exists, and it does not run on the server.

## Another: click outside

```typescript
@Directive({
  selector: '[appClickOutside]',
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class ClickOutside {
  readonly clickedOutside = output<void>();

  private readonly element = inject(ElementRef<HTMLElement>);

  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;

    if (!this.element.nativeElement.contains(target)) {
      this.clickedOutside.emit();
    }
  }
}
```

```html
<div appClickOutside (clickedOutside)="closeMenu()">
  <app-menu />
</div>
```

Directives can have outputs exactly like components.

## Directives are standalone too

```typescript
@Component({
  selector: 'app-page',
  imports: [Highlight, Autofocus],
  template: `
    <p appHighlight>Highlighted</p>
    <input appAutofocus>
  `,
})
export class Page {}
```

Forgetting the import is the most common directive problem. The template compiles fine, the attribute is just ignored, and nothing happens. There is no error, because `appHighlight` looks like a valid custom attribute.

If a directive silently does nothing, check the `imports` array first.

## Host directives

A component can apply directives to itself, composing behaviour without inheritance.

```typescript
@Component({
  selector: 'app-menu',
  hostDirectives: [
    {
      directive: ClickOutside,
      outputs: ['clickedOutside: dismissed'],
    },
    Autofocus,
  ],
  template: `...`,
})
export class Menu {}
```

```html
<app-menu (dismissed)="close()" />
```

Every `<app-menu>` gets the click outside behaviour, and callers see it as an ordinary output. Inputs and outputs can be renamed as they are exposed.

This is Angular's answer to mixins, and it composes far better than a base class.

## Injecting the host component

A directive can ask for the component it is attached to.

```typescript
@Directive({
  selector: '[appTrackCard]',
})
export class TrackCard {
  private readonly card = inject(UserCard);
  private readonly analytics = inject(AnalyticsService);

  constructor() {
    effect(() => this.analytics.track('card-shown', this.card.user().id));
  }
}
```

```html
<app-user-card [user]="user" appTrackCard />
```

Use `{ optional: true }` if the directive should also work on plain elements.

## Selectors

```typescript
@Directive({ selector: '[appHighlight]' })              // any element with the attribute
@Directive({ selector: 'button[appTracked]' })          // only buttons
@Directive({ selector: '[appHighlight]:not(a)' })       // excluding links
@Directive({ selector: 'input[type=email]' })           // by attribute value
@Directive({ selector: '[appA], [appB]' })              // either attribute
```

Narrow selectors are worth it. A directive that only applies to buttons cannot be misapplied to a `div`, and the compiler enforces it.

## Directive or component?

```text
Component     brings its own template and renders something
Directive     changes an element that already exists
```

If you find yourself writing a component whose only job is to wrap content and add behaviour, a directive is usually the better fit. It leaves the DOM alone.

## Common mistakes

**Forgetting the import.** Silent failure. Always check first.

**Manipulating the DOM directly** when a host binding would do. Bindings are declarative, survive re-renders and work on the server.

**Adding listeners with `addEventListener`** instead of a host listener, and then forgetting to remove them.

**Naming without a prefix.** `[highlight]` may collide with a future HTML attribute or another library. Prefix everything.

## Quick recap

- An attribute directive adds behaviour to an existing element and has no template.
- The selector uses square brackets, and aliasing the input to it lets one attribute do both jobs.
- Use `host` bindings and listeners rather than touching the DOM directly.
- Binding a style to `null` removes it.
- Directives can have inputs and outputs exactly like components.
- `hostDirectives` composes behaviour onto a component, replacing mixins and base classes.
- A directive that does nothing is almost always a missing entry in `imports`.

<code id="code-content" class="language-typescript">
import { Directive, Component, ElementRef, inject, input, output, signal,
         effect, booleanAttribute, afterNextRender } from '@angular/core';
// Square brackets in the selector mean "an element with this attribute".
// Aliasing the input to the selector lets ONE attribute apply and configure it.
@Directive({
  selector: '[appHighlight]',
  host: {
    '(mouseenter)': 'hovering.set(true)',
    '(mouseleave)': 'hovering.set(false)',
    // binding a style to null REMOVES it
    '[style.background-color]': 'hovering() ? colour() : null',
    '[class.highlighted]': 'hovering()',
  },
})
export class Highlight {
  readonly colour = input('yellow', { alias: 'appHighlight' });
  protected readonly hovering = signal(false);
}
// Used as:  &lt;p appHighlight&gt;  or  &lt;p [appHighlight]="'lightblue'"&gt;
// Directives can have OUTPUTS too
@Directive({
  selector: '[appClickOutside]',
  host: { '(document:click)': 'onClick($event)' },   // cleaned up automatically
})
export class ClickOutside {
  readonly clickedOutside = output&lt;void&gt;();
  private readonly element = inject(ElementRef&lt;HTMLElement&gt;);
  protected onClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node))
      this.clickedOutside.emit();
  }
}
// afterNextRender: the element exists, and it does not run on the server
@Directive({ selector: '[appAutofocus]' })
export class Autofocus {
  private readonly element = inject(ElementRef&lt;HTMLElement&gt;);
  readonly enabled = input(true, { alias: 'appAutofocus', transform: booleanAttribute });
  constructor() {
    afterNextRender(() =&gt; { if (this.enabled()) this.element.nativeElement.focus(); });
  }
}
// hostDirectives composes behaviour onto a component. Angular's answer to mixins,
// and it composes far better than a base class.
@Component({
  selector: 'app-menu',
  hostDirectives: [
    { directive: ClickOutside, outputs: ['clickedOutside: dismissed'] },
    Autofocus,
  ],
  template: `...`,
})
export class Menu {}
// Callers just see:  &lt;app-menu (dismissed)="close()" /&gt;
// Narrow selectors cannot be misapplied:
//   'button[appTracked]'      only buttons
//   '[appHighlight]:not(a)'   excluding links
//   'input[type=email]'       by attribute value
// A directive that silently does NOTHING is almost always missing from
// the component's imports array. There is no error, because the attribute
// looks like a valid custom attribute. Check imports first.
</code></pre>
