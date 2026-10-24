---
publishDate: 2026-06-08T07:55
title: 'Signal Queries: viewChild, viewChildren and contentChild'
slug: signal-queries
metadescription: Find child elements, components and projected content as signals with viewChild, viewChildren, contentChild and contentChildren.
updateDate: 2026-09-07T07:55
author: ['bishal-biswas']
level: 2
tags: ['signals', 'queries', 'viewchild']
course: angular
---

## Reaching into the template

A query finds something rendered by your component and gives you a handle to it.

```typescript
import { Component, viewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-search',
  template: `
    <input #box>
    <button (click)="focusInput()">Focus</button>
  `,
})
export class Search {
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

  protected focusInput(): void {
    this.box()?.nativeElement.focus();
  }
}
```

`viewChild` returns a **signal**. Reading it with brackets gives the current result, or `undefined` before the view exists.

## Required queries

```typescript
private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

protected focusInput(): void {
  this.box().nativeElement.focus();      // no ?. needed
}
```

`required` removes `undefined` from the type. It throws if the element is genuinely missing, which is what you want for something that is always in the template.

Use `required` for elements outside any `@if`. Use the plain version for anything conditional.

## The four queries

```text
viewChild        one thing in this component's own template
viewChildren     all matching things in this component's template
contentChild     one thing projected in via ng-content
contentChildren  all matching projected things
```

**View** means markup this component owns. **Content** means markup the caller passed in.

```typescript
@Component({
  selector: 'app-tabs',
  template: `
    <nav #tabBar></nav>       <!-- view: mine -->
    <ng-content />            <!-- content: the caller's -->
  `,
})
export class Tabs {
  readonly bar = viewChild.required<ElementRef>('tabBar');
  readonly panels = contentChildren(TabPanel);
}
```

## What you can query for

```typescript
// a template reference variable
readonly box = viewChild<ElementRef>('box');

// a component type
readonly child = viewChild(UserCard);

// a directive type
readonly tooltip = viewChild(TooltipDirective);

// a TemplateRef
readonly row = contentChild(TemplateRef);

// with an explicit read
readonly element = viewChild('box', { read: ElementRef });
readonly container = viewChild('slot', { read: ViewContainerRef });
```

The `read` option matters when one element could give you several things. A component tag can yield the component instance, its `ElementRef`, or its `ViewContainerRef`.

```typescript
readonly instance = viewChild(UserCard);                        // the component
readonly element = viewChild(UserCard, { read: ElementRef });   // its DOM element
```

## Queries are reactive

This is the improvement over the decorator versions. A signal query updates automatically as the DOM changes.

```typescript
@Component({
  template: `
    @for (item of items(); track item.id) {
      <app-row [item]="item" />
    }
    <p>{{ rows().length }} rows rendered</p>
  `,
})
export class List {
  readonly items = signal<Item[]>([]);
  protected readonly rows = viewChildren(Row);
}
```

Add an item and `rows()` grows. No lifecycle hook, no `QueryList` subscription.

`viewChildren` returns a `Signal<readonly T[]>`, so it composes with `computed`:

```typescript
protected readonly rowCount = computed(() => this.rows().length);
protected readonly anySelected = computed(() => this.rows().some(r => r.selected()));
```

## Descendants

`contentChildren` only looks at direct children by default. Pass `descendants` to search deeper.

```typescript
readonly items = contentChildren(MenuItem);                        // direct children
readonly allItems = contentChildren(MenuItem, { descendants: true }); // nested too
```

`viewChildren` always searches the whole view.

## When results are available

Queries resolve after the view is created. Reading one in a constructor gives `undefined`.

```typescript
export class Search {
  private readonly box = viewChild<ElementRef>('box');

  constructor() {
    console.log(this.box());          // undefined
  }

  ngAfterViewInit(): void {
    console.log(this.box());          // the element
  }
}
```

Better than a lifecycle hook, use an effect. It runs when the query resolves and again if it changes.

```typescript
constructor() {
  effect(() => {
    const box = this.box();
    if (box) box.nativeElement.focus();
  });
}
```

For anything measuring layout, use `afterRenderEffect` instead.

## A worked example

```typescript
@Component({
  selector: 'app-accordion',
  template: `<ng-content />`,
})
export class Accordion {
  readonly panels = contentChildren(AccordionPanel);

  constructor() {
    effect(() => {
      const panels = this.panels();

      // close every panel except the open one
      const open = panels.find(p => p.expanded());

      untracked(() => {
        for (const panel of panels) {
          if (panel !== open) panel.expanded.set(false);
        }
      });
    });
  }
}
```

