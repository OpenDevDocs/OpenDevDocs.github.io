---
publishDate: 2026-06-05T07:10
title: Content Projection with ng-content
slug: content-projection
metadescription: Pass markup into a component with ng-content, use named slots, and build flexible layout components.
updateDate: 2026-09-07T07:10
author: ['bishal-biswas']
level: 2
tags: ['content projection', 'ng-content', 'components']
course: angular
---

## Passing markup in

Inputs pass data. **Content projection** passes markup.

```typescript
@Component({
  selector: 'app-card',
  template: `
    <div class="card">
      <ng-content />
    </div>
  `,
})
export class Card {}
```

```html
<app-card>
  <h2>Title</h2>
  <p>Anything at all goes here.</p>
</app-card>
```

Whatever sits between the tags is rendered where `<ng-content />` is. The card supplies the wrapper and the styling, and the caller supplies the content.

This is how you build reusable layout components: cards, dialogs, panels, tabs, page shells.

## Named slots

One `ng-content` takes everything. Several named ones let the caller fill specific places.

```typescript
@Component({
  selector: 'app-panel',
  template: `
    <section class="panel">
      <header><ng-content select="[panel-title]" /></header>
      <div class="body"><ng-content /></div>
      <footer><ng-content select="[panel-actions]" /></footer>
    </section>
  `,
})
export class Panel {}
```

```html
<app-panel>
  <h2 panel-title>Settings</h2>

  <p>Body content goes in the unnamed slot.</p>

  <div panel-actions>
    <button>Cancel</button>
    <button>Save</button>
  </div>
</app-panel>
```

The `select` attribute takes any CSS selector:

```html
<ng-content select="[panel-title]" />      <!-- attribute -->
<ng-content select=".header" />            <!-- class -->
<ng-content select="h2" />                 <!-- element -->
<ng-content select="app-icon" />           <!-- component -->
<ng-content select="button.primary" />     <!-- combined -->
```

Attribute selectors are the usual choice, because they do not constrain what element the caller uses.

## The unnamed slot is a catch-all

Anything not matching a named slot goes to the unnamed one. Order matters in a subtle way: put the unnamed slot **last** in your thinking, since it collects the leftovers regardless of where it appears.

With no unnamed slot, unmatched content is simply dropped.

```typescript
@Component({
  selector: 'app-strict',
  template: `<ng-content select="[header]" />`,
})
```

```html
<app-strict>
  <h2 header>Shown</h2>
  <p>Silently discarded</p>
</app-strict>
```

That silent discarding catches people out, so include an unnamed slot unless you mean to reject extra content.

## Fallback content

If nothing is projected into a slot, Angular renders whatever is inside the `ng-content` tags instead.

```html
<ng-content select="[card-title]">
  <h2>Untitled</h2>
</ng-content>
```

This landed in Angular 18 and removes a lot of awkward `@if` checks around empty slots.

## Conditional projection

Wrapping `ng-content` in `@if` does not work the way you expect.

```html
@if (expanded()) {
  <ng-content />       <!-- projected content is NOT re-created -->
}
```

Projected content is created by the **parent**, once. The child cannot create or destroy it, only choose where to place it, and only in one place.

For content that should be created lazily, take a template instead:

```typescript
@Component({
  selector: 'app-collapsible',
  template: `
    <button (click)="toggle()">Toggle</button>
    @if (open()) {
      <ng-container [ngTemplateOutlet]="body()" />
    }
  `,
  imports: [NgTemplateOutlet],
})
export class Collapsible {
  readonly body = contentChild.required(TemplateRef);
  protected readonly open = signal(false);
  protected toggle(): void { this.open.update(v => !v); }
}
```

```html
<app-collapsible>
  <ng-template>
    <p>Only created when opened.</p>
  </ng-template>
</app-collapsible>
```

Now the content genuinely is not created until it is needed.

## Projecting into several places

A single `ng-content` can only appear once. Using the same selector twice renders the content in the last position only.

```html
<!-- does not duplicate the content -->
<ng-content select="[title]" />
<ng-content select="[title]" />
```

Use a template and `ngTemplateOutlet` when you need the same content in more than one place.

## Querying projected content

`contentChild` and `contentChildren` reach into what was projected.

```typescript
@Component({
  selector: 'app-tabs',
  template: `
    <nav>
      @for (tab of tabs(); track tab.id()) {
        <button (click)="select(tab)" [class.active]="tab === active()">
          {{ tab.label() }}
        </button>
      }
    </nav>
    <ng-content />
  `,
})
export class Tabs {
  readonly tabs = contentChildren(Tab);
  protected readonly active = signal<Tab | undefined>(undefined);

  protected select(tab: Tab): void { this.active.set(tab); }
}
```

