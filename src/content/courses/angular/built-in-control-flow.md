---
publishDate: 2026-06-04T06:50
title: 'Built-in Control Flow: @if, @for and @switch'
slug: built-in-control-flow
metadescription: Use the at-if, at-for and at-switch blocks that replaced structural directives, and understand why track matters so much.
updateDate: 2026-09-07T06:50
author: ['bishal-biswas']
level: 1
tags: ['control flow', 'templates', 'modern']
course: angular
---

## Built into the language

Angular 17 added control flow blocks to the template syntax itself. They became stable in version 18 and are now the recommended way to write conditionals and loops.

```html
@if (user()) {
  <p>Welcome back</p>
} @else {
  <p>Please sign in</p>
}
```

No imports. No asterisks. No `ng-template`. It is part of the template language, like `{{ }}`.

## at-if, at-else-if and at-else

```html
@if (status() === 'loading') {
  <app-spinner />
} @else if (status() === 'error') {
  <p class="error">Something went wrong</p>
} @else {
  <app-results [items]="items()" />
}
```

The `as` clause captures the value, which narrows the type:

```html
@if (user(); as u) {
  <p>{{ u.name }}</p>       <!-- u is User, not User | null -->
}
```

That narrowing is a genuine improvement over `*ngIf`, where you had to use `*ngIf="user as u"` and the compiler was less helpful.

## at-for and the track expression

```html
@for (user of users(); track user.id) {
  <app-user-card [user]="user" />
} @empty {
  <p>No users found</p>
}
```

Two things stand out.

**`track` is required.** The old `*ngFor` made `trackBy` optional and almost nobody used it. Making it mandatory was deliberate, because it is the single biggest performance lever in a list.

**`@empty`** handles the empty case without a separate `@if`.

## Why track matters

`track` tells Angular how to identify an item across renders. With it, Angular moves existing DOM nodes. Without a good one, it destroys and recreates them.

```html
<!-- good: a stable unique id -->
@for (user of users(); track user.id) { ... }

<!-- acceptable for a static list that never reorders -->
@for (item of items(); track $index) { ... }

<!-- bad: the object identity changes whenever data is refetched -->
@for (user of users(); track user) { ... }
```

The visible symptom of a bad `track`: an input inside the loop loses what you typed, or loses focus, whenever the list updates. Component state inside each row is destroyed and rebuilt.

Use `$index` only when the list never reorders and rows have no state. Otherwise use a stable id from the data.

## The loop variables

```html
@for (user of users(); track user.id; let i = $index, isFirst = $first) {
  <p>{{ i + 1 }}. {{ user.name }} {{ isFirst ? '(top)' : '' }}</p>
}
```

Available inside the loop:

```text
$index   position, starting at 0
$first   true for the first item
$last    true for the last item
$even    true when $index is even
$odd     true when $index is odd
$count   total number of items
```

They can be used directly without aliasing:

```html
@for (user of users(); track user.id) {
  <div [class.striped]="$even">{{ $index }}: {{ user.name }}</div>
}
```

Aliasing with `let` is needed when loops are nested and both `$index` values matter.

```html
@for (row of rows(); track row.id; let rowIndex = $index) {
  @for (cell of row.cells; track cell.id) {
    <td>{{ rowIndex }},{{ $index }}</td>
  }
}
```

## at-switch

```html
@switch (role()) {
  @case ('admin') {
    <app-admin-panel />
  }
  @case ('editor') {
    <app-editor-tools />
  }
  @default {
    <app-viewer />
  }
}
```

Comparison is strict equality, the same as `===`. There is no fall through, so no `break` is needed.

`@default` is optional. Without it, an unmatched value renders nothing.

## Why this replaced structural directives

```html
<!-- old -->
<div *ngIf="user; else guest">{{ user.name }}</div>
<ng-template #guest><p>Sign in</p></ng-template>

<!-- new -->
@if (user) {
  <div>{{ user.name }}</div>
} @else {
  <p>Sign in</p>
}
```

Four advantages, all real:

**No imports.** `*ngIf` needed `NgIf` from `CommonModule` in every component's `imports`.

**Better type narrowing.** The compiler understands the blocks natively.

**No `ng-template` gymnastics** for else and switch branches.

**Smaller bundles.** The blocks compile to direct instructions rather than pulling in directive code.

