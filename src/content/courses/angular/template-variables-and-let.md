---
publishDate: 2026-06-04T07:00
title: 'Template Variables and @let'
slug: template-variables-and-let
metadescription: Reference DOM elements and components from a template, and store computed values with the at-let block.
updateDate: 2026-09-07T07:00
author: ['bishal-biswas']
level: 1
tags: ['templates', 'variables', 'let']
course: angular
---

## Reference variables

A `#name` on an element gives you a handle to it elsewhere in the template.

```html
<input #nameBox placeholder="Your name">
<button (click)="greet(nameBox.value)">Greet</button>
<p>Length: {{ nameBox.value.length }}</p>
```

On a plain HTML element, the variable is the **DOM element**. So `nameBox` is an `HTMLInputElement` with all its properties and methods.

```html
<input #box>
<button (click)="box.focus()">Focus it</button>
<button (click)="box.value = ''">Clear it</button>
```

## On a component

On a component tag, the variable is the **component instance**, not the element.

```typescript
@Component({
  selector: 'app-timer',
  template: `<p>{{ seconds() }}s</p>`,
})
export class Timer {
  readonly seconds = signal(0);
  start(): void { ... }
  reset(): void { this.seconds.set(0); }
}
```

```html
<app-timer #timer />
<button (click)="timer.start()">Start</button>
<button (click)="timer.reset()">Reset</button>
<p>Current: {{ timer.seconds() }}</p>
```

This is a quick way to drive a child component from the template without wiring inputs and outputs. Use it sparingly. It couples the parent to the child's internals, and it only works within one template.

## Getting the element from a component

```html
<app-timer #timerComponent #timerElement="ngForm" />
```

To get the DOM element of a component rather than the instance, you need a query in the class. Template variables cannot do it.

```typescript
readonly card = viewChild.required<ElementRef<HTMLElement>>('cardEl');
```

## Reading a directive

`#name="exportedName"` gives you a directive instance instead. The directive must declare an `exportAs`.

```html
<form #userForm="ngForm" (ngSubmit)="save(userForm.value)">
  <input name="email" ngModel required>
  <button [disabled]="userForm.invalid">Save</button>
</form>
```

`ngForm` is the `exportAs` name of the `NgForm` directive. Without it, `#userForm` would just be the `<form>` element.

```typescript
@Directive({
  selector: '[appTooltip]',
  exportAs: 'tooltip',
})
export class Tooltip {
  show(): void { ... }
}
```

```html
<button appTooltip #tip="tooltip" (mouseenter)="tip.show()">Hover</button>
```

## Scope

A reference variable is visible throughout the template it is declared in, but **not** inside a different template.

```html
<input #box>
<p>{{ box.value }}</p>          <!-- fine -->

@if (visible()) {
  <p>{{ box.value }}</p>        <!-- fine, same template -->
}

<ng-template>
  <p>{{ box.value }}</p>        <!-- not available -->
</ng-template>
```

Declaring one inside an `@if` or `@for` block makes it local to that block:

```html
@for (item of items(); track item.id) {
  <input #row>
  <button (click)="row.focus()">Focus</button>   <!-- this row's input -->
}
```

Each iteration gets its own `row`, which is what you want.

## at-let

`@let` declares a variable in the template. It landed in Angular 18 and solves the problem of repeating an expression.

```html
@let fullName = user().firstName + ' ' + user().lastName;
@let greeting = 'Hello, ' + fullName;

<h1>{{ greeting }}</h1>
<p>Signed in as {{ fullName }}</p>
```

Without it you would either repeat the expression or add a `computed` to the class for something used only once.

## What at-let is good for

**Unwrapping something deeply nested:**

```html
@let address = user()?.profile?.address;

<p>{{ address?.street }}</p>
<p>{{ address?.city }}</p>
<p>{{ address?.postcode }}</p>
```

**Naming an index expression inside a loop:**

```html
@for (row of rows(); track row.id) {
  @let isLastRow = $last;
  <tr [class.final]="isLastRow">...</tr>
}
```

**Avoiding a repeated pipe:**

```html
@let formatted = amount() | currency:'GBP';
<p>Subtotal: {{ formatted }}</p>
<p>Total: {{ formatted }}</p>
```

## at-let rules

**It is read only.** You cannot reassign it.

```html
@let count = 0;
<button (click)="count = 1">No</button>    <!-- error -->
```

**It must be declared before use**, reading top to bottom.

```html
<p>{{ total }}</p>       <!-- error, not declared yet -->
@let total = a + b;
```

**It is scoped to its block**, like a reference variable.