```html
<app-tabs>
  <app-tab label="First">...</app-tab>
  <app-tab label="Second">...</app-tab>
</app-tabs>
```

The tabs component discovers its children and builds the navigation. This is how most tab, accordion and stepper components work.

Note `contentChildren` returns a signal, so the tab list updates automatically when children are added or removed.

## Styling projected content

Projected content keeps the **parent's** encapsulation, not the child's. The child's own styles cannot reach it.

```typescript
@Component({
  selector: 'app-card',
  template: `<div class="card"><ng-content /></div>`,
  styles: `
    .card { padding: 1rem; }
    .card h2 { color: red; }         /* does NOT affect projected h2 */
    :host ::ng-deep h2 { color: red; }  /* does */
  `,
})
```

This surprises people regularly. The content belongs to whoever wrote it, so it carries their scoping attributes.

Better than `::ng-deep`: style the wrapper and expose custom properties for the rest.

## Projection or an input?

```html
<!-- an input: for data -->
<app-card title="Settings" [count]="5" />

<!-- projection: for markup -->
<app-card>
  <h2>Settings <app-badge>New</app-badge></h2>
</app-card>
```

Use an input when the value is data the component formats. Use projection when the caller needs control over the markup, including nesting other components.

A component often takes both.

## Quick recap

- `<ng-content />` renders whatever the caller put between the tags.
- `select="[attr]"` creates named slots, and unmatched content falls into the unnamed one.
- With no unnamed slot, extra content is silently discarded.
- Content inside `ng-content` tags is fallback for when nothing is projected.
- Projected content is created by the parent, so `@if` around `ng-content` does not delay it.
- Use `TemplateRef` with `ngTemplateOutlet` for genuinely lazy or repeated content.
- Projected content keeps the parent's style encapsulation, not the child's.

<code id="code-content" class="language-typescript">
import { Component, signal, contentChild, contentChildren, TemplateRef, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
// Inputs pass DATA. Content projection passes MARKUP.
@Component({
  selector: 'app-panel',
  template: `
    &lt;section class="panel"&gt;
      &lt;!-- named slots, matched by CSS selector --&gt;
      &lt;header&gt;
        &lt;ng-content select="[panel-title]"&gt;
          &lt;h2&gt;Untitled&lt;/h2&gt;         &lt;!-- fallback when nothing is projected --&gt;
        &lt;/ng-content&gt;
      &lt;/header&gt;
      &lt;div class="body"&gt;&lt;ng-content /&gt;&lt;/div&gt;   &lt;!-- catch-all --&gt;
      &lt;footer&gt;&lt;ng-content select="[panel-actions]" /&gt;&lt;/footer&gt;
    &lt;/section&gt;
  `,
  styles: `
    .panel h2 { color: red; }             /* does NOT reach projected content */
    :host ::ng-deep h2 { color: red; }    /* does, because projection keeps the
                                             PARENT's encapsulation */
  `,
})
export class Panel {}
// Usage:
//   &lt;app-panel&gt;
//     &lt;h2 panel-title&gt;Settings&lt;/h2&gt;
//     &lt;p&gt;Body goes in the unnamed slot.&lt;/p&gt;
//     &lt;div panel-actions&gt;&lt;button&gt;Save&lt;/button&gt;&lt;/div&gt;
//   &lt;/app-panel&gt;
// With NO unnamed slot, unmatched content is silently DISCARDED.
// @if around ng-content does not delay creation. The PARENT creates it, once.
// For genuinely lazy content, take a TemplateRef instead:
@Component({
  selector: 'app-collapsible',
  imports: [NgTemplateOutlet],
  template: `
    &lt;button (click)="open.set(!open())"&gt;Toggle&lt;/button&gt;
    @if (open()) { &lt;ng-container [ngTemplateOutlet]="body()" /&gt; }
  `,
})
export class Collapsible {
  readonly body = contentChild.required(TemplateRef);
  protected readonly open = signal(false);
}
// contentChildren discovers projected components. This is how tabs work.
@Component({ selector: 'app-tabs', template: `&lt;ng-content /&gt;` })
export class Tabs {
  readonly tabs = contentChildren(Tab);      // a signal, updates automatically
}
@Component({ selector: 'app-tab', template: `` })
export class Tab { readonly label = input(''); }
</code></pre>
