---
publishDate: 2026-06-05T07:15
title: ng-template, ng-container and TemplateRef
slug: ng-template-and-ng-container
metadescription: Define reusable template fragments, group elements without adding a wrapper, and render templates dynamically with ngTemplateOutlet.
updateDate: 2026-09-07T07:15
author: ['bishal-biswas']
level: 2
tags: ['templates', 'ng-template', 'ng-container']
course: angular
---

## ng-container groups without adding an element

Sometimes you need a wrapper for Angular's benefit but not in the DOM.

```html
<!-- adds a pointless div to the page -->
<div *ngIf="visible">
  <li>One</li>
  <li>Two</li>
</div>

<!-- renders nothing itself -->
<ng-container *ngIf="visible">
  <li>One</li>
  <li>Two</li>
</ng-container>
```

`<ng-container>` disappears at runtime. Nothing is added to the DOM. That matters inside tables, lists and flex or grid layouts, where a stray `div` breaks the structure.

```html
<table>
  <tbody>
    <ng-container *ngFor="let group of groups">
      <tr class="group-header"><td>{{ group.name }}</td></tr>
      <tr *ngFor="let row of group.rows"><td>{{ row.value }}</td></tr>
    </ng-container>
  </tbody>
</table>
```

Wrapping those rows in a `div` would produce invalid HTML. `ng-container` does not.

The other classic use is combining two structural directives, which cannot share an element:

```html
<ng-container *ngFor="let item of items">
  <li *ngIf="item.visible">{{ item.name }}</li>
</ng-container>
```

## Control flow blocks made this less necessary

With `@if` and `@for`, most of those cases disappear.

```html
@for (group of groups(); track group.id) {
  <tr class="group-header"><td>{{ group.name }}</td></tr>
  @for (row of group.rows; track row.id) {
    <tr><td>{{ row.value }}</td></tr>
  }
}
```

No wrapper needed at all, because blocks are not elements. `ng-container` is still useful with `ngTemplateOutlet` and with directives, but you will reach for it far less often.

## ng-template defines, it does not render

```html
<ng-template #greeting>
  <p>Hello there</p>
</ng-template>
```

That renders **nothing**. `ng-template` defines a fragment of markup for something else to use later.

Three things use them: structural directives, `ngTemplateOutlet`, and components that accept a template as input.

## ngTemplateOutlet

```html
<ng-template #greeting>
  <p>Hello there</p>
</ng-template>

<ng-container [ngTemplateOutlet]="greeting" />
<ng-container [ngTemplateOutlet]="greeting" />
```

Now it renders, twice. This is the way to reuse a fragment without creating a component.

Needs importing:

```typescript
import { NgTemplateOutlet } from '@angular/common';

@Component({ imports: [NgTemplateOutlet], ... })
```

## Passing data to a template

Templates take context, declared with `let-` bindings.

```html
<ng-template #row let-user let-index="i">
  <tr>
    <td>{{ index }}</td>
    <td>{{ user.name }}</td>
  </tr>
</ng-template>

<ng-container
  [ngTemplateOutlet]="row"
  [ngTemplateOutletContext]="{ $implicit: currentUser, i: 0 }" />
```

`$implicit` is the default value, bound by a bare `let-user`. Other keys are bound by name with `let-index="i"`.

This is exactly how `*ngFor` works internally, which is why `let item of items` looks the way it does.

## Choosing a template at runtime

```typescript
@Component({
  selector: 'app-status',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #loading><app-spinner /></ng-template>
    <ng-template #error><p class="error">Failed</p></ng-template>
    <ng-template #ready><app-results [data]="data()" /></ng-template>

    <ng-container [ngTemplateOutlet]="templateFor()" />
  `,
})
export class Status {
  readonly state = input<'loading' | 'error' | 'ready'>('loading');

  private readonly loading = viewChild.required<TemplateRef<unknown>>('loading');
  private readonly error = viewChild.required<TemplateRef<unknown>>('error');
  private readonly ready = viewChild.required<TemplateRef<unknown>>('ready');

  protected readonly templateFor = computed(() => {
    switch (this.state()) {
      case 'loading': return this.loading();
      case 'error': return this.error();
      case 'ready': return this.ready();
    }
  });
}
```

An `@switch` block is simpler for this specific case. The template approach earns its keep when the choice is made somewhere else, or when templates are passed in from outside.

## Accepting a template as input

This is the powerful pattern. A component takes markup from its caller and decides when and how often to render it.

```typescript
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet],
  template: `
    <table>
      @for (row of rows(); track row.id) {
        <ng-container
          [ngTemplateOutlet]="rowTemplate()"
          [ngTemplateOutletContext]="{ $implicit: row }" />
      }
    </table>
  `,
})
export class DataTable<T extends { id: number }> {
  readonly rows = input.required<T[]>();
  readonly rowTemplate = input.required<TemplateRef<{ $implicit: T }>>();
}
```

```html
<ng-template #userRow let-user>
  <tr>
    <td>{{ user.name }}</td>
    <td>{{ user.email }}</td>
  </tr>
