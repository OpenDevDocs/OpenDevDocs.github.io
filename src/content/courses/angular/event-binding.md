---
publishDate: 2026-06-03T06:45
title: Event Binding and Template Statements
slug: event-binding
metadescription: Respond to user actions with parentheses syntax, use the event object, and handle keyboard and custom component events.
updateDate: 2026-09-07T06:45
author: ['bishal-biswas']
level: 1
tags: ['events', 'bindings', 'templates']
course: angular
---

## Parentheses listen

```html
<button (click)="save()">Save</button>
<input (input)="onType($event)">
<form (submit)="onSubmit($event)">
<div (mouseenter)="hovering = true" (mouseleave)="hovering = false">
```

The name in parentheses is any DOM event, without the `on` prefix. `onclick` becomes `(click)`.

What is inside the quotes is a **template statement**, not an expression. Unlike interpolation, statements are allowed to have side effects, since that is their entire purpose.

```html
<button (click)="count = count + 1">Add</button>
<button (click)="save(); close()">Save and close</button>
```

## The event object

`$event` is the event, and its type depends on what you are listening to.

```html
<input (input)="onInput($event)">
<button (click)="onClick($event)">
```

```typescript
protected onInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  console.log(value);
}

protected onClick(event: MouseEvent): void {
  console.log(event.clientX, event.clientY);
  event.preventDefault();
}
```

The `as HTMLInputElement` cast is needed because `event.target` is typed as the general `EventTarget`. It is tedious and there are two better options.

**Template reference variable:**

```html
<input #box (input)="onInput(box.value)">
```

```typescript
protected onInput(value: string): void { ... }
```

**Two-way binding**, when you just want the value in a signal:

```html
<input [(ngModel)]="name">
```

## Preventing default and stopping propagation

```typescript
protected onSubmit(event: Event): void {
  event.preventDefault();
  this.save();
}
```

```html
<form (submit)="onSubmit($event)">
```

For submit specifically, `(ngSubmit)` from the forms module calls `preventDefault` for you:

```html
<form (ngSubmit)="save()">
```

Stopping propagation matters for nested handlers:

```html
<div (click)="selectRow()">
  <button (click)="remove(); $event.stopPropagation()">Delete</button>
</div>
```

Without `stopPropagation`, clicking Delete also selects the row.

## Keyboard events

Angular has a pseudo-event syntax for keys, which is far cleaner than checking `event.key`.

```html
<input (keyup.enter)="search()">
<input (keyup.escape)="cancel()">
<input (keydown.control.s)="save(); $event.preventDefault()">
<input (keydown.shift.tab)="focusPrevious()">
<div (keydown.arrowdown)="next()" (keydown.arrowup)="previous()" tabindex="0">
```

Key names are lowercase, and modifiers come first joined by dots. `control`, `shift`, `alt` and `meta` all work.

Without the pseudo-event you would write:

```typescript
protected onKeyup(event: KeyboardEvent): void {
  if (event.key === 'Enter') this.search();
}
```

## Component outputs

Listening to a component's own events looks the same as listening to a DOM event.

```typescript
@Component({
  selector: 'app-search-box',
  template: `<input (keyup.enter)="search.emit(term)">`,
})
export class SearchBox {
  readonly search = output<string>();
  protected term = '';
}
```

```html
<app-search-box (search)="runSearch($event)" />
```

Here `$event` is whatever the output emitted, typed as `string`. That type safety comes free with `output<string>()`.

## Host listeners

To listen to events on the component's own element, use the `host` metadata.

```typescript
@Component({
  selector: 'app-dropdown',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close()',
    '[class.open]': 'isOpen()',
  },
  template: `...`,
})
export class Dropdown {
  protected readonly isOpen = signal(false);

  protected onDocumentClick(event: MouseEvent): void { ... }
  protected close(): void { this.isOpen.set(false); }
}
```

Targets like `document:` and `window:` let you listen globally, and Angular removes the listener when the component is destroyed. Adding one yourself with `addEventListener` means remembering to clean it up.

The older `@HostListener` decorator does the same job:

```typescript
@HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent): void { ... }
```

Both work. The `host` object is now preferred because everything about the host element sits in one place.

