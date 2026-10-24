---
publishDate: 2026-06-12T09:15
title: Host Bindings and the host Metadata
slug: host-bindings
metadescription: 'Control a component or directive''s own element with the host metadata, and understand what replaced HostBinding and HostListener.'
updateDate: 2026-09-07T09:15
author: ['bishal-biswas']
level: 2
tags: ['host', 'bindings', 'directives']
course: angular
---

## The element a component lives in

A component renders inside its own tag. The `host` metadata controls that tag.

```typescript
@Component({
  selector: 'app-badge',
  host: {
    'class': 'badge',
    'role': 'status',
    '[class.badge-error]': 'type() === "error"',
    '[attr.aria-live]': 'urgent() ? "assertive" : "polite"',
    '(click)': 'onClick($event)',
  },
  template: `<ng-content />`,
})
export class Badge {
  readonly type = input<'info' | 'error'>('info');
  readonly urgent = input(false);

  protected onClick(event: MouseEvent): void { ... }
}
```

Rendered:

```html
<app-badge class="badge badge-error" role="status" aria-live="polite">
  Failed
</app-badge>
```

The caller writes `<app-badge type="error">` and everything else is applied by the component itself.

## What can go in host

```typescript
host: {
  // static attributes and classes
  'class': 'card elevated',
  'role': 'button',
  'tabindex': '0',

  // property bindings
  '[class.active]': 'isActive()',
  '[class]': 'computedClasses()',
  '[style.width.px]': 'width()',
  '[attr.aria-expanded]': 'expanded()',
  '[attr.disabled]': 'disabled() ? "" : null',
  '[id]': 'elementId()',

  // event listeners
  '(click)': 'toggle()',
  '(keydown.enter)': 'toggle()',
  '(keydown.escape)': 'close()',
  '(document:click)': 'onOutsideClick($event)',
  '(window:resize)': 'onResize()',
}
```

The expressions are evaluated against the component instance, exactly like a template.

## Global listeners

Prefixing with `document:` or `window:` listens globally, and Angular removes the listener when the component is destroyed.

```typescript
@Component({
  selector: 'app-dropdown',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'reposition()',
    '(document:keydown.escape)': 'close()',
  },
  template: `...`,
})
export class Dropdown {
  private readonly element = inject(ElementRef<HTMLElement>);
  protected readonly open = signal(false);

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
```

Doing this with `addEventListener` means remembering to remove it, and forgetting is a real memory leak.

## Static and bound classes merge

```typescript
host: {
  'class': 'badge',
  '[class.badge-error]': 'isError()',
}
```

Both apply. Angular tracks which classes it added, so the static one is never removed.

The caller can add more too:

```html
<app-badge class="mt-4">Text</app-badge>
```

That produces `class="badge mt-4"`, and the component's bound classes are added on top.

## Attributes need attr

Same rule as in templates. ARIA attributes and anything without a matching DOM property need the `attr.` prefix.

```typescript
host: {
  '[attr.aria-label]': 'label()',
  '[attr.aria-expanded]': 'expanded()',
  '[attr.data-state]': 'state()',
  '[attr.disabled]': 'disabled() ? "" : null',
}
```

Binding to `null` removes the attribute, which is how you make one conditional. For `disabled`, the empty string means present and `null` means absent.

## Display block

A custom element defaults to `display: inline`, which makes width, height, margin and padding behave oddly.

```typescript
@Component({
  selector: 'app-card',
  styles: `:host { display: block; }`,
  ...
})
```

Or bind it:

```typescript
host: {
  '[style.display]': '"block"',
}
```

The stylesheet version is better, since it does not run through change detection.

## The decorators it replaced

```typescript
// old
@Component({ selector: 'app-badge' })
export class BadgeComponent {
  @HostBinding('class.badge') badgeClass = true;
  @HostBinding('class.badge-error') get isError() { return this.type === 'error'; }
  @HostBinding('attr.role') role = 'status';

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) { ... }

  @HostListener('document:keydown.escape')
  onEscape() { ... }
}
```

```typescript
// new
@Component({
  selector: 'app-badge',
  host: {
    'class': 'badge',
    'role': 'status',
    '[class.badge-error]': 'type() === "error"',
    '(click)': 'onClick($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class Badge {
  protected onClick(event: MouseEvent) { ... }
  protected onEscape() { ... }
}
```

Both work, and `@HostBinding` and `@HostListener` are not deprecated. The `host` object is preferred because everything about the element is in one place, rather than scattered through the class.