```html
@if (user()) {
  @let name = user()!.name;
}
<p>{{ name }}</p>        <!-- error, out of scope -->
```

**It is reactive.** When the expression reads a signal, the value updates as the signal changes. It is not a snapshot.

## at-let or computed?

```typescript
// in the class
protected readonly fullName = computed(
  () => `${this.user().firstName} ${this.user().lastName}`
);
```

```html
<!-- in the template -->
@let fullName = user().firstName + ' ' + user().lastName;
```

Use `computed` when the value is used by class logic, is expensive enough that caching matters, or is used in several templates.

Use `@let` when it is purely a template convenience and lives in one place. It keeps small formatting details out of the class.

## Replacing the old as pattern

`@let` cleans up something that used to be awkward.

```html
<!-- old -->
<ng-container *ngIf="user$ | async as user">
  <p>{{ user.name }}</p>
</ng-container>

<!-- newer, still fine -->
@if (user(); as u) {
  <p>{{ u.name }}</p>
}

<!-- when you do not want a conditional at all -->
@let u = user();
<p>{{ u?.name }}</p>
```

The `@if (...; as x)` form is still the right choice when you genuinely need the conditional, because it narrows the type. `@let` does not narrow.

## Common mistakes

**Expecting a reference variable to work in the class.** It does not. Use `viewChild()` for that.

**Using a reference variable across templates.** Blocks and `ng-template` create separate scopes.

**Trying to mutate an `@let`.** It is read only by design.

**Using `#ref` to reach into a child component's private state.** Templates can only see `public` and `protected` members, and reaching in at all is usually a sign the child needs a proper output.

## Quick recap

- `#name` on an element gives the DOM element, on a component gives the instance.
- `#name="exportAs"` gives a directive instance, as with `#f="ngForm"`.
- Reference variables are scoped to their template or block, not the class.
- `@let` declares a read only, reactive template variable.
- Declare `@let` before use, and remember it is scoped to its block.
- `@let` does not narrow types, so keep `@if (...; as x)` when you need narrowing.
- Prefer `computed` when class logic or several templates need the value.

<code id="code-content" class="language-typescript">
import { Component, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
@Component({
  selector: 'app-vars',
  imports: [CurrencyPipe],
  template: `
    &lt;!-- #ref on an ELEMENT gives you the DOM element --&gt;
    &lt;input #box placeholder="Your name"&gt;
    &lt;button (click)="box.focus()"&gt;Focus&lt;/button&gt;
    &lt;button (click)="greet(box.value)"&gt;Greet&lt;/button&gt;
    &lt;!-- #ref on a COMPONENT gives you the component instance --&gt;
    &lt;app-timer #timer /&gt;
    &lt;button (click)="timer.reset()"&gt;Reset&lt;/button&gt;
    &lt;p&gt;{{ timer.seconds() }}s&lt;/p&gt;
    &lt;!-- #ref="exportAs" gives you a DIRECTIVE instance --&gt;
    &lt;form #f="ngForm"&gt;&lt;button [disabled]="f.invalid"&gt;Save&lt;/button&gt;&lt;/form&gt;
    &lt;!-- @let: read only, reactive, declared before use --&gt;
    @let fullName = user().first + ' ' + user().last;
    @let formatted = amount() | currency:'GBP';
    &lt;h1&gt;Hello, {{ fullName }}&lt;/h1&gt;
    &lt;p&gt;Subtotal: {{ formatted }}&lt;/p&gt;
    &lt;p&gt;Total: {{ formatted }}&lt;/p&gt;
    &lt;!-- unwrap something deeply nested once --&gt;
    @let address = user().address;
    &lt;p&gt;{{ address?.city }}&lt;/p&gt;
    &lt;!-- each loop iteration gets its OWN #row --&gt;
    @for (item of items(); track item.id) {
      &lt;input #row&gt;
      &lt;button (click)="row.focus()"&gt;Focus this row&lt;/button&gt;
    }
    &lt;!-- @if (...; as x) NARROWS the type. @let does not. --&gt;
    @if (maybeUser(); as u) { &lt;p&gt;{{ u.first }}&lt;/p&gt; }
  `,
})
export class Vars {
  protected readonly user = signal({ first: 'Asha', last: 'B', address: { city: 'Delhi' } });
  protected readonly maybeUser = signal&lt;{ first: string } | null&gt;(null);
  protected readonly amount = signal(42.5);
  protected readonly items = signal([{ id: 1 }]);
  protected greet(name: string): void { console.log(name); }
}
// Reference variables do NOT exist in the class. Use viewChild() for that.
// @let is read only, scoped to its block, and cannot be declared after use.
</code></pre>