## Events and change detection

In a zoneless application, calling a signal's `set` or `update` inside a handler is what schedules the re-render. That happens automatically.

```typescript
protected increment(): void {
  this.count.update(n => n + 1);   // schedules an update
}
```

If you mutate a plain field instead of a signal in a zoneless app, nothing re-renders. This is the most common surprise when moving to zoneless, and the fix is to use signals for anything the template reads.

## Passive and once

Angular does not expose `addEventListener` options in the template. For a passive scroll listener, add it manually.

```typescript
export class Scroller {
  private readonly element = inject(ElementRef<HTMLElement>);

  constructor() {
    const handler = () => this.onScroll();

    this.element.nativeElement.addEventListener('scroll', handler, { passive: true });

    inject(DestroyRef).onDestroy(() => {
      this.element.nativeElement.removeEventListener('scroll', handler);
    });
  }
}
```

`DestroyRef.onDestroy` is the tidy way to clean up without implementing `OnDestroy`.

## Common mistakes

**Calling the method instead of referencing it.**

```html
<button (click)="save">Save</button>     <!-- does nothing -->
<button (click)="save()">Save</button>   <!-- correct -->
```

This is the opposite of React, and catches people switching between the two.

**Forgetting `$event`.**

```html
<input (input)="onInput()">          <!-- no event passed -->
<input (input)="onInput($event)">    <!-- correct -->
```

**Heavy work in a handler.** Handlers run on the main thread. Debounce anything triggered by typing or scrolling.

## Quick recap

- `(event)` listens, and template statements may have side effects.
- `$event` is the DOM event, or the emitted value for a component output.
- A template reference variable avoids casting `event.target` everywhere.
- `(keyup.enter)` and `(keydown.control.s)` beat checking `event.key` by hand.
- `host` metadata listens on the component's own element, with cleanup handled.
- In zoneless applications, updating a signal is what triggers a re-render.
- Write `(click)="save()"` with parentheses, not `(click)="save"`.

<code id="code-content" class="language-typescript">
import { Component, signal, output, inject, DestroyRef, ElementRef } from '@angular/core';
@Component({
  selector: 'app-events',
  host: {
    '(document:click)': 'onOutsideClick($event)',   // global, cleaned up for you
    '(keydown.escape)': 'close()',
    '[class.open]': 'isOpen()',
  },
  template: `
    &lt;!-- statements MAY have side effects, unlike interpolation --&gt;
    &lt;button (click)="save()"&gt;Save&lt;/button&gt;
    &lt;button (click)="save(); close()"&gt;Save and close&lt;/button&gt;
    &lt;!-- a template reference variable avoids casting event.target --&gt;
    &lt;input #box (input)="onInput(box.value)"&gt;
    &lt;!-- key pseudo-events beat checking event.key by hand --&gt;
    &lt;input (keyup.enter)="search()" (keyup.escape)="close()"&gt;
    &lt;input (keydown.control.s)="save(); $event.preventDefault()"&gt;
    &lt;!-- stopPropagation so the row is not also selected --&gt;
    &lt;div (click)="selectRow()"&gt;
      &lt;button (click)="remove(); $event.stopPropagation()"&gt;Delete&lt;/button&gt;
    &lt;/div&gt;
    &lt;!-- listening to a component output: $event is the emitted value --&gt;
    &lt;app-search-box (search)="runSearch($event)" /&gt;
  `,
})
export class Events {
  protected readonly isOpen = signal(false);
  protected onInput(value: string): void { console.log(value); }
  protected save(): void {}
  protected close(): void { this.isOpen.set(false); }
  protected search(): void {}
  protected selectRow(): void {}
  protected remove(): void {}
  protected runSearch(term: string): void { console.log(term); }
  protected onOutsideClick(event: MouseEvent): void {}
}
@Component({ selector: 'app-search-box', template: `...` })
export class SearchBox {
  readonly search = output&lt;string&gt;();     // (search)="..." with $event: string
}
// Mistakes to avoid:
//   (click)="save"        does nothing, you must call it
//   (input)="onInput()"   forgot $event
// In a ZONELESS app, updating a signal is what schedules the re-render.
// Mutating a plain field will not update the view.
</code></pre>