There is also no way to accidentally put two structural directives on one element, which was a common `*ngIf` and `*ngFor` mistake.

## Migrating

```bash
ng generate @angular/core:control-flow
```

That rewrites `*ngIf`, `*ngFor` and `*ngSwitch` throughout the project and removes the now unused imports. It handles most code correctly, so review the diff and move on.

## Nesting and readability

Blocks nest freely, but deep nesting in a template is as unpleasant as it is in code.

```html
@if (user(); as u) {
  @if (u.orders.length > 0) {
    @for (order of u.orders; track order.id) {
      @if (order.status === 'open') {
        <app-order [order]="order" />
      }
    }
  }
}
```

Better: move the filtering into a computed signal and keep the template flat.

```typescript
protected readonly openOrders = computed(
  () => this.user()?.orders.filter(o => o.status === 'open') ?? []
);
```

```html
@for (order of openOrders(); track order.id) {
  <app-order [order]="order" />
} @empty {
  <p>Nothing open</p>
}
```

## Common mistakes

**Forgetting `track`.** It is a compile error, which is the point.

**Tracking a mutating object.** `track user` breaks when data is refetched, since the objects are new.

**Calling a method in the loop expression.**

```html
@for (user of getUsers(); track user.id) { ... }     <!-- runs on every check -->
@for (user of users(); track user.id) { ... }        <!-- a signal, cheap -->
```

**Using `@if` where `@switch` is clearer.** Three or more branches on the same value read better as a switch.

## Quick recap

- `@if`, `@for` and `@switch` are part of the template language and need no imports.
- `@if (x; as y)` narrows the type inside the block.
- `track` is mandatory in `@for`, and a stable id is the right choice.
- A bad `track` destroys DOM and loses focus and input state.
- `@empty` handles empty lists, and `$index`, `$first` and `$last` are always available.
- `@switch` uses strict equality with no fall through.
- `ng generate @angular/core:control-flow` migrates an existing project.

<code id="code-content" class="language-typescript">
import { Component, signal, computed } from '@angular/core';
@Component({
  selector: 'app-control-flow',
  // NO imports needed. Control flow is part of the template language.
  template: `
    &lt;!-- as narrows the type: u is User, not User | null --&gt;
    @if (user(); as u) {
      &lt;p&gt;Welcome, {{ u.name }}&lt;/p&gt;
    } @else if (loading()) {
      &lt;p&gt;Loading...&lt;/p&gt;
    } @else {
      &lt;p&gt;Please sign in&lt;/p&gt;
    }
    &lt;!-- track is MANDATORY. Use a stable id, not the object. --&gt;
    @for (order of openOrders(); track order.id) {
      &lt;div [class.striped]="$even"&gt;{{ $index + 1 }}. {{ order.ref }}&lt;/div&gt;
    } @empty {
      &lt;p&gt;Nothing open&lt;/p&gt;
    }
    &lt;!-- nested loops: alias the outer index --&gt;
    @for (row of rows(); track row.id; let rowIndex = $index) {
      @for (cell of row.cells; track cell.id) {
        &lt;td&gt;{{ rowIndex }},{{ $index }}&lt;/td&gt;
      }
    }
    &lt;!-- strict equality, no fall through, no break --&gt;
    @switch (role()) {
      @case ('admin')  { &lt;app-admin-panel /&gt; }
      @case ('editor') { &lt;app-editor-tools /&gt; }
      @default         { &lt;app-viewer /&gt; }
    }
  `,
})
export class ControlFlow {
  protected readonly user = signal&lt;{ name: string; orders: Order[] } | null&gt;(null);
  protected readonly loading = signal(false);
  protected readonly role = signal&lt;'admin' | 'editor' | 'viewer'&gt;('viewer');
  protected readonly rows = signal&lt;{ id: number; cells: { id: number }[] }[]&gt;([]);
  // Filter in a computed signal, not in the template. Keeps the template flat.
  protected readonly openOrders = computed(
    () =&gt; this.user()?.orders.filter(o =&gt; o.status === 'open') ?? []);
}
interface Order { id: number; ref: string; status: string; }
// Loop variables, always available: $index $first $last $even $odd $count
// Bad track = DOM destroyed and rebuilt = inputs lose focus and typed text.
// Migrate an old codebase with:  ng generate @angular/core:control-flow
</code></pre>
