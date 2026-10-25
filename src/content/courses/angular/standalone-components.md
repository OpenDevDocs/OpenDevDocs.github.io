---
publishDate: 2026-06-02T06:30
title: Standalone Components and Component Metadata
slug: standalone-components
metadescription: Write standalone components, understand the imports array, and learn what changed now that standalone is the default.
updateDate: 2026-09-07T06:30
author: ['bishal-biswas']
level: 1
tags: ['components', 'standalone', 'metadata']
course: angular
---

## The default since Angular 19

A standalone component declares its own dependencies instead of belonging to an NgModule.

```typescript
import { Component } from '@angular/core';
import { UserCard } from './user-card';

@Component({
  selector: 'app-user-list',
  imports: [UserCard],
  template: `
    @for (user of users; track user.id) {
      <app-user-card [user]="user" />
    }
  `,
})
export class UserList {
  protected readonly users = [{ id: 1, name: 'Asha' }];
}
```

`imports` lists what this template uses. Nothing else needs to know.

You will see `standalone: true` in code written between Angular 15 and 18. It is the default now and no longer needs writing, but leaving it in causes no harm.

## Component metadata

```typescript
@Component({
  selector: 'app-user-card',
  imports: [DatePipe, RouterLink],
  templateUrl: './user-card.html',
  styleUrl: './user-card.css',
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.Emulated,
})
export class UserCard {}
```

**`selector`** is the tag name. Prefixed and kebab case by convention.

**`imports`** is every component, directive and pipe the template uses.

**`template` or `templateUrl`.** Inline for short templates, a separate file once it grows past about 20 lines.

**`styleUrl` or `styles`.** Note the singular `styleUrl`. The older plural `styleUrls` took an array and still works.

**`host`** sets attributes, classes and bindings on the component's own element.

**`changeDetection`** is covered in the performance section. `OnPush` is the right default.

## The imports array is the thing to understand

If a template uses something, that something must be imported. Angular's compiler will tell you when you forget.

```typescript
import { Component } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserAvatar } from './user-avatar';

@Component({
  selector: 'app-order',
  imports: [DatePipe, CurrencyPipe, RouterLink, UserAvatar],
  template: `
    <app-user-avatar [name]="customer" />
    <p>{{ placed | date:'medium' }}</p>
    <p>{{ total | currency:'GBP' }}</p>
    <a [routerLink]="['/orders', id]">View</a>
  `,
})
export class Order {
  protected readonly customer = 'Asha';
  protected readonly placed = new Date();
  protected readonly total = 42.5;
  protected readonly id = 7;
}
```

Four things used, four things imported. This is more typing than the NgModule approach, where a shared module imported everything once. It is also the point: you can see exactly what a component depends on by reading its top.

Unused imports are removed by the compiler, and the linter will flag them.

## What you do not import

Anything built into the template syntax needs no import.

```text
Needs importing              Built in, no import
DatePipe, CurrencyPipe       @if, @for, @switch
NgClass, NgStyle             @let, @defer
RouterLink, RouterOutlet     property and event binding
FormsModule, ReactiveFormsModule   interpolation
your own components          two-way binding syntax
```

The new control flow replaced `NgIf` and `NgFor`, which is one of the reasons it exists. No import, and better type narrowing.

## Importing an NgModule

A standalone component can import an NgModule, which is how you use libraries that have not migrated.

```typescript
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [MatButtonModule, ReactiveFormsModule],
  template: `<button mat-button>Sign in</button>`,
})
export class Login {}
```

`ReactiveFormsModule` and `FormsModule` are still modules, so classic forms need them imported here.

## Component-level providers

A component can provide its own services, giving each instance a separate copy.

```typescript
@Component({
  selector: 'app-wizard',
  imports: [],
  providers: [WizardState],      // one per <app-wizard>, not shared
  template: `...`,
})
export class Wizard {
  private readonly state = inject(WizardState);
}
```

Two wizards on the page get two independent `WizardState` instances. Contrast with `@Injectable({ providedIn: 'root' })`, which gives one instance for the whole application.

This is the cleanest way to scope state to a subtree.

## Grouping exports

A folder of related components often has an index file so callers write one import.

```typescript
// shared/ui/index.ts
export * from './button';
export * from './card';
export * from './dialog';
```

```typescript
import { Button, Card } from '@shared/ui';

@Component({
  imports: [Button, Card],
  ...
})
```

Do not create a "shared module" that re-exports everything as an NgModule. That reintroduces the problem standalone components solved, since importing it pulls in the whole set.

## What changed from NgModules

```text
NgModule world                       Standalone world
declarations: [UserCard]             UserCard declares itself standalone
imports: [CommonModule]              @if / @for are built in
exports: [UserCard]                  just export the class from its file
a SharedModule of everything         each component imports what it uses
providers: [UserService]             @Injectable({ providedIn: 'root' })
```

The trade is explicitness for convenience. A shared module meant one import line and an unknown dependency graph. Standalone means more import lines and a dependency graph you can read.

## Self-closing tags

Components with no content can be written self-closing, which reads better.

```html
<app-user-avatar [name]="user.name" />
<router-outlet />
```

`ng generate @angular/core:self-closing-tag` converts an existing codebase.

## Quick recap

- Standalone components declare their own dependencies and have been the default since Angular 19.
- `standalone: true` in older code is now redundant but harmless.
- Everything a template uses must appear in `imports`.
- Control flow, bindings and interpolation are built in and need no import.
- Classic forms still need `FormsModule` or `ReactiveFormsModule` imported.
- Component `providers` give each instance its own service, scoping state to a subtree.
- Avoid recreating a catch-all shared module, it defeats the purpose.

<code id="code-content" class="language-typescript">
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
// Standalone is the DEFAULT since Angular 19. No `standalone: true` needed.
@Component({
  selector: 'app-order',                     // prefixed, kebab case
  imports: [DatePipe, CurrencyPipe, RouterLink],   // everything the template uses
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'order-card' },             // classes on the host element
  template: `
    &lt;p&gt;{{ placed | date:'medium' }}&lt;/p&gt;
    &lt;p&gt;{{ total | currency:'GBP' }}&lt;/p&gt;
    &lt;a [routerLink]="['/orders', id]"&gt;View&lt;/a&gt;
    @if (total &gt; 100) { &lt;span&gt;Free delivery&lt;/span&gt; }
  `,
})
export class Order {
  protected readonly placed = new Date();
  protected readonly total = 142.5;
  protected readonly id = 7;
}
// Built in, NO import needed: @if @for @switch @let @defer, bindings, interpolation
// Needs importing: pipes, RouterLink, NgClass/NgStyle, FormsModule, your components
// A standalone component can still import an NgModule from a library
// imports: [MatButtonModule, ReactiveFormsModule]
// Component providers give EACH INSTANCE its own service
@Component({
  selector: 'app-wizard',
  providers: [WizardState],        // one per &lt;app-wizard&gt;, not shared
  template: `...`,
})
export class Wizard {
  private readonly state = inject(WizardState);
}
// Compare: @Injectable({ providedIn: 'root' }) is ONE instance app-wide.
// Self-closing tags read better for components with no content:
//   &lt;app-user-avatar [name]="name" /&gt;      &lt;router-outlet /&gt;
</code></pre>