</ng-template>

<app-data-table [rows]="users()" [rowTemplate]="userRow" />
```

The table owns the looping, sorting and paging. The caller owns what a row looks like. Neither knows about the other's concerns.

Nearly every serious Angular table and list library is built this way.

## Getting a template with contentChild

Instead of an input, take the template from projected content.

```typescript
@Component({
  selector: 'app-repeater',
  imports: [NgTemplateOutlet],
  template: `
    @for (item of items(); track $index) {
      <ng-container
        [ngTemplateOutlet]="itemTemplate()"
        [ngTemplateOutletContext]="{ $implicit: item }" />
    }
  `,
})
export class Repeater {
  readonly items = input.required<unknown[]>();
  readonly itemTemplate = contentChild.required(TemplateRef);
}
```

```html
<app-repeater [items]="products()">
  <ng-template let-product>
    <app-product-card [product]="product" />
  </ng-template>
</app-repeater>
```

Slightly nicer to call, since there is no named reference to wire up.

## Creating a view in code

For full control, use `ViewContainerRef`.

```typescript
export class Manual {
  private readonly container = inject(ViewContainerRef);
  private readonly template = viewChild.required<TemplateRef<unknown>>('tpl');

  show(): void {
    this.container.createEmbeddedView(this.template(), { $implicit: 'data' });
  }

  clear(): void {
    this.container.clear();
  }
}
```

This is what structural directives do internally, and it is covered in the dynamic components topic.

## ng-container or ng-template?

```text
ng-container    renders its children, adds no element
ng-template     renders nothing until something asks for it
```

Use `ng-container` when you need a grouping that leaves no trace. Use `ng-template` when you want to define markup for later.

## Quick recap

- `ng-container` groups elements without adding anything to the DOM.
- It is essential inside tables and lists where a wrapper would be invalid.
- Control flow blocks removed most of the old need for it.
- `ng-template` renders nothing on its own, it defines a fragment.
- `ngTemplateOutlet` renders a template, and `ngTemplateOutletContext` passes data.
- `$implicit` is bound by a bare `let-x`, other keys by `let-x="key"`.
- Taking a `TemplateRef` as an input or via `contentChild` lets callers control rendering.

<code id="code-content" class="language-typescript">
import { Component, input, signal, contentChild, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
// ng-container groups WITHOUT adding an element. Essential inside tables.
//   &lt;tbody&gt;
//     &lt;ng-container *ngFor="let g of groups"&gt;
//       &lt;tr&gt;...&lt;/tr&gt;
//       &lt;tr *ngFor="let r of g.rows"&gt;...&lt;/tr&gt;
//     &lt;/ng-container&gt;
//   &lt;/tbody&gt;
// A wrapping div there would be invalid HTML. ng-container leaves no trace.
// ng-template renders NOTHING on its own. It defines markup for later.
@Component({
  selector: 'app-outlet-demo',
  imports: [NgTemplateOutlet],
  template: `
    &lt;ng-template #greeting&gt;&lt;p&gt;Hello there&lt;/p&gt;&lt;/ng-template&gt;
    &lt;!-- now it renders, twice --&gt;
    &lt;ng-container [ngTemplateOutlet]="greeting" /&gt;
    &lt;ng-container [ngTemplateOutlet]="greeting" /&gt;
    &lt;!-- $implicit binds to a bare let-x, named keys to let-x="key" --&gt;
    &lt;ng-template #row let-user let-i="index"&gt;
      &lt;tr&gt;&lt;td&gt;{{ i }}&lt;/td&gt;&lt;td&gt;{{ user.name }}&lt;/td&gt;&lt;/tr&gt;
    &lt;/ng-template&gt;
    &lt;ng-container
      [ngTemplateOutlet]="row"
      [ngTemplateOutletContext]="{ $implicit: { name: 'Asha' }, index: 0 }" /&gt;
  `,
})
export class OutletDemo {}
// The powerful pattern: the component owns the LOOP, the caller owns the ROW.
@Component({
  selector: 'app-repeater',
  imports: [NgTemplateOutlet],
  template: `
    @for (item of items(); track $index) {
      &lt;ng-container
        [ngTemplateOutlet]="itemTemplate()"
        [ngTemplateOutletContext]="{ $implicit: item }" /&gt;
    }
  `,
})
export class Repeater {
  readonly items = input.required&lt;unknown[]&gt;();
  readonly itemTemplate = contentChild.required(TemplateRef);
}
// Called like this. Every serious table library works this way.
//   &lt;app-repeater [items]="products()"&gt;
//     &lt;ng-template let-product&gt;&lt;app-product-card [product]="product" /&gt;&lt;/ng-template&gt;
//   &lt;/app-repeater&gt;
</code></pre>