There is also a performance note. `@HostBinding` on a getter runs that getter on every check. In the `host` object the expression is a normal binding, so with signals it only re-evaluates when a dependency changes.

## Host directives

`hostDirectives` applies directives to the component's own element, composing behaviour.

```typescript
@Component({
  selector: 'app-menu',
  hostDirectives: [
    ClickOutside,
    {
      directive: Tooltip,
      inputs: ['tooltipText: hint'],
      outputs: ['shown: tooltipShown'],
    },
  ],
  template: `...`,
})
export class Menu {}
```

```html
<app-menu hint="Open the menu" (tooltipShown)="track()" />
```

Inputs and outputs can be renamed as they are exposed, so the component controls its public API. This composes far better than inheritance, and several directives can be combined without conflict.

## Directives use host too

Everything above applies to directives, and it is where they do most of their work.

```typescript
@Directive({
  selector: 'button[appConfirm]',
  host: {
    '(click)': 'onClick($event)',
    '[attr.aria-describedby]': 'describedBy()',
  },
})
export class Confirm {
  readonly message = input('Are you sure?', { alias: 'appConfirm' });
  readonly confirmed = output<void>();

  protected onClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (confirm(this.message())) this.confirmed.emit();
  }
}
```

## Common mistakes

**Forgetting `attr.` for ARIA.** With `strictTemplates` it is a build error, which is helpful.

**Using a getter with `@HostBinding`.** It runs on every check.

**Setting a class from the constructor** with `ElementRef` instead of binding it. Bindings survive re-renders and work on the server.

**Assuming the caller's classes are replaced.** They are merged.

## Quick recap

- `host` controls the component or directive's own element.
- It takes static attributes, property bindings and event listeners in one object.
- `document:` and `window:` prefixes listen globally with automatic cleanup.
- Static and bound classes merge, including ones the caller adds.
- Use `attr.` for ARIA, and bind to `null` to remove an attribute.
- Set `:host { display: block }` on components that need layout.
- `hostDirectives` composes behaviour and can rename the exposed inputs and outputs.

<code id="code-content" class="language-typescript">
import { Component, Directive, input, output, signal, inject, ElementRef } from '@angular/core';
@Component({
  selector: 'app-dropdown',
  host: {
    // static attributes and classes
    'class': 'dropdown',
    'role': 'button',
    'tabindex': '0',
    // property bindings, evaluated against the component like a template
    '[class.open]': 'open()',
    '[style.width.px]': 'width()',
    // attr. for anything with no matching DOM property. null REMOVES it.
    '[attr.aria-expanded]': 'open()',
    '[attr.aria-disabled]': 'disabled() ? "true" : null',
    // events on the host element
    '(click)': 'toggle()',
    '(keydown.enter)': 'toggle()',
    // GLOBAL listeners, removed automatically when the component is destroyed
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
    '(window:resize)': 'reposition()',
  },
  // custom elements are display: inline by default, which breaks layout
  styles: `:host { display: block; }`,
  template: `&lt;ng-content /&gt;`,
})
export class Dropdown {
  readonly disabled = input(false);
  protected readonly open = signal(false);
  protected readonly width = signal(240);
  private readonly element = inject(ElementRef&lt;HTMLElement&gt;);
  protected toggle() { this.open.update(v =&gt; !v); }
  protected reposition() {}
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node))
      this.open.set(false);
  }
}
// Static and bound classes MERGE, including classes the caller adds:
//   &lt;app-dropdown class="mt-4"&gt;  -&gt;  class="dropdown mt-4 open"
// hostDirectives composes behaviour, renaming the exposed API as it goes
@Component({
  selector: 'app-menu',
  hostDirectives: [
    ClickOutside,
    { directive: Tooltip, inputs: ['tooltipText: hint'], outputs: ['shown: tooltipShown'] },
  ],
  template: `...`,
})
export class Menu {}
// Callers see:  &lt;app-menu hint="Open the menu" (tooltipShown)="track()" /&gt;
// What this replaced. Both still work, but @HostBinding on a GETTER runs
// that getter on every check, while a host expression only re-evaluates
// when a signal it reads changes.
//   @HostBinding('class.badge') badgeClass = true;
//   @HostBinding('class.error') get isError() { return this.type === 'error'; }
//   @HostListener('click', ['$event']) onClick(e: MouseEvent) {}
//   @HostListener('document:keydown.escape') onEscape() {}
</code></pre>