```html
<app-accordion>
  <app-accordion-panel title="One">...</app-accordion-panel>
  <app-accordion-panel title="Two">...</app-accordion-panel>
</app-accordion>
```

The accordion coordinates panels it did not create. This is the pattern behind tabs, steppers, radio groups and menus.

## What changed from the decorators

```typescript
// old
@ViewChild('box') box!: ElementRef;
@ViewChild('box', { static: true }) staticBox!: ElementRef;
@ViewChildren(Row) rows!: QueryList<Row>;
@ContentChildren(Tab, { descendants: true }) tabs!: QueryList<Tab>;

ngAfterViewInit(): void {
  this.rows.changes.subscribe(() => this.recount());
}
```

```typescript
// new
readonly box = viewChild.required<ElementRef>('box');
readonly rows = viewChildren(Row);
readonly tabs = contentChildren(Tab, { descendants: true });

protected readonly count = computed(() => this.rows().length);
```

Three real gains:

**No `static` option.** That flag existed because results appeared at different times depending on whether the element was inside an `*ngIf`. Signals removed the problem.

**No `QueryList`.** A custom collection with its own `changes` observable is replaced by a plain array in a signal.

**No lifecycle hooks.** `computed` and `effect` react to query changes directly.

Migrate with:

```bash
ng generate @angular/core:signal-queries-migration
```

## Common mistakes

**Reading a query in a field initialiser.**

```typescript
readonly box = viewChild<ElementRef>('box');
readonly width = this.box()?.nativeElement.offsetWidth;   // undefined, too early
```

**Querying inside `@if` with `required`.** It throws when the condition is false. Use the optional form.

**Mutating the DOM found by a query.** Angular owns that DOM. Prefer bindings, and reach for direct manipulation only for focus, scroll and measurement.

## Quick recap

- `viewChild` and `viewChildren` find things in your own template.
- `contentChild` and `contentChildren` find things projected in by the caller.
- All four return signals, so they compose with `computed` and `effect`.
- `.required` removes `undefined` but throws if the target is missing.
- Use `read` when one element could yield several different things.
- `contentChildren` needs `descendants: true` to look past direct children.
- Signal queries removed the `static` flag, `QueryList` and the lifecycle hooks.

<code id="code-content" class="language-typescript">
import { Component, ElementRef, TemplateRef, ViewContainerRef, signal,
         computed, effect, untracked, viewChild, viewChildren,
         contentChild, contentChildren } from '@angular/core';
@Component({
  selector: 'app-queries',
  template: `
    &lt;input #box&gt;
    @for (item of items(); track item.id) { &lt;app-row [item]="item" /&gt; }
    &lt;ng-content /&gt;
  `,
})
export class Queries {
  readonly items = signal&lt;{ id: number }[]&gt;([]);
  // VIEW = markup this component owns
  private readonly box = viewChild.required&lt;ElementRef&lt;HTMLInputElement&gt;&gt;('box');
  protected readonly rows = viewChildren(Row);
  // CONTENT = markup the caller projected in
  readonly panels = contentChildren(Panel, { descendants: true });
  readonly rowTemplate = contentChild(TemplateRef);
  // `read` picks WHICH thing you get from one element
  private readonly instance = viewChild(Row);
  private readonly element = viewChild(Row, { read: ElementRef });
  private readonly slot = viewChild('box', { read: ViewContainerRef });
  // Queries are SIGNALS, so they compose. No QueryList, no changes subscription.
  protected readonly rowCount = computed(() =&gt; this.rows().length);
  constructor() {
    // Runs when the query resolves, and again whenever it changes.
    // Better than ngAfterViewInit.
    effect(() =&gt; this.box().nativeElement.focus());
    // Coordinating projected children: the accordion pattern
    effect(() =&gt; {
      const panels = this.panels();
      const open = panels.find(p =&gt; p.expanded());
      untracked(() =&gt; {
        for (const p of panels) if (p !== open) p.expanded.set(false);
      });
    });
  }
}
@Component({ selector: 'app-row', template: `` })
export class Row {}
@Component({ selector: 'app-panel', template: `` })
export class Panel { readonly expanded = signal(false); }
// What went away compared with @ViewChild:
//   { static: true }        no longer needed, signals removed the timing problem
//   QueryList&lt;T&gt;            now a plain readonly array in a signal
//   ngAfterViewInit         use effect() or computed() instead
// Migrate with:  ng generate @angular/core:signal-queries-migration
// Reading a query in a FIELD INITIALISER is too early and gives undefined.
</code></pre>
